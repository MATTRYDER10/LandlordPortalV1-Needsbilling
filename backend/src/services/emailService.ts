import { Resend } from 'resend';
import * as fs from 'fs';
import * as path from 'path';
import { supabase } from '../config/supabase';
import { encrypt } from './encryption';
import { getFrontendUrl } from '../utils/frontendUrl';

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY || '');

/**
 * Email Rate Limiter
 * Ensures we stay under Resend's 2 requests/second limit by enforcing
 * a minimum interval between emails (~1.5 emails/second with headroom)
 *
 * Uses slot reservation to prevent race conditions when multiple emails
 * are queued simultaneously.
 */
class EmailRateLimiter {
  private nextAllowedAt: number = 0;
  private readonly minInterval: number = 667; // ms between emails (~1.5/sec)

  async throttle<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();

    if (now < this.nextAllowedAt) {
      // Need to wait - reserve the NEXT slot before waiting
      const waitTime = this.nextAllowedAt - now;
      this.nextAllowedAt = this.nextAllowedAt + this.minInterval;
      console.log(`[Email] Rate limiting: waiting ${waitTime}ms before sending`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    } else {
      // No wait needed - reserve the next slot
      this.nextAllowedAt = now + this.minInterval;
    }

    return fn();
  }
}

const emailRateLimiter = new EmailRateLimiter();

/**
 * Log email event to reference_audit_log for Activity Log UI
 */
async function logEmailToAuditLog(
  referenceId: string,
  referenceType: string,
  status: 'sent' | 'failed' = 'sent',
  errorMessage?: string
): Promise<void> {
  try {
    const typeLabel = referenceType.charAt(0).toUpperCase() + referenceType.slice(1);
    const action = status === 'sent' ? 'EMAIL_SENT' : 'EMAIL_FAILED';
    const description =
      status === 'sent'
        ? `Email notification sent to ${typeLabel.toLowerCase()}`
        : `Email notification failed: ${errorMessage || 'Unknown error'}`;

    const { error } = await supabase.from('reference_audit_log').insert({
      reference_id: referenceId,
      action,
      description,
      metadata: { reference_type: referenceType, status, error_message: errorMessage },
      created_by: null, // System action
    });

    if (error) {
      console.error('Failed to log email to audit log:', error.message);
    }
  } catch (error) {
    console.error('Failed to log email to audit log:', error);
  }
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  attachments?: {
    filename: string;
    content: Buffer | string;
  }[];
  contactDetails?: ContactDetails;
  referenceId?: string;
  referenceType?: 'tenant' | 'guarantor' | 'landlord' | 'employer' | 'accountant' | 'agent';
}

interface ContactDetails {
  companyName?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}

const DEFAULT_CONTACT_DETAILS: ContactDetails = {
  companyName: 'PropertyGoose Support',
  email: 'hello@propertygoose.co.uk'
};

const DEFAULT_LOGO_URL = 'https://app.propertygoose.co.uk/PropertyGooseLogo.png';
const PROD_FRONTEND_URL = 'https://app.propertygoose.co.uk';
const LOCALHOST_PATTERN = /(localhost|127\.0\.0\.1)/i;

type ReferenceType = 'tenant' | 'guarantor' | 'landlord' | 'employer' | 'accountant' | 'agent';

function containsLocalhost(input?: string): boolean {
  return !!input && LOCALHOST_PATTERN.test(input);
}

function sanitizeLocalhostUrls(input: string): string {
  return input.replace(/https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/gi, PROD_FRONTEND_URL);
}

function buildReferenceLink(referenceId: string, referenceType?: ReferenceType | null): string {
  switch (referenceType) {
    case 'guarantor':
      return `${PROD_FRONTEND_URL}/guarantor-reference/${referenceId}`;
    case 'landlord':
      return `${PROD_FRONTEND_URL}/landlord-reference/${referenceId}`;
    case 'agent':
      return `${PROD_FRONTEND_URL}/agent-reference/${referenceId}`;
    case 'employer':
      return `${PROD_FRONTEND_URL}/submit-employer-reference/${referenceId}`;
    case 'accountant':
      return `${PROD_FRONTEND_URL}/accountant-reference/${referenceId}`;
    case 'tenant':
    default:
      return `${PROD_FRONTEND_URL}/submit-reference/${referenceId}`;
  }
}

async function resolveReferenceInfo(options: EmailOptions): Promise<{ referenceId: string; referenceType?: ReferenceType | null } | null> {
  if (options.referenceId) {
    if (options.referenceType) {
      return { referenceId: options.referenceId, referenceType: options.referenceType };
    }

    const { data, error } = await supabase
      .from('email_delivery_logs')
      .select('reference_id, reference_type')
      .eq('reference_id', options.referenceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data?.reference_id) {
      return { referenceId: data.reference_id, referenceType: data.reference_type as ReferenceType | null };
    }

    return { referenceId: options.referenceId, referenceType: null };
  }

  return null;
}

async function buildLocalhostFallback(options: EmailOptions): Promise<{ subject: string; html: string } | null> {
  const referenceInfo = await resolveReferenceInfo(options);
  if (!referenceInfo) {
    return null;
  }

  const link = buildReferenceLink(referenceInfo.referenceId, referenceInfo.referenceType);
  const subject = containsLocalhost(options.subject) ? 'PropertyGoose reference link' : options.subject;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:16px;color:#111827;">
      <p>Your secure reference link is ready:</p>
      <p><a href="${link}" style="color:#2563eb;">${link}</a></p>
      <p style="font-size:13px;color:#6b7280;">Reference: ${referenceInfo.referenceId}</p>
    </div>
  `;

  return { subject, html };
}

function buildContactFooter(details?: ContactDetails): string {
  if (!details) return '';

  const { companyName, phone, email, website } = details;
  if (!companyName && !phone && !email && !website) {
    return '';
  }

  const contactParts: string[] = [];
  if (phone) {
    contactParts.push(`Phone: <a href="tel:${phone}" style="color:#2563eb;text-decoration:none;">${phone}</a>`);
  }
  if (email) {
    contactParts.push(`Email: <a href="mailto:${email}" style="color:#2563eb;text-decoration:none;">${email}</a>`);
  }
  if (website) {
    contactParts.push(`<a href="${website}" style="color:#2563eb;text-decoration:none;">Website</a>`);
  }

  const contactLines = [
    companyName ? `<div style="font-weight:600;margin-bottom:4px;">${companyName}</div>` : '',
    contactParts.length ? `<div>${contactParts.join(' • ')}</div>` : ''
  ].filter(Boolean);

  if (!contactLines.length) {
    return '';
  }

  return `
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#374151;">
      <div style="font-size:13px;color:#6b7280;margin-bottom:8px;">Need help? Contact your agent:</div>
      ${contactLines.join('')}
    </div>
  `;
}

/**
 * Log email to delivery tracking table
 */
async function logEmailDelivery(data: {
  resendEmailId: string;
  referenceId?: string;
  referenceType?: string;
  toEmailEncrypted: string;
  subject: string;
  status: string;
}): Promise<void> {
  try {
    await supabase.from('email_delivery_logs').insert({
      resend_email_id: data.resendEmailId,
      reference_id: data.referenceId || null,
      reference_type: data.referenceType || null,
      to_email_encrypted: data.toEmailEncrypted,
      subject: data.subject,
      status: data.status,
    });
  } catch (error) {
    console.error('Failed to log email delivery:', error);
  }
}

/**
 * Update email delivery status from webhook
 * Called by the Resend webhook handler when delivery status changes
 */
export async function updateEmailDeliveryStatus(
  resendEmailId: string,
  status: string,
  bounceType?: string,
  errorMessage?: string
): Promise<{ referenceId: string | null; referenceType: string | null } | null> {
  try {
    // First get the existing record to return reference info
    const { data: existing } = await supabase
      .from('email_delivery_logs')
      .select('reference_id, reference_type')
      .eq('resend_email_id', resendEmailId)
      .single();

    // Update the status
    const { error } = await supabase
      .from('email_delivery_logs')
      .update({
        status,
        bounce_type: bounceType || null,
        error_message: errorMessage || null,
        status_updated_at: new Date().toISOString(),
      })
      .eq('resend_email_id', resendEmailId);

    if (error) {
      console.error('Failed to update email delivery status:', error);
      return null;
    }

    console.log(`Email status updated: ${resendEmailId} -> ${status}`);
    return existing ? { referenceId: existing.reference_id, referenceType: existing.reference_type } : null;
  } catch (error) {
    console.error('Failed to update email delivery status:', error);
    return null;
  }
}

/**
 * Log email delivery event to audit log (for bounces/complaints)
 */
export async function logEmailDeliveryToAuditLog(
  referenceId: string,
  referenceType: string,
  status: 'bounced' | 'complained',
  errorMessage?: string
): Promise<void> {
  try {
    const typeLabel = referenceType.charAt(0).toUpperCase() + referenceType.slice(1);
    const action = status === 'bounced' ? 'EMAIL_BOUNCED' : 'EMAIL_COMPLAINED';

    // Friendly descriptions for agents (technical details stored in metadata)
    const description =
      status === 'bounced'
        ? `Email to ${typeLabel.toLowerCase()} could not be delivered. Please check the email address is correct and try resending.`
        : `Email to ${typeLabel.toLowerCase()} was marked as spam. Consider contacting them by phone instead.`;

    const { error } = await supabase.from('reference_audit_log').insert({
      reference_id: referenceId,
      action,
      description,
      metadata: { reference_type: referenceType, status, technical_error: errorMessage },
      created_by: null, // System action
    });

    if (error) {
      console.error('Failed to log email delivery to audit log:', error.message);
    }
  } catch (error) {
    console.error('Failed to log email delivery to audit log:', error);
  }
}

/**
 * Internal function to send email via Resend (without rate limiting)
 */
async function sendEmailInternal(options: EmailOptions, html: string, subject: string): Promise<{ id: string } | null> {
  const { data, error } = await resend.emails.send({
    from: options.from || 'PropertyGoose <hello@notifications.propertygoose.co.uk>',
    to: options.to,
    subject,
    html,
    attachments: options.attachments,
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Check if an error is a rate limit error from Resend
 */
function isRateLimitError(error: any): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  const name = error.name?.toLowerCase() || '';
  return message.includes('too many requests') ||
    message.includes('rate limit') ||
    name.includes('rate_limit') ||
    error.statusCode === 429;
}

/**
 * Send an email using Resend with rate limiting and retry logic
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  // Dev mode check - skip actual sending in development unless explicitly enabled
  if (process.env.NODE_ENV === 'development' && !process.env.ENABLE_EMAIL_DEV) {
    console.log(`[DEV] Email skipped - would send to ${options.to}: ${options.subject}`);
    return;
  }

  const footer = buildContactFooter(options.contactDetails);
  let html = footer ? `${options.html}${footer}` : options.html;
  let subject = options.subject;

  if (containsLocalhost(subject) || containsLocalhost(html)) {
    const fallback = await buildLocalhostFallback(options);
    if (fallback) {
      console.warn(`[EmailGuard] Localhost detected, sending fallback link for ${options.to}.`);
      html = fallback.html;
      subject = fallback.subject;
    } else {
      console.warn(`[EmailGuard] Localhost detected, sanitizing content for ${options.to}.`);
      html = sanitizeLocalhostUrls(html);
      subject = containsLocalhost(subject) ? sanitizeLocalhostUrls(subject) : subject;
    }
  }

  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Use rate limiter to ensure we don't exceed Resend's rate limit
      const data = await emailRateLimiter.throttle(() =>
        sendEmailInternal(options, html, subject)
      );

      console.log(`Email sent successfully to ${options.to}`);

      // Log to email delivery tracking table
      if (data?.id) {
        const encryptedEmail = encrypt(options.to);
        if (encryptedEmail) {
          await logEmailDelivery({
            resendEmailId: data.id,
            referenceId: options.referenceId,
            referenceType: options.referenceType,
            toEmailEncrypted: encryptedEmail,
            subject,
            status: 'sent',
          });
        }
      }

      return; // Success - exit the retry loop
    } catch (error: any) {
      // If rate limited and we have retries left, wait with exponential backoff
      if (isRateLimitError(error) && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`[Email] Rate limited, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Log and rethrow for non-rate-limit errors or if retries exhausted
      console.error('Error sending email:', error);
      throw error;
    }
  }
}

/**
 * Capitalize the first letter of each word in a string
 */
function capitalizeWords(str: string): string {
  if (!str) return str;
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Load and process an email template
 */
export function loadEmailTemplate(templateName: string, variables: Record<string, string>): string {
  const templatePath = path.join(__dirname, '../../email-templates', `${templateName}.html`);

  let template = fs.readFileSync(templatePath, 'utf-8');

  // Replace all variables in the template
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    template = template.replace(regex, variables[key]);
  });

  return template;
}

/**
 * Send tenant reference request email
 */
export async function sendTenantReferenceRequest(
  tenantEmail: string,
  tenantName: string,
  referenceLink: string,
  companyName: string,
  propertyAddress?: string,
  companyPhone?: string,
  companyEmail?: string | null,
  referenceId?: string,
  agentLogoUrl?: string | null
): Promise<void> {
  const contactInfo = companyPhone ? `${companyName} on ${companyPhone}` : companyName

  const html = loadEmailTemplate('tenant-reference-request', {
    TenantName: capitalizeWords(tenantName),
    CompanyName: companyName,
    ReferenceLink: referenceLink,
    PropertyAddress: capitalizeWords(propertyAddress || ''),
    ContactInfo: contactInfo,
    AgentLogoUrl: agentLogoUrl || DEFAULT_LOGO_URL,
  });

  try {
    await sendEmail({
      to: tenantEmail,
      subject: 'Complete Your Tenant Reference - PropertyGoose',
      html,
      contactDetails: {
        companyName,
        phone: companyPhone,
        email: companyEmail || undefined
      },
      referenceId,
      referenceType: 'tenant'
    });

    if (referenceId) {
      await logEmailToAuditLog(referenceId, 'tenant', 'sent');
    }
  } catch (error: any) {
    if (referenceId) {
      await logEmailToAuditLog(referenceId, 'tenant', 'failed', error.message);
    }
    throw error;
  }
}

/**
 * Send employer reference request email
 */
export async function sendEmployerReferenceRequest(
  employerEmail: string,
  employerName: string,
  tenantName: string,
  referenceLink: string,
  agentCompanyName?: string | null,
  agentPhone?: string | null,
  agentEmail?: string | null,
  referenceId?: string,
  agentLogoUrl?: string | null
): Promise<void> {
  const html = loadEmailTemplate('employer-reference-request', {
    EmployerName: employerName,
    TenantName: tenantName,
    ReferenceLink: referenceLink,
    AgentCompanyName: agentCompanyName || '',
    AgentPhone: agentPhone || '',
    AgentEmail: agentEmail || '',
    AgentLogoUrl: agentLogoUrl || DEFAULT_LOGO_URL,
  });

  try {
    await sendEmail({
      to: employerEmail,
      subject: 'Employment Reference Request - PropertyGoose',
      html,
      contactDetails: {
        companyName: agentCompanyName || undefined,
        phone: agentPhone || undefined,
        email: agentEmail || undefined
      },
      referenceId,
      referenceType: 'employer'
    });

    if (referenceId) {
      await logEmailToAuditLog(referenceId, 'employer', 'sent');
    }
  } catch (error: any) {
    if (referenceId) {
      await logEmailToAuditLog(referenceId, 'employer', 'failed', error.message);
    }
    throw error;
  }
}

/**
 * Send landlord reference request email
 */
export async function sendLandlordReferenceRequest(
  landlordEmail: string,
  landlordName: string,
  tenantName: string,
  referenceLink: string,
  agentCompanyName?: string | null,
  agentPhone?: string | null,
  agentEmail?: string | null,
  referenceId?: string,
  agentLogoUrl?: string | null
): Promise<void> {
  const html = loadEmailTemplate('landlord-reference-request', {
    LandlordName: landlordName,
    TenantName: tenantName,
    ReferenceLink: referenceLink,
    AgentCompanyName: agentCompanyName || '',
    AgentPhone: agentPhone || '',
    AgentEmail: agentEmail || '',
    AgentLogoUrl: agentLogoUrl || DEFAULT_LOGO_URL,
  });

  try {
    await sendEmail({
      to: landlordEmail,
      subject: 'Landlord Reference Request - PropertyGoose',
      html,
      contactDetails: {
        companyName: agentCompanyName || undefined,
        phone: agentPhone || undefined,
        email: agentEmail || undefined
      },
      referenceId,
      referenceType: 'landlord'
    });

    if (referenceId) {
      await logEmailToAuditLog(referenceId, 'landlord', 'sent');
    }
  } catch (error: any) {
    if (referenceId) {
      await logEmailToAuditLog(referenceId, 'landlord', 'failed', error.message);
    }
    throw error;
  }
}

/**
 * Send accountant reference request email
 */
export async function sendAccountantReferenceRequest(
  accountantEmail: string,
  accountantName: string,
  tenantName: string,
  referenceLink: string,
  agentCompanyName?: string | null,
  agentPhone?: string | null,
  agentEmail?: string | null,
  referenceId?: string
): Promise<void> {
  const html = loadEmailTemplate('accountant-reference-request', {
    AccountantName: accountantName,
    TenantName: tenantName,
    ReferenceLink: referenceLink,
    Year: new Date().getFullYear().toString(),
    AgentCompanyName: agentCompanyName || '',
    AgentPhone: agentPhone || '',
    AgentEmail: agentEmail || '',
  });

  try {
    await sendEmail({
      to: accountantEmail,
      subject: 'Accountant Reference Request - PropertyGoose',
      html,
      contactDetails: {
        companyName: agentCompanyName || undefined,
        phone: agentPhone || undefined,
        email: agentEmail || undefined
      },
      referenceId,
      referenceType: 'accountant'
    });

    if (referenceId) {
      await logEmailToAuditLog(referenceId, 'accountant', 'sent');
    }
  } catch (error: any) {
    if (referenceId) {
      await logEmailToAuditLog(referenceId, 'accountant', 'failed', error.message);
    }
    throw error;
  }
}

/**
 * Send agent reference request email
 */
export async function sendAgentReferenceRequest(
  agentEmail: string,
  agentName: string,
  tenantName: string,
  referenceLink: string,
  agentCompanyName?: string | null,
  agentPhone?: string | null,
  agentEmailContact?: string | null,
  referenceId?: string,
  agentLogoUrl?: string | null
): Promise<void> {
  const html = loadEmailTemplate('agent-reference-request', {
    AgentName: agentName,
    TenantName: tenantName,
    ReferenceLink: referenceLink,
    AgentCompanyName: agentCompanyName || '',
    AgentPhone: agentPhone || '',
    AgentEmail: agentEmailContact || '',
    AgentLogoUrl: agentLogoUrl || DEFAULT_LOGO_URL,
  });

  try {
    await sendEmail({
      to: agentEmail,
      subject: 'Agent Reference Request - PropertyGoose',
      html,
      contactDetails: {
        companyName: agentCompanyName || undefined,
        phone: agentPhone || undefined,
        email: agentEmailContact || undefined
      },
      referenceId,
      referenceType: 'agent'
    });

    if (referenceId) {
      await logEmailToAuditLog(referenceId, 'agent', 'sent');
    }
  } catch (error: any) {
    if (referenceId) {
      await logEmailToAuditLog(referenceId, 'agent', 'failed', error.message);
    }
    throw error;
  }
}

/**
 * Send user invitation email
 */
export async function sendUserInvitation(
  inviteeEmail: string,
  inviterName: string,
  companyName: string,
  role: string,
  invitationUrl: string,
  expiresAt: string
): Promise<void> {
  const html = loadEmailTemplate('invite-user', {
    InviterName: inviterName,
    CompanyName: companyName,
    Role: role.charAt(0).toUpperCase() + role.slice(1),
    InvitationUrl: invitationUrl,
    ExpiresAt: expiresAt,
  });

  await sendEmail({
    to: inviteeEmail,
    subject: `You've been invited to join ${companyName} on PropertyGoose`,
    html,
    contactDetails: {
      companyName
    }
  });
}

/**
 * Send guarantor request notification to agent
 */
export async function sendGuarantorRequestNotification(
  agentEmail: string,
  agentName: string,
  tenantName: string,
  guarantorName: string,
  guarantorEmail: string,
  guarantorPhone: string,
  relationship: string,
  propertyAddress: string
): Promise<void> {
  const html = loadEmailTemplate('guarantor-request-notification', {
    AgentName: agentName,
    TenantName: tenantName,
    PropertyAddress: propertyAddress,
    GuarantorName: guarantorName,
    GuarantorEmail: guarantorEmail,
    GuarantorPhone: guarantorPhone,
    Relationship: relationship
  });

  await sendEmail({
    to: agentEmail,
    subject: `Guarantor Required - ${tenantName} - PropertyGoose`,
    html,
    contactDetails: DEFAULT_CONTACT_DETAILS
  });
}

/**
 * Send guarantor reference request directly to guarantor
 */
export async function sendGuarantorReferenceRequest(
  guarantorEmail: string,
  guarantorName: string,
  tenantName: string,
  propertyAddress: string,
  agentName: string,
  agentPhone: string,
  agentEmail: string,
  formLink: string,
  referenceId?: string,
  agentLogoUrl?: string | null
): Promise<void> {
  const html = loadEmailTemplate('guarantor-reference-request', {
    GuarantorName: guarantorName,
    TenantName: tenantName,
    PropertyAddress: propertyAddress,
    AgentName: agentName,
    AgentPhone: agentPhone,
    AgentEmail: agentEmail,
    FormLink: formLink,
    AgentLogoUrl: agentLogoUrl || DEFAULT_LOGO_URL,
  });

  try {
    await sendEmail({
      to: guarantorEmail,
      subject: `Guarantor Reference Request - ${tenantName} - PropertyGoose`,
      html,
      contactDetails: {
        companyName: agentName,
        phone: agentPhone,
        email: agentEmail
      },
      referenceId,
      referenceType: 'guarantor'
    });

    if (referenceId) {
      await logEmailToAuditLog(referenceId, 'guarantor', 'sent');
    }
  } catch (error: any) {
    if (referenceId) {
      await logEmailToAuditLog(referenceId, 'guarantor', 'failed', error.message);
    }
    throw error;
  }
}

/**
 * Send email to tenant requesting them to add guarantor details
 * Sent when reference completes with PASS_WITH_GUARANTOR and no guarantor exists
 */
export async function sendTenantAddGuarantorRequest(
  tenantEmail: string,
  tenantName: string,
  propertyAddress: string,
  agentName: string,
  formLink: string,
  referenceId?: string
): Promise<void> {
  const html = loadEmailTemplate('tenant-add-guarantor-request', {
    TenantName: tenantName,
    PropertyAddress: propertyAddress,
    AgentName: agentName,
    FormLink: formLink
  });

  try {
    await sendEmail({
      to: tenantEmail,
      subject: `Guarantor Required for Your Application - ${propertyAddress} - PropertyGoose`,
      html,
      contactDetails: {
        companyName: agentName
      },
      referenceId,
      referenceType: 'tenant'
    });

    if (referenceId) {
      await logEmailToAuditLog(referenceId, 'tenant_add_guarantor', 'sent');
    }
  } catch (error: any) {
    if (referenceId) {
      await logEmailToAuditLog(referenceId, 'tenant_add_guarantor', 'failed', error.message);
    }
    throw error;
  }
}

/**
 * Send consent PDF to tenant
 */
export async function sendConsentPDFToTenant(
  tenantEmail: string,
  tenantName: string,
  pdfBuffer: Buffer,
  pdfFilename: string,
  companyName?: string | null,
  companyPhone?: string | null,
  companyEmail?: string | null
): Promise<void> {
  const html = loadEmailTemplate('consent-pdf', {
    TenantName: tenantName,
  });

  await sendEmail({
    to: tenantEmail,
    subject: 'Your Referencing Consent Declaration - PropertyGoose',
    html,
    attachments: [
      {
        filename: pdfFilename,
        content: pdfBuffer,
      }
    ],
    contactDetails: {
      companyName: companyName || undefined,
      phone: companyPhone || undefined,
      email: companyEmail || undefined
    }
  });
}

/**
 * Send sanctions screening alert to company/agent
 */
export async function sendSanctionsAlert(
  companyEmail: string,
  tenantName: string,
  propertyAddress: string,
  riskLevel: string,
  totalMatches: number,
  summary: string,
  recommendedAction: string,
  referenceLink: string,
  screeningDate: string
): Promise<void> {
  const html = loadEmailTemplate('sanctions-alert', {
    TenantName: capitalizeWords(tenantName),
    PropertyAddress: capitalizeWords(propertyAddress),
    RiskLevel: riskLevel.toUpperCase(),
    TotalMatches: String(totalMatches),
    Summary: summary,
    RecommendedAction: recommendedAction,
    ReferenceLink: referenceLink,
    ScreeningDate: new Date(screeningDate).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  });

  await sendEmail({
    to: companyEmail,
    subject: `⚠️ URGENT: Sanctions Screening Alert - ${tenantName}`,
    html,
    contactDetails: DEFAULT_CONTACT_DETAILS
  });
}

/**
 * Send reference completion notification to agent
 */
export async function sendReferenceCompletedNotification(
  agentEmail: string,
  agentName: string,
  tenantName: string,
  propertyAddress: string,
  dashboardLink: string,
  completedDate: string
): Promise<void> {
  const html = loadEmailTemplate('reference-completed-notification', {
    AgentName: agentName,
    TenantName: capitalizeWords(tenantName),
    PropertyAddress: capitalizeWords(propertyAddress),
    DashboardLink: dashboardLink,
    CompletedDate: new Date(completedDate).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  });

  await sendEmail({
    to: agentEmail,
    subject: `Reference Completed - ${tenantName} - PropertyGoose`,
    html,
    contactDetails: {
      companyName: agentName,
      email: agentEmail
    }
  });
}

/**
 * Send verification report with PDF attachment to agent
 */
export async function sendVerificationReportToAgent(
  agentEmail: string,
  agentName: string,
  tenantName: string,
  propertyAddress: string,
  decision: string,
  dashboardLink: string,
  completedDate: string,
  pdfBuffer: Buffer,
  pdfFilename: string
): Promise<void> {
  // Format decision for display (e.g., "PASS_WITH_GUARANTOR" -> "Pass With Guarantor")
  const formattedDecision = decision
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  const html = loadEmailTemplate('verification-report-notification', {
    AgentName: agentName,
    TenantName: capitalizeWords(tenantName),
    PropertyAddress: capitalizeWords(propertyAddress),
    Decision: formattedDecision,
    DashboardLink: dashboardLink,
    CompletedDate: new Date(completedDate).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  });

  await sendEmail({
    to: agentEmail,
    subject: `Verification Report - ${tenantName} - PropertyGoose`,
    html,
    attachments: [
      {
        filename: pdfFilename,
        content: pdfBuffer
      }
    ],
    contactDetails: DEFAULT_CONTACT_DETAILS
  });
}

/**
 * Send landlord verification request email (for AML checks)
 */
export async function sendLandlordVerificationRequest(
  landlordEmail: string,
  landlordName: string,
  verificationLink: string,
  companyId: string
): Promise<void> {
  // Get company name for email
  const { supabase } = await import('../config/supabase')
  const { decrypt } = await import('./encryption')

  const { data: company } = await supabase
    .from('companies')
    .select('name_encrypted, phone_encrypted, email_encrypted, logo_url')
    .eq('id', companyId)
    .single()

  const companyName = company?.name_encrypted ? decrypt(company.name_encrypted) : 'PropertyGoose'
  const companyPhone = company?.phone_encrypted ? decrypt(company.phone_encrypted) : ''
  const companyEmail = company?.email_encrypted ? decrypt(company.email_encrypted) : ''
  const companyLogoUrl = company?.logo_url || null

  const html = loadEmailTemplate('landlord-verification-request', {
    LandlordName: landlordName,
    VerificationLink: verificationLink,
    Year: new Date().getFullYear().toString(),
    CompanyName: companyName || '',
    AgentLogoUrl: companyLogoUrl || DEFAULT_LOGO_URL,
  })

  await sendEmail({
    to: landlordEmail,
    subject: 'Landlord Verification Request - PropertyGoose',
    html,
    contactDetails: {
      companyName: companyName || undefined,
      phone: companyPhone || undefined,
      email: companyEmail || undefined
    }
  })
}

/**
 * Send tenant offer form request email
 */
export async function sendTenantOfferRequest(
  tenantEmail: string,
  offerLink: string,
  companyName: string,
  propertyAddress?: string,
  companyPhone?: string,
  companyEmail?: string | null
): Promise<void> {
  const contactInfo = companyPhone ? `${companyName} on ${companyPhone}` : companyName

  const html = loadEmailTemplate('tenant-offer-request', {
    CompanyName: companyName,
    OfferLink: offerLink,
    PropertyAddress: capitalizeWords(propertyAddress || ''),
    ContactInfo: contactInfo,
  })

  await sendEmail({
    to: tenantEmail,
    subject: 'Submit Your Rental Offer - PropertyGoose',
    html,
    contactDetails: {
      companyName,
      phone: companyPhone || undefined,
      email: companyEmail || undefined
    }
  })
}

/**
 * Send offer accepted email with bank details
 */
export async function sendOfferAcceptedEmail(
  tenantEmail: string,
  companyName: string,
  bankAccountName: string,
  bankAccountNumber: string,
  bankSortCode: string,
  holdingDepositAmount: number,
  offerId: string,
  companyPhone?: string | null,
  companyEmail?: string | null,
  extraDetailsHtml?: string
): Promise<void> {
  const frontendBaseUrl = getFrontendUrl()
  const paymentConfirmedUrl = `${frontendBaseUrl}/tenant-offer/payment-confirmed?offer_id=${offerId}`

  const html = loadEmailTemplate('offer-accepted', {
    CompanyName: companyName,
    BankAccountName: bankAccountName,
    BankAccountNumber: bankAccountNumber,
    BankSortCode: bankSortCode,
    HoldingDepositAmount: holdingDepositAmount.toFixed(2),
    ExtraDetailsHtml: extraDetailsHtml || '',
    PaymentConfirmedUrl: paymentConfirmedUrl
  })

  await sendEmail({
    to: tenantEmail,
    subject: 'Congratulations — Your Offer Has Been Accepted!',
    html,
    contactDetails: {
      companyName,
      phone: companyPhone || undefined,
      email: companyEmail || undefined
    }
  })
}

/**
 * Send offer declined email with reason
 */
export async function sendOfferDeclinedEmail(
  tenantEmail: string,
  companyName: string,
  declineReason: string,
  companyPhone?: string | null,
  companyEmail?: string | null
): Promise<void> {
  const html = loadEmailTemplate('offer-declined', {
    CompanyName: companyName,
    DeclineReason: declineReason,
  })

  await sendEmail({
    to: tenantEmail,
    subject: 'Update on Your Offer',
    html,
    contactDetails: {
      companyName,
      phone: companyPhone || undefined,
      email: companyEmail || undefined
    }
  })
}

/**
 * Send payment confirmed notification email to agent
 */
export async function sendPaymentConfirmedToAgentEmail(
  agentEmail: string,
  propertyAddress: string,
  tenantNames: string,
  holdingDepositAmount: string,
  offerLink: string
): Promise<void> {
  const confirmedAt = new Date().toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })

  const html = loadEmailTemplate('tenant-payment-confirmed', {
    PropertyAddress: propertyAddress,
    TenantNames: tenantNames,
    HoldingDepositAmount: holdingDepositAmount,
    ConfirmedAt: confirmedAt,
    OfferLink: offerLink
  })

  await sendEmail({
    to: agentEmail,
    subject: 'Tenant Confirmed Holding Deposit Payment',
    html
  })
}

/**
 * Status label and color mapping for verification states
 */
const VERIFICATION_STATE_LABELS: Record<string, { label: string; color: string }> = {
  SENT: { label: 'Sent', color: '#6b7280' },
  COLLECTING_EVIDENCE: { label: 'In Progress', color: '#3b82f6' },
  WAITING_ON_REFERENCES: { label: 'Awaiting References', color: '#eab308' },
  READY_FOR_REVIEW: { label: 'Ready for Review', color: '#8b5cf6' },
  IN_VERIFICATION: { label: 'Being Verified', color: '#8b5cf6' },
  ACTION_REQUIRED: { label: 'Action Required', color: '#f97316' },
  COMPLETED: { label: 'Verified', color: '#22c55e' },
  REJECTED: { label: 'Failed', color: '#ef4444' },
  CANCELLED: { label: 'Cancelled', color: '#6b7280' }
}

/**
 * Decision display mapping for verification decisions
 */
const DECISION_DISPLAY: Record<string, { display: string; bgColor: string; borderColor: string; textColor: string }> = {
  PASS: { display: 'Verified', bgColor: '#dcfce7', borderColor: '#22c55e', textColor: '#166534' },
  PASS_WITH_CONDITION: { display: 'Verified with Conditions', bgColor: '#fef9c3', borderColor: '#eab308', textColor: '#854d0e' },
  PASS_WITH_GUARANTOR: { display: 'Accepted - Guarantor Required', bgColor: '#ffedd5', borderColor: '#f97316', textColor: '#9a3412' },
  REFER: { display: 'Referred to Agent', bgColor: '#dbeafe', borderColor: '#3b82f6', textColor: '#1e40af' },
  FAIL: { display: 'Failed Verification', bgColor: '#fee2e2', borderColor: '#ef4444', textColor: '#991b1b' }
}

/**
 * Section type display labels
 */
const SECTION_TYPE_LABELS: Record<string, string> = {
  IDENTITY_SELFIE: 'Identity Verification',
  RTR: 'Right to Rent',
  INCOME: 'Income Verification',
  RESIDENTIAL: 'Residency History',
  CREDIT: 'Credit Check',
  AML: 'AML Screening',
  EMPLOYER_REFERENCE: 'Employer Reference',
  LANDLORD_REFERENCE: 'Landlord Reference',
  ACCOUNTANT_REFERENCE: 'Accountant Reference'
}

interface GroupMember {
  name: string
  role: 'TENANT' | 'GUARANTOR'
  guarantorFor?: string
  status: string
  statusColor: string
}

interface GroupStatusResult {
  members: GroupMember[]
  propertyAddress: string
  agentEmail: string
  agentName: string
  companyId: string
}

/**
 * Get all references in a tenancy group with their statuses for email notifications
 */
async function getGroupStatusForEmail(referenceId: string): Promise<GroupStatusResult | null> {
  try {
    const { decrypt } = await import('./encryption')

    // First get the reference to determine its group
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select(`
        id,
        tenant_first_name_encrypted,
        tenant_last_name_encrypted,
        property_address_encrypted,
        verification_state,
        company_id,
        parent_reference_id,
        is_group_parent,
        is_guarantor,
        guarantor_for_reference_id
      `)
      .eq('id', referenceId)
      .single()

    if (refError || !reference) {
      console.error('[getGroupStatusForEmail] Reference not found:', refError)
      return null
    }

    // Determine the group parent ID
    let groupParentId: string | null = null
    if (reference.is_group_parent) {
      groupParentId = reference.id
    } else if (reference.parent_reference_id) {
      groupParentId = reference.parent_reference_id
    }

    // Get all references in the group (siblings + guarantors)
    const members: GroupMember[] = []

    if (groupParentId) {
      // Fetch all children of this parent
      const { data: siblings } = await supabase
        .from('tenant_references')
        .select(`
          id,
          tenant_first_name_encrypted,
          tenant_last_name_encrypted,
          verification_state,
          is_guarantor,
          guarantor_for_reference_id
        `)
        .eq('parent_reference_id', groupParentId)
        .order('tenant_position', { ascending: true })

      if (siblings) {
        for (const sibling of siblings) {
          if (!sibling.is_guarantor) {
            const firstName = decrypt(sibling.tenant_first_name_encrypted) || ''
            const lastName = decrypt(sibling.tenant_last_name_encrypted) || ''
            const stateInfo = VERIFICATION_STATE_LABELS[sibling.verification_state] || { label: sibling.verification_state, color: '#6b7280' }

            members.push({
              name: `${firstName} ${lastName}`.trim(),
              role: 'TENANT',
              status: stateInfo.label,
              statusColor: stateInfo.color
            })

            // Check for guarantors for this tenant
            const { data: guarantors } = await supabase
              .from('tenant_references')
              .select(`
                id,
                tenant_first_name_encrypted,
                tenant_last_name_encrypted,
                verification_state
              `)
              .eq('guarantor_for_reference_id', sibling.id)
              .eq('is_guarantor', true)

            if (guarantors) {
              for (const guarantor of guarantors) {
                const gFirstName = decrypt(guarantor.tenant_first_name_encrypted) || ''
                const gLastName = decrypt(guarantor.tenant_last_name_encrypted) || ''
                const gStateInfo = VERIFICATION_STATE_LABELS[guarantor.verification_state] || { label: guarantor.verification_state, color: '#6b7280' }

                members.push({
                  name: `${gFirstName} ${gLastName}`.trim(),
                  role: 'GUARANTOR',
                  guarantorFor: `${firstName} ${lastName}`.trim(),
                  status: gStateInfo.label,
                  statusColor: gStateInfo.color
                })
              }
            }
          }
        }
      }
    } else {
      // Standalone reference - just add this reference
      const firstName = decrypt(reference.tenant_first_name_encrypted) || ''
      const lastName = decrypt(reference.tenant_last_name_encrypted) || ''
      const stateInfo = VERIFICATION_STATE_LABELS[reference.verification_state] || { label: reference.verification_state, color: '#6b7280' }

      members.push({
        name: `${firstName} ${lastName}`.trim(),
        role: reference.is_guarantor ? 'GUARANTOR' : 'TENANT',
        status: stateInfo.label,
        statusColor: stateInfo.color
      })

      // Check for guarantors for this standalone reference
      const { data: guarantors } = await supabase
        .from('tenant_references')
        .select(`
          id,
          tenant_first_name_encrypted,
          tenant_last_name_encrypted,
          verification_state
        `)
        .eq('guarantor_for_reference_id', reference.id)
        .eq('is_guarantor', true)

      if (guarantors) {
        for (const guarantor of guarantors) {
          const gFirstName = decrypt(guarantor.tenant_first_name_encrypted) || ''
          const gLastName = decrypt(guarantor.tenant_last_name_encrypted) || ''
          const gStateInfo = VERIFICATION_STATE_LABELS[guarantor.verification_state] || { label: guarantor.verification_state, color: '#6b7280' }

          members.push({
            name: `${gFirstName} ${gLastName}`.trim(),
            role: 'GUARANTOR',
            guarantorFor: `${firstName} ${lastName}`.trim(),
            status: gStateInfo.label,
            statusColor: gStateInfo.color
          })
        }
      }
    }

    // Get company details for agent email
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted, email_encrypted, reference_notification_email_encrypted')
      .eq('id', reference.company_id)
      .single()

    // Prefer reference_notification_email, fallback to company email
    let agentEmail = ''
    if (company?.reference_notification_email_encrypted) {
      agentEmail = decrypt(company.reference_notification_email_encrypted) || ''
    }
    if (!agentEmail && company?.email_encrypted) {
      agentEmail = decrypt(company.email_encrypted) || ''
    }

    const agentName = company?.name_encrypted ? decrypt(company.name_encrypted) || '' : ''
    const propertyAddress = decrypt(reference.property_address_encrypted) || ''

    return {
      members,
      propertyAddress,
      agentEmail,
      agentName,
      companyId: reference.company_id
    }
  } catch (error) {
    console.error('[getGroupStatusForEmail] Error:', error)
    return null
  }
}

/**
 * Build HTML for the group status table in emails
 */
function buildGroupStatusHtml(members: GroupMember[]): string {
  if (members.length <= 1) {
    return '' // No table needed for single applicant
  }

  let rows = ''
  for (const member of members) {
    const roleDisplay = member.role === 'GUARANTOR'
      ? `Guarantor${member.guarantorFor ? ` (for ${member.guarantorFor})` : ''}`
      : 'Tenant'

    rows += `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">
          ${member.name}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">
          ${roleDisplay}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">
          <span style="display: inline-block; padding: 2px 8px; background-color: ${member.statusColor}20; color: ${member.statusColor}; border-radius: 4px; font-size: 12px; font-weight: 500;">
            ${member.status}
          </span>
        </td>
      </tr>
    `
  }

  return `
    <h2 style="margin: 24px 0 16px; font-size: 18px; font-weight: 600; color: #111827;">Property Group Status:</h2>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 24px; border: 1px solid #e5e7eb; border-radius: 6px;">
      <tr style="background-color: #f9fafb;">
        <th style="padding: 10px 12px; text-align: left; font-size: 13px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Name</th>
        <th style="padding: 10px 12px; text-align: left; font-size: 13px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Role</th>
        <th style="padding: 10px 12px; text-align: left; font-size: 13px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Status</th>
      </tr>
      ${rows}
    </table>
  `
}

/**
 * Send verification complete notification to agent
 * Includes optional PDF attachment for pass decisions
 */
export async function sendVerificationCompleteNotification(
  referenceId: string,
  decision: string,
  pdfUrl?: string | null
): Promise<void> {
  try {
    const { decrypt } = await import('./encryption')

    // Get group status information
    const groupStatus = await getGroupStatusForEmail(referenceId)
    if (!groupStatus || !groupStatus.agentEmail) {
      console.error('[sendVerificationCompleteNotification] Could not get group status or agent email')
      return
    }

    // Get the reference for tenant name
    const { data: reference } = await supabase
      .from('tenant_references')
      .select('tenant_first_name_encrypted, tenant_last_name_encrypted')
      .eq('id', referenceId)
      .single()

    if (!reference) {
      console.error('[sendVerificationCompleteNotification] Reference not found')
      return
    }

    const tenantFirstName = decrypt(reference.tenant_first_name_encrypted) || ''
    const tenantLastName = decrypt(reference.tenant_last_name_encrypted) || ''
    const tenantName = `${tenantFirstName} ${tenantLastName}`.trim()

    // Get decision display info
    const decisionInfo = DECISION_DISPLAY[decision] || DECISION_DISPLAY.PASS

    // Build group status HTML
    const groupStatusHtml = buildGroupStatusHtml(groupStatus.members)

    // Build PDF attachment notice HTML
    const pdfNoticeHtml = pdfUrl ? `
      <div style="margin: 24px 0; padding: 16px; background-color: #dbeafe; border-left: 4px solid #3b82f6; border-radius: 4px;">
        <p style="margin: 0 0 8px; font-size: 14px; line-height: 20px; color: #1e40af;">
          <strong>Verification Report Attached</strong>
        </p>
        <p style="margin: 0; font-size: 14px; line-height: 20px; color: #1e40af;">
          The full verification report PDF is attached to this email for your records.
        </p>
      </div>
    ` : ''

    const frontendBaseUrl = getFrontendUrl()
    const dashboardLink = `${frontendBaseUrl}/references/${referenceId}`

    const html = loadEmailTemplate('verification-complete-notification', {
      AgentName: groupStatus.agentName || 'there',
      TenantName: capitalizeWords(tenantName),
      PropertyAddress: capitalizeWords(groupStatus.propertyAddress),
      DecisionDisplay: decisionInfo.display,
      DecisionBgColor: decisionInfo.bgColor,
      DecisionBorderColor: decisionInfo.borderColor,
      DecisionTextColor: decisionInfo.textColor,
      CompletedDate: new Date().toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      DashboardLink: dashboardLink,
      GroupStatusSection: groupStatusHtml,
      PdfAttachmentNotice: pdfNoticeHtml
    })

    // Prepare attachments if PDF URL is provided
    let attachments: { filename: string; content: Buffer }[] | undefined

    if (pdfUrl && ['PASS', 'PASS_WITH_CONDITION', 'PASS_WITH_GUARANTOR'].includes(decision)) {
      try {
        // Fetch PDF from storage
        const response = await fetch(pdfUrl)
        if (response.ok) {
          const pdfBuffer = Buffer.from(await response.arrayBuffer())
          const sanitizedName = tenantName.replace(/[^a-zA-Z0-9]/g, '_')
          attachments = [{
            filename: `Verification_Report_${sanitizedName}.pdf`,
            content: pdfBuffer
          }]
        } else {
          console.error('[sendVerificationCompleteNotification] Failed to fetch PDF:', response.status)
        }
      } catch (pdfError) {
        console.error('[sendVerificationCompleteNotification] Error fetching PDF:', pdfError)
      }
    }

    await sendEmail({
      to: groupStatus.agentEmail,
      subject: `Verification Complete - ${tenantName} - PropertyGoose`,
      html,
      attachments,
      referenceId,
      referenceType: 'agent'
    })

    // Log to audit
    await logEmailToAuditLog(referenceId, 'verification_complete', 'sent')
    console.log(`[sendVerificationCompleteNotification] Email sent to ${groupStatus.agentEmail} for reference ${referenceId}`)
  } catch (error: any) {
    console.error('[sendVerificationCompleteNotification] Error:', error)
    await logEmailToAuditLog(referenceId, 'verification_complete', 'failed', error.message)
  }
}

/**
 * Send action required notification to agent
 */
export async function sendActionRequiredNotification(
  referenceId: string,
  sectionType: string,
  reasonCode: string,
  agentNote: string
): Promise<void> {
  try {
    const { decrypt } = await import('./encryption')

    // Get group status information
    const groupStatus = await getGroupStatusForEmail(referenceId)
    if (!groupStatus || !groupStatus.agentEmail) {
      console.error('[sendActionRequiredNotification] Could not get group status or agent email')
      return
    }

    // Get the reference for tenant name
    const { data: reference } = await supabase
      .from('tenant_references')
      .select('tenant_first_name_encrypted, tenant_last_name_encrypted')
      .eq('id', referenceId)
      .single()

    if (!reference) {
      console.error('[sendActionRequiredNotification] Reference not found')
      return
    }

    const tenantFirstName = decrypt(reference.tenant_first_name_encrypted) || ''
    const tenantLastName = decrypt(reference.tenant_last_name_encrypted) || ''
    const tenantName = `${tenantFirstName} ${tenantLastName}`.trim()

    // Get section type display label
    const sectionLabel = SECTION_TYPE_LABELS[sectionType] || sectionType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

    // Format reason code as readable label
    const reasonLabel = reasonCode.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

    // Build group status HTML
    const groupStatusHtml = buildGroupStatusHtml(groupStatus.members)

    const frontendBaseUrl = getFrontendUrl()
    const dashboardLink = `${frontendBaseUrl}/references/${referenceId}`

    const html = loadEmailTemplate('action-required-notification', {
      AgentName: groupStatus.agentName || 'there',
      TenantName: capitalizeWords(tenantName),
      PropertyAddress: capitalizeWords(groupStatus.propertyAddress),
      SectionType: sectionLabel,
      ReasonLabel: reasonLabel,
      AgentNote: agentNote,
      DashboardLink: dashboardLink,
      GroupStatusSection: groupStatusHtml
    })

    await sendEmail({
      to: groupStatus.agentEmail,
      subject: `Action Required - ${tenantName} - PropertyGoose`,
      html,
      referenceId,
      referenceType: 'agent'
    })

    // Log to audit
    await logEmailToAuditLog(referenceId, 'action_required', 'sent')
    console.log(`[sendActionRequiredNotification] Email sent to ${groupStatus.agentEmail} for reference ${referenceId}`)
  } catch (error: any) {
    console.error('[sendActionRequiredNotification] Error:', error)
    await logEmailToAuditLog(referenceId, 'action_required', 'failed', error.message)
  }
}

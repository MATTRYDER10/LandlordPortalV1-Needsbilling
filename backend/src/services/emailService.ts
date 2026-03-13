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
  private emailCount: number = 0;

  async throttle<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const emailNum = ++this.emailCount;

    console.log(`[EmailRateLimiter] Email #${emailNum}: now=${now}, nextAllowedAt=${this.nextAllowedAt}`);

    if (now < this.nextAllowedAt) {
      // Need to wait - reserve the NEXT slot before waiting
      const waitTime = this.nextAllowedAt - now;
      this.nextAllowedAt = this.nextAllowedAt + this.minInterval;
      console.log(`[EmailRateLimiter] Email #${emailNum}: Rate limiting - waiting ${waitTime}ms, next slot reserved at ${this.nextAllowedAt}`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      console.log(`[EmailRateLimiter] Email #${emailNum}: Wait complete, proceeding to send`);
    } else {
      // No wait needed - reserve the next slot
      this.nextAllowedAt = now + this.minInterval;
      console.log(`[EmailRateLimiter] Email #${emailNum}: No wait needed, next slot reserved at ${this.nextAllowedAt}`);
    }

    try {
      const result = await fn();
      console.log(`[EmailRateLimiter] Email #${emailNum}: ✓ Send completed successfully`);
      return result;
    } catch (error: any) {
      console.error(`[EmailRateLimiter] Email #${emailNum}: ✗ Send failed: ${error.message}`);
      throw error;
    }
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
  cc?: string | string[];
  replyTo?: string;
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

// Pattern to detect local/private URLs: localhost, 127.x.x.x, 192.168.x.x, 10.x.x.x, 172.16-31.x.x
const LOCAL_URL_PATTERN = /(localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})/i;

type ReferenceType = 'tenant' | 'guarantor' | 'landlord' | 'employer' | 'accountant' | 'agent';

/**
 * Check if we should allow local URLs (for local testing only)
 * NEVER allow in production, even if USE_LOCAL_EMAIL_LINKS is set
 */
function shouldAllowLocalUrls(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  return process.env.USE_LOCAL_EMAIL_LINKS === 'true';
}

function containsLocalUrl(input?: string): boolean {
  return !!input && LOCAL_URL_PATTERN.test(input);
}

function sanitizeLocalUrls(input: string): string {
  // NEVER allow local URLs in production
  if (process.env.NODE_ENV === 'production') {
    return input.replace(/https?:\/\/(localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?/gi, PROD_FRONTEND_URL);
  }
  // In development, only sanitize if local links not explicitly enabled
  if (shouldAllowLocalUrls()) {
    return input;
  }
  return input.replace(/https?:\/\/(localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?/gi, PROD_FRONTEND_URL);
}

function buildReferenceLink(referenceId: string, referenceType?: ReferenceType | null): string {
  // Use getFrontendUrl() which respects USE_LOCAL_EMAIL_LINKS
  const baseUrl = getFrontendUrl();
  switch (referenceType) {
    case 'guarantor':
      return `${baseUrl}/guarantor-reference/${referenceId}`;
    case 'landlord':
      return `${baseUrl}/landlord-reference/${referenceId}`;
    case 'agent':
      return `${baseUrl}/agent-reference/${referenceId}`;
    case 'employer':
      return `${baseUrl}/submit-employer-reference/${referenceId}`;
    case 'accountant':
      return `${baseUrl}/accountant-reference/${referenceId}`;
    case 'tenant':
    default:
      return `${baseUrl}/submit-reference/${referenceId}`;
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
  const subject = containsLocalUrl(options.subject) ? 'PropertyGoose reference link' : options.subject;

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
  console.log(`[Resend] Calling Resend API for: ${options.to}`);
  console.log(`[Resend] Subject: ${subject}`);
  if (options.cc) console.log(`[Resend] CC: ${Array.isArray(options.cc) ? options.cc.join(', ') : options.cc}`);
  console.log(`[Resend] Attachments: ${options.attachments?.length || 0} files`);
  if (options.attachments) {
    options.attachments.forEach((att, i) => {
      const size = typeof att.content === 'string' ? att.content.length : att.content?.length || 0;
      console.log(`[Resend] Attachment ${i + 1}: ${att.filename} (${size} bytes)`);
    });
  }

  const emailPayload: any = {
    from: options.from || 'PropertyGoose <hello@notifications.propertygoose.co.uk>',
    to: options.to,
    subject,
    html,
    attachments: options.attachments,
  };

  if (options.cc) {
    emailPayload.cc = options.cc;
  }
  if (options.replyTo) {
    emailPayload.reply_to = options.replyTo;
  }

  const { data, error } = await resend.emails.send(emailPayload);

  if (error) {
    console.error(`[Resend] API error for ${options.to}:`, JSON.stringify(error));
    throw error;
  }

  console.log(`[Resend] ✓ API success for ${options.to}, email ID: ${data?.id}`);
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
  console.log(`[sendEmail] Called - to: ${options.to}, subject: ${options.subject}, attachments: ${options.attachments?.length || 0}`)

  // Dev mode check - skip actual sending in development unless explicitly enabled
  if (process.env.NODE_ENV === 'development' && !process.env.ENABLE_EMAIL_DEV) {
    console.log(`[DEV] ⚠️ Email SKIPPED (dev mode) - would send to ${options.to}: ${options.subject}`);
    console.log(`[DEV] To enable emails in dev mode, set ENABLE_EMAIL_DEV=true`);
    return;
  }

  const footer = buildContactFooter(options.contactDetails);
  let html = footer ? `${options.html}${footer}` : options.html;
  let subject = options.subject;

  // Always sanitize local/private URLs in production, regardless of env vars
  // In development, only sanitize if USE_LOCAL_EMAIL_LINKS is not enabled
  if (!shouldAllowLocalUrls() && (containsLocalUrl(subject) || containsLocalUrl(html))) {
    const fallback = await buildLocalhostFallback(options);
    if (fallback) {
      console.warn(`[EmailGuard] Local/private URL detected, sending fallback link for ${options.to}.`);
      html = fallback.html;
      subject = fallback.subject;
    } else {
      console.warn(`[EmailGuard] Local/private URL detected, sanitizing content for ${options.to}.`);
      html = sanitizeLocalUrls(html);
      subject = containsLocalUrl(subject) ? sanitizeLocalUrls(subject) : subject;
    }
  } else if (shouldAllowLocalUrls() && containsLocalUrl(html)) {
    console.log(`[EmailGuard] Local URLs allowed (USE_LOCAL_EMAIL_LINKS=true, non-production) for ${options.to}`);
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
  agentLogoUrl?: string | null,
  fullPropertyRent?: number,
  guaranteeingShare?: number
): Promise<void> {
  // Format rent amounts for display
  const formatCurrency = (amount?: number): string => {
    if (!amount) return ''
    return amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // Build the financial details section conditionally
  let financialDetailsSection = ''
  if (fullPropertyRent && guaranteeingShare) {
    financialDetailsSection = `
      <div style="margin: 0 0 24px; padding: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
        <p style="margin: 0 0 12px; font-size: 16px; font-weight: 600; color: #111827;">Financial Details:</p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="padding: 8px 0; font-size: 14px; color: #4b5563;">Full property rent:</td>
            <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #111827; text-align: right;">£${formatCurrency(fullPropertyRent)}/month</td>
          </tr>
          <tr>
            <td colspan="2" style="border-top: 1px solid #e2e8f0;"></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-size: 14px; color: #4b5563;">Your guaranteeing share:</td>
            <td style="padding: 8px 0; font-size: 16px; font-weight: 700; color: #059669; text-align: right;">£${formatCurrency(guaranteeingShare)}/month</td>
          </tr>
        </table>
      </div>
    `
  }

  const html = loadEmailTemplate('guarantor-reference-request', {
    GuarantorName: guarantorName,
    TenantName: tenantName,
    PropertyAddress: propertyAddress,
    AgentName: agentName,
    AgentPhone: agentPhone,
    AgentEmail: agentEmail,
    FormLink: formLink,
    AgentLogoUrl: agentLogoUrl || DEFAULT_LOGO_URL,
    FinancialDetailsSection: financialDetailsSection,
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
 * Send email to agent when reference completes with guarantor required but no guarantor added
 * Agent needs to manually add guarantor through the UI
 */
export async function sendAgentGuarantorReminder(
  agentEmail: string,
  tenantName: string,
  propertyAddress: string,
  companyName: string,
  dashboardUrl: string,
  agentLogoUrl: string | null,
  referenceId?: string
): Promise<void> {
  const html = loadEmailTemplate('agent-guarantor-reminder', {
    TenantName: tenantName,
    PropertyAddress: propertyAddress,
    CompanyName: companyName,
    DashboardUrl: dashboardUrl,
    AgentLogoUrl: agentLogoUrl || 'https://app.propertygoose.co.uk/PropertyGooseLogo.png'
  });

  try {
    await sendEmail({
      to: agentEmail,
      subject: `Action Required: Add Guarantor for ${tenantName} - PropertyGoose`,
      html,
      contactDetails: {
        companyName: companyName
      },
      referenceId,
      referenceType: 'tenant'
    });

    if (referenceId) {
      await logEmailToAuditLog(referenceId, 'agent_guarantor_reminder', 'sent');
    }
  } catch (error: any) {
    if (referenceId) {
      await logEmailToAuditLog(referenceId, 'agent_guarantor_reminder', 'failed', error.message);
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
 * Send CreditSafe error alert to PropertyGoose team
 */
export async function sendCreditsafeErrorAlert(
  errorType: string,
  errorMessage: string
): Promise<void> {
  const recipients = ['info@propertygoose.co.uk', 'craig@propertygoose.co.uk']

  const html = loadEmailTemplate('creditsafe-error-alert', {
    ErrorType: errorType,
    ErrorMessage: errorMessage,
    ErrorTime: new Date().toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  })

  for (const recipient of recipients) {
    await sendEmail({
      to: recipient,
      subject: `⚠️ CreditSafe Service Error - ${errorType}`,
      html,
      contactDetails: DEFAULT_CONTACT_DETAILS
    })
  }
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
  companyEmail?: string | null,
  agentLogoUrl?: string | null
): Promise<void> {
  const contactInfo = companyPhone ? `${companyName} on ${companyPhone}` : companyName

  const html = loadEmailTemplate('tenant-offer-request', {
    CompanyName: companyName,
    OfferLink: offerLink,
    PropertyAddress: capitalizeWords(propertyAddress || ''),
    ContactInfo: contactInfo,
    AgentLogoUrl: agentLogoUrl || DEFAULT_LOGO_URL
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
  extraDetailsHtml?: string,
  agentLogoUrl?: string | null
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
    PaymentConfirmedUrl: paymentConfirmedUrl,
    AgentLogoUrl: agentLogoUrl || DEFAULT_LOGO_URL
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
  companyEmail?: string | null,
  agentLogoUrl?: string | null
): Promise<void> {
  const html = loadEmailTemplate('offer-declined', {
    CompanyName: companyName,
    DeclineReason: declineReason,
    AgentLogoUrl: agentLogoUrl || DEFAULT_LOGO_URL,
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
  agentLogoUrl?: string
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
      .select('name_encrypted, email_encrypted, reference_notification_email, logo_url')
      .eq('id', reference.company_id)
      .single()

    // Prefer reference_notification_email (plaintext), fallback to company email (encrypted)
    let agentEmail = ''
    if (company?.reference_notification_email) {
      agentEmail = company.reference_notification_email
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
      companyId: reference.company_id,
      agentLogoUrl: company?.logo_url || ''
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
      PdfAttachmentNotice: pdfNoticeHtml,
      AgentLogoUrl: groupStatus.agentLogoUrl || 'https://app.propertygoose.co.uk/logo.png',
      CompanyName: groupStatus.agentName || 'Property Goose'
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

/**
 * Additional charge item for initial monies
 */
interface AdditionalChargeItem {
  name: string
  amount: number
}

/**
 * Send initial monies request email to tenant
 */
export async function sendInitialMoniesRequest(
  tenantEmail: string,
  tenantName: string,
  propertyAddress: string,
  firstMonthRent: number,
  depositAmount: number,
  additionalCharges: AdditionalChargeItem[],
  holdingDepositPaid: number,
  bankDetails: { accountName: string; accountNumber: string; sortCode: string },
  dueDate: string,
  paymentReference: string,
  confirmPaymentLink: string,
  companyName: string,
  companyDetails?: ContactDetails,
  agentLogoUrl?: string | null
): Promise<void> {
  // Calculate totals
  const additionalChargesTotal = additionalCharges.reduce((sum, charge) => sum + charge.amount, 0)
  const grossTotal = firstMonthRent + depositAmount + additionalChargesTotal
  const finalMoniesDue = grossTotal - holdingDepositPaid

  // Build additional charges rows HTML
  let additionalChargesRows = ''
  if (additionalCharges.length > 0) {
    for (const charge of additionalCharges) {
      additionalChargesRows += `
                                    <tr>
                                        <td style="padding: 8px 0;">${charge.name}</td>
                                        <td style="padding: 8px 0; text-align: right; font-weight: 500;">&pound;${charge.amount.toFixed(2)}</td>
                                    </tr>`
    }
  }

  // Format currency values
  const formatCurrency = (amount: number) => `&pound;${amount.toFixed(2)}`

  const html = loadEmailTemplate('initial-monies-request', {
    TenantName: capitalizeWords(tenantName),
    PropertyAddress: capitalizeWords(propertyAddress),
    FirstMonthRent: formatCurrency(firstMonthRent),
    DepositAmount: formatCurrency(depositAmount),
    AdditionalChargesRows: additionalChargesRows,
    GrossTotal: formatCurrency(grossTotal),
    HoldingDepositPaid: formatCurrency(holdingDepositPaid),
    FinalMoniesDue: formatCurrency(finalMoniesDue),
    BankAccountName: bankDetails.accountName,
    BankAccountNumber: bankDetails.accountNumber,
    BankSortCode: bankDetails.sortCode,
    PaymentReference: paymentReference,
    DueDate: dueDate,
    ConfirmPaymentLink: confirmPaymentLink,
    CompanyName: companyName,
    AgentLogoUrl: agentLogoUrl || DEFAULT_LOGO_URL
  })

  await sendEmail({
    to: tenantEmail,
    subject: `Initial Monies Request - ${propertyAddress} - PropertyGoose`,
    html,
    contactDetails: companyDetails
  })

  console.log(`[sendInitialMoniesRequest] Email sent to ${tenantEmail} for ${propertyAddress}`)
}

/**
 * Send notification to agent that tenant has confirmed payment
 */
export async function sendTenantPaymentConfirmedNotification(
  agentEmail: string,
  propertyAddress: string,
  tenantName: string,
  amountDue: number,
  tenancyLink: string,
  companyName?: string
): Promise<void> {
  const confirmedAt = new Date().toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="font-size: 24px; color: #111827; margin-bottom: 24px;">Tenant Payment Confirmed</h1>

      <p style="font-size: 16px; color: #4b5563; line-height: 24px;">
        <strong>${tenantName}</strong> has confirmed that they have paid the initial monies for:
      </p>

      <p style="font-size: 18px; font-weight: 600; color: #111827; margin: 16px 0;">
        ${propertyAddress}
      </p>

      <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 24px 0;">
        <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">Amount Due</p>
        <p style="margin: 0; font-size: 20px; font-weight: 600; color: #111827;">&pound;${amountDue.toFixed(2)}</p>
        <p style="margin: 12px 0 0; font-size: 14px; color: #6b7280;">Confirmed at: ${confirmedAt}</p>
      </div>

      <p style="font-size: 16px; color: #4b5563; line-height: 24px;">
        Please verify the payment has been received in your bank account and then confirm receipt in the tenancy record.
      </p>

      <div style="margin: 24px 0; text-align: center;">
        <a href="${tenancyLink}" style="display: inline-block; padding: 12px 24px; background-color: #fe7a0f; color: #ffffff; text-decoration: none; border-radius: 9999px; font-size: 15px; font-weight: 600;">
          View Tenancy
        </a>
      </div>
    </div>
  `

  await sendEmail({
    to: agentEmail,
    subject: `Payment Confirmed - ${tenantName} - ${propertyAddress}`,
    html,
    contactDetails: {
      companyName: companyName || undefined
    }
  })

  console.log(`[sendTenantPaymentConfirmedNotification] Email sent to ${agentEmail}`)
}

/**
 * Compliance document for move-in pack
 */
interface ComplianceDocument {
  name: string
  url: string
  type: string
}

/**
 * Send move-in pack email to tenants
 */
export async function sendMoveInPack(
  tenants: { email: string; name: string }[],
  propertyAddress: string,
  moveInDate: string,
  rentAmount: number,
  rentDueDay: number,
  depositAmount: number | null,
  depositScheme: string | null,
  documents: ComplianceDocument[],
  contactDetails: { name: string; email: string; phone: string },
  companyName: string,
  agentLogoUrl?: string | null
): Promise<void> {
  // Build document list HTML
  let documentListHtml = ''
  if (documents.length > 0) {
    documentListHtml = '<ul style="margin: 0; padding-left: 20px;">'
    for (const doc of documents) {
      documentListHtml += `
        <li style="margin-bottom: 8px;">
          <a href="${doc.url}" style="color: #2563eb; text-decoration: none; font-weight: 500;">${doc.name}</a>
          <span style="color: #6b7280; font-size: 14px;"> (${doc.type})</span>
        </li>`
    }
    documentListHtml += '</ul>'
  } else {
    documentListHtml = '<p style="color: #6b7280; font-style: italic;">No compliance documents currently available.</p>'
  }

  // Format deposit scheme label
  const depositSchemeLabels: Record<string, string> = {
    dps: 'Deposit Protection Service (DPS)',
    mydeposits: 'mydeposits',
    tds: 'Tenancy Deposit Scheme (TDS)',
    custodial: 'Custodial Scheme',
    insured: 'Insured Scheme'
  }
  const depositSchemeLabel = depositScheme ? (depositSchemeLabels[depositScheme] || depositScheme) : 'To be confirmed'

  // Format contact block
  const contactBlock = `
    <p style="margin: 4px 0;"><strong>${contactDetails.name}</strong></p>
    ${contactDetails.email ? `<p style="margin: 4px 0;">Email: <a href="mailto:${contactDetails.email}" style="color: #2563eb;">${contactDetails.email}</a></p>` : ''}
    ${contactDetails.phone ? `<p style="margin: 4px 0;">Phone: <a href="tel:${contactDetails.phone}" style="color: #2563eb;">${contactDetails.phone}</a></p>` : ''}
  `

  // Send to each tenant
  for (const tenant of tenants) {
    const html = loadEmailTemplate('move-in-pack', {
      TenantName: capitalizeWords(tenant.name),
      PropertyAddress: capitalizeWords(propertyAddress),
      MoveInDate: moveInDate,
      MonthlyRent: `&pound;${rentAmount.toFixed(2)}`,
      RentDueDay: ordinalSuffix(rentDueDay),
      DepositAmount: depositAmount ? `&pound;${depositAmount.toFixed(2)}` : 'None',
      DepositScheme: depositSchemeLabel,
      DocumentList: documentListHtml,
      HowToRentLink: 'https://www.gov.uk/government/publications/how-to-rent/how-to-rent-the-checklist-for-renting-in-england',
      ContactBlock: contactBlock,
      CompanyName: companyName,
      AgentLogoUrl: agentLogoUrl || DEFAULT_LOGO_URL
    })

    await sendEmail({
      to: tenant.email,
      subject: `Welcome to Your New Home - ${propertyAddress}`,
      html,
      contactDetails: {
        companyName,
        email: contactDetails.email,
        phone: contactDetails.phone
      }
    })

    console.log(`[sendMoveInPack] Email sent to ${tenant.email} for ${propertyAddress}`)
  }
}

/**
 * Send enhanced move-in pack with management info and rent payment details
 */
export async function sendEnhancedMoveInPack(
  tenants: { email: string; name: string }[],
  propertyAddress: string,
  moveInDate: string,
  rentAmount: number,
  rentDueDay: number,
  depositAmount: number | null,
  depositScheme: string | null,
  documents: ComplianceDocument[],
  contactDetails: { name: string; email: string; phone: string },
  companyName: string,
  agentLogoUrl: string | null | undefined,
  managementInfoHtml: string,
  rentPaymentHtml: string,
  additionalInfoHtml: string
): Promise<void> {
  // Build document list HTML
  let documentListHtml = ''
  if (documents.length > 0) {
    documentListHtml = '<ul style="margin: 0; padding-left: 20px;">'
    for (const doc of documents) {
      documentListHtml += `
        <li style="margin-bottom: 8px;">
          <a href="${doc.url}" style="color: #2563eb; text-decoration: none; font-weight: 500;">${doc.name}</a>
          <span style="color: #6b7280; font-size: 14px;"> (${doc.type})</span>
        </li>`
    }
    documentListHtml += '</ul>'
  } else {
    documentListHtml = '<p style="color: #6b7280; font-style: italic;">No compliance documents currently available.</p>'
  }

  // Format deposit scheme label
  const depositSchemeLabels: Record<string, string> = {
    dps: 'Deposit Protection Service (DPS)',
    dps_custodial: 'DPS (Custodial)',
    dps_insured: 'DPS (Insured)',
    mydeposits: 'mydeposits',
    mydeposits_custodial: 'mydeposits (Custodial)',
    mydeposits_insured: 'mydeposits (Insured)',
    tds: 'Tenancy Deposit Scheme (TDS)',
    tds_custodial: 'TDS (Custodial)',
    tds_insured: 'TDS (Insured)',
    custodial: 'Custodial Scheme',
    insured: 'Insured Scheme'
  }
  const depositSchemeLabel = depositScheme ? (depositSchemeLabels[depositScheme] || depositScheme) : 'To be confirmed'

  // Format contact block
  const contactBlock = `
    <p style="margin: 4px 0;"><strong>${contactDetails.name}</strong></p>
    ${contactDetails.email ? `<p style="margin: 4px 0;">Email: <a href="mailto:${contactDetails.email}" style="color: #2563eb;">${contactDetails.email}</a></p>` : ''}
    ${contactDetails.phone ? `<p style="margin: 4px 0;">Phone: <a href="tel:${contactDetails.phone}" style="color: #2563eb;">${contactDetails.phone}</a></p>` : ''}
  `

  // Send to each tenant
  for (const tenant of tenants) {
    const html = loadEmailTemplate('move-in-pack-enhanced', {
      TenantName: capitalizeWords(tenant.name),
      PropertyAddress: capitalizeWords(propertyAddress),
      MoveInDate: moveInDate,
      MonthlyRent: `&pound;${rentAmount.toFixed(2)}`,
      RentDueDay: ordinalSuffix(rentDueDay),
      DepositAmount: depositAmount ? `&pound;${depositAmount.toFixed(2)}` : 'None',
      DepositScheme: depositSchemeLabel,
      DocumentList: documentListHtml,
      HowToRentLink: 'https://www.gov.uk/government/publications/how-to-rent/how-to-rent-the-checklist-for-renting-in-england',
      ContactBlock: contactBlock,
      CompanyName: companyName,
      AgentLogoUrl: agentLogoUrl || DEFAULT_LOGO_URL,
      ManagementInfoSection: managementInfoHtml,
      RentPaymentSection: rentPaymentHtml,
      AdditionalInfoSection: additionalInfoHtml
    })

    await sendEmail({
      to: tenant.email,
      subject: `Welcome to Your New Home - ${propertyAddress}`,
      html,
      contactDetails: {
        companyName,
        email: contactDetails.email,
        phone: contactDetails.phone
      }
    })

    console.log(`[sendEnhancedMoveInPack] Email sent to ${tenant.email} for ${propertyAddress}`)
  }
}

/**
 * Send move-in time request email to tenant
 */
export async function sendMoveInTimeRequest(
  tenantEmail: string,
  tenantName: string,
  propertyAddress: string,
  moveInDate: string,
  selectTimeLink: string,
  companyName: string,
  contactDetails: { phone?: string; email?: string },
  agentLogoUrl?: string | null
): Promise<void> {
  // Build logo HTML - use agent logo or PropertyGoose fallback
  const logoHtml = agentLogoUrl
    ? `<img src="${agentLogoUrl}" alt="${companyName}" style="height: 48px; width: auto;">`
    : `<img src="${DEFAULT_LOGO_URL}" alt="PropertyGoose" style="height: 48px; width: auto;">`

  // Build contact sections
  const contactPhone = contactDetails.phone
    ? `<p style="margin: 4px 0;">Phone: <a href="tel:${contactDetails.phone}" style="color: #2563eb;">${contactDetails.phone}</a></p>`
    : ''
  const contactEmail = contactDetails.email
    ? `<p style="margin: 4px 0;">Email: <a href="mailto:${contactDetails.email}" style="color: #2563eb;">${contactDetails.email}</a></p>`
    : ''

  const html = loadEmailTemplate('move-in-time-request', {
    TenantName: capitalizeWords(tenantName),
    PropertyAddress: capitalizeWords(propertyAddress),
    MoveInDate: moveInDate,
    SelectTimeLink: selectTimeLink,
    CompanyName: companyName,
    LogoHtml: logoHtml,
    ContactPhone: contactPhone,
    ContactEmail: contactEmail
  })

  await sendEmail({
    to: tenantEmail,
    subject: `Choose Your Move-In Time - ${propertyAddress}`,
    html,
    contactDetails: {
      companyName: companyName,
      email: contactDetails.email,
      phone: contactDetails.phone
    }
  })

  console.log(`[sendMoveInTimeRequest] Email sent to ${tenantEmail} for ${propertyAddress}`)
}

/**
 * Send move-in time suggestions email to tenant (agent-suggested times)
 */
export async function sendMoveInTimeSuggestions(
  tenantEmail: string,
  tenantName: string,
  propertyAddress: string,
  moveInDate: string,
  suggestedTime1: string,
  suggestedTime2: string,
  confirmTimeLink: string,
  companyName: string,
  contactDetails: { phone?: string; email?: string },
  agentLogoUrl?: string | null
): Promise<void> {
  // Build logo HTML - use agent logo or PropertyGoose fallback
  const logoHtml = agentLogoUrl
    ? `<img src="${agentLogoUrl}" alt="${companyName}" style="height: 48px; width: auto;">`
    : `<img src="${DEFAULT_LOGO_URL}" alt="PropertyGoose" style="height: 48px; width: auto;">`

  // Build contact sections
  const contactPhone = contactDetails.phone
    ? `<p style="margin: 4px 0;">Phone: <a href="tel:${contactDetails.phone}" style="color: #2563eb;">${contactDetails.phone}</a></p>`
    : ''
  const contactEmail = contactDetails.email
    ? `<p style="margin: 4px 0;">Email: <a href="mailto:${contactDetails.email}" style="color: #2563eb;">${contactDetails.email}</a></p>`
    : ''

  const html = loadEmailTemplate('move-in-time-suggestions', {
    TenantName: capitalizeWords(tenantName),
    PropertyAddress: capitalizeWords(propertyAddress),
    MoveInDate: moveInDate,
    SuggestedTime1: suggestedTime1,
    SuggestedTime2: suggestedTime2,
    ConfirmTimeLink: confirmTimeLink,
    CompanyName: companyName,
    LogoHtml: logoHtml,
    ContactPhone: contactPhone,
    ContactEmail: contactEmail
  })

  await sendEmail({
    to: tenantEmail,
    subject: `Confirm Your Move-In Time - ${propertyAddress}`,
    html,
    contactDetails: {
      companyName: companyName,
      email: contactDetails.email,
      phone: contactDetails.phone
    }
  })

  console.log(`[sendMoveInTimeSuggestions] Email sent to ${tenantEmail} for ${propertyAddress}`)
}

/**
 * Send notification to agent when tenant submits move-in time preferences
 */
export async function sendMoveInTimeSubmittedNotification(
  agentEmail: string,
  tenantName: string,
  propertyAddress: string,
  moveInDate: string,
  timeSlot1: string,
  timeSlot2: string,
  tenantNotes: string | null,
  viewTenancyLink: string,
  companyName: string,
  agentLogoUrl?: string | null
): Promise<void> {
  // Build logo HTML
  const logoHtml = agentLogoUrl
    ? `<img src="${agentLogoUrl}" alt="${companyName}" style="height: 48px; width: auto;">`
    : `<img src="${DEFAULT_LOGO_URL}" alt="PropertyGoose" style="height: 48px; width: auto;">`

  // Build tenant notes section if provided
  const tenantNotesSection = tenantNotes
    ? `<div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #e5e7eb;">
        <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Tenant Notes</p>
        <p style="margin: 0; font-size: 15px; color: #374151;">${tenantNotes}</p>
       </div>`
    : ''

  const html = loadEmailTemplate('move-in-time-submitted', {
    TenantName: capitalizeWords(tenantName),
    PropertyAddress: capitalizeWords(propertyAddress),
    MoveInDate: moveInDate,
    TimeSlot1: timeSlot1,
    TimeSlot2: timeSlot2,
    TenantNotesSection: tenantNotesSection,
    ViewTenancyLink: viewTenancyLink,
    CompanyName: companyName,
    LogoHtml: logoHtml
  })

  await sendEmail({
    to: agentEmail,
    subject: `Move-In Time Submitted - ${tenantName} - ${propertyAddress}`,
    html
  })

  console.log(`[sendMoveInTimeSubmittedNotification] Email sent to ${agentEmail} for ${propertyAddress}`)
}

/**
 * Send move-in time confirmation email with .ics calendar invite
 */
export async function sendMoveInTimeConfirmation(
  recipientEmail: string,
  recipientName: string,
  propertyAddress: string,
  moveInDate: string,
  confirmedTime: string,
  companyName: string,
  contactDetails: ContactDetails | null,
  companyLogoUrl?: string | null,
  icsContent?: string
): Promise<void> {
  const html = loadEmailTemplate('move-in-time-confirmed', {
    RecipientName: capitalizeWords(recipientName) || 'there',
    PropertyAddress: capitalizeWords(propertyAddress),
    MoveInDate: moveInDate,
    ConfirmedTime: confirmedTime,
    CompanyName: companyName,
    CompanyPhone: contactDetails?.phone || '',
    CompanyEmail: contactDetails?.email || '',
    ContactSection: contactDetails ? `
      <p style="margin: 0; font-size: 14px; line-height: 20px; color: #4b5563;">
        If you have any questions, please contact ${companyName}:
        ${contactDetails.phone ? `<br>Phone: ${contactDetails.phone}` : ''}
        ${contactDetails.email ? `<br>Email: ${contactDetails.email}` : ''}
      </p>
    ` : '',
    AgentLogoUrl: companyLogoUrl || 'https://app.propertygoose.co.uk/PropertyGooseLogo.png'
  })

  // Prepare .ics attachment
  const attachments = icsContent ? [{
    filename: 'move-in-appointment.ics',
    content: Buffer.from(icsContent, 'utf-8'),
    contentType: 'text/calendar; method=REQUEST'
  }] : undefined

  await sendEmail({
    to: recipientEmail,
    subject: `Move-In Confirmed - ${confirmedTime} on ${moveInDate} - ${propertyAddress}`,
    html,
    attachments
  })

  console.log(`[sendMoveInTimeConfirmation] Email sent to ${recipientEmail} for ${propertyAddress}`)
}

interface CustomTenantEmailOptions {
  to: string
  subject: string
  message: string
  replyTo?: string
  cc?: string | string[]
  attachments?: Array<{
    filename: string
    content: Buffer
  }>
  branding?: any
}

/**
 * Send a custom email to a tenant with optional attachments
 * Uses branded template when branding is available
 */
export async function sendCustomTenantEmail(options: CustomTenantEmailOptions): Promise<void> {
  const { to, subject, message, replyTo, cc, attachments, branding } = options

  // Convert newlines to HTML paragraphs
  const formattedMessage = message
    .split('\n\n')
    .map(para => `<p style="margin: 0 0 16px 0; font-size: 14px; line-height: 24px; color: #374151;">${para.replace(/\n/g, '<br>')}</p>`)
    .join('')

  // Use branded template if branding exists, otherwise use simple template
  let html: string
  if (branding && branding.primaryColor) {
    html = loadEmailTemplate('custom-tenant-email', {
      Subject: subject,
      MessageBody: formattedMessage,
      PrimaryColor: branding.primaryColor || '#f97316',
      CompanyName: branding.companyName || 'Property Management',
      AgentLogoUrl: branding.logoUrl || 'https://app.propertygoose.co.uk/PropertyGooseLogo.png'
    })
  } else {
    // Fallback to PropertyGoose branded template
    html = loadEmailTemplate('custom-tenant-email', {
      Subject: subject,
      MessageBody: formattedMessage,
      PrimaryColor: '#f97316',
      CompanyName: 'PropertyGoose',
      AgentLogoUrl: 'https://app.propertygoose.co.uk/PropertyGooseLogo.png'
    })
  }

  await sendEmail({
    to,
    subject,
    html,
    cc,
    replyTo,
    attachments
  })

  console.log(`[sendCustomTenantEmail] Email sent to ${to}${cc ? ` (CC: ${Array.isArray(cc) ? cc.join(', ') : cc})` : ''} with subject: ${subject}`)
}

/**
 * Helper to format a date string for display in emails
 */
function formatDateForEmail(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

interface Section8NoticeOptions {
  to: string
  tenantName: string
  propertyAddress: string
  grounds: Array<{
    number: number
    title: string
    details: string
  }>
  noticeDate: string
  earliestCourtDate: string
  companyName: string
  branding?: any
}

/**
 * Send Section 8 Notice (seeking possession) to tenant
 */
export async function sendSection8Notice(options: Section8NoticeOptions): Promise<void> {
  const {
    to,
    tenantName,
    propertyAddress,
    grounds,
    noticeDate,
    earliestCourtDate,
    companyName,
    branding
  } = options

  const templateVariables: Record<string, string> = {
    TenantName: tenantName,
    PropertyAddress: propertyAddress,
    NoticeDate: formatDateForEmail(noticeDate),
    EarliestCourtDate: formatDateForEmail(earliestCourtDate),
    CompanyName: companyName,
    GroundsList: grounds.map(g =>
      `<tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #dc2626; width: 80px;">Ground ${g.number}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${g.title}${g.details ? `<br><span style="color: #6b7280; font-size: 13px;">${g.details}</span>` : ''}</td>
      </tr>`
    ).join('\n'),
    // Branding
    LogoUrl: branding?.logo_url || '',
    PrimaryColor: branding?.primary_color || '#f97316',
    CompanyWebsite: branding?.website || ''
  }

  const html = loadEmailTemplate('section-8-notice', templateVariables)

  await sendEmail({
    to,
    subject: `Important Legal Notice: Section 8 Notice Seeking Possession - ${propertyAddress}`,
    html
  })

  console.log(`[sendSection8Notice] Section 8 notice sent to ${to} for ${propertyAddress}`)
}

/**
 * Helper to add ordinal suffix to a number (1st, 2nd, 3rd, etc.)
 */
function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/**
 * Calculate pro-rata rent for a partial month
 * @param monthlyRent - The full monthly rent amount
 * @param endDate - The date the tenant is moving out
 * @param rentDueDay - The day of the month rent is due (e.g., 1, 3, 15)
 * @returns Pro-rata amount and days charged, or null if no pro-rata needed
 */
export function calculateProRataRent(
  monthlyRent: number,
  endDate: Date,
  rentDueDay: number
): { amount: number; daysCharged: number; daysInPeriod: number } | null {
  const moveOutDay = endDate.getDate()

  // If moving out before rent is due, no pro-rata needed for the final period
  if (moveOutDay <= rentDueDay) {
    return null
  }

  // Calculate days in the rental period (rent due day to end of billing cycle)
  // We need to figure out how many days from rent due day to move out day
  const daysCharged = moveOutDay - rentDueDay

  // Get days in the month for pro-rata calculation
  const year = endDate.getFullYear()
  const month = endDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Pro-rata calculation: (monthly_rent / days_in_month) * days_charged
  const dailyRate = monthlyRent / daysInMonth
  const proRataAmount = Math.round(dailyRate * daysCharged * 100) / 100

  return {
    amount: proRataAmount,
    daysCharged,
    daysInPeriod: daysInMonth
  }
}

/**
 * Send move-out confirmation email to tenant
 */
export async function sendMoveOutConfirmation(
  tenantEmail: string,
  tenantName: string,
  propertyAddress: string,
  moveOutDate: string,
  proRataInfo: { amount: number; daysCharged: number } | null,
  bankDetails: { accountName: string; sortCode: string; accountNumber: string } | null,
  nextRentDueDate: string | null,
  branding: { companyName: string; logoUrl?: string; email?: string; phone?: string; website?: string }
): Promise<void> {
  // Format the move out date
  const moveOutDateObj = new Date(moveOutDate)
  const formattedMoveOutDate = moveOutDateObj.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  // Build pro-rata section if applicable
  let proRataSection = ''
  if (proRataInfo && proRataInfo.amount > 0) {
    const formattedAmount = proRataInfo.amount.toLocaleString('en-GB', {
      style: 'currency',
      currency: 'GBP'
    })

    const rentDueDateFormatted = nextRentDueDate
      ? new Date(nextRentDueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'your next rent due date'

    // Bank details section (only if available)
    let bankDetailsSection = ''
    if (bankDetails) {
      bankDetailsSection = `
        <p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: #4b5563;">
          Please make payment to the following bank account:
        </p>

        <div style="margin: 16px 0 24px; padding: 16px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="padding: 4px 0; font-size: 14px; color: #6b7280; width: 120px;">Account Name:</td>
              <td style="padding: 4px 0; font-size: 14px; color: #111827; font-weight: 500;">${bankDetails.accountName}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-size: 14px; color: #6b7280;">Sort Code:</td>
              <td style="padding: 4px 0; font-size: 14px; color: #111827; font-weight: 500;">${bankDetails.sortCode}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-size: 14px; color: #6b7280;">Account No:</td>
              <td style="padding: 4px 0; font-size: 14px; color: #111827; font-weight: 500;">${bankDetails.accountNumber}</td>
            </tr>
          </table>
        </div>
      `
    } else {
      bankDetailsSection = `
        <p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: #4b5563;">
          Please contact us for payment details.
        </p>
      `
    }

    proRataSection = `
      <h2 style="margin: 32px 0 16px; font-size: 18px; font-weight: 600; color: #111827;">Final Rent Payment</h2>

      <p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: #4b5563;">
        As you're moving out mid-month, your final rent payment will be pro-rata for <strong>${proRataInfo.daysCharged} days</strong>.
      </p>

      <div style="margin: 24px 0; padding: 20px; background-color: #ecfdf5; border: 1px solid #10b981; border-radius: 8px;">
        <p style="margin: 0 0 8px; font-size: 14px; color: #047857; font-weight: 500;">Pro-Rata Rent Due</p>
        <p style="margin: 0; font-size: 28px; font-weight: 700; color: #065f46;">${formattedAmount}</p>
        <p style="margin: 8px 0 0; font-size: 14px; color: #047857;">Due on ${rentDueDateFormatted}</p>
      </div>

      ${bankDetailsSection}
    `
  }

  // Build contact info
  const contactParts = []
  if (branding.email) contactParts.push(branding.email)
  if (branding.phone) contactParts.push(branding.phone)
  const contactInfo = contactParts.length > 0 ? contactParts.join(' or ') : branding.companyName

  const templateVariables: Record<string, string> = {
    TenantName: tenantName,
    PropertyAddress: propertyAddress,
    MoveOutDate: formattedMoveOutDate,
    ProRataSection: proRataSection,
    CompanyName: branding.companyName,
    AgentLogoUrl: branding.logoUrl || 'https://app.propertygoose.co.uk/PropertyGooseLogo.png',
    ContactInfo: contactInfo
  }

  const html = loadEmailTemplate('move-out-confirmation', templateVariables)

  await sendEmail({
    to: tenantEmail,
    subject: `Move Out Confirmation - ${propertyAddress}`,
    html
  })

  console.log(`[sendMoveOutConfirmation] Move out confirmation sent to ${tenantEmail} for ${propertyAddress}`)
}

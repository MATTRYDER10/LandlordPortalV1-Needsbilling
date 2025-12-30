import { Resend } from 'resend';
import * as fs from 'fs';
import * as path from 'path';
import { supabase } from '../config/supabase';
import { encrypt } from './encryption';

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY || '');

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
 * Send an email using Resend
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  // Dev mode check - skip actual sending in development unless explicitly enabled
  if (process.env.NODE_ENV === 'development' && !process.env.ENABLE_EMAIL_DEV) {
    console.log(`[DEV] Email skipped - would send to ${options.to}: ${options.subject}`);
    return;
  }

  try {
    const footer = buildContactFooter(options.contactDetails);
    const html = footer ? `${options.html}${footer}` : options.html;

    const { data, error } = await resend.emails.send({
      from: options.from || 'PropertyGoose <hello@notifications.propertygoose.co.uk>',
      to: options.to,
      subject: options.subject,
      html,
      attachments: options.attachments,
    });

    if (error) {
      console.error('Error sending email:', error);
      throw error;
    }

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
          subject: options.subject,
          status: 'sent',
        });
      }
    }
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
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
  referenceId?: string
): Promise<void> {
  const contactInfo = companyPhone ? `${companyName} on ${companyPhone}` : companyName

  const html = loadEmailTemplate('tenant-reference-request', {
    TenantName: capitalizeWords(tenantName),
    CompanyName: companyName,
    ReferenceLink: referenceLink,
    PropertyAddress: capitalizeWords(propertyAddress || ''),
    ContactInfo: contactInfo,
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
  referenceId?: string
): Promise<void> {
  const html = loadEmailTemplate('employer-reference-request', {
    EmployerName: employerName,
    TenantName: tenantName,
    ReferenceLink: referenceLink,
    AgentCompanyName: agentCompanyName || '',
    AgentPhone: agentPhone || '',
    AgentEmail: agentEmail || '',
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
  referenceId?: string
): Promise<void> {
  const html = loadEmailTemplate('landlord-reference-request', {
    LandlordName: landlordName,
    TenantName: tenantName,
    ReferenceLink: referenceLink,
    AgentCompanyName: agentCompanyName || '',
    AgentPhone: agentPhone || '',
    AgentEmail: agentEmail || '',
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
  referenceId?: string
): Promise<void> {
  const html = loadEmailTemplate('agent-reference-request', {
    AgentName: agentName,
    TenantName: tenantName,
    ReferenceLink: referenceLink,
    AgentCompanyName: agentCompanyName || '',
    AgentPhone: agentPhone || '',
    AgentEmail: agentEmailContact || '',
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
  referenceId?: string
): Promise<void> {
  const html = loadEmailTemplate('guarantor-reference-request', {
    GuarantorName: guarantorName,
    TenantName: tenantName,
    PropertyAddress: propertyAddress,
    AgentName: agentName,
    AgentPhone: agentPhone,
    AgentEmail: agentEmail,
    FormLink: formLink
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
    .select('name_encrypted, phone_encrypted, email_encrypted')
    .eq('id', companyId)
    .single()

  const companyName = company?.name_encrypted ? decrypt(company.name_encrypted) : 'PropertyGoose'
  const companyPhone = company?.phone_encrypted ? decrypt(company.phone_encrypted) : ''
  const companyEmail = company?.email_encrypted ? decrypt(company.email_encrypted) : ''

  const html = loadEmailTemplate('landlord-verification-request', {
    LandlordName: landlordName,
    VerificationLink: verificationLink,
    Year: new Date().getFullYear().toString(),
    CompanyName: companyName || ''
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
  const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
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

import { Resend } from 'resend';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY || '');

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Send an email using Resend
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    const { data, error } = await resend.emails.send({
      from: options.from || 'PropertyGoose <hello@notifications.propertygoose.co.uk>',
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    if (error) {
      console.error('Error sending email:', error);
      throw error;
    }

    console.log(`Email sent successfully to ${options.to}`);
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
  companyPhone?: string
): Promise<void> {
  const contactInfo = companyPhone ? `${companyName} on ${companyPhone}` : companyName

  const html = loadEmailTemplate('tenant-reference-request', {
    TenantName: capitalizeWords(tenantName),
    CompanyName: companyName,
    ReferenceLink: referenceLink,
    PropertyAddress: capitalizeWords(propertyAddress || ''),
    ContactInfo: contactInfo,
  });

  await sendEmail({
    to: tenantEmail,
    subject: 'Complete Your Tenant Reference - PropertyGoose',
    html,
  });
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
  agentEmail?: string | null
): Promise<void> {
  const html = loadEmailTemplate('employer-reference-request', {
    EmployerName: employerName,
    TenantName: tenantName,
    ReferenceLink: referenceLink,
    AgentCompanyName: agentCompanyName || '',
    AgentPhone: agentPhone || '',
    AgentEmail: agentEmail || '',
  });

  await sendEmail({
    to: employerEmail,
    subject: 'Employment Reference Request - PropertyGoose',
    html,
  });
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
  agentEmail?: string | null
): Promise<void> {
  const html = loadEmailTemplate('landlord-reference-request', {
    LandlordName: landlordName,
    TenantName: tenantName,
    ReferenceLink: referenceLink,
    AgentCompanyName: agentCompanyName || '',
    AgentPhone: agentPhone || '',
    AgentEmail: agentEmail || '',
  });

  await sendEmail({
    to: landlordEmail,
    subject: 'Landlord Reference Request - PropertyGoose',
    html,
  });
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
  agentEmail?: string | null
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

  await sendEmail({
    to: accountantEmail,
    subject: 'Accountant Reference Request - PropertyGoose',
    html,
  });
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
  agentEmailContact?: string | null
): Promise<void> {
  const html = loadEmailTemplate('agent-reference-request', {
    AgentName: agentName,
    TenantName: tenantName,
    ReferenceLink: referenceLink,
    AgentCompanyName: agentCompanyName || '',
    AgentPhone: agentPhone || '',
    AgentEmail: agentEmailContact || '',
  });

  await sendEmail({
    to: agentEmail,
    subject: 'Agent Reference Request - PropertyGoose',
    html,
  });
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
  formLink: string
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

  await sendEmail({
    to: guarantorEmail,
    subject: `Guarantor Reference Request - ${tenantName} - PropertyGoose`,
    html,
  });
}

/**
 * Send consent PDF to tenant
 */
export async function sendConsentPDFToTenant(
  tenantEmail: string,
  tenantName: string,
  pdfBuffer: Buffer,
  pdfFilename: string
): Promise<void> {
  const html = loadEmailTemplate('consent-pdf', {
    TenantName: tenantName,
  });

  try {
    const { data, error } = await resend.emails.send({
      from: 'PropertyGoose <hello@notifications.propertygoose.co.uk>',
      to: tenantEmail,
      subject: 'Your Referencing Consent Declaration - PropertyGoose',
      html,
      attachments: [
        {
          filename: pdfFilename,
          content: pdfBuffer,
        }
      ],
    });

    if (error) {
      console.error('Error sending consent PDF email:', error);
      throw error;
    }

    console.log(`Consent PDF sent successfully to ${tenantEmail}`);
  } catch (error) {
    console.error('Error sending consent PDF email:', error);
    throw error;
  }
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
    .select('name_encrypted')
    .eq('id', companyId)
    .single()

  const companyName = company?.name_encrypted ? decrypt(company.name_encrypted) : 'PropertyGoose'

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
  })
}

/**
 * Send tenant application request email
 */
export async function sendTenantApplicationRequest(
  applicantEmail: string,
  applicationLink: string,
  companyName: string,
  propertyAddress?: string,
  companyPhone?: string
): Promise<void> {
  const contactInfo = companyPhone ? `${companyName} on ${companyPhone}` : companyName

  const html = loadEmailTemplate('tenant-application-request', {
    CompanyName: companyName,
    ApplicationLink: applicationLink,
    PropertyAddress: capitalizeWords(propertyAddress || ''),
    ContactInfo: contactInfo,
  })

  await sendEmail({
    to: applicantEmail,
    subject: 'Complete Your Rental Application - PropertyGoose',
    html,
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
  companyPhone?: string
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
  holdingDepositAmount: number
): Promise<void> {
  const html = loadEmailTemplate('offer-accepted', {
    CompanyName: companyName,
    BankAccountName: bankAccountName,
    BankAccountNumber: bankAccountNumber,
    BankSortCode: bankSortCode,
    HoldingDepositAmount: holdingDepositAmount.toFixed(2),
  })

  await sendEmail({
    to: tenantEmail,
    subject: 'Congratulations — Your Offer Has Been Accepted!',
    html,
  })
}

/**
 * Send offer declined email with reason
 */
export async function sendOfferDeclinedEmail(
  tenantEmail: string,
  companyName: string,
  declineReason: string
): Promise<void> {
  const html = loadEmailTemplate('offer-declined', {
    CompanyName: companyName,
    DeclineReason: declineReason,
  })

  await sendEmail({
    to: tenantEmail,
    subject: 'Update on Your Offer',
    html,
  })
}

/**
 * Send application completed notification to agent
 */
export async function sendApplicationCompletedNotification(
  agentEmail: string,
  applicantName: string,
  propertyAddress: string,
  dashboardLink: string,
  companyName: string
): Promise<void> {
  const html = loadEmailTemplate('application-completed-notification', {
    ApplicantName: capitalizeWords(applicantName),
    PropertyAddress: capitalizeWords(propertyAddress),
    DashboardLink: dashboardLink,
    CompanyName: companyName || 'PropertyGoose'
  })

  await sendEmail({
    to: agentEmail,
    subject: `Rental Application Completed - ${applicantName} - PropertyGoose`,
    html,
  })
}

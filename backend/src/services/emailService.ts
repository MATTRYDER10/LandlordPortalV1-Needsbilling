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
  propertyAddress?: string
): Promise<void> {
  const html = loadEmailTemplate('tenant-reference-request', {
    TenantName: tenantName,
    CompanyName: companyName,
    ReferenceLink: referenceLink,
    PropertyAddress: propertyAddress || '',
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

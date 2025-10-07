import sgMail from '@sendgrid/mail';
import * as fs from 'fs';
import * as path from 'path';

// Initialize SendGrid with API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Send an email using SendGrid
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const msg = {
    to: options.to,
    from: options.from || 'noreply@propertygoose.co.uk',
    subject: options.subject,
    html: options.html,
  };

  try {
    await sgMail.send(msg);
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
  const templatePath = path.join(__dirname, '../../../email-templates', `${templateName}.html`);

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
  companyName: string
): Promise<void> {
  const html = loadEmailTemplate('tenant-reference-request', {
    TenantName: tenantName,
    CompanyName: companyName,
    ReferenceLink: referenceLink,
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
  referenceLink: string
): Promise<void> {
  const html = loadEmailTemplate('employer-reference-request', {
    EmployerName: employerName,
    TenantName: tenantName,
    ReferenceLink: referenceLink,
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
  referenceLink: string
): Promise<void> {
  const html = loadEmailTemplate('landlord-reference-request', {
    LandlordName: landlordName,
    TenantName: tenantName,
    ReferenceLink: referenceLink,
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
  referenceLink: string
): Promise<void> {
  const html = loadEmailTemplate('accountant-reference-request', {
    AccountantName: accountantName,
    TenantName: tenantName,
    ReferenceLink: referenceLink,
    Year: new Date().getFullYear().toString(),
  });

  await sendEmail({
    to: accountantEmail,
    subject: 'Accountant Reference Request - PropertyGoose',
    html,
  });
}

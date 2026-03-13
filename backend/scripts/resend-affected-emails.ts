import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Import email service functions
import {
  sendEmail,
  loadEmailTemplate
} from '../src/services/emailService';

import { getFrontendUrl } from '../src/utils/frontendUrl';
import { decrypt } from '../src/services/encryption';

function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, char => char.toUpperCase());
}

function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

const DRY_RUN = process.env.DRY_RUN !== 'false';
const DAYS_BACK = parseInt(process.env.DAYS_BACK || '7', 10);

// Apology message to prepend to emails
const APOLOGY_MESSAGE = `
<div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
  <p style="margin: 0; color: #92400e; font-weight: 600;">Our Apologies</p>
  <p style="margin: 8px 0 0 0; color: #92400e;">A previous link may have expired before it reached you. The link below should now work correctly.</p>
</div>
`;

interface AffectedEmail {
  id: string;
  reference_id: string | null;
  reference_type: string | null;
  to_email_encrypted: string;
  subject: string;
  created_at: string;
  status: string;
}

interface Reference {
  id: string;
  tenant_first_name_encrypted: string;
  tenant_last_name_encrypted: string;
  tenant_email_encrypted: string;
  status: string;
  company_id: string;
}

interface Company {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
}

interface TenantChangeSignature {
  id: string;
  tenant_change_id: string;
  signer_name: string;
  signer_email: string;
  signer_type: string;
  status: string;
  last_email_sent_at: string | null;
}

interface RentDueDateChange {
  id: string;
  tenancy_id: string;
  company_id: string;
  confirmation_token: string;
  current_due_day: number;
  new_due_day: number;
  effective_month: number;
  effective_year: number;
  monthly_rent: number;
  pro_rata_days: number;
  daily_rate: number;
  pro_rata_amount: number;
  admin_fee: number;
  total_amount: number;
  lead_tenant_email_encrypted: string;
  status: string;
}

async function findAffectedEmails(): Promise<AffectedEmail[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DAYS_BACK);

  console.log(`\nSearching for emails sent since ${cutoffDate.toISOString()}...\n`);

  const { data, error } = await supabase
    .from('email_delivery_logs')
    .select('*')
    .gte('created_at', cutoffDate.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching email logs:', error);
    return [];
  }

  console.log(`Found ${data?.length || 0} emails in the last ${DAYS_BACK} days`);
  return data || [];
}

async function findPendingReferences(): Promise<Reference[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DAYS_BACK);

  console.log(`\nSearching for pending tenant references created since ${cutoffDate.toISOString()}...\n`);

  const { data, error } = await supabase
    .from('tenant_references')
    .select('id, tenant_first_name_encrypted, tenant_last_name_encrypted, tenant_email_encrypted, status, company_id')
    .gte('created_at', cutoffDate.toISOString())
    .in('status', ['pending', 'in_progress'])
    .not('tenant_email_encrypted', 'is', null);

  if (error) {
    console.error('Error fetching references:', error);
    return [];
  }

  console.log(`Found ${data?.length || 0} pending tenant references`);
  return data || [];
}

async function findPendingSignatures(): Promise<TenantChangeSignature[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DAYS_BACK);

  console.log(`\nSearching for pending agreement signatures since ${cutoffDate.toISOString()}...\n`);

  const { data, error } = await supabase
    .from('tenant_change_signatures')
    .select('id, tenant_change_id, signer_name, signer_email, signer_type, status, last_email_sent_at')
    .gte('created_at', cutoffDate.toISOString())
    .eq('status', 'pending')
    .not('signer_email', 'is', null);

  if (error) {
    console.error('Error fetching signatures:', error);
    return [];
  }

  console.log(`Found ${data?.length || 0} pending signatures`);
  return data || [];
}

async function findPendingRentDueDateChanges(): Promise<RentDueDateChange[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DAYS_BACK);

  console.log(`\nSearching for pending rent due date changes since ${cutoffDate.toISOString()}...\n`);

  const { data, error } = await supabase
    .from('rent_due_date_changes')
    .select('*')
    .gte('created_at', cutoffDate.toISOString())
    .eq('status', 'pending_payment');

  if (error) {
    console.error('Error fetching rent due date changes:', error);
    return [];
  }

  console.log(`Found ${data?.length || 0} pending rent due date changes`);
  return data || [];
}

async function getCompany(companyId: string): Promise<Company | null> {
  const { data } = await supabase
    .from('companies')
    .select('id, name, phone, email, logo_url')
    .eq('id', companyId)
    .single();
  return data;
}

async function resendReferenceEmail(reference: Reference): Promise<boolean> {
  // Decrypt tenant info
  let tenantFirstName: string, tenantLastName: string, tenantEmail: string;
  try {
    const firstName = decrypt(reference.tenant_first_name_encrypted);
    const lastName = decrypt(reference.tenant_last_name_encrypted);
    const email = decrypt(reference.tenant_email_encrypted);
    if (!firstName || !lastName || !email) {
      console.log(`   ⚠️  Could not decrypt tenant info`);
      return false;
    }
    tenantFirstName = firstName;
    tenantLastName = lastName;
    tenantEmail = email;
  } catch (e) {
    console.log(`   ⚠️  Could not decrypt tenant info`);
    return false;
  }

  const tenantName = `${tenantFirstName} ${tenantLastName}`.trim();
  const company = await getCompany(reference.company_id);
  const tenantUrl = `${getFrontendUrl()}/submit-reference/${reference.id}`;
  const contactInfo = company?.phone ? `${company.name} on ${company.phone}` : (company?.name || 'PropertyGoose');

  console.log(`\n📧 Reference: ${reference.id}`);
  console.log(`   Tenant: ${tenantName} <${tenantEmail}>`);
  console.log(`   URL: ${tenantUrl}`);
  console.log(`   Status: ${reference.status}`);

  if (DRY_RUN) {
    console.log(`   [DRY RUN] Would resend reference email`);
    return true;
  }

  try {
    // Load the template
    let html = loadEmailTemplate('tenant-reference-request', {
      TenantName: capitalizeWords(tenantName),
      CompanyName: company?.name || 'PropertyGoose',
      ReferenceLink: tenantUrl,
      ContactInfo: contactInfo,
      PropertyAddress: '',
      AgentLogoUrl: company?.logo_url || 'https://app.propertygoose.co.uk/PropertyGooseLogo.png',
      CompanyEmail: company?.email || ''
    });

    // Insert apology message after opening body tag
    const bodyIndex = html.indexOf('<body');
    const bodyEndIndex = html.indexOf('>', bodyIndex) + 1;
    if (bodyEndIndex > 0) {
      html = html.slice(0, bodyEndIndex) + APOLOGY_MESSAGE + html.slice(bodyEndIndex);
    }

    await sendEmail({
      to: tenantEmail,
      subject: `Reference Request: Please Complete Your Application - ${company?.name || 'PropertyGoose'}`,
      html,
      referenceId: reference.id,
      referenceType: 'tenant'
    });
    console.log(`   ✅ Email resent successfully`);
    return true;
  } catch (error) {
    console.error(`   ❌ Failed to resend:`, error);
    return false;
  }
}

async function resendSignatureEmail(signature: TenantChangeSignature): Promise<boolean> {
  // Get tenant change details for context
  const { data: tenantChange } = await supabase
    .from('tenant_changes')
    .select(`
      id, tenancy_id, company_id,
      tenancies!inner(
        id,
        properties!inner(address_line1_encrypted, city_encrypted, postcode)
      )
    `)
    .eq('id', signature.tenant_change_id)
    .single();

  if (!tenantChange) {
    console.log(`   ⚠️  Could not find tenant change ${signature.tenant_change_id}`);
    return false;
  }

  const company = await getCompany(tenantChange.company_id);
  const signingUrl = `${getFrontendUrl()}/sign-addendum/${signature.id}`;

  // Get property address
  const tenancy = (tenantChange as any).tenancies;
  const propertyData = tenancy?.properties;
  const propertyAddress = propertyData ? [
    propertyData.address_line1_encrypted ? decrypt(propertyData.address_line1_encrypted) : null,
    propertyData.city_encrypted ? decrypt(propertyData.city_encrypted) : null,
    propertyData.postcode
  ].filter(Boolean).join(', ') : 'Your property';

  // Format signer type
  const signerTypeMap: Record<string, string> = {
    'outgoing_tenant': 'Outgoing Tenant',
    'incoming_tenant': 'Incoming Tenant',
    'landlord': 'Landlord',
    'agent': 'Agent'
  };
  const signerType = signerTypeMap[signature.signer_type] || signature.signer_type;

  // Expiry date (7 days from now)
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 7);
  const expiryStr = expiryDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  console.log(`\n📝 Signature: ${signature.id}`);
  console.log(`   Signer: ${signature.signer_name} <${signature.signer_email}>`);
  console.log(`   Role: ${signature.signer_type}`);
  console.log(`   URL: ${signingUrl}`);

  if (DRY_RUN) {
    console.log(`   [DRY RUN] Would resend signature email`);
    return true;
  }

  try {
    let html = loadEmailTemplate('tenant-change-addendum-signing', {
      SignerName: signature.signer_name,
      SignerType: signerType,
      PropertyAddress: propertyAddress,
      ExpiryDate: expiryStr,
      CompanyName: company?.name || 'PropertyGoose',
      SigningUrl: signingUrl,
      AgentLogoUrl: company?.logo_url || 'https://app.propertygoose.co.uk/PropertyGooseLogo.png'
    });

    // Insert apology message after opening body tag
    const bodyIndex = html.indexOf('<body');
    const bodyEndIndex = html.indexOf('>', bodyIndex) + 1;
    if (bodyEndIndex > 0) {
      html = html.slice(0, bodyEndIndex) + APOLOGY_MESSAGE + html.slice(bodyEndIndex);
    }

    await sendEmail({
      to: signature.signer_email,
      subject: `Action Required: Please Sign Change of Tenant Addendum - ${propertyAddress}`,
      html,
      referenceId: signature.id
    });

    console.log(`   ✅ Signature email resent successfully`);
    return true;
  } catch (error) {
    console.error(`   ❌ Failed to resend signature email:`, error);
    return false;
  }
}

async function resendRentDueDateChangeEmail(change: RentDueDateChange): Promise<boolean> {
  const company = await getCompany(change.company_id);
  const confirmationUrl = `${getFrontendUrl()}/confirm-rent-change/${change.confirmation_token}`;

  // Decrypt tenant email
  let tenantEmail: string;
  try {
    const decrypted = decrypt(change.lead_tenant_email_encrypted);
    if (!decrypted) {
      console.log(`   ⚠️  Could not decrypt tenant email (null result)`);
      return false;
    }
    tenantEmail = decrypted;
  } catch (e) {
    console.log(`   ⚠️  Could not decrypt tenant email`);
    return false;
  }

  // Get tenancy and property for address
  const { data: tenancy } = await supabase
    .from('tenancies')
    .select(`
      id,
      properties!inner(address_line1_encrypted, city_encrypted, postcode)
    `)
    .eq('id', change.tenancy_id)
    .single();

  const propertyData = (tenancy?.properties as any);
  const propertyAddress = propertyData ? [
    propertyData.address_line1_encrypted ? decrypt(propertyData.address_line1_encrypted) : null,
    propertyData.city_encrypted ? decrypt(propertyData.city_encrypted) : null,
    propertyData.postcode
  ].filter(Boolean).join(', ') : 'Your property';

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const effectiveDate = `${change.new_due_day}${getDaySuffix(change.new_due_day)} ${monthNames[change.effective_month - 1]} ${change.effective_year}`;

  console.log(`\n💷 Rent Due Date Change: ${change.id}`);
  console.log(`   Tenant: ${tenantEmail}`);
  console.log(`   URL: ${confirmationUrl}`);
  console.log(`   Change: ${change.current_due_day}${getDaySuffix(change.current_due_day)} → ${change.new_due_day}${getDaySuffix(change.new_due_day)}`);

  if (DRY_RUN) {
    console.log(`   [DRY RUN] Would resend rent due date change email`);
    return true;
  }

  try {
    // Build admin fee row if applicable
    let adminFeeRow = '';
    if (change.admin_fee > 0) {
      adminFeeRow = `
        <tr>
          <td style="padding: 8px 0; font-size: 14px; color: #78350f;">Administration fee:</td>
          <td style="padding: 8px 0; font-size: 14px; color: #92400e; font-weight: 600; text-align: right;">£${change.admin_fee.toFixed(2)}</td>
        </tr>
      `;
    }

    let html = loadEmailTemplate('rent-due-date-change-request', {
      TenantName: 'Tenant',
      PropertyAddress: propertyAddress,
      CurrentDueDay: `${change.current_due_day}${getDaySuffix(change.current_due_day)} of each month`,
      NewDueDay: `${change.new_due_day}${getDaySuffix(change.new_due_day)} of each month`,
      EffectiveDate: effectiveDate,
      MonthlyRent: change.monthly_rent.toFixed(2),
      DailyRate: change.daily_rate.toFixed(2),
      ProRataDays: change.pro_rata_days.toString(),
      ProRataAmount: change.pro_rata_amount.toFixed(2),
      AdminFeeRow: adminFeeRow,
      TotalAmount: change.total_amount.toFixed(2),
      BankAccountName: company?.name || '',
      BankSortCode: '',
      BankAccountNumber: '',
      PaymentReference: `RDC-${change.id.slice(0, 8).toUpperCase()}`,
      ConfirmationUrl: confirmationUrl,
      CompanyName: company?.name || 'Your letting agent',
      AgentLogoUrl: company?.logo_url || 'https://app.propertygoose.co.uk/PropertyGooseLogo.png',
      ContactSection: ''
    });

    // Insert apology message after opening body tag
    const bodyIndex = html.indexOf('<body');
    const bodyEndIndex = html.indexOf('>', bodyIndex) + 1;
    if (bodyEndIndex > 0) {
      html = html.slice(0, bodyEndIndex) + APOLOGY_MESSAGE + html.slice(bodyEndIndex);
    }

    await sendEmail({
      to: tenantEmail,
      subject: `Rent Due Date Change Request - ${propertyAddress}`,
      html
    });

    console.log(`   ✅ Rent due date change email resent successfully`);
    return true;
  } catch (error) {
    console.error(`   ❌ Failed to resend rent due date change email:`, error);
    return false;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('RESEND AFFECTED EMAILS SCRIPT');
  console.log('='.repeat(60));
  console.log(`\nMode: ${DRY_RUN ? 'DRY RUN (no emails will be sent)' : 'LIVE (emails will be sent)'}`);
  console.log(`Looking back: ${DAYS_BACK} days`);
  console.log(`Production URL: ${getFrontendUrl()}`);

  if (!DRY_RUN) {
    console.log('\n⚠️  WARNING: This will send real emails!');
    console.log('    Press Ctrl+C within 5 seconds to cancel...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // 1. Find and resend pending reference emails
  const pendingRefs = await findPendingReferences();
  let refsSent = 0;
  let refsFailed = 0;

  for (const ref of pendingRefs) {
    const success = await resendReferenceEmail(ref);
    if (success) refsSent++;
    else refsFailed++;
  }

  // 2. Find and resend pending signature emails
  const pendingSignatures = await findPendingSignatures();
  let sigsSent = 0;
  let sigsFailed = 0;

  for (const sig of pendingSignatures) {
    const success = await resendSignatureEmail(sig);
    if (success) sigsSent++;
    else sigsFailed++;
  }

  // 3. Find and resend pending rent due date change emails
  const pendingRentChanges = await findPendingRentDueDateChanges();
  let rentSent = 0;
  let rentFailed = 0;

  for (const change of pendingRentChanges) {
    const success = await resendRentDueDateChangeEmail(change);
    if (success) rentSent++;
    else rentFailed++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`\nReferences: ${refsSent} sent, ${refsFailed} failed`);
  console.log(`Signatures: ${sigsSent} sent, ${sigsFailed} failed`);
  console.log(`Rent Due Date Changes: ${rentSent} sent, ${rentFailed} failed`);
  console.log(`\nTotal: ${refsSent + sigsSent + rentSent} emails ${DRY_RUN ? 'would be ' : ''}sent`);

  if (DRY_RUN) {
    console.log('\n💡 To actually send emails, run with DRY_RUN=false');
  }
}

main().catch(console.error);

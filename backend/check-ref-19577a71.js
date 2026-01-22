const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://spaetpdmlqfygsxiawul.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ? Buffer.from(process.env.ENCRYPTION_KEY, 'base64') : null;

function decrypt(encryptedText) {
  if (!encryptedText || !ENCRYPTION_KEY) return null;
  try {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    return null;
  }
}

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  const refId = '19577a71-6834-4743-871d-4c0ac3e4a25d';

  console.log(`🔍 Checking reference ${refId}\n`);
  console.log('='.repeat(80));
  console.log('');

  // Get reference details
  const { data: ref, error: refError } = await supabase
    .from('tenant_references')
    .select('*')
    .eq('id', refId)
    .single();

  if (refError) {
    console.error('❌ Error:', refError);
    return;
  }

  console.log('📋 REFERENCE STATUS:\n');
  console.log(`Status: ${ref.status}`);
  console.log(`Verification State: ${ref.verification_state || 'N/A'}`);
  console.log(`Created: ${ref.created_at}`);
  console.log(`Submitted At: ${ref.submitted_at || '❌ NOT SUBMITTED'}`);
  console.log('');

  // Decrypt tenant info
  const firstName = decrypt(ref.tenant_first_name_encrypted) || ref.tenant_first_name;
  const lastName = decrypt(ref.tenant_last_name_encrypted) || ref.tenant_last_name;
  const email = decrypt(ref.tenant_email_encrypted) || ref.tenant_email;
  const phone = decrypt(ref.tenant_phone_encrypted) || ref.tenant_phone;

  console.log('👤 TENANT INFO:\n');
  console.log(`Name: ${firstName || 'N/A'} ${lastName || 'N/A'}`);
  console.log(`Email: ${email || 'N/A'}`);
  console.log(`Phone: ${phone || 'N/A'}`);
  console.log('');

  // Check form data
  const dob = decrypt(ref.date_of_birth_encrypted) || ref.date_of_birth;
  const contact = decrypt(ref.contact_number_encrypted) || ref.contact_number;
  const empStatus = decrypt(ref.employment_status_encrypted) || ref.employment_status;
  const resStatus = decrypt(ref.residential_status_encrypted) || ref.residential_status;

  console.log('📝 TENANT FORM DATA:\n');
  console.log(`Date of Birth: ${dob || '❌ NOT FILLED'}`);
  console.log(`Contact Number: ${contact || '❌ NOT FILLED'}`);
  console.log(`Employment Status: ${empStatus || '❌ NOT FILLED'}`);
  console.log(`Residential Status: ${resStatus || '❌ NOT FILLED'}`);
  console.log('');

  // Check employment details if employed
  if (empStatus === 'employed' || decrypt(ref.employment_status_encrypted) === 'employed') {
    const employerName = decrypt(ref.employment_employer_name_encrypted) || ref.employment_employer_name;
    const jobTitle = decrypt(ref.employment_job_title_encrypted) || ref.employment_job_title;
    const salary = decrypt(ref.employment_salary_amount_encrypted) || ref.employment_salary_amount;

    console.log('💼 EMPLOYMENT DETAILS:\n');
    console.log(`Employer: ${employerName || '❌ NOT FILLED'}`);
    console.log(`Job Title: ${jobTitle || '❌ NOT FILLED'}`);
    console.log(`Salary: ${salary || '❌ NOT FILLED'}`);
    console.log('');
  }

  console.log('='.repeat(80));
  console.log('\n🔍 DIAGNOSIS:\n');

  const hasFormData = !!(dob || contact || empStatus || resStatus);
  const hasSubmitted = !!ref.submitted_at;

  if (ref.status === 'in_progress' && !hasSubmitted) {
    console.log('❌ SAME ISSUE: Status is "in_progress" but tenant has NOT submitted');
    console.log('');
    console.log('RECOMMENDED ACTION:');
    console.log('Change status from "in_progress" to "pending"');
    console.log('');

    if (hasFormData) {
      console.log('⚠️  WARNING: Some form data exists, but no submitted_at timestamp');
      console.log('   The tenant may have started filling the form but not submitted it');
    } else {
      console.log('✅ No form data - tenant has not started filling out the form');
    }
  } else if (ref.status === 'in_progress' && hasSubmitted) {
    console.log('✅ Status is CORRECT: Tenant HAS submitted the form');
    console.log('');
    console.log(`Submitted at: ${ref.submitted_at}`);
    console.log('');

    if (hasFormData) {
      console.log('✅ Form data is present - tenant completed their submission');
    } else {
      console.log('⚠️  WARNING: Form was submitted but no data found');
      console.log('   This might indicate a submission issue');
    }
  } else if (ref.status === 'pending') {
    console.log('✅ Status is correct - waiting for tenant to submit');
  } else {
    console.log(`ℹ️  Status is "${ref.status}"`);
  }

  console.log('');
})();

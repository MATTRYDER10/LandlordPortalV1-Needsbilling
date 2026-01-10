const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Correct decrypt function
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

function decrypt(encryptedData) {
  if (!encryptedData) return null;
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'base64');
  const combined = Buffer.from(encryptedData, 'base64');
  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, TAG_POSITION);
  const tag = combined.subarray(TAG_POSITION, ENCRYPTED_POSITION);
  const encrypted = combined.subarray(ENCRYPTED_POSITION);

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch (e1) {
    try {
      const derivedKey = crypto.pbkdf2Sync(key, salt, 10000, 32, 'sha512');
      const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    } catch (e2) {
      try {
        const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha512');
        const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
      } catch (e3) {
        return null;
      }
    }
  }
}

async function completeCheck() {
  const referenceId = '5e2dbf96-5db2-4fec-bd9b-9ebb175b2e27';

  console.log('=== COMPLETE EMPLOYER REFERENCE DATA CHECK ===\n');

  // Get employer reference
  const { data: empRef } = await supabase
    .from('employer_references')
    .select('*')
    .eq('reference_id', referenceId)
    .single();

  if (!empRef) {
    console.log('❌ No employer_references record found!\n');
    process.exit(1);
  }

  console.log('✅ employer_references record exists');
  console.log('   ID:', empRef.id);
  console.log('   Created:', empRef.created_at);
  console.log('   Submitted:', empRef.submitted_at);
  console.log('   (Note: created_at === submitted_at means it was never actually filled out)\n');

  console.log('=== EMPLOYER REFERENCE DATA (what employer filled out about tenant) ===\n');

  // Check all the important fields that the employer should have filled out
  const fieldsToCheck = {
    'Company Name': empRef.company_name_encrypted,
    'Employer Name (person filling form)': empRef.employer_name_encrypted,
    'Employer Position': empRef.employer_position_encrypted,
    'Employer Email': empRef.employer_email_encrypted,
    'Employer Phone': empRef.employer_phone_encrypted,
    'Employee Position (Qiang\'s job)': empRef.employee_position_encrypted,
    'Annual Salary': empRef.annual_salary_encrypted,
    'Employment Type': empRef.employment_type,
    'Employment Start Date': empRef.employment_start_date,
    'Salary Frequency': empRef.salary_frequency,
    'Is on Probation': empRef.is_probation,
    'Employment Status': empRef.employment_status,
    'Contract Type Confirmation': empRef.contract_type_confirmation,
    'Employment Stable': empRef.employment_stable,
    'Signature': empRef.signature_encrypted
  };

  let hasAnyData = false;

  Object.entries(fieldsToCheck).forEach(([label, value]) => {
    if (value) {
      hasAnyData = true;
      if (label.includes('encrypted') || typeof value === 'string' && value.length > 50) {
        const decrypted = decrypt(value);
        console.log(`✅ ${label}: ${decrypted || '[ENCRYPTED]'}`);
      } else {
        console.log(`✅ ${label}:`, value);
      }
    } else {
      console.log(`❌ ${label}: NULL/EMPTY`);
    }
  });

  console.log('\n=== SUMMARY ===\n');
  if (!hasAnyData) {
    console.log('❌ EMPLOYER REFERENCE DATA DOES NOT EXIST');
    console.log('   The employer_references record was created but contains NO DATA.');
    console.log('   Rachel Marshall either:');
    console.log('   1. Never actually filled out the form');
    console.log('   2. Submitted the form but the data wasn\'t saved (bug)');
    console.log('   3. The form submission failed silently');
  } else {
    console.log('✅ EMPLOYER REFERENCE DATA EXISTS');
    console.log('   The form was filled out and data was saved.');
  }

  console.log('\n=== TENANT-PROVIDED EMPLOYER CONTACT INFO (from tenant_references) ===\n');

  const { data: tenantRef } = await supabase
    .from('tenant_references')
    .select('employer_ref_name_encrypted, employer_ref_email_encrypted, employer_ref_phone_encrypted, employer_ref_position')
    .eq('id', referenceId)
    .single();

  console.log('This is the contact info that Qiang Lan provided (NOT filled by employer):');
  console.log('Contact Name:', decrypt(tenantRef.employer_ref_name_encrypted));
  console.log('Contact Email:', decrypt(tenantRef.employer_ref_email_encrypted));
  console.log('Contact Phone:', decrypt(tenantRef.employer_ref_phone_encrypted));
  console.log('Contact Position:', tenantRef.employer_ref_position);

  process.exit(0);
}

completeCheck();

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Decrypt function from backend
function decrypt(encryptedText) {
  if (!encryptedText) return null;
  try {
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encrypted = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error('Decryption error:', error.message);
    return null;
  }
}

async function findEmployerData() {
  const referenceId = '5e2dbf96-5db2-4fec-bd9b-9ebb175b2e27';

  console.log('=== CHECKING TENANT_REFERENCES TABLE ===');
  const { data: tenantRef } = await supabase
    .from('tenant_references')
    .select('*')
    .eq('id', referenceId)
    .single();

  if (tenantRef) {
    console.log('\nEmployer info provided by TENANT:');
    console.log('employer_ref_name_encrypted:', tenantRef.employer_ref_name_encrypted ? decrypt(tenantRef.employer_ref_name_encrypted) : 'EMPTY');
    console.log('employer_ref_email_encrypted:', tenantRef.employer_ref_email_encrypted ? decrypt(tenantRef.employer_ref_email_encrypted) : 'EMPTY');
    console.log('employer_ref_phone_encrypted:', tenantRef.employer_ref_phone_encrypted ? decrypt(tenantRef.employer_ref_phone_encrypted) : 'EMPTY');
    console.log('employer_name (not encrypted):', tenantRef.employer_name);
    console.log('employment_type:', tenantRef.employment_type);
  }

  console.log('\n=== CHECKING EMPLOYER_REFERENCES TABLE ===');
  const { data: empRef } = await supabase
    .from('employer_references')
    .select('*')
    .eq('reference_id', referenceId)
    .single();

  if (empRef) {
    console.log('\nData filled by EMPLOYER:');
    console.log('company_name_encrypted:', empRef.company_name_encrypted ? decrypt(empRef.company_name_encrypted) : 'EMPTY');
    console.log('employer_name_encrypted:', empRef.employer_name_encrypted ? decrypt(empRef.employer_name_encrypted) : 'EMPTY');
    console.log('employer_email_encrypted:', empRef.employer_email_encrypted ? decrypt(empRef.employer_email_encrypted) : 'EMPTY');
    console.log('employer_phone_encrypted:', empRef.employer_phone_encrypted ? decrypt(empRef.employer_phone_encrypted) : 'EMPTY');
    console.log('employee_position_encrypted:', empRef.employee_position_encrypted ? decrypt(empRef.employee_position_encrypted) : 'EMPTY');
    console.log('annual_salary_encrypted:', empRef.annual_salary_encrypted ? decrypt(empRef.annual_salary_encrypted) : 'EMPTY');
    console.log('employment_start_date:', empRef.employment_start_date);
    console.log('employment_type:', empRef.employment_type);
    console.log('is_current_employee:', empRef.is_current_employee);

    console.log('\n=== ALL ENCRYPTED FIELDS ===');
    const encryptedFields = Object.keys(empRef).filter(k => k.includes('encrypted'));
    encryptedFields.forEach(field => {
      if (empRef[field]) {
        console.log(`${field}:`, decrypt(empRef[field]));
      }
    });
  }

  process.exit(0);
}

findEmployerData();

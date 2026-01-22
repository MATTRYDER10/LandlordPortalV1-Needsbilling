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
  const refId = process.argv[2];

  if (!refId) {
    console.error('Usage: node check-ref-detailed.js <reference-id>');
    return;
  }

  console.log(`🔍 Detailed check for ${refId}\n`);
  console.log('='.repeat(80));
  console.log('');

  const { data: ref, error } = await supabase
    .from('tenant_references')
    .select('*')
    .eq('id', refId)
    .single();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('📋 STATUS:\n');
  console.log(`  Status: ${ref.status}`);
  console.log(`  Verification State: ${ref.verification_state || 'N/A'}`);
  console.log(`  Submitted At: ${ref.submitted_at || 'NOT SUBMITTED'}`);
  console.log(`  Created: ${ref.created_at}`);
  console.log('');

  // Check all form data fields
  const formFields = {
    'Date of Birth': decrypt(ref.date_of_birth_encrypted) || ref.date_of_birth,
    'Contact Number': decrypt(ref.contact_number_encrypted) || ref.contact_number,
    'Employment Status': decrypt(ref.employment_status_encrypted) || ref.employment_status,
    'Residential Status': decrypt(ref.residential_status_encrypted) || ref.residential_status,
    'Nationality': decrypt(ref.nationality_encrypted) || ref.nationality,
    'National Insurance': decrypt(ref.national_insurance_encrypted) || ref.national_insurance_number,
  };

  console.log('📝 FORM DATA:\n');
  let hasAnyData = false;
  Object.entries(formFields).forEach(([label, value]) => {
    if (value) {
      console.log(`  ${label}: ${value}`);
      hasAnyData = true;
    } else {
      console.log(`  ${label}: ❌ Not filled`);
    }
  });
  console.log('');

  console.log('='.repeat(80));
  console.log('\n🔍 DIAGNOSIS:\n');

  if (ref.verification_state === 'COLLECTING_EVIDENCE' && !ref.submitted_at) {
    console.log('⚠️  ISSUE: verification_state is "COLLECTING_EVIDENCE" but tenant has NOT submitted\n');

    if (hasAnyData) {
      console.log('❓ Some form data exists - tenant may have partially filled the form');
      console.log('   but did not complete submission');
    } else {
      console.log('❌ No form data - tenant has not filled anything out');
      console.log('   verification_state should likely be NULL or different state');
    }

    console.log('');
    console.log('The "COLLECTING_EVIDENCE" state suggests the system thinks');
    console.log('the form was submitted and is waiting for evidence upload.');
    console.log('But submitted_at is NULL, so this is inconsistent.');
  } else if (ref.verification_state === 'COLLECTING_EVIDENCE' && ref.submitted_at) {
    console.log('✅ State is correct - tenant submitted and system is collecting evidence');
  }

  console.log('');
})();

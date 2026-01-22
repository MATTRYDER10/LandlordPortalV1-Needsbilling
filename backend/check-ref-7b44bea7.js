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
  const refId = '7b44bea7-5b4a-4ab4-8d9a-1fa12bbbf3f2';

  console.log(`🔍 Checking reference ${refId}\n`);
  console.log('='.repeat(80));
  console.log('');

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

  const firstName = decrypt(ref.tenant_first_name_encrypted) || ref.tenant_first_name;
  const lastName = decrypt(ref.tenant_last_name_encrypted) || ref.tenant_last_name;
  const email = decrypt(ref.tenant_email_encrypted) || ref.tenant_email;
  const phone = decrypt(ref.tenant_phone_encrypted) || ref.tenant_phone;

  console.log('👤 TENANT INFO:\n');
  console.log(`Name: ${firstName || 'N/A'} ${lastName || 'N/A'}`);
  console.log(`Email: ${email || 'N/A'}`);
  console.log(`Phone: ${phone || 'N/A'}`);
  console.log('');

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

  console.log('='.repeat(80));
  console.log('\n🔍 DIAGNOSIS:\n');

  const hasFormData = !!(dob || contact || empStatus || resStatus);
  const hasSubmitted = !!ref.submitted_at;

  if (ref.status === 'in_progress' && !hasSubmitted) {
    console.log('❌ ISSUE: Status is "in_progress" but tenant has NOT submitted');
    console.log('');
    console.log('🔧 NEEDS FIX: Change status to "pending"');
    console.log('');

    if (hasFormData) {
      console.log('⚠️  Some form data exists but no submission timestamp');
    } else {
      console.log('No form data - tenant has not started the form');
    }
  } else if (ref.status === 'in_progress' && hasSubmitted) {
    console.log('✅ Status is CORRECT - tenant has submitted the form');
    console.log(`   Submitted at: ${ref.submitted_at}`);
  } else if (ref.status === 'pending') {
    console.log('✅ Status is CORRECT - waiting for tenant to submit');
  } else {
    console.log(`ℹ️  Status is "${ref.status}"`);
  }

  console.log('');
})();

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://spaetpdmlqfygsxiawul.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

function decrypt(encryptedText) {
  if (!encryptedText) return null;
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
  const refId = 'b00302e6-dc23-4637-99c5-4c5e3f38d0cc';

  console.log('🔍 Checking reference b00302e6-dc23-4637-99c5-4c5e3f38d0cc\n');
  console.log('='.repeat(80));
  console.log('');

  // Get all columns
  const { data: ref, error } = await supabase
    .from('tenant_references')
    .select('*')
    .eq('id', refId)
    .single();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('📋 BASIC INFO:\n');
  console.log(`Status: ${ref.status}`);
  console.log(`Verification State: ${ref.verification_state || 'N/A'}`);
  console.log(`Is Guarantor: ${ref.is_guarantor}`);
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

  // Check form fields
  const dob = decrypt(ref.date_of_birth_encrypted) || ref.date_of_birth;
  const contact = decrypt(ref.contact_number_encrypted) || ref.contact_number;
  const empStatus = decrypt(ref.employment_status_encrypted) || ref.employment_status;
  const resStatus = decrypt(ref.residential_status_encrypted) || ref.residential_status;

  console.log('📝 FORM DATA:\n');
  console.log(`Date of Birth: ${dob || '❌ NOT FILLED'}`);
  console.log(`Contact Number: ${contact || '❌ NOT FILLED'}`);
  console.log(`Employment Status: ${empStatus || '❌ NOT FILLED'}`);
  console.log(`Residential Status: ${resStatus || '❌ NOT FILLED'}`);
  console.log('');

  // Find columns with 'token' in the name
  const tokenColumns = Object.keys(ref).filter(key => key.toLowerCase().includes('token'));
  if (tokenColumns.length > 0) {
    console.log('🔗 TOKEN FIELDS:\n');
    tokenColumns.forEach(col => {
      console.log(`${col}: ${ref[col] ? 'EXISTS' : 'null'}`);
    });
    console.log('');
  }

  console.log('='.repeat(80));
  console.log('\n🔍 DIAGNOSIS:\n');

  if (!ref.submitted_at) {
    console.log('❌ ISSUE: Tenant has NOT submitted the reference form\n');
    console.log('This means:');
    console.log('- The tenant may not have received the invitation email');
    console.log('- OR the tenant has not clicked the link');
    console.log('- OR the tenant started filling the form but has not submitted it\n');

    console.log('Actions to take:');
    console.log('1. Check if an invitation was sent to the tenant');
    console.log('2. Resend the invitation email');
    console.log('3. Contact the tenant directly to ensure they received it');
  }

  if (!firstName && !lastName && !email) {
    console.log('⚠️  WARNING: No tenant contact information found');
    console.log('   This reference may have been created without tenant details\n');
  }

  console.log('');
})();

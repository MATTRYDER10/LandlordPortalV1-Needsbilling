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
  const refId = 'b00302e6-dc23-4637-99c5-4c5e3f38d0cc';

  console.log('🔍 Checking ALL fields for reference\n');
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

  console.log('📋 PERSONAL DETAILS FIELDS:\n');

  // Check all possible name fields
  const nameFields = [
    'tenant_first_name',
    'tenant_first_name_encrypted',
    'tenant_last_name',
    'tenant_last_name_encrypted',
    'first_name',
    'last_name',
    'name'
  ];

  console.log('Name fields:');
  nameFields.forEach(field => {
    if (ref.hasOwnProperty(field)) {
      const value = field.includes('encrypted') ? decrypt(ref[field]) : ref[field];
      if (value) {
        console.log(`  ${field}: ${value}`);
      }
    }
  });
  console.log('');

  // Check all possible email fields
  const emailFields = [
    'tenant_email',
    'tenant_email_encrypted',
    'email',
    'email_encrypted'
  ];

  console.log('Email fields:');
  emailFields.forEach(field => {
    if (ref.hasOwnProperty(field)) {
      const value = field.includes('encrypted') ? decrypt(ref[field]) : ref[field];
      if (value) {
        console.log(`  ${field}: ${value}`);
      }
    }
  });
  console.log('');

  // Check all possible phone fields
  const phoneFields = [
    'tenant_phone',
    'tenant_phone_encrypted',
    'phone',
    'phone_encrypted',
    'contact_number',
    'contact_number_encrypted'
  ];

  console.log('Phone fields:');
  phoneFields.forEach(field => {
    if (ref.hasOwnProperty(field)) {
      const value = field.includes('encrypted') ? decrypt(ref[field]) : ref[field];
      if (value) {
        console.log(`  ${field}: ${value}`);
      }
    }
  });
  console.log('');

  // Check date of birth
  const dobFields = [
    'date_of_birth',
    'date_of_birth_encrypted',
    'dob',
    'dob_encrypted'
  ];

  console.log('Date of Birth fields:');
  dobFields.forEach(field => {
    if (ref.hasOwnProperty(field)) {
      const value = field.includes('encrypted') ? decrypt(ref[field]) : ref[field];
      if (value) {
        console.log(`  ${field}: ${value}`);
      }
    }
  });
  console.log('');

  console.log('📊 REFERENCE STATUS:\n');
  console.log(`Status: ${ref.status}`);
  console.log(`Verification State: ${ref.verification_state || 'N/A'}`);
  console.log(`Submitted At: ${ref.submitted_at || 'NOT SUBMITTED'}`);
  console.log(`Created At: ${ref.created_at}`);
  console.log('');

  // List ALL fields with values
  console.log('📝 ALL NON-NULL FIELDS:\n');
  const nonNullFields = Object.entries(ref)
    .filter(([key, value]) => value !== null && value !== undefined)
    .filter(([key]) => !key.endsWith('_encrypted') || decrypt(ref[key])); // Only show encrypted if decryptable

  nonNullFields.forEach(([key, value]) => {
    if (key.endsWith('_encrypted')) {
      const decrypted = decrypt(value);
      if (decrypted) {
        console.log(`${key}: ${decrypted.substring(0, 50)}${decrypted.length > 50 ? '...' : ''}`);
      }
    } else if (typeof value === 'string' && value.length > 100) {
      console.log(`${key}: ${value.substring(0, 50)}...`);
    } else {
      console.log(`${key}: ${value}`);
    }
  });

  console.log('');
  console.log('='.repeat(80));
  console.log('\n💡 If you see "Matthew Chapman" and "chapmatt154@gmail.com" above,');
  console.log('   they are stored in the database but may be in different field names\n');
})();

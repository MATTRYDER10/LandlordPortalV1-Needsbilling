const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Decrypt function
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
    return `[DECRYPT ERROR: ${error.message}]`;
  }
}

async function showAllFields() {
  const referenceId = '5e2dbf96-5db2-4fec-bd9b-9ebb175b2e27';

  const { data: empRef } = await supabase
    .from('employer_references')
    .select('*')
    .eq('reference_id', referenceId)
    .single();

  if (empRef) {
    console.log('=== ALL FIELDS IN EMPLOYER_REFERENCES ===\n');

    // Show all non-encrypted fields
    console.log('NON-ENCRYPTED FIELDS:');
    Object.keys(empRef).forEach(key => {
      if (!key.includes('encrypted') && !key.includes('_at') && empRef[key] !== null) {
        console.log(`${key}:`, empRef[key]);
      }
    });

    // Show all encrypted fields
    console.log('\nENCRYPTED FIELDS:');
    Object.keys(empRef).forEach(key => {
      if (key.includes('encrypted')) {
        const value = empRef[key];
        if (value) {
          console.log(`${key}:`, decrypt(value));
        } else {
          console.log(`${key}: NULL`);
        }
      }
    });

    // Show timestamps
    console.log('\nTIMESTAMPS:');
    Object.keys(empRef).forEach(key => {
      if (key.includes('_at')) {
        console.log(`${key}:`, empRef[key]);
      }
    });
  }

  process.exit(0);
}

showAllFields();

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
    return null;
  }
}

async function checkEveryColumn() {
  const referenceId = '5e2dbf96-5db2-4fec-bd9b-9ebb175b2e27';

  console.log('=== CHECKING EVERY COLUMN IN EMPLOYER_REFERENCES ===\n');

  const { data: empRef } = await supabase
    .from('employer_references')
    .select('*')
    .eq('reference_id', referenceId)
    .single();

  if (!empRef) {
    console.log('No employer reference found!');
    process.exit(1);
  }

  console.log('Total columns:', Object.keys(empRef).length);
  console.log('\n=== SHOWING ALL NON-NULL VALUES ===\n');

  Object.keys(empRef).sort().forEach(key => {
    const value = empRef[key];

    if (value !== null && value !== undefined && value !== '') {
      if (key.includes('encrypted') && typeof value === 'string') {
        const decrypted = decrypt(value);
        if (decrypted) {
          console.log(`${key}: ${decrypted} (decrypted)`);
        } else {
          console.log(`${key}: [ENCRYPTED - cannot decrypt]`);
        }
      } else {
        console.log(`${key}:`, value);
      }
    }
  });

  console.log('\n=== ALL COLUMN NAMES (including nulls) ===\n');
  console.log(Object.keys(empRef).sort().join(', '));

  process.exit(0);
}

checkEveryColumn();

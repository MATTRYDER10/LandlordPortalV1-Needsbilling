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

async function checkTenantRefEmployerFields() {
  const referenceId = '5e2dbf96-5db2-4fec-bd9b-9ebb175b2e27';

  console.log('=== CHECKING TENANT_REFERENCES FOR EMPLOYER INFO ===\n');

  const { data: tenantRef } = await supabase
    .from('tenant_references')
    .select('*')
    .eq('id', referenceId)
    .single();

  if (!tenantRef) {
    console.log('No tenant reference found!');
    process.exit(1);
  }

  console.log('Looking for employer-related fields...\n');

  // Get all keys that might contain employer info
  const employerKeys = Object.keys(tenantRef).filter(key =>
    key.toLowerCase().includes('employer') ||
    key.toLowerCase().includes('employment')
  );

  console.log('Employer-related fields:', employerKeys.length);

  employerKeys.forEach(key => {
    const value = tenantRef[key];
    if (value !== null && value !== undefined && value !== '') {
      if (key.includes('encrypted') && typeof value === 'string') {
        const decrypted = decrypt(value);
        console.log(`${key}: ${decrypted || '[cannot decrypt]'}`);
      } else {
        console.log(`${key}:`, value);
      }
    } else {
      console.log(`${key}: NULL`);
    }
  });

  // Also check for any fields with "Rachel" or "Marshall" or the email
  console.log('\n=== SEARCHING ALL FIELDS FOR RACHEL/MARSHALL/bristol.ac.uk ===\n');

  Object.keys(tenantRef).forEach(key => {
    const value = tenantRef[key];
    if (value && typeof value === 'string') {
      const decrypted = key.includes('encrypted') ? decrypt(value) : value;
      if (decrypted) {
        if (decrypted.toLowerCase().includes('rachel') ||
            decrypted.toLowerCase().includes('marshall') ||
            decrypted.toLowerCase().includes('bristol.ac.uk')) {
          console.log(`FOUND IN ${key}:`, decrypted);
        }
      }
    }
  });

  process.exit(0);
}

checkTenantRefEmployerFields();

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
    return `[ERROR: ${error.message}]`;
  }
}

async function checkChaseDependencies() {
  const referenceId = '5e2dbf96-5db2-4fec-bd9b-9ebb175b2e27';

  console.log('=== CHASE DEPENDENCIES ===\n');

  const { data: deps } = await supabase
    .from('chase_dependencies')
    .select('*')
    .eq('reference_id', referenceId)
    .eq('dependency_type', 'EMPLOYER_REF');

  if (deps && deps.length > 0) {
    deps.forEach((dep, i) => {
      console.log(`Dependency #${i + 1}:`);
      console.log('Type:', dep.dependency_type);
      console.log('Status:', dep.status);
      console.log('Contact Name:', dep.contact_name_encrypted ? decrypt(dep.contact_name_encrypted) : 'NULL');
      console.log('Contact Email:', dep.contact_email_encrypted ? decrypt(dep.contact_email_encrypted) : 'NULL');
      console.log('Contact Phone:', dep.contact_phone_encrypted ? decrypt(dep.contact_phone_encrypted) : 'NULL');
      console.log('Created:', dep.created_at);
      console.log('Received:', dep.received_at);
      console.log('---');
    });
  } else {
    console.log('No employer chase dependencies found');
  }

  process.exit(0);
}

checkChaseDependencies();

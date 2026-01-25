const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
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
  console.log('Searching for Dongola Road references...\n');

  const { data: refs, error } = await supabase
    .from('tenant_references')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('Error:', error);
    return;
  }

  const matches = [];
  for (const ref of refs) {
    const address = decrypt(ref.property_address_encrypted) || ref.property_address || '';
    if (address.toLowerCase().includes('dongola')) {
      matches.push({ ref, address });
    }
  }

  console.log('Found', matches.length, 'matching references\n');

  for (const { ref, address } of matches) {
    console.log('ID:', ref.id);
    console.log('Address:', address);
    console.log('Status:', ref.status);
    console.log('Created:', ref.created_at);
    console.log('Company ID:', ref.company_id);
    console.log('---');
  }
})();

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
  console.log('Listing 30 most recent references...\n');

  const { data: refs } = await supabase
    .from('tenant_references')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);

  console.log(`Found ${refs?.length || 0} references:\n`);

  for (const ref of refs || []) {
    const firstName = decrypt(ref.tenant_first_name_encrypted) || ref.tenant_first_name || '';
    const lastName = decrypt(ref.tenant_last_name_encrypted) || ref.tenant_last_name || '';
    const address = decrypt(ref.property_address_encrypted) || ref.property_address || '';

    console.log('---');
    console.log('ID:', ref.id.substring(0, 8) + '...');
    console.log('Name:', firstName, lastName);
    console.log('Address:', address.substring(0, 60));
    console.log('Status:', ref.status);
    console.log('Is Guarantor:', ref.guarantor_reference_id ? 'Yes' : 'No');
    console.log('Created:', ref.created_at);
  }
})();

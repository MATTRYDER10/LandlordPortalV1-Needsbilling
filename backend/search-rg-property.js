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
  console.log('Finding RG Property Bristol company...\n');

  const { data: companies } = await supabase
    .from('companies')
    .select('*');

  let rgCompanyId = null;
  for (const company of companies) {
    const name = decrypt(company.name_encrypted) || company.name || '';
    if (name.toLowerCase().includes('rg property')) {
      console.log('Found company:', name);
      console.log('Company ID:', company.id);
      rgCompanyId = company.id;
      break;
    }
  }

  if (!rgCompanyId) {
    console.log('RG Property Bristol not found');
    return;
  }

  console.log('\nSearching for references with 5 tenants/guarantors...\n');

  const { data: refs } = await supabase
    .from('tenant_references')
    .select('*')
    .eq('company_id', rgCompanyId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(50);

  console.log('Found', refs.length, 'completed references for RG Property\n');

  for (const ref of refs) {
    const address = decrypt(ref.property_address_encrypted) || ref.property_address || '';
    const firstName = decrypt(ref.tenant_first_name_encrypted) || '';
    const lastName = decrypt(ref.tenant_last_name_encrypted) || '';
    
    console.log('---');
    console.log('ID:', ref.id.substring(0, 8) + '...');
    console.log('Address:', address);
    console.log('Tenant:', firstName, lastName);
    console.log('Created:', ref.created_at);
    console.log('Status:', ref.status);
    
    if (address.toLowerCase().includes('dongola')) {
      console.log('*** MATCH: DONGOLA ROAD FOUND ***');
    }
  }
})();

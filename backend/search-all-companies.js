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
  console.log('Listing all companies...\n');

  const { data: companies } = await supabase
    .from('companies')
    .select('*')
    .order('created_at', { ascending: false });

  for (const company of companies) {
    const name = decrypt(company.name_encrypted) || company.name || 'Unknown';
    console.log('Company:', name, '- ID:', company.id.substring(0, 8) + '...');
    
    if (name.toLowerCase().includes('rg') || name.toLowerCase().includes('bristol')) {
      console.log('  ^^^ POTENTIAL MATCH ^^^');
      
      const { data: refs, count } = await supabase
        .from('tenant_references')
        .select('id, property_address, property_address_encrypted, status, created_at', { count: 'exact' })
        .eq('company_id', company.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(20);
      
      console.log('  Has', count, 'completed references');
      
      if (refs && refs.length > 0) {
        for (const ref of refs) {
          const address = decrypt(ref.property_address_encrypted) || ref.property_address || '';
          if (address.toLowerCase().includes('dongola') || address.includes('75')) {
            console.log('  >>> REFERENCE:', ref.id.substring(0, 8) + '...');
            console.log('  >>> ADDRESS:', address);
            console.log('  >>> Created:', ref.created_at);
          }
        }
      }
    }
  }
})();

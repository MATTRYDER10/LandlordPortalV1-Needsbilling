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

const targetRefId = 'fe6a5291-ffec-417a-85b8-97d5cb46a2b3';
const partialId = 'fe6a5291'; // First segment

(async () => {
  console.log('Searching for references with similar UUID prefix...');
  console.log('Looking for IDs starting with:', partialId);
  console.log('='.repeat(80) + '\n');

  // Get all references and filter by UUID prefix
  const { data: allRefs } = await supabase
    .from('tenant_references')
    .select('*')
    .order('created_at', { ascending: false });

  const matches = (allRefs || []).filter(ref => ref.id.startsWith(partialId));

  console.log(`Found ${matches.length} references with matching UUID prefix:\n`);

  if (matches.length === 0) {
    console.log('No matching UUIDs found.');
    console.log('\nShowing 10 most recent reference IDs for comparison:\n');

    const recent = allRefs.slice(0, 10);
    recent.forEach((ref, index) => {
      const firstName = decrypt(ref.tenant_first_name_encrypted) || '';
      const lastName = decrypt(ref.tenant_last_name_encrypted) || '';
      console.log(`${index + 1}. ${ref.id}`);
      console.log(`   ${firstName} ${lastName} - ${ref.created_at}`);
    });
  } else {
    for (const ref of matches) {
      const firstName = decrypt(ref.tenant_first_name_encrypted) || '';
      const lastName = decrypt(ref.tenant_last_name_encrypted) || '';
      const address = decrypt(ref.property_address_encrypted) || ref.property_address || '';

      console.log('---');
      console.log('ID:', ref.id);
      console.log('Match:', ref.id === targetRefId ? '✅ EXACT MATCH' : '⚠️  SIMILAR');
      console.log('Name:', firstName, lastName);
      console.log('Address:', address);
      console.log('Status:', ref.status);
      console.log('Created:', ref.created_at);
      console.log('Is Guarantor:', ref.guarantor_reference_id ? 'Yes' : 'No');
      console.log('');
    }
  }

  console.log('='.repeat(80));
})();

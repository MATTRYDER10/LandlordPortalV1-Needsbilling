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

const searchTerms = ['ella', 'eital', 'monty', 'booth', 'gary', 'dow', 'tiger', 'innes', 'leo', 'monico'];

(async () => {
  console.log('Fuzzy searching for tenant names...\n');
  console.log('Search terms:', searchTerms.join(', '));
  console.log('\n' + '='.repeat(80) + '\n');

  // Get all references
  const { data: allRefs } = await supabase
    .from('tenant_references')
    .select('*')
    .order('created_at', { ascending: false });

  console.log('Total references in database:', allRefs?.length || 0);
  console.log('');

  const matches = [];

  for (const ref of allRefs || []) {
    const firstName = (decrypt(ref.tenant_first_name_encrypted) || ref.tenant_first_name || '').toLowerCase().trim();
    const lastName = (decrypt(ref.tenant_last_name_encrypted) || ref.tenant_last_name || '').toLowerCase().trim();
    const fullName = `${firstName} ${lastName}`;

    // Check if any search term appears in the name
    const matchedTerms = searchTerms.filter(term =>
      firstName.includes(term) || lastName.includes(term)
    );

    if (matchedTerms.length > 0) {
      matches.push({ ref, firstName, lastName, matchedTerms });
    }
  }

  console.log(`Found ${matches.length} potential matches:\n`);

  if (matches.length === 0) {
    console.log('No partial matches found.');
  } else {
    for (const { ref, firstName, lastName, matchedTerms } of matches) {
      const address = decrypt(ref.property_address_encrypted) || ref.property_address || '';

      console.log('---');
      console.log('ID:', ref.id.substring(0, 8) + '...');
      console.log('Name:', firstName, lastName);
      console.log('Matched terms:', matchedTerms.join(', '));
      console.log('Address:', address);
      console.log('Status:', ref.status);
      console.log('Is Guarantor:', ref.guarantor_reference_id ? 'Yes' : 'No');
      console.log('Created:', ref.created_at);
      console.log('');
    }
  }
})();

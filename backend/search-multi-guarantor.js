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
  console.log('Searching for references with exactly 5 guarantors...\n');

  // Get all references
  const { data: allRefs } = await supabase
    .from('tenant_references')
    .select('*')
    .order('created_at', { ascending: false });

  console.log('Total references in database:', allRefs?.length || 0);

  // Group by main reference ID
  const refGroups = {};

  for (const ref of allRefs || []) {
    // Main references
    if (!ref.guarantor_reference_id) {
      refGroups[ref.id] = {
        main: ref,
        guarantors: []
      };
    }
  }

  // Add guarantors to groups
  for (const ref of allRefs || []) {
    if (ref.guarantor_reference_id && refGroups[ref.guarantor_reference_id]) {
      refGroups[ref.guarantor_reference_id].guarantors.push(ref);
    }
  }

  console.log('\nReferences with 5 or more guarantors:\n');

  let found = false;
  for (const [mainId, group] of Object.entries(refGroups)) {
    if (group.guarantors.length >= 5) {
      const mainRef = group.main;
      const address = decrypt(mainRef.property_address_encrypted) || mainRef.property_address || '';
      const firstName = decrypt(mainRef.tenant_first_name_encrypted) || '';
      const lastName = decrypt(mainRef.tenant_last_name_encrypted) || '';

      console.log('='.repeat(80));
      console.log('Main Reference ID:', mainRef.id);
      console.log('Property Address:', address);
      console.log('Tenant Name:', firstName, lastName);
      console.log('Status:', mainRef.status);
      console.log('Verification State:', mainRef.verification_state);
      console.log('Company ID:', mainRef.company_id);
      console.log('Created:', mainRef.created_at);
      console.log('Updated:', mainRef.updated_at);
      console.log('Number of Guarantors:', group.guarantors.length);

      console.log('\nGuarantors:');
      group.guarantors.forEach((g, index) => {
        const gFirstName = decrypt(g.tenant_first_name_encrypted) || '';
        const gLastName = decrypt(g.tenant_last_name_encrypted) || '';
        console.log(`  ${index + 1}. ${gFirstName} ${gLastName} (Created: ${g.created_at})`);
      });
      console.log('='.repeat(80));
      console.log('');

      if (address.toLowerCase().includes('dongola') || address.includes('75')) {
        console.log('*** POTENTIAL MATCH FOR DONGOLA ***\n');
        found = true;
      }
    }
  }

  if (!found) {
    console.log('\nNo references with 5+ guarantors matching Dongola found.');
    console.log('Checking all completed references with 4+ guarantors:\n');

    for (const [mainId, group] of Object.entries(refGroups)) {
      if (group.guarantors.length >= 4 && group.main.status === 'completed') {
        const mainRef = group.main;
        const address = decrypt(mainRef.property_address_encrypted) || mainRef.property_address || '';

        console.log(`- ${mainRef.id.substring(0, 8)}... | ${group.guarantors.length} guarantors | ${address.substring(0, 50)} | ${mainRef.created_at}`);
      }
    }
  }
})();

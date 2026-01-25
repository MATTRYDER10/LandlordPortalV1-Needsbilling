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

const targetNames = [
  { first: 'Ella', last: 'Eital' },
  { first: 'Monty', last: 'Booth' },
  { first: 'Gary', last: 'Dow' },
  { first: 'Tiger', last: 'Innes' },
  { first: 'Leo', last: 'Monico' }
];

(async () => {
  console.log('Searching for specific tenant references...\n');
  console.log('Target tenants:');
  targetNames.forEach((name, i) => {
    console.log(`  ${i + 1}. ${name.first} ${name.last}`);
  });
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

    // Check if this reference matches any target name
    for (const target of targetNames) {
      if (firstName === target.first.toLowerCase() && lastName === target.last.toLowerCase()) {
        matches.push({ ref, matchedName: `${target.first} ${target.last}` });
        break;
      }
    }
  }

  console.log(`Found ${matches.length} matching references:\n`);

  if (matches.length === 0) {
    console.log('No matches found for any of the target names.');
  } else {
    // Group by main reference
    const refGroups = {};

    for (const { ref, matchedName } of matches) {
      const mainRefId = ref.guarantor_reference_id || ref.id;

      if (!refGroups[mainRefId]) {
        refGroups[mainRefId] = {
          mainRef: null,
          tenants: [],
          guarantors: []
        };
      }

      if (ref.guarantor_reference_id) {
        refGroups[mainRefId].guarantors.push({ ref, matchedName });
      } else {
        refGroups[mainRefId].mainRef = ref;
        refGroups[mainRefId].tenants.push({ ref, matchedName });
      }
    }

    // Get main references for guarantors
    for (const mainRefId of Object.keys(refGroups)) {
      if (!refGroups[mainRefId].mainRef) {
        const { data: mainRef } = await supabase
          .from('tenant_references')
          .select('*')
          .eq('id', mainRefId)
          .single();

        if (mainRef) {
          refGroups[mainRefId].mainRef = mainRef;
        }
      }
    }

    for (const [mainRefId, group] of Object.entries(refGroups)) {
      console.log('='.repeat(80));

      if (group.mainRef) {
        const mainRef = group.mainRef;
        const address = decrypt(mainRef.property_address_encrypted) || mainRef.property_address || '';
        const mainFirstName = decrypt(mainRef.tenant_first_name_encrypted) || '';
        const mainLastName = decrypt(mainRef.tenant_last_name_encrypted) || '';

        console.log('Main Reference ID:', mainRef.id);
        console.log('Property Address:', address);
        console.log('Main Tenant:', mainFirstName, mainLastName);
        console.log('Status:', mainRef.status);
        console.log('Verification State:', mainRef.verification_state);
        console.log('Company ID:', mainRef.company_id);
        console.log('Created:', mainRef.created_at);
        console.log('Updated:', mainRef.updated_at);
        console.log('');

        if (group.tenants.length > 0) {
          console.log('Matched Tenants:');
          group.tenants.forEach(({ matchedName }) => {
            console.log(`  - ${matchedName}`);
          });
          console.log('');
        }

        if (group.guarantors.length > 0) {
          console.log('Matched Guarantors:');
          group.guarantors.forEach(({ matchedName, ref }) => {
            console.log(`  - ${matchedName} (ID: ${ref.id.substring(0, 8)}...)`);
          });
          console.log('');
        }
      }

      console.log('='.repeat(80));
      console.log('');
    }

    console.log('\nSummary:');
    console.log(`Total matches: ${matches.length}`);
    console.log(`Unique references: ${Object.keys(refGroups).length}`);
  }
})();

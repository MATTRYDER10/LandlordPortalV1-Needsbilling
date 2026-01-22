const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://spaetpdmlqfygsxiawul.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

function decrypt(encryptedText) {
  if (!encryptedText) return null;
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
  console.log('🔍 Checking chase dependencies for property@southernbrook.co.uk\n');
  console.log('='.repeat(80));
  console.log('');

  // Find chase dependencies with the email property@southernbrook.co.uk
  const { data: deps, error } = await supabase
    .from('chase_dependencies')
    .select(`
      id,
      reference_id,
      dependency_type,
      status,
      contact_email_encrypted,
      linked_table,
      initial_request_sent_at,
      last_chase_sent_at,
      reference:tenant_references!chase_dependencies_reference_id_fkey (
        id,
        reference_type,
        previous_landlord_email_encrypted,
        tenant_first_name_encrypted,
        tenant_last_name_encrypted,
        property_address_encrypted
      )
    `)
    .in('status', ['PENDING', 'CHASING']);

  if (error) {
    console.error('Error:', error);
    return;
  }

  const targetEmail = 'property@southernbrook.co.uk';
  const matching = deps.filter(d => {
    const email = decrypt(d.contact_email_encrypted);
    return email && email.toLowerCase() === targetEmail.toLowerCase();
  });

  console.log(`Found ${matching.length} chase dependencies for ${targetEmail}:\n`);

  matching.forEach((dep, i) => {
    const tenantName = `${decrypt(dep.reference?.tenant_first_name_encrypted) || ''} ${decrypt(dep.reference?.tenant_last_name_encrypted) || ''}`.trim();
    const propertyAddress = decrypt(dep.reference?.property_address_encrypted) || 'N/A';

    console.log(`${i + 1}. Dependency ID: ${dep.id}`);
    console.log(`   Reference ID: ${dep.reference_id}`);
    console.log(`   Dependency Type: ${dep.dependency_type}`);
    console.log(`   Status: ${dep.status}`);
    console.log(`   Linked Table: ${dep.linked_table || 'N/A'}`);
    console.log(`   Reference Type: ${dep.reference?.reference_type || 'N/A'}`);
    console.log(`   Tenant: ${tenantName}`);
    console.log(`   Property: ${propertyAddress}`);
    console.log(`   Initial Request: ${dep.initial_request_sent_at || 'Not sent'}`);
    console.log(`   Last Chase: ${dep.last_chase_sent_at || 'Never'}`);
    console.log('');
  });

  // Now check if there are duplicate entries for the same reference
  const referenceGroups = {};
  matching.forEach(dep => {
    if (!referenceGroups[dep.reference_id]) {
      referenceGroups[dep.reference_id] = [];
    }
    referenceGroups[dep.reference_id].push(dep);
  });

  const duplicates = Object.entries(referenceGroups).filter(([refId, deps]) => deps.length > 1);

  if (duplicates.length > 0) {
    console.log('='.repeat(80));
    console.log(`\n⚠️  FOUND DUPLICATES: ${duplicates.length} reference(s) have multiple chase dependencies for the same email:\n`);

    duplicates.forEach(([refId, deps]) => {
      const tenantName = `${decrypt(deps[0].reference?.tenant_first_name_encrypted) || ''} ${decrypt(deps[0].reference?.tenant_last_name_encrypted) || ''}`.trim();
      console.log(`Reference ${refId} (${tenantName}):`);
      deps.forEach(dep => {
        console.log(`  - ${dep.dependency_type} (${dep.linked_table || 'no linked table'})`);
      });
      console.log('');
    });
  } else {
    console.log('✅ No duplicate chase dependencies found for the same reference\n');
  }
})();

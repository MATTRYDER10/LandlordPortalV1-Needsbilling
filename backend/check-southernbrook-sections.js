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
  console.log('🔍 Checking verification_sections for property@southernbrook.co.uk\n');
  console.log('='.repeat(80));
  console.log('');

  // Find verification sections with the email
  const { data: sections, error } = await supabase
    .from('verification_sections')
    .select(`
      id,
      reference_id,
      section_type,
      decision,
      contact_email_encrypted,
      initial_request_sent_at,
      last_chase_sent_at,
      last_marked_done_at,
      reference:tenant_references!verification_sections_reference_id_fkey (
        id,
        reference_type,
        status,
        verification_state,
        previous_landlord_email_encrypted,
        tenant_first_name_encrypted,
        tenant_last_name_encrypted,
        property_address_encrypted
      )
    `)
    .in('decision', ['NOT_REVIEWED', 'PENDING']);

  if (error) {
    console.error('Error:', error);
    return;
  }

  const targetEmail = 'property@southernbrook.co.uk';
  const matching = sections.filter(s => {
    const email = decrypt(s.contact_email_encrypted);
    return email && email.toLowerCase() === targetEmail.toLowerCase();
  });

  console.log(`Found ${matching.length} verification sections for ${targetEmail}:\n`);

  matching.forEach((section, i) => {
    const tenantName = `${decrypt(section.reference?.tenant_first_name_encrypted) || ''} ${decrypt(section.reference?.tenant_last_name_encrypted) || ''}`.trim();
    const propertyAddress = decrypt(section.reference?.property_address_encrypted) || 'N/A';

    console.log(`${i + 1}. Section ID: ${section.id}`);
    console.log(`   Reference ID: ${section.reference_id}`);
    console.log(`   Section Type: ${section.section_type}`);
    console.log(`   Decision: ${section.decision}`);
    console.log(`   Reference Type: ${section.reference?.reference_type || 'N/A'}`);
    console.log(`   Reference Status: ${section.reference?.status || 'N/A'}`);
    console.log(`   Verification State: ${section.reference?.verification_state || 'N/A'}`);
    console.log(`   Tenant: ${tenantName}`);
    console.log(`   Property: ${propertyAddress}`);
    console.log(`   Initial Request: ${section.initial_request_sent_at || 'Not sent'}`);
    console.log(`   Last Chase: ${section.last_chase_sent_at || 'Never'}`);
    console.log(`   Marked Done: ${section.last_marked_done_at || 'Never'}`);
    console.log('');
  });

  // Check for duplicates (multiple sections for same reference with same email)
  const referenceGroups = {};
  matching.forEach(section => {
    if (!referenceGroups[section.reference_id]) {
      referenceGroups[section.reference_id] = [];
    }
    referenceGroups[section.reference_id].push(section);
  });

  const duplicates = Object.entries(referenceGroups).filter(([refId, sections]) => sections.length > 1);

  if (duplicates.length > 0) {
    console.log('='.repeat(80));
    console.log(`\n⚠️  FOUND DUPLICATES: ${duplicates.length} reference(s) have multiple verification sections for the same email:\n`);

    duplicates.forEach(([refId, sections]) => {
      const tenantName = `${decrypt(sections[0].reference?.tenant_first_name_encrypted) || ''} ${decrypt(sections[0].reference?.tenant_last_name_encrypted) || ''}`.trim();
      console.log(`Reference ${refId} (${tenantName}):`);
      sections.forEach(section => {
        console.log(`  - ${section.section_type} (Decision: ${section.decision})`);
      });
      console.log('');
      console.log(`  ⚠️  This means the referee is receiving BOTH landlord and agent emails!`);
      console.log('');
    });
  } else {
    console.log('✅ No duplicate verification sections found for the same reference\n');
  }

  // Also show the previous_landlord_email for these references to confirm
  if (matching.length > 0) {
    console.log('='.repeat(80));
    console.log('\n📧 Email addresses stored in tenant_references:\n');

    const uniqueRefIds = [...new Set(matching.map(s => s.reference_id))];
    for (const refId of uniqueRefIds) {
      const { data: ref } = await supabase
        .from('tenant_references')
        .select('id, reference_type, previous_landlord_email_encrypted')
        .eq('id', refId)
        .single();

      if (ref) {
        const email = decrypt(ref.previous_landlord_email_encrypted);
        console.log(`Reference ${refId}:`);
        console.log(`  reference_type: ${ref.reference_type}`);
        console.log(`  previous_landlord_email: ${email}`);
        console.log('');
      }
    }
  }
})();

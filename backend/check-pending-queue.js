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
  console.log('🔍 Checking Pending Responses Queue (verification_sections)\n');
  console.log('='.repeat(80));
  console.log('');

  // Query exactly what getChaseQueue() queries
  const { data: sections, error } = await supabase
    .from('verification_sections')
    .select(`
      id,
      reference_id,
      section_type,
      decision,
      contact_name_encrypted,
      contact_email_encrypted,
      contact_phone_encrypted,
      initial_request_sent_at,
      reference:tenant_references!verification_sections_reference_id_fkey (
        id,
        tenant_first_name_encrypted,
        tenant_last_name_encrypted,
        property_address_encrypted,
        reference_type,
        status,
        verification_state
      )
    `)
    .in('section_type', ['EMPLOYER_REFERENCE', 'LANDLORD_REFERENCE', 'ACCOUNTANT_REFERENCE'])
    .eq('decision', 'NOT_REVIEWED')
    .order('initial_request_sent_at', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${sections?.length || 0} sections in Pending Responses queue\n`);

  // Filter by southernbrook
  const targetEmail = 'property@southernbrook.co.uk';
  const matching = sections.filter(s => {
    const email = decrypt(s.contact_email_encrypted);
    return email && email.toLowerCase().includes('southernbrook');
  });

  console.log(`Found ${matching.length} sections with 'southernbrook' in email:\n`);

  matching.forEach((section, i) => {
    const tenantName = `${decrypt(section.reference?.tenant_first_name_encrypted) || ''} ${decrypt(section.reference?.tenant_last_name_encrypted) || ''}`.trim();
    const propertyAddress = decrypt(section.reference?.property_address_encrypted) || 'N/A';
    const email = decrypt(section.contact_email_encrypted);
    const contactName = decrypt(section.contact_name_encrypted);

    console.log(`${i + 1}. Section ID: ${section.id}`);
    console.log(`   Reference ID: ${section.reference_id}`);
    console.log(`   Section Type: ${section.section_type}`);
    console.log(`   Decision: ${section.decision}`);
    console.log(`   Contact Name: ${contactName}`);
    console.log(`   Contact Email: ${email}`);
    console.log(`   Reference Type: ${section.reference?.reference_type || 'N/A'}`);
    console.log(`   Reference Status: ${section.reference?.status || 'N/A'}`);
    console.log(`   Verification State: ${section.reference?.verification_state || 'N/A'}`);
    console.log(`   Tenant: ${tenantName}`);
    console.log(`   Property: ${propertyAddress}`);
    console.log(`   Initial Request: ${section.initial_request_sent_at || 'Not sent'}`);
    console.log('');
  });

  // Check for duplicates
  const referenceGroups = {};
  matching.forEach(section => {
    if (!referenceGroups[section.reference_id]) {
      referenceGroups[section.reference_id] = [];
    }
    referenceGroups[section.reference_id].push(section);
  });

  const duplicates = Object.entries(referenceGroups).filter(([, sections]) => sections.length > 1);

  if (duplicates.length > 0) {
    console.log('='.repeat(80));
    console.log(`\n⚠️  FOUND DUPLICATES: ${duplicates.length} reference(s) have multiple sections for southernbrook:\n`);

    duplicates.forEach(([refId, sections]) => {
      const tenantName = `${decrypt(sections[0].reference?.tenant_first_name_encrypted) || ''} ${decrypt(sections[0].reference?.tenant_last_name_encrypted) || ''}`.trim();
      const refType = sections[0].reference?.reference_type;
      console.log(`Reference ${refId} (${tenantName}) - Reference Type: ${refType}:`);
      sections.forEach(section => {
        console.log(`  - ${section.section_type} (Decision: ${section.decision}, ID: ${section.id})`);
      });
      console.log('');
      console.log(`  ⚠️  This referee is receiving multiple chase emails!`);
      console.log('');
    });
  }

  // Now check if AGENT_REFERENCE sections exist but are not in the queue
  console.log('='.repeat(80));
  console.log('\n🔍 Checking if AGENT_REFERENCE sections exist for southernbrook (but excluded from queue):\n');

  const { data: agentSections, error: agentError } = await supabase
    .from('verification_sections')
    .select(`
      id,
      reference_id,
      section_type,
      decision,
      contact_email_encrypted,
      reference:tenant_references!verification_sections_reference_id_fkey (
        id,
        tenant_first_name_encrypted,
        tenant_last_name_encrypted,
        reference_type
      )
    `)
    .eq('section_type', 'AGENT_REFERENCE')
    .eq('decision', 'NOT_REVIEWED');

  if (agentError) {
    console.error('Error:', agentError);
    return;
  }

  const matchingAgents = agentSections.filter(s => {
    const email = decrypt(s.contact_email_encrypted);
    return email && email.toLowerCase().includes('southernbrook');
  });

  if (matchingAgents.length > 0) {
    console.log(`❗Found ${matchingAgents.length} AGENT_REFERENCE sections for southernbrook (NOT in current queue):\n`);

    matchingAgents.forEach((section, i) => {
      const tenantName = `${decrypt(section.reference?.tenant_first_name_encrypted) || ''} ${decrypt(section.reference?.tenant_last_name_encrypted) || ''}`.trim();
      const email = decrypt(section.contact_email_encrypted);

      console.log(`${i + 1}. Section ID: ${section.id}`);
      console.log(`   Reference ID: ${section.reference_id}`);
      console.log(`   Email: ${email}`);
      console.log(`   Tenant: ${tenantName}`);
      console.log(`   Reference Type: ${section.reference?.reference_type}`);
      console.log('');
    });

    console.log('⚠️  AGENT_REFERENCE is NOT included in the Pending Responses queue query!');
    console.log('The queue query only includes: EMPLOYER_REFERENCE, LANDLORD_REFERENCE, ACCOUNTANT_REFERENCE\n');
  } else {
    console.log('No AGENT_REFERENCE sections found for southernbrook\n');
  }
})();

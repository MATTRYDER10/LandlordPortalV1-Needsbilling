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
  console.log('🔍 Checking history for property@southernbrook.co.uk\n');
  console.log('='.repeat(80));
  console.log('');

  // First, find any references with this email
  const { data: references, error: refError } = await supabase
    .from('tenant_references')
    .select(`
      id,
      reference_type,
      status,
      verification_state,
      previous_landlord_email_encrypted,
      tenant_first_name_encrypted,
      tenant_last_name_encrypted,
      property_address_encrypted,
      created_at
    `);

  if (refError) {
    console.error('Error fetching references:', refError);
    return;
  }

  const targetEmail = 'property@southernbrook.co.uk';
  const matchingRefs = references.filter(ref => {
    const email = decrypt(ref.previous_landlord_email_encrypted);
    return email && email.toLowerCase() === targetEmail.toLowerCase();
  });

  if (matchingRefs.length === 0) {
    console.log(`No references found with landlord email ${targetEmail}\n`);
    return;
  }

  console.log(`Found ${matchingRefs.length} reference(s) with landlord email ${targetEmail}:\n`);

  for (const ref of matchingRefs) {
    const tenantName = `${decrypt(ref.tenant_first_name_encrypted) || ''} ${decrypt(ref.tenant_last_name_encrypted) || ''}`.trim();
    const propertyAddress = decrypt(ref.property_address_encrypted) || 'N/A';

    console.log(`Reference ID: ${ref.id}`);
    console.log(`  Tenant: ${tenantName}`);
    console.log(`  Property: ${propertyAddress}`);
    console.log(`  Reference Type: ${ref.reference_type}`);
    console.log(`  Status: ${ref.status}`);
    console.log(`  Verification State: ${ref.verification_state || 'N/A'}`);
    console.log(`  Created: ${ref.created_at}`);
    console.log('');

    // Check verification_sections for this reference
    const { data: sections } = await supabase
      .from('verification_sections')
      .select('id, section_type, decision, initial_request_sent_at, last_chase_sent_at')
      .eq('reference_id', ref.id)
      .in('section_type', ['LANDLORD_REFERENCE', 'AGENT_REFERENCE']);

    if (sections && sections.length > 0) {
      console.log(`  Verification Sections:`);
      sections.forEach(section => {
        console.log(`    - ${section.section_type} (Decision: ${section.decision})`);
        console.log(`      Initial Request: ${section.initial_request_sent_at || 'Not sent'}`);
        console.log(`      Last Chase: ${section.last_chase_sent_at || 'Never'}`);
      });
      console.log('');
    }

    // Check reference_notes for chase-related activity
    const { data: notes } = await supabase
      .from('reference_notes')
      .select('id, note_encrypted, created_at')
      .eq('reference_id', ref.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (notes && notes.length > 0) {
      console.log(`  Recent Notes:`);
      notes.forEach(note => {
        const noteText = decrypt(note.note_encrypted) || '';
        if (noteText.toLowerCase().includes('chase') ||
            noteText.toLowerCase().includes('email') ||
            noteText.toLowerCase().includes('landlord') ||
            noteText.toLowerCase().includes('agent')) {
          console.log(`    - ${noteText.substring(0, 100)}${noteText.length > 100 ? '...' : ''}`);
          console.log(`      (${note.created_at})`);
        }
      });
      console.log('');
    }

    // Check chase_dependencies
    const { data: deps } = await supabase
      .from('chase_dependencies')
      .select('id, dependency_type, status, linked_table, initial_request_sent_at, last_chase_sent_at')
      .eq('reference_id', ref.id);

    if (deps && deps.length > 0) {
      console.log(`  Chase Dependencies:`);
      deps.forEach(dep => {
        console.log(`    - ${dep.dependency_type} (Status: ${dep.status}, Linked: ${dep.linked_table || 'N/A'})`);
        console.log(`      Initial Request: ${dep.initial_request_sent_at || 'Not sent'}`);
        console.log(`      Last Chase: ${dep.last_chase_sent_at || 'Never'}`);
      });
      console.log('');
    }

    console.log('-'.repeat(80));
    console.log('');
  }

  // Check if ANY of these references have BOTH landlord and agent sections
  console.log('='.repeat(80));
  console.log('\n🔍 Checking for DUPLICATE sections (both LANDLORD_REFERENCE and AGENT_REFERENCE):\n');

  for (const ref of matchingRefs) {
    const { data: sections } = await supabase
      .from('verification_sections')
      .select('id, section_type, decision')
      .eq('reference_id', ref.id)
      .in('section_type', ['LANDLORD_REFERENCE', 'AGENT_REFERENCE']);

    if (sections && sections.length > 1) {
      const tenantName = `${decrypt(ref.tenant_first_name_encrypted) || ''} ${decrypt(ref.tenant_last_name_encrypted) || ''}`.trim();
      console.log(`⚠️  DUPLICATE FOUND - Reference ${ref.id} (${tenantName}):`);
      console.log(`   Reference Type: ${ref.reference_type}`);
      sections.forEach(section => {
        console.log(`   - ${section.section_type} (${section.decision})`);
      });
      console.log('');
      console.log(`   ❌ This referee received BOTH landlord and agent emails!`);
      console.log('');
    }
  }
})();

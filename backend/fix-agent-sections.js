const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://spaetpdmlqfygsxiawul.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('🔍 Finding verification_sections with incorrect section_type for agent references\n');
  console.log('='.repeat(80));
  console.log('');

  // Find all LANDLORD_REFERENCE sections where the reference_type is 'agent'
  const { data: sections, error } = await supabase
    .from('verification_sections')
    .select(`
      id,
      reference_id,
      section_type,
      decision,
      reference:tenant_references!verification_sections_reference_id_fkey (
        id,
        reference_type,
        previous_landlord_name_encrypted,
        previous_landlord_email_encrypted
      )
    `)
    .eq('section_type', 'LANDLORD_REFERENCE');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${sections?.length || 0} LANDLORD_REFERENCE sections\n`);

  // Filter to those where reference_type is 'agent'
  const mismatched = sections.filter(s => s.reference?.reference_type === 'agent');

  if (mismatched.length === 0) {
    console.log('✅ No mismatched sections found - all LANDLORD_REFERENCE sections are for landlord references\n');
    return;
  }

  console.log(`⚠️  Found ${mismatched.length} LANDLORD_REFERENCE sections that should be AGENT_REFERENCE:\n`);

  mismatched.forEach((section, i) => {
    console.log(`${i + 1}. Section ID: ${section.id}`);
    console.log(`   Reference ID: ${section.reference_id}`);
    console.log(`   Reference Type: ${section.reference?.reference_type}`);
    console.log(`   Current Section Type: ${section.section_type} (WRONG)`);
    console.log(`   Should Be: AGENT_REFERENCE`);
    console.log(`   Decision: ${section.decision}`);
    console.log('');
  });

  console.log('='.repeat(80));
  console.log('\n📋 FIXING MISMATCHED SECTIONS\n');

  let successCount = 0;
  let failCount = 0;

  for (const section of mismatched) {
    const { error: updateError } = await supabase
      .from('verification_sections')
      .update({
        section_type: 'AGENT_REFERENCE',
        updated_at: new Date().toISOString()
      })
      .eq('id', section.id);

    if (updateError) {
      console.error(`❌ Failed to update section ${section.id}:`, updateError.message);
      failCount++;
    } else {
      console.log(`✅ Updated section ${section.id} to AGENT_REFERENCE`);
      successCount++;
    }
  }

  console.log('');
  console.log('='.repeat(80));
  console.log(`\n✅ Fix complete: ${successCount} updated, ${failCount} failed\n`);
  console.log('These sections will now correctly send AGENT_REFERENCE chase emails instead of LANDLORD_REFERENCE emails.\n');
})();

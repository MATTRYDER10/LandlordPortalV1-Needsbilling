import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAgentReferenceSections() {
  console.log('=== CHECKING FOR AGENT_REFERENCE SECTIONS ===\n');

  const { data: sections, error } = await supabase
    .from('verification_sections')
    .select('*')
    .eq('section_type', 'AGENT_REFERENCE');

  if (error) {
    console.error('Query error:', error);
    return;
  }

  console.log(`Found ${sections?.length || 0} AGENT_REFERENCE sections\n`);

  if (sections && sections.length > 0) {
    console.log('⚠️  AGENT_REFERENCE sections exist in database!');
    console.log('These should be migrated to LANDLORD_REFERENCE\n');
    sections.forEach(s => {
      console.log(`Section ID: ${s.id}`);
      console.log(`Reference ID: ${s.reference_id}`);
      console.log(`Decision: ${s.decision}`);
      console.log('');
    });
  } else {
    console.log('✅ No AGENT_REFERENCE sections found');
    console.log('AGENT_REFERENCE can be removed from queries');
  }
}

checkAgentReferenceSections();

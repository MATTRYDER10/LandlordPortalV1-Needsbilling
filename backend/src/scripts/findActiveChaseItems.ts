import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findActiveChaseItems() {
  console.log('=== FINDING ACTIVE CHASE ITEMS ===\n');

  // Get all references in ACTIVE states (not completed/rejected/cancelled)
  const { data: activeRefs } = await supabase
    .from('tenant_references')
    .select('id, verification_state, status, created_at')
    .not('verification_state', 'in', '(COMPLETED,REJECTED,CANCELLED)')
    .order('created_at', { ascending: false });

  console.log(`Found ${activeRefs?.length || 0} active references\n`);

  if (!activeRefs || activeRefs.length === 0) {
    console.log('No active references found');
    return;
  }

  // For each active reference, check if it has external reference sections in NOT_REVIEWED
  let foundCount = 0;
  const EXTERNAL_REF_TYPES = ['EMPLOYER_REFERENCE', 'LANDLORD_REFERENCE', 'AGENT_REFERENCE', 'ACCOUNTANT_REFERENCE'];

  for (const ref of activeRefs) {
    const { data: sections } = await supabase
      .from('verification_sections')
      .select('id, section_type, decision, initial_request_sent_at')
      .eq('reference_id', ref.id)
      .in('section_type', EXTERNAL_REF_TYPES)
      .eq('decision', 'NOT_REVIEWED');

    if (sections && sections.length > 0) {
      foundCount++;
      console.log(`Reference ${ref.id}:`);
      console.log(`  State: ${ref.verification_state}`);
      console.log(`  Created: ${new Date(ref.created_at).toLocaleString()}`);
      console.log(`  External sections NOT_REVIEWED: ${sections.length}`);

      sections.forEach(s => {
        console.log(`    - ${s.section_type}: initial_request_sent_at = ${s.initial_request_sent_at || 'NOT SENT'}`);
      });
      console.log('');
    }
  }

  console.log(`\nTotal active references with pending external sections: ${foundCount}`);
  console.log('\n=== END INVESTIGATION ===');
}

findActiveChaseItems();

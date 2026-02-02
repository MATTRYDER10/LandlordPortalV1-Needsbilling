import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkCompletedRefs() {
  console.log('=== COMPLETED REFERENCES WITH PENDING EXTERNAL SECTIONS ===\n');

  const EXTERNAL_REF_TYPES = ['EMPLOYER_REFERENCE', 'LANDLORD_REFERENCE', 'AGENT_REFERENCE', 'ACCOUNTANT_REFERENCE'];

  // Get all verification sections that are NOT_REVIEWED and have initial request sent
  const { data: sections } = await supabase
    .from('verification_sections')
    .select(`
      id,
      section_type,
      decision,
      initial_request_sent_at,
      created_at,
      reference:tenant_references!verification_sections_reference_id_fkey (
        id,
        verification_state,
        status,
        created_at
      )
    `)
    .in('section_type', EXTERNAL_REF_TYPES)
    .eq('decision', 'NOT_REVIEWED')
    .not('initial_request_sent_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);

  console.log(`Found ${sections?.length || 0} external sections with NOT_REVIEWED and initial_request_sent_at\n`);

  if (!sections || sections.length === 0) {
    console.log('No sections found');
    return;
  }

  // Group by reference state
  const byState: any = {};
  sections.forEach((s: any) => {
    const state = s.reference?.verification_state || 'null';
    if (!byState[state]) byState[state] = [];
    byState[state].push(s);
  });

  console.log('Grouped by reference verification_state:');
  for (const [state, sectionList] of Object.entries(byState)) {
    const list = sectionList as any[];
    console.log(`\n${state}: ${list.length} sections`);

    // Show first 5 examples
    list.slice(0, 5).forEach((s: any) => {
      const refCreated = s.reference?.created_at ? new Date(s.reference.created_at).toLocaleDateString() : 'unknown';
      const sectionCreated = new Date(s.created_at).toLocaleDateString();
      console.log(`  - ${s.section_type} (ref: ${s.reference?.id?.substring(0, 8)}...)`);
      console.log(`    Ref created: ${refCreated}, Section created: ${sectionCreated}`);
      console.log(`    Initial sent: ${new Date(s.initial_request_sent_at).toLocaleString()}`);
    });

    if (list.length > 5) {
      console.log(`    ... and ${list.length - 5} more`);
    }
  }

  console.log('\n=== END INVESTIGATION ===');
}

checkCompletedRefs();

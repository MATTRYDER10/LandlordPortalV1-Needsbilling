import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkRecentRefs() {
  console.log('=== CHECKING RECENT REFERENCES ===\n');

  const twoDaysAgo = new Date();
  twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);

  const { data: refs } = await supabase
    .from('tenant_references')
    .select('*')
    .gte('created_at', twoDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  console.log(`Found ${refs?.length || 0} references created in last 48 hours\n`);

  if (!refs || refs.length === 0) {
    console.log('No recent references found');
    return;
  }

  for (const ref of refs) {
    console.log(`\nReference: ${ref.id}`);
    console.log(`  Created: ${new Date(ref.created_at).toLocaleString()}`);
    console.log(`  Status: ${ref.status}`);
    console.log(`  Verification State: ${ref.verification_state || 'null'}`);
    console.log(`  Submitted At: ${ref.submitted_at ? new Date(ref.submitted_at).toLocaleString() : 'NOT SUBMITTED'}`);

    // Check if they have employment history (which would require employer reference)
    const { data: employmentHistory } = await supabase
      .from('employment_history')
      .select('*')
      .eq('tenant_reference_id', ref.id);

    // Check if they have residential history (which would require landlord reference)
    const { data: residentialHistory } = await supabase
      .from('residential_history')
      .select('*')
      .eq('tenant_reference_id', ref.id);

    console.log(`  Employment History: ${employmentHistory?.length || 0} records`);
    console.log(`  Residential History: ${residentialHistory?.length || 0} records`);

    // Check verification sections
    const { data: sections } = await supabase
      .from('verification_sections')
      .select('section_type, decision, initial_request_sent_at')
      .eq('reference_id', ref.id);

    if (sections && sections.length > 0) {
      console.log(`  Verification Sections: ${sections.length}`);
      sections.forEach(s => {
        console.log(`    - ${s.section_type}: ${s.decision}, initial_sent=${s.initial_request_sent_at ? 'YES' : 'NO'}`);
      });
    } else {
      console.log(`  Verification Sections: NONE - sections not initialized!`);
    }

    // If submitted but no sections, this is a problem
    if (ref.submitted_at && (!sections || sections.length === 0)) {
      console.log(`  ⚠️  WARNING: Reference submitted but no verification sections exist!`);
    }
  }

  console.log('\n=== END INVESTIGATION ===');
}

checkRecentRefs();

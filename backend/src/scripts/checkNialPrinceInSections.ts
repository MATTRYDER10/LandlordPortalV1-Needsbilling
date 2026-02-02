import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNialPrince() {
  const referenceId = 'd0d15d1b-83d8-4af4-96e0-5ba343e6d8d7';

  console.log('=== CHECKING NIAL PRINCE REFERENCE ===\n');
  console.log(`Reference ID: ${referenceId}\n`);

  // Check verification_sections table
  const { data: sections } = await supabase
    .from('verification_sections')
    .select('*')
    .eq('reference_id', referenceId);

  console.log(`verification_sections entries: ${sections?.length || 0}\n`);

  if (sections && sections.length > 0) {
    sections.forEach(s => {
      console.log(`Section found:`);
      console.log(`  ID: ${s.id}`);
      console.log(`  Type: ${s.section_type}`);
      console.log(`  Decision: ${s.decision}`);
      console.log(`  Initial request sent: ${s.initial_request_sent_at || 'NO'}`);
      console.log(`  Last chase sent: ${s.last_chase_sent_at || 'NEVER'}`);
      console.log('');
    });
  } else {
    console.log('❌ NO verification_sections entries found for this reference!\n');
  }

  // Check chase_dependencies table
  const { data: deps } = await supabase
    .from('chase_dependencies')
    .select('*')
    .eq('reference_id', referenceId);

  console.log(`chase_dependencies entries: ${deps?.length || 0}\n`);

  if (deps && deps.length > 0) {
    deps.forEach(d => {
      console.log(`Chase dependency found:`);
      console.log(`  ID: ${d.id}`);
      console.log(`  Type: ${d.dependency_type}`);
      console.log(`  Status: ${d.status}`);
      console.log(`  Email attempts: ${d.email_attempts || 0}`);
      console.log(`  Last contacted: ${d.last_contacted_at || 'NEVER'}`);
      console.log(`  Created: ${new Date(d.created_at).toLocaleString()}`);
      console.log('');
    });
  }

  // Check the reference itself
  const { data: ref } = await supabase
    .from('tenant_references')
    .select('*')
    .eq('id', referenceId)
    .single();

  if (ref) {
    console.log('Reference details:');
    console.log(`  State: ${ref.verification_state}`);
    console.log(`  Status: ${ref.status}`);
    console.log(`  Submitted: ${ref.submitted_at ? new Date(ref.submitted_at).toLocaleString() : 'NOT SUBMITTED'}`);
    console.log(`  Created: ${new Date(ref.created_at).toLocaleString()}`);
  }

  console.log('\n=== DIAGNOSIS ===');
  if (!sections || sections.length === 0) {
    console.log('⚠️  PROBLEM: Reference has chase_dependencies entries but NO verification_sections entries!');
    console.log('This is why it does not appear in the Pending Responses queue.');
    console.log('\nThe queue queries verification_sections table only.');
    console.log('Items in chase_dependencies without corresponding verification_sections are invisible to the queue.');
  }

  console.log('\n=== END CHECK ===');
}

checkNialPrince();

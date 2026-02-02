import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const referenceId = 'febb2150-33dd-47b1-93cb-eb011a195eb2';

async function checkReference() {
  console.log(`=== CHECKING REFERENCE ${referenceId} ===\n`);

  // Get reference details
  const { data: reference } = await supabase
    .from('tenant_references')
    .select('*')
    .eq('id', referenceId)
    .single();

  if (!reference) {
    console.log('Reference not found');
    return;
  }

  console.log('Reference Details:');
  console.log(`  Status: ${reference.status}`);
  console.log(`  Verification State: ${reference.verification_state}`);
  console.log(`  Created: ${new Date(reference.created_at).toLocaleString()}`);
  console.log(`  Updated: ${new Date(reference.updated_at).toLocaleString()}`);
  console.log('');

  // Get verification sections
  const { data: sections } = await supabase
    .from('verification_sections')
    .select('*')
    .eq('reference_id', referenceId)
    .order('section_order', { ascending: true });

  if (sections && sections.length > 0) {
    console.log(`Verification Sections (${sections.length} total):`);

    const actionRequiredSections = sections.filter((s: any) => s.decision === 'ACTION_REQUIRED');
    const passedSections = sections.filter((s: any) => s.decision === 'PASS' || s.decision === 'PASS_WITH_CONDITION');
    const failedSections = sections.filter((s: any) => s.decision === 'FAIL');
    const notReviewedSections = sections.filter((s: any) => s.decision === 'NOT_REVIEWED');

    console.log(`  - NOT_REVIEWED: ${notReviewedSections.length}`);
    console.log(`  - PASS/PASS_WITH_CONDITION: ${passedSections.length}`);
    console.log(`  - ACTION_REQUIRED: ${actionRequiredSections.length}`);
    console.log(`  - FAIL: ${failedSections.length}`);
    console.log('');

    if (actionRequiredSections.length > 0) {
      console.log('ACTION_REQUIRED Sections:');
      actionRequiredSections.forEach((s: any) => {
        console.log(`  - ${s.section_type}`);
        console.log(`    Reason Code: ${s.action_reason_code || 'N/A'}`);
        console.log(`    Agent Note: ${s.action_agent_note || 'N/A'}`);
        console.log(`    Internal Note: ${s.action_internal_note || 'N/A'}`);
        console.log(`    Decision At: ${s.decision_at ? new Date(s.decision_at).toLocaleString() : 'N/A'}`);
        console.log(`    Correction Cycle: ${s.correction_cycle || 0}`);
        console.log('');
      });
    }

    console.log('All Sections:');
    sections.forEach((s: any) => {
      console.log(`  - ${s.section_type}: ${s.decision}`);
    });
  } else {
    console.log('No verification sections found');
  }

  console.log('');

  // Check work items
  const { data: workItems } = await supabase
    .from('work_items')
    .select('*')
    .eq('reference_id', referenceId);

  if (workItems && workItems.length > 0) {
    console.log(`Work Items (${workItems.length}):`);
    workItems.forEach((w: any) => {
      console.log(`  - ${w.work_type}: ${w.status}`);
      console.log(`    Created: ${new Date(w.created_at).toLocaleString()}`);
      if (w.assigned_to) {
        console.log(`    Assigned to: ${w.assigned_to}`);
      }
    });
  } else {
    console.log('No work items found');
  }

  console.log('');

  // Determine what the state SHOULD be
  if (sections && sections.length > 0) {
    const hasActionRequired = sections.some((s: any) => s.decision === 'ACTION_REQUIRED');
    const allReviewed = sections.every((s: any) => s.decision !== 'NOT_REVIEWED');

    console.log('Analysis:');
    console.log(`  Has ACTION_REQUIRED sections: ${hasActionRequired}`);
    console.log(`  All sections reviewed: ${allReviewed}`);
    console.log(`  Current verification_state: ${reference.verification_state}`);

    if (hasActionRequired && reference.verification_state !== 'ACTION_REQUIRED') {
      console.log('  ⚠️  MISMATCH: Has ACTION_REQUIRED sections but verification_state is NOT ACTION_REQUIRED');
      console.log('  ✅  Should be: ACTION_REQUIRED');
    } else if (hasActionRequired && reference.verification_state === 'ACTION_REQUIRED') {
      console.log('  ✅  State is correct: ACTION_REQUIRED');
    } else {
      console.log('  State appears correct for current section decisions');
    }
  }

  console.log('\n=== END INVESTIGATION ===');
}

checkReference();

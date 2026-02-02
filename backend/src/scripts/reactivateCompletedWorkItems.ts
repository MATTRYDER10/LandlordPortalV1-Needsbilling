import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function reactivateCompletedWorkItems() {
  console.log('Finding references in READY_FOR_REVIEW state with COMPLETED work items...\n');

  // Find all references in READY_FOR_REVIEW or IN_VERIFICATION state
  const { data: references, error: refsError } = await supabase
    .from('tenant_references')
    .select('id, status, verification_state, is_guarantor')
    .in('verification_state', ['READY_FOR_REVIEW', 'IN_VERIFICATION']);

  if (refsError) {
    console.error('Error fetching references:', refsError);
    return;
  }

  console.log(`Found ${references?.length || 0} references in READY_FOR_REVIEW or IN_VERIFICATION state\n`);

  let reactivated = 0;
  let alreadyActive = 0;
  let noWorkItem = 0;

  for (const ref of references || []) {
    // Check if work item exists and is COMPLETED
    const { data: workItem, error: workItemError } = await supabase
      .from('work_items')
      .select('id, status')
      .eq('reference_id', ref.id)
      .eq('work_type', 'VERIFY')
      .maybeSingle();

    if (workItemError) {
      console.error(`Error checking work item for ${ref.id}:`, workItemError);
      continue;
    }

    if (!workItem) {
      // No work item exists - create one
      const { data: created, error: createError } = await supabase
        .from('work_items')
        .insert({
          reference_id: ref.id,
          work_type: 'VERIFY',
          status: 'AVAILABLE',
          priority: 0
        })
        .select('id')
        .single();

      if (createError) {
        console.error(`✗ Failed to create work item for ${ref.id}:`, createError.message);
      } else {
        console.log(`✓ Created new work item for ${ref.id} (${ref.is_guarantor ? 'GUARANTOR' : 'TENANT'})`);
        noWorkItem++;
      }
    } else if (workItem.status === 'COMPLETED') {
      // Reactivate the completed work item
      const { error: updateError } = await supabase
        .from('work_items')
        .update({
          status: 'AVAILABLE',
          assigned_to: null,
          assigned_at: null,
          completed_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', workItem.id);

      if (updateError) {
        console.error(`✗ Failed to reactivate work item for ${ref.id}:`, updateError.message);
      } else {
        console.log(`✓ Reactivated work item for ${ref.id} (${ref.is_guarantor ? 'GUARANTOR' : 'TENANT'})`);
        reactivated++;
      }
    } else {
      // Work item already in active state
      alreadyActive++;
    }
  }

  console.log(`\n========================================`);
  console.log(`Results:`);
  console.log(`  - Reactivated (COMPLETED → AVAILABLE): ${reactivated}`);
  console.log(`  - Created (no work item existed): ${noWorkItem}`);
  console.log(`  - Already active: ${alreadyActive}`);
  console.log(`========================================`);
}

reactivateCompletedWorkItems();

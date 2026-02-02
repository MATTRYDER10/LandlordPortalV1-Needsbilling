import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixMissingWorkItems() {
  console.log('Finding references in READY_FOR_REVIEW state without work items...\n');

  // Find all references in READY_FOR_REVIEW or IN_VERIFICATION state
  const { data: references, error: refsError } = await supabase
    .from('tenant_references')
    .select('id, status, verification_state, tenant_first_name_encrypted, tenant_last_name_encrypted, is_guarantor')
    .in('verification_state', ['READY_FOR_REVIEW', 'IN_VERIFICATION']);

  if (refsError) {
    console.error('Error fetching references:', refsError);
    return;
  }

  console.log(`Found ${references?.length || 0} references in READY_FOR_REVIEW or IN_VERIFICATION state`);

  let fixed = 0;
  let alreadyHasWorkItem = 0;

  for (const ref of references || []) {
    // Check if work item exists
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
        console.log(`✓ Created work item for ${ref.id} (${ref.is_guarantor ? 'GUARANTOR' : 'TENANT'})`);
        fixed++;
      }
    } else {
      alreadyHasWorkItem++;
    }
  }

  console.log(`\n========================================`);
  console.log(`Results:`);
  console.log(`  - Fixed (created work items): ${fixed}`);
  console.log(`  - Already had work items: ${alreadyHasWorkItem}`);
  console.log(`========================================`);
}

fixMissingWorkItems();

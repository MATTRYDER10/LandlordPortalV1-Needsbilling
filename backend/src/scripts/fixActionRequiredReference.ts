import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const referenceId = 'febb2150-33dd-47b1-93cb-eb011a195eb2';

async function fixReference() {
  console.log(`=== FIXING REFERENCE ${referenceId} ===\n`);

  // Check current state
  const { data: reference } = await supabase
    .from('tenant_references')
    .select('verification_state, status')
    .eq('id', referenceId)
    .single();

  console.log('Current state:');
  console.log(`  verification_state: ${reference?.verification_state}`);
  console.log(`  status: ${reference?.status}`);
  console.log('');

  // Get sections
  const { data: sections } = await supabase
    .from('verification_sections')
    .select('section_type, decision')
    .eq('reference_id', referenceId);

  const hasActionRequired = sections?.some(s => s.decision === 'ACTION_REQUIRED');

  console.log(`Has ACTION_REQUIRED sections: ${hasActionRequired}`);
  if (hasActionRequired) {
    const actionRequiredSections = sections?.filter(s => s.decision === 'ACTION_REQUIRED');
    console.log('ACTION_REQUIRED sections:');
    actionRequiredSections?.forEach(s => {
      console.log(`  - ${s.section_type}`);
    });
  }
  console.log('');

  if (hasActionRequired && reference?.verification_state !== 'ACTION_REQUIRED') {
    console.log('⚠️  FIXING: Setting verification_state to ACTION_REQUIRED');

    const { error: updateError } = await supabase
      .from('tenant_references')
      .update({
        verification_state: 'ACTION_REQUIRED',
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('id', referenceId);

    if (updateError) {
      console.error('Failed to update reference:', updateError);
      return;
    }

    console.log('✅  Reference updated to ACTION_REQUIRED');
    console.log('');

    // Reactivate or create VERIFY work item
    const { data: workItems } = await supabase
      .from('work_items')
      .select('id, status')
      .eq('reference_id', referenceId)
      .eq('work_type', 'VERIFY');

    if (workItems && workItems.length > 0) {
      const workItem = workItems[0];
      if (workItem.status === 'COMPLETED') {
        console.log('Reactivating COMPLETED work item...');

        const { error: workItemError } = await supabase
          .from('work_items')
          .update({
            status: 'AVAILABLE',
            assigned_to: null,
            assigned_at: null,
            completed_at: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', workItem.id);

        if (workItemError) {
          console.error('Failed to reactivate work item:', workItemError);
        } else {
          console.log('✅  Work item reactivated');
        }
      }
    } else {
      console.log('No work item found - creating new one...');

      const { error: createError } = await supabase
        .from('work_items')
        .insert({
          reference_id: referenceId,
          work_type: 'VERIFY',
          status: 'AVAILABLE',
          priority: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (createError) {
        console.error('Failed to create work item:', createError);
      } else {
        console.log('✅  Work item created');
      }
    }

    // Log the correction
    await supabase
      .from('reference_audit_log')
      .insert({
        reference_id: referenceId,
        action: 'SYSTEM_CORRECTION',
        description: 'Reference corrected: Set to ACTION_REQUIRED due to RTR section requiring action',
        metadata: {
          reason: 'Reference was incorrectly finalized with ACTION_REQUIRED sections',
          corrected_by: 'system_script'
        },
        created_by: null
      });

    console.log('✅  Audit log entry created');
  } else {
    console.log('No fix needed - reference is already in correct state');
  }

  console.log('\n=== FIX COMPLETE ===');
}

fixReference();

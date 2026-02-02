import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkReference() {
  const refId = '7efc5688-97a0-47f6-b85a-3386e007fd05';

  // Get reference details
  const { data: ref, error: refError } = await supabase
    .from('tenant_references')
    .select('id, status, is_guarantor, verification_state, tenant_first_name_encrypted, tenant_last_name_encrypted, created_at, updated_at')
    .eq('id', refId)
    .single();

  if (refError) {
    console.log('Reference error:', refError);
    return;
  }

  console.log('Reference Status:', ref.status);
  console.log('Verification State:', ref.verification_state);
  console.log('Is Guarantor:', ref.is_guarantor);
  console.log('Updated At:', ref.updated_at);
  console.log('');

  // Get work items for this reference (used by verify queue)
  const { data: workItems, error: workItemsError } = await supabase
    .from('work_items')
    .select('id, work_type, status, priority, assigned_to, created_at, updated_at')
    .eq('reference_id', refId)
    .order('created_at', { ascending: false});

  console.log('Work Items for this reference:');
  if (workItems && workItems.length > 0) {
    workItems.forEach((item: any) => {
      console.log(`  - ${item.work_type}: ${item.status} (Priority: ${item.priority}, Created: ${item.created_at})`);
    });
  } else {
    console.log('  No work items found');
  }
  console.log('');

  // Check responses
  const { data: responses, error: responsesError } = await supabase
    .from('reference_responses')
    .select('id, respondent_type, status, completed_at, created_at')
    .eq('reference_id', refId)
    .order('created_at', { ascending: false });

  console.log('Reference Responses:');
  if (responses && responses.length > 0) {
    responses.forEach((resp: any) => {
      console.log(`  - ${resp.respondent_type}: ${resp.status} (Completed: ${resp.completed_at || 'Not completed'})`);
    });
  } else {
    console.log('  No responses found');
  }
}

checkReference();

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkQiangStatus() {
  console.log('=== CHECKING QIANG LAN STATUS ===\n');

  const qiangReferenceId = '5e2dbf96-5db2-4fec-bd9b-9ebb175b2e27';

  // Find work item
  const { data: workItem } = await supabase
    .from('work_items')
    .select('*')
    .eq('reference_id', qiangReferenceId)
    .eq('work_type', 'VERIFY')
    .maybeSingle();

  if (!workItem) {
    console.log('❌ No VERIFY work item found for Qiang Lan');
    process.exit(1);
  }

  console.log('Work Item ID:', workItem.id);
  console.log('Reference ID:', workItem.reference_id);
  console.log('Status:', workItem.status);
  console.log('Work Type:', workItem.work_type);
  console.log('Assigned To:', workItem.assigned_to || 'Unassigned');
  console.log('Priority:', workItem.priority);
  console.log('Created:', workItem.created_at);
  console.log('Updated:', workItem.updated_at);
  console.log('');

  // Check employer reference
  const { data: empRef } = await supabase
    .from('employer_references')
    .select('id, submitted_at, reference_token_hash')
    .eq('reference_id', qiangReferenceId)
    .single();

  console.log('=== EMPLOYER REFERENCE ===');
  console.log('Submitted At:', empRef?.submitted_at || 'Not submitted');
  console.log('Has Token:', empRef?.reference_token_hash ? 'Yes' : 'No');

  process.exit(0);
}

checkQiangStatus();

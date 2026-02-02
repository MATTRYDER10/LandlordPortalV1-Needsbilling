import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const referenceId = 'febb2150-33dd-47b1-93cb-eb011a195eb2';

async function checkAudit() {
  console.log(`=== AUDIT LOG FOR ${referenceId} ===\n`);

  const { data: logs } = await supabase
    .from('reference_audit_log')
    .select('*')
    .eq('reference_id', referenceId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (!logs || logs.length === 0) {
    console.log('No audit logs found');
    return;
  }

  console.log(`Found ${logs.length} audit log entries:\n`);

  // Find the finalization event
  const finalizeEvent = logs.find(l => l.action === 'VERIFICATION_FINALIZED');
  const actionRequiredEvent = logs.find(l => l.action === 'ACTION_REQUIRED');
  const stateTransitions = logs.filter(l => l.action === 'VERIFICATION_STATE_TRANSITION');

  if (finalizeEvent) {
    console.log('FINALIZATION EVENT:');
    console.log(`  Time: ${new Date(finalizeEvent.created_at).toLocaleString()}`);
    console.log(`  Action: ${finalizeEvent.action}`);
    console.log(`  Description: ${finalizeEvent.description}`);
    console.log(`  Metadata:`, JSON.stringify(finalizeEvent.metadata, null, 2));
    console.log('');
  }

  if (actionRequiredEvent) {
    console.log('ACTION_REQUIRED EVENT:');
    console.log(`  Time: ${new Date(actionRequiredEvent.created_at).toLocaleString()}`);
    console.log(`  Action: ${actionRequiredEvent.action}`);
    console.log(`  Description: ${actionRequiredEvent.description}`);
    console.log(`  Metadata:`, JSON.stringify(actionRequiredEvent.metadata, null, 2));
    console.log('');
  }

  console.log('STATE TRANSITIONS (most recent first):');
  stateTransitions.slice(0, 10).forEach(log => {
    console.log(`  ${new Date(log.created_at).toLocaleString()}: ${log.description}`);
    if (log.metadata) {
      console.log(`    Old: ${log.metadata.oldState}, New: ${log.metadata.newState}`);
    }
  });
  console.log('');

  console.log('ALL EVENTS (most recent 20):');
  logs.slice(0, 20).forEach(log => {
    console.log(`  ${new Date(log.created_at).toLocaleString()}: ${log.action} - ${log.description}`);
  });

  console.log('\n=== END AUDIT LOG ===');
}

checkAudit();

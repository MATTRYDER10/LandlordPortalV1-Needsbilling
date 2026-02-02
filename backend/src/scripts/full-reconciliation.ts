import { reconcileVerificationStates } from '../services/verificationStateService';
import dotenv from 'dotenv';

dotenv.config({ path: '/Users/matthewryder/PropertyGooseApp/backend/.env' });

async function runFullReconciliation() {
  console.log('=== FULL VERIFICATION STATE RECONCILIATION ===');
  console.log('Checking all in-progress references for correct verification state...');
  console.log('This will evaluate:');
  console.log('  - COLLECTING_EVIDENCE');
  console.log('  - WAITING_ON_REFERENCES');
  console.log('  - READY_FOR_REVIEW');
  console.log('');
  console.log('Starting reconciliation...');
  console.log('');

  const result = await reconcileVerificationStates();

  console.log('');
  console.log('=== RECONCILIATION COMPLETE ===');
  console.log(`References Processed: ${result.processed}`);
  console.log(`State Transitions: ${result.transitioned}`);
  console.log(`Errors: ${result.errors}`);

  if (result.transitioned > 0) {
    console.log('');
    console.log('✅ Successfully fixed references that were stuck in incorrect states.');
  }

  if (result.errors > 0) {
    console.log('');
    console.log('⚠️  Some errors occurred during reconciliation. Check logs above.');
  }
}

runFullReconciliation().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

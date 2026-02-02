import { createClient } from '@supabase/supabase-js';
import { evaluateAndTransition } from '../services/verificationStateService';
import dotenv from 'dotenv';

dotenv.config({ path: '/Users/matthewryder/PropertyGooseApp/backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function reconcileLivingWithFamily() {
  console.log('=== RECONCILIATION: Living with Family References ===');
  console.log('Finding references stuck in COLLECTING_EVIDENCE with reference_type=living_with_family...');
  console.log('');

  // Find all references with reference_type='living_with_family' in COLLECTING_EVIDENCE state
  const { data: references, error } = await supabase
    .from('tenant_references')
    .select('id, status, verification_state, reference_type, submitted_at, created_at')
    .eq('reference_type', 'living_with_family')
    .in('verification_state', ['COLLECTING_EVIDENCE', 'WAITING_ON_REFERENCES'])
    .not('submitted_at', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching references:', error);
    return;
  }

  if (!references || references.length === 0) {
    console.log('✅ No references found that need reconciliation.');
    return;
  }

  console.log(`Found ${references.length} references to check:`);
  console.log('');

  let processed = 0;
  let transitioned = 0;
  let alreadyCorrect = 0;
  let errors = 0;

  for (const ref of references) {
    processed++;
    console.log(`[${processed}/${references.length}] Processing ${ref.id}...`);
    console.log(`  Current State: ${ref.verification_state}`);
    console.log(`  Status: ${ref.status}`);
    console.log(`  Submitted: ${ref.submitted_at}`);

    try {
      const result = await evaluateAndTransition(
        ref.id,
        'Reconciliation: Living with family fix'
      );

      if (result.success && result.transitioned) {
        transitioned++;
        console.log(`  ✅ Transitioned to: ${result.newState}`);
      } else if (result.success && !result.transitioned) {
        alreadyCorrect++;
        console.log(`  ✓ Already in correct state`);
      } else {
        errors++;
        console.log(`  ❌ Error: ${result.error}`);
      }
    } catch (err) {
      errors++;
      console.error(`  ❌ Exception:`, err);
    }

    console.log('');
  }

  console.log('=== RECONCILIATION COMPLETE ===');
  console.log(`Total Processed: ${processed}`);
  console.log(`Transitioned: ${transitioned}`);
  console.log(`Already Correct: ${alreadyCorrect}`);
  console.log(`Errors: ${errors}`);
}

reconcileLivingWithFamily().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

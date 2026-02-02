import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { decrypt } from '../services/encryption';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findOutstandingIncome() {
  console.log('=== SEARCHING FOR OUTSTANDING INCOME CONFIRMATIONS ===\n');

  // Look for references with income_verified = false or null and in active states
  const { data: refs } = await supabase
    .from('tenant_references')
    .select('*')
    .not('verification_state', 'in', '(COMPLETED,REJECTED,CANCELLED)')
    .order('created_at', { ascending: false });

  console.log(`Found ${refs?.length || 0} active references\n`);

  if (!refs || refs.length === 0) {
    console.log('No active references');
    return;
  }

  let foundCount = 0;

  for (const ref of refs) {
    const firstName = decrypt(ref.tenant_first_name_encrypted);
    const lastName = decrypt(ref.tenant_last_name_encrypted);

    // Check if income section exists and is in NOT_REVIEWED
    const { data: incomeSections } = await supabase
      .from('verification_sections')
      .select('*')
      .eq('reference_id', ref.id)
      .eq('section_type', 'INCOME')
      .eq('decision', 'NOT_REVIEWED');

    // Check if there's an outstanding accountant reference
    const { data: accountantSections } = await supabase
      .from('verification_sections')
      .select('*')
      .eq('reference_id', ref.id)
      .eq('section_type', 'ACCOUNTANT_REFERENCE')
      .eq('decision', 'NOT_REVIEWED');

    if ((incomeSections && incomeSections.length > 0) || (accountantSections && accountantSections.length > 0)) {
      foundCount++;
      console.log(`\n${foundCount}. ${firstName} ${lastName}`);
      console.log(`   Reference ID: ${ref.id}`);
      console.log(`   Created: ${new Date(ref.created_at).toLocaleString()}`);
      console.log(`   State: ${ref.verification_state || 'null'}`);
      console.log(`   Status: ${ref.status}`);

      if (incomeSections && incomeSections.length > 0) {
        console.log(`   Income Section: NOT_REVIEWED`);
      }

      if (accountantSections && accountantSections.length > 0) {
        accountantSections.forEach(s => {
          console.log(`   Accountant Reference: NOT_REVIEWED`);
          console.log(`     Initial sent: ${s.initial_request_sent_at ? new Date(s.initial_request_sent_at).toLocaleString() : 'NO'}`);
          console.log(`     Last chase: ${s.last_chase_sent_at ? new Date(s.last_chase_sent_at).toLocaleString() : 'NEVER'}`);

          // Check if should be in pending responses
          if (s.initial_request_sent_at) {
            console.log(`     ✅ SHOULD BE IN PENDING RESPONSES`);
          } else {
            console.log(`     ⚠️  Initial request not yet sent`);
          }
        });
      }
    }
  }

  console.log(`\n\nTotal references with outstanding income confirmations: ${foundCount}`);
  console.log('\n=== END SEARCH ===');
}

findOutstandingIncome();

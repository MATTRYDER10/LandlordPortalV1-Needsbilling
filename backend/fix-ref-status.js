const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://spaetpdmlqfygsxiawul.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  const refId = 'b00302e6-dc23-4637-99c5-4c5e3f38d0cc';

  console.log('🔧 Fixing reference status\n');
  console.log('='.repeat(80));
  console.log('');

  // Get current status
  const { data: ref, error: refError } = await supabase
    .from('tenant_references')
    .select('id, status, submitted_at, verification_state')
    .eq('id', refId)
    .single();

  if (refError) {
    console.error('❌ Error:', refError);
    return;
  }

  console.log('📋 CURRENT STATE:\n');
  console.log(`Status: ${ref.status}`);
  console.log(`Submitted: ${ref.submitted_at || 'NOT SUBMITTED'}`);
  console.log(`Verification State: ${ref.verification_state || 'N/A'}`);
  console.log('');

  if (ref.status === 'in_progress' && !ref.submitted_at) {
    console.log('🔧 FIXING: Changing status from "in_progress" to "pending"\n');

    const { data: updated, error: updateError } = await supabase
      .from('tenant_references')
      .update({
        status: 'pending'
      })
      .eq('id', refId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Failed to update:', updateError);
      return;
    }

    console.log('✅ SUCCESS! Reference status updated:\n');
    console.log(`Old status: in_progress`);
    console.log(`New status: ${updated.status}`);
    console.log('');
    console.log('The reference will now appear in the "Sent" list');
    console.log('(waiting for tenant to submit the form)');
  } else if (ref.status === 'pending') {
    console.log('✅ Status is already correct ("pending")');
  } else {
    console.log(`ℹ️  Current status is "${ref.status}"`);
    console.log(`   Submitted: ${ref.submitted_at ? 'YES' : 'NO'}`);
    console.log('');
    console.log('   No action taken - status appears appropriate for current state');
  }

  console.log('');
  console.log('='.repeat(80));
})();

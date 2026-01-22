const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://spaetpdmlqfygsxiawul.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  const refId = '9534c0a4-5bdb-4bf7-8228-e42fa6eefe07';

  console.log('🔧 Fixing verification state for reference\n');
  console.log('='.repeat(80));
  console.log('');

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

  if (!ref.submitted_at && ref.verification_state) {
    console.log('🔧 FIXING: Clearing verification_state (tenant has not submitted)\n');

    const { data: updated, error: updateError } = await supabase
      .from('tenant_references')
      .update({
        verification_state: null
      })
      .eq('id', refId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Failed to update:', updateError);
      return;
    }

    console.log('✅ SUCCESS! Verification state cleared:\n');
    console.log(`Old verification_state: ${ref.verification_state}`);
    console.log(`New verification_state: ${updated.verification_state || 'NULL'}`);
    console.log('');
    console.log('The reference will now correctly show as waiting for tenant submission');
  } else if (!ref.verification_state) {
    console.log('✅ Verification state is already correct (NULL)');
  } else {
    console.log(`ℹ️  Reference has been submitted, verification_state is appropriate`);
  }

  console.log('');
  console.log('='.repeat(80));
})();

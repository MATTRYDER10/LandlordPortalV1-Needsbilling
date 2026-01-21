const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://spaetpdmlqfygsxiawul.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not found in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  const refId = '0f036447-ee86-4f70-a35b-e126ecdd36fc';

  console.log('🔄 Re-marking reference as submitted...');
  console.log('Reference ID:', refId);
  console.log('');

  // Re-mark as submitted with the original timestamp
  const { data: updated, error: updateError } = await supabase
    .from('tenant_references')
    .update({
      submitted_at: '2026-01-19T16:10:10.000Z',
      status: 'completed'
    })
    .eq('id', refId)
    .select('id, status, submitted_at');

  if (updateError) {
    console.error('❌ Error updating reference:', updateError);
    return;
  }

  console.log('✅ Reference marked as submitted again!');
  console.log('');
  console.log('=== STATUS ===');
  console.log('Status:', updated[0].status);
  console.log('Submitted:', updated[0].submitted_at);
  console.log('');
  console.log('ℹ️  Reference is now back to submitted status');
  console.log('   Student using Guaranto - no income required, awaiting agent response');
})();

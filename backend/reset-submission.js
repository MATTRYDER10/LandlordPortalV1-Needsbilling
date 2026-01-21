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

  console.log('🔄 Resetting reference submission...');
  console.log('Reference ID:', refId);
  console.log('');

  // Reset the submission so they can access the form again
  const { data: updated, error: updateError } = await supabase
    .from('tenant_references')
    .update({
      submitted_at: null,
      status: 'in_progress'
      // Keep all existing data - don't delete it
      // They can see what they filled and complete the rest
    })
    .eq('id', refId)
    .select('id, status, submitted_at');

  if (updateError) {
    console.error('❌ Error resetting reference:', updateError);
    return;
  }

  console.log('✅ Reference submission reset successfully!');
  console.log('');
  console.log('=== STATUS ===');
  console.log('Status:', updated[0].status);
  console.log('Submitted:', updated[0].submitted_at || 'Not submitted (can now edit)');
  console.log('');
  console.log('📧 Send this link to the tenant to complete the missing sections:');
  console.log('https://app.propertygoose.co.uk/submit-reference/' + refId);
  console.log('');
  console.log('💡 This is a non-expiring UUID-based link');
  console.log('');
  console.log('ℹ️  NOTE: All previously filled data is preserved.');
  console.log('   The tenant can see what they already entered and complete the rest.');
  console.log('');
  console.log('⚠️  Make sure to ask them to fill in:');
  console.log('   - Income/Employment details (so employer reference can be sent)');
  console.log('   - Current address');
  console.log('   - Right to Rent information');
  console.log('   - Bank details');
})();

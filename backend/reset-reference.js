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
  const refId = 'a00ef2fa-182d-4dbd-93c6-177dd1c480be';

  console.log('🔄 Resetting reference submission...');
  console.log('Reference ID:', refId);
  console.log('');

  // Reset the main tenant reference
  const { data: updated, error: updateError } = await supabase
    .from('tenant_references')
    .update({
      submitted_at: null,
      status: 'in_progress',
      // Clear form data that was incomplete
      employment_status: null,
      annual_income: null,
      current_address_line1: null,
      current_address_line2: null,
      current_city: null,
      current_postcode: null,
      current_country: null,
      previous_address_line1: null,
      previous_address_line2: null,
      previous_city: null,
      previous_postcode: null,
      previous_country: null,
      current_page: null
    })
    .eq('id', refId)
    .select();

  if (updateError) {
    console.error('❌ Error resetting reference:', updateError);
    return;
  }

  console.log('✅ Reference reset successfully!');
  console.log('');
  console.log('=== NEW DETAILS ===');
  console.log('Status:', updated[0].status);
  console.log('Submitted:', updated[0].submitted_at || 'Not submitted');
  console.log('');
  console.log('📧 Send this link to Louisa Matey:');
  console.log('https://app.propertygoose.co.uk/submit-reference/' + refId);
  console.log('');
  console.log('💡 This is a non-expiring UUID-based link');
  console.log('');

  // Check guarantor status
  const { data: guarantor } = await supabase
    .from('tenant_references')
    .select('id, submitted_at')
    .eq('guarantor_for_reference_id', refId)
    .eq('is_guarantor', true)
    .single();

  if (guarantor) {
    console.log('ℹ️  Note: Guarantor (Gabriel Abotsie) already submitted - keeping that intact');
    console.log('   Guarantor ID:', guarantor.id);
  }
})();

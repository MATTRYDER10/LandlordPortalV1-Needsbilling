const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkVerification() {
  const referenceId = '24ff73de-6bb6-4c35-826d-034c503069fb';
  
  const { data, error } = await supabase
    .from('creditsafe_verifications')
    .select('*')
    .eq('reference_id', referenceId)
    .single();
  
  if (error) {
    console.log('Error or no data found:', error.message);
  } else {
    console.log('Verification found:', JSON.stringify(data, null, 2));
  }
}

checkVerification();

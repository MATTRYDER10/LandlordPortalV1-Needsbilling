const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const { decrypt } = require('./src/services/encryption');

async function checkData() {
  const referenceId = '24ff73de-6bb6-4c35-826d-034c503069fb';
  
  const { data, error } = await supabase
    .from('creditsafe_verifications')
    .select('verification_response_encrypted, fraud_indicators')
    .eq('reference_id', referenceId)
    .single();
  
  if (error) {
    console.log('Error:', error.message);
    return;
  }
  
  console.log('Fraud indicators:', data.fraud_indicators);
  
  if (data.verification_response_encrypted) {
    const decrypted = decrypt(data.verification_response_encrypted);
    if (decrypted) {
      const response = JSON.parse(decrypted);
      console.log('\nInsolvencies:', JSON.stringify(response.insolvencies, null, 2));
      console.log('\nElectoral Rolls:', JSON.stringify(response.electoralRolls, null, 2));
      console.log('\nCCJs:', JSON.stringify(response.countyCourtJudgments, null, 2));
    }
  }
}

checkData();

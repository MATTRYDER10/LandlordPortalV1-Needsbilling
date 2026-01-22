const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://spaetpdmlqfygsxiawul.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  const refId = 'b00302e6-dc23-4637-99c5-4c5e3f38d0cc';

  console.log('🔍 Checking reference access and token\n');
  console.log('='.repeat(80));
  console.log('');

  // Get reference with token
  const { data: ref, error } = await supabase
    .from('tenant_references')
    .select(`
      id,
      status,
      verification_state,
      submitted_at,
      reference_token,
      reference_token_hash,
      has_id_proof,
      has_address_proof,
      has_financial_proof,
      created_at
    `)
    .eq('id', refId)
    .single();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('📋 REFERENCE STATUS:\n');
  console.log(`ID: ${ref.id}`);
  console.log(`Status: ${ref.status}`);
  console.log(`Verification State: ${ref.verification_state || 'N/A'}`);
  console.log(`Created: ${ref.created_at}`);
  console.log(`Submitted: ${ref.submitted_at || '❌ NOT SUBMITTED'}`);
  console.log('');

  console.log('🔗 ACCESS TOKEN:\n');
  console.log(`Token exists: ${ref.reference_token ? 'YES' : 'NO'}`);
  console.log(`Token hash exists: ${ref.reference_token_hash ? 'YES' : 'NO'}`);

  if (ref.reference_token) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    console.log(`\nAccess URL: ${frontendUrl}/submit-reference/${ref.reference_token}`);
  }
  console.log('');

  console.log('📎 EVIDENCE FLAGS:\n');
  console.log(`ID Proof: ${ref.has_id_proof ? '✅ Uploaded' : '❌ Not uploaded'}`);
  console.log(`Address Proof: ${ref.has_address_proof ? '✅ Uploaded' : '❌ Not uploaded'}`);
  console.log(`Financial Proof: ${ref.has_financial_proof ? '✅ Uploaded' : '❌ Not uploaded'}`);
  console.log('');

  // Check invitations table for email sent
  const { data: invites, error: inviteError } = await supabase
    .from('invitations')
    .select('*')
    .eq('reference_id', refId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!inviteError && invites && invites.length > 0) {
    const invite = invites[0];
    console.log('📧 INVITATION:\n');
    console.log(`Status: ${invite.status}`);
    console.log(`Sent: ${invite.sent_at || 'Not sent'}`);
    console.log(`Accepted: ${invite.accepted_at || 'Not accepted'}`);
  } else {
    console.log('📧 INVITATION: No invitation found\n');
  }

  // Diagnose
  console.log('='.repeat(80));
  console.log('\n🔍 DIAGNOSIS:\n');

  if (!ref.submitted_at) {
    console.log('❌ The tenant has NOT submitted their reference form');
    console.log('');
    console.log('Possible reasons:');
    console.log('1. Tenant has not received the email with the link');
    console.log('2. Tenant received the email but has not clicked the link');
    console.log('3. Tenant clicked the link but has not filled out the form');
    console.log('4. Tenant filled out the form but has not clicked "Submit"');
    console.log('');

    if (ref.reference_token) {
      console.log('✅ Access token exists - you can resend the email or share the link directly');
    } else {
      console.log('❌ No access token found - the invitation may not have been sent');
    }
  }

  console.log('');
})();

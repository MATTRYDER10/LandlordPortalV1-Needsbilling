const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://spaetpdmlqfygsxiawul.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

function decrypt(encryptedText) {
  if (!encryptedText) return null;
  try {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    return null;
  }
}

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  const referenceId = '0f036447-ee86-4f70-a35b-e126ecdd36fc';

  console.log('🔍 INVESTIGATING RESIDENTIAL REFERENCE\n');
  console.log('='.repeat(80));
  console.log('Reference ID:', referenceId);
  console.log('');

  // Get the tenant reference
  const { data: reference, error: refError } = await supabase
    .from('tenant_references')
    .select('*')
    .eq('id', referenceId)
    .single();

  if (refError || !reference) {
    console.error('❌ Error fetching reference:', refError);
    return;
  }

  const tenantFirstName = decrypt(reference.tenant_first_name_encrypted) || '';
  const tenantLastName = decrypt(reference.tenant_last_name_encrypted) || '';
  const tenantName = `${tenantFirstName} ${tenantLastName}`.trim();
  const propertyAddress = decrypt(reference.property_address_encrypted) || 'N/A';
  const landlordName = decrypt(reference.previous_landlord_name_encrypted) || 'N/A';
  const landlordEmail = decrypt(reference.previous_landlord_email_encrypted) || 'N/A';
  const landlordPhone = decrypt(reference.previous_landlord_phone_encrypted) || 'N/A';

  console.log('=== TENANT REFERENCE DETAILS ===');
  console.log('Tenant:', tenantName);
  console.log('Property:', propertyAddress);
  console.log('Reference Type:', reference.reference_type || 'NOT SET');
  console.log('Status:', reference.status);
  console.log('Submitted:', reference.submitted_at || 'NOT SUBMITTED');
  console.log('');

  console.log('=== RESIDENTIAL REFERENCE INFO ===');
  console.log('Landlord/Agent Name:', landlordName);
  console.log('Email:', landlordEmail);
  console.log('Phone:', landlordPhone);
  console.log('');

  // Check chase dependency
  const { data: chaseDep } = await supabase
    .from('chase_dependencies')
    .select('*')
    .eq('reference_id', referenceId)
    .eq('dependency_type', 'RESIDENTIAL_REF')
    .single();

  if (chaseDep) {
    console.log('=== CHASE DEPENDENCY ===');
    console.log('Status:', chaseDep.status);
    console.log('Created:', chaseDep.created_at);
    console.log('Last Chase Sent:', chaseDep.last_chase_sent_at || 'Never');
    console.log('Contact Name:', decrypt(chaseDep.contact_name_encrypted) || 'N/A');
    console.log('Contact Email:', decrypt(chaseDep.contact_email_encrypted) || 'N/A');
    console.log('Form URL:', chaseDep.form_url || 'N/A');
    console.log('');
  }

  // Check if it's landlord or agent type
  const isAgent = reference.reference_type === 'agent';
  console.log('=== REFERENCE TYPE ANALYSIS ===');
  console.log('Is Agent Reference:', isAgent ? 'YES' : 'NO');
  console.log('Expected Table:', isAgent ? 'agent_references' : 'landlord_references');
  console.log('');

  if (isAgent) {
    // Check agent_references
    const { data: agentRefs } = await supabase
      .from('agent_references')
      .select('*')
      .eq('reference_id', referenceId);

    console.log('=== AGENT REFERENCES TABLE ===');
    if (agentRefs && agentRefs.length > 0) {
      console.log(`Found ${agentRefs.length} agent reference(s):`);
      agentRefs.forEach((ref, i) => {
        console.log(`\n  Agent Ref ${i + 1}:`);
        console.log('    ID:', ref.id);
        console.log('    Submitted:', ref.submitted_at || 'NOT SUBMITTED');
        console.log('    Created:', ref.created_at);
        console.log('    Has Token Hash:', ref.reference_token_hash ? 'YES (legacy)' : 'NO');
      });
    } else {
      console.log('❌ NO AGENT REFERENCES FOUND');
      console.log('');
      console.log('💡 POSSIBLE REASONS:');
      console.log('   1. Form was never sent to the agent');
      console.log('   2. Chase dependency was created but no agent_references record was created');
      console.log('   3. Email failed to send so record was not created');
    }
  } else {
    // Check landlord_references
    const { data: landlordRefs } = await supabase
      .from('landlord_references')
      .select('*')
      .eq('reference_id', referenceId);

    console.log('=== LANDLORD REFERENCES TABLE ===');
    if (landlordRefs && landlordRefs.length > 0) {
      console.log(`Found ${landlordRefs.length} landlord reference(s):`);
      landlordRefs.forEach((ref, i) => {
        console.log(`\n  Landlord Ref ${i + 1}:`);
        console.log('    ID:', ref.id);
        console.log('    Submitted:', ref.submitted_at || 'NOT SUBMITTED');
        console.log('    Created:', ref.created_at);
        console.log('    Has Token Hash:', ref.reference_token_hash ? 'YES (legacy)' : 'NO');
      });
    } else {
      console.log('❌ NO LANDLORD REFERENCES FOUND');
      console.log('');
      console.log('💡 POSSIBLE REASONS:');
      console.log('   1. Form was never sent to the landlord');
      console.log('   2. Chase dependency was created but no landlord_references record was created');
      console.log('   3. Email failed to send so record was not created');
    }
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('\n🔧 RECOMMENDED ACTION:\n');

  if (!landlordEmail || landlordEmail === 'N/A') {
    console.log('⚠️  NO LANDLORD/AGENT EMAIL FOUND');
    console.log('   - The tenant reference has no landlord/agent email address');
    console.log('   - Cannot send reference request without email');
    console.log('   - This chase dependency should be marked as ACTION_REQUIRED');
    console.log('   - Staff need to obtain the landlord/agent contact details');
  } else {
    console.log('📧 EMAIL EXISTS BUT NO REFERENCE RECORD FOUND');
    console.log('   - Landlord/Agent email:', landlordEmail);
    console.log('   - The form was likely never sent, or the email send failed');
    console.log('   - Staff should manually send the reference request');
    console.log('   - Or update the email address and resend chase');
  }
})();

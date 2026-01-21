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
  const guarantorId = 'f563e914-f158-4ec9-8579-d63a46a9918a';

  // Get guarantor reference
  const { data: ref, error: refError } = await supabase
    .from('tenant_references')
    .select('*')
    .eq('id', guarantorId)
    .single();

  if (refError) {
    console.error('Error fetching guarantor:', refError);
    return;
  }

  console.log('=== GUARANTOR REFERENCE (Gabriel Abotsie) ===');
  console.log('ID:', ref.id);
  console.log('Status:', ref.status);
  console.log('Submitted:', ref.submitted_at ? 'YES ✓' : 'NO');
  console.log('Guarantor for tenant:', ref.guarantor_for_reference_id);
  console.log('');

  console.log('=== INCOME/EMPLOYMENT DATA ===');
  console.log('Employment Status:', ref.employment_status || 'NOT FILLED');
  console.log('Annual Income:', ref.annual_income || 'NOT FILLED');
  console.log('Has Employer Info:', ref.employer_ref_name_encrypted ? 'YES' : 'NO');
  console.log('Has Employer Email:', ref.employer_ref_email_encrypted ? 'YES' : 'NO');
  console.log('');

  console.log('=== RESIDENTIAL DATA ===');
  console.log('Has Current Address:', ref.current_address_line1 ? 'YES' : 'NO');
  console.log('Has Previous Address:', ref.previous_address_line1 ? 'YES' : 'NO');
  console.log('Has Landlord Info:', ref.previous_landlord_name_encrypted ? 'YES' : 'NO');
  console.log('Has Landlord Email:', ref.previous_landlord_email_encrypted ? 'YES' : 'NO');
  console.log('');

  // Check employer references
  const { data: employerRefs } = await supabase
    .from('employer_references')
    .select('id, submitted_at, reference_token_hash')
    .eq('reference_id', guarantorId);

  console.log('=== EMPLOYER REFERENCES ===');
  if (employerRefs && employerRefs.length > 0) {
    employerRefs.forEach((emp, i) => {
      console.log(`Employer Ref ${i+1}:`);
      console.log('  ID:', emp.id);
      console.log('  Link: https://app.propertygoose.co.uk/submit-employer-reference/' + emp.id);
      console.log('  Submitted:', emp.submitted_at ? 'YES ✓' : 'NO - PENDING');
      console.log('  Has Old Token:', emp.reference_token_hash ? 'YES (legacy)' : 'NO');
      console.log('');
    });
  } else {
    console.log('❌ NO EMPLOYER REFERENCES SENT');
  }
  console.log('');

  // Check landlord references
  const { data: landlordRefs } = await supabase
    .from('landlord_references')
    .select('id, submitted_at, reference_token_hash')
    .eq('reference_id', guarantorId);

  console.log('=== LANDLORD REFERENCES ===');
  if (landlordRefs && landlordRefs.length > 0) {
    landlordRefs.forEach((ll, i) => {
      console.log(`Landlord Ref ${i+1}:`);
      console.log('  Link: https://app.propertygoose.co.uk/landlord-reference/' + ref.id);
      console.log('  Submitted:', ll.submitted_at ? 'YES ✓' : 'NO - PENDING');
      console.log('  Has Old Token:', ll.reference_token_hash ? 'YES (legacy)' : 'NO');
      console.log('');
    });
  } else {
    console.log('❌ NO LANDLORD REFERENCES SENT');
  }
  console.log('');

  // Check agent references
  const { data: agentRefs } = await supabase
    .from('agent_references')
    .select('id, submitted_at')
    .eq('reference_id', guarantorId);

  console.log('=== AGENT REFERENCES ===');
  if (agentRefs && agentRefs.length > 0) {
    agentRefs.forEach((ag, i) => {
      console.log(`Agent Ref ${i+1}:`);
      console.log('  Link: https://app.propertygoose.co.uk/agent-reference/' + ref.id);
      console.log('  Submitted:', ag.submitted_at ? 'YES ✓' : 'NO - PENDING');
      console.log('');
    });
  } else {
    console.log('❌ NO AGENT REFERENCES SENT');
  }

  console.log('');
  console.log('=== SUMMARY ===');
  console.log('Guarantor Link: https://app.propertygoose.co.uk/guarantor-reference/' + guarantorId);
  console.log('Status: Already submitted - form will show "Reference Already Submitted"');
})();

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
  const refId = '0f036447-ee86-4f70-a35b-e126ecdd36fc';

  // Get main reference
  const { data: ref, error: refError } = await supabase
    .from('tenant_references')
    .select('*')
    .eq('id', refId)
    .single();

  if (refError) {
    console.error('Error fetching reference:', refError);
    return;
  }

  const firstName = decrypt(ref.tenant_first_name_encrypted);
  const lastName = decrypt(ref.tenant_last_name_encrypted);
  const email = decrypt(ref.tenant_email_encrypted);
  const propertyAddress = decrypt(ref.property_address_encrypted);
  const propertyCity = decrypt(ref.property_city_encrypted);

  console.log('=== REFERENCE DETAILS ===');
  console.log('ID:', ref.id);
  console.log('Tenant:', firstName, lastName);
  console.log('Email:', email);
  console.log('Property:', propertyAddress, propertyCity);
  console.log('Status:', ref.status);
  console.log('Submitted:', ref.submitted_at ? 'YES ✓' : 'NO - PENDING');
  console.log('Is Guarantor:', ref.is_guarantor ? 'YES' : 'NO');
  if (ref.is_guarantor) {
    console.log('Guarantor For:', ref.guarantor_for_reference_id);
  }
  console.log('');

  console.log('=== WHAT WE\'RE WAITING FOR ===');

  // Check if main form submitted
  if (!ref.submitted_at) {
    console.log('❌ TENANT FORM NOT SUBMITTED');
    console.log('   Link: https://app.propertygoose.co.uk/' + (ref.is_guarantor ? 'guarantor-reference/' : 'submit-reference/') + ref.id);
    console.log('');
  }

  // Check employer references
  const { data: employerRefs } = await supabase
    .from('employer_references')
    .select('id, submitted_at, company_name_encrypted')
    .eq('reference_id', refId);

  if (employerRefs && employerRefs.length > 0) {
    console.log('📋 EMPLOYER REFERENCES:');
    employerRefs.forEach((emp, i) => {
      const companyName = decrypt(emp.company_name_encrypted);
      console.log(`  ${i+1}. ${companyName || 'Employer'}`);
      console.log('     Link: https://app.propertygoose.co.uk/submit-employer-reference/' + emp.id);
      if (emp.submitted_at) {
        console.log('     Status: ✅ SUBMITTED');
      } else {
        console.log('     Status: ⏳ WAITING FOR SUBMISSION');
      }
      console.log('');
    });
  }

  // Check landlord references
  const { data: landlordRefs } = await supabase
    .from('landlord_references')
    .select('id, submitted_at')
    .eq('reference_id', refId);

  if (landlordRefs && landlordRefs.length > 0) {
    console.log('🏠 LANDLORD REFERENCES:');
    landlordRefs.forEach((ll, i) => {
      console.log(`  ${i+1}. Landlord Reference`);
      console.log('     Link: https://app.propertygoose.co.uk/landlord-reference/' + ref.id);
      if (ll.submitted_at) {
        console.log('     Status: ✅ SUBMITTED');
      } else {
        console.log('     Status: ⏳ WAITING FOR SUBMISSION');
      }
      console.log('');
    });
  }

  // Check agent references
  const { data: agentRefs } = await supabase
    .from('agent_references')
    .select('id, submitted_at')
    .eq('reference_id', refId);

  if (agentRefs && agentRefs.length > 0) {
    console.log('🏢 AGENT REFERENCES:');
    agentRefs.forEach((ag, i) => {
      console.log(`  ${i+1}. Agent Reference`);
      console.log('     Link: https://app.propertygoose.co.uk/agent-reference/' + ref.id);
      if (ag.submitted_at) {
        console.log('     Status: ✅ SUBMITTED');
      } else {
        console.log('     Status: ⏳ WAITING FOR SUBMISSION');
      }
      console.log('');
    });
  }

  // Check accountant references
  const { data: accountantRefs } = await supabase
    .from('accountant_references')
    .select('id, submitted_at, accountant_name_encrypted')
    .eq('tenant_reference_id', refId);

  if (accountantRefs && accountantRefs.length > 0) {
    console.log('💼 ACCOUNTANT REFERENCES:');
    accountantRefs.forEach((acc, i) => {
      const accountantName = decrypt(acc.accountant_name_encrypted);
      console.log(`  ${i+1}. ${accountantName || 'Accountant'}`);
      console.log('     Link: https://app.propertygoose.co.uk/accountant-reference/' + acc.id);
      if (acc.submitted_at) {
        console.log('     Status: ✅ SUBMITTED');
      } else {
        console.log('     Status: ⏳ WAITING FOR SUBMISSION');
      }
      console.log('');
    });
  }

  // Check for guarantor
  const { data: guarantors } = await supabase
    .from('tenant_references')
    .select('id, submitted_at, tenant_first_name_encrypted, tenant_last_name_encrypted')
    .eq('guarantor_for_reference_id', refId)
    .eq('is_guarantor', true);

  if (guarantors && guarantors.length > 0) {
    console.log('👤 GUARANTOR:');
    guarantors.forEach((g, i) => {
      const gFirstName = decrypt(g.tenant_first_name_encrypted);
      const gLastName = decrypt(g.tenant_last_name_encrypted);
      console.log(`  ${i+1}. ${gFirstName} ${gLastName}`);
      console.log('     Link: https://app.propertygoose.co.uk/guarantor-reference/' + g.id);
      if (g.submitted_at) {
        console.log('     Status: ✅ SUBMITTED');
      } else {
        console.log('     Status: ⏳ WAITING FOR SUBMISSION');
      }
      console.log('');
    });
  }
})();

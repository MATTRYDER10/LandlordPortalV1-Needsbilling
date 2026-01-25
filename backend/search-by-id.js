const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ? Buffer.from(process.env.ENCRYPTION_KEY, 'base64') : null;

function decrypt(encryptedText) {
  if (!encryptedText || !ENCRYPTION_KEY) return null;
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

const targetRefId = 'fe6a5291-ffec-417a-85b8-97d5cb46a2b3';

(async () => {
  console.log('Searching for reference:', targetRefId);
  console.log('='.repeat(80) + '\n');

  // Search for the main reference
  const { data: ref, error } = await supabase
    .from('tenant_references')
    .select('*')
    .eq('id', targetRefId)
    .single();

  if (error || !ref) {
    console.log('❌ Reference NOT found in database');
    console.log('Error:', error?.message || 'No data returned');
    console.log('\nThis reference may have been deleted.');
    return;
  }

  console.log('✅ REFERENCE FOUND!\n');

  const firstName = decrypt(ref.tenant_first_name_encrypted) || ref.tenant_first_name || '';
  const lastName = decrypt(ref.tenant_last_name_encrypted) || ref.tenant_last_name || '';
  const address = decrypt(ref.property_address_encrypted) || ref.property_address || '';
  const dob = decrypt(ref.date_of_birth_encrypted) || ref.date_of_birth || '';
  const contact = decrypt(ref.contact_number_encrypted) || ref.contact_number || '';

  console.log('ID:', ref.id);
  console.log('Tenant Name:', firstName, lastName);
  console.log('Property Address:', address);
  console.log('Status:', ref.status);
  console.log('Verification State:', ref.verification_state);
  console.log('Company ID:', ref.company_id);
  console.log('Created:', ref.created_at);
  console.log('Updated:', ref.updated_at);
  console.log('Submitted:', ref.submitted_at || 'Not submitted');
  console.log('DOB:', dob);
  console.log('Contact:', contact);
  console.log('Is Guarantor:', ref.guarantor_reference_id ? 'Yes' : 'No');

  if (ref.guarantor_reference_id) {
    console.log('Main Reference ID:', ref.guarantor_reference_id);
  }

  // Check for guarantors if this is a main reference
  if (!ref.guarantor_reference_id) {
    const { data: guarantors } = await supabase
      .from('tenant_references')
      .select('*')
      .eq('guarantor_reference_id', targetRefId);

    console.log('\nGuarantors:', guarantors?.length || 0);

    if (guarantors && guarantors.length > 0) {
      guarantors.forEach((g, index) => {
        const gFirstName = decrypt(g.tenant_first_name_encrypted) || '';
        const gLastName = decrypt(g.tenant_last_name_encrypted) || '';
        console.log(`  ${index + 1}. ${gFirstName} ${gLastName} (ID: ${g.id.substring(0, 8)}...)`);
      });
    }
  }

  // Get company info
  if (ref.company_id) {
    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('id', ref.company_id)
      .single();

    if (company) {
      const companyName = decrypt(company.name_encrypted) || company.name || '';
      console.log('\nCompany Name:', companyName);
    }
  }

  console.log('\n' + '='.repeat(80));
})();

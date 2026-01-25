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
  console.log('Searching for traces of deleted reference:', targetRefId);
  console.log('='.repeat(80) + '\n');

  // Check if any guarantors still reference this as their main reference
  console.log('1. Checking for guarantors that reference this ID...\n');
  const { data: guarantors } = await supabase
    .from('tenant_references')
    .select('*')
    .eq('guarantor_reference_id', targetRefId);

  if (guarantors && guarantors.length > 0) {
    console.log(`✅ Found ${guarantors.length} guarantor references!\n`);

    for (const g of guarantors) {
      const firstName = decrypt(g.tenant_first_name_encrypted) || '';
      const lastName = decrypt(g.tenant_last_name_encrypted) || '';
      const address = decrypt(g.property_address_encrypted) || g.property_address || '';

      console.log('---');
      console.log('Guarantor ID:', g.id);
      console.log('Name:', firstName, lastName);
      console.log('Property Address:', address);
      console.log('Status:', g.status);
      console.log('Created:', g.created_at);
      console.log('');
    }
  } else {
    console.log('❌ No guarantor references found\n');
  }

  // Check work_items table
  console.log('2. Checking work_items table...\n');
  const { data: workItems } = await supabase
    .from('work_items')
    .select('*')
    .eq('reference_id', targetRefId);

  if (workItems && workItems.length > 0) {
    console.log(`✅ Found ${workItems.length} work items!\n`);
    workItems.forEach(item => {
      console.log('Work Item ID:', item.id);
      console.log('Type:', item.type);
      console.log('Status:', item.status);
      console.log('Created:', item.created_at);
      console.log('---');
    });
  } else {
    console.log('❌ No work items found\n');
  }

  // Check agreement_tenant_references table
  console.log('3. Checking agreement_tenant_references table...\n');
  const { data: agreementRefs } = await supabase
    .from('agreement_tenant_references')
    .select('*')
    .eq('tenant_reference_id', targetRefId);

  if (agreementRefs && agreementRefs.length > 0) {
    console.log(`✅ Found ${agreementRefs.length} agreement references!\n`);
    for (const ar of agreementRefs) {
      console.log('Agreement ID:', ar.agreement_id);
      console.log('Created:', ar.created_at);

      // Get agreement details
      const { data: agreement } = await supabase
        .from('agreements')
        .select('*')
        .eq('id', ar.agreement_id)
        .single();

      if (agreement) {
        console.log('Agreement Status:', agreement.status);
        console.log('Property Address:', agreement.property_address);
      }
      console.log('---');
    }
  } else {
    console.log('❌ No agreement references found\n');
  }

  // Check reference_documents table
  console.log('4. Checking reference_documents table...\n');
  const { data: docs } = await supabase
    .from('reference_documents')
    .select('*')
    .eq('reference_id', targetRefId);

  if (docs && docs.length > 0) {
    console.log(`✅ Found ${docs.length} documents!\n`);
    docs.forEach(doc => {
      console.log('Document Type:', doc.document_type);
      console.log('File Path:', doc.file_path);
      console.log('Uploaded:', doc.uploaded_at);
      console.log('---');
    });
  } else {
    console.log('❌ No documents found\n');
  }

  console.log('='.repeat(80));
  console.log('\nSummary:');
  console.log('- Guarantors:', guarantors?.length || 0);
  console.log('- Work Items:', workItems?.length || 0);
  console.log('- Agreement References:', agreementRefs?.length || 0);
  console.log('- Documents:', docs?.length || 0);

  if (guarantors && guarantors.length > 0) {
    console.log('\n⚠️  The main reference was deleted but guarantors still exist!');
    console.log('This suggests the reference was accidentally deleted.');
  }
})();

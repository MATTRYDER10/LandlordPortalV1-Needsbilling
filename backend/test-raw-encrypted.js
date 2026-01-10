const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRawEncrypted() {
  const referenceId = '5e2dbf96-5db2-4fec-bd9b-9ebb175b2e27';

  const { data: tenantRef } = await supabase
    .from('tenant_references')
    .select('employer_ref_name_encrypted, employer_ref_email_encrypted, employer_ref_phone_encrypted')
    .eq('id', referenceId)
    .single();

  console.log('=== RAW ENCRYPTED VALUES ===\n');
  console.log('employer_ref_name_encrypted:');
  console.log(tenantRef.employer_ref_name_encrypted);
  console.log('\nemployer_ref_email_encrypted:');
  console.log(tenantRef.employer_ref_email_encrypted);
  console.log('\nemployer_ref_phone_encrypted:');
  console.log(tenantRef.employer_ref_phone_encrypted);

  console.log('\n=== LENGTH CHECK ===');
  console.log('employer_ref_name length:', tenantRef.employer_ref_name_encrypted?.length || 0);
  console.log('employer_ref_email length:', tenantRef.employer_ref_email_encrypted?.length || 0);
  console.log('employer_ref_phone length:', tenantRef.employer_ref_phone_encrypted?.length || 0);

  process.exit(0);
}

checkRawEncrypted();

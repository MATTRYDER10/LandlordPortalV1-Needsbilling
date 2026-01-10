const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAllEmployerReferences() {
  const referenceId = '5e2dbf96-5db2-4fec-bd9b-9ebb175b2e27'; // Qiang Lan's reference ID

  console.log('Checking ALL employer references (including not submitted) for:', referenceId);

  const { data: employerRefs, error } = await supabase
    .from('employer_references')
    .select('*')
    .eq('reference_id', referenceId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\nFound employer references:', employerRefs?.length || 0);

  if (employerRefs && employerRefs.length > 0) {
    employerRefs.forEach((ref, index) => {
      console.log(`\n=== Employer Reference #${index + 1} ===`);
      console.log('ID:', ref.id);
      console.log('Created at:', ref.created_at);
      console.log('Submitted at:', ref.submitted_at || 'NOT SUBMITTED');
      console.log('Has employer_name_encrypted:', !!ref.employer_name_encrypted);
      console.log('Has company_name_encrypted:', !!ref.company_name_encrypted);
      console.log('Has annual_salary_encrypted:', !!ref.annual_salary_encrypted);
      console.log('Has employee_position_encrypted:', !!ref.employee_position_encrypted);
      console.log('employment_start_date:', ref.employment_start_date);
      console.log('employment_status:', ref.employment_status);
      console.log('is_current_employee:', ref.is_current_employee);
      console.log('employment_type:', ref.employment_type);
      console.log('salary_frequency:', ref.salary_frequency);
    });
  } else {
    console.log('No employer references found!');
  }

  // Also check the tenant reference for employer info that tenant provided
  console.log('\n=== Checking tenant reference for employer info ===');
  const { data: tenantRef } = await supabase
    .from('tenant_references')
    .select('employer_ref_name_encrypted, employer_ref_email_encrypted, employer_ref_phone_encrypted, employment_type, employer_name')
    .eq('id', referenceId)
    .single();

  if (tenantRef) {
    console.log('Has employer_ref_name_encrypted (from tenant):', !!tenantRef.employer_ref_name_encrypted);
    console.log('Has employer_ref_email_encrypted (from tenant):', !!tenantRef.employer_ref_email_encrypted);
    console.log('Has employer_ref_phone_encrypted (from tenant):', !!tenantRef.employer_ref_phone_encrypted);
    console.log('employment_type:', tenantRef.employment_type);
    console.log('employer_name (not encrypted):', tenantRef.employer_name);
  }

  process.exit(0);
}

checkAllEmployerReferences();

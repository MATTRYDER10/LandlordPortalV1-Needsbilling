const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkEmployerReference() {
  const referenceId = '5e2dbf96-5db2-4fec-bd9b-9ebb175b2e27'; // Qiang Lan's reference ID from screenshot

  console.log('Checking employer references for:', referenceId);

  const { data: employerRefs, error } = await supabase
    .from('employer_references')
    .select('*')
    .eq('reference_id', referenceId);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\nFound employer references:', employerRefs?.length || 0);

  if (employerRefs && employerRefs.length > 0) {
    employerRefs.forEach((ref, index) => {
      console.log(`\n=== Employer Reference #${index + 1} ===`);
      console.log('ID:', ref.id);
      console.log('Submitted at:', ref.submitted_at);
      console.log('Has employer_name_encrypted:', !!ref.employer_name_encrypted);
      console.log('Has company_name_encrypted:', !!ref.company_name_encrypted);
      console.log('Has annual_salary_encrypted:', !!ref.annual_salary_encrypted);
      console.log('Has employee_position_encrypted:', !!ref.employee_position_encrypted);
      console.log('employment_start_date:', ref.employment_start_date);
      console.log('employment_status:', ref.employment_status);
      console.log('is_current_employee:', ref.is_current_employee);

      // Show all fields
      console.log('\nAll fields:', Object.keys(ref));
    });
  } else {
    console.log('No employer references found!');
  }

  process.exit(0);
}

checkEmployerReference();

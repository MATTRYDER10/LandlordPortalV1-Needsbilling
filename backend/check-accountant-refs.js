const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAccountantRefs() {
  console.log('=== CHECKING ACCOUNTANT REFERENCES FOR EMPTY DATA BUG ===\n');

  // Find all accountant references that have submitted_at
  const { data: accountantRefs } = await supabase
    .from('accountant_references')
    .select('*')
    .not('submitted_at', 'is', null)
    .order('submitted_at', { ascending: false });

  console.log(`Found ${accountantRefs?.length || 0} accountant references with submitted_at\n`);

  const corruptedRefs = accountantRefs?.filter(ref => {
    // Check if has actual form data (not just contact info)
    const hasData = ref.business_name_encrypted ||
                    ref.annual_turnover_encrypted ||
                    ref.annual_profit_encrypted ||
                    ref.tax_returns_filed !== null ||
                    ref.business_trading_status;
    return !hasData;
  }) || [];

  console.log(`Found ${corruptedRefs.length} CORRUPTED accountant references (submitted_at but no form data)\n`);

  if (corruptedRefs.length === 0) {
    console.log('✅ No corrupted accountant references found!');
  } else {
    console.log('❌ CORRUPTED ACCOUNTANT REFERENCES:\n');
    corruptedRefs.forEach((ref, i) => {
      console.log(`${i + 1}. ID: ${ref.id}`);
      console.log(`   Tenant Reference ID: ${ref.tenant_reference_id}`);
      console.log(`   Submitted At: ${ref.submitted_at}`);
      console.log(`   Created At: ${ref.created_at}`);
      console.log(`   Same timestamp? ${ref.submitted_at === ref.created_at ? 'YES (RED FLAG)' : 'NO'}`);
      console.log('');
    });
  }

  process.exit(0);
}

checkAccountantRefs();

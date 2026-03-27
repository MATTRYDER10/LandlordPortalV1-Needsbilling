require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('tenant_references_v2')
    .select('id, status, form_data')
    .eq('status', 'COLLECTING_EVIDENCE');

  if (error) {
    console.log('Error:', error);
    return;
  }

  console.log('Found', data.length, 'refs with COLLECTING_EVIDENCE status\n');
  for (const ref of data) {
    const hasData = ref.form_data ? true : false;
    const keys = ref.form_data ? Object.keys(ref.form_data).join(', ') : 'none';
    console.log('ID:', ref.id);
    console.log('  Has form_data:', hasData);
    console.log('  Keys:', keys);
    console.log('');
  }
}

run();

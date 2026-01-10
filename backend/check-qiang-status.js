const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkQiangStatus() {
  console.log('=== CHECKING QIANG LAN STATUS ===\n');

  // Find Qiang Lan's reference
  const { data: workItems } = await supabase
    .from('work_items')
    .select(`
      id,
      status,
      work_type,
      assigned_to,
      created_at,
      updated_at,
      tenant_references!inner(
        id,
        tenant_first_name_encrypted,
        tenant_last_name_encrypted
      )
    `)
    .ilike('tenant_references.tenant_first_name_encrypted', '%Qiang%');

  console.log(`Found ${workItems?.length || 0} work items\n`);

  workItems?.forEach(item => {
    console.log('Work Item ID:', item.id);
    console.log('Status:', item.status);
    console.log('Work Type:', item.work_type);
    console.log('Assigned To:', item.assigned_to);
    console.log('Created:', item.created_at);
    console.log('Updated:', item.updated_at);
    console.log('');
  });

  process.exit(0);
}

checkQiangStatus();

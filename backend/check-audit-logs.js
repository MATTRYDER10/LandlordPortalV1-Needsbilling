const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('Checking for any tables that might have audit logs...\n');
  
  // Try to find any activity logs
  const { data: tables, error: tablesError } = await supabase
    .rpc('get_tables_list')
    .catch(() => null);
  
  // Check work_items for Dongola
  console.log('Checking work_items...\n');
  const { data: workItems } = await supabase
    .from('work_items')
    .select('*')
    .or('description.ilike.%dongola%,reference_id.not.is.null')
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (workItems) {
    for (const item of workItems) {
      if (item.description && item.description.toLowerCase().includes('dongola')) {
        console.log('Found work item:');
        console.log('  ID:', item.id);
        console.log('  Reference ID:', item.reference_id);
        console.log('  Description:', item.description);
        console.log('  Created:', item.created_at);
        console.log('---');
      }
    }
  }
  
  // Check if there are completed references from today
  console.log('\nChecking recently completed references...\n');
  const { data: recentCompleted } = await supabase
    .from('tenant_references')
    .select('id, property_address_encrypted, status, created_at, updated_at')
    .eq('status', 'completed')
    .gte('updated_at', '2026-01-22')
    .order('updated_at', { ascending: false });
  
  console.log('Found', recentCompleted ? recentCompleted.length : 0, 'recently completed references');
  
  if (recentCompleted) {
    for (const ref of recentCompleted) {
      console.log('  -', ref.id.substring(0, 8) + '...');
      console.log('    Updated:', ref.updated_at);
      console.log('    Status:', ref.status);
    }
  }
})();

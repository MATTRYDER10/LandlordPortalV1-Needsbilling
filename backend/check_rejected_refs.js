const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkRejectedRefs() {
  // Check all rejected references
  const { data: rejected, error } = await supabase
    .from('tenant_references')
    .select('id, status, is_group_parent, parent_reference_id, tenant_first_name_encrypted, created_at')
    .eq('status', 'rejected')
    .order('created_at', { ascending: false })
  
  if (error) {
    console.log('Error:', error)
    return
  }
  
  console.log(`\nFound ${rejected.length} rejected references:\n`)
  
  rejected.forEach(ref => {
    console.log(`ID: ${ref.id}`)
    console.log(`  Status: ${ref.status}`)
    console.log(`  Is Parent: ${ref.is_group_parent}`)
    console.log(`  Parent ID: ${ref.parent_reference_id}`)
    console.log(`  Created: ${ref.created_at}`)
    console.log('')
  })
  
  // Now check staff query (excludes parents)
  const { data: staffView, error: staffError } = await supabase
    .from('tenant_references')
    .select('id, status, is_group_parent')
    .eq('status', 'rejected')
    .neq('is_group_parent', true) // Staff portal filter
    .order('created_at', { ascending: false })
    
  console.log(`\nStaff view (excluding parents): ${staffView?.length || 0} rejected references\n`)
}

checkRejectedRefs();

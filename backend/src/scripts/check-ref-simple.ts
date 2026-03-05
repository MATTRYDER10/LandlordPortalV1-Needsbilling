import { supabase } from '../config/supabase'

async function check() {
  const { data, error } = await supabase
    .from('tenant_references')
    .select('id')
    .eq('id', 'f3e801b3-f418-4f35-bc90-e9e537a922b3')
    .single()
  
  console.log('Data:', data)
  console.log('Error:', error)
}

check().then(() => process.exit(0))

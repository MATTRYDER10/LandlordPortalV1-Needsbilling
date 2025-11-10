import { supabase } from '../src/config/supabase'

async function checkLandlordsTable() {
  console.log('Checking if landlords table exists...\n')

  try {
    // Try to query the table
    const { data, error } = await supabase
      .from('landlords')
      .select('id')
      .limit(1)

    if (error) {
      if (error.message.includes('schema cache') || error.message.includes('Could not find the table')) {
        console.error('❌ ERROR: The landlords table does not exist!')
        console.error('\nPlease run the migrations in Supabase SQL Editor:')
        console.error('1. Open Supabase Dashboard → SQL Editor')
        console.error('2. Run: backend/migrations/056_create_landlords_table.sql')
        console.error('3. Run: backend/migrations/057_create_landlord_aml_checks_table.sql')
        console.error('\nAfter running migrations, wait 10-30 seconds for schema cache to refresh.')
      } else {
        console.error('Error:', error.message)
      }
    } else {
      console.log('✅ SUCCESS: The landlords table exists!')
      console.log(`Found ${data?.length || 0} landlord(s)`)
    }
  } catch (err: any) {
    console.error('Error checking table:', err.message)
  }
}

checkLandlordsTable().catch(console.error)


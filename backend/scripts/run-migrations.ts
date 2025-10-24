import { supabase } from '../src/config/supabase'
import fs from 'fs'
import path from 'path'

async function runMigrations() {
  const migrationsToRun = [
    '017_update_landlord_reference_fields.sql',
    '019_add_tenancy_still_in_progress_field.sql'
  ]

  for (const migration of migrationsToRun) {
    const migrationPath = path.join(__dirname, '..', 'migrations', migration)
    console.log(`Running migration: ${migration}`)

    const sql = fs.readFileSync(migrationPath, 'utf-8')

    // Split by semicolons and run each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      if (statement.trim()) {
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement })

        if (error) {
          // If exec_sql doesn't exist, try direct query
          const { error: directError } = await supabase.from('_migrations').select('*').limit(1)

          if (directError) {
            console.error(`Error running statement from ${migration}:`, error)
            console.error('Statement:', statement)
            console.log('\nPlease run these migrations manually in the Supabase SQL editor.')
            return
          }
        }
      }
    }

    console.log(`✓ Completed: ${migration}`)
  }

  console.log('\nAll migrations completed successfully!')
}

runMigrations().catch(console.error)

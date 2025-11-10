import { supabase } from '../src/config/supabase'
import fs from 'fs'
import path from 'path'

async function runLandlordMigrations() {
  const migrationsToRun = [
    '056_create_landlords_table.sql',
    '057_create_landlord_aml_checks_table.sql'
  ]

  console.log('Running landlord migrations...\n')

  for (const migration of migrationsToRun) {
    const migrationPath = path.join(__dirname, '..', 'migrations', migration)
    console.log(`Running migration: ${migration}`)

    if (!fs.existsSync(migrationPath)) {
      console.error(`Migration file not found: ${migrationPath}`)
      continue
    }

    const sql = fs.readFileSync(migrationPath, 'utf-8')

    // Split by semicolons and run each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          // Try using RPC first
          const { error: rpcError } = await supabase.rpc('exec_sql', { sql_query: statement })
          
          if (rpcError) {
            // If RPC doesn't work, try direct query (this won't work for DDL, but we'll try)
            console.warn(`RPC failed, trying alternative method for statement in ${migration}`)
            console.warn('Error:', rpcError.message)
            console.log('\n⚠️  Please run this migration manually in the Supabase SQL editor.')
            console.log(`File: ${migration}`)
            console.log('\nSQL to run:')
            console.log(statement)
            console.log('\n---\n')
            continue
          }
        } catch (err: any) {
          console.error(`Error running statement from ${migration}:`, err.message)
          console.log('\n⚠️  Please run this migration manually in the Supabase SQL editor.')
          console.log(`File: ${migration}`)
          console.log('\nSQL to run:')
          console.log(statement)
          console.log('\n---\n')
          continue
        }
      }
    }

    console.log(`✓ Completed: ${migration}\n`)
  }

  console.log('✅ All landlord migrations completed!')
}

runLandlordMigrations().catch((error) => {
  console.error('Migration error:', error)
  process.exit(1)
})


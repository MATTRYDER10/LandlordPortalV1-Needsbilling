import { supabase } from '../config/supabase'

async function checkMarkDoneIssue() {
  console.log('=== CHECKING MARK DONE FUNCTIONALITY ===\n')

  // Test 1: Check if last_marked_done_at column exists
  console.log('[1] Checking if last_marked_done_at column exists in verification_sections...')
  const { data: testSection, error: columnError } = await supabase
    .from('verification_sections')
    .select('id, last_marked_done_at')
    .limit(1)
    .maybeSingle()

  if (columnError) {
    console.log('❌ ERROR: Column likely does not exist!')
    console.log('Error:', columnError)
    console.log('\nThis is the root cause - the column needs to be added via migration.')
  } else {
    console.log('✅ Column exists')
    if (testSection) {
      console.log(`   Sample value: ${testSection.last_marked_done_at || 'NULL'}`)
    }
  }

  // Test 2: Check recent reference notes with mark-done source
  console.log('\n[2] Checking recent mark-done notes...')
  const { data: markDoneNotes } = await supabase
    .from('reference_notes')
    .select('id, reference_id, note, created_at, source')
    .eq('source', 'PENDING_RESPONSE_QUEUE')
    .order('created_at', { ascending: false })
    .limit(5)

  if (markDoneNotes && markDoneNotes.length > 0) {
    console.log(`✅ Found ${markDoneNotes.length} mark-done notes`)
    markDoneNotes.forEach(note => {
      console.log(`   - ${note.created_at}: "${note.note.substring(0, 50)}..."`)
    })
  } else {
    console.log('⚠️  No mark-done notes found (or source field not supported)')
  }

  // Test 3: Check audit log for mark-done actions
  console.log('\n[3] Checking audit log for mark-done actions...')
  const { data: auditLogs } = await supabase
    .from('reference_audit_log')
    .select('id, reference_id, action, description, created_at')
    .eq('action', 'PENDING_RESPONSE_MARKED_DONE')
    .order('created_at', { ascending: false })
    .limit(5)

  if (auditLogs && auditLogs.length > 0) {
    console.log(`✅ Found ${auditLogs.length} mark-done audit entries`)
    auditLogs.forEach(log => {
      console.log(`   - ${log.created_at}: ${log.description}`)
    })
  } else {
    console.log('⚠️  No mark-done audit entries found')
  }

  // Test 4: Check if migration file exists
  console.log('\n[4] Checking for migration file...')
  const fs = require('fs')
  const path = require('path')
  const migrationPath = path.join(__dirname, '../../migrations/145_add_last_marked_done_at_to_verification_sections.sql')

  if (fs.existsSync(migrationPath)) {
    console.log('✅ Migration file exists')
    console.log(`   Path: ${migrationPath}`)
  } else {
    console.log('❌ Migration file NOT found')
  }

  console.log('\n=== DIAGNOSIS ===')
  if (columnError) {
    console.log('🔴 ROOT CAUSE: last_marked_done_at column missing from verification_sections table')
    console.log('\nSOLUTION: Run migration 145 to add the column:')
    console.log('  ALTER TABLE verification_sections ADD COLUMN last_marked_done_at TIMESTAMPTZ;')
  } else {
    console.log('✅ Database schema looks correct')
    console.log('⚠️  Issue may be with frontend refresh or backend logic')
  }
}

checkMarkDoneIssue()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Check failed:', error)
    process.exit(1)
  })

import { supabase } from '../config/supabase'
import { logAuditAction } from '../services/auditService'

async function testAuditLog() {
  console.log('=== TESTING AUDIT LOG ===\n')

  // Get a recent reference that has mark-done notes
  const { data: note } = await supabase
    .from('reference_notes')
    .select('reference_id')
    .eq('source', 'PENDING_RESPONSE_QUEUE')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!note) {
    console.log('No mark-done notes found to test with')
    return
  }

  const referenceId = note.reference_id

  console.log(`Testing with reference: ${referenceId}\n`)

  // Test 1: Try to insert audit log directly
  console.log('[1] Testing direct insert to reference_audit_log...')
  const { data: testInsert, error: insertError } = await supabase
    .from('reference_audit_log')
    .insert({
      reference_id: referenceId,
      action: 'TEST_ACTION',
      description: 'Test audit log entry',
      metadata: { test: true },
      created_by: null
    })
    .select()

  if (insertError) {
    console.log('❌ Direct insert FAILED')
    console.log('Error:', insertError)
  } else {
    console.log('✅ Direct insert succeeded')
    console.log('Inserted ID:', testInsert?.[0]?.id)

    // Clean up test entry
    if (testInsert?.[0]?.id) {
      await supabase
        .from('reference_audit_log')
        .delete()
        .eq('id', testInsert[0].id)
      console.log('   (cleaned up test entry)')
    }
  }

  // Test 2: Try using logAuditAction function
  console.log('\n[2] Testing logAuditAction function...')
  try {
    await logAuditAction({
      referenceId: referenceId,
      action: 'TEST_PENDING_RESPONSE_MARKED_DONE',
      description: 'Test mark done action',
      metadata: { test: true },
      userId: null as any
    })
    console.log('✅ logAuditAction completed (check logs for errors)')
  } catch (error) {
    console.log('❌ logAuditAction threw error:', error)
  }

  // Check if it was inserted
  const { data: checkInsert } = await supabase
    .from('reference_audit_log')
    .select('id')
    .eq('reference_id', referenceId)
    .eq('action', 'TEST_PENDING_RESPONSE_MARKED_DONE')
    .maybeSingle()

  if (checkInsert) {
    console.log('✅ Entry was created via logAuditAction')
    // Clean up
    await supabase
      .from('reference_audit_log')
      .delete()
      .eq('id', checkInsert.id)
    console.log('   (cleaned up test entry)')
  } else {
    console.log('❌ Entry was NOT created - logging silently failed')
  }

  // Test 3: Check for actual PENDING_RESPONSE_MARKED_DONE entries
  console.log('\n[3] Checking for actual mark-done audit entries...')
  const { data: actualEntries, count } = await supabase
    .from('reference_audit_log')
    .select('*', { count: 'exact' })
    .eq('action', 'PENDING_RESPONSE_MARKED_DONE')

  console.log(`Found ${count || 0} entries with action='PENDING_RESPONSE_MARKED_DONE'`)

  if (count && count > 0) {
    console.log('Sample entries:')
    actualEntries?.slice(0, 3).forEach(entry => {
      console.log(`  - ${entry.created_at}: ${entry.description}`)
    })
  }

  // Test 4: Check reference_notes vs audit_log count
  const { count: notesCount } = await supabase
    .from('reference_notes')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'PENDING_RESPONSE_QUEUE')

  const { count: auditCount } = await supabase
    .from('reference_audit_log')
    .select('*', { count: 'exact', head: true })
    .eq('action', 'PENDING_RESPONSE_MARKED_DONE')

  console.log('\n[4] Count comparison:')
  console.log(`   Reference notes (mark-done): ${notesCount || 0}`)
  console.log(`   Audit log entries: ${auditCount || 0}`)

  if ((notesCount || 0) > (auditCount || 0)) {
    console.log('   ⚠️  MISMATCH! Notes exist but audit logs don\'t - logging is failing!')
  }
}

testAuditLog()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Test failed:', error)
    process.exit(1)
  })

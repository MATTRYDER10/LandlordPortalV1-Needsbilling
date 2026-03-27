import { supabase } from '../src/config/supabase'

async function fixStudentIncomeSection() {
  // Find the reference
  const { data: ref, error: refError } = await supabase
    .from('tenant_references_v2')
    .select('id')
    .eq('reference_number', 'PG-2603-0015')
    .single()

  if (refError || !ref) {
    console.error('Reference not found:', refError?.message || 'No data')
    process.exit(1)
  }

  console.log('Found reference:', ref.id)

  // Update INCOME section to READY
  const { data: updated, error: updateError } = await supabase
    .from('reference_sections_v2')
    .update({
      queue_status: 'READY',
      queue_entered_at: new Date().toISOString(),
      section_data: {
        evidence_status: 'STUDENT_EXEMPT',
        income_source: 'student'
      },
      updated_at: new Date().toISOString()
    })
    .eq('reference_id', ref.id)
    .eq('section_type', 'INCOME')
    .eq('queue_status', 'PENDING')
    .select()

  if (updateError) {
    console.error('Update failed:', updateError.message)
    process.exit(1)
  }

  if (!updated || updated.length === 0) {
    console.log('No PENDING INCOME section found for PG-2603-0015 (may already be updated)')
  } else {
    console.log('Successfully updated INCOME section to READY for PG-2603-0015')
    console.log('Updated rows:', updated.length)
  }

  process.exit(0)
}

fixStudentIncomeSection().catch(err => {
  console.error('Script error:', err)
  process.exit(1)
})

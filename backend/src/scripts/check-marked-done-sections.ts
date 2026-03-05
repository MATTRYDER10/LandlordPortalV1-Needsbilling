import { supabase } from '../config/supabase'

async function checkMarkedDoneSections() {
  console.log('=== CHECKING MARKED DONE SECTIONS ===\n')

  // Find sections that should have been marked done (have corresponding notes)
  console.log('[1] Finding sections with mark-done notes...')
  const { data: notes } = await supabase
    .from('reference_notes')
    .select('reference_id, note, created_at')
    .eq('source', 'PENDING_RESPONSE_QUEUE')
    .order('created_at', { ascending: false })
    .limit(10)

  if (!notes || notes.length === 0) {
    console.log('No mark-done notes found')
    return
  }

  console.log(`Found ${notes.length} mark-done notes\n`)

  for (const note of notes) {
    console.log(`\nNote created: ${note.created_at}`)
    console.log(`Reference: ${note.reference_id}`)
    console.log(`Text: "${note.note.substring(0, 50)}..."`)

    // Find verification sections for this reference
    const { data: sections } = await supabase
      .from('verification_sections')
      .select('id, section_type, last_marked_done_at, status, decision')
      .eq('reference_id', note.reference_id)
      .eq('status', 'ACTION_REQUIRED')

    if (sections && sections.length > 0) {
      console.log(`  Sections with ACTION_REQUIRED:`)
      sections.forEach(section => {
        console.log(`    - ${section.section_type}:`)
        console.log(`      ID: ${section.id}`)
        console.log(`      last_marked_done_at: ${section.last_marked_done_at || 'NULL ❌'}`)
        console.log(`      decision: ${section.decision || 'NULL'}`)

        if (!section.last_marked_done_at) {
          console.log(`      ⚠️  PROBLEM: No last_marked_done_at despite note existing!`)
        } else {
          const markedDoneTime = new Date(section.last_marked_done_at)
          const noteTime = new Date(note.created_at)
          if (markedDoneTime < noteTime) {
            console.log(`      ⚠️  WARNING: last_marked_done_at is BEFORE note creation`)
          } else {
            console.log(`      ✅ Timestamp looks correct`)
          }
        }
      })
    } else {
      console.log(`  No ACTION_REQUIRED sections found for this reference`)
    }
  }

  // Summary
  console.log('\n=== SUMMARY ===')
  const { data: allActionRequired } = await supabase
    .from('verification_sections')
    .select('id, last_marked_done_at')
    .eq('status', 'ACTION_REQUIRED')

  const withTimestamp = allActionRequired?.filter(s => s.last_marked_done_at).length || 0
  const withoutTimestamp = allActionRequired?.filter(s => !s.last_marked_done_at).length || 0

  console.log(`Total ACTION_REQUIRED sections: ${allActionRequired?.length || 0}`)
  console.log(`  With last_marked_done_at: ${withTimestamp}`)
  console.log(`  Without last_marked_done_at: ${withoutTimestamp}`)

  if (withoutTimestamp > 0 && notes.length > 0) {
    console.log('\n🔴 DIAGNOSIS: Mark-done is creating notes but NOT updating last_marked_done_at!')
    console.log('   This explains why items don\'t disappear from the queue.')
  }
}

checkMarkedDoneSections()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Check failed:', error)
    process.exit(1)
  })

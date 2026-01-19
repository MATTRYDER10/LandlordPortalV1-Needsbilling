import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'

const router = Router()

// Get audit log for a reference (includes staff notes)
router.get('/:referenceId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { referenceId } = req.params

    // Fetch audit log entries
    const { data: auditLog, error: auditError } = await supabase
      .from('reference_audit_log')
      .select('*')
      .eq('reference_id', referenceId)
      .order('created_at', { ascending: false })

    if (auditError) {
      return res.status(400).json({ error: auditError.message })
    }

    // Also fetch reference notes to include in activity log
    const { data: notes, error: notesError } = await supabase
      .from('reference_notes')
      .select('*')
      .eq('reference_id', referenceId)
      .order('created_at', { ascending: false })

    if (notesError) {
      console.error('Error fetching notes for activity log:', notesError)
      // Don't fail the whole request if notes fail
    }

    // Convert notes to audit log format so they appear in the timeline
    // Note: source column may not exist if migration hasn't run
    const notesAsAuditEntries = (notes || []).map(note => ({
      id: `note-${note.id}`,
      reference_id: note.reference_id,
      action: note.source === 'PENDING_RESPONSE_QUEUE' ? 'PENDING_RESPONSE_MARKED_DONE' : 'STAFF_NOTE',
      description: note.note,
      metadata: { noteId: note.id, source: note.source || null },
      created_by: note.created_by,
      created_at: note.created_at
    }))

    // Merge and sort by created_at (most recent first)
    const combinedActivity = [...(auditLog || []), ...notesAsAuditEntries]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    // Remove duplicates (some notes might already be in audit log via NOTE_ADDED action)
    const seenNoteIds = new Set<string>()
    const deduplicatedActivity = combinedActivity.filter(entry => {
      // If this is a note entry from reference_notes table
      if (entry.id.toString().startsWith('note-')) {
        const noteId = entry.metadata?.noteId
        if (seenNoteIds.has(noteId)) return false
        seenNoteIds.add(noteId)
      }
      // If this is an audit log entry about a note (NOTE_ADDED, etc)
      if (entry.action === 'NOTE_ADDED' && entry.metadata?.noteId) {
        seenNoteIds.add(entry.metadata.noteId)
      }
      return true
    })

    // Fetch user emails for entries that have a user
    if (deduplicatedActivity.length > 0) {
      const userIds = [...new Set(deduplicatedActivity.filter(a => a.created_by).map(a => a.created_by))]

      if (userIds.length > 0) {
        const { data: users } = await supabase.auth.admin.listUsers()
        const userMap = new Map(users.users.map(u => [u.id, u.email]))

        const activityWithUsers = deduplicatedActivity.map(entry => ({
          ...entry,
          created_by_user: entry.created_by ? { email: userMap.get(entry.created_by) || 'Staff' } : null
        }))

        return res.json(activityWithUsers)
      }
    }

    res.json(deduplicatedActivity)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router

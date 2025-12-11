import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import { logOfferAuditAction } from '../services/offerAuditService'

const router = Router()

// Get all notes for an offer
router.get('/:offerId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { offerId } = req.params
    console.log('[offer-notes] GET request for offerId:', offerId, 'user:', req.user?.id)

    const { data: notes, error } = await supabase
      .from('offer_notes')
      .select('*')
      .eq('offer_id', offerId)
      .order('created_at', { ascending: false })

    if (error) {
      console.log('[offer-notes] Supabase error:', error)
      return res.status(400).json({ error: error.message })
    }

    console.log('[offer-notes] Found', notes?.length || 0, 'notes')

    // Fetch user emails for each note
    if (notes && notes.length > 0) {
      const userIds = [...new Set(notes.map(n => n.created_by))]
      const { data: users } = await supabase.auth.admin.listUsers()

      const userMap = new Map(users.users.map(u => [u.id, u.email]))

      const notesWithUsers = notes.map(note => ({
        ...note,
        created_by_user: { email: userMap.get(note.created_by) || 'Unknown' }
      }))

      return res.json(notesWithUsers)
    }

    res.json(notes)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Create a new note
router.post('/:offerId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { offerId } = req.params
    const { note } = req.body
    const userId = req.user?.id

    if (!note || !note.trim()) {
      return res.status(400).json({ error: 'Note text is required' })
    }

    // Insert the note
    const { data: newNote, error } = await supabase
      .from('offer_notes')
      .insert({
        offer_id: offerId,
        note: note.trim(),
        created_by: userId
      })
      .select('*')
      .single()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // Get user email
    const { data: userData } = await supabase.auth.admin.getUserById(userId!)
    const noteWithUser = {
      ...newNote,
      created_by_user: { email: userData.user?.email || 'Unknown' }
    }

    // Log to audit trail
    await logOfferAuditAction({
      offerId,
      action: 'NOTE_ADDED',
      description: `Note added: ${note.substring(0, 100)}${note.length > 100 ? '...' : ''}`,
      metadata: { noteId: newNote.id },
      userId
    })

    res.json(noteWithUser)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Update a note
router.put('/:offerId/:noteId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { offerId, noteId } = req.params
    const { note } = req.body
    const userId = req.user?.id

    if (!note || !note.trim()) {
      return res.status(400).json({ error: 'Note text is required' })
    }

    // Check if note belongs to user
    const { data: existingNote } = await supabase
      .from('offer_notes')
      .select('created_by')
      .eq('id', noteId)
      .eq('offer_id', offerId)
      .single()

    if (!existingNote || existingNote.created_by !== userId) {
      return res.status(403).json({ error: 'Not authorized to update this note' })
    }

    // Update the note
    const { data: updatedNote, error } = await supabase
      .from('offer_notes')
      .update({
        note: note.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', noteId)
      .select('*')
      .single()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // Get user email
    const { data: userData } = await supabase.auth.admin.getUserById(userId!)
    const noteWithUser = {
      ...updatedNote,
      created_by_user: { email: userData.user?.email || 'Unknown' }
    }

    // Log to audit trail
    await logOfferAuditAction({
      offerId,
      action: 'NOTE_UPDATED',
      description: `Note updated`,
      metadata: { noteId },
      userId
    })

    res.json(noteWithUser)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Delete a note
router.delete('/:offerId/:noteId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { offerId, noteId } = req.params
    const userId = req.user?.id

    // Check if note belongs to user
    const { data: existingNote } = await supabase
      .from('offer_notes')
      .select('created_by, note')
      .eq('id', noteId)
      .eq('offer_id', offerId)
      .single()

    if (!existingNote || existingNote.created_by !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this note' })
    }

    // Delete the note
    const { error } = await supabase
      .from('offer_notes')
      .delete()
      .eq('id', noteId)

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // Log to audit trail
    await logOfferAuditAction({
      offerId,
      action: 'NOTE_DELETED',
      description: `Note deleted: ${existingNote.note.substring(0, 100)}${existingNote.note.length > 100 ? '...' : ''}`,
      metadata: { noteId },
      userId
    })

    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router

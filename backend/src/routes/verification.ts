import { Router } from 'express'
import { authenticateStaff, StaffAuthRequest } from '../middleware/staffAuth'
import { supabase } from '../config/supabase'

const router = Router()

// Get verification check for a reference
router.get('/:referenceId', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { referenceId } = req.params
    const userId = req.user?.id

    // Get or create verification check
    const { data: existingCheck } = await supabase
      .from('verification_checks')
      .select('*')
      .eq('reference_id', referenceId)
      .single()

    if (existingCheck) {
      return res.json({ verificationCheck: existingCheck })
    }

    // Create new verification check if doesn't exist
    const { data: newCheck, error } = await supabase
      .from('verification_checks')
      .insert({
        reference_id: referenceId,
        verified_by: userId,
        current_step: 1,
        overall_status: 'not_started'
      })
      .select()
      .single()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json({ verificationCheck: newCheck })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Update verification check
router.patch('/:referenceId', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { referenceId } = req.params
    const userId = req.user?.id
    const updateData = req.body

    // Get existing check
    const { data: existingCheck } = await supabase
      .from('verification_checks')
      .select('*')
      .eq('reference_id', referenceId)
      .single()

    if (!existingCheck) {
      // Create if doesn't exist
      const { data: newCheck, error } = await supabase
        .from('verification_checks')
        .insert({
          reference_id: referenceId,
          verified_by: userId,
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        return res.status(400).json({ error: error.message })
      }

      return res.json({ verificationCheck: newCheck })
    }

    // Update existing check
    const { data: updatedCheck, error } = await supabase
      .from('verification_checks')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('reference_id', referenceId)
      .select()
      .single()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json({ verificationCheck: updatedCheck })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Complete verification and update reference status
router.post('/:referenceId/complete', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { referenceId } = req.params
    const { finalDecision, finalNotes, passed } = req.body

    // Update verification check
    const { error: checkError } = await supabase
      .from('verification_checks')
      .update({
        overall_status: passed ? 'passed' : 'failed',
        final_decision: finalDecision,
        final_notes: finalNotes,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('reference_id', referenceId)

    if (checkError) {
      return res.status(400).json({ error: checkError.message })
    }

    // Update reference status
    const newStatus = passed ? 'completed' : 'in_progress' // If failed, send back to in_progress
    const { error: refError } = await supabase
      .from('tenant_references')
      .update({
        status: newStatus,
        verified_at: passed ? new Date().toISOString() : null,
        verification_notes: finalNotes
      })
      .eq('id', referenceId)

    if (refError) {
      return res.status(400).json({ error: refError.message })
    }

    res.json({ success: true, status: newStatus })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router

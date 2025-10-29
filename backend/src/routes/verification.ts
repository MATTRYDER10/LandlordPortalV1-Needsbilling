import { Router } from 'express'
import { authenticateStaff, StaffAuthRequest } from '../middleware/staffAuth'
import { supabase } from '../config/supabase'
import { encrypt } from '../services/encryption'
import { scorePropertyGoose } from '../services/scoringService'
import { mapReferenceToScoringInput } from '../services/scoringMapper'

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
    const newStatus = passed ? 'completed' : 'rejected' // If failed, mark as rejected
    const staffUserId = req.staffUser?.id
    const { error: refError } = await supabase
      .from('tenant_references')
      .update({
        status: newStatus,
        verified_at: new Date().toISOString(),
        verified_by: staffUserId,
        verification_notes_encrypted: encrypt(finalNotes || '')
      })
      .eq('id', referenceId)

    if (refError) {
      return res.status(400).json({ error: refError.message })
    }

    // Automatically score the reference if verification passed
    let scoreResult = null
    if (passed) {
      try {
        console.log(`Auto-scoring reference ${referenceId} after verification complete...`)

        // Map database data to scoring input format
        const scoringInput = await mapReferenceToScoringInput(referenceId)

        if (scoringInput) {
          // Run the scoring engine
          const score = scorePropertyGoose(scoringInput)

          console.log(`Scoring result for ${referenceId}:`, {
            decision: score.decision,
            score_total: score.score_total,
            ratio: score.ratio
          })

          // Store the score in the database
          const { data: savedScore, error: scoreError } = await supabase
            .from('reference_scores')
            .upsert({
              reference_id: referenceId,
              decision: score.decision,
              score_total: score.score_total,
              domain_scores: score.domain_scores,
              ratio: score.ratio,
              caps: score.caps,
              review_flags: score.review_flags,
              decline_reasons: score.decline_reasons,
              guarantor_required: score.decision === 'PASS_WITH_GUARANTOR',
              guarantor_min_ratio: score.guarantor_requirements.min_ratio,
              guarantor_min_tas: score.guarantor_requirements.min_tas,
              scored_by: staffUserId,
              scored_at: new Date().toISOString()
            }, {
              onConflict: 'reference_id'
            })
            .select()
            .single()

          if (scoreError) {
            console.error('Error saving score:', scoreError)
          } else {
            scoreResult = savedScore
            console.log(`Score saved successfully for reference ${referenceId}`)
          }
        } else {
          console.error('Failed to map reference data to scoring input')
        }
      } catch (scoringError: any) {
        // Log error but don't fail the verification complete request
        console.error('Error during auto-scoring:', scoringError)
      }
    }

    res.json({ success: true, status: newStatus, score: scoreResult })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// TEST ENDPOINT: Manually trigger scoring for a reference (for development/testing)
router.post('/:referenceId/score', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { referenceId } = req.params
    const staffUserId = req.staffUser?.id

    console.log(`[TEST] Manually scoring reference ${referenceId}...`)

    // Map database data to scoring input format
    const scoringInput = await mapReferenceToScoringInput(referenceId)

    if (!scoringInput) {
      return res.status(400).json({ error: 'Failed to map reference data for scoring' })
    }

    // Run the scoring engine
    const score = scorePropertyGoose(scoringInput)

    console.log(`[TEST] Scoring result:`, {
      decision: score.decision,
      score_total: score.score_total,
      ratio: score.ratio,
      decline_reasons: score.decline_reasons
    })

    // Store the score in the database
    const { data: savedScore, error: scoreError } = await supabase
      .from('reference_scores')
      .upsert({
        reference_id: referenceId,
        decision: score.decision,
        score_total: score.score_total,
        domain_scores: score.domain_scores,
        ratio: score.ratio,
        caps: score.caps,
        review_flags: score.review_flags,
        decline_reasons: score.decline_reasons,
        guarantor_required: score.decision === 'PASS_WITH_GUARANTOR',
        guarantor_min_ratio: score.guarantor_requirements.min_ratio,
        guarantor_min_tas: score.guarantor_requirements.min_tas,
        scored_by: staffUserId,
        scored_at: new Date().toISOString()
      }, {
        onConflict: 'reference_id'
      })
      .select()
      .single()

    if (scoreError) {
      console.error('[TEST] Error saving score:', scoreError)
      return res.status(400).json({ error: scoreError.message })
    }

    res.json({
      success: true,
      score: savedScore,
      input: scoringInput // Include input for debugging
    })
  } catch (error: any) {
    console.error('[TEST] Error during manual scoring:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router

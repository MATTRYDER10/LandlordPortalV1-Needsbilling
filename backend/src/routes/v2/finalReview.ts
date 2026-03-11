/**
 * V2 Final Review Routes (Senior Staff Only)
 *
 * Endpoints for final review decisions.
 * Only accessible to staff with FINAL_REVIEW or higher role.
 */

import { Router } from 'express'
import { authenticateStaff, StaffAuthRequest } from '../../middleware/staffAuth'
import { supabase } from '../../config/supabase'
import { decrypt } from '../../services/encryption'
import {
  getReference,
  getReferenceDecrypted,
  updateReferenceStatus,
  getGroupChildren,
  getGuarantor
} from '../../services/v2/referenceServiceV2'
import { getSections } from '../../services/v2/sectionServiceV2'
import {
  getFinalReviewItems,
  claimWorkItem,
  releaseWorkItem,
  completeWorkItem,
  getWorkItem
} from '../../services/v2/workQueueServiceV2'
import { getVerbalReferencesForReference } from '../../services/v2/verbalReferenceService'
import { V2ReferenceStatus } from '../../services/v2/types'
import { generateAndUploadV2Report } from '../../services/v2/pdfReportServiceV2'

const router = Router()

// ============================================================================
// ROLE CHECK MIDDLEWARE
// ============================================================================

/**
 * Middleware to check if staff has Final Review permission
 */
async function requireFinalReviewRole(req: StaffAuthRequest, res: any, next: any) {
  const staffUser = req.staffUser

  if (!staffUser) {
    return res.status(401).json({ error: 'Staff authentication required' })
  }

  // Check staff role - must be FINAL_REVIEW, SUPERVISOR, or ADMIN
  const { data: staffData } = await supabase
    .from('staff_users')
    .select('role')
    .eq('id', staffUser.id)
    .single()

  const allowedRoles = ['FINAL_REVIEW', 'SUPERVISOR', 'ADMIN', 'admin', 'supervisor']
  if (!staffData || !allowedRoles.includes(staffData.role)) {
    return res.status(403).json({ error: 'Final Review access required' })
  }

  next()
}

// ============================================================================
// FINAL REVIEW QUEUE
// ============================================================================

/**
 * Get final review queue
 */
router.get('/', authenticateStaff, requireFinalReviewRole, async (req: StaffAuthRequest, res) => {
  return finalReviewQueueHandler(req, res)
})

/**
 * Get final review queue (alias for /queue endpoint)
 */
router.get('/queue', authenticateStaff, requireFinalReviewRole, async (req: StaffAuthRequest, res) => {
  return finalReviewQueueHandler(req, res)
})

/**
 * Shared handler for final review queue
 */
async function finalReviewQueueHandler(req: StaffAuthRequest, res: any) {
  try {
    const { limit } = req.query

    const items = await getFinalReviewItems(limit ? parseInt(limit as string) : 50)

    // Enrich with decrypted data
    const enrichedItems = items.map((item: any) => ({
      ...item,
      reference: item.reference ? {
        ...item.reference,
        tenant_first_name: decrypt(item.reference.tenant_first_name_encrypted),
        tenant_last_name: decrypt(item.reference.tenant_last_name_encrypted),
        property_address: decrypt(item.reference.property_address_encrypted),
        property_city: decrypt(item.reference.property_city_encrypted)
      } : null
    }))

    res.json({ items: enrichedItems })
  } catch (error: any) {
    console.error('[V2 FinalReview] Error getting queue:', error)
    res.status(500).json({ error: error.message })
  }
}

/**
 * Get final review details for a reference
 */
router.get('/:id', authenticateStaff, requireFinalReviewRole, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params

    // Get reference details
    const refResult = await getReferenceDecrypted(id)
    if (!refResult) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Get all sections with decisions
    const sections = await getSections(id)

    // Get verbal references
    const verbalReferences = await getVerbalReferencesForReference(id)

    // Build response based on whether group or single
    let response: any = {
      reference: {
        ...refResult.reference,
        tenant_first_name: decrypt(refResult.reference.tenant_first_name_encrypted),
        tenant_last_name: decrypt(refResult.reference.tenant_last_name_encrypted),
        tenant_email: decrypt(refResult.reference.tenant_email_encrypted),
        property_address: decrypt(refResult.reference.property_address_encrypted),
        property_city: decrypt(refResult.reference.property_city_encrypted),
        property_postcode: decrypt(refResult.reference.property_postcode_encrypted)
      },
      sections,
      verbalReferences,
      isGroup: refResult.reference.is_group_parent
    }

    // If group parent, get all children with their sections
    if (refResult.reference.is_group_parent) {
      const children = await getGroupChildren(id)

      const childrenWithDetails = await Promise.all(
        children.map(async (child) => {
          const childSections = await getSections(child.id)
          const childVerbalRefs = await getVerbalReferencesForReference(child.id)
          const guarantor = await getGuarantor(child.id)

          let guarantorDetails = null
          if (guarantor) {
            const guarantorSections = await getSections(guarantor.id)
            guarantorDetails = {
              ...guarantor,
              tenant_first_name: decrypt(guarantor.tenant_first_name_encrypted),
              tenant_last_name: decrypt(guarantor.tenant_last_name_encrypted),
              sections: guarantorSections
            }
          }

          return {
            ...child,
            tenant_first_name: decrypt(child.tenant_first_name_encrypted),
            tenant_last_name: decrypt(child.tenant_last_name_encrypted),
            sections: childSections,
            verbalReferences: childVerbalRefs,
            guarantor: guarantorDetails
          }
        })
      )

      response.children = childrenWithDetails
    } else {
      // Single tenant - check for guarantor
      const guarantor = await getGuarantor(id)
      if (guarantor) {
        const guarantorSections = await getSections(guarantor.id)
        response.guarantor = {
          ...guarantor,
          tenant_first_name: decrypt(guarantor.tenant_first_name_encrypted),
          tenant_last_name: decrypt(guarantor.tenant_last_name_encrypted),
          sections: guarantorSections
        }
      }
    }

    res.json(response)
  } catch (error: any) {
    console.error('[V2 FinalReview] Error getting details:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Claim a final review work item
 */
router.post('/:id/claim', authenticateStaff, requireFinalReviewRole, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params // This is the work item ID
    const staffUser = req.staffUser

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' })
    }

    const success = await claimWorkItem(id, staffUser.id)
    if (!success) {
      return res.status(400).json({ error: 'Failed to claim. Item may have been claimed by another assessor.' })
    }

    res.json({ message: 'Final review claimed', workItemId: id })
  } catch (error: any) {
    console.error('[V2 FinalReview] Error claiming:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Release a final review work item
 */
router.post('/:id/release', authenticateStaff, requireFinalReviewRole, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params

    const success = await releaseWorkItem(id)
    if (!success) {
      return res.status(400).json({ error: 'Failed to release work item' })
    }

    res.json({ message: 'Final review released', workItemId: id })
  } catch (error: any) {
    console.error('[V2 FinalReview] Error releasing:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Submit final decision
 */
router.post('/:referenceId/decision', authenticateStaff, requireFinalReviewRole, async (req: StaffAuthRequest, res) => {
  try {
    const { referenceId } = req.params
    const staffUser = req.staffUser
    const { decision, notes, workItemId } = req.body

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' })
    }

    // Validate decision
    const validDecisions: V2ReferenceStatus[] = [
      'ACCEPTED',
      'ACCEPTED_WITH_GUARANTOR',
      'ACCEPTED_ON_CONDITION',
      'REJECTED'
    ]

    if (!validDecisions.includes(decision)) {
      return res.status(400).json({
        error: 'Invalid decision. Must be ACCEPTED, ACCEPTED_WITH_GUARANTOR, ACCEPTED_ON_CONDITION, or REJECTED'
      })
    }

    // Require notes for conditional acceptance or rejection
    if ((decision === 'ACCEPTED_ON_CONDITION' || decision === 'REJECTED') && !notes) {
      return res.status(400).json({ error: 'Notes required for this decision type' })
    }

    // Update reference status
    const success = await updateReferenceStatus(referenceId, decision, {
      finalDecisionNotes: notes,
      finalDecisionBy: staffUser.id
    })

    if (!success) {
      return res.status(500).json({ error: 'Failed to update reference status' })
    }

    // If this is a group parent, update all children
    const reference = await getReference(referenceId)
    if (reference?.is_group_parent) {
      const children = await getGroupChildren(referenceId)
      for (const child of children) {
        await updateReferenceStatus(child.id, decision, {
          finalDecisionNotes: notes,
          finalDecisionBy: staffUser.id
        })

        // Also update any guarantors
        const guarantor = await getGuarantor(child.id)
        if (guarantor) {
          await updateReferenceStatus(guarantor.id, decision, {
            finalDecisionNotes: notes,
            finalDecisionBy: staffUser.id
          })
        }
      }
    } else {
      // Single tenant - update guarantor if exists
      const guarantor = await getGuarantor(referenceId)
      if (guarantor) {
        await updateReferenceStatus(guarantor.id, decision, {
          finalDecisionNotes: notes,
          finalDecisionBy: staffUser.id
        })
      }
    }

    // Complete the work item if provided
    if (workItemId) {
      await completeWorkItem(workItemId)
    }

    // Generate PDF report (Sprint 4)
    let reportPdfUrl: string | null = null
    try {
      reportPdfUrl = await generateAndUploadV2Report(referenceId)
      console.log(`[V2 FinalReview] PDF report generated: ${reportPdfUrl}`)
    } catch (pdfError: any) {
      console.error('[V2 FinalReview] Error generating PDF:', pdfError.message)
      // Don't fail the decision submission, PDF can be regenerated later
    }

    // TODO: Send notification to agent (use /api/v2/reports/:id/email endpoint)

    res.json({
      message: 'Final decision submitted',
      referenceId,
      decision,
      notes,
      reportPdfUrl
    })
  } catch (error: any) {
    console.error('[V2 FinalReview] Error submitting decision:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router

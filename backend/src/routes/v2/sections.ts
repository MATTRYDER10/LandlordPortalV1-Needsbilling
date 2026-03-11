/**
 * V2 Sections Routes (Staff)
 *
 * Endpoints for managing verification sections and queues.
 * Used by staff dashboard for section-by-section verification.
 */

import { Router } from 'express'
import { authenticateStaff, StaffAuthRequest } from '../../middleware/staffAuth'
import { supabase } from '../../config/supabase'
import { decrypt } from '../../services/encryption'
import {
  getQueueCounts,
  getSectionsInQueue,
  getSection,
  claimSection,
  releaseSection,
  submitSectionDecision
} from '../../services/v2/sectionServiceV2'
import { getReference } from '../../services/v2/referenceServiceV2'
import { getVerbalReferenceForSection } from '../../services/v2/verbalReferenceService'
import { V2SectionType, V2SectionDecision, TENANT_SECTIONS } from '../../services/v2/types'

const router = Router()

// ============================================================================
// QUEUE DASHBOARD
// ============================================================================

/**
 * Get comprehensive stats for V2 dashboard
 */
router.get('/stats', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const staffUser = req.staffUser

    // Initialize stats object
    const stats: any = {
      sections: {
        IDENTITY: { ready: 0, in_progress: 0 },
        RTR: { ready: 0, in_progress: 0 },
        INCOME: { ready: 0, in_progress: 0 },
        RESIDENTIAL: { ready: 0, in_progress: 0 },
        CREDIT: { ready: 0, in_progress: 0 },
        AML: { ready: 0, in_progress: 0 }
      },
      chase: { pending: 0, overdue: 0 },
      finalReview: { pending: 0, in_progress: 0 },
      myItems: 0
    }

    // Get section counts by type and status
    const { data: sectionCounts } = await supabase
      .from('reference_sections_v2')
      .select('section_type, queue_status')
      .in('queue_status', ['READY', 'IN_PROGRESS'])

    if (sectionCounts) {
      for (const row of sectionCounts) {
        const sectionType = row.section_type as V2SectionType
        if (stats.sections[sectionType]) {
          if (row.queue_status === 'READY') {
            stats.sections[sectionType].ready++
          } else if (row.queue_status === 'IN_PROGRESS') {
            stats.sections[sectionType].in_progress++
          }
        }
      }
    }

    // Get chase queue stats
    const { count: chaseCount } = await supabase
      .from('chase_items_v2')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'IN_CHASE_QUEUE')

    stats.chase.pending = chaseCount || 0

    // Get overdue chase items (next_chase_due in the past)
    const { count: overdueCount } = await supabase
      .from('chase_items_v2')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'IN_CHASE_QUEUE')
      .lt('next_chase_due', new Date().toISOString())

    stats.chase.overdue = overdueCount || 0

    // Get final review stats
    const { data: finalReviewData } = await supabase
      .from('work_items_v2')
      .select('status')
      .eq('work_type', 'FINAL_REVIEW')
      .in('status', ['AVAILABLE', 'IN_PROGRESS'])

    if (finalReviewData) {
      stats.finalReview.pending = finalReviewData.filter(r => r.status === 'AVAILABLE').length
      stats.finalReview.in_progress = finalReviewData.filter(r => r.status === 'IN_PROGRESS').length
    }

    // Get my items count
    if (staffUser) {
      const { count: myCount } = await supabase
        .from('reference_sections_v2')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', staffUser.id)
        .eq('queue_status', 'IN_PROGRESS')

      stats.myItems = myCount || 0
    }

    res.json({ stats })
  } catch (error: any) {
    console.error('[V2 Sections] Error getting stats:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get queue items for a specific section type (frontend query param style)
 */
router.get('/queue', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { sectionType, limit } = req.query

    // Validate section type
    const validTypes: V2SectionType[] = TENANT_SECTIONS
    if (!sectionType || !validTypes.includes(sectionType as V2SectionType)) {
      return res.status(400).json({ error: 'Invalid or missing sectionType' })
    }

    const sections = await getSectionsInQueue(
      sectionType as V2SectionType,
      limit ? parseInt(limit as string) : 50
    ) as any[] | null

    if (!sections) {
      return res.json({ items: [] })
    }

    // Get company names for each section
    const companyIds = [...new Set(sections.map((s: any) => s.reference?.company_id).filter(Boolean))]
    const { data: companies } = await supabase
      .from('companies')
      .select('id, company_name')
      .in('id', companyIds)

    const companyMap = new Map(companies?.map(c => [c.id, c.company_name]) || [])

    // Get staff names for claimed sections
    const staffIds = [...new Set(sections.filter(s => s.assigned_to).map(s => s.assigned_to))]
    const { data: staffUsers } = staffIds.length > 0 ? await supabase
      .from('staff_users')
      .select('id, name')
      .in('id', staffIds) : { data: [] }

    const staffMap = new Map(staffUsers?.map(s => [s.id, s.name]) || [])

    // Transform to frontend format
    const items = sections.map((section: any) => ({
      id: section.id,
      section_id: section.id,
      section_type: section.section_type,
      queue_status: section.queue_status,
      reference_id: section.reference_id,
      tenant_name: section.reference
        ? `${decrypt(section.reference.tenant_first_name_encrypted)} ${decrypt(section.reference.tenant_last_name_encrypted)}`
        : 'Unknown',
      property_address: section.reference
        ? decrypt(section.reference.property_address_encrypted)
        : 'Unknown',
      company_name: companyMap.get(section.reference?.company_id) || 'Unknown',
      is_guarantor: section.reference?.is_guarantor || false,
      claimed_by: section.assigned_to,
      claimed_by_name: staffMap.get(section.assigned_to) || null,
      claimed_at: section.assigned_at,
      hours_in_queue: section.queue_entered_at
        ? Math.round((Date.now() - new Date(section.queue_entered_at).getTime()) / (1000 * 60 * 60))
        : 0,
      urgency: section.queue_entered_at && (Date.now() - new Date(section.queue_entered_at).getTime()) > 48 * 60 * 60 * 1000
        ? 'URGENT'
        : section.queue_entered_at && (Date.now() - new Date(section.queue_entered_at).getTime()) > 24 * 60 * 60 * 1000
        ? 'WARNING'
        : 'NORMAL',
      created_at: section.created_at
    }))

    res.json({ items })
  } catch (error: any) {
    console.error('[V2 Sections] Error getting queue:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get my active tasks (claimed sections)
 */
router.get('/my-tasks', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const staffUser = req.staffUser

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' })
    }

    // Get all sections claimed by this staff member
    const { data: sections, error } = await supabase
      .from('reference_sections_v2')
      .select(`
        *,
        reference:tenant_references_v2!reference_sections_v2_reference_id_fkey (
          id,
          company_id,
          tenant_first_name_encrypted,
          tenant_last_name_encrypted,
          property_address_encrypted,
          is_guarantor
        )
      `)
      .eq('assigned_to', staffUser.id)
      .eq('queue_status', 'IN_PROGRESS')

    if (error) {
      throw error
    }

    // Get company names
    const companyIds = [...new Set(sections?.map(s => s.reference?.company_id).filter(Boolean))]
    const { data: companies } = companyIds.length > 0 ? await supabase
      .from('companies')
      .select('id, company_name')
      .in('id', companyIds) : { data: [] }

    const companyMap = new Map(companies?.map(c => [c.id, c.company_name]) || [])

    // Transform to frontend format
    const items = (sections || []).map((section: any) => ({
      id: section.id,
      section_id: section.id,
      section_type: section.section_type,
      reference_id: section.reference_id,
      work_type: 'SECTION_REVIEW',
      tenant_name: section.reference
        ? `${decrypt(section.reference.tenant_first_name_encrypted)} ${decrypt(section.reference.tenant_last_name_encrypted)}`
        : 'Unknown',
      property_address: section.reference
        ? decrypt(section.reference.property_address_encrypted)
        : 'Unknown',
      company_name: companyMap.get(section.reference?.company_id) || 'Unknown',
      is_guarantor: section.reference?.is_guarantor || false,
      claimed_at: section.assigned_at,
      created_at: section.created_at
    }))

    // Also get final review items claimed by this staff member
    const { data: finalReviews } = await supabase
      .from('work_items_v2')
      .select(`
        *,
        reference:tenant_references_v2!work_items_v2_reference_id_fkey (
          id,
          company_id,
          tenant_first_name_encrypted,
          tenant_last_name_encrypted,
          property_address_encrypted
        )
      `)
      .eq('assigned_to', staffUser.id)
      .eq('work_type', 'FINAL_REVIEW')
      .eq('status', 'IN_PROGRESS')

    if (finalReviews) {
      for (const review of finalReviews) {
        items.push({
          id: review.id,
          section_id: null,
          section_type: null,
          reference_id: review.reference_id,
          work_type: 'FINAL_REVIEW',
          tenant_name: review.reference
            ? `${decrypt(review.reference.tenant_first_name_encrypted)} ${decrypt(review.reference.tenant_last_name_encrypted)}`
            : 'Unknown',
          property_address: review.reference
            ? decrypt(review.reference.property_address_encrypted)
            : 'Unknown',
          company_name: companyMap.get(review.reference?.company_id) || 'Unknown',
          is_guarantor: false,
          claimed_at: review.assigned_at,
          created_at: review.created_at
        })
      }
    }

    res.json({ items })
  } catch (error: any) {
    console.error('[V2 Sections] Error getting my tasks:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get queue counts for dashboard tiles (legacy endpoint)
 */
router.get('/queues', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const counts = await getQueueCounts()
    res.json({ counts })
  } catch (error: any) {
    console.error('[V2 Sections] Error getting queue counts:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get items in a specific queue
 */
router.get('/queues/:type', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { type } = req.params
    const { limit } = req.query

    // Validate section type
    const validTypes: V2SectionType[] = ['IDENTITY', 'RTR', 'INCOME', 'RESIDENTIAL', 'CREDIT', 'AML']
    if (!validTypes.includes(type as V2SectionType)) {
      return res.status(400).json({ error: 'Invalid queue type' })
    }

    const sections = await getSectionsInQueue(
      type as V2SectionType,
      limit ? parseInt(limit as string) : 50
    )

    if (!sections) {
      return res.status(500).json({ error: 'Failed to get queue' })
    }

    // Decrypt reference data for display
    const enrichedSections = sections.map((section: any) => ({
      ...section,
      reference: section.reference ? {
        ...section.reference,
        tenant_first_name: decrypt(section.reference.tenant_first_name_encrypted),
        tenant_last_name: decrypt(section.reference.tenant_last_name_encrypted),
        property_address: decrypt(section.reference.property_address_encrypted)
      } : null
    }))

    res.json({ sections: enrichedSections })
  } catch (error: any) {
    console.error('[V2 Sections] Error getting queue:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// SECTION OPERATIONS
// ============================================================================

/**
 * Get section details for review
 */
router.get('/:id', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params

    const section = await getSection(id)
    if (!section) {
      return res.status(404).json({ error: 'Section not found' })
    }

    // Get reference details
    const reference = await getReference(section.reference_id)
    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Check for verbal reference
    const verbalReference = await getVerbalReferenceForSection(id)

    // Decrypt data for display
    const decryptedReference = {
      ...reference,
      tenant_first_name: decrypt(reference.tenant_first_name_encrypted),
      tenant_last_name: decrypt(reference.tenant_last_name_encrypted),
      tenant_email: decrypt(reference.tenant_email_encrypted),
      tenant_phone: decrypt(reference.tenant_phone_encrypted),
      property_address: decrypt(reference.property_address_encrypted),
      property_city: decrypt(reference.property_city_encrypted),
      property_postcode: decrypt(reference.property_postcode_encrypted),
      employer_ref_name: decrypt(reference.employer_ref_name_encrypted),
      employer_ref_email: decrypt(reference.employer_ref_email_encrypted),
      previous_landlord_name: decrypt(reference.previous_landlord_name_encrypted),
      previous_landlord_email: decrypt(reference.previous_landlord_email_encrypted)
    }

    res.json({
      section,
      reference: decryptedReference,
      verbalReference,
      hasVerbalReference: !!verbalReference
    })
  } catch (error: any) {
    console.error('[V2 Sections] Error getting section:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Claim a section for review
 */
router.post('/:id/claim', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params
    const staffUser = req.staffUser

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' })
    }

    const success = await claimSection(id, staffUser.id)
    if (!success) {
      return res.status(400).json({ error: 'Failed to claim section. It may have been claimed by another assessor.' })
    }

    res.json({ message: 'Section claimed', sectionId: id })
  } catch (error: any) {
    console.error('[V2 Sections] Error claiming section:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Release a section back to queue
 */
router.post('/:id/release', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params

    const success = await releaseSection(id)
    if (!success) {
      return res.status(400).json({ error: 'Failed to release section' })
    }

    res.json({ message: 'Section released to queue', sectionId: id })
  } catch (error: any) {
    console.error('[V2 Sections] Error releasing section:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Submit decision for a section
 */
router.post('/:id/decision', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params
    const staffUser = req.staffUser
    // Accept both naming conventions from frontend
    const {
      decision,
      conditionText,
      condition_text,
      failReason,
      decision_notes,
      assessorNotes,
      checklist_results
    } = req.body

    const finalConditionText = conditionText || condition_text
    const finalNotes = assessorNotes || decision_notes

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' })
    }

    // Validate decision
    const validDecisions: V2SectionDecision[] = ['PASS', 'PASS_WITH_CONDITION', 'FAIL']
    if (!validDecisions.includes(decision)) {
      return res.status(400).json({ error: 'Invalid decision. Must be PASS, PASS_WITH_CONDITION, or FAIL' })
    }

    // Require condition text for PASS_WITH_CONDITION
    if (decision === 'PASS_WITH_CONDITION' && !finalConditionText) {
      return res.status(400).json({ error: 'Condition text required for PASS_WITH_CONDITION' })
    }

    // Require notes for FAIL
    if (decision === 'FAIL' && !finalNotes && !failReason) {
      return res.status(400).json({ error: 'Notes or fail reason required for FAIL decision' })
    }

    const success = await submitSectionDecision({
      sectionId: id,
      decision,
      conditionText: finalConditionText,
      failReason: failReason || finalNotes,
      assessorNotes: finalNotes,
      staffUserId: staffUser.id
    })

    if (!success) {
      return res.status(500).json({ error: 'Failed to submit decision' })
    }

    res.json({ message: 'Decision submitted', sectionId: id, decision })
  } catch (error: any) {
    console.error('[V2 Sections] Error submitting decision:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get evidence for a section
 */
router.get('/:id/evidence', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params

    const section = await getSection(id)
    if (!section) {
      return res.status(404).json({ error: 'Section not found' })
    }

    // TODO: Fetch actual evidence from storage/database
    // For now return empty array - evidence integration will be added in Sprint 3
    const evidence: any[] = []

    res.json({ evidence })
  } catch (error: any) {
    console.error('[V2 Sections] Error getting evidence:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router

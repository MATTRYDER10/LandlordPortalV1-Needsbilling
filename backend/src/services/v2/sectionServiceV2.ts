/**
 * V2 Section Service
 *
 * Manages verification sections and their queue statuses.
 * Each reference has 6 sections (tenant) or 5 sections (guarantor).
 */

import { supabase } from '../../config/supabase'
import {
  V2SectionType,
  V2SectionRow,
  V2QueueStatus,
  V2SectionDecision,
  V2QueueCounts,
  TENANT_SECTIONS,
  GUARANTOR_SECTIONS,
  SubmitSectionDecisionInput
} from './types'

// ============================================================================
// SECTION INITIALIZATION
// ============================================================================

/**
 * Initialize all verification sections for a V2 reference
 *
 * @param referenceId - V2 reference ID
 * @param isGuarantor - Whether this is a guarantor (5 sections vs 6)
 * @returns Created sections or null on error
 */
export async function initializeSections(
  referenceId: string,
  isGuarantor: boolean = false
): Promise<V2SectionRow[] | null> {
  try {
    const sections = isGuarantor ? GUARANTOR_SECTIONS : TENANT_SECTIONS

    const sectionsToInsert = sections.map((sectionType, index) => ({
      reference_id: referenceId,
      section_type: sectionType,
      section_order: index + 1,
      queue_status: 'PENDING' as V2QueueStatus
    }))

    const { data, error } = await supabase
      .from('reference_sections_v2')
      .insert(sectionsToInsert)
      .select()

    if (error) {
      console.error('[SectionServiceV2] Failed to initialize sections:', error)
      return null
    }

    console.log(`[SectionServiceV2] Initialized ${sections.length} sections for reference ${referenceId}`)
    return data
  } catch (error) {
    console.error('[SectionServiceV2] Error initializing sections:', error)
    return null
  }
}

// ============================================================================
// SECTION QUERIES
// ============================================================================

/**
 * Get all sections for a reference
 */
export async function getSections(referenceId: string): Promise<V2SectionRow[] | null> {
  const { data, error } = await supabase
    .from('reference_sections_v2')
    .select('*')
    .eq('reference_id', referenceId)
    .order('section_order')

  if (error) {
    console.error('[SectionServiceV2] Failed to get sections:', error)
    return null
  }

  return data
}

/**
 * Get a single section by ID
 */
export async function getSection(sectionId: string): Promise<V2SectionRow | null> {
  const { data, error } = await supabase
    .from('reference_sections_v2')
    .select('*')
    .eq('id', sectionId)
    .single()

  if (error) {
    console.error('[SectionServiceV2] Failed to get section:', error)
    return null
  }

  return data
}

/**
 * Get sections ready for a specific queue
 */
export async function getSectionsInQueue(
  sectionType: V2SectionType,
  limit: number = 50
): Promise<V2SectionRow[] | null> {
  const { data, error } = await supabase
    .from('reference_sections_v2')
    .select(`
      *,
      reference:tenant_references_v2!reference_sections_v2_reference_id_fkey (
        id,
        company_id,
        tenant_first_name_encrypted,
        tenant_last_name_encrypted,
        property_address_encrypted,
        monthly_rent,
        rent_share
      )
    `)
    .eq('section_type', sectionType)
    .eq('queue_status', 'READY')
    .order('queue_entered_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('[SectionServiceV2] Failed to get queue:', error)
    return null
  }

  return data
}

/**
 * Get queue counts for dashboard
 */
export async function getQueueCounts(): Promise<V2QueueCounts> {
  const counts: V2QueueCounts = {
    IDENTITY: 0,
    RTR: 0,
    INCOME: 0,
    RESIDENTIAL: 0,
    CREDIT: 0,
    AML: 0,
    CHASE: 0,
    FINAL_REVIEW: 0
  }

  try {
    // Count sections ready per type
    const { data: sectionCounts, error: sectionError } = await supabase
      .from('reference_sections_v2')
      .select('section_type')
      .eq('queue_status', 'READY')

    if (!sectionError && sectionCounts) {
      for (const row of sectionCounts) {
        const type = row.section_type as V2SectionType
        if (type in counts) {
          counts[type]++
        }
      }
    }

    // Count chase items in queue
    const { count: chaseCount, error: chaseError } = await supabase
      .from('chase_items_v2')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'IN_CHASE_QUEUE')

    if (!chaseError) {
      counts.CHASE = chaseCount || 0
    }

    // Count final review items
    const { count: finalCount, error: finalError } = await supabase
      .from('work_items_v2')
      .select('*', { count: 'exact', head: true })
      .eq('work_type', 'FINAL_REVIEW')
      .eq('status', 'AVAILABLE')

    if (!finalError) {
      counts.FINAL_REVIEW = finalCount || 0
    }

    return counts
  } catch (error) {
    console.error('[SectionServiceV2] Error getting queue counts:', error)
    return counts
  }
}

// ============================================================================
// SECTION STATUS TRANSITIONS
// ============================================================================

/**
 * Mark a section as ready for queue
 * Called when evidence is uploaded or referee submits
 */
export async function markSectionReady(
  sectionId: string,
  isRefereeSubmission: boolean = false
): Promise<boolean> {
  try {
    const now = new Date().toISOString()

    const updateData: Partial<V2SectionRow> = {
      queue_status: 'READY',
      queue_entered_at: now,
      updated_at: now
    }

    if (isRefereeSubmission) {
      updateData.referee_submitted_at = now
    } else {
      updateData.evidence_submitted_at = now
    }

    const { error } = await supabase
      .from('reference_sections_v2')
      .update(updateData)
      .eq('id', sectionId)

    if (error) {
      console.error('[SectionServiceV2] Failed to mark section ready:', error)
      return false
    }

    // Create work item for this section
    const section = await getSection(sectionId)
    if (section) {
      await createWorkItem(section.reference_id, sectionId, section.section_type)
    }

    console.log(`[SectionServiceV2] Section ${sectionId} marked as READY`)
    return true
  } catch (error) {
    console.error('[SectionServiceV2] Error marking section ready:', error)
    return false
  }
}

/**
 * Claim a section for review (assessor starts working)
 */
export async function claimSection(
  sectionId: string,
  staffUserId: string
): Promise<boolean> {
  try {
    const now = new Date().toISOString()

    // Check section is still READY
    const section = await getSection(sectionId)
    if (!section || section.queue_status !== 'READY') {
      console.log('[SectionServiceV2] Section not available for claiming')
      return false
    }

    const { error } = await supabase
      .from('reference_sections_v2')
      .update({
        queue_status: 'IN_PROGRESS',
        assigned_to: staffUserId,
        assigned_at: now,
        started_at: now,
        updated_at: now
      })
      .eq('id', sectionId)
      .eq('queue_status', 'READY') // Ensure still READY (prevent race condition)

    if (error) {
      console.error('[SectionServiceV2] Failed to claim section:', error)
      return false
    }

    // Update work item
    await updateWorkItemStatus(sectionId, 'IN_PROGRESS', staffUserId)

    console.log(`[SectionServiceV2] Section ${sectionId} claimed by ${staffUserId}`)
    return true
  } catch (error) {
    console.error('[SectionServiceV2] Error claiming section:', error)
    return false
  }
}

/**
 * Release a section back to queue (assessor stops without deciding)
 */
export async function releaseSection(sectionId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('reference_sections_v2')
      .update({
        queue_status: 'READY',
        assigned_to: null,
        assigned_at: null,
        started_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', sectionId)

    if (error) {
      console.error('[SectionServiceV2] Failed to release section:', error)
      return false
    }

    // Update work item
    await updateWorkItemStatus(sectionId, 'AVAILABLE', null)

    console.log(`[SectionServiceV2] Section ${sectionId} released to queue`)
    return true
  } catch (error) {
    console.error('[SectionServiceV2] Error releasing section:', error)
    return false
  }
}

/**
 * Submit decision for a section
 */
export async function submitSectionDecision(
  input: SubmitSectionDecisionInput
): Promise<boolean> {
  try {
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('reference_sections_v2')
      .update({
        queue_status: 'COMPLETED',
        decision: input.decision,
        condition_text: input.conditionText || null,
        fail_reason: input.failReason || null,
        assessor_notes: input.assessorNotes || null,
        completed_at: now,
        updated_at: now
      })
      .eq('id', input.sectionId)

    if (error) {
      console.error('[SectionServiceV2] Failed to submit decision:', error)
      return false
    }

    // Update work item
    await updateWorkItemStatus(input.sectionId, 'COMPLETED', input.staffUserId)

    // Check if all sections complete for this reference
    const section = await getSection(input.sectionId)
    if (section) {
      await checkAndTriggerFinalReview(section.reference_id)
    }

    console.log(`[SectionServiceV2] Section ${input.sectionId} decision: ${input.decision}`)
    return true
  } catch (error) {
    console.error('[SectionServiceV2] Error submitting decision:', error)
    return false
  }
}

// ============================================================================
// FINAL REVIEW TRIGGER
// ============================================================================

/**
 * Check if all sections are complete and trigger final review
 */
export async function checkAndTriggerFinalReview(referenceId: string): Promise<boolean> {
  try {
    // Get all sections for this reference
    const sections = await getSections(referenceId)
    if (!sections || sections.length === 0) {
      return false
    }

    // Check if all have decisions
    const allComplete = sections.every(s => s.decision !== null)
    if (!allComplete) {
      console.log(`[SectionServiceV2] Reference ${referenceId} not ready for final review yet`)
      return false
    }

    // Check if final review work item already exists
    const { data: existingWorkItem } = await supabase
      .from('work_items_v2')
      .select('id')
      .eq('reference_id', referenceId)
      .eq('work_type', 'FINAL_REVIEW')
      .single()

    if (existingWorkItem) {
      console.log(`[SectionServiceV2] Final review already exists for ${referenceId}`)
      return true
    }

    // Check if this is part of a group (has parent)
    const { data: reference } = await supabase
      .from('tenant_references_v2')
      .select('parent_reference_id, is_group_parent')
      .eq('id', referenceId)
      .single()

    if (reference?.parent_reference_id) {
      // This is a child reference - check if whole group is ready
      const groupReady = await isGroupReadyForFinalReview(reference.parent_reference_id)
      if (!groupReady) {
        console.log(`[SectionServiceV2] Group not ready for final review yet`)
        return false
      }
      // Group final review is created on the parent
      return true
    }

    if (reference?.is_group_parent) {
      // This is a parent - check if all children ready
      const groupReady = await isGroupReadyForFinalReview(referenceId)
      if (!groupReady) {
        return false
      }
    }

    // Create final review work item
    const { error } = await supabase
      .from('work_items_v2')
      .insert({
        reference_id: referenceId,
        section_id: null, // No section for final review
        work_type: 'FINAL_REVIEW',
        status: 'AVAILABLE',
        priority: 10 // Higher priority
      })

    if (error) {
      console.error('[SectionServiceV2] Failed to create final review:', error)
      return false
    }

    console.log(`[SectionServiceV2] Final review created for ${referenceId}`)
    return true
  } catch (error) {
    console.error('[SectionServiceV2] Error checking final review:', error)
    return false
  }
}

/**
 * Check if all members of a group are ready for final review
 */
export async function isGroupReadyForFinalReview(parentReferenceId: string): Promise<boolean> {
  try {
    // Get all children (tenants + guarantors)
    const { data: children, error: childError } = await supabase
      .from('tenant_references_v2')
      .select('id')
      .eq('parent_reference_id', parentReferenceId)

    if (childError || !children || children.length === 0) {
      return false
    }

    // Check each child has all sections complete
    for (const child of children) {
      const sections = await getSections(child.id)
      if (!sections || sections.length === 0) {
        return false
      }
      const allComplete = sections.every(s => s.decision !== null)
      if (!allComplete) {
        return false
      }
    }

    return true
  } catch (error) {
    console.error('[SectionServiceV2] Error checking group readiness:', error)
    return false
  }
}

// ============================================================================
// WORK ITEM HELPERS
// ============================================================================

/**
 * Create a work item for a section
 */
async function createWorkItem(
  referenceId: string,
  sectionId: string,
  sectionType: V2SectionType
): Promise<void> {
  try {
    // Check if work item already exists
    const { data: existing } = await supabase
      .from('work_items_v2')
      .select('id')
      .eq('section_id', sectionId)
      .single()

    if (existing) {
      // Update existing work item to available
      await supabase
        .from('work_items_v2')
        .update({ status: 'AVAILABLE', updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      return
    }

    // Create new work item
    await supabase
      .from('work_items_v2')
      .insert({
        reference_id: referenceId,
        section_id: sectionId,
        work_type: sectionType,
        status: 'AVAILABLE'
      })
  } catch (error) {
    console.error('[SectionServiceV2] Error creating work item:', error)
  }
}

/**
 * Update work item status
 */
async function updateWorkItemStatus(
  sectionId: string,
  status: string,
  assignedTo: string | null
): Promise<void> {
  try {
    const now = new Date().toISOString()
    const updateData: Record<string, unknown> = {
      status,
      updated_at: now
    }

    if (status === 'IN_PROGRESS') {
      updateData.assigned_to = assignedTo
      updateData.assigned_at = now
      updateData.started_at = now
    } else if (status === 'COMPLETED') {
      updateData.completed_at = now
    } else if (status === 'AVAILABLE') {
      updateData.assigned_to = null
      updateData.assigned_at = null
      updateData.started_at = null
    }

    await supabase
      .from('work_items_v2')
      .update(updateData)
      .eq('section_id', sectionId)
  } catch (error) {
    console.error('[SectionServiceV2] Error updating work item:', error)
  }
}

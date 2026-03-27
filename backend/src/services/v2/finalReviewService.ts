/**
 * Final Review Service V2
 *
 * Handles the final review queue and decision making for completed references.
 * Only references where ALL sections have decisions appear in this queue.
 */

import { supabase } from '../../config/supabase'
import { decrypt } from '../encryption'
import { V2ReferenceStatus } from './types'

export interface FinalReviewQueueItem {
  id: string
  tenant_name: string
  property_address: string
  company_name: string
  monthly_rent: number
  rent_share: number
  group_size: number
  is_group_parent: boolean
  queue_entered_at: string
}

export interface FinalReviewDetail {
  reference: {
    id: string
    tenant_name: string
    property_address: string
    property_city: string
    property_postcode: string
    company_name: string
    monthly_rent: number
    rent_share: number
    annual_income: number | null
    affordability_ratio: number | null
    affordability_pass: boolean
    is_guarantor: boolean
    is_group_parent: boolean
    move_in_date: string | null
  }
  sections: Array<{
    id: string
    section_type: string
    decision: string | null
    condition_text: string | null
    fail_reason: string | null
    assessor_notes: string | null
    completed_at: string | null
  }>
  groupMembers: Array<{
    id: string
    tenant_name: string
    rent_share: number
    is_guarantor: boolean
    guarantor_for_name: string | null
    completed_sections: number
    total_sections: number
    all_sections_complete: boolean
  }>
}

/**
 * Get queue items ready for final review
 */
export async function getFinalReviewQueue(): Promise<FinalReviewQueueItem[]> {
  // Get references where all sections are complete (have a decision)
  const { data: references, error } = await supabase
    .from('tenant_references_v2')
    .select(`
      id,
      tenant_first_name_encrypted,
      tenant_last_name_encrypted,
      property_address_encrypted,
      property_city_encrypted,
      company_id,
      monthly_rent,
      rent_share,
      is_group_parent,
      parent_reference_id,
      final_review_queue_entered_at,
      companies!inner (name)
    `)
    .eq('status', 'COLLECTING_EVIDENCE')
    .not('final_review_queue_entered_at', 'is', null)
    .is('final_decision_at', null)
    .order('final_review_queue_entered_at', { ascending: true })

  if (error) {
    console.error('[FinalReview] Error fetching queue:', error)
    throw new Error('Failed to fetch final review queue')
  }

  // Decrypt and format
  const items: FinalReviewQueueItem[] = (references || []).map((ref: any) => ({
    id: ref.id,
    tenant_name: `${decrypt(ref.tenant_first_name_encrypted) || ''} ${decrypt(ref.tenant_last_name_encrypted) || ''}`.trim(),
    property_address: `${decrypt(ref.property_address_encrypted) || ''}, ${decrypt(ref.property_city_encrypted) || ''}`,
    company_name: ref.companies?.name || 'Unknown',
    monthly_rent: ref.monthly_rent,
    rent_share: ref.rent_share || ref.monthly_rent,
    group_size: 1, // Will be updated for group parents
    is_group_parent: ref.is_group_parent || false,
    queue_entered_at: ref.final_review_queue_entered_at
  }))

  // Get group sizes for group parents
  const groupParentIds = items.filter(i => i.is_group_parent).map(i => i.id)
  if (groupParentIds.length > 0) {
    const { data: children } = await supabase
      .from('tenant_references_v2')
      .select('parent_reference_id')
      .in('parent_reference_id', groupParentIds)

    const counts: Record<string, number> = {}
    children?.forEach((c: any) => {
      counts[c.parent_reference_id] = (counts[c.parent_reference_id] || 0) + 1
    })

    items.forEach(item => {
      if (item.is_group_parent) {
        item.group_size = (counts[item.id] || 0) + 1 // +1 for parent
      }
    })
  }

  return items
}

/**
 * Get detailed information for final review
 */
export async function getFinalReviewDetail(referenceId: string): Promise<FinalReviewDetail | null> {
  // Get reference
  const { data: ref, error } = await supabase
    .from('tenant_references_v2')
    .select(`
      *,
      companies (name)
    `)
    .eq('id', referenceId)
    .single()

  if (error || !ref) {
    console.error('[FinalReview] Error fetching reference:', error)
    return null
  }

  // Get sections
  const { data: sections } = await supabase
    .from('reference_sections_v2')
    .select('*')
    .eq('reference_id', referenceId)
    .order('section_type')

  // Get group members if this is a group parent
  let groupMembers: FinalReviewDetail['groupMembers'] = []
  if (ref.is_group_parent) {
    const { data: children } = await supabase
      .from('tenant_references_v2')
      .select(`
        id,
        tenant_first_name_encrypted,
        tenant_last_name_encrypted,
        rent_share,
        is_guarantor,
        guarantor_for_reference_id
      `)
      .eq('parent_reference_id', referenceId)

    if (children) {
      for (const child of children) {
        // Get section completion status
        const { data: childSections } = await supabase
          .from('reference_sections_v2')
          .select('decision')
          .eq('reference_id', child.id)

        const totalSections = (childSections || []).length
        const completedSections = (childSections || []).filter((s: any) => s.decision !== null).length

        // Get guarantor for name if applicable
        let guarantorForName = null
        if (child.is_guarantor && child.guarantor_for_reference_id) {
          const { data: guarantorFor } = await supabase
            .from('tenant_references_v2')
            .select('tenant_first_name_encrypted, tenant_last_name_encrypted')
            .eq('id', child.guarantor_for_reference_id)
            .single()

          if (guarantorFor) {
            guarantorForName = `${decrypt(guarantorFor.tenant_first_name_encrypted) || ''} ${decrypt(guarantorFor.tenant_last_name_encrypted) || ''}`.trim()
          }
        }

        groupMembers.push({
          id: child.id,
          tenant_name: `${decrypt(child.tenant_first_name_encrypted) || ''} ${decrypt(child.tenant_last_name_encrypted) || ''}`.trim(),
          rent_share: child.rent_share,
          is_guarantor: child.is_guarantor || false,
          guarantor_for_name: guarantorForName,
          completed_sections: completedSections,
          total_sections: totalSections,
          all_sections_complete: completedSections === totalSections && totalSections > 0
        })
      }
    }
  }

  return {
    reference: {
      id: ref.id,
      tenant_name: `${decrypt(ref.tenant_first_name_encrypted) || ''} ${decrypt(ref.tenant_last_name_encrypted) || ''}`.trim(),
      property_address: decrypt(ref.property_address_encrypted) || '',
      property_city: decrypt(ref.property_city_encrypted) || '',
      property_postcode: decrypt(ref.property_postcode_encrypted) || '',
      company_name: ref.companies?.name || 'Unknown',
      monthly_rent: ref.monthly_rent,
      rent_share: ref.rent_share || ref.monthly_rent,
      annual_income: ref.annual_income,
      affordability_ratio: ref.affordability_ratio,
      affordability_pass: ref.affordability_pass || false,
      is_guarantor: ref.is_guarantor || false,
      is_group_parent: ref.is_group_parent || false,
      move_in_date: ref.move_in_date
    },
    sections: (sections || []).map((s: any) => ({
      id: s.id,
      section_type: s.section_type,
      decision: s.decision,
      condition_text: s.condition_text,
      fail_reason: s.fail_reason,
      assessor_notes: s.assessor_notes,
      completed_at: s.completed_at
    })),
    groupMembers
  }
}

/**
 * Submit final review decision
 */
export async function submitFinalDecision(
  referenceId: string,
  decision: V2ReferenceStatus,
  options?: {
    conditionText?: string
    notes?: string
    decidedBy?: string
  }
): Promise<boolean> {
  const validDecisions: V2ReferenceStatus[] = [
    'ACCEPTED',
    'ACCEPTED_WITH_GUARANTOR',
    'ACCEPTED_ON_CONDITION',
    'REJECTED'
  ]

  if (!validDecisions.includes(decision)) {
    throw new Error(`Invalid final decision: ${decision}`)
  }

  const updateData: Record<string, any> = {
    status: decision,
    final_decision_at: new Date().toISOString(),
    final_decision_by: options?.decidedBy || null,
    final_decision_notes: options?.notes || null,
    updated_at: new Date().toISOString()
  }

  if (decision === 'ACCEPTED_ON_CONDITION' && options?.conditionText) {
    updateData.condition_text = options.conditionText
  }

  const { error } = await supabase
    .from('tenant_references_v2')
    .update(updateData)
    .eq('id', referenceId)

  if (error) {
    console.error('[FinalReview] Error submitting decision:', error)
    throw new Error('Failed to submit final decision')
  }

  // If this is a group parent, also update all children to the same status
  const { data: ref } = await supabase
    .from('tenant_references_v2')
    .select('is_group_parent')
    .eq('id', referenceId)
    .single()

  if (ref?.is_group_parent) {
    await supabase
      .from('tenant_references_v2')
      .update({
        status: decision,
        final_decision_at: new Date().toISOString(),
        final_decision_notes: options?.notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('parent_reference_id', referenceId)
  }

  return true
}

/**
 * Check if a reference is ready for final review (all sections have decisions)
 */
export async function checkReadyForFinalReview(referenceId: string): Promise<boolean> {
  const { data: sections, error } = await supabase
    .from('reference_sections_v2')
    .select('decision')
    .eq('reference_id', referenceId)

  if (error || !sections || sections.length === 0) {
    return false
  }

  // All sections must have a decision
  return sections.every((s: any) => s.decision !== null)
}

/**
 * Mark reference as ready for final review
 */
export async function markReadyForFinalReview(referenceId: string): Promise<void> {
  const { error } = await supabase
    .from('tenant_references_v2')
    .update({
      final_review_queue_entered_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', referenceId)

  if (error) {
    console.error('[FinalReview] Error marking ready for review:', error)
    throw new Error('Failed to mark ready for final review')
  }
}

/**
 * For group references: check if entire group is ready for final review
 */
export async function checkGroupReadyForFinalReview(parentReferenceId: string): Promise<boolean> {
  // Get all references in group (parent + children)
  const { data: references, error } = await supabase
    .from('tenant_references_v2')
    .select('id')
    .or(`id.eq.${parentReferenceId},parent_reference_id.eq.${parentReferenceId}`)

  if (error || !references) {
    return false
  }

  // Check each reference
  for (const ref of references) {
    const ready = await checkReadyForFinalReview(ref.id)
    if (!ready) return false
  }

  return true
}

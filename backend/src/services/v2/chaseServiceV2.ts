/**
 * V2 Chase Service
 *
 * Manages chase items for external references (employer, landlord, etc.)
 * 24-hour cycle: items move to chase queue after 24hrs without response.
 */

import { supabase } from '../../config/supabase'
import { encrypt, decrypt } from '../encryption'
import {
  V2ChaseItemRow,
  V2ChaseStatus,
  V2RefereeType,
  V2SectionType
} from './types'
import { markSectionReady } from './sectionServiceV2'

// ============================================================================
// CHASE ITEM MANAGEMENT
// ============================================================================

/**
 * Create a chase item when external reference is sent
 */
export async function createChaseItem(
  referenceId: string,
  sectionId: string,
  refereeType: V2RefereeType,
  refereeDetails: {
    name: string
    email: string
    phone?: string
  }
): Promise<V2ChaseItemRow | null> {
  try {
    const { data, error } = await supabase
      .from('chase_items_v2')
      .insert({
        reference_id: referenceId,
        section_id: sectionId,
        referee_type: refereeType,
        referee_name_encrypted: encrypt(refereeDetails.name),
        referee_email_encrypted: encrypt(refereeDetails.email),
        referee_phone_encrypted: refereeDetails.phone ? encrypt(refereeDetails.phone) : null,
        status: 'WAITING',
        initial_sent_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('[ChaseServiceV2] Error creating chase item:', error)
      return null
    }

    console.log(`[ChaseServiceV2] Created chase item for ${refereeType} on section ${sectionId}`)
    return data
  } catch (error) {
    console.error('[ChaseServiceV2] Error:', error)
    return null
  }
}

/**
 * Get chase item by ID
 */
export async function getChaseItem(chaseItemId: string): Promise<V2ChaseItemRow | null> {
  try {
    const { data, error } = await supabase
      .from('chase_items_v2')
      .select('*')
      .eq('id', chaseItemId)
      .single()

    if (error) {
      return null
    }

    return data
  } catch (error) {
    console.error('[ChaseServiceV2] Error:', error)
    return null
  }
}

/**
 * Get chase item for a section
 */
export async function getChaseItemForSection(sectionId: string): Promise<V2ChaseItemRow | null> {
  try {
    const { data, error } = await supabase
      .from('chase_items_v2')
      .select('*')
      .eq('section_id', sectionId)
      .single()

    if (error) {
      return null
    }

    return data
  } catch (error) {
    console.error('[ChaseServiceV2] Error:', error)
    return null
  }
}

/**
 * Get items in chase queue (24hrs passed, no response)
 */
export async function getChaseQueue(limit: number = 50): Promise<V2ChaseItemRow[]> {
  try {
    const { data, error } = await supabase
      .from('chase_items_v2')
      .select(`
        *,
        reference:tenant_references_v2!chase_items_v2_reference_id_fkey (
          id,
          company_id,
          tenant_first_name_encrypted,
          tenant_last_name_encrypted,
          property_address_encrypted
        ),
        section:reference_sections_v2!chase_items_v2_section_id_fkey (
          id,
          section_type
        )
      `)
      .eq('status', 'IN_CHASE_QUEUE')
      .order('chase_queue_entered_at', { ascending: true })
      .limit(limit)

    if (error) {
      console.error('[ChaseServiceV2] Error getting chase queue:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('[ChaseServiceV2] Error:', error)
    return []
  }
}

/**
 * Get chase item with decrypted referee details
 */
export async function getChaseItemDecrypted(chaseItemId: string): Promise<{
  chaseItem: V2ChaseItemRow
  refereeName: string
  refereeEmail: string
  refereePhone: string | null
} | null> {
  const chaseItem = await getChaseItem(chaseItemId)
  if (!chaseItem) return null

  return {
    chaseItem,
    refereeName: decrypt(chaseItem.referee_name_encrypted) || '',
    refereeEmail: decrypt(chaseItem.referee_email_encrypted) || '',
    refereePhone: decrypt(chaseItem.referee_phone_encrypted)
  }
}

// ============================================================================
// CHASE QUEUE PROCESSING (Scheduled Job)
// ============================================================================

/**
 * Process items that should move to chase queue (24hrs passed)
 * This should be called by a scheduled job
 */
export async function processChaseQueue(): Promise<number> {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const now = new Date().toISOString()

    // Find items that have been waiting > 24hrs
    const { data: itemsToChase, error: fetchError } = await supabase
      .from('chase_items_v2')
      .select('id')
      .eq('status', 'WAITING')
      .lt('initial_sent_at', twentyFourHoursAgo)

    if (fetchError || !itemsToChase || itemsToChase.length === 0) {
      return 0
    }

    // Update them to IN_CHASE_QUEUE
    const { error: updateError } = await supabase
      .from('chase_items_v2')
      .update({
        status: 'IN_CHASE_QUEUE',
        chase_queue_entered_at: now,
        updated_at: now
      })
      .in('id', itemsToChase.map(i => i.id))

    if (updateError) {
      console.error('[ChaseServiceV2] Error moving items to chase queue:', updateError)
      return 0
    }

    // Create CHASE work items for each
    for (const item of itemsToChase) {
      const chaseItem = await getChaseItem(item.id)
      if (chaseItem) {
        await supabase
          .from('work_items_v2')
          .insert({
            reference_id: chaseItem.reference_id,
            section_id: chaseItem.section_id,
            work_type: 'CHASE',
            status: 'AVAILABLE'
          })
      }
    }

    console.log(`[ChaseServiceV2] Moved ${itemsToChase.length} items to chase queue`)
    return itemsToChase.length
  } catch (error) {
    console.error('[ChaseServiceV2] Error processing chase queue:', error)
    return 0
  }
}

// ============================================================================
// CHASE ACTIONS
// ============================================================================

/**
 * Record a chase action (email, SMS, call)
 */
export async function recordChaseAction(
  chaseItemId: string,
  actionType: 'EMAIL' | 'SMS' | 'CALL',
  staffUserId: string,
  notes?: string
): Promise<boolean> {
  try {
    const chaseItem = await getChaseItem(chaseItemId)
    if (!chaseItem) return false

    const now = new Date().toISOString()
    const updateData: Partial<V2ChaseItemRow> = {
      last_chased_at: now,
      chase_count: chaseItem.chase_count + 1,
      updated_at: now
    }

    // Increment specific counter
    if (actionType === 'EMAIL') {
      updateData.emails_sent = chaseItem.emails_sent + 1
    } else if (actionType === 'SMS') {
      updateData.sms_sent = chaseItem.sms_sent + 1
    } else if (actionType === 'CALL') {
      updateData.calls_made = chaseItem.calls_made + 1
    }

    const { error } = await supabase
      .from('chase_items_v2')
      .update(updateData)
      .eq('id', chaseItemId)

    if (error) {
      console.error('[ChaseServiceV2] Error recording chase action:', error)
      return false
    }

    console.log(`[ChaseServiceV2] Recorded ${actionType} chase for ${chaseItemId}`)
    return true
  } catch (error) {
    console.error('[ChaseServiceV2] Error:', error)
    return false
  }
}

// ============================================================================
// CHASE RESOLUTION
// ============================================================================

/**
 * Mark chase item as received (referee submitted online)
 */
export async function markChaseReceived(chaseItemId: string): Promise<boolean> {
  try {
    const chaseItem = await getChaseItem(chaseItemId)
    if (!chaseItem) return false

    const now = new Date().toISOString()

    const { error } = await supabase
      .from('chase_items_v2')
      .update({
        status: 'RECEIVED',
        resolution_type: 'ONLINE_SUBMISSION',
        resolved_at: now,
        updated_at: now
      })
      .eq('id', chaseItemId)

    if (error) {
      console.error('[ChaseServiceV2] Error marking received:', error)
      return false
    }

    // Mark section as ready for verification
    await markSectionReady(chaseItem.section_id, true)

    // Complete the work item
    await supabase
      .from('work_items_v2')
      .update({ status: 'COMPLETED', completed_at: now, updated_at: now })
      .eq('section_id', chaseItem.section_id)
      .eq('work_type', 'CHASE')

    console.log(`[ChaseServiceV2] Chase item ${chaseItemId} marked as received`)
    return true
  } catch (error) {
    console.error('[ChaseServiceV2] Error:', error)
    return false
  }
}

/**
 * Mark chase item as verbal obtained
 */
export async function markChaseVerbalObtained(
  chaseItemId: string,
  verbalReferenceId: string
): Promise<boolean> {
  try {
    const chaseItem = await getChaseItem(chaseItemId)
    if (!chaseItem) return false

    const now = new Date().toISOString()

    const { error } = await supabase
      .from('chase_items_v2')
      .update({
        status: 'VERBAL_OBTAINED',
        resolution_type: 'VERBAL',
        verbal_reference_id: verbalReferenceId,
        resolved_at: now,
        updated_at: now
      })
      .eq('id', chaseItemId)

    if (error) {
      console.error('[ChaseServiceV2] Error marking verbal obtained:', error)
      return false
    }

    // Mark section as ready for verification (with verbal badge)
    await markSectionReady(chaseItem.section_id, true)

    // Complete the CHASE work item
    await supabase
      .from('work_items_v2')
      .update({ status: 'COMPLETED', completed_at: now, updated_at: now })
      .eq('section_id', chaseItem.section_id)
      .eq('work_type', 'CHASE')

    console.log(`[ChaseServiceV2] Chase item ${chaseItemId} marked as verbal obtained`)
    return true
  } catch (error) {
    console.error('[ChaseServiceV2] Error:', error)
    return false
  }
}

/**
 * Mark chase item as unable to obtain
 */
export async function markChaseUnable(
  chaseItemId: string,
  reason: string
): Promise<boolean> {
  try {
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('chase_items_v2')
      .update({
        status: 'UNABLE_TO_OBTAIN',
        resolution_type: 'UNABLE',
        unable_reason: reason,
        resolved_at: now,
        updated_at: now
      })
      .eq('id', chaseItemId)

    if (error) {
      console.error('[ChaseServiceV2] Error marking unable:', error)
      return false
    }

    // Complete the work item
    await supabase
      .from('work_items_v2')
      .update({ status: 'COMPLETED', completed_at: now, updated_at: now })
      .eq('id', chaseItemId)

    console.log(`[ChaseServiceV2] Chase item ${chaseItemId} marked as unable to obtain`)
    return true
  } catch (error) {
    console.error('[ChaseServiceV2] Error:', error)
    return false
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Map section type to referee type
 */
export function getSectionRefereeType(sectionType: V2SectionType): V2RefereeType | null {
  switch (sectionType) {
    case 'INCOME':
      return 'EMPLOYER' // Could also be ACCOUNTANT for self-employed
    case 'RESIDENTIAL':
      return 'LANDLORD' // Could also be AGENT
    default:
      return null
  }
}

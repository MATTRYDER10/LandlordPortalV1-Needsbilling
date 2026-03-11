/**
 * V2 Work Queue Service
 *
 * Manages work items for the V2 verification system.
 * Work items represent actionable tasks in queues.
 */

import { supabase } from '../../config/supabase'
import { decrypt } from '../encryption'
import {
  V2WorkItemRow,
  V2WorkItemStatus,
  V2WorkType
} from './types'

// ============================================================================
// WORK ITEM QUERIES
// ============================================================================

/**
 * Get work items by type and status
 */
export async function getWorkItems(
  workType?: V2WorkType,
  status?: V2WorkItemStatus,
  limit: number = 50
): Promise<V2WorkItemRow[]> {
  try {
    let query = supabase
      .from('work_items_v2')
      .select(`
        *,
        reference:tenant_references_v2!work_items_v2_reference_id_fkey (
          id,
          company_id,
          tenant_first_name_encrypted,
          tenant_last_name_encrypted,
          property_address_encrypted,
          monthly_rent,
          rent_share,
          is_guarantor
        ),
        section:reference_sections_v2!work_items_v2_section_id_fkey (
          id,
          section_type,
          queue_status,
          decision
        ),
        assigned_staff:staff_users!work_items_v2_assigned_to_fkey (
          id,
          full_name
        )
      `)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit)

    if (workType) {
      query = query.eq('work_type', workType)
    }

    if (status) {
      query = query.eq('status', status)
    } else {
      // Default: show available items
      query = query.eq('status', 'AVAILABLE')
    }

    const { data, error } = await query

    if (error) {
      console.error('[WorkQueueServiceV2] Error getting work items:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('[WorkQueueServiceV2] Error:', error)
    return []
  }
}

/**
 * Get work item by ID
 */
export async function getWorkItem(workItemId: string): Promise<V2WorkItemRow | null> {
  try {
    const { data, error } = await supabase
      .from('work_items_v2')
      .select('*')
      .eq('id', workItemId)
      .single()

    if (error) {
      return null
    }

    return data
  } catch (error) {
    console.error('[WorkQueueServiceV2] Error:', error)
    return null
  }
}

/**
 * Get final review work items
 */
export async function getFinalReviewItems(limit: number = 50): Promise<V2WorkItemRow[]> {
  try {
    const { data, error } = await supabase
      .from('work_items_v2')
      .select(`
        *,
        reference:tenant_references_v2!work_items_v2_reference_id_fkey (
          id,
          company_id,
          is_group_parent,
          parent_reference_id,
          tenant_first_name_encrypted,
          tenant_last_name_encrypted,
          property_address_encrypted,
          property_city_encrypted,
          monthly_rent,
          rent_share,
          annual_income,
          affordability_ratio,
          affordability_pass
        )
      `)
      .eq('work_type', 'FINAL_REVIEW')
      .eq('status', 'AVAILABLE')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) {
      console.error('[WorkQueueServiceV2] Error getting final review items:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('[WorkQueueServiceV2] Error:', error)
    return []
  }
}

/**
 * Get my assigned work items
 */
export async function getMyWorkItems(staffUserId: string): Promise<V2WorkItemRow[]> {
  try {
    const { data, error } = await supabase
      .from('work_items_v2')
      .select(`
        *,
        reference:tenant_references_v2!work_items_v2_reference_id_fkey (
          id,
          tenant_first_name_encrypted,
          tenant_last_name_encrypted,
          property_address_encrypted
        ),
        section:reference_sections_v2!work_items_v2_section_id_fkey (
          id,
          section_type
        )
      `)
      .eq('assigned_to', staffUserId)
      .in('status', ['ASSIGNED', 'IN_PROGRESS'])
      .order('started_at', { ascending: true })

    if (error) {
      console.error('[WorkQueueServiceV2] Error getting my work items:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('[WorkQueueServiceV2] Error:', error)
    return []
  }
}

// ============================================================================
// WORK ITEM OPERATIONS
// ============================================================================

/**
 * Claim a work item
 */
export async function claimWorkItem(
  workItemId: string,
  staffUserId: string
): Promise<boolean> {
  try {
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('work_items_v2')
      .update({
        status: 'IN_PROGRESS',
        assigned_to: staffUserId,
        assigned_at: now,
        started_at: now,
        updated_at: now
      })
      .eq('id', workItemId)
      .eq('status', 'AVAILABLE') // Only claim if still available

    if (error) {
      console.error('[WorkQueueServiceV2] Error claiming work item:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('[WorkQueueServiceV2] Error:', error)
    return false
  }
}

/**
 * Release a work item back to queue
 */
export async function releaseWorkItem(workItemId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('work_items_v2')
      .update({
        status: 'AVAILABLE',
        assigned_to: null,
        assigned_at: null,
        started_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', workItemId)

    if (error) {
      console.error('[WorkQueueServiceV2] Error releasing work item:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('[WorkQueueServiceV2] Error:', error)
    return false
  }
}

/**
 * Complete a work item
 */
export async function completeWorkItem(workItemId: string): Promise<boolean> {
  try {
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('work_items_v2')
      .update({
        status: 'COMPLETED',
        completed_at: now,
        updated_at: now
      })
      .eq('id', workItemId)

    if (error) {
      console.error('[WorkQueueServiceV2] Error completing work item:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('[WorkQueueServiceV2] Error:', error)
    return false
  }
}

/**
 * Create a work item
 */
export async function createWorkItem(
  referenceId: string,
  workType: V2WorkType,
  sectionId?: string,
  priority: number = 0
): Promise<V2WorkItemRow | null> {
  try {
    // Check if work item already exists for this section/type
    if (sectionId) {
      const { data: existing } = await supabase
        .from('work_items_v2')
        .select('id')
        .eq('section_id', sectionId)
        .eq('work_type', workType)
        .single()

      if (existing) {
        // Reactivate if completed
        await supabase
          .from('work_items_v2')
          .update({ status: 'AVAILABLE', updated_at: new Date().toISOString() })
          .eq('id', existing.id)
        return null
      }
    }

    const { data, error } = await supabase
      .from('work_items_v2')
      .insert({
        reference_id: referenceId,
        section_id: sectionId || null,
        work_type: workType,
        status: 'AVAILABLE',
        priority
      })
      .select()
      .single()

    if (error) {
      console.error('[WorkQueueServiceV2] Error creating work item:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('[WorkQueueServiceV2] Error:', error)
    return null
  }
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get work queue statistics
 */
export async function getQueueStats(): Promise<{
  available: number
  inProgress: number
  completedToday: number
}> {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [available, inProgress, completedToday] = await Promise.all([
      supabase
        .from('work_items_v2')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'AVAILABLE'),
      supabase
        .from('work_items_v2')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'IN_PROGRESS'),
      supabase
        .from('work_items_v2')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'COMPLETED')
        .gte('completed_at', today.toISOString())
    ])

    return {
      available: available.count || 0,
      inProgress: inProgress.count || 0,
      completedToday: completedToday.count || 0
    }
  } catch (error) {
    console.error('[WorkQueueServiceV2] Error getting stats:', error)
    return { available: 0, inProgress: 0, completedToday: 0 }
  }
}

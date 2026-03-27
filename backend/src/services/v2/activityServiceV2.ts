/**
 * V2 Activity Log Service
 *
 * Logs all actions on references for audit trail and compliance.
 */

import { supabase } from '../../config/supabase'

interface LogActivityInput {
  referenceId: string
  sectionId?: string
  action: string
  fieldName?: string
  oldValue?: string
  newValue?: string
  performedBy: string
  performedByType: string
  notes?: string
}

/**
 * Log an activity event for a reference
 */
export async function logActivity(input: LogActivityInput): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('reference_activity_v2')
      .insert({
        reference_id: input.referenceId,
        section_id: input.sectionId || null,
        action: input.action,
        field_name: input.fieldName || null,
        old_value: input.oldValue || null,
        new_value: input.newValue || null,
        performed_by: input.performedBy,
        performed_by_type: input.performedByType,
        notes: input.notes || null
      })

    if (error) {
      console.error('[ActivityServiceV2] Error logging activity:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('[ActivityServiceV2] Error:', error)
    return false
  }
}

/**
 * Get all activity for a reference, newest first
 */
export async function getActivityForReference(referenceId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('reference_activity_v2')
      .select('*')
      .eq('reference_id', referenceId)
      .order('performed_at', { ascending: false })

    if (error) {
      console.error('[ActivityServiceV2] Error getting activity:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('[ActivityServiceV2] Error:', error)
    return []
  }
}

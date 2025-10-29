import { supabase } from '../config/supabase'

interface AuditLogParams {
  referenceId: string
  action: string
  description: string
  metadata?: Record<string, any>
  userId?: string
}

export async function logAuditAction({
  referenceId,
  action,
  description,
  metadata = {},
  userId
}: AuditLogParams): Promise<void> {
  try {
    await supabase
      .from('reference_audit_log')
      .insert({
        reference_id: referenceId,
        action,
        description,
        metadata,
        created_by: userId || null
      })
  } catch (error) {
    console.error('Failed to log audit action:', error)
    // Don't throw - audit logging shouldn't break the main flow
  }
}

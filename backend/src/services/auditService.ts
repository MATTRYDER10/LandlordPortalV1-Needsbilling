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
    // Validate userId is a valid UUID or null (e.g., 'SYSTEM' is not a valid UUID)
    const isValidUuid = userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)

    const { error } = await supabase
      .from('reference_audit_log')
      .insert({
        reference_id: referenceId,
        action,
        description,
        metadata,
        created_by: isValidUuid ? userId : null
      })

    if (error) {
      console.error('Failed to log audit action:', error.message)
    }
  } catch (error) {
    console.error('Failed to log audit action:', error)
    // Don't throw - audit logging shouldn't break the main flow
  }
}

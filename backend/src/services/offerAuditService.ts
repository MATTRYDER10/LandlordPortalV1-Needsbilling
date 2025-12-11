import { supabase } from '../config/supabase'

interface OfferAuditLogParams {
  offerId: string
  action: string
  description: string
  metadata?: Record<string, any>
  userId?: string
}

export async function logOfferAuditAction({
  offerId,
  action,
  description,
  metadata = {},
  userId
}: OfferAuditLogParams): Promise<void> {
  try {
    await supabase
      .from('offer_audit_log')
      .insert({
        offer_id: offerId,
        action,
        description,
        metadata,
        created_by: userId || null
      })
  } catch (error) {
    console.error('Failed to log offer audit action:', error)
    // Don't throw - audit logging shouldn't break the main flow
  }
}

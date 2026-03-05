import { supabase } from '../config/supabase'
import { logAuditAction } from './auditService'
import { logPropertyAuditAction, PropertyAuditAction } from './propertyAuditService'

/**
 * Unified Audit Service
 *
 * Provides a single entry point for logging audit events that may span
 * multiple entities (properties, tenancies, references, agreements).
 *
 * Logs to:
 * - audit_logs (general system audit log)
 * - property_audit_log (if propertyId provided)
 * - tenancy_audit_log (if tenancyId provided) - future
 */

// ============================================================================
// INTERFACES
// ============================================================================

export interface UnifiedAuditEvent {
  companyId: string
  userId?: string

  // Action info
  action: string
  description: string
  metadata?: Record<string, any>

  // Entity links - log to relevant audit tables based on what's provided
  propertyId?: string
  tenancyId?: string
  referenceId?: string
  agreementId?: string
  offerId?: string
  landlordId?: string

  // Options
  visibleToAgent?: boolean
}

// Standard events that should log to multiple places
export type StandardAuditEvent =
  | 'OFFER_SENT'
  | 'OFFER_ACCEPTED'
  | 'OFFER_DECLINED'
  | 'REFERENCE_CREATED'
  | 'REFERENCE_SUBMITTED'
  | 'REFERENCE_COMPLETED'
  | 'REFERENCE_REJECTED'
  | 'TENANCY_CREATED'
  | 'TENANCY_CONVERTED'
  | 'TENANCY_UPDATED'
  | 'TENANCY_ENDED'
  | 'TENANCY_CANCELLED'
  | 'TENANCY_NOTICE_GIVEN'
  | 'AGREEMENT_GENERATED'
  | 'AGREEMENT_SENT'
  | 'AGREEMENT_SIGNED'
  | 'AGREEMENT_EXECUTED'
  | 'MONIES_REQUESTED'
  | 'MONIES_CONFIRMED'
  | 'COMPLIANCE_PACK_SENT'
  | 'NOTICE_GENERATED'
  | 'NOTICE_SERVED'
  | 'TENANT_CHANGED'
  | 'RENT_REVIEW_INITIATED'
  | 'RENT_CHANGED'

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Log an audit event to all relevant audit tables
 *
 * This function logs to multiple tables based on the entity IDs provided:
 * - Always logs to audit_logs (general)
 * - Logs to property_audit_log if propertyId is provided
 * - Logs to tenancy_audit_log if tenancyId is provided (when table exists)
 *
 * All logging is non-blocking and won't throw errors.
 */
export async function logUnifiedAuditEvent(event: UnifiedAuditEvent): Promise<void> {
  const {
    companyId,
    userId,
    action,
    description,
    metadata = {},
    propertyId,
    tenancyId,
    referenceId,
    agreementId,
    offerId,
    landlordId,
    visibleToAgent = false
  } = event

  // Build enriched metadata with all entity links
  const enrichedMetadata = {
    ...metadata,
    ...(propertyId && { property_id: propertyId }),
    ...(tenancyId && { tenancy_id: tenancyId }),
    ...(referenceId && { reference_id: referenceId }),
    ...(agreementId && { agreement_id: agreementId }),
    ...(offerId && { offer_id: offerId }),
    ...(landlordId && { landlord_id: landlordId }),
    visible_to_agent: visibleToAgent
  }

  // Log to all relevant tables in parallel
  const logPromises: Promise<void>[] = []

  // 1. Always log to general audit_logs (if referenceId provided, use existing auditService)
  if (referenceId) {
    logPromises.push(
      logAuditAction({
        referenceId,
        action,
        description,
        metadata: enrichedMetadata,
        userId
      }).catch(err => {
        console.error('[UnifiedAudit] Failed to log to audit_logs:', err)
      })
    )
  }

  // 2. Log to property_audit_log if propertyId provided
  if (propertyId) {
    // Map action to PropertyAuditAction if possible
    const propertyAction = mapToPropertyAction(action)

    logPromises.push(
      logPropertyAuditAction({
        propertyId,
        companyId,
        action: propertyAction,
        description,
        metadata: enrichedMetadata,
        userId
      }).catch(err => {
        console.error('[UnifiedAudit] Failed to log to property_audit_log:', err)
      })
    )
  }

  // 3. Log to tenancy_audit_log if tenancyId provided
  if (tenancyId) {
    logPromises.push(
      logToTenancyAudit({
        tenancyId,
        companyId,
        action,
        description,
        metadata: enrichedMetadata,
        userId
      }).catch(err => {
        console.error('[UnifiedAudit] Failed to log to tenancy_audit_log:', err)
      })
    )
  }

  // Wait for all logs to complete (but don't throw on failure)
  await Promise.allSettled(logPromises)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Map a general action to a PropertyAuditAction
 */
function mapToPropertyAction(action: string): PropertyAuditAction {
  const actionMap: Record<string, PropertyAuditAction> = {
    'OFFER_SENT': 'OFFER_SENT',
    'OFFER_ACCEPTED': 'OFFER_COMPLETED',
    'OFFER_COMPLETED': 'OFFER_COMPLETED',
    'REFERENCE_CREATED': 'REFERENCE_STARTED',
    'REFERENCE_SUBMITTED': 'REFERENCE_STARTED',
    'REFERENCE_COMPLETED': 'REFERENCE_COMPLETED',
    'TENANCY_CREATED': 'TENANCY_LINKED',
    'TENANCY_CONVERTED': 'TENANCY_LINKED',
    'TENANCY_ENDED': 'TENANCY_UNLINKED',
    'TENANCY_CANCELLED': 'TENANCY_UNLINKED',
    'TENANCY_NOTICE_GIVEN': 'UPDATED',
    'AGREEMENT_SENT': 'AGREEMENT_SENT'
  }

  return actionMap[action] || 'UPDATED'
}

/**
 * Log to tenancy_audit_log table
 * Note: Table may not exist yet - this will gracefully fail
 */
async function logToTenancyAudit(params: {
  tenancyId: string
  companyId: string
  action: string
  description: string
  metadata?: Record<string, any>
  userId?: string
}): Promise<void> {
  try {
    // Validate UUID format for userId
    const isValidUuid = params.userId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.userId)

    const { error } = await supabase
      .from('tenancy_audit_log')
      .insert({
        tenancy_id: params.tenancyId,
        company_id: params.companyId,
        action: params.action,
        description: params.description,
        metadata: params.metadata || {},
        created_by: isValidUuid ? params.userId : null
      })

    if (error) {
      // Table might not exist yet - this is expected during Phase 0
      if (error.code === '42P01') {
        // Relation does not exist - table not created yet
        console.log('[UnifiedAudit] tenancy_audit_log table not yet created, skipping')
      } else {
        console.error('[UnifiedAudit] Failed to log to tenancy_audit_log:', error.message)
      }
    }
  } catch (error: any) {
    console.error('[UnifiedAudit] Failed to log to tenancy_audit_log:', error.message)
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Log an offer-related event
 */
export async function logOfferEvent(
  event: 'SENT' | 'ACCEPTED' | 'DECLINED',
  data: {
    companyId: string
    offerId: string
    propertyId?: string
    tenantName?: string
    userId?: string
    metadata?: Record<string, any>
  }
): Promise<void> {
  const descriptions: Record<string, string> = {
    'SENT': `Offer sent to ${data.tenantName || 'tenant'}`,
    'ACCEPTED': `Offer accepted by ${data.tenantName || 'tenant'}`,
    'DECLINED': `Offer declined by ${data.tenantName || 'tenant'}`
  }

  await logUnifiedAuditEvent({
    companyId: data.companyId,
    userId: data.userId,
    action: `OFFER_${event}`,
    description: descriptions[event],
    metadata: data.metadata,
    offerId: data.offerId,
    propertyId: data.propertyId,
    visibleToAgent: true
  })
}

/**
 * Log a reference-related event
 */
export async function logReferenceEvent(
  event: 'CREATED' | 'SUBMITTED' | 'COMPLETED' | 'REJECTED',
  data: {
    companyId: string
    referenceId: string
    propertyId?: string
    tenancyId?: string
    tenantName?: string
    userId?: string
    metadata?: Record<string, any>
  }
): Promise<void> {
  const descriptions: Record<string, string> = {
    'CREATED': `Reference request created for ${data.tenantName || 'tenant'}`,
    'SUBMITTED': `Reference submitted by ${data.tenantName || 'tenant'}`,
    'COMPLETED': `Reference completed for ${data.tenantName || 'tenant'}`,
    'REJECTED': `Reference rejected for ${data.tenantName || 'tenant'}`
  }

  await logUnifiedAuditEvent({
    companyId: data.companyId,
    userId: data.userId,
    action: `REFERENCE_${event}`,
    description: descriptions[event],
    metadata: data.metadata,
    referenceId: data.referenceId,
    propertyId: data.propertyId,
    tenancyId: data.tenancyId,
    visibleToAgent: true
  })
}

/**
 * Log a tenancy-related event
 */
export async function logTenancyEvent(
  event: 'CREATED' | 'CONVERTED' | 'UPDATED' | 'ENDED' | 'CANCELLED' | 'NOTICE_GIVEN',
  data: {
    companyId: string
    tenancyId: string
    propertyId: string
    tenantNames?: string[]
    userId?: string
    metadata?: Record<string, any>
  }
): Promise<void> {
  const tenants = data.tenantNames?.join(', ') || 'tenants'
  const descriptions: Record<string, string> = {
    'CREATED': `Tenancy created for ${tenants}`,
    'CONVERTED': `Reference converted to tenancy for ${tenants}`,
    'UPDATED': `Tenancy updated`,
    'ENDED': `Tenancy ended for ${tenants}`,
    'CANCELLED': `Tenancy cancelled`,
    'NOTICE_GIVEN': `Notice given for tenancy - ending on ${data.metadata?.end_date || 'TBC'}`
  }

  await logUnifiedAuditEvent({
    companyId: data.companyId,
    userId: data.userId,
    action: `TENANCY_${event}`,
    description: descriptions[event],
    metadata: data.metadata,
    tenancyId: data.tenancyId,
    propertyId: data.propertyId,
    visibleToAgent: true
  })
}

/**
 * Log an agreement-related event
 */
export async function logAgreementEvent(
  event: 'GENERATED' | 'SENT' | 'SIGNED' | 'EXECUTED',
  data: {
    companyId: string
    agreementId: string
    tenancyId?: string
    propertyId?: string
    signedBy?: string
    userId?: string
    metadata?: Record<string, any>
  }
): Promise<void> {
  const descriptions: Record<string, string> = {
    'GENERATED': 'Tenancy agreement generated',
    'SENT': 'Tenancy agreement sent for signing',
    'SIGNED': `Agreement signed by ${data.signedBy || 'party'}`,
    'EXECUTED': 'Tenancy agreement executed - all parties signed'
  }

  await logUnifiedAuditEvent({
    companyId: data.companyId,
    userId: data.userId,
    action: `AGREEMENT_${event}`,
    description: descriptions[event],
    metadata: data.metadata,
    agreementId: data.agreementId,
    tenancyId: data.tenancyId,
    propertyId: data.propertyId,
    visibleToAgent: true
  })
}

/**
 * Log a compliance pack event
 */
export async function logCompliancePackEvent(
  data: {
    companyId: string
    tenancyId: string
    propertyId: string
    recipients?: string[]
    userId?: string
    metadata?: Record<string, any>
  }
): Promise<void> {
  await logUnifiedAuditEvent({
    companyId: data.companyId,
    userId: data.userId,
    action: 'COMPLIANCE_PACK_SENT',
    description: `Compliance pack sent to ${data.recipients?.join(', ') || 'all parties'}`,
    metadata: {
      ...data.metadata,
      recipients: data.recipients
    },
    tenancyId: data.tenancyId,
    propertyId: data.propertyId,
    visibleToAgent: true
  })
}

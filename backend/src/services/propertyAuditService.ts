import { supabase } from '../config/supabase'

/**
 * Property audit action types
 */
export type PropertyAuditAction =
  | 'CREATED'
  | 'UPDATED'
  | 'DELETED'
  | 'STATUS_CHANGED'
  | 'LANDLORD_LINKED'
  | 'LANDLORD_UNLINKED'
  | 'OWNERSHIP_UPDATED'
  | 'COMPLIANCE_ADDED'
  | 'COMPLIANCE_UPDATED'
  | 'COMPLIANCE_DELETED'
  | 'COMPLIANCE_OVERRIDE'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_REMOVED'
  | 'TENANCY_LINKED'
  | 'TENANCY_UNLINKED'
  | 'REMINDER_SENT'
  | 'CSV_IMPORTED'
  | 'OFFER_SENT'
  | 'OFFER_COMPLETED'
  | 'REFERENCE_STARTED'
  | 'REFERENCE_COMPLETED'
  | 'AGREEMENT_SENT'

export interface PropertyAuditParams {
  propertyId: string
  companyId: string
  action: PropertyAuditAction
  description: string
  metadata?: Record<string, any>
  userId?: string | null
}

/**
 * Log an audit action for a property
 *
 * This function is designed to be non-blocking and will not throw errors
 * to prevent audit logging from breaking the main flow.
 */
export async function logPropertyAuditAction(params: PropertyAuditParams): Promise<void> {
  try {
    // Validate UUID format for userId
    const isValidUuid = params.userId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.userId)

    const { error } = await supabase
      .from('property_audit_log')
      .insert({
        property_id: params.propertyId,
        company_id: params.companyId,
        action: params.action,
        description: params.description,
        metadata: params.metadata || {},
        created_by: isValidUuid ? params.userId : null
      })

    if (error) {
      console.error('[PropertyAudit] Failed to log action:', error.message)
    }
  } catch (error: any) {
    console.error('[PropertyAudit] Failed to log action:', error.message)
    // Don't throw - audit logging shouldn't break main flow
  }
}

/**
 * Get audit log entries for a property
 */
export async function getPropertyAuditLog(
  propertyId: string,
  companyId: string,
  options?: {
    limit?: number
    offset?: number
    action?: PropertyAuditAction
  }
): Promise<{
  logs: Array<{
    id: string
    action: string
    description: string
    metadata: Record<string, any>
    created_by: string | null
    created_at: string
  }>
  total: number
}> {
  const limit = options?.limit || 50
  const offset = options?.offset || 0

  let query = supabase
    .from('property_audit_log')
    .select('*', { count: 'exact' })
    .eq('property_id', propertyId)
    .eq('company_id', companyId)

  if (options?.action) {
    query = query.eq('action', options.action)
  }

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('[PropertyAudit] Failed to get audit log:', error.message)
    throw new Error(`Failed to get property audit log: ${error.message}`)
  }

  return {
    logs: data || [],
    total: count || 0
  }
}

/**
 * Helper to log property creation
 */
export async function auditPropertyCreated(
  propertyId: string,
  companyId: string,
  userId: string,
  address: string
): Promise<void> {
  await logPropertyAuditAction({
    propertyId,
    companyId,
    action: 'CREATED',
    description: `Property created at ${address}`,
    metadata: { address },
    userId
  })
}

/**
 * Helper to log property update
 */
export async function auditPropertyUpdated(
  propertyId: string,
  companyId: string,
  userId: string,
  changedFields: string[]
): Promise<void> {
  await logPropertyAuditAction({
    propertyId,
    companyId,
    action: 'UPDATED',
    description: `Property updated: ${changedFields.join(', ')}`,
    metadata: { changed_fields: changedFields },
    userId
  })
}

/**
 * Helper to log property deletion
 */
export async function auditPropertyDeleted(
  propertyId: string,
  companyId: string,
  userId: string
): Promise<void> {
  await logPropertyAuditAction({
    propertyId,
    companyId,
    action: 'DELETED',
    description: 'Property deleted',
    userId
  })
}

/**
 * Helper to log landlord linking
 */
export async function auditLandlordLinked(
  propertyId: string,
  companyId: string,
  userId: string,
  landlordName: string,
  ownershipPercentage: number
): Promise<void> {
  await logPropertyAuditAction({
    propertyId,
    companyId,
    action: 'LANDLORD_LINKED',
    description: `Landlord ${landlordName} linked with ${ownershipPercentage}% ownership`,
    metadata: { landlord_name: landlordName, ownership_percentage: ownershipPercentage },
    userId
  })
}

/**
 * Helper to log compliance record added
 */
export async function auditComplianceAdded(
  propertyId: string,
  companyId: string,
  userId: string,
  complianceType: string,
  expiryDate: string
): Promise<void> {
  await logPropertyAuditAction({
    propertyId,
    companyId,
    action: 'COMPLIANCE_ADDED',
    description: `${formatComplianceType(complianceType)} certificate added, expires ${expiryDate}`,
    metadata: { compliance_type: complianceType, expiry_date: expiryDate },
    userId
  })
}

/**
 * Helper to log compliance override during agreement creation
 */
export async function auditComplianceOverride(
  propertyId: string,
  companyId: string,
  userId: string,
  complianceType: string,
  reason: string,
  agreementId?: string,
  tenancyId?: string
): Promise<void> {
  await logPropertyAuditAction({
    propertyId,
    companyId,
    action: 'COMPLIANCE_OVERRIDE',
    description: `Expired ${formatComplianceType(complianceType)} compliance overridden: ${reason}`,
    metadata: {
      compliance_type: complianceType,
      reason,
      agreement_id: agreementId,
      tenancy_id: tenancyId
    },
    userId
  })
}

/**
 * Helper to log document upload
 */
export async function auditDocumentUploaded(
  propertyId: string,
  companyId: string,
  userId: string,
  fileName: string,
  tag: string
): Promise<void> {
  await logPropertyAuditAction({
    propertyId,
    companyId,
    action: 'DOCUMENT_UPLOADED',
    description: `Document uploaded: ${fileName} (${tag})`,
    metadata: { file_name: fileName, tag },
    userId
  })
}

/**
 * Helper to log CSV import
 */
export async function auditCSVImport(
  propertyId: string,
  companyId: string,
  userId: string,
  importedCount: number,
  skippedCount: number
): Promise<void> {
  await logPropertyAuditAction({
    propertyId,
    companyId,
    action: 'CSV_IMPORTED',
    description: `Property imported via CSV (${importedCount} imported, ${skippedCount} skipped)`,
    metadata: { imported_count: importedCount, skipped_count: skippedCount },
    userId
  })
}

/**
 * Format compliance type for display
 */
function formatComplianceType(type: string): string {
  const types: Record<string, string> = {
    gas_safety: 'Gas Safety',
    eicr: 'EICR',
    epc: 'EPC',
    council_licence: 'Council Licence',
    pat_test: 'PAT Test',
    legionella: 'Legionella',
    fire_safety: 'Fire Safety',
    hmo_licence: 'HMO Licence',
    other: 'Other'
  }
  return types[type] || type
}

/**
 * Helper to log offer sent
 */
export async function auditOfferSent(
  propertyId: string,
  companyId: string,
  userId: string,
  tenantName: string,
  offerId?: string
): Promise<void> {
  await logPropertyAuditAction({
    propertyId,
    companyId,
    action: 'OFFER_SENT',
    description: `Offer form sent to ${tenantName}`,
    metadata: { tenant_name: tenantName, offer_id: offerId },
    userId
  })
}

/**
 * Helper to log offer completed
 */
export async function auditOfferCompleted(
  propertyId: string,
  companyId: string,
  tenantName: string,
  offerId: string
): Promise<void> {
  await logPropertyAuditAction({
    propertyId,
    companyId,
    action: 'OFFER_COMPLETED',
    description: `Offer form completed by ${tenantName}`,
    metadata: { tenant_name: tenantName, offer_id: offerId },
    userId: null
  })
}

/**
 * Helper to log reference started
 */
export async function auditReferenceStarted(
  propertyId: string,
  companyId: string,
  userId: string,
  tenantName: string,
  referenceId: string
): Promise<void> {
  await logPropertyAuditAction({
    propertyId,
    companyId,
    action: 'REFERENCE_STARTED',
    description: `Reference started for ${tenantName}`,
    metadata: { tenant_name: tenantName, reference_id: referenceId },
    userId
  })
}

/**
 * Helper to log reference completed
 */
export async function auditReferenceCompleted(
  propertyId: string,
  companyId: string,
  tenantName: string,
  referenceId: string
): Promise<void> {
  await logPropertyAuditAction({
    propertyId,
    companyId,
    action: 'REFERENCE_COMPLETED',
    description: `Reference completed for ${tenantName}`,
    metadata: { tenant_name: tenantName, reference_id: referenceId },
    userId: null
  })
}

/**
 * Helper to log agreement sent
 */
export async function auditAgreementSent(
  propertyId: string,
  companyId: string,
  userId: string,
  tenantName: string,
  agreementId?: string
): Promise<void> {
  await logPropertyAuditAction({
    propertyId,
    companyId,
    action: 'AGREEMENT_SENT',
    description: `Agreement sent to ${tenantName}`,
    metadata: { tenant_name: tenantName, agreement_id: agreementId },
    userId
  })
}

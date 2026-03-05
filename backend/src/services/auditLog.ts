import { Request } from 'express'
import { supabase } from '../config/supabase'

export type AuditAction =
  // User actions
  | 'user.invited'
  | 'user.invitation_resent'
  | 'user.invitation_revoked'
  | 'user.joined'
  | 'user.removed'
  | 'user.added_to_branch'
  | 'user.role_changed'
  | 'user.profile_updated'
  | 'user.password_changed'
  // Company actions
  | 'company.updated'
  | 'company.branding_updated'
  | 'company.logo_uploaded'
  | 'company.onboarding_completed'
  // Reference actions
  | 'reference.created'
  | 'reference.updated'
  | 'reference.deleted'
  | 'reference.sent'
  | 'reference.viewed'
  | 'reference.completed'
  // Staff actions
  | 'staff.added'
  | 'staff.updated'
  | 'staff.removed'
  // Verification actions
  | 'verification.creditsafe_completed'
  | 'verification.creditsafe_failed'
  | 'verification.sanctions_screening_completed'
  | 'verification.sanctions_screening_failed'
  | 'verification.sanctions_alert_sent'

export type ResourceType =
  | 'user'
  | 'company'
  | 'invitation'
  | 'reference'
  | 'staff'
  | 'profile'

export interface AuditLogEntry {
  companyId: string
  userId?: string | null // Can be null if system action or user deleted
  actionType: AuditAction
  resourceType: ResourceType
  resourceId?: string | null
  description: string
  metadata?: Record<string, any>
}

/**
 * Extract client IP address from Express request
 * Handles proxies and load balancers
 */
function getClientIp(req: Request): string | null {
  // Check common headers set by proxies/load balancers
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')
    return ips[0].trim()
  }

  const realIp = req.headers['x-real-ip']
  if (realIp) {
    return typeof realIp === 'string' ? realIp : realIp[0]
  }

  // Fallback to direct connection IP
  return req.ip || req.socket.remoteAddress || null
}

/**
 * Extract user agent from Express request
 */
function getUserAgent(req: Request): string | null {
  const userAgent = req.headers['user-agent']
  return userAgent || null
}

/**
 * Create an audit log entry
 *
 * @param entry - The audit log entry details
 * @param req - The Express request object (for IP and user agent)
 * @returns Promise with the created audit log record
 */
export async function createAuditLog(
  entry: AuditLogEntry,
  req?: Request
): Promise<{ success: boolean; error?: string }> {
  try {
    const ipAddress = req ? getClientIp(req) : null
    const userAgent = req ? getUserAgent(req) : null

    const { error } = await supabase
      .from('audit_logs')
      .insert({
        company_id: entry.companyId,
        user_id: entry.userId || null,
        action_type: entry.actionType,
        resource_type: entry.resourceType,
        resource_id: entry.resourceId || null,
        description: entry.description,
        metadata: entry.metadata || null,
        ip_address: ipAddress,
        user_agent: userAgent
      })

    if (error) {
      console.error('Failed to create audit log:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Failed to create audit log:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Helper function to format user names for audit logs
 */
export function formatUserName(user: any): string {
  if (!user) return 'Unknown user'

  const fullName = user.user_metadata?.full_name || user.raw_user_meta_data?.full_name
  if (fullName) return fullName

  const email = user.email
  if (email) return email.split('@')[0]

  return 'Unknown user'
}

/**
 * Helper function to create audit log for user actions
 */
export async function auditUserAction(
  companyId: string,
  actorUserId: string,
  targetUserId: string,
  actionType: AuditAction,
  description: string,
  req?: Request,
  metadata?: Record<string, any>
): Promise<void> {
  await createAuditLog(
    {
      companyId,
      userId: actorUserId,
      actionType,
      resourceType: 'user',
      resourceId: targetUserId,
      description,
      metadata
    },
    req
  )
}

/**
 * Helper function to create audit log for company actions
 */
export async function auditCompanyAction(
  companyId: string,
  userId: string,
  actionType: AuditAction,
  description: string,
  req?: Request,
  metadata?: Record<string, any>
): Promise<void> {
  await createAuditLog(
    {
      companyId,
      userId,
      actionType,
      resourceType: 'company',
      resourceId: companyId,
      description,
      metadata
    },
    req
  )
}

/**
 * Helper function to create audit log for reference actions
 */
export async function auditReferenceAction(
  companyId: string,
  userId: string,
  referenceId: string,
  actionType: AuditAction,
  description: string,
  req?: Request,
  metadata?: Record<string, any>
): Promise<void> {
  await createAuditLog(
    {
      companyId,
      userId,
      actionType,
      resourceType: 'reference',
      resourceId: referenceId,
      description,
      metadata
    },
    req
  )
}

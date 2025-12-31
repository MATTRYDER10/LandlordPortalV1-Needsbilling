import { supabase as supabaseAdmin } from '../config/supabase'
import {
  createNotification,
  notificationExists,
  markEmailSent,
  cleanupExpiredNotifications
} from './notificationService'
import { sendEmail, loadEmailTemplate } from './emailService'
import { decrypt } from './encryption'

// Check intervals
const COMPLIANCE_CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1 hour
const NOTIFICATION_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours

// Thresholds
const EXPIRING_SOON_DAYS = 30
const EXPIRING_URGENT_DAYS = 14

interface ComplianceRecord {
  id: string
  property_id: string
  company_id: string
  compliance_type: string
  expiry_date: string
  status: string
  certificate_number: string | null
}

interface PropertyInfo {
  id: string
  postcode: string
  address_line1_encrypted: string | null
  full_address_encrypted: string | null
  company_id: string
}

interface CompanyInfo {
  id: string
  name: string
  primary_email: string
}

/**
 * Format compliance type for display
 */
function formatComplianceType(type: string): string {
  const types: Record<string, string> = {
    'gas_safety': 'Gas Safety Certificate',
    'eicr': 'EICR (Electrical)',
    'epc': 'EPC',
    'council_licence': 'Council Licence',
    'pat_test': 'PAT Test',
    'other': 'Other Compliance'
  }
  return types[type] || type
}

/**
 * Get property display address
 */
function getPropertyAddress(property: PropertyInfo): string {
  if (property.full_address_encrypted) {
    try {
      const decrypted = decrypt(property.full_address_encrypted)
      if (decrypted) return decrypted
    } catch {
      // Fall through to postcode
    }
  }
  if (property.address_line1_encrypted) {
    try {
      const decrypted = decrypt(property.address_line1_encrypted)
      if (decrypted) return `${decrypted}, ${property.postcode}`
    } catch {
      // Fall through to postcode
    }
  }
  return property.postcode
}

/**
 * Calculate days until expiry
 */
function daysUntilExpiry(expiryDate: string): number {
  const expiry = new Date(expiryDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  expiry.setHours(0, 0, 0, 0)
  const diffTime = expiry.getTime() - today.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Check for compliance records expiring within threshold and create notifications
 */
export async function checkExpiringCompliance(): Promise<{
  checked: number
  notificationsCreated: number
  emailsSent: number
}> {
  console.log('[ComplianceScheduler] Starting compliance expiry check...')

  let checked = 0
  let notificationsCreated = 0
  let emailsSent = 0

  try {
    // Get compliance records that are expiring soon or expired
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + EXPIRING_SOON_DAYS)

    const { data: expiringRecords, error: fetchError } = await supabaseAdmin
      .from('compliance_records')
      .select(`
        id,
        property_id,
        company_id,
        compliance_type,
        expiry_date,
        status,
        certificate_number
      `)
      .lte('expiry_date', thirtyDaysFromNow.toISOString())
      .is('deleted_at', null)
      .order('expiry_date', { ascending: true })

    if (fetchError) {
      console.error('[ComplianceScheduler] Error fetching expiring records:', fetchError)
      return { checked: 0, notificationsCreated: 0, emailsSent: 0 }
    }

    if (!expiringRecords || expiringRecords.length === 0) {
      console.log('[ComplianceScheduler] No expiring compliance records found')
      return { checked: 0, notificationsCreated: 0, emailsSent: 0 }
    }

    console.log(`[ComplianceScheduler] Found ${expiringRecords.length} expiring compliance records`)
    checked = expiringRecords.length

    // Process each record
    for (const record of expiringRecords as ComplianceRecord[]) {
      const days = daysUntilExpiry(record.expiry_date)

      // Determine notification type based on days remaining
      let notificationType: 'COMPLIANCE_EXPIRING_30' | 'COMPLIANCE_EXPIRING_14' | 'COMPLIANCE_EXPIRED'
      let severity: 'INFO' | 'WARNING' | 'URGENT'

      if (days <= 0) {
        notificationType = 'COMPLIANCE_EXPIRED'
        severity = 'URGENT'
      } else if (days <= EXPIRING_URGENT_DAYS) {
        notificationType = 'COMPLIANCE_EXPIRING_14'
        severity = 'WARNING'
      } else {
        notificationType = 'COMPLIANCE_EXPIRING_30'
        severity = 'INFO'
      }

      // Check if notification already exists
      const exists = await notificationExists(
        record.company_id,
        notificationType,
        record.id,
        24 // Don't create duplicate within 24 hours
      )

      if (exists) {
        continue
      }

      // Get property info
      const { data: property } = await supabaseAdmin
        .from('properties')
        .select('id, postcode, address_line1_encrypted, full_address_encrypted, company_id')
        .eq('id', record.property_id)
        .single()

      if (!property) {
        continue
      }

      const address = getPropertyAddress(property as PropertyInfo)
      const complianceTypeName = formatComplianceType(record.compliance_type)

      // Create notification
      let title: string
      let message: string

      if (days <= 0) {
        title = `${complianceTypeName} Expired`
        message = `The ${complianceTypeName} for ${address} expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago. Please renew immediately.`
      } else if (days <= EXPIRING_URGENT_DAYS) {
        title = `${complianceTypeName} Expiring Soon`
        message = `The ${complianceTypeName} for ${address} expires in ${days} day${days === 1 ? '' : 's'}. Please arrange renewal.`
      } else {
        title = `${complianceTypeName} Expiring`
        message = `The ${complianceTypeName} for ${address} expires in ${days} days. Consider scheduling renewal.`
      }

      const notification = await createNotification({
        companyId: record.company_id,
        notificationType,
        resourceType: 'compliance_record',
        resourceId: record.id,
        title,
        message,
        severity,
        metadata: {
          property_id: record.property_id,
          compliance_type: record.compliance_type,
          expiry_date: record.expiry_date,
          days_remaining: days,
          address
        }
      })

      if (notification) {
        notificationsCreated++
        console.log(`[ComplianceScheduler] Created ${severity} notification for ${complianceTypeName} at ${address}`)

        // Send email for urgent notifications
        if (severity === 'URGENT' || severity === 'WARNING') {
          const emailSent = await sendComplianceEmail(record, property as PropertyInfo, days)
          if (emailSent) {
            await markEmailSent(notification.id)
            emailsSent++
          }
        }
      }
    }

    console.log(`[ComplianceScheduler] Completed: ${checked} checked, ${notificationsCreated} notifications, ${emailsSent} emails`)
    return { checked, notificationsCreated, emailsSent }

  } catch (err) {
    console.error('[ComplianceScheduler] Error in compliance check:', err)
    return { checked, notificationsCreated, emailsSent }
  }
}

/**
 * Send compliance expiry email
 */
async function sendComplianceEmail(
  record: ComplianceRecord,
  property: PropertyInfo,
  daysRemaining: number
): Promise<boolean> {
  try {
    // Get company info for email
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('id, name, primary_email')
      .eq('id', record.company_id)
      .single()

    if (!company || !company.primary_email) {
      console.log('[ComplianceScheduler] No company email found, skipping email')
      return false
    }

    const address = getPropertyAddress(property)
    const complianceTypeName = formatComplianceType(record.compliance_type)
    const isExpired = daysRemaining <= 0

    // Choose template based on expiry status
    const templateName = isExpired ? 'compliance-expired-urgent' : 'compliance-expiring-reminder'

    const templateVars = {
      CompanyName: company.name,
      PropertyAddress: address,
      ComplianceType: complianceTypeName,
      ExpiryDate: new Date(record.expiry_date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      }),
      DaysRemaining: Math.abs(daysRemaining).toString(),
      DaysText: isExpired ? 'days ago' : 'days',
      CertificateNumber: record.certificate_number || 'N/A',
      PropertyLink: `${process.env.FRONTEND_URL}/properties/${property.id}`,
      CurrentYear: new Date().getFullYear().toString()
    }

    const htmlContent = loadEmailTemplate(templateName, templateVars)

    const subject = isExpired
      ? `URGENT: ${complianceTypeName} has expired for ${address}`
      : `Reminder: ${complianceTypeName} expiring soon for ${address}`

    await sendEmail({
      to: company.primary_email,
      subject,
      html: htmlContent
    })

    console.log(`[ComplianceScheduler] Sent ${isExpired ? 'expired' : 'expiring'} email to ${company.primary_email}`)
    return true

  } catch (err) {
    console.error('[ComplianceScheduler] Error sending compliance email:', err)
    return false
  }
}

/**
 * Update compliance record statuses based on expiry dates
 */
export async function updateComplianceStatuses(): Promise<number> {
  console.log('[ComplianceScheduler] Updating compliance statuses...')

  try {
    const today = new Date()
    const fourteenDaysFromNow = new Date()
    fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14)

    // Set expired records
    const { data: expired, error: expiredError } = await supabaseAdmin
      .from('compliance_records')
      .update({ status: 'expired' })
      .lt('expiry_date', today.toISOString())
      .neq('status', 'expired')
      .is('deleted_at', null)
      .select('id')

    if (expiredError) {
      console.error('[ComplianceScheduler] Error updating expired records:', expiredError)
    }

    // Set expiring_soon records
    const { data: expiringSoon, error: expiringSoonError } = await supabaseAdmin
      .from('compliance_records')
      .update({ status: 'expiring_soon' })
      .gte('expiry_date', today.toISOString())
      .lte('expiry_date', fourteenDaysFromNow.toISOString())
      .neq('status', 'expiring_soon')
      .is('deleted_at', null)
      .select('id')

    if (expiringSoonError) {
      console.error('[ComplianceScheduler] Error updating expiring_soon records:', expiringSoonError)
    }

    const totalUpdated = (expired?.length || 0) + (expiringSoon?.length || 0)
    console.log(`[ComplianceScheduler] Updated ${totalUpdated} compliance statuses`)
    return totalUpdated

  } catch (err) {
    console.error('[ComplianceScheduler] Error updating compliance statuses:', err)
    return 0
  }
}

/**
 * Start the compliance scheduler
 */
export function startComplianceScheduler(): void {
  console.log('[ComplianceScheduler] Starting property compliance scheduler...')

  // Run immediately on startup
  setTimeout(async () => {
    await updateComplianceStatuses()
    await checkExpiringCompliance()
  }, 10000) // Wait 10 seconds after startup

  // Compliance expiry check (every 1 hour)
  setInterval(async () => {
    console.log('[ComplianceScheduler] Running scheduled compliance check...')
    await updateComplianceStatuses()
    await checkExpiringCompliance()
  }, COMPLIANCE_CHECK_INTERVAL_MS)

  // Notification cleanup (every 24 hours)
  setInterval(async () => {
    console.log('[ComplianceScheduler] Running notification cleanup...')
    const cleaned = await cleanupExpiredNotifications(90)
    console.log(`[ComplianceScheduler] Cleaned up ${cleaned} old notifications`)
  }, NOTIFICATION_CLEANUP_INTERVAL_MS)
}

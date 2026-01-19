/**
 * Auto-Chase Service
 * Automatically sends chase emails on a schedule
 *
 * Chase Logic:
 * - Chases run once per day at 8:55am UK time (adjusts for GMT/BST)
 * - Each chase sends EMAIL ONLY (SMS is manual via staff portal)
 * - No auto-escalation to Action Required
 */

import { supabase } from '../config/supabase'
import { recordChase } from './chaseDependencyService'
// import { isWithinCallHours } from './vapiService' // Calls disabled for now
import { sendEmail } from './emailService'
import { decrypt } from './encryption'

// Temporary: Send summary emails to this address for monitoring
const SUMMARY_EMAIL_RECIPIENT = 'craig@propertygoose.co.uk'

interface ChaseDetail {
  dependencyType: string
  method: string // 'email' only now (SMS removed from auto-chase)
  referenceId: string
  contactName: string
  contactEmail: string
  success: boolean
  error?: string
}

// Chase timing constants
const CHASE_RULES = {
  CHASE_HOUR_UK: 8,                // 8:55am UK local time
  CHASE_MINUTE_UK: 55,             // Run at minute 55
  SMS_DELAY_HOURS: 4               // Hours after email before sending SMS (not used - SMS is manual only)
}

/**
 * Check if current time is within the auto-chase window (8:55am UK time)
 * Uses UK timezone which automatically handles GMT/BST transitions
 */
function isAutoChaseTime(): boolean {
  const now = new Date()

  // Get current time in UK timezone
  const ukTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  }).formatToParts(now)

  const ukHour = parseInt(ukTime.find(p => p.type === 'hour')?.value || '0')
  const ukMinute = parseInt(ukTime.find(p => p.type === 'minute')?.value || '0')

  // Check if it's 8:55am UK time (with 5-minute window for scheduler tolerance)
  const isCorrectHour = ukHour === CHASE_RULES.CHASE_HOUR_UK
  const isCorrectMinute = ukMinute >= CHASE_RULES.CHASE_MINUTE_UK && ukMinute < (CHASE_RULES.CHASE_MINUTE_UK + 5)

  return isCorrectHour && isCorrectMinute
}

/**
 * Get next daily chase time in UK timezone (8:55am)
 * Handles GMT/BST transitions automatically
 */
function getNextDailyChaseTime(base: Date): Date {
  // Create a date formatter for UK timezone
  const ukFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  // Get current UK date/time parts
  const ukParts = ukFormatter.formatToParts(base)
  const ukDay = parseInt(ukParts.find(p => p.type === 'day')?.value || '1')
  const ukMonth = parseInt(ukParts.find(p => p.type === 'month')?.value || '1') - 1
  const ukYear = parseInt(ukParts.find(p => p.type === 'year')?.value || '2024')
  const ukHour = parseInt(ukParts.find(p => p.type === 'hour')?.value || '0')
  const ukMinute = parseInt(ukParts.find(p => p.type === 'minute')?.value || '0')

  // Check if we've already passed 8:55am UK today
  const isPastChaseTime = ukHour > CHASE_RULES.CHASE_HOUR_UK ||
    (ukHour === CHASE_RULES.CHASE_HOUR_UK && ukMinute >= CHASE_RULES.CHASE_MINUTE_UK)

  // Create next chase time at 8:55am UK
  const next = new Date(base)
  if (isPastChaseTime) {
    // Schedule for tomorrow
    next.setDate(next.getDate() + 1)
  }

  // Set to 8:55am in UK timezone by creating a date string and parsing it
  // This is a simplified approach - the scheduler will run the job and isAutoChaseTime() will validate
  next.setHours(8, 55, 0, 0) // Approximate - actual check is done by isAutoChaseTime()

  return next
}

/**
 * Get all chase dependencies that are due for automatic chasing
 * Updated to use next_chase_due_at field and 7-day max chase period
 * Now runs at 8:55am UK time instead of 12:00 GMT
 */
async function getDependenciesDueForAutoChase(): Promise<any[]> {
  const now = new Date()
  if (!isAutoChaseTime()) {
    return []
  }

  // Get dependencies that need chasing:
  // - Status is PENDING or CHASING
  // - Use next_chase_due_at field (which has quiet hours adjustments baked in)
  const { data: dependencies, error } = await supabase
    .from('chase_dependencies')
    .select(`
      *,
      reference:tenant_references!chase_dependencies_reference_id_fkey (
        id,
        status,
        verification_state
      )
    `)
    .in('status', ['PENDING', 'CHASING'])
    .order('initial_request_sent_at', { ascending: true })

  if (error) {
    console.error('[AutoChase] Error fetching dependencies:', error)
    return []
  }

  // Filter to only those due for chasing
  return (dependencies || []).filter((dep: any) => {
    // Skip if no reference or reference is terminal
    if (!dep.reference) return false

    const terminalStatuses = ['completed', 'rejected', 'cancelled']
    const terminalVerificationStates = ['COMPLETED', 'REJECTED', 'CANCELLED', 'IN_VERIFICATION', 'READY_FOR_REVIEW']

    if (terminalStatuses.includes(dep.reference.status)) return false
    if (dep.reference.verification_state && terminalVerificationStates.includes(dep.reference.verification_state)) return false

    // Must have initial request sent
    if (!dep.initial_request_sent_at) return false
    const initialDate = new Date(dep.initial_request_sent_at)

    // NEW: Use next_chase_due_at if available (has quiet hours adjustments)
    if (dep.next_chase_due_at) {
      const nextChaseDue = new Date(dep.next_chase_due_at)
      const isDue = nextChaseDue <= now

      if (!isDue) {
        const hoursUntilDue = Math.round((nextChaseDue.getTime() - now.getTime()) / (1000 * 60 * 60))
        console.log(`[AutoChase] Dependency ${dep.id} not due yet - ${hoursUntilDue} hours remaining`)
      }

      return isDue
    }

    // FALLBACK: For first chase (no next_chase_due_at yet)
    const firstChaseDue = new Date(initialDate)
    const firstChaseAt = getNextDailyChaseTime(firstChaseDue)
    return firstChaseAt <= now
  })
}

/**
 * Determine if a dependency should be chased
 * Returns true if email+sms should be sent
 *
 * Updated: Daily chase at 12:00 GMT
 * The getDependenciesDueForAutoChase() filter already checks timing,
 * so if we get here, we should chase
 */
function shouldChase(dep: any): boolean {
  // Always chase if item passed the time window filter
  return true
}

// DISABLED: Call functionality commented out for now
// /**
//  * Determine what chase method to use for a dependency
//  * Returns 'email', 'sms', 'call', or null if nothing should be sent
//  * Chase order per cycle: Email -> SMS -> Call
//  */
// function determineChaseMethod(dep: any): 'email' | 'sms' | 'call' | null {
//   const { email_attempts, sms_attempts, call_attempts, chase_cycle } = dep
//   const callAttempts = call_attempts || 0
//
//   // Each cycle consists of: 1 email, then 1 SMS, then 1 call
//   // Cycle 0: email_attempts=0, sms_attempts=0, call_attempts=0 -> send email
//   // After email: email_attempts=1, sms_attempts=0, call_attempts=0 -> send SMS
//   // After SMS: email_attempts=1, sms_attempts=1, call_attempts=0 -> send call
//   // After call: email_attempts=1, sms_attempts=1, call_attempts=1 -> cycle_complete, cycle becomes 1
//   // Cycle 1: email_attempts=1, sms_attempts=1, call_attempts=1 -> send email (email_attempts becomes 2)
//   // etc.
//
//   // If email attempts <= chase_cycle, send email
//   if (email_attempts <= chase_cycle) {
//     return 'email'
//   }
//
//   // If sms attempts <= chase_cycle AND we've sent email this cycle, send SMS
//   if (sms_attempts <= chase_cycle && email_attempts > chase_cycle) {
//     return 'sms'
//   }
//
//   // If call attempts <= chase_cycle AND we've sent email and SMS this cycle, send call
//   if (callAttempts <= chase_cycle && email_attempts > chase_cycle && sms_attempts > chase_cycle) {
//     return 'call'
//   }
//
//   // All three sent for this cycle, nothing to do until cycle advances
//   return null
// }

/**
 * Send summary email with auto-chase results
 * Temporary feature for monitoring - sends to craig@propertygoose.co.uk
 */
async function sendAutoSummaryEmail(
  stats: { processed: number; sent: number; skipped: number; errors: number },
  chaseDetails: ChaseDetail[],
  exhaustedCount: number
): Promise<void> {
  // Only send if there was activity
  if (stats.sent === 0 && stats.errors === 0 && exhaustedCount === 0) {
    console.log('[AutoChase] No activity to report - skipping summary email')
    return
  }

  const timestamp = new Date().toISOString()
  const successfulChases = chaseDetails.filter(d => d.success)
  const failedChases = chaseDetails.filter(d => !d.success)

  // Build HTML email
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #f97316; margin-bottom: 20px;">Auto-Chase Summary Report</h2>
      <p style="color: #6b7280; font-size: 14px;">Run completed at: ${timestamp}</p>

      <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <h3 style="margin: 0 0 12px 0; font-size: 16px;">Statistics</h3>
        <table style="width: 100%; font-size: 14px;">
          <tr><td style="padding: 4px 0;">Processed:</td><td style="text-align: right; font-weight: 600;">${stats.processed}</td></tr>
          <tr><td style="padding: 4px 0;">Sent:</td><td style="text-align: right; font-weight: 600; color: #10b981;">${stats.sent}</td></tr>
          <tr><td style="padding: 4px 0;">Skipped:</td><td style="text-align: right; font-weight: 600; color: #6b7280;">${stats.skipped}</td></tr>
          <tr><td style="padding: 4px 0;">Errors:</td><td style="text-align: right; font-weight: 600; color: ${stats.errors > 0 ? '#ef4444' : '#6b7280'};">${stats.errors}</td></tr>
          <tr><td style="padding: 4px 0;">Exhausted (-> Action Required):</td><td style="text-align: right; font-weight: 600;">${exhaustedCount}</td></tr>
        </table>
      </div>

      ${successfulChases.length > 0 ? `
        <div style="margin: 20px 0;">
          <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #10b981;">Successful Chases (${successfulChases.length})</h3>
          <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
            <tr style="background: #f3f4f6;">
              <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb;">Contact</th>
              <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb;">Type</th>
              <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb;">Method</th>
            </tr>
            ${successfulChases.map(chase => `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
                  <div style="font-weight: 500;">${chase.contactName || 'Unknown'}</div>
                  <div style="font-size: 11px; color: #6b7280;">${chase.contactEmail || 'No email'}</div>
                </td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${chase.dependencyType}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${chase.method.toUpperCase()}</td>
              </tr>
            `).join('')}
          </table>
        </div>
      ` : ''}

      ${failedChases.length > 0 ? `
        <div style="margin: 20px 0;">
          <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #ef4444;">Failed Chases (${failedChases.length})</h3>
          <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
            <tr style="background: #fef2f2;">
              <th style="padding: 8px; text-align: left; border-bottom: 1px solid #fecaca;">Contact</th>
              <th style="padding: 8px; text-align: left; border-bottom: 1px solid #fecaca;">Type</th>
              <th style="padding: 8px; text-align: left; border-bottom: 1px solid #fecaca;">Error</th>
            </tr>
            ${failedChases.map(chase => `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #fecaca;">
                  <div style="font-weight: 500;">${chase.contactName || 'Unknown'}</div>
                  <div style="font-size: 11px; color: #6b7280;">${chase.contactEmail || 'No email'}</div>
                </td>
                <td style="padding: 8px; border-bottom: 1px solid #fecaca;">${chase.dependencyType}</td>
                <td style="padding: 8px; border-bottom: 1px solid #fecaca; color: #ef4444;">${chase.error || 'Unknown error'}</td>
              </tr>
            `).join('')}
          </table>
        </div>
      ` : ''}

      <p style="color: #9ca3af; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        This is an automated monitoring email from PropertyGoose. You can remove this feature by editing autoChaseService.ts.
      </p>
    </div>
  `

  try {
    await sendEmail({
      to: SUMMARY_EMAIL_RECIPIENT,
      subject: `[Auto-Chase] ${stats.sent} sent, ${stats.errors} errors - ${new Date().toLocaleDateString('en-GB')}`,
      html
    })
    console.log(`[AutoChase] Summary email sent to ${SUMMARY_EMAIL_RECIPIENT}`)
  } catch (error) {
    console.error('[AutoChase] Failed to send summary email:', error)
  }
}

/**
 * Process all auto-chases
 * This is called by the scheduler every 30 minutes
 */
export async function processAutoChases(): Promise<{ processed: number; sent: number; skipped: number; errors: number }> {
  const stats = { processed: 0, sent: 0, skipped: 0, errors: 0 }
  const chaseDetails: ChaseDetail[] = []

  try {
    // Check dev mode
    const isDev = process.env.NODE_ENV === 'development'
    if (isDev) {
      console.log('[AutoChase] Running in dev mode - emails/SMS will be logged but not sent')
    }

    // Get dependencies due for chasing
    const dueForChase = await getDependenciesDueForAutoChase()
    console.log(`[AutoChase] Found ${dueForChase.length} dependencies due for chasing`)

    for (const dep of dueForChase) {
      stats.processed++

      // Check if we should chase this dependency
      if (!shouldChase(dep)) {
        stats.skipped++
        continue
      }

      // Decrypt contact info for summary email
      const contactName = decrypt(dep.contact_name_encrypted) || 'Unknown'
      const contactEmail = decrypt(dep.contact_email_encrypted) || 'No email'

      try {
        // Send EMAIL ONLY (SMS is now manual via staff portal to reduce costs)
        let emailSent = false
        const errors: string[] = []

        // Send email
        try {
          await recordChase(dep.id, 'email', 'SYSTEM', true)
          emailSent = true
          console.log(`[AutoChase] Sent email for ${dep.dependency_type} to ${contactName} (ref: ${dep.reference_id})`)
        } catch (emailError: any) {
          errors.push(`Email: ${emailError.message}`)
          console.error(`[AutoChase] Error sending email for ${dep.id}:`, emailError.message)
        }

        // Track results
        if (emailSent) {
          stats.sent++
          chaseDetails.push({
            dependencyType: dep.dependency_type,
            method: 'email',
            referenceId: dep.reference_id,
            contactName,
            contactEmail,
            success: true
          })
        }

        if (errors.length > 0) {
          stats.errors++
          if (!emailSent) {
            chaseDetails.push({
              dependencyType: dep.dependency_type,
              method: 'email',
              referenceId: dep.reference_id,
              contactName,
              contactEmail,
              success: false,
              error: errors.join('; ')
            })
          }
        }

        // Rate limit between dependencies
        await new Promise(resolve => setTimeout(resolve, 600))
      } catch (error: any) {
        stats.errors++
        chaseDetails.push({
          dependencyType: dep.dependency_type,
          method: 'email',
          referenceId: dep.reference_id,
          contactName,
          contactEmail,
          success: false,
          error: error.message
        })
        console.error(`[AutoChase] Error processing ${dep.id}:`, error.message)
      }
    }

    console.log(`[AutoChase] Complete: processed=${stats.processed}, sent=${stats.sent}, skipped=${stats.skipped}, errors=${stats.errors}`)

    // Send summary email (temporary monitoring feature)
    await sendAutoSummaryEmail(stats, chaseDetails, 0)

    return stats
  } catch (error) {
    console.error('[AutoChase] Fatal error:', error)
    return stats
  }
}

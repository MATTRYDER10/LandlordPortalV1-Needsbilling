/**
 * Auto-Chase Service
 * Automatically sends chase emails/SMS/calls on a schedule
 *
 * Chase Logic:
 * - Initial chase: 8 hours after request sent
 * - Subsequent chases: every 8 hours
 * - Only between 08:00-20:00 GMT (quiet hours for email/SMS)
 * - Calls have stricter hours: 09:00-19:00 GMT, weekdays only
 * - After 3 full cycles (email + SMS + call each): auto push to Action Required
 * - Chase order per cycle: Email first, then SMS, then Call
 */

import { supabase } from '../config/supabase'
import { recordChase, processExhaustedDependencies } from './chaseDependencyService'
import { isWithinCallHours } from './vapiService'
import { sendEmail } from './emailService'
import { decrypt } from './encryption'

// Temporary: Send summary emails to this address for monitoring
const SUMMARY_EMAIL_RECIPIENT = 'craig@propertygoose.co.uk'

interface ChaseDetail {
  dependencyType: string
  method: 'email' | 'sms' | 'call'
  referenceId: string
  contactName: string
  contactEmail: string
  success: boolean
  error?: string
}

// Chase timing constants
const CHASE_RULES = {
  INITIAL_CHASE_DELAY_HOURS: 8,    // Hours after initial request before first chase
  CHASE_INTERVAL_HOURS: 8,         // Hours between chases
  QUIET_HOURS_START: 20,           // 8 PM GMT - start of quiet hours
  QUIET_HOURS_END: 8,              // 8 AM GMT - end of quiet hours
  SMS_DELAY_HOURS: 4               // Hours after email before sending SMS
}

/**
 * Check if current time is within quiet hours (20:00-08:00 GMT)
 */
function isQuietHours(): boolean {
  const now = new Date()
  const gmtHour = now.getUTCHours()
  // Quiet hours: 20:00-08:00 GMT
  return gmtHour >= CHASE_RULES.QUIET_HOURS_START || gmtHour < CHASE_RULES.QUIET_HOURS_END
}

/**
 * Get all chase dependencies that are due for automatic chasing
 */
async function getDependenciesDueForAutoChase(): Promise<any[]> {
  const now = new Date()
  const chaseThreshold = new Date(now.getTime() - (CHASE_RULES.CHASE_INTERVAL_HOURS * 60 * 60 * 1000))

  // Get dependencies that need chasing:
  // - Status is PENDING or CHASING
  // - Either:
  //   a) No chase sent yet AND initial_request_sent_at > 8 hours ago
  //   b) Last chase sent > 8 hours ago
  const { data: dependencies, error } = await supabase
    .from('chase_dependencies')
    .select(`
      *,
      reference:tenant_references!chase_dependencies_reference_id_fkey (
        id,
        status
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
    const terminalStatuses = ['completed', 'rejected', 'cancelled', 'action_required', 'pending_verification']
    if (terminalStatuses.includes(dep.reference.status)) return false

    // Must have initial request sent
    if (!dep.initial_request_sent_at) return false

    // Determine what's due based on chase cycle and attempts
    const relevantTimestamp = dep.last_chase_sent_at || dep.initial_request_sent_at
    const timestampDate = new Date(relevantTimestamp)

    // Check if 8+ hours have passed
    return timestampDate <= chaseThreshold
  })
}

/**
 * Determine what chase method to use for a dependency
 * Returns 'email', 'sms', 'call', or null if nothing should be sent
 * Chase order per cycle: Email -> SMS -> Call
 */
function determineChaseMethod(dep: any): 'email' | 'sms' | 'call' | null {
  const { email_attempts, sms_attempts, call_attempts, chase_cycle } = dep
  const callAttempts = call_attempts || 0

  // Each cycle consists of: 1 email, then 1 SMS, then 1 call
  // Cycle 0: email_attempts=0, sms_attempts=0, call_attempts=0 -> send email
  // After email: email_attempts=1, sms_attempts=0, call_attempts=0 -> send SMS
  // After SMS: email_attempts=1, sms_attempts=1, call_attempts=0 -> send call
  // After call: email_attempts=1, sms_attempts=1, call_attempts=1 -> cycle_complete, cycle becomes 1
  // Cycle 1: email_attempts=1, sms_attempts=1, call_attempts=1 -> send email (email_attempts becomes 2)
  // etc.

  // If email attempts <= chase_cycle, send email
  if (email_attempts <= chase_cycle) {
    return 'email'
  }

  // If sms attempts <= chase_cycle AND we've sent email this cycle, send SMS
  if (sms_attempts <= chase_cycle && email_attempts > chase_cycle) {
    return 'sms'
  }

  // If call attempts <= chase_cycle AND we've sent email and SMS this cycle, send call
  if (callAttempts <= chase_cycle && email_attempts > chase_cycle && sms_attempts > chase_cycle) {
    return 'call'
  }

  // All three sent for this cycle, nothing to do until cycle advances
  return null
}

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
    // Check quiet hours
    if (isQuietHours()) {
      console.log('[AutoChase] Skipping - currently in quiet hours (20:00-08:00 GMT)')
      return stats
    }

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

      // Determine what to send
      const method = determineChaseMethod(dep)
      if (!method) {
        stats.skipped++
        continue
      }

      // Skip calls if outside call hours (stricter than email/SMS quiet hours)
      if (method === 'call' && !isWithinCallHours()) {
        console.log(`[AutoChase] Skipping call for ${dep.id}: outside call hours (9 AM - 7 PM GMT, weekdays)`)
        stats.skipped++
        continue
      }

      // Decrypt contact info for summary email
      const contactName = decrypt(dep.contact_name_encrypted) || 'Unknown'
      const contactEmail = decrypt(dep.contact_email_encrypted) || 'No email'

      try {
        // Record and send the chase
        await recordChase(dep.id, method, 'SYSTEM', true)
        stats.sent++
        chaseDetails.push({
          dependencyType: dep.dependency_type,
          method,
          referenceId: dep.reference_id,
          contactName,
          contactEmail,
          success: true
        })
        console.log(`[AutoChase] Sent ${method} for ${dep.dependency_type} to ${contactName} (ref: ${dep.reference_id})`)

        // Rate limit: Resend allows 2 req/sec, add 600ms delay to stay well under limit
        // VAPI also has rate limits, so this delay applies to all methods
        await new Promise(resolve => setTimeout(resolve, 600))
      } catch (error: any) {
        stats.errors++
        chaseDetails.push({
          dependencyType: dep.dependency_type,
          method,
          referenceId: dep.reference_id,
          contactName,
          contactEmail,
          success: false,
          error: error.message
        })
        console.error(`[AutoChase] Error sending ${method} for ${dep.id}:`, error.message)
      }
    }

    // Process any exhausted dependencies
    const exhaustedCount = await processExhaustedDependencies()
    if (exhaustedCount > 0) {
      console.log(`[AutoChase] Processed ${exhaustedCount} exhausted dependencies -> ACTION_REQUIRED`)
    }

    console.log(`[AutoChase] Complete: processed=${stats.processed}, sent=${stats.sent}, skipped=${stats.skipped}, errors=${stats.errors}`)

    // Send summary email (temporary monitoring feature)
    await sendAutoSummaryEmail(stats, chaseDetails, exhaustedCount)

    return stats
  } catch (error) {
    console.error('[AutoChase] Fatal error:', error)
    return stats
  }
}

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
 * Process all auto-chases
 * This is called by the scheduler every 30 minutes
 */
export async function processAutoChases(): Promise<{ processed: number; sent: number; skipped: number; errors: number }> {
  const stats = { processed: 0, sent: 0, skipped: 0, errors: 0 }

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

      try {
        // Record and send the chase
        await recordChase(dep.id, method, 'SYSTEM', true)
        stats.sent++
        console.log(`[AutoChase] Sent ${method} for ${dep.dependency_type} (ref: ${dep.reference_id})`)

        // Rate limit: Resend allows 2 req/sec, add 600ms delay to stay well under limit
        // VAPI also has rate limits, so this delay applies to all methods
        await new Promise(resolve => setTimeout(resolve, 600))
      } catch (error: any) {
        stats.errors++
        console.error(`[AutoChase] Error sending ${method} for ${dep.id}:`, error.message)
      }
    }

    // Process any exhausted dependencies
    const exhaustedCount = await processExhaustedDependencies()
    if (exhaustedCount > 0) {
      console.log(`[AutoChase] Processed ${exhaustedCount} exhausted dependencies -> ACTION_REQUIRED`)
    }

    console.log(`[AutoChase] Complete: processed=${stats.processed}, sent=${stats.sent}, skipped=${stats.skipped}, errors=${stats.errors}`)
    return stats
  } catch (error) {
    console.error('[AutoChase] Fatal error:', error)
    return stats
  }
}

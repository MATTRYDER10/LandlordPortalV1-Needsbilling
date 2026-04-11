/**
 * Landlord AML Chase Scheduler
 *
 * Automatically chases landlords who have a pending AML verification check.
 * Runs once per day at 12:00 UK time. Each pending AML check is re-sent the
 * verification email (with a fresh link) if it has not already been chased
 * in the last 24 hours.
 *
 * Safety rules:
 *  - Only chases checks where verification_status = 'pending' (not verified,
 *    not failed, not completed)
 *  - Only chases if last_chased_at (or requested_at if never chased) is more
 *    than 24h ago — avoids piling on
 *  - Runs at most once per day (gated by hour === 12 UK time + lastRunDate)
 *  - Skips landlords whose email is missing or who belong to companies that
 *    have been soft-deleted
 */

import { supabase } from '../config/supabase'
import { decrypt, generateToken, hash } from './encryption'
import { sendLandlordVerificationRequest } from './emailService'
import { getFrontendUrl } from '../utils/frontendUrl'

const CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1 hour — fires at most once per day
const TARGET_HOUR_UK = 12 // 12:00 (noon) UK time
const MIN_HOURS_BETWEEN_CHASES = 20 // Belt-and-braces so a re-run on the same day can't double-send

let schedulerInterval: NodeJS.Timeout | null = null
let lastRunDate: string | null = null
let isRunning = false

/**
 * Start the landlord AML chase scheduler.
 */
export function startLandlordAmlChaseScheduler(intervalMs: number = CHECK_INTERVAL_MS): void {
  if (schedulerInterval) {
    console.log('[LandlordAmlChase] Already running')
    return
  }

  console.log(`[LandlordAmlChase] Starting — checks hourly, fires daily at ${TARGET_HOUR_UK}:00 UK time`)

  // Kick off an initial check 60s after startup so the scheduler is alive
  // but doesn't block boot
  setTimeout(() => runDailyChase(), 60 * 1000)

  schedulerInterval = setInterval(runDailyChase, intervalMs)
}

/**
 * Stop the scheduler (used by tests / shutdown hooks).
 */
export function stopLandlordAmlChaseScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
    console.log('[LandlordAmlChase] Stopped')
  }
}

/**
 * Gate the chase on "is it 12pm UK time today AND have we not run yet today".
 */
async function runDailyChase(): Promise<void> {
  if (isRunning) return

  try {
    const now = new Date()
    const ukTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }))
    const hour = ukTime.getHours()
    const todayStr = ukTime.toISOString().split('T')[0]

    if (hour !== TARGET_HOUR_UK) {
      return
    }

    if (lastRunDate === todayStr) {
      return // Already ran today
    }

    isRunning = true
    console.log(`[LandlordAmlChase] Starting daily chase run for ${todayStr}`)

    const result = await chasePendingLandlordAmlChecks()
    console.log(`[LandlordAmlChase] Complete — chased: ${result.chased}, skipped: ${result.skipped}, failed: ${result.failed}`)

    lastRunDate = todayStr
  } catch (err) {
    console.error('[LandlordAmlChase] Fatal error in daily chase:', err)
  } finally {
    isRunning = false
  }
}

/**
 * Query all pending landlord AML checks and resend the verification email
 * to each landlord whose check is due for a chase.
 */
export async function chasePendingLandlordAmlChecks(): Promise<{ chased: number; skipped: number; failed: number }> {
  let chased = 0
  let skipped = 0
  let failed = 0

  const minChaseGapIso = new Date(Date.now() - MIN_HOURS_BETWEEN_CHASES * 60 * 60 * 1000).toISOString()

  // Pull pending checks whose last chase (or initial request if never chased)
  // is older than the min gap. We fetch both last_chased_at and requested_at
  // and filter in memory because .or() with null checks is awkward.
  const { data: checks, error } = await supabase
    .from('landlord_aml_checks')
    .select('id, landlord_id, verification_status, requested_at, last_chased_at, chase_count')
    .eq('verification_status', 'pending')

  if (error) {
    console.error('[LandlordAmlChase] Failed to query pending checks:', error)
    return { chased, skipped, failed }
  }

  if (!checks || checks.length === 0) {
    console.log('[LandlordAmlChase] No pending AML checks found')
    return { chased, skipped, failed }
  }

  // Filter to only those due for a chase (last contact > 20h ago)
  const dueChecks = checks.filter(c => {
    const lastContact = c.last_chased_at || c.requested_at
    if (!lastContact) return true // Never contacted — chase now
    return lastContact < minChaseGapIso
  })

  console.log(`[LandlordAmlChase] ${checks.length} pending check(s) total, ${dueChecks.length} due for chase`)

  for (const check of dueChecks) {
    try {
      // Fetch landlord + company details
      const { data: landlord, error: llErr } = await supabase
        .from('landlords')
        .select('id, company_id, email_encrypted, first_name_encrypted, last_name_encrypted')
        .eq('id', check.landlord_id)
        .maybeSingle()

      if (llErr || !landlord) {
        console.warn(`[LandlordAmlChase] Landlord ${check.landlord_id} not found — skipping`)
        skipped++
        continue
      }

      const landlordEmail = landlord.email_encrypted ? (decrypt(landlord.email_encrypted) || '') : ''
      if (!landlordEmail) {
        console.warn(`[LandlordAmlChase] Landlord ${check.landlord_id} has no email — skipping`)
        skipped++
        continue
      }

      const landlordName = `${decrypt(landlord.first_name_encrypted) || ''} ${decrypt(landlord.last_name_encrypted) || ''}`.trim() || 'Landlord'

      // Generate a fresh verification token — the old one may have been used
      // by an abandoned attempt, and rotating reduces the chance of stale
      // links being shared around
      const verificationToken = generateToken()
      const verificationTokenHash = hash(verificationToken)

      const { error: updateErr } = await supabase
        .from('landlord_aml_checks')
        .update({
          verification_token_hash: verificationTokenHash,
          last_chased_at: new Date().toISOString(),
          chase_count: (check.chase_count || 0) + 1,
        })
        .eq('id', check.id)

      if (updateErr) {
        console.error(`[LandlordAmlChase] Failed to update check ${check.id}:`, updateErr)
        failed++
        continue
      }

      // Build the verification link (prod URL in prod env)
      const frontendUrl = getFrontendUrl()
      const verificationLink = `${frontendUrl}/landlord-verification/${landlord.id}/${verificationToken}`

      try {
        await sendLandlordVerificationRequest(
          landlordEmail,
          landlordName,
          verificationLink,
          landlord.company_id
        )
        chased++
        console.log(`[LandlordAmlChase] Sent chase #${(check.chase_count || 0) + 1} to ${landlordEmail} (landlord ${landlord.id})`)
      } catch (emailErr: any) {
        console.error(`[LandlordAmlChase] Email failed for landlord ${landlord.id}:`, emailErr?.message || emailErr)
        failed++
      }
    } catch (err) {
      console.error(`[LandlordAmlChase] Unexpected error for check ${check.id}:`, err)
      failed++
    }
  }

  return { chased, skipped, failed }
}

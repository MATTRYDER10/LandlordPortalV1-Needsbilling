/**
 * Deposit Certificate Scheduler
 *
 * Polls daily for custodial deposit certificates that aren't available yet.
 * Custodial schemes (TDS Custodial, mydeposits) require payment before the
 * certificate is generated — this can take up to 30 days (legal limit).
 *
 * When a certificate becomes available, it's downloaded and emailed to tenant(s).
 */

import { supabase } from '../config/supabase'
import { decrypt } from './encryption'

let schedulerInterval: NodeJS.Timeout | null = null
let isRunning = false

// Run every 6 hours (catches certs faster than once daily)
const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000

/**
 * Start the deposit certificate polling scheduler
 */
export function startDepositCertificateScheduler(intervalMs: number = DEFAULT_INTERVAL_MS): void {
  if (schedulerInterval) {
    console.log('[DepositCertScheduler] Already running')
    return
  }

  console.log(`[DepositCertScheduler] Starting (interval: ${intervalMs / 1000 / 60 / 60}h)`)

  // Run after a 2-minute delay on startup (let other services init first)
  setTimeout(() => runCertificatePolling(), 2 * 60 * 1000)

  schedulerInterval = setInterval(runCertificatePolling, intervalMs)
}

/**
 * Stop the scheduler
 */
export function stopDepositCertificateScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
    console.log('[DepositCertScheduler] Stopped')
  }
}

/**
 * Main polling run
 */
async function runCertificatePolling(): Promise<void> {
  if (isRunning) return
  isRunning = true

  try {
    console.log('[DepositCertScheduler] Checking for pending certificates...')

    let processed = 0

    // 1. TDS Custodial registrations needing certificate
    processed += await pollTDSCustodialCerts()

    // 2. mydeposits registrations needing certificate
    processed += await pollMyDepositsCerts()

    if (processed > 0) {
      console.log(`[DepositCertScheduler] Processed ${processed} certificates`)
    }
  } catch (error) {
    console.error('[DepositCertScheduler] Error:', error)
  } finally {
    isRunning = false
  }
}

/**
 * Poll TDS Custodial registrations where cert hasn't been sent yet
 */
async function pollTDSCustodialCerts(): Promise<number> {
  const now = new Date().toISOString()

  const { data: pending, error } = await supabase
    .from('tds_registrations')
    .select('id, tenancy_id, company_id, registered_by, dan, deposit_amount, scheme_type, certificate_sent_at, certificate_poll_until')
    .eq('status', 'registered')
    .is('certificate_sent_at', null)
    .not('certificate_poll_until', 'is', null)
    .gt('certificate_poll_until', now)

  if (error || !pending || pending.length === 0) return 0

  console.log(`[DepositCertScheduler] Found ${pending.length} TDS registrations needing certificates`)

  let sent = 0
  for (const reg of pending) {
    try {
      // Get property address for the email
      const { data: tenancy } = await supabase
        .from('tenancies')
        .select('property_address_encrypted')
        .eq('id', reg.tenancy_id)
        .single()
      const propertyAddress = tenancy?.property_address_encrypted ? decrypt(tenancy.property_address_encrypted) : null

      const schemeName = reg.scheme_type === 'insured' ? 'TDS Insured' : 'TDS Custodial'
      const depositScheme = reg.scheme_type === 'insured' ? 'tds_insured' : 'tds_custodial'

      // Dynamic import to avoid circular deps
      const { sendCertificateToTenants } = await import('../routes/tds')

      const success = await sendCertificateToTenants(
        reg.tenancy_id,
        reg.company_id,
        reg.registered_by || 'system',
        reg.dan,
        schemeName,
        reg.deposit_amount,
        propertyAddress,
        depositScheme
      )

      if (success) {
        // Mark certificate as sent
        await supabase
          .from('tds_registrations')
          .update({ certificate_sent_at: new Date().toISOString() })
          .eq('id', reg.id)
        sent++
        console.log(`[DepositCertScheduler] TDS cert sent for DAN ${reg.dan}`)
      }
    } catch (err) {
      console.error(`[DepositCertScheduler] Error processing TDS reg ${reg.id}:`, err)
    }
  }

  // Clean up expired polling (past 30 days)
  await supabase
    .from('tds_registrations')
    .update({ certificate_poll_until: null })
    .is('certificate_sent_at', null)
    .lt('certificate_poll_until', now)

  return sent
}

/**
 * Poll mydeposits registrations where cert hasn't been sent yet
 */
async function pollMyDepositsCerts(): Promise<number> {
  const now = new Date().toISOString()

  const { data: pending, error } = await supabase
    .from('mydeposits_registrations')
    .select('id, tenancy_id, company_id, registered_by, deposit_id, deposit_amount, scheme_type, certificate_sent_at, certificate_poll_until')
    .eq('status', 'registered')
    .is('certificate_sent_at', null)
    .not('certificate_poll_until', 'is', null)
    .gt('certificate_poll_until', now)

  if (error || !pending || pending.length === 0) return 0

  console.log(`[DepositCertScheduler] Found ${pending.length} mydeposits registrations needing certificates`)

  let sent = 0
  for (const reg of pending) {
    try {
      const { data: tenancy } = await supabase
        .from('tenancies')
        .select('property_address_encrypted')
        .eq('id', reg.tenancy_id)
        .single()
      const propertyAddress = tenancy?.property_address_encrypted ? decrypt(tenancy.property_address_encrypted) : null

      const schemeName = 'mydeposits'

      const { sendCertificateToTenants } = await import('../routes/tds')

      const success = await sendCertificateToTenants(
        reg.tenancy_id,
        reg.company_id,
        reg.registered_by || 'system',
        reg.deposit_id || '',
        schemeName,
        reg.deposit_amount || 0,
        propertyAddress,
        'mydeposits'
      )

      if (success) {
        await supabase
          .from('mydeposits_registrations')
          .update({ certificate_sent_at: new Date().toISOString() })
          .eq('id', reg.id)
        sent++
        console.log(`[DepositCertScheduler] mydeposits cert sent for deposit ${reg.deposit_id}`)
      }
    } catch (err) {
      console.error(`[DepositCertScheduler] Error processing mydeposits reg ${reg.id}:`, err)
    }
  }

  // Clean up expired
  await supabase
    .from('mydeposits_registrations')
    .update({ certificate_poll_until: null })
    .is('certificate_sent_at', null)
    .lt('certificate_poll_until', now)

  return sent
}

import { supabase } from '../config/supabase'
import { decrypt } from './encryption'
import * as tenancyService from './tenancyService'

// Check interval - daily
const RENT_INCREASE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours

interface RentIncreaseNotice {
  id: string
  tenancy_id: string
  company_id: string
  current_rent: number
  new_rent: number
  effective_date: string
  status: string
  created_by: string | null
}

interface TenancyInfo {
  id: string
  property_id: string
  monthly_rent: number
  rent_amount: number
}

/**
 * Apply pending rent increases that have reached their effective date
 */
export async function applyPendingRentIncreases(): Promise<{ applied: number; errors: number }> {
  console.log('[RentIncreaseScheduler] Checking for pending rent increases...')

  let applied = 0
  let errors = 0

  try {
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

    // Find rent increase notices that:
    // 1. Have reached their effective date
    // 2. Are in 'served' status (not yet applied)
    const { data: notices, error: noticesError } = await supabase
      .from('rent_increase_notices')
      .select('*')
      .eq('status', 'served')
      .lte('effective_date', today)

    if (noticesError) {
      console.error('[RentIncreaseScheduler] Error fetching notices:', noticesError.message)
      return { applied, errors: 1 }
    }

    if (!notices || notices.length === 0) {
      console.log('[RentIncreaseScheduler] No pending rent increases to apply')
      return { applied, errors }
    }

    console.log(`[RentIncreaseScheduler] Found ${notices.length} rent increase(s) to apply`)

    for (const notice of notices as RentIncreaseNotice[]) {
      try {
        // Get the tenancy
        const { data: tenancy, error: tenancyError } = await supabase
          .from('tenancies')
          .select('id, property_id, monthly_rent, rent_amount')
          .eq('id', notice.tenancy_id)
          .single()

        if (tenancyError || !tenancy) {
          console.error(`[RentIncreaseScheduler] Tenancy ${notice.tenancy_id} not found:`, tenancyError?.message)
          errors++
          continue
        }

        // Update the tenancy rent amount
        const { error: updateError } = await supabase
          .from('tenancies')
          .update({
            monthly_rent: notice.new_rent,
            rent_amount: notice.new_rent
          })
          .eq('id', notice.tenancy_id)

        if (updateError) {
          console.error(`[RentIncreaseScheduler] Failed to update tenancy ${notice.tenancy_id}:`, updateError.message)
          errors++
          continue
        }

        // Update the notice status to 'applied'
        const { error: noticeUpdateError } = await supabase
          .from('rent_increase_notices')
          .update({
            status: 'applied'
          })
          .eq('id', notice.id)

        if (noticeUpdateError) {
          console.error(`[RentIncreaseScheduler] Failed to update notice ${notice.id}:`, noticeUpdateError.message)
          // Don't count as error since rent was updated
        }

        // Log to activity log
        const effectiveDateFormatted = new Date(notice.effective_date).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', year: 'numeric'
        })

        await tenancyService.logTenancyActivity(notice.tenancy_id, {
          action: 'RENT_INCREASED',
          category: 'financial',
          title: 'Rent Increase Applied',
          description: `Rent increased from £${notice.current_rent} to £${notice.new_rent} per month (Section 13 notice effective ${effectiveDateFormatted})`,
          metadata: {
            noticeId: notice.id,
            previousRent: notice.current_rent,
            newRent: notice.new_rent,
            effectiveDate: notice.effective_date
          },
          performedBy: undefined // System action
        })

        console.log(`[RentIncreaseScheduler] Applied rent increase for tenancy ${notice.tenancy_id}: £${notice.current_rent} → £${notice.new_rent}`)
        applied++

      } catch (err: any) {
        console.error(`[RentIncreaseScheduler] Error processing notice ${notice.id}:`, err.message)
        errors++
      }
    }

    console.log(`[RentIncreaseScheduler] Completed: ${applied} applied, ${errors} errors`)
    return { applied, errors }

  } catch (err: any) {
    console.error('[RentIncreaseScheduler] Fatal error:', err.message)
    return { applied, errors: errors + 1 }
  }
}

/**
 * Get pending rent increase for a tenancy (if any)
 * Used by API to show pending badge on frontend
 */
export async function getPendingRentIncrease(tenancyId: string): Promise<{
  pending: boolean
  newRent?: number
  effectiveDate?: string
  noticeId?: string
} | null> {
  try {
    const today = new Date().toISOString().split('T')[0]

    const { data: notice, error } = await supabase
      .from('rent_increase_notices')
      .select('id, new_rent, effective_date')
      .eq('tenancy_id', tenancyId)
      .eq('status', 'served')
      .gt('effective_date', today)
      .order('effective_date', { ascending: true })
      .limit(1)
      .single()

    if (error || !notice) {
      return { pending: false }
    }

    return {
      pending: true,
      newRent: notice.new_rent,
      effectiveDate: notice.effective_date,
      noticeId: notice.id
    }
  } catch {
    return { pending: false }
  }
}

/**
 * Calculate milliseconds until next 00:01
 */
function msUntilNextMidnight(): number {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 1, 0, 0) // 00:01:00
  return tomorrow.getTime() - now.getTime()
}

/**
 * Start the rent increase scheduler
 * Runs daily at 00:01
 */
export function startRentIncreaseScheduler(): void {
  console.log('[RentIncreaseScheduler] Starting rent increase scheduler...')

  // Run immediately on startup (after a short delay)
  setTimeout(async () => {
    await applyPendingRentIncreases()
  }, 15000) // Wait 15 seconds after startup

  // Schedule first run at 00:01
  const msToMidnight = msUntilNextMidnight()
  console.log(`[RentIncreaseScheduler] Next scheduled run in ${Math.round(msToMidnight / 1000 / 60)} minutes (00:01)`)

  setTimeout(() => {
    // Run at 00:01
    console.log('[RentIncreaseScheduler] Running scheduled rent increase check (00:01)...')
    applyPendingRentIncreases()

    // Then run every 24 hours
    setInterval(async () => {
      console.log('[RentIncreaseScheduler] Running daily rent increase check (00:01)...')
      await applyPendingRentIncreases()
    }, RENT_INCREASE_CHECK_INTERVAL_MS)
  }, msToMidnight)
}

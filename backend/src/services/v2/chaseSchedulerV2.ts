/**
 * V2 Chase Scheduler
 *
 * Background job that processes the chase queue.
 * Moves items from WAITING to IN_CHASE_QUEUE after 24 hours.
 */

import { processChaseQueue } from './chaseServiceV2'

// Scheduler state
let schedulerInterval: NodeJS.Timeout | null = null
let isRunning = false

// Default interval: 15 minutes
const DEFAULT_INTERVAL_MS = 15 * 60 * 1000

/**
 * Start the chase queue scheduler
 */
export function startChaseSchedulerV2(intervalMs: number = DEFAULT_INTERVAL_MS): void {
  if (schedulerInterval) {
    console.log('[ChaseSchedulerV2] Scheduler already running')
    return
  }

  console.log(`[ChaseSchedulerV2] Starting scheduler (interval: ${intervalMs / 1000 / 60} minutes)`)

  // Run immediately on start
  runChaseProcessing()

  // Then run on interval
  schedulerInterval = setInterval(runChaseProcessing, intervalMs)
}

/**
 * Stop the chase queue scheduler
 */
export function stopChaseSchedulerV2(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
    console.log('[ChaseSchedulerV2] Scheduler stopped')
  }
}

/**
 * Run chase processing (called by scheduler)
 */
async function runChaseProcessing(): Promise<void> {
  if (isRunning) {
    console.log('[ChaseSchedulerV2] Previous run still in progress, skipping')
    return
  }

  isRunning = true

  try {
    console.log('[ChaseSchedulerV2] Processing chase queue...')
    const processed = await processChaseQueue()

    if (processed > 0) {
      console.log(`[ChaseSchedulerV2] Moved ${processed} items to chase queue`)
    }
  } catch (error) {
    console.error('[ChaseSchedulerV2] Error processing chase queue:', error)
  } finally {
    isRunning = false
  }
}

/**
 * Manually trigger chase processing
 */
export async function triggerChaseProcessing(): Promise<number> {
  try {
    return await processChaseQueue()
  } catch (error) {
    console.error('[ChaseSchedulerV2] Error in manual trigger:', error)
    return 0
  }
}

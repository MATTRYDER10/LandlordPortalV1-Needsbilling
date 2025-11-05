import { supabase as supabaseAdmin } from '../config/supabase';

/**
 * Work Queue Scheduler Service
 *
 * Handles:
 * 1. Auto-unassigning idle CHASE items after 4 hours of no activity
 * 2. Making cooldown items visible again after cooldown period expires
 * 3. Escalating urgent items (>8 hours old) with priority boost
 */

const IDLE_TIMEOUT_HOURS = 4;
const COOLDOWN_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const IDLE_CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const URGENCY_THRESHOLD_HOURS = 8;

/**
 * Auto-unassign CHASE work items that have been idle for 4+ hours
 * An item is considered idle if:
 * - Status is ASSIGNED or IN_PROGRESS
 * - Work type is CHASE
 * - No activity (contact attempts or updates) in the last 4 hours
 */
export async function autoUnassignIdleChaseItems() {
  try {
    const fourHoursAgo = new Date();
    fourHoursAgo.setHours(fourHoursAgo.getHours() - IDLE_TIMEOUT_HOURS);

    // Find idle CHASE items
    const { data: idleItems, error: fetchError } = await supabaseAdmin
      .from('work_items')
      .select('id, reference_id, assigned_to, last_activity_at')
      .eq('work_type', 'CHASE')
      .in('status', ['ASSIGNED', 'IN_PROGRESS'])
      .lt('last_activity_at', fourHoursAgo.toISOString());

    if (fetchError) {
      console.error('Error fetching idle CHASE items:', fetchError);
      return { success: false, error: fetchError.message };
    }

    if (!idleItems || idleItems.length === 0) {
      console.log('[Scheduler] No idle CHASE items found');
      return { success: true, unassignedCount: 0 };
    }

    console.log(`[Scheduler] Found ${idleItems.length} idle CHASE items to unassign`);

    // Unassign each item
    const { error: updateError } = await supabaseAdmin
      .from('work_items')
      .update({
        status: 'RETURNED',
        assigned_to: null,
        assigned_at: null,
        last_activity_at: new Date().toISOString()
      })
      .in('id', idleItems.map(item => item.id));

    if (updateError) {
      console.error('Error unassigning idle items:', updateError);
      return { success: false, error: updateError.message };
    }

    // Log to audit for each item
    for (const item of idleItems) {
      await supabaseAdmin.from('reference_audit_log').insert({
        reference_id: item.reference_id,
        action: 'AUTO_UNASSIGNED',
        details: {
          work_item_id: item.id,
          reason: 'No activity for 4+ hours',
          last_activity_at: item.last_activity_at
        },
        performed_by: null // System action
      });
    }

    console.log(`[Scheduler] Successfully unassigned ${idleItems.length} idle CHASE items`);
    return { success: true, unassignedCount: idleItems.length };
  } catch (error: any) {
    console.error('[Scheduler] Error in autoUnassignIdleChaseItems:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Reset status of items past their cooldown period
 * Items in RETURNED status with cooldown_until in the past should become AVAILABLE
 */
export async function processCooldownExpiry() {
  try {
    const now = new Date().toISOString();

    // Find items past cooldown
    const { data: expiredItems, error: fetchError } = await supabaseAdmin
      .from('work_items')
      .select('id, reference_id')
      .eq('status', 'RETURNED')
      .not('cooldown_until', 'is', null)
      .lte('cooldown_until', now);

    if (fetchError) {
      console.error('Error fetching expired cooldown items:', fetchError);
      return { success: false, error: fetchError.message };
    }

    if (!expiredItems || expiredItems.length === 0) {
      console.log('[Scheduler] No expired cooldown items found');
      return { success: true, resetCount: 0 };
    }

    console.log(`[Scheduler] Found ${expiredItems.length} items past cooldown`);

    // Reset to AVAILABLE and clear cooldown
    const { error: updateError } = await supabaseAdmin
      .from('work_items')
      .update({
        status: 'AVAILABLE',
        cooldown_until: null,
        last_activity_at: new Date().toISOString()
      })
      .in('id', expiredItems.map(item => item.id));

    if (updateError) {
      console.error('Error resetting cooldown items:', updateError);
      return { success: false, error: updateError.message };
    }

    // Log to audit
    for (const item of expiredItems) {
      await supabaseAdmin.from('reference_audit_log').insert({
        reference_id: item.reference_id,
        action: 'COOLDOWN_EXPIRED',
        details: {
          work_item_id: item.id,
          status_changed_to: 'AVAILABLE'
        },
        performed_by: null // System action
      });
    }

    console.log(`[Scheduler] Successfully reset ${expiredItems.length} items after cooldown`);
    return { success: true, resetCount: expiredItems.length };
  } catch (error: any) {
    console.error('[Scheduler] Error in processCooldownExpiry:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Escalate urgent items (>8 hours old) with priority boost
 * Items available for 8+ hours get priority increased
 */
export async function escalateUrgentItems() {
  try {
    const urgentThreshold = new Date();
    urgentThreshold.setHours(urgentThreshold.getHours() - URGENCY_THRESHOLD_HOURS);

    // Find old items that haven't been escalated yet
    const { data: urgentItems, error: fetchError } = await supabaseAdmin
      .from('work_items')
      .select('id, reference_id, priority, created_at')
      .eq('status', 'AVAILABLE')
      .lt('created_at', urgentThreshold.toISOString())
      .lt('priority', 10); // Only boost if not already max priority

    if (fetchError) {
      console.error('Error fetching urgent items:', fetchError);
      return { success: false, error: fetchError.message };
    }

    if (!urgentItems || urgentItems.length === 0) {
      console.log('[Scheduler] No urgent items to escalate');
      return { success: true, escalatedCount: 0 };
    }

    console.log(`[Scheduler] Found ${urgentItems.length} urgent items to escalate`);

    // Boost priority for each item
    for (const item of urgentItems) {
      const newPriority = Math.min(item.priority + 5, 10); // Cap at 10

      await supabaseAdmin
        .from('work_items')
        .update({
          priority: newPriority,
          last_activity_at: new Date().toISOString(),
          metadata: {
            ...((item as any).metadata || {}),
            escalated_at: new Date().toISOString(),
            urgent: true
          }
        })
        .eq('id', item.id);

      // Log to audit
      await supabaseAdmin.from('reference_audit_log').insert({
        reference_id: item.reference_id,
        action: 'ITEM_ESCALATED',
        details: {
          work_item_id: item.id,
          old_priority: item.priority,
          new_priority: newPriority,
          age_hours: Math.floor((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60))
        },
        performed_by: null // System action
      });
    }

    console.log(`[Scheduler] Successfully escalated ${urgentItems.length} urgent items`);
    return { success: true, escalatedCount: urgentItems.length };
  } catch (error: any) {
    console.error('[Scheduler] Error in escalateUrgentItems:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Start all background schedulers
 */
export function startSchedulers() {
  console.log('[Scheduler] Starting work queue background schedulers...');

  // Cooldown expiry check (every 5 minutes)
  setInterval(async () => {
    console.log('[Scheduler] Running cooldown expiry check...');
    await processCooldownExpiry();
  }, COOLDOWN_CHECK_INTERVAL_MS);

  // Idle check (every 15 minutes)
  setInterval(async () => {
    console.log('[Scheduler] Running idle CHASE item check...');
    await autoUnassignIdleChaseItems();
  }, IDLE_CHECK_INTERVAL_MS);

  // Urgent escalation (every 15 minutes)
  setInterval(async () => {
    console.log('[Scheduler] Running urgent item escalation...');
    await escalateUrgentItems();
  }, IDLE_CHECK_INTERVAL_MS);

  // Run immediately on startup
  setTimeout(async () => {
    console.log('[Scheduler] Running initial checks...');
    await processCooldownExpiry();
    await autoUnassignIdleChaseItems();
    await escalateUrgentItems();
  }, 5000); // Wait 5 seconds after startup

  console.log('[Scheduler] Background schedulers started successfully');
}

/**
 * Manual trigger functions for testing/admin
 */
export async function runAllScheduledTasks() {
  console.log('[Scheduler] Running all scheduled tasks manually...');

  const results = {
    cooldown: await processCooldownExpiry(),
    idle: await autoUnassignIdleChaseItems(),
    urgent: await escalateUrgentItems()
  };

  console.log('[Scheduler] Manual run complete:', results);
  return results;
}

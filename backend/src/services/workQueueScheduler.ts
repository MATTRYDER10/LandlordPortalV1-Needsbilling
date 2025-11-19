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
const VERIFY_SYNC_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
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
 * Ensure VERIFY work items exist for all references in pending_verification
 */
export async function syncMissingVerifyItems() {
  try {
    const { data: pendingReferences, error: pendingError } = await supabaseAdmin
      .from('tenant_references')
      .select('id')
      .eq('status', 'pending_verification');

    if (pendingError) {
      console.error('Error fetching pending verification references:', pendingError);
      return { success: false, error: pendingError.message };
    }

    if (!pendingReferences || pendingReferences.length === 0) {
      console.log('[Scheduler] No pending references found for verify sync');
      return { success: true, createdCount: 0 };
    }

    const referenceIds = pendingReferences.map(ref => ref.id);

    const { data: existingVerifyItems, error: existingError } = await supabaseAdmin
      .from('work_items')
      .select('reference_id')
      .eq('work_type', 'VERIFY')
      .in('reference_id', referenceIds);

    if (existingError) {
      console.error('Error fetching existing verify work items:', existingError);
      return { success: false, error: existingError.message };
    }

    const existingReferenceIds = new Set(existingVerifyItems?.map(item => item.reference_id) || []);
    const missingReferenceIds = referenceIds.filter(id => !existingReferenceIds.has(id));

    if (missingReferenceIds.length === 0) {
      console.log('[Scheduler] All pending references already have verify work items');
      return { success: true, createdCount: 0 };
    }

    const now = new Date().toISOString();
    const newItems = missingReferenceIds.map(referenceId => ({
      reference_id: referenceId,
      work_type: 'VERIFY',
      status: 'AVAILABLE',
      priority: 0,
      last_activity_at: now
    }));

    const { error: insertError } = await supabaseAdmin
      .from('work_items')
      .insert(newItems);

    if (insertError) {
      console.error('Error inserting missing verify work items:', insertError);
      return { success: false, error: insertError.message };
    }

    console.log(`[Scheduler] Created ${missingReferenceIds.length} missing verify work items`);
    return { success: true, createdCount: missingReferenceIds.length };
  } catch (error: any) {
    console.error('[Scheduler] Error in syncMissingVerifyItems:', error);
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

  // Verify sync (every 10 minutes)
  setInterval(async () => {
    console.log('[Scheduler] Running verify work item sync...');
    await syncMissingVerifyItems();
  }, VERIFY_SYNC_INTERVAL_MS);

  // Run immediately on startup
  setTimeout(async () => {
    console.log('[Scheduler] Running initial checks...');
    await processCooldownExpiry();
    await autoUnassignIdleChaseItems();
    await escalateUrgentItems();
    await syncMissingVerifyItems();
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

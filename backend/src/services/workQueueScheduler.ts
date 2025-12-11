import { supabase as supabaseAdmin } from '../config/supabase';
import * as creditService from './creditService';
import { signatureService } from './signatureService';

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
const EXPIRED_REFERENCE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const SIGNING_REMINDER_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const SIGNING_REMINDER_THRESHOLD_HOURS = 24; // Send reminders every 24 hours

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
 * Auto-delete expired unfilled references and refund credits
 * References are considered expired if:
 * - Status is 'pending' (tenant hasn't started filling it out)
 * - Token has expired (token_expires_at is in the past)
 */
export async function autoDeleteExpiredReferences() {
  try {
    const now = new Date().toISOString();

    // Find expired pending references
    const { data: expiredReferences, error: fetchError } = await supabaseAdmin
      .from('tenant_references')
      .select('id, company_id, parent_reference_id')
      .eq('status', 'pending')
      .lt('token_expires_at', now);

    if (fetchError) {
      console.error('Error fetching expired references:', fetchError);
      return { success: false, error: fetchError.message };
    }

    if (!expiredReferences || expiredReferences.length === 0) {
      console.log('[Scheduler] No expired unfilled references found');
      return { success: true, deletedCount: 0, refundedCredits: 0 };
    }

    console.log(`[Scheduler] Found ${expiredReferences.length} expired unfilled references`);

    let deletedCount = 0;
    let refundedCredits = 0;

    for (const reference of expiredReferences) {
      try {
        // Only refund for main references (not guarantor references which are linked to parents)
        const isMainReference = !reference.parent_reference_id;

        if (isMainReference) {
          // Check for any linked guarantor references that are also pending
          const { data: guarantorRefs } = await supabaseAdmin
            .from('tenant_references')
            .select('id, status')
            .eq('parent_reference_id', reference.id);

          // Calculate credits to refund: 1 for main + 0.5 for each pending guarantor
          let creditsToRefund = 1;
          const pendingGuarantors = guarantorRefs?.filter(g => g.status === 'pending') || [];
          creditsToRefund += pendingGuarantors.length * 0.5;

          // Delete guarantor references first
          if (guarantorRefs && guarantorRefs.length > 0) {
            const { error: deleteGuarantorsError } = await supabaseAdmin
              .from('tenant_references')
              .delete()
              .in('id', guarantorRefs.map(g => g.id));

            if (deleteGuarantorsError) {
              console.error(`Error deleting guarantor references for ${reference.id}:`, deleteGuarantorsError);
              continue;
            }
          }

          // Refund credits (1 for main reference + 0.5 for each pending guarantor)
          try {
            await creditService.refundCredits(
              reference.company_id,
              creditsToRefund,
              reference.id,
              `Auto-refund: Reference expired (unfilled after 21 days)${pendingGuarantors.length > 0 ? ` + ${pendingGuarantors.length} guarantor(s)` : ''}`
            );
            refundedCredits += creditsToRefund;
            console.log(`[Scheduler] Refunded ${creditsToRefund} credit(s) for expired reference ${reference.id}`);
          } catch (refundError: any) {
            console.error(`Error refunding credits for ${reference.id}:`, refundError);
          }
        }

        // Delete the reference
        const { error: deleteError } = await supabaseAdmin
          .from('tenant_references')
          .delete()
          .eq('id', reference.id);

        if (deleteError) {
          console.error(`Error deleting expired reference ${reference.id}:`, deleteError);
          continue;
        }

        deletedCount++;

        // Log to audit
        await supabaseAdmin.from('reference_audit_log').insert({
          reference_id: reference.id,
          action: 'AUTO_DELETED_EXPIRED',
          details: {
            reason: 'Reference expired without tenant filling it out (21 days)',
            was_main_reference: isMainReference
          },
          performed_by: null // System action
        });

      } catch (refError: any) {
        console.error(`Error processing expired reference ${reference.id}:`, refError);
      }
    }

    console.log(`[Scheduler] Successfully deleted ${deletedCount} expired references, refunded ${refundedCredits} credits`);
    return { success: true, deletedCount, refundedCredits };
  } catch (error: any) {
    console.error('[Scheduler] Error in autoDeleteExpiredReferences:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send signing reminders to signers who haven't signed
 * Reminders are sent every 24 hours until signed or expired
 */
export async function sendSigningReminders() {
  try {
    const reminderThreshold = new Date();
    reminderThreshold.setHours(reminderThreshold.getHours() - SIGNING_REMINDER_THRESHOLD_HOURS);

    // Find signatures that need reminders:
    // - Status is 'pending' or 'sent' or 'viewed'
    // - Token hasn't expired
    // - Last email was sent more than 24 hours ago
    const now = new Date().toISOString();
    const { data: pendingSignatures, error: fetchError } = await supabaseAdmin
      .from('agreement_signatures')
      .select('id, agreement_id, signer_name, signer_email, signer_type, signing_token, token_expires_at, last_email_sent_at, email_send_count')
      .in('status', ['pending', 'sent', 'viewed'])
      .gt('token_expires_at', now) // Token not expired
      .lt('last_email_sent_at', reminderThreshold.toISOString());

    if (fetchError) {
      console.error('Error fetching pending signatures for reminders:', fetchError);
      return { success: false, error: fetchError.message };
    }

    if (!pendingSignatures || pendingSignatures.length === 0) {
      console.log('[Scheduler] No pending signatures need reminders');
      return { success: true, remindersSent: 0 };
    }

    console.log(`[Scheduler] Found ${pendingSignatures.length} signatures needing reminders`);

    let remindersSent = 0;
    for (const signature of pendingSignatures) {
      try {
        // Use the existing service method which handles everything
        await signatureService.sendReminderEmail(signature.id);
        remindersSent++;
      } catch (sendError: any) {
        console.error(`Error sending reminder for signature ${signature.id}:`, sendError);
      }
    }

    console.log(`[Scheduler] Successfully sent ${remindersSent} signing reminders`);
    return { success: true, remindersSent };
  } catch (error: any) {
    console.error('[Scheduler] Error in sendSigningReminders:', error);
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

  // Expired reference cleanup (every 1 hour)
  setInterval(async () => {
    console.log('[Scheduler] Running expired reference cleanup...');
    await autoDeleteExpiredReferences();
  }, EXPIRED_REFERENCE_CHECK_INTERVAL_MS);

  // Signing reminders (every 1 hour, checks 24-hour threshold)
  setInterval(async () => {
    console.log('[Scheduler] Running signing reminder check...');
    await sendSigningReminders();
  }, SIGNING_REMINDER_CHECK_INTERVAL_MS);

  // Run immediately on startup
  setTimeout(async () => {
    console.log('[Scheduler] Running initial checks...');
    await processCooldownExpiry();
    await autoUnassignIdleChaseItems();
    await escalateUrgentItems();
    await syncMissingVerifyItems();
    await autoDeleteExpiredReferences();
    await sendSigningReminders();
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
    urgent: await escalateUrgentItems(),
    expiredReferences: await autoDeleteExpiredReferences(),
    signingReminders: await sendSigningReminders()
  };

  console.log('[Scheduler] Manual run complete:', results);
  return results;
}

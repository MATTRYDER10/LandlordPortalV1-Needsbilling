import { Router, Request, Response } from 'express';
import { authenticateStaff as staffAuth, StaffAuthRequest } from '../middleware/staffAuth';
import { supabase as supabaseAdmin } from '../config/supabase';
import { decrypt, encrypt, generateToken, hash } from '../services/encryption';
import { sendTenantReferenceRequest, sendEmployerReferenceRequest, sendLandlordReferenceRequest, sendAgentReferenceRequest, sendAccountantReferenceRequest, sendGuarantorReferenceRequest } from '../services/emailService';
import { sendTenantReferenceRequestSMS, sendLandlordReferenceRequestSMS, sendEmployerReferenceRequestSMS, sendAccountantReferenceRequestSMS, sendAgentReferenceRequestSMS, sendGuarantorReferenceRequestSMS } from '../services/smsService';
import { logAuditAction } from '../services/auditService';
import { isValidEmail } from '../utils/validation';
import { acquireLock, releaseLock, extendLock, checkLockStatus, getStaffLocks, forceReleaseLock } from '../services/lockService';
import { isReadyForVerification } from '../services/verificationReadinessService';
import { transitionState } from '../services/verificationStateService';

const router = Router();

// Get work queue items (filterable by type, status)
router.get('/', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { type, status, assigned_to } = req.query;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    let query = supabaseAdmin
      .from('work_items')
      .select(`
        *,
        reference:tenant_references!work_items_reference_id_fkey (
          id,
          tenant_first_name_encrypted,
          tenant_last_name_encrypted,
          tenant_email_encrypted,
          property_address_encrypted,
          is_guarantor,
          status,
          created_at
        ),
        assigned_staff:staff_users!work_items_assigned_to_fkey (
          id,
          user_id,
          full_name
        )
      `)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    // Filter by work type
    if (type && ['CHASE', 'VERIFY'].includes(type as string)) {
      query = query.eq('work_type', type);
    }

    // Filter by status
    if (status) {
      query = query.eq('status', status);
    } else {
      // Default: show all active items (not completed)
      query = query.in('status', ['AVAILABLE', 'ASSIGNED', 'IN_PROGRESS', 'RETURNED']);
    }

    // Filter by assigned staff
    if (assigned_to === 'me') {
      query = query.eq('assigned_to', staffUser.id);
    } else if (assigned_to) {
      query = query.eq('assigned_to', assigned_to);
    }

    // Filter out items still in cooldown
    query = query.or('cooldown_until.is.null,cooldown_until.lte.now()');

    const { data: workItems, error } = await query;

    if (error) throw error;

    // Filter out work items where the reference is already completed/rejected
    const validWorkItems = workItems?.filter((item: any) => {
      if (!item.reference) return false;
      if (item.reference.status === 'completed' || item.reference.status === 'rejected') {
        return false;
      }
      return true;
    });

    // Calculate urgency based on age and decrypt reference data
    const enrichedWorkItems = validWorkItems?.map((item: any) => {
      const ageHours = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60);
      let urgency = 'normal';
      if (ageHours >= 8) urgency = 'urgent';
      else if (ageHours >= 4) urgency = 'warning';

      // Decrypt tenant reference data
      const decryptedReference = item.reference ? {
        ...item.reference,
        tenant_first_name: decrypt(item.reference.tenant_first_name_encrypted),
        tenant_last_name: decrypt(item.reference.tenant_last_name_encrypted),
        tenant_email: decrypt(item.reference.tenant_email_encrypted),
        property_address: decrypt(item.reference.property_address_encrypted)
      } : null;

      return {
        ...item,
        reference: decryptedReference,
        ageHours: Math.floor(ageHours),
        urgency
      };
    });

    res.json({ workItems: enrichedWorkItems });
  } catch (error: any) {
    console.error('Error fetching work queue:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get stats for work queue dashboard
router.get('/stats', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const staffUser = req.staffUser;
    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    // Get VERIFY work_items with reference data for filtering
    const { data: verifyItems, error: verifyError } = await supabaseAdmin
      .from('work_items')
      .select(`
        id,
        reference_id,
        status,
        metadata,
        assigned_to,
        cooldown_until,
        reference:tenant_references!work_items_reference_id_fkey (status)
      `)
      .eq('work_type', 'VERIFY')
      .in('status', ['AVAILABLE', 'ASSIGNED', 'IN_PROGRESS', 'RETURNED']);

    if (verifyError) throw verifyError;

    // Get CHASE dependencies count (items ready to chase - 8+ hours since initial/last chase)
    const eightHoursAgo = new Date();
    eightHoursAgo.setHours(eightHoursAgo.getHours() - 8);

    const { data: chaseDeps, error: chaseError } = await supabaseAdmin
      .from('chase_dependencies')
      .select(`
        id,
        initial_request_sent_at,
        last_chase_sent_at,
        reference:tenant_references!chase_dependencies_reference_id_fkey (status)
      `)
      .in('status', ['PENDING', 'CHASING']);

    if (chaseError) throw chaseError;

    // Filter chase dependencies by 8-hour rule and reference status
    const excludedRefStatuses = ['completed', 'rejected', 'cancelled', 'action_required', 'pending_verification'];
    const activeChaseCount = (chaseDeps || []).filter((dep: any) => {
      if (!dep.reference) return false;
      if (excludedRefStatuses.includes(dep.reference.status)) return false;
      if (!dep.initial_request_sent_at) return false;

      const relevantTimestamp = dep.last_chase_sent_at || dep.initial_request_sent_at;
      const timestampDate = new Date(relevantTimestamp);
      return timestampDate <= eightHoursAgo;
    }).length;

    // Get email issues count
    const { data: emailIssues, error: emailError } = await supabaseAdmin
      .from('email_delivery_logs')
      .select(`
        id,
        reference:tenant_references!email_delivery_logs_reference_id_fkey (status)
      `)
      .in('status', ['bounced', 'complained']);

    if (emailError) throw emailError;

    // Filter out issues where reference is completed/rejected
    const excludedEmailStatuses = ['completed', 'rejected', 'cancelled'];
    const activeEmailIssues = (emailIssues || []).filter((issue: any) => {
      if (!issue.reference) return false;
      return !excludedEmailStatuses.includes(issue.reference.status);
    });

    const summary = {
      chase: {
        available: activeChaseCount,
        assigned: 0,
        inProgress: 0,
        myItems: 0,
        total: activeChaseCount
      },
      verify: {
        available: 0,
        assigned: 0,
        inProgress: 0,
        awaitingDocs: 0,
        myItems: 0,
        total: 0
      },
      emailIssues: {
        total: activeEmailIssues.length
      }
    };

    // Filter verify items same as /api/verify/queue does
    const excludedVerifyStatuses = ['completed', 'rejected', 'action_required', 'cancelled'];
    const now = new Date();

    // Check readiness for each item (same as verify queue endpoint)
    const readyItems = await Promise.all(
      (verifyItems || []).map(async (item: any) => {
        // Filter out items with excluded reference status
        if (!item.reference) return null;
        if (excludedVerifyStatuses.includes(item.reference.status)) return null;

        // Filter out items in cooldown
        if (item.cooldown_until && new Date(item.cooldown_until) > now) return null;

        // Check if reference is actually ready for verification
        const readiness = await isReadyForVerification(item.reference_id);
        if (!readiness.isReady) return null;

        return item;
      })
    );

    // Count the ready items
    readyItems.filter(item => item !== null).forEach((item: any) => {
      const status = item.status.toLowerCase();

      // RETURNED items are treated as available since they can be picked up
      if (status === 'available' || status === 'returned') summary.verify.available++;
      else if (status === 'assigned') summary.verify.assigned++;
      else if (status === 'in_progress') summary.verify.inProgress++;

      // Count awaiting docs items
      if (item.metadata?.awaiting_documentation === true) {
        summary.verify.awaitingDocs++;
      }

      // Count my items
      if (item.assigned_to === staffUser.id && (status === 'assigned' || status === 'in_progress')) {
        summary.verify.myItems++;
      }
    });

    summary.verify.total = summary.verify.available + summary.verify.assigned + summary.verify.inProgress;

    res.json({ stats: summary });
  } catch (error: any) {
    console.error('Error fetching work queue stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get my active tasks (unified view of both VERIFY and CHASE)
router.get('/my-tasks', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const staffUser = req.staffUser;
    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const { data: workItems, error } = await supabaseAdmin
      .from('work_items')
      .select(`
        *,
        reference:tenant_references!work_items_reference_id_fkey (
          id,
          tenant_first_name_encrypted,
          tenant_last_name_encrypted,
          property_address_encrypted,
          is_guarantor
        )
      `)
      .eq('assigned_to', staffUser.id)
      .in('status', ['ASSIGNED', 'IN_PROGRESS'])
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Transform to ActiveTask format
    const tasks = workItems?.map((item: any) => {
      const hoursInQueue = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60);
      let urgency: 'NORMAL' | 'WARNING' | 'URGENT' = 'NORMAL';
      if (hoursInQueue >= 48) urgency = 'URGENT';
      else if (hoursInQueue >= 24) urgency = 'WARNING';

      return {
        id: item.id,
        referenceId: item.reference_id,
        workType: item.work_type,
        status: item.status,
        personName: item.reference ?
          `${decrypt(item.reference.tenant_first_name_encrypted) || ''} ${decrypt(item.reference.tenant_last_name_encrypted) || ''}`.trim() :
          'Unknown',
        personRole: item.reference?.is_guarantor ? 'GUARANTOR' : 'TENANT',
        propertyAddress: item.reference ? decrypt(item.reference.property_address_encrypted) || '' : '',
        urgency,
        hoursInQueue: Math.floor(hoursInQueue),
        createdAt: item.created_at,
        dependencyId: item.dependency_id,
        dependencyType: item.dependency_type,
        dependencyStatus: item.dependency_status
      };
    }) || [];

    res.json({ tasks });
  } catch (error: any) {
    console.error('Error fetching my tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single work item by ID
router.get('/:id', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const { data: workItem, error } = await supabaseAdmin
      .from('work_items')
      .select(`
        *,
        reference:tenant_references!work_items_reference_id_fkey (
          id,
          tenant_first_name_encrypted,
          tenant_last_name_encrypted,
          tenant_email_encrypted,
          tenant_phone_encrypted,
          property_address_encrypted,
          is_guarantor,
          status,
          created_at,
          previous_address_type,
          previous_landlord_name_encrypted,
          previous_landlord_email_encrypted,
          previous_landlord_phone_encrypted,
          employer_ref_name_encrypted,
          employer_ref_email_encrypted,
          employer_ref_phone_encrypted,
          accountant_name_encrypted,
          accountant_email_encrypted,
          accountant_phone_encrypted,
          guarantor_first_name_encrypted,
          guarantor_last_name_encrypted,
          guarantor_email_encrypted,
          guarantor_phone_encrypted
        ),
        assigned_staff:staff_users!work_items_assigned_to_fkey (id, user_id, full_name),
        contact_attempts (
          id,
          channel,
          contact_type,
          recipient_name,
          recipient_contact,
          outcome,
          notes,
          created_at,
          created_by_staff:staff_users!contact_attempts_created_by_fkey (full_name)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!workItem) {
      return res.status(404).json({ error: 'Work item not found' });
    }

    // Decrypt tenant reference data
    const decryptedReference = workItem.reference ? {
      ...workItem.reference,
      tenant_first_name: decrypt(workItem.reference.tenant_first_name_encrypted),
      tenant_last_name: decrypt(workItem.reference.tenant_last_name_encrypted),
      tenant_email: decrypt(workItem.reference.tenant_email_encrypted),
      tenant_phone: decrypt(workItem.reference.tenant_phone_encrypted),
      property_address: decrypt(workItem.reference.property_address_encrypted),
      // Landlord/Agent fields (previous_address_type determines which)
      previous_landlord_name: decrypt(workItem.reference.previous_landlord_name_encrypted),
      previous_landlord_email: decrypt(workItem.reference.previous_landlord_email_encrypted),
      previous_landlord_phone: decrypt(workItem.reference.previous_landlord_phone_encrypted),
      // Employer fields
      employer_ref_name: decrypt(workItem.reference.employer_ref_name_encrypted),
      employer_ref_email: decrypt(workItem.reference.employer_ref_email_encrypted),
      employer_ref_phone: decrypt(workItem.reference.employer_ref_phone_encrypted),
      // Accountant fields
      accountant_name: decrypt(workItem.reference.accountant_name_encrypted),
      accountant_email: decrypt(workItem.reference.accountant_email_encrypted),
      accountant_phone: decrypt(workItem.reference.accountant_phone_encrypted),
      // Guarantor fields
      guarantor_first_name: decrypt(workItem.reference.guarantor_first_name_encrypted),
      guarantor_last_name: decrypt(workItem.reference.guarantor_last_name_encrypted),
      guarantor_email: decrypt(workItem.reference.guarantor_email_encrypted),
      guarantor_phone: decrypt(workItem.reference.guarantor_phone_encrypted)
    } : null;

    res.json({
      workItem: {
        ...workItem,
        reference: decryptedReference
      }
    });
  } catch (error: any) {
    console.error('Error fetching work item:', error);
    res.status(500).json({ error: error.message });
  }
});

// Claim/assign a work item to current staff
router.post('/:id/claim', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    // Check if item is available
    const { data: workItem, error: fetchError } = await supabaseAdmin
      .from('work_items')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!workItem) {
      return res.status(404).json({ error: 'Work item not found' });
    }

    if (workItem.status !== 'AVAILABLE' && workItem.status !== 'RETURNED') {
      return res.status(400).json({ error: 'Work item is not available', currentStatus: workItem.status });
    }

    // Check cooldown
    if (workItem.cooldown_until && new Date(workItem.cooldown_until) > new Date()) {
      return res.status(400).json({ error: 'Work item is in cooldown period' });
    }

    // Assign to current staff
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('work_items')
      .update({
        status: 'ASSIGNED',
        assigned_to: staffUser.id,
        assigned_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // If this is a VERIFY work item, transition state to IN_VERIFICATION
    if (workItem.work_type === 'VERIFY') {
      await transitionState(
        workItem.reference_id,
        'IN_VERIFICATION',
        'Staff claimed work item for verification',
        staffUser.id
      );
    }

    // Log to audit
    await supabaseAdmin.from('reference_audit_log').insert({
      reference_id: workItem.reference_id,
      action: 'WORK_ITEM_CLAIMED',
      details: { work_item_id: id, work_type: workItem.work_type },
      performed_by: staffUser.id
    });

    res.json({ workItem: updated, message: 'Work item claimed successfully' });
  } catch (error: any) {
    console.error('Error claiming work item:', error);
    res.status(500).json({ error: error.message });
  }
});

// Release/return work item to queue
router.post('/:id/release', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { cooldownHours } = req.body; // Optional cooldown period
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const { data: workItem, error: fetchError } = await supabaseAdmin
      .from('work_items')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!workItem) {
      return res.status(404).json({ error: 'Work item not found' });
    }

    // Calculate cooldown time
    let cooldownUntil = null;
    if (cooldownHours && cooldownHours > 0) {
      const cooldownDate = new Date();
      cooldownDate.setHours(cooldownDate.getHours() + cooldownHours);
      cooldownUntil = cooldownDate.toISOString();
    }

    // Return to queue
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('work_items')
      .update({
        status: 'RETURNED',
        assigned_to: null,
        assigned_at: null,
        cooldown_until: cooldownUntil,
        last_activity_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // If this is a VERIFY work item, transition state back to READY_FOR_REVIEW
    if (workItem.work_type === 'VERIFY') {
      await transitionState(
        workItem.reference_id,
        'READY_FOR_REVIEW',
        'Staff released work item back to queue',
        staffUser.id
      );
    }

    // Log to audit
    await supabaseAdmin.from('reference_audit_log').insert({
      reference_id: workItem.reference_id,
      action: 'WORK_ITEM_RELEASED',
      details: { work_item_id: id, cooldown_hours: cooldownHours },
      performed_by: staffUser.id
    });

    res.json({ workItem: updated, message: 'Work item returned to queue' });
  } catch (error: any) {
    console.error('Error releasing work item:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update work item status (e.g., move to IN_PROGRESS)
router.patch('/:id/status', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    if (!['AVAILABLE', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'RETURNED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const { data: workItem, error: fetchError } = await supabaseAdmin
      .from('work_items')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!workItem) {
      return res.status(404).json({ error: 'Work item not found' });
    }

    // Prevent marking VERIFY work items as COMPLETED directly
    // They must go through the /verify/finalize/:referenceId endpoint
    // to ensure the reference status is also updated
    if (status === 'COMPLETED' && workItem.work_type === 'VERIFY') {
      return res.status(400).json({
        error: 'VERIFY work items cannot be marked as COMPLETED directly. Use the finalize endpoint instead.'
      });
    }

    const updates: any = {
      status,
      last_activity_at: new Date().toISOString()
    };

    if (status === 'COMPLETED') {
      updates.completed_at = new Date().toISOString();
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('work_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log to audit
    await supabaseAdmin.from('reference_audit_log').insert({
      reference_id: workItem.reference_id,
      action: 'WORK_ITEM_STATUS_CHANGED',
      details: { work_item_id: id, new_status: status },
      performed_by: staffUser.id
    });

    res.json({ workItem: updated });
  } catch (error: any) {
    console.error('Error updating work item status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Push CHASE item to VERIFY queue
router.post('/:id/push-to-verify', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const { data: chaseItem, error: fetchError } = await supabaseAdmin
      .from('work_items')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!chaseItem) {
      return res.status(404).json({ error: 'Work item not found' });
    }

    if (chaseItem.work_type !== 'CHASE') {
      return res.status(400).json({ error: 'Can only push CHASE items to verify' });
    }

    // Mark CHASE item as completed
    await supabaseAdmin
      .from('work_items')
      .update({
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString()
      })
      .eq('id', id);

    // Create VERIFY work item
    const { data: verifyItem, error: createError } = await supabaseAdmin
      .from('work_items')
      .insert({
        reference_id: chaseItem.reference_id,
        work_type: 'VERIFY',
        status: 'AVAILABLE',
        priority: chaseItem.priority
      })
      .select()
      .single();

    if (createError) throw createError;

    // Log to audit
    await supabaseAdmin.from('reference_audit_log').insert({
      reference_id: chaseItem.reference_id,
      action: 'PUSHED_TO_VERIFY',
      details: { chase_item_id: id, verify_item_id: verifyItem.id },
      performed_by: staffUser.id
    });

    res.json({ verifyItem, message: 'Pushed to verify queue successfully' });
  } catch (error: any) {
    console.error('Error pushing to verify:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify now (complete CHASE and start VERIFY immediately)
router.post('/:id/verify-now', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const { data: chaseItem, error: fetchError } = await supabaseAdmin
      .from('work_items')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!chaseItem) {
      return res.status(404).json({ error: 'Work item not found' });
    }

    if (chaseItem.work_type !== 'CHASE') {
      return res.status(400).json({ error: 'Can only transition CHASE items to verify' });
    }

    // Mark CHASE item as completed
    await supabaseAdmin
      .from('work_items')
      .update({
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString()
      })
      .eq('id', id);

    // Create and immediately assign VERIFY work item
    const { data: verifyItem, error: createError } = await supabaseAdmin
      .from('work_items')
      .insert({
        reference_id: chaseItem.reference_id,
        work_type: 'VERIFY',
        status: 'ASSIGNED',
        assigned_to: staffUser.id,
        assigned_at: new Date().toISOString(),
        priority: chaseItem.priority
      })
      .select()
      .single();

    if (createError) throw createError;

    // Log to audit
    await supabaseAdmin.from('reference_audit_log').insert({
      reference_id: chaseItem.reference_id,
      action: 'VERIFY_NOW',
      details: { chase_item_id: id, verify_item_id: verifyItem.id },
      performed_by: staffUser.id
    });

    res.json({ verifyItem, message: 'Started verification immediately' });
  } catch (error: any) {
    console.error('Error starting verify now:', error);
    res.status(500).json({ error: error.message });
  }
});

// Staff endpoint to resend reference email with optional email update
router.post('/:id/resend-email', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { contactType, newEmail } = req.body;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    // Validate contact type
    const validContactTypes = ['TENANT', 'LANDLORD', 'AGENT', 'EMPLOYER', 'ACCOUNTANT', 'GUARANTOR'];
    if (!contactType || !validContactTypes.includes(contactType)) {
      return res.status(400).json({ error: 'Invalid contact type. Must be one of: ' + validContactTypes.join(', ') });
    }

    // Validate email if provided
    if (newEmail && !isValidEmail(newEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Get the work item to find the reference
    const { data: workItem, error: workError } = await supabaseAdmin
      .from('work_items')
      .select('reference_id')
      .eq('id', id)
      .single();

    if (workError || !workItem) {
      return res.status(404).json({ error: 'Work item not found' });
    }

    const referenceId = workItem.reference_id;

    // Get the reference with all needed fields
    const { data: reference, error: refError } = await supabaseAdmin
      .from('tenant_references')
      .select(`
        *,
        company:companies!inner(id, name_encrypted, phone_encrypted, email_encrypted)
      `)
      .eq('id', referenceId)
      .single();

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' });
    }

    const companyName = reference.company?.name_encrypted ? decrypt(reference.company.name_encrypted) || '' : '';
    const companyPhone = reference.company?.phone_encrypted ? decrypt(reference.company.phone_encrypted) || '' : '';
    const companyEmail = reference.company?.email_encrypted ? decrypt(reference.company.email_encrypted) || '' : '';
    const tenantName = `${decrypt(reference.tenant_first_name_encrypted) || ''} ${decrypt(reference.tenant_last_name_encrypted) || ''}`.trim();
    const propertyAddress = decrypt(reference.property_address_encrypted) || '';

    let emailSentTo = '';
    let recipientName = '';

    switch (contactType) {
      case 'TENANT': {
        const currentEmail = decrypt(reference.tenant_email_encrypted) || '';
        const targetEmail = newEmail || currentEmail;
        recipientName = tenantName;
        emailSentTo = targetEmail;

        // Update email if changed
        if (newEmail && newEmail !== currentEmail) {
          await supabaseAdmin
            .from('tenant_references')
            .update({ tenant_email_encrypted: encrypt(newEmail) })
            .eq('id', referenceId);

          await logAuditAction({
            referenceId,
            action: 'EMAIL_CHANGED',
            description: `Tenant email changed from ${currentEmail} to ${newEmail} by staff`,
            metadata: { emailType: 'tenant', oldEmail: currentEmail, newEmail },
            userId: staffUser.id
          });
        }

        // Generate new token and send email
        const newToken = generateToken();
        const newTokenHash = hash(newToken);

        await supabaseAdmin
          .from('tenant_references')
          .update({ reference_token_hash: newTokenHash })
          .eq('id', referenceId);

        const tenantReferenceUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/submit-reference/${newToken}`;

        await sendTenantReferenceRequest(
          targetEmail,
          tenantName,
          tenantReferenceUrl,
          companyName,
          propertyAddress,
          companyPhone || undefined,
          companyEmail || undefined,
          referenceId
        );

        // Send SMS (non-blocking)
        const tenantPhone = decrypt(reference.tenant_phone_encrypted);
        if (tenantPhone) {
          sendTenantReferenceRequestSMS(
            tenantPhone,
            tenantName,
            tenantReferenceUrl,
            companyName,
            propertyAddress,
            referenceId
          ).catch(err => console.error('Failed to send SMS to tenant:', err));
        }
        break;
      }

      case 'LANDLORD': {
        const currentEmail = decrypt(reference.previous_landlord_email_encrypted) || '';
        const targetEmail = newEmail || currentEmail;
        recipientName = decrypt(reference.previous_landlord_name_encrypted) || '';
        emailSentTo = targetEmail;

        // Update email if changed - update both tenant_references AND landlord_references
        if (newEmail && newEmail !== currentEmail) {
          await supabaseAdmin
            .from('tenant_references')
            .update({ previous_landlord_email_encrypted: encrypt(newEmail) })
            .eq('id', referenceId);

          // Also update landlord_references if it exists
          await supabaseAdmin
            .from('landlord_references')
            .update({ landlord_email_encrypted: encrypt(newEmail) })
            .eq('reference_id', referenceId);

          await logAuditAction({
            referenceId,
            action: 'EMAIL_CHANGED',
            description: `Landlord email changed from ${currentEmail} to ${newEmail} by staff`,
            metadata: { emailType: 'landlord', oldEmail: currentEmail, newEmail },
            userId: staffUser.id
          });
        }

        const landlordReferenceUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/landlord-reference/${referenceId}`;

        await sendLandlordReferenceRequest(
          targetEmail,
          recipientName,
          tenantName,
          landlordReferenceUrl,
          companyName,
          companyPhone,
          companyEmail,
          referenceId
        );

        // Send SMS (non-blocking)
        const landlordPhone = decrypt(reference.previous_landlord_phone_encrypted);
        if (landlordPhone) {
          sendLandlordReferenceRequestSMS(
            landlordPhone,
            recipientName,
            tenantName,
            landlordReferenceUrl,
            referenceId
          ).catch(err => console.error('Failed to send SMS to landlord:', err));
        }
        break;
      }

      case 'AGENT': {
        const currentEmail = decrypt(reference.previous_landlord_email_encrypted) || '';
        const targetEmail = newEmail || currentEmail;
        recipientName = decrypt(reference.previous_landlord_name_encrypted) || '';
        emailSentTo = targetEmail;

        // Update email if changed - update both tenant_references AND agent_references
        if (newEmail && newEmail !== currentEmail) {
          await supabaseAdmin
            .from('tenant_references')
            .update({ previous_landlord_email_encrypted: encrypt(newEmail) })
            .eq('id', referenceId);

          // Also update agent_references if it exists
          await supabaseAdmin
            .from('agent_references')
            .update({ agent_email_encrypted: encrypt(newEmail) })
            .eq('reference_id', referenceId);

          await logAuditAction({
            referenceId,
            action: 'EMAIL_CHANGED',
            description: `Agent email changed from ${currentEmail} to ${newEmail} by staff`,
            metadata: { emailType: 'agent', oldEmail: currentEmail, newEmail },
            userId: staffUser.id
          });
        }

        const agentReferenceUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/agent-reference/${referenceId}`;

        await sendAgentReferenceRequest(
          targetEmail,
          recipientName,
          tenantName,
          agentReferenceUrl,
          companyName,
          companyPhone,
          companyEmail,
          referenceId
        );

        // Send SMS (non-blocking)
        const agentPhone = decrypt(reference.previous_landlord_phone_encrypted);
        if (agentPhone) {
          sendAgentReferenceRequestSMS(
            agentPhone,
            recipientName,
            tenantName,
            agentReferenceUrl,
            referenceId
          ).catch(err => console.error('Failed to send SMS to agent:', err));
        }
        break;
      }

      case 'EMPLOYER': {
        const currentEmail = decrypt(reference.employer_ref_email_encrypted) || '';
        const targetEmail = newEmail || currentEmail;
        recipientName = decrypt(reference.employer_ref_name_encrypted) || '';
        emailSentTo = targetEmail;

        // Update email if changed - update both tenant_references AND employer_references
        if (newEmail && newEmail !== currentEmail) {
          await supabaseAdmin
            .from('tenant_references')
            .update({ employer_ref_email_encrypted: encrypt(newEmail) })
            .eq('id', referenceId);

          // Also update employer_references if it exists
          await supabaseAdmin
            .from('employer_references')
            .update({ employer_email_encrypted: encrypt(newEmail) })
            .eq('reference_id', referenceId);

          await logAuditAction({
            referenceId,
            action: 'EMAIL_CHANGED',
            description: `Employer email changed from ${currentEmail} to ${newEmail} by staff`,
            metadata: { emailType: 'employer', oldEmail: currentEmail, newEmail },
            userId: staffUser.id
          });
        }

        const employerReferenceUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/employer-reference/${referenceId}`;

        await sendEmployerReferenceRequest(
          targetEmail,
          recipientName,
          tenantName,
          employerReferenceUrl,
          companyName,
          companyPhone,
          companyEmail,
          referenceId
        );

        // Send SMS (non-blocking)
        const employerPhone = decrypt(reference.employer_ref_phone_encrypted);
        if (employerPhone) {
          sendEmployerReferenceRequestSMS(
            employerPhone,
            recipientName,
            tenantName,
            employerReferenceUrl,
            referenceId
          ).catch(err => console.error('Failed to send SMS to employer:', err));
        }
        break;
      }

      case 'ACCOUNTANT': {
        const currentEmail = decrypt(reference.accountant_email_encrypted) || '';
        const targetEmail = newEmail || currentEmail;
        recipientName = decrypt(reference.accountant_name_encrypted) || '';
        emailSentTo = targetEmail;

        // Get accountant reference for token
        const { data: accountantRef } = await supabaseAdmin
          .from('accountant_references')
          .select('id, token_hash')
          .eq('tenant_reference_id', referenceId)
          .single();

        if (!accountantRef) {
          return res.status(404).json({ error: 'Accountant reference not found' });
        }

        // Update email if changed - update both tenant_references AND accountant_references
        if (newEmail && newEmail !== currentEmail) {
          await supabaseAdmin
            .from('tenant_references')
            .update({ accountant_email_encrypted: encrypt(newEmail) })
            .eq('id', referenceId);

          // Also update accountant_references
          await supabaseAdmin
            .from('accountant_references')
            .update({ accountant_email_encrypted: encrypt(newEmail) })
            .eq('id', accountantRef.id);

          await logAuditAction({
            referenceId,
            action: 'EMAIL_CHANGED',
            description: `Accountant email changed from ${currentEmail} to ${newEmail} by staff`,
            metadata: { emailType: 'accountant', oldEmail: currentEmail, newEmail },
            userId: staffUser.id
          });
        }

        // Generate new token
        const accountantToken = generateToken();
        const accountantTokenHash = hash(accountantToken);

        await supabaseAdmin
          .from('accountant_references')
          .update({ token_hash: accountantTokenHash })
          .eq('id', accountantRef.id);

        const formLink = `${process.env.FRONTEND_URL}/accountant-reference/${accountantToken}`;

        await sendAccountantReferenceRequest(
          targetEmail,
          recipientName,
          tenantName,
          formLink,
          companyName,
          companyPhone,
          companyEmail,
          accountantRef.id
        );

        // Send SMS (non-blocking)
        const accountantPhone = decrypt(reference.accountant_phone_encrypted);
        if (accountantPhone) {
          sendAccountantReferenceRequestSMS(
            accountantPhone,
            recipientName,
            tenantName,
            formLink,
            accountantRef.id
          ).catch(err => console.error('Failed to send SMS to accountant:', err));
        }
        break;
      }

      case 'GUARANTOR': {
        const currentEmail = decrypt(reference.guarantor_email_encrypted) || '';
        const targetEmail = newEmail || currentEmail;
        const guarantorFirstName = decrypt(reference.guarantor_first_name_encrypted) || '';
        const guarantorLastName = decrypt(reference.guarantor_last_name_encrypted) || '';
        recipientName = `${guarantorFirstName} ${guarantorLastName}`.trim();
        emailSentTo = targetEmail;

        // Try to find guarantor in either legacy or new method
        const { data: guarantorRefLegacy } = await supabaseAdmin
          .from('guarantor_references')
          .select('id, reference_token_hash')
          .eq('reference_id', referenceId)
          .single();

        const { data: guarantorRefNew } = await supabaseAdmin
          .from('tenant_references')
          .select('id, reference_token_hash')
          .eq('guarantor_for_reference_id', referenceId)
          .eq('is_guarantor', true)
          .single();

        if (!guarantorRefLegacy && !guarantorRefNew) {
          return res.status(404).json({ error: 'Guarantor reference not found' });
        }

        const isLegacyGuarantor = !!guarantorRefLegacy;
        const guarantorId = isLegacyGuarantor ? guarantorRefLegacy.id : guarantorRefNew!.id;

        // Update email if changed
        if (newEmail && newEmail !== currentEmail) {
          if (isLegacyGuarantor) {
            await supabaseAdmin
              .from('guarantor_references')
              .update({ guarantor_email_encrypted: encrypt(newEmail) })
              .eq('id', guarantorId);
          } else {
            await supabaseAdmin
              .from('tenant_references')
              .update({ tenant_email_encrypted: encrypt(newEmail) })
              .eq('id', guarantorId);
          }

          // Also update in parent reference
          await supabaseAdmin
            .from('tenant_references')
            .update({ guarantor_email_encrypted: encrypt(newEmail) })
            .eq('id', referenceId);

          await logAuditAction({
            referenceId,
            action: 'EMAIL_CHANGED',
            description: `Guarantor email changed from ${currentEmail} to ${newEmail} by staff`,
            metadata: { emailType: 'guarantor', oldEmail: currentEmail, newEmail },
            userId: staffUser.id
          });
        }

        // Generate new token
        const guarantorToken = generateToken();
        const guarantorTokenHash = hash(guarantorToken);
        const tokenExpiresAt = new Date();
        tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 21);

        if (isLegacyGuarantor) {
          await supabaseAdmin
            .from('guarantor_references')
            .update({ reference_token_hash: guarantorTokenHash })
            .eq('id', guarantorId);
        } else {
          await supabaseAdmin
            .from('tenant_references')
            .update({
              reference_token_hash: guarantorTokenHash,
              token_expires_at: tokenExpiresAt.toISOString()
            })
            .eq('id', guarantorId);
        }

        const formLink = `${process.env.FRONTEND_URL}/guarantor-reference/${guarantorToken}`;

        await sendGuarantorReferenceRequest(
          targetEmail,
          recipientName,
          tenantName,
          propertyAddress,
          companyName,
          companyPhone,
          companyEmail,
          formLink,
          guarantorId
        );

        // Send SMS (non-blocking)
        const guarantorPhone = decrypt(reference.guarantor_phone_encrypted);
        if (guarantorPhone) {
          sendGuarantorReferenceRequestSMS(
            guarantorPhone,
            recipientName,
            tenantName,
            formLink,
            guarantorId
          ).catch(err => console.error('Failed to send SMS to guarantor:', err));
        }
        break;
      }
    }

    // Log the resend action
    await logAuditAction({
      referenceId,
      action: 'EMAIL_RESENT',
      description: `${contactType} reference email resent to ${emailSentTo} by staff`,
      metadata: { emailType: contactType.toLowerCase(), recipient: emailSentTo, staffId: staffUser.id },
      userId: staffUser.id
    });

    // Update work item last_activity_at
    await supabaseAdmin
      .from('work_items')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', id);

    res.json({
      message: `${contactType} reference email sent successfully`,
      emailSentTo,
      recipientName,
      contactType
    });
  } catch (error: any) {
    console.error('Error resending email:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// LOCK ENDPOINTS - Soft locking for concurrent access
// ============================================================================

// Acquire lock on a work item
router.post('/:id/lock/claim', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const result = await acquireLock(id, staffUser.id);

    if (!result.success) {
      return res.status(409).json({
        error: result.error,
        existingLock: result.existingLock
      });
    }

    res.json({
      message: 'Lock acquired successfully',
      lock: result.lock
    });
  } catch (error: any) {
    console.error('Error acquiring lock:', error);
    res.status(500).json({ error: error.message });
  }
});

// Release lock on a work item
router.post('/:id/lock/release', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const success = await releaseLock(id, staffUser.id);

    if (!success) {
      return res.status(400).json({ error: 'Failed to release lock' });
    }

    res.json({ message: 'Lock released successfully' });
  } catch (error: any) {
    console.error('Error releasing lock:', error);
    res.status(500).json({ error: error.message });
  }
});

// Heartbeat to extend lock (call every 5 minutes)
router.post('/:id/lock/heartbeat', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const result = await extendLock(id, staffUser.id);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      message: 'Lock extended successfully',
      lock: result.lock
    });
  } catch (error: any) {
    console.error('Error extending lock:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check lock status for a work item
router.get('/:id/lock/status', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const status = await checkLockStatus(id);

    res.json({
      isLocked: status.isLocked,
      lock: status.lock,
      isLockedByMe: status.lock?.lockedBy === staffUser.id
    });
  } catch (error: any) {
    console.error('Error checking lock status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all locks held by current staff member
router.get('/locks/my-locks', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const locks = await getStaffLocks(staffUser.id);

    res.json({ locks });
  } catch (error: any) {
    console.error('Error getting staff locks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Force release lock (admin only)
router.post('/:id/lock/force-release', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    // Check if user is admin
    const { data: staff } = await supabaseAdmin
      .from('staff_users')
      .select('role')
      .eq('id', staffUser.id)
      .single();

    if (staff?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const success = await forceReleaseLock(id);

    if (!success) {
      return res.status(400).json({ error: 'Failed to force release lock' });
    }

    res.json({ message: 'Lock force released successfully' });
  } catch (error: any) {
    console.error('Error force releasing lock:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { authenticateStaff as staffAuth, StaffAuthRequest } from '../middleware/staffAuth';
import { supabase as supabaseAdmin } from '../config/supabase';
import { decrypt } from '../services/encryption';

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
      // Default: only show available and assigned items (not completed)
      query = query.in('status', ['AVAILABLE', 'ASSIGNED', 'IN_PROGRESS']);
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

    // Calculate urgency based on age and decrypt reference data
    const enrichedWorkItems = workItems?.map((item: any) => {
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

    // Get counts by type and status
    const { data: stats, error } = await supabaseAdmin
      .from('work_items')
      .select('work_type, status')
      .in('status', ['AVAILABLE', 'ASSIGNED', 'IN_PROGRESS']);

    if (error) throw error;

    const summary = {
      chase: {
        available: 0,
        assigned: 0,
        inProgress: 0,
        myItems: 0,
        total: 0
      },
      verify: {
        available: 0,
        assigned: 0,
        inProgress: 0,
        myItems: 0,
        total: 0
      }
    };

    // Get my assigned items
    const { data: myItems } = await supabaseAdmin
      .from('work_items')
      .select('work_type')
      .eq('assigned_to', staffUser.id)
      .in('status', ['ASSIGNED', 'IN_PROGRESS']);

    stats?.forEach((item: any) => {
      const type = item.work_type.toLowerCase() as 'chase' | 'verify';
      const status = item.status.toLowerCase();

      if (type === 'chase' || type === 'verify') {
        if (status === 'available') summary[type].available++;
        else if (status === 'assigned') summary[type].assigned++;
        else if (status === 'in_progress') summary[type].inProgress++;
      }
    });

    myItems?.forEach((item: any) => {
      const type = item.work_type.toLowerCase() as 'chase' | 'verify';
      if (type === 'chase' || type === 'verify') {
        summary[type].myItems++;
      }
    });

    summary.chase.total = summary.chase.available + summary.chase.assigned + summary.chase.inProgress;
    summary.verify.total = summary.verify.available + summary.verify.assigned + summary.verify.inProgress;

    res.json({ stats: summary });
  } catch (error: any) {
    console.error('Error fetching work queue stats:', error);
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
          property_address_encrypted,
          status,
          created_at
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
      property_address: decrypt(workItem.reference.property_address_encrypted)
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

export default router;

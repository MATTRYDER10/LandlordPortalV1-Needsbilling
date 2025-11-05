import { Router, Request, Response } from 'express';
import { authenticateStaff as staffAuth, StaffAuthRequest } from '../middleware/staffAuth';
import { supabase as supabaseAdmin } from '../config/supabase';

const router = Router();

// Get contact attempts for a work item
router.get('/work-item/:workItemId', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { workItemId } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const { data: attempts, error } = await supabaseAdmin
      .from('contact_attempts')
      .select(`
        *,
        created_by_staff:staff_users!contact_attempts_created_by_fkey (
          id,
          full_name,
          email
        )
      `)
      .eq('work_item_id', workItemId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ attempts });
  } catch (error: any) {
    console.error('Error fetching contact attempts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get contact attempts for a reference
router.get('/reference/:referenceId', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { referenceId } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const { data: attempts, error } = await supabaseAdmin
      .from('contact_attempts')
      .select(`
        *,
        work_item:work_items!contact_attempts_work_item_id_fkey (
          id,
          work_type,
          status
        ),
        created_by_staff:staff_users!contact_attempts_created_by_fkey (
          id,
          full_name,
          email
        )
      `)
      .eq('reference_id', referenceId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ attempts });
  } catch (error: any) {
    console.error('Error fetching contact attempts for reference:', error);
    res.status(500).json({ error: error.message });
  }
});

// Log a new contact attempt
router.post('/', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const {
      work_item_id,
      reference_id,
      channel,
      contact_type,
      recipient_name,
      recipient_contact,
      outcome,
      notes,
      attachments
    } = req.body;

    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    // Validate required fields
    if (!work_item_id || !reference_id || !channel || !contact_type || !outcome) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate channel
    if (!['EMAIL', 'SMS', 'PHONE', 'WHATSAPP'].includes(channel)) {
      return res.status(400).json({ error: 'Invalid channel' });
    }

    // Create contact attempt
    const { data: attempt, error: insertError } = await supabaseAdmin
      .from('contact_attempts')
      .insert({
        work_item_id,
        reference_id,
        channel,
        contact_type,
        recipient_name,
        recipient_contact,
        outcome,
        notes,
        attachments: attachments || [],
        created_by: staffUser.id
      })
      .select(`
        *,
        created_by_staff:staff_users!contact_attempts_created_by_fkey (
          id,
          full_name,
          email
        )
      `)
      .single();

    if (insertError) throw insertError;

    // Update work item's last_activity_at (trigger should handle this, but being explicit)
    await supabaseAdmin
      .from('work_items')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', work_item_id);

    // Log to audit
    await supabaseAdmin.from('reference_audit_log').insert({
      reference_id,
      action: 'CONTACT_ATTEMPT',
      details: {
        work_item_id,
        channel,
        contact_type,
        outcome,
        recipient_name
      },
      performed_by: staffUser.id
    });

    res.json({ attempt, message: 'Contact attempt logged successfully' });
  } catch (error: any) {
    console.error('Error logging contact attempt:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a contact attempt (e.g., add notes or change outcome)
router.patch('/:id', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { outcome, notes, attachments } = req.body;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    // Verify ownership
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('contact_attempts')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({ error: 'Contact attempt not found' });
    }

    if (existing.created_by !== staffUser.id) {
      return res.status(403).json({ error: 'Can only update your own contact attempts' });
    }

    // Update fields
    const updates: any = {};
    if (outcome) updates.outcome = outcome;
    if (notes !== undefined) updates.notes = notes;
    if (attachments !== undefined) updates.attachments = attachments;

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('contact_attempts')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        created_by_staff:staff_users!contact_attempts_created_by_fkey (
          id,
          full_name,
          email
        )
      `)
      .single();

    if (updateError) throw updateError;

    res.json({ attempt: updated, message: 'Contact attempt updated successfully' });
  } catch (error: any) {
    console.error('Error updating contact attempt:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a contact attempt (soft delete or hard delete)
router.delete('/:id', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    // Verify ownership
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('contact_attempts')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({ error: 'Contact attempt not found' });
    }

    if (existing.created_by !== staffUser.id) {
      return res.status(403).json({ error: 'Can only delete your own contact attempts' });
    }

    // Hard delete (can change to soft delete if needed)
    const { error: deleteError } = await supabaseAdmin
      .from('contact_attempts')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    res.json({ message: 'Contact attempt deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting contact attempt:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get contact attempt statistics for a reference
router.get('/stats/reference/:referenceId', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { referenceId } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const { data: attempts, error } = await supabaseAdmin
      .from('contact_attempts')
      .select('channel, outcome, contact_type, created_at')
      .eq('reference_id', referenceId);

    if (error) throw error;

    // Calculate stats
    const stats = {
      total: attempts?.length || 0,
      byChannel: {} as Record<string, number>,
      byOutcome: {} as Record<string, number>,
      byContactType: {} as Record<string, number>,
      lastContact: attempts?.[0]?.created_at || null
    };

    attempts?.forEach((attempt: any) => {
      stats.byChannel[attempt.channel] = (stats.byChannel[attempt.channel] || 0) + 1;
      stats.byOutcome[attempt.outcome] = (stats.byOutcome[attempt.outcome] || 0) + 1;
      stats.byContactType[attempt.contact_type] = (stats.byContactType[attempt.contact_type] || 0) + 1;
    });

    res.json({ stats });
  } catch (error: any) {
    console.error('Error fetching contact attempt stats:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

import { Router, Response } from 'express';
import { authenticateStaff as staffAuth, StaffAuthRequest } from '../middleware/staffAuth';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { supabase } from '../config/supabase';
import { logAuditAction } from '../services/auditService';
import {
  getChaseQueue,
  getDependenciesForReference,
  createDependenciesForReference,
  recordChase,
  markReceived,
  sendToActionRequired,
  sendChaseForDependency
} from '../services/chaseDependencyService';

const router = Router();

// ============================================================================
// CHASE QUEUE ENDPOINTS
// ============================================================================

// Get dependency-centric chase queue
router.get('/queue', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const staffUser = req.staffUser;
    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const items = await getChaseQueue();

    res.json({
      items,
      total: items.length
    });
  } catch (error: any) {
    console.error('Error fetching chase queue:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all dependencies for a specific reference
router.get('/reference/:referenceId', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { referenceId } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const dependencies = await getDependenciesForReference(referenceId);

    res.json({ dependencies });
  } catch (error: any) {
    console.error('Error fetching dependencies:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create/refresh dependencies for a reference
router.post('/reference/:referenceId/create', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { referenceId } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const dependencies = await createDependenciesForReference(referenceId);

    res.json({
      message: 'Dependencies created/updated',
      dependencies
    });
  } catch (error: any) {
    console.error('Error creating dependencies:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// DEPENDENCY ACTION ENDPOINTS
// ============================================================================

// Record that a chase was sent
router.post('/:dependencyId/chase', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { dependencyId } = req.params;
    const { method } = req.body; // 'email', 'sms', or 'call'
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    if (!['email', 'sms', 'call'].includes(method)) {
      return res.status(400).json({ error: 'Method must be "email", "sms", or "call"' });
    }

    const dependency = await recordChase(dependencyId, method, staffUser.id);

    res.json({
      message: `${method.toUpperCase()} chase recorded`,
      dependency
    });
  } catch (error: any) {
    console.error('Error recording chase:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark dependency as received
router.post('/:dependencyId/received', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { dependencyId } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const dependency = await markReceived(dependencyId, staffUser.id);

    res.json({
      message: 'Dependency marked as received',
      dependency
    });
  } catch (error: any) {
    console.error('Error marking received:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send to action required (manual escalation)
router.post('/:dependencyId/action-required', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { dependencyId } = req.params;
    const { reason } = req.body;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const dependency = await sendToActionRequired(dependencyId, staffUser.id, reason);

    res.json({
      message: 'Dependency sent to action required',
      dependency
    });
  } catch (error: any) {
    console.error('Error sending to action required:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// AGENT CHASE ENDPOINTS (for /references page)
// ============================================================================

// Agent chase cooldown (4 hours per the spec)
const AGENT_CHASE_COOLDOWN_HOURS = 4;

/**
 * POST /api/chase/agent/:dependencyId
 * Agent-facing chase endpoint that sends email + SMS
 * - Uses regular user authentication (not staff)
 * - 4-hour cooldown per referee
 * - Removes from staff chase queue by updating last_chase_sent_at
 */
router.post('/agent/:dependencyId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { dependencyId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user's company to verify access
    const { data: companyUsers } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1);

    if (!companyUsers || companyUsers.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const companyId = companyUsers[0].company_id;

    // Get the dependency and verify it belongs to this company
    const { data: dependency, error: depError } = await supabase
      .from('chase_dependencies')
      .select(`
        *,
        reference:tenant_references!chase_dependencies_reference_id_fkey (
          id,
          company_id,
          status
        )
      `)
      .eq('id', dependencyId)
      .single();

    if (depError || !dependency) {
      return res.status(404).json({ error: 'Dependency not found' });
    }

    if (dependency.reference?.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check 4-hour cooldown
    if (dependency.last_chase_sent_at) {
      const lastChase = new Date(dependency.last_chase_sent_at);
      const cooldownEnd = new Date(lastChase.getTime() + AGENT_CHASE_COOLDOWN_HOURS * 60 * 60 * 1000);

      if (new Date() < cooldownEnd) {
        const minutesRemaining = Math.ceil((cooldownEnd.getTime() - Date.now()) / (1000 * 60));
        return res.status(429).json({
          error: 'Cooldown period active',
          message: `Please wait ${minutesRemaining} minutes before chasing again`,
          cooldownEnds: cooldownEnd.toISOString()
        });
      }
    }

    // Send both email and SMS
    const emailResult = await sendChaseForDependency(dependencyId, 'email');
    const smsResult = await sendChaseForDependency(dependencyId, 'sms');

    // Update the dependency to record the chase
    const now = new Date();
    const { error: updateError } = await supabase
      .from('chase_dependencies')
      .update({
        last_chase_sent_at: now.toISOString(),
        status: 'CHASING',
        email_attempts: dependency.email_attempts + (emailResult.sent ? 1 : 0),
        sms_attempts: dependency.sms_attempts + (smsResult.sent ? 1 : 0)
      })
      .eq('id', dependencyId);

    if (updateError) {
      console.error('Error updating dependency:', updateError);
    }

    // Log audit action
    await logAuditAction({
      referenceId: dependency.reference.id,
      action: 'AGENT_CHASE_SENT',
      description: `Agent sent chase for ${dependency.dependency_type}`,
      metadata: {
        dependencyType: dependency.dependency_type,
        emailSent: emailResult.sent,
        smsSent: smsResult.sent,
        visible_to_agent: true
      },
      userId
    });

    res.json({
      message: 'Chase sent successfully',
      emailSent: emailResult.sent,
      smsSent: smsResult.sent,
      emailSkipped: emailResult.skipped,
      smsSkipped: smsResult.skipped,
      cooldownEnds: new Date(now.getTime() + AGENT_CHASE_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString()
    });
  } catch (error: any) {
    console.error('Error in agent chase:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/chase/agent/reference/:referenceId
 * Get dependencies for a reference (agent-facing)
 */
router.get('/agent/reference/:referenceId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { referenceId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user's company
    const { data: companyUsers } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1);

    if (!companyUsers || companyUsers.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const companyId = companyUsers[0].company_id;

    // Verify reference belongs to company
    const { data: reference } = await supabase
      .from('tenant_references')
      .select('id, company_id')
      .eq('id', referenceId)
      .single();

    if (!reference || reference.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const dependencies = await getDependenciesForReference(referenceId);

    // Add cooldown info for each dependency
    const dependenciesWithCooldown = dependencies.map(dep => {
      let canChase = true;
      let cooldownEnds: string | null = null;

      if (dep.lastChaseSentAt) {
        const lastChase = new Date(dep.lastChaseSentAt);
        const cooldownEnd = new Date(lastChase.getTime() + AGENT_CHASE_COOLDOWN_HOURS * 60 * 60 * 1000);

        if (new Date() < cooldownEnd) {
          canChase = false;
          cooldownEnds = cooldownEnd.toISOString();
        }
      }

      return {
        ...dep,
        canChase,
        cooldownEnds
      };
    });

    res.json({ dependencies: dependenciesWithCooldown });
  } catch (error: any) {
    console.error('Error fetching agent dependencies:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

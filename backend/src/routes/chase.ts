import { Router, Response } from 'express';
import { authenticateStaff as staffAuth, StaffAuthRequest } from '../middleware/staffAuth';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { supabase } from '../config/supabase';
import { logAuditAction } from '../services/auditService';
import { generateToken, hash } from '../services/encryption';
import {
  getChaseQueue,
  getDependenciesForReference,
  createDependenciesForReference,
  recordChase,
  recordChaseForSection,
  markReceived,
  markSectionReceived,
  sendToActionRequired,
  escalateSectionToActionRequired,
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
router.post('/:sectionId/chase', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { sectionId } = req.params;
    const { method } = req.body; // 'email' or 'sms'
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    if (!['email', 'sms'].includes(method)) {
      return res.status(400).json({ error: 'Method must be "email" or "sms"' });
    }

    // Use the new function that works with verification_sections IDs
    const section = await recordChaseForSection(sectionId, method, staffUser.id);

    res.json({
      message: `${method.toUpperCase()} chase recorded`,
      section
    });
  } catch (error: any) {
    console.error('Error recording chase:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark section as received (response was submitted)
router.post('/:sectionId/received', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { sectionId } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    // Use the new function that works with verification_sections IDs
    const section = await markSectionReceived(sectionId, staffUser.id);

    res.json({
      message: 'Section marked as received - removed from chase queue',
      section
    });
  } catch (error: any) {
    console.error('Error marking received:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get form link for a verification section (for staff to copy or fill out over phone)
router.get('/:sectionId/form-link', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { sectionId } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    // Get the verification section
    const { data: section, error: sectionError } = await supabase
      .from('verification_sections')
      .select('id, reference_id, section_type, linked_table, linked_record_id, form_url')
      .eq('id', sectionId)
      .single();

    if (sectionError || !section) {
      return res.status(404).json({ error: 'Section not found' });
    }

    // Generate form URL based on section type
    // Note: We always regenerate the URL to ensure it uses the current FRONTEND_URL
    // (cached form_url might have localhost from development)
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    let formUrl: string | null = null;

    switch (section.section_type) {
      case 'EMPLOYER_REFERENCE':
        // Employer reference uses employer_references table ID
        if (section.linked_record_id) {
          formUrl = `${FRONTEND_URL}/submit-employer-reference/${section.linked_record_id}`;
        } else {
          // Look up from employer_references table
          const { data: employerRefRecord } = await supabase
            .from('employer_references')
            .select('id')
            .eq('reference_id', section.reference_id)
            .single();
          if (employerRefRecord?.id) {
            formUrl = `${FRONTEND_URL}/submit-employer-reference/${employerRefRecord.id}`;
          }
        }
        break;

      case 'LANDLORD_REFERENCE':
        // Landlord reference uses reference ID in URL
        // Check if it's an agent reference or landlord reference
        const { data: refForLandlord } = await supabase
          .from('tenant_references')
          .select('reference_type')
          .eq('id', section.reference_id)
          .single();

        if (refForLandlord?.reference_type === 'agent') {
          formUrl = `${FRONTEND_URL}/agent-reference/${section.reference_id}`;
        } else {
          formUrl = `${FRONTEND_URL}/landlord-reference/${section.reference_id}`;
        }
        break;

      case 'ACCOUNTANT_REFERENCE':
        // Accountant reference uses accountant_references table with token
        const { data: accountantRefRecord } = await supabase
          .from('accountant_references')
          .select('id, token_hash')
          .eq('tenant_reference_id', section.reference_id)
          .single();

        if (accountantRefRecord) {
          // Generate a new token for the link (same as chase system does)
          const accountantToken = generateToken();
          const accountantTokenHash = hash(accountantToken);

          // Update the token
          await supabase
            .from('accountant_references')
            .update({ token_hash: accountantTokenHash })
            .eq('id', accountantRefRecord.id);

          formUrl = `${FRONTEND_URL}/accountant-reference/${accountantToken}`;
        }
        break;

      default:
        return res.status(400).json({ error: 'Form links not supported for this section type' });
    }

    if (!formUrl) {
      return res.status(404).json({ error: 'Could not generate form link - missing token or ID' });
    }

    // Store the form_url for future use
    await supabase
      .from('verification_sections')
      .update({ form_url: formUrl })
      .eq('id', sectionId);

    res.json({ formUrl, sectionType: section.section_type });
  } catch (error: any) {
    console.error('Error getting form link:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark as done for today (removes from Pending Responses queue until 8:55am UK tomorrow)
// Requires a note which is saved and visible to agents
router.post('/:sectionId/mark-done', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { sectionId } = req.params;
    const { note } = req.body;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    if (!note || !note.trim()) {
      return res.status(400).json({ error: 'Note is required when marking as done' });
    }

    // Get the verification section to get the reference_id
    const { data: section, error: sectionError } = await supabase
      .from('verification_sections')
      .select('id, reference_id, section_type')
      .eq('id', sectionId)
      .single();

    if (sectionError || !section) {
      return res.status(404).json({ error: 'Section not found' });
    }

    // Update last_marked_done_at timestamp (column may not exist if migration hasn't run)
    const now = new Date();
    try {
      const { error: updateError } = await supabase
        .from('verification_sections')
        .update({
          last_marked_done_at: now.toISOString()
        })
        .eq('id', sectionId);

      if (updateError) {
        console.warn('Could not update last_marked_done_at (migration may not have run):', updateError.message);
        // Continue anyway - the note will still be created
      }
    } catch (updateErr: any) {
      console.warn('Could not update last_marked_done_at:', updateErr.message);
    }

    // Create a note on the reference (visible to agents)
    // Try with source field first, fall back to without if column doesn't exist
    let noteCreated = false;
    try {
      const { error: noteError } = await supabase
        .from('reference_notes')
        .insert({
          reference_id: section.reference_id,
          note: note.trim(),
          created_by: staffUser.id,
          source: 'PENDING_RESPONSE_QUEUE' // Tag to identify notes from mark-done action
        });

      if (noteError) {
        // Try without source field (column may not exist)
        const { error: noteErrorRetry } = await supabase
          .from('reference_notes')
          .insert({
            reference_id: section.reference_id,
            note: note.trim(),
            created_by: staffUser.id
          });

        if (noteErrorRetry) {
          console.error('Error creating note:', noteErrorRetry);
        } else {
          noteCreated = true;
        }
      } else {
        noteCreated = true;
      }
    } catch (noteErr: any) {
      console.error('Error creating note:', noteErr);
    }

    // Log audit action
    await logAuditAction({
      referenceId: section.reference_id,
      action: 'PENDING_RESPONSE_MARKED_DONE',
      description: `${section.section_type} marked done for today: ${note.substring(0, 100)}${note.length > 100 ? '...' : ''}`,
      metadata: {
        sectionId,
        sectionType: section.section_type,
        visible_to_agent: true // Make this visible in agent activity log
      },
      userId: staffUser.id
    });

    res.json({
      message: 'Marked as done for today. Will reappear at 8:55am UK tomorrow if still pending.',
      markedDoneAt: now.toISOString()
    });
  } catch (error: any) {
    console.error('Error marking as done:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send to action required (manual escalation)
router.post('/:sectionId/action-required', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { sectionId } = req.params;
    const { reason } = req.body;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    // Use the new function that works with verification_sections IDs
    const section = await escalateSectionToActionRequired(sectionId, staffUser.id, reason);

    res.json({
      message: 'Section escalated to action required',
      section
    });
  } catch (error: any) {
    console.error('Error escalating to action required:', error);
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

import { Router, Response } from 'express';
import { authenticateStaff as staffAuth, StaffAuthRequest } from '../middleware/staffAuth';
import {
  getChaseQueue,
  getDependenciesForReference,
  createDependenciesForReference,
  recordChase,
  markReceived,
  sendToActionRequired
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
    const { method } = req.body; // 'email' or 'sms'
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    if (!['email', 'sms'].includes(method)) {
      return res.status(400).json({ error: 'Method must be "email" or "sms"' });
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

export default router;

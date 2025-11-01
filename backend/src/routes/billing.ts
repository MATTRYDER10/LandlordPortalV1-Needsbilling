import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import * as billingService from '../services/billingService';
import * as creditService from '../services/creditService';

const router = Router();

// ============================================================================
// CREDIT BALANCE & HISTORY
// ============================================================================

/**
 * GET /api/billing/credits
 * Get current credit balance for the authenticated user's company
 */
router.get('/credits', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's company
    const { data: companyUser, error: companyError } = await (await import('../config/supabase')).supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (companyError || !companyUser) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const balance = await creditService.getCreditBalance(companyUser.company_id);

    res.json(balance);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/billing/transactions
 * Get credit transaction history
 */
router.get('/transactions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's company
    const { data: companyUser, error: companyError } = await (await import('../config/supabase')).supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (companyError || !companyUser) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const type = req.query.type as string | undefined;

    const history = await creditService.getTransactionHistory(
      companyUser.company_id,
      limit,
      offset,
      type
    );

    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/billing/stats
 * Get credit usage statistics
 */
router.get('/stats', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's company
    const { data: companyUser, error: companyError } = await (await import('../config/supabase')).supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (companyError || !companyUser) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const stats = await creditService.getCreditStats(companyUser.company_id);

    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// PRICING & PRODUCTS
// ============================================================================

/**
 * GET /api/billing/pricing/subscriptions
 * Get available subscription tiers
 */
router.get('/pricing/subscriptions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tiers = await billingService.getSubscriptionTiers();
    res.json(tiers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/billing/pricing/packs
 * Get available credit packs
 */
router.get('/pricing/packs', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const packs = await billingService.getCreditPacks();
    res.json(packs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

/**
 * POST /api/billing/subscriptions
 * Create a new subscription
 */
router.post('/subscriptions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { tier_product_key } = req.body;

    if (!tier_product_key) {
      return res.status(400).json({ error: 'tier_product_key is required' });
    }

    // Get user's company
    const { data: companyUser, error: companyError } = await (await import('../config/supabase')).supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (companyError || !companyUser) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const result = await billingService.createSubscription(
      companyUser.company_id,
      tier_product_key,
      userId
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/billing/subscriptions/active
 * Get active subscription for the company
 */
router.get('/subscriptions/active', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's company
    const { data: companyUser, error: companyError } = await (await import('../config/supabase')).supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (companyError || !companyUser) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const subscription = await billingService.getActiveSubscription(companyUser.company_id);

    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    res.json(subscription);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/billing/subscriptions
 * Cancel the active subscription
 */
router.delete('/subscriptions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { cancel_at_period_end } = req.body;

    // Get user's company
    const { data: companyUser, error: companyError } = await (await import('../config/supabase')).supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (companyError || !companyUser) {
      return res.status(404).json({ error: 'Company not found' });
    }

    await billingService.cancelSubscription(
      companyUser.company_id,
      cancel_at_period_end !== false
    );

    res.json({ message: 'Subscription canceled successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// CREDIT PACK PURCHASES
// ============================================================================

/**
 * POST /api/billing/credits/purchase
 * Purchase a credit pack
 */
router.post('/credits/purchase', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { pack_product_key } = req.body;

    if (!pack_product_key) {
      return res.status(400).json({ error: 'pack_product_key is required' });
    }

    // Get user's company
    const { data: companyUser, error: companyError } = await (await import('../config/supabase')).supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (companyError || !companyUser) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const result = await billingService.purchaseCreditPack(
      companyUser.company_id,
      pack_product_key,
      userId
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// PAYMENT METHODS
// ============================================================================

/**
 * GET /api/billing/payment-methods
 * Get saved payment methods
 */
router.get('/payment-methods', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's company
    const { data: companyUser, error: companyError } = await (await import('../config/supabase')).supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (companyError || !companyUser) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const paymentMethods = await billingService.getPaymentMethods(companyUser.company_id);

    res.json(paymentMethods);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/billing/payment-methods
 * Save a new payment method
 */
router.post('/payment-methods', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { payment_method_id } = req.body;

    if (!payment_method_id) {
      return res.status(400).json({ error: 'payment_method_id is required' });
    }

    // Get user's company
    const { data: companyUser, error: companyError } = await (await import('../config/supabase')).supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (companyError || !companyUser) {
      return res.status(404).json({ error: 'Company not found' });
    }

    await billingService.savePaymentMethod(companyUser.company_id, payment_method_id);

    res.json({ message: 'Payment method saved successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// AUTO-RECHARGE SETTINGS
// ============================================================================

/**
 * PUT /api/billing/auto-recharge
 * Update auto-recharge settings
 */
router.put('/auto-recharge', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { enabled, threshold, pack_size } = req.body;

    // Get user's company
    const { data: companyUser, error: companyError } = await (await import('../config/supabase')).supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (companyError || !companyUser) {
      return res.status(404).json({ error: 'Company not found' });
    }

    await billingService.updateAutoRechargeSettings(companyUser.company_id, {
      enabled,
      threshold,
      pack_size,
    });

    res.json({ message: 'Auto-recharge settings updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

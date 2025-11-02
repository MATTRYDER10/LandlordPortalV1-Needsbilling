import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { supabase } from '../config/supabase';
import * as billingService from '../services/billingService';

/**
 * Middleware to check if a company has sufficient credits to create a reference
 *
 * This middleware should be applied to routes that create references.
 * If the company has insufficient credits, it returns a 402 Payment Required
 * response with information about available purchase options.
 *
 * Usage:
 *   router.post('/references', authenticateToken, checkCredits, async (req, res) => {
 *     // Create reference - credits will be deducted after successful creation
 *   });
 */
export async function checkCredits(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get user's company
    const { data: companyUser, error: companyError } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (companyError || !companyUser) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    // Check if company can create a reference
    const canCreate = await billingService.canCreateReference(companyUser.company_id);

    console.log('[checkCredits] Company:', companyUser.company_id);
    console.log('[checkCredits] Credits remaining:', canCreate.credits_remaining);
    console.log('[checkCredits] Can create reference:', canCreate.allowed);

    if (canCreate.allowed) {
      // Company has credits, proceed to route handler
      // Store company_id in request for use in route handler
      console.log('[checkCredits] ✅ Credits check passed, proceeding to next middleware');
      (req as any).companyId = companyUser.company_id;
      next();
      return;
    }

    // Insufficient credits - return 402 Payment Required with purchase options
    console.log('[checkCredits] ❌ Insufficient credits, blocking request');
    res.status(402).json({
      error: 'Insufficient credits',
      message: 'You need credits to create a reference. Please purchase a subscription or credit pack.',
      credits_remaining: canCreate.credits_remaining,
      requires_purchase: true,
      purchase_options: {
        subscriptions: canCreate.subscription_tiers,
        credit_packs: canCreate.credit_packs,
      },
    });
  } catch (error: any) {
    console.error('Error in checkCredits middleware:', error);
    res.status(500).json({ error: 'Failed to check credits', details: error.message });
  }
}

/**
 * Optional middleware to check credits without blocking
 * Returns credit information but allows the request to proceed
 * Useful for endpoints that need credit info but don't require credits
 */
export async function getCreditInfo(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;

    if (!userId) {
      next();
      return;
    }

    // Get user's company
    const { data: companyUser, error: companyError } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (companyError || !companyUser) {
      next();
      return;
    }

    // Get credit info and attach to request
    const canCreate = await billingService.canCreateReference(companyUser.company_id);
    (req as any).creditInfo = canCreate;
    (req as any).companyId = companyUser.company_id;

    next();
  } catch (error: any) {
    console.error('Error in getCreditInfo middleware:', error);
    // Don't block the request, just proceed without credit info
    next();
  }
}

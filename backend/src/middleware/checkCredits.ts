import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { supabase } from '../config/supabase';
import * as billingService from '../services/billingService';
import * as creditService from '../services/creditService';

/**
 * Calculate required credits for a reference creation request
 * - 1 credit per tenant
 * - 0.5 credits per guarantor
 */
function calculateRequiredCredits(body: any): number {
  let credits = 0;

  // Check for multi-tenant request
  if (body.tenants && Array.isArray(body.tenants) && body.tenants.length > 0) {
    // Multi-tenant: 1 credit per tenant
    credits += body.tenants.length;

    // Count guarantors in multi-tenant request
    for (const tenant of body.tenants) {
      if (tenant.guarantor?.first_name && tenant.guarantor?.last_name && tenant.guarantor?.email) {
        credits += 0.5;
      }
    }
  } else {
    // Single tenant: 1 credit
    credits = 1;

    // Check for guarantor in single-tenant request
    if (body.guarantor_first_name && body.guarantor_last_name && body.guarantor_email) {
      credits += 0.5;
    }
  }

  return credits;
}

/**
 * Middleware to check if a company has sufficient credits to create a reference
 *
 * This middleware should be applied to routes that create references.
 * If the company has insufficient credits, it returns a 402 Payment Required
 * response with information about available purchase options.
 *
 * Credit costs:
 * - 1 credit per tenant
 * - 0.5 credits per guarantor
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

    // Calculate required credits based on request body
    const requiredCredits = calculateRequiredCredits(req.body);

    // Get current credit balance
    const balance = await creditService.getCreditBalance(companyUser.company_id);

    console.log('[checkCredits] Company:', companyUser.company_id);
    console.log('[checkCredits] Credits remaining:', balance.credits);
    console.log('[checkCredits] Credits required:', requiredCredits);

    if (balance.credits >= requiredCredits) {
      // Company has sufficient credits, proceed to route handler
      // Store company_id and required credits in request for use in route handler
      console.log('[checkCredits] ✅ Credits check passed, proceeding to next middleware');
      (req as any).companyId = companyUser.company_id;
      (req as any).requiredCredits = requiredCredits;
      next();
      return;
    }

    // Insufficient credits - return 402 Payment Required with purchase options
    console.log('[checkCredits] ❌ Insufficient credits, blocking request');

    // Fetch purchase options
    const [tiers, packs] = await Promise.all([
      billingService.getSubscriptionTiers(),
      billingService.getCreditPacks(),
    ]);

    res.status(402).json({
      error: 'Insufficient credits',
      message: `You need ${requiredCredits} credits to create this reference. You have ${balance.credits} credits remaining.`,
      credits_remaining: balance.credits,
      credits_required: requiredCredits,
      requires_purchase: true,
      purchase_options: {
        subscriptions: tiers,
        credit_packs: packs,
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

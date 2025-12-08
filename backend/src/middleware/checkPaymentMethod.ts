import { Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AuthRequest } from './auth';

/**
 * Middleware to check if company has a payment method on file
 * Required before creating references (prevents flow issues with guarantors)
 */
export async function checkPaymentMethod(
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

    // Check if company has a payment method and credits
    const { data: company, error: paymentError } = await supabase
      .from('companies')
      .select('stripe_payment_method_id, payment_method_required, reference_credits')
      .eq('id', companyUser.company_id)
      .single();

    if (paymentError) {
      console.error('Failed to check payment method:', paymentError);
      res.status(500).json({ error: 'Failed to verify payment method' });
      return;
    }

    // Only require payment method if credits are depleted
    // If user has credits, allow them to create references without a payment method
    const hasCredits = (company.reference_credits || 0) > 0;
    const hasPaymentMethod = company.stripe_payment_method_id && !company.payment_method_required;

    if (!hasPaymentMethod && !hasCredits) {
      console.log('[checkPaymentMethod] No payment method and no credits for company:', companyUser.company_id);
      console.log('[checkPaymentMethod] stripe_payment_method_id:', company.stripe_payment_method_id);
      console.log('[checkPaymentMethod] payment_method_required:', company.payment_method_required);
      console.log('[checkPaymentMethod] reference_credits:', company.reference_credits);

      res.status(402).json({
        error: 'Payment Method Required',
        message: 'Please add a payment method to your account before creating references.',
        requires_payment_method: true,
        action: 'add_payment_method',
        redirect_to: '/billing',
      });
      return;
    }

    // Payment method exists OR user has credits, continue
    console.log('[checkPaymentMethod] ✅ Passed for company:', companyUser.company_id,
      '(hasPaymentMethod:', hasPaymentMethod, ', hasCredits:', hasCredits, ')');
    next();
  } catch (error: any) {
    console.error('Payment method check error:', error);
    res.status(500).json({ error: 'Failed to verify payment method' });
  }
}

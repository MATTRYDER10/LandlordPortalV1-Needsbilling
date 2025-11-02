import { supabase } from '../config/supabase';
import * as stripeService from './stripeService';
import * as creditService from './creditService';

/**
 * Billing Service
 *
 * High-level business logic for PropertyGoose billing operations.
 * Orchestrates Stripe payments and credit management.
 */

export interface PricingTier {
  id: string;
  product_key: string;
  product_name: string;
  description: string;
  credits_quantity: number;
  price_per_credit: number;
  price_gbp: number;
  is_popular: boolean;
  is_recommended: boolean;
  stripe_price_id?: string;
}

export interface CreditPack {
  id: string;
  product_key: string;
  product_name: string;
  description: string;
  credits_quantity: number;
  price_per_credit: number;
  price_gbp: number;
  is_recommended: boolean;
}

// ============================================================================
// PRICING & CONFIGURATION
// ============================================================================

/**
 * Get all active subscription tiers
 */
export async function getSubscriptionTiers(): Promise<PricingTier[]> {
  const { data, error } = await supabase
    .from('pricing_config')
    .select('*')
    .eq('product_type', 'credit_subscription')
    .eq('active', true)
    .order('display_order', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch subscription tiers: ${error.message}`);
  }

  return data || [];
}

/**
 * Get all active credit packs
 */
export async function getCreditPacks(): Promise<CreditPack[]> {
  const { data, error } = await supabase
    .from('pricing_config')
    .select('*')
    .eq('product_type', 'credit_pack')
    .eq('active', true)
    .order('display_order', { ascending: true});

  if (error) {
    throw new Error(`Failed to fetch credit packs: ${error.message}`);
  }

  return data || [];
}

/**
 * Get pricing for a specific product
 */
export async function getProductPricing(productKey: string): Promise<any> {
  const { data, error } = await supabase
    .from('pricing_config')
    .select('*')
    .eq('product_key', productKey)
    .eq('active', true)
    .single();

  if (error) {
    throw new Error(`Failed to fetch product pricing: ${error.message}`);
  }

  return data;
}

/**
 * Get agreement pricing
 */
export async function getAgreementPricing(agreementType: string = 'standard'): Promise<number> {
  const { data, error} = await supabase
    .from('pricing_config')
    .select('price_gbp')
    .eq('product_type', 'agreement')
    .eq('product_key', `agreement_${agreementType}`)
    .eq('active', true)
    .single();

  if (error) {
    throw new Error(`Failed to fetch agreement pricing: ${error.message}`);
  }

  return data?.price_gbp || 9.99; // Default fallback
}

// ============================================================================
// CUSTOMER MANAGEMENT
// ============================================================================

/**
 * Get or create Stripe customer for a company
 */
export async function getOrCreateStripeCustomer(companyId: string): Promise<string> {
  // Check if customer already exists
  const { data: company, error } = await supabase
    .from('companies')
    .select('stripe_customer_id, email_encrypted, name_encrypted')
    .eq('id', companyId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch company: ${error.message}`);
  }

  // Return existing customer ID if present
  if (company.stripe_customer_id) {
    return company.stripe_customer_id;
  }

  // Create new Stripe customer
  const { decrypt } = await import('./encryption');
  let email = company.email_encrypted ? decrypt(company.email_encrypted) : null;
  const companyName = company.name_encrypted ? decrypt(company.name_encrypted) : null;

  // If company email is missing, use the owner's email as fallback
  if (!email) {
    const { data: ownerUser } = await supabase
      .from('company_users')
      .select('user_id')
      .eq('company_id', companyId)
      .eq('role', 'owner')
      .limit(1)
      .single();

    if (ownerUser) {
      const { data: { user } } = await supabase.auth.admin.getUserById(ownerUser.user_id);
      if (user?.email) {
        email = user.email;
      }
    }
  }

  if (!email || !companyName) {
    throw new Error('Company email or name not found. Please contact support.');
  }

  const customer = await stripeService.createCustomer(email, companyName, {
    company_id: companyId,
  });

  // Save customer ID to database
  await supabase
    .from('companies')
    .update({ stripe_customer_id: customer.id })
    .eq('id', companyId);

  return customer.id;
}

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

/**
 * Create a new subscription for a company
 */
export async function createSubscription(
  companyId: string,
  tierProductKey: string,
  userId: string
): Promise<{ subscription: any; client_secret: string }> {
  // Get pricing details
  const pricing = await getProductPricing(tierProductKey);
  if (!pricing || !pricing.stripe_price_id) {
    throw new Error('Invalid subscription tier or Stripe price ID not configured');
  }

  // Get or create Stripe customer
  const customerId = await getOrCreateStripeCustomer(companyId);

  // Create Stripe subscription
  const subscription = await stripeService.createSubscription(
    customerId,
    pricing.stripe_price_id,
    {
      company_id: companyId,
      tier: pricing.product_key,
      credits_per_month: pricing.credits_quantity.toString(),
    }
  );

  // Save subscription to database
  // Period dates are on the subscription items, not the top-level subscription object
  const sub: any = subscription; // Cast to any for period fields
  const firstItem = sub.items?.data?.[0];

  const { error: dbError } = await supabase
    .from('subscriptions')
    .insert({
      company_id: companyId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      tier: pricing.product_key.replace('subscription_', ''),
      credits_per_month: pricing.credits_quantity,
      price_per_credit: pricing.price_per_credit,
      monthly_total: pricing.price_gbp,
      status: subscription.status,
      current_period_start: firstItem?.current_period_start
        ? new Date(firstItem.current_period_start * 1000).toISOString()
        : null,
      current_period_end: firstItem?.current_period_end
        ? new Date(firstItem.current_period_end * 1000).toISOString()
        : null,
    });

  if (dbError) {
    throw new Error(`Failed to save subscription: ${dbError.message}`);
  }

  // The subscription is created with payment_behavior: 'default_incomplete'
  // When there's no default payment method, Stripe creates the invoice but NOT a payment_intent
  // We need to manually create a PaymentIntent for the invoice amount

  const invoice: any = subscription.latest_invoice;
  console.log('[BillingService] Subscription created:', subscription.id);
  console.log('[BillingService] Subscription status:', subscription.status);
  console.log('[BillingService] Invoice:', invoice ? invoice.id : 'null');

  if (!invoice || typeof invoice !== 'object') {
    throw new Error('No invoice found on subscription');
  }

  // Create a PaymentIntent for the first invoice
  const amount = invoice.amount_due as number;
  console.log('[BillingService] Creating PaymentIntent for amount:', amount);

  const paymentIntent = await stripeService.createPaymentIntent(
    amount,
    customerId,
    `Subscription: ${pricing.product_name}`,
    {
      subscription_id: subscription.id,
      invoice_id: invoice.id as string,
      company_id: companyId,
    }
  );

  console.log('[BillingService] PaymentIntent created:', paymentIntent.id);
  console.log('[BillingService] Client secret extracted:', !!paymentIntent.client_secret);

  return {
    subscription,
    client_secret: paymentIntent.client_secret || '',
  };
}

/**
 * Get active subscription for a company
 */
export async function getActiveSubscription(companyId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('company_id', companyId)
    .in('status', ['active', 'trialing'])
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch subscription: ${error.message}`);
  }

  return data;
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  companyId: string,
  cancelAtPeriodEnd: boolean = true
): Promise<void> {
  const subscription = await getActiveSubscription(companyId);
  if (!subscription) {
    throw new Error('No active subscription found');
  }

  // Cancel in Stripe
  await stripeService.cancelSubscription(subscription.stripe_subscription_id, cancelAtPeriodEnd);

  // Update database
  await supabase
    .from('subscriptions')
    .update({
      cancel_at_period_end: cancelAtPeriodEnd,
      canceled_at: cancelAtPeriodEnd ? null : new Date().toISOString(),
      status: cancelAtPeriodEnd ? 'active' : 'canceled',
    })
    .eq('id', subscription.id);
}

// ============================================================================
// CREDIT PACK PURCHASES
// ============================================================================

/**
 * Purchase a credit pack (one-off payment)
 * Auto-charges if default payment method exists, otherwise returns client_secret for manual payment
 */
export async function purchaseCreditPack(
  companyId: string,
  packProductKey: string,
  userId: string
): Promise<{ payment_intent: any; client_secret?: string; charged?: boolean }> {
  // Get pricing details
  const pricing = await getProductPricing(packProductKey);
  if (!pricing) {
    throw new Error('Invalid credit pack');
  }

  // Get or create Stripe customer
  const customerId = await getOrCreateStripeCustomer(companyId);

  // Check if customer has a saved payment method
  const { data: company } = await supabase
    .from('companies')
    .select('stripe_payment_method_id')
    .eq('id', companyId)
    .single();

  console.log('[Billing] Checking for saved payment method:', {
    companyId,
    hasPaymentMethod: !!company?.stripe_payment_method_id,
    paymentMethodId: company?.stripe_payment_method_id
  });

  const amount = stripeService.poundsToPence(pricing.price_gbp);
  const description = `Purchase ${pricing.credits_quantity} reference credits`;
  const metadata = {
    company_id: companyId,
    pack_key: packProductKey,
    credits: pricing.credits_quantity.toString(),
  };

  // If customer has saved payment method, charge automatically
  if (company?.stripe_payment_method_id) {
    console.log('[Billing] Attempting auto-charge with saved payment method...');
    try {
      const paymentIntent = await stripeService.chargeCustomer(
        customerId,
        amount,
        description,
        metadata
      );

      console.log('[Billing] Auto-charge succeeded!', { status: paymentIntent.status });
      return {
        payment_intent: paymentIntent,
        charged: true,
      };
    } catch (error) {
      console.error('Auto-charge failed, falling back to manual payment:', error);
      // Fall through to manual payment if auto-charge fails
    }
  }

  console.log('[Billing] No saved payment method, creating manual payment intent');

  // Otherwise, create payment intent for manual payment
  const paymentIntent = await stripeService.createPaymentIntent(
    amount,
    customerId,
    description,
    metadata
  );

  return {
    payment_intent: paymentIntent,
    client_secret: paymentIntent.client_secret || '',
    charged: false,
  };
}

/**
 * Handle successful credit pack purchase
 * Called by webhook handler after payment succeeds
 */
export async function fulfillCreditPackPurchase(
  companyId: string,
  credits: number,
  amountGbp: number,
  paymentIntentId: string,
  userId?: string
): Promise<void> {
  await creditService.addCredits(
    companyId,
    credits,
    'pack_purchase',
    `Purchased ${credits} credit pack`,
    userId,
    {
      amount_gbp: amountGbp,
      stripe_payment_intent_id: paymentIntentId,
    }
  );

  // TODO: Send receipt email
}

/**
 * Auto-recharge credits when balance is low
 * Called automatically by creditService
 */
export async function purchaseCreditPackAutoRecharge(
  companyId: string,
  packSize: number
): Promise<void> {
  // Find the appropriate pack pricing
  const packs = await getCreditPacks();
  const pack = packs.find(p => p.credits_quantity >= packSize);

  if (!pack) {
    throw new Error('No suitable credit pack found for auto-recharge');
  }

  // Get Stripe customer
  const customerId = await getOrCreateStripeCustomer(companyId);

  // Charge customer immediately using saved payment method
  const amount = stripeService.poundsToPence(pack.price_gbp);
  const paymentIntent = await stripeService.chargeCustomer(
    customerId,
    amount,
    `Auto-recharge: ${pack.credits_quantity} reference credits`,
    {
      company_id: companyId,
      pack_key: pack.product_key,
      credits: pack.credits_quantity.toString(),
      auto_recharge: 'true',
    }
  );

  if (paymentIntent.status === 'succeeded') {
    await creditService.addCredits(
      companyId,
      pack.credits_quantity,
      'auto_recharge',
      `Auto-recharged ${pack.credits_quantity} credits`,
      undefined,
      {
        amount_gbp: pack.price_gbp,
        stripe_payment_intent_id: paymentIntent.id,
        stripe_charge_id: paymentIntent.latest_charge as string,
      }
    );

    // TODO: Send auto-recharge confirmation email
  } else {
    throw new Error(`Auto-recharge payment failed: ${paymentIntent.status}`);
  }
}

// ============================================================================
// AGREEMENT BILLING
// ============================================================================

/**
 * Charge for agreement generation
 * Called when user generates an agreement PDF
 *
 * SIMPLIFIED: Always prompts for payment per agreement
 */
export async function chargeForAgreement(
  companyId: string,
  agreementId: string,
  agreementType: string = 'standard',
  userId?: string
): Promise<{ success: boolean; payment_intent_id?: string; client_secret?: string; requires_payment_method?: boolean }> {
  // Check if there's already a successful payment for this agreement
  const { data: existingPayment } = await supabase
    .from('agreement_payments')
    .select('*')
    .eq('agreement_id', agreementId)
    .eq('payment_status', 'succeeded')
    .single();

  if (existingPayment) {
    console.log(`Agreement ${agreementId} already has a successful payment: ${existingPayment.stripe_payment_intent_id}`);
    return {
      success: true,
      payment_intent_id: existingPayment.stripe_payment_intent_id,
    };
  }

  // Get pricing
  const priceGbp = await getAgreementPricing(agreementType);
  const amount = stripeService.poundsToPence(priceGbp);

  // Get Stripe customer
  const customerId = await getOrCreateStripeCustomer(companyId);

  // Check if customer has a saved payment method
  const { data: company } = await supabase
    .from('companies')
    .select('stripe_payment_method_id')
    .eq('id', companyId)
    .single();

  console.log('[Agreement] Checking for saved payment method:', {
    companyId,
    agreementId,
    hasPaymentMethod: !!company?.stripe_payment_method_id,
    paymentMethodId: company?.stripe_payment_method_id
  });

  const description = `Agreement generation: ${agreementType}`;
  const metadata = {
    company_id: companyId,
    agreement_id: agreementId,
    agreement_type: agreementType,
  };

  // If customer has saved payment method, charge automatically
  if (company?.stripe_payment_method_id) {
    console.log('[Agreement] Attempting auto-charge with saved payment method...');
    try {
      const paymentIntent = await stripeService.chargeCustomer(
        customerId,
        amount,
        description,
        metadata
      );

      console.log('[Agreement] Auto-charge succeeded!', { status: paymentIntent.status, id: paymentIntent.id });
      return {
        success: true,
        payment_intent_id: paymentIntent.id,
      };
    } catch (error) {
      console.error('[Agreement] Auto-charge failed, falling back to manual payment:', error);
      // Fall through to manual payment if auto-charge fails
    }
  }

  console.log('[Agreement] No saved payment method, creating manual payment intent');

  // Otherwise, create payment intent for manual payment
  const paymentIntent = await stripeService.createPaymentIntent(
    amount,
    customerId,
    description,
    metadata
  );

  return {
    success: false,
    requires_payment_method: true,
    client_secret: paymentIntent.client_secret || '',
    payment_intent_id: paymentIntent.id,
  };
}

// ============================================================================
// REFERENCE CREATION WITH CREDIT CHECK
// ============================================================================

/**
 * Check if company can create a reference
 * Returns true if they have credits, or provides payment options if not
 */
export async function canCreateReference(
  companyId: string
): Promise<{
  allowed: boolean;
  credits_remaining: number;
  requires_purchase: boolean;
  subscription_tiers?: PricingTier[];
  credit_packs?: CreditPack[];
}> {
  const balance = await creditService.getCreditBalance(companyId);

  if (balance.can_create_reference) {
    return {
      allowed: true,
      credits_remaining: balance.credits,
      requires_purchase: false,
    };
  }

  // Fetch purchase options
  const [tiers, packs] = await Promise.all([
    getSubscriptionTiers(),
    getCreditPacks(),
  ]);

  return {
    allowed: false,
    credits_remaining: 0,
    requires_purchase: true,
    subscription_tiers: tiers,
    credit_packs: packs,
  };
}

/**
 * Consume a credit for reference creation
 */
export async function consumeCreditForReference(
  companyId: string,
  referenceId: string,
  userId: string
): Promise<void> {
  await creditService.deductCredits(
    companyId,
    1,
    referenceId,
    'Reference creation',
    userId
  );
}

// ============================================================================
// PAYMENT METHOD MANAGEMENT
// ============================================================================

/**
 * Create a SetupIntent for saving a payment method
 * Following Stripe's recommended approach for save-and-reuse
 */
export async function createSetupIntent(companyId: string): Promise<{ clientSecret: string }> {
  const customerId = await getOrCreateStripeCustomer(companyId);

  const stripeInstance = stripeService.stripe();
  const setupIntent = await stripeInstance.setupIntents.create({
    customer: customerId,
    automatic_payment_methods: {
      enabled: true,
    },
  });

  if (!setupIntent.client_secret) {
    throw new Error('Failed to create setup intent');
  }

  return { clientSecret: setupIntent.client_secret };
}

/**
 * Save a payment method for a company
 */
export async function savePaymentMethod(
  companyId: string,
  paymentMethodId: string
): Promise<void> {
  const customerId = await getOrCreateStripeCustomer(companyId);

  // Attach and set as default
  await stripeService.attachPaymentMethod(paymentMethodId, customerId);
  await stripeService.setDefaultPaymentMethod(customerId, paymentMethodId);

  // Save to database and clear payment_method_required flag
  await supabase
    .from('companies')
    .update({
      stripe_payment_method_id: paymentMethodId,
      payment_method_required: false,
    })
    .eq('id', companyId);
}

/**
 * Get saved payment methods for a company
 */
export async function getPaymentMethods(companyId: string): Promise<any[]> {
  const { data: company } = await supabase
    .from('companies')
    .select('stripe_customer_id, stripe_payment_method_id')
    .eq('id', companyId)
    .single();

  if (!company?.stripe_customer_id) {
    return [];
  }

  const paymentMethods = await stripeService.listPaymentMethods(company.stripe_customer_id);

  // Mark the default payment method
  return paymentMethods.map(pm => ({
    ...pm,
    is_default: pm.id === company.stripe_payment_method_id
  }));
}

/**
 * Delete a payment method
 */
export async function deletePaymentMethod(
  companyId: string,
  paymentMethodId: string
): Promise<void> {
  const { data: company } = await supabase
    .from('companies')
    .select('stripe_customer_id, stripe_payment_method_id')
    .eq('id', companyId)
    .single();

  if (!company?.stripe_customer_id) {
    throw new Error('No Stripe customer found for this company');
  }

  // Detach the payment method from the customer in Stripe
  await stripeService.detachPaymentMethod(paymentMethodId);

  // If this was the default payment method, clear it from the database
  if (company.stripe_payment_method_id === paymentMethodId) {
    // Check if there are other payment methods
    const remainingMethods = await stripeService.listPaymentMethods(company.stripe_customer_id);
    const otherMethods = remainingMethods.filter(pm => pm.id !== paymentMethodId);

    await supabase
      .from('companies')
      .update({
        stripe_payment_method_id: null,
        // Set payment_method_required back to true if no other payment methods exist
        payment_method_required: otherMethods.length === 0,
      })
      .eq('id', companyId);
  }
}

// ============================================================================
// GUARANTOR REFERENCE BILLING
// ============================================================================

/**
 * Get guarantor reference pricing
 */
export async function getGuarantorReferencePricing(): Promise<number> {
  const { data, error } = await supabase
    .from('pricing_config')
    .select('price_gbp')
    .eq('product_type', 'guarantor_reference')
    .eq('product_key', 'guarantor_reference_standard')
    .eq('active', true)
    .single();

  if (error) {
    console.error('Failed to fetch guarantor reference pricing:', error.message);
    return 9.99; // Default fallback
  }

  return data?.price_gbp || 9.99;
}

/**
 * Charge for guarantor reference processing
 * Auto-charges using saved payment method - REQUIRED for guarantors
 *
 * @param companyId - The company being charged
 * @param guarantorReferenceId - The guarantor reference ID
 * @param userId - Optional user who triggered the charge
 * @returns Payment result with status
 */
export async function chargeForGuarantorReference(
  companyId: string,
  guarantorReferenceId: string,
  userId?: string
): Promise<{ success: boolean; payment_intent_id?: string; error?: string }> {
  // Check if there's already a successful payment for this guarantor reference
  const { data: existingPayment } = await supabase
    .from('guarantor_reference_payments')
    .select('*')
    .eq('guarantor_reference_id', guarantorReferenceId)
    .eq('payment_status', 'succeeded')
    .single();

  if (existingPayment) {
    console.log(`Guarantor reference ${guarantorReferenceId} already has a successful payment: ${existingPayment.stripe_payment_intent_id}`);
    return {
      success: true,
      payment_intent_id: existingPayment.stripe_payment_intent_id,
    };
  }

  // Get pricing
  const priceGbp = await getGuarantorReferencePricing();
  const amount = stripeService.poundsToPence(priceGbp);

  // Get Stripe customer
  const customerId = await getOrCreateStripeCustomer(companyId);

  // Check if customer has a saved payment method
  const { data: company } = await supabase
    .from('companies')
    .select('stripe_payment_method_id')
    .eq('id', companyId)
    .single();

  console.log('[GuarantorReference] Checking for saved payment method:', {
    companyId,
    guarantorReferenceId,
    hasPaymentMethod: !!company?.stripe_payment_method_id,
    paymentMethodId: company?.stripe_payment_method_id
  });

  // Guarantor references REQUIRE a saved payment method for auto-billing
  if (!company?.stripe_payment_method_id) {
    const errorMessage = 'Payment method required. Please add a payment method to your account before requesting guarantor references.';
    console.error('[GuarantorReference] No saved payment method found:', errorMessage);

    // Log failed payment attempt
    await supabase
      .from('guarantor_reference_payments')
      .insert({
        company_id: companyId,
        guarantor_reference_id: guarantorReferenceId,
        amount_gbp: priceGbp,
        payment_status: 'failed',
        failure_code: 'no_payment_method',
        failure_message: errorMessage,
        created_by: userId,
      });

    return {
      success: false,
      error: errorMessage,
    };
  }

  const description = `Guarantor Reference Processing (£${priceGbp})`;
  const metadata = {
    company_id: companyId,
    guarantor_reference_id: guarantorReferenceId,
    product_type: 'guarantor_reference',
  };

  // Auto-charge using saved payment method
  console.log('[GuarantorReference] Auto-charging with saved payment method...');
  try {
    const paymentIntent = await stripeService.chargeCustomer(
      customerId,
      amount,
      description,
      metadata
    );

    console.log('[GuarantorReference] Auto-charge succeeded!', {
      status: paymentIntent.status,
      id: paymentIntent.id
    });

    // Record successful payment
    await supabase
      .from('guarantor_reference_payments')
      .insert({
        company_id: companyId,
        guarantor_reference_id: guarantorReferenceId,
        amount_gbp: priceGbp,
        stripe_payment_intent_id: paymentIntent.id,
        stripe_charge_id: paymentIntent.latest_charge as string,
        payment_status: 'succeeded',
        paid_at: new Date().toISOString(),
        created_by: userId,
      });

    return {
      success: true,
      payment_intent_id: paymentIntent.id,
    };
  } catch (error: any) {
    console.error('[GuarantorReference] Auto-charge failed:', error);

    // Log failed payment
    await supabase
      .from('guarantor_reference_payments')
      .insert({
        company_id: companyId,
        guarantor_reference_id: guarantorReferenceId,
        amount_gbp: priceGbp,
        payment_status: 'failed',
        failure_code: error.code || 'charge_failed',
        failure_message: error.message || 'Payment failed',
        created_by: userId,
      });

    return {
      success: false,
      error: error.message || 'Payment failed. Please check your payment method.',
    };
  }
}

// ============================================================================
// AUTO-RECHARGE SETTINGS
// ============================================================================

/**
 * Update auto-recharge settings for a company
 */
export async function updateAutoRechargeSettings(
  companyId: string,
  settings: {
    enabled: boolean;
    threshold?: number;
    pack_size?: number;
  }
): Promise<void> {
  const updateData: any = {
    auto_recharge_enabled: settings.enabled,
  };

  if (settings.threshold !== undefined) {
    updateData.auto_recharge_threshold = settings.threshold;
  }

  if (settings.pack_size !== undefined) {
    updateData.auto_recharge_pack_size = settings.pack_size;
  }

  const { error } = await supabase
    .from('companies')
    .update(updateData)
    .eq('id', companyId);

  if (error) {
    throw new Error(`Failed to update auto-recharge settings: ${error.message}`);
  }
}

import Stripe from 'stripe';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-10-29.clover',
  typescript: true,
});

/**
 * Stripe Service
 *
 * Wrapper around Stripe API for PropertyGoose billing operations.
 * Handles customers, payment methods, subscriptions, and one-off payments.
 */

// ============================================================================
// CUSTOMER MANAGEMENT
// ============================================================================

/**
 * Create a new Stripe customer
 */
export async function createCustomer(
  email: string,
  companyName: string,
  metadata?: Record<string, string>
): Promise<Stripe.Customer> {
  return await stripe.customers.create({
    email,
    name: companyName,
    metadata: {
      ...metadata,
      source: 'propertygoose',
    },
  });
}

/**
 * Retrieve a Stripe customer by ID
 */
export async function getCustomer(customerId: string): Promise<Stripe.Customer> {
  return await stripe.customers.retrieve(customerId) as Stripe.Customer;
}

/**
 * Update a Stripe customer
 */
export async function updateCustomer(
  customerId: string,
  data: Stripe.CustomerUpdateParams
): Promise<Stripe.Customer> {
  return await stripe.customers.update(customerId, data);
}

/**
 * Delete a Stripe customer
 */
export async function deleteCustomer(customerId: string): Promise<Stripe.DeletedCustomer> {
  return await stripe.customers.del(customerId);
}

// ============================================================================
// PAYMENT METHODS
// ============================================================================

/**
 * Attach a payment method to a customer
 */
export async function attachPaymentMethod(
  paymentMethodId: string,
  customerId: string
): Promise<Stripe.PaymentMethod> {
  return await stripe.paymentMethods.attach(paymentMethodId, {
    customer: customerId,
  });
}

/**
 * Set a payment method as the default for a customer
 */
export async function setDefaultPaymentMethod(
  customerId: string,
  paymentMethodId: string
): Promise<Stripe.Customer> {
  return await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });
}

/**
 * List all payment methods for a customer
 */
export async function listPaymentMethods(
  customerId: string,
  type: 'card' = 'card'
): Promise<Stripe.PaymentMethod[]> {
  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type,
  });
  return paymentMethods.data;
}

/**
 * Detach a payment method from a customer
 */
export async function detachPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
  return await stripe.paymentMethods.detach(paymentMethodId);
}

// ============================================================================
// SUBSCRIPTIONS
// ============================================================================

/**
 * Create a subscription for recurring credit delivery
 */
export async function createSubscription(
  customerId: string,
  priceId: string,
  metadata?: Record<string, string>
): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: {
      payment_method_types: ['card'],
      save_default_payment_method: 'on_subscription',
    },
    expand: ['latest_invoice.payment_intent'],
    metadata: {
      ...metadata,
      source: 'propertygoose',
    },
  });
}

/**
 * Retrieve a subscription by ID
 */
export async function getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Update a subscription (e.g., change tier)
 */
export async function updateSubscription(
  subscriptionId: string,
  data: Stripe.SubscriptionUpdateParams
): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.update(subscriptionId, data);
}

/**
 * Cancel a subscription (at period end or immediately)
 */
export async function cancelSubscription(
  subscriptionId: string,
  cancelAtPeriodEnd: boolean = true
): Promise<Stripe.Subscription> {
  if (cancelAtPeriodEnd) {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  } else {
    return await stripe.subscriptions.cancel(subscriptionId);
  }
}

/**
 * Reactivate a canceled subscription (if not yet ended)
 */
export async function reactivateSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

// ============================================================================
// ONE-OFF PAYMENTS (Credit Packs & Agreements)
// ============================================================================

/**
 * Create a payment intent for one-off payment
 * Used for credit packs and agreement generation
 */
export async function createPaymentIntent(
  amount: number, // Amount in pence (e.g., 999 for £9.99)
  customerId: string,
  description: string,
  metadata?: Record<string, string>
): Promise<Stripe.PaymentIntent> {
  return await stripe.paymentIntents.create({
    amount,
    currency: 'gbp',
    customer: customerId,
    description,
    metadata: {
      ...metadata,
      source: 'propertygoose',
    },
    automatic_payment_methods: {
      enabled: true,
    },
  });
}

/**
 * Confirm a payment intent with a payment method
 * Used for auto-billing agreements
 */
export async function confirmPaymentIntent(
  paymentIntentId: string,
  paymentMethodId: string
): Promise<Stripe.PaymentIntent> {
  return await stripe.paymentIntents.confirm(paymentIntentId, {
    payment_method: paymentMethodId,
  });
}

/**
 * Charge a customer immediately using saved payment method
 * Used for agreement auto-billing
 */
export async function chargeCustomer(
  customerId: string,
  amount: number, // Amount in pence
  description: string,
  metadata?: Record<string, string>
): Promise<Stripe.PaymentIntent> {
  // Get the customer's default payment method
  const customer = await getCustomer(customerId);
  const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;

  if (!defaultPaymentMethod) {
    throw new Error('No default payment method found for customer');
  }

  const paymentIntent = await createPaymentIntent(amount, customerId, description, metadata);

  return await confirmPaymentIntent(
    paymentIntent.id,
    typeof defaultPaymentMethod === 'string' ? defaultPaymentMethod : defaultPaymentMethod.id
  );
}

/**
 * Retrieve a payment intent by ID
 */
export async function getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  return await stripe.paymentIntents.retrieve(paymentIntentId);
}

/**
 * Cancel a payment intent
 */
export async function cancelPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  return await stripe.paymentIntents.cancel(paymentIntentId);
}

// ============================================================================
// CHECKOUT SESSIONS (for easier payment flows)
// ============================================================================

/**
 * Create a Checkout Session for subscription signup
 */
export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  metadata?: Record<string, string>
): Promise<Stripe.Checkout.Session> {
  return await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      ...metadata,
      source: 'propertygoose',
    },
  });
}

/**
 * Create a Checkout Session for one-off credit pack purchase
 */
export async function createCreditPackCheckoutSession(
  customerId: string,
  amount: number,
  credits: number,
  successUrl: string,
  cancelUrl: string,
  metadata?: Record<string, string>
): Promise<Stripe.Checkout.Session> {
  return await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'gbp',
          unit_amount: amount,
          product_data: {
            name: `${credits} Reference Credits`,
            description: `Purchase ${credits} reference credits for PropertyGoose`,
          },
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      ...metadata,
      credits: credits.toString(),
      source: 'propertygoose',
    },
  });
}

// ============================================================================
// REFUNDS
// ============================================================================

/**
 * Create a refund for a payment
 */
export async function createRefund(
  paymentIntentId: string,
  amount?: number, // Optional: partial refund amount in pence
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
): Promise<Stripe.Refund> {
  return await stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount,
    reason,
  });
}

// ============================================================================
// WEBHOOK HANDLING
// ============================================================================

/**
 * Construct and verify a webhook event from Stripe
 * IMPORTANT: Must use raw body for signature verification
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

/**
 * Verify webhook signature without constructing event
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
): boolean {
  try {
    stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    return true;
  } catch (err) {
    return false;
  }
}

// ============================================================================
// PRICES & PRODUCTS (for managing Stripe catalog)
// ============================================================================

/**
 * Create a Stripe price for a subscription tier
 */
export async function createSubscriptionPrice(
  productName: string,
  amount: number, // Monthly amount in pence
  metadata?: Record<string, string>
): Promise<Stripe.Price> {
  // First create the product
  const product = await stripe.products.create({
    name: productName,
    description: `PropertyGoose ${productName} subscription`,
    metadata: {
      ...metadata,
      source: 'propertygoose',
    },
  });

  // Then create the recurring price
  return await stripe.prices.create({
    product: product.id,
    currency: 'gbp',
    unit_amount: amount,
    recurring: {
      interval: 'month',
    },
    metadata,
  });
}

/**
 * List all prices
 */
export async function listPrices(active: boolean = true): Promise<Stripe.Price[]> {
  const prices = await stripe.prices.list({
    active,
    expand: ['data.product'],
  });
  return prices.data;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert pounds to pence for Stripe
 */
export function poundsToPence(pounds: number): number {
  return Math.round(pounds * 100);
}

/**
 * Convert pence to pounds
 */
export function penceToPounds(pence: number): number {
  return pence / 100;
}

/**
 * Format amount as GBP currency string
 */
export function formatCurrency(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(penceToPounds(pence));
}

// Export the stripe instance for advanced use cases
export { stripe };

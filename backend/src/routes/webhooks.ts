import { Router, Request, Response } from 'express';
import * as stripeService from '../services/stripeService';
import * as billingService from '../services/billingService';
import * as creditService from '../services/creditService';
import { supabase } from '../config/supabase';

const router = Router();

/**
 * Stripe Webhook Handler
 *
 * IMPORTANT: This endpoint must receive the RAW body for signature verification.
 * Configure Express to use raw body for this route ONLY.
 *
 * In server.ts, add BEFORE express.json():
 *   app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), webhookRouter);
 */

router.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  if (!sig) {
    return res.status(400).send('No signature provided');
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).send('Webhook secret not configured');
  }

  let event;

  try {
    // Construct event from webhook payload
    event = stripeService.constructWebhookEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`Received Stripe webhook: ${event.type}`);

  try {
    // Handle the event
    switch (event.type) {
      // ========================================================================
      // SUBSCRIPTION EVENTS
      // ========================================================================

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      // ========================================================================
      // PAYMENT EVENTS (Credit Packs & Agreements)
      // ========================================================================

      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      // ========================================================================
      // INVOICE EVENTS (Subscription Billing)
      // ========================================================================

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;

      // ========================================================================
      // PAYMENT METHOD EVENTS
      // ========================================================================

      case 'payment_method.attached':
        console.log('Payment method attached:', event.data.object.id);
        break;

      case 'payment_method.detached':
        console.log('Payment method detached:', event.data.object.id);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Return 200 to acknowledge receipt
    res.json({ received: true });
  } catch (error: any) {
    console.error(`Error handling webhook ${event.type}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// WEBHOOK EVENT HANDLERS
// ============================================================================

/**
 * Handle subscription creation or update
 * Delivers credits when subscription becomes active or renews
 */
async function handleSubscriptionUpdate(subscription: any) {
  const { customer, status, metadata, id } = subscription;

  console.log(`Subscription ${id} status: ${status}`);

  // Update subscription in database
  const { data: dbSubscription, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('stripe_subscription_id', id)
    .single();

  if (error) {
    console.error('Failed to find subscription in database:', error);
    return;
  }

  // Update subscription status
  await supabase
    .from('subscriptions')
    .update({
      status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
    })
    .eq('stripe_subscription_id', id);

  // If subscription just became active or is renewing, deliver credits
  if (status === 'active') {
    const companyId = metadata.company_id || dbSubscription.company_id;
    const creditsPerMonth = dbSubscription.credits_per_month;
    const monthlyTotal = dbSubscription.monthly_total;

    // Add credits to company balance
    await creditService.addCredits(
      companyId,
      creditsPerMonth,
      'subscription_credit',
      `Monthly subscription: ${creditsPerMonth} credits`,
      undefined,
      {
        amount_gbp: monthlyTotal,
        stripe_payment_intent_id: subscription.latest_invoice,
      }
    );

    console.log(`Delivered ${creditsPerMonth} credits to company ${companyId}`);

    // TODO: Send email notification
  }
}

/**
 * Handle subscription deletion/cancellation
 */
async function handleSubscriptionDeleted(subscription: any) {
  const { id } = subscription;

  console.log(`Subscription ${id} deleted`);

  // Update subscription status in database
  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', id);

  // Note: We do NOT remove credits - they roll over forever
  // TODO: Send cancellation confirmation email
}

/**
 * Handle successful payment intent
 * Used for credit pack purchases and agreement payments
 */
async function handlePaymentSucceeded(paymentIntent: any) {
  const { id, metadata, amount, customer, payment_method } = paymentIntent;

  console.log(`Payment succeeded: ${id}, amount: ${amount}, metadata:`, metadata);

  // If save_payment_method flag is set, set this as the customer's default payment method
  if (metadata.save_payment_method === 'true' && payment_method && customer) {
    try {
      console.log(`Setting payment method ${payment_method} as default for customer ${customer}`);

      // The payment method is already attached by setup_future_usage
      // We just need to set it as the default
      const { stripe: getStripeInstance } = await import('../services/stripeService');
      const stripeInstance = getStripeInstance();

      await stripeInstance.customers.update(customer, {
        invoice_settings: {
          default_payment_method: payment_method,
        },
      });

      // Also update in our database
      await supabase
        .from('companies')
        .update({ stripe_payment_method_id: payment_method })
        .eq('id', metadata.company_id);

      console.log(`Payment method set as default successfully`);
    } catch (error) {
      console.error('Failed to set default payment method:', error);
    }
  }

  // Determine payment type from metadata
  if (metadata.credits) {
    // This is a credit pack purchase
    const companyId = metadata.company_id;
    const credits = parseInt(metadata.credits);
    const amountGbp = amount / 100; // Convert pence to pounds

    await billingService.fulfillCreditPackPurchase(
      companyId,
      credits,
      amountGbp,
      id
    );

    console.log(`Fulfilled credit pack purchase: ${credits} credits to company ${companyId}`);
    // TODO: Send receipt email
  } else if (metadata.agreement_id) {
    // This is an agreement payment - upsert payment record
    const agreementId = metadata.agreement_id;
    const companyId = metadata.company_id;
    const agreementType = metadata.agreement_type || 'standard';
    const amountGbp = amount / 100;

    // Try to update existing record, or insert if not exists
    const { data: existingPayment } = await supabase
      .from('agreement_payments')
      .select('id')
      .eq('stripe_payment_intent_id', id)
      .single();

    if (existingPayment) {
      // Update existing record
      await supabase
        .from('agreement_payments')
        .update({
          payment_status: 'succeeded',
          stripe_charge_id: paymentIntent.latest_charge as string,
          paid_at: new Date().toISOString(),
        })
        .eq('stripe_payment_intent_id', id);
    } else {
      // Insert new record
      await supabase
        .from('agreement_payments')
        .insert({
          company_id: companyId,
          agreement_id: agreementId,
          amount_gbp: amountGbp,
          agreement_type: agreementType,
          stripe_payment_intent_id: id,
          stripe_charge_id: paymentIntent.latest_charge as string,
          payment_status: 'succeeded',
          paid_at: new Date().toISOString(),
        });
    }

    console.log(`Agreement payment succeeded for agreement ${agreementId}`);
    // TODO: Send receipt email
  }
}

/**
 * Handle failed payment intent
 */
async function handlePaymentFailed(paymentIntent: any) {
  const { id, metadata, last_payment_error } = paymentIntent;

  console.error(`Payment failed: ${id}`, last_payment_error);

  // Log failure details
  if (metadata.agreement_id) {
    await supabase
      .from('agreement_payments')
      .update({
        payment_status: 'failed',
        failure_code: last_payment_error?.code,
        failure_message: last_payment_error?.message,
      })
      .eq('stripe_payment_intent_id', id);

    // TODO: Send payment failed email
  }
}

/**
 * Handle successful invoice payment (subscription)
 */
async function handleInvoicePaid(invoice: any) {
  const { id, subscription, customer } = invoice;

  console.log(`Invoice paid: ${id} for subscription ${subscription}`);

  // Credits are delivered in handleSubscriptionUpdate
  // This is mainly for logging and email notifications
  // TODO: Send invoice receipt email
}

/**
 * Handle failed invoice payment (subscription)
 */
async function handleInvoicePaymentFailed(invoice: any) {
  const { id, subscription, attempt_count, next_payment_attempt } = invoice;

  console.error(`Invoice payment failed: ${id}, attempt ${attempt_count}`);

  // Update subscription status to past_due
  await supabase
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('stripe_subscription_id', subscription);

  // TODO: Send payment failed email with retry date
}

export default router;

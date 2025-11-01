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
  const updateData: any = {
    status,
    cancel_at_period_end: subscription.cancel_at_period_end || false,
    canceled_at: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000).toISOString()
      : null,
  };

  // Only add period dates if they exist (they won't exist for incomplete subscriptions)
  if (subscription.current_period_start) {
    updateData.current_period_start = new Date(subscription.current_period_start * 1000).toISOString();
  }
  if (subscription.current_period_end) {
    updateData.current_period_end = new Date(subscription.current_period_end * 1000).toISOString();
  }

  await supabase
    .from('subscriptions')
    .update(updateData)
    .eq('stripe_subscription_id', id);

  // Note: Credits are delivered in payment_intent.succeeded (first payment)
  // and invoice.paid (renewals), not here, to avoid duplicates
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

  // Check if this is a subscription payment
  if (metadata.subscription_id) {
    console.log(`Subscription payment succeeded for: ${metadata.subscription_id}`);

    try {
      // Get subscription details from database
      const { data: dbSubscription, error: dbError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('stripe_subscription_id', metadata.subscription_id)
        .single();

      console.log(`Database subscription found: ${!!dbSubscription}, error: ${dbError?.message || 'none'}`);

      if (dbSubscription) {
        const companyId = metadata.company_id || dbSubscription.company_id;
        const creditsPerMonth = dbSubscription.credits_per_month;
        const monthlyTotal = dbSubscription.monthly_total;

        // Check if we already delivered credits for this invoice (prevents duplicates)
        const invoiceId = metadata.invoice_id;
        const { data: existingTransaction } = await supabase
          .from('credit_transactions')
          .select('id')
          .eq('company_id', companyId)
          .eq('metadata->>stripe_invoice_id', invoiceId)
          .single();

        if (existingTransaction) {
          console.log(`Credits already delivered for invoice ${invoiceId}, skipping`);
        } else {
          console.log(`Delivering ${creditsPerMonth} credits to company ${companyId} (first payment)`);

          // Deliver credits immediately when payment succeeds
          await creditService.addCredits(
            companyId,
            creditsPerMonth,
            'subscription_credit',
            `Monthly subscription: ${creditsPerMonth} credits`,
            undefined,
            {
              amount_gbp: monthlyTotal,
              stripe_payment_intent_id: id,
              stripe_invoice_id: invoiceId,
              stripe_subscription_id: metadata.subscription_id,
            } as any
          );

          console.log(`Successfully delivered ${creditsPerMonth} credits to company ${companyId} for subscription ${metadata.subscription_id}`);
        }

        // Update subscription status in database (will be updated again by subscription.updated webhook)
        await supabase
          .from('subscriptions')
          .update({ status: 'active' })
          .eq('stripe_subscription_id', metadata.subscription_id);
      } else {
        console.error(`No database subscription found for ${metadata.subscription_id}`);
      }
    } catch (error) {
      console.error('Error handling subscription payment:', error);
      // Don't throw - we don't want to fail the webhook
    }

    return; // Exit early for subscription payments
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
 * This handles monthly renewals
 */
async function handleInvoicePaid(invoice: any) {
  const { id, subscription: subscriptionId, customer, amount_paid, billing_reason } = invoice;

  console.log(`Invoice paid: ${id} for subscription ${subscriptionId}, billing_reason: ${billing_reason}`);

  // Only deliver credits for subscription cycle invoices, not for other billing reasons
  if (!subscriptionId || billing_reason === 'manual') {
    console.log('Skipping credit delivery - not a subscription cycle invoice');
    return;
  }

  try {
    // Get subscription details from database
    const { data: dbSubscription, error: dbError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('stripe_subscription_id', subscriptionId)
      .single();

    if (dbError || !dbSubscription) {
      console.error(`No database subscription found for ${subscriptionId}:`, dbError);
      return;
    }

    const companyId = dbSubscription.company_id;
    const creditsPerMonth = dbSubscription.credits_per_month;
    const monthlyTotal = dbSubscription.monthly_total;

    // Check if we already delivered credits for this invoice
    const { data: existingTransaction } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('company_id', companyId)
      .eq('metadata->>stripe_invoice_id', id)
      .single();

    if (existingTransaction) {
      console.log(`Credits already delivered for invoice ${id}, skipping`);
      return;
    }

    console.log(`Delivering ${creditsPerMonth} credits for subscription renewal (invoice: ${id})`);

    // Deliver credits for this billing period
    await creditService.addCredits(
      companyId,
      creditsPerMonth,
      'subscription_credit',
      `Monthly subscription renewal: ${creditsPerMonth} credits`,
      undefined,
      {
        amount_gbp: monthlyTotal,
        stripe_invoice_id: id,
        stripe_subscription_id: subscriptionId,
      } as any
    );

    console.log(`Successfully delivered ${creditsPerMonth} credits to company ${companyId} for invoice ${id}`);
    // TODO: Send invoice receipt email
  } catch (error) {
    console.error('Error handling invoice payment:', error);
  }
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

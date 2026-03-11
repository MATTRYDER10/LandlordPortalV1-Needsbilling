import { Router, Request, Response } from 'express';
import Twilio from 'twilio';
import crypto from 'crypto';
import * as stripeService from '../services/stripeService';
import * as billingService from '../services/billingService';
import * as creditService from '../services/creditService';
import { supabase } from '../config/supabase';
import { updateSMSDeliveryStatus } from '../services/smsService';
import { updateCallStatus } from '../services/vapiService';
import { updateEmailDeliveryStatus, logEmailDeliveryToAuditLog, sendEmail, loadEmailTemplate } from '../services/emailService';
import { decrypt } from '../services/encryption';
import { getFrontendUrl } from '../utils/frontendUrl';

const router = Router();

/**
 * Helper function to get company email details for sending notifications
 */
async function getCompanyEmailDetails(companyId: string): Promise<{ name: string; email: string } | null> {
  try {
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted, email_encrypted')
      .eq('id', companyId)
      .single();

    if (company && company.email_encrypted) {
      const name = decrypt(company.name_encrypted) || 'Valued Customer';
      const email = decrypt(company.email_encrypted);
      if (email) {
        return { name, email };
      }
    }
  } catch (error) {
    console.error('[Webhooks] Failed to get company email details:', error);
  }
  return null;
}

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
// TWILIO WEBHOOK HANDLER
// ============================================================================

/**
 * Twilio SMS Status Webhook Handler
 *
 * Receives delivery status updates from Twilio for SMS messages.
 * Updates the sms_delivery_logs table with the current status.
 *
 * Status values from Twilio:
 * - queued: Message is queued to be sent
 * - sent: Message has been sent to carrier
 * - delivered: Carrier confirmed delivery to recipient
 * - undelivered: Carrier could not deliver the message
 * - failed: Message failed to send
 */
router.post('/twilio', async (req: Request, res: Response) => {
  const {
    MessageSid,
    MessageStatus,
    ErrorCode,
    ErrorMessage,
  } = req.body;

  console.log(`Twilio webhook received: SID=${MessageSid}, Status=${MessageStatus}`);

  // Validate Twilio signature (optional but recommended for production)
  const twilioSignature = req.headers['x-twilio-signature'] as string;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (authToken && twilioSignature && process.env.BACKEND_URL) {
    const webhookUrl = `${process.env.BACKEND_URL}/api/webhooks/twilio`;
    const isValid = Twilio.validateRequest(
      authToken,
      twilioSignature,
      webhookUrl,
      req.body
    );

    if (!isValid) {
      console.warn('Invalid Twilio signature - request may be spoofed');
      // In production, you might want to reject invalid signatures:
      // return res.status(403).send('Invalid signature');
    }
  }

  if (!MessageSid) {
    return res.status(400).send('Missing MessageSid');
  }

  try {
    // Update delivery status in database
    await updateSMSDeliveryStatus(
      MessageSid,
      MessageStatus,
      ErrorCode,
      ErrorMessage
    );

    // Return 200 to acknowledge receipt (Twilio requires this)
    res.status(200).send('OK');
  } catch (error: any) {
    console.error('Error handling Twilio webhook:', error);
    // Still return 200 to prevent Twilio from retrying
    res.status(200).send('OK');
  }
});

// ============================================================================
// VAPI WEBHOOK HANDLER
// ============================================================================

/**
 * VAPI Voice Call Status Webhook Handler
 *
 * Receives call status updates and end-of-call reports from VAPI.
 * Updates the call_delivery_logs table with the current status.
 *
 * Event types from VAPI:
 * - status-update: Call status changed (ringing, in-progress, etc.)
 * - end-of-call-report: Call ended, includes transcript and summary
 */
router.post('/vapi', async (req: Request, res: Response) => {
  const { message } = req.body;

  // VAPI sends events with a 'message' wrapper containing 'type' and data
  const eventType = message?.type;
  const call = message?.call;

  console.log(`[VAPI Webhook] Received: type=${eventType}, callId=${call?.id || 'unknown'}`);

  if (!call?.id) {
    console.log('[VAPI Webhook] No call ID in payload, acknowledging');
    return res.status(200).send('OK');
  }

  try {
    switch (eventType) {
      case 'status-update':
        // Call status changed (queued, ringing, in-progress, forwarding, ended)
        await updateCallStatus(call.id, message.status || call.status, {
          startedAt: call.startedAt,
          endedAt: call.endedAt
        });
        break;

      case 'end-of-call-report':
        // Call ended - includes final status, duration, transcript, summary
        await updateCallStatus(call.id, 'ended', {
          endedReason: message.endedReason,
          duration: message.durationSeconds,
          transcript: message.transcript,
          summary: message.summary,
          startedAt: call.startedAt,
          endedAt: call.endedAt
        });
        break;

      case 'hang':
        // Call was hung up
        await updateCallStatus(call.id, 'ended', {
          endedReason: 'hang',
          endedAt: call.endedAt
        });
        break;

      case 'speech-update':
      case 'transcript':
      case 'function-call':
      case 'tool-calls':
        // Informational events during call - log but don't update status
        console.log(`[VAPI Webhook] Informational event: ${eventType}`);
        break;

      default:
        console.log(`[VAPI Webhook] Unhandled event type: ${eventType}`);
    }

    // Always return 200 to acknowledge receipt
    res.status(200).send('OK');
  } catch (error: any) {
    console.error('[VAPI Webhook] Error handling webhook:', error);
    // Still return 200 to prevent VAPI from retrying
    res.status(200).send('OK');
  }
});

// ============================================================================
// RESEND WEBHOOK HANDLER
// ============================================================================

/**
 * Resend Email Delivery Status Webhook Handler
 *
 * Receives delivery status updates from Resend for emails.
 * Updates the email_delivery_logs table with the current status.
 *
 * Event types from Resend:
 * - email.sent: Email accepted by Resend (initial status)
 * - email.delivered: Successfully delivered to recipient's mail server
 * - email.bounced: Permanently rejected by recipient's mail server
 * - email.complained: Recipient marked as spam
 * - email.delivery_delayed: Temporary delivery issues
 */
router.post('/resend', async (req: Request, res: Response) => {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  // Verify webhook signature if secret is configured
  if (webhookSecret) {
    const svixId = req.headers['svix-id'] as string;
    const svixTimestamp = req.headers['svix-timestamp'] as string;
    const svixSignature = req.headers['svix-signature'] as string;

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.warn('[Resend Webhook] Missing Svix headers');
      return res.status(400).send('Missing signature headers');
    }

    // Verify timestamp is within 5 minutes to prevent replay attacks
    const timestamp = parseInt(svixTimestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > 300) {
      console.warn('[Resend Webhook] Timestamp too old or in future');
      return res.status(400).send('Invalid timestamp');
    }

    // Get raw body (set by express.json verify callback in server.ts)
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    // Construct signed content: id.timestamp.rawBody
    const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;

    // Extract signatures from header (format: "v1,sig1 v1,sig2")
    const expectedSignatures = svixSignature.split(' ').map(sig => {
      const parts = sig.split(',');
      return parts[1]; // Get the signature part after "v1,"
    });

    // Base64 decode the secret (after removing whsec_ prefix)
    const secretBase64 = webhookSecret.replace('whsec_', '');
    const secretBytes = Buffer.from(secretBase64, 'base64');

    // Compute HMAC-SHA256 signature
    const computedSignature = crypto
      .createHmac('sha256', secretBytes)
      .update(signedContent)
      .digest('base64');

    const isValid = expectedSignatures.some(sig => sig === computedSignature);

    if (!isValid) {
      console.warn('[Resend Webhook] Invalid signature');
      return res.status(401).send('Invalid signature');
    }
  }

  const { type, data } = req.body;
  const emailId = data?.email_id;

  console.log(`[Resend Webhook] Received: type=${type}, emailId=${emailId || 'unknown'}`);

  if (!emailId) {
    console.log('[Resend Webhook] No email ID in payload, acknowledging');
    return res.status(200).send('OK');
  }

  try {
    let status: string;
    let bounceType: string | undefined;
    let errorMessage: string | undefined;

    switch (type) {
      case 'email.sent':
        status = 'sent';
        break;

      case 'email.delivered':
        status = 'delivered';
        break;

      case 'email.bounced':
        status = 'bounced';
        bounceType = data.bounce?.type || 'hard';
        errorMessage = data.bounce?.message || data.bounce?.reason || 'Email bounced';
        break;

      case 'email.complained':
        status = 'complained';
        errorMessage = 'Recipient marked email as spam';
        break;

      case 'email.delivery_delayed':
        status = 'delivery_delayed';
        errorMessage = data.delay?.message || 'Delivery delayed';
        break;

      default:
        console.log(`[Resend Webhook] Unhandled event type: ${type}`);
        return res.status(200).send('OK');
    }

    // Update delivery status in database
    const result = await updateEmailDeliveryStatus(
      emailId,
      status,
      bounceType,
      errorMessage
    );

    // Log bounces and complaints to audit log for visibility
    if (result?.referenceId && result?.referenceType) {
      if (status === 'bounced' || status === 'complained') {
        await logEmailDeliveryToAuditLog(
          result.referenceId,
          result.referenceType,
          status as 'bounced' | 'complained',
          errorMessage
        );
      }
    }

    // Return 200 to acknowledge receipt
    res.status(200).send('OK');
  } catch (error: any) {
    console.error('[Resend Webhook] Error handling webhook:', error);
    // Still return 200 to prevent Resend from retrying
    res.status(200).send('OK');
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

  // Period dates are on the subscription items, not the top-level subscription object
  // Get them from the first subscription item if available
  const firstItem = subscription.items?.data?.[0];
  if (firstItem?.current_period_start) {
    updateData.current_period_start = new Date(firstItem.current_period_start * 1000).toISOString();
  }
  if (firstItem?.current_period_end) {
    updateData.current_period_end = new Date(firstItem.current_period_end * 1000).toISOString();
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

  // Get subscription details before updating
  const { data: dbSub } = await supabase
    .from('subscriptions')
    .select('company_id, plan_name, credits_per_month')
    .eq('stripe_subscription_id', id)
    .single();

  // Update subscription status in database
  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', id);

  // Note: We do NOT remove credits - they roll over forever

  // Send cancellation confirmation email
  if (dbSub?.company_id) {
    try {
      const companyDetails = await getCompanyEmailDetails(dbSub.company_id);
      if (companyDetails) {
        // Get remaining credits
        const { data: balanceData } = await supabase
          .from('company_credits')
          .select('balance')
          .eq('company_id', dbSub.company_id)
          .single();

        const html = loadEmailTemplate('credits-purchased-receipt', {
          CompanyName: companyDetails.name,
          CreditsAdded: '0',
          AmountPaid: '0.00',
          PricePerCredit: '—',
          PaymentMethod: 'Subscription Cancelled',
          TransactionId: id.substring(0, 20) + '...',
          PurchaseDate: new Date().toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          }),
          NewBalance: (balanceData?.balance || 0).toString() + ' (remaining credits never expire)',
          DashboardLink: `${getFrontendUrl()}/billing`
        });

        await sendEmail({
          to: companyDetails.email,
          subject: 'Subscription Cancelled - PropertyGoose',
          html
        });

        console.log(`[Webhooks] Sent subscription cancellation email to ${companyDetails.email}`);
      }
    } catch (emailError) {
      console.error('[Webhooks] Failed to send cancellation email:', emailError);
    }
  }
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

        // Update subscription status and period dates in database
        // Fetch the latest subscription data from Stripe to get period dates
        const subscription: any = await stripeService.getSubscription(metadata.subscription_id);

        const updateData: any = { status: 'active' };

        // Period dates are on the subscription items, not the top-level subscription object
        const firstItem = subscription.items?.data?.[0];
        if (firstItem?.current_period_start) {
          updateData.current_period_start = new Date(firstItem.current_period_start * 1000).toISOString();
        }
        if (firstItem?.current_period_end) {
          updateData.current_period_end = new Date(firstItem.current_period_end * 1000).toISOString();
        }

        await supabase
          .from('subscriptions')
          .update(updateData)
          .eq('stripe_subscription_id', metadata.subscription_id);

        console.log(`Updated subscription ${metadata.subscription_id} with period: ${updateData.current_period_start} to ${updateData.current_period_end}`);
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
    // Receipt email is sent by fulfillCreditPackPurchase
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

    // Send agreement payment receipt email
    if (companyId) {
      try {
        const companyDetails = await getCompanyEmailDetails(companyId);
        if (companyDetails) {
          // Get agreement details
          const { data: agreement } = await supabase
            .from('agreements')
            .select('property_address, tenant_names, agreement_type, pdf_url')
            .eq('id', agreementId)
            .single();

          const html = loadEmailTemplate('agreement-payment-receipt', {
            AgentLogoUrl: 'https://app.propertygoose.co.uk/PropertyGooseLogo.png',
            CompanyName: companyDetails.name,
            PropertyAddress: agreement?.property_address || 'Property Address',
            TenantNames: agreement?.tenant_names || 'Tenants',
            AgreementType: agreementType.charAt(0).toUpperCase() + agreementType.slice(1),
            AmountPaid: amountGbp.toFixed(2),
            PaymentMethod: 'Card',
            TransactionId: id.substring(0, 20) + '...',
            PaymentDate: new Date().toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            }),
            AgreementLink: agreement?.pdf_url || `${getFrontendUrl()}/agreements`
          });

          await sendEmail({
            to: companyDetails.email,
            subject: 'Agreement Payment Receipt - PropertyGoose',
            html
          });

          console.log(`[Webhooks] Sent agreement payment receipt to ${companyDetails.email}`);
        }
      } catch (emailError) {
        console.error('[Webhooks] Failed to send agreement payment receipt:', emailError);
      }
    }
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

    // Send payment failed email
    const companyId = metadata.company_id;
    if (companyId) {
      try {
        const companyDetails = await getCompanyEmailDetails(companyId);
        if (companyDetails) {
          const html = loadEmailTemplate('payment-failed', {
            CompanyName: companyDetails.name,
            PaymentType: 'Agreement Payment',
            Amount: ((paymentIntent.amount || 0) / 100).toFixed(2),
            FailureReason: last_payment_error?.message || 'Payment could not be processed',
            AttemptDate: new Date().toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }),
            PaymentMethod: last_payment_error?.payment_method?.type || 'Card',
            BillingLink: `${getFrontendUrl()}/billing`
          });

          await sendEmail({
            to: companyDetails.email,
            subject: 'Payment Failed - Action Required',
            html
          });

          console.log(`[Webhooks] Sent payment failed notification to ${companyDetails.email}`);
        }
      } catch (emailError) {
        console.error('[Webhooks] Failed to send payment failed email:', emailError);
      }
    }
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

    // Send subscription renewal receipt email
    try {
      const companyDetails = await getCompanyEmailDetails(companyId);
      if (companyDetails) {
        // Get new balance
        const { data: balanceData } = await supabase
          .from('company_credits')
          .select('balance')
          .eq('company_id', companyId)
          .single();

        const html = loadEmailTemplate('credits-purchased-receipt', {
          CompanyName: companyDetails.name,
          CreditsAdded: creditsPerMonth.toString(),
          AmountPaid: monthlyTotal.toFixed(2),
          PricePerCredit: (monthlyTotal / creditsPerMonth).toFixed(2),
          PaymentMethod: 'Subscription (Auto-Renewal)',
          TransactionId: id.substring(0, 20) + '...',
          PurchaseDate: new Date().toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          }),
          NewBalance: (balanceData?.balance || creditsPerMonth).toString(),
          DashboardLink: `${getFrontendUrl()}/billing`
        });

        await sendEmail({
          to: companyDetails.email,
          subject: 'Subscription Renewal Receipt - PropertyGoose',
          html
        });

        console.log(`[Webhooks] Sent subscription renewal receipt to ${companyDetails.email}`);
      }
    } catch (emailError) {
      console.error('[Webhooks] Failed to send invoice receipt email:', emailError);
    }
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

  // Get subscription details
  const { data: dbSub } = await supabase
    .from('subscriptions')
    .select('company_id, plan_name, monthly_total')
    .eq('stripe_subscription_id', subscription)
    .single();

  // Update subscription status to past_due
  await supabase
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('stripe_subscription_id', subscription);

  // Send payment failed email with retry date
  if (dbSub?.company_id) {
    try {
      const companyDetails = await getCompanyEmailDetails(dbSub.company_id);
      if (companyDetails) {
        const retryDate = next_payment_attempt
          ? new Date(next_payment_attempt * 1000).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })
          : 'Soon';

        const html = loadEmailTemplate('payment-failed', {
          CompanyName: companyDetails.name,
          PaymentType: `Subscription (${dbSub.plan_name || 'Monthly'})`,
          Amount: (dbSub.monthly_total || 0).toFixed(2),
          FailureReason: `Payment attempt ${attempt_count} failed. Next retry: ${retryDate}`,
          AttemptDate: new Date().toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          PaymentMethod: 'Saved Card',
          BillingLink: `${getFrontendUrl()}/billing`
        });

        await sendEmail({
          to: companyDetails.email,
          subject: 'Subscription Payment Failed - Action Required',
          html
        });

        console.log(`[Webhooks] Sent subscription payment failed notification to ${companyDetails.email}`);
      }
    } catch (emailError) {
      console.error('[Webhooks] Failed to send payment failed email:', emailError);
    }
  }
}

// ============================================================================
// REPOSIT WEBHOOK HANDLER
// ============================================================================

/**
 * Reposit Webhook Handler
 *
 * Receives status updates from Reposit for deposit replacement registrations.
 *
 * Events from Reposit:
 * - reposit.tenant.confirmed: Tenant confirmed the Reposit
 * - reposit.tenant.signed: Tenant signed the agreement
 * - reposit.tenant.paid: Tenant paid the fee
 * - reposit.completed: Reposit is active and coverage started
 * - reposit.deactivated: Reposit was cancelled
 * - reposit.closed: Tenancy ended
 */
router.post('/reposit', async (req: Request, res: Response) => {
  const { event, data } = req.body;

  console.log(`[Reposit Webhook] Received: event=${event}, repositId=${data?.id || 'unknown'}`);

  if (!data?.id) {
    console.log('[Reposit Webhook] No reposit ID in payload, acknowledging');
    return res.status(200).send('OK');
  }

  const repositId = data.id;

  try {
    const { updateRepositRegistrationStatus } = await import('../services/repositService');

    switch (event) {
      case 'reposit.tenant.confirmed':
        await updateRepositRegistrationStatus(repositId, 'tenant_confirmed', {
          tenant_confirmed_at: new Date().toISOString()
        });
        console.log(`[Reposit Webhook] Tenant confirmed for ${repositId}`);
        break;

      case 'reposit.tenant.signed':
        await updateRepositRegistrationStatus(repositId, 'tenant_signed', {
          tenant_signed_at: new Date().toISOString()
        });
        console.log(`[Reposit Webhook] Tenant signed for ${repositId}`);
        break;

      case 'reposit.tenant.paid':
        await updateRepositRegistrationStatus(repositId, 'tenant_paid', {
          tenant_paid_at: new Date().toISOString()
        });
        console.log(`[Reposit Webhook] Tenant paid for ${repositId}`);
        break;

      case 'reposit.completed':
        await updateRepositRegistrationStatus(repositId, 'completed', {
          completed_at: new Date().toISOString()
        });

        // Update tenancy.deposit_protected_at
        const { data: registration } = await supabase
          .from('reposit_registrations')
          .select('tenancy_id')
          .eq('reposit_id', repositId)
          .single();

        if (registration?.tenancy_id) {
          await supabase
            .from('tenancies')
            .update({ deposit_protected_at: new Date().toISOString() })
            .eq('id', registration.tenancy_id);
          console.log(`[Reposit Webhook] Updated tenancy ${registration.tenancy_id} deposit_protected_at`);
        }

        console.log(`[Reposit Webhook] Reposit completed for ${repositId}`);
        break;

      case 'reposit.deactivated':
        await updateRepositRegistrationStatus(repositId, 'deactivated', {
          deactivated_at: new Date().toISOString()
        });
        console.log(`[Reposit Webhook] Reposit deactivated for ${repositId}`);
        break;

      case 'reposit.closed':
        await updateRepositRegistrationStatus(repositId, 'closed', {
          closed_at: new Date().toISOString()
        });
        console.log(`[Reposit Webhook] Reposit closed for ${repositId}`);
        break;

      default:
        console.log(`[Reposit Webhook] Unhandled event: ${event}`);
    }

    res.status(200).send('OK');
  } catch (error: any) {
    console.error('[Reposit Webhook] Error handling webhook:', error);
    // Still return 200 to prevent retries
    res.status(200).send('OK');
  }
});

export default router;

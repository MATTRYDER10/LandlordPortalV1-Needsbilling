/**
 * Backend endpoint needed: POST /api/billing/checkout-session
 *
 * Add this to the shared PropertyGoose backend billing routes.
 *
 * Stripe Product IDs:
 *   - landlord_standard:      prod_UPBRukOnUA20ky  (£11.99/mo promo, £14.99/mo standard)
 *   - landlord_professional:  prod_UQRXREPnA55UZi  (£24.99/mo)
 *   - landlord_payg:          prod_UQRX85iRU7ZK9y  (per-reference, one-off charges)
 *
 * You'll need Price IDs for each product. Create them in Stripe Dashboard
 * or via API, then map them below.
 */

const PLAN_CONFIG = {
  landlord_standard: {
    stripe_price_id: 'price_XXXXX', // Create recurring £11.99/mo price on prod_UPBRukOnUA20ky
    mode: 'subscription',
  },
  landlord_professional: {
    stripe_price_id: 'price_XXXXX', // Create recurring £24.99/mo price on prod_UQRXREPnA55UZi
    mode: 'subscription',
  },
}

// Express route handler
async function createCheckoutSession(req, res) {
  const { plan, success_url, cancel_url } = req.body
  const userId = req.user.id       // from auth middleware
  const companyId = req.user.company_id

  const config = PLAN_CONFIG[plan]
  if (!config) {
    return res.status(400).json({ error: 'Invalid plan' })
  }

  // Find or create Stripe customer for this user
  let stripeCustomerId = await getStripeCustomerId(companyId) // your existing lookup
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: req.user.email,
      metadata: { company_id: companyId, user_id: userId },
    })
    stripeCustomerId = customer.id
    await saveStripeCustomerId(companyId, stripeCustomerId) // your existing save
  }

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: config.mode,
    line_items: [{ price: config.stripe_price_id, quantity: 1 }],
    success_url,
    cancel_url,
    metadata: { company_id: companyId, plan },
  })

  return res.json({ url: session.url })
}

/**
 * Webhook handler: listen for checkout.session.completed
 *
 * When Stripe fires this event:
 * 1. Look up company_id from session.metadata
 * 2. Store the subscription ID (session.subscription) in your subscriptions table
 * 3. Mark the subscription as 'active'
 * 4. The frontend will re-fetch via GET /api/billing/subscriptions/active
 */

/**
 * BULK REFERENCES (PAYG & Subscribed)
 *
 * No individual Stripe products needed per pack size.
 * Just calculate the total and create a one-off checkout session:
 *
 *   const session = await stripe.checkout.sessions.create({
 *     customer: stripeCustomerId,
 *     mode: 'payment',
 *     line_items: [{
 *       price_data: {
 *         currency: 'gbp',
 *         product: 'prod_UQRX85iRU7ZK9y',  // PAYG product
 *         unit_amount: Math.round(pricePerRef * 100),  // pence
 *       },
 *       quantity: numReferences,
 *     }],
 *     success_url: '...',
 *     cancel_url: '...',
 *     metadata: { company_id, type: 'bulk_references', quantity: numReferences },
 *   })
 *
 * The webhook then credits reference_credits for the company.
 */

module.exports = { createCheckoutSession }

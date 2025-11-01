# Stripe Billing Implementation - PropertyGoose

## 🎉 Implementation Status

### ✅ **COMPLETED** - Backend Infrastructure (Phase 1-3)

This document tracks the Stripe billing implementation for PropertyGoose's credit-based reference system and auto-billed agreements.

---

## System Architecture

### **Two-Track Billing System**

#### Track 1: References (Credit-Based)
- **1 credit = 1 reference**
- Credits purchased via subscriptions or one-off packs
- Credits roll over forever (never expire)
- Block reference creation if no credits available

#### Track 2: Agreements (Pay-Per-Use Auto-Billing)
- **£9.99 per standard agreement** (variable pricing supported)
- Charge saved payment method immediately when PDF generated
- Block PDF generation if payment fails

---

## 📦 What's Been Built

### **Database Schema** ✅
**Files**: `backend/migrations/046_create_billing_tables.sql`, `047_seed_pricing_config.sql`

Created 4 new tables:
1. **subscriptions** - Recurring credit subscriptions
2. **credit_transactions** - All credit additions/deductions
3. **agreement_payments** - Agreement payment records
4. **pricing_config** - Flexible pricing configuration

Added columns to **companies** table:
- `reference_credits` - Current credit balance
- `stripe_customer_id` - Stripe customer ID
- `stripe_payment_method_id` - Saved payment method
- `auto_recharge_enabled` - Auto-recharge toggle
- `auto_recharge_threshold` - Trigger threshold (default: 5)
- `auto_recharge_pack_size` - Pack size to buy (default: 25)

### **Pricing Configuration** ✅
Seeded in database:

**Subscription Tiers** (Monthly, Prepaid):
- Small (Under 20): 20 credits @ £17.50/credit = £350/month
- Medium (20-39): 30 credits @ £16.00/credit = £480/month ⭐ Most Popular
- Large (40-49): 45 credits @ £15.00/credit = £675/month
- Enterprise (50+): 50 credits @ £13.00/credit = £650/month

**Credit Packs** (One-Off, 20% Premium):
- 10 credits: £21.00/credit = £210.00
- 25 credits: £19.20/credit = £480.00
- 50 credits: £18.00/credit = £900.00 ⭐ Recommended
- 100 credits: £15.60/credit = £1,560.00

**Agreements**:
- Standard: £9.99 (active)
- Notice: £14.99 (inactive - not built yet)
- Renewal: £7.99 (inactive - not built yet)

### **Backend Services** ✅

**1. stripeService.ts** - Stripe API Wrapper
- Customer management (create, update, delete)
- Payment methods (attach, detach, set default)
- Subscriptions (create, update, cancel, reactivate)
- One-off payments (payment intents, auto-charge)
- Checkout sessions
- Refunds
- Webhook verification
- Utility functions (pounds ↔ pence conversion)

**2. creditService.ts** - Credit Management
- Get credit balance
- Add credits (subscription, pack purchase, auto-recharge)
- Deduct credits (reference creation)
- Refund credits
- Auto-recharge trigger logic
- Transaction history
- Credit statistics & reporting

**3. billingService.ts** - Business Logic Orchestration
- Get pricing configuration
- Customer management
- Subscription lifecycle
- Credit pack purchases
- Agreement billing
- Payment method management
- Auto-recharge settings
- Can create reference check

### **API Routes** ✅

**File**: `backend/src/routes/billing.ts`

**Credit & Balance**:
- `GET /api/billing/credits` - Get current balance
- `GET /api/billing/transactions` - Transaction history
- `GET /api/billing/stats` - Usage statistics

**Pricing**:
- `GET /api/billing/pricing/subscriptions` - List subscription tiers
- `GET /api/billing/pricing/packs` - List credit packs

**Subscriptions**:
- `POST /api/billing/subscriptions` - Create subscription
- `GET /api/billing/subscriptions/active` - Get active subscription
- `DELETE /api/billing/subscriptions` - Cancel subscription

**Credit Purchases**:
- `POST /api/billing/credits/purchase` - Buy credit pack

**Payment Methods**:
- `GET /api/billing/payment-methods` - List saved methods
- `POST /api/billing/payment-methods` - Save new method

**Settings**:
- `PUT /api/billing/auto-recharge` - Update auto-recharge settings

### **Webhook Handler** ✅

**File**: `backend/src/routes/webhooks.ts`

Handles Stripe events:
- `customer.subscription.created/updated` - Deliver credits
- `customer.subscription.deleted` - Cancel subscription
- `payment_intent.succeeded` - Fulfill credit purchases
- `payment_intent.payment_failed` - Log failures
- `invoice.paid` - Subscription renewal
- `invoice.payment_failed` - Update to past_due status

### **Dependencies** ✅
- Installed `stripe` package (v13.11.0+)
- Added Stripe env vars to `.env.example`

---

## 🚧 Still To Do

### **Backend Integration** ⏳

**Priority 1: Critical for MVP**

1. **Create checkCredits Middleware** ⚠️
   - File: `backend/src/middleware/checkCredits.ts`
   - Check if company has credits before allowing reference creation
   - Return 402 Payment Required if insufficient credits

2. **Modify Reference Creation** ⚠️
   - File: `backend/src/routes/references.ts`
   - Add credit check before creating reference
   - Deduct 1 credit after successful creation
   - Refund credit if creation fails

3. **Modify Agreement Creation** ⚠️
   - File: `backend/src/routes/agreements.ts`
   - Charge payment before generating PDF
   - Block PDF generation if payment fails
   - Log payment in agreement_payments table

4. **Register Routes in server.ts** ⚠️
   - Import billing and webhook routes
   - Add webhook endpoint with RAW body parser
   - Mount billing routes

5. **Run Database Migrations** ⚠️
   - Execute `046_create_billing_tables.sql`
   - Execute `047_seed_pricing_config.sql`
   - Verify tables created correctly

**Priority 2: Important**

6. **Email Notifications**
   - Low credits warning (< 5 credits)
   - Subscription created/renewed
   - Subscription canceled
   - Credit pack purchase receipt
   - Agreement payment receipt
   - Payment failed alerts
   - Auto-recharge confirmation

7. **Create Stripe Products & Prices**
   - Script to sync pricing_config to Stripe
   - Create products for each subscription tier
   - Create recurring prices
   - Update `stripe_price_id` in database

8. **TypeScript Types**
   - File: `backend/src/types/billing.ts`
   - Define interfaces for all billing entities
   - Export for use across codebase

9. **Error Handling**
   - Graceful failure for Stripe API errors
   - Idempotency keys for critical operations
   - Retry logic for failed webhooks

### **Frontend** ⏳

**Priority 1: MVP**

1. **Install Stripe.js**
   - `npm install @stripe/stripe-js @stripe/react-stripe-js`

2. **Billing Dashboard** (`frontend/src/views/Billing.vue`)
   - Display current credit balance
   - Show active subscription
   - Transaction history table
   - Payment methods section

3. **Subscription Management** (Component or View)
   - Display available tiers
   - Subscription signup flow
   - Cancel subscription
   - Show renewal date

4. **Credit Pack Purchase** (Component)
   - Display available packs
   - Payment flow with Stripe Elements
   - Success/error handling

5. **Credits Display** (Component)
   - Show balance in sidebar
   - Low credits warning badge

6. **Insufficient Credits Modal**
   - Show when trying to create reference without credits
   - Offer subscription or credit pack purchase
   - Link to billing page

7. **Agreement Payment Confirmation**
   - Show before generating PDF
   - Display price
   - Confirm charge to saved payment method

8. **Auto-Recharge Settings**
   - Toggle enable/disable
   - Set threshold
   - Select pack size

**Priority 2: Polish**

9. **Payment Method Management**
   - Add/remove payment methods
   - Set default method
   - Card brand icons

10. **Usage Analytics**
    - Credit usage over time
    - Cost breakdown
    - Monthly spending chart

### **Testing** ⏳

1. **Setup Stripe Test Mode**
   - Create Stripe account
   - Get test API keys
   - Configure webhook endpoint

2. **Test Subscription Flow**
   - Create subscription
   - Verify credits delivered
   - Test renewal (use Stripe CLI to trigger)
   - Test cancellation

3. **Test Credit Pack Purchase**
   - Buy pack
   - Verify credits added
   - Check transaction log

4. **Test Reference Creation**
   - With credits (should succeed)
   - Without credits (should block)
   - Verify credit deduction

5. **Test Agreement Billing**
   - With saved payment method (should charge)
   - Without payment method (should fail)
   - Failed payment handling

6. **Test Auto-Recharge**
   - Enable auto-recharge
   - Let credits drop below threshold
   - Verify automatic charge and credit addition

7. **Test Webhooks**
   - Use Stripe CLI to forward webhooks
   - Verify all event handlers work
   - Check database updates

### **Production Deployment** ⏳

1. **Environment Variables**
   - Set production Stripe keys
   - Configure webhook secret
   - Set frontend URL

2. **Database Migration**
   - Run migrations on production database
   - Verify data integrity

3. **Stripe Configuration**
   - Create production products
   - Set up webhook endpoint
   - Test webhook delivery

4. **Monitoring**
   - Set up error logging (Sentry, etc.)
   - Monitor webhook delivery
   - Track failed payments

5. **Documentation**
   - API documentation
   - Billing flow diagrams
   - Troubleshooting guide

---

## 📝 Implementation Notes

### **Subscription Billing Flow**
1. User selects tier (e.g., "Medium - 30 credits")
2. Backend creates Stripe subscription
3. Frontend collects payment method via Stripe Elements
4. Stripe charges £480 immediately (prepaid)
5. Webhook delivers 30 credits to company balance
6. Credits roll over month-to-month
7. Next month: Stripe auto-charges £480, webhook delivers 30 more credits

### **Credit Pack Purchase Flow**
1. User selects pack (e.g., "50 credits - £900")
2. Backend creates payment intent
3. Frontend shows Stripe payment form
4. User completes payment
5. Webhook fulfills purchase, adds 50 credits
6. No expiry - credits last forever

### **Reference Creation Flow**
1. User clicks "Create Reference"
2. Middleware checks credit balance
3. If balance < 1: Return 402, show "Buy Credits" modal
4. If balance >= 1: Create reference
5. Deduct 1 credit via `creditService.deductCredits()`
6. Check if auto-recharge threshold met
7. If threshold met & enabled: Auto-purchase credits

### **Agreement Generation Flow**
1. User clicks "Generate Agreement"
2. Check if saved payment method exists
3. If no method: Prompt to add payment method
4. Show confirmation: "Charge £9.99 to card ending in 4242?"
5. User confirms
6. Call `billingService.chargeForAgreement()`
7. Stripe charges saved card immediately
8. If success: Generate PDF, log payment
9. If failure: Show error, block PDF generation

### **Auto-Recharge Flow**
1. After credit deduction, check balance
2. If balance <= threshold (e.g., 5):
3. Check if auto-recharge enabled
4. If enabled: Charge customer for configured pack size
5. If payment succeeds: Add credits
6. If payment fails: Send email alert, don't block future operations

---

## 🔒 Security Considerations

1. **Webhook Signature Verification** ✅
   - All webhooks verify Stripe signature
   - Reject invalid signatures

2. **Idempotency** ⚠️ TODO
   - Add idempotency keys to prevent duplicate charges
   - Especially important for auto-recharge

3. **Rate Limiting** ⚠️ TODO
   - Limit billing API endpoints
   - Prevent abuse of payment attempts

4. **PCI Compliance** ✅
   - Never store raw card data
   - Use Stripe Elements/Checkout for card entry
   - Only store Stripe payment method tokens

5. **Data Encryption** ✅
   - Company email/name already encrypted
   - Sensitive billing data in Stripe, not our DB

6. **Row Level Security** ⚠️ TODO
   - Add RLS policies to billing tables
   - Ensure companies can only see their own data

---

## 🎯 Next Steps

**To continue implementation:**

1. **Run migrations** to create database tables
2. **Register routes** in server.ts
3. **Integrate credit checks** into reference creation
4. **Integrate payment** into agreement generation
5. **Test backend** with Postman/Thunder Client
6. **Build frontend** billing UI
7. **End-to-end testing** with Stripe test cards
8. **Deploy** and monitor

---

## 📞 Stripe Support Resources

- **Dashboard**: https://dashboard.stripe.com/
- **API Docs**: https://stripe.com/docs/api
- **Webhooks**: https://stripe.com/docs/webhooks
- **Test Cards**: https://stripe.com/docs/testing
- **Stripe CLI**: https://stripe.com/docs/stripe-cli

---

## ✨ Key Features

- ✅ Credit-based reference system
- ✅ Subscription tiers with volume discounts
- ✅ One-off credit packs (20% premium)
- ✅ Auto-billing for agreements
- ✅ Auto-recharge when credits low
- ✅ Credits roll over forever
- ✅ Comprehensive transaction logging
- ✅ Stripe webhook integration
- ✅ Flexible pricing configuration

---

**Last Updated**: 2025-01-01
**Status**: Backend infrastructure complete, integration pending

# Frontend Billing Implementation - TODO

## ✅ Completed

### Backend (100% Complete)
- ✅ Database migrations (subscriptions, transactions, payments, pricing)
- ✅ Stripe service with full API wrapper
- ✅ Credit service for balance management
- ✅ Billing service for business logic
- ✅ API routes for all billing operations
- ✅ Webhook handler for Stripe events
- ✅ Routes registered in server.ts
- ✅ checkCredits middleware
- ✅ Credit deduction in reference creation
- ✅ Payment integration in agreement generation
- ✅ Stripe API keys configured in .env
- ✅ Backend server running successfully

### Frontend (30% Complete)
- ✅ Stripe.js packages installed (@stripe/stripe-js, @stripe/react-stripe-js)
- ✅ Billing Pinia store created with full state management
- ✅ Billing dashboard view created

## 🚧 Still To Do

### Frontend Components (HIGH PRIORITY)

#### 1. CreditPacksModal.vue
Create modal for purchasing one-off credit packs:
```vue
// Location: frontend/src/components/CreditPacksModal.vue
- Display available credit packs with pricing
- Show recommended pack badge
- Integrate Stripe Payment Element
- Handle payment confirmation
- Show success/error states
```

#### 2. SubscriptionModal.vue
Create modal for subscription signup:
```vue
// Location: frontend/src/components/SubscriptionModal.vue
- Display subscription tiers
- Highlight "Most Popular" tier
- Integrate Stripe Payment Element
- Handle subscription creation
- Show success/error states
```

#### 3. CreditsDisplay.vue
Create component to show credit balance in sidebar:
```vue
// Location: frontend/src/components/CreditsDisplay.vue
- Show current credit count
- Display low credits warning badge
- Link to billing page
- Auto-refresh on credit changes
```

#### 4. InsufficientCreditsModal.vue
Create modal shown when trying to create reference without credits:
```vue
// Location: frontend/src/components/InsufficientCreditsModal.vue
- Show "Insufficient Credits" message
- Display purchase options (packs + subscriptions)
- Quick purchase flow
- Redirect to billing page option
```

#### 5. PaymentMethodCard.vue
Create component for managing payment methods:
```vue
// Location: frontend/src/components/PaymentMethodCard.vue
- Display saved cards
- Add new payment method
- Set default payment method
- Delete payment method
```

### Frontend Integration

#### 1. Add Billing Route
```typescript
// In frontend/src/router/index.ts
{
  path: '/billing',
  name: 'Billing',
  component: () => import('../views/Billing.vue'),
  meta: { requiresAuth: true }
}
```

#### 2. Add Credits Display to Sidebar
```vue
// In frontend/src/components/Sidebar.vue
<CreditsDisplay />
```

#### 3. Integrate Insufficient Credits Modal
```vue
// In frontend/src/views/References.vue
// Show modal when API returns 402 Payment Required
```

#### 4. Add Agreement Payment Confirmation
```vue
// In frontend/src/views/Agreements.vue
// Show payment confirmation before generating PDF
// Handle 402 Payment Required errors
```

### Email Notifications (BACKEND)

#### 1. Low Credits Warning Email
```typescript
// Location: backend/email-templates/low-credits-warning.html
// Location: backend/src/services/emailService.ts
export async function sendLowCreditsWarning(
  companyEmail: string,
  companyName: string,
  creditsRemaining: number,
  dashboardLink: string
): Promise<void>
```
Trigger: When credits drop below 5 (in creditService.ts after deduction)

#### 2. Credit Pack Purchase Receipt
```typescript
// Template: backend/email-templates/credits-purchased-receipt.html
export async function sendCreditPurchaseReceipt(
  companyEmail: string,
  companyName: string,
  credits: number,
  amountPaid: number,
  transactionId: string
): Promise<void>
```
Trigger: In webhooks.ts after payment_intent.succeeded for credit packs

#### 3. Subscription Created Email
```typescript
// Template: backend/email-templates/subscription-created.html
export async function sendSubscriptionCreated(
  companyEmail: string,
  companyName: string,
  tier: string,
  creditsPerMonth: number,
  monthlyTotal: number,
  nextBillingDate: string
): Promise<void>
```
Trigger: In webhooks.ts after customer.subscription.created

#### 4. Subscription Canceled Email
```typescript
// Template: backend/email-templates/subscription-canceled.html
export async function sendSubscriptionCanceled(
  companyEmail: string,
  companyName: string,
  tier: string,
  endDate: string
): Promise<void>
```
Trigger: In webhooks.ts after customer.subscription.deleted

#### 5. Agreement Payment Receipt
```typescript
// Template: backend/email-templates/agreement-payment-receipt.html
export async function sendAgreementPaymentReceipt(
  companyEmail: string,
  companyName: string,
  agreementType: string,
  amountPaid: number,
  agreementId: string
): Promise<void>
```
Trigger: In billingService.ts after successful chargeForAgreement

#### 6. Payment Failed Email
```typescript
// Template: backend/email-templates/payment-failed.html
export async function sendPaymentFailed(
  companyEmail: string,
  companyName: string,
  reason: string,
  retryDate?: string
): Promise<void>
```
Trigger: In webhooks.ts after payment_intent.payment_failed

### Auto-Recharge Feature

Already implemented in backend! Just needs:
1. Frontend UI in Billing.vue to toggle auto-recharge
2. Set threshold (default: 5 credits)
3. Set pack size (default: 25 credits)

```vue
// In frontend/src/views/Billing.vue
<div class="auto-recharge-settings">
  <h3>Auto-Recharge Settings</h3>
  <label>
    <input type="checkbox" v-model="autoRecharge.enabled" />
    Enable auto-recharge
  </label>
  <label>
    Trigger when credits drop below:
    <input type="number" v-model="autoRecharge.threshold" />
  </label>
  <label>
    Auto-purchase pack size:
    <select v-model="autoRecharge.packSize">
      <option :value="10">10 credits</option>
      <option :value="25">25 credits</option>
      <option :value="50">50 credits</option>
      <option :value="100">100 credits</option>
    </select>
  </label>
  <button @click="saveAutoRecharge">Save Settings</button>
</div>
```

### Stripe Configuration

#### 1. Create Products in Stripe Dashboard
For each subscription tier:
- Small (Under 20): £350/month
- Medium (20-39): £480/month
- Large (40-49): £675/month
- Enterprise (50+): £650/month

#### 2. Update Database with Stripe Price IDs
```sql
UPDATE pricing_config
SET stripe_price_id = 'price_xxx'
WHERE product_key = 'subscription_small';
```

#### 3. Configure Webhook Endpoint
- URL: `https://your-backend.com/api/webhooks/stripe`
- Events to listen for:
  - customer.subscription.created
  - customer.subscription.updated
  - customer.subscription.deleted
  - payment_intent.succeeded
  - payment_intent.payment_failed
  - invoice.paid
  - invoice.payment_failed

### Testing Checklist

- [ ] Test credit pack purchase flow
- [ ] Test subscription signup flow
- [ ] Test reference creation with credits
- [ ] Test reference creation without credits (402 error)
- [ ] Test agreement generation with payment
- [ ] Test agreement generation payment failure
- [ ] Test low credits warning display
- [ ] Test auto-recharge trigger
- [ ] Test subscription cancellation
- [ ] Test webhook delivery for all events
- [ ] Test email notifications

### Environment Variables

Make sure these are set in production:
```bash
# Backend (.env)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Frontend (.env)
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

---

## Quick Start Guide

### To continue frontend development:

1. **Create the modal components**:
   ```bash
   touch frontend/src/components/CreditPacksModal.vue
   touch frontend/src/components/SubscriptionModal.vue
   touch frontend/src/components/CreditsDisplay.vue
   touch frontend/src/components/InsufficientCreditsModal.vue
   ```

2. **Add billing route to router**

3. **Add CreditsDisplay to Sidebar**

4. **Create email templates** (6 templates needed)

5. **Add email triggers** in backend webhook handler

6. **Test with Stripe test cards**:
   - Success: 4242 4242 4242 4242
   - Decline: 4000 0000 0000 0002

---

## Architecture Summary

### Data Flow

**Credit Purchase:**
User → Frontend Modal → API → Stripe Payment Intent → Webhook → Add Credits → Email Receipt

**Reference Creation:**
User → checkCredits Middleware → Create Reference → Deduct Credit → Check Auto-Recharge

**Agreement Generation:**
User → Charge Payment → Generate PDF (if payment succeeds) → Email Receipt

**Subscription:**
User → Frontend Modal → API → Stripe Subscription → Webhook → Deliver Credits → Email Confirmation

---

## Current Status

**Backend**: 100% Complete ✅
**Frontend**: 30% Complete 🚧
**Emails**: 0% Complete ⏳
**Testing**: Not started ⏳

**Next Priority**: Create the 4 frontend modal components, then add email notifications.

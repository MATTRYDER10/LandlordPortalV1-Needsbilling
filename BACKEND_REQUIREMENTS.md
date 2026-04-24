# Backend Requirements for Landlord Portal

All endpoints are called from the landlord frontend at `landlord.propertygoose.co.uk` against the **shared PropertyGoose backend**.

---

## P0 — Required before launch

### 1. CORS Whitelist
**File:** `backend/src/server.ts`
**Action:** Add `https://landlord.propertygoose.co.uk` to CORS allowed origins.

---

### 2. Reference Credit System (NEW)

The landlord portal uses a **reference credit** model. Landlords either pre-buy credits in bulk (at a discount) or pay per-reference at checkout.

#### 2a. Get credit balance
**Endpoint:** `GET /api/billing/reference-credits`
**Called from:** `frontend/src/stores/auth.ts` → `fetchReferenceCredits()`
**Response:**
```json
{ "credits": 5 }
```

#### 2b. Purchase credits (bulk packs)
**Endpoint:** `POST /api/billing/reference-credits/purchase`
**Called from:** `frontend/src/views/Settings.vue` → Billing tab
**Request:**
```json
{
  "quantity": 10,
  "price_per_ref": 9.10
}
```
**What it does:**
1. Creates a Stripe PaymentIntent for `quantity × price_per_ref` (convert to pence)
2. On payment success (webhook or confirmation), credits the user's `reference_credits` balance
3. Records a transaction

**Bulk discount schedule (frontend calculates, backend should validate):**
- 1 ref = 0% off (no bulk)
- 2 refs = 5% off each
- 3 refs = 10% off
- 5 refs = 20% off
- 7 refs = 30% off
- 8+ refs = 35% off (cap)

**Base prices:**
- Launch (until 30 Apr 2026): £14.00/ref
- Standard: £17.50/ref
- Subscriber (has tenancies subscription): £13.00/ref

#### 2c. Use credits
**Endpoint:** `POST /api/billing/reference-credits/use`
**Called from:** `frontend/src/components/references/ReferencePaywallModal.vue`
**Request:**
```json
{ "quantity": 2 }
```
**What it does:** Deducts N credits from the user's balance. Returns 400 if insufficient credits.
**Response:**
```json
{ "credits_remaining": 3 }
```

#### 2d. Pay per reference (no credits)
**Endpoint:** `POST /api/billing/reference-payment`
**Called from:** `frontend/src/components/references/ReferencePaywallModal.vue`
**Request:**
```json
{
  "num_references": 2,
  "price_per_reference": 14.00
}
```
**What it does:** Creates a Stripe PaymentIntent for `num_references × price_per_reference` (in pence).
**Response:**
```json
{ "client_secret": "pi_xxx_secret_xxx" }
```
After Stripe confirms payment on the frontend, the user proceeds to create references via `POST /api/v2/references`.

**The backend should verify** that the user has either paid or has credits before allowing `POST /api/v2/references` for landlord accounts.

---

### 3. Tenancies Subscription (NEW product on existing endpoint)

**Endpoint:** `POST /api/billing/subscriptions` (existing)
**Called from:** `frontend/src/components/tenancies/TenanciesPaywall.vue`
**Request:**
```json
{ "tier_product_key": "landlord_full_management" }
```

**Stripe setup required:**
1. Create Stripe Product: **"Landlord Full Self-Management"**
2. Create Stripe Prices:
   - `£11.99/month` (launch price — active until 1 May 2026)
   - `£14.99/month` (standard price — from 1 May 2026)
3. Insert into `subscription_tiers` or pricing table with `product_key = 'landlord_full_management'`

**Check endpoint:** `GET /api/billing/subscriptions/active` (existing) — the frontend calls this to determine if the Tenancies tab is unlocked. Must return `{ status: 'active' }` for subscribed landlords.

---

## P1 — Required for full functionality

### 4. Agreement Payment (existing endpoint, config change)

**Endpoint:** `POST /api/agreements/:id/generate` (existing)
**Called from:** `frontend/src/views/Agreements.vue` line ~3330
**Current:** Returns 402 with `{ requires_payment_method: true, client_secret, amount }` when payment needed.
**Change for landlord accounts:** Always require payment at **£2.49** per agreement.

The frontend `AgreementPaymentModal` (`frontend/src/components/AgreementPaymentModal.vue`) already handles the Stripe Elements flow using the `client_secret`.

---

### 5. User/Account Type Distinction (NEW)

**Purpose:** Distinguish landlord accounts from agent accounts to apply correct billing rules.
**Suggested:** Add `account_type` column to `companies` table: `'agent'` (default) | `'landlord'`

**Impact:**
- `POST /api/v2/references` → check credits/payment for `landlord` accounts
- `POST /api/agreements/:id/generate` → charge £2.49 for `landlord` accounts
- Login validation: landlord portal rejects agent accounts and vice versa
- Registration from `landlord.propertygoose.co.uk` should set `account_type = 'landlord'`

**Frontend sends:** Could pass `account_type` in Supabase signup metadata, or detect by origin URL.

---

## P2 — Future / nice-to-have

### 6. Onboarding Steps
**Endpoints:** `PUT /api/onboarding/step` + `GET /api/onboarding/status`
**Note:** Landlord onboarding has 7 steps (0-6) vs agent's 5 (0-5). Backend just stores an integer — should work unless there's validation capping at 5.

### 7. Authenticated AML Verification
**Current:** `POST /api/landlords/:id/submit-verification` requires magic-link token.
**Needed:** `POST /api/profile/submit-aml-verification` — same logic but uses auth header for the logged-in landlord to submit their own AML during onboarding.

### 8. Landlord Companies CRUD
**Endpoint:** `POST/GET/PUT/DELETE /api/landlord-companies`
**Purpose:** Landlords can create SPV/Ltd company entities used as the landlord party in agreements.
**Fields:** company_name, registration_number, address, bank_details (account_name, sort_code, account_number)

---

## Database Schema Changes

```sql
-- Add account type to companies
ALTER TABLE companies ADD COLUMN account_type TEXT DEFAULT 'agent' CHECK (account_type IN ('agent', 'landlord'));

-- Reference credits table
CREATE TABLE reference_credits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit transactions log
CREATE TABLE reference_credit_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  type TEXT NOT NULL CHECK (type IN ('purchase', 'use', 'refund')),
  quantity INTEGER NOT NULL,
  price_per_ref NUMERIC(10,2),
  total_amount NUMERIC(10,2),
  stripe_payment_intent_id TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Landlord companies (SPVs/Ltd for agreements)
CREATE TABLE landlord_companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  registration_number TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  postcode TEXT,
  bank_account_name TEXT,
  bank_sort_code TEXT,
  bank_account_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Frontend ↔ Backend Mapping

| Frontend file | Endpoint called | Status |
|---|---|---|
| `stores/auth.ts` → `fetchReferenceCredits()` | `GET /api/billing/reference-credits` | **NEW** |
| `stores/auth.ts` → `fetchSubscriptionStatus()` | `GET /api/billing/subscriptions/active` | Existing |
| `components/references/ReferencePaywallModal.vue` | `POST /api/billing/reference-payment` | **NEW** |
| `components/references/ReferencePaywallModal.vue` | `POST /api/billing/reference-credits/use` | **NEW** |
| `views/Settings.vue` → Billing tab | `POST /api/billing/reference-credits/purchase` | **NEW** |
| `components/tenancies/TenanciesPaywall.vue` | `POST /api/billing/subscriptions` | Existing, new product |
| `views/Agreements.vue` | `POST /api/agreements/:id/generate` | Existing, config change |

# PropertyGoose Landlord Portal V1

**Status: Frontend complete, needs backend billing endpoints**

Landlord self-management portal at `landlord.propertygoose.co.uk`. Lets private landlords ditch the 10% agent fee and self-manage their properties — referencing, agreements, tenancies, deposits, compliance — all from one app.

## Architecture

This is a **frontend-only** repo. It shares the same Express backend and Supabase database as the main agent app (`app.propertygoose.co.uk`). Deployed as a separate Railway frontend service alongside the existing stack.

```
Railway Project
├── Backend (shared, existing)
├── Frontend — app.propertygoose.co.uk (agent app, existing)
├── Landlord Frontend — landlord.propertygoose.co.uk (THIS REPO)
├── InventoryGoose, Marketing Site, SANLIST, R2R DB...
```

## What's Built

### Navigation
Dashboard → Offers (free) → Referencing (paywall) → Tenancies (subscription) → Properties → Landlords → Agreements (paywall) → Settings → Help Centre

### Pricing Model
| Tier | Price | What it unlocks |
|------|-------|----------------|
| **Pay-as-you-go** | £14/ref (launch), £17.50 standard | Referencing only |
| **Full Self-Management** | £11.99/mo (launch), £14.99/mo | Tenancies tab, agreements, £13/ref discount |
| **Agreement generation** | £2.49 each | Per-agreement charge |
| **Bulk reference credits** | 5% off per ref, max 35% | Pre-buy and save |

### Paywall Locations
- **Referencing** — "New Reference" button and offer-to-reference conversion both show paywall. If landlord has pre-purchased credits, they can use those instead of paying. If not, Stripe Elements payment form.
- **Tenancies** — Entire tab locked behind subscription. Shows feature list + pricing + subscribe button.
- **Agreements** — Payment required before PDF generation/send & sign (existing `AgreementPaymentModal` flow, needs backend to return 402 with £2.49).
- **Create Tenancy** — All "Create Tenancy" buttons gated behind subscription check.

### What's Different from Agent App
- No `/backend` directory (shared backend)
- No staff portal, admin panel, or branch selection
- No V1 references — only V2 "Referencing"
- No RentGoose, InventoryGoose tab
- Landlord IS the client (replaces agent role)
- Sidebar says "Landlord Portal" with PG branding only
- Register page says "Create your landlord account"
- Dashboard greeting uses user name not company name
- Management type filters/toggles removed everywhere
- Leaderboard, negotiators, deal owner, "Send to Landlord" removed from offers
- Settings stripped to: Profile, Billing, Audit Logs, TDS, Reposit, MyDeposits, JMI

### Billing Tab (Settings → Billing)
- Shows current reference credit balance
- Bulk purchase packs (3, 5, 10, 15, 20 refs) with auto-calculated discounts
- Custom quantity input with live pricing
- Subscription status and upgrade link
- Pay-as-you-go pricing info

### Reference Credit System
Landlords can pre-buy reference credits in bulk at a discount:
- 1 ref = 0% off (single purchase)
- 2 refs = 5% off each
- 3 refs = 10% off
- 5 refs = 20% off
- 7 refs = 30% off
- 8+ refs = 35% off (cap)

Credits sit on their account until used. When creating references, the paywall checks credits first — if they have enough, one click to use them. If not, Stripe payment.

---

## What Needs Doing — Backend

**See [`BACKEND_REQUIREMENTS.md`](./BACKEND_REQUIREMENTS.md) for full technical specs** including endpoint contracts, request/response formats, SQL schema, and Stripe product setup.

### Summary of new endpoints needed

| Priority | Endpoint | Purpose |
|----------|----------|---------|
| P0 | CORS config | Add `landlord.propertygoose.co.uk` to allowed origins |
| P0 | `GET /api/billing/reference-credits` | Return landlord's credit balance |
| P0 | `POST /api/billing/reference-credits/purchase` | Buy bulk credits via Stripe PaymentIntent |
| P0 | `POST /api/billing/reference-credits/use` | Deduct N credits from balance |
| P0 | `POST /api/billing/reference-payment` | Stripe PaymentIntent for pay-per-reference |
| P0 | `POST /api/billing/subscriptions` | New Stripe product `landlord_full_management` |
| P1 | `POST /api/agreements/:id/generate` | Return 402 with £2.49 for landlord accounts |
| P1 | `companies.account_type` column | Distinguish `'agent'` vs `'landlord'` accounts |
| P2 | `POST /api/profile/submit-aml-verification` | Authenticated AML for onboarding |
| P2 | `CRUD /api/landlord-companies` | SPV/Ltd entities for agreements |

### Stripe Products to Create
1. **Landlord Full Self-Management** — £11.99/month (launch), £14.99/month (standard)
2. Reference payments use dynamic PaymentIntents (not products)
3. Agreement payments use dynamic PaymentIntents at £2.49

---

## Running Locally

```bash
# Terminal 1 — Start the shared backend from the main PropertyGooseApp repo
cd ~/PropertyGooseApp/backend && npm run dev

# Terminal 2 — Start the landlord frontend
cd ~/LandlordPortalV1-Needsbilling/frontend && npm run dev
```

Frontend runs on `http://localhost:5173`. API calls proxy to `localhost:3001` via Vite dev server.

### Environment Variables
Copy from main app — same Supabase, same Stripe:
```
VITE_API_URL="http://localhost:3001"
VITE_SUPABASE_URL="https://xxx.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJ..."
VITE_STRIPE_PUBLISHABLE_KEY="pk_live_..."
VITE_GOOGLE_MAPS_API_KEY="AIza..."
```

---

## Still To Build (Frontend)
- Typeform-style onboarding with built-in AML (7 steps)
- First-login guided tour
- Help centre content filtering (remove agent-specific guides)
- "My Companies" settings tab (SPV/Ltd entities)
- Enhanced deposit integration explanations + `landlords@propertygoose.co.uk` contact
- Agreement builder auto-populate from landlord profile

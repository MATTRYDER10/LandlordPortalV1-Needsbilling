# Apex27 Offers Integration Plan

## Context

Agents using Apex27 CRM send automated feedback emails to tenants after viewings. These emails can include a link to make an offer. We need a universal offer form that tenants can fill out without logging into PropertyGoose. The offer flows into the V2 Offers pending queue, matched to a property where possible, and the agent can accept/reject from there.

Two phases: Phase 1 (this plan) is the universal offer link. Phase 2 (future) is pulling offers directly from Apex27 via their API.

---

## Phase 1: Universal Offer Link

### How it works

1. **Each agency gets a unique offer URL** — e.g. `https://app.propertygoose.co.uk/make-offer/{company_token}`
2. The agent pastes this link into their Apex27 CRM viewing-feedback email template
3. After a viewing, Apex27 auto-sends the feedback email with the link
4. Tenant clicks the link → lands on a **public offer form** (no login required)
5. Tenant fills in:
   - Their name, email, phone
   - The rental property address (they'll have it from the viewing email)
   - Proposed rent amount
   - Proposed move-in date
   - Proposed tenancy length
   - Any special conditions
   - Number of tenants (and their names if > 1)
6. On submit:
   - PG creates a V2 `tenant_offer` with `status: 'pending'`
   - PG tries to **match the entered address** against the company's properties
   - Match logic: normalise address → search `properties` by postcode → fuzzy match on address line 1
   - If matched → `linked_property_id` is set, offer is ready for agent to accept/reject
   - If no match → `linked_property_id` is NULL, offer is flagged as **"Unmatched — assign property"**
7. Agent sees the offer in V2 Offers tab:
   - **Matched offers**: accept / reject / counter available immediately
   - **Unmatched offers**: accept/reject DISABLED. Agent sees a yellow banner: "No property match found. Please assign a property before accepting."
   - Agent clicks a **searchable property dropdown** → selects the correct property → offer becomes actionable
8. Once matched + accepted → normal V2 flow: holding deposit → references → tenancy

### Company Token

- New column on `companies`: `offer_link_token` (UUID, unique)
- Generated once when the company first enables the feature (or via Settings)
- The public URL is: `https://app.propertygoose.co.uk/make-offer/{offer_link_token}`
- Token → company lookup: `SELECT id FROM companies WHERE offer_link_token = ?`
- **No auth required** on the public form — the token identifies the company

### Property Matching Logic

When the tenant submits their address:

```
1. Normalise the entered postcode (strip spaces, uppercase)
2. Query: SELECT id, address_line1_encrypted, postcode
          FROM properties
          WHERE company_id = ? AND postcode = ? AND deleted_at IS NULL
3. Decrypt address_line1 for each result
4. Fuzzy match:
   a. Exact match (normalised address line 1)
   b. Partial match (one contains the other)
   c. House number match (extract leading digits, compare)
   d. If exactly 1 property at that postcode → auto-match
5. If match found → set linked_property_id
6. If no match → leave NULL, flag for agent
```

### Unmatched Offer UI

In the V2 Offers detail modal (`TenantOffersV2.vue`):

- If `linked_property_id` is NULL:
  - Show yellow banner: "⚠️ No property match — please assign before accepting"
  - Show searchable property dropdown (typeahead, searches by address/postcode)
  - Accept/Reject buttons disabled until property assigned
  - On property selection → `PUT /api/tenant-offers/:id` with `linked_property_id`
- If `linked_property_id` is set:
  - Normal accept/reject flow (as today)

### Files to Create/Modify

**Backend:**
- `backend/src/routes/public-offers.ts` — **New.** Public routes (no auth):
  - `GET /api/public/offer-form/:token` — validates token, returns company name + branding
  - `POST /api/public/offer-form/:token` — receives offer submission, creates tenant_offer, attempts property match
- `backend/src/routes/tenancies.ts` or `tenant-offers.ts` — Add property assignment endpoint if not already covered by PUT
- Migration: `ADD COLUMN IF NOT EXISTS offer_link_token UUID DEFAULT gen_random_uuid()` to `companies`

**Frontend:**
- `frontend/src/views/public/MakeOffer.vue` — **New.** Public offer form page
- `frontend/src/router/index.ts` — Add route `/make-offer/:token` (public, no auth)
- `frontend/src/views/TenantOffersV2.vue` — Add unmatched property warning + searchable dropdown

### API Endpoints

| Method | URL | Auth | Purpose |
|---|---|---|---|
| `GET /api/public/offer-form/:token` | None | Validate token, return company info |
| `POST /api/public/offer-form/:token` | None | Submit offer |
| `GET /api/settings/offer-link` | Agent | Get/generate the company's offer link |
| `POST /api/settings/offer-link/regenerate` | Agent | Regenerate token |

### Offer Form Fields

| Field | Required | Notes |
|---|---|---|
| `tenant_first_name` | Yes | |
| `tenant_last_name` | Yes | |
| `tenant_email` | Yes | |
| `tenant_phone` | Yes | |
| `property_address` | Yes | Free text — used for matching |
| `property_postcode` | Yes | Used for property lookup |
| `offered_rent_amount` | Yes | Monthly rent in £ |
| `proposed_move_in_date` | Yes | Date picker |
| `proposed_tenancy_length_months` | No | Default 12 |
| `special_conditions` | No | Free text |
| `number_of_tenants` | No | Default 1 |
| `additional_tenant_names` | No | If > 1 tenant |

---

## Phase 2: Apex27 Offer Sync (Future)

### Apex27 Offers API

Confirmed available on production:

```
GET /offers — all offers (filterable by transactionType, minDtsUpdated, paginated)
GET /listings/{listingId}/offers — offers for a specific listing
POST /listings/{listingId}/offers — create offer
PUT /listings/{listingId}/offers/{offerId} — update offer
DELETE /listings/{listingId}/offers/{offerId} — delete offer
GET /listings?includeOffers=1 — listings with offers nested
```

**Offer object:**
```json
{
  "id": 123,
  "listingId": 456,
  "contactId": 789,
  "currency": "GBP",
  "amount": 1200,
  "counterAmount": null,
  "status": "new",      // new | considering | accepted | rejected | withdrawn
  "notes": "...",
  "dtsOffer": "2026-04-12 09:00:00",
  "dtsCounterOffer": null,
  "dtsAccepted": null
}
```

**Webhook events:**
- `listing_offer.create`
- `listing_offer.update`
- `listing_offer.delete`

### Phase 2 Approach

1. **Register webhook** for `listing_offer.create` → PG endpoint
2. When offer created in Apex27:
   - Receive webhook with offer data (listingId, contactId, amount, status)
   - Look up PG property by `apex27_listing_id` matching `listingId`
   - Fetch contact details from `GET /contacts/{contactId}` (name, email, phone)
   - Create V2 `tenant_offer` in PG with all details pre-filled
   - Property already matched (via listing ID) → offer is immediately actionable
3. **Bidirectional sync** (optional):
   - When agent accepts in PG → `PUT /listings/{listingId}/offers/{offerId}` with `status: "accepted"` in Apex27
   - When agent rejects in PG → same with `status: "rejected"`
4. **Periodic poll** as backup:
   - `GET /offers?transactionType=rent&minDtsUpdated={lastSync}` every 15 mins
   - Sync any new offers not received via webhook

### Why Phase 2 is separate

- Requires Apex27 webhook registration (agent needs to do this in their Apex27 settings, or we automate via `POST /webhooks`)
- The `contactId` on the offer requires an additional API call to resolve tenant details
- Property matching is simpler (listing ID → property) but only works for Apex27-synced properties
- Phase 1 (universal link) works for ALL companies, not just Apex27 users

---

## Migration

```sql
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS offer_link_token UUID DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_offer_link_token
  ON companies(offer_link_token)
  WHERE offer_link_token IS NOT NULL;
```

---

## Priority

- **Phase 1** (Universal link): Build next — solves the immediate problem for all agents
- **Phase 2** (Apex27 sync): Build after Phase 1 is live — adds automation for Apex27 users

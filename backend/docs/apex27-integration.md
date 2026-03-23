# Apex27 CRM API Reference (Condensed)

## Base URL
`https://api.apex27.co.uk`

## Authentication
Header: `X-Api-Key: YOUR_API_KEY`

## Rate Limiting
100 requests/minute per API key.

## Pagination
- Query params: `page` (default 1), `pageSize` (25–250, default 25)
- Response header: `X-Page-Count` — total number of pages

## Response Format
Responses may be a bare array `[...]` OR an object `{ data: [...] }`. Always handle both.

---

## Key Endpoints

### Branches
- `GET /branches` — list all branches (good for connection test)

### Contacts
- `GET /contacts` — list contacts, paginated
- `GET /contacts/{id}` — single contact
- `POST /contacts` — create contact
- `PUT /contacts/{id}` — update contact

Contact fields include: `id`, `firstName`, `lastName`, `email`, `mobile`, `phone`, `isLandlord`, `isVendor`, `isTenant`, `isBuyer`, `address`, `postcode`, `notes`.

### Listings (Properties)
- `GET /listings` — list listings, paginated
  - Filters: `transactionType` (sale/rent), `branchId`, `archived`, `minBeds`, `maxBeds`, `minPrice`, `maxPrice`, `status`, `includeContacts` (0/1)
- `GET /listings/{id}` — single listing
- `POST /listings` — create listing
- `PUT /listings/{id}` — update listing

Listing status values: `pending`, `available`, `sold_subject_to_contract`, `under_offer`, `reserved`, `let_agreed`, `let`, `sold`

Transaction types: `sale`, `rent`, `land`, `commercial_sale`, `commercial_rent`

Listing fields include: `id`, `branchId`, `transactionType`, `status`, `address`, `address2`, `town`, `county`, `postcode`, `country`, `bedrooms`, `bathrooms`, `price`, `propertyType`, `contacts` (when includeContacts=1).

### Documents
- `POST /documents` — upload/link a document
  - Body: `{ name, url, contactId?, listingId? }`

### Tenancies
- `GET /tenancies` — list tenancies
  - Filters: `activeOnly`, `listingId`, `branchId`, `tenantId`
- `GET /tenancies/{id}` — single tenancy
- `PATCH /tenancies/{id}` — update deposit fields only

### Issues (Maintenance)
- `GET /listings/{listingId}/issues` — list issues for a listing
- `POST /listings/{listingId}/issues` — create issue
- `GET /listings/{listingId}/issues/{issueId}` — get issue
- `PUT /listings/{listingId}/issues/{issueId}` — update issue

Issue types: Appliance, Cleaning, Damage, Electrical, Fire, Heating, Painting, Pest, Plumbing, Structural, etc.
Issue status: New, Awaiting Contractor, In Progress, Completed, Closed, etc.
Issue priority: Low, Medium, High

### Webhooks
- `GET /webhooks` — list webhooks
- `POST /webhooks` — create webhook
- Events: branch.*, contact.*, lead.*, listing.*, offer.*, valuation.*, viewing.*, completion.*, user.*, tenancy.*, issue.*

### Users
- `GET /users` — list users
- `GET /users/{id}` — single user

### Leads
- `GET /leads` — list leads
- `POST /leads` — create lead

---

## Property Types
apartment, house, flat, bungalow, cottage, villa, commercial, detached, semi-detached, terraced, end-terrace, maisonette, studio, penthouse, barn-conversion, etc. (40+)

## Deposit Schemes
Deposit Protection Service, My Deposits, Tenancy Deposit Scheme, etc. (19 options)

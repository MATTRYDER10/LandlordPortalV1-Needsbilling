# PropertyGoose ↔ InventoryGoose API

This document describes the **outbound** API that PropertyGoose exposes for
InventoryGoose to consume. IG uses these endpoints to verify the connection
and pull a company's property + landlord data so it can keep its own
directory in sync with PG.

> All endpoints are authenticated by a per-company API key. The agent
> generates the key in PG (`Settings → Integrations → InventoryGoose`) and
> pastes it into IG. PG stores it encrypted **and** hashed (SHA-256) so the
> auth lookup is a single indexed query, not a decrypt+compare loop.

## Base URL

| Environment | URL |
|---|---|
| **Production** | `https://backend-production-508bf.up.railway.app` |

## Authentication

All endpoints require the `x-pg-api-key` header containing the plaintext
API key as the agent pasted it into IG.

```http
x-pg-api-key: <plaintext_api_key>
```

The header name is **case-insensitive** (`x-pg-api-key`, `X-PG-Api-Key`,
`X-PG-API-KEY` all work — Express normalises headers).

### Failed-auth lockout

PG rate-limits **failed authentication attempts only** — successful
requests are not throttled.

- **10 failed attempts per IP per 5-minute rolling window**
- After the 10th failure, all requests from that IP get `429 Too many
  failed authentication attempts. Try again later.` for the rest of the
  window
- **A single successful auth wipes the IP's failure counter.** So if an
  agent typos their key once and then fixes it, they're not locked out.

Practical implication for IG: don't retry a 401 in a tight loop. Surface
the error to the user and let them fix the key.

## Endpoints

### `GET /api/integrations/ig/test-connection`

**Purpose:** Verify the API key is valid and the PG side is reachable.
Use this for the "Test Connection" button in IG settings.

Cheap — only touches `company_integrations` and `companies`. No joins, no
encryption decode beyond the company name.

#### Request

```http
GET /api/integrations/ig/test-connection HTTP/1.1
Host: backend-production-508bf.up.railway.app
x-pg-api-key: <plaintext_api_key>
```

#### Success — `200 OK`

```json
{
  "ok": true,
  "company_id": "0a38b602-64bd-4c45-94fb-241d03af2752",
  "company_name": "Pearl Lettings (Norwich) Ltd.",
  "verified_at": "2026-04-11T09:42:13.519Z"
}
```

| Field | Type | Notes |
|---|---|---|
| `ok` | `boolean` | Always `true` on success |
| `company_id` | `string` (uuid) | PG's internal company id |
| `company_name` | `string` | Decrypted company name (may be `""`) |
| `verified_at` | `string` (ISO8601) | Server timestamp at the moment of verification |

#### Failure responses

| Status | Body | Cause |
|---|---|---|
| `401` | `{ "ok": false, "error": "Missing x-pg-api-key header" }` | Header absent or empty |
| `401` | `{ "ok": false, "error": "Invalid API key" }` | Header present but no matching company |
| `429` | `{ "error": "Too many failed authentication attempts. Try again later." }` | IP locked out (>10 failures in 5 mins) |
| `500` | `{ "error": "Internal server error" }` | Unexpected — please report |

#### curl

```bash
curl -i \
  -H "x-pg-api-key: YOUR_PG_API_KEY" \
  https://backend-production-508bf.up.railway.app/api/integrations/ig/test-connection
```

---

### `GET /api/integrations/ig/properties`

**Purpose:** Pull every property for the authenticated company, with all
linked landlords nested per property. Use for the initial sync and any
subsequent re-syncs from IG side.

Returns soft-deleted properties already filtered out (`deleted_at IS NULL`).

#### Request

```http
GET /api/integrations/ig/properties HTTP/1.1
Host: backend-production-508bf.up.railway.app
x-pg-api-key: <plaintext_api_key>
```

#### Success — `200 OK`

```json
{
  "properties": [
    {
      "pg_property_id": "97d1f8dc-0cce-4580-8939-f20f030e729f",
      "address_line_1": "71 Beverley Road",
      "address_line_2": "",
      "city": "Norwich",
      "postcode": "NR58AP",
      "property_type": "house",
      "bedrooms": 4,
      "updated_at": "2026-04-08T08:54:06.281638+00:00",
      "landlords": [
        {
          "pg_landlord_id": "9f3a4d2e-...-...",
          "first_name": "John",
          "last_name": "Smith",
          "name": "John Smith",
          "email": "john@example.com",
          "phone": "+447700900001",
          "address": {
            "line1": "12 High Street",
            "line2": "",
            "city": "Norwich",
            "postcode": "NR2 1AB"
          },
          "ownership_percentage": 100,
          "is_primary_contact": true
        }
      ]
    }
  ]
}
```

#### Field reference — top level

| Field | Type | Notes |
|---|---|---|
| `properties` | `Property[]` | **Always present**, may be `[]` |

#### Field reference — `Property`

| Field | Type | Always present? | Notes |
|---|---|---|---|
| `pg_property_id` | `string` (uuid) | ✅ | Stable PG primary key |
| `address_line_1` | `string` | ✅ (may be `""`) | **snake_case with underscore** |
| `address_line_2` | `string` | ✅ (may be `""`) | **snake_case with underscore** |
| `city` | `string` | ✅ (may be `""`) | |
| `postcode` | `string` | ✅ (may be `""`) | **No space normalization** — stored as the agent typed it. May be `"NR58AP"` or `"NR5 8AP"` |
| `property_type` | `string` | ✅ | One of `flat`, `house`, `studio`, etc. Defaults to `"flat"` if null |
| `bedrooms` | `number` | ✅ | Defaults to `0` if null |
| `updated_at` | `string` (ISO8601 with timezone) | ✅ | Postgres `timestamptz` format, e.g. `"2026-04-08T08:54:06.281638+00:00"`. Note the microsecond precision |
| `landlords` | `Landlord[]` | ✅ | **Always an array, never `null` or missing.** May be `[]` |

#### Field reference — `Landlord`

| Field | Type | Always present? | Notes |
|---|---|---|---|
| `pg_landlord_id` | `string` (uuid) | ✅ | Stable PG primary key |
| `first_name` | `string` | ✅ (may be `""`) | Decrypted |
| `last_name` | `string` | ✅ (may be `""`) | Decrypted |
| `name` | `string` | ✅ (may be `""`) | Convenience field — `first_name + " " + last_name` then `.trim()` |
| `email` | `string` | ✅ (may be `""`) | Decrypted |
| `phone` | `string` | ✅ (may be `""`) | Decrypted |
| `address` | `object` | ✅ | **Always present** even if every sub-field is `""` |
| `address.line1` | `string` | ✅ (may be `""`) | ⚠️ **`camelCase`, no underscore** — different from property level |
| `address.line2` | `string` | ✅ (may be `""`) | ⚠️ **`camelCase`** |
| `address.city` | `string` | ✅ (may be `""`) | |
| `address.postcode` | `string` | ✅ (may be `""`) | |
| `ownership_percentage` | `number` | ✅ | 0–100. Defaults to `100` if not set |
| `is_primary_contact` | `boolean` | ✅ | `true` for the lead landlord on a multi-landlord property |

#### ⚠️ Validation gotchas

1. **Property fields are `snake_case`, landlord nested address is
   `camelCase`.** Inconsistent — that's how the existing PG client
   contract is defined. If your validator assumes a uniform casing it
   will silently drop landlord addresses.

2. **Empty strings, never `null`.** A missing email is `""`, not `null`
   and not undefined. If your validator does `if (landlord.email)` it
   will treat `""` as falsy and skip the landlord.

3. **`landlords` is always present as an array.** Empty `[]` if no
   landlords are linked to the property — do not null-check, always
   iterate.

4. **`postcode` may have or omit a space.** PG does not normalize. Don't
   exact-string-match against another postcode source.

5. **Properties with no linked landlords still appear in the response**
   with `landlords: []`. Don't drop them just because the array is
   empty — they're real properties IG should still know about.

#### Failure responses

| Status | Body | Cause |
|---|---|---|
| `401` | `{ "error": "Missing x-pg-api-key header" }` | Header absent or empty |
| `401` | `{ "error": "Invalid API key" }` | Header present but no matching company |
| `429` | `{ "error": "Too many failed authentication attempts. Try again later." }` | IP locked out (>10 failures in 5 mins) |
| `500` | `{ "error": "Failed to load properties" }` | DB query failed — please report with timestamp |

#### curl

```bash
curl -i \
  -H "x-pg-api-key: YOUR_PG_API_KEY" \
  https://backend-production-508bf.up.railway.app/api/integrations/ig/properties
```

To pretty-print one property only:

```bash
curl -s \
  -H "x-pg-api-key: YOUR_PG_API_KEY" \
  https://backend-production-508bf.up.railway.app/api/integrations/ig/properties \
  | jq '.properties[0]'
```

#### Real prod response (sample)

The first property returned by Pearl Lettings (Norwich) Ltd. as of
2026-04-11:

```json
{
  "pg_property_id": "97d1f8dc-0cce-4580-8939-f20f030e729f",
  "address_line_1": "71 Beverley Road",
  "address_line_2": "",
  "city": "Norwich",
  "postcode": "NR58AP",
  "property_type": "house",
  "bedrooms": 4,
  "updated_at": "2026-04-08T08:54:06.281638+00:00",
  "landlords": []
}
```

Note `landlords: []` — Pearl has not linked landlords to its properties
yet on the PG side, so the array is empty. **This is a valid property
that IG should still import.** If your sync drops properties with no
landlords, you'll see "found N properties, imported 0".

---

## Inbound endpoints (PG receiving from IG)

For completeness — these are the existing webhook endpoints PG exposes
for IG to push events back. They use HMAC signature verification, not the
hashed-key auth above.

### `POST /api/integrations/ig/webhook`

Appointment status updates from IG (created, updated, cancelled,
report.signed, etc.). Requires `x-ig-signature` header (HMAC-SHA256 of
the raw body using the company's IG API key).

### `POST /api/integrations/ig/report-complete`

Final report delivery. Same HMAC requirement.

These are pre-existing and unchanged by the recent integration work.

---

## Troubleshooting checklist

**"Test Connection" fails with 401**

1. Confirm the agent pasted the correct PG API key into IG
2. In the PG settings page, click **Regenerate** — the old key may have
   been hashed before migration 219 ran. The regenerate flow rewrites
   both the encrypted column and the hash column, so the key will then
   authenticate
3. Check IG is sending the header literally as `x-pg-api-key` (most
   stacks normalize, but a few don't)

**"Test Connection" succeeds but property sync imports 0**

1. Hit `/properties` directly with curl (see above) and inspect the raw
   JSON
2. Compare actual field names to what your validator/parser expects —
   the snake_case vs camelCase split between property level and
   landlord.address is the most common cause
3. Check whether your sync is requiring `landlords.length > 0` — if so,
   every property without linked landlords on the PG side gets silently
   dropped
4. Check whether your validator treats empty string `""` as missing —
   PG returns empty strings, not nulls

**Lockout (429 even though the key is correct)**

The IP has failed >10 auth attempts in the last 5 minutes. Either:

- Wait 5 minutes for the window to roll over
- OR make one successful authenticated call (with the correct key) —
  that wipes the failure counter for the IP immediately

**500 error**

If you ever see a real 500 (status 500, not just an IG-side wrapper),
please send:

- Exact request URL + method
- Headers (redact the API key)
- Response body verbatim
- Timestamp (UTC, with seconds) so we can grep server logs

The endpoint has been load-tested against prod and currently returns
correct responses for missing/invalid/valid keys, malformed bodies, wrong
methods, and non-existent paths — so a real 500 is a regression we'd
want to know about immediately.

---

## Versioning

There is no formal API version yet. Breaking changes to the response
shape will be announced in the PR description and this document updated.
The contract today is:

- Adding new fields to `Property` or `Landlord` is **not** breaking
- Renaming or removing existing fields **is** breaking
- Changing the casing of an existing field **is** breaking

If you need a versioned endpoint (e.g. `/v1/properties`) for safety,
ask and we'll alias the current shape under it.

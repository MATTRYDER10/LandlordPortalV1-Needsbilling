# PGIntegrateIG — PropertyGoose ↔ InventoryGoose Integration Plan

**Version:** 1.1  
**Date:** March 2026  
**Scope:** API contract, data flows, UI touchpoints, and webhook events for the PG ↔ IG integration  
**Audience:** Two separate Claude Code agents — one operating on PropertyGoose (PG), one on InventoryGoose (IG)

---

## Overview

PropertyGoose (PG) is a Vue 3 + Vite SPA tenancy management platform. InventoryGoose (IG) is a Nuxt application for property inventory reports (photo capture, AI descriptions, PDF generation, tenant sign-off).

The integration connects them via a REST API. PG is the **master record** for properties, tenancies, and documents. IG is the **operational tool** for conducting and completing inspections. Data flows from PG → IG at booking, and from IG → PG on report completion.

---

## 1. API Key & Connection Settings (PG Agent)

### 1.1 Settings Page — InventoryGoose API Configuration

Add a new section to PG Settings (e.g. `Settings > Integrations > InventoryGoose`):

- **Field:** InventoryGoose API Key (text input, masked)
- **Field:** InventoryGoose Base URL (default: `https://app.inventorygoose.co.uk`)
- **Button:** Test Connection — calls `GET /api/pg/ping` on IG with the API key; shows green tick or error
- **Status indicator:** Connected / Not Connected

Store the API key securely (encrypted at rest, never exposed in frontend JS). Reference as `igApiKey` in all outbound calls.

### 1.2 Locked State — No API Key

If `igApiKey` is null or connection test fails:
- The **Book Inspection** button on tenancy actions renders **greyed out with a padlock icon**
- On hover/click: show tooltip — *"Connect InventoryGoose to book inspections. [Sign up at InventoryGoose →]"*
- The link points to the IG marketing/sign-up page

---

## 2. Properties Sync (PG Agent + IG Agent)

### 2.1 PG — Expose Properties Endpoint

PG must expose an authenticated endpoint that IG can call to pull the property list:

```
GET /api/integrations/ig/properties
Headers: x-pg-api-key: <key>

Response 200:
{
  "properties": [
    {
      "pg_property_id": "prop_abc123",
      "address_line_1": "12 Maple Street",
      "address_line_2": "",
      "city": "Bristol",
      "postcode": "BS16 3AB",
      "property_type": "flat",
      "bedrooms": 2,
      "updated_at": "2026-03-01T10:00:00Z"
    }
  ]
}
```

### 2.2 IG — Properties Tab & Sync Logic

IG maintains its own `properties` table mirrored from PG. The Properties tab in IG shows all synced properties.

**Manual Refresh Button** — labelled *"Sync from PropertyGoose"*:
1. Calls `GET /api/integrations/ig/properties` on PG
2. For each returned property, check if `pg_property_id` already exists in IG database
3. **Skip** if exists (no overwrite of IG-specific data)
4. **Insert** if new — store `pg_property_id` as the foreign key reference
5. Display result: *"3 new properties imported. 45 already up to date."*

**Duplicate check:** Match on `pg_property_id` only. Never create duplicates.

**No automatic background sync** — manual refresh only (as specified).

---

## 3. Book Inspection — Modal & Data POST (PG Agent)

### 3.1 Trigger Button

On the **Active Tenancies** and **Draft Tenancies** action menus, add:

- **Button label:** `Book Inspection`
- **Button icon:** InventoryGoose logo (small, inline left of label)
- **Locked state:** Grey + padlock if no valid IG API key (see Section 1.2)
- **Active state:** Branded button, opens the booking modal

### 3.2 Booking Modal

The modal contains:

| Field | Type | Notes |
|---|---|---|
| Inspection Date | Date picker | Calendar UI, no past dates |
| Inspection Time | Time selector | Hour + minute, 15-min intervals |
| Inspection Type | Dropdown | Options: `Inventory Report`, `Mid-Term Inspection`, `Check Out` |
| Confirm button | Button | Triggers POST to IG |

Pre-populate from tenancy context:
- Property address shown at top of modal (read-only)
- Tenancy ID passed silently in payload

### 3.3 Data POST to IG

On confirm, PG sends:

```
POST https://app.inventorygoose.co.uk/api/pg/appointments
Headers:
  x-pg-api-key: <igApiKey>
  Content-Type: application/json

Body:
{
  "pg_tenancy_id": "ten_xyz789",
  "pg_property_id": "prop_abc123",
  "inspection_type": "inventory_report" | "mid_term" | "check_out",
  "scheduled_date": "2026-04-10",
  "scheduled_time": "10:30",
  "property": {
    "address_line_1": "12 Maple Street",
    "address_line_2": "",
    "city": "Bristol",
    "postcode": "BS16 3AB"
  },
  "tenants": [
    {
      "name": "Jane Smith",
      "email": "jane.smith@email.com"
    },
    {
      "name": "Tom Jones",
      "email": "tom.jones@email.com"
    }
  ],
  "landlord": {
    "name": "David Lloyd",
    "email": "david.lloyd@email.com"
  }
}
```

**Notes:**
- Include **all tenants** on the tenancy (name + email each)
- Include **first landlord only** (name + email)
- `pg_tenancy_id` is the key IG will reference when posting the completed report back
- `pg_property_id` is used to match against the IG properties table

### 3.4 PG Response Handling

On `200` from IG:
- Close modal
- Show success toast: *"Inspection booked for [date] at [time]"*
- Write to PG **Activity Log** for this tenancy:
  ```
  [Inspection Type] booked for [DD/MM/YYYY] at [HH:MM] — sent to InventoryGoose
  ```

On error:
- Show inline error in modal: *"Could not connect to InventoryGoose. Please try again or check your API key in Settings."*
- Do not close modal

---

## 4. Appointment Receipt (IG Agent)

### 4.1 Incoming Appointment Endpoint

IG must expose:

```
POST /api/pg/appointments
Headers: x-pg-api-key: <key>

Validates:
- API key matches a registered PG connection in IG
- Required fields present: pg_tenancy_id, pg_property_id, inspection_type, scheduled_date, scheduled_time, tenants[], landlord

Response 200:
{
  "ig_appointment_id": "appt_ig_001",
  "status": "scheduled",
  "message": "Appointment created successfully"
}
```

### 4.2 IG — Appointment Storage

Store the appointment with:
- `ig_appointment_id` (IG-generated)
- `pg_tenancy_id` (from PG — retained for report push-back)
- `pg_property_id` (matched to IG properties table)
- `inspection_type`
- `scheduled_date` + `scheduled_time`
- `tenants[]` — stored for Send & Sign workflow
- `landlord` — stored for Send & Sign workflow
- `status`: `scheduled` → `in_progress` → `completed` → `report_sent`

### 4.3 IG — Appointments View

Show booked appointments in an Appointments or Dashboard view. Inspector picks up the appointment on the day, opens it, and begins the inspection flow (photos, AI descriptions, room-by-room conditions).

---

## 5. Report Completion & Push-Back to PG (IG Agent + PG Agent)

### 5.1 Trigger Condition (IG)

The completed report PDF is **only** sent to PG when:
- All parties have **signed** via the Send & Sign workflow, **OR**
- The signing loop has been **explicitly closed** by the agent (manual override)

**Draft and finalised-but-unsigned reports must NOT be sent to PG.**

### 5.2 IG — POST Report to PG

Once signed/closed, IG pushes:

```
POST https://app.propertygoose.co.uk/api/integrations/ig/reports
Headers:
  x-ig-api-key: <key>
  Content-Type: application/json

Body:
{
  "pg_tenancy_id": "ten_xyz789",
  "ig_appointment_id": "appt_ig_001",
  "inspection_type": "inventory_report",
  "completed_at": "2026-04-10T14:32:00Z",
  "report_status": "signed" | "signing_closed",
  "report": {
    "delivery_method": "base64_pdf",
    "data": "<base64-encoded PDF string>",
    "filename": "Inventory_Report_12_Maple_Street_2026-04-10.pdf",
    "mime_type": "application/pdf"
  }
}
```

**Delivery method:** Always `base64_pdf`. IG encodes the final signed PDF as a base64 string and includes it directly in the payload. PG decodes and stores the file in its own file storage, making PG the permanent owner of the document — independent of IG availability.

### 5.3 PG — Receive Report Endpoint (PG Agent)

PG must expose:

```
POST /api/integrations/ig/reports
Headers: x-ig-api-key: <key>

Validates:
- API key is valid
- pg_tenancy_id exists in PG database
- report_status is "signed" or "signing_closed" (reject drafts)

Actions:
1. Decode the base64 PDF and store as a file in PG file storage (e.g. S3, Railway volume, or equivalent)
2. Store document record in tenancy documents tab:
   - Document name: filename from payload
   - Source: "InventoryGoose"
   - Stored file reference: internal PG file path/URL (not IG-dependent)
   - Date: completed_at

2. Write to Activity Log for this tenancy:
   "[Inspection Type] completed on [DD/MM/YYYY HH:MM] — signed report received from InventoryGoose"

Response 200:
{
  "status": "received",
  "message": "Report stored against tenancy ten_xyz789"
}
```

### 5.4 PG — Tenancy Documents Tab

The received report appears in the tenancy's Documents tab as:
- **Name:** `Inventory Report — 12 Maple Street — 10 Apr 2026` (or equivalent for mid-term/check-out)
- **Source badge:** InventoryGoose logo or label
- **Action:** Opens or downloads the PDF stored in PG file storage (no dependency on IG being online)
- **Date:** Completion date/time

---

## 6. API Authentication (Both Agents)

### PG → IG calls
- PG sends `x-pg-api-key` header on all outbound requests to IG
- IG validates this key against its registered connections table
- Key is set by the user in PG Settings (Section 1.1)

### IG → PG calls
- IG sends `x-ig-api-key` header on all outbound requests to PG
- PG validates this key
- Key is generated in PG and shared with IG during connection setup (or vice versa — decide on one flow)

### Agreed key exchange flow:
1. User signs up on IG and receives an IG API key from the IG dashboard
2. User pastes the IG API key into PG Settings > Integrations > InventoryGoose
3. PG calls `GET /api/pg/ping` on IG to test the connection
4. IG validates the key and returns a reciprocal PG callback key in the ping response body:
   ```
   GET /api/pg/ping response:
   {
     "status": "ok",
     "pg_callback_key": "pgcb_xxxxxxxxxxxx"
   }
   ```
5. PG stores the `pg_callback_key` automatically — no manual step required for the user
6. Both keys stored **encrypted at rest**, **never exposed in frontend JS**, on their respective platforms
7. Setup is complete — one paste, one click

---

## 7. Endpoint Summary

### PG Exposes (for IG to call)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/integrations/ig/properties` | IG pulls property list for sync |
| `POST` | `/api/integrations/ig/reports` | IG pushes completed signed report |

### IG Exposes (for PG to call)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/pg/ping` | PG tests connection / API key validity |
| `POST` | `/api/pg/appointments` | PG posts a new booked inspection |

---

## 8. Activity Log Entries (PG Agent)

All IG-related events must write to the PG tenancy activity log. Format:

| Event | Log Entry |
|---|---|
| Inspection booked | `[Inspection Type] booked for [DD/MM/YYYY] at [HH:MM] — sent to InventoryGoose` |
| Report received (signed) | `[Inspection Type] completed on [DD/MM/YYYY HH:MM] — signed report received from InventoryGoose` |
| Report received (closed) | `[Inspection Type] completed on [DD/MM/YYYY HH:MM] — signing loop closed, report received from InventoryGoose` |

---

## 9. Error & Edge Cases

| Scenario | Behaviour |
|---|---|
| IG API key not set | Book Inspection button is greyed + padlocked; links to IG sign-up |
| IG unreachable at booking time | Modal shows error, no activity log entry, no appointment created |
| PG unreachable when IG pushes report | IG should retry up to 3 times with exponential backoff (5s, 30s, 2min); log failure in IG |
| Duplicate property on sync | Skip insert, never overwrite; show count of skipped in sync result |
| Report pushed before signing complete | PG endpoint rejects with `400` — only `signed` or `signing_closed` accepted |
| `pg_tenancy_id` not found in PG | PG returns `404`; IG logs error against appointment |

---

## 10. Build Order (Recommended)

1. **IG Agent:** Build `GET /api/pg/ping` endpoint
2. **PG Agent:** Build Settings > Integrations > InventoryGoose (API key input + test connection)
3. **PG Agent:** Build `GET /api/integrations/ig/properties` endpoint
4. **IG Agent:** Build Properties tab + manual sync button with duplicate check
5. **PG Agent:** Build Book Inspection button (locked/unlocked states) + booking modal
6. **PG Agent:** Build `POST` to `IG /api/pg/appointments` + activity log entry on success
7. **IG Agent:** Build `POST /api/pg/appointments` receiver + appointment storage + appointments view
8. **IG Agent:** Build report push `POST` to `PG /api/integrations/ig/reports` (signed/closed trigger only)
9. **PG Agent:** Build `POST /api/integrations/ig/reports` receiver + documents tab storage + activity log
10. **Both:** End-to-end test: book → inspect → sign → verify document appears in PG tenancy

---

*End of PGIntegrateIG v1.1 — updated: base64 PDF delivery, agreed API key handshake flow*

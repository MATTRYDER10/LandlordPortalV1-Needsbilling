# Tenancies Feature Implementation Plan

## Overview
Build a comprehensive Tenancies module that serves as the operational backbone of PropertyGoose, connecting references, properties, landlords, and agreements into a unified tenancy lifecycle.

**Design Principles:**
1. **Single Source of Truth** - One property record with all notes, documents, and audit logs
2. **Seamless Data Flow** - Offers/references automatically create or link to properties
3. **Unified Audit Trail** - Every action logs to both Property tab AND Tenancy tab
4. **Professional & Bug-Free** - No orphan data, no broken links, 100% working rate

---

## Current State Analysis

### What Exists
1. **Properties** (`properties` table) - Full schema with compliance tracking, `property_audit_log` for activity
2. **Landlords** (`landlords` table) - With `property_landlords` join table (ownership %, primary contact)
3. **Offers** (`tenant_offers` table) - Optional `linked_property_id`
4. **References** (`tenant_references` table) - Optional `linked_property_id`
5. **Agreements** - Full PDF generation, e-signing, optional `property_id`
6. **property_tenancies** - Bridge table exists but NOT auto-populated
7. **Two Audit Systems** - `audit_logs` (general) and `property_audit_log` (property-specific)

### Critical Gaps (Must Fix First)

| Gap | Problem | Impact |
|-----|---------|--------|
| Property linking is OPTIONAL | Offers, references, agreements can all exist without property | Orphan data, broken workflows |
| No auto-creation of properties | Manual entry required before linking | Extra steps, inconsistent data |
| `property_tenancies` table unused | Bridge table exists but never populated | No property ↔ reference tracking |
| Two separate audit systems | `audit_logs` vs `property_audit_log` | Fragmented history |
| Landlord AML not enforced | Can create agreements without AML check | Compliance risk |

---

## Phase 0: Foundation Fixes (PREREQUISITE)

**Goal:** Fix the data architecture BEFORE building tenancies. This ensures seamless flow.

### 0.1 Property Auto-Creation Service

Create `/backend/src/services/propertyMatchingService.ts`:

```typescript
interface PropertyMatchResult {
  matched: boolean;
  property_id: string;
  confidence: 'exact' | 'fuzzy' | 'new';
  suggestions?: Property[]; // For fuzzy matches
}

async function matchOrCreateProperty(
  companyId: string,
  address: { line1: string; line2?: string; city: string; postcode: string },
  options?: { autoCreate: boolean; landlordId?: string }
): Promise<PropertyMatchResult>
```

**Matching Logic:**
1. Exact match: Same postcode + normalized address_line1
2. Fuzzy match: Same postcode + Levenshtein distance < 3 on address
3. No match: Create new property (if `autoCreate: true`)

**On Property Creation:**
- Auto-link landlord if `landlordId` provided
- Log to `property_audit_log`: "Property auto-created from offer/reference"
- Set status to 'vacant' by default

### 0.2 Make Property Linking Mandatory

**Database Changes:**
```sql
-- Migration: xxx_enforce_property_linking.sql

-- Add NOT NULL constraint to tenant_offers (with default for existing)
ALTER TABLE tenant_offers
  ALTER COLUMN linked_property_id SET NOT NULL;

-- Add NOT NULL constraint to tenant_references (with default for existing)
ALTER TABLE tenant_references
  ALTER COLUMN linked_property_id SET NOT NULL;

-- Add NOT NULL constraint to agreements
ALTER TABLE agreements
  ALTER COLUMN property_id SET NOT NULL;
```

**API Changes:**
- `POST /api/tenant-offers/send-link` - MUST include property (auto-create if needed)
- `POST /api/references` - MUST include property (auto-create if needed)
- `POST /api/agreements` - MUST include property_id

**Frontend Changes:**
- Remove "manual address entry" option
- Property selection required: search existing OR create new
- "Create Property" inline form when no match found

### 0.3 Auto-Populate property_tenancies

**Trigger on reference creation:**
```sql
-- Migration: xxx_auto_populate_property_tenancies.sql

CREATE OR REPLACE FUNCTION auto_link_property_tenancy()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into property_tenancies if not exists
  INSERT INTO property_tenancies (property_id, reference_id, company_id, is_active, created_at)
  VALUES (NEW.linked_property_id, NEW.id, NEW.company_id, true, NOW())
  ON CONFLICT (property_id, reference_id) DO NOTHING;

  -- Log to property_audit_log
  INSERT INTO property_audit_log (property_id, company_id, action, description, metadata, created_at)
  VALUES (
    NEW.linked_property_id,
    NEW.company_id,
    'REFERENCE_LINKED',
    'Tenant reference linked to property',
    jsonb_build_object('reference_id', NEW.id, 'tenant_name', NEW.tenant_name_encrypted),
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_link_property_tenancy
AFTER INSERT ON tenant_references
FOR EACH ROW
EXECUTE FUNCTION auto_link_property_tenancy();
```

### 0.4 Unified Audit Logging Service

Create `/backend/src/services/unifiedAuditService.ts`:

```typescript
interface AuditEvent {
  companyId: string;
  userId: string;
  action: string;
  description: string;
  metadata?: Record<string, any>;

  // Link to ALL relevant entities
  propertyId?: string;
  tenancyId?: string;
  referenceId?: string;
  agreementId?: string;
  offerId?: string;
  landlordId?: string;
}

async function logAuditEvent(event: AuditEvent): Promise<void> {
  // Always log to general audit_logs
  await db.insert(audit_logs).values({...});

  // If property involved, also log to property_audit_log
  if (event.propertyId) {
    await db.insert(property_audit_log).values({...});
  }

  // If tenancy involved, also log to tenancy_audit_log (new)
  if (event.tenancyId) {
    await db.insert(tenancy_audit_log).values({...});
  }
}
```

**Standard Audit Events:**
| Event | Logs To | Description |
|-------|---------|-------------|
| OFFER_SENT | property_audit_log | "Offer sent to tenant" |
| OFFER_ACCEPTED | property_audit_log | "Offer accepted by tenant" |
| REFERENCE_CREATED | property_audit_log | "Reference created for tenant" |
| REFERENCE_COMPLETED | property_audit_log | "Reference completed" |
| TENANCY_CREATED | property_audit_log, tenancy_audit_log | "Tenancy created" |
| AGREEMENT_GENERATED | property_audit_log, tenancy_audit_log | "Agreement generated" |
| AGREEMENT_SIGNED | property_audit_log, tenancy_audit_log | "Agreement signed by [party]" |
| AGREEMENT_EXECUTED | property_audit_log, tenancy_audit_log | "Agreement executed" |
| MONIES_REQUESTED | property_audit_log, tenancy_audit_log | "Initial monies requested" |
| MONIES_RECEIVED | property_audit_log, tenancy_audit_log | "Initial monies received" |
| TENANCY_STARTED | property_audit_log, tenancy_audit_log | "Tenancy started" |
| TENANCY_ENDED | property_audit_log, tenancy_audit_log | "Tenancy ended" |
| COMPLIANCE_PACK_SENT | property_audit_log, tenancy_audit_log | "Compliance pack sent" |
| NOTICE_SERVED | property_audit_log, tenancy_audit_log | "Section X notice served" |

---

## Phase 1: Property & Landlord Improvements

### 1.1 Enhanced Property Selection UI

**When creating offer/reference:**
1. Search box with autocomplete (postcode + address)
2. Shows matching properties with landlord names
3. "Create New Property" button if no match
4. Inline property creation form:
   - Address fields (line1, line2, city, postcode)
   - Link landlord (search existing or create new)
   - Property type, bedrooms (optional, can complete later)

### 1.2 Property Tab Shows All Activity

**PropertyDetail.vue Activity Tab displays:**
- Offers sent for this property
- References linked to this property
- Tenancies (current and past)
- Agreements generated
- Compliance pack sent dates
- All status changes with timestamps

**Query for Activity Tab:**
```sql
SELECT * FROM (
  -- Property-specific events
  SELECT created_at, action, description, metadata
  FROM property_audit_log
  WHERE property_id = $1

  UNION ALL

  -- Tenancy events for this property
  SELECT tal.created_at, tal.action, tal.description, tal.metadata
  FROM tenancy_audit_log tal
  JOIN tenancies t ON t.id = tal.tenancy_id
  WHERE t.property_id = $1
)
ORDER BY created_at DESC;
```

### 1.3 Landlord AML Warning Integration

**When creating tenancy/agreement for property:**
1. Check landlord AML status from `property_landlords` → `landlords`
2. If AML not satisfactory:
   - Show warning banner (yellow)
   - "Request AML Check" button
   - Allow continue but log override
3. If AML expired (>2 years):
   - Show warning banner (orange)
   - Prompt to request new AML check

---

## Phase 2: Tenancies Table & Core Schema

### New Table: `tenancies`
```sql
CREATE TABLE tenancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  property_id UUID NOT NULL REFERENCES properties(id), -- NOW MANDATORY

  -- Visibility Control
  converted BOOLEAN DEFAULT false,
  converted_at TIMESTAMPTZ,
  converted_by UUID REFERENCES auth.users(id),
  source_reference_id UUID REFERENCES tenant_references(id),

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'awaiting_signatures', 'signed', 'monies_requested',
    'monies_received', 'executed', 'active', 'ended', 'cancelled'
  )),

  -- Dates
  tenancy_start_date DATE,
  tenancy_end_date DATE,
  move_in_date DATE,
  actual_move_in_date DATE,
  ended_at TIMESTAMPTZ,

  -- Financial
  monthly_rent DECIMAL(10,2),
  deposit_amount DECIMAL(10,2),
  holding_deposit_amount DECIMAL(10,2),
  holding_deposit_received BOOLEAN DEFAULT false,
  deposit_scheme_type TEXT CHECK (deposit_scheme_type IN ('dps', 'mydeposits', 'tds', 'no_deposit', 'reposit')),
  deposit_registered BOOLEAN DEFAULT false,
  deposit_registered_at TIMESTAMPTZ,
  deposit_certificate_number TEXT,

  -- Agreement Link
  agreement_id UUID REFERENCES agreements(id),
  agreement_signed_at TIMESTAMPTZ,
  agreement_executed_at TIMESTAMPTZ,

  -- Compliance
  compliance_pack_sent BOOLEAN DEFAULT false,
  compliance_pack_sent_at TIMESTAMPTZ,

  -- Metadata
  notes_encrypted TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_tenancies_company ON tenancies(company_id);
CREATE INDEX idx_tenancies_property ON tenancies(property_id);
CREATE INDEX idx_tenancies_status ON tenancies(status) WHERE status NOT IN ('ended', 'cancelled');
```

### New Table: `tenancy_people`
```sql
CREATE TABLE tenancy_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  reference_id UUID REFERENCES tenant_references(id),
  role TEXT NOT NULL CHECK (role IN ('tenant', 'guarantor')),
  is_lead_tenant BOOLEAN DEFAULT false,
  rent_share DECIMAL(5,2),
  guarantor_for_person_id UUID REFERENCES tenancy_people(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tenancy_people_tenancy ON tenancy_people(tenancy_id);
```

### New Table: `tenancy_landlords`
```sql
CREATE TABLE tenancy_landlords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  landlord_id UUID NOT NULL REFERENCES landlords(id),
  ownership_percentage DECIMAL(5,2),
  rent_share DECIMAL(5,2),
  is_primary_contact BOOLEAN DEFAULT false,
  bank_account_name_encrypted TEXT,
  bank_account_number_encrypted TEXT,
  bank_sort_code_encrypted TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tenancy_landlords_tenancy ON tenancy_landlords(tenancy_id);
```

### New Table: `tenancy_audit_log`
```sql
CREATE TABLE tenancy_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id),
  action TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tenancy_audit_tenancy ON tenancy_audit_log(tenancy_id);
CREATE INDEX idx_tenancy_audit_created ON tenancy_audit_log(created_at DESC);
```

### Additional Tables

**`initial_monies`** - Line items for initial monies calculation
- `tenancy_id`, `type` (pro_rata, first_month, deposit, holding_credit, additional)
- `description`, `amount`, `created_at`
- Additional charges have type='additional' with free text description

**`initial_monies_requests`** - Track requests and confirmations
- `tenancy_id`, `tenant_id`, `amount`, `sent_at`, `confirmed_at`

**`tenancy_notices`** - Section 8, 13, 21, 48 notices
- `tenancy_id`, `notice_type`, `content`, `generated_at`, `served_at`, `served_method`

**`rent_reviews`** - Rent increase tracking
- `tenancy_id`, `old_rent`, `new_rent`, `effective_date`, `notice_sent_at`

**`tenancy_compliance_packs`** - Track compliance pack sends
- `tenancy_id`, `sent_at`, `sent_to`, `documents_included`, `sent_by`

**`tenancy_people` additions for mid-tenancy changes:**
- `start_date` - When person joined the tenancy
- `end_date` - When person left (null if current)
- `status` - 'active', 'pending_reference', 'ended'
- `replacement_for_id` - Links to person they replaced (if applicable)

---

## Phase 3: Convert to Tenancy Flow

### Entry Points
1. **From References tab** - "Convert to Tenancy" button on completed reference (MAIN FLOW)
2. **From Tenancies tab** - "New Tenancy" button (from scratch)
3. **From Properties tab** - "Create Tenancy" → Opens linking page where agent:
   - Selects existing reference(s) for tenants/guarantors
   - Or initiates new reference requests if needed
   - Links landlords (pre-filled from property_landlords)

**NOTE:** No tenancy creation from Offers tab. Offers capture initial details but tenancies are only created after referencing.

### Convert to Tenancy Logic
```
1. Get property from reference.linked_property_id (ALWAYS exists now)
2. Get landlords from property_landlords
3. Get reference group (parent + children + guarantors)
4. Get offer data if exists (rent, deposit, holding deposit)

5. Pre-fill tenancy form:
   - Property: Read-only (already linked)
   - Landlords: From property_landlords (can add more)
   - Tenants: From references (show verification status)
   - Guarantors: From guarantor references
   - Financial: From offer/reference

6. Agent reviews/completes missing data

7. On Save:
   - Create tenancy record
   - Create tenancy_people records
   - Create tenancy_landlords records (copy from property_landlords)
   - Log to BOTH property_audit_log AND tenancy_audit_log
   - Update property status to 'in_tenancy'
```

### Validation Before Conversion
- [ ] Property has at least one landlord linked
- [ ] All tenants have completed references (warning if not)
- [ ] Landlord AML status checked (warning if not satisfactory)
- [ ] Compliance certificates exist (warning if expired/missing)

---

## Phase 4: Tenancies Tab & UI

### Navigation
Add "Tenancies" to main nav between References and Properties

### Tab Structure
1. **Pre-Tenancy** - Status: draft (references in progress, not yet converted)
2. **In Progress** - Status: awaiting_signatures, signed, monies_requested
3. **Active** - Status: monies_received, executed, active
4. **Archived** - Status: ended, cancelled

### List View
| Column | Source |
|--------|--------|
| Property | tenancy → property.address |
| Tenants | tenancy_people where role='tenant' |
| Landlord | tenancy_landlords → landlord.name |
| Move-in | tenancy.move_in_date |
| Rent | tenancy.monthly_rent |
| Status | Status badge |
| Actions | View, Archive |

### Tenancy Detail Modal (Side Drawer)

**Tab 1: Overview**
- Property card (address, link to property tab)
- Tenants list with verification status icons
- Landlords list with AML status icons
- Key dates (start, end, move-in)
- Financial summary (rent, deposit)
- Quick action buttons

**Tab 2: Agreement**
- Agreement status badge
- Generate/Edit Agreement button
- Send for Signing button
- View Signed PDF link
- Compliance override warnings

**Tab 3: Monies**
- Initial monies breakdown
- Send Request button
- Payment status per tenant
- Confirm Receipt button

**Tab 4: Documents**
- **From Property:** Compliance certificates (Gas, EPC, EICR)
- **From Tenancy:** Agreement PDF, signed agreement, compliance pack
- **From Notices:** Any served notices
- All documents clickable to view/download

**Tab 5: Activity**
- Combined timeline from `tenancy_audit_log`
- Shows all actions with timestamps and users
- Links to related items

**Tab 6: Rent Reviews** (if active tenancy)
- Current rent
- Rent history
- Initiate Rent Review button

**Tab 7: Management Actions**
- Generate Notices
- Rent Due Date Changes
- Tenant/Guarantor Changes

---

## Phase 4B: Mid-Tenancy Management Features

### 4B.1 Generate Notices
Button to generate and serve legal notices:
- Section 8 (Possession - breach of tenancy)
- Section 13 (Rent increase)
- Section 21 (No-fault eviction - where applicable)
- Section 48 (Landlord's address for service)

Flow:
1. Select notice type
2. Fill in required details (dates, reasons if applicable)
3. Preview generated notice
4. Save/Print or Send electronically
5. Mark as "Served" with date
6. Log to tenancy_audit_log

### 4B.2 Rent Due Date Changes
Change the monthly rent payment date mid-tenancy:
1. Agent clicks "Change Rent Due Date"
2. Enter new due date (day of month)
3. System calculates pro-rata adjustment for transition
4. Confirm change
5. Update tenancy record
6. Notify tenant(s) of change
7. Log to audit

### 4B.3 Tenant/Guarantor Changes (Mid-Tenancy)
**"Change Tenant/Guarantor" button** for when someone leaves mid-tenancy:

**Flow:**
1. Agent clicks "Change Tenant/Guarantor"
2. Modal opens with two sections:

   **Section A - Who is Leaving:**
   - Select person from current tenants/guarantors
   - Enter leaving date
   - Reason (optional)

   **Section B - Who is Joining:**
   - Enter new person's details (name, email, phone)
   - Role: Tenant or Guarantor
   - If Guarantor: Select which tenant they're guaranteeing
   - Rent share (if applicable)

3. On Submit:
   - Mark leaving person as "ended" on tenancy_people (with end_date)
   - Create placeholder for new person
   - **Auto-send reference request** to new person
   - Log to audit: "Tenant change initiated"

4. When new person's reference completes:
   - Add them to tenancy_people with start_date
   - Notify agent: "New tenant reference complete"
   - Prompt to generate Deed of Variation if needed

5. **Deed of Variation** (if agreement needs updating):
   - Option to generate deed updating the parties
   - Send for signature to all current parties + new person
   - Once signed, attach to tenancy documents

**Database:**
- `tenancy_people.start_date` - When person joined tenancy
- `tenancy_people.end_date` - When person left (null if current)
- `tenancy_people.status` - 'active', 'pending_reference', 'ended'

---

## Phase 5: Agreement Integration

**IMPORTANT:** Do NOT duplicate or modify the existing "Generate Agreement" flow. The tenancy simply USES the existing agreement generation system.

### Flow
1. From tenancy → "Generate Agreement" button
2. Opens the EXISTING agreement generation flow (no changes to that system)
3. Agreement form is pre-filled with tenancy data:
   - Tenancy record (dates, rent, deposit)
   - Property record (address, compliance)
   - Landlord records (names, addresses, bank details)
   - Tenant references (names, addresses)
4. Agent uses existing agreement tools (special clauses, AI suggestions, etc.)
5. Save → Links agreement to tenancy (`tenancy.agreement_id`)
6. Send for Signing → Existing e-sign workflow
7. All signatures complete → Auto-update tenancy status to 'signed'

### Compliance Check Before Sending
```
On "Send for Signing":
1. Check all compliance certificates from property
2. If any expired:
   - Show modal: "The following certificates are expired: [list]"
   - Options: "Override & Continue" or "Cancel"
   - If override: Log reason, mark compliance_override on agreement
3. If all valid: Proceed normally
```

---

## Phase 6: Initial Monies

### Calculation
```
Pro-rata rent = (days_until_rent_due / days_in_month) × monthly_rent
First full month = monthly_rent (if move-in not on rent due day)
Deposit = tenancy.deposit_amount
Holding deposit credit = -tenancy.holding_deposit_amount
Additional charges = custom line items (see below)
---
Total = sum of above
```

### Additional Charges (Non-Mandatory)
Agent can add custom line items to the initial monies:
- Free text description (e.g., "Admin Fee", "Inventory Fee", "Professional Cleaning")
- Amount
- Add/remove rows as needed
- These are stored in `initial_monies` table with type='additional'

### Request Flow
1. Agent clicks "Send Initial Monies Request"
2. System calculates amounts, shows preview
3. Agent can add/edit additional charges
4. Agent selects split method (lead tenant only / split equally / custom)
5. Agent confirms bank details
6. System sends email with full breakdown and "I've Paid" link
7. Tenant clicks "I've Paid" → Agent notified
8. Agent confirms receipt → Status updates to 'monies_received'
9. Audit logged to BOTH property and tenancy

---

## Phase 7: Agreement Execution & Compliance Pack

### Execute Agreement
1. All parties signed
2. Agent clicks "Execute Agreement"
3. System:
   - Locks agreement
   - Generates final PDF with all signatures
   - Updates tenancy status to 'executed'
   - Enables "Send Compliance Pack" button (does NOT auto-send)

### Compliance Pack Contents
- **Final Signed Tenancy Agreement** (the executed agreement PDF)
- Gas Safety Certificate (from property `compliance_records`)
- EICR Certificate (from property `compliance_records`)
- EPC Certificate (from property `compliance_records`)
- Prescribed Information (generated PDF with tenancy details)
- How to Rent Guide (static PDF)

### Compliance Pack Send (MANUAL - No Auto-Send)
1. Agent clicks "Send Compliance Pack" button
2. System compiles all documents (including signed agreement)
3. Send to all tenants + landlords + CC agent
4. Store record in `tenancy_compliance_packs`
5. Button changes to "Sent ✓" (greyed out, shows sent date)
6. Log to BOTH property_audit_log AND tenancy_audit_log

**NOTE:** Compliance pack is NOT auto-sent. Agent must manually click the button after agreement execution.

---

## Phase 8: Cross-Tab Integration & Linked Views

**Design Principle:** Every tab is a "hub" showing related data with click-through links. No navigating back and forth - everything visible at a glance.

---

### 8.1 Property Tab (Central Hub)

The Property detail view should show EVERYTHING related to that property.

**PropertyDetail.vue - Enhanced Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│ PROPERTY HEADER                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ 123 High Street, London SW1A 1AA          [Status: In Tenancy]│
│ │ 3 bed • Semi-detached • Council Tax Band D                   ││
│ └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│ LEFT COLUMN              │ CENTER COLUMN      │ RIGHT COLUMN    │
│ ┌───────────────────────┐│┌─────────────────┐│┌───────────────┐│
│ │ COMPLIANCE            ││ PROPERTY DETAILS ││ TABS           ││
│ │ ✅ Gas (exp 12/2026)  ││                  ││ [Landlords]    ││
│ │ ✅ EPC (Band C)       ││ Type: Semi       ││ [Tenants]      ││
│ │ ⚠️ EICR (exp 2 mo)    ││ Bedrooms: 3      ││ [Tenancies]    ││
│ │                       ││ Bathrooms: 2     ││ [Documents]    ││
│ │ [+ Add Compliance]    ││ Furnished: Part  ││ [Activity]     ││
│ └───────────────────────┘│└─────────────────┘│└───────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

**Right Column Tabs - Enhanced:**

**Tab: Landlords**
```
┌─────────────────────────────────────────────────────┐
│ LANDLORDS                              [+ Add Link] │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐│
│ │ 👤 John Smith (Primary)           [View →]      ││
│ │    📧 john@email.com  📞 07700 900123           ││
│ │    Ownership: 60%                               ││
│ │    AML: ✅ Verified (Jan 2025)                  ││
│ └─────────────────────────────────────────────────┘│
│ ┌─────────────────────────────────────────────────┐│
│ │ 👤 Jane Smith                      [View →]      ││
│ │    📧 jane@email.com  📞 07700 900456           ││
│ │    Ownership: 40%                               ││
│ │    AML: ⚠️ Requested (pending)                  ││
│ └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```
- Click [View →] → Opens Landlord detail modal
- Shows contact info inline (no extra clicks needed)
- AML status with visual indicator

**Tab: Tenants (NEW - from active tenancy)**
```
┌─────────────────────────────────────────────────────┐
│ CURRENT TENANTS                                     │
│ From: Active Tenancy #TEN-2024-001    [View →]      │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐│
│ │ 👤 Alice Johnson (Lead)            [View Ref →] ││
│ │    📧 alice@email.com  📞 07700 111222          ││
│ │    Rent Share: 50% (£750/mo)                    ││
│ │    Reference: ✅ Complete                       ││
│ │    Guarantor: Bob Johnson           [View →]    ││
│ └─────────────────────────────────────────────────┘│
│ ┌─────────────────────────────────────────────────┐│
│ │ 👤 Charlie Brown                   [View Ref →] ││
│ │    📧 charlie@email.com  📞 07700 333444        ││
│ │    Rent Share: 50% (£750/mo)                    ││
│ │    Reference: ✅ Complete                       ││
│ │    Guarantor: None                              ││
│ └─────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────┤
│ Move-in: 1 Feb 2025 • Rent: £1,500/mo • Ends: 31 Jan 2026│
│ [View Full Tenancy →]                               │
└─────────────────────────────────────────────────────┘

── OR if no active tenancy ──

┌─────────────────────────────────────────────────────┐
│ CURRENT TENANTS                                     │
├─────────────────────────────────────────────────────┤
│           No active tenancy                         │
│                                                     │
│    Property is currently vacant                     │
│                                                     │
│    [Create Tenancy]  [View Past Tenancies]          │
└─────────────────────────────────────────────────────┘
```
- Shows tenants from ACTIVE tenancy only
- Contact info visible inline
- Click links to reference detail, guarantor detail, or full tenancy
- Quick summary: move-in date, rent, end date

**Tab: Tenancies (History)**
```
┌─────────────────────────────────────────────────────┐
│ TENANCY HISTORY                      [+ New Tenancy]│
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐│
│ │ 🟢 ACTIVE: TEN-2024-001            [View →]     ││
│ │    Alice Johnson, Charlie Brown                 ││
│ │    1 Feb 2025 → 31 Jan 2026                     ││
│ │    £1,500/mo • Status: Executed                 ││
│ └─────────────────────────────────────────────────┘│
│ ┌─────────────────────────────────────────────────┐│
│ │ ⚪ ENDED: TEN-2023-042              [View →]     ││
│ │    David Wilson                                 ││
│ │    1 Mar 2023 → 28 Feb 2024                     ││
│ │    £1,400/mo • Ended normally                   ││
│ └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

**Tab: Documents**
- Unchanged, but add filter for "Tenancy Documents"

**Tab: Activity**
- Combined timeline from property_audit_log + tenancy_audit_log
- Filter by: All, Property, Tenancy, Compliance, Offers

---

### 8.2 Tenancy Tab (Tenancy Detail View)

**TenancyDetail.vue - Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│ TENANCY HEADER                                                  │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ TEN-2024-001                        [Status: Executed]       ││
│ │ 123 High Street, London SW1A 1AA    [View Property →]        ││
│ └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│ TABS: [Overview] [Agreement] [Monies] [Documents] [Activity]    │
├─────────────────────────────────────────────────────────────────┤
```

**Tab: Overview**
```
┌─────────────────────────────────────────────────────┐
│ PROPERTY                               [View →]     │
├─────────────────────────────────────────────────────┤
│ 123 High Street, London SW1A 1AA                    │
│ 3 bed • Semi-detached                               │
│ Compliance: ✅ Gas ✅ EPC ⚠️ EICR (expiring)        │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ LANDLORDS                                           │
├─────────────────────────────────────────────────────┤
│ 👤 John Smith (Primary)               [View →]      │
│    📧 john@email.com  📞 07700 900123               │
│    Bank: ****1234 (for rent payments)               │
│    AML: ✅ Verified                                 │
│                                                     │
│ 👤 Jane Smith                         [View →]      │
│    📧 jane@email.com  📞 07700 900456               │
│    AML: ⚠️ Pending                                  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ TENANTS                                             │
├─────────────────────────────────────────────────────┤
│ 👤 Alice Johnson (Lead)               [View Ref →]  │
│    📧 alice@email.com  📞 07700 111222              │
│    Rent: £750/mo (50%)                              │
│    Reference: ✅ Complete                           │
│    └── Guarantor: Bob Johnson         [View →]      │
│                                                     │
│ 👤 Charlie Brown                      [View Ref →]  │
│    📧 charlie@email.com  📞 07700 333444            │
│    Rent: £750/mo (50%)                              │
│    Reference: ✅ Complete                           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ KEY DATES                                           │
├─────────────────────────────────────────────────────┤
│ Start Date:    1 Feb 2025                           │
│ End Date:      31 Jan 2026 (12 months)              │
│ Move-in:       1 Feb 2025                           │
│ Next Review:   1 Feb 2026                           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ FINANCIALS                                          │
├─────────────────────────────────────────────────────┤
│ Monthly Rent:     £1,500                            │
│ Deposit:          £1,730 (5 weeks)                  │
│ Holding Deposit:  £346 (1 week) ✅ Received         │
│ Deposit Scheme:   DPS • Cert #12345678              │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ QUICK ACTIONS                                       │
├─────────────────────────────────────────────────────┤
│ [Generate Agreement] [Send Monies Request]          │
│ [Send Compliance Pack] [Serve Notice]               │
└─────────────────────────────────────────────────────┘
```

**Tab: Documents**
```
┌─────────────────────────────────────────────────────┐
│ DOCUMENTS                                           │
├─────────────────────────────────────────────────────┤
│ 📁 FROM PROPERTY (Compliance)         [View All →]  │
│    📄 Gas Safety Certificate      exp 12/2026 [↓]   │
│    📄 EPC Certificate             Band C      [↓]   │
│    📄 EICR Certificate            exp 03/2025 [↓]   │
├─────────────────────────────────────────────────────┤
│ 📁 TENANCY DOCUMENTS                                │
│    📄 Tenancy Agreement (Draft)               [↓]   │
│    📄 Tenancy Agreement (Signed)              [↓]   │
│    📄 Compliance Pack (Sent 1 Feb)            [↓]   │
│    📄 Prescribed Information                  [↓]   │
├─────────────────────────────────────────────────────┤
│ 📁 NOTICES                                          │
│    (No notices served)                              │
└─────────────────────────────────────────────────────┘
```
- Property compliance docs shown but stored on property (links, not copies)
- Tenancy-specific docs stored on tenancy

---

### 8.3 Landlord Tab (Landlord Detail View)

**LandlordDetail.vue - Enhanced:**

```
┌─────────────────────────────────────────────────────────────────┐
│ LANDLORD HEADER                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ 👤 John Smith                       [AML: ✅ Verified]       ││
│ │ 📧 john@email.com  📞 07700 900123                           ││
│ └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│ TABS: [Details] [Properties] [Tenancies] [Activity]             │
├─────────────────────────────────────────────────────────────────┤
```

**Tab: Properties**
```
┌─────────────────────────────────────────────────────┐
│ PROPERTIES (2)                        [+ Link New]  │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐│
│ │ 🏠 123 High Street, SW1A 1AA       [View →]     ││
│ │    Ownership: 60% (Primary Contact)             ││
│ │    Status: 🟢 In Tenancy                        ││
│ │    Tenants: Alice Johnson, Charlie Brown        ││
│ │    Rent: £1,500/mo                              ││
│ └─────────────────────────────────────────────────┘│
│ ┌─────────────────────────────────────────────────┐│
│ │ 🏠 45 Park Lane, W1K 1AA           [View →]     ││
│ │    Ownership: 100%                              ││
│ │    Status: ⚪ Vacant                            ││
│ │    Last Tenancy: Ended Dec 2024                 ││
│ └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

**Tab: Tenancies**
```
┌─────────────────────────────────────────────────────┐
│ TENANCIES (3)                                       │
├─────────────────────────────────────────────────────┤
│ 🟢 ACTIVE                                           │
│ ┌─────────────────────────────────────────────────┐│
│ │ TEN-2024-001                       [View →]     ││
│ │ 123 High Street • Alice, Charlie                ││
│ │ 1 Feb 2025 → 31 Jan 2026 • £1,500/mo            ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
│ ⚪ PAST                                             │
│ ┌─────────────────────────────────────────────────┐│
│ │ TEN-2023-042                       [View →]     ││
│ │ 123 High Street • David Wilson                  ││
│ │ 1 Mar 2023 → 28 Feb 2024 • £1,400/mo            ││
│ └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

---

### 8.4 References Tab (Reference Detail View)

**PersonDrawer.vue - Enhanced:**

Add link back to tenancy if converted:

```
┌─────────────────────────────────────────────────────┐
│ TENANCY LINK                                        │
├─────────────────────────────────────────────────────┤
│ This reference is part of:                          │
│ 🏠 TEN-2024-001                      [View →]       │
│    123 High Street, London SW1A 1AA                 │
│    Status: Executed • Move-in: 1 Feb 2025           │
└─────────────────────────────────────────────────────┘
```

Add property link:

```
┌─────────────────────────────────────────────────────┐
│ PROPERTY                                            │
├─────────────────────────────────────────────────────┤
│ 🏠 123 High Street, London SW1A 1AA  [View →]       │
│    Landlord: John Smith              [View →]       │
└─────────────────────────────────────────────────────┘
```

---

### 8.5 Offers Tab

**ViewOfferModal.vue - Enhanced:**

Add property and landlord info:

```
┌─────────────────────────────────────────────────────┐
│ PROPERTY                                            │
├─────────────────────────────────────────────────────┤
│ 🏠 123 High Street, London SW1A 1AA  [View →]       │
│    3 bed • Semi-detached                            │
│    Landlord: John Smith              [View →]       │
│    📧 john@email.com  📞 07700 900123               │
└─────────────────────────────────────────────────────┘
```

---

### 8.6 Cross-Link Summary Table

| From Tab | Shows | Links To |
|----------|-------|----------|
| **Property** | Landlord name, email, phone, AML status | Landlord detail |
| **Property** | Current tenants (from active tenancy), contact info | Reference detail |
| **Property** | Active tenancy summary | Tenancy detail |
| **Property** | Tenancy history | Each tenancy detail |
| **Tenancy** | Property address, compliance summary | Property detail |
| **Tenancy** | Landlord name, email, phone, bank | Landlord detail |
| **Tenancy** | Tenant name, email, phone, ref status | Reference detail |
| **Tenancy** | Property compliance documents | Property documents |
| **Landlord** | All linked properties with status | Property detail |
| **Landlord** | All tenancies across properties | Tenancy detail |
| **Reference** | Property address | Property detail |
| **Reference** | Landlord name | Landlord detail |
| **Reference** | Linked tenancy (if converted) | Tenancy detail |
| **Offer** | Property address | Property detail |
| **Offer** | Landlord name, contact | Landlord detail |

---

### 8.7 API Endpoints for Cross-Linking

**New/Enhanced Endpoints:**

```typescript
// Get property with all linked data
GET /api/properties/:id/full
Response: {
  property: {...},
  landlords: [{...landlord, contact, aml_status}],
  active_tenancy: {
    ...tenancy,
    tenants: [{...tenant, reference_status, contact}],
    guarantors: [{...}]
  },
  tenancy_history: [...],
  compliance_summary: {...}
}

// Get tenancy with all linked data
GET /api/tenancies/:id/full
Response: {
  tenancy: {...},
  property: {...property, compliance_records},
  landlords: [{...landlord, contact, aml_status, bank_details}],
  tenants: [{...tenant, reference, guarantor}],
  documents: {
    property_compliance: [...],
    tenancy_documents: [...],
    notices: [...]
  }
}

// Get landlord with properties and tenancies
GET /api/landlords/:id/full
Response: {
  landlord: {...},
  properties: [{...property, status, active_tenancy_summary}],
  tenancies: [{...tenancy, property_address, tenant_names}]
}
```

---

### Data Flow Diagram (Updated)

```
┌─────────────────────────────────────────────────────────────────┐
│                        PROPERTY (Central Hub)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Compliance  │  │  Landlords  │  │   Tenants   │              │
│  │ Records     │  │  (linked)   │  │ (from       │              │
│  └─────────────┘  └──────┬──────┘  │  tenancy)   │              │
│                          │         └──────┬──────┘              │
│                          │                │                      │
│                    ┌─────┴────────────────┴─────┐                │
│                    │        TENANCIES           │                │
│                    │  (current + history)       │                │
│                    └─────────────┬──────────────┘                │
│                                  │                               │
│  ┌───────────────────────────────┼───────────────────────────┐  │
│  │                               │                           │  │
│  ▼                               ▼                           ▼  │
│ OFFERS                      REFERENCES                  AGREEMENTS│
│ (property_id)              (property_id)               (tenancy_id)│
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │     UNIFIED AUDIT       │
                    │  (shows in all views)   │
                    └─────────────────────────┘
```

---

## Implementation Order

### Sprint 0: Foundation (MUST DO FIRST)
1. Create `propertyMatchingService.ts`
2. Migration: Make `linked_property_id` NOT NULL (with backfill)
3. Migration: Auto-populate `property_tenancies` trigger
4. Create `unifiedAuditService.ts`
5. Update offer/reference routes to require property
6. Update frontend to require property selection

### Sprint 1: Core Tenancies
7. Migration: Create tenancies tables
8. Create `tenancyService.ts`
9. API: Tenancies CRUD endpoints
10. Convert to Tenancy flow (backend + frontend)

### Sprint 2: Tenancies UI & Cross-Linking
11. Add Tenancies to navigation
12. Tenancies list view
13. Tenancy detail modal (all tabs with cross-links)
14. Property tab: Add Tenants tab (from active tenancy)
15. Property tab: Add Tenancies tab (history)
16. Property tab: Enhance Landlords tab with contact info
17. Landlord tab: Add Properties and Tenancies tabs
18. Create `/full` API endpoints for cross-linked data

### Sprint 3: Agreement Integration
15. Pre-fill agreement from tenancy
16. Link agreement to tenancy
17. Status sync on signature
18. Compliance check before send

### Sprint 4: Monies & Compliance
19. Initial monies calculation
20. Send request flow
21. Compliance pack generation
22. Auto-send on execution

### Sprint 5: Management Features
23. Notice generation (Section 8, 13, 21, 48) with serve tracking
24. Rent due date change flow with pro-rata calculation
25. Tenant/Guarantor change flow:
    - Remove leaving person
    - Add new person with auto-reference request
    - Deed of Variation generation
26. Rent review flow

---

## Key Files to Modify/Create

### Backend - New Files
- `/backend/src/services/propertyMatchingService.ts`
- `/backend/src/services/unifiedAuditService.ts`
- `/backend/src/services/tenancyService.ts`
- `/backend/src/services/initialMoniesService.ts`
- `/backend/src/services/compliancePackService.ts`

### Backend - Modify
- `/backend/src/routes/tenant-offers.ts` - Require property, use matching service
- `/backend/src/routes/references.ts` - Require property, use matching service
- `/backend/src/routes/tenancies.ts` - Full CRUD + conversion logic
- `/backend/src/routes/agreements.ts` - Link to tenancy, compliance check

### Frontend - New Files
- `/frontend/src/views/Tenancies.vue`
- `/frontend/src/views/TenancyDetail.vue`
- `/frontend/src/components/tenancy/ConvertToTenancyModal.vue`
- `/frontend/src/components/tenancy/InitialMoniesModal.vue`
- `/frontend/src/components/tenancy/CompliancePackPreview.vue`
- `/frontend/src/components/property/PropertySelector.vue` (reusable)

### Frontend - Modify
- `/frontend/src/router/index.ts` - Add tenancies routes
- `/frontend/src/views/References.vue` - Add Convert to Tenancy button
- `/frontend/src/views/PropertyDetail.vue` - Add tenancies section, update activity
- `/frontend/src/components/offers/SendOfferModal.vue` - Require property

### Migrations
1. `xxx_enforce_property_linking.sql`
2. `xxx_auto_populate_property_tenancies.sql`
3. `xxx_create_tenancies.sql`
4. `xxx_create_tenancy_people.sql`
5. `xxx_create_tenancy_landlords.sql`
6. `xxx_create_tenancy_audit_log.sql`
7. `xxx_create_initial_monies.sql`
8. `xxx_create_tenancy_notices.sql`
9. `xxx_create_rent_reviews.sql`

---

## Decisions Made

1. **Property linking** - MANDATORY for offers, references, agreements (not optional)
2. **Property matching** - Exact postcode + fuzzy address, auto-create if no match
3. **Landlord AML** - Warning only, don't block, but log override
4. **Audit logging** - Unified service that logs to BOTH property AND tenancy
5. **Tenancy visibility** - Hybrid: created early, shows in tab only when converted
6. **Multi-property** - One property per tenancy, HMO rooms are separate properties
7. **Deposit schemes** - Future API, tracking only for now
8. **Credit costs** - 0.25 credits for notices only, tenancy creation FREE

---

## Testing Checklist

### Foundation Tests
- [ ] Create offer → Property auto-created if new address
- [ ] Create offer → Property matched if existing address
- [ ] Create reference → Property required, linked automatically
- [ ] property_tenancies populated automatically
- [ ] Audit logs appear in BOTH property and tenancy tabs

### Flow Tests
- [ ] Convert reference to tenancy → All data pre-filled
- [ ] Generate agreement from tenancy → Correct merge
- [ ] Compliance warning shown if certificates expired
- [ ] Send for signing → E-sign workflow works
- [ ] All signed → Tenancy status auto-updates
- [ ] Execute agreement → Compliance pack sent automatically
- [ ] Initial monies → Calculation correct, email sent
- [ ] Tenant confirms payment → Agent notified

### Cross-Linking UI Tests
- [ ] **Property Tab:**
  - [ ] Shows landlord name, email, phone inline
  - [ ] Click landlord → Opens landlord detail
  - [ ] Shows current tenants (from active tenancy) with contact info
  - [ ] Click tenant → Opens reference detail
  - [ ] Shows active tenancy summary (rent, dates)
  - [ ] Click "View Tenancy" → Opens tenancy detail
  - [ ] Shows tenancy history with links
  - [ ] Activity tab shows ALL events (property + tenancy)
- [ ] **Tenancy Tab:**
  - [ ] Shows property address with compliance summary
  - [ ] Click property → Opens property detail
  - [ ] Shows landlords with contact info and bank details
  - [ ] Click landlord → Opens landlord detail
  - [ ] Shows tenants with reference status
  - [ ] Click tenant → Opens reference detail
  - [ ] Documents tab shows property compliance docs (linked, not copied)
- [ ] **Landlord Tab:**
  - [ ] Shows all linked properties with current status
  - [ ] Click property → Opens property detail
  - [ ] Shows all tenancies across properties
  - [ ] Click tenancy → Opens tenancy detail
- [ ] **Reference Tab:**
  - [ ] Shows linked property with landlord name
  - [ ] Click property → Opens property detail
  - [ ] Shows linked tenancy if converted
  - [ ] Click tenancy → Opens tenancy detail
- [ ] **Offer Tab:**
  - [ ] Shows property with landlord contact info
  - [ ] Click property → Opens property detail
  - [ ] Click landlord → Opens landlord detail

### Status Badge Tests
- [ ] Property shows "In Tenancy" when active tenancy exists
- [ ] Property shows "Vacant" when no active tenancy
- [ ] Tenancy status updates in real-time on all linked views
- [ ] AML status shows correctly on landlord cards
- [ ] Compliance status shows correctly on property cards

### Management Feature Tests
- [ ] Generate Section 8 notice → Correct content, serve tracking works
- [ ] Generate Section 13 notice → Rent increase calculated correctly
- [ ] Generate Section 21 notice → Correct notice period
- [ ] Change rent due date → Pro-rata calculated, tenant notified
- [ ] Change tenant mid-tenancy:
  - [ ] Leaving person marked as ended
  - [ ] Reference request auto-sent to new person
  - [ ] New person added when reference complete
  - [ ] Deed of Variation generated if requested
- [ ] Additional charges on initial monies → Included in total, shown in breakdown

### Edge Cases
- [ ] Multi-tenant with different rent shares
- [ ] Multiple guarantors
- [ ] Multiple landlords with ownership %
- [ ] Expired compliance override flow
- [ ] Landlord AML not satisfactory warning
- [ ] Property with no landlord linked (warning shown)
- [ ] Viewing ended tenancy still shows historical data correctly
- [ ] Tenant change with guarantor → Guarantor also updated/removed
- [ ] Compliance pack button disabled until agreement executed
- [ ] Compliance pack includes signed agreement PDF

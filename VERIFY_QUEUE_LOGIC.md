# Verify Queue Logic Documentation

This document outlines all logic for how items appear in the verify queue, including blockers, status transitions, and key business rules.

---

## Table of Contents
1. [Overview](#overview)
2. [Status Lifecycle](#status-lifecycle)
3. [Blockers Preventing Verification](#blockers-preventing-verification)
4. [When Items Appear in Queue](#when-items-appear-in-queue)
5. [Urgency Calculation](#urgency-calculation)
6. [Key Database Fields](#key-database-fields)
7. [Backend Routes](#backend-routes)
8. [Frontend Components](#frontend-components)
9. [Potential Bug Areas](#potential-bug-areas)

---

## Overview

The verify queue shows tenant references that are ready for staff verification. Items appear when:
1. A `VERIFY` work item exists in `work_items` table
2. The reference passes all readiness checks
3. No active blockers exist

**Key Files:**
- `/backend/src/services/verificationReadinessService.ts` - All readiness logic
- `/backend/src/routes/verify.ts` - Queue endpoints
- `/backend/src/services/workQueueScheduler.ts` - Creates verify work items
- `/frontend/src/components/staff/portal/VerifyQueueTab.vue` - Display component

---

## Status Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                        REFERENCE STATUS FLOW                        │
└─────────────────────────────────────────────────────────────────────┘

  pending          → Tenant form NOT yet submitted
      ↓
  in_progress      → Tenant form submitted, collecting data
      ↓
  pending_verification → All data collected, ready for verify queue
      ↓
  ┌──────────────────┬────────────────────┐
  ↓                  ↓                    ↓
completed        rejected          action_required
(PASS)           (FAIL)            (needs tenant action)
```

**Work Item Status Flow:**
```
AVAILABLE → ASSIGNED → IN_PROGRESS → COMPLETED
                ↓
            RETURNED (if released back to queue)
```

---

## Blockers Preventing Verification

All blockers are checked in `verificationReadinessService.ts` → `isReadyForVerification()`

### 1. Tenant Form Not Submitted
**Condition:** `reference.status === 'pending'`
**Blocker Message:** "Tenant form not yet submitted"
**Resolution:** Wait for tenant to submit form

---

### 2. Identity Documents Missing
**Condition:** Missing `id_document_path` OR `selfie_path`
**Blocker Message:** "Missing identity documents: ID document, selfie"
**Resolution:** Tenant must upload ID document and selfie

**Code Location:** Lines 154-163
```typescript
if (!reference.id_document_path || !reference.selfie_path) {
  blockers.push({
    type: 'identity',
    message: 'Missing identity documents: ID document, selfie'
  });
}
```

---

### 3. Income Verification Incomplete
**Logic varies by employment type:**

| Employment Type | Required Evidence |
|-----------------|-------------------|
| **Employed** | Employer reference submitted OR at least 1 payslip uploaded |
| **Self-employed** | Accountant reference submitted OR tax return uploaded |
| **Benefits** | Benefit amount declared AND benefit evidence uploaded |
| **Student only** | Nothing required (auto-complete) |
| **None selected but amounts declared** | Need employer ref OR accountant ref OR payslips OR tax return |

**Blocker Messages:**
- "Income verification incomplete: waiting for employer reference"
- "Income verification incomplete: waiting for accountant reference"
- "Income verification incomplete: need payslips or employer reference"
- "Income verification incomplete: need tax return or accountant reference"
- "Income verification incomplete: need benefit evidence"

**Code Location:** Lines 135-283

---

### 4. Residential Verification Incomplete (Tenants Only)
**Note:** Guarantors skip residential verification entirely.

**Complete if ANY of these are true:**
1. `confirmed_residential_status` is set (e.g., LIVING_WITH_FAMILY, OWNER_OCCUPIER, VERIFIED)
2. Landlord reference has been submitted
3. Agent reference has been submitted
4. No landlord email was provided (auto-complete)

**Blocker if:**
- Landlord/agent email was provided but no reference received yet

**Blocker Message:** "Residential verification incomplete: waiting for landlord/agent reference"

**Code Location:** Lines 142-152, 287-313

---

### 5. Guarantor Form Not Submitted
**Condition:** `requires_guarantor === true` AND guarantor form not submitted

**Exception:** Students with ONLY student income AND guarantor contact details provided can bypass this blocker.

**Blocker Message:** "Guarantor form not yet submitted"

**Code Location:** Lines 96-133

---

### 6. Reference in Excluded Status
**Condition:** Reference status is one of: `completed`, `rejected`, `action_required`, `cancelled`

**Code Location:** `/backend/src/routes/verify.ts` lines 105-112

---

### 7. Cooldown Period Active
**Condition:** `work_item.cooldown_until > NOW()`

Items with active cooldown are hidden from queue until cooldown expires.

**Code Location:** `/backend/src/routes/verify.ts` line 99

---

### 8. Awaiting Documentation
**Condition:** `work_item.metadata.awaiting_documentation === true`

Item has been moved to "Awaiting Docs" queue.

---

## When Items Appear in Queue

An item appears in the verify queue when ALL conditions are met:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CONDITIONS TO APPEAR IN QUEUE                    │
└─────────────────────────────────────────────────────────────────────┘

✅ VERIFY work_item exists with status: AVAILABLE | ASSIGNED | IN_PROGRESS | RETURNED
✅ Reference status NOT in: completed, rejected, action_required, cancelled
✅ No active cooldown (cooldown_until is NULL or in past)
✅ Not awaiting documentation (metadata.awaiting_documentation != true)
✅ isReadyForVerification() returns isReady: true (all blockers resolved)
```

---

## Urgency Calculation

| Urgency | Hours in Queue | Visual |
|---------|----------------|--------|
| NORMAL | < 24 hours | Default |
| WARNING | 24-48 hours | Yellow indicator |
| URGENT | > 48 hours | Red indicator |

**Code Location:** `/backend/src/routes/verify.ts` lines 126-136

---

## Key Database Fields

### `tenant_references` Table
| Field | Type | Purpose |
|-------|------|---------|
| `status` | enum | Primary status: pending, in_progress, pending_verification, completed, rejected, cancelled, action_required |
| `submitted_at` | timestamp | When tenant submitted their form |
| `id_document_path` | string | Path to uploaded ID document |
| `selfie_path` | string | Path to uploaded selfie |
| `requires_guarantor` | boolean | Whether guarantor is required |
| `is_guarantor` | boolean | Whether this reference IS a guarantor |
| `guarantor_for_reference_id` | uuid | Links guarantor to tenant |
| `confirmed_residential_status` | enum | Staff-confirmed residential status |
| `confirmed_residential_at` | timestamp | When residential was confirmed |
| `confirmed_income_at` | timestamp | When income was confirmed |

### `work_items` Table
| Field | Type | Purpose |
|-------|------|---------|
| `work_type` | enum | VERIFY or CHASE |
| `status` | enum | AVAILABLE, ASSIGNED, IN_PROGRESS, RETURNED, COMPLETED |
| `reference_id` | uuid | Links to tenant_references |
| `assigned_to` | uuid | Staff user ID if claimed |
| `assigned_at` | timestamp | When claimed |
| `cooldown_until` | timestamp | When item becomes visible again |
| `metadata` | jsonb | Additional flags like awaiting_documentation |

### `verification_sections` Table
| Field | Type | Purpose |
|-------|------|---------|
| `reference_id` | uuid | Links to tenant_references |
| `section_type` | enum | IDENTITY, RESIDENTIAL, INCOME, AFFORDABILITY, etc. |
| `decision` | enum | NOT_REVIEWED, PASS, PASS_WITH_CONDITION, ACTION_REQUIRED, FAIL |
| `action_reason_code` | string | Reason code if ACTION_REQUIRED |
| `action_agent_note` | text | Staff note for action |

### `chase_dependencies` Table
| Field | Type | Purpose |
|-------|------|---------|
| `reference_id` | uuid | Links to tenant_references |
| `dependency_type` | enum | EMPLOYER_REF, LANDLORD_REF, etc. |
| `status` | enum | PENDING, CHASING, RECEIVED, EXHAUSTED, ACTION_REQUIRED |

---

## Backend Routes

### Verify Queue Endpoints (`/backend/src/routes/verify.ts`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/verify/queue` | GET | Fetch verify queue items |
| `/api/verify/person/:referenceId` | GET | Get full person data |
| `/api/verify/person/:referenceId/sections` | GET | Get verification sections |
| `/api/verify/person/:referenceId/sections/initialize` | POST | Initialize sections |
| `/api/verify/person/:referenceId/progress` | GET | Get verification progress |
| `/api/verify/sections/:sectionId/pass` | POST | Mark section PASS |
| `/api/verify/sections/:sectionId/pass-with-condition` | POST | Mark section PASS_WITH_CONDITION |
| `/api/verify/sections/:sectionId/action-required` | POST | Mark section ACTION_REQUIRED |
| `/api/verify/sections/:sectionId/fail` | POST | Mark section FAIL |
| `/api/verify/sections/:sectionId/reset` | POST | Reset section |
| `/api/verify/person/:referenceId/finalize` | POST | Finalize verification |
| `/api/verify/confirm-income/:referenceId` | POST | Confirm income |
| `/api/verify/confirm-residential/:referenceId` | POST | Confirm residential status |
| `/api/verify/evidence/:referenceId` | GET | Get all evidence files |

### Work Queue Endpoints (`/backend/src/routes/work-queue.ts`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/work-queue` | GET | Get filtered work items |
| `/api/work-queue/:id/claim` | POST | Assign work item to staff |
| `/api/work-queue/:id/push-to-verify` | POST | Push CHASE item to VERIFY |
| `/api/work-queue/:id/verify-now` | POST | Start verification immediately |

---

## Frontend Components

### VerifyQueueTab.vue
**Location:** `/frontend/src/components/staff/portal/VerifyQueueTab.vue`

**Displays:** Urgency, Person, Role, Property, Company, Age, Status, Assigned To

**Actions:**
- Pick Up (if AVAILABLE) - Claims item for current user
- Open (if assigned to current user) - Opens verification view
- Release - Returns item to queue

### StaffWorkQueue.vue
**Location:** `/frontend/src/views/StaffWorkQueue.vue`

Main work queue page with tabs: VERIFY, CHASE, AWAITING_DOCS, MY_CASES

### TypeScript Types
**Location:** `/frontend/src/types/staff.ts`

```typescript
interface VerifyQueueItem {
  id: string                    // work_item.id
  referenceId: string           // work_item.reference_id
  workType: 'VERIFY'
  status: 'AVAILABLE' | 'ASSIGNED' | 'IN_PROGRESS' | 'RETURNED'
  priority: number
  urgency: 'NORMAL' | 'WARNING' | 'URGENT'
  urgencyReason?: string
  hoursInQueue: number
  createdAt: string
  assignedTo?: string
  assignedAt?: string
  assignedStaffName?: string
  person: { name, email, role }
  property: { address }
  company: { name }
}
```

---

## Potential Bug Areas

### Area 1: Race Conditions in Work Item Creation
**Risk:** `syncVerifyQueue()` might create duplicate work items if run concurrently
**Check:** Does the scheduler have proper locking/deduplication?

### Area 2: Stale Readiness Checks
**Risk:** Readiness is checked when fetching queue, not when work item was created
**Question:** Could a reference become "not ready" after work item exists?

### Area 3: Guarantor Logic Edge Cases
**Risk:** Student income bypass for guarantor requirement
**Question:** Is the student-only income check correct? What if student has part-time job?

### Area 4: Residential Status for Guarantors
**Risk:** Guarantors skip residential verification entirely
**Question:** Is this intentional? Should guarantors have any residential check?

### Area 5: Reference Status Transition
**Risk:** Items might get stuck if status doesn't transition properly
**Check:** What triggers `in_progress` → `pending_verification` transition?

### Area 6: Cooldown Edge Cases
**Risk:** Items might be hidden indefinitely if cooldown is set incorrectly
**Check:** How is cooldown cleared? Is there a max duration?

### Area 7: Awaiting Documentation Flag
**Risk:** Flag might not be cleared when documents are uploaded
**Check:** What triggers clearing of `metadata.awaiting_documentation`?

### Area 8: Chase Dependencies vs Readiness
**Risk:** Chase dependencies might not sync with readiness blockers
**Question:** When a chase dependency gets RECEIVED, does readiness update automatically?

---

## Checklist for Bug Investigation

- [ ] Verify work items aren't created for references already in verify queue
- [ ] Check that readiness recalculates when new evidence is uploaded
- [ ] Confirm guarantor bypass logic is working as intended
- [ ] Test status transitions from in_progress → pending_verification
- [ ] Verify cooldown handling and expiration
- [ ] Check awaiting_documentation flag lifecycle
- [ ] Test chase dependency → readiness synchronization
- [ ] Verify excluded statuses filter works correctly

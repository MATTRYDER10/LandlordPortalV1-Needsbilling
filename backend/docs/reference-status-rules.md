# Reference Status Rules

This document defines the rules for determining the status of references on the /references page.

---

## Person Status Rules (Tenant & Guarantor)

### NOT_STARTED
- Form sent but not filled out (`submitted_at` is null)

### IN_PROGRESS
- Form filled out (`submitted_at` is set)
- BUT waiting on one or more of:
  - **Identity**: ID document OR selfie not uploaded
  - **Income** (if applicable):
    - Employed: No payslips AND no employer reference submitted (if employer email provided)
    - Self-employed: No tax return AND no accountant reference submitted (if accountant email provided)
    - Benefits: No benefits evidence uploaded
    - Student + other income: Waiting on the other income type's evidence
  - **Residential** (tenants only, NOT guarantors):
    - Landlord/agent email provided but reference not submitted
    - (If "living with family" or similar selected → auto-complete)

### AWAITING_VERIFICATION
- Form filled out
- Identity complete (ID + selfie uploaded)
- Income complete (one of):
  - Student only → auto-complete
  - Employed → payslips uploaded OR employer reference submitted
  - Self-employed → tax return uploaded OR accountant reference submitted
  - Benefits → evidence uploaded + amount declared
  - No income → auto-complete
- Residential complete (tenants only):
  - "Living with family" / similar selected, OR
  - Landlord/agent reference submitted, OR
  - No landlord/agent email was provided

### ACTION_REQUIRED
- Set manually by staff in Verify OR by auto-chase system
- Sections pushed back requiring more evidence

### VERIFIED_PASS
- Set by staff in Verify queue
- Reference has passed verification

### VERIFIED_CONDITIONAL
- Set by staff in Verify queue
- Reference has passed with conditions

### VERIFIED_FAIL
- Set by staff in Verify queue
- Reference has failed overall

---

## Tenancy Status Rules (Overall Card)

The tenancy status follows the "last person" rule - it only moves to the next status IF all people have completed that stage.

| Tenancy Status | Rule |
|----------------|------|
| **SENT** | All people are NOT_STARTED |
| **IN_PROGRESS** | Any person is IN_PROGRESS or NOT_STARTED (but not all NOT_STARTED) |
| **AWAITING_VERIFICATION** | All people are AWAITING_VERIFICATION or higher (verified) |
| **ACTION_REQUIRED** | Any person has ACTION_REQUIRED |
| **COMPLETED** | All people are VERIFIED_PASS or VERIFIED_CONDITIONAL |
| **REJECTED** | Any person is VERIFIED_FAIL |

---

## Key Differences: Tenant vs Guarantor

| Requirement | Tenant | Guarantor |
|-------------|--------|-----------|
| Identity (ID + selfie) | Required | Required |
| Income verification | Required | Required |
| Residential verification | Required | **NOT required** |

---

## Income Verification Details

| Income Type | Evidence Options |
|-------------|------------------|
| **Employed** | Payslips uploaded OR employer reference submitted |
| **Self-employed** | Tax return uploaded OR accountant reference submitted |
| **Benefits** | Evidence uploaded AND amount declared |
| **Student only** | Auto-complete (no evidence needed) |
| **Student + other income** | Evidence needed for the other income type |
| **No income declared** | Auto-complete |

---

## Residential Verification Details (Tenants Only)

| Situation | Status |
|-----------|--------|
| "Living with family" selected | Auto-complete |
| "Owner occupier" selected | Auto-complete |
| Landlord/agent email provided | Wait for reference submission |
| No landlord/agent email provided | Auto-complete |

---

## Reference Expectations

A reference is "expected" and must be waited for when:

| Reference Type | Expected When |
|----------------|---------------|
| Employer reference | Employer email was provided |
| Accountant reference | Accountant email was provided |
| Landlord reference | Landlord email was provided |
| Agent reference | Letting agent email was provided |

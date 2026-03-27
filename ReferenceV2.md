# Reference V2 - Complete System Redesign

## Executive Summary

The current referencing system has grown organically through 6+ phases and contains significant technical debt:
- **Dual status systems** (legacy `status` + new `verification_state`)
- **Redundant tracking** (chase_dependencies + verification_sections)
- **Overcomplicated evidence evaluation** (300+ lines of conditional logic)
- **Scattered guarantor logic** across multiple files
- **No section-by-section verification** (assessors see everything at once)
- **Poor offshore assessor UX** (requires training, not self-guiding)

### Core Problems Identified

| Problem | Impact | Current State |
|---------|--------|---------------|
| Dual status system | Code confusion, bugs | Both `status` and `verification_state` exist |
| Chase vs Sections | Redundant data | Two systems track similar info |
| Monolithic verification | Assessors overwhelmed | All 6 sections shown at once |
| No verbal reference capture | Manual workarounds | Assessors can't record phone calls |
| Complex evidence evaluation | Edge case bugs | 300+ lines of conditionals |
| PDF report outdated | Poor branding | Not matching new UI style |
| No performance metrics | Blind optimization | Can't see feature usage |

---

## V2 Architecture Overview

### New Statuses (Simplified - 7 Total)

```
SENT                      → Form sent to tenant, not started
COLLECTING_EVIDENCE       → Tenant filling form / uploading docs
ACTION_REQUIRED           → Agent/Tenant needs to fix something
ACCEPTED                  → Passed verification (all clear)
ACCEPTED_WITH_GUARANTOR   → Passed but guarantor required for affordability
ACCEPTED_ON_CONDITION     → Passed with noted conditions (free text field)
REJECTED                  → Failed verification
```

**Removed**: `pending`, `in_progress`, `pending_verification`, `completed`, `cancelled`, `WAITING_ON_REFERENCES`, `READY_FOR_REVIEW`, `IN_VERIFICATION`

**Key Changes**:
- No intermediate "ready for review" states - each SECTION has its own queue
- "ACCEPTED_WITH_CONDITION" renamed to "ACCEPTED_ON_CONDITION" for clarity
- Simple, clear progression that agents can easily understand

---

### Section-Based Verification Model

Instead of verifying entire references, assessors verify **individual sections**:

```
┌─────────────────────────────────────────────────────────────┐
│                    VERIFICATION QUEUES                       │
├─────────────────────────────────────────────────────────────┤
│  IDENTITY QUEUE    │ Section ready when: selfie + ID uploaded │
│  RTR QUEUE         │ Section ready when: RTR evidence present  │
│  INCOME QUEUE      │ Section ready when: income evidence OR    │
│                    │ employer ref returned                     │
│  RESIDENTIAL QUEUE │ Section ready when: landlord/agent ref    │
│                    │ returned OR status confirmed              │
│  CREDIT QUEUE      │ Section ready when: credit check complete │
│  AML QUEUE         │ Section ready when: AML check complete    │
│  FINAL REVIEW      │ ALL sections PASS → Final decision queue  │
└─────────────────────────────────────────────────────────────┘
```

### Section Statuses

Each section independently tracks:

```typescript
interface VerificationSection {
  id: string
  reference_id: string
  section_type: 'IDENTITY' | 'RTR' | 'INCOME' | 'RESIDENTIAL' | 'CREDIT' | 'AML'
  status: 'PENDING' | 'READY' | 'IN_PROGRESS' | 'COMPLETED'
  evidence_submitted_at: Date | null
  referee_submitted_at: Date | null  // For INCOME/RESIDENTIAL with external refs
  assessor_id: string | null
  started_at: Date | null
  completed_at: Date | null
  decision: 'PASS' | 'PASS_WITH_CONDITION' | 'FAIL' | null  // Set when COMPLETED
  condition_text: string | null
  assessor_notes: string | null  // Internal notes
  agent_notes: string | null     // Visible to agent
}
```

**Section Decision Options:**
- PASS - Section verified successfully
- PASS_WITH_CONDITION - Section verified with noted conditions
- FAIL - Section failed verification

**CRITICAL: Final Review Trigger Logic**
- A section is "complete" when it has ANY decision (PASS, PASS_WITH_CONDITION, or FAIL)
- Final Review is triggered when ALL sections have a decision - regardless of outcome
- The Final Review assessor sees all section outcomes and makes the overall reference decision
- This allows Final Review to see the full picture (e.g., one FAIL might still result in ACCEPTED_ON_CONDITION)

**Guarantor Sections:**
Guarantors only have 5 sections (NO residential reference):
- IDENTITY
- RTR
- INCOME
- CREDIT
- AML

### Workflow: Section-by-Section

```
1. Tenant submits form with ID + Selfie
   → IDENTITY section status = READY
   → Appears in IDENTITY QUEUE for assessors

2. Assessor picks up IDENTITY section
   → Section status = IN_PROGRESS
   → Assessor sees: ID photo, selfie, guided checklist
   → Assessor decides: PASS, PASS_WITH_CONDITION, or FAIL

3. Section marked COMPLETED with decision recorded
   → Move to next queue item
   → (Section outcome recorded but doesn't stop other sections)

4. Meanwhile, employer reference email sent
   → INCOME section status = PENDING (waiting on referee)
   → After 24h with no response → Moves to CHASE QUEUE

5. Employer submits form (or assessor does verbal reference)
   → INCOME section status = READY
   → Appears in INCOME QUEUE

6. Continue until ALL sections have decisions...
   → Even if some sections FAIL, process continues
   → Final Review sees the full picture

7. When ALL sections COMPLETED (have decisions):
   → Reference appears in FINAL REVIEW QUEUE
   → Senior assessor sees: All section results with outcomes
   → Makes FINAL decision: ACCEPTED / ACCEPTED_WITH_GUARANTOR / ACCEPTED_ON_CONDITION / REJECTED
   → Final report PDF generated
   → Agent + Tenant notified
```

**Key Point**: A section FAIL doesn't immediately reject the reference. All sections complete first, then Final Review makes the overall decision. A section FAIL might still result in ACCEPTED_ON_CONDITION if circumstances warrant.

---

## Chase System V2

### Chase Queue (Section-Based)

Chase items are created per-section when external dependency exists:

```typescript
interface ChaseItem {
  id: string
  reference_id: string
  section_type: 'INCOME' | 'RESIDENTIAL'  // Only sections with external refs
  referee_type: 'EMPLOYER' | 'LANDLORD' | 'AGENT' | 'ACCOUNTANT'
  referee_name: string
  referee_email: string
  referee_phone: string
  initial_sent_at: Date
  last_chased_at: Date | null
  chase_count: number
  status: 'WAITING' | 'CHASING' | 'RECEIVED' | 'VERBAL_OBTAINED'
  verbal_reference_id: string | null  // Links to verbal_references table
}
```

### Chase Rules (24-Hour Cycle)

```
INITIAL SEND
└─ After 24 hours with no response → Enters CHASE QUEUE

CHASE QUEUE WORKFLOW
└─ Assessor sees item, can:
   1. Resend email (auto-logged, resets 24hr timer)
   2. Send SMS reminder (auto-logged)
   3. Call referee (log call attempt with outcome)
   4. Record verbal reference (opens same form as online - see below)

CHASE EXIT CONDITIONS
└─ Item leaves queue when:
   - Referee submits online form, OR
   - Assessor records verbal reference, OR
   - Agent marks as "Unable to obtain" (requires reason)
```

### Verbal Reference = Same Form as Online

When assessor clicks "Record Verbal Reference":
1. Same form fields as the online referee form appear
2. Assessor fills in responses exactly as referee dictates
3. Additional fields: Referee phone, call date/time, assessor notes
4. On save: Section status → READY, appears in verification queue with "Verbal" badge
5. Verification process identical to online submissions

### Verbal Reference Capture

New feature: "Use Verbal Reference" button in chase queue:

```typescript
interface VerbalReference {
  id: string
  reference_id: string
  section_type: 'INCOME' | 'RESIDENTIAL'
  referee_type: 'EMPLOYER' | 'LANDLORD' | 'AGENT' | 'ACCOUNTANT'

  // Referee details
  referee_name: string
  referee_position: string
  referee_phone: string
  call_datetime: Date

  // Form responses (same fields as online form)
  responses: Record<string, any>  // JSON matching referee form fields

  // Assessor tracking
  recorded_by: string  // assessor user_id
  recorded_at: Date

  // Verification
  verified: boolean
  verified_by: string | null
  verified_at: Date | null
}
```

When verbal reference recorded:
1. Chase item status → `VERBAL_OBTAINED`
2. Section status → `READY`
3. Section appears in relevant QUEUE with "Verbal" badge
4. Assessor verifies verbal reference same as online form

---

## Assessor Dashboard V2

### Queue Dashboard

```
┌──────────────────────────────────────────────────────────────┐
│  ASSESSOR DASHBOARD                        [John Smith] ▼    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  IDENTITY   │  │    RTR      │  │   INCOME    │          │
│  │     12      │  │      8      │  │     15      │          │
│  │   pending   │  │   pending   │  │   pending   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ RESIDENTIAL │  │   CREDIT    │  │    AML      │          │
│  │      5      │  │      3      │  │      2      │          │
│  │   pending   │  │   pending   │  │   pending   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐                           │
│  │FINAL REVIEW │  │   CHASE     │                           │
│  │      4      │  │      7      │                           │
│  │   pending   │  │  overdue    │                           │
│  └─────────────┘  └─────────────┘                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Section Verification View (Guided)

When assessor clicks a queue, they see ONE item at a time with guided steps:

```
┌──────────────────────────────────────────────────────────────┐
│  IDENTITY VERIFICATION                    [Back to Queue]    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Applicant: John Smith                                       │
│  Property: 124 Ellan Hay Road, Bristol BS32 0HB              │
│  Agent: R&G Property Cardiff                                 │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  STEP 1: Review ID Document                            │ │
│  │  ─────────────────────────────────────────────────────│ │
│  │  [ID PHOTO DISPLAYED HERE]                             │ │
│  │                                                        │ │
│  │  ☐ Document is clear and readable                     │ │
│  │  ☐ Name matches: John Smith                           │ │
│  │  ☐ Document is valid (not expired)                    │ │
│  │  ☐ Document type: [Passport ▼]                        │ │
│  │                                                        │ │
│  │  [PASS] [FAIL - Select Reason ▼]                      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  STEP 2: Compare Selfie                                │ │
│  │  ─────────────────────────────────────────────────────│ │
│  │  [ID PHOTO]              [SELFIE PHOTO]                │ │
│  │                                                        │ │
│  │  ☐ Same person in both photos                         │ │
│  │  ☐ Selfie is recent (matches ID age)                  │ │
│  │  ☐ No signs of tampering                              │ │
│  │                                                        │ │
│  │  [MATCH] [NO MATCH - Select Reason ▼]                 │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  DECISION                                              │ │
│  │  ─────────────────────────────────────────────────────│ │
│  │  [✓ PASS]  [ ] FAIL  [ ] ACTION REQUIRED              │ │
│  │                                                        │ │
│  │  Notes (optional): ___________________________         │ │
│  │                                                        │ │
│  │  [SUBMIT DECISION]                                     │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Guided Prompts by Section

**IDENTITY Section:**
1. Review ID document (passport/driving license/ID card)
2. Check document validity and expiry
3. Compare selfie to ID photo
4. Verify name matches application

**RTR Section:**
1. Check citizenship status
2. If share code: Link to GOV.UK checker, verify code
3. If passport: Check British passport validity
4. If visa: Check visa type and expiry

**INCOME Section:**
1. Review income evidence (payslips/bank statements/employer ref)
2. Calculate annual income
3. Compare to rent share (affordability check)
4. If employer ref: Review employment details

**RESIDENTIAL Section:**
1. Review previous tenancy evidence
2. Check landlord/agent reference responses
3. Verify tenancy dates
4. Check rent payment history

**CREDIT Section:**
1. Review credit check results (Creditsafe)
2. Check for CCJs, bankruptcies, IVAs
3. Review credit score
4. Flag any concerns

**AML Section:**
1. Review sanctions screening results
2. Check PEP status
3. Verify no adverse findings

**FINAL REVIEW (Senior Assessors Only):**
1. See all section results at a glance (PASS / PASS_WITH_CONDITION / FAIL for each)
2. Review any conditions from sections
3. Check rent affordability overall
4. For multi-tenant groups: Review all tenants + guarantors together as a GROUP
5. Make final decision: ACCEPTED / ACCEPTED_WITH_GUARANTOR / ACCEPTED_ON_CONDITION / REJECTED
6. Generate PDF report with decision

**Access Control**: Only users with "Final Review Assessor" role can access this queue

**Final Review Trigger Rules:**
- SINGLE TENANT: Appears in Final Review when all 6 sections have decisions
- SINGLE TENANT + GUARANTOR: Appears when tenant's 6 sections + guarantor's 5 sections all have decisions
- MULTI-TENANT GROUP: Appears when EVERY tenant AND every guarantor has ALL their sections completed
- Section outcome doesn't matter (PASS/FAIL/CONDITION) - just needs a decision

---

## Rent Share & Affordability

### Rent Share Assignment

Each tenant in a multi-tenant reference has:

```typescript
interface TenantRentShare {
  reference_id: string
  rent_share: number        // Amount this tenant pays (not percentage)
  total_property_rent: number
  affordability_ratio: number  // Calculated: annual_income / (rent_share * 12)
}
```

**Affordability Calculation:**
- **Tenants**: Annual income ÷ 30 must be ≥ monthly rent share
  - Example: £500/month rent share requires £15,000 annual income (£15,000 ÷ 30 = £500)
  - Formula: annual_income / 30 >= rent_share
- **Guarantors**: Annual income ÷ 32 must be ≥ monthly rent share (stricter)
  - Example: £500/month rent share requires £16,000 annual income (£16,000 ÷ 32 = £500)
  - Formula: annual_income / 32 >= rent_share
- If tenant fails affordability: Final decision = "ACCEPTED_WITH_GUARANTOR"
- Guarantor must pass their own affordability check to cover tenant's shortfall

### Agent Visibility

Agent can edit rent share per tenant:
- Default: Equal split (total_rent / num_tenants)
- Can adjust individual amounts
- System recalculates affordability per tenant in real-time
- Clear display showing: tenant income, rent share, pass/fail indicator

---

## Evidence Visibility

### Agent Evidence View

Agents can see ALL uploaded evidence at all times:

```
┌──────────────────────────────────────────────────────────────┐
│  EVIDENCE - John Smith                                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  IDENTITY                                    [VERIFIED ✓]    │
│  ├─ Passport.jpg                            [View] [Download]│
│  └─ Selfie.jpg                              [View] [Download]│
│                                                              │
│  RIGHT TO RENT                              [PENDING]        │
│  └─ Share code: AB123456                    Expires: 2024-12 │
│                                                              │
│  INCOME                                     [IN PROGRESS]    │
│  ├─ Payslip_Jan.pdf                         [View] [Download]│
│  ├─ Payslip_Feb.pdf                         [View] [Download]│
│  └─ Employer Reference                      [Awaiting]       │
│     ├─ Contact: hr@company.com                               │
│     ├─ Sent: 2 days ago                                      │
│     └─ Last chased: 1 day ago                                │
│                                                              │
│  RESIDENTIAL                                [WAITING]        │
│  └─ Landlord Reference                      [Awaiting]       │
│     ├─ Contact: landlord@email.com                           │
│     └─ Sent: 3 days ago                                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Staff Roles & Permissions

### Role Definitions

```
ADMIN               → Full system access, company management, billing, staff management
ASSESSOR            → Access to section queues (Identity, RTR, Income, Residential, Credit, AML)
                      Can verify sections, record verbal references, chase referees
                      CANNOT access Final Review queue
FINAL_REVIEW        → All Assessor permissions PLUS access to Final Review queue
                      Can make final decisions on references
SUPERVISOR          → All Final Review permissions PLUS performance dashboards
                      Can reassign work, view assessor metrics, override decisions
```

### Philippine Team Considerations

- UK Time Clock: Display current UK time prominently in assessor dashboard
- Strict Help Text: Clear, detailed guidance on every form field
- Example: "Enter the monthly gross salary BEFORE tax deductions. If weekly, multiply by 4.33"
- Visual indicators showing UK business hours (when referees most likely to respond)

---

## Admin Dashboard (New)

### Company Onboarding Flow

```
NEW COMPANY ONBOARDING
1. Admin creates company record
2. Sets billing tier / custom deal
3. Adds primary admin user
4. Company admin receives invite email
5. Company admin sets up their users
6. Feature flag enables V2 references for this company
```

### Company Management Dashboard

```
┌──────────────────────────────────────────────────────────────┐
│  ADMIN DASHBOARD                                             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  COMPANIES                                    [+ Add Company]│
│  ─────────────────────────────────────────────────────────── │
│  │ Company        │ Plan    │ Credits │ Revenue │ Status   │ │
│  │────────────────│─────────│─────────│─────────│──────────│ │
│  │ R&G Property   │ Custom  │ 450     │ £2,340  │ Active   │ │
│  │ Cardiff Lets   │ Pro     │ 120     │ £890    │ Active   │ │
│  │ Bristol Homes  │ Starter │ 25      │ £150    │ Trial    │ │
│  └────────────────────────────────────────────────────────── │
│                                                              │
│  Click company row to see: users, branches, billing history, │
│  usage stats, feature flags, support tickets                 │
│                                                              │
│  STAFF USERS (PropertyGoose Team)             [+ Add Staff]  │
│  ─────────────────────────────────────────────────────────── │
│  │ Name          │ Role         │ Completed │ Avg Time │    │ │
│  │───────────────│──────────────│───────────│──────────│────│ │
│  │ Craig         │ Final Review │ 234       │ 6.1 min  │    │ │
│  │ Sarah Jones   │ Assessor     │ 145       │ 4.2 min  │    │ │
│  │ Mike Brown    │ Assessor     │ 89        │ 5.1 min  │    │ │
│  │ Admin User    │ Admin        │ -         │ -        │    │ │
│  └────────────────────────────────────────────────────────── │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Feature Usage Analytics

```
┌──────────────────────────────────────────────────────────────┐
│  FEATURE USAGE (Last 30 Days)                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  REFERENCES                                                  │
│  ├─ Created: 1,245                                           │
│  ├─ Completed: 1,102 (88.5%)                                 │
│  ├─ Rejected: 89 (7.1%)                                      │
│  └─ Avg completion time: 3.2 days                            │
│                                                              │
│  TENANCIES                                                   │
│  ├─ Created: 892                                             │
│  ├─ Active: 756                                              │
│  └─ Converted from refs: 834 (93.5%)                         │
│                                                              │
│  AGREEMENTS                                                  │
│  ├─ Generated: 654                                           │
│  ├─ Signed: 612 (93.6%)                                      │
│  └─ Avg signing time: 1.4 days                               │
│                                                              │
│  SECTION PERFORMANCE                                         │
│  ├─ Identity: 4,980 verified (avg 2.1 min)                   │
│  ├─ RTR: 4,890 verified (avg 1.8 min)                        │
│  ├─ Income: 4,756 verified (avg 5.4 min)                     │
│  ├─ Residential: 4,234 verified (avg 4.2 min)                │
│  ├─ Credit: 4,980 auto-checked                               │
│  └─ AML: 4,980 auto-checked                                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Revenue & Billing

```
┌──────────────────────────────────────────────────────────────┐
│  BILLING MANAGEMENT                                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  PRICING TIERS                                [Edit Tiers]   │
│  ├─ Starter: £15/ref (1-50 refs/month)                       │
│  ├─ Pro: £12/ref (51-200 refs/month)                         │
│  ├─ Enterprise: £9/ref (201+ refs/month)                     │
│  └─ Custom: Per-company negotiated rates                     │
│                                                              │
│  CUSTOM DEALS                                 [+ New Deal]   │
│  ─────────────────────────────────────────────────────────── │
│  │ Company        │ Rate    │ Min Vol │ Contract │ Status   │ │
│  │────────────────│─────────│─────────│──────────│──────────│ │
│  │ R&G Property   │ £8/ref  │ 100/mo  │ 12 mo    │ Active   │ │
│  │ Cardiff Lets   │ £10/ref │ 50/mo   │ 6 mo     │ Active   │ │
│  └────────────────────────────────────────────────────────── │
│                                                              │
│  STRIPE INTEGRATION                                          │
│  ├─ Monthly invoices: Auto-generated on 1st                  │
│  ├─ Payment tracking: Synced with Stripe                     │
│  └─ Credit allocation: Auto on payment                       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## PDF Report V2 (Modern Design)

### Design Requirements

- Clean, modern layout matching new UI
- **Dual Branding**: Agent company logo at top + PropertyGoose "Verified by" badge at bottom
- Section-by-section results with visual indicators (progress bars, checkmarks)
- Clear PASS/FAIL/CONDITION badges with color coding
- QR code for verification (links to online verification page)
- Mobile-friendly viewing (responsive width)
- Professional, clean aesthetic - suitable for landlords to review

### Report Structure

```
┌──────────────────────────────────────────────────────────────┐
│  [PropertyGoose Logo]              Reference Report          │
│                                    Ref: PG-2024-001234       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  APPLICANT DETAILS                                           │
│  ────────────────                                            │
│  Name: John Smith                                            │
│  DOB: 15/03/1990                                             │
│  Email: john.smith@email.com                                 │
│  Phone: 07123 456789                                         │
│                                                              │
│  PROPERTY                                                    │
│  ────────                                                    │
│  124 Ellan Hay Road                                          │
│  Bradley Stoke, Bristol BS32 0HB                             │
│  Monthly Rent: £1,200 (Share: £600)                          │
│  Move-in Date: 1st April 2024                                │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  VERIFICATION RESULTS                                        │
│  ────────────────────                                        │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ IDENTITY           │ ████████████████████ │ PASSED ✓   ││
│  │ Passport verified  │                      │            ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ RIGHT TO RENT      │ ████████████████████ │ PASSED ✓   ││
│  │ British Citizen    │                      │            ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ INCOME             │ ████████████████████ │ PASSED ✓   ││
│  │ Annual: £42,000    │ Affordability: 5.8x  │            ││
│  │ Employer: ABC Ltd  │ Verified by ref      │            ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ RESIDENTIAL        │ ████████████████████ │ PASSED ✓   ││
│  │ Previous: 2 years  │ Landlord ref: Good   │            ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ CREDIT CHECK       │ ████████████████████ │ PASSED ✓   ││
│  │ Score: 720         │ No adverse findings  │            ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ AML SCREENING      │ ████████████████████ │ PASSED ✓   ││
│  │ No sanctions match │ No PEP flags         │            ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ╔════════════════════════════════════════════════════════╗ │
│  ║                                                        ║ │
│  ║              REFERENCE DECISION                        ║ │
│  ║                                                        ║ │
│  ║                  ✓ ACCEPTED                            ║ │
│  ║                                                        ║ │
│  ║   This applicant has passed all verification checks    ║ │
│  ║   and is recommended for tenancy.                      ║ │
│  ║                                                        ║ │
│  ╚════════════════════════════════════════════════════════╝ │
│                                                              │
│  Verified by: PropertyGoose Ltd                              │
│  Date: 15th March 2024                                       │
│  Report ID: RPT-2024-001234                                  │
│                                                              │
│  [QR Code]  Scan to verify this report                       │
│             propertygoose.co.uk/verify/RPT-2024-001234       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Search Functionality

### Global Search

Search ALL references regardless of current tab:

```typescript
interface SearchParams {
  query: string           // Searches: name, email, phone, property address
  filters?: {
    status?: string[]     // Filter by status
    date_from?: Date
    date_to?: Date
    company_id?: string   // For admin filtering
  }
  sort_by?: 'created_at' | 'updated_at' | 'name' | 'status'
  sort_order?: 'asc' | 'desc'
}
```

### Search Results

Results show:
- Applicant name
- Property address (partial)
- Current status
- Days since created
- Quick actions (View, Chase)

---

## Database Schema Changes

### New Tables

```sql
-- Verbal references captured by assessors
CREATE TABLE verbal_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id UUID NOT NULL REFERENCES tenant_references(id),
  section_type TEXT NOT NULL,  -- 'INCOME' or 'RESIDENTIAL'
  referee_type TEXT NOT NULL,  -- 'EMPLOYER', 'LANDLORD', etc.

  -- Referee details
  referee_name TEXT NOT NULL,
  referee_position TEXT,
  referee_phone TEXT NOT NULL,
  call_datetime TIMESTAMPTZ NOT NULL,

  -- Form responses (JSON matching referee form fields)
  responses JSONB NOT NULL,

  -- Tracking
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feature usage analytics
CREATE TABLE feature_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT NOT NULL,  -- 'reference_create', 'tenancy_convert', etc.
  company_id UUID REFERENCES companies(id),
  user_id UUID REFERENCES auth.users(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom billing deals
CREATE TABLE billing_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  rate_per_reference DECIMAL(10,2) NOT NULL,
  minimum_volume INTEGER,
  contract_months INTEGER,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Modified Tables

```sql
-- Add to verification_sections
ALTER TABLE verification_sections
ADD COLUMN queue_entered_at TIMESTAMPTZ,  -- When section became READY
ADD COLUMN assessor_id UUID REFERENCES auth.users(id),
ADD COLUMN started_at TIMESTAMPTZ,
ADD COLUMN completed_at TIMESTAMPTZ;

-- Add to tenant_references
ALTER TABLE tenant_references
ADD COLUMN rent_share DECIMAL(10,2),  -- Individual rent amount
ADD COLUMN affordability_ratio DECIMAL(5,2);  -- Calculated ratio

-- Simplify status field (deprecate verification_state)
-- Keep only: SENT, COLLECTING_EVIDENCE, ACTION_REQUIRED, ACCEPTED,
--            ACCEPTED_WITH_GUARANTOR, ACCEPTED_WITH_CONDITION, REJECTED
```

---

---

# IMPLEMENTATION SPRINTS

---

## SPRINT 1: V2 Database Schema & Core Services

**Duration**: 1-2 weeks
**Risk Level**: LOW (parallel system, no V1 disruption)
**Goal**: Build the V2 foundation alongside V1

---

### 1.1 Database Schema - New V2 Tables

**IMPORTANT**: V2 uses NEW tables. V1 tables remain untouched and continue working.

```sql
-- ============================================================================
-- SPRINT 1: NEW V2 TABLES (run in Supabase SQL editor)
-- ============================================================================

-- V2 References (simplified status, no dual status system)
CREATE TABLE tenant_references_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),

  -- Link to V1 if migrated (NULL for new V2 references)
  v1_reference_id UUID REFERENCES tenant_references(id),

  -- Group structure
  parent_reference_id UUID REFERENCES tenant_references_v2(id),
  is_group_parent BOOLEAN DEFAULT FALSE,

  -- Type
  is_guarantor BOOLEAN DEFAULT FALSE,
  guarantor_for_reference_id UUID REFERENCES tenant_references_v2(id),

  -- Status (SIMPLIFIED - single field, no dual system)
  status TEXT NOT NULL DEFAULT 'SENT' CHECK (status IN (
    'SENT',                      -- Form sent, not started
    'COLLECTING_EVIDENCE',       -- Tenant filling form
    'ACTION_REQUIRED',           -- Agent/tenant needs to fix something
    'ACCEPTED',                  -- Passed all verification
    'ACCEPTED_WITH_GUARANTOR',   -- Passed but needs guarantor
    'ACCEPTED_ON_CONDITION',     -- Passed with noted conditions
    'REJECTED'                   -- Failed verification
  )),

  -- Final decision details
  final_decision_notes TEXT,
  final_decision_by UUID REFERENCES staff_users(id),
  final_decision_at TIMESTAMPTZ,

  -- Property & Rent
  linked_property_id UUID REFERENCES properties(id),
  property_address_encrypted TEXT,
  property_city_encrypted TEXT,
  property_postcode_encrypted TEXT,
  monthly_rent DECIMAL(10,2),
  rent_share DECIMAL(10,2),  -- This tenant's share
  move_in_date DATE,
  term_years INTEGER DEFAULT 0,
  term_months INTEGER DEFAULT 0,
  bills_included BOOLEAN DEFAULT FALSE,

  -- Tenant details (encrypted)
  tenant_first_name_encrypted TEXT,
  tenant_last_name_encrypted TEXT,
  tenant_email_encrypted TEXT,
  tenant_phone_encrypted TEXT,
  tenant_dob_encrypted TEXT,

  -- Current address (encrypted)
  current_address_line1_encrypted TEXT,
  current_address_line2_encrypted TEXT,
  current_city_encrypted TEXT,
  current_postcode_encrypted TEXT,
  current_country TEXT DEFAULT 'United Kingdom',

  -- Referee details (encrypted)
  employer_ref_name_encrypted TEXT,
  employer_ref_email_encrypted TEXT,
  employer_ref_phone_encrypted TEXT,
  employer_ref_position_encrypted TEXT,

  previous_landlord_name_encrypted TEXT,
  previous_landlord_email_encrypted TEXT,
  previous_landlord_phone_encrypted TEXT,
  previous_landlord_type TEXT CHECK (previous_landlord_type IN ('landlord', 'agent', 'none')),

  accountant_name_encrypted TEXT,
  accountant_email_encrypted TEXT,
  accountant_phone_encrypted TEXT,

  -- Employment & Income
  employment_status TEXT,
  job_title_encrypted TEXT,
  employer_name_encrypted TEXT,
  annual_income DECIMAL(10,2),
  affordability_ratio DECIMAL(5,2),  -- Calculated: annual_income / (rent_share * 12)
  affordability_pass BOOLEAN,

  -- RTR
  citizenship_status TEXT,
  share_code TEXT,
  share_code_expiry DATE,

  -- Evidence flags (what has been submitted)
  id_uploaded BOOLEAN DEFAULT FALSE,
  selfie_uploaded BOOLEAN DEFAULT FALSE,
  proof_of_income_uploaded BOOLEAN DEFAULT FALSE,

  -- Tracking
  form_token_hash TEXT UNIQUE,
  form_started_at TIMESTAMPTZ,
  form_submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Conversion tracking
  converted_to_tenancy_id UUID REFERENCES tenancies(id),
  converted_at TIMESTAMPTZ
);

-- V2 Verification Sections (enhanced for queue-based workflow)
CREATE TABLE reference_sections_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id UUID NOT NULL REFERENCES tenant_references_v2(id) ON DELETE CASCADE,

  -- Section identification
  section_type TEXT NOT NULL CHECK (section_type IN (
    'IDENTITY', 'RTR', 'INCOME', 'RESIDENTIAL', 'CREDIT', 'AML'
  )),
  section_order INTEGER NOT NULL,

  -- Queue status (when section is ready for assessor)
  queue_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (queue_status IN (
    'PENDING',       -- Waiting for evidence/referee
    'READY',         -- Ready for assessor to review
    'IN_PROGRESS',   -- Assessor currently reviewing
    'COMPLETED'      -- Decision made
  )),

  -- Assessor assignment
  assigned_to UUID REFERENCES staff_users(id),
  assigned_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Decision (only set when COMPLETED)
  decision TEXT CHECK (decision IN ('PASS', 'PASS_WITH_CONDITION', 'FAIL')),
  condition_text TEXT,  -- If PASS_WITH_CONDITION
  fail_reason TEXT,     -- If FAIL
  assessor_notes TEXT,  -- Internal notes

  -- Evidence tracking
  evidence_submitted_at TIMESTAMPTZ,
  referee_submitted_at TIMESTAMPTZ,  -- For external refs (employer/landlord)

  -- Queue timing
  queue_entered_at TIMESTAMPTZ,  -- When became READY

  -- For external reference sections
  referee_type TEXT,  -- 'EMPLOYER', 'LANDLORD', 'AGENT', 'ACCOUNTANT'
  referee_email_encrypted TEXT,
  referee_phone_encrypted TEXT,
  referee_name_encrypted TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(reference_id, section_type)
);

-- V2 Chase Items (section-based, 24-hour cycle)
CREATE TABLE chase_items_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id UUID NOT NULL REFERENCES tenant_references_v2(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES reference_sections_v2(id) ON DELETE CASCADE,

  -- Referee details
  referee_type TEXT NOT NULL CHECK (referee_type IN ('EMPLOYER', 'LANDLORD', 'AGENT', 'ACCOUNTANT')),
  referee_name_encrypted TEXT,
  referee_email_encrypted TEXT,
  referee_phone_encrypted TEXT,

  -- Chase status
  status TEXT NOT NULL DEFAULT 'WAITING' CHECK (status IN (
    'WAITING',          -- Initial request sent, waiting for response
    'IN_CHASE_QUEUE',   -- 24hrs passed, ready for chase
    'RECEIVED',         -- Referee submitted online
    'VERBAL_OBTAINED',  -- Verbal reference recorded
    'UNABLE_TO_OBTAIN'  -- Agent marked as unable
  )),

  -- Timing
  initial_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_chased_at TIMESTAMPTZ,
  chase_queue_entered_at TIMESTAMPTZ,  -- When 24hrs passed
  resolved_at TIMESTAMPTZ,

  -- Chase tracking
  chase_count INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  sms_sent INTEGER DEFAULT 0,
  calls_made INTEGER DEFAULT 0,

  -- Resolution
  resolution_type TEXT,  -- 'ONLINE_SUBMISSION', 'VERBAL', 'UNABLE'
  unable_reason TEXT,    -- If UNABLE_TO_OBTAIN

  -- Links
  verbal_reference_id UUID,  -- References verbal_references_v2

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- V2 Verbal References (captured by assessor over phone)
CREATE TABLE verbal_references_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id UUID NOT NULL REFERENCES tenant_references_v2(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES reference_sections_v2(id) ON DELETE CASCADE,
  chase_item_id UUID REFERENCES chase_items_v2(id),

  -- Referee details
  referee_type TEXT NOT NULL CHECK (referee_type IN ('EMPLOYER', 'LANDLORD', 'AGENT', 'ACCOUNTANT')),
  referee_name TEXT NOT NULL,
  referee_position TEXT,
  referee_phone TEXT NOT NULL,

  -- Call details
  call_datetime TIMESTAMPTZ NOT NULL,
  call_duration_minutes INTEGER,

  -- Form responses (JSON - same fields as online form)
  -- For EMPLOYER: employment_confirmed, job_title, salary, start_date, etc.
  -- For LANDLORD: tenancy_confirmed, rent_amount, rent_paid_on_time, would_recommend, etc.
  responses JSONB NOT NULL,

  -- Assessor tracking
  recorded_by UUID NOT NULL REFERENCES staff_users(id),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- V2 Work Items (enhanced for section-based queues)
CREATE TABLE work_items_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What this work item is for
  reference_id UUID NOT NULL REFERENCES tenant_references_v2(id) ON DELETE CASCADE,
  section_id UUID REFERENCES reference_sections_v2(id) ON DELETE CASCADE,  -- NULL for FINAL_REVIEW

  -- Work type
  work_type TEXT NOT NULL CHECK (work_type IN (
    'IDENTITY', 'RTR', 'INCOME', 'RESIDENTIAL', 'CREDIT', 'AML',
    'CHASE',         -- Chase queue item
    'FINAL_REVIEW'   -- Final review (all sections complete)
  )),

  -- Status
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN (
    'AVAILABLE',     -- Ready to be claimed
    'ASSIGNED',      -- Claimed by assessor
    'IN_PROGRESS',   -- Being worked on
    'COMPLETED',     -- Done
    'RETURNED'       -- Returned to queue
  )),

  -- Assignment
  assigned_to UUID REFERENCES staff_users(id),
  assigned_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Priority & Timing
  priority INTEGER DEFAULT 0,  -- Higher = more urgent
  age_hours DECIMAL(10,2),     -- Calculated for display

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_refs_v2_company ON tenant_references_v2(company_id);
CREATE INDEX idx_refs_v2_status ON tenant_references_v2(status);
CREATE INDEX idx_refs_v2_parent ON tenant_references_v2(parent_reference_id);
CREATE INDEX idx_sections_v2_reference ON reference_sections_v2(reference_id);
CREATE INDEX idx_sections_v2_queue ON reference_sections_v2(queue_status) WHERE queue_status = 'READY';
CREATE INDEX idx_chase_v2_status ON chase_items_v2(status) WHERE status = 'IN_CHASE_QUEUE';
CREATE INDEX idx_work_v2_type_status ON work_items_v2(work_type, status) WHERE status = 'AVAILABLE';

-- Enable RLS
ALTER TABLE tenant_references_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_sections_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE chase_items_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE verbal_references_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_items_v2 ENABLE ROW LEVEL SECURITY;

-- RLS policies (staff can see all, companies see their own)
CREATE POLICY "Staff can view all v2 references" ON tenant_references_v2 FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_users WHERE user_id = auth.uid()));

CREATE POLICY "Companies see own v2 references" ON tenant_references_v2 FOR ALL TO authenticated
  USING (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  ));
```

---

### 1.2 Backend Services - New V2 Services

**Location**: `/backend/src/services/`

**New Files to Create**:

```
/backend/src/services/v2/
  ├── referenceServiceV2.ts       # CRUD for tenant_references_v2
  ├── sectionServiceV2.ts         # Section queue management
  ├── chaseServiceV2.ts           # Chase queue (24hr cycle)
  ├── verbalReferenceService.ts   # Verbal reference capture
  ├── workQueueServiceV2.ts       # Work item management
  ├── finalReviewService.ts       # Final review logic
  └── affordabilityService.ts     # Affordability calculations
```

**Key Implementation Details**:

#### referenceServiceV2.ts
```typescript
// Key functions:

// Create V2 reference (called when company has V2 feature flag)
export async function createReferenceV2(data: CreateReferenceInput): Promise<ReferenceV2>

// Initialize all sections when reference created
export async function initializeSectionsV2(referenceId: string, isGuarantor: boolean): Promise<void>
// - Creates 6 sections for tenants: IDENTITY, RTR, INCOME, RESIDENTIAL, CREDIT, AML
// - Creates 5 sections for guarantors: IDENTITY, RTR, INCOME, CREDIT, AML (NO RESIDENTIAL)
// - All sections start as queue_status = 'PENDING'

// Update reference status (single status field, no dual system)
export async function updateReferenceStatusV2(referenceId: string, status: V2Status): Promise<void>

// Check if all sections complete (for Final Review trigger)
export async function areAllSectionsComplete(referenceId: string): Promise<boolean>
// - Returns true if ALL sections have decision (PASS, PASS_WITH_CONDITION, or FAIL)
// - Outcome doesn't matter - just needs a decision

// For multi-tenant: check if entire group ready for Final Review
export async function isGroupReadyForFinalReview(parentReferenceId: string): Promise<boolean>
// - Get all children (tenants + guarantors)
// - Check if ALL children have ALL sections complete
// - If yes, create single FINAL_REVIEW work item for the group
```

#### sectionServiceV2.ts
```typescript
// Key functions:

// Mark section as ready for queue (called when evidence uploaded or referee responds)
export async function markSectionReady(sectionId: string): Promise<void>
// - Set queue_status = 'READY'
// - Set queue_entered_at = NOW()
// - Create work_items_v2 entry

// Claim section for review (assessor clicks to start)
export async function claimSection(sectionId: string, staffUserId: string): Promise<void>
// - Set queue_status = 'IN_PROGRESS'
// - Set assigned_to = staffUserId
// - Set started_at = NOW()
// - Update work_items_v2 status

// Submit section decision
export async function submitSectionDecision(
  sectionId: string,
  decision: 'PASS' | 'PASS_WITH_CONDITION' | 'FAIL',
  notes?: string,
  conditionText?: string,
  failReason?: string
): Promise<void>
// - Set queue_status = 'COMPLETED'
// - Set decision, condition_text or fail_reason
// - Set completed_at = NOW()
// - Update work_items_v2 status
// - Check if all sections complete → trigger Final Review if yes

// Get queue counts for dashboard
export async function getQueueCounts(): Promise<QueueCounts>
// - Count READY sections grouped by section_type
// - Return { IDENTITY: 12, RTR: 8, INCOME: 15, ... }
```

#### chaseServiceV2.ts
```typescript
// Key functions:

// Create chase item when external reference sent
export async function createChaseItem(
  referenceId: string,
  sectionId: string,
  refereeType: 'EMPLOYER' | 'LANDLORD' | 'AGENT' | 'ACCOUNTANT',
  refereeDetails: RefereeDetails
): Promise<ChaseItem>

// Scheduled job: move items to chase queue after 24hrs
export async function processChaseQueue(): Promise<void>
// - Find chase_items_v2 WHERE status = 'WAITING'
//   AND initial_sent_at < NOW() - INTERVAL '24 hours'
// - Update status = 'IN_CHASE_QUEUE'
// - Set chase_queue_entered_at = NOW()
// - Create CHASE work item

// Record chase action (email, SMS, call)
export async function recordChaseAction(
  chaseItemId: string,
  actionType: 'EMAIL' | 'SMS' | 'CALL',
  staffUserId: string
): Promise<void>

// Mark as received (when referee submits online)
export async function markChaseReceived(chaseItemId: string): Promise<void>

// Mark as verbal obtained (when assessor records verbal)
export async function markChaseVerbalObtained(chaseItemId: string, verbalRefId: string): Promise<void>

// Mark as unable to obtain
export async function markChaseUnable(chaseItemId: string, reason: string): Promise<void>
```

#### verbalReferenceService.ts
```typescript
// Record verbal reference (assessor fills in same form as online)
export async function recordVerbalReference(
  referenceId: string,
  sectionId: string,
  refereeType: 'EMPLOYER' | 'LANDLORD' | 'AGENT' | 'ACCOUNTANT',
  refereeDetails: { name: string, position?: string, phone: string },
  callDetails: { datetime: Date, durationMinutes?: number },
  responses: Record<string, any>,  // Same fields as online form
  staffUserId: string
): Promise<VerbalReference>
// - Insert into verbal_references_v2
// - Update chase_item status = 'VERBAL_OBTAINED'
// - Update section queue_status = 'READY' (goes to verification queue)
// - Create work item for section verification
```

#### affordabilityService.ts
```typescript
// Calculate affordability ratio
export function calculateAffordability(
  annualIncome: number,
  monthlyRentShare: number,
  isGuarantor: boolean
): { ratio: number, passes: boolean }
// - Tenant: passes if annualIncome / 30 >= monthlyRentShare
// - Guarantor: passes if annualIncome / 32 >= monthlyRentShare

// Update affordability for reference
export async function updateReferenceAffordability(referenceId: string): Promise<void>
// - Calculate ratio based on annual_income and rent_share
// - Update affordability_ratio and affordability_pass fields
```

---

### 1.3 Backend Routes - New V2 Endpoints

**Location**: `/backend/src/routes/`

**New Files**:

```
/backend/src/routes/v2/
  ├── references.ts       # V2 reference CRUD
  ├── sections.ts         # Section queue operations
  ├── chase.ts            # Chase queue operations
  ├── verbal.ts           # Verbal reference capture
  ├── workQueue.ts        # Work queue endpoints
  └── finalReview.ts      # Final review endpoints
```

**Key Endpoints**:

```typescript
// V2 References
POST   /api/v2/references              // Create V2 reference
GET    /api/v2/references              // List V2 references (agent)
GET    /api/v2/references/:id          // Get V2 reference details
PUT    /api/v2/references/:id          // Update V2 reference
DELETE /api/v2/references/:id          // Delete V2 reference

// V2 Sections (Staff)
GET    /api/v2/staff/queues            // Get queue counts for dashboard
GET    /api/v2/staff/queues/:type      // Get items in specific queue
POST   /api/v2/staff/sections/:id/claim      // Claim section
POST   /api/v2/staff/sections/:id/decision   // Submit decision
POST   /api/v2/staff/sections/:id/release    // Release back to queue

// V2 Chase (Staff)
GET    /api/v2/staff/chase             // Get chase queue items
POST   /api/v2/staff/chase/:id/email   // Send chase email
POST   /api/v2/staff/chase/:id/sms     // Send chase SMS (Twilio)
POST   /api/v2/staff/chase/:id/call    // Log call attempt
POST   /api/v2/staff/chase/:id/verbal  // Record verbal reference
POST   /api/v2/staff/chase/:id/unable  // Mark unable to obtain

// V2 Final Review (Senior Staff)
GET    /api/v2/staff/final-review           // Get final review queue
GET    /api/v2/staff/final-review/:id       // Get reference for final review
POST   /api/v2/staff/final-review/:id/decision  // Submit final decision
```

---

### 1.4 Feature Flag System

**Add to companies table or company_settings**:

```sql
-- Add V2 feature flag to companies
ALTER TABLE companies ADD COLUMN use_references_v2 BOOLEAN DEFAULT FALSE;

-- For gradual rollout, can also add to company_settings
INSERT INTO company_settings (company_id, setting_key, setting_value)
VALUES ('company-uuid', 'use_references_v2', 'true');
```

**Backend check**:
```typescript
// In reference creation endpoint
async function shouldUseV2(companyId: string): Promise<boolean> {
  const { data } = await supabase
    .from('companies')
    .select('use_references_v2')
    .eq('id', companyId)
    .single()
  return data?.use_references_v2 === true
}
```

---

### 1.5 Sprint 1 Deliverables Checklist

- [ ] Create V2 database tables (SQL migration)
- [ ] Create referenceServiceV2.ts
- [ ] Create sectionServiceV2.ts
- [ ] Create chaseServiceV2.ts
- [ ] Create verbalReferenceService.ts
- [ ] Create workQueueServiceV2.ts
- [ ] Create affordabilityService.ts
- [ ] Create V2 route files
- [ ] Add feature flag to companies table
- [ ] Write integration tests for V2 services
- [ ] Test V2 reference creation flow
- [ ] Test section initialization
- [ ] Verify V1 still works unchanged

---

## SPRINT 2: Staff Dashboard V2 - Section Queues

**Duration**: 1-2 weeks
**Risk Level**: LOW (new UI, no V1 changes)
**Goal**: Build the new queue-based assessor dashboard

---

### 2.1 Frontend Structure

**Location**: `/frontend/src/views/staff/v2/` (new folder)

**New Files**:

```
/frontend/src/views/staff/v2/
  ├── DashboardV2.vue           # Main dashboard with queue tiles
  ├── QueueView.vue             # Generic queue list view
  ├── SectionReview.vue         # Guided section review
  ├── ChaseQueue.vue            # Chase queue view
  ├── VerbalReferenceModal.vue  # Verbal reference capture
  ├── FinalReviewView.vue       # Final review (senior only)
  └── components/
      ├── QueueTile.vue         # Dashboard tile showing count
      ├── QueueItem.vue         # Single item in queue list
      ├── SectionChecklist.vue  # Guided checklist for section
      ├── DecisionPanel.vue     # PASS/FAIL/CONDITION buttons
      └── UKTimeClock.vue       # UK time display for PH team
```

---

### 2.2 Dashboard Layout

**DashboardV2.vue**:

```
┌──────────────────────────────────────────────────────────────────┐
│  ASSESSOR DASHBOARD                   🇬🇧 UK Time: 14:32 GMT     │
│                                       [Your Name ▼]              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  VERIFICATION QUEUES                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │IDENTITY │ │   RTR   │ │ INCOME  │ │RESIDENT.│ │ CREDIT  │   │
│  │   12    │ │    8    │ │   15    │ │    5    │ │    3    │   │
│  │ ready   │ │  ready  │ │  ready  │ │  ready  │ │  ready  │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
│                                                                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────────────────────────────────┐│
│  │   AML   │ │  CHASE  │ │                                     ││
│  │    2    │ │    7    │ │  FINAL REVIEW          [4 ready]    ││
│  │  ready  │ │ overdue │ │  (Senior Assessors Only)            ││
│  └─────────┘ └─────────┘ └─────────────────────────────────────┘│
│                                                                  │
│  MY CURRENT WORK                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ IDENTITY - John Smith - 124 Ellan Hay Rd    [Continue]     │ │
│  │ Started 5 mins ago                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Key Features**:
- UK Time Clock (prominent for Philippine team)
- Queue tiles with counts (click to enter queue)
- "My Current Work" section (items they've claimed)
- Final Review only visible to users with FINAL_REVIEW role

---

### 2.3 Section Review - Guided Steps

**SectionReview.vue** - What assessor sees when reviewing a section:

```
┌──────────────────────────────────────────────────────────────────┐
│  IDENTITY VERIFICATION                       [Back to Queue]     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Applicant: John Smith                                           │
│  Property: 124 Ellan Hay Road, Bristol BS32 0HB                  │
│  Agent: R&G Property Cardiff                                     │
│  Rent Share: £600/month                                          │
│                                                                  │
│  ════════════════════════════════════════════════════════════   │
│                                                                  │
│  STEP 1 OF 2: Review ID Document                                │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  [═══════════════════════════════════════════════════════════]  │
│  │                    ID DOCUMENT IMAGE                        │ │
│  │                    (Click to enlarge)                       │ │
│  [═══════════════════════════════════════════════════════════]  │
│                                                                  │
│  ☐ Document is clear and readable                               │
│    ℹ️ Check all text is legible, no blur or glare               │
│                                                                  │
│  ☐ Name matches application: John Smith                         │
│    ℹ️ Compare name on ID with application name exactly          │
│                                                                  │
│  ☐ Document is valid (check expiry date)                        │
│    ℹ️ Document must not be expired at move-in date              │
│                                                                  │
│  Document Type: [Passport ▼]                                    │
│  Document Expiry: [DD/MM/YYYY]                                   │
│                                                                  │
│  [Step 1 Complete ✓] [Issue Found - Select Reason ▼]            │
│                                                                  │
│  ════════════════════════════════════════════════════════════   │
│                                                                  │
│  STEP 2 OF 2: Compare Selfie to ID                              │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  [ID PHOTO]                    [SELFIE PHOTO]                   │
│                                                                  │
│  ☐ Same person in both photos                                   │
│    ℹ️ Compare facial features, ears, nose shape                 │
│                                                                  │
│  ☐ Selfie appears recent (matches ID age)                       │
│    ℹ️ Person should look same age as ID photo                  │
│                                                                  │
│  ☐ No signs of photo manipulation                               │
│    ℹ️ Check for blurring, cut edges, inconsistent lighting     │
│                                                                  │
│  [Step 2 Complete ✓] [Issue Found - Select Reason ▼]            │
│                                                                  │
│  ════════════════════════════════════════════════════════════   │
│                                                                  │
│  SECTION DECISION                                                │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  [✓ PASS]  [PASS WITH CONDITION]  [✗ FAIL]                      │
│                                                                  │
│  Notes (optional):                                               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  [SUBMIT DECISION]                           [Release to Queue]  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Key Features**:
- Guided checklist with help text (strict guidance for PH team)
- Step-by-step flow
- Each checkbox has info icon with detailed explanation
- Can't submit until all checkboxes completed
- "Issue Found" expands to show reason codes

---

### 2.4 Section Checklists by Type

**IDENTITY Section Steps**:
1. Review ID Document
   - Document clear and readable
   - Name matches application
   - Document not expired
   - Document type selection
2. Compare Selfie to ID
   - Same person
   - Recent photo
   - No manipulation

**RTR Section Steps**:
1. Check Citizenship Status
   - If British: Verify British passport
   - If Share Code: Open GOV.UK checker, enter code, verify status
   - If Visa: Check visa type and expiry
2. Confirm Right to Rent
   - Status allows renting
   - Valid until after move-in date

**INCOME Section Steps**:
1. Review Income Evidence
   - Payslips present (3 months if employed)
   - Bank statements showing salary
   - Self-employed: accounts/tax returns
2. Calculate Annual Income
   - Enter calculated annual amount
   - System shows affordability: income/30 vs rent share
3. Review Employer Reference (if present)
   - Employment confirmed
   - Job title matches
   - Salary matches evidence
   - Badge: "Online Submission" or "Verbal Reference"

**RESIDENTIAL Section Steps**:
1. Check Previous Address History
   - Current address provided
   - Previous addresses if < 3 years
2. Review Landlord/Agent Reference
   - Tenancy dates correct
   - Rent amount correct
   - Rent paid on time
   - Would recommend
   - Any issues noted
   - Badge: "Online Submission" or "Verbal Reference"

**CREDIT Section** (Auto-populated from Creditsafe):
1. Review Credit Check Results
   - Credit score displayed
   - CCJs listed (amount, date, status)
   - Bankruptcies listed
   - IVAs listed
2. Make Assessment
   - No issues = PASS
   - Minor issues = PASS_WITH_CONDITION
   - Severe issues = FAIL

**AML Section** (Auto-populated from sanctions screening):
1. Review AML Screening Results
   - Sanctions matches listed
   - PEP status
   - Adverse media
2. Make Assessment
   - No matches = PASS
   - Matches found = Investigate and decide

---

### 2.5 Chase Queue UI

**ChaseQueue.vue**:

```
┌──────────────────────────────────────────────────────────────────┐
│  CHASE QUEUE                                  [Back to Dashboard] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  7 items overdue for chasing                                     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ EMPLOYER REFERENCE                              ⏰ 3 days  │ │
│  │ ──────────────────────────────────────────────────────────│ │
│  │ Tenant: John Smith                                         │ │
│  │ Referee: ABC Ltd - hr@abcltd.com - 07123 456789           │ │
│  │ Initial sent: 5th March 2026                               │ │
│  │ Chased: 2 times (last: yesterday)                         │ │
│  │                                                            │ │
│  │ [📧 Send Email] [📱 Send SMS] [📞 Log Call] [🎤 Verbal]   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ LANDLORD REFERENCE                              ⏰ 2 days  │ │
│  │ ──────────────────────────────────────────────────────────│ │
│  │ Tenant: Sarah Jones                                        │ │
│  │ Referee: Mr Smith - landlord@email.com - 07987 654321     │ │
│  │ Initial sent: 6th March 2026                               │ │
│  │ Chased: 0 times                                           │ │
│  │                                                            │ │
│  │ [📧 Send Email] [📱 Send SMS] [📞 Log Call] [🎤 Verbal]   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Chase Actions**:
- **Send Email**: Uses existing email templates via emailService
- **Send SMS**: Uses existing Twilio integration via smsService
- **Log Call**: Records call attempt with outcome dropdown
- **Verbal**: Opens VerbalReferenceModal with same form as online

---

### 2.6 Verbal Reference Modal

**VerbalReferenceModal.vue**:

When assessor clicks "Verbal Reference", show the SAME FORM as the online referee form:

```
┌──────────────────────────────────────────────────────────────────┐
│  RECORD VERBAL REFERENCE                              [✕ Close] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Referee Details                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  Name: [John Smith - HR Manager          ]                       │
│  Position: [HR Manager                    ]                      │
│  Phone: [07123 456789                     ]                      │
│  Call Date/Time: [08/03/2026] [14:30]                            │
│                                                                  │
│  ════════════════════════════════════════════════════════════   │
│                                                                  │
│  EMPLOYER REFERENCE FORM                                         │
│  (Same questions as online form)                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Is [John Smith] currently employed by your company?            │
│  [Yes ▼]                                                         │
│                                                                  │
│  What is their job title?                                        │
│  [Software Developer                      ]                      │
│                                                                  │
│  What is their annual salary?                                    │
│  £[45000                                  ]                      │
│  ℹ️ Enter annual gross salary BEFORE tax deductions             │
│                                                                  │
│  Employment start date:                                          │
│  [15/06/2020]                                                    │
│                                                                  │
│  Is their employment: [Permanent ▼]                              │
│                                                                  │
│  Any performance issues or disciplinary action?                  │
│  [No ▼]                                                          │
│                                                                  │
│  Additional comments:                                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Excellent employee, no concerns.                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ════════════════════════════════════════════════════════════   │
│                                                                  │
│  [SAVE VERBAL REFERENCE]                                         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**After Save**:
- Chase item marked as VERBAL_OBTAINED
- Section becomes READY with "Verbal" badge
- Appears in verification queue for review

---

### 2.7 Final Review View (Senior Assessors)

**FinalReviewView.vue** - Only accessible to FINAL_REVIEW role:

```
┌──────────────────────────────────────────────────────────────────┐
│  FINAL REVIEW                                [Back to Dashboard] │
│  Reference: John Smith - 124 Ellan Hay Rd                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  APPLICANT SUMMARY                                               │
│  ─────────────────────────────────────────────────────────────  │
│  Name: John Smith                                                │
│  DOB: 15/03/1990                                                 │
│  Property: 124 Ellan Hay Road, Bristol BS32 0HB                  │
│  Monthly Rent: £1,200 (This tenant's share: £600)               │
│  Move-in: 1st April 2026                                         │
│                                                                  │
│  AFFORDABILITY                                                   │
│  ─────────────────────────────────────────────────────────────  │
│  Annual Income: £45,000                                          │
│  Rent Share: £600/month                                          │
│  Affordability: £45,000 ÷ 30 = £1,500 ✓ PASS                    │
│  (Required: £600, Actual: £1,500)                               │
│                                                                  │
│  SECTION RESULTS                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  ┌──────────────┬────────────────────────────────────────────┐  │
│  │ IDENTITY     │ ✓ PASS                                      │  │
│  │              │ Passport verified, selfie matched           │  │
│  ├──────────────┼────────────────────────────────────────────┤  │
│  │ RTR          │ ✓ PASS                                      │  │
│  │              │ British Citizen                             │  │
│  ├──────────────┼────────────────────────────────────────────┤  │
│  │ INCOME       │ ✓ PASS                                      │  │
│  │              │ Employer ref (verbal) confirmed £45k       │  │
│  ├──────────────┼────────────────────────────────────────────┤  │
│  │ RESIDENTIAL  │ ⚠️ PASS WITH CONDITION                      │  │
│  │              │ Previous landlord noted late payment once   │  │
│  ├──────────────┼────────────────────────────────────────────┤  │
│  │ CREDIT       │ ✓ PASS                                      │  │
│  │              │ Score 720, no adverse findings              │  │
│  ├──────────────┼────────────────────────────────────────────┤  │
│  │ AML          │ ✓ PASS                                      │  │
│  │              │ No sanctions matches                        │  │
│  └──────────────┴────────────────────────────────────────────┘  │
│                                                                  │
│  FINAL DECISION                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  ○ ACCEPTED                                                      │
│    All checks passed, recommend for tenancy                      │
│                                                                  │
│  ○ ACCEPTED WITH GUARANTOR                                       │
│    Affordability concerns require guarantor                      │
│                                                                  │
│  ○ ACCEPTED ON CONDITION                                         │
│    ┌──────────────────────────────────────────────────────────┐ │
│    │ Conditions: Previous late payment noted - recommend      │ │
│    │ standing order setup                                     │ │
│    └──────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ○ REJECTED                                                      │
│    ┌──────────────────────────────────────────────────────────┐ │
│    │ Rejection reason:                                        │ │
│    └──────────────────────────────────────────────────────────┘ │
│                                                                  │
│  [SUBMIT FINAL DECISION]                                         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**For Multi-Tenant Groups** - Shows ALL tenants and guarantors together:

```
│  GROUP FINAL REVIEW                                              │
│  Property: 124 Ellan Hay Road (3 tenants)                       │
│                                                                  │
│  TENANT 1: John Smith                                            │
│  ├─ Rent Share: £400/month                                      │
│  ├─ Affordability: ✓ PASS                                       │
│  └─ All sections: ✓ PASS                                        │
│                                                                  │
│  TENANT 2: Sarah Jones                                           │
│  ├─ Rent Share: £400/month                                      │
│  ├─ Affordability: ✗ FAIL (requires guarantor)                  │
│  ├─ All sections: ✓ PASS                                        │
│  └─ GUARANTOR: Mrs Jones                                        │
│     ├─ Affordability: ✓ PASS                                    │
│     └─ All sections: ✓ PASS                                     │
│                                                                  │
│  TENANT 3: Mike Brown                                            │
│  ├─ Rent Share: £400/month                                      │
│  ├─ Affordability: ✓ PASS                                       │
│  └─ All sections: ⚠️ PASS WITH CONDITION (credit)               │
```

---

### 2.8 Sprint 2 Deliverables Checklist

- [ ] Create DashboardV2.vue with queue tiles
- [ ] Create QueueView.vue for queue lists
- [ ] Create SectionReview.vue with guided checklists
- [ ] Create ChaseQueue.vue
- [ ] Create VerbalReferenceModal.vue
- [ ] Create FinalReviewView.vue
- [ ] Create UKTimeClock.vue component
- [ ] Implement section checklists for all 6 types
- [ ] Wire up to V2 API endpoints
- [ ] Add role-based access (FINAL_REVIEW for senior)
- [ ] Test full flow: queue → claim → review → decide
- [ ] Test chase flow: chase → verbal → verify
- [ ] Test final review flow

---

## SPRINT 3: Agent Experience V2 & Forms

**Duration**: 1-2 weeks
**Risk Level**: MEDIUM (tenant-facing forms need careful testing)
**Goal**: Build agent reference management and tenant forms

---

### 3.1 Agent Reference List V2

**Location**: `/frontend/src/views/references/v2/`

**ReferencesV2.vue**:

```
┌──────────────────────────────────────────────────────────────────┐
│  REFERENCES                                    [+ New Reference] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🔍 [Search name, email, property...               ]  [Search]  │
│                                                                  │
│  [All] [Sent] [In Progress] [Action Required] [Completed]       │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ John Smith                                                 │ │
│  │ 124 Ellan Hay Road, Bristol          Sent 2 days ago      │ │
│  │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │ │
│  │ │ ID ✓ │ │RTR ✓ │ │INC ⏳│ │RES ⏳│ │CRD ✓ │ │AML ✓ │   │ │
│  │ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘   │ │
│  │ Status: COLLECTING EVIDENCE                    [View →]   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Sarah Jones                               ⚠️ ACTION REQ.  │ │
│  │ 45 High Street, Cardiff                  Sent 5 days ago  │ │
│  │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │ │
│  │ │ ID ✗ │ │RTR ✓ │ │INC ✓ │ │RES ✓ │ │CRD ✓ │ │AML ✓ │   │ │
│  │ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘   │ │
│  │ Issue: ID document expired                     [View →]   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Key Features**:
- Global search across all references
- Section progress indicators (✓ pass, ⏳ waiting, ✗ issue)
- Status tabs matching V2 statuses
- Action required highlighted prominently

---

### 3.2 Reference Detail Drawer V2

**ReferenceDrawerV2.vue**:

```
┌────────────────────────────────────────────────────────────────────────────┐
│  John Smith                                    [✕]                         │
│  124 Ellan Hay Road, Bristol BS32 0HB                                      │
│  Status: COLLECTING EVIDENCE                                               │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  [Details] [Evidence] [Sections] [Timeline]                                │
│                                                                            │
│  ═══════════════════════════════════════════════════════════════════════  │
│                                                                            │
│  RENT & AFFORDABILITY                                             [Edit]   │
│  ─────────────────────────────────────────────────────────────────────    │
│  Monthly Rent: £1,200                                                      │
│  This tenant's share: £600                    [Edit Rent Share]            │
│  Annual Income: £45,000                                                    │
│  Affordability: £45,000 ÷ 30 = £1,500 ✓ PASS                              │
│                                                                            │
│  SECTION STATUS                                                            │
│  ─────────────────────────────────────────────────────────────────────    │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ ✓ IDENTITY          Passed - Passport verified                      │  │
│  ├─────────────────────────────────────────────────────────────────────┤  │
│  │ ✓ RTR               Passed - British Citizen                        │  │
│  ├─────────────────────────────────────────────────────────────────────┤  │
│  │ ⏳ INCOME            Waiting - Employer reference sent 2 days ago   │  │
│  │                      hr@abcltd.com - 07123 456789                   │  │
│  ├─────────────────────────────────────────────────────────────────────┤  │
│  │ ⏳ RESIDENTIAL        Waiting - Landlord reference sent 2 days ago  │  │
│  │                      landlord@email.com - 07987 654321              │  │
│  ├─────────────────────────────────────────────────────────────────────┤  │
│  │ ✓ CREDIT             Passed - Score 720, no issues                  │  │
│  ├─────────────────────────────────────────────────────────────────────┤  │
│  │ ✓ AML                Passed - No sanctions matches                   │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  UPLOADED EVIDENCE                                                         │
│  ─────────────────────────────────────────────────────────────────────    │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ 📄 Passport.jpg                                    [View] [Download] │ │
│  │ 📄 Selfie.jpg                                      [View] [Download] │ │
│  │ 📄 Payslip_Jan.pdf                                 [View] [Download] │ │
│  │ 📄 Payslip_Feb.pdf                                 [View] [Download] │ │
│  │ 📄 Payslip_Mar.pdf                                 [View] [Download] │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  ACTIONS                                                                   │
│  [Resend Form Link]  [Add Guarantor]  [Cancel Reference]                  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

**Evidence Tab** shows all uploaded files regardless of section status.

**Edit Rent Share**:
- Opens modal to edit rent_share value
- Recalculates affordability in real-time
- For multi-tenant: shows all tenants and their shares

---

### 3.3 Tenant Form V2

**Location**: `/frontend/src/views/tenant-form/v2/`

**TenantFormV2.vue** - Public form tenants fill out:

Key differences from V1:
- Streamlined sections
- Better mobile experience
- Clear progress indicator
- Same fields, cleaner layout

```
┌────────────────────────────────────────────────────────────────┐
│  [Company Logo]                                                │
│                                                                │
│  TENANT REFERENCE APPLICATION                                  │
│  124 Ellan Hay Road, Bristol BS32 0HB                         │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Progress: ████████░░░░░░░░░░░░ 40%                           │
│  [Personal ✓] [Address ✓] [Employment] [Income] [References] │
│                                                                │
│  ════════════════════════════════════════════════════════════ │
│                                                                │
│  EMPLOYMENT DETAILS                                            │
│  ─────────────────────────────────────────────────────────   │
│                                                                │
│  Employment Status:                                            │
│  [Employed Full-Time ▼]                                        │
│                                                                │
│  Employer Name:                                                │
│  [ABC Ltd                                    ]                 │
│                                                                │
│  Job Title:                                                    │
│  [Software Developer                          ]                │
│                                                                │
│  Employer Contact for Reference:                               │
│  Name: [Sarah Smith                           ]                │
│  Email: [hr@abcltd.com                        ]                │
│  Phone: [07123 456789                         ]                │
│                                                                │
│  [← Back]                              [Continue →]            │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

### 3.4 External Referee Forms V2

**Employer Reference Form** - `/frontend/src/views/referee/EmployerFormV2.vue`:

Same fields as V1, used for both online submissions AND verbal reference capture:

```typescript
// Employer reference response fields
interface EmployerReferenceResponse {
  is_employed: boolean
  job_title: string
  annual_salary: number
  employment_type: 'permanent' | 'contract' | 'temporary'
  start_date: string
  end_date?: string  // If no longer employed
  performance_issues: boolean
  performance_notes?: string
  would_reemploy: boolean
  additional_comments?: string

  // Referee details
  referee_name: string
  referee_position: string
  referee_email: string
  referee_phone: string
  submitted_at: string
}
```

**Landlord Reference Form** - `/frontend/src/views/referee/LandlordFormV2.vue`:

```typescript
// Landlord reference response fields
interface LandlordReferenceResponse {
  was_tenant: boolean
  tenancy_start_date: string
  tenancy_end_date?: string
  monthly_rent: number
  rent_paid_on_time: 'always' | 'usually' | 'sometimes' | 'rarely'
  rent_arrears: boolean
  arrears_amount?: number
  property_condition: 'excellent' | 'good' | 'fair' | 'poor'
  any_issues: boolean
  issues_description?: string
  would_rent_again: boolean
  additional_comments?: string

  // Referee details
  referee_name: string
  referee_type: 'landlord' | 'agent'
  referee_email: string
  referee_phone: string
  submitted_at: string
}
```

---

### 3.5 Sprint 3 Deliverables Checklist

- [ ] Create ReferencesV2.vue with global search
- [ ] Create ReferenceDrawerV2.vue with section status
- [ ] Create rent share editing modal
- [ ] Create TenantFormV2.vue (public form)
- [ ] Create EmployerFormV2.vue (referee form)
- [ ] Create LandlordFormV2.vue (referee form)
- [ ] Wire forms to V2 API endpoints
- [ ] Add section readiness triggers when forms submitted
- [ ] Test full flow: create ref → tenant fills form → referee fills form → sections ready
- [ ] Test rent share editing and affordability recalculation
- [ ] Add V2 routes to router

---

## SPRINT 4: PDF Report, Admin Dashboard & Polish

**Duration**: 1-2 weeks
**Risk Level**: LOW (new features, not modifying V1)
**Goal**: Complete the V2 system with PDF generation and admin tools

---

### 4.1 PDF Report V2

**Location**: `/backend/src/services/pdfGenerationServiceV2.ts`

**Design Requirements**:
- Company logo at top (agent's branding)
- PropertyGoose "Verified by" badge at bottom
- Section-by-section results with visual indicators
- Clean, modern layout

**Template Structure**:

```
┌──────────────────────────────────────────────────────────────────┐
│  [COMPANY LOGO]                                                  │
│                                                                  │
│  TENANT REFERENCE REPORT                                         │
│  Reference: PG-2026-001234                                       │
│  Generated: 8th March 2026                                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  APPLICANT                                                       │
│  ──────────                                                      │
│  Name: John Smith                                                │
│  Date of Birth: 15th March 1990                                  │
│  Email: john.smith@email.com                                     │
│  Phone: 07123 456789                                             │
│                                                                  │
│  PROPERTY                                                        │
│  ────────                                                        │
│  Address: 124 Ellan Hay Road, Bradley Stoke, Bristol BS32 0HB   │
│  Monthly Rent: £1,200                                            │
│  Applicant's Share: £600                                         │
│  Move-in Date: 1st April 2026                                    │
│  Term: 12 months                                                 │
│                                                                  │
│  AFFORDABILITY                                                   │
│  ─────────────                                                   │
│  Annual Income: £45,000                                          │
│  Affordability Check: £45,000 ÷ 30 = £1,500                     │
│  Required: £600/month | Result: ✓ PASS                          │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  VERIFICATION RESULTS                                            │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ IDENTITY VERIFICATION                           ✓ PASSED    ││
│  │ ─────────────────────────────────────────────────────────── ││
│  │ Document Type: Passport                                     ││
│  │ Document Valid: Yes (expires 2028)                          ││
│  │ Selfie Match: Confirmed                                     ││
│  │ Verified: 7th March 2026                                    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ RIGHT TO RENT                                   ✓ PASSED    ││
│  │ ─────────────────────────────────────────────────────────── ││
│  │ Status: British Citizen                                     ││
│  │ Evidence: British Passport                                  ││
│  │ Verified: 7th March 2026                                    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ INCOME VERIFICATION                             ✓ PASSED    ││
│  │ ─────────────────────────────────────────────────────────── ││
│  │ Employment Status: Employed Full-Time                       ││
│  │ Employer: ABC Ltd                                           ││
│  │ Job Title: Software Developer                               ││
│  │ Annual Income: £45,000                                      ││
│  │ Reference: Employer (verbal) - confirmed                    ││
│  │ Verified: 8th March 2026                                    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ RESIDENTIAL HISTORY                   ⚠️ PASSED (CONDITION) ││
│  │ ─────────────────────────────────────────────────────────── ││
│  │ Previous Address: 45 High Street, Cardiff                   ││
│  │ Tenancy: 2 years (2022-2024)                                ││
│  │ Reference: Previous landlord (online)                       ││
│  │ Rent Payments: Usually on time                              ││
│  │ Condition: One late payment noted - recommend standing order││
│  │ Verified: 8th March 2026                                    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ CREDIT CHECK                                    ✓ PASSED    ││
│  │ ─────────────────────────────────────────────────────────── ││
│  │ Credit Score: 720                                           ││
│  │ CCJs: None                                                   ││
│  │ Bankruptcies: None                                          ││
│  │ IVAs: None                                                   ││
│  │ Checked: 7th March 2026                                     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ AML SCREENING                                   ✓ PASSED    ││
│  │ ─────────────────────────────────────────────────────────── ││
│  │ Sanctions Check: No matches                                 ││
│  │ PEP Status: Not a PEP                                       ││
│  │ Screened: 7th March 2026                                    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ╔════════════════════════════════════════════════════════════╗ │
│  ║                                                            ║ │
│  ║                    FINAL DECISION                          ║ │
│  ║                                                            ║ │
│  ║                ✓ ACCEPTED ON CONDITION                     ║ │
│  ║                                                            ║ │
│  ║  This applicant has passed verification with the           ║ │
│  ║  following condition:                                       ║ │
│  ║                                                            ║ │
│  ║  • Recommend standing order for rent payments              ║ │
│  ║                                                            ║ │
│  ╚════════════════════════════════════════════════════════════╝ │
│                                                                  │
│  Decision by: Craig (Senior Assessor)                           │
│  Decision date: 8th March 2026                                  │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [QR CODE]                                                       │
│                                                                  │
│  Verify this report:                                             │
│  propertygoose.co.uk/verify/PG-2026-001234                      │
│                                                                  │
│  ──────────────────────────────────────────────────────────     │
│                                                                  │
│  [PropertyGoose Logo]                                            │
│  Verified by PropertyGoose Ltd                                   │
│  www.propertygoose.co.uk                                         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

### 4.2 Admin Dashboard

**Location**: `/frontend/src/views/admin/`

**AdminDashboard.vue**:

```
┌──────────────────────────────────────────────────────────────────┐
│  ADMIN DASHBOARD                                                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Companies] [Staff] [Billing] [Analytics]                       │
│                                                                  │
│  ═══════════════════════════════════════════════════════════   │
│                                                                  │
│  QUICK STATS                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐│
│  │ Companies   │ │ References  │ │ Pending     │ │ Revenue    ││
│  │    45       │ │   1,234     │ │    156      │ │  £12,340   ││
│  │   active    │ │  this month │ │   in queue  │ │ this month ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘│
│                                                                  │
│  COMPANIES                                        [+ Add Company]│
│  ─────────────────────────────────────────────────────────────  │
│  🔍 [Search companies...                     ]                   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ R&G Property Cardiff          │ Active │ 450 refs │ Custom │ │
│  │ Created: Jan 2025             │        │ this yr  │ £8/ref │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ Cardiff Lettings Ltd          │ Active │ 120 refs │ Pro    │ │
│  │ Created: Mar 2025             │        │ this yr  │ £12/ref│ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ Bristol Homes                 │ Trial  │ 25 refs  │ Starter│ │
│  │ Created: Feb 2026             │        │ this yr  │ £15/ref│ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Company Detail View**:

```
┌──────────────────────────────────────────────────────────────────┐
│  R&G Property Cardiff                         [Edit] [Disable]   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Overview] [Users] [Branches] [Billing] [Usage]                 │
│                                                                  │
│  COMPANY DETAILS                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  Name: R&G Property Cardiff                                      │
│  Email: info@rgproperty.co.uk                                    │
│  Phone: 029 1234 5678                                            │
│  Address: 45 High Street, Cardiff CF1 1AA                        │
│  Created: 15th January 2025                                      │
│  V2 Enabled: ✓ Yes                                               │
│                                                                  │
│  BILLING                                                         │
│  ─────────────────────────────────────────────────────────────  │
│  Plan: Custom Deal                                               │
│  Rate: £8 per reference                                          │
│  Minimum Volume: 100/month                                       │
│  Contract: 12 months (ends Jan 2026)                             │
│  Credits Balance: 450                                            │
│  [Edit Billing] [Add Credits] [View Invoices]                   │
│                                                                  │
│  USAGE THIS MONTH                                                │
│  ─────────────────────────────────────────────────────────────  │
│  References Created: 45                                          │
│  References Completed: 38 (84%)                                  │
│  Avg Completion Time: 2.8 days                                   │
│  Tenancies Created: 32                                           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Staff Management Tab**:

```
│  STAFF USERS                                       [+ Add Staff] │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Craig                         │ Final Review │ Active      │ │
│  │ craig@propertygoose.co.uk     │ 234 reviews  │ Avg 6.1 min│ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ Sarah Jones                   │ Assessor     │ Active      │ │
│  │ sarah@propertygoose.co.uk     │ 145 sections │ Avg 4.2 min│ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ Mike Brown                    │ Assessor     │ Active      │ │
│  │ mike@propertygoose.co.uk      │ 89 sections  │ Avg 5.1 min│ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Add Staff User:                                                 │
│  Email: [                                        ]               │
│  Name: [                                         ]               │
│  Role: [Assessor ▼]                                              │
│        Options: Admin, Assessor, Final Review, Supervisor        │
│  [Add User]                                                      │
```

---

### 4.3 Feature Flag Rollout UI

**V2 Migration Controls** (in Admin):

```
│  V2 REFERENCE SYSTEM ROLLOUT                                     │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Global Status: GRADUAL ROLLOUT                                  │
│                                                                  │
│  Enabled Companies:                                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ✓ R&G Property Cardiff          Enabled: 1st March 2026   │ │
│  │ ✓ Cardiff Lettings Ltd          Enabled: 5th March 2026   │ │
│  │ ○ Bristol Homes                  Not enabled               │ │
│  │ ○ London Properties             Not enabled               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  [Enable for Company ▼]  [Enable for All]                        │
│                                                                  │
│  V1 References Still Processing: 23                              │
│  (These will complete in V1 system)                              │
```

---

### 4.4 Sprint 4 Deliverables Checklist

- [ ] Create pdfGenerationServiceV2.ts with new design
- [ ] Add company logo + PropertyGoose branding to PDF
- [ ] Add QR code verification to PDF
- [ ] Create AdminDashboard.vue
- [ ] Create CompanyDetail.vue
- [ ] Create StaffManagement.vue
- [ ] Create BillingManagement.vue (use existing Stripe)
- [ ] Create V2 rollout controls in admin
- [ ] Create verification page for QR codes
- [ ] Update email templates for V2
- [ ] End-to-end testing of full V2 flow
- [ ] Performance testing with realistic data
- [ ] Documentation for assessors

---

## POST-SPRINT: Monitoring & Migration

After all 4 sprints complete:

1. **Enable V2 for pilot company**
   - Enable feature flag for one company
   - Monitor for issues
   - Collect feedback

2. **Gradual rollout**
   - Enable for more companies week by week
   - Monitor queue times and completion rates
   - Address any issues

3. **V1 wind-down**
   - Once all companies on V2
   - V1 references continue processing until complete
   - Archive V1 tables after 6 months

4. **Success metrics to track**:
   - Avg reference completion time (target: < 3 days)
   - Assessor time per section (target: < 3 min)
   - References stuck > 7 days (target: < 5%)
   - Chase response rate (target: > 80%)

---

## Success Metrics

### Target KPIs

| Metric | Current | Target |
|--------|---------|--------|
| Avg reference completion time | 5+ days | < 3 days |
| Assessor time per section | Unknown | < 3 min |
| References stuck > 7 days | ~15% | < 5% |
| Chase response rate | ~60% | > 80% |
| Agent support tickets | High | -50% |
| Assessor training time | Days | Hours |

### Monitoring

- Track time in each queue
- Track assessor performance
- Track chase effectiveness
- Track feature usage
- Track error rates per section

---

## V2 Migration Strategy

### Approach: New Table Alongside V1

Rather than migrating the existing `tenant_references` table, V2 will use NEW tables:

```
tenant_references_v2      → New simplified reference records
reference_sections_v2     → Section-based verification tracking
verbal_references_v2      → Verbal reference capture
chase_items_v2            → Section-based chase tracking
```

**Benefits:**
- V1 continues working unchanged during transition
- No risk to existing in-progress references
- Can run V1 and V2 simultaneously
- Gradual company-by-company migration
- Easy rollback if issues arise

**Migration Path:**
1. New references created in V2 tables (feature flag per company)
2. V1 references continue processing in V1 system
3. Once V1 queue empties, disable V1 for that company
4. After all companies migrated, archive V1 tables

---

## Risk Mitigation

### Data Migration
- V2 as parallel system - no V1 data migration needed initially
- Completed V1 references remain accessible for historical viewing
- Build V1→V2 migration tool for mid-reference conversion if needed

### Backwards Compatibility
- V1 and V2 API endpoints coexist
- Company-level feature flag controls which system is used
- Agent portal shows references from both systems during transition

### Training
- Step-by-step guided UI reduces training needs
- UK time clock and strict help text for offshore team
- Test with small company cohort before wider rollout

---

## Resolved Decisions

1. **Partial reference completion?** → No. All sections must pass before Final Review.
2. **V1 references when V2 launches?** → V1 continues processing existing refs. New refs go to V2. No mid-reference migration.
3. **Different chase rules per referee type?** → Same 24-hour cycle for all. Verbal reference option for all.
4. **Assessors claim sections?** → Yes, section locks to assessor when they start. Prevents duplicate work.
5. **Analytics granularity?** → Per-section metrics for performance. Per-company for billing/usage.

## Integrations (All Existing - Reuse)

1. **Credit Check**: Creditsafe - continue using existing integration
2. **AML Screening**: Current provider - continue using existing integration
3. **SMS Chase**: Twilio - already set up. Assessor clicks "Send Chase SMS" button. Use same templates and pathways.
4. **Billing**: Stripe - existing integration to build on

**No new integrations needed** - V2 reuses all existing third-party connections.

---

*Document Version: 2.0*
*Updated: 8th March 2026*
*Author: Claude Code + Matthew Ryder*
*Status: Ready for implementation planning*

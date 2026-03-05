# Change Rent Due Date Feature - Implementation Plan

## Overview
Allow agents to change a tenant's rent due date. This involves pro-rata payment calculation, email notification with payment request, tenant confirmation, and final activation.

---

## 1. Database Changes

### New Table: `rent_due_date_changes`
```sql
CREATE TABLE rent_due_date_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Date change details
  current_due_day INTEGER NOT NULL,
  new_due_day INTEGER NOT NULL CHECK (new_due_day >= 1 AND new_due_day <= 28),

  -- Financial
  monthly_rent DECIMAL(10, 2) NOT NULL,
  pro_rata_days INTEGER NOT NULL,
  pro_rata_amount DECIMAL(10, 2) NOT NULL,
  admin_fee DECIMAL(10, 2) DEFAULT 0 CHECK (admin_fee >= 0 AND admin_fee <= 50),
  total_amount DECIMAL(10, 2) NOT NULL,

  -- Workflow status
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN (
    'pending_payment',    -- Email sent, awaiting tenant payment
    'payment_confirmed',  -- Tenant clicked "I've Paid"
    'activated',          -- Agent activated the change
    'cancelled'           -- Cancelled before activation
  )),

  -- Timestamps
  email_sent_at TIMESTAMP WITH TIME ZONE,
  tenant_confirmed_at TIMESTAMP WITH TIME ZONE,
  agent_confirmed_at TIMESTAMP WITH TIME ZONE,
  activated_at TIMESTAMP WITH TIME ZONE,
  effective_date DATE,  -- When the new rent due date takes effect

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 2. Backend API Endpoints

### POST `/api/tenancies/:id/rent-due-date-change`
Create a new rent due date change request and send email to tenant.

**Request Body:**
```json
{
  "newDueDay": 1,
  "adminFee": 25
}
```

**Logic:**
1. Validate tenancy is active
2. Calculate pro-rata days (difference between current and new date)
3. Calculate pro-rata amount: `(monthly_rent × 12 / 365) × days`
4. Create record in `rent_due_date_changes`
5. Send email to all tenants with invoice/payment details
6. Return change request details

### POST `/api/rent-due-date-change/:id/confirm-payment` (Public - Token-based)
Tenant confirms they've made the payment.

### POST `/api/tenancies/:id/rent-due-date-change/:changeId/activate`
Agent activates the change after verifying payment.

**Logic:**
1. Verify payment was confirmed
2. Update `tenancies.rent_due_day` to new value
3. Update `agreements.rent_due_day` if applicable
4. Log to tenancy audit trail
5. Send confirmation email to tenant

### GET `/api/tenancies/:id/rent-due-date-changes`
Get history of rent due date changes for a tenancy.

---

## 3. Email Template

### `rent-due-date-change-request.html`
- Agent/company branding
- Explanation of the change (from X to Y)
- Pro-rata calculation breakdown:
  - "Your current rent due date: 24th"
  - "New rent due date: 1st"
  - "Days difference: 7 days"
  - "Pro-rata calculation: £1,275 × 12 ÷ 365 × 7 = £293.01"
  - "Admin fee: £25.00"
  - "Total due: £318.01"
- Bank details for payment
- "I've Paid" button (links to confirmation page)

---

## 4. Frontend Components

### A. Updated Drawer UI - Action Buttons Section
Replace the simple dropdown with a dedicated actions section showing:
- Each action as a card/row with status indicators
- Current state (e.g., "Awaiting payment", "Ready to activate")
- Relevant info (amounts, dates)

```
┌────────────────────────────────────────────────────────────┐
│ TENANCY ACTIONS                                            │
├────────────────────────────────────────────────────────────┤
│ 📅 Change Rent Due Date                          [Initiate]│
│    └─ No pending changes                                   │
├────────────────────────────────────────────────────────────┤
│ 📈 Serve Rent Increase Notice                    [Initiate]│
│    └─ No pending increases                                 │
├────────────────────────────────────────────────────────────┤
│ ⚠️ Serve Section 8 Notice                        [Initiate]│
├────────────────────────────────────────────────────────────┤
│ 👤 Change Tenant                                 [Initiate]│
├────────────────────────────────────────────────────────────┤
│ ✉️ Email All Tenants                              [Send]   │
├────────────────────────────────────────────────────────────┤
│ ❌ End Tenancy                                   [Initiate]│
└────────────────────────────────────────────────────────────┘
```

When a change is pending:
```
┌────────────────────────────────────────────────────────────┐
│ 📅 Change Rent Due Date                                    │
│    Current: 24th → New: 1st                                │
│    Pro-rata: £293.01 + £25 fee = £318.01                   │
│    Status: Awaiting tenant payment                         │
│    [Resend Email] [Cancel]                                 │
├────────────────────────────────────────────────────────────┤
```

When payment confirmed:
```
┌────────────────────────────────────────────────────────────┐
│ 📅 Change Rent Due Date                     🟢 Ready       │
│    Current: 24th → New: 1st                                │
│    Tenant confirmed payment on 26 Feb 2026                 │
│    [Activate Change] [Cancel]                              │
├────────────────────────────────────────────────────────────┤
```

### B. ChangeRentDueDateModal.vue
Modal with:
1. Current rent due day display
2. Date picker for new due day (1-28)
3. Auto-calculated pro-rata amount (live update)
4. Admin fee input (£0-£50, default £0)
5. Total amount display
6. Preview of email content
7. Send button

### C. TenantPaymentConfirmation.vue (Public page)
Simple page accessed via email link:
- Shows payment details
- "I've Paid" button
- Confirmation message after clicking

---

## 5. Implementation Order

### Phase 1: Database & Core API
1. Create migration for `rent_due_date_changes` table
2. Create POST endpoint to initiate change
3. Create email template
4. Create tenant confirmation endpoint
5. Create activation endpoint

### Phase 2: Frontend Modal
1. Create `ChangeRentDueDateModal.vue`
2. Wire up to drawer action button
3. Implement pro-rata calculation
4. Send request to backend

### Phase 3: Updated Drawer UI
1. Redesign actions section in drawer
2. Create `TenancyActionsCard.vue` component
3. Show pending changes with status
4. Add activate/cancel buttons

### Phase 4: Tenant Confirmation Page
1. Create public route for payment confirmation
2. Create confirmation page component
3. Handle token validation

### Phase 5: Testing & Polish
1. Test full workflow
2. Add activity logging
3. Email delivery verification

---

## 6. Pro-Rata Calculation Details

**Formula:** `(monthly_rent × 12 / 365) × days_difference`

**Example:**
- Monthly rent: £1,275
- Current due date: 24th
- New due date: 1st
- Days difference: 7 days (24th to 1st of next month)

Calculation:
- Daily rate: £1,275 × 12 ÷ 365 = £41.92
- Pro-rata: £41.92 × 7 = £293.42

**Edge cases:**
- If new date is earlier in month: calculate days from current to new
- If new date is later in month: calculate days from current to new (going forward)
- Always calculate as positive days (absolute difference)

---

## 7. Files to Create/Modify

### New Files:
- `backend/migrations/XXX_create_rent_due_date_changes.sql`
- `backend/email-templates/rent-due-date-change-request.html`
- `backend/email-templates/rent-due-date-change-confirmed.html`
- `frontend/src/components/tenancies/ChangeRentDueDateModal.vue`
- `frontend/src/components/tenancies/TenancyActionsCard.vue`
- `frontend/src/views/TenantRentChangeConfirmation.vue`

### Modified Files:
- `backend/src/routes/tenancies.ts` - Add new endpoints
- `frontend/src/components/tenancies/TenancyDetailDrawer.vue` - Update actions UI
- `frontend/src/router/index.ts` - Add public confirmation route

---

## Questions for Confirmation

1. **Effective date:** Should the new rent due date take effect immediately after activation, or from the next rental period?

2. **Multiple tenants:** If there are multiple tenants, should all receive the email, or just the lead tenant?

3. **Calculation direction:** If changing from 24th to 1st, should we calculate:
   - 7 days forward (24th → 1st of next month), OR
   - 17 days backward (1st → 24th)?
   The first option seems more logical (tenant pays for extra days until new cycle starts).

4. **Agreement update:** Should we also update the rent_due_day on the signed agreement PDF, or just the tenancy record?

---

Ready to proceed with implementation?

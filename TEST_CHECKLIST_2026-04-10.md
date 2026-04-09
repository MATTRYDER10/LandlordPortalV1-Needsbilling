# Test Checklist — April 10th 2026

All changes from April 9th session. 14 modified files, 2 new files, ~570 lines changed.

---

## 1. Agreement Signing Page — Title Display

**What changed:** Signing page now shows actual agreement type instead of always "AST"

- [ ] Create/open an AST agreement → signing page shows "Assured Shorthold Tenancy Agreement"
- [ ] Create/open an APTA agreement → shows "Assured Periodic Tenancy Agreement"
- [ ] Create/open a Company Let → shows "Company Let Agreement"
- [ ] Create/open a Lodger agreement → shows "Lodger Agreement"
- [ ] Create/open a Holiday Let → shows "Holiday Let Agreement"
- [ ] Welsh agreement still shows "Welsh Occupation Contract"

---

## 2. Holiday Let Template — Landlord Email & Phone

**What changed:** Added landlord phone row + fixed email/phone merge in PDF generation

- [ ] Generate a holiday let agreement PDF
- [ ] Landlord section shows: Name, Email (actual email, not `[landlord_email]`), Phone (actual number)
- [ ] Guest section shows: Name, Address, Email, Phone (populated if available)
- [ ] For managed property: email/phone should show agent's details, not landlord's
- [ ] For let-only property: email/phone should show landlord's details

---

## 3. Auth Token Refresh (403 Fix)

**What changed:** authFetch now auto-refreshes tokens on 403, retries once

- [ ] Log in, leave app idle for 1+ hour, then navigate — should NOT get logged out or see errors
- [ ] Open browser dev tools Network tab — no 403 responses during normal use
- [ ] If token truly expires, app should silently refresh and retry (no user-visible error)
- [ ] If session is dead (e.g. password changed), redirects cleanly to /login
- [ ] Multiple tabs open simultaneously — all should keep working

---

## 4. RentGoose — All Active Tenancies Appear

**What changed:** Removed fee gate; management_type on tenancy is the gate instead

- [ ] Tenancy with `management_type = managed` → appears in RentGoose rents
- [ ] Tenancy with `management_type = let_only` → appears in RentGoose rents (month 1 only)
- [ ] Tenancy with `management_type = null` (not set) → does NOT appear
- [ ] Managed tenancy with 0% fee → still appears (zero charges at payout)
- [ ] Let-only tenancy → only month 1 schedule entry generated (no month 2)
- [ ] Managed tenancy → month 1 + month 2 generated, rolling extends

---

## 5. RentGoose — Landlord Board Retention

**What changed:** Landlords with payout history stay on board even if property off management

- [ ] Landlord with active tenancy → shows on RentGoose Landlords tab
- [ ] End a tenancy / remove management → landlord STILL shows (has payout history)
- [ ] Landlord with no active tenancies but past payouts → shows with `total_paid` figure
- [ ] Landlord with no payouts and no active tenancies → does NOT show
- [ ] Statements for historical landlords are still accessible

---

## 6. Management Type Sync

**What changed:** Changing management_type on tenancy drawer also updates the property

- [ ] Open tenancy drawer → change management type from "Managed" to "Let Only"
- [ ] Navigate to the property → management type now shows "Let Only"
- [ ] Change it back on tenancy → property updates again
- [ ] Other tenancies on the same property reflect the change

---

## 7. Auto-Receipt Month 1 from Initial Monies

**What changed:** When initial monies are confirmed, month 1 auto-receipts and goes to payout queue

**Scenario A — Initial monies confirmed BEFORE activation:**
- [ ] Send initial monies invoice → tenant pays → confirm payment
- [ ] Activate tenancy
- [ ] Check RentGoose → month 1 should show as "Paid" immediately
- [ ] Check Payouts tab → month 1 should be in payout queue ready for landlord payment
- [ ] Client account shows `initial_monies_rent_in` entry (money IN)
- [ ] NO duplicate `rent_in` entry (money should only be posted once)

**Scenario B — Activation BEFORE initial monies:**
- [ ] Activate tenancy first → month 1 shows as "Upcoming" or "Due"
- [ ] Then confirm initial monies
- [ ] Month 1 auto-updates to "Paid" → appears in payout queue
- [ ] Same client account checks as above

---

## 8. Holding Deposit — V2 Offers

**What changed:** 3-tier lookup (tenancy field → V1 offer → V2 reference), self-healing backfill

- [ ] Create a V2 offer with holding deposit → convert to tenancy
- [ ] Open Initial Monies modal → "Holding Deposit Paid" shows correct amount (not £0)
- [ ] For existing draft tenancies (converted via V2 before this fix): open Initial Monies modal → should now show correct holding deposit
- [ ] After opening modal once, the tenancy record is backfilled (check DB: `tenancies.holding_deposit_amount`)
- [ ] V1 legacy tenancies still work (holding deposit from tenant_offers)

---

## 9. Holding Deposit Linkage on Conversion

**What changed:** Expected payment for holding deposit gets tenancy_id set during V2 conversion

- [ ] Convert a V2 reference with holding deposit to tenancy
- [ ] Check `expected_payments` table → holding deposit record should have `tenancy_id` set
- [ ] No errors in console during conversion

---

## 10. Fee Copying on New Property

**What changed:** When creating property with existing landlord, copies fees from their other property

- [ ] Create a property, assign an existing landlord who has another property with 10% fee
- [ ] New property should auto-populate with 10% fee, same fee type, letting fee
- [ ] Edit the new property's fee independently → should NOT change the original property's fees
- [ ] Create a property with a brand new landlord → no fee copied (nothing to copy from)
- [ ] Create a property with no landlord → no fee copied

---

## 11. Edit Agency Fees Modal (NEW)

**What changed:** "Fees" button on RentGoose rent entries opens a fee editor

- [ ] Go to RentGoose → Payments tab
- [ ] Click "Fees" button on a rent entry
- [ ] Modal opens showing current fee %, type (% vs £), and letting fee
- [ ] Change the fee → click Save
- [ ] Modal closes, rent board refreshes
- [ ] Navigate to property → fee is updated there too
- [ ] Toggle between % and £ fee type → saves correctly

---

## 12. Payment History & Rent Credit Modal (NEW)

**What changed:** "History" button shows full rent history with credit capability

- [ ] Click "History" button on a rent entry
- [ ] Modal shows all months: period, amount due, amount received, status
- [ ] Payment details expand showing individual payments per month
- [ ] Click "Add Credit" on an unpaid month
- [ ] Enter credit amount (e.g. £50) and reason → click Apply
- [ ] Amount due reduces by £50, credit shows in the table
- [ ] Apply a second credit to the same month → amount reduces further (no double-dip)
- [ ] If credit + received covers new amount due → status auto-updates to "Paid"
- [ ] Period column shows "1 Apr – 30 Apr 2026" format (not just "Apr 2026")

---

## 13. Dark Mode — Receipt Modal

**What changed:** Fixed text contrast on dark backgrounds

- [ ] Enable dark mode
- [ ] Open Receipt Payment modal
- [ ] All text is readable: title, tenant name, ref, labels, amounts, charges, summary
- [ ] Partial payment options text is visible
- [ ] Agent charges checkbox labels are visible
- [ ] "Rent received" / "Agent charges" / "Landlord payout" summary text is visible

---

## 14. Confirm Initial Monies — Holding Deposit in Payout Split

**What changed:** confirm-initial-monies now uses 3-tier holding deposit lookup for payout_split

- [ ] For a V2 tenancy: confirm initial monies
- [ ] Check `expected_payments.payout_split` → `landlord_rent` amount should be (first month rent - holding deposit), NOT the full rent
- [ ] Payout to landlord should reflect the correct net amount

---

## Quick Smoke Tests

- [ ] Frontend builds: `cd frontend && npm run build` ✓
- [ ] Backend builds: `cd backend && npx tsc --noEmit` ✓
- [ ] Login/logout works normally
- [ ] Navigate between all main pages without errors
- [ ] RentGoose loads without console errors
- [ ] Dark mode toggle works across the app

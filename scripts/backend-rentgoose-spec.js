/**
 * Backend Specification: RentGoose Overhaul
 *
 * Add these endpoints to the shared PropertyGoose backend
 * under the landlord-portal router.
 *
 * ═══════════════════════════════════════════════════════
 * NEW ENDPOINTS
 * ═══════════════════════════════════════════════════════
 */

/**
 * GET /api/landlord-portal/rentgoose/settings
 *
 * Returns the landlord's RentGoose settings.
 *
 * Response:
 *   { "auto_chase_enabled": true }
 *
 * If no settings row exists, create one with auto_chase_enabled = false.
 */

/**
 * PUT /api/landlord-portal/rentgoose/settings
 *
 * Updates the landlord's RentGoose settings.
 *
 * Body: { "auto_chase_enabled": true }
 * Response: { "auto_chase_enabled": true }
 */

/**
 * POST /api/landlord-portal/rentgoose/rent/:id/quick-chase
 *
 * Sends a quick chase reminder email to the tenant for a specific
 * overdue rent entry. Uses PG branding.
 *
 * Email content:
 *   Subject: "Rent Payment Reminder — [property_address]"
 *   Body:
 *     - "Your rent of £[amount] was due on [due_date]."
 *     - "It is now [X] days overdue."
 *     - "Please make payment to:"
 *     - "  Account Name: [landlord.bank_account_name]"
 *     - "  Sort Code: [landlord.bank_sort_code]"
 *     - "  Account Number: [landlord.bank_account_number]"
 *     - "If you have already paid, please disregard this reminder."
 *
 * The chase is logged in the rent entry's chase_history array:
 *   { type: 'quick', sent_at: ISO string, automated: false }
 *
 * Response: { "success": true, "message": "Chase email sent" }
 */

/**
 * ═══════════════════════════════════════════════════════
 * MODIFIED ENDPOINTS
 * ═══════════════════════════════════════════════════════
 */

/**
 * POST /api/landlord-portal/rentgoose/rent (MODIFIED)
 *
 * Add optional field to body:
 *   auto_populate: boolean (default false)
 *
 * When auto_populate is true, a daily cron job will automatically
 * create the next month's rent entry once this entry's due_date
 * has been surpassed — even if the tenant hasn't paid (arrears).
 *
 * The auto-created entry copies: property_id, tenant_name, amount,
 * and sets due_date to the same day next month.
 * auto_populate is inherited so the chain continues indefinitely.
 *
 * Response should include auto_populate field on the created entry.
 */

/**
 * GET /api/landlord-portal/rentgoose/rent (MODIFIED)
 *
 * New optional query parameter:
 *   month_window=true
 *
 * When month_window=true, return only entries for the current month
 * and next month (rolling 2-month window). Ignore the 'year' param.
 *
 * Each entry in response should now include:
 *   - auto_populate: boolean
 *   - auto_created: boolean (true if created by the cron job)
 *   - property_address: string (denormalized for display)
 *   - chase_history: Array<{
 *       type: number | 'quick',
 *       sent_at: string (ISO),
 *       automated: boolean
 *     }>
 *   - tenancy_id: string | null (link to tenancy if created via activation)
 */

/**
 * POST /api/tenancies/records/:id/activate (MODIFIED)
 *
 * On successful activation, also create a RentGoose rent entry:
 *   - property_id: tenancy.property_id
 *   - tenant_name: lead tenant's full name (or all tenant names)
 *   - due_date: next occurrence of tenancy.rent_due_day from today
 *   - amount: tenancy.monthly_rent
 *   - auto_populate: true
 *   - auto_created: false (this is the initial entry)
 *   - tenancy_id: tenancy.id
 *   - status: 'pending'
 *
 * This is a side-effect — if the rent entry creation fails,
 * log the error but don't fail the activation.
 *
 * POST /api/tenancies/records/:id/end (MODIFIED)
 *
 * When a tenancy is ended, stop auto-populating rent:
 *   UPDATE rentgoose_rent_entries
 *   SET auto_populate = false
 *   WHERE tenancy_id = :tenancyId AND auto_populate = true
 *
 * This prevents the cron job from creating future rent entries
 * for ended tenancies. Existing overdue entries remain for chase/receipting.
 */

/**
 * ═══════════════════════════════════════════════════════
 * OFFER → TENANCY LINKAGE (Backend change needed)
 * ═══════════════════════════════════════════════════════
 *
 * POST /api/v2/references/:id/convert (MODIFIED)
 *
 * When converting a reference to a tenancy:
 * 1. Look up if the reference has a linked offer (via reference.offer_id)
 * 2. If found, update the offer with tenancy_id:
 *    UPDATE tenant_offers SET tenancy_id = :newTenancyId WHERE id = :offerId
 *
 * GET /api/tenant-offers (MODIFIED)
 *
 * Include tenancy_id in the offer response so the frontend can show
 * "Tenancy Created" badge and a "View Tenancy" link.
 *
 * GET /api/notifications/badge-counts (MODIFIED)
 *
 * Add overdue_rent count to the response:
 *   SELECT COUNT(*) FROM rentgoose_rent_entries
 *   WHERE company_id = :companyId
 *   AND status != 'received'
 *   AND due_date < CURRENT_DATE
 *
 * Response should include: { ..., overdue_rent: 3 }
 *
 * GET /api/landlord-portal/rentgoose/statement/:year (MODIFIED)
 *
 * When query param tax_year=true is passed, the year parameter
 * represents the START of the UK tax year. Use date range:
 *   FROM: {year}-04-06
 *   TO:   {year+1}-04-05
 * instead of calendar year Jan 1 - Dec 31.
 *
 * GET /api/landlord-portal/rentgoose/expenses (MODIFIED)
 *
 * Same tax_year=true logic: filter expenses by Apr 6 to Apr 5 range.
 */

/**
 * ═══════════════════════════════════════════════════════
 * DATABASE CHANGES
 * ═══════════════════════════════════════════════════════
 */

/*
-- RentGoose settings per company
CREATE TABLE IF NOT EXISTS rentgoose_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) UNIQUE,
  auto_chase_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add new columns to rent entries table
ALTER TABLE rentgoose_rent_entries
  ADD COLUMN IF NOT EXISTS auto_populate BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_created BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS tenancy_id UUID REFERENCES tenancy_records(id),
  ADD COLUMN IF NOT EXISTS chase_history JSONB DEFAULT '[]'::jsonb;
*/

/**
 * ═══════════════════════════════════════════════════════
 * CRON JOB: Daily at 08:00 UTC
 * ═══════════════════════════════════════════════════════
 *
 * 1. AUTO-POPULATE RENTS
 *    For each rent entry where:
 *      - auto_populate = true
 *      - due_date < NOW()
 *      - No successor entry exists (same property_id, tenant_name,
 *        amount, with due_date = this.due_date + 1 month)
 *    Create the next month's entry with:
 *      - due_date: same day, next month
 *      - auto_populate: true
 *      - auto_created: true
 *      - status: 'pending'
 *      - Copy: property_id, tenant_name, amount, tenancy_id
 *
 * 2. AUTO-CHASE OVERDUE RENTS
 *    For each company where rentgoose_settings.auto_chase_enabled = true:
 *      For each rent entry where status != 'received' and due_date < NOW():
 *        Calculate days_overdue = CURRENT_DATE - due_date
 *        For each milestone in [7, 14, 21, 28]:
 *          If days_overdue >= milestone AND no chase_history entry
 *          exists with type = milestone:
 *            - Send PG-branded chase email to tenant
 *            - Append to chase_history: { type: milestone, sent_at: NOW(), automated: true }
 *
 * Chase email template:
 *   Subject: "Rent Payment Reminder — [property_address]"
 *   Body uses PG branding (HTML template at /backend/email-templates/rent-chase.html)
 *   with {{ VariableName }} syntax:
 *     {{ TenantName }}
 *     {{ Amount }}         (e.g. "£850.00")
 *     {{ DueDate }}        (e.g. "1st April 2026")
 *     {{ DaysOverdue }}    (e.g. "14")
 *     {{ BankAccountName }}
 *     {{ BankSortCode }}
 *     {{ BankAccountNumber }}
 *     {{ PropertyAddress }}
 *     {{ LandlordName }}
 */

module.exports = {}

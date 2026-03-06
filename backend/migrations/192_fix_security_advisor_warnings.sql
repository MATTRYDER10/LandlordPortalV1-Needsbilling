-- Migration 192: Fix Supabase Security Advisor warnings (45 items)
-- Backend uses service_role key which bypasses RLS entirely.
-- Frontend only uses anon key for auth, never queries tables directly.

-- ============================================================================
-- PART 1: Function Search Path (25 warnings)
-- Pin search_path to prevent search path injection attacks
-- ============================================================================

-- Trigger functions (no parameters)
ALTER FUNCTION update_work_items_updated_at() SET search_path = public;
ALTER FUNCTION update_agreement_signatures_updated_at() SET search_path = public;
ALTER FUNCTION update_chase_dependencies_updated_at() SET search_path = public;
ALTER FUNCTION update_compliance_status() SET search_path = public;
ALTER FUNCTION update_rent_due_date_changes_updated_at() SET search_path = public;
ALTER FUNCTION update_section8_notices_updated_at() SET search_path = public;
ALTER FUNCTION update_staff_users_updated_at() SET search_path = public;
ALTER FUNCTION update_tenancies_updated_at() SET search_path = public;
ALTER FUNCTION update_tenant_change_payments_updated_at() SET search_path = public;
ALTER FUNCTION update_tenant_changes_updated_at() SET search_path = public;
ALTER FUNCTION update_tenant_offers_updated_at() SET search_path = public;
ALTER FUNCTION update_tenant_references_updated_at() SET search_path = public;
ALTER FUNCTION update_updated_at_column() SET search_path = public;
ALTER FUNCTION update_verification_sections_updated_at() SET search_path = public;
ALTER FUNCTION update_verification_steps_updated_at() SET search_path = public;
ALTER FUNCTION update_work_item_activity_on_contact() SET search_path = public;
ALTER FUNCTION check_ownership_percentage() SET search_path = public;
ALTER FUNCTION auto_create_work_item() SET search_path = public;
ALTER FUNCTION handle_new_user() SET search_path = public;
-- Functions with parameters
ALTER FUNCTION initialize_verification_sections(UUID) SET search_path = public;
ALTER FUNCTION calculate_work_item_urgency(TIMESTAMP WITH TIME ZONE) SET search_path = public;
ALTER FUNCTION calculate_compliance_expiry(TEXT, DATE) SET search_path = public;
ALTER FUNCTION generate_tenancy_reference_number(UUID) SET search_path = public;
ALTER FUNCTION cleanup_old_audit_logs(INTEGER) SET search_path = public;
ALTER FUNCTION notify_new_tenant_reference() SET search_path = public;
ALTER FUNCTION get_user_company() SET search_path = public;


-- ============================================================================
-- PART 2: Dangerous RLS Policies — `-` role (all roles including anon)
-- Drop overly permissive policies, replace with USING(false)
-- ============================================================================

-- rent_increase_notices: ALL true for `-` (all roles)
DROP POLICY IF EXISTS "Users can manage rent increase notices" ON rent_increase_notices;
CREATE POLICY "Service role only" ON rent_increase_notices FOR ALL USING (false);

-- tenancy_notes: ALL true for `-` (all roles)
-- Already has proper scoped policies from migration 164 (view/insert/update/delete)
DROP POLICY IF EXISTS "Users can manage tenancy notes" ON tenancy_notes;

-- email_events: ALL true for `-` + INSERT/UPDATE true for authenticated
DROP POLICY IF EXISTS "Service role can manage email events" ON email_events;
DROP POLICY IF EXISTS "System can insert email events" ON email_events;
DROP POLICY IF EXISTS "System can update email events" ON email_events;
CREATE POLICY "Service role only" ON email_events FOR ALL USING (false);

-- tenancy_activity: INSERT true for `-` (all roles)
DROP POLICY IF EXISTS "Authenticated users can insert tenancy activity" ON tenancy_activity;
CREATE POLICY "Service role only insert" ON tenancy_activity FOR INSERT WITH CHECK (false);

-- companies: INSERT true for `-` (all roles)
-- handle_new_user() is SECURITY DEFINER so it bypasses RLS
DROP POLICY IF EXISTS "Allow company creation on signup" ON companies;
CREATE POLICY "Service role only insert" ON companies FOR INSERT WITH CHECK (false);


-- ============================================================================
-- PART 3: Permissive Reference & Audit Policies
-- Public form submissions go through backend API (service_role)
-- ============================================================================

-- Reference tables — drop INSERT/UPDATE true policies
DROP POLICY IF EXISTS "Allow public insert with token" ON accountant_references;
DROP POLICY IF EXISTS "Allow public update with token" ON accountant_references;
CREATE POLICY "Service role only write" ON accountant_references FOR ALL USING (false);

DROP POLICY IF EXISTS "Allow public insert on agent_references" ON agent_references;
CREATE POLICY "Service role only write" ON agent_references FOR ALL USING (false);

DROP POLICY IF EXISTS "Allow public insert on employer_references" ON employer_references;
CREATE POLICY "Service role only write" ON employer_references FOR ALL USING (false);

DROP POLICY IF EXISTS "Allow public insert on landlord_references" ON landlord_references;
CREATE POLICY "Service role only write" ON landlord_references FOR ALL USING (false);

-- Audit/log tables — drop INSERT true policies
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
CREATE POLICY "Service role only write" ON audit_logs FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "System can create notifications" ON notification_queue;
CREATE POLICY "Service role only insert" ON notification_queue FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "System can insert offer audit log entries" ON offer_audit_log;
CREATE POLICY "Service role only write" ON offer_audit_log FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "System can insert property audit logs" ON property_audit_log;
CREATE POLICY "Service role only write" ON property_audit_log FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "System can insert audit log entries" ON reference_audit_log;
CREATE POLICY "Service role only write" ON reference_audit_log FOR INSERT WITH CHECK (false);

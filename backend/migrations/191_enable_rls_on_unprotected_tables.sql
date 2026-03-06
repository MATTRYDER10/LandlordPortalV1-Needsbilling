-- Migration 191: Enable RLS on all unprotected public tables
-- The backend uses service_role key which bypasses RLS entirely.
-- These policies only affect direct anon-key access via PostgREST.

-- 1. creditsafe_verifications
ALTER TABLE creditsafe_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON creditsafe_verifications FOR ALL USING (false);

-- 2. sanctions_screenings
ALTER TABLE sanctions_screenings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON sanctions_screenings FOR ALL USING (false);

-- 3. verification_checks
ALTER TABLE verification_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON verification_checks FOR ALL USING (false);

-- 4. subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON subscriptions FOR ALL USING (false);

-- 5. agreement_payments
ALTER TABLE agreement_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON agreement_payments FOR ALL USING (false);

-- 6. pricing_config (read-only lookup, allow authenticated reads)
ALTER TABLE pricing_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read pricing" ON pricing_config FOR SELECT TO authenticated USING (true);

-- 7. guarantor_reference_payments
ALTER TABLE guarantor_reference_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON guarantor_reference_payments FOR ALL USING (false);

-- 8. evidence_source_options (read-only lookup, allow authenticated reads)
ALTER TABLE evidence_source_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read evidence options" ON evidence_source_options FOR SELECT TO authenticated USING (true);

-- 9. credit_transactions
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON credit_transactions FOR ALL USING (false);

-- 10. sent_offer_forms
ALTER TABLE sent_offer_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON sent_offer_forms FOR ALL USING (false);

-- 11. guarantor_references
ALTER TABLE guarantor_references ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON guarantor_references FOR ALL USING (false);

-- 12. section_notices
ALTER TABLE section_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON section_notices FOR ALL USING (false);

-- 13. company_integrations (already has RLS enabled per migration 181, but re-enable to be safe)
ALTER TABLE company_integrations ENABLE ROW LEVEL SECURITY;

-- 14. tds_registrations
ALTER TABLE tds_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON tds_registrations FOR ALL USING (false);

-- 15. tenant_change_signatures
ALTER TABLE tenant_change_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON tenant_change_signatures FOR ALL USING (false);

-- 16. tenant_change_signature_events
ALTER TABLE tenant_change_signature_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON tenant_change_signature_events FOR ALL USING (false);

-- 17. payment_requests
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON payment_requests FOR ALL USING (false);

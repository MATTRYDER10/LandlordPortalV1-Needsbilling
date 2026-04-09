-- Enable RLS on tables that were missing it (flagged by Supabase security advisor)
-- Tables: ig_appointments, jmi_moves, landlord_service_types, property_charges, negotiators, expected_payments

-- ============================================================================
-- ig_appointments
-- ============================================================================
ALTER TABLE ig_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view their company's ig appointments"
  ON ig_appointments FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company members can create ig appointments for their company"
  ON ig_appointments FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company members can update their company's ig appointments"
  ON ig_appointments FOR UPDATE TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company members can delete their company's ig appointments"
  ON ig_appointments FOR DELETE TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- jmi_moves
-- ============================================================================
ALTER TABLE jmi_moves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view their company's jmi moves"
  ON jmi_moves FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company members can create jmi moves for their company"
  ON jmi_moves FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company members can update their company's jmi moves"
  ON jmi_moves FOR UPDATE TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company members can delete their company's jmi moves"
  ON jmi_moves FOR DELETE TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- landlord_service_types
-- ============================================================================
ALTER TABLE landlord_service_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view their company's service types"
  ON landlord_service_types FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company members can create service types for their company"
  ON landlord_service_types FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company members can update their company's service types"
  ON landlord_service_types FOR UPDATE TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company members can delete their company's service types"
  ON landlord_service_types FOR DELETE TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- property_charges
-- ============================================================================
ALTER TABLE property_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view their company's property charges"
  ON property_charges FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company members can create property charges for their company"
  ON property_charges FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company members can update their company's property charges"
  ON property_charges FOR UPDATE TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company members can delete their company's property charges"
  ON property_charges FOR DELETE TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- negotiators
-- ============================================================================
ALTER TABLE negotiators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view their company's negotiators"
  ON negotiators FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company members can create negotiators for their company"
  ON negotiators FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company members can update their company's negotiators"
  ON negotiators FOR UPDATE TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company members can delete their company's negotiators"
  ON negotiators FOR DELETE TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- expected_payments
-- ============================================================================
ALTER TABLE expected_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view their company's expected payments"
  ON expected_payments FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company members can create expected payments for their company"
  ON expected_payments FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company members can update their company's expected payments"
  ON expected_payments FOR UPDATE TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company members can delete their company's expected payments"
  ON expected_payments FOR DELETE TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

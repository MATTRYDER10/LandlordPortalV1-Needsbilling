CREATE TABLE IF NOT EXISTS mydeposits_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  scheme_type TEXT NOT NULL DEFAULT 'custodial' CHECK (scheme_type IN ('custodial', 'insurance')),
  deposit_id TEXT,
  deposit_amount DECIMAL(10, 2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'registered', 'failed')),
  certificate_url TEXT,
  registered_at TIMESTAMPTZ,
  registered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  error_message TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenancy_id, scheme_type)
);

CREATE INDEX IF NOT EXISTS idx_mydeposits_registrations_tenancy ON mydeposits_registrations(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_mydeposits_registrations_company ON mydeposits_registrations(company_id);
CREATE INDEX IF NOT EXISTS idx_mydeposits_registrations_status ON mydeposits_registrations(status);

ALTER TABLE mydeposits_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mydeposits_registrations_insert" ON mydeposits_registrations
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "mydeposits_registrations_select" ON mydeposits_registrations
  FOR SELECT
  USING (true);

CREATE POLICY "mydeposits_registrations_update" ON mydeposits_registrations
  FOR UPDATE
  USING (true);

CREATE POLICY "mydeposits_registrations_delete" ON mydeposits_registrations
  FOR DELETE
  USING (true);

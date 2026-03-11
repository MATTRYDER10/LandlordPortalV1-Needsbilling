CREATE TABLE IF NOT EXISTS reposit_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reposit_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  monthly_rent INTEGER NOT NULL,
  total_fee INTEGER,
  per_tenant_fee INTEGER,
  headcount INTEGER NOT NULL DEFAULT 1,
  tenancy_start_date DATE NOT NULL,
  tenancy_end_date DATE,
  agent_id TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  tenant_confirmed_at TIMESTAMPTZ,
  tenant_signed_at TIMESTAMPTZ,
  tenant_paid_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reposit_registrations_tenancy ON reposit_registrations(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_reposit_registrations_company ON reposit_registrations(company_id);
CREATE INDEX IF NOT EXISTS idx_reposit_registrations_status ON reposit_registrations(status);
CREATE INDEX IF NOT EXISTS idx_reposit_registrations_reposit_id ON reposit_registrations(reposit_id);

ALTER TABLE reposit_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company reposit registrations"
  ON reposit_registrations FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert reposit registrations for their company"
  ON reposit_registrations FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company reposit registrations"
  ON reposit_registrations FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE reposit_registrations IS 'Reposit deposit replacement registrations for tenancies';
COMMENT ON COLUMN reposit_registrations.reposit_id IS 'Reposit ID from API (rep_ or tnc_ prefix)';
COMMENT ON COLUMN reposit_registrations.status IS 'draft, published, tenant_confirmed, tenant_signed, tenant_paid, completed, deactivated, closed';
COMMENT ON COLUMN reposit_registrations.monthly_rent IS 'Monthly rent in pence';
COMMENT ON COLUMN reposit_registrations.total_fee IS 'Total Reposit fee in pence';
COMMENT ON COLUMN reposit_registrations.per_tenant_fee IS 'Fee per tenant in pence';

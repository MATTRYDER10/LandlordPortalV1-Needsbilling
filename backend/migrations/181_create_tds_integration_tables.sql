-- Migration 181: Create TDS (Tenancy Deposit Scheme) integration tables
-- Tables for storing TDS Custodial API credentials and deposit registrations

-- ============================================================================
-- COMPANY INTEGRATIONS
-- Store encrypted TDS credentials per company
-- ============================================================================

CREATE TABLE IF NOT EXISTS company_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- TDS Custodial credentials (encrypted)
  tds_api_key_encrypted TEXT,
  tds_member_id VARCHAR(10),
  tds_branch_id VARCHAR(10),
  tds_environment VARCHAR(10) CHECK (tds_environment IN ('sandbox', 'live')),
  tds_connected_at TIMESTAMP WITH TIME ZONE,
  tds_last_tested_at TIMESTAMP WITH TIME ZONE,
  tds_last_test_status VARCHAR(20),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(company_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_company_integrations_company_id ON company_integrations(company_id);

-- RLS
ALTER TABLE company_integrations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view integrations for their company
CREATE POLICY "Users can view company integrations"
  ON company_integrations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = company_integrations.company_id
      AND cu.user_id = auth.uid()
    )
  );

-- Policy: Admin/Owner can insert integrations for their company
CREATE POLICY "Admins can insert company integrations"
  ON company_integrations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = company_integrations.company_id
      AND cu.user_id = auth.uid()
      AND cu.role IN ('admin', 'owner')
    )
  );

-- Policy: Admin/Owner can update integrations for their company
CREATE POLICY "Admins can update company integrations"
  ON company_integrations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = company_integrations.company_id
      AND cu.user_id = auth.uid()
      AND cu.role IN ('admin', 'owner')
    )
  );

-- Policy: Admin/Owner can delete integrations for their company
CREATE POLICY "Admins can delete company integrations"
  ON company_integrations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = company_integrations.company_id
      AND cu.user_id = auth.uid()
      AND cu.role IN ('admin', 'owner')
    )
  );


-- ============================================================================
-- TDS REGISTRATIONS
-- Store deposit registration records with TDS
-- ============================================================================

CREATE TABLE IF NOT EXISTS tds_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- TDS reference numbers
  dan VARCHAR(20) NOT NULL, -- Deposit Assurance Number
  batch_id VARCHAR(50),

  -- Registration details
  deposit_amount DECIMAL(10, 2) NOT NULL,
  deposit_received_date DATE,

  -- Audit fields
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  registered_by UUID REFERENCES auth.users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'registered',

  -- Store raw API response for debugging/audit
  raw_response JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tds_registrations_tenancy_id ON tds_registrations(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_tds_registrations_company_id ON tds_registrations(company_id);
CREATE INDEX IF NOT EXISTS idx_tds_registrations_dan ON tds_registrations(dan);
CREATE INDEX IF NOT EXISTS idx_tds_registrations_created_at ON tds_registrations(created_at DESC);

-- RLS
ALTER TABLE tds_registrations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view registrations for their company's tenancies
CREATE POLICY "Users can view tds registrations"
  ON tds_registrations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = tds_registrations.company_id
      AND cu.user_id = auth.uid()
    )
  );

-- Policy: Users can insert registrations for their company's tenancies
CREATE POLICY "Users can insert tds registrations"
  ON tds_registrations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = tds_registrations.company_id
      AND cu.user_id = auth.uid()
    )
  );


-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE company_integrations IS 'Store third-party integration credentials per company (TDS Custodial, etc.)';
COMMENT ON COLUMN company_integrations.tds_api_key_encrypted IS 'AES-256-GCM encrypted TDS API key';
COMMENT ON COLUMN company_integrations.tds_member_id IS 'TDS member ID (max 6 digits)';
COMMENT ON COLUMN company_integrations.tds_branch_id IS 'TDS branch ID (0 for single-branch members)';
COMMENT ON COLUMN company_integrations.tds_environment IS 'sandbox or live environment';

COMMENT ON TABLE tds_registrations IS 'Audit trail of deposits registered with TDS Custodial';
COMMENT ON COLUMN tds_registrations.dan IS 'Deposit Assurance Number issued by TDS';
COMMENT ON COLUMN tds_registrations.batch_id IS 'TDS batch ID for async processing';
COMMENT ON COLUMN tds_registrations.raw_response IS 'Full TDS API response for debugging';

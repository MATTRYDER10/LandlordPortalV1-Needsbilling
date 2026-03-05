-- Migration 165: Create TDS integration tables
-- company_integrations: Store encrypted TDS credentials per company
-- tds_registrations: Store deposit registration records from TDS

-- ============================================================================
-- COMPANY INTEGRATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS company_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- TDS Custodial Integration
  tds_api_key_encrypted TEXT,
  tds_member_id VARCHAR(10),
  tds_branch_id VARCHAR(10),
  tds_environment VARCHAR(10) CHECK (tds_environment IN ('sandbox', 'live')),
  tds_connected_at TIMESTAMP WITH TIME ZONE,
  tds_last_tested_at TIMESTAMP WITH TIME ZONE,
  tds_last_test_status VARCHAR(20) CHECK (tds_last_test_status IN ('success', 'failed')),
  tds_last_test_error TEXT,

  -- Future integrations can be added here (e.g., mydeposits, DPS)

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(company_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_company_integrations_company_id ON company_integrations(company_id);

-- RLS
ALTER TABLE company_integrations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view integrations for their own company
CREATE POLICY "Users can view their company integrations"
  ON company_integrations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = company_integrations.company_id
      AND cu.user_id = auth.uid()
    )
  );

-- Policy: Admins/Owners can insert integrations
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

-- Policy: Admins/Owners can update integrations
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

-- Policy: Admins/Owners can delete integrations
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
-- ============================================================================

CREATE TABLE IF NOT EXISTS tds_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- TDS Response Data
  dan VARCHAR(20) NOT NULL,  -- Deposit Account Number (e.g., "EW1234567")
  batch_id VARCHAR(50),

  -- Registration Details
  deposit_amount DECIMAL(10, 2) NOT NULL,
  deposit_received_date DATE,

  -- Who and When
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  registered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Status Tracking
  status VARCHAR(20) NOT NULL DEFAULT 'registered' CHECK (status IN (
    'pending',      -- Awaiting TDS processing
    'registered',   -- Successfully registered with TDS
    'failed'        -- Registration failed
  )),

  -- Error Handling
  error_message TEXT,

  -- Raw API Response (for debugging/audit)
  raw_response JSONB,

  -- DPC Certificate tracking
  dpc_downloaded_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent duplicate registrations for same tenancy
  UNIQUE(tenancy_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tds_registrations_tenancy_id ON tds_registrations(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_tds_registrations_company_id ON tds_registrations(company_id);
CREATE INDEX IF NOT EXISTS idx_tds_registrations_dan ON tds_registrations(dan);
CREATE INDEX IF NOT EXISTS idx_tds_registrations_status ON tds_registrations(status);

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

-- Policy: Authenticated users can insert registrations
CREATE POLICY "Authenticated users can insert tds registrations"
  ON tds_registrations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = tds_registrations.company_id
      AND cu.user_id = auth.uid()
    )
  );

-- Policy: Users can update their company's registrations
CREATE POLICY "Users can update tds registrations"
  ON tds_registrations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = tds_registrations.company_id
      AND cu.user_id = auth.uid()
    )
  );


-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE company_integrations IS 'Stores third-party API credentials per company (TDS, etc.)';
COMMENT ON COLUMN company_integrations.tds_api_key_encrypted IS 'AES-256-GCM encrypted TDS API key';
COMMENT ON COLUMN company_integrations.tds_environment IS 'sandbox or live - determines which TDS API URL to use';

COMMENT ON TABLE tds_registrations IS 'Records of deposits registered with TDS Custodial';
COMMENT ON COLUMN tds_registrations.dan IS 'Deposit Account Number returned by TDS (e.g., EW1234567)';
COMMENT ON COLUMN tds_registrations.batch_id IS 'TDS batch ID for tracking async registration';

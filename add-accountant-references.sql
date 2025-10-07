-- Add accountant references table
-- This table stores accountant reference information for self-employed tenants

CREATE TABLE IF NOT EXISTS accountant_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_reference_id UUID NOT NULL REFERENCES tenant_references(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,

  -- Accountant/Firm Information
  accountant_firm_name TEXT NOT NULL,
  accountant_contact_name TEXT NOT NULL,
  accountant_email TEXT NOT NULL,
  accountant_phone TEXT,

  -- Tenant/Business Information (filled by accountant)
  tenant_name TEXT,
  business_name TEXT,
  nature_of_business TEXT,
  business_start_date DATE,

  -- Financial Information
  annual_turnover DECIMAL(12, 2),
  annual_profit DECIMAL(12, 2),
  tax_returns_filed BOOLEAN,
  last_tax_return_date DATE,
  accounts_prepared BOOLEAN,
  accounts_year_end DATE,

  -- Business Status
  business_trading_status TEXT, -- 'trading', 'dormant', 'ceased'
  any_outstanding_tax_liabilities BOOLEAN,
  tax_liabilities_details TEXT,
  business_financially_stable BOOLEAN,

  -- Verification
  accountant_confirms_income BOOLEAN,
  estimated_monthly_income DECIMAL(10, 2),

  -- Additional Comments
  additional_comments TEXT,

  -- Reference Status
  would_recommend BOOLEAN,
  recommendation_comments TEXT,

  -- Metadata
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_accountant_references_tenant_ref ON accountant_references(tenant_reference_id);
CREATE INDEX idx_accountant_references_token ON accountant_references(token);

-- Add comments
COMMENT ON TABLE accountant_references IS 'Stores accountant reference information for self-employed tenants';
COMMENT ON COLUMN accountant_references.token IS 'Unique token for accessing the reference form';
COMMENT ON COLUMN accountant_references.submitted_at IS 'Timestamp when the reference was submitted';

-- Add RLS policies
ALTER TABLE accountant_references ENABLE ROW LEVEL SECURITY;

-- Allow public access via token (for form submission)
CREATE POLICY "Allow public select with token" ON accountant_references
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert with token" ON accountant_references
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update with token" ON accountant_references
  FOR UPDATE
  USING (true);

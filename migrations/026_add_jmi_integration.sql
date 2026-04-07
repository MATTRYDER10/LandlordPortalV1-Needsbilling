ALTER TABLE company_integrations
ADD COLUMN IF NOT EXISTS jmi_api_key_encrypted TEXT,
ADD COLUMN IF NOT EXISTS jmi_environment VARCHAR(20) DEFAULT 'sandbox',
ADD COLUMN IF NOT EXISTS jmi_connected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS jmi_last_tested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS jmi_last_test_status VARCHAR(20);

CREATE TABLE IF NOT EXISTS jmi_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id),
  jmi_move_id INTEGER,
  partner_move_identifier TEXT,
  move_type TEXT NOT NULL CHECK (move_type IN ('movein', 'moveout')),
  status TEXT NOT NULL DEFAULT 'submitted',
  jmi_status JSONB,
  customer_intro_url TEXT,
  void_status JSONB,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenancy_id, move_type)
);

CREATE INDEX IF NOT EXISTS idx_jmi_moves_tenancy_id ON jmi_moves(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_jmi_moves_company_id ON jmi_moves(company_id);

-- Migration 180: Create section8_notices table for Section 8 (Housing Act 1988) notices

CREATE TABLE IF NOT EXISTS section8_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tenancy_id UUID REFERENCES tenancies(id) ON DELETE SET NULL,

  -- Property and tenant details (stored separately in case tenancy is deleted)
  property_address TEXT NOT NULL,
  tenant_names TEXT NOT NULL,

  -- Grounds cited
  grounds TEXT[] NOT NULL, -- Array of ground IDs (e.g., ['ground-8', 'ground-10'])
  ground_numbers TEXT NOT NULL, -- Human readable (e.g., 'Ground 8, Ground 10')

  -- Financial
  total_arrears DECIMAL(10, 2),

  -- Key dates
  service_date DATE NOT NULL,
  earliest_court_date DATE NOT NULL,

  -- Generation details
  service_method TEXT NOT NULL CHECK (service_method IN ('email', 'first_class_post', 'personal_service', 'email_and_post')),
  status TEXT NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'served', 'expired', 'withdrawn', 'court_proceedings')),

  -- Document reference
  document_id UUID REFERENCES property_documents(id),
  document_ref TEXT NOT NULL,

  -- Serve workflow (populated when notice is officially served)
  served_at TIMESTAMP WITH TIME ZONE,
  served_by UUID REFERENCES auth.users(id),
  served_email_message_id TEXT,
  compliance_docs_sent JSONB, -- { how_to_rent: true, gas_cert: true, epc: true, eicr: true, agreement: true, deposit_cert: false }

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_section8_notices_tenancy_id ON section8_notices(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_section8_notices_company_id ON section8_notices(company_id);
CREATE INDEX IF NOT EXISTS idx_section8_notices_status ON section8_notices(status);
CREATE INDEX IF NOT EXISTS idx_section8_notices_document_ref ON section8_notices(document_ref);
CREATE INDEX IF NOT EXISTS idx_section8_notices_service_date ON section8_notices(service_date);

-- Enable RLS
ALTER TABLE section8_notices ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Companies can view their own section8 notices"
  ON section8_notices
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access to section8 notices"
  ON section8_notices
  FOR ALL
  USING (auth.role() = 'service_role');

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_section8_notices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_section8_notices_updated_at
  BEFORE UPDATE ON section8_notices
  FOR EACH ROW
  EXECUTE FUNCTION update_section8_notices_updated_at();

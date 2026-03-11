ALTER TABLE tenant_references_v2
  ADD COLUMN IF NOT EXISTS tenant_phone_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS annual_income DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS is_smoker BOOLEAN,
  ADD COLUMN IF NOT EXISTS has_pets BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pet_details TEXT,
  ADD COLUMN IF NOT EXISTS has_adverse_credit BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS adverse_credit_details TEXT,
  ADD COLUMN IF NOT EXISTS guarantor_reference_id UUID REFERENCES tenant_references_v2(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guarantor_for_reference_id UUID REFERENCES tenant_references_v2(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guarantor_relationship TEXT;

CREATE INDEX IF NOT EXISTS idx_tenant_references_v2_guarantor_for ON tenant_references_v2(guarantor_for_reference_id);

CREATE TABLE IF NOT EXISTS referees_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id UUID NOT NULL REFERENCES tenant_references_v2(id) ON DELETE CASCADE,
  referee_type TEXT NOT NULL CHECK (referee_type IN ('EMPLOYER', 'LANDLORD', 'ACCOUNTANT', 'AGENT')),
  referee_email_encrypted TEXT NOT NULL,
  referee_name TEXT,
  referee_phone_encrypted TEXT,
  form_token_hash TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'COMPLETED', 'EXPIRED')),
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  form_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referees_v2_reference_id ON referees_v2(reference_id);
CREATE INDEX IF NOT EXISTS idx_referees_v2_form_token_hash ON referees_v2(form_token_hash);
CREATE INDEX IF NOT EXISTS idx_referees_v2_status ON referees_v2(status);

CREATE TABLE IF NOT EXISTS evidence_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id UUID NOT NULL REFERENCES tenant_references_v2(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL,
  evidence_type TEXT NOT NULL DEFAULT 'document',
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by TEXT NOT NULL DEFAULT 'tenant',
  verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_v2_reference_id ON evidence_v2(reference_id);
CREATE INDEX IF NOT EXISTS idx_evidence_v2_section_type ON evidence_v2(section_type);

ALTER TABLE referees_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referees_v2_company_access" ON referees_v2
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_references_v2 tr
      WHERE tr.id = referees_v2.reference_id
      AND tr.company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "evidence_v2_company_access" ON evidence_v2
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_references_v2 tr
      WHERE tr.id = evidence_v2.reference_id
      AND tr.company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

COMMENT ON COLUMN tenant_references_v2.tenant_phone_encrypted IS 'Encrypted tenant phone number';
COMMENT ON COLUMN tenant_references_v2.annual_income IS 'Calculated total annual income from all sources';
COMMENT ON COLUMN tenant_references_v2.is_smoker IS 'Whether the tenant is a smoker';
COMMENT ON COLUMN tenant_references_v2.has_pets IS 'Whether the tenant has pets';
COMMENT ON COLUMN tenant_references_v2.pet_details IS 'Details about pets (type, breed, etc)';
COMMENT ON COLUMN tenant_references_v2.has_adverse_credit IS 'Whether tenant has adverse credit history';
COMMENT ON COLUMN tenant_references_v2.adverse_credit_details IS 'Details about adverse credit';
COMMENT ON COLUMN tenant_references_v2.guarantor_reference_id IS 'Link to the guarantor reference record';
COMMENT ON COLUMN tenant_references_v2.guarantor_for_reference_id IS 'If this is a guarantor reference, links to the tenant reference';
COMMENT ON COLUMN tenant_references_v2.guarantor_relationship IS 'Relationship of guarantor to tenant';

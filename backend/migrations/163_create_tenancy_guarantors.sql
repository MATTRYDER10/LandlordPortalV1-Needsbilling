-- Migration 163: Create tenancy_guarantors table
-- Stores guarantors associated with tenancies, mirroring tenant structure

CREATE TABLE IF NOT EXISTS tenancy_guarantors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,

  -- Link to source reference (optional - can be manually added)
  guarantor_reference_id UUID REFERENCES tenant_references(id),

  -- Link to the tenant they're guaranteeing (optional)
  guarantees_tenant_id UUID REFERENCES tenancy_tenants(id),

  -- Encrypted personal details
  first_name_encrypted TEXT NOT NULL,
  last_name_encrypted TEXT NOT NULL,
  email_encrypted TEXT,
  phone_encrypted TEXT,

  -- Address (encrypted)
  address_line1_encrypted TEXT,
  address_line2_encrypted TEXT,
  city_encrypted TEXT,
  postcode_encrypted TEXT,

  -- Relationship to tenant
  relationship_to_tenant TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenancy_guarantors_tenancy_id
  ON tenancy_guarantors(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_tenancy_guarantors_reference_id
  ON tenancy_guarantors(guarantor_reference_id);
CREATE INDEX IF NOT EXISTS idx_tenancy_guarantors_tenant_id
  ON tenancy_guarantors(guarantees_tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenancy_guarantors_active
  ON tenancy_guarantors(tenancy_id) WHERE status = 'active';

-- RLS Policies
ALTER TABLE tenancy_guarantors ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view guarantors for tenancies their company owns
CREATE POLICY "Users can view tenancy guarantors"
  ON tenancy_guarantors FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancies t
      JOIN properties p ON t.property_id = p.id
      JOIN companies c ON p.company_id = c.id
      JOIN company_users cu ON c.id = cu.company_id
      WHERE t.id = tenancy_guarantors.tenancy_id
      AND cu.user_id = auth.uid()
    )
  );

-- Policy: Users can insert guarantors for tenancies their company owns
CREATE POLICY "Users can insert tenancy guarantors"
  ON tenancy_guarantors FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenancies t
      JOIN properties p ON t.property_id = p.id
      JOIN companies c ON p.company_id = c.id
      JOIN company_users cu ON c.id = cu.company_id
      WHERE t.id = tenancy_guarantors.tenancy_id
      AND cu.user_id = auth.uid()
    )
  );

-- Policy: Users can update guarantors for tenancies their company owns
CREATE POLICY "Users can update tenancy guarantors"
  ON tenancy_guarantors FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tenancies t
      JOIN properties p ON t.property_id = p.id
      JOIN companies c ON p.company_id = c.id
      JOIN company_users cu ON c.id = cu.company_id
      WHERE t.id = tenancy_guarantors.tenancy_id
      AND cu.user_id = auth.uid()
    )
  );

-- Policy: Users can delete guarantors for tenancies their company owns
CREATE POLICY "Users can delete tenancy guarantors"
  ON tenancy_guarantors FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tenancies t
      JOIN properties p ON t.property_id = p.id
      JOIN companies c ON p.company_id = c.id
      JOIN company_users cu ON c.id = cu.company_id
      WHERE t.id = tenancy_guarantors.tenancy_id
      AND cu.user_id = auth.uid()
    )
  );

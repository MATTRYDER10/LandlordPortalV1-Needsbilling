-- Create section_notices table for tracking Section 8, Section 13, and other statutory notices
-- This table stores all formal notices served to tenants under UK housing law

CREATE TABLE IF NOT EXISTS section_notices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,

  -- Notice type: section_8 (possession), section_13 (rent increase), section_21 (no-fault eviction)
  notice_type TEXT NOT NULL CHECK (notice_type IN ('section_8', 'section_13', 'section_21')),

  -- Section 8 specific fields
  grounds INTEGER[] DEFAULT NULL, -- Array of ground numbers (e.g., {8, 10, 11})
  ground_details JSONB DEFAULT '{}', -- Details for each ground: {"8": "£2000 arrears", "10": "Late payments"}

  -- Section 13 (rent increase) specific fields
  current_rent DECIMAL(10, 2) DEFAULT NULL,
  new_rent DECIMAL(10, 2) DEFAULT NULL,

  -- Common fields
  notice_date DATE NOT NULL, -- When notice was served
  effective_date DATE DEFAULT NULL, -- When notice takes effect (Section 13: new rent starts)
  earliest_court_date DATE DEFAULT NULL, -- Earliest date landlord can apply to court (Section 8)
  hearing_date DATE DEFAULT NULL, -- Court hearing date if scheduled

  -- Delivery tracking
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('email', 'download', 'post', 'hand')),
  served_at TIMESTAMPTZ DEFAULT NOW(),
  served_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'served' CHECK (status IN ('draft', 'served', 'acknowledged', 'disputed', 'withdrawn', 'court_ordered', 'completed')),

  -- Response tracking
  tenant_acknowledged_at TIMESTAMPTZ DEFAULT NULL,
  tenant_disputed_at TIMESTAMPTZ DEFAULT NULL,
  dispute_reason TEXT DEFAULT NULL,

  -- For Section 13, tribunal referral
  tribunal_referred_at TIMESTAMPTZ DEFAULT NULL,
  tribunal_decision TEXT DEFAULT NULL,
  tribunal_decision_at TIMESTAMPTZ DEFAULT NULL,

  -- Additional notes (internal)
  additional_notes TEXT DEFAULT NULL,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_section_notices_tenancy_id ON section_notices(tenancy_id);
CREATE INDEX idx_section_notices_notice_type ON section_notices(notice_type);
CREATE INDEX idx_section_notices_status ON section_notices(status);
CREATE INDEX idx_section_notices_notice_date ON section_notices(notice_date);

-- Add trigger for updated_at
CREATE TRIGGER update_section_notices_updated_at
  BEFORE UPDATE ON section_notices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS policies
ALTER TABLE section_notices ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view notices for tenancies in their company
CREATE POLICY "Users can view section_notices for their company"
  ON section_notices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancies t
      JOIN properties p ON t.property_id = p.id
      WHERE t.id = section_notices.tenancy_id
        AND p.company_id IN (
          SELECT company_id FROM users WHERE id = auth.uid()
        )
    )
  );

-- Policy: Users can insert notices for tenancies in their company
CREATE POLICY "Users can insert section_notices for their company"
  ON section_notices
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenancies t
      JOIN properties p ON t.property_id = p.id
      WHERE t.id = section_notices.tenancy_id
        AND p.company_id IN (
          SELECT company_id FROM users WHERE id = auth.uid()
        )
    )
  );

-- Policy: Users can update notices for tenancies in their company
CREATE POLICY "Users can update section_notices for their company"
  ON section_notices
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tenancies t
      JOIN properties p ON t.property_id = p.id
      WHERE t.id = section_notices.tenancy_id
        AND p.company_id IN (
          SELECT company_id FROM users WHERE id = auth.uid()
        )
    )
  );

-- Add columns to tenancies table for notice tracking if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenancies' AND column_name = 'notice_served_at'
  ) THEN
    ALTER TABLE tenancies ADD COLUMN notice_served_at TIMESTAMPTZ DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenancies' AND column_name = 'notice_type'
  ) THEN
    ALTER TABLE tenancies ADD COLUMN notice_type TEXT DEFAULT NULL;
  END IF;
END $$;

COMMENT ON TABLE section_notices IS 'Tracks statutory notices served to tenants (Section 8, 13, 21 etc.)';
COMMENT ON COLUMN section_notices.grounds IS 'Section 8 grounds for possession (array of ground numbers)';
COMMENT ON COLUMN section_notices.ground_details IS 'JSON object with details for each ground';
COMMENT ON COLUMN section_notices.earliest_court_date IS 'Earliest date landlord can apply to court after notice period';

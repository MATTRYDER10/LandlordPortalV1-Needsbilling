-- Migration 179: Create rent_increase_notices table for Section 13 notices

CREATE TABLE IF NOT EXISTS rent_increase_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Rent details
  current_rent DECIMAL(10, 2) NOT NULL,
  new_rent DECIMAL(10, 2) NOT NULL,

  -- Dates
  notice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_date DATE NOT NULL,

  -- Delivery
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('email', 'download', 'post')),
  delivered_at TIMESTAMP WITH TIME ZONE,

  -- Status
  status TEXT NOT NULL DEFAULT 'served' CHECK (status IN ('served', 'accepted', 'referred_to_tribunal', 'withdrawn', 'expired')),

  -- Document reference
  document_id UUID REFERENCES property_documents(id),

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rent_increase_notices_tenancy_id ON rent_increase_notices(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_rent_increase_notices_company_id ON rent_increase_notices(company_id);
CREATE INDEX IF NOT EXISTS idx_rent_increase_notices_status ON rent_increase_notices(status);

-- Enable RLS
ALTER TABLE rent_increase_notices ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage rent increase notices" ON rent_increase_notices FOR ALL USING (true) WITH CHECK (true);

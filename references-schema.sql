-- PropertyGoose References Schema
-- Run this in Supabase SQL Editor after the multi-tenancy schema

-- Reference Status Enum
CREATE TYPE reference_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- References Table
CREATE TABLE tenant_references (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Tenant Information
  tenant_first_name TEXT NOT NULL,
  tenant_last_name TEXT NOT NULL,
  tenant_email TEXT NOT NULL,
  tenant_phone TEXT,

  -- Property Information
  property_address TEXT NOT NULL,
  property_city TEXT,
  property_postcode TEXT,
  monthly_rent DECIMAL(10, 2),
  move_in_date DATE,

  -- Reference Details
  status reference_status NOT NULL DEFAULT 'pending',
  reference_token TEXT UNIQUE NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Employment Information (filled by tenant)
  employment_status TEXT,
  employer_name TEXT,
  employer_contact TEXT,
  job_title TEXT,
  annual_income DECIMAL(10, 2),
  employment_start_date DATE,

  -- Previous Landlord Information (filled by tenant)
  previous_landlord_name TEXT,
  previous_landlord_email TEXT,
  previous_landlord_phone TEXT,
  previous_address TEXT,
  previous_tenancy_duration TEXT,

  -- Additional Information
  notes TEXT,
  internal_notes TEXT, -- Private notes for lettings agent

  -- Timestamps
  submitted_at TIMESTAMP WITH TIME ZONE, -- When tenant submits their info
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reference Documents Table (for uploading documents)
CREATE TABLE reference_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_id UUID NOT NULL REFERENCES tenant_references(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_tenant_references_company_id ON tenant_references(company_id);
CREATE INDEX idx_tenant_references_created_by ON tenant_references(created_by);
CREATE INDEX idx_tenant_references_status ON tenant_references(status);
CREATE INDEX idx_tenant_references_tenant_email ON tenant_references(tenant_email);
CREATE INDEX idx_tenant_references_token ON tenant_references(reference_token);
CREATE INDEX idx_reference_documents_reference_id ON reference_documents(reference_id);

-- Enable RLS
ALTER TABLE tenant_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for References
-- Users can view references for their company
CREATE POLICY "Users can view company references" ON tenant_references
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- Users can create references for their company
CREATE POLICY "Users can create company references" ON tenant_references
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- Users can update references for their company
CREATE POLICY "Users can update company references" ON tenant_references
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- Users can delete references for their company (owner/admin only via API)
CREATE POLICY "Users can delete company references" ON tenant_references
  FOR DELETE USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for Reference Documents
CREATE POLICY "Users can view company reference documents" ON reference_documents
  FOR SELECT USING (
    reference_id IN (
      SELECT id FROM tenant_references WHERE company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can upload reference documents" ON reference_documents
  FOR INSERT WITH CHECK (
    reference_id IN (
      SELECT id FROM tenant_references WHERE company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete reference documents" ON reference_documents
  FOR DELETE USING (
    reference_id IN (
      SELECT id FROM tenant_references WHERE company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tenant_references_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER tenant_references_updated_at
  BEFORE UPDATE ON tenant_references
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_references_updated_at();

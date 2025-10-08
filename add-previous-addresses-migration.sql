-- Migration: Add previous addresses table for 3-year address history tracking
-- This creates a separate table to store multiple previous addresses for tenants

-- Create previous addresses table
CREATE TABLE IF NOT EXISTS tenant_reference_previous_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_reference_id UUID NOT NULL REFERENCES tenant_references(id) ON DELETE CASCADE,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  postcode TEXT NOT NULL,
  country TEXT NOT NULL,
  time_at_address_years INTEGER NOT NULL DEFAULT 0,
  time_at_address_months INTEGER NOT NULL DEFAULT 0,
  address_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE tenant_reference_previous_addresses IS 'Stores previous addresses for tenants to build 3-year address history';
COMMENT ON COLUMN tenant_reference_previous_addresses.tenant_reference_id IS 'Reference to the main tenant reference';
COMMENT ON COLUMN tenant_reference_previous_addresses.address_line1 IS 'First line of previous address';
COMMENT ON COLUMN tenant_reference_previous_addresses.address_line2 IS 'Second line of previous address (optional)';
COMMENT ON COLUMN tenant_reference_previous_addresses.city IS 'City of previous address';
COMMENT ON COLUMN tenant_reference_previous_addresses.postcode IS 'Postcode/ZIP of previous address';
COMMENT ON COLUMN tenant_reference_previous_addresses.country IS 'Country of previous address';
COMMENT ON COLUMN tenant_reference_previous_addresses.time_at_address_years IS 'Number of years lived at this previous address (0-100)';
COMMENT ON COLUMN tenant_reference_previous_addresses.time_at_address_months IS 'Number of months lived at this previous address (0-11)';
COMMENT ON COLUMN tenant_reference_previous_addresses.address_order IS 'Order of addresses (0 = most recent previous, 1 = next previous, etc.)';

-- Add check constraints to ensure valid values
ALTER TABLE tenant_reference_previous_addresses
ADD CONSTRAINT check_prev_time_at_address_years
CHECK (time_at_address_years >= 0 AND time_at_address_years <= 100);

ALTER TABLE tenant_reference_previous_addresses
ADD CONSTRAINT check_prev_time_at_address_months
CHECK (time_at_address_months >= 0 AND time_at_address_months <= 11);

ALTER TABLE tenant_reference_previous_addresses
ADD CONSTRAINT check_prev_address_order
CHECK (address_order >= 0);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_prev_addresses_tenant_ref ON tenant_reference_previous_addresses(tenant_reference_id);
CREATE INDEX IF NOT EXISTS idx_prev_addresses_order ON tenant_reference_previous_addresses(tenant_reference_id, address_order);

-- Enable Row Level Security
ALTER TABLE tenant_reference_previous_addresses ENABLE ROW LEVEL SECURITY;

-- Create policy for users to access previous addresses for references in their company
CREATE POLICY "Users can view previous addresses for references in their company"
  ON tenant_reference_previous_addresses
  FOR SELECT
  USING (
    tenant_reference_id IN (
      SELECT id FROM tenant_references
      WHERE company_id IN (
        SELECT company_id FROM company_users
        WHERE user_id = auth.uid()
      )
    )
  );

-- Create policy for users to insert previous addresses for references in their company
CREATE POLICY "Users can insert previous addresses for references in their company"
  ON tenant_reference_previous_addresses
  FOR INSERT
  WITH CHECK (
    tenant_reference_id IN (
      SELECT id FROM tenant_references
      WHERE company_id IN (
        SELECT company_id FROM company_users
        WHERE user_id = auth.uid()
      )
    )
  );

-- Create policy for users to update previous addresses for references in their company
CREATE POLICY "Users can update previous addresses for references in their company"
  ON tenant_reference_previous_addresses
  FOR UPDATE
  USING (
    tenant_reference_id IN (
      SELECT id FROM tenant_references
      WHERE company_id IN (
        SELECT company_id FROM company_users
        WHERE user_id = auth.uid()
      )
    )
  );

-- Create policy for users to delete previous addresses for references in their company
CREATE POLICY "Users can delete previous addresses for references in their company"
  ON tenant_reference_previous_addresses
  FOR DELETE
  USING (
    tenant_reference_id IN (
      SELECT id FROM tenant_references
      WHERE company_id IN (
        SELECT company_id FROM company_users
        WHERE user_id = auth.uid()
      )
    )
  );

-- Create policy for public access via reference token (for tenant form submission)
CREATE POLICY "Public can manage previous addresses via reference token"
  ON tenant_reference_previous_addresses
  FOR ALL
  USING (
    tenant_reference_id IN (
      SELECT id FROM tenant_references
      WHERE reference_token IS NOT NULL
      AND token_expires_at > NOW()
    )
  )
  WITH CHECK (
    tenant_reference_id IN (
      SELECT id FROM tenant_references
      WHERE reference_token IS NOT NULL
      AND token_expires_at > NOW()
    )
  );

-- Migration to add structured fields for tenant references
-- Run this in Supabase SQL Editor

-- Add new employer contact fields
ALTER TABLE tenant_references
ADD COLUMN IF NOT EXISTS employer_email TEXT,
ADD COLUMN IF NOT EXISTS employer_phone TEXT;

-- Add new previous address fields
ALTER TABLE tenant_references
ADD COLUMN IF NOT EXISTS previous_street TEXT,
ADD COLUMN IF NOT EXISTS previous_city TEXT,
ADD COLUMN IF NOT EXISTS previous_postcode TEXT;

-- Add new tenancy duration fields
ALTER TABLE tenant_references
ADD COLUMN IF NOT EXISTS tenancy_years INTEGER,
ADD COLUMN IF NOT EXISTS tenancy_months INTEGER;

-- Add indexes for the new fields
CREATE INDEX IF NOT EXISTS idx_tenant_references_employer_email ON tenant_references(employer_email);
CREATE INDEX IF NOT EXISTS idx_tenant_references_previous_postcode ON tenant_references(previous_postcode);

-- Note: The old fields (employer_contact, previous_address, previous_tenancy_duration)
-- are kept for backward compatibility and can be deprecated later

-- Migration: Add Encrypted Fields for Names, Addresses, Company Info, and Signatures
-- For Creditsafe API compliance - everything must be encrypted

-- Add encrypted columns to tenant_references table
ALTER TABLE tenant_references
  ADD COLUMN IF NOT EXISTS tenant_first_name_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS tenant_last_name_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS property_address_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS property_city_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS property_postcode_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS employment_company_name_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS employment_position_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS guarantor_name_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS guarantor_relationship_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS previous_landlord_name_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS previous_landlord_address_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS accountant_name_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS accountant_firm_encrypted TEXT;

-- Add encrypted columns to landlord_references table
ALTER TABLE landlord_references
  ADD COLUMN IF NOT EXISTS landlord_name_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS property_address_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS property_city_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS property_postcode_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS signature_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS signature_name_encrypted TEXT;

-- Add encrypted columns to agent_references table
ALTER TABLE agent_references
  ADD COLUMN IF NOT EXISTS agent_name_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS agency_name_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS property_address_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS property_city_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS property_postcode_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS signature_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS signature_name_encrypted TEXT;

-- Add encrypted columns to employer_references table
ALTER TABLE employer_references
  ADD COLUMN IF NOT EXISTS company_name_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS employer_name_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS employer_position_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS employee_position_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS signature_encrypted TEXT;

-- Add encrypted columns to accountant_references table
ALTER TABLE accountant_references
  ADD COLUMN IF NOT EXISTS accountant_name_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS accountant_firm_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS business_name_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS signature_encrypted TEXT;

-- Add encrypted column to companies table
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS name_encrypted TEXT;

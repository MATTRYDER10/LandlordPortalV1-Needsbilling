-- Migration: Drop Plaintext Name, Address, Company, and Signature Columns
-- For Creditsafe API compliance - complete encryption of all sensitive data
-- WARNING: This drops all plaintext name, address, company, and signature columns

-- Drop plaintext columns from tenant_references
ALTER TABLE tenant_references
  DROP COLUMN IF EXISTS tenant_first_name,
  DROP COLUMN IF EXISTS tenant_last_name,
  DROP COLUMN IF EXISTS property_address,
  DROP COLUMN IF EXISTS property_city,
  DROP COLUMN IF EXISTS property_postcode,
  DROP COLUMN IF EXISTS employment_company_name,
  DROP COLUMN IF EXISTS employment_job_title,
  DROP COLUMN IF EXISTS previous_landlord_name,
  DROP COLUMN IF EXISTS accountant_name,
  DROP COLUMN IF EXISTS accountant_contact_name;

-- Drop plaintext columns from landlord_references
ALTER TABLE landlord_references
  DROP COLUMN IF EXISTS landlord_name,
  DROP COLUMN IF EXISTS property_address,
  DROP COLUMN IF EXISTS property_city,
  DROP COLUMN IF EXISTS property_postcode,
  DROP COLUMN IF EXISTS signature,
  DROP COLUMN IF EXISTS signature_name;

-- Drop plaintext columns from agent_references
ALTER TABLE agent_references
  DROP COLUMN IF EXISTS agent_name,
  DROP COLUMN IF EXISTS agency_name,
  DROP COLUMN IF EXISTS property_address,
  DROP COLUMN IF EXISTS property_city,
  DROP COLUMN IF EXISTS property_postcode,
  DROP COLUMN IF EXISTS signature,
  DROP COLUMN IF EXISTS signature_name;

-- Drop plaintext columns from employer_references
ALTER TABLE employer_references
  DROP COLUMN IF EXISTS company_name,
  DROP COLUMN IF EXISTS employer_name,
  DROP COLUMN IF EXISTS employer_position,
  DROP COLUMN IF EXISTS employee_position,
  DROP COLUMN IF EXISTS signature,
  DROP COLUMN IF EXISTS signature_name;

-- Drop plaintext columns from accountant_references
ALTER TABLE accountant_references
  DROP COLUMN IF EXISTS accountant_name,
  DROP COLUMN IF EXISTS accountant_firm,
  DROP COLUMN IF EXISTS business_name,
  DROP COLUMN IF EXISTS signature,
  DROP COLUMN IF EXISTS signature_name,
  DROP COLUMN IF EXISTS tenant_name;

-- Drop plaintext column from companies
ALTER TABLE companies
  DROP COLUMN IF EXISTS name;

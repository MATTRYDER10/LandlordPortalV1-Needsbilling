-- Migration: Remove Plaintext Columns (Full Encryption Mode)
-- WARNING: This drops all plaintext sensitive data columns
-- Only run this if you're ready to go full encrypted

-- First, clear all test data (optional - remove if you want to keep some data)
TRUNCATE TABLE landlord_references CASCADE;
TRUNCATE TABLE agent_references CASCADE;
TRUNCATE TABLE employer_references CASCADE;
TRUNCATE TABLE accountant_references CASCADE;
TRUNCATE TABLE reference_documents CASCADE;
TRUNCATE TABLE tenant_reference_previous_addresses CASCADE;
TRUNCATE TABLE tenant_references CASCADE;
TRUNCATE TABLE invitations CASCADE;

-- Drop RLS policies that depend on plaintext columns
DROP POLICY IF EXISTS "Public can manage previous addresses via reference token" ON tenant_reference_previous_addresses;

-- Drop plaintext token columns
ALTER TABLE invitations DROP COLUMN IF EXISTS token;
ALTER TABLE tenant_references DROP COLUMN IF EXISTS reference_token;
ALTER TABLE accountant_references DROP COLUMN IF EXISTS token;

-- Drop plaintext sensitive data columns from tenant_references
ALTER TABLE tenant_references
  DROP COLUMN IF EXISTS tenant_email,
  DROP COLUMN IF EXISTS tenant_phone,
  DROP COLUMN IF EXISTS contact_number,
  DROP COLUMN IF EXISTS date_of_birth,
  DROP COLUMN IF EXISTS employment_salary_amount,
  DROP COLUMN IF EXISTS self_employed_annual_income,
  DROP COLUMN IF EXISTS savings_amount,
  DROP COLUMN IF EXISTS employer_ref_email,
  DROP COLUMN IF EXISTS employer_ref_phone,
  DROP COLUMN IF EXISTS previous_landlord_email,
  DROP COLUMN IF EXISTS previous_landlord_phone,
  DROP COLUMN IF EXISTS accountant_email,
  DROP COLUMN IF EXISTS accountant_phone;

-- Drop plaintext sensitive data columns from invitations
ALTER TABLE invitations DROP COLUMN IF EXISTS email;

-- Drop plaintext sensitive data columns from landlord_references
ALTER TABLE landlord_references
  DROP COLUMN IF EXISTS landlord_email,
  DROP COLUMN IF EXISTS landlord_phone,
  DROP COLUMN IF EXISTS monthly_rent;

-- Drop plaintext sensitive data columns from agent_references
ALTER TABLE agent_references
  DROP COLUMN IF EXISTS agent_email,
  DROP COLUMN IF EXISTS agent_phone,
  DROP COLUMN IF EXISTS monthly_rent;

-- Drop plaintext sensitive data columns from employer_references
ALTER TABLE employer_references
  DROP COLUMN IF EXISTS employer_email,
  DROP COLUMN IF EXISTS employer_phone,
  DROP COLUMN IF EXISTS annual_salary;

-- Drop plaintext sensitive data columns from accountant_references
ALTER TABLE accountant_references
  DROP COLUMN IF EXISTS accountant_email,
  DROP COLUMN IF EXISTS accountant_phone,
  DROP COLUMN IF EXISTS annual_turnover,
  DROP COLUMN IF EXISTS annual_profit,
  DROP COLUMN IF EXISTS estimated_monthly_income;

-- Recreate RLS policy using hash-based token lookup
CREATE POLICY "Public can manage previous addresses via reference token hash"
  ON tenant_reference_previous_addresses
  FOR ALL
  USING (
    tenant_reference_id IN (
      SELECT id FROM tenant_references
      WHERE reference_token_hash = current_setting('request.jwt.claims', true)::json->>'reference_token_hash'
    )
  );

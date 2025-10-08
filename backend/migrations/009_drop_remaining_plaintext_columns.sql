-- Migration: Drop Remaining Plaintext Columns (Corrected Column Names)
-- This fixes migration 008 which had incorrect column names

-- Drop plaintext columns from accountant_references
ALTER TABLE accountant_references
  DROP COLUMN IF EXISTS accountant_firm_name,
  DROP COLUMN IF EXISTS accountant_contact_name;

-- Drop plaintext columns from landlord_references
ALTER TABLE landlord_references
  DROP COLUMN IF EXISTS property_address_line1,
  DROP COLUMN IF EXISTS property_address_line2;

-- Drop plaintext columns from agent_references
ALTER TABLE agent_references
  DROP COLUMN IF EXISTS property_address_line1,
  DROP COLUMN IF EXISTS property_address_line2;

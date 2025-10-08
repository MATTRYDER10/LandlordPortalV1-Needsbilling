-- Migration: Drop Plaintext Address Columns
-- Removes plaintext address fields after encryption migration is complete

-- Drop plaintext current address columns from tenant_references
ALTER TABLE tenant_references
  DROP COLUMN IF EXISTS current_address_line1,
  DROP COLUMN IF EXISTS current_address_line2,
  DROP COLUMN IF EXISTS current_city,
  DROP COLUMN IF EXISTS current_postcode,
  DROP COLUMN IF EXISTS current_country;

-- Drop plaintext employment company address columns from tenant_references
ALTER TABLE tenant_references
  DROP COLUMN IF EXISTS employment_company_address_line1,
  DROP COLUMN IF EXISTS employment_company_address_line2,
  DROP COLUMN IF EXISTS employment_company_city,
  DROP COLUMN IF EXISTS employment_company_postcode,
  DROP COLUMN IF EXISTS employment_company_country;

-- Drop plaintext previous rental address columns from tenant_references
ALTER TABLE tenant_references
  DROP COLUMN IF EXISTS previous_rental_address_line1,
  DROP COLUMN IF EXISTS previous_rental_address_line2,
  DROP COLUMN IF EXISTS previous_rental_city,
  DROP COLUMN IF EXISTS previous_rental_postcode,
  DROP COLUMN IF EXISTS previous_rental_country;

-- Add previous rental address fields to tenant_references table

ALTER TABLE tenant_references
ADD COLUMN IF NOT EXISTS previous_rental_address_line1 TEXT,
ADD COLUMN IF NOT EXISTS previous_rental_address_line2 TEXT,
ADD COLUMN IF NOT EXISTS previous_rental_city TEXT,
ADD COLUMN IF NOT EXISTS previous_rental_postcode TEXT,
ADD COLUMN IF NOT EXISTS previous_rental_country TEXT;

-- Remove old single address field if it exists
ALTER TABLE tenant_references
DROP COLUMN IF EXISTS previous_address;

COMMENT ON COLUMN tenant_references.previous_rental_address_line1 IS 'Previous rental property address line 1';
COMMENT ON COLUMN tenant_references.previous_rental_address_line2 IS 'Previous rental property address line 2';
COMMENT ON COLUMN tenant_references.previous_rental_city IS 'Previous rental property city';
COMMENT ON COLUMN tenant_references.previous_rental_postcode IS 'Previous rental property postcode';
COMMENT ON COLUMN tenant_references.previous_rental_country IS 'Previous rental property country';

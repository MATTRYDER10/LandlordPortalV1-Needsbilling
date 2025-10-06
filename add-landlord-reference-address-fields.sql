-- Migration: Add landlord reference address fields to tenant_references table
-- Date: 2025-10-06

-- Add new columns for structured landlord reference address
ALTER TABLE tenant_references
ADD COLUMN IF NOT EXISTS previous_rental_address_line1 TEXT,
ADD COLUMN IF NOT EXISTS previous_rental_address_line2 TEXT,
ADD COLUMN IF NOT EXISTS previous_rental_city TEXT,
ADD COLUMN IF NOT EXISTS previous_rental_postcode TEXT,
ADD COLUMN IF NOT EXISTS previous_rental_country TEXT;

-- Remove old single address field if it exists
ALTER TABLE tenant_references
DROP COLUMN IF EXISTS previous_rental_address;

-- Verify the columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tenant_references'
AND column_name LIKE 'previous_rental%'
ORDER BY column_name;

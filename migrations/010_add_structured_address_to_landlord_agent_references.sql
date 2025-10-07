-- Add structured address fields to landlord_references and agent_references tables
-- This brings consistency with how tenant addresses are stored

-- Update landlord_references table
ALTER TABLE landlord_references
ADD COLUMN IF NOT EXISTS property_address_line1 TEXT,
ADD COLUMN IF NOT EXISTS property_address_line2 TEXT;

-- Migrate existing data from property_address to property_address_line1
UPDATE landlord_references
SET property_address_line1 = property_address
WHERE property_address IS NOT NULL AND property_address_line1 IS NULL;

-- Update agent_references table
ALTER TABLE agent_references
ADD COLUMN IF NOT EXISTS property_address_line1 TEXT,
ADD COLUMN IF NOT EXISTS property_address_line2 TEXT;

-- Migrate existing data from property_address to property_address_line1
UPDATE agent_references
SET property_address_line1 = property_address
WHERE property_address IS NOT NULL AND property_address_line1 IS NULL;

-- Add comments
COMMENT ON COLUMN landlord_references.property_address_line1 IS 'Property address line 1';
COMMENT ON COLUMN landlord_references.property_address_line2 IS 'Property address line 2';
COMMENT ON COLUMN agent_references.property_address_line1 IS 'Property address line 1';
COMMENT ON COLUMN agent_references.property_address_line2 IS 'Property address line 2';

-- Note: We keep the old property_address column for backward compatibility
-- It can be dropped in a future migration after verifying all data is migrated

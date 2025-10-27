-- Add corrected address fields to agent_references and landlord_references tables
-- When agent/landlord says address is incorrect, they provide the correct address

-- Agent References
ALTER TABLE agent_references
ADD COLUMN IF NOT EXISTS address_correct TEXT,
ADD COLUMN IF NOT EXISTS corrected_address_line1_encrypted TEXT,
ADD COLUMN IF NOT EXISTS corrected_address_line2_encrypted TEXT,
ADD COLUMN IF NOT EXISTS corrected_city_encrypted TEXT,
ADD COLUMN IF NOT EXISTS corrected_postcode_encrypted TEXT;

-- Landlord References
ALTER TABLE landlord_references
ADD COLUMN IF NOT EXISTS address_correct TEXT,
ADD COLUMN IF NOT EXISTS corrected_address_line1_encrypted TEXT,
ADD COLUMN IF NOT EXISTS corrected_address_line2_encrypted TEXT,
ADD COLUMN IF NOT EXISTS corrected_city_encrypted TEXT,
ADD COLUMN IF NOT EXISTS corrected_postcode_encrypted TEXT;

-- Add comments
COMMENT ON COLUMN agent_references.address_correct IS 'Whether the tenant-provided address is correct (yes/no)';
COMMENT ON COLUMN agent_references.corrected_address_line1_encrypted IS 'Encrypted corrected address line 1 (if address was incorrect)';
COMMENT ON COLUMN agent_references.corrected_address_line2_encrypted IS 'Encrypted corrected address line 2 (if address was incorrect)';
COMMENT ON COLUMN agent_references.corrected_city_encrypted IS 'Encrypted corrected city (if address was incorrect)';
COMMENT ON COLUMN agent_references.corrected_postcode_encrypted IS 'Encrypted corrected postcode (if address was incorrect)';

COMMENT ON COLUMN landlord_references.address_correct IS 'Whether the tenant-provided address is correct (yes/no)';
COMMENT ON COLUMN landlord_references.corrected_address_line1_encrypted IS 'Encrypted corrected address line 1 (if address was incorrect)';
COMMENT ON COLUMN landlord_references.corrected_address_line2_encrypted IS 'Encrypted corrected address line 2 (if address was incorrect)';
COMMENT ON COLUMN landlord_references.corrected_city_encrypted IS 'Encrypted corrected city (if address was incorrect)';
COMMENT ON COLUMN landlord_references.corrected_postcode_encrypted IS 'Encrypted corrected postcode (if address was incorrect)';

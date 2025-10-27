-- Add guarantor fields to tenant_references table
-- Allows students and unemployed tenants to provide a guarantor
-- NOTE: When credit system is implemented, requesting a guarantor should consume an additional credit

ALTER TABLE tenant_references
ADD COLUMN IF NOT EXISTS requires_guarantor BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS guarantor_first_name_encrypted TEXT,
ADD COLUMN IF NOT EXISTS guarantor_last_name_encrypted TEXT,
ADD COLUMN IF NOT EXISTS guarantor_email_encrypted TEXT,
ADD COLUMN IF NOT EXISTS guarantor_phone_encrypted TEXT,
ADD COLUMN IF NOT EXISTS guarantor_relationship TEXT;

-- Add comments
COMMENT ON COLUMN tenant_references.requires_guarantor IS 'Whether a guarantor reference is required (typically for students/unemployed)';
COMMENT ON COLUMN tenant_references.guarantor_first_name_encrypted IS 'Encrypted first name of guarantor';
COMMENT ON COLUMN tenant_references.guarantor_last_name_encrypted IS 'Encrypted last name of guarantor';
COMMENT ON COLUMN tenant_references.guarantor_email_encrypted IS 'Encrypted email address of guarantor';
COMMENT ON COLUMN tenant_references.guarantor_phone_encrypted IS 'Encrypted phone number of guarantor';
COMMENT ON COLUMN tenant_references.guarantor_relationship IS 'Relationship of guarantor to tenant (parent, guardian, etc)';

-- TODO: When credit system is implemented, add logic to consume an additional credit when requires_guarantor is true

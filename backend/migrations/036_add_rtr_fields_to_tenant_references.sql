-- Add Right to Rent fields to tenant_references table
-- These fields store information about British citizenship and RTR verification

ALTER TABLE tenant_references
ADD COLUMN IF NOT EXISTS is_british_citizen BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS rtr_share_code TEXT,
ADD COLUMN IF NOT EXISTS rtr_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS rtr_verification_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS rtr_verification_data JSONB;

-- Add comments
COMMENT ON COLUMN tenant_references.is_british_citizen IS 'Whether the tenant is a British citizen (null = not answered yet)';
COMMENT ON COLUMN tenant_references.rtr_share_code IS 'Home Office Right to Rent share code (for non-British citizens)';
COMMENT ON COLUMN tenant_references.rtr_verified IS 'Whether the RTR share code has been verified';
COMMENT ON COLUMN tenant_references.rtr_verification_date IS 'When the RTR verification was completed';
COMMENT ON COLUMN tenant_references.rtr_verification_data IS 'Full RTR verification response from the API';

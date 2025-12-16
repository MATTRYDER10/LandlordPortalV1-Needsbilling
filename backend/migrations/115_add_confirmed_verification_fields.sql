-- Migration: 115_add_confirmed_verification_fields.sql
-- Description: Add fields to track when staff have confirmed income and residential verification
-- Date: 2025-12-15

-- Add confirmed residential verification fields
ALTER TABLE tenant_references ADD COLUMN IF NOT EXISTS
  confirmed_residential_status VARCHAR(50); -- VERIFIED, LIVING_WITH_FAMILY, OWNER_OCCUPIER

ALTER TABLE tenant_references ADD COLUMN IF NOT EXISTS
  confirmed_residential_at TIMESTAMPTZ;

ALTER TABLE tenant_references ADD COLUMN IF NOT EXISTS
  confirmed_residential_by UUID REFERENCES staff_users(id);

-- Add confirmed income tracking fields
-- Note: The actual verified income values are already stored in verified_*_encrypted fields from migration 112
-- These fields track WHEN and WHO confirmed the income
ALTER TABLE tenant_references ADD COLUMN IF NOT EXISTS
  confirmed_income_at TIMESTAMPTZ;

ALTER TABLE tenant_references ADD COLUMN IF NOT EXISTS
  confirmed_income_by UUID REFERENCES staff_users(id);

-- Create index for quick lookup of confirmed status
CREATE INDEX IF NOT EXISTS idx_tenant_references_confirmed_income_at
  ON tenant_references(confirmed_income_at) WHERE confirmed_income_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_references_confirmed_residential_at
  ON tenant_references(confirmed_residential_at) WHERE confirmed_residential_at IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN tenant_references.confirmed_residential_status IS 'Staff-confirmed residential status: VERIFIED (landlord reference confirmed), LIVING_WITH_FAMILY, OWNER_OCCUPIER';
COMMENT ON COLUMN tenant_references.confirmed_residential_at IS 'Timestamp when residential was confirmed by staff';
COMMENT ON COLUMN tenant_references.confirmed_residential_by IS 'Staff user ID who confirmed the residential status';
COMMENT ON COLUMN tenant_references.confirmed_income_at IS 'Timestamp when income was confirmed by staff';
COMMENT ON COLUMN tenant_references.confirmed_income_by IS 'Staff user ID who confirmed the income';

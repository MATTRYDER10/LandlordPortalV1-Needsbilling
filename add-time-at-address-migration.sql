-- Migration: Add time at current address fields to tenant_references table
-- This adds fields to track how long a tenant has been at their current address

DO $$
BEGIN
  -- Add time_at_address_years column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_references'
    AND column_name = 'time_at_address_years'
  ) THEN
    ALTER TABLE tenant_references
    ADD COLUMN time_at_address_years INTEGER;
  END IF;

  -- Add time_at_address_months column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_references'
    AND column_name = 'time_at_address_months'
  ) THEN
    ALTER TABLE tenant_references
    ADD COLUMN time_at_address_months INTEGER;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN tenant_references.time_at_address_years IS 'Number of years at current address (0-100)';
COMMENT ON COLUMN tenant_references.time_at_address_months IS 'Number of months at current address (0-11)';

-- Add check constraints to ensure valid values
DO $$
BEGIN
  -- Check constraint for years (0-100)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_time_at_address_years'
  ) THEN
    ALTER TABLE tenant_references
    ADD CONSTRAINT check_time_at_address_years
    CHECK (time_at_address_years IS NULL OR (time_at_address_years >= 0 AND time_at_address_years <= 100));
  END IF;

  -- Check constraint for months (0-11)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_time_at_address_months'
  ) THEN
    ALTER TABLE tenant_references
    ADD CONSTRAINT check_time_at_address_months
    CHECK (time_at_address_months IS NULL OR (time_at_address_months >= 0 AND time_at_address_months <= 11));
  END IF;
END $$;

-- Add status column to tenancy_tenants for tracking tenant lifecycle
-- This enables tracking of: active, replaced, removed, never_moved_in tenants

-- Add status column if it doesn't exist
ALTER TABLE tenancy_tenants
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Add constraint for valid status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenancy_tenants_status_check'
  ) THEN
    ALTER TABLE tenancy_tenants
    ADD CONSTRAINT tenancy_tenants_status_check
    CHECK (status IN ('active', 'replaced', 'removed', 'never_moved_in'));
  END IF;
END $$;

-- Add left_date column if it doesn't exist (for tracking when tenant left)
ALTER TABLE tenancy_tenants
ADD COLUMN IF NOT EXISTS left_date DATE;

-- Update existing records: set status to 'active' for active tenants, 'removed' for inactive
UPDATE tenancy_tenants
SET status = CASE
  WHEN is_active = true THEN 'active'
  ELSE 'removed'
END
WHERE status IS NULL;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_tenancy_tenants_status ON tenancy_tenants(status);

-- Migration 130: Add management_type to properties table
-- This allows tracking whether a property is fully managed by the agent or let-only
-- When creating tenancies/agreements, bank details can auto-populate based on this:
-- - 'managed': Use Agent's bank details
-- - 'let_only': Use Landlord's bank details

ALTER TABLE properties
ADD COLUMN IF NOT EXISTS management_type TEXT CHECK (management_type IN ('managed', 'let_only'));

-- Add comment for documentation
COMMENT ON COLUMN properties.management_type IS 'Indicates if property is agent-managed or let-only. Used for auto-populating bank details in agreements.';

-- Create index for filtering properties by management type
CREATE INDEX IF NOT EXISTS idx_properties_management_type ON properties(management_type) WHERE management_type IS NOT NULL;

-- Add urgent_reverify flag to tenant_references for re-referencing priority
-- This flag is set when a person is submitted for re-referencing

ALTER TABLE tenant_references
ADD COLUMN IF NOT EXISTS urgent_reverify BOOLEAN DEFAULT FALSE;

-- Create index for efficient queries on urgent references
CREATE INDEX IF NOT EXISTS idx_tenant_references_urgent_reverify
ON tenant_references(urgent_reverify)
WHERE urgent_reverify = true;

-- Add comment for documentation
COMMENT ON COLUMN tenant_references.urgent_reverify IS 'Flag indicating this reference requires priority re-verification after corrections';

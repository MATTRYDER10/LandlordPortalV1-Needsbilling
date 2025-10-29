-- Add guarantor linking fields to tenant_references
-- This enables guarantors to be full tenant references that link to a parent tenant
-- Similar to how group applications work with parent_reference_id

ALTER TABLE tenant_references
ADD COLUMN IF NOT EXISTS is_guarantor BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS guarantor_for_reference_id UUID REFERENCES tenant_references(id) ON DELETE CASCADE;

-- Create index for faster lookups of guarantors for a specific tenant
CREATE INDEX IF NOT EXISTS idx_tenant_references_guarantor_for ON tenant_references(guarantor_for_reference_id);

-- Add comments
COMMENT ON COLUMN tenant_references.is_guarantor IS 'True if this reference is for a guarantor (not a primary tenant)';
COMMENT ON COLUMN tenant_references.guarantor_for_reference_id IS 'If is_guarantor=true, this links to the parent tenant reference that requires this guarantor';

-- Update status field documentation to include new awaiting_guarantor status
-- Status values: 'pending', 'in_progress', 'pending_verification', 'awaiting_guarantor', 'completed', 'rejected', 'cancelled'
-- 'awaiting_guarantor' means tenant passed checks but needs guarantor to complete and pass

-- Note: requires_guarantor field already exists (from migration 034)
-- It's used to mark when a tenant needs a guarantor

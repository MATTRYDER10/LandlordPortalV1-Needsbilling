-- Add multi-tenant support to tenant_references table
-- Allows grouping multiple tenants under one property reference

ALTER TABLE tenant_references
ADD COLUMN parent_reference_id UUID REFERENCES tenant_references(id) ON DELETE CASCADE,
ADD COLUMN is_group_parent BOOLEAN DEFAULT false,
ADD COLUMN rent_share DECIMAL(10, 2),
ADD COLUMN tenant_position INTEGER DEFAULT 1;

-- Create index for faster parent-child lookups
CREATE INDEX idx_tenant_references_parent_id ON tenant_references(parent_reference_id);

-- Add comment explaining the structure
COMMENT ON COLUMN tenant_references.parent_reference_id IS 'References the parent record for multi-tenant properties. NULL for single tenants or parent records';
COMMENT ON COLUMN tenant_references.is_group_parent IS 'True if this is a parent record grouping multiple tenants';
COMMENT ON COLUMN tenant_references.rent_share IS 'Individual tenant rent portion. NULL for parent records, required for children';
COMMENT ON COLUMN tenant_references.tenant_position IS 'Position in the tenant group (1, 2, 3, etc.)';

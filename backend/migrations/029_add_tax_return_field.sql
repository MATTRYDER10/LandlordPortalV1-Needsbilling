-- Add tax return document path field to tenant_references table
ALTER TABLE tenant_references
ADD COLUMN IF NOT EXISTS tax_return_path TEXT;

-- Add comment for documentation
COMMENT ON COLUMN tenant_references.tax_return_path IS 'Path to uploaded tax return document for self-employed applicants';

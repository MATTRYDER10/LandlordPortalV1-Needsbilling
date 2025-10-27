-- Add additional_income_type field to tenant_references table
ALTER TABLE tenant_references
ADD COLUMN IF NOT EXISTS additional_income_type TEXT;

-- Add comment for documentation
COMMENT ON COLUMN tenant_references.additional_income_type IS 'Type of additional financial resource: income or savings';

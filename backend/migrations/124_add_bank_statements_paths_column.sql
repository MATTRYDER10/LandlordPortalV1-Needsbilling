-- Add bank_statements_paths column to tenant_references table
-- This column stores an array of file paths for uploaded bank statements

ALTER TABLE tenant_references
ADD COLUMN IF NOT EXISTS bank_statements_paths TEXT[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN tenant_references.bank_statements_paths IS 'Array of file paths for uploaded bank statement documents';

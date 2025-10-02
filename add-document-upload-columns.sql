-- Add columns for storing file paths for bank statements and payslips
ALTER TABLE tenant_references
ADD COLUMN bank_statement_files TEXT[],
ADD COLUMN payslip_files TEXT[];

-- Add comments
COMMENT ON COLUMN tenant_references.bank_statement_files IS 'Array of file paths for bank statements stored in Supabase Storage';
COMMENT ON COLUMN tenant_references.payslip_files IS 'Array of file paths for payslips stored in Supabase Storage';

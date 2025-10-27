-- Add benefits amount fields to tenant_references table
ALTER TABLE tenant_references
ADD COLUMN IF NOT EXISTS benefits_monthly_amount_encrypted TEXT,
ADD COLUMN IF NOT EXISTS benefits_annual_amount_encrypted TEXT;

-- Add comments for documentation
COMMENT ON COLUMN tenant_references.benefits_monthly_amount_encrypted IS 'Encrypted monthly benefits amount in GBP';
COMMENT ON COLUMN tenant_references.benefits_annual_amount_encrypted IS 'Encrypted annual benefits amount (calculated as monthly * 12) in GBP';

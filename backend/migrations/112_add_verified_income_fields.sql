-- Migration: Add verified income fields to tenant_references
-- These fields store staff-verified income values separately from tenant-entered values
-- When present, these values should be used for final report generation and ratio calculations

-- Add verified income fields (encrypted) to tenant_references
ALTER TABLE tenant_references
ADD COLUMN IF NOT EXISTS verified_salary_amount_encrypted TEXT,
ADD COLUMN IF NOT EXISTS verified_benefits_amount_encrypted TEXT,
ADD COLUMN IF NOT EXISTS verified_savings_amount_encrypted TEXT,
ADD COLUMN IF NOT EXISTS verified_additional_income_amount_encrypted TEXT,
ADD COLUMN IF NOT EXISTS verified_self_employed_income_encrypted TEXT,
ADD COLUMN IF NOT EXISTS verified_total_income_encrypted TEXT;

-- Add comments to explain the fields
COMMENT ON COLUMN tenant_references.verified_salary_amount_encrypted IS 'Staff-verified annual salary amount (encrypted). Takes precedence over tenant-entered value for report generation.';
COMMENT ON COLUMN tenant_references.verified_benefits_amount_encrypted IS 'Staff-verified annual benefits amount (encrypted). Takes precedence over tenant-entered value for report generation.';
COMMENT ON COLUMN tenant_references.verified_savings_amount_encrypted IS 'Staff-verified savings amount (encrypted). Takes precedence over tenant-entered value for report generation.';
COMMENT ON COLUMN tenant_references.verified_additional_income_amount_encrypted IS 'Staff-verified additional income amount (encrypted). Takes precedence over tenant-entered value for report generation.';
COMMENT ON COLUMN tenant_references.verified_self_employed_income_encrypted IS 'Staff-verified self-employed annual income (encrypted). Takes precedence over tenant-entered value for report generation.';
COMMENT ON COLUMN tenant_references.verified_total_income_encrypted IS 'Staff-verified total annual income (encrypted). If set, overrides calculated total from individual income sources.';

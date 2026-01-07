-- Migration: Add Pension and Landlord/Rental Income Types
-- Purpose: Add new income type fields for standalone pension income and landlord/rental income
-- Backwards compatible: Does NOT rename or remove existing columns

-- =====================================================
-- TENANT REFERENCES TABLE
-- =====================================================

-- Pension income fields (NEW)
ALTER TABLE tenant_references ADD COLUMN IF NOT EXISTS income_pension BOOLEAN DEFAULT false;
ALTER TABLE tenant_references ADD COLUMN IF NOT EXISTS pension_monthly_amount_encrypted TEXT;
ALTER TABLE tenant_references ADD COLUMN IF NOT EXISTS pension_provider_encrypted TEXT;
ALTER TABLE tenant_references ADD COLUMN IF NOT EXISTS pension_statement_path TEXT;

-- Landlord/Rental income fields (NEW)
ALTER TABLE tenant_references ADD COLUMN IF NOT EXISTS income_landlord_rental BOOLEAN DEFAULT false;
ALTER TABLE tenant_references ADD COLUMN IF NOT EXISTS landlord_rental_monthly_amount_encrypted TEXT;
ALTER TABLE tenant_references ADD COLUMN IF NOT EXISTS landlord_rental_bank_statement_path TEXT;

-- Verified/confirmed income fields for staff verification (NEW)
ALTER TABLE tenant_references ADD COLUMN IF NOT EXISTS verified_pension_amount_encrypted TEXT;
ALTER TABLE tenant_references ADD COLUMN IF NOT EXISTS verified_landlord_rental_amount_encrypted TEXT;

-- Add comments for documentation
COMMENT ON COLUMN tenant_references.income_pension IS 'Tenant receives pension income (separate from savings/investments)';
COMMENT ON COLUMN tenant_references.pension_monthly_amount_encrypted IS 'Monthly pension amount (encrypted)';
COMMENT ON COLUMN tenant_references.pension_provider_encrypted IS 'Pension provider name e.g. State Pension, Scottish Widows (encrypted)';
COMMENT ON COLUMN tenant_references.pension_statement_path IS 'File path to uploaded pension statement';
COMMENT ON COLUMN tenant_references.income_landlord_rental IS 'Tenant receives landlord/rental income';
COMMENT ON COLUMN tenant_references.landlord_rental_monthly_amount_encrypted IS 'Monthly rental income amount (encrypted)';
COMMENT ON COLUMN tenant_references.landlord_rental_bank_statement_path IS 'File path to bank statement showing rental income';

-- =====================================================
-- GUARANTOR REFERENCES TABLE
-- =====================================================

-- Pension income fields (NEW)
ALTER TABLE guarantor_references ADD COLUMN IF NOT EXISTS income_pension BOOLEAN DEFAULT false;
ALTER TABLE guarantor_references ADD COLUMN IF NOT EXISTS pension_monthly_amount_encrypted TEXT;
ALTER TABLE guarantor_references ADD COLUMN IF NOT EXISTS pension_provider_encrypted TEXT;
ALTER TABLE guarantor_references ADD COLUMN IF NOT EXISTS pension_statement_path TEXT;

-- Landlord/Rental income fields (NEW)
ALTER TABLE guarantor_references ADD COLUMN IF NOT EXISTS income_landlord_rental BOOLEAN DEFAULT false;
ALTER TABLE guarantor_references ADD COLUMN IF NOT EXISTS landlord_rental_monthly_amount_encrypted TEXT;
ALTER TABLE guarantor_references ADD COLUMN IF NOT EXISTS landlord_rental_bank_statement_path TEXT;

-- Verified/confirmed income fields for staff verification (NEW)
ALTER TABLE guarantor_references ADD COLUMN IF NOT EXISTS verified_pension_amount_encrypted TEXT;
ALTER TABLE guarantor_references ADD COLUMN IF NOT EXISTS verified_landlord_rental_amount_encrypted TEXT;

-- Add comments for documentation
COMMENT ON COLUMN guarantor_references.income_pension IS 'Guarantor receives pension income (replaces income_retired for new submissions)';
COMMENT ON COLUMN guarantor_references.pension_monthly_amount_encrypted IS 'Monthly pension amount (encrypted)';
COMMENT ON COLUMN guarantor_references.pension_provider_encrypted IS 'Pension provider name e.g. State Pension, Scottish Widows (encrypted)';
COMMENT ON COLUMN guarantor_references.pension_statement_path IS 'File path to uploaded pension statement';
COMMENT ON COLUMN guarantor_references.income_landlord_rental IS 'Guarantor receives landlord/rental income';
COMMENT ON COLUMN guarantor_references.landlord_rental_monthly_amount_encrypted IS 'Monthly rental income amount (encrypted)';
COMMENT ON COLUMN guarantor_references.landlord_rental_bank_statement_path IS 'File path to bank statement showing rental income';

-- NOTE: Existing columns preserved for backwards compatibility:
-- - income_savings_pension_investments (kept, not renamed)
-- - income_retired (kept on guarantor_references)
-- - pension_amount_encrypted (kept on guarantor_references for old 'retired' submissions)

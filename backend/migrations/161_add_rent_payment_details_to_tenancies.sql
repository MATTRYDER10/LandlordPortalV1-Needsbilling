-- Migration 161: Add rent payment details to tenancies table
-- Store bank details directly on tenancy to avoid complex landlord lookups
-- These are copied from landlord (let_only) or company (managed) at tenancy creation
-- and can be edited independently for the specific tenancy

ALTER TABLE tenancies
  ADD COLUMN IF NOT EXISTS payment_bank_account_name_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS payment_bank_sort_code_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS payment_bank_account_number_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS payment_details_source TEXT CHECK (payment_details_source IN ('landlord', 'agent', 'custom'));

-- Comments for documentation
COMMENT ON COLUMN tenancies.payment_bank_account_name_encrypted IS 'Encrypted bank account name for rent payments';
COMMENT ON COLUMN tenancies.payment_bank_sort_code_encrypted IS 'Encrypted bank sort code for rent payments';
COMMENT ON COLUMN tenancies.payment_bank_account_number_encrypted IS 'Encrypted bank account number for rent payments';
COMMENT ON COLUMN tenancies.payment_reference IS 'Payment reference tenants should use (e.g., property address slug)';
COMMENT ON COLUMN tenancies.payment_details_source IS 'Source of payment details: landlord (let_only), agent (managed), or custom';

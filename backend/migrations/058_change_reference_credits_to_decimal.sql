-- Migration 058: Change reference_credits from INTEGER to DECIMAL
-- This allows fractional credits (e.g., 0.5 credits for AML checks)
-- ============================================================================

-- ============================================================================
-- 1. UPDATE COMPANIES TABLE
-- ============================================================================

-- Drop the existing check constraint
ALTER TABLE companies
DROP CONSTRAINT IF EXISTS companies_reference_credits_check;

-- Change the column type from INTEGER to DECIMAL(10, 2)
-- This allows up to 99999999.99 credits with 2 decimal places
ALTER TABLE companies
ALTER COLUMN reference_credits TYPE DECIMAL(10, 2) USING reference_credits::DECIMAL(10, 2);

-- Re-add the check constraint to ensure non-negative values
ALTER TABLE companies
ADD CONSTRAINT companies_reference_credits_check CHECK (reference_credits >= 0);

-- Update the default value to be a decimal
ALTER TABLE companies
ALTER COLUMN reference_credits SET DEFAULT 0.0;

-- ============================================================================
-- 2. UPDATE CREDIT_TRANSACTIONS TABLE
-- ============================================================================

-- Drop the existing check constraint
ALTER TABLE credit_transactions
DROP CONSTRAINT IF EXISTS credit_transactions_credits_balance_after_check;

-- Change credits_change from INTEGER to DECIMAL(10, 2)
ALTER TABLE credit_transactions
ALTER COLUMN credits_change TYPE DECIMAL(10, 2) USING credits_change::DECIMAL(10, 2);

-- Change credits_balance_after from INTEGER to DECIMAL(10, 2)
ALTER TABLE credit_transactions
ALTER COLUMN credits_balance_after TYPE DECIMAL(10, 2) USING credits_balance_after::DECIMAL(10, 2);

-- Re-add the check constraint to ensure non-negative balance
ALTER TABLE credit_transactions
ADD CONSTRAINT credit_transactions_credits_balance_after_check CHECK (credits_balance_after >= 0);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON COLUMN companies.reference_credits IS 'Current balance of reference credits available to this company (supports fractional credits, e.g., 0.5 for AML checks)';
COMMENT ON COLUMN credit_transactions.credits_change IS 'Credit change amount (positive for additions, negative for deductions). Supports fractional credits.';
COMMENT ON COLUMN credit_transactions.credits_balance_after IS 'Credit balance after this transaction. Supports fractional credits.';


-- Migration: Add savings and proof of funds fields to tenant_references table
-- This adds fields for savings/pensions/investments information

DO $$
BEGIN
  -- Add savings_amount column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_references'
    AND column_name = 'savings_amount'
  ) THEN
    ALTER TABLE tenant_references
    ADD COLUMN savings_amount DECIMAL(12, 2);
  END IF;

  -- Add proof_of_funds_path column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_references'
    AND column_name = 'proof_of_funds_path'
  ) THEN
    ALTER TABLE tenant_references
    ADD COLUMN proof_of_funds_path TEXT;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN tenant_references.savings_amount IS 'Total amount in savings, pensions, and investments (in £)';
COMMENT ON COLUMN tenant_references.proof_of_funds_path IS 'Path to proof of funds document (bank statement, pension statement, or investment portfolio)';

-- Add check constraint to ensure valid values
DO $$
BEGIN
  -- Check constraint for savings amount (must be non-negative)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_savings_amount'
  ) THEN
    ALTER TABLE tenant_references
    ADD CONSTRAINT check_savings_amount
    CHECK (savings_amount IS NULL OR savings_amount >= 0);
  END IF;
END $$;

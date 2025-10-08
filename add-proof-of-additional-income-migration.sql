-- Migration: Add proof of additional income field to tenant_references table
-- This adds a field for storing the path to proof of additional income document

DO $$
BEGIN
  -- Add proof_of_additional_income_path column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_references'
    AND column_name = 'proof_of_additional_income_path'
  ) THEN
    ALTER TABLE tenant_references
    ADD COLUMN proof_of_additional_income_path TEXT;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN tenant_references.proof_of_additional_income_path IS 'Path to proof of additional income document (invoices, contracts, or bank statements)';

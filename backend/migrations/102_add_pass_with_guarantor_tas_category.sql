-- Migration: Add PASS_WITH_GUARANTOR to TAS category options
-- This adds a new TAS category while keeping PASS_PLUS for backward compatibility

-- Drop existing constraint
ALTER TABLE verification_checks DROP CONSTRAINT IF EXISTS verification_checks_tas_category_check;

-- Add updated constraint with PASS_WITH_GUARANTOR
ALTER TABLE verification_checks ADD CONSTRAINT verification_checks_tas_category_check
  CHECK (tas_category IN ('PASS_PLUS', 'PASS', 'PASS_WITH_GUARANTOR', 'REFER', 'FAIL'));

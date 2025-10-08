-- Migration: Drop Plaintext Notes Columns
-- Removes plaintext notes fields after encryption migration is complete

-- Drop plaintext notes columns from tenant_references
ALTER TABLE tenant_references
  DROP COLUMN IF EXISTS notes,
  DROP COLUMN IF EXISTS internal_notes,
  DROP COLUMN IF EXISTS verification_notes;

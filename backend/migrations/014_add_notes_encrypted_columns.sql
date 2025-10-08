-- Migration: Add Encrypted Columns for Notes Fields
-- Encrypts free-form text fields that may contain sensitive information

-- Add encrypted columns for notes fields in tenant_references
ALTER TABLE tenant_references
  ADD COLUMN IF NOT EXISTS notes_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS internal_notes_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS verification_notes_encrypted TEXT;

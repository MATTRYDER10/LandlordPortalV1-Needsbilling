-- Migration: Add Token Hashing Columns
-- Description: Adds hashed token columns for secure token storage
-- Run this in Supabase SQL Editor

-- Add token_hash column to invitations table
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS token_hash TEXT;

-- Add reference_token_hash column to tenant_references table
ALTER TABLE tenant_references ADD COLUMN IF NOT EXISTS reference_token_hash TEXT;

-- Add token_hash column to accountant_references table
ALTER TABLE accountant_references ADD COLUMN IF NOT EXISTS token_hash TEXT;

-- Create indexes for hash lookups (much faster than plaintext token searches)
CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_tenant_references_token_hash ON tenant_references(reference_token_hash);
CREATE INDEX IF NOT EXISTS idx_accountant_references_token_hash ON accountant_references(token_hash);

-- Note: After deploying the code changes that hash tokens:
-- 1. The application will start writing to both token and token_hash columns
-- 2. Old tokens will still work during the migration period
-- 3. Once all tokens are migrated, we can remove the plaintext token columns in a future migration

-- Migration: Add Token Fields to Employer and Landlord References
-- Description: Adds reference_token_hash and token_expires_at columns that were missing
-- These columns are required for the secure reference submission flow
-- Run this in Supabase SQL Editor

-- Add token fields to employer_references table
ALTER TABLE employer_references
ADD COLUMN IF NOT EXISTS reference_token_hash TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP;

-- Add token fields to landlord_references table
ALTER TABLE landlord_references
ADD COLUMN IF NOT EXISTS reference_token_hash TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP;

-- Create indexes for token lookups (for fast reference form loading)
CREATE INDEX IF NOT EXISTS idx_employer_references_token_hash ON employer_references(reference_token_hash);
CREATE INDEX IF NOT EXISTS idx_landlord_references_token_hash ON landlord_references(reference_token_hash);

-- Add comments for documentation
COMMENT ON COLUMN employer_references.reference_token_hash IS 'Hashed token for secure employer form access';
COMMENT ON COLUMN employer_references.token_expires_at IS 'When the employer form link expires (typically 30 days)';
COMMENT ON COLUMN landlord_references.reference_token_hash IS 'Hashed token for secure landlord form access';
COMMENT ON COLUMN landlord_references.token_expires_at IS 'When the landlord form link expires (typically 30 days)';

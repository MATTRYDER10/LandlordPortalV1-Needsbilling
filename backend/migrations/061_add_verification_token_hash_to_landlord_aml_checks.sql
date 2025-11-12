-- Migration 061: Add verification_token_hash to landlord_aml_checks table
-- This allows storing the token hash for landlord verification links

ALTER TABLE landlord_aml_checks
ADD COLUMN IF NOT EXISTS verification_token_hash TEXT;

-- Add index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_landlord_aml_checks_token_hash ON landlord_aml_checks(verification_token_hash);


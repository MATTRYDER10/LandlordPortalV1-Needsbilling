-- Add token and status fields to guarantor_references table
-- These fields are needed for the guarantor form workflow

ALTER TABLE guarantor_references
ADD COLUMN IF NOT EXISTS reference_token_hash TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS guarantor_email_encrypted TEXT,
ADD COLUMN IF NOT EXISTS guarantor_phone_encrypted TEXT;

-- Create index for token lookups
CREATE INDEX IF NOT EXISTS idx_guarantor_references_token_hash ON guarantor_references(reference_token_hash);

-- Add comments
COMMENT ON COLUMN guarantor_references.reference_token_hash IS 'Hashed token for secure guarantor form access';
COMMENT ON COLUMN guarantor_references.token_expires_at IS 'When the guarantor form link expires (typically 30 days)';
COMMENT ON COLUMN guarantor_references.status IS 'Status of guarantor reference (pending, in_progress, completed)';
COMMENT ON COLUMN guarantor_references.guarantor_email_encrypted IS 'Guarantor email (from tenant submission, before guarantor fills form)';
COMMENT ON COLUMN guarantor_references.guarantor_phone_encrypted IS 'Guarantor phone (from tenant submission, before guarantor fills form)';

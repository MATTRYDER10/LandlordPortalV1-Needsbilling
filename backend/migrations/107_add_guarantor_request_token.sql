-- Migration: Add token fields for tenant to add guarantor details
-- When a reference is completed with PASS_WITH_GUARANTOR decision and no guarantor exists,
-- the tenant receives an email with a secure link to add their guarantor's contact details.

ALTER TABLE tenant_references
ADD COLUMN IF NOT EXISTS add_guarantor_token_hash VARCHAR(128),
ADD COLUMN IF NOT EXISTS add_guarantor_token_expires_at TIMESTAMPTZ;

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_tenant_references_add_guarantor_token
ON tenant_references(add_guarantor_token_hash);

-- Migration 182: Add TDS Insured integration fields
-- TDS Insured uses OAuth2 authentication (different from Custodial which uses API key)

-- Add TDS Insured fields to company_integrations
ALTER TABLE company_integrations
  ADD COLUMN IF NOT EXISTS tds_insured_client_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS tds_insured_client_secret_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS tds_insured_access_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS tds_insured_refresh_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS tds_insured_token_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS tds_insured_member_id VARCHAR(10),
  ADD COLUMN IF NOT EXISTS tds_insured_branch_id VARCHAR(10),
  ADD COLUMN IF NOT EXISTS tds_insured_environment VARCHAR(10) CHECK (tds_insured_environment IN ('sandbox', 'live')),
  ADD COLUMN IF NOT EXISTS tds_insured_connected_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS tds_insured_last_tested_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS tds_insured_last_test_status VARCHAR(20);

-- Rename existing TDS fields to be clearer (they are for Custodial)
-- Note: Only rename if not already renamed
DO $$
BEGIN
  -- Check if column exists with old name
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'company_integrations'
             AND column_name = 'tds_api_key_encrypted') THEN
    -- Add comment to clarify it's for Custodial
    COMMENT ON COLUMN company_integrations.tds_api_key_encrypted IS 'TDS Custodial API key (AES-256-GCM encrypted)';
    COMMENT ON COLUMN company_integrations.tds_member_id IS 'TDS Custodial member ID';
    COMMENT ON COLUMN company_integrations.tds_branch_id IS 'TDS Custodial branch ID';
    COMMENT ON COLUMN company_integrations.tds_environment IS 'TDS Custodial environment (sandbox/live)';
  END IF;
END $$;

-- Add scheme_type to tds_registrations to track which scheme was used
ALTER TABLE tds_registrations
  ADD COLUMN IF NOT EXISTS scheme_type VARCHAR(20) DEFAULT 'custodial'
    CHECK (scheme_type IN ('custodial', 'insured'));

-- Add index for scheme type lookups
CREATE INDEX IF NOT EXISTS idx_tds_registrations_scheme_type ON tds_registrations(scheme_type);

-- Comments for new columns
COMMENT ON COLUMN company_integrations.tds_insured_client_id IS 'TDS Insured OAuth2 client ID';
COMMENT ON COLUMN company_integrations.tds_insured_client_secret_encrypted IS 'TDS Insured OAuth2 client secret (AES-256-GCM encrypted)';
COMMENT ON COLUMN company_integrations.tds_insured_access_token_encrypted IS 'TDS Insured OAuth2 access token (encrypted, expires in 60 mins)';
COMMENT ON COLUMN company_integrations.tds_insured_refresh_token_encrypted IS 'TDS Insured OAuth2 refresh token (encrypted, long-lived)';
COMMENT ON COLUMN company_integrations.tds_insured_token_expires_at IS 'Timestamp when access token expires';
COMMENT ON COLUMN company_integrations.tds_insured_member_id IS 'TDS Insured member ID';
COMMENT ON COLUMN company_integrations.tds_insured_branch_id IS 'TDS Insured branch ID';
COMMENT ON COLUMN company_integrations.tds_insured_environment IS 'TDS Insured environment (sandbox/live)';
COMMENT ON COLUMN tds_registrations.scheme_type IS 'Which TDS scheme was used: custodial or insured';

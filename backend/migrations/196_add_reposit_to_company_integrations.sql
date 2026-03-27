ALTER TABLE company_integrations
ADD COLUMN IF NOT EXISTS reposit_referrer_token_encrypted TEXT,
ADD COLUMN IF NOT EXISTS reposit_api_key_encrypted TEXT,
ADD COLUMN IF NOT EXISTS reposit_supplier_id TEXT,
ADD COLUMN IF NOT EXISTS reposit_environment TEXT DEFAULT 'sandbox',
ADD COLUMN IF NOT EXISTS reposit_connected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reposit_last_tested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reposit_last_test_status TEXT,
ADD COLUMN IF NOT EXISTS reposit_default_agent_id TEXT;

COMMENT ON COLUMN company_integrations.reposit_referrer_token_encrypted IS 'Encrypted Reposit Referrer Token';
COMMENT ON COLUMN company_integrations.reposit_api_key_encrypted IS 'Encrypted Reposit API Key';
COMMENT ON COLUMN company_integrations.reposit_supplier_id IS 'Reposit Supplier ID (sup_ or org_ prefix)';
COMMENT ON COLUMN company_integrations.reposit_environment IS 'sandbox or live';
COMMENT ON COLUMN company_integrations.reposit_default_agent_id IS 'Default agent ID for creating Reposits';

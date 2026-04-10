ALTER TABLE company_integrations
  ADD COLUMN IF NOT EXISTS ig_api_key_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_company_integrations_ig_key_hash
  ON company_integrations(ig_api_key_hash);

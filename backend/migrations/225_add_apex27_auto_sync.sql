ALTER TABLE company_integrations ADD COLUMN IF NOT EXISTS apex27_last_auto_sync_at TIMESTAMPTZ;

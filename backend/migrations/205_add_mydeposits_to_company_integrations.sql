ALTER TABLE company_integrations
ADD COLUMN IF NOT EXISTS mydeposits_client_id TEXT,
ADD COLUMN IF NOT EXISTS mydeposits_client_secret_encrypted TEXT,
ADD COLUMN IF NOT EXISTS mydeposits_access_token_encrypted TEXT,
ADD COLUMN IF NOT EXISTS mydeposits_refresh_token_encrypted TEXT,
ADD COLUMN IF NOT EXISTS mydeposits_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS mydeposits_member_id TEXT,
ADD COLUMN IF NOT EXISTS mydeposits_branch_id TEXT,
ADD COLUMN IF NOT EXISTS mydeposits_scheme_type TEXT DEFAULT 'custodial',
ADD COLUMN IF NOT EXISTS mydeposits_environment TEXT DEFAULT 'sandbox' CHECK (mydeposits_environment IN ('sandbox', 'live')),
ADD COLUMN IF NOT EXISTS mydeposits_connected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS mydeposits_last_tested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS mydeposits_last_test_status TEXT;

ALTER TABLE tenant_references_v2
ADD COLUMN IF NOT EXISTS deposit_replacement_offered BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS reposit_confirmed BOOLEAN,
ADD COLUMN IF NOT EXISTS reposit_confirmed_at TIMESTAMPTZ;

COMMENT ON COLUMN tenant_references_v2.deposit_replacement_offered IS 'Whether Reposit was offered for this tenancy (copied from offer)';
COMMENT ON COLUMN tenant_references_v2.deposit_amount IS 'Traditional deposit amount (copied from offer)';
COMMENT ON COLUMN tenant_references_v2.reposit_confirmed IS 'Tenant choice: true = wants Reposit, false = wants traditional deposit, null = not yet chosen';
COMMENT ON COLUMN tenant_references_v2.reposit_confirmed_at IS 'When the tenant made their Reposit choice';

-- Migration 186: Add payment confirmation token to tenant_changes
-- Allows tenant to confirm they've made payment via email link

ALTER TABLE tenant_changes
ADD COLUMN IF NOT EXISTS fee_payment_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS fee_tenant_confirmed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_tenant_changes_payment_token ON tenant_changes(fee_payment_token) WHERE fee_payment_token IS NOT NULL;

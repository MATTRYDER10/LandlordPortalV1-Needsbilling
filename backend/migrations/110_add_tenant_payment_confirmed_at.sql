-- Migration 110: Add tenant_payment_confirmed_at column to tenant_offers table
-- This column tracks when a tenant confirms they have paid the holding deposit

ALTER TABLE tenant_offers
ADD COLUMN IF NOT EXISTS tenant_payment_confirmed_at TIMESTAMP WITH TIME ZONE;

-- Add index for querying offers by payment confirmation status
CREATE INDEX IF NOT EXISTS idx_tenant_offers_payment_confirmed
ON tenant_offers(tenant_payment_confirmed_at)
WHERE tenant_payment_confirmed_at IS NOT NULL;

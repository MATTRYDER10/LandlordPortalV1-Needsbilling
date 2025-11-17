-- Migration 095: Add holding_deposit_amount_paid column
ALTER TABLE tenant_offers
  ADD COLUMN IF NOT EXISTS holding_deposit_amount_paid DECIMAL(10, 2);


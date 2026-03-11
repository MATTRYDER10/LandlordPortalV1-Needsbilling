ALTER TABLE tenant_references_v2
  ADD COLUMN IF NOT EXISTS holding_deposit_amount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS offer_id UUID REFERENCES tenant_offers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_references_v2_offer_id ON tenant_references_v2(offer_id);

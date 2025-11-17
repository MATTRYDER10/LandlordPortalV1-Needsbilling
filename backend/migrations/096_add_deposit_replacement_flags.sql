ALTER TABLE tenant_offers
    ADD COLUMN IF NOT EXISTS deposit_replacement_offered BOOLEAN DEFAULT FALSE;

ALTER TABLE tenant_offers
    ADD COLUMN IF NOT EXISTS deposit_replacement_requested BOOLEAN DEFAULT FALSE;


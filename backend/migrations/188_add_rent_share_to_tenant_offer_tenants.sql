ALTER TABLE tenant_offer_tenants
ADD COLUMN IF NOT EXISTS rent_share DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS rent_share_percentage DECIMAL(5, 2);

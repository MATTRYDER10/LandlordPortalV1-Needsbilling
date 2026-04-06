ALTER TABLE tenant_offer_tenants ADD COLUMN IF NOT EXISTS first_name_encrypted TEXT;
ALTER TABLE tenant_offer_tenants ADD COLUMN IF NOT EXISTS last_name_encrypted TEXT;
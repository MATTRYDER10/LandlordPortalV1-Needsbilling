ALTER TABLE tenant_offer_tenants
  ADD COLUMN IF NOT EXISTS address_line2_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS address_city_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS address_county_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS address_postcode_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS address_country_encrypted TEXT;

ALTER TABLE tenant_offers
  ADD COLUMN IF NOT EXISTS holding_deposit_amount DECIMAL(10, 2);

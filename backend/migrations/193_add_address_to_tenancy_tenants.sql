ALTER TABLE tenancy_tenants
ADD COLUMN IF NOT EXISTS residential_address_line1_encrypted TEXT,
ADD COLUMN IF NOT EXISTS residential_address_line2_encrypted TEXT,
ADD COLUMN IF NOT EXISTS residential_city_encrypted TEXT,
ADD COLUMN IF NOT EXISTS residential_postcode_encrypted TEXT;

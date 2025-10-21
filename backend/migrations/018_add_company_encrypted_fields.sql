-- Add encrypted company information fields
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS address_encrypted TEXT,
ADD COLUMN IF NOT EXISTS city_encrypted TEXT,
ADD COLUMN IF NOT EXISTS postcode_encrypted TEXT,
ADD COLUMN IF NOT EXISTS website_encrypted TEXT;

-- Note: name_encrypted, phone_encrypted, and email_encrypted should already exist
-- If they don't exist, add them too:
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS name_encrypted TEXT,
ADD COLUMN IF NOT EXISTS phone_encrypted TEXT,
ADD COLUMN IF NOT EXISTS email_encrypted TEXT;

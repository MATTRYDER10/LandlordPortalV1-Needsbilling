-- Add payment reference to agreements
ALTER TABLE agreements
ADD COLUMN IF NOT EXISTS payment_reference TEXT;

COMMENT ON COLUMN agreements.payment_reference IS 'Optional payment reference for rent payments; defaults to property address in templates when blank.';

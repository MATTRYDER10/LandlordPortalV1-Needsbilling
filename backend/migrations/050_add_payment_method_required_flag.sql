-- Migration 050: Add flag to track if company needs to add payment method
-- Used to show banners and warnings about adding payment methods

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS payment_method_required BOOLEAN DEFAULT TRUE;

-- Set to FALSE for companies that already have payment methods
UPDATE companies
SET payment_method_required = FALSE
WHERE stripe_payment_method_id IS NOT NULL;

COMMENT ON COLUMN companies.payment_method_required IS 'Flag to indicate if company needs to add a payment method (for UI banners/warnings)';

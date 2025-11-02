-- Migration 049: Add guarantor reference pricing to pricing_config
-- Guarantor references are charged per-use at £9.99 each

-- First, update the CHECK constraint to allow 'guarantor_reference' product type
ALTER TABLE pricing_config DROP CONSTRAINT IF EXISTS pricing_config_product_type_check;

ALTER TABLE pricing_config ADD CONSTRAINT pricing_config_product_type_check
  CHECK (product_type IN (
    'credit_subscription',
    'credit_pack',
    'agreement',
    'guarantor_reference'
  ));

-- Insert guarantor reference pricing
INSERT INTO pricing_config (
  product_type,
  product_key,
  product_name,
  description,
  price_gbp,
  display_order,
  active
) VALUES (
  'guarantor_reference',
  'guarantor_reference_standard',
  'Guarantor Reference',
  'Processing fee for guarantor reference check (£9.99 per guarantor)',
  9.99,
  20,
  TRUE
)
ON CONFLICT (product_key) DO UPDATE SET
  price_gbp = EXCLUDED.price_gbp,
  active = EXCLUDED.active,
  updated_at = NOW();

-- Create table to track guarantor reference payments
CREATE TABLE IF NOT EXISTS guarantor_reference_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  guarantor_reference_id UUID NOT NULL REFERENCES tenant_references(id) ON DELETE CASCADE,

  -- Payment details
  amount_gbp DECIMAL(10, 2) NOT NULL CHECK (amount_gbp > 0),

  -- Stripe payment details
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_charge_id TEXT,
  payment_status TEXT NOT NULL CHECK (payment_status IN (
    'pending',
    'processing',
    'succeeded',
    'failed',
    'canceled',
    'refunded'
  )),

  -- Failure handling
  failure_code TEXT,
  failure_message TEXT,

  -- Metadata
  metadata JSONB,

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT unique_guarantor_reference_payment UNIQUE (guarantor_reference_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_guarantor_reference_payments_company_id ON guarantor_reference_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_guarantor_reference_payments_guarantor_reference_id ON guarantor_reference_payments(guarantor_reference_id);
CREATE INDEX IF NOT EXISTS idx_guarantor_reference_payments_status ON guarantor_reference_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_guarantor_reference_payments_created_at ON guarantor_reference_payments(created_at DESC);

COMMENT ON TABLE guarantor_reference_payments IS 'Payment records for pay-per-use guarantor reference processing';
COMMENT ON TABLE pricing_config IS 'Flexible pricing configuration for all billable products including guarantor references';

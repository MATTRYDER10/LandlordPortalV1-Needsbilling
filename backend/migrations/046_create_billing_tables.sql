-- Migration 046: Create billing and credit system tables
-- This migration creates the core billing infrastructure for PropertyGoose

-- ============================================================================
-- 1. SUBSCRIPTIONS TABLE
-- Tracks recurring credit subscriptions for companies
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Stripe integration
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT NOT NULL,

  -- Subscription tier details
  tier TEXT NOT NULL CHECK (tier IN ('small', 'medium', 'large', 'enterprise')),
  credits_per_month INTEGER NOT NULL,
  price_per_credit DECIMAL(10, 2) NOT NULL,
  monthly_total DECIMAL(10, 2) NOT NULL,

  -- Subscription status
  status TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'canceled', 'incomplete', 'trialing')),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMP WITH TIME ZONE,

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_active_subscription_per_company UNIQUE (company_id, status)
    WHERE status IN ('active', 'trialing')
);

-- Index for faster lookups
CREATE INDEX idx_subscriptions_company_id ON subscriptions(company_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- ============================================================================
-- 2. CREDIT TRANSACTIONS TABLE
-- Logs all credit additions and deductions
-- ============================================================================
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Transaction type and amount
  type TEXT NOT NULL CHECK (type IN (
    'subscription_credit',    -- Credits added via subscription renewal
    'pack_purchase',          -- Credits purchased as one-off pack
    'credit_used',            -- Credit deducted for reference creation
    'auto_recharge',          -- Auto-recharge triggered
    'manual_adjustment',      -- Staff manual adjustment
    'refund'                  -- Refunded credits
  )),
  credits_change INTEGER NOT NULL, -- Positive for additions, negative for deductions
  credits_balance_after INTEGER NOT NULL CHECK (credits_balance_after >= 0),

  -- Payment details (for credit purchases)
  amount_gbp DECIMAL(10, 2),
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,

  -- Reference to what consumed the credit (for deductions)
  reference_id UUID REFERENCES tenant_references(id) ON DELETE SET NULL,

  -- Additional context
  description TEXT NOT NULL,
  metadata JSONB, -- Flexible field for additional data

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes for common queries
CREATE INDEX idx_credit_transactions_company_id ON credit_transactions(company_id);
CREATE INDEX idx_credit_transactions_type ON credit_transactions(type);
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX idx_credit_transactions_reference_id ON credit_transactions(reference_id);

-- ============================================================================
-- 3. AGREEMENT PAYMENTS TABLE
-- Tracks pay-per-use payments for agreement generation
-- ============================================================================
CREATE TABLE IF NOT EXISTS agreement_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agreement_id UUID NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,

  -- Payment details
  amount_gbp DECIMAL(10, 2) NOT NULL CHECK (amount_gbp > 0),
  agreement_type TEXT NOT NULL DEFAULT 'standard', -- 'standard', 'complex', 'notice', etc.

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

  CONSTRAINT unique_agreement_payment UNIQUE (agreement_id)
);

-- Indexes
CREATE INDEX idx_agreement_payments_company_id ON agreement_payments(company_id);
CREATE INDEX idx_agreement_payments_agreement_id ON agreement_payments(agreement_id);
CREATE INDEX idx_agreement_payments_status ON agreement_payments(payment_status);
CREATE INDEX idx_agreement_payments_created_at ON agreement_payments(created_at DESC);

-- ============================================================================
-- 4. PRICING CONFIG TABLE
-- Flexible pricing configuration for products
-- ============================================================================
CREATE TABLE IF NOT EXISTS pricing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Product identification
  product_type TEXT NOT NULL CHECK (product_type IN (
    'credit_subscription',  -- Monthly subscription tier
    'credit_pack',          -- One-off credit pack
    'agreement'             -- Agreement generation pricing
  )),
  product_key TEXT NOT NULL UNIQUE, -- Unique identifier (e.g., 'subscription_medium', 'pack_25')
  product_name TEXT NOT NULL,       -- Display name
  description TEXT,

  -- Credit products (subscriptions and packs)
  credits_quantity INTEGER,
  price_per_credit DECIMAL(10, 2),

  -- Direct pricing (for agreements)
  price_gbp DECIMAL(10, 2),

  -- Stripe integration
  stripe_price_id TEXT,
  stripe_product_id TEXT,

  -- Display and ordering
  display_order INTEGER DEFAULT 0,
  is_popular BOOLEAN DEFAULT FALSE,
  is_recommended BOOLEAN DEFAULT FALSE,

  -- Status
  active BOOLEAN DEFAULT TRUE,

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for active products lookup
CREATE INDEX idx_pricing_config_product_type ON pricing_config(product_type) WHERE active = TRUE;
CREATE INDEX idx_pricing_config_display_order ON pricing_config(display_order);

-- ============================================================================
-- 5. ADD COLUMNS TO COMPANIES TABLE
-- Add billing-related fields to existing companies table
-- ============================================================================
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS reference_credits INTEGER DEFAULT 0 CHECK (reference_credits >= 0),
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT,
ADD COLUMN IF NOT EXISTS billing_email TEXT,
ADD COLUMN IF NOT EXISTS auto_recharge_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_recharge_threshold INTEGER DEFAULT 5 CHECK (auto_recharge_threshold >= 0),
ADD COLUMN IF NOT EXISTS auto_recharge_pack_size INTEGER DEFAULT 25;

-- Index for Stripe customer lookups
CREATE INDEX IF NOT EXISTS idx_companies_stripe_customer_id ON companies(stripe_customer_id);

-- ============================================================================
-- 6. CREATE UPDATE TRIGGER FOR UPDATED_AT COLUMNS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables with updated_at
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_config_updated_at
    BEFORE UPDATE ON pricing_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE subscriptions IS 'Tracks recurring credit subscriptions for companies';
COMMENT ON TABLE credit_transactions IS 'Transaction log for all credit additions and deductions';
COMMENT ON TABLE agreement_payments IS 'Payment records for pay-per-use agreement generation';
COMMENT ON TABLE pricing_config IS 'Flexible pricing configuration for all billable products';

COMMENT ON COLUMN companies.reference_credits IS 'Current balance of reference credits available to this company';
COMMENT ON COLUMN companies.stripe_customer_id IS 'Stripe customer ID for billing integration';
COMMENT ON COLUMN companies.auto_recharge_enabled IS 'Whether to automatically purchase credits when balance is low';

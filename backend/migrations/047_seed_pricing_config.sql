-- Migration 047: Seed pricing configuration data
-- This migration populates initial pricing for subscriptions, credit packs, and agreements

-- ============================================================================
-- 1. SUBSCRIPTION TIERS
-- Monthly recurring subscriptions that deliver credits
-- Billed upfront each month, credits roll over forever
-- ============================================================================

-- Small Tier (Under 20 references/month)
INSERT INTO pricing_config (
  product_type,
  product_key,
  product_name,
  description,
  credits_quantity,
  price_per_credit,
  price_gbp,
  display_order,
  is_popular,
  active
) VALUES (
  'credit_subscription',
  'subscription_small',
  'Small (Under 20)',
  'Perfect for smaller agencies processing fewer than 20 references per month',
  20,
  17.50,
  350.00,
  1,
  FALSE,
  TRUE
);

-- Medium Tier (20-39 references/month) - MOST POPULAR
INSERT INTO pricing_config (
  product_type,
  product_key,
  product_name,
  description,
  credits_quantity,
  price_per_credit,
  price_gbp,
  display_order,
  is_popular,
  is_recommended,
  active
) VALUES (
  'credit_subscription',
  'subscription_medium',
  'Medium (20-39)',
  'Most popular plan for growing agencies processing 20-39 references per month',
  30,
  16.00,
  480.00,
  2,
  TRUE,
  TRUE,
  TRUE
);

-- Large Tier (40-49 references/month)
INSERT INTO pricing_config (
  product_type,
  product_key,
  product_name,
  description,
  credits_quantity,
  price_per_credit,
  price_gbp,
  display_order,
  is_popular,
  active
) VALUES (
  'credit_subscription',
  'subscription_large',
  'Large (40-49)',
  'Ideal for busy agencies processing 40-49 references per month',
  45,
  15.00,
  675.00,
  3,
  FALSE,
  TRUE
);

-- Enterprise Tier (50+ references/month)
INSERT INTO pricing_config (
  product_type,
  product_key,
  product_name,
  description,
  credits_quantity,
  price_per_credit,
  price_gbp,
  display_order,
  is_popular,
  active
) VALUES (
  'credit_subscription',
  'subscription_enterprise',
  'Enterprise (50+)',
  'Best value for high-volume agencies processing 50+ references per month',
  50,
  13.00,
  650.00,
  4,
  FALSE,
  TRUE
);

-- ============================================================================
-- 2. ONE-OFF CREDIT PACKS
-- Pay-as-you-go credit packs (no subscription required)
-- 20% premium over subscription pricing to incentivize subscriptions
-- Credits never expire
-- ============================================================================

-- 10 Credit Pack
INSERT INTO pricing_config (
  product_type,
  product_key,
  product_name,
  description,
  credits_quantity,
  price_per_credit,
  price_gbp,
  display_order,
  active
) VALUES (
  'credit_pack',
  'pack_10',
  '10 Reference Credits',
  'Perfect for occasional use. Credits never expire.',
  10,
  21.00,
  210.00,
  5,
  TRUE
);

-- 25 Credit Pack
INSERT INTO pricing_config (
  product_type,
  product_key,
  product_name,
  description,
  credits_quantity,
  price_per_credit,
  price_gbp,
  display_order,
  active
) VALUES (
  'credit_pack',
  'pack_25',
  '25 Reference Credits',
  'Great value for medium usage. Credits never expire.',
  25,
  19.20,
  480.00,
  6,
  TRUE
);

-- 50 Credit Pack - RECOMMENDED
INSERT INTO pricing_config (
  product_type,
  product_key,
  product_name,
  description,
  credits_quantity,
  price_per_credit,
  price_gbp,
  display_order,
  is_recommended,
  active
) VALUES (
  'credit_pack',
  'pack_50',
  '50 Reference Credits',
  'Best value for one-off purchase. Credits never expire.',
  50,
  18.00,
  900.00,
  7,
  TRUE,
  TRUE
);

-- 100 Credit Pack
INSERT INTO pricing_config (
  product_type,
  product_key,
  product_name,
  description,
  credits_quantity,
  price_per_credit,
  price_gbp,
  display_order,
  active
) VALUES (
  'credit_pack',
  'pack_100',
  '100 Reference Credits',
  'Maximum savings for high-volume users. Credits never expire.',
  100,
  15.60,
  1560.00,
  8,
  TRUE
);

-- ============================================================================
-- 3. AGREEMENT PRICING
-- Pay-per-use pricing for agreement generation
-- Charged immediately when agreement PDF is generated
-- ============================================================================

-- Standard Agreement
INSERT INTO pricing_config (
  product_type,
  product_key,
  product_name,
  description,
  price_gbp,
  display_order,
  active
) VALUES (
  'agreement',
  'agreement_standard',
  'Standard Tenancy Agreement',
  'Comprehensive tenancy agreement with all standard clauses',
  9.99,
  10,
  TRUE
);

-- Placeholder for future agreement types
-- These can be activated later as new agreement types are built

INSERT INTO pricing_config (
  product_type,
  product_key,
  product_name,
  description,
  price_gbp,
  display_order,
  active
) VALUES (
  'agreement',
  'agreement_notice',
  'Tenancy Notice',
  'Section 21 or Section 8 notice generation',
  14.99,
  11,
  FALSE  -- Not active yet
);

INSERT INTO pricing_config (
  product_type,
  product_key,
  product_name,
  description,
  price_gbp,
  display_order,
  active
) VALUES (
  'agreement',
  'agreement_renewal',
  'Tenancy Renewal Agreement',
  'Tenancy renewal or extension agreement',
  7.99,
  12,
  FALSE  -- Not active yet
);

-- ============================================================================
-- VERIFICATION QUERY
-- Run this to verify pricing was seeded correctly
-- ============================================================================

-- SELECT
--   product_type,
--   product_name,
--   credits_quantity,
--   price_per_credit,
--   price_gbp,
--   CASE
--     WHEN is_popular THEN 'POPULAR'
--     WHEN is_recommended THEN 'RECOMMENDED'
--     ELSE ''
--   END as badge,
--   active
-- FROM pricing_config
-- ORDER BY display_order;

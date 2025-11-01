-- Migration: Update pricing_config with Stripe Price IDs
-- Created: 2025-11-01
-- Description: Maps pricing_config records to Stripe price IDs

-- Update Subscription Tiers
UPDATE pricing_config
SET stripe_price_id = 'price_1SOiFNLLQSrQhTAAQ6xZdkmS'
WHERE product_type = 'credit_subscription' AND product_key = 'subscription_small';

UPDATE pricing_config
SET stripe_price_id = 'price_1SOiFWLLQSrQhTAAgdNLLyzW'
WHERE product_type = 'credit_subscription' AND product_key = 'subscription_medium';

UPDATE pricing_config
SET stripe_price_id = 'price_1SOiFfLLQSrQhTAAiib5SGAI'
WHERE product_type = 'credit_subscription' AND product_key = 'subscription_large';

UPDATE pricing_config
SET stripe_price_id = 'price_1SOiFrLLQSrQhTAATzrKJWK2'
WHERE product_type = 'credit_subscription' AND product_key = 'subscription_enterprise';

-- Update Credit Packs
UPDATE pricing_config
SET stripe_price_id = 'price_1SOiEZLLQSrQhTAACoLigRHh'
WHERE product_type = 'credit_pack' AND product_key = 'pack_10';

UPDATE pricing_config
SET stripe_price_id = 'price_1SOiEoLLQSrQhTAA8Srywgds'
WHERE product_type = 'credit_pack' AND product_key = 'pack_25';

UPDATE pricing_config
SET stripe_price_id = 'price_1SOiEwLLQSrQhTAAiuu3pvSj'
WHERE product_type = 'credit_pack' AND product_key = 'pack_50';

UPDATE pricing_config
SET stripe_price_id = 'price_1SOiF7LLQSrQhTAAyVGUARMe'
WHERE product_type = 'credit_pack' AND product_key = 'pack_100';

-- Verify updates
SELECT
    product_type,
    product_key,
    product_name,
    price_gbp,
    stripe_price_id,
    CASE
        WHEN stripe_price_id IS NOT NULL THEN '✓ Mapped'
        ELSE '✗ Missing'
    END AS status
FROM pricing_config
ORDER BY product_type, price_gbp;

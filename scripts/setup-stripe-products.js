#!/usr/bin/env node
/**
 * Provisions the Stripe product + prices for the landlord portal.
 *
 * Per BACKEND_REQUIREMENTS.md only the "Landlord Full Self-Management"
 * subscription needs a Stripe Product. Reference and agreement payments
 * use dynamic PaymentIntents and don't need products.
 *
 * Idempotent: identifies the product by metadata.product_key and prices
 * by lookup_key, so re-running won't create duplicates.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/setup-stripe-products.js
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/setup-stripe-products.js --dry-run
 */

const Stripe = require('stripe');

const PRODUCT_KEY = 'landlord_full_management';

const PRODUCT = {
  name: 'Landlord Full Self-Management',
  description:
    'Unlocks the Tenancies tab, agreement generation, and discounted referencing (£13/ref) for self-managing landlords.',
  metadata: {
    product_key: PRODUCT_KEY,
    portal: 'landlord',
  },
};

// Stripe wants amounts in pence
const PRICES = [
  {
    lookup_key: 'landlord_full_management_launch',
    nickname: 'Launch (until 1 May 2026) — £11.99/mo',
    unit_amount: 1199,
    metadata: { product_key: PRODUCT_KEY, tier: 'launch' },
  },
  {
    lookup_key: 'landlord_full_management_standard',
    nickname: 'Standard — £14.99/mo',
    unit_amount: 1499,
    metadata: { product_key: PRODUCT_KEY, tier: 'standard' },
  },
];

const CURRENCY = 'gbp';
const RECURRING = { interval: 'month' };

const DRY_RUN = process.argv.includes('--dry-run');

function fail(msg) {
  console.error(`\n  ERROR: ${msg}\n`);
  process.exit(1);
}

async function findProductByKey(stripe, key) {
  // search API requires the search add-on; fall back to listing if it errors
  try {
    const res = await stripe.products.search({
      query: `metadata['product_key']:'${key}'`,
      limit: 1,
    });
    return res.data[0] ?? null;
  } catch (err) {
    const list = await stripe.products.list({ limit: 100, active: true });
    return list.data.find((p) => p.metadata?.product_key === key) ?? null;
  }
}

async function findPriceByLookupKey(stripe, lookupKey) {
  const res = await stripe.prices.list({
    lookup_keys: [lookupKey],
    limit: 1,
    active: true,
  });
  return res.data[0] ?? null;
}

async function ensureProduct(stripe) {
  const existing = await findProductByKey(stripe, PRODUCT_KEY);
  if (existing) {
    console.log(`  Product exists: ${existing.id} (${existing.name})`);
    return existing;
  }
  if (DRY_RUN) {
    console.log(`  [dry-run] Would create product: ${PRODUCT.name}`);
    return { id: '<would-create>', ...PRODUCT };
  }
  const created = await stripe.products.create(PRODUCT);
  console.log(`  Created product: ${created.id} (${created.name})`);
  return created;
}

async function ensurePrice(stripe, productId, priceSpec) {
  const existing = await findPriceByLookupKey(stripe, priceSpec.lookup_key);
  if (existing) {
    if (existing.product !== productId && productId !== '<would-create>') {
      fail(
        `Price ${existing.id} (lookup_key ${priceSpec.lookup_key}) is attached to product ${existing.product}, expected ${productId}. Resolve manually.`,
      );
    }
    console.log(
      `  Price exists: ${existing.id} (${priceSpec.lookup_key}, £${(existing.unit_amount / 100).toFixed(2)}/${existing.recurring?.interval})`,
    );
    return existing;
  }
  if (DRY_RUN) {
    console.log(
      `  [dry-run] Would create price: ${priceSpec.lookup_key} £${(priceSpec.unit_amount / 100).toFixed(2)}/${RECURRING.interval}`,
    );
    return { id: '<would-create>', ...priceSpec };
  }
  const created = await stripe.prices.create({
    product: productId,
    currency: CURRENCY,
    unit_amount: priceSpec.unit_amount,
    recurring: RECURRING,
    lookup_key: priceSpec.lookup_key,
    nickname: priceSpec.nickname,
    metadata: priceSpec.metadata,
  });
  console.log(
    `  Created price: ${created.id} (${priceSpec.lookup_key}, £${(created.unit_amount / 100).toFixed(2)}/${created.recurring.interval})`,
  );
  return created;
}

function printSummary(product, prices) {
  const launch = prices.find((p) => p.lookup_key === 'landlord_full_management_launch');
  const standard = prices.find((p) => p.lookup_key === 'landlord_full_management_standard');

  console.log('\n----------------------------------------------------------');
  console.log('  Done. Wire these into the backend:');
  console.log('----------------------------------------------------------');
  console.log(`  product_key       : ${PRODUCT_KEY}`);
  console.log(`  stripe_product_id : ${product.id}`);
  console.log(`  launch price id   : ${launch?.id ?? '(none)'}`);
  console.log(`  standard price id : ${standard?.id ?? '(none)'}`);
  console.log('\n  SQL — register in subscription_tiers (adjust column names to match your schema):');
  console.log(`
INSERT INTO subscription_tiers
  (product_key, product_name, description, price_gbp, stripe_price_id, is_recommended)
VALUES
  ('${PRODUCT_KEY}',
   '${PRODUCT.name}',
   '${PRODUCT.description.replace(/'/g, "''")}',
   11.99,
   '${launch?.id ?? '<launch-price-id>'}',
   true)
ON CONFLICT (product_key) DO UPDATE
  SET stripe_price_id = EXCLUDED.stripe_price_id,
      price_gbp       = EXCLUDED.price_gbp,
      product_name    = EXCLUDED.product_name,
      description     = EXCLUDED.description;
`);
  console.log('  After 1 May 2026, switch stripe_price_id to the standard price and price_gbp to 14.99.');
  console.log('----------------------------------------------------------\n');
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) fail('STRIPE_SECRET_KEY env var is required.');
  if (!key.startsWith('sk_')) fail('STRIPE_SECRET_KEY does not look like a Stripe secret key.');

  const mode = key.startsWith('sk_live_') ? 'LIVE' : 'TEST';
  console.log(`\n  Stripe mode: ${mode}${DRY_RUN ? ' (dry run)' : ''}`);
  if (mode === 'LIVE' && !DRY_RUN) {
    console.log('  WARNING: writing to LIVE Stripe account in 3s. Ctrl-C to cancel.');
    await new Promise((r) => setTimeout(r, 3000));
  }

  const stripe = new Stripe(key, { apiVersion: '2024-06-20' });

  console.log('\n  → Product');
  const product = await ensureProduct(stripe);

  console.log('\n  → Prices');
  const prices = [];
  for (const spec of PRICES) {
    prices.push(await ensurePrice(stripe, product.id, spec));
  }

  printSummary(product, prices);
}

main().catch((err) => {
  console.error('\n  Stripe setup failed:');
  console.error(err.message ?? err);
  process.exit(1);
});

const { supabase } = require('./dist/config/supabase');

(async () => {
  console.log('Testing pricing_config table...\n');

  const { data, error } = await supabase
    .from('pricing_config')
    .select('product_key, product_name, price_gbp, stripe_price_id, active')
    .eq('product_type', 'credit_pack')
    .eq('active', true);

  if (error) {
    console.error('ERROR:', error.message);
    console.error('Details:', error);
  } else if (!data || data.length === 0) {
    console.log('No credit packs found in pricing_config table!');
    console.log('You may need to run migrations 047 and 048.');
  } else {
    console.log('Credit Packs found:', data.length);
    console.log(JSON.stringify(data, null, 2));
  }

  process.exit(0);
})();

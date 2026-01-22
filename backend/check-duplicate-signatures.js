const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://spaetpdmlqfygsxiawul.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('🔍 Checking for duplicate agreement signatures\n');
  console.log('='.repeat(80));
  console.log('');

  // Get all signatures for 21 Chandler Close
  const { data: signatures, error } = await supabase
    .from('agreement_signatures')
    .select(`
      id,
      agreement_id,
      signer_name,
      signer_email,
      signer_type,
      status,
      created_at,
      agreements!inner (
        id,
        property_address
      )
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${signatures?.length || 0} recent signatures\n`);

  // Filter to 21 Chandler Close
  const chandlerSigs = signatures.filter(sig => {
    const address = sig.agreements?.property_address;
    if (!address) return false;
    const fullAddress = [address.line1, address.city, address.postcode]
      .filter(Boolean)
      .join(', ');
    return fullAddress.toLowerCase().includes('chandler');
  });

  if (chandlerSigs.length === 0) {
    console.log('No signatures found for Chandler Close\n');
    return;
  }

  console.log(`Found ${chandlerSigs.length} signatures for Chandler Close:\n`);

  // Group by agreement_id
  const byAgreement = {};
  chandlerSigs.forEach(sig => {
    if (!byAgreement[sig.agreement_id]) {
      byAgreement[sig.agreement_id] = [];
    }
    byAgreement[sig.agreement_id].push(sig);
  });

  Object.entries(byAgreement).forEach(([agreementId, sigs]) => {
    console.log(`Agreement ${agreementId}:`);

    // Check for duplicate emails
    const emailCount = {};
    sigs.forEach(sig => {
      if (!emailCount[sig.signer_email]) {
        emailCount[sig.signer_email] = [];
      }
      emailCount[sig.signer_email].push(sig);
    });

    const duplicates = Object.entries(emailCount).filter(([email, sigs]) => sigs.length > 1);

    if (duplicates.length > 0) {
      console.log(`  ⚠️  DUPLICATES FOUND:`);
      duplicates.forEach(([email, sigs]) => {
        console.log(`    ${email} - ${sigs.length} signature records:`);
        sigs.forEach(sig => {
          console.log(`      - ID: ${sig.id}, Type: ${sig.signer_type}, Status: ${sig.status}, Created: ${sig.created_at}`);
        });
      });
    } else {
      console.log(`  ✅ No duplicate emails`);
    }

    // List all signers
    console.log(`  Signers (${sigs.length} total):`);
    sigs.forEach(sig => {
      console.log(`    - ${sig.signer_name} (${sig.signer_email}) - ${sig.signer_type} - ${sig.status}`);
    });
    console.log('');
  });

  console.log('='.repeat(80));
  console.log('\n💡 If duplicates are found, check:');
  console.log('   1. Are there multiple agreements for the same property?');
  console.log('   2. Was the agreement created multiple times?');
  console.log('   3. Is initiateSigning() being called twice?');
  console.log('');
})();

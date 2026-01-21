const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://spaetpdmlqfygsxiawul.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

function decrypt(encryptedText) {
  if (!encryptedText) return null;
  try {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    return null;
  }
}

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('🔍 CHECKING RECENT VERIFICATIONS\n');
  console.log('='.repeat(80));
  console.log('');

  // Get recently completed/verified references (last 24 hours)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: references, error: refError } = await supabase
    .from('tenant_references')
    .select(`
      id,
      status,
      verification_state,
      submitted_at,
      verified_at,
      tenant_first_name_encrypted,
      tenant_last_name_encrypted,
      property_address_encrypted,
      is_guarantor,
      company:companies(name_encrypted)
    `)
    .in('verification_state', ['COMPLETED', 'REJECTED'])
    .gte('verified_at', yesterday)
    .order('verified_at', { ascending: false });

  if (refError) {
    console.error('Error fetching verified references:', refError);
    return;
  }

  console.log(`Found ${references.length} references verified in the last 24 hours\n`);

  if (references.length === 0) {
    console.log('No references verified recently.');
    console.log('\nLet me check all COMPLETED/REJECTED references instead...\n');

    const { data: allVerified, error: allError } = await supabase
      .from('tenant_references')
      .select(`
        id,
        status,
        verification_state,
        submitted_at,
        verified_at,
        tenant_first_name_encrypted,
        tenant_last_name_encrypted,
        property_address_encrypted,
        is_guarantor,
        company:companies(name_encrypted)
      `)
      .in('verification_state', ['COMPLETED', 'REJECTED'])
      .order('verified_at', { ascending: false })
      .limit(10);

    if (allError) {
      console.error('Error fetching all verified references:', allError);
      return;
    }

    console.log(`Showing last 10 verified references:\n`);

    allVerified.forEach((ref, i) => {
      const tenantName = `${decrypt(ref.tenant_first_name_encrypted) || ''} ${decrypt(ref.tenant_last_name_encrypted) || ''}`.trim();
      const propertyAddress = decrypt(ref.property_address_encrypted) || 'N/A';
      const companyName = decrypt(ref.company?.name_encrypted) || 'N/A';
      const type = ref.is_guarantor ? 'Guarantor' : 'Tenant';

      console.log(`${i + 1}. ${tenantName} (${type})`);
      console.log(`   Property: ${propertyAddress}`);
      console.log(`   Company: ${companyName}`);
      console.log(`   Status: ${ref.status}`);
      console.log(`   Verification State: ${ref.verification_state}`);
      console.log(`   Verified At: ${ref.verified_at || 'Not set'}`);
      console.log(`   Reference ID: ${ref.id}`);
      console.log('');
    });
    return;
  }

  references.forEach((ref, i) => {
    const tenantName = `${decrypt(ref.tenant_first_name_encrypted) || ''} ${decrypt(ref.tenant_last_name_encrypted) || ''}`.trim();
    const propertyAddress = decrypt(ref.property_address_encrypted) || 'N/A';
    const companyName = decrypt(ref.company?.name_encrypted) || 'N/A';
    const type = ref.is_guarantor ? 'Guarantor' : 'Tenant';

    console.log(`${i + 1}. ${tenantName} (${type})`);
    console.log(`   Property: ${propertyAddress}`);
    console.log(`   Company: ${companyName}`);
    console.log(`   Status: ${ref.status}`);
    console.log(`   Verification State: ${ref.verification_state}`);
    console.log(`   Submitted: ${ref.submitted_at || 'N/A'}`);
    console.log(`   Verified: ${ref.verified_at}`);
    console.log(`   Reference ID: ${ref.id}`);
    console.log('');
  });

  console.log('='.repeat(80));
  console.log(`\n✅ Total verified in last 24h: ${references.length}\n`);
})();

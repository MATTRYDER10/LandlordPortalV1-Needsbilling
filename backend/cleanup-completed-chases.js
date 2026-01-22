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
  console.log('🧹 CLEANUP: Marking chase dependencies as RECEIVED for completed references\n');
  console.log('='.repeat(80));
  console.log('');

  // Get all chase dependencies in PENDING or CHASING status
  const { data: dependencies, error: depsError } = await supabase
    .from('chase_dependencies')
    .select(`
      id,
      reference_id,
      dependency_type,
      status,
      created_at,
      reference:tenant_references!chase_dependencies_reference_id_fkey (
        id,
        status,
        verification_state,
        tenant_first_name_encrypted,
        tenant_last_name_encrypted,
        property_address_encrypted,
        company:companies(name_encrypted)
      )
    `)
    .in('status', ['PENDING', 'CHASING'])
    .order('created_at', { ascending: false });

  if (depsError) {
    console.error('Error fetching dependencies:', depsError);
    return;
  }

  console.log(`Found ${dependencies.length} chase dependencies in PENDING/CHASING status\n`);

  // Filter to those with COMPLETED references only
  const toMarkReceived = dependencies.filter(dep => {
    if (!dep.reference) return false;

    return dep.reference.status === 'completed' ||
           dep.reference.verification_state === 'COMPLETED';
  });

  console.log(`Found ${toMarkReceived.length} chase dependencies that should be marked RECEIVED\n`);

  if (toMarkReceived.length === 0) {
    console.log('✅ No cleanup needed - all chase dependencies are correctly synced\n');
    return;
  }

  console.log('Chase dependencies to mark as RECEIVED:\n');
  toMarkReceived.forEach((dep, i) => {
    const tenantName = `${decrypt(dep.reference.tenant_first_name_encrypted) || ''} ${decrypt(dep.reference.tenant_last_name_encrypted) || ''}`.trim();
    const propertyAddress = decrypt(dep.reference.property_address_encrypted) || 'N/A';
    const companyName = decrypt(dep.reference.company?.name_encrypted) || 'N/A';

    console.log(`${i + 1}. ${dep.dependency_type}`);
    console.log(`   Tenant: ${tenantName}`);
    console.log(`   Property: ${propertyAddress}`);
    console.log(`   Company: ${companyName}`);
    console.log(`   Reference Status: ${dep.reference.status}`);
    console.log(`   Verification State: ${dep.reference.verification_state || 'N/A'}`);
    console.log(`   Dependency ID: ${dep.id}`);
    console.log('');
  });

  console.log('='.repeat(80));
  console.log('\n⚠️  Ready to mark these chase dependencies as RECEIVED.');
  console.log('This will stop auto-chases since the reference is complete.\n');

  // Mark all dependencies as RECEIVED
  let successCount = 0;
  let failCount = 0;

  for (const dep of toMarkReceived) {
    const { error } = await supabase
      .from('chase_dependencies')
      .update({
        status: 'RECEIVED',
        updated_at: new Date().toISOString()
      })
      .eq('id', dep.id);

    if (error) {
      console.error(`❌ Failed to mark ${dep.dependency_type} as RECEIVED:`, error.message);
      failCount++;
    } else {
      successCount++;
    }
  }

  console.log('');
  console.log('='.repeat(80));
  console.log(`\n✅ Cleanup complete: ${successCount} marked as RECEIVED, ${failCount} failed\n`);
  console.log('Going forward, chase dependencies will be automatically marked RECEIVED when');
  console.log('a reference is completed/verified.\n');
})();

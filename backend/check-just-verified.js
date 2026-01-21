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
  console.log('🔍 CHECKING VERIFICATION WORK ITEMS\n');
  console.log('='.repeat(80));
  console.log('');

  // Check work_items table for recently completed VERIFY tasks
  const { data: workItems, error: workError } = await supabase
    .from('work_items')
    .select(`
      id,
      reference_id,
      work_type,
      status,
      completed_at,
      assigned_to,
      tenant_reference:tenant_references (
        id,
        verification_state,
        status,
        tenant_first_name_encrypted,
        tenant_last_name_encrypted,
        property_address_encrypted,
        is_guarantor,
        company:companies(name_encrypted)
      )
    `)
    .eq('work_type', 'VERIFY')
    .eq('status', 'COMPLETED')
    .order('completed_at', { ascending: false })
    .limit(10);

  if (workError) {
    console.error('Error fetching work items:', workError);
    return;
  }

  console.log(`Found ${workItems.length} recently completed VERIFY work items\n`);

  workItems.forEach((item, i) => {
    const ref = item.tenant_reference;
    if (!ref) {
      console.log(`${i + 1}. Work Item ${item.id} - Reference not found`);
      return;
    }

    const tenantName = `${decrypt(ref.tenant_first_name_encrypted) || ''} ${decrypt(ref.tenant_last_name_encrypted) || ''}`.trim() || 'Unknown';
    const propertyAddress = decrypt(ref.property_address_encrypted) || 'N/A';
    const companyName = decrypt(ref.company?.name_encrypted) || 'N/A';
    const type = ref.is_guarantor ? 'Guarantor' : 'Tenant';

    console.log(`${i + 1}. ${tenantName} (${type})`);
    console.log(`   Property: ${propertyAddress}`);
    console.log(`   Company: ${companyName}`);
    console.log(`   Work Item Status: ${item.status}`);
    console.log(`   Work Item Completed: ${item.completed_at || 'Not set'}`);
    console.log(`   Reference Status: ${ref.status}`);
    console.log(`   Verification State: ${ref.verification_state}`);
    console.log(`   Reference ID: ${ref.id}`);
    console.log('');
  });

  console.log('='.repeat(80));
})();

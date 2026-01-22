const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://spaetpdmlqfygsxiawul.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ? Buffer.from(process.env.ENCRYPTION_KEY, 'base64') : null;

function decrypt(encryptedText) {
  if (!encryptedText || !ENCRYPTION_KEY) return null;
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
  const refId = process.argv[2] || 'afc5ac03-9b7b-47d1-9a6d-a852acf6285b';

  console.log(`🔍 Checking reference ${refId}\n`);
  console.log('='.repeat(80));
  console.log('');

  const { data: ref, error } = await supabase
    .from('tenant_references')
    .select('*')
    .eq('id', refId)
    .single();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('📋 STATUS:\n');
  console.log(`  Current: ${ref.status}`);
  console.log(`  Submitted: ${ref.submitted_at || 'NOT SUBMITTED'}`);
  console.log(`  Verification State: ${ref.verification_state || 'N/A'}`);
  console.log('');

  const firstName = decrypt(ref.tenant_first_name_encrypted) || ref.tenant_first_name;
  const lastName = decrypt(ref.tenant_last_name_encrypted) || ref.tenant_last_name;
  const dob = decrypt(ref.date_of_birth_encrypted) || ref.date_of_birth;
  const empStatus = decrypt(ref.employment_status_encrypted) || ref.employment_status;

  console.log('📝 DATA:\n');
  console.log(`  Name: ${firstName || 'N/A'} ${lastName || 'N/A'}`);
  console.log(`  DOB: ${dob || 'N/A'}`);
  console.log(`  Employment: ${empStatus || 'N/A'}`);
  console.log('');

  if (ref.status === 'in_progress' && !ref.submitted_at) {
    console.log('❌ ISSUE: Status is "in_progress" but NOT submitted\n');
    console.log('🔧 FIXING...\n');

    const { data: updated, error: updateError } = await supabase
      .from('tenant_references')
      .update({ status: 'pending' })
      .eq('id', refId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Fix failed:', updateError);
    } else {
      console.log(`✅ FIXED! Status changed to: ${updated.status}`);
      console.log('   Will now show in "Sent" list');
    }
  } else if (ref.status === 'pending') {
    console.log('✅ Status is already correct (pending)');
  } else if (ref.status === 'in_progress' && ref.submitted_at) {
    console.log('✅ Status is correct - tenant has submitted');
  } else {
    console.log(`ℹ️  Status is: ${ref.status}`);
  }

  console.log('');
})();

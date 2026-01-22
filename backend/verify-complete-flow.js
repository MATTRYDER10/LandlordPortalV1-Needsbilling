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
  console.log('📋 CHECKING ALL NON-SUBMITTED FORMS (Pending Responses Queue)\n');
  console.log('='.repeat(80));
  console.log('');

  // Get all references that have NOT been submitted (submitted_at is NULL)
  // and are not in terminal states
  const { data: references, error } = await supabase
    .from('tenant_references')
    .select('id, status, verification_state, submitted_at, created_at, is_guarantor, tenant_first_name_encrypted, tenant_last_name_encrypted')
    .is('submitted_at', null)
    .not('status', 'in', '(completed,rejected,cancelled)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching references:', error);
    return;
  }

  console.log(`📊 Found ${references.length} references without tenant submission\n`);
  console.log('='.repeat(80));
  console.log('');

  const correctRefs = [];
  const incorrectRefs = [];

  for (const ref of references) {
    const refId = ref.id.substring(0, 8);
    const firstName = decrypt(ref.tenant_first_name_encrypted);
    const lastName = decrypt(ref.tenant_last_name_encrypted);
    const name = firstName && lastName ? `${firstName} ${lastName}` : 'Unknown';
    const type = ref.is_guarantor ? 'Guarantor' : 'Tenant';

    // Expected: status should be 'pending' and verification_state should be NULL
    const isCorrect = ref.status === 'pending' && ref.verification_state === null;

    if (isCorrect) {
      correctRefs.push({ id: ref.id, shortId: refId, name, type });
    } else {
      incorrectRefs.push({
        id: ref.id,
        shortId: refId,
        name,
        type,
        status: ref.status,
        verificationState: ref.verification_state,
        created: ref.created_at
      });
    }
  }

  console.log('📋 VALIDATION RESULTS:\n');
  console.log(`✅ Correct: ${correctRefs.length}`);
  console.log(`❌ Incorrect: ${incorrectRefs.length}`);
  console.log('');

  if (incorrectRefs.length > 0) {
    console.log('='.repeat(80));
    console.log('\n❌ REFERENCES WITH INCORRECT STATUS:\n');

    incorrectRefs.forEach((ref, index) => {
      console.log(`${index + 1}. ${ref.shortId}... - ${ref.name} (${ref.type})`);
      console.log(`   Current Status: ${ref.status}`);
      console.log(`   Current Verification State: ${ref.verificationState || 'NULL'}`);
      console.log(`   Expected Status: pending`);
      console.log(`   Expected Verification State: NULL`);
      console.log(`   Created: ${ref.created}`);
      console.log('');
    });

    console.log('='.repeat(80));
    console.log('\n🔧 FIXING INCORRECT REFERENCES...\n');

    let fixedCount = 0;
    let errorCount = 0;

    for (const ref of incorrectRefs) {
      console.log(`Fixing ${ref.shortId}... (${ref.name})`);

      const updates = { status: 'pending' };
      if (ref.verificationState !== null) {
        updates.verification_state = null;
      }

      const { error: updateError } = await supabase
        .from('tenant_references')
        .update(updates)
        .eq('id', ref.id);

      if (updateError) {
        console.error(`  ❌ Error: ${updateError.message}`);
        errorCount++;
      } else {
        console.log(`  ✅ Fixed`);
        fixedCount++;
      }
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('\n📊 FIX RESULTS:\n');
    console.log(`✅ Successfully fixed: ${fixedCount}`);
    console.log(`❌ Failed: ${errorCount}`);
  } else {
    console.log('✅ ALL PENDING RESPONSES ARE CORRECT!\n');
    console.log('All non-submitted forms are properly showing as "pending" status');
    console.log('with NULL verification_state, which means they will correctly');
    console.log('appear in the "Sent" or "Pending Responses" queue.');
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('\n📝 SUMMARY:\n');
  console.log(`Total references waiting for tenant submission: ${references.length}`);
  console.log(`Correctly configured: ${correctRefs.length}`);
  console.log(`Fixed in this run: ${incorrectRefs.length}`);
  console.log('');
  console.log('These references should appear in the "Pending Responses" queue');
  console.log('(or "Sent" status in the agent dashboard).');
  console.log('');
  console.log('='.repeat(80));
  console.log('');
})();

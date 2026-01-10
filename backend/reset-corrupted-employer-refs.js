const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Correct decrypt function
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

function decrypt(encryptedData) {
  if (!encryptedData) return null;
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'base64');
  const combined = Buffer.from(encryptedData, 'base64');
  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, TAG_POSITION);
  const tag = combined.subarray(TAG_POSITION, ENCRYPTED_POSITION);
  const encrypted = combined.subarray(ENCRYPTED_POSITION);

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch (e1) {
    try {
      const derivedKey = crypto.pbkdf2Sync(key, salt, 10000, 32, 'sha512');
      const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    } catch (e2) {
      try {
        const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha512');
        const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
      } catch (e3) {
        return null;
      }
    }
  }
}

async function resetCorruptedRefs() {
  console.log('=== RESETTING CORRUPTED EMPLOYER REFERENCES ===\n');

  // Find all employer references that have submitted_at but no data
  const { data: allEmployerRefs } = await supabase
    .from('employer_references')
    .select('*')
    .not('submitted_at', 'is', null)
    .order('submitted_at', { ascending: false });

  // Filter to find corrupted ones
  const corruptedRefs = allEmployerRefs.filter(ref => {
    const hasData = ref.company_name_encrypted ||
                    ref.annual_salary_encrypted ||
                    ref.employer_name_encrypted ||
                    ref.employee_position_encrypted ||
                    ref.employment_type ||
                    ref.employment_start_date;
    return !hasData;
  });

  console.log(`Found ${corruptedRefs.length} corrupted employer references\n`);

  const resendList = [];

  // Reset each one
  for (const ref of corruptedRefs) {
    const { data: tenantRef } = await supabase
      .from('tenant_references')
      .select('id, tenant_first_name_encrypted, tenant_last_name_encrypted, employer_ref_name_encrypted, employer_ref_email_encrypted, employer_ref_phone_encrypted, property_address_encrypted')
      .eq('id', ref.reference_id)
      .single();

    if (tenantRef) {
      const tenantName = `${decrypt(tenantRef.tenant_first_name_encrypted)} ${decrypt(tenantRef.tenant_last_name_encrypted)}`;
      const employerName = decrypt(tenantRef.employer_ref_name_encrypted);
      const employerEmail = decrypt(tenantRef.employer_ref_email_encrypted);
      const property = decrypt(tenantRef.property_address_encrypted);

      // Reset submitted_at
      const { error: updateError } = await supabase
        .from('employer_references')
        .update({ submitted_at: null })
        .eq('id', ref.id);

      if (updateError) {
        console.log(`❌ Failed to reset ${ref.id}`);
      } else {
        console.log(`✅ Reset: ${tenantName} - ${property}`);
        resendList.push({
          referenceId: ref.reference_id,
          tenantName,
          property,
          employerName,
          employerEmail
        });
      }
    }
  }

  console.log('\n=== EMPLOYER REFERENCES TO RESEND (copy this list) ===\n');

  resendList.forEach((item, i) => {
    console.log(`${i + 1}. Tenant: ${item.tenantName}`);
    console.log(`   Property: ${item.property}`);
    console.log(`   Employer: ${item.employerName}`);
    console.log(`   Email: ${item.employerEmail}`);
    console.log(`   Reference ID: ${item.referenceId}`);
    console.log('');
  });

  console.log(`\n✅ Reset ${resendList.length} employer references`);
  console.log('\nYou can now manually resend these from the deployed version.');

  process.exit(0);
}

resetCorruptedRefs();

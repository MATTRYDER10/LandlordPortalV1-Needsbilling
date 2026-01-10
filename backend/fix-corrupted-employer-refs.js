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

async function findAndFixCorruptedRefs() {
  console.log('=== FINDING CORRUPTED EMPLOYER REFERENCES ===\n');

  // Find all employer references that have submitted_at but no data
  const { data: allEmployerRefs, error } = await supabase
    .from('employer_references')
    .select('*')
    .not('submitted_at', 'is', null)
    .order('submitted_at', { ascending: false });

  if (error) {
    console.error('Error fetching employer references:', error);
    process.exit(1);
  }

  console.log(`Found ${allEmployerRefs.length} employer references with submitted_at\n`);

  // Filter to find corrupted ones (submitted but no data)
  const corruptedRefs = allEmployerRefs.filter(ref => {
    const hasData = ref.company_name_encrypted ||
                    ref.annual_salary_encrypted ||
                    ref.employer_name_encrypted ||
                    ref.employee_position_encrypted ||
                    ref.employment_type ||
                    ref.employment_start_date;
    return !hasData;
  });

  console.log(`Found ${corruptedRefs.length} CORRUPTED employer references (submitted but no data)\n`);

  if (corruptedRefs.length === 0) {
    console.log('✅ No corrupted employer references found!');
    process.exit(0);
  }

  console.log('=== CORRUPTED EMPLOYER REFERENCES ===\n');

  const resendList = [];

  for (const ref of corruptedRefs) {
    // Get tenant reference to find contact details
    const { data: tenantRef } = await supabase
      .from('tenant_references')
      .select('id, tenant_first_name_encrypted, tenant_last_name_encrypted, employer_ref_name_encrypted, employer_ref_email_encrypted, employer_ref_phone_encrypted, property_address_encrypted')
      .eq('id', ref.reference_id)
      .single();

    if (tenantRef) {
      const tenantName = `${decrypt(tenantRef.tenant_first_name_encrypted)} ${decrypt(tenantRef.tenant_last_name_encrypted)}`;
      const employerName = decrypt(tenantRef.employer_ref_name_encrypted);
      const employerEmail = decrypt(tenantRef.employer_ref_email_encrypted);
      const employerPhone = decrypt(tenantRef.employer_ref_phone_encrypted);
      const property = decrypt(tenantRef.property_address_encrypted);

      console.log('---');
      console.log(`Reference ID: ${ref.reference_id}`);
      console.log(`Tenant: ${tenantName}`);
      console.log(`Property: ${property}`);
      console.log(`Employer Contact: ${employerName}`);
      console.log(`Employer Email: ${employerEmail}`);
      console.log(`Employer Phone: ${employerPhone}`);
      console.log(`Submitted At (fake): ${ref.submitted_at}`);
      console.log(`Created At: ${ref.created_at}`);

      resendList.push({
        referenceId: ref.reference_id,
        employerRefId: ref.id,
        tenantName,
        property,
        employerName,
        employerEmail,
        employerPhone
      });
    }
  }

  console.log('\n=== ACTION REQUIRED ===\n');
  console.log(`Found ${corruptedRefs.length} employer references that need to be reset and resent.\n`);

  // Ask for confirmation
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  readline.question('Reset submitted_at to NULL for these references? (yes/no): ', async (answer) => {
    if (answer.toLowerCase() === 'yes') {
      console.log('\nResetting corrupted employer references...\n');

      for (const ref of corruptedRefs) {
        const { error: updateError } = await supabase
          .from('employer_references')
          .update({ submitted_at: null })
          .eq('id', ref.id);

        if (updateError) {
          console.error(`❌ Failed to reset ${ref.id}:`, updateError);
        } else {
          console.log(`✅ Reset employer reference ${ref.id}`);
        }
      }

      console.log('\n=== RESET COMPLETE ===\n');
      console.log('These employer references now need to be re-sent:\n');

      resendList.forEach((item, i) => {
        console.log(`${i + 1}. ${item.tenantName} - ${item.property}`);
        console.log(`   Employer: ${item.employerName} (${item.employerEmail})`);
        console.log(`   Reference ID: ${item.referenceId}\n`);
      });

      console.log('✅ All corrupted references have been reset!');
      console.log('You can now manually resend these from the deployed version.');
    } else {
      console.log('\nNo changes made.');
    }

    readline.close();
    process.exit(0);
  });
}

findAndFixCorruptedRefs();

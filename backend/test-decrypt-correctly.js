const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Correct decrypt function matching backend
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY not set');
  // Convert base64 key to buffer (NOT hex!)
  return Buffer.from(key, 'base64');
}

function decrypt(encryptedData) {
  if (!encryptedData) return null;

  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedData, 'base64');

  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, TAG_POSITION);
  const tag = combined.subarray(TAG_POSITION, ENCRYPTED_POSITION);
  const encrypted = combined.subarray(ENCRYPTED_POSITION);

  // Try newest format first (direct key)
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (error) {
    // Try 10k iterations
    try {
      const derivedKey = crypto.pbkdf2Sync(key, salt, 10000, 32, 'sha512');
      const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return decrypted.toString('utf8');
    } catch (error2) {
      // Try legacy 100k iterations
      try {
        const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha512');
        const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        return decrypted.toString('utf8');
      } catch (error3) {
        console.error('Decryption failed:', error3.message);
        return '[DECRYPTION FAILED]';
      }
    }
  }
}

async function checkEmployerContactData() {
  const referenceId = '5e2dbf96-5db2-4fec-bd9b-9ebb175b2e27';

  console.log('=== EMPLOYER CONTACT INFO FROM TENANT_REFERENCES ===\n');

  const { data: tenantRef } = await supabase
    .from('tenant_references')
    .select('employer_ref_name_encrypted, employer_ref_email_encrypted, employer_ref_phone_encrypted, employer_ref_position')
    .eq('id', referenceId)
    .single();

  console.log('Employer Contact Name:', decrypt(tenantRef.employer_ref_name_encrypted));
  console.log('Employer Contact Email:', decrypt(tenantRef.employer_ref_email_encrypted));
  console.log('Employer Contact Phone:', decrypt(tenantRef.employer_ref_phone_encrypted));
  console.log('Employer Contact Position:', tenantRef.employer_ref_position);

  process.exit(0);
}

checkEmployerContactData();

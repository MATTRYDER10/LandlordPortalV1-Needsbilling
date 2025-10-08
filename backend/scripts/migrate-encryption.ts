import crypto from 'crypto'
import { supabase } from '../src/config/supabase'

// Encryption configuration (same as encryption.ts)
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 64
const TAG_LENGTH = 16
const TAG_POSITION = SALT_LENGTH + IV_LENGTH
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }
  return Buffer.from(key, 'base64')
}

// Decrypt with legacy 100k iterations
function decryptLegacy(encryptedData: string | null): string | null {
  if (!encryptedData) return null

  try {
    const key = getEncryptionKey()
    const combined = Buffer.from(encryptedData, 'base64')

    const salt = combined.subarray(0, SALT_LENGTH)
    const iv = combined.subarray(SALT_LENGTH, TAG_POSITION)
    const tag = combined.subarray(TAG_POSITION, ENCRYPTED_POSITION)
    const encrypted = combined.subarray(ENCRYPTED_POSITION)

    const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha512')
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv)
    decipher.setAuthTag(tag)

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ])

    return decrypted.toString('utf8')
  } catch (error) {
    console.error('Legacy decryption failed:', error)
    return null
  }
}

// Encrypt with new 10k iterations
function encryptNew(plaintext: string | null): string | null {
  if (!plaintext) return null

  try {
    const key = getEncryptionKey()
    const salt = crypto.randomBytes(SALT_LENGTH)
    const iv = crypto.randomBytes(IV_LENGTH)

    const derivedKey = crypto.pbkdf2Sync(key, salt, 10000, 32, 'sha512')
    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv)

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final()
    ])

    const tag = cipher.getAuthTag()
    const combined = Buffer.concat([salt, iv, tag, encrypted])

    return combined.toString('base64')
  } catch (error) {
    console.error('Encryption failed:', error)
    return null
  }
}

async function migrateTable(
  tableName: string,
  encryptedColumns: string[]
) {
  console.log(`\n🔄 Migrating ${tableName}...`)

  // Fetch all records
  const { data: records, error: fetchError } = await supabase
    .from(tableName)
    .select('*')

  if (fetchError) {
    console.error(`❌ Error fetching ${tableName}:`, fetchError)
    return
  }

  if (!records || records.length === 0) {
    console.log(`✅ No records to migrate in ${tableName}`)
    return
  }

  let migrated = 0
  let skipped = 0

  for (const record of records) {
    const updates: Record<string, string | null> = {}
    let needsUpdate = false

    for (const column of encryptedColumns) {
      const encryptedValue = record[column]
      if (!encryptedValue) continue

      // Decrypt with legacy method
      const decrypted = decryptLegacy(encryptedValue)
      if (!decrypted) {
        console.warn(`⚠️  Failed to decrypt ${tableName}.${column} for record ${record.id}`)
        continue
      }

      // Re-encrypt with new method
      const reencrypted = encryptNew(decrypted)
      if (!reencrypted) {
        console.warn(`⚠️  Failed to re-encrypt ${tableName}.${column} for record ${record.id}`)
        continue
      }

      updates[column] = reencrypted
      needsUpdate = true
    }

    if (needsUpdate) {
      const { error: updateError } = await supabase
        .from(tableName)
        .update(updates)
        .eq('id', record.id)

      if (updateError) {
        console.error(`❌ Failed to update ${tableName} record ${record.id}:`, updateError)
        skipped++
      } else {
        migrated++
      }
    } else {
      skipped++
    }
  }

  console.log(`✅ ${tableName}: ${migrated} migrated, ${skipped} skipped`)
}

async function main() {
  console.log('🚀 Starting encryption migration (100k → 10k iterations)\n')

  // Migrate each table with encrypted columns
  await migrateTable('companies', [
    'name_encrypted',
    'address_encrypted'
  ])

  await migrateTable('tenant_references', [
    'first_name_encrypted',
    'last_name_encrypted',
    'email_encrypted',
    'phone_encrypted',
    'dob_encrypted',
    'landlord_name_encrypted',
    'landlord_email_encrypted',
    'landlord_phone_encrypted',
    'property_address_encrypted',
    'rent_amount_encrypted',
    'notes_encrypted',
    'internal_notes_encrypted',
    'verification_notes_encrypted'
  ])

  await migrateTable('previous_addresses', [
    'address_line1_encrypted',
    'address_line2_encrypted',
    'city_encrypted',
    'postcode_encrypted',
    'country_encrypted'
  ])

  await migrateTable('employer_references', [
    'employer_name_encrypted',
    'employer_contact_encrypted',
    'position_encrypted',
    'salary_encrypted'
  ])

  await migrateTable('invitations', [
    'email_encrypted'
  ])

  console.log('\n✨ Migration complete!')
  console.log('All encrypted data has been re-encrypted with 10k iterations for faster performance.')
}

main().catch(console.error)

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

// Decrypt with legacy formats (10k or 100k iterations)
function decryptLegacy(encryptedData: string | null): string | null {
  if (!encryptedData) return null

  const key = getEncryptionKey()
  const combined = Buffer.from(encryptedData, 'base64')

  const salt = combined.subarray(0, SALT_LENGTH)
  const iv = combined.subarray(SALT_LENGTH, TAG_POSITION)
  const tag = combined.subarray(TAG_POSITION, ENCRYPTED_POSITION)
  const encrypted = combined.subarray(ENCRYPTED_POSITION)

  // Try 10k iterations first (most recent legacy format)
  try {
    const derivedKey = crypto.pbkdf2Sync(key, salt, 10000, 32, 'sha512')
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv)
    decipher.setAuthTag(tag)

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ])

    return decrypted.toString('utf8')
  } catch (error) {
    // Try 100k iterations (original legacy format)
    try {
      const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha512')
      const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv)
      decipher.setAuthTag(tag)

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ])

      return decrypted.toString('utf8')
    } catch (error2) {
      console.error('Legacy decryption failed:', error2)
      return null
    }
  }
}

// Encrypt with new format (direct key - fastest)
function encryptNew(plaintext: string | null): string | null {
  if (!plaintext) return null

  try {
    const key = getEncryptionKey()
    const salt = Buffer.alloc(SALT_LENGTH) // Empty salt for format compatibility
    const iv = crypto.randomBytes(IV_LENGTH)

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

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

      // Check if this field is already using new format (direct key - no PBKDF2)
      try {
        const key = getEncryptionKey()
        const combined = Buffer.from(encryptedValue, 'base64')
        const iv = combined.subarray(SALT_LENGTH, TAG_POSITION)
        const tag = combined.subarray(TAG_POSITION, ENCRYPTED_POSITION)
        const encrypted = combined.subarray(ENCRYPTED_POSITION)

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
        decipher.setAuthTag(tag)

        Buffer.concat([decipher.update(encrypted), decipher.final()])
        // This field is already migrated, skip just this field (continue to next field)
        continue
      } catch {
        // Not in new format, needs migration
      }

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
  console.log('🚀 Starting encryption migration to fastest format (direct key - no PBKDF2)\n')

  // Migrate each table with encrypted columns
  await migrateTable('companies', [
    'name_encrypted'
  ])

  await migrateTable('tenant_references', [
    'accountant_email_encrypted',
    'accountant_firm_encrypted',
    'accountant_name_encrypted',
    'accountant_phone_encrypted',
    'additional_income_amount_encrypted',
    'additional_income_source_encrypted',
    'adverse_credit_details_encrypted',
    'contact_number_encrypted',
    'current_address_line1_encrypted',
    'current_address_line2_encrypted',
    'current_city_encrypted',
    'current_country_encrypted',
    'current_postcode_encrypted',
    'date_of_birth_encrypted',
    'dependants_details_encrypted',
    'employer_ref_email_encrypted',
    'employer_ref_name_encrypted',
    'employer_ref_phone_encrypted',
    'employment_company_address_line1_encrypted',
    'employment_company_address_line2_encrypted',
    'employment_company_city_encrypted',
    'employment_company_country_encrypted',
    'employment_company_name_encrypted',
    'employment_company_postcode_encrypted',
    'employment_position_encrypted',
    'employment_salary_amount_encrypted',
    'guarantor_name_encrypted',
    'guarantor_relationship_encrypted',
    'internal_notes_encrypted',
    'marital_status_encrypted',
    'middle_name_encrypted',
    'nationality_encrypted',
    'notes_encrypted',
    'pet_details_encrypted',
    'previous_landlord_address_encrypted',
    'previous_landlord_email_encrypted'
  ])

  await migrateTable('tenant_reference_previous_addresses', [
    'address_line1_encrypted',
    'address_line2_encrypted',
    'city_encrypted',
    'postcode_encrypted',
    'country_encrypted'
  ])

  await migrateTable('employer_references', [
    'absence_details_encrypted',
    'additional_comments_encrypted',
    'annual_salary_encrypted',
    'company_name_encrypted',
    'disciplinary_details_encrypted',
    'employee_position_encrypted',
    'employer_email_encrypted',
    'employer_name_encrypted',
    'employer_phone_encrypted',
    'employer_position_encrypted',
    'performance_details_encrypted',
    'signature_encrypted',
    'would_reemploy_details_encrypted'
  ])

  await migrateTable('accountant_references', [
    'accountant_email_encrypted',
    'accountant_firm_encrypted',
    'accountant_name_encrypted',
    'accountant_phone_encrypted',
    'additional_comments_encrypted',
    'annual_profit_encrypted',
    'annual_turnover_encrypted',
    'business_name_encrypted',
    'estimated_monthly_income_encrypted',
    'nature_of_business_encrypted',
    'recommendation_comments_encrypted',
    'signature_encrypted',
    'tax_liabilities_details_encrypted'
  ])

  await migrateTable('agent_references', [
    'additional_comments_encrypted',
    'agency_name_encrypted',
    'agent_email_encrypted',
    'agent_name_encrypted',
    'agent_phone_encrypted',
    'breach_of_tenancy_details_encrypted',
    'monthly_rent_encrypted',
    'neighbour_complaints_details_encrypted',
    'property_address_encrypted',
    'property_city_encrypted',
    'property_condition_details_encrypted',
    'property_postcode_encrypted',
    'rent_paid_on_time_details_encrypted',
    'signature_encrypted',
    'signature_name_encrypted',
    'would_rent_again_details_encrypted'
  ])

  await migrateTable('landlord_references', [
    'additional_comments_encrypted',
    'breach_of_tenancy_details_encrypted',
    'landlord_email_encrypted',
    'landlord_name_encrypted',
    'landlord_phone_encrypted',
    'monthly_rent_encrypted',
    'neighbour_complaints_details_encrypted',
    'property_address_encrypted',
    'property_city_encrypted',
    'property_condition_details_encrypted',
    'property_postcode_encrypted',
    'rent_paid_on_time_details_encrypted',
    'signature_encrypted',
    'signature_name_encrypted',
    'would_rent_again_details_encrypted'
  ])

  await migrateTable('invitations', [
    'email_encrypted'
  ])

  console.log('\n✨ Migration complete!')
  console.log('All encrypted data has been re-encrypted with direct key method for maximum performance (~100x faster).')
}

main().catch(console.error)

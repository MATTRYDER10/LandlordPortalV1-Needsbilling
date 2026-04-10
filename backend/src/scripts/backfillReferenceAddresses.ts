/**
 * Backfill reference addresses from linked properties
 * Fixes references that only have address_line1 stored in property_address
 * by combining line1 + line2 from the linked property
 */
import { supabase } from '../config/supabase'
import { encrypt, decrypt } from '../services/encryption'

async function backfillReferenceAddresses() {
  console.log('Starting reference address backfill...')

  // Get all references with a linked property
  const { data: references, error } = await supabase
    .from('tenant_references')
    .select('id, property_address_encrypted, linked_property_id')
    .not('linked_property_id', 'is', null)

  if (error) {
    console.error('Error fetching references:', error)
    return
  }

  console.log(`Found ${references.length} references with linked properties`)

  let updated = 0
  let skipped = 0

  for (const ref of references) {
    // Get the linked property's address
    const { data: property } = await supabase
      .from('properties')
      .select('address_line1_encrypted, address_line2_encrypted, city_encrypted, postcode')
      .eq('id', ref.linked_property_id)
      .single()

    if (!property) {
      skipped++
      continue
    }

    const line1 = decrypt(property.address_line1_encrypted) || ''
    const line2 = decrypt(property.address_line2_encrypted) || ''
    const currentAddress = decrypt(ref.property_address_encrypted) || ''

    // Build full address from line1 + line2
    const fullAddress = [line1, line2].filter(Boolean).join(', ')

    // Only update if the full address is different (more complete) than current
    if (fullAddress && fullAddress !== currentAddress && fullAddress.length > currentAddress.length) {
      const { error: updateError } = await supabase
        .from('tenant_references')
        .update({ property_address_encrypted: encrypt(fullAddress) })
        .eq('id', ref.id)

      if (updateError) {
        console.error(`Error updating ref ${ref.id}:`, updateError)
      } else {
        console.log(`Updated: "${currentAddress}" -> "${fullAddress}"`)
        updated++
      }
    } else {
      skipped++
    }
  }

  console.log(`\nDone! Updated: ${updated}, Skipped: ${skipped}`)
}

backfillReferenceAddresses()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1) })

/**
 * Backfill Property Links Script
 *
 * This script backfills linked_property_id for:
 * - tenant_references that have address data but no linked property
 * - tenant_offers that have address data but no linked property
 * - agreements that have no property_id
 *
 * It uses the propertyMatchingService to find or create properties
 * based on the address data stored in each record.
 *
 * Usage: npx ts-node src/scripts/backfillPropertyLinks.ts [--dry-run] [--limit=100]
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment
dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Import encryption utilities
import { decrypt } from '../services/encryption'
import { matchOrCreateProperty, PropertyAddress } from '../services/propertyMatchingService'

// ============================================================================
// CONFIGURATION
// ============================================================================

interface BackfillConfig {
  dryRun: boolean
  limit: number
  verbose: boolean
}

function parseArgs(): BackfillConfig {
  const args = process.argv.slice(2)
  return {
    dryRun: args.includes('--dry-run'),
    limit: parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || 0,
    verbose: args.includes('--verbose') || args.includes('-v')
  }
}

// ============================================================================
// BACKFILL TENANT REFERENCES
// ============================================================================

async function backfillReferences(config: BackfillConfig): Promise<{ processed: number; linked: number; errors: number }> {
  console.log('\n=== Backfilling tenant_references ===\n')

  // Get references without linked_property_id that have address data
  let query = supabase
    .from('tenant_references')
    .select('id, company_id, property_address_encrypted, property_city_encrypted, property_postcode_encrypted')
    .is('linked_property_id', null)
    .not('property_postcode_encrypted', 'is', null)
    .order('created_at', { ascending: false })

  if (config.limit > 0) {
    query = query.limit(config.limit)
  }

  const { data: references, error } = await query

  if (error) {
    console.error('Failed to fetch references:', error.message)
    return { processed: 0, linked: 0, errors: 1 }
  }

  console.log(`Found ${references?.length || 0} references without linked property`)

  let processed = 0
  let linked = 0
  let errors = 0

  for (const ref of references || []) {
    processed++

    try {
      // Decrypt address data
      const addressLine1 = decrypt(ref.property_address_encrypted)
      const city = decrypt(ref.property_city_encrypted)
      const postcode = decrypt(ref.property_postcode_encrypted)

      if (!postcode || !addressLine1) {
        if (config.verbose) {
          console.log(`  [${ref.id}] Skipping - missing address data`)
        }
        continue
      }

      const address: PropertyAddress = {
        line1: addressLine1,
        city: city || undefined,
        postcode: postcode
      }

      if (config.verbose) {
        console.log(`  [${ref.id}] Processing: ${addressLine1}, ${postcode}`)
      }

      if (config.dryRun) {
        console.log(`  [DRY RUN] Would match/create property for: ${addressLine1}, ${postcode}`)
        linked++
        continue
      }

      // Match or create property
      const result = await matchOrCreateProperty(ref.company_id, address, {
        autoCreate: true
      })

      if (result.matched && result.property_id) {
        // Update reference with linked property
        const { error: updateError } = await supabase
          .from('tenant_references')
          .update({
            linked_property_id: result.property_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', ref.id)

        if (updateError) {
          console.error(`  [${ref.id}] Failed to update:`, updateError.message)
          errors++
        } else {
          linked++
          if (config.verbose) {
            console.log(`  [${ref.id}] Linked to property ${result.property_id} (${result.confidence})`)
          }
        }

        // Create property_tenancies entry if it doesn't exist
        const { error: tenancyError } = await supabase
          .from('property_tenancies')
          .insert({
            property_id: result.property_id,
            reference_id: ref.id,
            company_id: ref.company_id,
            is_active: true,
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        // Ignore conflict errors (entry already exists)
        if (tenancyError && tenancyError.code !== '23505') {
          console.error(`  [${ref.id}] Failed to create property_tenancies entry:`, tenancyError.message)
        }
      }
    } catch (err: any) {
      console.error(`  [${ref.id}] Error:`, err.message)
      errors++
    }

    // Progress indicator
    if (processed % 10 === 0) {
      console.log(`  Progress: ${processed}/${references?.length || 0}`)
    }
  }

  return { processed, linked, errors }
}

// ============================================================================
// BACKFILL TENANT OFFERS
// ============================================================================

async function backfillOffers(config: BackfillConfig): Promise<{ processed: number; linked: number; errors: number }> {
  console.log('\n=== Backfilling tenant_offers ===\n')

  // Get offers without linked_property_id that have address data
  let query = supabase
    .from('tenant_offers')
    .select('id, company_id, property_address_encrypted, property_city_encrypted, property_postcode_encrypted')
    .is('linked_property_id', null)
    .not('property_postcode_encrypted', 'is', null)
    .order('created_at', { ascending: false })

  if (config.limit > 0) {
    query = query.limit(config.limit)
  }

  const { data: offers, error } = await query

  if (error) {
    console.error('Failed to fetch offers:', error.message)
    return { processed: 0, linked: 0, errors: 1 }
  }

  console.log(`Found ${offers?.length || 0} offers without linked property`)

  let processed = 0
  let linked = 0
  let errors = 0

  for (const offer of offers || []) {
    processed++

    try {
      // Decrypt address data
      const addressLine1 = decrypt(offer.property_address_encrypted)
      const city = decrypt(offer.property_city_encrypted)
      const postcode = decrypt(offer.property_postcode_encrypted)

      if (!postcode || !addressLine1) {
        if (config.verbose) {
          console.log(`  [${offer.id}] Skipping - missing address data`)
        }
        continue
      }

      const address: PropertyAddress = {
        line1: addressLine1,
        city: city || undefined,
        postcode: postcode
      }

      if (config.verbose) {
        console.log(`  [${offer.id}] Processing: ${addressLine1}, ${postcode}`)
      }

      if (config.dryRun) {
        console.log(`  [DRY RUN] Would match/create property for: ${addressLine1}, ${postcode}`)
        linked++
        continue
      }

      // Match or create property
      const result = await matchOrCreateProperty(offer.company_id, address, {
        autoCreate: true
      })

      if (result.matched && result.property_id) {
        // Update offer with linked property
        const { error: updateError } = await supabase
          .from('tenant_offers')
          .update({
            linked_property_id: result.property_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', offer.id)

        if (updateError) {
          console.error(`  [${offer.id}] Failed to update:`, updateError.message)
          errors++
        } else {
          linked++
          if (config.verbose) {
            console.log(`  [${offer.id}] Linked to property ${result.property_id} (${result.confidence})`)
          }
        }
      }
    } catch (err: any) {
      console.error(`  [${offer.id}] Error:`, err.message)
      errors++
    }

    // Progress indicator
    if (processed % 10 === 0) {
      console.log(`  Progress: ${processed}/${offers?.length || 0}`)
    }
  }

  return { processed, linked, errors }
}

// ============================================================================
// BACKFILL AGREEMENTS
// ============================================================================

async function backfillAgreements(config: BackfillConfig): Promise<{ processed: number; linked: number; errors: number }> {
  console.log('\n=== Backfilling agreements ===\n')

  // Get agreements without property_id that have a reference linked
  // We'll get the property from the linked reference
  let query = supabase
    .from('agreements')
    .select(`
      id,
      company_id,
      reference_id,
      tenant_references!inner(linked_property_id)
    `)
    .is('property_id', null)
    .not('reference_id', 'is', null)
    .order('created_at', { ascending: false })

  if (config.limit > 0) {
    query = query.limit(config.limit)
  }

  const { data: agreements, error } = await query

  if (error) {
    console.error('Failed to fetch agreements:', error.message)
    return { processed: 0, linked: 0, errors: 1 }
  }

  console.log(`Found ${agreements?.length || 0} agreements without property_id`)

  let processed = 0
  let linked = 0
  let errors = 0

  for (const agreement of agreements || []) {
    processed++

    try {
      const refData = agreement.tenant_references as any
      const propertyId = refData?.linked_property_id

      if (!propertyId) {
        if (config.verbose) {
          console.log(`  [${agreement.id}] Skipping - reference has no linked property`)
        }
        continue
      }

      if (config.verbose) {
        console.log(`  [${agreement.id}] Linking to property ${propertyId}`)
      }

      if (config.dryRun) {
        console.log(`  [DRY RUN] Would link to property ${propertyId}`)
        linked++
        continue
      }

      // Update agreement with property_id
      const { error: updateError } = await supabase
        .from('agreements')
        .update({
          property_id: propertyId,
          updated_at: new Date().toISOString()
        })
        .eq('id', agreement.id)

      if (updateError) {
        console.error(`  [${agreement.id}] Failed to update:`, updateError.message)
        errors++
      } else {
        linked++
        if (config.verbose) {
          console.log(`  [${agreement.id}] Linked to property ${propertyId}`)
        }
      }
    } catch (err: any) {
      console.error(`  [${agreement.id}] Error:`, err.message)
      errors++
    }
  }

  return { processed, linked, errors }
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

async function main() {
  const config = parseArgs()

  console.log('='.repeat(60))
  console.log('Property Links Backfill Script')
  console.log('='.repeat(60))
  console.log(`Mode: ${config.dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`)
  console.log(`Limit: ${config.limit || 'None'}`)
  console.log(`Verbose: ${config.verbose}`)
  console.log('='.repeat(60))

  // Get current counts
  const { count: refsCount } = await supabase
    .from('tenant_references')
    .select('*', { count: 'exact', head: true })
    .is('linked_property_id', null)

  const { count: offersCount } = await supabase
    .from('tenant_offers')
    .select('*', { count: 'exact', head: true })
    .is('linked_property_id', null)

  const { count: agreementsCount } = await supabase
    .from('agreements')
    .select('*', { count: 'exact', head: true })
    .is('property_id', null)

  console.log('\nCurrent state:')
  console.log(`  References without linked_property_id: ${refsCount}`)
  console.log(`  Offers without linked_property_id: ${offersCount}`)
  console.log(`  Agreements without property_id: ${agreementsCount}`)

  // Run backfills
  const refResults = await backfillReferences(config)
  const offerResults = await backfillOffers(config)
  const agreementResults = await backfillAgreements(config)

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('SUMMARY')
  console.log('='.repeat(60))
  console.log(`\nReferences:`)
  console.log(`  Processed: ${refResults.processed}`)
  console.log(`  Linked: ${refResults.linked}`)
  console.log(`  Errors: ${refResults.errors}`)

  console.log(`\nOffers:`)
  console.log(`  Processed: ${offerResults.processed}`)
  console.log(`  Linked: ${offerResults.linked}`)
  console.log(`  Errors: ${offerResults.errors}`)

  console.log(`\nAgreements:`)
  console.log(`  Processed: ${agreementResults.processed}`)
  console.log(`  Linked: ${agreementResults.linked}`)
  console.log(`  Errors: ${agreementResults.errors}`)

  const totalLinked = refResults.linked + offerResults.linked + agreementResults.linked
  const totalErrors = refResults.errors + offerResults.errors + agreementResults.errors

  console.log(`\nTotal: ${totalLinked} records linked, ${totalErrors} errors`)

  if (config.dryRun) {
    console.log('\n[DRY RUN] No changes were made. Run without --dry-run to apply changes.')
  }

  // Get final counts
  const { count: finalRefsCount } = await supabase
    .from('tenant_references')
    .select('*', { count: 'exact', head: true })
    .is('linked_property_id', null)

  const { count: finalOffersCount } = await supabase
    .from('tenant_offers')
    .select('*', { count: 'exact', head: true })
    .is('linked_property_id', null)

  const { count: finalAgreementsCount } = await supabase
    .from('agreements')
    .select('*', { count: 'exact', head: true })
    .is('property_id', null)

  console.log('\nFinal state:')
  console.log(`  References without linked_property_id: ${finalRefsCount}`)
  console.log(`  Offers without linked_property_id: ${finalOffersCount}`)
  console.log(`  Agreements without property_id: ${finalAgreementsCount}`)

  if (!config.dryRun && totalLinked > 0) {
    console.log('\nNext steps:')
    console.log('1. Review the linked properties in the admin panel')
    console.log('2. Run migration 148 to add NOT NULL constraints (uncomment the ALTER statements)')
  }
}

main().catch(console.error)

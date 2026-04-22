/**
 * Apex27 Auto-Sync Scheduler
 *
 * Runs daily at 5:00 AM UK time. For every company with Apex27 configured
 * and sync enabled, fetches new/updated listings from Apex27 and imports
 * them as properties with linked landlords.
 *
 * Only imports listings created AFTER the company's initial sync — listings
 * that existed at initial sync time but weren't imported were deliberately
 * omitted by the agent.
 */

import { supabase } from '../config/supabase'
import { encrypt, decrypt } from './encryption'
import { normalizePostcode, normalizeAddressLine } from './propertyMatchingService'
import {
  fetchAllListings,
  getCompanyApex27Config,
  mapPropertyType,
  mapFurnishedStatus,
  createEpcComplianceRecord
} from './apex27Service'

const CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1 hour
const TARGET_HOUR_UK = 5 // 5:00 AM UK time

let schedulerInterval: NodeJS.Timeout | null = null
let lastRunDate: string | null = null
let isRunning = false

export function startApex27AutoSyncScheduler(intervalMs: number = CHECK_INTERVAL_MS): void {
  if (schedulerInterval) {
    console.log('[Apex27AutoSync] Already running')
    return
  }

  console.log(`[Apex27AutoSync] Starting — checks hourly, fires daily at ${TARGET_HOUR_UK}:00 UK time`)

  setTimeout(() => runDailySync(), 60 * 1000)
  schedulerInterval = setInterval(runDailySync, intervalMs)
}

export function stopApex27AutoSyncScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
    console.log('[Apex27AutoSync] Stopped')
  }
}

async function runDailySync(): Promise<void> {
  if (isRunning) return

  try {
    const now = new Date()
    const ukTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }))
    const hour = ukTime.getHours()
    const todayStr = ukTime.toISOString().split('T')[0]

    if (hour !== TARGET_HOUR_UK) return
    if (lastRunDate === todayStr) return

    isRunning = true
    console.log(`[Apex27AutoSync] Starting daily auto-sync for ${todayStr}`)

    const result = await autoSyncAllCompanies()
    console.log(`[Apex27AutoSync] Complete — companies: ${result.companiesProcessed}, created: ${result.totalCreated}, updated: ${result.totalUpdated}, skipped: ${result.totalSkipped}`)

    lastRunDate = todayStr
  } catch (err) {
    console.error('[Apex27AutoSync] Fatal error:', err)
  } finally {
    isRunning = false
  }
}

interface AutoSyncTotals {
  companiesProcessed: number
  totalCreated: number
  totalUpdated: number
  totalSkipped: number
}

export async function autoSyncAllCompanies(): Promise<AutoSyncTotals> {
  const totals: AutoSyncTotals = {
    companiesProcessed: 0,
    totalCreated: 0,
    totalUpdated: 0,
    totalSkipped: 0
  }

  const { data: integrations } = await supabase
    .from('company_integrations')
    .select('company_id, apex27_api_key_encrypted, apex27_branch_id, apex27_last_auto_sync_at, apex27_connected_at, apex27_last_sync_at, apex27_sync_enabled')
    .not('apex27_api_key_encrypted', 'is', null)

  if (!integrations || integrations.length === 0) return totals

  for (const integration of integrations) {
    if (!integration.apex27_sync_enabled) {
      continue
    }

    try {
      const apiKey = decrypt(integration.apex27_api_key_encrypted)
      if (!apiKey) continue

      const sinceDate = integration.apex27_last_auto_sync_at
        || integration.apex27_connected_at
        || integration.apex27_last_sync_at

      if (!sinceDate) {
        console.log(`[Apex27AutoSync] Company ${integration.company_id} has no sync date reference, skipping`)
        continue
      }

      const result = await autoSyncCompany(
        integration.company_id,
        apiKey,
        integration.apex27_branch_id,
        sinceDate
      )

      totals.companiesProcessed++
      totals.totalCreated += result.created
      totals.totalUpdated += result.updated
      totals.totalSkipped += result.skipped

      // Update last auto-sync timestamp
      await supabase
        .from('company_integrations')
        .update({ apex27_last_auto_sync_at: new Date().toISOString() })
        .eq('company_id', integration.company_id)

      if (result.created > 0 || result.updated > 0) {
        console.log(`[Apex27AutoSync] Company ${integration.company_id}: created ${result.created}, updated ${result.updated}, skipped ${result.skipped}`)
      }
    } catch (err) {
      console.error(`[Apex27AutoSync] Error for company ${integration.company_id}:`, err)
    }
  }

  return totals
}

interface CompanySyncResult {
  created: number
  updated: number
  skipped: number
  errors: string[]
}

async function autoSyncCompany(
  companyId: string,
  apiKey: string,
  branchId: string | null,
  sinceDate: string
): Promise<CompanySyncResult> {
  const result: CompanySyncResult = { created: 0, updated: 0, skipped: 0, errors: [] }

  // Format sinceDate for Apex27 API (expects 'YYYY-MM-DD HH:MM:SS')
  const sinceDateFormatted = new Date(sinceDate).toISOString().replace('T', ' ').substring(0, 19)

  // Fetch only listings created/updated since last sync
  const listingsResult = await fetchAllListings(apiKey, {
    branchId,
    minDtsCreatedUpdated: sinceDateFormatted
  })

  if (!listingsResult.success || !listingsResult.listings) {
    result.errors.push(listingsResult.error || 'Failed to fetch listings')
    return result
  }

  const listings = listingsResult.listings
  if (listings.length === 0) return result

  console.log(`[Apex27AutoSync] Company ${companyId}: ${listings.length} listings to process since ${sinceDateFormatted}`)

  // Load existing properties for matching
  const { data: existingProperties } = await supabase
    .from('properties')
    .select('id, address_line1_encrypted, postcode, apex27_listing_id')
    .eq('company_id', companyId)
    .is('deleted_at', null)

  const properties = existingProperties || []

  // Build lookup maps
  const byApex27Id = new Map<string, any>()
  const byPostcode = new Map<string, any[]>()

  for (const prop of properties) {
    if (prop.apex27_listing_id) {
      byApex27Id.set(String(prop.apex27_listing_id), prop)
    }
    if (prop.postcode) {
      const normPC = normalizePostcode(prop.postcode)
      const decryptedAddr = prop.address_line1_encrypted ? decrypt(prop.address_line1_encrypted) : null
      const entry = { ...prop, _decrypted_address: decryptedAddr }
      if (!byPostcode.has(normPC)) byPostcode.set(normPC, [])
      byPostcode.get(normPC)!.push(entry)
    }
  }

  // Landlord dedup cache
  const llCache = new Map<string, string>()

  for (const listing of listings) {
    try {
      const listingId = String(listing.id)

      // 1. Match by apex27_listing_id (already linked)
      let matched = byApex27Id.get(listingId)

      // 2. Match by normalized postcode + address similarity
      if (!matched && listing.postalCode) {
        const normPC = normalizePostcode(listing.postalCode)
        const candidates = byPostcode.get(normPC) || []

        if (listing.address1 && candidates.length > 0) {
          const normListingAddr = normalizeAddressLine(listing.address1)
          for (const candidate of candidates) {
            if (candidate._decrypted_address) {
              const normCandidateAddr = normalizeAddressLine(candidate._decrypted_address)
              if (normListingAddr === normCandidateAddr) {
                matched = candidate
                break
              }
            }
          }
        }
      }

      if (matched) {
        // Update existing property
        const { error } = await supabase
          .from('properties')
          .update({
            apex27_listing_id: listingId,
            apex27_last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', matched.id)

        if (!error) result.updated++
      } else {
        // Unmatched listing — check if it was created AFTER initial sync
        const listingCreated = listing.dtsCreated ? new Date(listing.dtsCreated) : null
        const syncCutoff = new Date(sinceDate)

        if (!listingCreated || listingCreated <= syncCutoff) {
          // Listing existed before/at initial sync — agent omitted it
          result.skipped++
          continue
        }

        // New listing — create property
        const fullAddress = listing.displayAddress || [listing.address1, listing.address2, listing.city, listing.county, listing.postalCode].filter(Boolean).join(', ')
        const combinedAddress = [listing.address1, listing.address2].filter(Boolean).join(', ')

        const { data: newProp, error } = await supabase
          .from('properties')
          .insert({
            company_id: companyId,
            full_address_encrypted: encrypt(fullAddress),
            address_line1_encrypted: encrypt(combinedAddress),
            city_encrypted: listing.city ? encrypt(listing.city) : null,
            county_encrypted: listing.county ? encrypt(listing.county) : null,
            postcode: listing.postalCode ? normalizePostcode(listing.postalCode) : '',
            country: listing.country || 'GB',
            property_type: mapPropertyType(listing.propertyType),
            number_of_bedrooms: listing.bedrooms || null,
            number_of_bathrooms: listing.bathrooms || null,
            council_tax_band: listing.councilTaxBand || null,
            furnishing_status: mapFurnishedStatus(listing.furnished),
            apex27_listing_id: listingId,
            apex27_last_synced_at: new Date().toISOString()
          })
          .select('id, postcode')
          .single()

        if (error) {
          result.errors.push(`Failed to create property for listing ${listingId}: ${error.message}`)
          continue
        }

        result.created++

        // Create EPC compliance record if data available
        if (newProp && listing.epcEeCurrent && listing.dtsEpcExpiry) {
          await createEpcComplianceRecord(companyId, newProp.id, listing)
        }

        // Add to lookup maps for dedup within same sync
        if (newProp) {
          byApex27Id.set(listingId, newProp)
          if (newProp.postcode) {
            const normPC = normalizePostcode(newProp.postcode)
            const entry = { ...newProp, _decrypted_address: combinedAddress }
            if (!byPostcode.has(normPC)) byPostcode.set(normPC, [])
            byPostcode.get(normPC)!.push(entry)
          }
        }

        // Auto-link landlord contacts from the listing
        if (listing.contacts && Array.isArray(listing.contacts) && newProp) {
          for (const contact of listing.contacts) {
            if (!contact.isLandlord) continue

            const contactId = String(contact.id)
            let landlordId: string | null = llCache.get(contactId) || null

            if (!landlordId) {
              // Check by apex27_contact_id
              const { data: existingByApex } = await supabase
                .from('landlords')
                .select('id')
                .eq('company_id', companyId)
                .eq('apex27_contact_id', contactId)
                .limit(1)

              if (existingByApex && existingByApex.length > 0) {
                landlordId = existingByApex[0].id
              } else if (contact.email) {
                // Check by email
                const { data: allLandlords } = await supabase
                  .from('landlords')
                  .select('id, email_encrypted')
                  .eq('company_id', companyId)

                for (const ll of allLandlords || []) {
                  const llEmail = ll.email_encrypted ? decrypt(ll.email_encrypted) : null
                  if (llEmail && llEmail.toLowerCase() === contact.email.toLowerCase()) {
                    landlordId = ll.id
                    await supabase
                      .from('landlords')
                      .update({ apex27_contact_id: contactId, apex27_last_synced_at: new Date().toISOString() })
                      .eq('id', ll.id)
                    break
                  }
                }
              }
            }

            // Create landlord if not found
            if (!landlordId) {
              const { data: newLL } = await supabase
                .from('landlords')
                .insert({
                  company_id: companyId,
                  first_name_encrypted: encrypt(contact.firstName || ''),
                  last_name_encrypted: encrypt(contact.lastName || ''),
                  email_encrypted: encrypt(contact.email || ''),
                  phone_encrypted: encrypt(contact.mobile || contact.phone || ''),
                  residential_address_line1_encrypted: encrypt(contact.address1 || ''),
                  residential_postcode_encrypted: encrypt(contact.postalCode || ''),
                  apex27_contact_id: contactId,
                  apex27_last_synced_at: new Date().toISOString()
                })
                .select('id')
                .single()

              landlordId = newLL?.id || null
            }

            // Cache for reuse across properties
            if (landlordId) {
              llCache.set(contactId, landlordId)
            }

            // Link landlord to property
            if (landlordId) {
              const { data: existingLink } = await supabase
                .from('property_landlords')
                .select('id')
                .eq('property_id', newProp.id)
                .eq('landlord_id', landlordId)
                .limit(1)

              if (!existingLink || existingLink.length === 0) {
                await supabase
                  .from('property_landlords')
                  .insert({
                    property_id: newProp.id,
                    landlord_id: landlordId,
                    is_primary_contact: true,
                    ownership_percentage: 100
                  })
              }
            }
          }
        }
      }
    } catch (err) {
      result.errors.push(`Error processing listing ${listing.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Log sync result
  await supabase
    .from('apex27_sync_logs')
    .insert({
      company_id: companyId,
      sync_type: 'auto_daily',
      status: result.errors.length > 0 ? 'completed_with_errors' : 'completed',
      records_processed: result.created + result.updated + result.skipped,
      records_created: result.created,
      records_updated: result.updated,
      records_skipped: result.skipped,
      errors: result.errors.length > 0 ? result.errors : null
    })

  return result
}

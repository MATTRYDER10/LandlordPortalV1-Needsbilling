import { supabase } from '../config/supabase'
import { encrypt, decrypt } from './encryption'
import { normalizePostcode, normalizeAddressLine } from './propertyMatchingService'

// Apex27 API
const APEX27_BASE_URL = 'https://api.apex27.co.uk'

// ============================================================================
// INTERFACES
// ============================================================================

export interface Apex27Config {
  apiKey: string
  branchId?: string | null
}

interface Apex27Listing {
  id: number | string
  branchId?: number
  transactionType?: string
  status?: string
  address1?: string
  address2?: string
  address3?: string
  address4?: string
  city?: string
  county?: string
  postalCode?: string
  country?: string
  displayAddress?: string
  bedrooms?: number
  bathrooms?: number
  price?: number
  propertyType?: string
  contacts?: any[]
  [key: string]: any
}

interface Apex27Contact {
  id: number | string
  firstName?: string
  lastName?: string
  email?: string
  mobile?: string
  phone?: string
  isLandlord?: boolean
  isVendor?: boolean
  isTenant?: boolean
  address1?: string
  postalCode?: string
  city?: string
  county?: string
  [key: string]: any
}

interface SyncResult {
  records_processed: number
  records_created: number
  records_updated: number
  records_skipped: number
  errors: Array<{ message: string; detail?: string }>
}

// ============================================================================
// RATE LIMITER
// ============================================================================

const requestTimestamps: number[] = []
const MAX_REQUESTS_PER_MINUTE = 95 // 5 buffer from 100 limit

async function waitForRateLimit(): Promise<void> {
  const now = Date.now()
  // Remove timestamps older than 1 minute
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - 60000) {
    requestTimestamps.shift()
  }
  if (requestTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    const waitMs = requestTimestamps[0] + 60000 - now + 100
    console.log(`[Apex27] Rate limit reached, waiting ${waitMs}ms`)
    await new Promise(resolve => setTimeout(resolve, waitMs))
  }
  requestTimestamps.push(Date.now())
}

// ============================================================================
// CORE HTTP HELPER
// ============================================================================

/**
 * Core fetch helper for Apex27 API
 * Handles auth header, pagination, and response format normalization
 */
export async function apex27Fetch<T = any>(
  apiKey: string,
  endpoint: string,
  params?: Record<string, string | number | boolean>,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  body?: any
): Promise<{ success: boolean; data?: T; error?: string; pageCount?: number }> {
  await waitForRateLimit()

  const url = new URL(`${APEX27_BASE_URL}${endpoint}`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value))
    })
  }

  try {
    const options: RequestInit = {
      method,
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'PropertyGoose/1.0'
      }
    }

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body)
    }

    console.log(`[Apex27] ${method} ${url.pathname}${url.search}`)

    const response = await fetch(url.toString(), options)
    const pageCount = parseInt(response.headers.get('X-Page-Count') || '0', 10)

    if (!response.ok) {
      const text = await response.text()
      console.error(`[Apex27] Error ${response.status}:`, text.substring(0, 500))
      return { success: false, error: `Apex27 API error (${response.status}): ${text.substring(0, 200)}` }
    }

    const responseText = await response.text()
    if (!responseText || responseText.trim() === '') {
      return { success: true, data: [] as any, pageCount }
    }

    let parsed: any
    try {
      parsed = JSON.parse(responseText)
    } catch {
      return { success: false, error: `Invalid JSON response from Apex27` }
    }

    // Normalize: Apex27 may return array or { data: [...] }
    const data = Array.isArray(parsed) ? parsed : (parsed.data !== undefined ? parsed.data : parsed)

    return { success: true, data: data as T, pageCount }
  } catch (err) {
    console.error('[Apex27] Fetch error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to connect to Apex27 API' }
  }
}

// ============================================================================
// CONFIG MANAGEMENT
// ============================================================================

export async function getCompanyApex27Config(companyId: string): Promise<Apex27Config | null> {
  const { data, error } = await supabase
    .from('company_integrations')
    .select('apex27_api_key_encrypted, apex27_branch_id')
    .eq('company_id', companyId)
    .single()

  if (error || !data || !data.apex27_api_key_encrypted) {
    return null
  }

  const apiKey = decrypt(data.apex27_api_key_encrypted)
  if (!apiKey) {
    return null
  }

  return { apiKey, branchId: data.apex27_branch_id || null }
}

export async function saveApex27Config(
  companyId: string,
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  console.log('[Apex27] Saving config for companyId:', companyId)

  const encryptedApiKey = encrypt(apiKey)

  const { data: existing } = await supabase
    .from('company_integrations')
    .select('id')
    .eq('company_id', companyId)
    .single()

  if (existing) {
    const { error } = await supabase
      .from('company_integrations')
      .update({
        apex27_api_key_encrypted: encryptedApiKey,
        apex27_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('company_id', companyId)

    if (error) {
      console.error('[Apex27] Error updating config:', error)
      return { success: false, error: 'Failed to save Apex27 configuration' }
    }
  } else {
    const { error } = await supabase
      .from('company_integrations')
      .insert({
        company_id: companyId,
        apex27_api_key_encrypted: encryptedApiKey,
        apex27_connected_at: new Date().toISOString()
      })

    if (error) {
      console.error('[Apex27] Error inserting config:', error)
      return { success: false, error: 'Failed to save Apex27 configuration' }
    }
  }

  return { success: true }
}

export async function removeApex27Config(companyId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('company_integrations')
    .update({
      apex27_api_key_encrypted: null,
      apex27_connected_at: null,
      apex27_last_tested_at: null,
      apex27_last_test_status: null,
      apex27_last_sync_at: null,
      apex27_sync_enabled: false,
      updated_at: new Date().toISOString()
    })
    .eq('company_id', companyId)

  if (error) {
    console.error('[Apex27] Error removing config:', error)
    return { success: false, error: 'Failed to remove Apex27 configuration' }
  }

  return { success: true }
}

export async function testConnection(config: Apex27Config): Promise<{ success: boolean; message: string; branches?: any[] }> {
  const result = await apex27Fetch<any[]>(config.apiKey, '/branches')

  if (!result.success) {
    return { success: false, message: result.error || 'Connection test failed' }
  }

  const branches = Array.isArray(result.data) ? result.data : []
  console.log(`[Apex27] Connection test successful, found ${branches.length} branches`)

  return { success: true, message: `Connection successful — ${branches.length} branch(es) found`, branches }
}

export async function updateApex27TestStatus(
  companyId: string,
  status: 'success' | 'failed'
): Promise<void> {
  await supabase
    .from('company_integrations')
    .update({
      apex27_last_tested_at: new Date().toISOString(),
      apex27_last_test_status: status,
      updated_at: new Date().toISOString()
    })
    .eq('company_id', companyId)
}

// ============================================================================
// PROPERTY SYNC
// ============================================================================

// Statuses to exclude from sync (not real managed properties)
/**
 * Map Apex27 property types to PG property types
 */
function mapPropertyType(apex27Type: string | undefined): string | null {
  if (!apex27Type) return null
  const normalized = apex27Type.toLowerCase().replace(/[-_\s]+/g, '_')
  const map: Record<string, string> = {
    'house': 'house',
    'flat': 'flat',
    'apartment': 'flat',
    'studio': 'studio',
    'studio_flat': 'studio',
    'room': 'room',
    'bungalow': 'bungalow',
    'maisonette': 'maisonette',
    'house_share': 'house',
    'flat_share': 'flat',
    'detached': 'house',
    'semi_detached': 'house',
    'terraced': 'house',
    'end_terrace': 'house',
    'cottage': 'house',
    'penthouse': 'flat',
    'barn_conversion': 'house',
  }
  return map[normalized] || 'other'
}

/**
 * Map Apex27 furnished status to PG furnishing_status
 */
function mapFurnishedStatus(apex27Furnished: string | undefined): string | null {
  if (!apex27Furnished) return null
  const map: Record<string, string> = {
    'furnished': 'furnished',
    'part_furnished': 'part_furnished',
    'unfurnished': 'unfurnished',
    'furnished_or_unfurnished': 'unfurnished'
  }
  return map[apex27Furnished] || null
}

/**
 * Create an EPC compliance record from Apex27 listing data
 */
async function createEpcComplianceRecord(
  companyId: string,
  propertyId: string,
  listing: Apex27Listing
): Promise<void> {
  try {
    // Check if an EPC record already exists for this property
    const { data: existing } = await supabase
      .from('compliance_records')
      .select('id')
      .eq('property_id', propertyId)
      .eq('compliance_type', 'epc')
      .limit(1)

    if (existing && existing.length > 0) return

    // Parse expiry date
    const expiryDate = listing.dtsEpcExpiry ? listing.dtsEpcExpiry.split(' ')[0] : null
    if (!expiryDate) return

    // Estimate issue date (EPCs valid for 10 years)
    const expiry = new Date(expiryDate)
    const issue = new Date(expiry)
    issue.setFullYear(issue.getFullYear() - 10)

    await supabase
      .from('compliance_records')
      .insert({
        property_id: propertyId,
        company_id: companyId,
        compliance_type: 'epc',
        issue_date: issue.toISOString().split('T')[0],
        expiry_date: expiryDate,
        certificate_number: listing.epcReference || null,
        notes: listing.epcEeCurrent ? `EPC Rating: ${listing.epcEeCurrent} (Current), ${listing.epcEePotential || 'N/A'} (Potential)` : null
      })

    console.log(`[Apex27] Created EPC compliance record for property ${propertyId}`)
  } catch (err) {
    console.error(`[Apex27] Failed to create EPC record for property ${propertyId}:`, err)
  }
}

const EXCLUDED_STATUSES = new Set([
  'withdrawn', 'valuation', 'online_valuation', 'online valuation', 'pending',
  'Withdrawn', 'Valuation', 'Online Valuation', 'Pending'
])

/**
 * Fetch all rental listings from Apex27, paginating through all pages.
 * Fetches ALL rent listings (no status filter) and excludes Withdrawn/Valuation client-side.
 */
export async function fetchAllListings(
  apiKey: string,
  filters?: { branchId?: string | null }
): Promise<{ success: boolean; listings?: Apex27Listing[]; error?: string }> {
  const allListings: Apex27Listing[] = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const params: Record<string, string | number> = {
      transactionType: 'rent',
      includeContacts: 1,
      page,
      pageSize: 250
    }
    if (filters?.branchId) {
      params.branchId = filters.branchId
    }

    const result = await apex27Fetch<Apex27Listing[]>(apiKey, '/listings', params)

    if (!result.success) {
      return { success: false, error: result.error }
    }

    const listings = Array.isArray(result.data) ? result.data : []
    allListings.push(...listings)

    if (page === 1 && result.pageCount) {
      totalPages = result.pageCount
    }

    console.log(`[Apex27] Fetched listings page ${page}/${totalPages}, got ${listings.length} listings`)
    page++
  }

  // Filter out excluded statuses client-side
  const filtered = allListings.filter(l => {
    const status = (l.status || '').toLowerCase().trim()
    return !EXCLUDED_STATUSES.has(status)
  })

  console.log(`[Apex27] After filtering: ${filtered.length} of ${allListings.length} listings (excluded ${allListings.length - filtered.length} withdrawn/valuation)`)

  return { success: true, listings: filtered }
}

/**
 * Sync Apex27 rental listings to PG properties
 */
export async function syncProperties(companyId: string): Promise<{ success: boolean; result?: SyncResult; error?: string }> {
  const config = await getCompanyApex27Config(companyId)
  if (!config) {
    return { success: false, error: 'Apex27 not configured for this company' }
  }

  // Create sync log
  const { data: syncLog } = await supabase
    .from('apex27_sync_logs')
    .insert({
      company_id: companyId,
      sync_type: 'properties',
      status: 'started'
    })
    .select('id')
    .single()

  const syncLogId = syncLog?.id

  const syncResult: SyncResult = {
    records_processed: 0,
    records_created: 0,
    records_updated: 0,
    records_skipped: 0,
    errors: []
  }

  try {
    // Fetch all rental listings (filtered by branch if set, excluding withdrawn/valuation)
    const listingsResult = await fetchAllListings(config.apiKey, { branchId: config.branchId })

    if (!listingsResult.success) {
      throw new Error(listingsResult.error || 'Failed to fetch listings')
    }

    const allListings = listingsResult.listings || []
    console.log(`[Apex27] Total listings to sync: ${allListings.length}`)

    // Load all company properties with encrypted addresses for dedup
    const { data: existingProperties } = await supabase
      .from('properties')
      .select('id, address_line1_encrypted, postcode, apex27_listing_id')
      .eq('company_id', companyId)
      .is('deleted_at', null)

    const properties = existingProperties || []

    // Build lookup maps — decrypt addresses for matching
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

    // Landlord dedup cache for auto-link path
    const llCache = new Map<string, string>()

    for (const listing of allListings) {
      syncResult.records_processed++

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
          // Update existing property with apex27 link
          const { error } = await supabase
            .from('properties')
            .update({
              apex27_listing_id: listingId,
              apex27_last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', matched.id)

          if (error) {
            syncResult.errors.push({ message: `Failed to update property ${matched.id}`, detail: error.message })
          } else {
            syncResult.records_updated++
          }
        } else {
          // Build full address string
          const fullAddress = listing.displayAddress || [listing.address1, listing.address2, listing.city, listing.county, listing.postalCode].filter(Boolean).join(', ')

          // Combine address1 + address2 into first line for clean display
          const combinedAddress = [listing.address1, listing.address2].filter(Boolean).join(', ')

          // Create new property with encrypted fields (matching PG schema)
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
            syncResult.errors.push({ message: `Failed to create property for listing ${listingId}`, detail: error.message })
          } else {
            syncResult.records_created++

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
          }

          // Auto-link landlord contacts from the listing
          if (listing.contacts && Array.isArray(listing.contacts) && newProp) {
            for (const contact of listing.contacts) {
              if (!contact.isLandlord) continue

              const contactId = String(contact.id)

              // Check cache first — same landlord across multiple properties
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

              // Create landlord if not found (only once — cached for subsequent properties)
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

              // Link landlord to property via property_landlords
              if (landlordId) {
                // Check if link already exists
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
        syncResult.errors.push({ message: `Error processing listing ${listing.id}`, detail: err instanceof Error ? err.message : String(err) })
      }
    }

    // Update sync log
    if (syncLogId) {
      await supabase
        .from('apex27_sync_logs')
        .update({
          status: 'completed',
          records_processed: syncResult.records_processed,
          records_created: syncResult.records_created,
          records_updated: syncResult.records_updated,
          records_skipped: syncResult.records_skipped,
          errors: syncResult.errors.length > 0 ? syncResult.errors : null,
          completed_at: new Date().toISOString()
        })
        .eq('id', syncLogId)
    }

    // Update last sync timestamp
    await supabase
      .from('company_integrations')
      .update({
        apex27_last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('company_id', companyId)

    return { success: true, result: syncResult }
  } catch (err) {
    console.error('[Apex27] Property sync error:', err)

    if (syncLogId) {
      await supabase
        .from('apex27_sync_logs')
        .update({
          status: 'failed',
          errors: [{ message: err instanceof Error ? err.message : String(err) }],
          completed_at: new Date().toISOString()
        })
        .eq('id', syncLogId)
    }

    return { success: false, error: err instanceof Error ? err.message : 'Property sync failed' }
  }
}

// ============================================================================
// INITIAL SYNC PREVIEW (read-only, no DB writes)
// ============================================================================

export interface PreviewItem {
  apex27ListingId: string
  apex27Address: string
  apex27Postcode: string
  apex27Status: string
  apex27Bedrooms: number | null
  apex27Rent: number | null
  matchType: 'exact_id' | 'address_match' | 'new'
  matchedPropertyId: string | null
  matchedPropertyAddress: string | null
  hasExistingLandlord: boolean
  landlordContacts: Array<{ id: string; name: string; email: string; matchedLandlordId: string | null }>
  importProperty: boolean
  importLandlord: boolean
}

/**
 * Preview what an initial sync would do — no DB writes.
 * Returns a list of items for the user to review.
 */
export async function previewSync(companyId: string): Promise<{ success: boolean; items?: PreviewItem[]; error?: string }> {
  const config = await getCompanyApex27Config(companyId)
  if (!config) {
    return { success: false, error: 'Apex27 not configured for this company' }
  }

  try {
    const listingsResult = await fetchAllListings(config.apiKey, { branchId: config.branchId })

    if (!listingsResult.success) {
      return { success: false, error: listingsResult.error }
    }

    const allListings = listingsResult.listings || []

    // Load existing properties with landlord link info
    const { data: existingProperties } = await supabase
      .from('properties')
      .select('id, address_line1_encrypted, postcode, apex27_listing_id, property_landlords (id)')
      .eq('company_id', companyId)
      .is('deleted_at', null)

    const properties = existingProperties || []

    // Build lookup maps
    const byApex27Id = new Map<string, any>()
    const byPostcode = new Map<string, any[]>()

    for (const prop of properties) {
      const hasLandlord = prop.property_landlords && (prop.property_landlords as any[]).length > 0
      if (prop.apex27_listing_id) {
        byApex27Id.set(String(prop.apex27_listing_id), { ...prop, _hasLandlord: hasLandlord })
      }
      if (prop.postcode) {
        const normPC = normalizePostcode(prop.postcode)
        const decryptedAddr = prop.address_line1_encrypted ? decrypt(prop.address_line1_encrypted) : null
        const entry = { ...prop, _decrypted_address: decryptedAddr, _hasLandlord: hasLandlord }
        if (!byPostcode.has(normPC)) byPostcode.set(normPC, [])
        byPostcode.get(normPC)!.push(entry)
      }
    }

    // Load existing landlords for contact matching
    const { data: existingLandlords } = await supabase
      .from('landlords')
      .select('id, email_encrypted, apex27_contact_id')
      .eq('company_id', companyId)

    const landlords = existingLandlords || []
    const llByApex27Id = new Map<string, any>()
    const llByEmail = new Map<string, any>()

    for (const ll of landlords) {
      if (ll.apex27_contact_id) {
        llByApex27Id.set(String(ll.apex27_contact_id), ll)
      }
      if (ll.email_encrypted) {
        const email = decrypt(ll.email_encrypted)
        if (email) llByEmail.set(email.toLowerCase(), ll)
      }
    }

    // Build preview items
    const items: PreviewItem[] = []

    for (const listing of allListings) {
      const listingId = String(listing.id)
      const displayAddr = [listing.address1, listing.city, listing.postalCode].filter(Boolean).join(', ')

      let matchType: PreviewItem['matchType'] = 'new'
      let matchedPropertyId: string | null = null
      let matchedPropertyAddress: string | null = null
      let hasExistingLandlord = false

      // 1. Match by apex27_listing_id
      const matchedById = byApex27Id.get(listingId)
      if (matchedById) {
        matchType = 'exact_id'
        matchedPropertyId = matchedById.id
        matchedPropertyAddress = matchedById._decrypted_address || (matchedById.address_line1_encrypted ? decrypt(matchedById.address_line1_encrypted) : null)
        hasExistingLandlord = !!matchedById._hasLandlord
      }

      // 2. Match by postcode + address
      if (!matchedById && listing.postalCode) {
        const normPC = normalizePostcode(listing.postalCode)
        const candidates = byPostcode.get(normPC) || []

        if (listing.address1 && candidates.length > 0) {
          const normListingAddr = normalizeAddressLine(listing.address1)
          for (const candidate of candidates) {
            if (candidate._decrypted_address) {
              const normCandidateAddr = normalizeAddressLine(candidate._decrypted_address)
              if (normListingAddr === normCandidateAddr) {
                matchType = 'address_match'
                matchedPropertyId = candidate.id
                matchedPropertyAddress = candidate._decrypted_address
                hasExistingLandlord = !!candidate._hasLandlord
                break
              }
            }
          }
        }
      }

      // Check landlord contacts
      const landlordContacts: PreviewItem['landlordContacts'] = []
      if (listing.contacts && Array.isArray(listing.contacts)) {
        for (const contact of listing.contacts) {
          if (!contact.isLandlord) continue

          const contactId = String(contact.id)
          let matchedLandlordId: string | null = null

          const byId = llByApex27Id.get(contactId)
          if (byId) {
            matchedLandlordId = byId.id
          } else if (contact.email) {
            const byEmail = llByEmail.get(contact.email.toLowerCase())
            if (byEmail) matchedLandlordId = byEmail.id
          }

          landlordContacts.push({
            id: contactId,
            name: [contact.firstName, contact.lastName].filter(Boolean).join(' '),
            email: contact.email || '',
            matchedLandlordId
          })
        }
      }

      const isMatched = matchType !== 'new'

      items.push({
        apex27ListingId: listingId,
        apex27Address: displayAddr,
        apex27Postcode: listing.postalCode || '',
        apex27Status: listing.status || '',
        apex27Bedrooms: listing.bedrooms || null,
        apex27Rent: listing.price || null,
        matchType,
        matchedPropertyId,
        matchedPropertyAddress,
        hasExistingLandlord,
        landlordContacts,
        // Smart defaults: don't import property if matched, don't import landlord if property already has one
        importProperty: !isMatched,
        importLandlord: landlordContacts.length > 0 && !hasExistingLandlord
      })
    }

    return { success: true, items }
  } catch (err) {
    console.error('[Apex27] Preview sync error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Preview failed' }
  }
}

/**
 * Confirm initial sync — writes only the user-approved items to DB.
 */
export async function confirmSync(
  companyId: string,
  approvedItems: Array<{
    apex27ListingId: string
    matchedPropertyId: string | null
    importProperty: boolean
    importLandlord: boolean
    landlordContacts: Array<{ id: string; matchedLandlordId: string | null }>
  }>
): Promise<{ success: boolean; result?: SyncResult; error?: string }> {
  const config = await getCompanyApex27Config(companyId)
  if (!config) {
    return { success: false, error: 'Apex27 not configured for this company' }
  }

  // Create sync log
  const { data: syncLog } = await supabase
    .from('apex27_sync_logs')
    .insert({
      company_id: companyId,
      sync_type: 'initial_sync',
      status: 'started'
    })
    .select('id')
    .single()

  const syncLogId = syncLog?.id

  const syncResult: SyncResult = {
    records_processed: 0,
    records_created: 0,
    records_updated: 0,
    records_skipped: 0,
    errors: []
  }

  try {
    // Fetch the listings again to get full data (contacts, addresses)
    const listingsResult = await fetchAllListings(config.apiKey, { branchId: config.branchId })
    if (!listingsResult.success) {
      throw new Error(listingsResult.error || 'Failed to fetch listings')
    }

    // Build listing lookup
    const listingMap = new Map<string, Apex27Listing>()
    for (const l of listingsResult.listings || []) {
      listingMap.set(String(l.id), l)
    }

    // Landlord dedup cache: apex27ContactId → PG landlordId
    // Ensures the same landlord across multiple properties is created once
    const landlordCache = new Map<string, string>()

    for (const item of approvedItems) {
      syncResult.records_processed++

      // Skip items where neither property nor landlord is being imported
      if (!item.importProperty && !item.importLandlord) {
        syncResult.records_skipped++
        continue
      }

      const listing = listingMap.get(item.apex27ListingId)
      if (!listing) {
        syncResult.records_skipped++
        continue
      }

      try {
        let propertyId: string | null = item.matchedPropertyId

        if (item.importProperty && !propertyId) {
          // Create new property
          const combinedAddr = [listing.address1, listing.address2].filter(Boolean).join(', ')
          const fullAddress = listing.displayAddress || [combinedAddr, listing.city, listing.county, listing.postalCode].filter(Boolean).join(', ')

          const { data: newProp, error } = await supabase
            .from('properties')
            .insert({
              company_id: companyId,
              full_address_encrypted: encrypt(fullAddress),
              address_line1_encrypted: encrypt(combinedAddr),
              city_encrypted: listing.city ? encrypt(listing.city) : null,
              county_encrypted: listing.county ? encrypt(listing.county) : null,
              postcode: listing.postalCode ? normalizePostcode(listing.postalCode) : '',
              country: listing.country || 'GB',
              property_type: mapPropertyType(listing.propertyType),
              number_of_bedrooms: listing.bedrooms || null,
              number_of_bathrooms: listing.bathrooms || null,
              council_tax_band: listing.councilTaxBand || null,
              furnishing_status: mapFurnishedStatus(listing.furnished),
              apex27_listing_id: item.apex27ListingId,
              apex27_last_synced_at: new Date().toISOString()
            })
            .select('id')
            .single()

          if (error) {
            syncResult.errors.push({ message: `Failed to create property for listing ${item.apex27ListingId}`, detail: error.message })
            continue
          }

          propertyId = newProp?.id || null
          syncResult.records_created++

          // Create EPC compliance record if data available
          if (propertyId && listing.epcEeCurrent && listing.dtsEpcExpiry) {
            await createEpcComplianceRecord(companyId, propertyId, listing)
          }
        } else if (item.importProperty && propertyId) {
          // Link existing property to Apex27
          await supabase
            .from('properties')
            .update({
              apex27_listing_id: item.apex27ListingId,
              apex27_last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', propertyId)
            .eq('company_id', companyId)

          syncResult.records_updated++
        } else if (!item.importProperty && propertyId) {
          // Property already exists — just ensure apex27 link is set
          await supabase
            .from('properties')
            .update({
              apex27_listing_id: item.apex27ListingId,
              apex27_last_synced_at: new Date().toISOString()
            })
            .eq('id', propertyId)
            .eq('company_id', companyId)

          syncResult.records_updated++
        }

        // Link landlord contacts (only if importLandlord is true)
        if (item.importLandlord && propertyId && item.landlordContacts) {
          for (const lc of item.landlordContacts) {
            const contact = listing.contacts?.find((c: any) => String(c.id) === lc.id && c.isLandlord)
            if (!contact) continue

            // Check cache first — same landlord may appear across multiple properties
            let landlordId = landlordCache.get(lc.id) || lc.matchedLandlordId || null

            if (!landlordId) {
              // Create new landlord (only once — cached for subsequent properties)
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
                  apex27_contact_id: lc.id,
                  apex27_last_synced_at: new Date().toISOString()
                })
                .select('id')
                .single()

              landlordId = newLL?.id || null
              if (landlordId) {
                landlordCache.set(lc.id, landlordId)
              }
            } else {
              // Update existing landlord with apex27 link
              await supabase
                .from('landlords')
                .update({
                  apex27_contact_id: lc.id,
                  apex27_last_synced_at: new Date().toISOString()
                })
                .eq('id', landlordId)
                .eq('company_id', companyId)

              landlordCache.set(lc.id, landlordId)
            }

            // Link to property
            if (landlordId) {
              const { data: existingLink } = await supabase
                .from('property_landlords')
                .select('id')
                .eq('property_id', propertyId)
                .eq('landlord_id', landlordId)
                .limit(1)

              if (!existingLink || existingLink.length === 0) {
                await supabase
                  .from('property_landlords')
                  .insert({
                    property_id: propertyId,
                    landlord_id: landlordId,
                    is_primary_contact: true,
                    ownership_percentage: 100
                  })
              }
            }
          }
        }
      } catch (err) {
        syncResult.errors.push({ message: `Error processing listing ${item.apex27ListingId}`, detail: err instanceof Error ? err.message : String(err) })
      }
    }

    // Update sync log
    if (syncLogId) {
      await supabase
        .from('apex27_sync_logs')
        .update({
          status: 'completed',
          records_processed: syncResult.records_processed,
          records_created: syncResult.records_created,
          records_updated: syncResult.records_updated,
          records_skipped: syncResult.records_skipped,
          errors: syncResult.errors.length > 0 ? syncResult.errors : null,
          completed_at: new Date().toISOString()
        })
        .eq('id', syncLogId)
    }

    await supabase
      .from('company_integrations')
      .update({
        apex27_last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('company_id', companyId)

    return { success: true, result: syncResult }
  } catch (err) {
    console.error('[Apex27] Confirm sync error:', err)

    if (syncLogId) {
      await supabase
        .from('apex27_sync_logs')
        .update({
          status: 'failed',
          errors: [{ message: err instanceof Error ? err.message : String(err) }],
          completed_at: new Date().toISOString()
        })
        .eq('id', syncLogId)
    }

    return { success: false, error: err instanceof Error ? err.message : 'Sync failed' }
  }
}

// ============================================================================
// LANDLORD SYNC
// ============================================================================

/**
 * Fetch all landlord contacts from Apex27
 */
export async function fetchAllContacts(apiKey: string): Promise<{ success: boolean; contacts?: Apex27Contact[]; error?: string }> {
  const allContacts: Apex27Contact[] = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const result = await apex27Fetch<Apex27Contact[]>(apiKey, '/contacts', { page, pageSize: 250 })

    if (!result.success) {
      return { success: false, error: result.error }
    }

    const contacts = Array.isArray(result.data) ? result.data : []
    // Filter to landlords only
    const landlords = contacts.filter(c => c.isLandlord === true)
    allContacts.push(...landlords)

    if (page === 1 && result.pageCount) {
      totalPages = result.pageCount
    }

    console.log(`[Apex27] Fetched contacts page ${page}/${totalPages}, got ${contacts.length} contacts, ${landlords.length} landlords`)
    page++
  }

  return { success: true, contacts: allContacts }
}

/**
 * Sync Apex27 landlord contacts to PG landlords
 */
export async function syncLandlords(companyId: string): Promise<{ success: boolean; result?: SyncResult; error?: string }> {
  const config = await getCompanyApex27Config(companyId)
  if (!config) {
    return { success: false, error: 'Apex27 not configured for this company' }
  }

  // Create sync log
  const { data: syncLog } = await supabase
    .from('apex27_sync_logs')
    .insert({
      company_id: companyId,
      sync_type: 'landlords',
      status: 'started'
    })
    .select('id')
    .single()

  const syncLogId = syncLog?.id

  const syncResult: SyncResult = {
    records_processed: 0,
    records_created: 0,
    records_updated: 0,
    records_skipped: 0,
    errors: []
  }

  try {
    const contactsResult = await fetchAllContacts(config.apiKey)
    if (!contactsResult.success) {
      throw new Error(contactsResult.error || 'Failed to fetch contacts')
    }

    const landlordContacts = contactsResult.contacts || []
    console.log(`[Apex27] Total landlord contacts to sync: ${landlordContacts.length}`)

    // Load all company landlords with decrypted emails
    const { data: existingLandlords } = await supabase
      .from('landlords')
      .select('id, email_encrypted, apex27_contact_id')
      .eq('company_id', companyId)

    const landlords = existingLandlords || []

    // Build lookup maps
    const byApex27Id = new Map<string, any>()
    const byEmail = new Map<string, any>()

    for (const ll of landlords) {
      if (ll.apex27_contact_id) {
        byApex27Id.set(String(ll.apex27_contact_id), ll)
      }
      if (ll.email_encrypted) {
        const email = decrypt(ll.email_encrypted)
        if (email) {
          byEmail.set(email.toLowerCase(), ll)
        }
      }
    }

    for (const contact of landlordContacts) {
      syncResult.records_processed++

      try {
        const contactId = String(contact.id)

        // 1. Match by apex27_contact_id
        let matched = byApex27Id.get(contactId)

        // 2. Match by email
        if (!matched && contact.email) {
          matched = byEmail.get(contact.email.toLowerCase())
        }

        if (matched) {
          // Update existing landlord with apex27 link
          const { error } = await supabase
            .from('landlords')
            .update({
              apex27_contact_id: contactId,
              apex27_last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', matched.id)

          if (error) {
            syncResult.errors.push({ message: `Failed to update landlord ${matched.id}`, detail: error.message })
          } else {
            syncResult.records_updated++
          }
        } else {
          // Create new landlord with encrypted PII
          const { data: newLL, error } = await supabase
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

          if (error) {
            syncResult.errors.push({ message: `Failed to create landlord for contact ${contactId}`, detail: error.message })
          } else {
            syncResult.records_created++
            // Add to lookup for dedup within same sync
            if (newLL) {
              byApex27Id.set(contactId, newLL)
              if (contact.email) {
                byEmail.set(contact.email.toLowerCase(), newLL)
              }
            }
          }
        }
      } catch (err) {
        syncResult.errors.push({ message: `Error processing contact ${contact.id}`, detail: err instanceof Error ? err.message : String(err) })
      }
    }

    // Update sync log
    if (syncLogId) {
      await supabase
        .from('apex27_sync_logs')
        .update({
          status: 'completed',
          records_processed: syncResult.records_processed,
          records_created: syncResult.records_created,
          records_updated: syncResult.records_updated,
          records_skipped: syncResult.records_skipped,
          errors: syncResult.errors.length > 0 ? syncResult.errors : null,
          completed_at: new Date().toISOString()
        })
        .eq('id', syncLogId)
    }

    // Update last sync timestamp
    await supabase
      .from('company_integrations')
      .update({
        apex27_last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('company_id', companyId)

    return { success: true, result: syncResult }
  } catch (err) {
    console.error('[Apex27] Landlord sync error:', err)

    if (syncLogId) {
      await supabase
        .from('apex27_sync_logs')
        .update({
          status: 'failed',
          errors: [{ message: err instanceof Error ? err.message : String(err) }],
          completed_at: new Date().toISOString()
        })
        .eq('id', syncLogId)
    }

    return { success: false, error: err instanceof Error ? err.message : 'Landlord sync failed' }
  }
}

// ============================================================================
// DOCUMENT PUSH
// ============================================================================

/**
 * Push a document to Apex27
 */
export async function pushDocument(
  apiKey: string,
  params: { listingId?: string; contactId?: string; name: string; url: string }
): Promise<{ success: boolean; response?: any; error?: string }> {
  const body: any = {
    name: params.name,
    url: params.url
  }

  if (params.listingId) body.listingId = params.listingId
  if (params.contactId) body.contactId = params.contactId

  const result = await apex27Fetch(apiKey, '/documents', undefined, 'POST', body)

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return { success: true, response: result.data }
}

/**
 * Update a listing's status on Apex27 (e.g. to "Let Agreed")
 */
export async function updateListingStatus(
  apiKey: string,
  listingId: string,
  status: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[Apex27] Updating listing ${listingId} status to "${status}"`)

  const result = await apex27Fetch(
    apiKey,
    `/listings/${listingId}`,
    undefined,
    'PUT',
    { status }
  )

  if (!result.success) {
    console.error(`[Apex27] Failed to update listing status: ${result.error}`)
    return { success: false, error: result.error }
  }

  console.log(`[Apex27] Successfully updated listing ${listingId} to "${status}"`)
  return { success: true }
}

import { supabase } from '../config/supabase'
import { encrypt, decrypt } from './encryption'
import { logPropertyAuditAction } from './propertyAuditService'

/**
 * Property Matching Service
 *
 * Provides intelligent property matching for offers, references, and tenancies.
 * Supports exact matching, fuzzy matching, and auto-creation of new properties.
 */

// ============================================================================
// INTERFACES
// ============================================================================

export interface PropertyAddress {
  line1: string
  line2?: string
  city?: string
  county?: string
  postcode: string
}

export interface MatchedProperty {
  id: string
  address_line1: string | null
  address_line2: string | null
  city: string | null
  postcode: string
  formatted_address: string
}

export interface PropertyMatchResult {
  matched: boolean
  property_id: string | null
  confidence: 'exact' | 'fuzzy' | 'new' | 'none'
  suggestions?: MatchedProperty[]
  created?: boolean
}

export interface MatchOrCreateOptions {
  autoCreate?: boolean
  landlordId?: string
  userId?: string
}

// ============================================================================
// MATCHING FUNCTIONS
// ============================================================================

/**
 * Normalize a UK postcode for comparison
 * Removes spaces and converts to uppercase
 */
export function normalizePostcode(postcode: string): string {
  return postcode.toUpperCase().replace(/\s/g, '')
}

/**
 * Normalize an address line for comparison
 * Removes extra spaces, converts to lowercase, removes common words
 */
export function normalizeAddressLine(address: string): string {
  return address
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/,/g, '')
    // Remove common words that don't affect matching
    .replace(/\b(flat|apartment|apt|unit|floor|ground|first|second|third)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching addresses
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length
  const n = str2.length

  // Create a matrix
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))

  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  // Fill the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        )
      }
    }
  }

  return dp[m][n]
}

/**
 * Match or create a property based on address
 *
 * Matching logic:
 * 1. Exact match: Same postcode + normalized address_line1 matches exactly
 * 2. Fuzzy match: Same postcode + Levenshtein distance < 3 on address
 * 3. No match: Returns suggestions if fuzzy matches exist, or creates new if autoCreate=true
 *
 * @param companyId - The company ID to search within
 * @param address - The address to match
 * @param options - Match options (autoCreate, landlordId, userId)
 */
export async function matchOrCreateProperty(
  companyId: string,
  address: PropertyAddress,
  options: MatchOrCreateOptions = {}
): Promise<PropertyMatchResult> {
  const { autoCreate = false, landlordId, userId } = options

  // Validate required fields
  if (!address.postcode) {
    throw new Error('Postcode is required for property matching')
  }
  if (!address.line1) {
    throw new Error('Address line 1 is required for property matching')
  }

  const normalizedPostcode = normalizePostcode(address.postcode)
  const normalizedAddressLine1 = normalizeAddressLine(address.line1)

  // Step 1: Find all properties with matching postcode
  const { data: candidateProperties, error } = await supabase
    .from('properties')
    .select('id, postcode, address_line1_encrypted, address_line2_encrypted, city_encrypted, full_address_encrypted')
    .eq('company_id', companyId)
    .eq('postcode', normalizedPostcode)
    .is('deleted_at', null)

  if (error) {
    console.error('[PropertyMatching] Failed to search properties:', error)
    throw new Error(`Failed to search properties: ${error.message}`)
  }

  // Step 2: Check for exact and fuzzy matches
  let exactMatch: MatchedProperty | null = null
  const fuzzyMatches: Array<{ property: MatchedProperty; distance: number }> = []

  for (const prop of candidateProperties || []) {
    const propAddressLine1 = decrypt(prop.address_line1_encrypted) || ''
    const normalizedPropAddress = normalizeAddressLine(propAddressLine1)

    const formattedProperty: MatchedProperty = {
      id: prop.id,
      address_line1: propAddressLine1,
      address_line2: decrypt(prop.address_line2_encrypted),
      city: decrypt(prop.city_encrypted),
      postcode: prop.postcode,
      formatted_address: formatAddress(propAddressLine1, decrypt(prop.address_line2_encrypted), decrypt(prop.city_encrypted), prop.postcode)
    }

    // Check for exact match
    if (normalizedPropAddress === normalizedAddressLine1) {
      exactMatch = formattedProperty
      break // Found exact match, no need to continue
    }

    // Calculate fuzzy match distance
    const distance = levenshteinDistance(normalizedPropAddress, normalizedAddressLine1)
    if (distance <= 3) {
      fuzzyMatches.push({ property: formattedProperty, distance })
    }
  }

  // Step 3: Return results based on match type
  if (exactMatch) {
    console.log(`[PropertyMatching] Exact match found for ${address.postcode}: ${exactMatch.id}`)
    return {
      matched: true,
      property_id: exactMatch.id,
      confidence: 'exact'
    }
  }

  if (fuzzyMatches.length > 0) {
    // Sort by distance (closest matches first)
    fuzzyMatches.sort((a, b) => a.distance - b.distance)
    const suggestions = fuzzyMatches.map(fm => fm.property)

    console.log(`[PropertyMatching] ${fuzzyMatches.length} fuzzy match(es) found for ${address.postcode}`)

    // If only one fuzzy match with very low distance (1), treat as match
    if (fuzzyMatches.length === 1 && fuzzyMatches[0].distance <= 1) {
      return {
        matched: true,
        property_id: fuzzyMatches[0].property.id,
        confidence: 'fuzzy',
        suggestions
      }
    }

    // Return suggestions for user to choose
    return {
      matched: false,
      property_id: null,
      confidence: 'none',
      suggestions
    }
  }

  // Step 4: No match found - auto-create if requested
  if (autoCreate) {
    console.log(`[PropertyMatching] No match found, auto-creating property for ${address.postcode}`)
    const newPropertyId = await createPropertyFromAddress(companyId, address, landlordId, userId)

    return {
      matched: true,
      property_id: newPropertyId,
      confidence: 'new',
      created: true
    }
  }

  // No match and no auto-create
  return {
    matched: false,
    property_id: null,
    confidence: 'none'
  }
}

/**
 * Search for properties by address (for autocomplete/search)
 */
export async function searchProperties(
  companyId: string,
  searchTerm: string,
  limit: number = 10
): Promise<MatchedProperty[]> {
  if (!searchTerm || searchTerm.length < 1) {
    return []
  }

  // Check if search looks like a postcode
  const normalizedSearch = searchTerm.toUpperCase().replace(/\s/g, '')
  const isPostcodeLike = /^[A-Z]{1,2}[0-9][0-9A-Z]{0,4}$/.test(normalizedSearch)

  let query = supabase
    .from('properties')
    .select('id, postcode, address_line1_encrypted, address_line2_encrypted, city_encrypted, full_address_encrypted')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .limit(500) // Fetch all to filter after decryption (addresses are encrypted)

  if (isPostcodeLike) {
    query = query.ilike('postcode', `%${normalizedSearch}%`)
  }

  const { data: properties, error } = await query

  if (error) {
    console.error('[PropertyMatching] Search failed:', error)
    return []
  }

  // Decrypt and filter
  const searchLower = searchTerm.toLowerCase()
  const results: MatchedProperty[] = []

  for (const prop of properties || []) {
    const addressLine1 = decrypt(prop.address_line1_encrypted) || ''
    const addressLine2 = decrypt(prop.address_line2_encrypted) || ''
    const city = decrypt(prop.city_encrypted) || ''
    const fullAddress = decrypt(prop.full_address_encrypted) || ''

    // Match against any address field including postcode
    const postcodeLower = (prop.postcode || '').toLowerCase()
    const matchesSearch = isPostcodeLike ||
      addressLine1.toLowerCase().includes(searchLower) ||
      addressLine2.toLowerCase().includes(searchLower) ||
      city.toLowerCase().includes(searchLower) ||
      fullAddress.toLowerCase().includes(searchLower) ||
      postcodeLower.includes(searchLower)

    if (matchesSearch) {
      results.push({
        id: prop.id,
        address_line1: addressLine1,
        address_line2: addressLine2,
        city: city,
        postcode: prop.postcode,
        formatted_address: formatAddress(addressLine1, addressLine2, city, prop.postcode)
      })
    }

    if (results.length >= limit) break
  }

  return results
}

/**
 * Get a property by ID with formatted address
 */
export async function getPropertyForLinking(
  propertyId: string,
  companyId: string
): Promise<MatchedProperty | null> {
  const { data: prop, error } = await supabase
    .from('properties')
    .select('id, postcode, address_line1_encrypted, address_line2_encrypted, city_encrypted')
    .eq('id', propertyId)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .single()

  if (error || !prop) {
    return null
  }

  const addressLine1 = decrypt(prop.address_line1_encrypted) || ''
  const addressLine2 = decrypt(prop.address_line2_encrypted) || ''
  const city = decrypt(prop.city_encrypted) || ''

  return {
    id: prop.id,
    address_line1: addressLine1,
    address_line2: addressLine2,
    city: city,
    postcode: prop.postcode,
    formatted_address: formatAddress(addressLine1, addressLine2, city, prop.postcode)
  }
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Format address parts into a single string
 */
function formatAddress(line1: string | null, line2: string | null, city: string | null, postcode: string): string {
  return [line1, line2, city, postcode].filter(Boolean).join(', ')
}

/**
 * Create a new property from address data
 */
async function createPropertyFromAddress(
  companyId: string,
  address: PropertyAddress,
  landlordId?: string,
  userId?: string
): Promise<string> {
  const normalizedPostcode = normalizePostcode(address.postcode)

  // Create property record
  const propertyData = {
    company_id: companyId,
    address_line1_encrypted: encrypt(address.line1),
    address_line2_encrypted: address.line2 ? encrypt(address.line2) : null,
    city_encrypted: address.city ? encrypt(address.city) : null,
    county_encrypted: address.county ? encrypt(address.county) : null,
    postcode: normalizedPostcode,
    country: 'GB',
    status: 'vacant',
    created_by: userId || null
  }

  const { data: property, error } = await supabase
    .from('properties')
    .insert(propertyData)
    .select('id')
    .single()

  if (error) {
    console.error('[PropertyMatching] Failed to create property:', error)
    throw new Error(`Failed to create property: ${error.message}`)
  }

  // Link landlord if provided
  if (landlordId) {
    const { error: landlordError } = await supabase
      .from('property_landlords')
      .insert({
        property_id: property.id,
        landlord_id: landlordId,
        ownership_percentage: 100,
        is_primary_contact: true,
        created_by: userId || null
      })

    if (landlordError) {
      console.error('[PropertyMatching] Failed to link landlord:', landlordError)
      // Don't throw - property was created successfully
    }
  }

  // Log audit
  await logPropertyAuditAction({
    propertyId: property.id,
    companyId,
    action: 'CREATED',
    description: 'Property auto-created from offer/reference',
    metadata: {
      source: 'property_matching_service',
      address: formatAddress(address.line1, address.line2 || null, address.city || null, normalizedPostcode),
      landlord_linked: !!landlordId
    },
    userId
  })

  console.log(`[PropertyMatching] Created new property: ${property.id}`)
  return property.id
}

/**
 * Validate that a property exists and belongs to the company
 */
export async function validatePropertyAccess(
  propertyId: string,
  companyId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('properties')
    .select('id')
    .eq('id', propertyId)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .single()

  return !error && !!data
}

import { supabase } from '../config/supabase'
import { encrypt, decrypt } from './encryption'

// TDS API endpoints (v1.2 as per documentation)
// Note: Some endpoints need /v1.2 prefix, some don't. We'll add it per-endpoint.
const TDS_BASE_URLS = {
  sandbox: 'https://sandbox.api.custodial.tenancydepositscheme.com',
  live: 'https://api.custodial.tenancydepositscheme.com'
}

// Versioned endpoints
const TDS_ENDPOINTS = {
  sandbox: 'https://sandbox.api.custodial.tenancydepositscheme.com/v1.2',
  live: 'https://api.custodial.tenancydepositscheme.com/v1.2'
}

// TDS API response types
interface TDSCreateDepositResponse {
  result?: string
  success?: boolean
  batchId?: string
  batch_id?: string
  error?: string
  errors?: Array<{ field: string; message: string }>
}

// TDS CreateDepositStatus response (per API docs v1.13 page 14-15)
interface TDSDepositStatusResponse {
  success?: boolean | string  // Can be boolean true or string "true"
  status?: 'created' | 'pending' | 'failed' | string
  dan?: string                // Only present when status is "created"
  batch_id?: string
  branch_id?: string
  warnings?: Array<{ [key: string]: string }>
  errors?: Array<{ code?: string; name?: string; value?: string; field?: string; message?: string }>
  error?: string
}

interface TDSConfig {
  apiKey: string
  memberId: string
  branchId: string
  environment: 'sandbox' | 'live'
}

interface PersonObject {
  person_classification: 'Lead Tenant' | 'Joint Tenant' | 'Primary Landlord' | 'Joint Landlord' | 'Related Party'
  person_id?: string  // Existing TDS person ID — links to existing record instead of creating new
  person_title: string
  person_firstname: string
  person_surname: string
  person_email?: string
  person_mobile?: string
  person_phone?: string
  is_business: 'Y' | 'N'
  business_name?: string
  // Landlord address fields (mandatory for landlords)
  person_paon?: string
  person_saon?: string
  person_street?: string
  person_town?: string
  person_administrative_area?: string
  person_postcode?: string
  person_country?: string
}

/**
 * Search TDS for an existing landlord by email
 * Returns their nonmemberlandlordid if found
 */
export async function searchLandlordByEmail(
  config: TDSConfig,
  email: string
): Promise<string | null> {
  const baseUrl = TDS_ENDPOINTS[config.environment]
  const url = `${baseUrl}/landlord/${config.memberId}/${config.branchId}/${config.apiKey}/?email=${encodeURIComponent(email)}`

  try {
    console.log('[TDS] Searching for existing landlord by email:', email.replace(/(.{3}).*@/, '$1***@'))
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'PropertyGoose/1.0' }
    })

    if (!response.ok) {
      console.log('[TDS] Landlord search returned:', response.status)
      return null
    }

    const data = await response.json() as any
    if (data.totalResults > 0 && data.landlords?.length > 0) {
      const landlordId = String(data.landlords[0].nonmemberlandlordid)
      console.log(`[TDS] Found existing landlord ID: ${landlordId}`)
      return landlordId
    }

    console.log('[TDS] No existing landlord found for this email')
    return null
  } catch (err) {
    console.error('[TDS] Landlord search error:', err)
    return null
  }
}

interface TenancyPayload {
  user_tenancy_reference: string
  property_paon: string
  property_street: string
  property_town: string
  property_administrative_area: string
  property_postcode: string
  tenancy_start_date: string
  tenancy_expected_end_date?: string
  deposit_amount: number
  deposit_amount_to_protect: number
  deposit_received_date: string
  number_of_tenants: number
  number_of_landlords: number
  furnished_status: 'furnished' | 'part furnished' | 'unfurnished'
  people: PersonObject[]
}

interface TDSCreateDepositPayload {
  member_id: string
  branch_id: string
  api_key: string
  region: 'EW'
  scheme_type: 'Custodial'
  invoice: boolean
  tenancy: TenancyPayload[]
}

/**
 * Get TDS configuration for a company
 */
export async function getCompanyTDSConfig(companyId: string): Promise<TDSConfig | null> {
  const { data, error } = await supabase
    .from('company_integrations')
    .select('tds_api_key_encrypted, tds_member_id, tds_branch_id, tds_environment')
    .eq('company_id', companyId)
    .single()

  if (error || !data || !data.tds_api_key_encrypted) {
    return null
  }

  // Read API key as plaintext — encryption was corrupting the key on prod
  const apiKey: string = data.tds_api_key_encrypted
  if (!apiKey) {
    return null
  }

  console.log('[TDS getConfig] companyId:', companyId, '| memberId:', data.tds_member_id, '| branchId:', data.tds_branch_id, '| env:', data.tds_environment, '| apiKey first4:', apiKey.substring(0, 4), '| last4:', apiKey.substring(apiKey.length - 4), '| length:', apiKey.length)

  return {
    apiKey,
    memberId: data.tds_member_id || '',
    branchId: data.tds_branch_id || '0',
    environment: (data.tds_environment as 'sandbox' | 'live') || 'live'
  }
}

/**
 * Test TDS API connection with provided credentials
 */
export async function testConnection(config: TDSConfig): Promise<{ success: boolean; message: string }> {
  // Trim whitespace from credentials
  config.apiKey = config.apiKey.trim()
  config.memberId = config.memberId.trim()
  config.branchId = config.branchId.trim()

  // Use versioned endpoint - /v1.2/ prefix required for all TDS endpoints
  const baseUrl = TDS_ENDPOINTS[config.environment]

  try {
    // Test using GET /v1.2/landlord/<member_id>/<branch_id>/<api_key>/
    // Returns 200 with isSuccess:true and landlord list on valid credentials
    // Returns 403 on invalid credentials
    const url = `${baseUrl}/landlord/${config.memberId}/${config.branchId}/${config.apiKey}/`

    console.log('[TDS] Testing connection with GET to:', url.replace(config.apiKey, '***'))
    console.log('[TDS] Config:', { memberId: config.memberId, branchId: config.branchId, environment: config.environment })

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'PropertyGoose/1.0'
      }
    })

    const responseText = await response.text()
    console.log('[TDS] Response status:', response.status)

    if (!responseText || responseText.trim() === '') {
      if (response.ok) return { success: true, message: 'Connection successful' }
      return { success: false, message: `TDS API returned empty response (status ${response.status})` }
    }

    let data: any
    try {
      data = JSON.parse(responseText)
    } catch {
      return { success: false, message: `TDS API returned invalid response: ${responseText.substring(0, 100)}` }
    }

    // 403 = auth failed
    if (response.status === 403) {
      const errorMsg = data.errors ?
        (typeof data.errors === 'string' ? data.errors :
         Array.isArray(data.errors) ? data.errors.map((e: any) => e.value || e.name).join(', ') :
         Object.values(data.errors).join(', ')) :
        'The request could not be authenticated'
      return { success: false, message: `Authentication failed: ${errorMsg}` }
    }

    // 200 = credentials valid
    if (response.ok) {
      if (data.isSuccess === true || data.isSuccess === 'true' ||
          data.success === true || data.success === 'true' ||
          data.totalResults !== undefined || data.landlords) {
        return { success: true, message: 'Connection successful' }
      }
      return { success: true, message: 'Connection successful' }
    }

    return { success: false, message: data.error ?? `Connection test failed (status ${response.status})` }
  } catch (err) {
    console.error('TDS connection test error:', err)
    return { success: false, message: err instanceof Error ? err.message : 'Failed to connect to TDS API' }
  }
}

/**
 * Format date to TDS format (DD/MM/YYYY with slashes)
 */
function formatDateForTDS(date: string | Date): string {
  if (!date) {
    console.warn('[TDS] formatDateForTDS called with empty date')
    return ''
  }

  // If already in DD/MM/YYYY format, return as-is
  if (typeof date === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
    return date
  }

  // If in YYYY-MM-DD format (ISO), parse without timezone issues
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-')
    return `${day}/${month}/${year}`
  }

  // Otherwise use Date parsing (with timezone handling)
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) {
    console.warn('[TDS] formatDateForTDS: Invalid date:', date)
    return ''
  }
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

/**
 * Parse address line to extract PAON (house number/name) and street
 */
function parseAddressLine(addressLine1: string): { paon: string; street: string } {
  // Try to extract house number/name from start of address
  const match = addressLine1.match(/^(\d+[A-Za-z]?|[A-Za-z\s]+(?:House|Court|Lodge|Villa|Cottage|Flat\s+\d+))\s*,?\s*(.+)$/i)

  if (match) {
    return {
      paon: match[1].trim(),
      street: match[2].trim()
    }
  }

  // Fallback: try to split on first comma
  const commaIndex = addressLine1.indexOf(',')
  if (commaIndex > 0) {
    return {
      paon: addressLine1.substring(0, commaIndex).trim(),
      street: addressLine1.substring(commaIndex + 1).trim()
    }
  }

  // Last resort: try to extract leading number
  const numberMatch = addressLine1.match(/^(\d+)\s+(.+)$/)
  if (numberMatch) {
    return {
      paon: numberMatch[1],
      street: numberMatch[2]
    }
  }

  // Cannot parse - use '1' as default paon (must be valid BS7666 format, not 'N/A')
  return {
    paon: '1',
    street: addressLine1 || 'Unknown Street'
  }
}

/**
 * Map tenancy data to TDS API payload format
 */
export async function mapTenancyToTDSPayload(
  tenancy: any,
  depositReceivedDate: string,
  furnishedStatus: string = 'furnished',
  tdsConfig?: TDSConfig | null
): Promise<TenancyPayload> {
  console.log('[TDS] mapTenancyToTDSPayload input:', JSON.stringify({
    tenancy_id: tenancy.id,
    tenancy_start_date: tenancy.tenancy_start_date,
    start_date: tenancy.start_date,
    end_date: tenancy.end_date,
    deposit_amount: tenancy.deposit_amount,
    property: tenancy.property,
    landlords_count: tenancy.landlords?.length,
    tenants_count: tenancy.tenants?.length,
    depositReceivedDate
  }, null, 2))

  const property = tenancy.property || {}
  const tenants = tenancy.tenants || []
  const landlords = tenancy.landlords || []

  // Parse address
  const addressParts = parseAddressLine(property.address_line1 || '')
  console.log('[TDS] Parsed property address:', { input: property.address_line1, result: addressParts })

  // Build people array
  const people: PersonObject[] = []

  // Add landlords
  const primaryLandlord = landlords.find((l: any) => l.is_primary) || landlords[0]

  for (let index = 0; index < landlords.length; index++) {
    const landlord = landlords[index]
    // Check is_primary flag directly (for form data) or compare IDs (for database data)
    const isPrimary = landlord.is_primary || (landlord.id && landlord.id === primaryLandlord?.id) || index === 0
    // Check if landlord is a company (has company_name or is_company flag)
    const isCompany = !!(landlord.company_name || landlord.is_company)

    // Parse landlord address to extract PAON and street
    const landlordAddress = decrypt(landlord.address_line1_encrypted) || landlord.address_line1 || ''
    const landlordAddressParts = parseAddressLine(landlordAddress)

    console.log('[TDS] Processing landlord:', {
      index,
      isPrimary,
      first_name: landlord.first_name,
      last_name: landlord.last_name,
      email: landlord.email ? '***' : 'MISSING',
      address_line1: landlordAddress || 'MISSING',
      city: landlord.city || 'MISSING',
      postcode: landlord.postcode || 'MISSING',
      parsed_paon: landlordAddressParts.paon || 'MISSING',
      parsed_street: landlordAddressParts.street || 'MISSING'
    })

    // Search TDS for existing landlord by email to get their person_id
    const landlordEmailOriginal = decrypt(landlord.email_encrypted) || landlord.email || ''
    let existingPersonId: string | undefined
    let landlordEmail = landlordEmailOriginal
    if (tdsConfig && landlordEmailOriginal) {
      const tdsLandlordId = await searchLandlordByEmail(tdsConfig, landlordEmailOriginal)
      if (tdsLandlordId) {
        existingPersonId = tdsLandlordId
      } else {
        // Landlord not found in TDS — use plus addressing to ensure unique email
        // e.g. landlord@example.com → landlord+tds1711878000@example.com
        const [localPart, domain] = landlordEmailOriginal.split('@')
        if (localPart && domain) {
          landlordEmail = `${localPart}+tds${Date.now()}@${domain}`
          console.log('[TDS] Using plus-addressed email for new landlord:', landlordEmail.replace(/(.{3}).*@/, '$1***@'))
        }
      }
    }

    people.push({
      person_classification: isPrimary ? 'Primary Landlord' : 'Joint Landlord',
      person_id: existingPersonId,
      person_title: landlord.title || 'Mr',
      person_firstname: decrypt(landlord.first_name_encrypted) || landlord.first_name || '',
      person_surname: decrypt(landlord.last_name_encrypted) || landlord.last_name || '',
      person_email: landlordEmail || undefined,
      person_mobile: decrypt(landlord.phone_encrypted) || landlord.phone || undefined,
      is_business: isCompany ? 'Y' : 'N',
      business_name: isCompany ? landlord.company_name : undefined,
      // Landlord address fields (mandatory for landlords)
      person_paon: landlordAddressParts.paon,
      person_saon: decrypt(landlord.address_line2_encrypted) || landlord.address_line2 || undefined,
      person_street: landlordAddressParts.street,
      person_town: decrypt(landlord.city_encrypted) || landlord.city || 'Unknown',
      person_administrative_area: landlord.county || decrypt(landlord.city_encrypted) || landlord.city || 'Unknown',
      person_postcode: decrypt(landlord.postcode_encrypted) || landlord.postcode || property.postcode || 'AA1 1AA',
      person_country: 'United Kingdom'
    })
  }

  // Add tenants
  const leadTenant = tenants.find((t: any) => t.is_lead) || tenants[0]

  tenants.forEach((tenant: any, index: number) => {
    // Check is_lead flag directly (for form data) or compare IDs (for database data)
    const isLead = tenant.is_lead || (tenant.id && tenant.id === leadTenant?.id) || index === 0

    const tenantFirstName = decrypt(tenant.first_name_encrypted) || tenant.first_name || ''
    const tenantLastName = decrypt(tenant.last_name_encrypted) || tenant.last_name || ''
    const tenantEmailOriginal = decrypt(tenant.email_encrypted) || tenant.email || ''
    const tenantPhone = decrypt(tenant.phone_encrypted) || tenant.phone || ''

    // Apply plus addressing to ensure unique email in TDS
    let tenantEmail = tenantEmailOriginal
    if (tenantEmailOriginal) {
      const [localPart, domain] = tenantEmailOriginal.split('@')
      if (localPart && domain) {
        tenantEmail = `${localPart}+tds${Date.now()}${index}@${domain}`
      }
    }

    console.log('[TDS] Processing tenant:', {
      index,
      isLead,
      first_name: tenantFirstName || 'MISSING',
      last_name: tenantLastName || 'MISSING',
      email: tenantEmail ? '***' : 'MISSING',
      phone: tenantPhone ? '***' : 'MISSING'
    })

    people.push({
      person_classification: isLead ? 'Lead Tenant' : 'Joint Tenant',
      person_title: tenant.title || 'Mr',
      person_firstname: tenantFirstName,
      person_surname: tenantLastName,
      person_email: tenantEmail || undefined,
      person_mobile: tenantPhone || undefined,
      is_business: 'N'
    })
  })

  // Deduplicate emails within this payload — TDS requires unique emails per tenancy
  const usedEmails = new Set<string>()
  for (const person of people) {
    if (!person.person_email) continue
    const emailLower = person.person_email.toLowerCase().trim()
    if (usedEmails.has(emailLower)) {
      if (person.person_mobile) {
        console.log(`[TDS] Removing duplicate email for ${person.person_classification} (has mobile)`)
        delete person.person_email
      } else {
        const suffix = `+tds${usedEmails.size}@`
        const uniqueEmail = person.person_email.replace('@', suffix)
        console.log(`[TDS] Adding suffix to duplicate email for ${person.person_classification}`)
        person.person_email = uniqueEmail
        usedEmails.add(uniqueEmail.toLowerCase())
      }
    } else {
      usedEmails.add(emailLower)
    }
  }

  // Build payload - validate furnished status
  const validFurnishedStatuses = ['furnished', 'part furnished', 'unfurnished'] as const
  const normalizedFurnishedStatus = validFurnishedStatuses.includes(furnishedStatus as any)
    ? furnishedStatus as typeof validFurnishedStatuses[number]
    : 'furnished'

  // Ensure required property fields have values
  const propertyPaon = addressParts.paon || '1'
  const propertyStreet = addressParts.street || property.address_line1 || 'Unknown'
  const propertyTown = property.city || 'Unknown'
  const propertyPostcode = property.postcode || ''

  // Ensure dates are properly formatted
  const tenancyStartDate = formatDateForTDS(tenancy.tenancy_start_date || tenancy.start_date)
  const depositReceivedDateFormatted = formatDateForTDS(depositReceivedDate)

  console.log('[TDS] Final payload fields:', {
    property_paon: propertyPaon,
    property_street: propertyStreet,
    property_town: propertyTown,
    property_postcode: propertyPostcode,
    tenancy_start_date: tenancyStartDate,
    deposit_received_date: depositReceivedDateFormatted,
    deposit_amount: tenancy.deposit_amount,
    people_count: people.length,
    people_types: people.map(p => p.person_classification)
  })

  // Validate critical fields
  const validationErrors: string[] = []
  if (!tenancyStartDate) validationErrors.push('tenancy_start_date is missing')
  if (!depositReceivedDateFormatted) validationErrors.push('deposit_received_date is missing')
  if (!tenancy.deposit_amount) validationErrors.push('deposit_amount is missing')
  if (people.length === 0) validationErrors.push('No people (landlords/tenants) in payload')

  people.forEach((p, i) => {
    if (!p.person_firstname) validationErrors.push(`Person ${i} (${p.person_classification}): missing firstname`)
    if (!p.person_surname) validationErrors.push(`Person ${i} (${p.person_classification}): missing surname`)
  })

  if (validationErrors.length > 0) {
    console.error('[TDS] Payload validation errors:', validationErrors)
  }

  const payload: TenancyPayload = {
    user_tenancy_reference: `${tenancy.id.substring(0, 8)}-${Date.now()}`,
    property_paon: propertyPaon,
    property_street: propertyStreet,
    property_town: propertyTown,
    property_administrative_area: property.county || propertyTown || 'Unknown',
    property_postcode: propertyPostcode,
    tenancy_start_date: tenancyStartDate,
    deposit_amount: Number(tenancy.deposit_amount),
    deposit_amount_to_protect: Number(tenancy.deposit_amount),
    deposit_received_date: depositReceivedDateFormatted,
    number_of_tenants: tenants.length,
    number_of_landlords: landlords.length || 1,
    furnished_status: normalizedFurnishedStatus,
    people
  }

  // TDS REQUIRES end date - use provided or default to start date + 12 months
  if (tenancy.end_date || tenancy.tenancy_end_date) {
    payload.tenancy_expected_end_date = formatDateForTDS(tenancy.end_date || tenancy.tenancy_end_date)
  } else {
    // Default to 12 months from start date
    const startDateStr = tenancy.tenancy_start_date || tenancy.start_date
    if (startDateStr) {
      const startDate = new Date(startDateStr)
      startDate.setFullYear(startDate.getFullYear() + 1)
      payload.tenancy_expected_end_date = formatDateForTDS(startDate)
    }
  }

  return payload
}

/**
 * Create deposit with TDS
 */
export async function createDeposit(
  companyId: string,
  tenancy: any,
  depositReceivedDate: string,
  furnishedStatus: string = 'furnished'
): Promise<{ success: boolean; batchId?: string; error?: string }> {
  const config = await getCompanyTDSConfig(companyId)

  if (!config) {
    return { success: false, error: 'TDS not configured for this company' }
  }

  const baseUrl = TDS_ENDPOINTS[config.environment]
  const tenancyPayload = await mapTenancyToTDSPayload(tenancy, depositReceivedDate, furnishedStatus, config)

  const payload: TDSCreateDepositPayload = {
    member_id: config.memberId,
    branch_id: config.branchId,
    api_key: config.apiKey,
    region: 'EW',
    scheme_type: 'Custodial',
    invoice: true,
    tenancy: [tenancyPayload]
  }

  try {
    console.log('[TDS] Calling CreateDeposit:', `${baseUrl}/CreateDeposit`)
    // Log payload without sensitive data for debugging
    const debugPayload = {
      ...payload,
      api_key: '***REDACTED***',
      tenancy: payload.tenancy.map(t => ({
        ...t,
        people: t.people.map(p => ({
          ...p,
          person_email: p.person_email ? '***@***' : undefined,
          person_mobile: p.person_mobile ? '***REDACTED***' : undefined
        }))
      }))
    }
    console.log('[TDS] CreateDeposit payload:', JSON.stringify(debugPayload, null, 2))

    const response = await fetch(`${baseUrl}/CreateDeposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'PropertyGoose/1.0'
      },
      body: JSON.stringify(payload)
    })

    // Check for non-OK response before parsing
    const responseText = await response.text()
    console.log('[TDS] CreateDeposit response status:', response.status)
    console.log('[TDS] CreateDeposit response body:', responseText.substring(0, 500))

    if (!response.ok) {
      // Try to parse error response for more details
      try {
        const errorData = JSON.parse(responseText) as any
        // TDS can return errors in different formats:
        // { isSuccess: false, errors: { error: "message" } }
        // { success: false, errors: [{ name: "field", value: "message" }] }
        let errorMessage = ''
        if (errorData.errors) {
          if (Array.isArray(errorData.errors)) {
            errorMessage = errorData.errors.map((e: any) => e.value || e.message || e.name).join(', ')
          } else if (typeof errorData.errors === 'object') {
            errorMessage = Object.values(errorData.errors).join(', ')
          }
        }
        if (!errorMessage && errorData.error) {
          errorMessage = errorData.error
        }
        console.error('[TDS] API error details:', JSON.stringify(errorData))
        return {
          success: false,
          error: errorMessage || `TDS API error (${response.status})`
        }
      } catch {
        return {
          success: false,
          error: `TDS API error (${response.status}): ${responseText.substring(0, 200) || 'No response body'}`
        }
      }
    }

    // Parse JSON response
    let data: TDSCreateDepositResponse
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      console.error('[TDS] Failed to parse response as JSON:', responseText.substring(0, 500))
      return { success: false, error: `Invalid response from TDS API: ${responseText.substring(0, 100)}` }
    }

    console.log('[TDS] createDeposit response:', JSON.stringify(data))

    // TDS API can return either { success: true, batch_id: "..." } or { result: "success", batchId: "..." }
    const batchId = data.batch_id || data.batchId
    const isSuccess = data.success === true || data.result === 'success'

    if (isSuccess && batchId) {
      return { success: true, batchId }
    }

    // Handle specific errors
    if (data.error && data.error.includes('Invalid authentication key')) {
      return { success: false, error: 'API authentication failed. Check credentials in Settings.' }
    }
    if (data.error && data.error.includes('Attempt to update existing tenancy')) {
      return { success: false, error: 'This deposit is already registered with TDS.' }
    }
    if (data.errors && data.errors.length > 0) {
      const errorMessages = data.errors.map(e => e.message).join(', ')
      return { success: false, error: errorMessages }
    }

    return { success: false, error: data.error ?? 'Failed to create deposit with TDS' }
  } catch (err) {
    console.error('[TDS] createDeposit error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to connect to TDS API' }
  }
}

/**
 * Poll deposit status until complete or timeout
 */
export async function pollDepositStatus(
  companyId: string,
  batchId: string,
  maxAttempts: number = 10,
  intervalMs: number = 3000
): Promise<{ success: boolean; dan?: string; status?: string; error?: string; rawResponse?: any }> {
  const config = await getCompanyTDSConfig(companyId)

  if (!config) {
    return { success: false, error: 'TDS not configured for this company' }
  }

  const baseUrl = TDS_ENDPOINTS[config.environment]

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // GET /v1.2/CreateDepositStatus/<member_id>/<branch_id>/<api_key>/<batch_id>
      const url = `${baseUrl}/CreateDepositStatus/${config.memberId}/${config.branchId}/${config.apiKey}/${batchId}`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'PropertyGoose/1.0'
        }
      })

      const data = await response.json() as TDSDepositStatusResponse

      console.log(`[TDS] pollDepositStatus attempt ${attempt + 1} response:`, JSON.stringify(data))

      // TDS returns success as boolean true or string "true"
      const isSuccessResponse = data.success === true || data.success === 'true'

      // Per TDS API docs v1.13 page 14-15:
      // Response has: success, status (created/pending/failed), dan (when created), errors (when failed)
      if (isSuccessResponse) {
        const status = data.status?.toLowerCase()

        // Status "created" means deposit is registered and we have a DAN
        if (status === 'created' && data.dan) {
          console.log(`[TDS] Deposit created successfully with DAN: ${data.dan}`)
          return {
            success: true,
            dan: data.dan,
            status: 'complete',
            rawResponse: data
          }
        }

        // Status "failed" means there was an error
        if (status === 'failed') {
          const errorMessages = data.errors
            ? data.errors.map(e => e.value || e.message || JSON.stringify(e)).join(', ')
            : 'Registration failed'
          console.log(`[TDS] Deposit creation failed: ${errorMessages}`)
          return {
            success: false,
            status: 'failed',
            error: errorMessages,
            rawResponse: data
          }
        }

        // Status "pending" means still processing - continue polling
        if (status === 'pending') {
          console.log(`[TDS] Deposit still pending, attempt ${attempt + 1}/${maxAttempts}`)
          if (attempt < maxAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, intervalMs))
            continue
          }
        }
      }

      // Handle error response
      if (data.error || (data.errors && data.errors.length > 0)) {
        const errorMsg = data.error || data.errors?.map(e => e.value || e.message || JSON.stringify(e)).join(', ')
        return { success: false, error: errorMsg, rawResponse: data }
      }

      // If success is false, return the error
      if (data.success === false || data.success === 'false') {
        return {
          success: false,
          error: 'TDS request failed',
          rawResponse: data
        }
      }

      // If still processing after max attempts
      if (attempt === maxAttempts - 1) {
        return {
          success: false,
          status: 'timeout',
          error: 'TDS taking longer than expected. Check TDS portal for status.',
          rawResponse: data
        }
      }

      await new Promise(resolve => setTimeout(resolve, intervalMs))
    } catch (err) {
      console.error(`TDS pollDepositStatus attempt ${attempt + 1} error:`, err)
      if (attempt === maxAttempts - 1) {
        return { success: false, error: err instanceof Error ? err.message : 'Failed to check deposit status' }
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }
  }

  return { success: false, error: 'Polling timeout reached' }
}

/**
 * Get DPC (Deposit Protection Certificate) PDF
 * Per TDS Custodial API docs: GET /dpc/<member_id>/<branch_id>/<api_key>/<tenancy_dan>
 * Returns the PDF file directly
 */
export async function getDPCUrl(
  companyId: string,
  dan: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const config = await getCompanyTDSConfig(companyId)

  if (!config) {
    return { success: false, error: 'TDS not configured for this company' }
  }

  const baseUrl = TDS_ENDPOINTS[config.environment]

  // The DPC endpoint returns the PDF directly, so we return the URL for direct download
  const url = `${baseUrl}/dpc/${config.memberId}/${config.branchId}/${config.apiKey}/${dan}`

  return { success: true, url }
}

/**
 * Download DPC certificate and return as buffer
 * Per TDS Custodial API docs: GET /dpc/<member_id>/<branch_id>/<api_key>/<tenancy_dan>
 */
export async function downloadDPC(
  companyId: string,
  dan: string
): Promise<{ success: boolean; buffer?: Buffer; contentType?: string; error?: string }> {
  const urlResult = await getDPCUrl(companyId, dan)

  if (!urlResult.success || !urlResult.url) {
    console.error('[TDS DPC] Failed to get URL:', urlResult.error)
    return { success: false, error: urlResult.error || 'Failed to get DPC URL' }
  }

  console.log('[TDS DPC] Fetching certificate from TDS...')

  try {
    const response = await fetch(urlResult.url, {
      method: 'GET',
      headers: {
        'User-Agent': 'PropertyGoose/1.0'
      }
    })

    console.log('[TDS DPC] Response status:', response.status, 'Content-Type:', response.headers.get('content-type'))

    if (!response.ok) {
      // Try to parse error response
      const text = await response.text()
      console.error('[TDS DPC] Error response:', text.substring(0, 500))
      try {
        const errorData = JSON.parse(text)
        if (errorData.errors) {
          const errorMsg = Object.values(errorData.errors).join(', ')
          return { success: false, error: errorMsg }
        }
      } catch {
        // Not JSON, use status
      }
      return { success: false, error: `Failed to download DPC certificate (${response.status})` }
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type') || 'application/pdf'

    return { success: true, buffer, contentType }
  } catch (err) {
    console.error('TDS downloadDPC error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to download DPC certificate' }
  }
}

/**
 * Save TDS credentials for a company
 */
export async function saveTDSConfig(
  companyId: string,
  config: { memberId: string; branchId: string; apiKey: string; environment: 'sandbox' | 'live' }
): Promise<{ success: boolean; error?: string }> {
  // Trim whitespace from all credentials to prevent auth failures
  config.apiKey = config.apiKey.trim()
  config.memberId = config.memberId.trim()
  config.branchId = config.branchId.trim()

  console.log('[TDS saveTDSConfig] Saving config for companyId:', companyId)
  console.log('[TDS saveTDSConfig] Config:', { memberId: config.memberId, branchId: config.branchId, environment: config.environment, hasApiKey: !!config.apiKey })

  // Store API key as-is — encryption/decryption has been corrupting the key on prod
  const encryptedApiKey = config.apiKey

  const { data: existing, error: existingError } = await supabase
    .from('company_integrations')
    .select('id')
    .eq('company_id', companyId)
    .single()

  console.log('[TDS saveTDSConfig] Existing record check:', { existing, error: existingError?.message })

  if (existing) {
    // Update existing record
    console.log('[TDS saveTDSConfig] Updating existing record...')
    const { error } = await supabase
      .from('company_integrations')
      .update({
        tds_api_key_encrypted: encryptedApiKey,
        tds_member_id: config.memberId,
        tds_branch_id: config.branchId,
        tds_environment: config.environment,
        tds_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('company_id', companyId)

    if (error) {
      console.error('[TDS saveTDSConfig] Error updating TDS config:', error)
      return { success: false, error: 'Failed to save TDS configuration' }
    }
    console.log('[TDS saveTDSConfig] Update successful')
  } else {
    // Insert new record
    console.log('[TDS saveTDSConfig] Inserting new record...')
    const { error } = await supabase
      .from('company_integrations')
      .insert({
        company_id: companyId,
        tds_api_key_encrypted: encryptedApiKey,
        tds_member_id: config.memberId,
        tds_branch_id: config.branchId,
        tds_environment: config.environment,
        tds_connected_at: new Date().toISOString()
      })

    if (error) {
      console.error('[TDS saveTDSConfig] Error inserting TDS config:', error)
      return { success: false, error: 'Failed to save TDS configuration' }
    }
    console.log('[TDS saveTDSConfig] Insert successful')
  }

  return { success: true }
}

/**
 * Remove TDS configuration for a company
 */
export async function removeTDSConfig(companyId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('company_integrations')
    .update({
      tds_api_key_encrypted: null,
      tds_member_id: null,
      tds_branch_id: null,
      tds_environment: null,
      tds_connected_at: null,
      tds_last_tested_at: null,
      tds_last_test_status: null,
      updated_at: new Date().toISOString()
    })
    .eq('company_id', companyId)

  if (error) {
    console.error('Error removing TDS config:', error)
    return { success: false, error: 'Failed to remove TDS configuration' }
  }

  return { success: true }
}

/**
 * Update TDS test status
 */
export async function updateTDSTestStatus(
  companyId: string,
  status: 'success' | 'failed'
): Promise<void> {
  await supabase
    .from('company_integrations')
    .update({
      tds_last_tested_at: new Date().toISOString(),
      tds_last_test_status: status,
      updated_at: new Date().toISOString()
    })
    .eq('company_id', companyId)
}

/**
 * Get TDS registration for a tenancy
 */
export async function getTDSRegistration(tenancyId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('tds_registrations')
    .select('*')
    .eq('tenancy_id', tenancyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    return null
  }

  return data
}

/**
 * Save TDS registration record
 */
export async function saveTDSRegistration(
  tenancyId: string,
  companyId: string,
  userId: string,
  dan: string,
  batchId: string | null,
  depositAmount: number,
  depositReceivedDate: string,
  rawResponse: any
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('tds_registrations')
    .insert({
      tenancy_id: tenancyId,
      company_id: companyId,
      registered_by: userId,
      dan,
      batch_id: batchId,
      deposit_amount: depositAmount,
      deposit_received_date: depositReceivedDate,
      status: 'registered',
      raw_response: rawResponse
    })

  if (error) {
    console.error('Error saving TDS registration:', error)
    return { success: false, error: 'Failed to save registration record' }
  }

  return { success: true }
}

/**
 * Save pending TDS registration (before DAN is received)
 */
export async function savePendingTDSRegistration(
  tenancyId: string,
  companyId: string,
  userId: string,
  batchId: string,
  depositAmount: number,
  depositReceivedDate: string,
  schemeType: 'custodial' | 'insured' = 'custodial'
): Promise<{ success: boolean; registrationId?: string; error?: string }> {
  const { data, error } = await supabase
    .from('tds_registrations')
    .insert({
      tenancy_id: tenancyId,
      company_id: companyId,
      registered_by: userId,
      batch_id: batchId,
      deposit_amount: depositAmount,
      deposit_received_date: depositReceivedDate,
      status: 'processing',
      scheme_type: schemeType
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error saving pending TDS registration:', error)
    return { success: false, error: 'Failed to save registration record' }
  }

  return { success: true, registrationId: data?.id }
}

/**
 * Update TDS registration with DAN (when processing completes)
 */
export async function updateTDSRegistrationWithDAN(
  batchId: string,
  dan: string,
  rawResponse?: any
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('tds_registrations')
    .update({
      dan,
      status: 'registered',
      raw_response: rawResponse,
      updated_at: new Date().toISOString()
    })
    .eq('batch_id', batchId)

  if (error) {
    console.error('Error updating TDS registration:', error)
    return { success: false, error: 'Failed to update registration record' }
  }

  return { success: true }
}

/**
 * Mark TDS registration as failed
 */
export async function markTDSRegistrationFailed(
  batchId: string,
  errorMessage: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('tds_registrations')
    .update({
      status: 'failed',
      error_message: errorMessage,
      updated_at: new Date().toISOString()
    })
    .eq('batch_id', batchId)

  if (error) {
    console.error('Error marking TDS registration as failed:', error)
    return { success: false, error: 'Failed to update registration record' }
  }

  return { success: true }
}

/**
 * Get pending TDS registration by batch ID
 */
export async function getPendingTDSRegistration(batchId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('tds_registrations')
    .select('*')
    .eq('batch_id', batchId)
    .single()

  if (error || !data) {
    return null
  }

  return data
}

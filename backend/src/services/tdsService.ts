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
  type: string
  title?: string
  forename: string
  surname: string
  email?: string
  telephone?: string
  address_line_1?: string
  address_line_2?: string
  address_town?: string
  address_county?: string
  address_postcode?: string
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
  property_furnished: string
  people: PersonObject[]
}

interface TDSCreateDepositPayload {
  member_id: string
  branch_id: string
  api_key: string
  region: 'EW'
  scheme_type: 'Custodial'
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

  const apiKey = decrypt(data.tds_api_key_encrypted)
  if (!apiKey) {
    return null
  }

  return {
    apiKey,
    memberId: data.tds_member_id || '',
    branchId: data.tds_branch_id || '0',
    environment: (data.tds_environment as 'sandbox' | 'live') || 'sandbox'
  }
}

/**
 * Test TDS API connection with provided credentials
 */
export async function testConnection(config: TDSConfig): Promise<{ success: boolean; message: string }> {
  // Use versioned endpoints - testing confirmed /v1.2/ prefix is required for GET endpoints
  const baseUrl = TDS_ENDPOINTS[config.environment]

  try {
    // Test using the landlord search endpoint (simplest GET endpoint)
    // Per testing: GET /v1.2/landlord/<member_id>/<branch_id>/<api_key>/
    // Returns 200 with isSuccess:true on valid credentials, 403 on invalid
    const url = `${baseUrl}/landlord/${config.memberId}/${config.branchId}/${config.apiKey}/`

    console.log('[TDS] Testing connection with GET request to:', url.replace(config.apiKey, '***API_KEY***'))
    console.log('[TDS] Config:', { memberId: config.memberId, branchId: config.branchId, environment: config.environment })

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'PropertyGoose/1.0'
      }
    })

    // Get response text first to handle empty responses
    const responseText = await response.text()

    console.log('[TDS] Response status:', response.status, response.statusText)
    console.log('[TDS] Response body:', responseText.substring(0, 500))

    // Check if response is empty
    if (!responseText || responseText.trim() === '') {
      if (response.ok) {
        // Empty 200 response might still indicate success
        return { success: true, message: 'Connection successful (empty response)' }
      }
      return { success: false, message: `TDS API returned empty response (status ${response.status})` }
    }

    // Try to parse as JSON
    let data: { success?: boolean | string; result?: string; status?: string; error?: string; errors?: Record<string, string> | Array<{name?: string; value?: string}> }
    try {
      data = JSON.parse(responseText)
    } catch {
      console.error('[TDS] API returned non-JSON response:', responseText.substring(0, 200))
      return { success: false, message: `TDS API returned invalid response: ${responseText.substring(0, 100)}` }
    }

    console.log('[TDS] Parsed response:', JSON.stringify(data).substring(0, 500))

    // Check for authentication errors (403 response)
    if (response.status === 403) {
      const errorMsg = data.errors ?
        (Array.isArray(data.errors) ? data.errors.map(e => e.value || e.name).join(', ') : Object.values(data.errors).join(', ')) :
        'The request could not be authenticated'
      return { success: false, message: `Authentication failed: ${errorMsg}` }
    }

    // Check for 400 errors (validation/missing params)
    if (response.status === 400) {
      const errorMsg = data.errors ?
        (Array.isArray(data.errors) ? data.errors.map(e => e.value || e.name).join(', ') : Object.values(data.errors).join(', ')) :
        data.error || 'Bad request'
      return { success: false, message: errorMsg }
    }

    // If we get a proper 200 response, credentials are valid
    if (response.ok) {
      // Per API docs for landlord endpoint, isSuccess=true indicates valid credentials
      // The response can also have success=true or success="true"
      if (data.success === true || data.success === 'true' ||
          (data as any).isSuccess === true || (data as any).isSuccess === 'true') {
        return { success: true, message: 'Connection successful' }
      }
      // Also accept if we got a proper status response
      if (data.status) {
        return { success: true, message: 'Connection successful' }
      }
      // Accept if we got a totalResults response (landlord/property search)
      if ((data as any).totalResults !== undefined || (data as any).landlords || (data as any).properties) {
        return { success: true, message: 'Connection successful' }
      }
      // Fallback - if we got a 200, credentials likely work
      return { success: true, message: 'Connection successful' }
    }

    return { success: false, message: data.error ?? `Connection test failed (status ${response.status})` }
  } catch (err) {
    console.error('TDS connection test error:', err)
    return { success: false, message: err instanceof Error ? err.message : 'Failed to connect to TDS API' }
  }
}

/**
 * Format date to TDS format (DD-MM-YYYY)
 */
function formatDateForTDS(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}-${month}-${year}`
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

  // Cannot parse - return full address as street
  return {
    paon: '',
    street: addressLine1
  }
}

/**
 * Map tenancy data to TDS API payload format
 */
export function mapTenancyToTDSPayload(
  tenancy: any,
  depositReceivedDate: string,
  furnishedStatus: string = 'furnished'
): TenancyPayload {
  const property = tenancy.property || {}
  const tenants = tenancy.tenants || []
  const landlords = tenancy.landlords || []

  // Parse address
  const addressParts = parseAddressLine(property.address_line1 || '')

  // Build people array
  const people: PersonObject[] = []

  // Add landlords
  const primaryLandlord = landlords.find((l: any) => l.is_primary) || landlords[0]

  landlords.forEach((landlord: any, index: number) => {
    const isPrimary = landlord.id === primaryLandlord?.id
    people.push({
      type: isPrimary ? 'Primary Landlord' : 'Joint Landlord',
      title: landlord.title || 'Mr',
      forename: decrypt(landlord.first_name_encrypted) || landlord.first_name || '',
      surname: decrypt(landlord.last_name_encrypted) || landlord.last_name || '',
      email: decrypt(landlord.email_encrypted) || landlord.email || '',
      telephone: decrypt(landlord.phone_encrypted) || landlord.phone || '',
      address_line_1: decrypt(landlord.address_line1_encrypted) || landlord.address_line1 || '',
      address_line_2: decrypt(landlord.address_line2_encrypted) || landlord.address_line2 || '',
      address_town: decrypt(landlord.city_encrypted) || landlord.city || '',
      address_county: landlord.county || '',
      address_postcode: decrypt(landlord.postcode_encrypted) || landlord.postcode || ''
    })
  })

  // Add tenants
  const leadTenant = tenants.find((t: any) => t.is_lead) || tenants[0]

  tenants.forEach((tenant: any) => {
    const isLead = tenant.id === leadTenant?.id
    people.push({
      type: isLead ? 'Lead Tenant' : 'Joint Tenant',
      title: tenant.title || 'Mr',
      forename: decrypt(tenant.first_name_encrypted) || tenant.first_name || '',
      surname: decrypt(tenant.last_name_encrypted) || tenant.last_name || '',
      email: decrypt(tenant.email_encrypted) || tenant.email || '',
      telephone: decrypt(tenant.phone_encrypted) || tenant.phone || ''
    })
  })

  // Build payload
  const payload: TenancyPayload = {
    user_tenancy_reference: tenancy.id,
    property_paon: addressParts.paon,
    property_street: addressParts.street,
    property_town: property.city || '',
    property_administrative_area: property.county || '',
    property_postcode: property.postcode || '',
    tenancy_start_date: formatDateForTDS(tenancy.tenancy_start_date || tenancy.start_date),
    deposit_amount: Number(tenancy.deposit_amount),
    deposit_amount_to_protect: Number(tenancy.deposit_amount),
    deposit_received_date: formatDateForTDS(depositReceivedDate),
    number_of_tenants: tenants.length,
    number_of_landlords: landlords.length || 1,
    property_furnished: furnishedStatus,
    people
  }

  // Add optional end date if provided
  if (tenancy.end_date || tenancy.tenancy_end_date) {
    payload.tenancy_expected_end_date = formatDateForTDS(tenancy.end_date || tenancy.tenancy_end_date)
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
  const tenancyPayload = mapTenancyToTDSPayload(tenancy, depositReceivedDate, furnishedStatus)

  const payload: TDSCreateDepositPayload = {
    member_id: config.memberId,
    branch_id: config.branchId,
    api_key: config.apiKey,
    region: 'EW',
    scheme_type: 'Custodial',
    tenancy: [tenancyPayload]
  }

  try {
    console.log('[TDS] Calling CreateDeposit:', `${baseUrl}/CreateDeposit`)

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
      return {
        success: false,
        error: `TDS API error (${response.status}): ${responseText.substring(0, 200) || 'No response body'}`
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

  // All endpoints need /v1.2 version prefix
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

  // All endpoints need /v1.2 version prefix
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
    return { success: false, error: urlResult.error || 'Failed to get DPC URL' }
  }

  try {
    const response = await fetch(urlResult.url, {
      method: 'GET',
      headers: {
        'User-Agent': 'PropertyGoose/1.0'
      }
    })

    if (!response.ok) {
      // Try to parse error response
      const text = await response.text()
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
  console.log('[TDS saveTDSConfig] Saving config for companyId:', companyId)
  console.log('[TDS saveTDSConfig] Config:', { memberId: config.memberId, branchId: config.branchId, environment: config.environment, hasApiKey: !!config.apiKey })

  const encryptedApiKey = encrypt(config.apiKey)

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

import { supabase } from '../config/supabase'
import { encrypt, decrypt } from './encryption'

// TDS Insured API endpoints
const TDS_INSURED_ENDPOINTS = {
  sandbox: 'https://sandbox.api.insured.tenancydepositscheme.com',
  live: 'https://api.insured.tenancydepositscheme.com'
}

const API_VERSION = 'v1.4'
const USER_AGENT = 'PropertyGoose/1.0'

// TDS Insured config interface
interface TDSInsuredConfig {
  clientId: string
  clientSecret: string
  accessToken: string
  refreshToken: string
  tokenExpiresAt: Date | null
  memberId: string
  branchId: string
  environment: 'sandbox' | 'live'
}

// TDS Insured person object
interface InsuredPersonObject {
  person_classification: 'Landlord' | 'Tenant'
  person_id?: string
  person_reference?: string
  person_title: string
  person_firstname: string
  person_surname: string
  person_email?: string
  person_mobile?: string
  is_business?: string
  // Landlord address fields
  person_paon?: string
  person_saon?: string
  person_street?: string
  person_locality?: string
  person_town?: string
  person_administrative_area?: string
  person_postcode?: string
  person_country?: string
  person_correspondence_country?: string
}

// TDS Insured tenancy payload
interface InsuredTenancyPayload {
  tenancy_id: string
  property_paon: string
  property_saon?: string
  property_street?: string
  property_locality?: string
  property_town: string
  property_administrative_area?: string
  property_postcode: string
  tenancy_start_date: string
  tenancy_expected_end_date?: string
  rent_amount: number
  deposit_amount: number
  deposit_received_date: string
  number_of_tenants: number
  number_of_landlords: number
  people: InsuredPersonObject[]
}

// Full request payload
interface InsuredCreateDepositPayload {
  member_id: string
  branch_id: string
  scheme_type: 'Insured'
  tenancy: InsuredTenancyPayload
}

/**
 * Get TDS Insured configuration for a company
 */
export async function getCompanyTDSInsuredConfig(companyId: string): Promise<TDSInsuredConfig | null> {
  const { data, error } = await supabase
    .from('company_integrations')
    .select(`
      tds_insured_client_id,
      tds_insured_client_secret_encrypted,
      tds_insured_access_token_encrypted,
      tds_insured_refresh_token_encrypted,
      tds_insured_token_expires_at,
      tds_insured_member_id,
      tds_insured_branch_id,
      tds_insured_environment
    `)
    .eq('company_id', companyId)
    .single()

  if (error || !data || !data.tds_insured_client_id) {
    return null
  }

  const clientSecret = data.tds_insured_client_secret_encrypted ? decrypt(data.tds_insured_client_secret_encrypted) : ''
  const accessToken = data.tds_insured_access_token_encrypted ? decrypt(data.tds_insured_access_token_encrypted) : ''
  const refreshToken = data.tds_insured_refresh_token_encrypted ? decrypt(data.tds_insured_refresh_token_encrypted) : ''

  return {
    clientId: data.tds_insured_client_id,
    clientSecret: clientSecret || '',
    accessToken: accessToken || '',
    refreshToken: refreshToken || '',
    tokenExpiresAt: data.tds_insured_token_expires_at ? new Date(data.tds_insured_token_expires_at) : null,
    memberId: data.tds_insured_member_id || '',
    branchId: data.tds_insured_branch_id || '',
    environment: (data.tds_insured_environment as 'sandbox' | 'live') || 'sandbox'
  }
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  config: { clientId: string; clientSecret: string; environment: 'sandbox' | 'live' },
  authorizationCode: string,
  redirectUri?: string
): Promise<{ success: boolean; accessToken?: string; refreshToken?: string; expiresIn?: number; error?: string }> {
  const baseUrl = TDS_INSURED_ENDPOINTS[config.environment]

  try {
    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')

    let body = `grant_type=authorization_code&code=${encodeURIComponent(authorizationCode)}`
    if (redirectUri) {
      body += `&redirect_uri=${encodeURIComponent(redirectUri)}`
    }

    const response = await fetch(`${baseUrl}/${API_VERSION}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
        'User-Agent': USER_AGENT
      },
      body
    })

    const responseText = await response.text()
    if (!responseText) {
      return { success: false, error: 'Empty response from TDS API' }
    }

    let data: any
    try {
      data = JSON.parse(responseText)
    } catch {
      return { success: false, error: `Invalid response: ${responseText.substring(0, 100)}` }
    }

    if (data.access_token) {
      return {
        success: true,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in || 3600
      }
    }

    return { success: false, error: data.error_description || data.error || 'Failed to get token' }
  } catch (err) {
    console.error('TDS Insured token exchange error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to exchange code for token' }
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  companyId: string,
  config: TDSInsuredConfig
): Promise<{ success: boolean; accessToken?: string; error?: string }> {
  const baseUrl = TDS_INSURED_ENDPOINTS[config.environment]

  try {
    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')

    const response = await fetch(`${baseUrl}/${API_VERSION}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
        'User-Agent': USER_AGENT
      },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(config.refreshToken)}`
    })

    const responseText = await response.text()
    if (!responseText) {
      return { success: false, error: 'Empty response from TDS API' }
    }

    let data: any
    try {
      data = JSON.parse(responseText)
    } catch {
      return { success: false, error: `Invalid response: ${responseText.substring(0, 100)}` }
    }

    if (data.Access_token || data.access_token) {
      const newAccessToken = data.Access_token || data.access_token
      const expiresIn = data.Expires_in || data.expires_in || 3600

      // Save new access token
      const encryptedToken = encrypt(newAccessToken)
      const expiresAt = new Date(Date.now() + expiresIn * 1000)

      await supabase
        .from('company_integrations')
        .update({
          tds_insured_access_token_encrypted: encryptedToken,
          tds_insured_token_expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('company_id', companyId)

      return { success: true, accessToken: newAccessToken }
    }

    return { success: false, error: data.error_description || data.error || 'Failed to refresh token' }
  } catch (err) {
    console.error('TDS Insured token refresh error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to refresh token' }
  }
}

/**
 * Get valid access token, refreshing if needed
 */
export async function getValidAccessToken(
  companyId: string,
  config: TDSInsuredConfig
): Promise<{ success: boolean; accessToken?: string; error?: string }> {
  // Check if token is still valid (with 5 minute buffer)
  if (config.accessToken && config.tokenExpiresAt) {
    const bufferMs = 5 * 60 * 1000 // 5 minutes
    if (new Date(config.tokenExpiresAt).getTime() > Date.now() + bufferMs) {
      return { success: true, accessToken: config.accessToken }
    }
  }

  // Token expired or expiring soon, refresh it
  if (config.refreshToken) {
    return await refreshAccessToken(companyId, config)
  }

  return { success: false, error: 'No valid token available. Please re-authorize.' }
}

/**
 * Test TDS Insured API connection
 */
export async function testInsuredConnection(
  companyId: string,
  config: TDSInsuredConfig
): Promise<{ success: boolean; message: string }> {
  const baseUrl = TDS_INSURED_ENDPOINTS[config.environment]

  // Get valid access token
  const tokenResult = await getValidAccessToken(companyId, config)
  if (!tokenResult.success || !tokenResult.accessToken) {
    return { success: false, message: tokenResult.error || 'Failed to get valid access token' }
  }

  try {
    // Use verify-access-code endpoint to test
    const response = await fetch(`${baseUrl}/${API_VERSION}/verify-access-code`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenResult.accessToken}`,
        'User-Agent': USER_AGENT
      }
    })

    const responseText = await response.text()

    if (response.ok) {
      let data: any
      try {
        data = JSON.parse(responseText)
      } catch {
        // Some endpoints return plain text
      }

      if (data?.success === 'true' || data?.success === true || response.status === 200) {
        return { success: true, message: 'Connection successful' }
      }
    }

    if (response.status === 401) {
      return { success: false, message: 'Authorization failed. Please re-authorize.' }
    }

    return { success: false, message: `Connection test failed (status ${response.status})` }
  } catch (err) {
    console.error('TDS Insured connection test error:', err)
    return { success: false, message: err instanceof Error ? err.message : 'Failed to connect to TDS API' }
  }
}

/**
 * Format date to TDS Insured format (DD/MM/YYYY)
 */
function formatDateForTDSInsured(date: string | Date): string {
  if (!date) {
    console.warn('[TDS Insured] formatDateForTDSInsured called with empty date')
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

  // Otherwise use Date parsing
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) {
    console.warn('[TDS Insured] formatDateForTDSInsured: Invalid date:', date)
    return ''
  }
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

/**
 * Parse address line to extract PAON and street
 */
function parseAddressLine(addressLine1: string): { paon: string; street: string } {
  const match = addressLine1.match(/^(\d+[A-Za-z]?|[A-Za-z\s]+(?:House|Court|Lodge|Villa|Cottage|Flat\s+\d+))\s*,?\s*(.+)$/i)

  if (match) {
    return { paon: match[1].trim(), street: match[2].trim() }
  }

  const commaIndex = addressLine1.indexOf(',')
  if (commaIndex > 0) {
    return {
      paon: addressLine1.substring(0, commaIndex).trim(),
      street: addressLine1.substring(commaIndex + 1).trim()
    }
  }

  const numberMatch = addressLine1.match(/^(\d+)\s+(.+)$/)
  if (numberMatch) {
    return { paon: numberMatch[1], street: numberMatch[2] }
  }

  // Use '1' as default paon (must be valid BS7666 format, not 'N/A')
  return { paon: '1', street: addressLine1 || 'Unknown Street' }
}

/**
 * Map tenancy data to TDS Insured API payload format
 */
export function mapTenancyToInsuredPayload(
  tenancy: any,
  depositReceivedDate: string
): InsuredTenancyPayload {
  const property = tenancy.property || {}
  const tenants = tenancy.tenants || []
  const landlords = tenancy.landlords || []

  const addressParts = parseAddressLine(property.address_line1 || '')

  // Build people array
  const people: InsuredPersonObject[] = []

  // Add landlord (TDS Insured only supports one landlord per tenancy)
  const primaryLandlord = landlords.find((l: any) => l.is_primary) || landlords[0]
  if (primaryLandlord) {
    // Use structured address fields — these come pre-decrypted from the route
    const llAddr = primaryLandlord.address_line1 || ''
    const llCity = primaryLandlord.city || ''
    const llCounty = primaryLandlord.county || ''
    const llPostcode = primaryLandlord.postcode || ''
    const landlordAddressParts = parseAddressLine(llAddr)

    people.push({
      person_classification: 'Landlord',
      person_title: primaryLandlord.title || 'Mr',
      person_firstname: primaryLandlord.first_name || '',
      person_surname: primaryLandlord.last_name || '',
      person_email: primaryLandlord.email || '',
      person_mobile: primaryLandlord.phone || primaryLandlord.mobile || '07000000000',
      is_business: 'N',
      person_paon: landlordAddressParts.paon || '1',
      person_street: landlordAddressParts.street || 'Not provided',
      person_town: llCity || 'N/A',
      person_administrative_area: llCounty || llCity || 'N/A',
      person_postcode: (llPostcode || '').replace(/\s+/g, ''),
      person_country: 'United Kingdom',
      person_correspondence_country: 'United Kingdom'
    })
  }

  // Add tenants
  const leadTenant = tenants.find((t: any) => t.is_lead) || tenants[0]

  tenants.forEach((tenant: any, index: number) => {
    // Check is_lead flag directly (for form data) or compare IDs (for database data)
    const isLead = tenant.is_lead || (tenant.id && tenant.id === leadTenant?.id) || index === 0
    const tenantPhone = tenant.phone || tenant.mobile || ''
    people.push({
      person_classification: 'Tenant',
      person_title: tenant.title || 'Mr',
      person_firstname: tenant.first_name || '',
      person_surname: tenant.last_name || '',
      person_email: tenant.email || '',
      person_mobile: (tenantPhone.startsWith('0') || tenantPhone.startsWith('+')) ? tenantPhone : '',
      is_business: 'N'
    })
  })

  // Strip spaces from all postcodes (TDS requires no spaces)
  const stripPostcode = (pc: string) => (pc || '').replace(/\s+/g, '')

  // Strip spaces from postcodes in person objects
  for (const person of people) {
    if (person.person_postcode) person.person_postcode = stripPostcode(person.person_postcode)
  }

  // Build payload
  // Note: TDS Insured only supports 1 landlord per tenancy (the primary/main landlord)
  const payload: InsuredTenancyPayload = {
    tenancy_id: tenancy.id,
    property_paon: addressParts.paon,
    property_street: addressParts.street,
    property_town: property.city || 'N/A',
    property_administrative_area: property.county || property.city || 'N/A',
    property_postcode: stripPostcode(property.postcode || ''),
    tenancy_start_date: formatDateForTDSInsured(tenancy.tenancy_start_date || tenancy.start_date),
    rent_amount: Number(tenancy.monthly_rent) || 0,
    deposit_amount: Number(tenancy.deposit_amount),
    deposit_received_date: formatDateForTDSInsured(depositReceivedDate),
    number_of_tenants: tenants.length,
    number_of_landlords: 1, // TDS Insured only works with 1 landlord per tenancy
    people
  }

  // TDS REQUIRES end date - use provided or default to start date + 12 months
  if (tenancy.end_date || tenancy.tenancy_end_date) {
    payload.tenancy_expected_end_date = formatDateForTDSInsured(tenancy.end_date || tenancy.tenancy_end_date)
  } else {
    // Default to 12 months from start date
    const startDateStr = tenancy.tenancy_start_date || tenancy.start_date
    if (startDateStr) {
      const startDate = new Date(startDateStr)
      startDate.setFullYear(startDate.getFullYear() + 1)
      payload.tenancy_expected_end_date = formatDateForTDSInsured(startDate)
    }
  }

  return payload
}

/**
 * Create deposit with TDS Insured
 */
export async function createInsuredDeposit(
  companyId: string,
  tenancy: any,
  depositReceivedDate: string
): Promise<{ success: boolean; apiReference?: string; error?: string }> {
  const config = await getCompanyTDSInsuredConfig(companyId)

  if (!config) {
    return { success: false, error: 'TDS Insured not configured for this company' }
  }

  // Get valid access token
  const tokenResult = await getValidAccessToken(companyId, config)
  if (!tokenResult.success || !tokenResult.accessToken) {
    return { success: false, error: tokenResult.error || 'Failed to get valid access token' }
  }

  const baseUrl = TDS_INSURED_ENDPOINTS[config.environment]
  const tenancyPayload = mapTenancyToInsuredPayload(tenancy, depositReceivedDate)

  // Search for existing landlord by email to get their person_id
  const landlordPerson = tenancyPayload.people.find(p => p.person_classification === 'Landlord')
  if (landlordPerson && landlordPerson.person_email) {
    try {
      console.log(`[TDS Insured] Searching for landlord by email: ${landlordPerson.person_email}`)
      const searchResponse = await fetch(`${baseUrl}/${API_VERSION}/search/landlord`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenResult.accessToken}`,
          'User-Agent': USER_AGENT
        },
        body: JSON.stringify({
          member_id: Number(config.memberId),
          page: 1,
          query: landlordPerson.person_email,
          archived: false
        })
      })
      const searchText = await searchResponse.text()
      console.log(`[TDS Insured] Landlord search response (${searchResponse.status}):`, searchText.substring(0, 300))
      if (searchResponse.ok) {
        const searchData = JSON.parse(searchText)
        if (searchData.results && searchData.results.length > 0) {
          landlordPerson.person_id = String(searchData.results[0].person_id)
          console.log(`[TDS Insured] Found existing landlord with person_id: ${landlordPerson.person_id}`)
        } else {
          console.log('[TDS Insured] No existing landlord found, will create new')
        }
      }
    } catch (searchErr) {
      console.log('[TDS Insured] Landlord search failed (non-blocking):', searchErr)
    }
  }

  const payload: InsuredCreateDepositPayload = {
    member_id: config.memberId,
    branch_id: config.branchId,
    scheme_type: 'Insured',
    tenancy: tenancyPayload
  }

  try {
    console.log('[TDS Insured] Full payload being sent:', JSON.stringify(payload, null, 2))
    console.log('[TDS Insured] People count:', payload.tenancy?.people?.length || 0)
    console.log('[TDS Insured] API URL:', `${baseUrl}/${API_VERSION}/tenancy`)

    const response = await fetch(`${baseUrl}/${API_VERSION}/tenancy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenResult.accessToken}`,
        'User-Agent': USER_AGENT
      },
      body: JSON.stringify(payload)
    })

    const responseText = await response.text()
    if (!responseText) {
      return { success: false, error: 'Empty response from TDS API' }
    }

    let data: any
    try {
      data = JSON.parse(responseText)
    } catch {
      return { success: false, error: `Invalid response: ${responseText.substring(0, 100)}` }
    }

    if ((data.success === 'true' || data.success === true) && data.api_reference) {
      return { success: true, apiReference: data.api_reference }
    }

    // Handle errors
    if (data.errors && Array.isArray(data.errors)) {
      const errorMessages = data.errors.map((e: any) => e.error || e.message).join(', ')
      return { success: false, error: errorMessages }
    }

    return { success: false, error: data.error || 'Failed to create deposit with TDS Insured' }
  } catch (err) {
    console.error('TDS Insured createDeposit error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to connect to TDS API' }
  }
}

/**
 * Poll deposit status for TDS Insured
 */
export async function pollInsuredDepositStatus(
  companyId: string,
  apiReference: string,
  maxAttempts: number = 10,
  intervalMs: number = 3000
): Promise<{ success: boolean; dan?: string; status?: string; error?: string; rawResponse?: any }> {
  const config = await getCompanyTDSInsuredConfig(companyId)

  if (!config) {
    return { success: false, error: 'TDS Insured not configured for this company' }
  }

  const baseUrl = TDS_INSURED_ENDPOINTS[config.environment]

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Get valid access token (may need refresh during polling)
    const tokenResult = await getValidAccessToken(companyId, config)
    if (!tokenResult.success || !tokenResult.accessToken) {
      return { success: false, error: tokenResult.error || 'Failed to get valid access token' }
    }

    try {
      const response = await fetch(`${baseUrl}/${API_VERSION}/status/${apiReference}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenResult.accessToken}`,
          'User-Agent': USER_AGENT
        }
      })

      const responseText = await response.text()
      if (!responseText) {
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, intervalMs))
          continue
        }
        return { success: false, error: 'Empty response from TDS API' }
      }

      let data: any
      try {
        data = JSON.parse(responseText)
      } catch {
        return { success: false, error: `Invalid response: ${responseText.substring(0, 100)}` }
      }

      if (data.status === 'created' && data.dan) {
        return {
          success: true,
          dan: data.dan,
          status: 'created',
          rawResponse: data
        }
      }

      if (data.status === 'failed') {
        console.log('[TDS Insured] FULL STATUS RESPONSE:', JSON.stringify(data, null, 2))
        const errorMessage = data.errors?.map((e: any) => e.error).join(', ') || 'Registration failed'
        return {
          success: false,
          status: 'failed',
          error: errorMessage,
          rawResponse: data
        }
      }

      // Still pending
      if (data.status === 'pending') {
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, intervalMs))
          continue
        }
      }

      // Timeout
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
      console.error(`TDS Insured pollDepositStatus attempt ${attempt + 1} error:`, err)
      if (attempt === maxAttempts - 1) {
        return { success: false, error: err instanceof Error ? err.message : 'Failed to check deposit status' }
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }
  }

  return { success: false, error: 'Polling timeout reached' }
}

/**
 * Get certificate URL for TDS Insured deposit
 */
export async function getInsuredCertificateUrl(
  companyId: string,
  dan: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const config = await getCompanyTDSInsuredConfig(companyId)

  if (!config) {
    return { success: false, error: 'TDS Insured not configured for this company' }
  }

  const tokenResult = await getValidAccessToken(companyId, config)
  if (!tokenResult.success || !tokenResult.accessToken) {
    return { success: false, error: tokenResult.error || 'Failed to get valid access token' }
  }

  const baseUrl = TDS_INSURED_ENDPOINTS[config.environment]

  try {
    const response = await fetch(`${baseUrl}/${API_VERSION}/certificate/${dan}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenResult.accessToken}`,
        'User-Agent': USER_AGENT
      }
    })

    const responseText = await response.text()
    if (!responseText) {
      return { success: false, error: 'Empty response from TDS API' }
    }

    let data: any
    try {
      data = JSON.parse(responseText)
    } catch {
      return { success: false, error: `Invalid response: ${responseText.substring(0, 100)}` }
    }

    if ((data.success === 'true' || data.success === true) && data.certificate) {
      return { success: true, url: data.certificate }
    }

    return { success: false, error: data.error || 'Failed to get certificate' }
  } catch (err) {
    console.error('TDS Insured getCertificateUrl error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to get certificate' }
  }
}

/**
 * Download certificate PDF
 */
export async function downloadInsuredCertificate(
  companyId: string,
  dan: string
): Promise<{ success: boolean; buffer?: Buffer; contentType?: string; error?: string }> {
  const urlResult = await getInsuredCertificateUrl(companyId, dan)

  if (!urlResult.success || !urlResult.url) {
    return { success: false, error: urlResult.error || 'Failed to get certificate URL' }
  }

  try {
    const response = await fetch(urlResult.url)

    if (!response.ok) {
      return { success: false, error: 'Failed to download certificate' }
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type') || 'application/pdf'

    return { success: true, buffer, contentType }
  } catch (err) {
    console.error('TDS Insured downloadCertificate error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to download certificate' }
  }
}

/**
 * Save TDS Insured OAuth tokens
 */
export async function saveTDSInsuredTokens(
  companyId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number
): Promise<{ success: boolean; error?: string }> {
  const encryptedAccessToken = encrypt(accessToken)
  const encryptedRefreshToken = encrypt(refreshToken)
  const expiresAt = new Date(Date.now() + expiresIn * 1000)

  const { error } = await supabase
    .from('company_integrations')
    .update({
      tds_insured_access_token_encrypted: encryptedAccessToken,
      tds_insured_refresh_token_encrypted: encryptedRefreshToken,
      tds_insured_token_expires_at: expiresAt.toISOString(),
      tds_insured_connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('company_id', companyId)

  if (error) {
    console.error('Error saving TDS Insured tokens:', error)
    return { success: false, error: 'Failed to save tokens' }
  }

  return { success: true }
}

/**
 * Save TDS Insured configuration
 */
export async function saveTDSInsuredConfig(
  companyId: string,
  config: {
    clientId: string
    clientSecret: string
    memberId: string
    branchId: string
    environment: 'sandbox' | 'live'
  }
): Promise<{ success: boolean; error?: string }> {
  const encryptedSecret = encrypt(config.clientSecret)

  const { data: existing } = await supabase
    .from('company_integrations')
    .select('id')
    .eq('company_id', companyId)
    .single()

  const updateData = {
    tds_insured_client_id: config.clientId,
    tds_insured_client_secret_encrypted: encryptedSecret,
    tds_insured_member_id: config.memberId,
    tds_insured_branch_id: config.branchId,
    tds_insured_environment: config.environment,
    updated_at: new Date().toISOString()
  }

  if (existing) {
    const { error } = await supabase
      .from('company_integrations')
      .update(updateData)
      .eq('company_id', companyId)

    if (error) {
      console.error('Error updating TDS Insured config:', error)
      return { success: false, error: 'Failed to save configuration' }
    }
  } else {
    const { error } = await supabase
      .from('company_integrations')
      .insert({
        company_id: companyId,
        ...updateData
      })

    if (error) {
      console.error('Error inserting TDS Insured config:', error)
      return { success: false, error: 'Failed to save configuration' }
    }
  }

  return { success: true }
}

/**
 * Remove TDS Insured configuration
 */
export async function removeTDSInsuredConfig(companyId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('company_integrations')
    .update({
      tds_insured_client_id: null,
      tds_insured_client_secret_encrypted: null,
      tds_insured_access_token_encrypted: null,
      tds_insured_refresh_token_encrypted: null,
      tds_insured_token_expires_at: null,
      tds_insured_member_id: null,
      tds_insured_branch_id: null,
      tds_insured_environment: null,
      tds_insured_connected_at: null,
      tds_insured_last_tested_at: null,
      tds_insured_last_test_status: null,
      updated_at: new Date().toISOString()
    })
    .eq('company_id', companyId)

  if (error) {
    console.error('Error removing TDS Insured config:', error)
    return { success: false, error: 'Failed to remove configuration' }
  }

  return { success: true }
}

/**
 * Get authorization URL for OAuth flow
 */
export function getAuthorizationUrl(
  config: { clientId: string; environment: 'sandbox' | 'live' },
  redirectUri: string,
  state: string
): string {
  const baseUrl = TDS_INSURED_ENDPOINTS[config.environment]
  const scope = 'tenancy_management'

  return `${baseUrl}/${API_VERSION}/authorize?response_type=code&client_id=${encodeURIComponent(config.clientId)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}`
}

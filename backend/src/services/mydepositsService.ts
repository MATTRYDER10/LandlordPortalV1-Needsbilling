import { supabase } from '../config/supabase'
import { encrypt, decrypt } from './encryption'
import crypto from 'crypto'

// mydeposits API endpoints (Total Property API)
const MYDEPOSITS_API_ENDPOINTS = {
  sandbox: 'https://api.sandbox.totalproperty.co.uk/totalproperty',
  live: 'https://api.totalproperty.co.uk/totalproperty'
}

// OAuth endpoints - includes /totalpropertyauth base path
const MYDEPOSITS_AUTH_ENDPOINTS = {
  sandbox: 'https://authapi.sandbox.totalproperty.co.uk/totalpropertyauth',
  live: 'https://authapi.totalproperty.co.uk/totalpropertyauth'
}

const API_VERSION = 'v1'
const USER_AGENT = 'PropertyGoose/1.0'

// mydeposits config interface
interface MyDepositsConfig {
  clientId: string
  clientSecret: string
  accessToken: string
  refreshToken: string
  tokenExpiresAt: Date | null
  memberId: string
  branchId: string
  schemeType: 'custodial'
  environment: 'sandbox' | 'live'
}

// mydeposits person object
interface MyDepositsPersonObject {
  title: string
  firstName: string
  lastName: string
  email?: string
  mobile?: string
  dateOfBirth?: string
}

// mydeposits landlord object
interface MyDepositsLandlordObject extends MyDepositsPersonObject {
  addressLine1: string
  addressLine2?: string
  town: string
  county?: string
  postcode: string
  country?: string
}

// mydeposits tenant object
interface MyDepositsTenantObject extends MyDepositsPersonObject {
  isLeadTenant: boolean
}

// mydeposits deposit payload
interface MyDepositsDepositPayload {
  propertyAddressLine1: string
  propertyAddressLine2?: string
  propertyTown: string
  propertyCounty?: string
  propertyPostcode: string
  tenancyStartDate: string
  tenancyEndDate?: string
  depositAmount: number
  depositReceivedDate: string
  landlord: MyDepositsLandlordObject
  tenants: MyDepositsTenantObject[]
}

/**
 * Generate PKCE code verifier (43-128 characters)
 */
export function generateCodeVerifier(): string {
  // Generate 32 random bytes and encode as base64url (43 chars)
  return crypto.randomBytes(32)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Generate PKCE code challenge from verifier (SHA256)
 */
export function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash('sha256').update(verifier).digest()
  return hash.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Get mydeposits configuration for a company
 */
export async function getCompanyMyDepositsConfig(companyId: string): Promise<MyDepositsConfig | null> {
  const { data, error } = await supabase
    .from('company_integrations')
    .select(`
      mydeposits_client_id,
      mydeposits_client_secret_encrypted,
      mydeposits_access_token_encrypted,
      mydeposits_refresh_token_encrypted,
      mydeposits_token_expires_at,
      mydeposits_member_id,
      mydeposits_branch_id,
      mydeposits_scheme_type,
      mydeposits_environment
    `)
    .eq('company_id', companyId)
    .single()

  if (error || !data || !data.mydeposits_client_id) {
    return null
  }

  const clientSecret = data.mydeposits_client_secret_encrypted ? decrypt(data.mydeposits_client_secret_encrypted) : ''
  const accessToken = data.mydeposits_access_token_encrypted ? decrypt(data.mydeposits_access_token_encrypted) : ''
  const refreshToken = data.mydeposits_refresh_token_encrypted ? decrypt(data.mydeposits_refresh_token_encrypted) : ''

  return {
    clientId: data.mydeposits_client_id,
    clientSecret: clientSecret || '',
    accessToken: accessToken || '',
    refreshToken: refreshToken || '',
    tokenExpiresAt: data.mydeposits_token_expires_at ? new Date(data.mydeposits_token_expires_at) : null,
    memberId: data.mydeposits_member_id || '',
    branchId: data.mydeposits_branch_id || '',
    schemeType: (data.mydeposits_scheme_type as 'custodial') || 'custodial',
    environment: (data.mydeposits_environment as 'sandbox' | 'live') || 'sandbox'
  }
}

/**
 * Get OAuth authorization URL with PKCE
 */
export function getAuthorizationUrl(
  config: { clientId: string; environment: 'sandbox' | 'live' },
  redirectUri: string,
  codeChallenge: string,
  state: string
): string {
  const authUrl = MYDEPOSITS_AUTH_ENDPOINTS[config.environment]
  return `${authUrl}/connect/authorize?` +
    `client_id=${encodeURIComponent(config.clientId)}&` +
    `code_challenge=${encodeURIComponent(codeChallenge)}&` +
    `code_challenge_method=S256&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code`
}

/**
 * Exchange authorization code for tokens (with PKCE)
 */
export async function exchangeCodeForTokens(
  config: { clientId: string; clientSecret: string; environment: 'sandbox' | 'live' },
  authorizationCode: string,
  codeVerifier: string,
  redirectUri: string
): Promise<{ success: boolean; accessToken?: string; refreshToken?: string; expiresIn?: number; memberId?: string; branchId?: string; error?: string }> {
  const authUrl = MYDEPOSITS_AUTH_ENDPOINTS[config.environment]

  try {
    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: authorizationCode,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    })

    const response = await fetch(`${authUrl}/connect/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
        'User-Agent': USER_AGENT
      },
      body: body.toString()
    })

    const responseText = await response.text()
    if (!responseText) {
      return { success: false, error: 'Empty response from mydeposits API' }
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
        expiresIn: data.expires_in || 3600,
        memberId: data.member_id,
        branchId: data.branch_id
      }
    }

    return { success: false, error: data.error_description || data.error || 'Failed to get token' }
  } catch (err) {
    console.error('mydeposits token exchange error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to exchange code for token' }
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  companyId: string,
  config: MyDepositsConfig
): Promise<{ success: boolean; accessToken?: string; error?: string }> {
  const authUrl = MYDEPOSITS_AUTH_ENDPOINTS[config.environment]

  try {
    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: config.refreshToken
    })

    const response = await fetch(`${authUrl}/connect/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
        'User-Agent': USER_AGENT
      },
      body: body.toString()
    })

    const responseText = await response.text()
    if (!responseText) {
      return { success: false, error: 'Empty response from mydeposits API' }
    }

    let data: any
    try {
      data = JSON.parse(responseText)
    } catch {
      return { success: false, error: `Invalid response: ${responseText.substring(0, 100)}` }
    }

    if (data.access_token) {
      const newAccessToken = data.access_token
      const expiresIn = data.expires_in || 3600

      // Save new access token
      const encryptedToken = encrypt(newAccessToken)
      const expiresAt = new Date(Date.now() + expiresIn * 1000)

      // Also save new refresh token if provided
      const updateData: any = {
        mydeposits_access_token_encrypted: encryptedToken,
        mydeposits_token_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString()
      }

      if (data.refresh_token) {
        updateData.mydeposits_refresh_token_encrypted = encrypt(data.refresh_token)
      }

      await supabase
        .from('company_integrations')
        .update(updateData)
        .eq('company_id', companyId)

      return { success: true, accessToken: newAccessToken }
    }

    return { success: false, error: data.error_description || data.error || 'Failed to refresh token' }
  } catch (err) {
    console.error('mydeposits token refresh error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to refresh token' }
  }
}

/**
 * Get valid access token, refreshing if needed
 */
export async function getValidAccessToken(
  companyId: string,
  config: MyDepositsConfig
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
 * Test mydeposits API connection
 */
export async function testConnection(
  companyId: string,
  config: MyDepositsConfig
): Promise<{ success: boolean; message: string }> {
  const baseUrl = MYDEPOSITS_API_ENDPOINTS[config.environment]

  // Get valid access token
  const tokenResult = await getValidAccessToken(companyId, config)
  if (!tokenResult.success || !tokenResult.accessToken) {
    return { success: false, message: tokenResult.error || 'Failed to get valid access token' }
  }

  try {
    // Use member info endpoint to test connection
    const response = await fetch(`${baseUrl}/${API_VERSION}/member`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenResult.accessToken}`,
        'User-Agent': USER_AGENT
      }
    })

    if (response.ok) {
      return { success: true, message: 'Connection successful' }
    }

    if (response.status === 401) {
      return { success: false, message: 'Authorization failed. Please re-authorize.' }
    }

    return { success: false, message: `Connection test failed (status ${response.status})` }
  } catch (err) {
    console.error('mydeposits connection test error:', err)
    return { success: false, message: err instanceof Error ? err.message : 'Failed to connect to mydeposits API' }
  }
}

/**
 * Format date to mydeposits format (YYYY-MM-DD)
 */
function formatDateForMyDeposits(date: string | Date): string {
  if (!date) {
    console.warn('[mydeposits] formatDateForMyDeposits called with empty date')
    return ''
  }

  // If already in YYYY-MM-DD format, return as-is
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date
  }

  // If in DD/MM/YYYY format, convert
  if (typeof date === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
    const [day, month, year] = date.split('/')
    return `${year}-${month}-${day}`
  }

  // Otherwise use Date parsing
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) {
    console.warn('[mydeposits] formatDateForMyDeposits: Invalid date:', date)
    return ''
  }
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Map tenancy data to mydeposits API payload format
 */
export function mapTenancyToMyDepositsPayload(
  tenancy: any,
  depositReceivedDate: string
): MyDepositsDepositPayload {
  const property = tenancy.property || {}
  const tenants = tenancy.tenants || []
  const landlords = tenancy.landlords || []

  // Get primary landlord
  const primaryLandlord = landlords.find((l: any) => l.is_primary) || landlords[0]

  // Build landlord object
  const landlordData: MyDepositsLandlordObject = {
    title: primaryLandlord?.title || 'Mr',
    firstName: decrypt(primaryLandlord?.first_name_encrypted) || primaryLandlord?.first_name || '',
    lastName: decrypt(primaryLandlord?.last_name_encrypted) || primaryLandlord?.last_name || '',
    email: decrypt(primaryLandlord?.email_encrypted) || primaryLandlord?.email || '',
    mobile: decrypt(primaryLandlord?.phone_encrypted) || primaryLandlord?.phone || '',
    addressLine1: decrypt(primaryLandlord?.address_line1_encrypted) || primaryLandlord?.address_line1 || '',
    town: decrypt(primaryLandlord?.city_encrypted) || primaryLandlord?.city || 'N/A',
    county: primaryLandlord?.county || '',
    postcode: decrypt(primaryLandlord?.postcode_encrypted) || primaryLandlord?.postcode || '',
    country: 'United Kingdom'
  }

  // Build tenants array
  const leadTenant = tenants.find((t: any) => t.is_lead) || tenants[0]

  const tenantData: MyDepositsTenantObject[] = tenants.map((tenant: any, index: number) => {
    const isLead = tenant.is_lead || (tenant.id && tenant.id === leadTenant?.id) || index === 0
    return {
      title: tenant.title || 'Mr',
      firstName: decrypt(tenant.first_name_encrypted) || tenant.first_name || '',
      lastName: decrypt(tenant.last_name_encrypted) || tenant.last_name || '',
      email: decrypt(tenant.email_encrypted) || tenant.email || '',
      mobile: decrypt(tenant.phone_encrypted) || tenant.phone || '',
      isLeadTenant: isLead
    }
  })

  // Build payload
  const payload: MyDepositsDepositPayload = {
    propertyAddressLine1: property.address_line1 || '',
    propertyAddressLine2: property.address_line2 || '',
    propertyTown: property.city || 'N/A',
    propertyCounty: property.county || '',
    propertyPostcode: property.postcode || '',
    tenancyStartDate: formatDateForMyDeposits(tenancy.tenancy_start_date || tenancy.start_date),
    depositAmount: Number(tenancy.deposit_amount),
    depositReceivedDate: formatDateForMyDeposits(depositReceivedDate),
    landlord: landlordData,
    tenants: tenantData
  }

  // Add end date if available
  if (tenancy.end_date || tenancy.tenancy_end_date) {
    payload.tenancyEndDate = formatDateForMyDeposits(tenancy.end_date || tenancy.tenancy_end_date)
  }

  return payload
}

/**
 * Register a deposit with mydeposits
 */
export async function registerDeposit(
  companyId: string,
  tenancy: any,
  depositReceivedDate: string
): Promise<{ success: boolean; depositId?: string; error?: string }> {
  const config = await getCompanyMyDepositsConfig(companyId)

  if (!config) {
    return { success: false, error: 'mydeposits not configured for this company' }
  }

  // Get valid access token
  const tokenResult = await getValidAccessToken(companyId, config)
  if (!tokenResult.success || !tokenResult.accessToken) {
    return { success: false, error: tokenResult.error || 'Failed to get valid access token' }
  }

  const baseUrl = MYDEPOSITS_API_ENDPOINTS[config.environment]
  const schemeEndpoint = 'custodial'
  const payload = mapTenancyToMyDepositsPayload(tenancy, depositReceivedDate)

  try {
    const response = await fetch(`${baseUrl}/${API_VERSION}/${schemeEndpoint}/deposit`, {
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
      return { success: false, error: 'Empty response from mydeposits API' }
    }

    let data: any
    try {
      data = JSON.parse(responseText)
    } catch {
      return { success: false, error: `Invalid response: ${responseText.substring(0, 100)}` }
    }

    // Handle success response
    if (response.ok && (data.depositId || data.deposit_id || data.id)) {
      return {
        success: true,
        depositId: data.depositId || data.deposit_id || data.id
      }
    }

    // Handle errors
    if (data.errors && Array.isArray(data.errors)) {
      const errorMessages = data.errors.map((e: any) => e.message || e.error).join(', ')
      return { success: false, error: errorMessages }
    }

    return { success: false, error: data.error || data.message || 'Failed to register deposit with mydeposits' }
  } catch (err) {
    console.error('mydeposits registerDeposit error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to connect to mydeposits API' }
  }
}

/**
 * Get deposit status from mydeposits
 */
export async function getDepositStatus(
  companyId: string,
  depositId: string
): Promise<{ success: boolean; status?: string; certificateUrl?: string; error?: string; rawResponse?: any }> {
  const config = await getCompanyMyDepositsConfig(companyId)

  if (!config) {
    return { success: false, error: 'mydeposits not configured for this company' }
  }

  const tokenResult = await getValidAccessToken(companyId, config)
  if (!tokenResult.success || !tokenResult.accessToken) {
    return { success: false, error: tokenResult.error || 'Failed to get valid access token' }
  }

  const baseUrl = MYDEPOSITS_API_ENDPOINTS[config.environment]
  const schemeEndpoint = 'custodial'

  try {
    const response = await fetch(`${baseUrl}/${API_VERSION}/${schemeEndpoint}/deposit/${depositId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenResult.accessToken}`,
        'User-Agent': USER_AGENT
      }
    })

    const responseText = await response.text()
    if (!responseText) {
      return { success: false, error: 'Empty response from mydeposits API' }
    }

    let data: any
    try {
      data = JSON.parse(responseText)
    } catch {
      return { success: false, error: `Invalid response: ${responseText.substring(0, 100)}` }
    }

    if (response.ok) {
      return {
        success: true,
        status: data.status,
        certificateUrl: data.certificateUrl || data.certificate_url,
        rawResponse: data
      }
    }

    return { success: false, error: data.error || 'Failed to get deposit status', rawResponse: data }
  } catch (err) {
    console.error('mydeposits getDepositStatus error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to check deposit status' }
  }
}

/**
 * Poll deposit status until complete or timeout
 */
export async function pollDepositStatus(
  companyId: string,
  depositId: string,
  maxAttempts: number = 10,
  intervalMs: number = 3000
): Promise<{ success: boolean; status?: string; certificateUrl?: string; error?: string; rawResponse?: any }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await getDepositStatus(companyId, depositId)

    if (result.success) {
      // Check for completed status
      if (result.status === 'registered' || result.status === 'active' || result.status === 'protected') {
        return result
      }

      // Check for failed status
      if (result.status === 'failed' || result.status === 'rejected') {
        return { success: false, status: 'failed', error: 'Registration failed', rawResponse: result.rawResponse }
      }

      // Still pending, continue polling
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, intervalMs))
        continue
      }
    } else {
      // API error
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, intervalMs))
        continue
      }
      return result
    }
  }

  return {
    success: false,
    status: 'timeout',
    error: 'mydeposits taking longer than expected. Check mydeposits portal for status.'
  }
}

/**
 * Download certificate from mydeposits
 */
export async function downloadCertificate(
  companyId: string,
  depositId: string
): Promise<{ success: boolean; buffer?: Buffer; contentType?: string; error?: string }> {
  const config = await getCompanyMyDepositsConfig(companyId)

  if (!config) {
    return { success: false, error: 'mydeposits not configured for this company' }
  }

  const tokenResult = await getValidAccessToken(companyId, config)
  if (!tokenResult.success || !tokenResult.accessToken) {
    return { success: false, error: tokenResult.error || 'Failed to get valid access token' }
  }

  const baseUrl = MYDEPOSITS_API_ENDPOINTS[config.environment]
  const schemeEndpoint = 'custodial'

  try {
    const response = await fetch(`${baseUrl}/${API_VERSION}/${schemeEndpoint}/deposit/${depositId}/certificate`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenResult.accessToken}`,
        'User-Agent': USER_AGENT
      }
    })

    if (!response.ok) {
      return { success: false, error: 'Failed to download certificate' }
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type') || 'application/pdf'

    return { success: true, buffer, contentType }
  } catch (err) {
    console.error('mydeposits downloadCertificate error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to download certificate' }
  }
}

/**
 * Save mydeposits OAuth tokens
 */
export async function saveMyDepositsTokens(
  companyId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
  memberId?: string,
  branchId?: string
): Promise<{ success: boolean; error?: string }> {
  const encryptedAccessToken = encrypt(accessToken)
  const encryptedRefreshToken = encrypt(refreshToken)
  const expiresAt = new Date(Date.now() + expiresIn * 1000)

  const updateData: any = {
    mydeposits_access_token_encrypted: encryptedAccessToken,
    mydeposits_refresh_token_encrypted: encryptedRefreshToken,
    mydeposits_token_expires_at: expiresAt.toISOString(),
    mydeposits_connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  if (memberId) {
    updateData.mydeposits_member_id = memberId
  }
  if (branchId) {
    updateData.mydeposits_branch_id = branchId
  }

  const { error } = await supabase
    .from('company_integrations')
    .update(updateData)
    .eq('company_id', companyId)

  if (error) {
    console.error('Error saving mydeposits tokens:', error)
    return { success: false, error: 'Failed to save tokens' }
  }

  return { success: true }
}

/**
 * Save mydeposits configuration (before OAuth)
 */
export async function saveMyDepositsConfig(
  companyId: string,
  config: {
    clientId: string
    clientSecret: string
    schemeType: 'custodial'
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
    mydeposits_client_id: config.clientId,
    mydeposits_client_secret_encrypted: encryptedSecret,
    mydeposits_scheme_type: config.schemeType,
    mydeposits_environment: config.environment,
    updated_at: new Date().toISOString()
  }

  if (existing) {
    const { error } = await supabase
      .from('company_integrations')
      .update(updateData)
      .eq('company_id', companyId)

    if (error) {
      console.error('Error updating mydeposits config:', error)
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
      console.error('Error inserting mydeposits config:', error)
      return { success: false, error: 'Failed to save configuration' }
    }
  }

  return { success: true }
}

/**
 * Remove mydeposits configuration
 */
export async function removeMyDepositsConfig(companyId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('company_integrations')
    .update({
      mydeposits_client_id: null,
      mydeposits_client_secret_encrypted: null,
      mydeposits_access_token_encrypted: null,
      mydeposits_refresh_token_encrypted: null,
      mydeposits_token_expires_at: null,
      mydeposits_member_id: null,
      mydeposits_branch_id: null,
      mydeposits_scheme_type: null,
      mydeposits_environment: null,
      mydeposits_connected_at: null,
      mydeposits_last_tested_at: null,
      mydeposits_last_test_status: null,
      updated_at: new Date().toISOString()
    })
    .eq('company_id', companyId)

  if (error) {
    console.error('Error removing mydeposits config:', error)
    return { success: false, error: 'Failed to remove configuration' }
  }

  return { success: true }
}

/**
 * Update test status
 */
export async function updateMyDepositsTestStatus(
  companyId: string,
  status: 'success' | 'failed'
): Promise<void> {
  await supabase
    .from('company_integrations')
    .update({
      mydeposits_last_tested_at: new Date().toISOString(),
      mydeposits_last_test_status: status,
      updated_at: new Date().toISOString()
    })
    .eq('company_id', companyId)
}

/**
 * Get registration for a tenancy
 */
export async function getMyDepositsRegistration(tenancyId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('mydeposits_registrations')
    .select('*')
    .eq('tenancy_id', tenancyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching mydeposits registration:', error)
  }

  return data || null
}

/**
 * Save pending registration
 */
export async function savePendingMyDepositsRegistration(
  tenancyId: string,
  companyId: string,
  userId: string,
  depositAmount: number,
  schemeType: 'custodial'
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('mydeposits_registrations')
    .insert({
      tenancy_id: tenancyId,
      company_id: companyId,
      registered_by: userId,
      deposit_amount: depositAmount,
      scheme_type: schemeType,
      status: 'pending'
    })

  if (error) {
    console.error('Error saving pending mydeposits registration:', error)
    return { success: false, error: 'Failed to save registration' }
  }

  return { success: true }
}

/**
 * Update registration with deposit ID
 */
export async function updateMyDepositsRegistration(
  tenancyId: string,
  depositId: string,
  certificateUrl?: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('mydeposits_registrations')
    .update({
      deposit_id: depositId,
      certificate_url: certificateUrl,
      status: 'registered',
      registered_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('tenancy_id', tenancyId)
    .eq('status', 'pending')

  if (error) {
    console.error('Error updating mydeposits registration:', error)
    return { success: false, error: 'Failed to update registration' }
  }

  return { success: true }
}

/**
 * Mark registration as failed
 */
export async function markMyDepositsRegistrationFailed(
  tenancyId: string,
  errorMessage: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('mydeposits_registrations')
    .update({
      status: 'failed',
      error_message: errorMessage,
      updated_at: new Date().toISOString()
    })
    .eq('tenancy_id', tenancyId)
    .eq('status', 'pending')

  if (error) {
    console.error('Error marking mydeposits registration as failed:', error)
    return { success: false, error: 'Failed to update registration' }
  }

  return { success: true }
}

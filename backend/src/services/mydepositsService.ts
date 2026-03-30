import { supabase } from '../config/supabase'
import { encrypt, decrypt } from './encryption'
import crypto from 'crypto'

// mydeposits API endpoints
const MYDEPOSITS_API_ENDPOINTS = {
  sandbox: 'https://gtw.sandbox.totalproperty.co.uk/rs/api',
  live: 'https://api.totalproperty.co.uk/totalproperty'
}

// OAuth endpoints
const MYDEPOSITS_AUTH_ENDPOINTS = {
  sandbox: 'https://authapi.sandbox.totalproperty.co.uk/totalpropertyauth',
  live: 'https://authapi.totalproperty.co.uk/totalpropertyauth'
}

const API_VERSION = 'v1'
const DEPOSITS_PATH = '' // gateway /totalproperty already includes the base
const USER_AGENT = 'PropertyGoose/1.0'

// Platform-level mydeposits OAuth credentials (same for all agents)
const MYDEPOSITS_CLIENT_ID = process.env.MYDEPOSITS_CLIENT_ID || 'XBqHwL8hnP9qdK9cDGcs'
const MYDEPOSITS_CLIENT_SECRET = process.env.MYDEPOSITS_CLIENT_SECRET || '36Zd0jsf/E7/By5nqIitE1Q7/MMvyfr27FaoIRKGEzg='

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

  if (error || !data) {
    return null
  }

  // Check if we have tokens (authorized) — client credentials come from platform
  const hasTokens = !!data.mydeposits_access_token_encrypted
  if (!hasTokens && !data.mydeposits_client_id) {
    return null
  }

  const accessToken = data.mydeposits_access_token_encrypted ? decrypt(data.mydeposits_access_token_encrypted) : ''
  const refreshToken = data.mydeposits_refresh_token_encrypted ? decrypt(data.mydeposits_refresh_token_encrypted) : ''

  return {
    clientId: MYDEPOSITS_CLIENT_ID,
    clientSecret: MYDEPOSITS_CLIENT_SECRET,
    accessToken: accessToken || '',
    refreshToken: refreshToken || '',
    tokenExpiresAt: data.mydeposits_token_expires_at ? new Date(data.mydeposits_token_expires_at) : null,
    memberId: data.mydeposits_member_id || '',
    branchId: data.mydeposits_branch_id || '',
    schemeType: (data.mydeposits_scheme_type as 'custodial') || 'custodial',
    environment: 'live' as const
  }
}

/**
 * Get OAuth authorization URL with PKCE
 */
export function getAuthorizationUrl(
  config: { clientId?: string; environment?: 'sandbox' | 'live' },
  redirectUri: string,
  codeChallenge: string,
  state: string
): string {
  const authUrl = MYDEPOSITS_AUTH_ENDPOINTS['live']
  return `${authUrl}/connect/authorize?` +
    `client_id=${encodeURIComponent(MYDEPOSITS_CLIENT_ID)}&` +
    `code_challenge=${encodeURIComponent(codeChallenge)}&` +
    `code_challenge_method=S256&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code`
}

/**
 * Exchange authorization code for tokens (with PKCE)
 */
export async function exchangeCodeForTokens(
  config: { clientId?: string; clientSecret?: string; environment?: 'sandbox' | 'live' },
  authorizationCode: string,
  codeVerifier: string,
  redirectUri: string
): Promise<{ success: boolean; accessToken?: string; refreshToken?: string; expiresIn?: number; memberId?: string; branchId?: string; error?: string }> {
  const authUrl = MYDEPOSITS_AUTH_ENDPOINTS['live']

  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: authorizationCode,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
      client_id: MYDEPOSITS_CLIENT_ID,
      client_secret: MYDEPOSITS_CLIENT_SECRET
    })

    console.log(`[mydeposits] Token exchange POST ${authUrl}/connect/token`)

    const response = await fetch(`${authUrl}/connect/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
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
  const authUrl = MYDEPOSITS_AUTH_ENDPOINTS['live']

  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: config.refreshToken,
      client_id: MYDEPOSITS_CLIENT_ID,
      client_secret: MYDEPOSITS_CLIENT_SECRET
    })

    console.log(`[mydeposits] Token refresh POST ${authUrl}/connect/token`)

    const response = await fetch(`${authUrl}/connect/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
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
    const expiresAt = new Date(config.tokenExpiresAt).getTime()
    const now = Date.now()
    if (expiresAt > now + bufferMs) {
      console.log(`[mydeposits] Token still valid (expires in ${Math.round((expiresAt - now) / 1000)}s)`)
      return { success: true, accessToken: config.accessToken }
    }
    console.log(`[mydeposits] Token expired or expiring soon (expires at ${config.tokenExpiresAt})`)
  } else {
    console.log(`[mydeposits] No token or no expiry — has token: ${!!config.accessToken}, has expiry: ${!!config.tokenExpiresAt}`)
  }

  // Token expired or expiring soon, refresh it
  if (config.refreshToken) {
    console.log('[mydeposits] Attempting token refresh...')
    const result = await refreshAccessToken(companyId, config)
    console.log(`[mydeposits] Token refresh result: success=${result.success}, error=${result.error || 'none'}`)
    return result
  }

  console.log('[mydeposits] No refresh token available')
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
    const testUrl = `${baseUrl}/${API_VERSION}/properties?take=1&pageSize=1`
    console.log(`[mydeposits] Test: GET ${testUrl}`)
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenResult.accessToken}`,
        'User-Agent': USER_AGENT
      }
    })

    console.log(`[mydeposits] Test connection response: ${response.status} from ${testUrl}`)

    if (response.ok) {
      return { success: true, message: 'Connection successful' }
    }

    if (response.status === 401) {
      return { success: false, message: 'Authorization failed. Please re-authorize.' }
    }

    const errorText = await response.text()
    console.error(`[mydeposits] Test connection failed: ${response.status}`, errorText.substring(0, 200))
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
 * Helper: make authenticated API call to mydeposits
 */
async function mydepositsApiFetch(
  baseUrl: string,
  accessToken: string,
  method: string,
  path: string,
  body?: any
): Promise<{ ok: boolean; status: number; data: any }> {
  const url = `${baseUrl}/${API_VERSION}${path}`
  console.log(`[mydeposits] ${method} ${url}`)
  if (body) console.log(`[mydeposits] Body:`, JSON.stringify(body).substring(0, 500))

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': USER_AGENT
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  })

  const text = await response.text()
  console.log(`[mydeposits] Response ${response.status}:`, text.substring(0, 300))

  let data: any
  try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }
  return { ok: response.ok, status: response.status, data }
}

/**
 * Register a deposit with mydeposits
 * Full flow: 1) Create property  2) Create tenancy with tenants  3) Create deposit
 */
export async function registerDeposit(
  companyId: string,
  tenancy: any,
  depositReceivedDate: string
): Promise<{ success: boolean; depositId?: string; paymentReference?: string | null; error?: string }> {
  const config = await getCompanyMyDepositsConfig(companyId)
  if (!config) {
    return { success: false, error: 'mydeposits not configured for this company' }
  }

  const tokenResult = await getValidAccessToken(companyId, config)
  if (!tokenResult.success || !tokenResult.accessToken) {
    return { success: false, error: tokenResult.error || 'Failed to get valid access token' }
  }

  const baseUrl = MYDEPOSITS_API_ENDPOINTS[config.environment]
  const token = tokenResult.accessToken
  const mapped = mapTenancyToMyDepositsPayload(tenancy, depositReceivedDate)

  try {
    // ── Step 1: Create property in mydeposits ──
    console.log('[mydeposits] Step 1: Creating property...')
    const landlord = mapped.landlord

    // Get office ID — stored as branchId in config, or discovered from existing properties
    let officeId: number | null = null

    // Use stored branchId (set during MyDeposits setup)
    if (config.branchId) {
      officeId = parseInt(config.branchId)
      if (isNaN(officeId)) officeId = null
    }

    // Fallback: try to get from an existing property
    if (!officeId) {
      const propsResult = await mydepositsApiFetch(baseUrl, token, 'GET', '/properties?take=1&pageSize=1')
      if (propsResult.ok && propsResult.data?.data?.length > 0) {
        const propId = propsResult.data.data[0].propertyId || propsResult.data.data[0].id
        if (propId) {
          const detailResult = await mydepositsApiFetch(baseUrl, token, 'GET', `/properties/${propId}`)
          if (detailResult.ok && detailResult.data?.agencyOfficeId) {
            officeId = detailResult.data.agencyOfficeId
          }
        }
      }
    }

    if (!officeId) {
      return { success: false, error: 'MyDeposits Office ID not configured. Please set it in Settings > mydeposits.' }
    }

    console.log(`[mydeposits] Using officeId: ${officeId}`)

    // Search for existing property first
    let propertyId: number | null = null
    const searchResult = await mydepositsApiFetch(baseUrl, token, 'POST', '/look-up/properties/search', {
      searchText: mapped.propertyPostcode
    })
    if (searchResult.ok && Array.isArray(searchResult.data) && searchResult.data.length > 0) {
      // Try to match by address
      const addrLower = mapped.propertyAddressLine1.toLowerCase()
      const match = searchResult.data.find((p: any) =>
        (p.text || p.address || '').toLowerCase().includes(addrLower)
      ) || searchResult.data[0]
      propertyId = match.id
      console.log(`[mydeposits] Found existing property: ${propertyId} (${match.text || match.address})`)
    }

    // Create property if not found
    if (!propertyId) {
      console.log('[mydeposits] No existing property found, creating...')
      const propertyPayload: any = {
        name: `${mapped.propertyAddressLine1}, ${mapped.propertyPostcode}`,
        officeId: officeId || undefined,
        address: {
          addressLine1: mapped.propertyAddressLine1,
          addressLine2: mapped.propertyAddressLine2 || undefined,
          city: mapped.propertyTown,
          postcode: mapped.propertyPostcode,
          country: { id: 225 },
          region: { id: 1 },
          isAddressSetManually: true
        },
        landlord: {
          email: landlord.email,
          firstName: landlord.firstName,
          lastName: landlord.lastName,
          phone: landlord.mobile || '+440000000000'
        }
      }

      const propResult = await mydepositsApiFetch(baseUrl, token, 'POST', '/properties/manage-by-agency', propertyPayload)
      if (!propResult.ok) {
        const errors = propResult.data?.errors || []
        const errMsg = JSON.stringify(errors)
        // If it failed because property already exists, search again
        const isAlreadyExists = errors.some((e: any) =>
          e.code === 'PropertyIsNotUniqueForAgent' || e.code === 'PropertyAlreadyExistsInYourAccount'
        )
        if (isAlreadyExists) {
          // Re-search — it exists but didn't match our first search
          const retry = await mydepositsApiFetch(baseUrl, token, 'POST', '/look-up/properties/search', {
            searchText: mapped.propertyAddressLine1
          })
          if (retry.ok && Array.isArray(retry.data) && retry.data.length > 0) {
            propertyId = retry.data[0].id
            console.log(`[mydeposits] Found property on retry: ${propertyId}`)
          }
        }
        if (!propertyId) {
          return { success: false, error: `Failed to create property in mydeposits: ${errMsg.substring(0, 200)}` }
        }
      } else {
        propertyId = propResult.data.propertyId
        console.log(`[mydeposits] Property created: ${propertyId}`)
      }
    }

    // ── Step 2: Create tenancy with tenants ──
    console.log('[mydeposits] Step 2: Creating tenancy...')
    const tenants = mapped.tenants.map((t: any) => ({
      email: t.email,
      firstName: t.firstName,
      lastName: t.lastName,
      phoneNumber: t.mobile || '+440000000000',
      isLeadTenant: t.isLeadTenant || false
    }))

    // Ensure at least one lead tenant
    if (!tenants.some((t: any) => t.isLeadTenant) && tenants.length > 0) {
      tenants[0].isLeadTenant = true
    }

    const depositAmount = Math.round(Number(mapped.depositAmount) || 0)
    const monthlyRent = Math.round(Number(tenancy.rent_amount) || depositAmount / 5 * 4.33)
    const tenancyPayload = {
      propertyId,
      tenancyDetails: {
        rent: monthlyRent,
        rentFrequency: { id: 1, text: 'Monthly' },
        depositAmount,
        isDepositAmountSetManually: true,
        startDate: mapped.tenancyStartDate,
        endDate: mapped.tenancyEndDate || undefined,
        tenancyName: `${mapped.propertyAddressLine1} ${Date.now()}`
      },
      tenants
    }

    const tenancyResult = await mydepositsApiFetch(baseUrl, token, 'POST', '/tenancies', tenancyPayload)
    if (!tenancyResult.ok) {
      const errMsg = JSON.stringify(tenancyResult.data?.errors || tenancyResult.data)
      return { success: false, error: `Failed to create tenancy in mydeposits: ${errMsg.substring(0, 200)}` }
    }

    const mdTenancyId = tenancyResult.data.tenancyId
    console.log(`[mydeposits] Tenancy created: ${mdTenancyId}`)

    // ── Step 3: Get available schemes and create deposit ──
    console.log('[mydeposits] Step 3: Getting schemes and creating deposit...')
    const schemesResult = await mydepositsApiFetch(baseUrl, token, 'GET', `/tenancies/${mdTenancyId}/available-deposit-schemes`)

    let schemeId: number | null = null
    if (schemesResult.ok && schemesResult.data?.schemes?.length > 0) {
      // Prefer custodial scheme
      const custodialScheme = schemesResult.data.schemes.find(
        (s: any) => s.schemeType?.text?.toLowerCase().includes('custodial')
      )
      schemeId = custodialScheme?.id || schemesResult.data.schemes[0].id
      console.log(`[mydeposits] Using scheme: ${schemeId} (${custodialScheme?.name || schemesResult.data.schemes[0].name})`)
    }

    if (!schemeId) {
      return { success: false, error: 'No available deposit schemes found for this tenancy in mydeposits' }
    }

    const depositPayload = {
      tenancyId: mdTenancyId,
      schemeId,
      tenantPaidDepositDate: new Date(mapped.depositReceivedDate).toISOString()
    }

    const depositResult = await mydepositsApiFetch(baseUrl, token, 'POST', '/deposits', depositPayload)
    if (!depositResult.ok) {
      const errMsg = JSON.stringify(depositResult.data?.errors || depositResult.data)
      return { success: false, error: `Failed to create deposit in mydeposits: ${errMsg.substring(0, 200)}` }
    }

    const depositId = String(depositResult.data.depositId)
    console.log(`[mydeposits] Deposit created: ${depositId}`)

    // ── Step 4: Initiate bank transfer payment ──
    console.log('[mydeposits] Step 4: Initiating bank transfer payment...')
    const paymentPayload = {
      paymentMethodTypeId: 2, // Bank transfer
      amount: depositAmount
    }

    const paymentResult = await mydepositsApiFetch(baseUrl, token, 'POST', `/deposits/${depositId}/payments`, paymentPayload)
    let paymentReference: string | null = null

    if (paymentResult.ok) {
      paymentReference = paymentResult.data.paymentReference || null
      const paymentId = paymentResult.data.paymentId
      console.log(`[mydeposits] Payment initiated: id=${paymentId}, ref=${paymentReference}`)

      // Get full payment details for the bank transfer reference
      if (paymentId) {
        const paymentDetails = await mydepositsApiFetch(baseUrl, token, 'GET', `/payments/${paymentId}`)
        if (paymentDetails.ok) {
          paymentReference = paymentDetails.data.paymentReference || paymentReference
          console.log(`[mydeposits] Payment details:`, JSON.stringify(paymentDetails.data).substring(0, 300))
        }
      }
    } else {
      console.log(`[mydeposits] Payment initiation failed (non-blocking): ${JSON.stringify(paymentResult.data).substring(0, 200)}`)
    }

    return { success: true, depositId, paymentReference }
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

  try {
    const response = await fetch(`${baseUrl}/${API_VERSION}/deposits/${depositId}`, {
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

  try {
    // API returns JSON with downloadUrl, not the PDF directly
    const response = await fetch(`${baseUrl}/${API_VERSION}/deposits/${depositId}/certificate`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenResult.accessToken}`,
        'User-Agent': USER_AGENT
      }
    })

    if (!response.ok) {
      console.error(`[mydeposits] Certificate API error: ${response.status}`)
      return { success: false, error: 'Failed to get certificate from mydeposits' }
    }

    const data: any = await response.json()
    console.log('[mydeposits] Certificate response:', JSON.stringify(data).substring(0, 300))

    // Response has downloadUrl — fetch the actual PDF from that URL
    if (data.downloadUrl) {
      const pdfResponse = await fetch(data.downloadUrl)
      if (!pdfResponse.ok) {
        return { success: false, error: 'Failed to download certificate PDF' }
      }
      const buffer = Buffer.from(await pdfResponse.arrayBuffer())
      return { success: true, buffer, contentType: 'application/pdf' }
    }

    // If not generated yet
    if (data.isGenerated === false) {
      return { success: false, error: 'Certificate not yet generated. Please try again later.' }
    }

    return { success: false, error: 'No download URL in certificate response' }
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
    clientId?: string
    clientSecret?: string
    schemeType?: 'custodial'
    environment?: 'sandbox' | 'live'
  }
): Promise<{ success: boolean; error?: string }> {
  const { data: existing } = await supabase
    .from('company_integrations')
    .select('id')
    .eq('company_id', companyId)
    .single()

  const updateData: Record<string, any> = {
    mydeposits_client_id: MYDEPOSITS_CLIENT_ID,
    mydeposits_client_secret_encrypted: encrypt(MYDEPOSITS_CLIENT_SECRET),
    mydeposits_scheme_type: config.schemeType || 'custodial',
    mydeposits_environment: 'live',
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

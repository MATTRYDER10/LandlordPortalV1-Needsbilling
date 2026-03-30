import { supabase } from '../config/supabase'
import { encrypt, decrypt } from './encryption'

// Reposit API endpoints
const REPOSIT_BASE_URLS = {
  sandbox: 'https://demo.reposit.co.uk',
  live: 'https://api.reposit.co.uk'
}

// Reposit status types
export type RepositStatus =
  | 'draft'
  | 'published'
  | 'tenant_confirmed'
  | 'tenant_signed'
  | 'tenant_paid'
  | 'completed'
  | 'deactivated'
  | 'closed'

export interface RepositConfig {
  referrerToken: string
  apiKey: string
  supplierId: string
  environment: 'sandbox' | 'live'
  defaultAgentId?: string
}

interface RepositPricingResponse {
  total_fee_pence: number
  per_tenant_fee_pence: number
  monthly_rent_pence: number
  headcount: number
}

interface RepositCreatePayload {
  supplier_id: string
  agent_id?: string
  tenancy: {
    address: {
      line1: string
      line2?: string
      city: string
      postcode: string
      country?: string
    }
    start_date: string
    end_date?: string
    monthly_rent_pence: number
  }
  tenants: Array<{
    first_name: string
    last_name: string
    email: string
    phone?: string
  }>
  landlord?: {
    first_name: string
    last_name: string
    email: string
    phone?: string
  }
}

interface RepositResponse {
  id: string
  status: string
  total_fee_pence?: number
  per_tenant_fee_pence?: number
  [key: string]: any
}

/**
 * Get Reposit configuration for a company
 */
export async function getCompanyRepositConfig(companyId: string): Promise<RepositConfig | null> {
  const { data, error } = await supabase
    .from('company_integrations')
    .select('reposit_referrer_token_encrypted, reposit_api_key_encrypted, reposit_supplier_id, reposit_environment, reposit_default_agent_id')
    .eq('company_id', companyId)
    .single()

  if (error || !data || !data.reposit_referrer_token_encrypted) {
    return null
  }

  const referrerToken = decrypt(data.reposit_referrer_token_encrypted)
  const apiKey = decrypt(data.reposit_api_key_encrypted)

  if (!referrerToken || !apiKey) {
    return null
  }

  return {
    referrerToken,
    apiKey,
    supplierId: data.reposit_supplier_id || '',
    environment: (data.reposit_environment as 'sandbox' | 'live') || 'live',
    defaultAgentId: data.reposit_default_agent_id || undefined
  }
}

/**
 * Build request headers for Reposit API
 */
function buildHeaders(config: RepositConfig): Record<string, string> {
  return {
    'Reposit-Referrer-Token': config.referrerToken,
    'Authorization': `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json',
    'User-Agent': 'PropertyGoose/1.0'
  }
}

/**
 * Test Reposit API connection with provided credentials
 */
export async function testConnection(config: RepositConfig): Promise<{ success: boolean; message: string; supplierInfo?: any }> {
  const baseUrl = REPOSIT_BASE_URLS[config.environment]

  try {
    // Test using POST /deposits/v1/reposits/pricing — works on both sandbox and production
    const url = `${baseUrl}/deposits/v1/reposits/pricing`

    console.log('[Reposit] Testing connection with POST to:', url)
    console.log('[Reposit] Headers: Reposit-Referrer-Token:', config.referrerToken?.substring(0, 10) + '...', 'Bearer:', config.apiKey?.substring(0, 10) + '...')

    const response = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(config),
      body: JSON.stringify({ ppm: 100000, headcount: 1 })
    })

    const responseText = await response.text()
    console.log('[Reposit] Response status:', response.status, response.statusText)
    console.log('[Reposit] Response body:', responseText.substring(0, 500))

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { success: false, message: 'Authentication failed. Check your credentials.' }
      }
      return { success: false, message: `API error (${response.status}): ${responseText.substring(0, 100)}` }
    }

    // Pricing responded successfully — auth is valid
    return {
      success: true,
      message: 'Connection successful'
    }
  } catch (err) {
    console.error('[Reposit] Connection test error:', err)
    return { success: false, message: err instanceof Error ? err.message : 'Failed to connect to Reposit API' }
  }
}

/**
 * Get supplier info
 */
export async function getSupplierInfo(config: RepositConfig): Promise<{ success: boolean; data?: any; error?: string }> {
  const baseUrl = REPOSIT_BASE_URLS[config.environment]

  try {
    // Use pricing endpoint as a connectivity check (suppliers/me doesn't exist on production)
    const response = await fetch(`${baseUrl}/deposits/v1/reposits/pricing`, {
      method: 'POST',
      headers: buildHeaders(config),
      body: JSON.stringify({ ppm: 100000, headcount: 1 })
    })

    if (!response.ok) {
      return { success: false, error: `API error (${response.status})` }
    }

    const data = await response.json()
    return { success: true, data }
  } catch (err) {
    console.error('[Reposit] getSupplierInfo error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to get supplier info' }
  }
}

/**
 * Get supplier agents
 */
export async function getSupplierAgents(config: RepositConfig): Promise<{ success: boolean; agents?: any[]; error?: string }> {
  const baseUrl = REPOSIT_BASE_URLS[config.environment]

  try {
    // Use configured supplier ID to get agents
    // Note: /suppliers/me doesn't exist on production, so we use the stored supplierId
    if (!config.supplierId) {
      return { success: true, agents: [] }
    }

    // Get agents for this supplier
    const agentsUrl = `${baseUrl}/deposits/v1/suppliers/${config.supplierId}/agents`
    console.log('[Reposit] Fetching agents from:', agentsUrl)

    const response = await fetch(agentsUrl, {
      method: 'GET',
      headers: buildHeaders(config)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Reposit] Agents API error:', response.status, errorText)
      return { success: false, error: `API error (${response.status}): ${errorText}` }
    }

    // API returns array directly, not wrapped in { agents: [] }
    const agents = await response.json() as any[]
    console.log('[Reposit] Found agents:', agents?.length || 0)
    return { success: true, agents: agents || [] }
  } catch (err) {
    console.error('[Reposit] getSupplierAgents error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to get agents' }
  }
}

/**
 * Get Reposit pricing
 */
export async function getRepositPricing(
  config: RepositConfig,
  monthlyRentPence: number,
  headcount: number
): Promise<{ success: boolean; pricing?: RepositPricingResponse; error?: string }> {
  const baseUrl = REPOSIT_BASE_URLS[config.environment]

  // API requires ppm >= 25000 (£250 minimum rent)
  if (monthlyRentPence < 25000) {
    return { success: false, error: 'Monthly rent must be at least £250 for Reposit pricing' }
  }

  try {
    const response = await fetch(`${baseUrl}/deposits/v1/reposits/pricing`, {
      method: 'POST',
      headers: buildHeaders(config),
      body: JSON.stringify({
        ppm: monthlyRentPence, // API uses "ppm" not "monthly_rent_pence"
        headcount: headcount
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Reposit] Pricing API error:', response.status, errorText)
      return { success: false, error: `Pricing API error: ${errorText.substring(0, 100)}` }
    }

    // API returns camelCase: totalFee, tenantFee
    const data = await response.json() as { totalFee: number; tenantFee: number }
    return {
      success: true,
      pricing: {
        total_fee_pence: data.totalFee,
        per_tenant_fee_pence: data.tenantFee,
        monthly_rent_pence: monthlyRentPence,
        headcount: headcount
      }
    }
  } catch (err) {
    console.error('[Reposit] getRepositPricing error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to get pricing' }
  }
}

/**
 * Create a Reposit
 */
export async function createReposit(
  config: RepositConfig,
  payload: RepositCreatePayload
): Promise<{ success: boolean; repositId?: string; data?: RepositResponse; error?: string }> {
  const baseUrl = REPOSIT_BASE_URLS[config.environment]

  try {
    console.log('[Reposit] Creating Reposit with payload:', JSON.stringify(payload).substring(0, 500))

    const response = await fetch(`${baseUrl}/deposits/v1/reposits`, {
      method: 'POST',
      headers: buildHeaders(config),
      body: JSON.stringify(payload)
    })

    const responseText = await response.text()
    console.log('[Reposit] Create response status:', response.status)
    console.log('[Reposit] Create response body:', responseText.substring(0, 500))

    if (!response.ok) {
      return { success: false, error: `Create API error (${response.status}): ${responseText.substring(0, 200)}` }
    }

    const data = JSON.parse(responseText)
    return {
      success: true,
      repositId: data.id,
      data: data
    }
  } catch (err) {
    console.error('[Reposit] createReposit error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create Reposit' }
  }
}

/**
 * Publish a Reposit (send to tenants)
 */
export async function publishReposit(
  config: RepositConfig,
  repositId: string
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = REPOSIT_BASE_URLS[config.environment]

  try {
    const response = await fetch(`${baseUrl}/deposits/v1/reposits/${repositId}/publish`, {
      method: 'POST',
      headers: buildHeaders(config)
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: `Publish API error (${response.status}): ${errorText.substring(0, 100)}` }
    }

    return { success: true }
  } catch (err) {
    console.error('[Reposit] publishReposit error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to publish Reposit' }
  }
}

/**
 * Get Reposit details
 */
export async function getReposit(
  config: RepositConfig,
  repositId: string
): Promise<{ success: boolean; data?: RepositResponse; error?: string }> {
  const baseUrl = REPOSIT_BASE_URLS[config.environment]

  try {
    const response = await fetch(`${baseUrl}/deposits/v1/reposits/${repositId}`, {
      method: 'GET',
      headers: buildHeaders(config)
    })

    if (!response.ok) {
      return { success: false, error: `API error (${response.status})` }
    }

    const data = await response.json() as RepositResponse
    return { success: true, data }
  } catch (err) {
    console.error('[Reposit] getReposit error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to get Reposit' }
  }
}

/**
 * Save Reposit credentials for a company
 */
export async function saveRepositConfig(
  companyId: string,
  config: {
    referrerToken: string
    apiKey: string
    supplierId: string
    environment: 'sandbox' | 'live'
    defaultAgentId?: string
  }
): Promise<{ success: boolean; error?: string }> {
  console.log('[Reposit] Saving config for companyId:', companyId)

  const encryptedReferrerToken = encrypt(config.referrerToken)
  const encryptedApiKey = encrypt(config.apiKey)

  const { data: existing, error: existingError } = await supabase
    .from('company_integrations')
    .select('id')
    .eq('company_id', companyId)
    .single()

  const updateData = {
    reposit_referrer_token_encrypted: encryptedReferrerToken,
    reposit_api_key_encrypted: encryptedApiKey,
    reposit_supplier_id: config.supplierId,
    reposit_environment: config.environment,
    reposit_default_agent_id: config.defaultAgentId || null,
    reposit_connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  if (existing) {
    const { error } = await supabase
      .from('company_integrations')
      .update(updateData)
      .eq('company_id', companyId)

    if (error) {
      console.error('[Reposit] Error updating config:', error)
      return { success: false, error: 'Failed to save Reposit configuration' }
    }
  } else {
    const { error } = await supabase
      .from('company_integrations')
      .insert({
        company_id: companyId,
        ...updateData
      })

    if (error) {
      console.error('[Reposit] Error inserting config:', error)
      return { success: false, error: 'Failed to save Reposit configuration' }
    }
  }

  return { success: true }
}

/**
 * Remove Reposit configuration for a company
 */
export async function removeRepositConfig(companyId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('company_integrations')
    .update({
      reposit_referrer_token_encrypted: null,
      reposit_api_key_encrypted: null,
      reposit_supplier_id: null,
      reposit_environment: null,
      reposit_default_agent_id: null,
      reposit_connected_at: null,
      reposit_last_tested_at: null,
      reposit_last_test_status: null,
      updated_at: new Date().toISOString()
    })
    .eq('company_id', companyId)

  if (error) {
    console.error('[Reposit] Error removing config:', error)
    return { success: false, error: 'Failed to remove Reposit configuration' }
  }

  return { success: true }
}

/**
 * Update Reposit test status
 */
export async function updateRepositTestStatus(
  companyId: string,
  status: 'success' | 'failed'
): Promise<void> {
  await supabase
    .from('company_integrations')
    .update({
      reposit_last_tested_at: new Date().toISOString(),
      reposit_last_test_status: status,
      updated_at: new Date().toISOString()
    })
    .eq('company_id', companyId)
}

/**
 * Get Reposit registration for a tenancy
 */
export async function getRepositRegistration(tenancyId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('reposit_registrations')
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
 * Save Reposit registration record
 */
export async function saveRepositRegistration(
  tenancyId: string,
  companyId: string,
  userId: string,
  repositId: string,
  status: RepositStatus,
  data: {
    monthlyRent: number
    totalFee?: number
    perTenantFee?: number
    headcount: number
    tenancyStartDate: string
    tenancyEndDate?: string
    agentId?: string
    rawResponse?: any
  }
): Promise<{ success: boolean; registrationId?: string; error?: string }> {
  const { data: registration, error } = await supabase
    .from('reposit_registrations')
    .insert({
      tenancy_id: tenancyId,
      company_id: companyId,
      created_by: userId,
      reposit_id: repositId,
      status,
      monthly_rent: data.monthlyRent,
      total_fee: data.totalFee,
      per_tenant_fee: data.perTenantFee,
      headcount: data.headcount,
      tenancy_start_date: data.tenancyStartDate,
      tenancy_end_date: data.tenancyEndDate || null,
      agent_id: data.agentId || null,
      raw_response: data.rawResponse || null
    })
    .select('id')
    .single()

  if (error) {
    console.error('[Reposit] Error saving registration:', error)
    return { success: false, error: 'Failed to save registration record' }
  }

  return { success: true, registrationId: registration.id }
}

/**
 * Update Reposit registration status
 */
export async function updateRepositRegistrationStatus(
  repositId: string,
  status: RepositStatus,
  additionalFields?: Partial<{
    published_at: string
    tenant_confirmed_at: string
    tenant_signed_at: string
    tenant_paid_at: string
    completed_at: string
    deactivated_at: string
    closed_at: string
  }>
): Promise<{ success: boolean; error?: string }> {
  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
    ...additionalFields
  }

  const { error } = await supabase
    .from('reposit_registrations')
    .update(updateData)
    .eq('reposit_id', repositId)

  if (error) {
    console.error('[Reposit] Error updating registration status:', error)
    return { success: false, error: 'Failed to update registration status' }
  }

  return { success: true }
}

import { supabase } from '../config/supabase'
import { encrypt, decrypt } from './encryption'

const JMI_URLS: Record<string, string> = {
  sandbox: 'https://sandbox.jmi.cloud/api/v1',
  production: 'https://app.jmi.cloud/api/v1'
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface JMIConfig {
  apiKey: string
  environment: string
}

export interface JMICustomer {
  gdpr_consent: boolean
  email: string
  firstname: string
  lastname: string
  phone: string
  title?: string
  altphone?: string
  date_of_birth?: string
}

export interface JMITenant {
  firstname: string
  lastname: string
  email?: string
  phone?: string
  title?: string
  student?: number
}

export interface JMIMoveEvent {
  active: number
  movetype?: 'sale' | 'letting'
  movedate?: string
  movedate_confirmed?: number
  managed?: number
  address1?: string
  address2?: string
  city?: string
  county?: string
  postcode?: string
  country?: string
  uprn?: string
  single_occupancy?: number
  under_18s_count?: number
  tenants?: JMITenant[]
  gas_additional_information?: any
  elec_additional_information?: any
  water_additional_information?: any
}

export interface JMIMovePayload {
  partner_move_identifier?: string
  agency_name?: string
  customer: JMICustomer
  movein?: JMIMoveEvent
  moveout?: JMIMoveEvent
}

export interface JMIVoidRequest {
  movedate: string
  movedate_confirmed: boolean
  send_bills_to: 'agency' | 'landlord' | 'property'
  switch_gas?: boolean
  switch_electricity?: boolean
  contact_title: string
  contact_firstname: string
  contact_lastname: string
  contact_phone: string
  contact_email: string
  agent_email?: string
  landlord_address?: {
    is_uk_address?: boolean
    address1?: string
    address2?: string
    city?: string
    county?: string
    postcode?: string
    foreign_address?: string
  }
}

export interface JMIMeterReadings {
  gas?: Array<{
    mprn?: string
    reading: string
    reading_date: string
  }>
  electricity?: Array<{
    mpan?: string
    profile_class?: string
    reading: string
    reading_date: string
  }>
}

// ============================================================================
// CORE HTTP HELPER
// ============================================================================

async function jmiFetch<T = any>(
  apiKey: string,
  environment: string,
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: any
): Promise<{ success: boolean; data?: T; error?: string; statusCode?: number }> {
  try {
    const baseUrl = JMI_URLS[environment] || JMI_URLS.sandbox
    const url = `${baseUrl}${endpoint}`
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
        'User-Agent': 'PropertyGoose/1.0'
      }
    }

    if (body && (method === 'POST' || method === 'PATCH')) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(url, options)
    const responseData: any = await response.json().catch(() => null)

    if (!response.ok) {
      console.error('[JMI] API error response:', JSON.stringify(responseData, null, 2))
      const errorMessage = responseData?.message || responseData?.error || `JMI API error: ${response.status}`
      return { success: false, error: errorMessage, statusCode: response.status }
    }

    return { success: true, data: responseData as T, statusCode: response.status }
  } catch (error) {
    console.error('[JMI] API request failed:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Network error' }
  }
}

// ============================================================================
// CONFIG FUNCTIONS
// ============================================================================

export async function getCompanyJMIConfig(companyId: string): Promise<JMIConfig | null> {
  const { data, error } = await supabase
    .from('company_integrations')
    .select('jmi_api_key_encrypted, jmi_environment')
    .eq('company_id', companyId)
    .single()

  if (error || !data || !data.jmi_api_key_encrypted) {
    return null
  }

  const apiKey = decrypt(data.jmi_api_key_encrypted)
  if (!apiKey) {
    return null
  }

  return { apiKey, environment: data.jmi_environment || 'sandbox' }
}

export async function saveJMIConfig(
  companyId: string,
  apiKey: string,
  environment: string
): Promise<{ success: boolean; error?: string }> {
  console.log('[JMI] Saving config for companyId:', companyId)

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
        jmi_api_key_encrypted: encryptedApiKey,
        jmi_environment: environment,
        jmi_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('company_id', companyId)

    if (error) {
      console.error('[JMI] Error updating config:', error)
      return { success: false, error: 'Failed to save JMI configuration' }
    }
  } else {
    const { error } = await supabase
      .from('company_integrations')
      .insert({
        company_id: companyId,
        jmi_api_key_encrypted: encryptedApiKey,
        jmi_environment: environment,
        jmi_connected_at: new Date().toISOString()
      })

    if (error) {
      console.error('[JMI] Error inserting config:', error)
      return { success: false, error: 'Failed to save JMI configuration' }
    }
  }

  return { success: true }
}

export async function removeJMIConfig(companyId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('company_integrations')
    .update({
      jmi_api_key_encrypted: null,
      jmi_environment: 'sandbox',
      jmi_connected_at: null,
      jmi_last_tested_at: null,
      jmi_last_test_status: null,
      updated_at: new Date().toISOString()
    })
    .eq('company_id', companyId)

  if (error) {
    console.error('[JMI] Error removing config:', error)
    return { success: false, error: 'Failed to remove JMI configuration' }
  }

  return { success: true }
}

export async function updateJMITestStatus(
  companyId: string,
  status: 'success' | 'failed'
): Promise<void> {
  await supabase
    .from('company_integrations')
    .update({
      jmi_last_tested_at: new Date().toISOString(),
      jmi_last_test_status: status,
      updated_at: new Date().toISOString()
    })
    .eq('company_id', companyId)
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

export async function testJMIConnection(
  apiKey: string,
  environment: string
): Promise<{ success: boolean; message: string }> {
  const today = new Date().toISOString().split('T')[0]
  const result = await jmiFetch(apiKey, environment, `/moves?date_from=${today}&date_to=${today}&limit=1`)

  if (!result.success) {
    return { success: false, message: result.error || 'Connection test failed' }
  }

  return { success: true, message: 'Connection successful — JMI API is accessible' }
}

export async function submitMove(
  apiKey: string,
  environment: string,
  payload: JMIMovePayload
): Promise<{ success: boolean; data?: any; error?: string }> {
  const result = await jmiFetch(apiKey, environment, '/moves', 'POST', payload)

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return { success: true, data: result.data }
}

export async function getMoveStatus(
  apiKey: string,
  environment: string,
  moveId: number
): Promise<{ success: boolean; data?: any; error?: string }> {
  const result = await jmiFetch(apiKey, environment, `/moves/${moveId}`)

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return { success: true, data: result.data }
}

export async function cancelMove(
  apiKey: string,
  environment: string,
  moveId: number
): Promise<{ success: boolean; data?: any; error?: string }> {
  const result = await jmiFetch(apiKey, environment, `/moves/${moveId}`, 'PATCH', { action: 'cancel' })

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return { success: true, data: result.data }
}

export async function updateMoveDates(
  apiKey: string,
  environment: string,
  moveId: number,
  movein?: { movedate: string; movedate_confirmed: boolean },
  moveout?: { movedate: string; movedate_confirmed: boolean }
): Promise<{ success: boolean; data?: any; error?: string }> {
  const body: any = { action: 'dates' }
  if (movein) body.movein = movein
  if (moveout) body.moveout = moveout

  const result = await jmiFetch(apiKey, environment, `/moves/${moveId}`, 'PATCH', body)

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return { success: true, data: result.data }
}

export async function updateMoveMeters(
  apiKey: string,
  environment: string,
  moveId: number,
  movein?: { gas_additional_information?: any; elec_additional_information?: any; water_additional_information?: any },
  moveout?: { gas_additional_information?: any; elec_additional_information?: any; water_additional_information?: any }
): Promise<{ success: boolean; data?: any; error?: string }> {
  const body: any = { action: 'meters' }
  if (movein) body.movein = movein
  if (moveout) body.moveout = moveout

  const result = await jmiFetch(apiKey, environment, `/moves/${moveId}`, 'PATCH', body)

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return { success: true, data: result.data }
}

export async function getMeters(
  apiKey: string,
  environment: string,
  moveId: number
): Promise<{ success: boolean; data?: any; error?: string }> {
  const result = await jmiFetch(apiKey, environment, `/moves/${moveId}/meters`)

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return { success: true, data: result.data }
}

export async function getMeterReadings(
  apiKey: string,
  environment: string,
  moveId: number
): Promise<{ success: boolean; data?: any; error?: string }> {
  const result = await jmiFetch(apiKey, environment, `/moves/${moveId}/readings`)

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return { success: true, data: result.data }
}

export async function submitMeterReadings(
  apiKey: string,
  environment: string,
  moveId: number,
  readings: JMIMeterReadings
): Promise<{ success: boolean; data?: any; error?: string }> {
  const result = await jmiFetch(apiKey, environment, `/moves/${moveId}/readings`, 'POST', readings)

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return { success: true, data: result.data }
}

export async function requestVoid(
  apiKey: string,
  environment: string,
  moveId: number,
  voidData: JMIVoidRequest
): Promise<{ success: boolean; data?: any; error?: string }> {
  const result = await jmiFetch(apiKey, environment, `/moves/${moveId}/void`, 'POST', voidData)

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return { success: true, data: result.data }
}

export async function getVoidStatus(
  apiKey: string,
  environment: string,
  moveId: number
): Promise<{ success: boolean; data?: any; error?: string }> {
  const result = await jmiFetch(apiKey, environment, `/moves/${moveId}/void`)

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return { success: true, data: result.data }
}

export async function cancelVoid(
  apiKey: string,
  environment: string,
  moveId: number
): Promise<{ success: boolean; data?: any; error?: string }> {
  const result = await jmiFetch(apiKey, environment, `/moves/${moveId}/void`, 'DELETE')

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return { success: true, data: result.data }
}

export async function updateCustomer(
  apiKey: string,
  environment: string,
  moveId: number,
  customerData: Partial<{
    title: string
    firstname: string
    lastname: string
    date_of_birth: string
    phone: string
    altphone: string
    gdpr_consent: boolean
  }>
): Promise<{ success: boolean; data?: any; error?: string }> {
  const result = await jmiFetch(apiKey, environment, `/moves/${moveId}/customer`, 'PATCH', customerData)

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return { success: true, data: result.data }
}

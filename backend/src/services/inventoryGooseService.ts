import { supabase } from '../config/supabase'
import { encrypt, decrypt } from './encryption'
import crypto from 'crypto'

const IG_BASE_URL = 'https://ig.propertygoose.co.uk'

// ============================================================================
// INTERFACES
// ============================================================================

export interface IGConfig {
  apiKey: string
}

export interface IGAssessor {
  id: string
  name: string
  initials: string
  email: string
}

export interface IGAppointmentPayload {
  externalPropertyId: string
  externalTenancyId: string
  type: 'inventory' | 'checkout' | 'mid_term'
  scheduledDate: string
  scheduledTime: string
  assessorId?: string
  webhookUrl?: string
  reportCallbackUrl?: string
  property: {
    addressLine1: string
    addressLine2?: string
    city: string
    postcode: string
    bedrooms?: number
    bathrooms?: number
    propertyType?: string
  }
}

export interface IGAppointmentResponse {
  appointmentId: string
  reportId: string
  status: string
  reportUrl: string
  assessor: {
    id: string
    name: string
    initials: string
  }
  scheduledAt: string
}

// ============================================================================
// CORE HTTP HELPER
// ============================================================================

async function igFetch<T = any>(
  apiKey: string,
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: any
): Promise<{ success: boolean; data?: T; error?: string; statusCode?: number }> {
  try {
    const url = `${IG_BASE_URL}${endpoint}`
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'User-Agent': 'PropertyGoose/1.0'
      }
    }

    if (body && (method === 'POST' || method === 'PATCH')) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(url, options)
    const responseData: any = await response.json().catch(() => null)

    if (!response.ok) {
      const errorMessage = responseData?.message || `IG API error: ${response.status}`
      return { success: false, error: errorMessage, statusCode: response.status }
    }

    return { success: true, data: responseData as T, statusCode: response.status }
  } catch (error) {
    console.error('[IG] API request failed:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Network error' }
  }
}

// ============================================================================
// CONFIG FUNCTIONS
// ============================================================================

export async function getCompanyIGConfig(companyId: string): Promise<IGConfig | null> {
  const { data, error } = await supabase
    .from('company_integrations')
    .select('ig_api_key_encrypted')
    .eq('company_id', companyId)
    .single()

  if (error || !data || !data.ig_api_key_encrypted) {
    return null
  }

  const apiKey = decrypt(data.ig_api_key_encrypted)
  if (!apiKey) {
    return null
  }

  return { apiKey }
}

export async function saveIGConfig(
  companyId: string,
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  console.log('[IG] Saving config for companyId:', companyId)

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
        ig_api_key_encrypted: encryptedApiKey,
        ig_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('company_id', companyId)

    if (error) {
      console.error('[IG] Error updating config:', error)
      return { success: false, error: 'Failed to save InventoryGoose configuration' }
    }
  } else {
    const { error } = await supabase
      .from('company_integrations')
      .insert({
        company_id: companyId,
        ig_api_key_encrypted: encryptedApiKey,
        ig_connected_at: new Date().toISOString()
      })

    if (error) {
      console.error('[IG] Error inserting config:', error)
      return { success: false, error: 'Failed to save InventoryGoose configuration' }
    }
  }

  return { success: true }
}

export async function removeIGConfig(companyId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('company_integrations')
    .update({
      ig_api_key_encrypted: null,
      ig_connected_at: null,
      ig_last_tested_at: null,
      ig_last_test_status: null,
      updated_at: new Date().toISOString()
    })
    .eq('company_id', companyId)

  if (error) {
    console.error('[IG] Error removing config:', error)
    return { success: false, error: 'Failed to remove InventoryGoose configuration' }
  }

  return { success: true }
}

export async function updateIGTestStatus(
  companyId: string,
  status: 'success' | 'failed'
): Promise<void> {
  await supabase
    .from('company_integrations')
    .update({
      ig_last_tested_at: new Date().toISOString(),
      ig_last_test_status: status,
      updated_at: new Date().toISOString()
    })
    .eq('company_id', companyId)
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

export async function testConnection(apiKey: string): Promise<{ success: boolean; message: string }> {
  const result = await igFetch<{ assessors: IGAssessor[] }>(apiKey, '/api/partner/assessors')

  if (!result.success) {
    return { success: false, message: result.error || 'Connection test failed' }
  }

  const assessors = result.data?.assessors || []
  return { success: true, message: `Connection successful — ${assessors.length} assessor(s) found` }
}

export async function getAssessors(apiKey: string): Promise<{ success: boolean; assessors?: IGAssessor[]; error?: string }> {
  const result = await igFetch<{ assessors: IGAssessor[] }>(apiKey, '/api/partner/assessors')

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return { success: true, assessors: result.data?.assessors || [] }
}

export async function createAppointment(
  apiKey: string,
  payload: IGAppointmentPayload
): Promise<{ success: boolean; data?: IGAppointmentResponse; error?: string }> {
  const result = await igFetch<IGAppointmentResponse>(apiKey, '/api/partner/appointments', 'POST', payload)

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return { success: true, data: result.data }
}

export async function updateAppointment(
  apiKey: string,
  appointmentId: string,
  updates: { scheduledDate?: string; scheduledTime?: string; assessorId?: string }
): Promise<{ success: boolean; data?: any; error?: string }> {
  const result = await igFetch(apiKey, `/api/partner/appointments/${appointmentId}`, 'PATCH', updates)

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return { success: true, data: result.data }
}

export async function getAppointmentStatus(
  apiKey: string,
  appointmentId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const result = await igFetch(apiKey, `/api/partner/appointments/${appointmentId}`)

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return { success: true, data: result.data }
}

export async function cancelAppointment(
  apiKey: string,
  appointmentId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const result = await igFetch(apiKey, `/api/partner/appointments/${appointmentId}`, 'DELETE')

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return { success: true, data: result.data }
}

export async function downloadReportPdf(
  apiKey: string,
  reportId: string
): Promise<{ success: boolean; data?: Buffer; contentType?: string; error?: string }> {
  try {
    const url = `${IG_BASE_URL}/api/partner/reports/${reportId}/pdf`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'User-Agent': 'PropertyGoose/1.0'
      }
    })

    if (!response.ok) {
      const errorData: any = await response.json().catch(() => null)
      return { success: false, error: errorData?.message || `Failed to download PDF: ${response.status}` }
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const contentType = response.headers.get('content-type') || 'application/pdf'

    return { success: true, data: buffer, contentType }
  } catch (error) {
    console.error('[IG] PDF download failed:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to download PDF' }
  }
}

// ============================================================================
// WEBHOOK VERIFICATION
// ============================================================================

export function verifyWebhookSignature(body: string, signature: string, apiKey: string): boolean {
  if (!signature || !apiKey) return false

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', apiKey)
    .update(body)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

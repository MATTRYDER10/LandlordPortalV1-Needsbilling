import { Router, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import {
  verifyWebhookSignature,
  getCompanyIGConfig,
  hashIGApiKey,
  findCompanyIdByIgApiKeyHash
} from '../services/inventoryGooseService'
import { decrypt } from '../services/encryption'

const router = Router()

// ── Failed-auth throttle for the IG properties pull endpoint ───────────────
// We don't rate-limit successful authenticated requests at all — IG can pull
// as fast as it likes if the API key is valid. We DO throttle FAILED auth
// attempts per IP so that anyone trying to brute-force the x-pg-api-key
// header gets locked out cheaply after a small handful of failures. This is
// the standard pattern for authenticated APIs: punish failure, not success.
const igFailedAuthMap = new Map<string, { count: number; resetAt: number }>()
const IG_FAILED_AUTH_MAX = 10 // failed attempts per window before lockout
const IG_FAILED_AUTH_WINDOW_MS = 5 * 60_000 // 5-minute rolling window

function isIgAuthLockedOut(ip: string): boolean {
  const now = Date.now()
  const entry = igFailedAuthMap.get(ip)
  if (!entry || now > entry.resetAt) return false
  return entry.count > IG_FAILED_AUTH_MAX
}

function recordIgAuthFailure(ip: string): void {
  const now = Date.now()
  const entry = igFailedAuthMap.get(ip)
  if (!entry || now > entry.resetAt) {
    igFailedAuthMap.set(ip, { count: 1, resetAt: now + IG_FAILED_AUTH_WINDOW_MS })
    return
  }
  entry.count++
}

function clearIgAuthFailures(ip: string): void {
  // A successful auth wipes any prior failure count for this IP — fixes the
  // "agent typo'd their key, fixed it, now they're locked out" footgun.
  igFailedAuthMap.delete(ip)
}

setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of igFailedAuthMap) {
    if (now > entry.resetAt) igFailedAuthMap.delete(ip)
  }
}, 60_000)

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')
    return ips[0].trim()
  }
  const realIp = req.headers['x-real-ip']
  if (realIp) return typeof realIp === 'string' ? realIp : realIp[0]
  return req.ip || req.socket?.remoteAddress || '0.0.0.0'
}

// ============================================================================
// HELPER: Verify webhook and find appointment
// ============================================================================

async function verifyAndFindAppointment(req: Request, res: Response): Promise<{ appointment: any; apiKey: string } | null> {
  const signature = req.headers['x-ig-signature'] as string
  const body = JSON.stringify(req.body)

  if (!signature) {
    res.status(401).json({ error: 'Missing signature' })
    return null
  }

  const { appointmentId, externalTenancyId } = req.body

  if (!appointmentId) {
    res.status(400).json({ error: 'Missing appointmentId' })
    return null
  }

  // Find the appointment in our database
  const { data: appointment, error } = await supabase
    .from('ig_appointments')
    .select('*, company_id')
    .eq('ig_appointment_id', appointmentId)
    .single()

  if (error || !appointment) {
    console.error('[IG Webhook] Appointment not found:', appointmentId)
    res.status(404).json({ error: 'Appointment not found' })
    return null
  }

  // Get the company's API key to verify signature
  const config = await getCompanyIGConfig(appointment.company_id)
  if (!config) {
    console.error('[IG Webhook] No IG config for company:', appointment.company_id)
    res.status(500).json({ error: 'Integration not configured' })
    return null
  }

  // Verify HMAC signature
  if (!verifyWebhookSignature(body, signature, config.apiKey)) {
    console.error('[IG Webhook] Invalid signature for appointment:', appointmentId)
    res.status(401).json({ error: 'Invalid signature' })
    return null
  }

  return { appointment, apiKey: config.apiKey }
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/integrations/ig/webhook
 * Handle appointment status webhooks from IG
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const result = await verifyAndFindAppointment(req, res)
    if (!result) return // Response already sent

    const { appointment } = result
    const { event, status, data, appointmentId, reportId } = req.body

    console.log(`[IG Webhook] Event: ${event}, Status: ${status}, Appointment: ${appointmentId}`)

    // Build update object
    const updates: any = {
      updated_at: new Date().toISOString()
    }

    if (status) {
      updates.status = status
    }

    if (reportId) {
      updates.ig_report_id = reportId
    }

    // Handle specific event data
    if (data?.assessor) {
      updates.assessor_id = data.assessor.id || appointment.assessor_id
      updates.assessor_name = data.assessor.name || appointment.assessor_name
      updates.assessor_initials = data.assessor.initials || appointment.assessor_initials
    }

    if (data?.scheduledAt) {
      const scheduledDate = new Date(data.scheduledAt)
      updates.scheduled_date = scheduledDate.toISOString().split('T')[0]
      updates.scheduled_time = scheduledDate.toISOString().split('T')[1]?.substring(0, 5)
    }

    if (data?.reportUrl) {
      updates.report_url = data.reportUrl
    }

    if (data?.pdfUrl) {
      updates.pdf_url = data.pdfUrl
    }

    if (data?.signedAt) {
      updates.signed_at = data.signedAt
    }

    // Update the appointment record
    const { error: updateError } = await supabase
      .from('ig_appointments')
      .update(updates)
      .eq('id', appointment.id)

    if (updateError) {
      console.error('[IG Webhook] Error updating appointment:', updateError)
    }

    // Log activity for significant events
    const activityMap: Record<string, { title: string; description: string }> = {
      'appointment.updated': {
        title: 'Inspection Updated',
        description: `Inspection status changed to ${status}`
      },
      'appointment.cancelled': {
        title: 'Inspection Cancelled',
        description: 'Inspection was cancelled via InventoryGoose'
      },
      'report.ai_complete': {
        title: 'AI Report Processing Complete',
        description: 'InventoryGoose AI has finished processing the inspection report'
      },
      'report.signed': {
        title: 'Inspection Report Signed',
        description: 'All parties have signed the inspection report'
      }
    }

    const activity = activityMap[event]
    if (activity) {
      await supabase
        .from('tenancy_activity')
        .insert({
          tenancy_id: appointment.tenancy_id,
          action: `IG_${event.toUpperCase().replace('.', '_')}`,
          category: 'inspection',
          title: activity.title,
          description: activity.description,
          metadata: { appointmentId, event, status },
          is_system_action: true
        })
    }

    res.json({ received: true })
  } catch (error) {
    console.error('[IG Webhook] Error processing webhook:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/integrations/ig/report-complete
 * Handle report delivery from IG
 */
router.post('/report-complete', async (req: Request, res: Response) => {
  try {
    const result = await verifyAndFindAppointment(req, res)
    if (!result) return // Response already sent

    const { appointment } = result
    const { reportId, pdfUrl, reportUrl, signedAt, signatories, type } = req.body

    console.log(`[IG Report] Report complete for appointment: ${appointment.ig_appointment_id}, reportId: ${reportId}`)

    // Update the appointment record with report data
    const { error: updateError } = await supabase
      .from('ig_appointments')
      .update({
        ig_report_id: reportId || appointment.ig_report_id,
        pdf_url: pdfUrl || appointment.pdf_url,
        report_url: reportUrl || appointment.report_url,
        signed_at: signedAt || null,
        signatories: signatories || null,
        status: 'signed',
        updated_at: new Date().toISOString()
      })
      .eq('id', appointment.id)

    if (updateError) {
      console.error('[IG Report] Error updating appointment:', updateError)
    }

    // Log activity
    const typeLabel = type === 'inventory' ? 'Inventory' : type === 'checkout' ? 'Check Out' : type === 'mid_term' ? 'Mid-Term' : 'Inspection'
    const signerNames = signatories?.map((s: any) => s.name).join(', ') || ''

    await supabase
      .from('tenancy_activity')
      .insert({
        tenancy_id: appointment.tenancy_id,
        action: 'IG_REPORT_COMPLETE',
        category: 'inspection',
        title: `${typeLabel} Report Complete`,
        description: `Signed report delivered${signerNames ? ` — signed by ${signerNames}` : ''}`,
        metadata: { reportId, type, signedAt, signatoryCount: signatories?.length || 0 },
        is_system_action: true
      })

    res.json({ received: true })
  } catch (error) {
    console.error('[IG Report] Error processing report delivery:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/integrations/ig/properties
 * Authenticates by the IG-issued API key and returns all properties for that company.
 * Used by IG to pull its full property list from PG in one request (manual sync).
 */
router.get('/properties', async (req: Request, res: Response) => {
  const clientIp = getClientIp(req)

  // Lockout check BEFORE any DB work — if this IP has been hammering bad
  // keys we reject it cheaply with no auth lookup. Successful pulls have
  // no rate limit at all.
  if (isIgAuthLockedOut(clientIp)) {
    console.warn(`[IG Properties] Auth lockout ip=${clientIp}`)
    return res.status(429).json({ error: 'Too many failed authentication attempts. Try again later.' })
  }

  try {
    const rawKey = req.headers['x-pg-api-key']
    const apiKey = typeof rawKey === 'string' ? rawKey.trim() : ''
    if (!apiKey) {
      recordIgAuthFailure(clientIp)
      return res.status(401).json({ error: 'Missing x-pg-api-key header' })
    }

    const hash = hashIGApiKey(apiKey)
    const companyId = await findCompanyIdByIgApiKeyHash(hash)
    if (!companyId) {
      recordIgAuthFailure(clientIp)
      console.warn(`[IG Properties] Auth failed ip=${clientIp}`)
      return res.status(401).json({ error: 'Invalid API key' })
    }

    // Successful auth — clear any prior failure count for this IP so a
    // brief mistype doesn't lock the legitimate caller out for 5 minutes.
    clearIgAuthFailures(clientIp)

    const { data: properties, error } = await supabase
      .from('properties')
      .select('id, postcode, property_type, number_of_bedrooms, address_line1_encrypted, address_line2_encrypted, city_encrypted, updated_at')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('[IG Properties] Query error:', error)
      return res.status(500).json({ error: 'Failed to load properties' })
    }

    // Batch-fetch landlords for every property in one round trip via the
    // property_landlords junction table. Then decrypt landlord PII and group
    // by property so we can attach landlords[] to each property in the
    // response. IG uses this to keep landlord contact details in sync with
    // PG without needing a separate /landlords pull.
    const propertyIds = (properties || []).map((p: any) => p.id)
    const landlordsByProperty = new Map<string, any[]>()

    if (propertyIds.length > 0) {
      const { data: links } = await supabase
        .from('property_landlords')
        .select('property_id, landlord_id, ownership_percentage, is_primary_contact')
        .in('property_id', propertyIds)

      const landlordIds = [...new Set((links || []).map((l: any) => l.landlord_id))]
      const landlordById = new Map<string, any>()
      if (landlordIds.length > 0) {
        const { data: landlords } = await supabase
          .from('landlords')
          .select(`
            id,
            first_name_encrypted,
            last_name_encrypted,
            email_encrypted,
            phone_encrypted,
            address_line1_encrypted,
            address_line2_encrypted,
            city_encrypted,
            postcode_encrypted
          `)
          .in('id', landlordIds)
        for (const l of (landlords || [])) landlordById.set(l.id, l)
      }

      for (const link of (links || [])) {
        const ll = landlordById.get(link.landlord_id)
        if (!ll) continue
        const arr = landlordsByProperty.get(link.property_id) || []
        const firstName = ll.first_name_encrypted ? (decrypt(ll.first_name_encrypted) || '') : ''
        const lastName = ll.last_name_encrypted ? (decrypt(ll.last_name_encrypted) || '') : ''
        arr.push({
          pg_landlord_id: ll.id,
          first_name: firstName,
          last_name: lastName,
          name: `${firstName} ${lastName}`.trim(),
          email: ll.email_encrypted ? (decrypt(ll.email_encrypted) || '') : '',
          phone: ll.phone_encrypted ? (decrypt(ll.phone_encrypted) || '') : '',
          address: {
            line1: ll.address_line1_encrypted ? (decrypt(ll.address_line1_encrypted) || '') : '',
            line2: ll.address_line2_encrypted ? (decrypt(ll.address_line2_encrypted) || '') : '',
            city: ll.city_encrypted ? (decrypt(ll.city_encrypted) || '') : '',
            postcode: ll.postcode_encrypted ? (decrypt(ll.postcode_encrypted) || '') : '',
          },
          ownership_percentage: link.ownership_percentage || 100,
          is_primary_contact: !!link.is_primary_contact,
        })
        landlordsByProperty.set(link.property_id, arr)
      }
    }

    const payload = (properties || []).map((p: any) => ({
      pg_property_id: p.id,
      address_line_1: decrypt(p.address_line1_encrypted) || '',
      address_line_2: decrypt(p.address_line2_encrypted) || '',
      city: decrypt(p.city_encrypted) || '',
      postcode: p.postcode || '',
      property_type: p.property_type || 'flat',
      bedrooms: p.number_of_bedrooms || 0,
      updated_at: p.updated_at,
      landlords: landlordsByProperty.get(p.id) || [],
    }))

    const totalLandlords = payload.reduce((sum, p) => sum + p.landlords.length, 0)
    console.log(`[IG Properties] Served ${payload.length} properties (${totalLandlords} landlords) company=${companyId} ip=${clientIp}`)
    res.json({ properties: payload })
  } catch (error) {
    console.error('[IG Properties] Error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

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
  try {
    const apiKey = req.headers['x-pg-api-key'] as string | undefined
    if (!apiKey) {
      return res.status(401).json({ error: 'Missing x-pg-api-key header' })
    }

    const hash = hashIGApiKey(apiKey)
    const companyId = await findCompanyIdByIgApiKeyHash(hash)
    if (!companyId) {
      return res.status(401).json({ error: 'Invalid API key' })
    }

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

    const payload = (properties || []).map((p: any) => ({
      pg_property_id: p.id,
      address_line_1: decrypt(p.address_line1_encrypted) || '',
      address_line_2: decrypt(p.address_line2_encrypted) || '',
      city: decrypt(p.city_encrypted) || '',
      postcode: p.postcode || '',
      property_type: p.property_type || 'flat',
      bedrooms: p.number_of_bedrooms || 0,
      updated_at: p.updated_at
    }))

    res.json({ properties: payload })
  } catch (error) {
    console.error('[IG Properties] Error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

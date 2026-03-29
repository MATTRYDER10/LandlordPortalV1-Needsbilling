import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import { decrypt } from '../services/encryption'
import {
  getCompanyIGConfig,
  getAssessors,
  createAppointment,
  updateAppointment,
  cancelAppointment,
  getAppointmentStatus,
  downloadReportPdf
} from '../services/inventoryGooseService'

const router = Router()

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getUserCompanyId(req: AuthRequest): Promise<string | null> {
  const userId = req.user?.id
  if (!userId) return null

  const branchId = req.headers['x-branch-id'] as string | undefined

  if (branchId) {
    const { data: branchMembership } = await supabase
      .from('company_users')
      .select('company_id, role')
      .eq('user_id', userId)
      .eq('company_id', branchId)
      .limit(1)

    if (branchMembership && branchMembership.length > 0) {
      return branchMembership[0].company_id
    }
  }

  const { data: companyUsers } = await supabase
    .from('company_users')
    .select('company_id')
    .eq('user_id', userId)
    .limit(1)

  if (companyUsers && companyUsers.length > 0) {
    return companyUsers[0].company_id
  }

  return null
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/ig/assessors
 * Proxy to IG assessors endpoint
 */
router.get('/assessors', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyIGConfig(companyId)
    if (!config) {
      return res.status(400).json({ error: 'InventoryGoose is not configured' })
    }

    const result = await getAssessors(config.apiKey)

    if (!result.success) {
      return res.status(400).json({ error: result.error })
    }

    res.json({ assessors: result.assessors })
  } catch (error) {
    console.error('[IG] Error fetching assessors:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * POST /api/ig/appointments
 * Create appointment (builds payload from tenancy/property data)
 */
router.post('/appointments', authenticateToken, async (req: AuthRequest, res) => {
  try {
    console.log('[IG] POST /appointments - body:', JSON.stringify(req.body))

    const companyId = await getUserCompanyId(req)
    if (!companyId) {
      console.error('[IG] No company found for user:', req.user?.id)
      return res.status(404).json({ error: 'Company not found' })
    }

    console.log('[IG] Company ID:', companyId)

    const config = await getCompanyIGConfig(companyId)
    if (!config) {
      console.error('[IG] No IG config for company:', companyId)
      return res.status(400).json({ error: 'InventoryGoose is not configured for this company. Please add your API key in Settings > Integrations.' })
    }

    const { tenancyId, type, scheduledDate, scheduledTime, assessorId } = req.body

    if (!tenancyId || !type || !scheduledDate || !scheduledTime) {
      console.error('[IG] Missing required fields:', { tenancyId, type, scheduledDate, scheduledTime })
      return res.status(400).json({ error: `Missing required fields: ${[!tenancyId && 'tenancyId', !type && 'type', !scheduledDate && 'scheduledDate', !scheduledTime && 'scheduledTime'].filter(Boolean).join(', ')}` })
    }

    if (!['inventory', 'checkout', 'mid_term'].includes(type)) {
      return res.status(400).json({ error: 'type must be inventory, checkout, or mid_term' })
    }

    // Fetch tenancy to get property_id
    const { data: tenancy, error: tenancyError } = await supabase
      .from('tenancies')
      .select('id, property_id, company_id')
      .eq('id', tenancyId)
      .eq('company_id', companyId)
      .single()

    if (tenancyError || !tenancy) {
      console.error('[IG] Tenancy not found:', tenancyId, tenancyError)
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    console.log('[IG] Tenancy found, property_id:', tenancy.property_id)

    // Fetch property details
    let propertyData = {
      addressLine1: '',
      addressLine2: '',
      city: '',
      postcode: '',
      bedrooms: 0,
      bathrooms: 0,
      propertyType: ''
    }

    if (tenancy.property_id) {
      const { data: property } = await supabase
        .from('properties')
        .select('id, address_line1_encrypted, address_line2_encrypted, city_encrypted, postcode, number_of_bedrooms, number_of_bathrooms, property_type')
        .eq('id', tenancy.property_id)
        .single()

      if (property) {
        propertyData = {
          addressLine1: property.address_line1_encrypted ? (decrypt(property.address_line1_encrypted) || '') : '',
          addressLine2: property.address_line2_encrypted ? (decrypt(property.address_line2_encrypted) || '') : '',
          city: property.city_encrypted ? (decrypt(property.city_encrypted) || '') : '',
          postcode: property.postcode || '',
          bedrooms: property.number_of_bedrooms || 0,
          bathrooms: property.number_of_bathrooms || 0,
          propertyType: property.property_type || ''
        }
      }
    }

    // Validate property data before sending to IG
    if (!propertyData.addressLine1 || !propertyData.postcode) {
      console.error('[IG] Missing property data for tenancy:', tenancyId, {
        hasPropertyId: !!tenancy.property_id,
        addressLine1: propertyData.addressLine1 ? '(set)' : '(empty)',
        postcode: propertyData.postcode ? '(set)' : '(empty)'
      })
      return res.status(400).json({
        error: 'Property address and postcode are required to book an inspection. Please ensure the property has a full address saved.'
      })
    }

    // Build webhook URLs
    const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`
    const webhookUrl = `${backendUrl}/api/integrations/ig/webhook`
    const reportCallbackUrl = `${backendUrl}/api/integrations/ig/report-complete`

    const payload = {
      externalPropertyId: tenancy.property_id || tenancyId,
      externalTenancyId: tenancyId,
      type: type as 'inventory' | 'checkout' | 'mid_term',
      scheduledDate,
      scheduledTime,
      assessorId: assessorId || undefined,
      webhookUrl,
      reportCallbackUrl,
      property: propertyData
    }

    console.log('[IG] Creating appointment with payload:', JSON.stringify({
      ...payload,
      property: {
        addressLine1: payload.property.addressLine1 ? '(set)' : '(empty)',
        postcode: payload.property.postcode ? '(set)' : '(empty)',
        city: payload.property.city ? '(set)' : '(empty)'
      }
    }))

    const result = await createAppointment(config.apiKey, payload)

    if (!result.success || !result.data) {
      console.error('[IG] InventoryGoose API rejected appointment:', result.error)
      return res.status(400).json({ error: result.error || 'Failed to create appointment in InventoryGoose' })
    }

    // Store in ig_appointments table
    const { error: insertError } = await supabase
      .from('ig_appointments')
      .insert({
        company_id: companyId,
        tenancy_id: tenancyId,
        property_id: tenancy.property_id || null,
        ig_appointment_id: result.data.appointmentId,
        ig_report_id: result.data.reportId || null,
        type,
        status: result.data.status || 'scheduled',
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        assessor_id: result.data.assessor?.id || null,
        assessor_name: result.data.assessor?.name || null,
        assessor_initials: result.data.assessor?.initials || null,
        report_url: result.data.reportUrl || null,
        webhook_url: webhookUrl
      })

    if (insertError) {
      console.error('[IG] Error storing appointment:', insertError)
      // Still return success since IG appointment was created
    }

    // Log activity
    await supabase
      .from('tenancy_activity')
      .insert({
        tenancy_id: tenancyId,
        action: 'IG_INSPECTION_BOOKED',
        category: 'inspection',
        title: `${type === 'inventory' ? 'Inventory' : type === 'checkout' ? 'Check Out' : 'Mid-Term'} Inspection Booked`,
        description: `Scheduled for ${scheduledDate} at ${scheduledTime}${result.data.assessor?.name ? ` with ${result.data.assessor.name}` : ''}`,
        metadata: { appointmentId: result.data.appointmentId, type, scheduledDate, scheduledTime },
        performed_by: req.user?.id,
        is_system_action: false
      })

    res.status(201).json(result.data)
  } catch (error) {
    console.error('[IG] Error creating appointment:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * GET /api/ig/appointments/:tenancyId
 * List appointments for a tenancy (from ig_appointments table)
 */
router.get('/appointments/:tenancyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { tenancyId } = req.params

    const { data: appointments, error } = await supabase
      .from('ig_appointments')
      .select('*')
      .eq('tenancy_id', tenancyId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[IG] Error fetching appointments:', error)
      return res.status(500).json({ error: 'Failed to fetch appointments' })
    }

    res.json({ appointments: appointments || [] })
  } catch (error) {
    console.error('[IG] Error fetching appointments:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * PATCH /api/ig/appointments/:id
 * Update appointment
 */
router.patch('/appointments/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyIGConfig(companyId)
    if (!config) {
      return res.status(400).json({ error: 'InventoryGoose is not configured' })
    }

    const { id } = req.params
    const { scheduledDate, scheduledTime, assessorId } = req.body

    // Get the local appointment record
    const { data: appointment, error: fetchError } = await supabase
      .from('ig_appointments')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .single()

    if (fetchError || !appointment) {
      return res.status(404).json({ error: 'Appointment not found' })
    }

    const updates: any = {}
    if (scheduledDate) updates.scheduledDate = scheduledDate
    if (scheduledTime) updates.scheduledTime = scheduledTime
    if (assessorId !== undefined) updates.assessorId = assessorId || undefined

    const result = await updateAppointment(config.apiKey, appointment.ig_appointment_id, updates)

    if (!result.success) {
      return res.status(400).json({ error: result.error })
    }

    // Update local record
    const localUpdates: any = { updated_at: new Date().toISOString() }
    if (scheduledDate) localUpdates.scheduled_date = scheduledDate
    if (scheduledTime) localUpdates.scheduled_time = scheduledTime
    if (result.data?.assessor) {
      localUpdates.assessor_id = result.data.assessor.id
      localUpdates.assessor_name = result.data.assessor.name
      localUpdates.assessor_initials = result.data.assessor.initials
    }

    await supabase
      .from('ig_appointments')
      .update(localUpdates)
      .eq('id', id)

    res.json(result.data)
  } catch (error) {
    console.error('[IG] Error updating appointment:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * DELETE /api/ig/appointments/:id
 * Cancel appointment
 */
router.delete('/appointments/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyIGConfig(companyId)
    if (!config) {
      return res.status(400).json({ error: 'InventoryGoose is not configured' })
    }

    const { id } = req.params

    // Get the local appointment record
    const { data: appointment, error: fetchError } = await supabase
      .from('ig_appointments')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .single()

    if (fetchError || !appointment) {
      return res.status(404).json({ error: 'Appointment not found' })
    }

    const result = await cancelAppointment(config.apiKey, appointment.ig_appointment_id)

    if (!result.success) {
      return res.status(400).json({ error: result.error })
    }

    // Update local record
    await supabase
      .from('ig_appointments')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    // Log activity
    await supabase
      .from('tenancy_activity')
      .insert({
        tenancy_id: appointment.tenancy_id,
        action: 'IG_INSPECTION_CANCELLED',
        category: 'inspection',
        title: 'Inspection Cancelled',
        description: `${appointment.type === 'inventory' ? 'Inventory' : appointment.type === 'checkout' ? 'Check Out' : 'Mid-Term'} inspection on ${appointment.scheduled_date} cancelled`,
        metadata: { appointmentId: appointment.ig_appointment_id, type: appointment.type },
        performed_by: req.user?.id,
        is_system_action: false
      })

    res.json({ success: true, status: 'cancelled' })
  } catch (error) {
    console.error('[IG] Error cancelling appointment:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * GET /api/ig/appointments/:id/status
 * Get fresh status from IG
 */
router.get('/appointments/:id/status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyIGConfig(companyId)
    if (!config) {
      return res.status(400).json({ error: 'InventoryGoose is not configured' })
    }

    const { id } = req.params

    const { data: appointment } = await supabase
      .from('ig_appointments')
      .select('ig_appointment_id')
      .eq('id', id)
      .eq('company_id', companyId)
      .single()

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' })
    }

    const result = await getAppointmentStatus(config.apiKey, appointment.ig_appointment_id)

    if (!result.success) {
      return res.status(400).json({ error: result.error })
    }

    // Update local status
    if (result.data?.status) {
      await supabase
        .from('ig_appointments')
        .update({
          status: result.data.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
    }

    res.json(result.data)
  } catch (error) {
    console.error('[IG] Error fetching appointment status:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * GET /api/ig/reports/:reportId/pdf
 * Proxy PDF download
 */
router.get('/reports/:reportId/pdf', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyIGConfig(companyId)
    if (!config) {
      return res.status(400).json({ error: 'InventoryGoose is not configured' })
    }

    const { reportId } = req.params

    const result = await downloadReportPdf(config.apiKey, reportId)

    if (!result.success || !result.data) {
      return res.status(404).json({ error: result.error || 'Report not available' })
    }

    res.setHeader('Content-Type', result.contentType || 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="inspection-report-${reportId}.pdf"`)
    res.send(result.data)
  } catch (error) {
    console.error('[IG] Error downloading report:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

export default router

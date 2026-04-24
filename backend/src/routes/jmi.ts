import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import {
  getCompanyJMIConfig,
  submitMove,
  getMoveStatus,
  cancelMove,
  requestVoid,
  getVoidStatus,
  cancelVoid,
  submitMeterReadings,
  getMeters,
  getMeterReadings,
  updateMoveDates,
  updateMoveMeters,
  JMIMovePayload
} from '../services/jmiService'
import { decrypt } from '../services/encryption'

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

async function getTenancyWithDetails(tenancyId: string, companyId: string) {
  const { data: tenancy, error } = await supabase
    .from('tenancies')
    .select(`
      *,
      properties(id, postcode, address_line1_encrypted, address_line2_encrypted, city_encrypted, county_encrypted, management_type, uprn),
      tenancy_tenants(*)
    `)
    .eq('id', tenancyId)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .single()

  if (error || !tenancy) return null
  return tenancy
}

function getLeadTenant(tenants: any[]): any | null {
  if (!tenants || tenants.length === 0) return null
  // Find lead tenant (tenant_order === 1) with active status
  const lead = tenants.find((t: any) => t.tenant_order === 1 && t.is_active)
  return lead || tenants.find((t: any) => t.is_active) || tenants[0]
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/jmi/status/:tenancyId
 * Get JMI move status for a tenancy
 */
router.get('/status/:tenancyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyJMIConfig(companyId)

    // Get local move records
    const { data: moves } = await supabase
      .from('jmi_moves')
      .select('*')
      .eq('tenancy_id', req.params.tenancyId)
      .eq('company_id', companyId)

    res.json({
      configured: !!config,
      moves: moves || []
    })
  } catch (error) {
    console.error('[JMI] Error getting status:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * POST /api/jmi/submit/:tenancyId
 * Submit a move to JMI
 */
router.post('/submit/:tenancyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyJMIConfig(companyId)
    if (!config) {
      return res.status(400).json({ error: 'JMI is not configured. Please set up the integration in Settings first.' })
    }

    const { moveType, gdprConsent, moveOutDate, meterData } = req.body

    if (!moveType || !['movein', 'moveout'].includes(moveType)) {
      return res.status(400).json({ error: 'Invalid move type. Must be movein or moveout.' })
    }

    if (!gdprConsent) {
      return res.status(400).json({ error: 'GDPR consent is required before submitting to JMI.' })
    }

    // Check for existing move of same type
    const { data: existingMove } = await supabase
      .from('jmi_moves')
      .select('id, status')
      .eq('tenancy_id', req.params.tenancyId)
      .eq('move_type', moveType)
      .single()

    if (existingMove && existingMove.status !== 'cancelled') {
      return res.status(400).json({ error: `A ${moveType} has already been submitted for this tenancy.` })
    }

    // Get company name for agency_name field
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted')
      .eq('id', companyId)
      .single()
    const agencyName = company?.name_encrypted ? decrypt(company.name_encrypted) : ''

    // Get tenancy details
    const tenancy = await getTenancyWithDetails(req.params.tenancyId, companyId)
    if (!tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    const leadTenant = getLeadTenant(tenancy.tenancy_tenants)
    if (!leadTenant) {
      return res.status(400).json({ error: 'No tenant found for this tenancy.' })
    }

    const tenantName = decrypt(leadTenant.tenant_name_encrypted) || ''
    const tenantEmail = decrypt(leadTenant.tenant_email_encrypted) || ''
    const tenantPhone = decrypt(leadTenant.tenant_phone_encrypted) || ''

    if (!tenantEmail) {
      return res.status(400).json({ error: 'Lead tenant must have an email address to submit to JMI.' })
    }

    const nameParts = tenantName.trim().split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    const addressLine1 = tenancy.properties?.address_line1_encrypted
      ? decrypt(tenancy.properties.address_line1_encrypted) || ''
      : ''
    const addressLine2 = tenancy.properties?.address_line2_encrypted
      ? decrypt(tenancy.properties.address_line2_encrypted) || ''
      : ''
    const city = tenancy.properties?.city_encrypted
      ? decrypt(tenancy.properties.city_encrypted) || ''
      : ''
    const county = tenancy.properties?.county_encrypted
      ? decrypt(tenancy.properties.county_encrypted) || ''
      : ''
    const postcode = tenancy.properties?.postcode || ''

    // DB columns are tenancy_start_date / tenancy_end_date (not start_date / end_date)
    const rawMoveDate = moveType === 'movein'
      ? (tenancy.tenancy_start_date || tenancy.start_date)
      : moveOutDate || (tenancy.tenancy_end_date || tenancy.end_date) || new Date().toISOString().split('T')[0]
    const moveDate = rawMoveDate ? String(rawMoveDate).split('T')[0] : null

    if (!moveDate) {
      return res.status(400).json({ error: 'Move date is not set. Please set a start date on the tenancy before submitting to JMI.' })
    }

    // Build additional tenants array (excluding lead tenant)
    const activeTenants = (tenancy.tenancy_tenants || []).filter((t: any) => t.is_active)
    const additionalTenants = activeTenants
      .filter((t: any) => t.id !== leadTenant.id)
      .map((t: any) => {
        const name = decrypt(t.tenant_name_encrypted) || ''
        const parts = name.trim().split(' ')
        return {
          firstname: parts[0] || '',
          lastname: parts.slice(1).join(' ') || '',
          email: decrypt(t.tenant_email_encrypted) || '',
          phone: decrypt(t.tenant_phone_encrypted) || ''
        }
      })

    // Build move event (movein or moveout)
    const moveEvent = {
      active: 1 as const,
      movetype: (tenancy.tenancy_type === 'sale' ? 'sale' : 'letting') as 'sale' | 'letting',
      movedate: moveDate,
      movedate_confirmed: 1,
      managed: (tenancy.management_type || tenancy.properties?.management_type) === 'managed' ? 1 : 0,
      address1: addressLine1,
      address2: addressLine2 || undefined,
      city,
      county: county || undefined,
      postcode,
      country: 'United Kingdom',
      uprn: tenancy.properties?.uprn || undefined,
      single_occupancy: activeTenants.length <= 1 ? 1 : 0,
      tenants: additionalTenants.length > 0 ? additionalTenants : undefined,
      // Meter info if provided
      ...(meterData?.gas_mprn ? {
        gas_additional_information: {
          mprn: meterData.gas_mprn,
          serial_number: meterData.gas_serial_number || undefined,
          partner_meter_read: meterData.gas_reading || undefined,
          partner_meter_read_date: meterData.gas_reading_date || undefined
        }
      } : {}),
      ...(meterData?.elec_mpan ? {
        elec_additional_information: {
          mpan: meterData.elec_mpan,
          serial_number: meterData.elec_serial_number || undefined,
          profile_class: meterData.elec_profile_class || undefined,
          partner_meter_read: meterData.elec_reading || undefined,
          partner_meter_read_date: meterData.elec_reading_date || undefined
        }
      } : {})
    }

    const payload: JMIMovePayload = {
      partner_move_identifier: req.params.tenancyId,
      agency_name: agencyName || undefined,
      customer: {
        gdpr_consent: true,
        email: tenantEmail,
        firstname: firstName,
        lastname: lastName,
        phone: tenantPhone || ''
      },
      ...(moveType === 'movein'
        ? { movein: moveEvent }
        : { moveout: moveEvent }
      )
    }

    console.log('[JMI] Submitting move payload:', JSON.stringify(payload, null, 2))
    const result = await submitMove(config.apiKey, config.environment, payload)

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to submit move to JMI' })
    }

    // If there was a cancelled move, delete it first so we can insert fresh
    if (existingMove && existingMove.status === 'cancelled') {
      await supabase
        .from('jmi_moves')
        .delete()
        .eq('id', existingMove.id)
    }

    // Save to local DB
    const { error: insertError } = await supabase
      .from('jmi_moves')
      .insert({
        company_id: companyId,
        tenancy_id: req.params.tenancyId,
        jmi_move_id: result.data?.id || result.data?.move_id,
        partner_move_identifier: req.params.tenancyId,
        move_type: moveType,
        status: 'submitted',
        jmi_status: result.data,
        customer_intro_url: result.data?.customer_intro_url || null,
        submitted_at: new Date().toISOString(),
        gas_mprn: meterData?.gas_mprn || null,
        gas_serial_number: meterData?.gas_serial_number || null,
        elec_mpan: meterData?.elec_mpan || null,
        elec_serial_number: meterData?.elec_serial_number || null,
        elec_profile_class: meterData?.elec_profile_class || null
      })

    if (insertError) {
      console.error('[JMI] Error saving move record:', insertError)
    }

    res.json({
      success: true,
      move: result.data
    })
  } catch (error) {
    console.error('[JMI] Error submitting move:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * POST /api/jmi/cancel/:tenancyId
 * Cancel a JMI move
 */
router.post('/cancel/:tenancyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyJMIConfig(companyId)
    if (!config) {
      return res.status(400).json({ error: 'JMI is not configured' })
    }

    const { moveType } = req.body

    const { data: move } = await supabase
      .from('jmi_moves')
      .select('*')
      .eq('tenancy_id', req.params.tenancyId)
      .eq('company_id', companyId)
      .eq('move_type', moveType || 'movein')
      .single()

    if (!move || !move.jmi_move_id) {
      return res.status(404).json({ error: 'No JMI move found for this tenancy' })
    }

    const result = await cancelMove(config.apiKey, config.environment, move.jmi_move_id)

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to cancel move' })
    }

    await supabase
      .from('jmi_moves')
      .update({
        status: 'cancelled',
        jmi_status: result.data,
        updated_at: new Date().toISOString()
      })
      .eq('id', move.id)

    res.json({ success: true })
  } catch (error) {
    console.error('[JMI] Error cancelling move:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * POST /api/jmi/refresh/:tenancyId
 * Refresh JMI move status from API
 */
router.post('/refresh/:tenancyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyJMIConfig(companyId)
    if (!config) {
      return res.status(400).json({ error: 'JMI is not configured' })
    }

    const { data: moves } = await supabase
      .from('jmi_moves')
      .select('*')
      .eq('tenancy_id', req.params.tenancyId)
      .eq('company_id', companyId)

    if (!moves || moves.length === 0) {
      return res.status(404).json({ error: 'No JMI moves found for this tenancy' })
    }

    const updatedMoves = []
    for (const move of moves) {
      if (!move.jmi_move_id || move.status === 'cancelled') {
        updatedMoves.push(move)
        continue
      }

      const result = await getMoveStatus(config.apiKey, config.environment, move.jmi_move_id)
      if (result.success && result.data) {
        const newStatus = result.data.status || move.status

        await supabase
          .from('jmi_moves')
          .update({
            status: newStatus,
            jmi_status: result.data,
            customer_intro_url: result.data.customer_intro_url || move.customer_intro_url,
            updated_at: new Date().toISOString()
          })
          .eq('id', move.id)

        updatedMoves.push({ ...move, status: newStatus, jmi_status: result.data })
      } else {
        updatedMoves.push(move)
      }
    }

    res.json({ moves: updatedMoves })
  } catch (error) {
    console.error('[JMI] Error refreshing status:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * POST /api/jmi/update-dates/:tenancyId
 * Update move dates on JMI
 */
router.post('/update-dates/:tenancyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyJMIConfig(companyId)
    if (!config) {
      return res.status(400).json({ error: 'JMI is not configured' })
    }

    const { data: move } = await supabase
      .from('jmi_moves')
      .select('*')
      .eq('tenancy_id', req.params.tenancyId)
      .eq('company_id', companyId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!move || !move.jmi_move_id) {
      return res.status(404).json({ error: 'No JMI move found for this tenancy' })
    }

    const { moveOutDate } = req.body
    if (!moveOutDate) {
      return res.status(400).json({ error: 'Move out date is required' })
    }

    const moveoutData = { movedate: moveOutDate, movedate_confirmed: true }
    const result = await updateMoveDates(config.apiKey, config.environment, move.jmi_move_id, undefined, moveoutData)

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to update dates' })
    }

    await supabase
      .from('jmi_moves')
      .update({
        jmi_status: result.data,
        updated_at: new Date().toISOString()
      })
      .eq('id', move.id)

    res.json({ success: true })
  } catch (error) {
    console.error('[JMI] Error updating dates:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * POST /api/jmi/void/:tenancyId
 * Request void energy switch
 */
router.post('/void/:tenancyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyJMIConfig(companyId)
    if (!config) {
      return res.status(400).json({ error: 'JMI is not configured' })
    }

    // Find the moveout move for this tenancy
    const { data: move } = await supabase
      .from('jmi_moves')
      .select('*')
      .eq('tenancy_id', req.params.tenancyId)
      .eq('company_id', companyId)
      .in('move_type', ['moveout', 'movein'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!move || !move.jmi_move_id) {
      return res.status(404).json({ error: 'No JMI move found for this tenancy' })
    }

    // Include landlord_address in void payload if send_bills_to is landlord
    const voidPayload = { ...(req.body || {}) }
    if (voidPayload.landlord_address && voidPayload.send_bills_to !== 'landlord') {
      delete voidPayload.landlord_address
    }
    const result = await requestVoid(config.apiKey, config.environment, move.jmi_move_id, voidPayload)

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to request void' })
    }

    await supabase
      .from('jmi_moves')
      .update({
        void_status: result.data,
        updated_at: new Date().toISOString()
      })
      .eq('id', move.id)

    res.json({ success: true, void: result.data })
  } catch (error) {
    console.error('[JMI] Error requesting void:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * GET /api/jmi/void/:tenancyId
 * Get void status
 */
router.get('/void/:tenancyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyJMIConfig(companyId)
    if (!config) {
      return res.status(400).json({ error: 'JMI is not configured' })
    }

    const { data: move } = await supabase
      .from('jmi_moves')
      .select('*')
      .eq('tenancy_id', req.params.tenancyId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!move || !move.jmi_move_id) {
      return res.status(404).json({ error: 'No JMI move found for this tenancy' })
    }

    const result = await getVoidStatus(config.apiKey, config.environment, move.jmi_move_id)

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to get void status' })
    }

    await supabase
      .from('jmi_moves')
      .update({
        void_status: result.data,
        updated_at: new Date().toISOString()
      })
      .eq('id', move.id)

    res.json({ void: result.data })
  } catch (error) {
    console.error('[JMI] Error getting void status:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * DELETE /api/jmi/void/:tenancyId
 * Cancel void
 */
router.delete('/void/:tenancyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyJMIConfig(companyId)
    if (!config) {
      return res.status(400).json({ error: 'JMI is not configured' })
    }

    const { data: move } = await supabase
      .from('jmi_moves')
      .select('*')
      .eq('tenancy_id', req.params.tenancyId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!move || !move.jmi_move_id) {
      return res.status(404).json({ error: 'No JMI move found for this tenancy' })
    }

    const result = await cancelVoid(config.apiKey, config.environment, move.jmi_move_id)

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to cancel void' })
    }

    await supabase
      .from('jmi_moves')
      .update({
        void_status: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', move.id)

    res.json({ success: true })
  } catch (error) {
    console.error('[JMI] Error cancelling void:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * GET /api/jmi/meters/:tenancyId
 * Get meters for a move
 */
router.get('/meters/:tenancyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyJMIConfig(companyId)
    if (!config) {
      return res.status(400).json({ error: 'JMI is not configured' })
    }

    const { data: move } = await supabase
      .from('jmi_moves')
      .select('*')
      .eq('tenancy_id', req.params.tenancyId)
      .eq('company_id', companyId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!move || !move.jmi_move_id) {
      return res.status(404).json({ error: 'No JMI move found for this tenancy' })
    }

    const result = await getMeters(config.apiKey, config.environment, move.jmi_move_id)

    if (!result.success) {
      return res.status(400).json({ error: result.error })
    }

    res.json(result.data)
  } catch (error) {
    console.error('[JMI] Error getting meters:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * GET /api/jmi/readings/:tenancyId
 * Get meter readings for a move
 */
router.get('/readings/:tenancyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyJMIConfig(companyId)
    if (!config) {
      return res.status(400).json({ error: 'JMI is not configured' })
    }

    const { data: move } = await supabase
      .from('jmi_moves')
      .select('*')
      .eq('tenancy_id', req.params.tenancyId)
      .eq('company_id', companyId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!move || !move.jmi_move_id) {
      return res.status(404).json({ error: 'No JMI move found for this tenancy' })
    }

    const result = await getMeterReadings(config.apiKey, config.environment, move.jmi_move_id)

    if (!result.success) {
      return res.status(400).json({ error: result.error })
    }

    res.json(result.data)
  } catch (error) {
    console.error('[JMI] Error getting readings:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * POST /api/jmi/readings/:tenancyId
 * Submit meter readings
 */
router.post('/readings/:tenancyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyJMIConfig(companyId)
    if (!config) {
      return res.status(400).json({ error: 'JMI is not configured' })
    }

    const { data: move } = await supabase
      .from('jmi_moves')
      .select('*')
      .eq('tenancy_id', req.params.tenancyId)
      .eq('company_id', companyId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!move || !move.jmi_move_id) {
      return res.status(404).json({ error: 'No JMI move found for this tenancy' })
    }

    const { gas, electricity, gas_serial_number, elec_serial_number, elec_profile_class } = req.body
    const readingsPayload = { gas, electricity }
    const result = await submitMeterReadings(config.apiKey, config.environment, move.jmi_move_id, readingsPayload)

    if (!result.success) {
      return res.status(400).json({ error: result.error })
    }

    // Also update the move with meter data (fire-and-forget)
    try {
      const meterUpdate: any = {}
      if (gas && gas.length > 0) {
        meterUpdate.gas_additional_information = {
          mprn: gas[0].mprn,
          serial_number: gas_serial_number || undefined,
          partner_meter_read: gas[0].reading,
          partner_meter_read_date: gas[0].reading_date
        }
      }
      if (electricity && electricity.length > 0) {
        meterUpdate.elec_additional_information = {
          mpan: electricity[0].mpan,
          serial_number: elec_serial_number || undefined,
          profile_class: elec_profile_class || electricity[0].profile_class || undefined,
          partner_meter_read: electricity[0].reading,
          partner_meter_read_date: electricity[0].reading_date
        }
      }
      if (Object.keys(meterUpdate).length > 0) {
        const isMovein = move.move_type === 'movein'
        await updateMoveMeters(
          config.apiKey, config.environment, move.jmi_move_id,
          isMovein ? meterUpdate : undefined,
          !isMovein ? meterUpdate : undefined
        )
        // Save meter identifiers to local DB
        const dbUpdate: any = { updated_at: new Date().toISOString() }
        if (gas?.[0]?.mprn) dbUpdate.gas_mprn = gas[0].mprn
        if (gas_serial_number) dbUpdate.gas_serial_number = gas_serial_number
        if (electricity?.[0]?.mpan) dbUpdate.elec_mpan = electricity[0].mpan
        if (elec_serial_number) dbUpdate.elec_serial_number = elec_serial_number
        if (elec_profile_class) dbUpdate.elec_profile_class = elec_profile_class
        await supabase.from('jmi_moves').update(dbUpdate).eq('id', move.id)
      }
    } catch (meterErr) {
      console.error('[JMI] Failed to update move meters (non-blocking):', meterErr)
    }

    res.json({ success: true, data: result.data })
  } catch (error) {
    console.error('[JMI] Error submitting readings:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

// ============================================================================
// METER INFO (save/load meter metadata for draft + active tenancies)
// ============================================================================

/**
 * GET /api/jmi/meter-info/:tenancyId
 * Load saved meter metadata
 */
router.get('/meter-info/:tenancyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)
    if (!companyId) return res.status(404).json({ error: 'Company not found' })

    const { data: move } = await supabase
      .from('jmi_moves')
      .select('gas_mprn, gas_serial_number, elec_mpan, elec_serial_number, elec_profile_class')
      .eq('tenancy_id', req.params.tenancyId)
      .eq('company_id', companyId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    res.json({
      gas_mprn: move?.gas_mprn || '',
      gas_serial_number: move?.gas_serial_number || '',
      elec_mpan: move?.elec_mpan || '',
      elec_serial_number: move?.elec_serial_number || '',
      elec_profile_class: move?.elec_profile_class || ''
    })
  } catch (error) {
    console.error('[JMI] Error loading meter info:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * PUT /api/jmi/meter-info/:tenancyId
 * Save meter metadata (upserts on jmi_moves — creates draft record if none exists)
 */
router.put('/meter-info/:tenancyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)
    if (!companyId) return res.status(404).json({ error: 'Company not found' })

    const { gas_mprn, gas_serial_number, elec_mpan, elec_serial_number, elec_profile_class } = req.body

    // Try to update existing record first
    const { data: existing } = await supabase
      .from('jmi_moves')
      .select('id, status')
      .eq('tenancy_id', req.params.tenancyId)
      .eq('company_id', companyId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const meterFields = {
      gas_mprn: gas_mprn || null,
      gas_serial_number: gas_serial_number || null,
      elec_mpan: elec_mpan || null,
      elec_serial_number: elec_serial_number || null,
      elec_profile_class: elec_profile_class || null,
      updated_at: new Date().toISOString()
    }

    if (existing) {
      await supabase.from('jmi_moves').update(meterFields).eq('id', existing.id)
    } else {
      // Create a draft record to store meter info before move submission
      await supabase.from('jmi_moves').insert({
        company_id: companyId,
        tenancy_id: req.params.tenancyId,
        partner_move_identifier: req.params.tenancyId,
        move_type: 'movein',
        status: 'draft',
        ...meterFields
      })
    }

    res.json({ success: true })
  } catch (error) {
    console.error('[JMI] Error saving meter info:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

// ============================================================================
// VOID DEFAULTS (auto-populate void form based on management type)
// ============================================================================

/**
 * GET /api/jmi/void-defaults/:tenancyId
 * Returns pre-populated void form data based on management type
 */
router.get('/void-defaults/:tenancyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)
    if (!companyId) return res.status(404).json({ error: 'Company not found' })

    const tenancy = await getTenancyWithDetails(req.params.tenancyId, companyId)
    if (!tenancy) return res.status(404).json({ error: 'Tenancy not found' })

    const managementType = tenancy.management_type || tenancy.properties?.management_type || 'let_only'
    const endDate = (tenancy.tenancy_end_date || tenancy.end_date || '').toString().split('T')[0]

    if (managementType === 'managed') {
      // Get company/agent details
      const { data: company } = await supabase
        .from('companies')
        .select('name_encrypted, email, phone')
        .eq('id', companyId)
        .single()

      const companyName = company?.name_encrypted ? decrypt(company.name_encrypted) : ''

      res.json({
        send_bills_to: 'agency',
        contact_name: companyName,
        contact_email: company?.email || '',
        contact_phone: company?.phone || '',
        movedate: endDate
      })
    } else {
      // Get landlord details from property
      const { data: propertyLandlords } = await supabase
        .from('property_landlords')
        .select(`
          is_primary_contact,
          landlords (
            first_name_encrypted, last_name_encrypted,
            email_encrypted, phone_encrypted,
            residential_address_line1_encrypted,
            residential_city_encrypted,
            residential_postcode_encrypted
          )
        `)
        .eq('property_id', tenancy.properties?.id)
        .order('is_primary_contact', { ascending: false })
        .limit(1)

      const landlord = (propertyLandlords as any)?.[0]?.landlords
      const llFirstName = landlord?.first_name_encrypted ? decrypt(landlord.first_name_encrypted) : ''
      const llLastName = landlord?.last_name_encrypted ? decrypt(landlord.last_name_encrypted) : ''
      const llName = `${llFirstName} ${llLastName}`.trim()
      const llEmail = landlord?.email_encrypted ? decrypt(landlord.email_encrypted) : ''
      const llPhone = landlord?.phone_encrypted ? decrypt(landlord.phone_encrypted) : ''
      const llAddress1 = landlord?.residential_address_line1_encrypted ? decrypt(landlord.residential_address_line1_encrypted) : ''
      const llCity = landlord?.residential_city_encrypted ? decrypt(landlord.residential_city_encrypted) : ''
      const llPostcode = landlord?.residential_postcode_encrypted ? decrypt(landlord.residential_postcode_encrypted) : ''

      res.json({
        send_bills_to: 'landlord',
        contact_name: llName,
        contact_email: llEmail,
        contact_phone: llPhone,
        movedate: endDate,
        landlord_address: {
          address1: llAddress1,
          city: llCity,
          postcode: llPostcode
        }
      })
    }
  } catch (error) {
    console.error('[JMI] Error getting void defaults:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

export default router

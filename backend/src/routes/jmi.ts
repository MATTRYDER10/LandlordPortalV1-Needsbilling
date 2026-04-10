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
      properties(id, postcode, address_line1_encrypted, address_line2_encrypted, city_encrypted, county_encrypted),
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

    const { moveType, gdprConsent, moveOutDate } = req.body

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

    const moveDate = moveType === 'movein'
      ? tenancy.start_date
      : moveOutDate || tenancy.end_date || new Date().toISOString().split('T')[0]

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
      managed: 1,
      address1: addressLine1,
      address2: addressLine2 || undefined,
      city,
      county: county || undefined,
      postcode,
      country: 'United Kingdom',
      single_occupancy: activeTenants.length <= 1 ? 1 : 0,
      tenants: additionalTenants.length > 0 ? additionalTenants : undefined
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
        submitted_at: new Date().toISOString()
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

    const result = await requestVoid(config.apiKey, config.environment, move.jmi_move_id, req.body || {})

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

    const result = await submitMeterReadings(config.apiKey, config.environment, move.jmi_move_id, req.body)

    if (!result.success) {
      return res.status(400).json({ error: result.error })
    }

    res.json({ success: true, data: result.data })
  } catch (error) {
    console.error('[JMI] Error submitting readings:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

export default router

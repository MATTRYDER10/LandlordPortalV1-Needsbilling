import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import { decrypt } from '../services/encryption'
import {
  getCompanyTDSConfig,
  createDeposit,
  pollDepositStatus,
  downloadDPC,
  getTDSRegistration,
  saveTDSRegistration
} from '../services/tdsService'
import {
  getCompanyTDSInsuredConfig,
  createInsuredDeposit,
  pollInsuredDepositStatus,
  downloadInsuredCertificate
} from '../services/tdsInsuredService'

const router = Router()

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get company ID for the authenticated user, supporting multi-branch users
 * Checks X-Branch-Id header first, then falls back to first company
 */
async function getUserCompanyId(req: AuthRequest): Promise<string | null> {
  const userId = req.user?.id
  if (!userId) return null

  const branchId = req.headers['x-branch-id'] as string | undefined

  if (branchId) {
    // Verify user belongs to this branch
    const { data: branchMembership } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .eq('company_id', branchId)
      .limit(1)

    if (branchMembership && branchMembership.length > 0) {
      return branchMembership[0].company_id
    }
  }

  // Fallback: Get user's first company (don't use .single() for multi-branch users)
  const { data: companyUsers } = await supabase
    .from('company_users')
    .select('company_id')
    .eq('user_id', userId)
    .limit(1)

  return companyUsers && companyUsers.length > 0 ? companyUsers[0].company_id : null
}

/**
 * Get tenancy data with property, tenants, and landlords
 */
async function getTenancyWithDetails(tenancyId: string, companyId: string) {
  const { data: tenancy, error: tenancyError } = await supabase
    .from('tenancies')
    .select(`
      *,
      property:properties(*),
      tenants:tenancy_tenants(*)
    `)
    .eq('id', tenancyId)
    .single()

  if (tenancyError || !tenancy) {
    return { error: 'Tenancy not found' }
  }

  // Verify tenancy belongs to company
  if (tenancy.property.company_id !== companyId) {
    return { error: 'Access denied' }
  }

  // Get landlords linked to property
  const { data: propertyLandlords } = await supabase
    .from('property_landlords')
    .select('landlord_id, is_primary, landlords(*)')
    .eq('property_id', tenancy.property.id)

  const landlords = propertyLandlords?.map(pl => ({
    ...(pl.landlords as any),
    is_primary: pl.is_primary
  })) || []

  return {
    tenancy: {
      ...tenancy,
      landlords
    }
  }
}

/**
 * Save registration and update tenancy
 */
async function saveRegistrationAndUpdateTenancy(
  tenancyId: string,
  companyId: string,
  userId: string,
  dan: string,
  referenceId: string | null,
  depositAmount: number,
  depositReceivedDate: string,
  schemeType: 'custodial' | 'insured',
  rawResponse: any
) {
  // Check if we have an existing pending registration to update
  const { data: existingReg } = await supabase
    .from('tds_registrations')
    .select('id')
    .eq('tenancy_id', tenancyId)
    .eq('status', 'pending')
    .single()

  if (existingReg) {
    // Update the existing pending registration
    await supabase
      .from('tds_registrations')
      .update({
        dan,
        status: 'registered',
        raw_response: rawResponse,
        registered_at: new Date().toISOString()
      })
      .eq('id', existingReg.id)
  } else {
    // Insert new registration record (fallback for legacy flow)
    await supabase
      .from('tds_registrations')
      .insert({
        tenancy_id: tenancyId,
        company_id: companyId,
        registered_by: userId,
        dan,
        batch_id: referenceId,
        deposit_amount: depositAmount,
        deposit_received_date: depositReceivedDate,
        status: 'registered',
        scheme_type: schemeType,
        raw_response: rawResponse
      })
  }

  // Update tenancy deposit protection status
  await supabase
    .from('tenancies')
    .update({
      deposit_scheme: schemeType === 'custodial' ? 'tds_custodial' : 'tds_insured',
      deposit_reference: dan,
      deposit_protected_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', tenancyId)

  // Add activity log entry
  const schemeName = schemeType === 'custodial' ? 'TDS Custodial' : 'TDS Insured'
  await supabase
    .from('tenancy_activity')
    .insert({
      tenancy_id: tenancyId,
      action: 'DEPOSIT_REGISTERED_TDS',
      category: 'payment',
      title: `Deposit Registered with ${schemeName}`,
      description: `Deposit registered with ${schemeName}. DAN: ${dan}`,
      metadata: {
        dan,
        reference_id: referenceId,
        scheme: schemeName,
        scheme_type: schemeType
      },
      performed_by: userId,
      is_system_action: false
    })
}

// ============================================================================
// UNIFIED CONFIG STATUS
// ============================================================================

/**
 * GET /api/tds/config-status
 * Get configuration status for all TDS schemes
 */
router.get('/config-status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const custodialConfig = await getCompanyTDSConfig(companyId)
    const insuredConfig = await getCompanyTDSInsuredConfig(companyId)

    res.json({
      custodial: {
        configured: !!custodialConfig,
        environment: custodialConfig?.environment || null
      },
      insured: {
        configured: !!(insuredConfig?.clientId && insuredConfig?.memberId),
        authorized: !!insuredConfig?.accessToken,
        environment: insuredConfig?.environment || null
      },
      // Legacy format
      configured: !!custodialConfig || !!(insuredConfig?.accessToken),
      environment: custodialConfig?.environment || insuredConfig?.environment || null
    })
  } catch (error) {
    console.error('Error checking TDS config status:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

// ============================================================================
// TDS CUSTODIAL ROUTES
// ============================================================================

/**
 * POST /api/tds/custodial/create-deposit
 * Register a deposit with TDS Custodial
 */
router.post('/custodial/create-deposit', authenticateToken, async (req: AuthRequest, res) => {
  console.log('[TDS] ===== CREATE DEPOSIT ENDPOINT HIT =====')
  console.log('[TDS] Request body:', JSON.stringify(req.body))
  try {
    const userId = req.user?.id
    const { tenancyId, depositReceivedDate, furnishedStatus } = req.body

    if (!tenancyId) {
      return res.status(400).json({ error: 'Tenancy ID is required' })
    }

    if (!depositReceivedDate) {
      return res.status(400).json({ error: 'Deposit received date is required' })
    }

    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyTDSConfig(companyId)
    if (!config) {
      return res.status(400).json({ error: 'TDS Custodial is not configured. Please set up in Settings.' })
    }

    const existingRegistration = await getTDSRegistration(tenancyId)
    console.log('[TDS] Existing registration check:', existingRegistration ? JSON.stringify(existingRegistration) : 'none')
    if (existingRegistration) {
      // If already completed with a DAN, don't allow re-registration
      if (existingRegistration.status === 'registered' && existingRegistration.dan) {
        console.log('[TDS] Already registered with DAN:', existingRegistration.dan)
        return res.status(400).json({
          error: 'This deposit is already registered with TDS',
          dan: existingRegistration.dan
        })
      }
      // If pending, return the existing batch_id so frontend can continue polling
      if (existingRegistration.status === 'pending' && existingRegistration.batch_id) {
        console.log('[TDS] Found pending registration, returning existing batch_id:', existingRegistration.batch_id)
        return res.json({
          success: true,
          batchId: existingRegistration.batch_id,
          schemeType: 'custodial',
          message: 'Deposit already submitted. Polling for completion...'
        })
      }
    }

    const tenancyResult = await getTenancyWithDetails(tenancyId, companyId)
    if (tenancyResult.error) {
      return res.status(404).json({ error: tenancyResult.error })
    }

    console.log('[TDS Custodial] Creating deposit for tenancy:', tenancyId)

    const createResult = await createDeposit(
      companyId,
      tenancyResult.tenancy,
      depositReceivedDate,
      furnishedStatus || 'furnished'
    )

    console.log('[TDS Custodial] createDeposit result:', JSON.stringify(createResult))

    if (!createResult.success || !createResult.batchId) {
      return res.status(400).json({ error: createResult.error || 'Failed to create deposit with TDS' })
    }

    // Save a pending registration immediately so we have a record even if polling times out
    console.log('[TDS] Saving pending registration for batch:', createResult.batchId)
    const { error: insertError } = await supabase
      .from('tds_registrations')
      .insert({
        tenancy_id: tenancyId,
        company_id: companyId,
        registered_by: userId,
        batch_id: createResult.batchId,
        deposit_amount: Number(tenancyResult.tenancy.deposit_amount) || 0,
        deposit_received_date: depositReceivedDate,
        status: 'pending',
        scheme_type: 'custodial'
      })

    if (insertError) {
      console.error('[TDS] Failed to save pending registration:', insertError)
    } else {
      console.log('[TDS] Pending registration saved successfully')
    }

    res.json({
      success: true,
      batchId: createResult.batchId,
      schemeType: 'custodial',
      message: 'Deposit submitted to TDS Custodial. Polling for completion...'
    })
  } catch (error) {
    console.error('Error creating TDS Custodial deposit:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * GET /api/tds/custodial/deposit-status/:batchId
 * Poll for TDS Custodial deposit status
 */
router.get('/custodial/deposit-status/:batchId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const { batchId } = req.params
    const { tenancyId, depositAmount, depositReceivedDate } = req.query

    console.log('[TDS Custodial] Polling status for batchId:', batchId)

    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Poll TDS multiple times per request (10 attempts, 3 seconds apart = 30 seconds max)
    console.log('[TDS Custodial] Starting polling for batchId:', batchId)
    const statusResult = await pollDepositStatus(companyId, batchId, 10, 3000)

    console.log('[TDS Custodial] pollDepositStatus result:', JSON.stringify(statusResult))

    if (statusResult.success && statusResult.dan) {
      if (tenancyId) {
        await saveRegistrationAndUpdateTenancy(
          tenancyId as string,
          companyId,
          userId!,
          statusResult.dan,
          batchId,
          Number(depositAmount) || 0,
          (depositReceivedDate as string) || new Date().toISOString().split('T')[0],
          'custodial',
          statusResult.rawResponse
        )
      }

      res.json({
        success: true,
        status: 'complete',
        dan: statusResult.dan,
        schemeType: 'custodial'
      })
    } else if (statusResult.status === 'failed') {
      res.json({ success: false, status: 'failed', error: statusResult.error })
    } else if (statusResult.status === 'timeout') {
      res.json({ success: false, status: 'timeout', error: statusResult.error })
    } else {
      res.json({ success: false, status: 'pending', message: 'Still processing...' })
    }
  } catch (error) {
    console.error('Error polling TDS Custodial deposit status:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * GET /api/tds/custodial/certificate/:dan
 * Download TDS Custodial DPC certificate
 */
router.get('/custodial/certificate/:dan', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { dan } = req.params

    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { data: registration, error: regError } = await supabase
      .from('tds_registrations')
      .select('id')
      .eq('dan', dan)
      .eq('company_id', companyId)
      .single()

    if (regError || !registration) {
      return res.status(404).json({ error: 'Registration not found' })
    }

    const result = await downloadDPC(companyId, dan)

    if (!result.success || !result.buffer) {
      return res.status(400).json({ error: result.error || 'Failed to download certificate' })
    }

    res.setHeader('Content-Type', result.contentType || 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="DPC-${dan}.pdf"`)
    res.send(result.buffer)
  } catch (error) {
    console.error('Error downloading TDS Custodial certificate:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

// ============================================================================
// TDS INSURED ROUTES
// ============================================================================

/**
 * POST /api/tds/insured/create-deposit
 * Register a deposit with TDS Insured
 */
router.post('/insured/create-deposit', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { tenancyId, depositReceivedDate } = req.body

    if (!tenancyId) {
      return res.status(400).json({ error: 'Tenancy ID is required' })
    }

    if (!depositReceivedDate) {
      return res.status(400).json({ error: 'Deposit received date is required' })
    }

    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyTDSInsuredConfig(companyId)
    if (!config || !config.accessToken) {
      return res.status(400).json({ error: 'TDS Insured is not configured or authorized. Please set up in Settings.' })
    }

    const existingRegistration = await getTDSRegistration(tenancyId)
    if (existingRegistration) {
      return res.status(400).json({
        error: 'This deposit is already registered with TDS',
        dan: existingRegistration.dan
      })
    }

    const tenancyResult = await getTenancyWithDetails(tenancyId, companyId)
    if (tenancyResult.error) {
      return res.status(404).json({ error: tenancyResult.error })
    }

    const createResult = await createInsuredDeposit(
      companyId,
      tenancyResult.tenancy,
      depositReceivedDate
    )

    if (!createResult.success || !createResult.apiReference) {
      return res.status(400).json({ error: createResult.error || 'Failed to create deposit with TDS Insured' })
    }

    res.json({
      success: true,
      apiReference: createResult.apiReference,
      schemeType: 'insured',
      message: 'Deposit submitted to TDS Insured. Polling for completion...'
    })
  } catch (error) {
    console.error('Error creating TDS Insured deposit:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * GET /api/tds/insured/deposit-status/:apiReference
 * Poll for TDS Insured deposit status
 */
router.get('/insured/deposit-status/:apiReference', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const { apiReference } = req.params
    const { tenancyId, depositAmount, depositReceivedDate } = req.query

    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const statusResult = await pollInsuredDepositStatus(companyId, apiReference, 1, 0)

    if (statusResult.success && statusResult.dan) {
      if (tenancyId) {
        await saveRegistrationAndUpdateTenancy(
          tenancyId as string,
          companyId,
          userId!,
          statusResult.dan,
          apiReference,
          Number(depositAmount) || 0,
          (depositReceivedDate as string) || new Date().toISOString().split('T')[0],
          'insured',
          statusResult.rawResponse
        )
      }

      res.json({
        success: true,
        status: 'complete',
        dan: statusResult.dan,
        schemeType: 'insured'
      })
    } else if (statusResult.status === 'failed') {
      res.json({ success: false, status: 'failed', error: statusResult.error })
    } else if (statusResult.status === 'timeout') {
      res.json({ success: false, status: 'timeout', error: statusResult.error })
    } else {
      res.json({ success: false, status: 'pending', message: 'Still processing...' })
    }
  } catch (error) {
    console.error('Error polling TDS Insured deposit status:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * GET /api/tds/insured/certificate/:dan
 * Download TDS Insured certificate
 */
router.get('/insured/certificate/:dan', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { dan } = req.params

    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { data: registration, error: regError } = await supabase
      .from('tds_registrations')
      .select('id')
      .eq('dan', dan)
      .eq('company_id', companyId)
      .single()

    if (regError || !registration) {
      return res.status(404).json({ error: 'Registration not found' })
    }

    const result = await downloadInsuredCertificate(companyId, dan)

    if (!result.success || !result.buffer) {
      return res.status(400).json({ error: result.error || 'Failed to download certificate' })
    }

    res.setHeader('Content-Type', result.contentType || 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="Certificate-${dan}.pdf"`)
    res.send(result.buffer)
  } catch (error) {
    console.error('Error downloading TDS Insured certificate:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

// ============================================================================
// UNIFIED ROUTES (auto-detect scheme based on registration)
// ============================================================================

/**
 * GET /api/tds/registration/:tenancyId
 * Get existing TDS registration for a tenancy (any scheme)
 */
router.get('/registration/:tenancyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { tenancyId } = req.params

    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { data: registration, error: regError } = await supabase
      .from('tds_registrations')
      .select('*')
      .eq('tenancy_id', tenancyId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (regError && regError.code !== 'PGRST116') {
      console.error('Error fetching TDS registration:', regError)
    }

    if (!registration) {
      return res.json({ registration: null })
    }

    let registeredByName = 'Unknown'
    if (registration.registered_by) {
      const { data: userData } = await supabase.auth.admin.getUserById(registration.registered_by)
      if (userData?.user?.user_metadata) {
        const meta = userData.user.user_metadata
        registeredByName = meta.full_name || meta.name || 'Unknown'
      }
    }

    res.json({
      registration: {
        id: registration.id,
        dan: registration.dan,
        batchId: registration.batch_id,
        depositAmount: registration.deposit_amount,
        depositReceivedDate: registration.deposit_received_date,
        registeredAt: registration.registered_at,
        registeredByName,
        status: registration.status,
        schemeType: registration.scheme_type || 'custodial'
      }
    })
  } catch (error) {
    console.error('Error getting TDS registration:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * GET /api/tds/certificate/:dan
 * Download certificate (auto-detect scheme from registration)
 */
router.get('/certificate/:dan', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { dan } = req.params

    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { data: registration, error: regError } = await supabase
      .from('tds_registrations')
      .select('id, scheme_type')
      .eq('dan', dan)
      .eq('company_id', companyId)
      .single()

    if (regError || !registration) {
      return res.status(404).json({ error: 'Registration not found' })
    }

    const schemeType = registration.scheme_type || 'custodial'
    let result

    if (schemeType === 'insured') {
      result = await downloadInsuredCertificate(companyId, dan)
    } else {
      result = await downloadDPC(companyId, dan)
    }

    if (!result.success || !result.buffer) {
      return res.status(400).json({ error: result.error || 'Failed to download certificate' })
    }

    res.setHeader('Content-Type', result.contentType || 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="Certificate-${dan}.pdf"`)
    res.send(result.buffer)
  } catch (error) {
    console.error('Error downloading certificate:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

// ============================================================================
// LEGACY ROUTES (for backwards compatibility - map to Custodial)
// ============================================================================

router.post('/create-deposit', authenticateToken, async (req: AuthRequest, res) => {
  // Legacy route - maps to Custodial
  try {
    const { tenancyId, depositReceivedDate, furnishedStatus } = req.body

    if (!tenancyId) {
      return res.status(400).json({ error: 'Tenancy ID is required' })
    }

    if (!depositReceivedDate) {
      return res.status(400).json({ error: 'Deposit received date is required' })
    }

    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyTDSConfig(companyId)
    if (!config) {
      return res.status(400).json({ error: 'TDS Custodial is not configured. Please set up in Settings.' })
    }

    const existingRegistration = await getTDSRegistration(tenancyId)
    if (existingRegistration) {
      return res.status(400).json({
        error: 'This deposit is already registered with TDS',
        dan: existingRegistration.dan
      })
    }

    const tenancyResult = await getTenancyWithDetails(tenancyId, companyId)
    if (tenancyResult.error) {
      return res.status(404).json({ error: tenancyResult.error })
    }

    const createResult = await createDeposit(
      companyId,
      tenancyResult.tenancy,
      depositReceivedDate,
      furnishedStatus || 'furnished'
    )

    if (!createResult.success || !createResult.batchId) {
      return res.status(400).json({ error: createResult.error || 'Failed to create deposit with TDS' })
    }

    res.json({
      success: true,
      batchId: createResult.batchId,
      schemeType: 'custodial',
      message: 'Deposit submitted to TDS Custodial. Polling for completion...'
    })
  } catch (error) {
    console.error('Error creating TDS deposit (legacy):', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

router.get('/deposit-status/:batchId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const { batchId } = req.params
    const { tenancyId, depositAmount, depositReceivedDate } = req.query

    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Poll TDS multiple times per request (10 attempts, 3 seconds apart = 30 seconds max)
    const statusResult = await pollDepositStatus(companyId, batchId, 10, 3000)

    if (statusResult.success && statusResult.dan) {
      if (tenancyId) {
        await saveRegistrationAndUpdateTenancy(
          tenancyId as string,
          companyId,
          userId!,
          statusResult.dan,
          batchId,
          Number(depositAmount) || 0,
          (depositReceivedDate as string) || new Date().toISOString().split('T')[0],
          'custodial',
          statusResult.rawResponse
        )
      }

      res.json({ success: true, status: 'complete', dan: statusResult.dan })
    } else if (statusResult.status === 'failed') {
      res.json({ success: false, status: 'failed', error: statusResult.error })
    } else if (statusResult.status === 'timeout') {
      res.json({ success: false, status: 'timeout', error: statusResult.error })
    } else {
      res.json({ success: false, status: 'pending', message: 'Still processing...' })
    }
  } catch (error) {
    console.error('Error polling TDS deposit status:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

router.get('/dpc/:dan', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { dan } = req.params

    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { data: registration, error: regError } = await supabase
      .from('tds_registrations')
      .select('id')
      .eq('dan', dan)
      .eq('company_id', companyId)
      .single()

    if (regError || !registration) {
      return res.status(404).json({ error: 'Registration not found' })
    }

    const result = await downloadDPC(companyId, dan)

    if (!result.success || !result.buffer) {
      return res.status(400).json({ error: result.error || 'Failed to download DPC certificate' })
    }

    res.setHeader('Content-Type', result.contentType || 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="DPC-${dan}.pdf"`)
    res.send(result.buffer)
  } catch (error) {
    console.error('Error downloading DPC:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

export default router

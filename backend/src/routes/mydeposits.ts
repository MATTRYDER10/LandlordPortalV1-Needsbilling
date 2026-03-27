import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import {
  getCompanyMyDepositsConfig,
  registerDeposit,
  pollDepositStatus,
  downloadCertificate,
  getMyDepositsRegistration,
  savePendingMyDepositsRegistration,
  updateMyDepositsRegistration,
  markMyDepositsRegistrationFailed
} from '../services/mydepositsService'

const router = Router()

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get company ID for the authenticated user, supporting multi-branch users
 */
async function getUserCompanyId(req: AuthRequest): Promise<string | null> {
  const userId = req.user?.id
  if (!userId) return null

  const branchId = req.headers['x-branch-id'] as string | undefined

  if (branchId) {
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

  const { data: companyUsers } = await supabase
    .from('company_users')
    .select('company_id')
    .eq('user_id', userId)
    .limit(1)

  return companyUsers && companyUsers.length > 0 ? companyUsers[0].company_id : null
}

// ============================================================================
// CONFIG STATUS
// ============================================================================

/**
 * GET /api/mydeposits/config-status
 * Get configuration status for mydeposits
 */
router.get('/config-status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyMyDepositsConfig(companyId)

    res.json({
      configured: !!config?.clientId,
      authorized: !!config?.accessToken,
      schemeType: config?.schemeType || 'custodial',
      environment: config?.environment || null
    })
  } catch (error) {
    console.error('Error checking mydeposits config status:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

// ============================================================================
// DEPOSIT REGISTRATION
// ============================================================================

/**
 * POST /api/mydeposits/register/:tenancyId
 * Register a deposit with mydeposits
 */
router.post('/register/:tenancyId', authenticateToken, async (req: AuthRequest, res) => {
  console.log('[mydeposits] ===== REGISTER DEPOSIT ENDPOINT HIT =====')
  try {
    const userId = req.user?.id
    const { tenancyId } = req.params
    const { depositReceivedDate, property, tenancy, deposit, landlord, tenants } = req.body

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

    const config = await getCompanyMyDepositsConfig(companyId)
    if (!config || !config.accessToken) {
      return res.status(400).json({ error: 'mydeposits is not configured or authorized. Please set up in Settings.' })
    }

    // Check for existing registration
    const existingRegistration = await getMyDepositsRegistration(tenancyId)
    if (existingRegistration) {
      if (existingRegistration.status === 'registered' && existingRegistration.deposit_id) {
        return res.status(400).json({
          error: 'This deposit is already registered with mydeposits',
          depositId: existingRegistration.deposit_id
        })
      }
      if (existingRegistration.status === 'pending') {
        return res.json({
          success: true,
          status: 'pending',
          message: 'Deposit registration already in progress'
        })
      }
      // Delete failed registration so we can retry clean
      if (existingRegistration.status === 'failed') {
        await supabase
          .from('mydeposits_registrations')
          .delete()
          .eq('id', existingRegistration.id)
        console.log(`[mydeposits] Deleted failed registration ${existingRegistration.id} for retry`)
      }
    }

    // Validate form data
    if (!landlord || !landlord.firstName || !landlord.lastName) {
      return res.status(400).json({ error: 'Landlord details are required.' })
    }

    if (!tenants || tenants.length === 0) {
      return res.status(400).json({ error: 'At least one tenant is required.' })
    }

    const leadTenant = tenants.find((t: any) => t.isLead) || tenants[0]
    if (!leadTenant.firstName || !leadTenant.lastName) {
      return res.status(400).json({ error: 'Lead tenant name is required.' })
    }

    // Get structured landlord address from DB (not the flat form string)
    const { decrypt: decryptField } = await import('../services/encryption')
    const tenancyRecord = await supabase
      .from('tenancies')
      .select('property_id')
      .eq('id', tenancyId)
      .single()

    let landlordAddressLine1 = ''
    let landlordCity = ''
    let landlordPostcode = ''

    if (tenancyRecord.data?.property_id) {
      const { data: propLandlords } = await supabase
        .from('property_landlords')
        .select('landlords(residential_address_line1_encrypted, residential_city_encrypted, residential_postcode_encrypted)')
        .eq('property_id', tenancyRecord.data.property_id)
        .order('is_primary_contact', { ascending: false })
        .limit(1)

      if (propLandlords && propLandlords.length > 0) {
        const ll = (propLandlords[0] as any).landlords
        if (ll) {
          landlordAddressLine1 = ll.residential_address_line1_encrypted ? decryptField(ll.residential_address_line1_encrypted) || '' : ''
          landlordCity = ll.residential_city_encrypted ? decryptField(ll.residential_city_encrypted) || '' : ''
          landlordPostcode = ll.residential_postcode_encrypted ? decryptField(ll.residential_postcode_encrypted) || '' : ''
        }
      }
    }

    // Fallback to form string if DB had nothing
    if (!landlordAddressLine1 && landlord.address) {
      const parts = (landlord.address || '').split(',').map((p: string) => p.trim())
      landlordAddressLine1 = parts[0] || ''
      landlordCity = parts.length > 2 ? parts[1] : ''
      landlordPostcode = parts[parts.length - 1] || ''
    }

    const formTenancyData = {
      id: tenancyId,
      property: {
        address_line1: property.addressLine1,
        city: property.city,
        county: property.county,
        postcode: property.postcode
      },
      tenancy_start_date: tenancy.startDate,
      end_date: tenancy.endDate,
      deposit_amount: deposit.amount || deposit.amountToProtect,
      rent_amount: tenancy.rent,
      landlords: [{
        title: landlord.title,
        first_name: landlord.firstName,
        last_name: landlord.lastName,
        email: landlord.email,
        address_line1: landlordAddressLine1,
        city: landlordCity,
        postcode: landlordPostcode,
        is_primary: true
      }],
      tenants: tenants.map((t: any) => ({
        title: t.title,
        first_name: t.firstName,
        last_name: t.lastName,
        email: t.email,
        phone: t.phone,
        is_lead: t.isLead
      }))
    }

    // Save pending registration
    const depositAmount = Number(deposit.amount || deposit.amountToProtect) || 0
    await savePendingMyDepositsRegistration(
      tenancyId,
      companyId,
      userId!,
      depositAmount,
      config.schemeType
    )

    // Register with mydeposits
    const registerResult = await registerDeposit(companyId, formTenancyData, depositReceivedDate)

    if (!registerResult.success || !registerResult.depositId) {
      await markMyDepositsRegistrationFailed(tenancyId, registerResult.error || 'Registration failed')
      return res.status(400).json({ error: registerResult.error || 'Failed to register deposit with mydeposits' })
    }

    // Update registration with deposit ID
    await updateMyDepositsRegistration(tenancyId, registerResult.depositId)

    // Update tenancy deposit status
    await supabase
      .from('tenancies')
      .update({
        deposit_scheme: 'mydeposits',
        deposit_reference: registerResult.depositId,
        deposit_protected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', tenancyId)

    // Add activity log
    await supabase
      .from('tenancy_activity')
      .insert({
        tenancy_id: tenancyId,
        action: 'DEPOSIT_REGISTERED_MYDEPOSITS',
        category: 'payment',
        title: 'Deposit Registered with mydeposits',
        description: `Deposit registered with mydeposits (${config.schemeType}). ID: ${registerResult.depositId}`,
        metadata: {
          deposit_id: registerResult.depositId,
          scheme_type: config.schemeType
        },
        performed_by: userId,
        is_system_action: false
      })

    // Queue certificate polling (custodial certs not available until payment)
    const pollUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    await supabase
      .from('mydeposits_registrations')
      .update({ certificate_poll_until: pollUntil })
      .eq('tenancy_id', tenancyId)
      .eq('deposit_id', registerResult.depositId)
    console.log(`[mydeposits] Cert polling queued until ${pollUntil} for deposit ${registerResult.depositId}`)

    res.json({
      success: true,
      depositId: registerResult.depositId,
      schemeType: config.schemeType,
      message: 'Deposit registered with mydeposits successfully'
    })
  } catch (error) {
    console.error('Error registering deposit with mydeposits:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

// ============================================================================
// REGISTRATION STATUS
// ============================================================================

/**
 * GET /api/mydeposits/registration/:tenancyId
 * Get mydeposits registration for a tenancy
 */
router.get('/registration/:tenancyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { tenancyId } = req.params

    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { data: registration, error: regError } = await supabase
      .from('mydeposits_registrations')
      .select('*')
      .eq('tenancy_id', tenancyId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (regError && regError.code !== 'PGRST116') {
      console.error('Error fetching mydeposits registration:', regError)
    }

    if (!registration) {
      return res.json({ registration: null })
    }

    // Get registered by name
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
        depositId: registration.deposit_id,
        depositAmount: registration.deposit_amount,
        schemeType: registration.scheme_type,
        status: registration.status,
        certificateUrl: registration.certificate_url,
        registeredAt: registration.registered_at,
        registeredByName,
        error: registration.error_message
      }
    })
  } catch (error) {
    console.error('Error getting mydeposits registration:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

// ============================================================================
// CERTIFICATE DOWNLOAD
// ============================================================================

/**
 * GET /api/mydeposits/certificate/:tenancyId
 * Download mydeposits certificate
 */
router.get('/certificate/:tenancyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { tenancyId } = req.params

    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { data: registration, error: regError } = await supabase
      .from('mydeposits_registrations')
      .select('deposit_id, scheme_type')
      .eq('tenancy_id', tenancyId)
      .eq('company_id', companyId)
      .eq('status', 'registered')
      .single()

    if (regError || !registration || !registration.deposit_id) {
      return res.status(404).json({ error: 'Registration not found or not completed' })
    }

    const result = await downloadCertificate(companyId, registration.deposit_id)

    if (!result.success || !result.buffer) {
      return res.status(400).json({ error: result.error || 'Failed to download certificate' })
    }

    res.setHeader('Content-Type', result.contentType || 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="mydeposits-certificate-${registration.deposit_id}.pdf"`)
    res.send(result.buffer)
  } catch (error) {
    console.error('Error downloading mydeposits certificate:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

// ============================================================================
// ALL REGISTRATIONS
// ============================================================================

/**
 * GET /api/mydeposits/registrations
 * Get all mydeposits registrations for company
 */
router.get('/registrations', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { data: registrations, error } = await supabase
      .from('mydeposits_registrations')
      .select(`
        id,
        tenancy_id,
        deposit_id,
        deposit_amount,
        scheme_type,
        status,
        registered_at,
        created_at
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching mydeposits registrations:', error)
      return res.status(500).json({ error: 'Failed to fetch registrations' })
    }

    res.json({ registrations: registrations || [] })
  } catch (error) {
    console.error('Error getting mydeposits registrations:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

export default router

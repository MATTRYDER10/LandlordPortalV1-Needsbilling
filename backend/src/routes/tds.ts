import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import { decrypt } from '../services/encryption'
import { sendEmail, loadEmailTemplate } from '../services/emailService'
import { getFrontendUrl } from '../utils/frontendUrl'
import {
  getCompanyTDSConfig,
  createDeposit,
  pollDepositStatus,
  downloadDPC,
  getTDSRegistration,
  saveTDSRegistration,
  savePendingTDSRegistration,
  updateTDSRegistrationWithDAN,
  markTDSRegistrationFailed,
  getPendingTDSRegistration
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

  // Send notification email + in-app notification to agent
  try {
    const propertyAddress = (() => {
      try {
        const { data: t } = supabase.from('tenancies').select('property_address_encrypted').eq('id', tenancyId).single() as any
        return t?.property_address_encrypted ? decrypt(t.property_address_encrypted) : 'Property'
      } catch { return 'Property' }
    })()

    // Get company email
    const { data: company } = await supabase
      .from('companies')
      .select('email_encrypted')
      .eq('id', companyId)
      .single()

    const agentEmail = company?.email_encrypted ? decrypt(company.email_encrypted) : null

    // In-app notification
    await supabase.from('notifications').insert({
      company_id: companyId,
      user_id: userId,
      type: 'deposit_registered',
      title: `Deposit Registered - ${schemeName}`,
      message: `Deposit registered with ${schemeName}. DAN: ${dan}`,
      metadata: { tenancy_id: tenancyId, dan, scheme: schemeName },
      read: false
    })

    // Email notification
    if (agentEmail) {
      await sendEmail({
        to: agentEmail,
        subject: `Deposit Registered with ${schemeName} - DAN: ${dan}`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#16a34a;">Deposit Successfully Registered</h2>
          <p>The deposit has been registered with <strong>${schemeName}</strong>.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">DAN</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:bold;">${dan}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Scheme</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;">${schemeName}</td></tr>
            <tr><td style="padding:8px;color:#6b7280;">Date</td><td style="padding:8px;">${new Date().toLocaleDateString('en-GB')}</td></tr>
          </table>
          <p style="font-size:14px;color:#6b7280;">Download the certificate from PropertyGoose.</p>
        </div>`
      }).catch(err => console.error('[TDS] Notification email failed:', err))
    }
  } catch (notifyErr) {
    console.error('[TDS] Notification error:', notifyErr)
  }
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
    const { tenancyId, depositReceivedDate, furnishedStatus, property, tenancy, deposit, landlord, tenants } = req.body

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

    // Validate form data - USE THE DATA FROM THE FORM, not from linked tables
    if (!landlord || !landlord.firstName || !landlord.lastName) {
      return res.status(400).json({ error: 'Landlord details are required. Please fill in the landlord information.' })
    }

    if (!tenants || tenants.length === 0) {
      return res.status(400).json({ error: 'At least one tenant is required.' })
    }

    const leadTenant = tenants.find((t: any) => t.isLead) || tenants[0]
    if (!leadTenant.firstName || !leadTenant.lastName) {
      return res.status(400).json({ error: 'Lead tenant name is required.' })
    }

    if (!leadTenant.email && !leadTenant.phone) {
      return res.status(400).json({ error: 'Lead tenant must have an email or phone number.' })
    }

    console.log('[TDS Custodial] Creating deposit for tenancy:', tenancyId, 'with form data - landlord:', landlord.firstName, landlord.lastName, ', tenants:', tenants.length)

    // Parse landlord address into components (address might be combined like "3 Road, City, BS1 1AA")
    const landlordAddressParts = (landlord.address || '').split(',').map((p: string) => p.trim())
    const landlordAddressLine1 = landlordAddressParts[0] || ''
    const landlordCity = landlordAddressParts[1] || ''
    const landlordPostcode = landlordAddressParts[landlordAddressParts.length - 1] || ''

    // Build tenancy data from form - USE FORM DATA, not database lookups
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
      monthly_rent: tenancy.rent,
      deposit_amount: deposit.amount || deposit.amountToProtect,
      // Use form data for landlord - NOT from property_landlords table
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
      // Use form data for tenants - NOT from tenancy_tenants table
      tenants: tenants.map((t: any) => ({
        title: t.title,
        first_name: t.firstName,
        last_name: t.lastName,
        email: t.email,
        phone: t.phone,
        is_lead: t.isLead
      }))
    }

    const createResult = await createDeposit(
      companyId,
      formTenancyData,
      depositReceivedDate,
      furnishedStatus || 'furnished'
    )

    console.log('[TDS Custodial] createDeposit result:', JSON.stringify(createResult))

    if (!createResult.success || !createResult.batchId) {
      return res.status(400).json({ error: createResult.error || 'Failed to create deposit with TDS' })
    }

    // Save a pending registration immediately so we have a record even if polling times out
    console.log('[TDS] Saving pending registration for batch:', createResult.batchId)
    const depositAmount = Number(deposit.amount || deposit.amountToProtect) || 0
    const { error: insertError } = await supabase
      .from('tds_registrations')
      .insert({
        tenancy_id: tenancyId,
        company_id: companyId,
        registered_by: userId,
        batch_id: createResult.batchId,
        deposit_amount: depositAmount,
        deposit_received_date: depositReceivedDate,
        status: 'pending',
        scheme_type: 'custodial'
      })

    if (insertError) {
      console.error('[TDS] Failed to save pending registration:', insertError)
      // Don't fail the request - TDS already received it, we just couldn't track it locally
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

    // Poll TDS multiple times per request (40 attempts, 5 seconds apart = ~3.5 minutes max)
    console.log('[TDS Custodial] Starting polling for batchId:', batchId)
    const statusResult = await pollDepositStatus(companyId, batchId, 40, 5000)

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
      // Update registration status to failed in database so it persists
      if (tenancyId) {
        await supabase
          .from('tds_registrations')
          .update({
            status: 'failed',
            error_message: statusResult.error,
            updated_at: new Date().toISOString()
          })
          .eq('tenancy_id', tenancyId)
          .eq('batch_id', batchId)
      }
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
  console.log('[TDS Insured] ===== CREATE DEPOSIT ENDPOINT HIT =====')
  console.log('[TDS Insured] Request body:', JSON.stringify(req.body))
  try {
    const userId = req.user?.id
    const { tenancyId, depositReceivedDate, furnishedStatus, property, tenancy, deposit, landlord, tenants } = req.body

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
    console.log('[TDS Insured] Existing registration check:', existingRegistration ? JSON.stringify(existingRegistration) : 'none')
    if (existingRegistration) {
      // If already completed with a DAN, don't allow re-registration
      if (existingRegistration.status === 'registered' && existingRegistration.dan) {
        console.log('[TDS Insured] Already registered with DAN:', existingRegistration.dan)
        return res.status(400).json({
          error: 'This deposit is already registered with TDS',
          dan: existingRegistration.dan
        })
      }
      // If pending, return the existing batch_id so frontend can continue polling
      if (existingRegistration.status === 'pending' && existingRegistration.batch_id) {
        console.log('[TDS Insured] Found pending registration, returning existing apiReference:', existingRegistration.batch_id)
        return res.json({
          success: true,
          apiReference: existingRegistration.batch_id,
          schemeType: 'insured',
          message: 'Deposit already submitted. Polling for completion...'
        })
      }
    }

    // Validate form data - USE THE DATA FROM THE FORM, not from linked tables
    if (!landlord || !landlord.firstName || !landlord.lastName) {
      return res.status(400).json({ error: 'Landlord details are required. Please fill in the landlord information.' })
    }

    if (!tenants || tenants.length === 0) {
      return res.status(400).json({ error: 'At least one tenant is required.' })
    }

    const leadTenant = tenants.find((t: any) => t.isLead) || tenants[0]
    if (!leadTenant.firstName || !leadTenant.lastName) {
      return res.status(400).json({ error: 'Lead tenant name is required.' })
    }

    // Get structured landlord address from the database (property_landlords → landlords)
    // The form sends a flat string which can't be reliably parsed
    const { decrypt: decryptField } = await import('../services/encryption')
    const tenancyRecord = await supabase
      .from('tenancies')
      .select('property_id')
      .eq('id', tenancyId)
      .single()

    let landlordAddressLine1 = ''
    let landlordCity = ''
    let landlordCounty = ''
    let landlordPostcode = ''

    if (tenancyRecord.data?.property_id) {
      const { data: propLandlords } = await supabase
        .from('property_landlords')
        .select('landlords(residential_address_line1_encrypted, residential_city_encrypted, residential_county_encrypted, residential_postcode_encrypted)')
        .eq('property_id', tenancyRecord.data.property_id)
        .order('is_primary_contact', { ascending: false })
        .limit(1)

      if (propLandlords && propLandlords.length > 0) {
        const ll = (propLandlords[0] as any).landlords
        if (ll) {
          landlordAddressLine1 = ll.residential_address_line1_encrypted ? decryptField(ll.residential_address_line1_encrypted) || '' : ''
          landlordCity = ll.residential_city_encrypted ? decryptField(ll.residential_city_encrypted) || '' : ''
          landlordCounty = ll.residential_county_encrypted ? decryptField(ll.residential_county_encrypted) || '' : ''
          landlordPostcode = ll.residential_postcode_encrypted ? decryptField(ll.residential_postcode_encrypted) || '' : ''
        }
      }
    }

    // Fallback: try to parse from form if DB had nothing
    if (!landlordAddressLine1 && landlord.address) {
      const parts = (landlord.address || '').split(',').map((p: string) => p.trim())
      landlordAddressLine1 = parts[0] || ''
      landlordCity = parts.length > 2 ? parts[1] : ''
      landlordPostcode = parts[parts.length - 1] || ''
    }

    // Build tenancy data from form + structured DB addresses
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
      monthly_rent: tenancy.rent,
      deposit_amount: deposit.amount || deposit.amountToProtect,
      landlords: [{
        title: landlord.title,
        first_name: landlord.firstName,
        last_name: landlord.lastName,
        email: landlord.email,
        address_line1: landlordAddressLine1,
        city: landlordCity,
        county: landlordCounty,
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

    console.log('[TDS Insured] Creating deposit for tenancy:', tenancyId, 'with form data')

    const createResult = await createInsuredDeposit(
      companyId,
      formTenancyData,
      depositReceivedDate
    )

    console.log('[TDS Insured] createInsuredDeposit result:', JSON.stringify(createResult))

    if (!createResult.success || !createResult.apiReference) {
      return res.status(400).json({ error: createResult.error || 'Failed to create deposit with TDS Insured' })
    }

    // Save a pending registration immediately so we have a record even if polling times out
    console.log('[TDS Insured] Saving pending registration for apiReference:', createResult.apiReference)
    const insuredDepositAmount = Number(deposit.amount || deposit.amountToProtect) || 0
    const { error: insertError } = await supabase
      .from('tds_registrations')
      .insert({
        tenancy_id: tenancyId,
        company_id: companyId,
        registered_by: userId,
        batch_id: createResult.apiReference, // Using batch_id field to store apiReference
        deposit_amount: insuredDepositAmount,
        deposit_received_date: depositReceivedDate,
        status: 'pending',
        scheme_type: 'insured'
      })

    if (insertError) {
      console.error('[TDS Insured] Failed to save pending registration:', insertError)
    } else {
      console.log('[TDS Insured] Pending registration saved successfully')
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
    const branchHeader = req.headers['x-branch-id']
    console.log('[TDS Registration] Fetching for tenancy:', tenancyId, 'X-Branch-Id:', branchHeader)

    const companyId = await getUserCompanyId(req)
    console.log('[TDS Registration] Resolved company_id:', companyId)

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

    console.log('[TDS Registration] Query result:', { found: !!registration, status: registration?.status, dan: registration?.dan, error: regError?.code })

    if (regError && regError.code !== 'PGRST116') {
      console.error('Error fetching TDS registration:', regError)
    }

    if (!registration) {
      console.log('[TDS Registration] No registration found, returning null')
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
        schemeType: registration.scheme_type || 'custodial',
        error: registration.error_message || null
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
    console.log('[TDS Certificate] Downloading certificate for DAN:', dan)

    const companyId = await getUserCompanyId(req)
    console.log('[TDS Certificate] Company ID:', companyId)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { data: registration, error: regError } = await supabase
      .from('tds_registrations')
      .select('id, scheme_type')
      .eq('dan', dan)
      .eq('company_id', companyId)
      .single()

    console.log('[TDS Certificate] Registration lookup:', { found: !!registration, error: regError?.message, schemeType: registration?.scheme_type })

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

    console.log('[TDS Certificate] Download result:', { success: result.success, hasBuffer: !!result.buffer, error: result.error })

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

    // Poll TDS multiple times per request (40 attempts, 5 seconds apart = ~3.5 minutes max)
    const statusResult = await pollDepositStatus(companyId, batchId, 40, 5000)

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

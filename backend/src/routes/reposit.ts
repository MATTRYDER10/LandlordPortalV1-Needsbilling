import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import { decrypt } from '../services/encryption'
import {
  getCompanyRepositConfig,
  getRepositPricing,
  createReposit,
  publishReposit,
  getReposit,
  getRepositRegistration,
  saveRepositRegistration,
  updateRepositRegistrationStatus,
  getSupplierAgents
} from '../services/repositService'
import {
  checkRepositEligibility,
  checkTenancyRepositEligibility,
  updateReferenceRepositEligibility
} from '../services/repositEligibilityService'

const router = Router()

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getUserCompanyId(req: AuthRequest): Promise<string | null> {
  const userId = req.user?.id
  if (!userId) return null

  const branchId = req.headers['x-branch-id'] as string | undefined

  if (branchId) {
    const { data } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .eq('company_id', branchId)
      .limit(1)

    if (data && data.length > 0) return data[0].company_id
  }

  const { data } = await supabase
    .from('company_users')
    .select('company_id')
    .eq('user_id', userId)
    .limit(1)

  return data?.[0]?.company_id || null
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/reposit/config-status
 * Get Reposit integration status for company
 */
router.get('/config-status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)
    console.log('[Reposit] Config status check - companyId:', companyId, 'X-Branch-Id:', req.headers['x-branch-id'])

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyRepositConfig(companyId)
    console.log('[Reposit] Config status - configured:', !!config, 'supplierId:', config?.supplierId)

    res.json({
      configured: !!config,
      supplierId: config?.supplierId || null,
      environment: config?.environment || 'sandbox',
      defaultAgentId: config?.defaultAgentId || null
    })
  } catch (error) {
    console.error('[Reposit] Error getting config status:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/reposit/pricing
 * Get Reposit pricing
 */
router.post('/pricing', authenticateToken, async (req: AuthRequest, res) => {
  try {
    console.log('[Reposit] Pricing request body:', req.body)

    const companyId = await getUserCompanyId(req)
    console.log('[Reposit] Pricing - companyId:', companyId)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyRepositConfig(companyId)
    console.log('[Reposit] Pricing - config found:', !!config)

    if (!config) {
      return res.status(400).json({ error: 'Reposit is not configured' })
    }

    let monthlyRentPence: number
    let headcount: number

    // Can provide tenancyId OR { monthly_rent, headcount }
    if (req.body.tenancyId) {
      const { data: tenancy, error } = await supabase
        .from('tenancies')
        .select('rent_amount')
        .eq('id', req.body.tenancyId)
        .single()

      if (error || !tenancy) {
        console.error('[Reposit Pricing] Tenancy query error:', error)
        return res.status(404).json({ error: 'Tenancy not found' })
      }

      console.log('[Reposit Pricing] Tenancy rent_amount:', tenancy.rent_amount)
      monthlyRentPence = Math.round((tenancy.rent_amount || 0) * 100)

      // Get tenant count (only active tenants)
      const { count } = await supabase
        .from('tenancy_tenants')
        .select('id', { count: 'exact' })
        .eq('tenancy_id', req.body.tenancyId)
        .eq('is_active', true)

      headcount = count || 1
    } else {
      monthlyRentPence = Math.round((req.body.monthly_rent || 0) * 100)
      headcount = req.body.headcount || 1
    }

    if (monthlyRentPence <= 0) {
      return res.status(400).json({ error: 'Monthly rent is required' })
    }

    const result = await getRepositPricing(config, monthlyRentPence, headcount)

    if (result.success && result.pricing) {
      res.json({
        success: true,
        pricing: {
          totalFee: result.pricing.total_fee_pence / 100, // Convert to pounds
          perTenantFee: result.pricing.per_tenant_fee_pence / 100,
          monthlyRent: result.pricing.monthly_rent_pence / 100,
          headcount: result.pricing.headcount
        }
      })
    } else {
      res.status(400).json({ success: false, error: result.error })
    }
  } catch (error) {
    console.error('[Reposit] Error getting pricing:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * POST /api/reposit/eligibility-check
 * Check Reposit eligibility for a reference or tenancy
 */
router.post('/eligibility-check', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { referenceId, tenancyId } = req.body

    if (referenceId) {
      // Check single reference
      const result = await checkRepositEligibility(referenceId)

      // Update the reference with eligibility status
      await updateReferenceRepositEligibility(referenceId, result.eligible, result.notes)

      res.json({ success: true, eligibility: result })
    } else if (tenancyId) {
      // Check all tenants in tenancy
      const result = await checkTenancyRepositEligibility(tenancyId)
      res.json({ success: true, ...result })
    } else {
      res.status(400).json({ error: 'referenceId or tenancyId is required' })
    }
  } catch (error) {
    console.error('[Reposit] Error checking eligibility:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/reposit/create
 * Create a Reposit for a tenancy
 */
router.post('/create', authenticateToken, async (req: AuthRequest, res) => {
  try {
    console.log('[Reposit Create] Request body:', req.body)
    console.log('[Reposit Create] X-Branch-Id header:', req.headers['x-branch-id'])

    const companyId = await getUserCompanyId(req)
    console.log('[Reposit Create] Resolved companyId:', companyId)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const userId = req.user?.id
    const { tenancyId, agentId, publishImmediately } = req.body

    if (!tenancyId) {
      return res.status(400).json({ error: 'tenancyId is required' })
    }

    const config = await getCompanyRepositConfig(companyId)
    console.log('[Reposit Create] Config found:', !!config)

    if (!config) {
      return res.status(400).json({ error: 'Reposit is not configured' })
    }

    // Get tenancy with property and tenants
    // Note: Database uses rent_amount (not monthly_rent), tenancy_start_date, tenancy_end_date
    console.log('[Reposit Create] Looking up tenancy:', tenancyId)
    const { data: tenancy, error: tenancyError } = await supabase
      .from('tenancies')
      .select(`
        id, rent_amount, tenancy_start_date, tenancy_end_date, property_id,
        property:properties(id, address_line1_encrypted, address_line2_encrypted, city_encrypted, postcode, company_id)
      `)
      .eq('id', tenancyId)
      .single()

    console.log('[Reposit Create] Raw tenancy data:', JSON.stringify(tenancy, null, 2))

    console.log('[Reposit Create] Tenancy query result:', { tenancy: !!tenancy, error: tenancyError })

    if (tenancyError || !tenancy) {
      console.log('[Reposit Create] Tenancy not found, error:', tenancyError)
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    // Verify tenancy belongs to company via property
    const rawProperty = tenancy.property as any
    console.log('[Reposit Create] Property company_id:', rawProperty?.company_id, 'User companyId:', companyId)

    if (!rawProperty || rawProperty.company_id !== companyId) {
      console.log('[Reposit Create] Access denied - company mismatch')
      return res.status(403).json({ error: 'Access denied' })
    }

    // Decrypt property fields
    const property = {
      id: rawProperty.id,
      address_line1: decrypt(rawProperty.address_line1_encrypted) || '',
      address_line2: decrypt(rawProperty.address_line2_encrypted) || '',
      city: decrypt(rawProperty.city_encrypted) || '',
      postcode: rawProperty.postcode || ''
    }
    console.log('[Reposit Create] Decrypted property:', { address_line1: property.address_line1, city: property.city, postcode: property.postcode })

    // Get landlord from property_landlords
    const { data: propertyLandlords, error: landlordError } = await supabase
      .from('property_landlords')
      .select('is_primary_contact, landlords(first_name_encrypted, last_name_encrypted, email_encrypted, phone_encrypted)')
      .eq('property_id', property.id)
      .order('is_primary_contact', { ascending: false })
      .limit(1)

    console.log('[Reposit Create] Landlords query:', { count: propertyLandlords?.length, error: landlordError })

    let landlord: { first_name: string; last_name: string; email: string; phone?: string } | undefined
    if (propertyLandlords && propertyLandlords.length > 0) {
      const ll = (propertyLandlords[0].landlords as any)
      landlord = {
        first_name: decrypt(ll.first_name_encrypted) || '',
        last_name: decrypt(ll.last_name_encrypted) || '',
        email: decrypt(ll.email_encrypted) || '',
        phone: decrypt(ll.phone_encrypted) || undefined
      }
      console.log('[Reposit Create] Primary landlord:', { first_name: landlord.first_name, last_name: landlord.last_name, email: landlord.email })
    }

    // Get tenants - use status='active' to include pending/future tenants
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenancy_tenants')
      .select('tenant_name_encrypted, tenant_email_encrypted, tenant_phone_encrypted, is_active, status')
      .eq('tenancy_id', tenancyId)
      .eq('status', 'active')

    console.log('[Reposit Create] Tenants query:', { count: tenants?.length, error: tenantsError })

    if (tenantsError || !tenants?.length) {
      return res.status(400).json({ error: 'No tenants found for tenancy' })
    }

    // Build Reposit payload - parse tenant names into first/last
    const parsedTenants = tenants.map(t => {
      const fullName = decrypt(t.tenant_name_encrypted) || ''
      const nameParts = fullName.trim().split(' ')
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''
      return {
        first_name: firstName,
        last_name: lastName,
        email: decrypt(t.tenant_email_encrypted) || '',
        phone: decrypt(t.tenant_phone_encrypted) || undefined
      }
    })

    // Validate required data before calling API
    if (!property.address_line1 || !property.city || !property.postcode) {
      console.error('[Reposit Create] Missing property address data:', property)
      return res.status(400).json({
        error: 'Property address is incomplete. Please ensure address line 1, city, and postcode are set.',
        details: { address_line1: !!property.address_line1, city: !!property.city, postcode: !!property.postcode }
      })
    }

    if (!landlord) {
      console.error('[Reposit Create] No landlord found for property:', property.id)
      return res.status(400).json({
        error: 'No landlord linked to this property. Please link a landlord before creating a Reposit.'
      })
    }

    if (!landlord.email) {
      console.error('[Reposit Create] Landlord has no email:', landlord)
      return res.status(400).json({
        error: 'Landlord email is required for Reposit. Please add an email to the landlord record.'
      })
    }

    // Get agentId - required by API
    let finalAgentId = agentId || config.defaultAgentId

    // If no agent configured, try to fetch the first available agent
    if (!finalAgentId) {
      console.log('[Reposit Create] No agent configured, fetching available agents...')
      const agentsResult = await getSupplierAgents(config)
      if (agentsResult.success && agentsResult.agents && agentsResult.agents.length > 0) {
        finalAgentId = agentsResult.agents[0].id
        console.log('[Reposit Create] Using first available agent:', finalAgentId)
      } else {
        console.error('[Reposit Create] No agents available:', agentsResult.error)
        return res.status(400).json({
          error: 'No Reposit agents available. Please configure agents in your Reposit account.'
        })
      }
    }

    // Build payload according to Reposit API spec
    console.log('[Reposit Create] Monthly rent:', tenancy.rent_amount, 'Start date:', tenancy.tenancy_start_date)
    const monthlyRentPence = Math.round((tenancy.rent_amount || 0) * 100)

    // Reposit requires start date to be within the last month
    // If tenancy started more than a month ago, use today's date
    let startDate = tenancy.tenancy_start_date
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
    const tenancyStartDate = new Date(tenancy.tenancy_start_date)

    if (tenancyStartDate < oneMonthAgo) {
      startDate = new Date().toISOString().split('T')[0] // Today's date in YYYY-MM-DD
      console.log('[Reposit Create] Tenancy start date too old, using today:', startDate)
    }

    const endDate = tenancy.tenancy_end_date

    // Ensure ppm is at least 25000 (API minimum)
    if (monthlyRentPence < 25000) {
      console.error('[Reposit Create] Monthly rent too low:', monthlyRentPence, 'pence')
      return res.status(400).json({
        error: `Monthly rent must be at least £250 for Reposit (got £${(monthlyRentPence / 100).toFixed(2)})`
      })
    }

    if (!startDate) {
      return res.status(400).json({
        error: 'Tenancy start date is required for Reposit'
      })
    }

    const payload: any = {
      address: {
        line1: property.address_line1,
        line2: property.address_line2 || undefined,
        town: property.city, // API uses "town" not "city"
        postcode: property.postcode,
        country: 'GBR' // ISO 3166-1 alpha-3
      },
      landlord: {
        firstName: landlord.first_name,
        lastName: landlord.last_name,
        email: landlord.email
      },
      agentId: finalAgentId,
      ppm: monthlyRentPence,
      headcount: tenants.length,
      startDate: startDate, // YYYY-MM-DD format
      tenants: parsedTenants.map(t => ({
        email: t.email,
        firstName: t.first_name || undefined,
        lastName: t.last_name || undefined
      })),
      letOnly: false, // Assuming fully managed - could make this configurable
      draft: false // Send to tenants immediately (or use publishImmediately flag)
    }

    // If not publishing immediately, create as draft
    if (!publishImmediately) {
      payload.draft = true
    }

    console.log('[Reposit Create] Final payload:', JSON.stringify(payload, null, 2))

    // Fetch pricing before creating (so we can save the fee)
    const pricingResult = await getRepositPricing(config, monthlyRentPence, tenants.length)
    const totalFeePence = pricingResult.success ? pricingResult.pricing?.total_fee_pence : undefined
    const perTenantFeePence = pricingResult.success ? pricingResult.pricing?.per_tenant_fee_pence : undefined

    // Create Reposit
    const createResult = await createReposit(config, payload)

    if (!createResult.success || !createResult.repositId) {
      return res.status(400).json({ success: false, error: createResult.error })
    }

    // Save registration record with pricing data
    const saveResult = await saveRepositRegistration(
      tenancyId,
      companyId,
      userId!,
      createResult.repositId,
      'draft',
      {
        monthlyRent: monthlyRentPence,
        totalFee: totalFeePence,
        perTenantFee: perTenantFeePence,
        headcount: tenants.length,
        tenancyStartDate: startDate,
        tenancyEndDate: endDate,
        agentId: agentId || config.defaultAgentId,
        rawResponse: createResult.data
      }
    )

    if (!saveResult.success) {
      console.error('[Reposit] Failed to save registration record:', saveResult.error)
    }

    // Publish immediately if requested
    if (publishImmediately) {
      const publishResult = await publishReposit(config, createResult.repositId)
      if (publishResult.success) {
        await updateRepositRegistrationStatus(createResult.repositId, 'published', {
          published_at: new Date().toISOString()
        })
      }
    }

    res.json({
      success: true,
      repositId: createResult.repositId,
      status: publishImmediately ? 'published' : 'draft',
      registrationId: saveResult.registrationId
    })
  } catch (error) {
    console.error('[Reposit] Error creating Reposit:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * POST /api/reposit/:id/publish
 * Publish a draft Reposit
 */
router.post('/:id/publish', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const repositId = req.params.id

    const config = await getCompanyRepositConfig(companyId)
    if (!config) {
      return res.status(400).json({ error: 'Reposit is not configured' })
    }

    const result = await publishReposit(config, repositId)

    if (result.success) {
      await updateRepositRegistrationStatus(repositId, 'published', {
        published_at: new Date().toISOString()
      })
      res.json({ success: true })
    } else {
      res.status(400).json({ success: false, error: result.error })
    }
  } catch (error) {
    console.error('[Reposit] Error publishing Reposit:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/reposit/:tenancyId
 * Get Reposit registration for a tenancy
 */
router.get('/:tenancyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { tenancyId } = req.params

    const registration = await getRepositRegistration(tenancyId)

    if (!registration) {
      return res.json({ registration: null })
    }

    // Verify company ownership
    if (registration.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    res.json({
      registration: {
        id: registration.id,
        repositId: registration.reposit_id,
        status: registration.status,
        monthlyRent: registration.monthly_rent / 100,
        totalFee: registration.total_fee ? registration.total_fee / 100 : null,
        perTenantFee: registration.per_tenant_fee ? registration.per_tenant_fee / 100 : null,
        headcount: registration.headcount,
        tenancyStartDate: registration.tenancy_start_date,
        tenancyEndDate: registration.tenancy_end_date,
        publishedAt: registration.published_at,
        completedAt: registration.completed_at,
        createdAt: registration.created_at
      }
    })
  } catch (error) {
    console.error('[Reposit] Error getting registration:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/reposit/:id/status
 * Poll Reposit status with detailed tenant progress
 */
router.get('/:id/status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const repositId = req.params.id

    const config = await getCompanyRepositConfig(companyId)
    if (!config) {
      return res.status(400).json({ error: 'Reposit is not configured' })
    }

    const result = await getReposit(config, repositId)

    if (result.success && result.data) {
      const data = result.data

      // Parse tenant statuses to determine overall progress
      // Tenant status flow: DRAFT → INVITED → REGISTERED → REFERENCED → CONFIRMED → SIGNED → PAID
      const tenants = data.tenants || []
      const tenantStatuses = tenants.map((t: any) => ({
        email: t.email,
        firstName: t.firstName,
        lastName: t.lastName,
        status: t.status,
        progressUrl: t.progressUrl
      }))

      // Calculate overall status based on tenant progress
      const statusPriority: Record<string, number> = {
        'DRAFT': 0,
        'INVITED': 1,
        'REGISTERED': 2,
        'REFERENCED': 3,
        'CONFIRMED': 4,
        'SIGNED': 5,
        'PAID': 6
      }

      const allPaid = tenants.length > 0 && tenants.every((t: any) => t.status === 'PAID')
      const allSigned = tenants.length > 0 && tenants.every((t: any) => statusPriority[t.status] >= 5)
      const allConfirmed = tenants.length > 0 && tenants.every((t: any) => statusPriority[t.status] >= 4)
      const anySigned = tenants.some((t: any) => t.status === 'SIGNED')
      const anyPaid = tenants.some((t: any) => t.status === 'PAID')

      // Determine human-readable overall status
      let overallStatus: string
      let statusLabel: string

      if (data.deactivatedAt) {
        overallStatus = 'deactivated'
        statusLabel = 'Cancelled'
      } else if (data.closedAt) {
        overallStatus = 'closed'
        statusLabel = 'Closed'
      } else if (allPaid) {
        overallStatus = 'active'
        statusLabel = 'Active - Cover in Place'
      } else if (anyPaid) {
        overallStatus = 'partial_paid'
        statusLabel = 'Partially Paid'
      } else if (allSigned) {
        overallStatus = 'awaiting_payment'
        statusLabel = 'Awaiting Payment'
      } else if (anySigned) {
        overallStatus = 'partial_signed'
        statusLabel = 'Signing in Progress'
      } else if (allConfirmed) {
        overallStatus = 'awaiting_signature'
        statusLabel = 'Awaiting Signatures'
      } else if (data.status === 'DRAFT') {
        overallStatus = 'draft'
        statusLabel = 'Draft'
      } else {
        overallStatus = 'pending'
        statusLabel = 'Pending Tenant Action'
      }

      // Update local registration with new status (just the status string, not tenant details)
      await updateRepositRegistrationStatus(repositId, overallStatus as any)

      res.json({
        success: true,
        repositStatus: data.status, // DRAFT or PUBLISHED
        overallStatus,
        statusLabel,
        tenants: tenantStatuses,
        totalFee: data.ppm ? Math.round(data.ppm * 0.01) : null, // Convert pence to pounds
        isActive: allPaid,
        isClosed: !!data.closedAt,
        isDeactivated: !!data.deactivatedAt,
        createdAt: data.createdAt,
        closedAt: data.closedAt,
        deactivatedAt: data.deactivatedAt
      })
    } else {
      res.status(400).json({ success: false, error: result.error })
    }
  } catch (error) {
    console.error('[Reposit] Error getting status:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

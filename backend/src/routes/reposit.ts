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
  updateRepositRegistrationStatus
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
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyRepositConfig(companyId)

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
    const companyId = await getUserCompanyId(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyRepositConfig(companyId)
    if (!config) {
      return res.status(400).json({ error: 'Reposit is not configured' })
    }

    let monthlyRentPence: number
    let headcount: number

    // Can provide tenancyId OR { monthly_rent, headcount }
    if (req.body.tenancyId) {
      const { data: tenancy, error } = await supabase
        .from('tenancies')
        .select('monthly_rent')
        .eq('id', req.body.tenancyId)
        .single()

      if (error || !tenancy) {
        return res.status(404).json({ error: 'Tenancy not found' })
      }

      monthlyRentPence = Math.round((tenancy.monthly_rent || 0) * 100)

      // Get tenant count
      const { count } = await supabase
        .from('tenancy_tenants')
        .select('id', { count: 'exact' })
        .eq('tenancy_id', req.body.tenancyId)

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
    res.status(500).json({ error: 'Internal server error' })
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
    const companyId = await getUserCompanyId(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const userId = req.user?.id
    const { tenancyId, agentId, publishImmediately } = req.body

    if (!tenancyId) {
      return res.status(400).json({ error: 'tenancyId is required' })
    }

    const config = await getCompanyRepositConfig(companyId)
    if (!config) {
      return res.status(400).json({ error: 'Reposit is not configured' })
    }

    // Get tenancy with property and tenants
    const { data: tenancy, error: tenancyError } = await supabase
      .from('tenancies')
      .select(`
        id, monthly_rent, tenancy_start_date, tenancy_end_date,
        property:properties(address_line1, address_line2, city, postcode)
      `)
      .eq('id', tenancyId)
      .eq('company_id', companyId)
      .single()

    if (tenancyError || !tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    // Get tenants
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenancy_tenants')
      .select('first_name_encrypted, last_name_encrypted, email_encrypted, phone_encrypted')
      .eq('tenancy_id', tenancyId)

    if (tenantsError || !tenants?.length) {
      return res.status(400).json({ error: 'No tenants found for tenancy' })
    }

    const property = tenancy.property as any

    // Build Reposit payload
    const payload = {
      supplier_id: config.supplierId,
      agent_id: agentId || config.defaultAgentId,
      tenancy: {
        address: {
          line1: property?.address_line1 || '',
          line2: property?.address_line2 || undefined,
          city: property?.city || '',
          postcode: property?.postcode || '',
          country: 'GB'
        },
        start_date: tenancy.tenancy_start_date,
        end_date: tenancy.tenancy_end_date || undefined,
        monthly_rent_pence: Math.round((tenancy.monthly_rent || 0) * 100)
      },
      tenants: tenants.map(t => ({
        first_name: decrypt(t.first_name_encrypted) || '',
        last_name: decrypt(t.last_name_encrypted) || '',
        email: decrypt(t.email_encrypted) || '',
        phone: decrypt(t.phone_encrypted) || undefined
      }))
    }

    // Create Reposit
    const createResult = await createReposit(config, payload)

    if (!createResult.success || !createResult.repositId) {
      return res.status(400).json({ success: false, error: createResult.error })
    }

    // Save registration record
    const saveResult = await saveRepositRegistration(
      tenancyId,
      companyId,
      userId!,
      createResult.repositId,
      'draft',
      {
        monthlyRent: Math.round((tenancy.monthly_rent || 0) * 100),
        totalFee: createResult.data?.total_fee_pence,
        perTenantFee: createResult.data?.per_tenant_fee_pence,
        headcount: tenants.length,
        tenancyStartDate: tenancy.tenancy_start_date,
        tenancyEndDate: tenancy.tenancy_end_date,
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
    res.status(500).json({ error: 'Internal server error' })
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
 * Poll Reposit status
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
      // Update local registration status if it changed
      const newStatus = result.data.status as any
      await updateRepositRegistrationStatus(repositId, newStatus)

      res.json({
        success: true,
        status: result.data.status,
        data: result.data
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

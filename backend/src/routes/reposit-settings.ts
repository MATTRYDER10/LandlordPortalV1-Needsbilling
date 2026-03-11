import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import {
  getCompanyRepositConfig,
  testConnection,
  saveRepositConfig,
  removeRepositConfig,
  updateRepositTestStatus,
  getSupplierAgents
} from '../services/repositService'

const router = Router()

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get company ID and role for the authenticated user, supporting multi-branch users
 */
async function getUserCompanyAndRole(req: AuthRequest): Promise<{ companyId: string; role: string } | null> {
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
      return { companyId: branchMembership[0].company_id, role: branchMembership[0].role }
    }
  }

  const { data: companyUsers } = await supabase
    .from('company_users')
    .select('company_id, role')
    .eq('user_id', userId)
    .limit(1)

  if (companyUsers && companyUsers.length > 0) {
    return { companyId: companyUsers[0].company_id, role: companyUsers[0].role }
  }

  return null
}

async function getUserCompanyId(req: AuthRequest): Promise<string | null> {
  const result = await getUserCompanyAndRole(req)
  return result?.companyId || null
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/settings/reposit
 * Get Reposit integration status
 */
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { data: integration, error: integrationError } = await supabase
      .from('company_integrations')
      .select(`
        reposit_supplier_id, reposit_environment, reposit_connected_at,
        reposit_last_tested_at, reposit_last_test_status, reposit_referrer_token_encrypted,
        reposit_default_agent_id
      `)
      .eq('company_id', companyId)
      .single()

    if (integrationError && integrationError.code !== 'PGRST116') {
      console.error('Error fetching Reposit integration:', integrationError)
    }

    const configured = !!(integration?.reposit_referrer_token_encrypted && integration?.reposit_supplier_id)

    // Get masked credentials if configured
    let maskedReferrerToken = null
    if (configured) {
      const config = await getCompanyRepositConfig(companyId)
      if (config?.referrerToken) {
        maskedReferrerToken = '••••••••' + config.referrerToken.slice(-4)
      }
    }

    res.json({
      configured,
      supplierId: integration?.reposit_supplier_id || null,
      environment: integration?.reposit_environment || 'sandbox',
      maskedReferrerToken,
      defaultAgentId: integration?.reposit_default_agent_id || null,
      connectedAt: integration?.reposit_connected_at || null,
      lastTestedAt: integration?.reposit_last_tested_at || null,
      lastTestStatus: integration?.reposit_last_test_status || null
    })
  } catch (error) {
    console.error('Error getting Reposit settings:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * POST /api/settings/reposit
 * Save Reposit credentials
 */
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { referrerToken, apiKey, supplierId, environment, defaultAgentId } = req.body

    if (!supplierId) {
      return res.status(400).json({ error: 'Supplier ID is required' })
    }

    if (environment && !['sandbox', 'live'].includes(environment)) {
      return res.status(400).json({ error: 'Environment must be sandbox or live' })
    }

    const companyData = await getUserCompanyAndRole(req)

    if (!companyData) {
      return res.status(404).json({ error: 'Company not found' })
    }

    if (!['admin', 'owner'].includes(companyData.role)) {
      return res.status(403).json({ error: 'Only admins and owners can configure integrations' })
    }

    // Check if config already exists
    const existingConfig = await getCompanyRepositConfig(companyData.companyId)

    // If no credentials provided and no existing config, require them
    if ((!referrerToken || !apiKey) && !existingConfig) {
      return res.status(400).json({ error: 'Referrer Token and API Key are required for new configuration' })
    }

    // Use existing credentials if not provided in request
    const finalReferrerToken = referrerToken ? referrerToken.trim() : existingConfig?.referrerToken
    const finalApiKey = apiKey ? apiKey.trim() : existingConfig?.apiKey

    if (!finalReferrerToken || !finalApiKey) {
      return res.status(400).json({ error: 'Referrer Token and API Key are required' })
    }

    const result = await saveRepositConfig(companyData.companyId, {
      referrerToken: finalReferrerToken,
      apiKey: finalApiKey,
      supplierId: supplierId.trim(),
      environment: environment || 'sandbox',
      defaultAgentId: defaultAgentId?.trim() || undefined
    })

    if (!result.success) {
      return res.status(500).json({ error: result.error })
    }

    res.json({ success: true, message: 'Reposit credentials saved successfully' })
  } catch (error) {
    console.error('Error saving Reposit settings:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * DELETE /api/settings/reposit
 * Remove Reposit integration
 */
router.delete('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyData = await getUserCompanyAndRole(req)

    if (!companyData) {
      return res.status(404).json({ error: 'Company not found' })
    }

    if (!['admin', 'owner'].includes(companyData.role)) {
      return res.status(403).json({ error: 'Only admins and owners can remove integrations' })
    }

    const result = await removeRepositConfig(companyData.companyId)

    if (!result.success) {
      return res.status(500).json({ error: result.error })
    }

    res.json({ success: true, message: 'Reposit integration removed' })
  } catch (error) {
    console.error('Error removing Reposit settings:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * POST /api/settings/reposit/test
 * Test Reposit connection
 */
router.post('/test', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyRepositConfig(companyId)

    if (!config) {
      return res.status(400).json({ error: 'Reposit is not configured. Please save credentials first.' })
    }

    console.log('[Reposit Settings] Testing connection with config:', {
      supplierId: config.supplierId,
      environment: config.environment,
      hasReferrerToken: !!config.referrerToken,
      hasApiKey: !!config.apiKey
    })

    const result = await testConnection(config)

    console.log('[Reposit Settings] Test connection result:', result)

    await updateRepositTestStatus(companyId, result.success ? 'success' : 'failed')

    if (result.success) {
      res.json({ success: true, message: result.message, supplierInfo: result.supplierInfo })
    } else {
      res.status(400).json({ success: false, error: result.message })
    }
  } catch (error) {
    console.error('Error testing Reposit connection:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * GET /api/settings/reposit/agents
 * List supplier agents
 */
router.get('/agents', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyRepositConfig(companyId)

    if (!config) {
      return res.status(400).json({ error: 'Reposit is not configured' })
    }

    const result = await getSupplierAgents(config)

    if (result.success) {
      res.json({ success: true, agents: result.agents })
    } else {
      res.status(400).json({ success: false, error: result.error })
    }
  } catch (error) {
    console.error('Error getting Reposit agents:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

export default router

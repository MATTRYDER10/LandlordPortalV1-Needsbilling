import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import {
  getCompanyApex27Config,
  testConnection,
  saveApex27Config,
  removeApex27Config,
  updateApex27TestStatus
} from '../services/apex27Service'

const router = Router()

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
 * GET /api/settings/apex27
 * Get Apex27 integration status
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
        apex27_api_key_encrypted,
        apex27_connected_at,
        apex27_last_tested_at,
        apex27_last_test_status,
        apex27_last_sync_at,
        apex27_sync_enabled,
        apex27_branch_id
      `)
      .eq('company_id', companyId)
      .single()

    if (integrationError && integrationError.code !== 'PGRST116') {
      console.error('[Apex27] Error fetching integration:', integrationError)
    }

    const configured = !!integration?.apex27_api_key_encrypted

    let maskedApiKey = null
    if (configured) {
      const config = await getCompanyApex27Config(companyId)
      if (config?.apiKey) {
        maskedApiKey = '••••••••' + config.apiKey.slice(-4)
      }
    }

    res.json({
      configured,
      maskedApiKey,
      connectedAt: integration?.apex27_connected_at || null,
      lastTestedAt: integration?.apex27_last_tested_at || null,
      lastTestStatus: integration?.apex27_last_test_status || null,
      lastSyncAt: integration?.apex27_last_sync_at || null,
      syncEnabled: integration?.apex27_sync_enabled || false,
      branchId: integration?.apex27_branch_id || null
    })
  } catch (error) {
    console.error('[Apex27] Error getting settings:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * POST /api/settings/apex27
 * Save Apex27 API key
 */
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { apiKey } = req.body

    if (!apiKey) {
      return res.status(400).json({ error: 'API Key is required' })
    }

    const companyData = await getUserCompanyAndRole(req)

    if (!companyData) {
      return res.status(404).json({ error: 'Company not found' })
    }

    if (!['admin', 'owner'].includes(companyData.role)) {
      return res.status(403).json({ error: 'Only admins and owners can configure integrations' })
    }

    const result = await saveApex27Config(companyData.companyId, apiKey.trim())

    if (!result.success) {
      return res.status(500).json({ error: result.error })
    }

    res.json({ success: true, message: 'Apex27 API key saved successfully' })
  } catch (error) {
    console.error('[Apex27] Error saving settings:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * DELETE /api/settings/apex27
 * Remove Apex27 integration
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

    const result = await removeApex27Config(companyData.companyId)

    if (!result.success) {
      return res.status(500).json({ error: result.error })
    }

    res.json({ success: true, message: 'Apex27 integration removed' })
  } catch (error) {
    console.error('[Apex27] Error removing settings:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * POST /api/settings/apex27/test
 * Test Apex27 connection
 */
router.post('/test', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyApex27Config(companyId)

    if (!config) {
      return res.status(400).json({ error: 'Apex27 is not configured. Please save your API key first.' })
    }

    const result = await testConnection(config)

    await updateApex27TestStatus(companyId, result.success ? 'success' : 'failed')

    if (result.success) {
      res.json({ success: true, message: result.message, branches: result.branches })
    } else {
      res.status(400).json({ success: false, error: result.message })
    }
  } catch (error) {
    console.error('[Apex27] Error testing connection:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * GET /api/settings/apex27/branches
 * Fetch branches from Apex27 (without updating test status)
 */
router.get('/branches', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyApex27Config(companyId)

    if (!config) {
      return res.status(400).json({ error: 'Apex27 is not configured' })
    }

    const result = await testConnection(config)

    if (!result.success) {
      return res.status(400).json({ error: result.message })
    }

    res.json({ branches: result.branches || [] })
  } catch (error) {
    console.error('[Apex27] Error fetching branches:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * POST /api/settings/apex27/branch
 * Save selected Apex27 branch
 */
router.post('/branch', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { branchId } = req.body

    const companyData = await getUserCompanyAndRole(req)

    if (!companyData) {
      return res.status(404).json({ error: 'Company not found' })
    }

    if (!['admin', 'owner'].includes(companyData.role)) {
      return res.status(403).json({ error: 'Only admins and owners can configure integrations' })
    }

    const { error } = await supabase
      .from('company_integrations')
      .update({
        apex27_branch_id: branchId || null,
        updated_at: new Date().toISOString()
      })
      .eq('company_id', companyData.companyId)

    if (error) {
      console.error('[Apex27] Error saving branch:', error)
      return res.status(500).json({ error: 'Failed to save branch selection' })
    }

    res.json({ success: true })
  } catch (error) {
    console.error('[Apex27] Error saving branch:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

export default router

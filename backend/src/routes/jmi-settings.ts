import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import {
  getCompanyJMIConfig,
  saveJMIConfig,
  removeJMIConfig,
  testJMIConnection,
  updateJMITestStatus
} from '../services/jmiService'

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
 * GET /api/settings/jmi
 * Get JMI integration status
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
        jmi_api_key_encrypted,
        jmi_environment,
        jmi_connected_at,
        jmi_last_tested_at,
        jmi_last_test_status
      `)
      .eq('company_id', companyId)
      .single()

    if (integrationError && integrationError.code !== 'PGRST116') {
      console.error('[JMI] Error fetching integration:', integrationError)
    }

    const configured = !!integration?.jmi_api_key_encrypted

    let maskedApiKey = null
    if (configured) {
      const config = await getCompanyJMIConfig(companyId)
      if (config?.apiKey) {
        maskedApiKey = '••••••••' + config.apiKey.slice(-4)
      }
    }

    res.json({
      configured,
      maskedApiKey,
      environment: integration?.jmi_environment || 'sandbox',
      connectedAt: integration?.jmi_connected_at || null,
      lastTestedAt: integration?.jmi_last_tested_at || null,
      lastTestStatus: integration?.jmi_last_test_status || null
    })
  } catch (error) {
    console.error('[JMI] Error getting settings:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * POST /api/settings/jmi
 * Save JMI API key and environment
 */
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { apiKey, environment } = req.body

    if (!apiKey) {
      return res.status(400).json({ error: 'API Key is required' })
    }

    if (environment && !['sandbox', 'production'].includes(environment)) {
      return res.status(400).json({ error: 'Environment must be sandbox or production' })
    }

    const companyData = await getUserCompanyAndRole(req)

    if (!companyData) {
      return res.status(404).json({ error: 'Company not found' })
    }

    if (!['admin', 'owner'].includes(companyData.role)) {
      return res.status(403).json({ error: 'Only admins and owners can configure integrations' })
    }

    const result = await saveJMIConfig(companyData.companyId, apiKey.trim(), environment || 'sandbox')

    if (!result.success) {
      return res.status(500).json({ error: result.error })
    }

    res.json({ success: true, message: 'JMI API key saved successfully' })
  } catch (error) {
    console.error('[JMI] Error saving settings:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * POST /api/settings/jmi/test
 * Test JMI connection
 */
router.post('/test', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyJMIConfig(companyId)

    if (!config) {
      return res.status(400).json({ error: 'JMI is not configured. Please save your API key first.' })
    }

    const result = await testJMIConnection(config.apiKey, config.environment)

    await updateJMITestStatus(companyId, result.success ? 'success' : 'failed')

    if (result.success) {
      res.json({ success: true, message: result.message })
    } else {
      res.status(400).json({ success: false, error: result.message })
    }
  } catch (error) {
    console.error('[JMI] Error testing connection:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * DELETE /api/settings/jmi
 * Remove JMI integration
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

    const result = await removeJMIConfig(companyData.companyId)

    if (!result.success) {
      return res.status(500).json({ error: result.error })
    }

    res.json({ success: true, message: 'JMI integration removed' })
  } catch (error) {
    console.error('[JMI] Error removing settings:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

export default router

import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import {
  getCompanyTDSConfig,
  testConnection,
  saveTDSConfig,
  removeTDSConfig,
  updateTDSTestStatus
} from '../services/tdsService'
import {
  getCompanyTDSInsuredConfig,
  saveTDSInsuredConfig,
  removeTDSInsuredConfig,
  testInsuredConnection,
  getAuthorizationUrl,
  exchangeCodeForToken,
  saveTDSInsuredTokens
} from '../services/tdsInsuredService'

const router = Router()

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get company ID and role for the authenticated user, supporting multi-branch users
 * Checks X-Branch-Id header first, then falls back to first company
 */
async function getUserCompanyAndRole(req: AuthRequest): Promise<{ companyId: string; role: string } | null> {
  const userId = req.user?.id
  if (!userId) return null

  const branchId = req.headers['x-branch-id'] as string | undefined

  if (branchId) {
    // Verify user belongs to this branch
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

  // Fallback: Get user's first company (don't use .single() for multi-branch users)
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

/**
 * Simple helper for routes that don't need role
 */
async function getUserCompanyId(req: AuthRequest): Promise<string | null> {
  const result = await getUserCompanyAndRole(req)
  return result?.companyId || null
}

// ============================================================================
// UNIFIED STATUS - Get status of all TDS integrations
// ============================================================================

/**
 * GET /api/settings/tds
 * Get status of all TDS integrations (Custodial and Insured)
 */
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Get TDS Custodial integration data
    const { data: integration, error: integrationError } = await supabase
      .from('company_integrations')
      .select(`
        tds_member_id, tds_branch_id, tds_environment, tds_connected_at,
        tds_last_tested_at, tds_last_test_status, tds_api_key_encrypted,
        tds_insured_client_id, tds_insured_member_id, tds_insured_branch_id,
        tds_insured_environment, tds_insured_connected_at, tds_insured_access_token_encrypted,
        tds_insured_last_tested_at, tds_insured_last_test_status
      `)
      .eq('company_id', companyId)
      .single()

    if (integrationError && integrationError.code !== 'PGRST116') {
      console.error('Error fetching TDS integration:', integrationError)
    }

    // Custodial status
    const custodialConfigured = !!(integration?.tds_api_key_encrypted && integration?.tds_member_id)
    let custodialMaskedApiKey = null
    if (integration?.tds_api_key_encrypted) {
      const config = await getCompanyTDSConfig(companyId)
      if (config?.apiKey) {
        custodialMaskedApiKey = '••••••••' + config.apiKey.slice(-4)
      }
    }

    // Insured status
    const insuredConfigured = !!(integration?.tds_insured_client_id && integration?.tds_insured_member_id)
    const insuredAuthorized = !!integration?.tds_insured_access_token_encrypted

    // Debug: log what we're about to return
    console.log('[TDS Settings] Returning response:', {
      companyId: companyId,
      custodialConfigured,
      memberId: integration?.tds_member_id
    })

    res.json({
      // Custodial
      custodial: {
        configured: custodialConfigured,
        memberId: integration?.tds_member_id || null,
        branchId: integration?.tds_branch_id || null,
        environment: integration?.tds_environment || 'sandbox',
        maskedApiKey: custodialMaskedApiKey,
        connectedAt: integration?.tds_connected_at || null,
        lastTestedAt: integration?.tds_last_tested_at || null,
        lastTestStatus: integration?.tds_last_test_status || null
      },
      // Insured
      insured: {
        configured: insuredConfigured,
        authorized: insuredAuthorized,
        clientId: integration?.tds_insured_client_id || null,
        memberId: integration?.tds_insured_member_id || null,
        branchId: integration?.tds_insured_branch_id || null,
        environment: integration?.tds_insured_environment || 'sandbox',
        connectedAt: integration?.tds_insured_connected_at || null,
        lastTestedAt: integration?.tds_insured_last_tested_at || null,
        lastTestStatus: integration?.tds_insured_last_test_status || null
      },
      // Legacy format for backwards compatibility
      configured: custodialConfigured,
      memberId: integration?.tds_member_id || null,
      branchId: integration?.tds_branch_id || null,
      environment: integration?.tds_environment || 'sandbox',
      maskedApiKey: custodialMaskedApiKey,
      connectedAt: integration?.tds_connected_at || null,
      lastTestedAt: integration?.tds_last_tested_at || null,
      lastTestStatus: integration?.tds_last_test_status || null,
      // Debug marker to confirm this code is being used
      _debug: {
        timestamp: new Date().toISOString(),
        companyIdUsed: companyId,
        branchIdHeader: req.headers['x-branch-id'] || null
      }
    })
  } catch (error) {
    console.error('Error getting TDS settings:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

// ============================================================================
// TDS CUSTODIAL ROUTES
// ============================================================================

/**
 * POST /api/settings/tds/custodial
 * Save TDS Custodial credentials
 */
router.post('/custodial', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { memberId, branchId, apiKey, environment } = req.body

    if (!memberId) {
      return res.status(400).json({ error: 'Member ID is required' })
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
    const existingConfig = await getCompanyTDSConfig(companyData.companyId)

    // If no apiKey provided and no existing config, require apiKey
    if (!apiKey && !existingConfig) {
      return res.status(400).json({ error: 'API Key is required for new configuration' })
    }

    // Use existing apiKey if not provided in request
    const finalApiKey = apiKey ? apiKey.trim() : existingConfig?.apiKey

    if (!finalApiKey) {
      return res.status(400).json({ error: 'API Key is required' })
    }

    const result = await saveTDSConfig(companyData.companyId, {
      memberId: memberId.trim(),
      branchId: (branchId || '0').trim(),
      apiKey: finalApiKey,
      environment: environment || 'sandbox'
    })

    if (!result.success) {
      return res.status(500).json({ error: result.error })
    }

    res.json({ success: true, message: 'TDS Custodial credentials saved successfully' })
  } catch (error) {
    console.error('Error saving TDS Custodial settings:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * DELETE /api/settings/tds/custodial
 * Remove TDS Custodial integration
 */
router.delete('/custodial', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyData = await getUserCompanyAndRole(req)

    if (!companyData) {
      return res.status(404).json({ error: 'Company not found' })
    }

    if (!['admin', 'owner'].includes(companyData.role)) {
      return res.status(403).json({ error: 'Only admins and owners can remove integrations' })
    }

    const result = await removeTDSConfig(companyData.companyId)

    if (!result.success) {
      return res.status(500).json({ error: result.error })
    }

    res.json({ success: true, message: 'TDS Custodial integration removed' })
  } catch (error) {
    console.error('Error removing TDS Custodial settings:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * POST /api/settings/tds/custodial/test
 * Test TDS Custodial connection
 */
router.post('/custodial/test', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyTDSConfig(companyId)

    if (!config) {
      return res.status(400).json({ error: 'TDS Custodial is not configured. Please save credentials first.' })
    }

    console.log('[TDS Settings] Testing Custodial connection with config:', {
      memberId: config.memberId,
      branchId: config.branchId,
      environment: config.environment,
      hasApiKey: !!config.apiKey
    })

    const result = await testConnection(config)

    console.log('[TDS Settings] Test Custodial connection result:', result)

    await updateTDSTestStatus(companyId, result.success ? 'success' : 'failed')

    if (result.success) {
      res.json({ success: true, message: result.message })
    } else {
      res.status(400).json({ success: false, error: result.message })
    }
  } catch (error) {
    console.error('Error testing TDS Custodial connection:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

// ============================================================================
// TDS INSURED ROUTES
// ============================================================================

/**
 * POST /api/settings/tds/insured
 * Save TDS Insured configuration (client credentials, not OAuth tokens)
 */
router.post('/insured', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { clientId, clientSecret, memberId, branchId, environment } = req.body

    if (!clientId || !clientSecret || !memberId) {
      return res.status(400).json({ error: 'Client ID, Client Secret, and Member ID are required' })
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

    const result = await saveTDSInsuredConfig(companyData.companyId, {
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      memberId: memberId.trim(),
      branchId: (branchId || '').trim(),
      environment: environment || 'sandbox'
    })

    if (!result.success) {
      return res.status(500).json({ error: result.error })
    }

    res.json({ success: true, message: 'TDS Insured configuration saved. Please authorize to complete setup.' })
  } catch (error) {
    console.error('Error saving TDS Insured settings:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * GET /api/settings/tds/insured/auth-url
 * Get OAuth authorization URL for TDS Insured
 */
router.get('/insured/auth-url', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const redirectUri = req.query.redirect_uri as string

    if (!redirectUri) {
      return res.status(400).json({ error: 'redirect_uri is required' })
    }

    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyTDSInsuredConfig(companyId)

    if (!config || !config.clientId) {
      return res.status(400).json({ error: 'TDS Insured is not configured. Please save credentials first.' })
    }

    // Generate state for CSRF protection
    const state = Buffer.from(JSON.stringify({
      companyId: companyId,
      timestamp: Date.now()
    })).toString('base64')

    const authUrl = getAuthorizationUrl(
      { clientId: config.clientId, environment: config.environment },
      redirectUri,
      state
    )

    res.json({ authUrl, state })
  } catch (error) {
    console.error('Error getting TDS Insured auth URL:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * POST /api/settings/tds/insured/callback
 * Handle OAuth callback and exchange code for tokens
 */
router.post('/insured/callback', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { code, state } = req.body

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' })
    }

    const companyData = await getUserCompanyAndRole(req)

    if (!companyData) {
      return res.status(404).json({ error: 'Company not found' })
    }

    if (!['admin', 'owner'].includes(companyData.role)) {
      return res.status(403).json({ error: 'Only admins and owners can authorize integrations' })
    }

    const config = await getCompanyTDSInsuredConfig(companyData.companyId)

    if (!config || !config.clientId || !config.clientSecret) {
      return res.status(400).json({ error: 'TDS Insured is not configured' })
    }

    // Exchange code for tokens
    const tokenResult = await exchangeCodeForToken(
      {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        environment: config.environment
      },
      code
    )

    if (!tokenResult.success || !tokenResult.accessToken || !tokenResult.refreshToken) {
      return res.status(400).json({ error: tokenResult.error || 'Failed to exchange code for tokens' })
    }

    // Save tokens
    const saveResult = await saveTDSInsuredTokens(
      companyData.companyId,
      tokenResult.accessToken,
      tokenResult.refreshToken,
      tokenResult.expiresIn || 3600
    )

    if (!saveResult.success) {
      return res.status(500).json({ error: saveResult.error })
    }

    res.json({ success: true, message: 'TDS Insured authorized successfully' })
  } catch (error) {
    console.error('Error handling TDS Insured callback:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * DELETE /api/settings/tds/insured
 * Remove TDS Insured integration
 */
router.delete('/insured', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyData = await getUserCompanyAndRole(req)

    if (!companyData) {
      return res.status(404).json({ error: 'Company not found' })
    }

    if (!['admin', 'owner'].includes(companyData.role)) {
      return res.status(403).json({ error: 'Only admins and owners can remove integrations' })
    }

    const result = await removeTDSInsuredConfig(companyData.companyId)

    if (!result.success) {
      return res.status(500).json({ error: result.error })
    }

    res.json({ success: true, message: 'TDS Insured integration removed' })
  } catch (error) {
    console.error('Error removing TDS Insured settings:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * POST /api/settings/tds/insured/test
 * Test TDS Insured connection
 */
router.post('/insured/test', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyTDSInsuredConfig(companyId)

    if (!config) {
      return res.status(400).json({ error: 'TDS Insured is not configured' })
    }

    if (!config.accessToken) {
      return res.status(400).json({ error: 'TDS Insured is not authorized. Please complete OAuth flow.' })
    }

    const result = await testInsuredConnection(companyId, config)

    // Update test status
    await supabase
      .from('company_integrations')
      .update({
        tds_insured_last_tested_at: new Date().toISOString(),
        tds_insured_last_test_status: result.success ? 'success' : 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('company_id', companyId)

    if (result.success) {
      res.json({ success: true, message: result.message })
    } else {
      res.status(400).json({ success: false, error: result.message })
    }
  } catch (error) {
    console.error('Error testing TDS Insured connection:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

// ============================================================================
// LEGACY ROUTES (for backwards compatibility)
// ============================================================================

/**
 * POST /api/settings/tds
 * Save TDS credentials (legacy - maps to Custodial)
 */
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { memberId, branchId, apiKey, environment } = req.body

    if (!memberId) {
      return res.status(400).json({ error: 'Member ID is required' })
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
    const existingConfig = await getCompanyTDSConfig(companyData.companyId)

    // If no apiKey provided and no existing config, require apiKey
    if (!apiKey && !existingConfig) {
      return res.status(400).json({ error: 'API Key is required for new configuration' })
    }

    // Use existing apiKey if not provided in request
    const finalApiKey = apiKey ? apiKey.trim() : existingConfig?.apiKey

    if (!finalApiKey) {
      return res.status(400).json({ error: 'API Key is required' })
    }

    const result = await saveTDSConfig(companyData.companyId, {
      memberId: memberId.trim(),
      branchId: (branchId || '0').trim(),
      apiKey: finalApiKey,
      environment: environment || 'sandbox'
    })

    if (!result.success) {
      return res.status(500).json({ error: result.error })
    }

    res.json({ success: true, message: 'TDS credentials saved successfully' })
  } catch (error) {
    console.error('Error saving TDS settings:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * DELETE /api/settings/tds
 * Remove TDS integration (legacy - maps to Custodial)
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

    const result = await removeTDSConfig(companyData.companyId)

    if (!result.success) {
      return res.status(500).json({ error: result.error })
    }

    res.json({ success: true, message: 'TDS integration removed' })
  } catch (error) {
    console.error('Error removing TDS settings:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * POST /api/settings/tds/test
 * Test TDS connection (legacy - maps to Custodial)
 */
router.post('/test', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyTDSConfig(companyId)

    if (!config) {
      return res.status(400).json({ error: 'TDS is not configured. Please save credentials first.' })
    }

    const result = await testConnection(config)
    await updateTDSTestStatus(companyId, result.success ? 'success' : 'failed')

    if (result.success) {
      res.json({ success: true, message: result.message })
    } else {
      res.status(400).json({ success: false, error: result.message })
    }
  } catch (error) {
    console.error('Error testing TDS connection:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

export default router

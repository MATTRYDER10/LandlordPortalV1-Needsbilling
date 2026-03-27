import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import {
  getCompanyMyDepositsConfig,
  saveMyDepositsConfig,
  removeMyDepositsConfig,
  testConnection,
  updateMyDepositsTestStatus,
  getAuthorizationUrl,
  generateCodeVerifier,
  generateCodeChallenge,
  exchangeCodeForTokens,
  saveMyDepositsTokens
} from '../services/mydepositsService'

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
// STATUS ENDPOINT
// ============================================================================

/**
 * GET /api/settings/mydeposits
 * Get mydeposits integration status
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
        mydeposits_client_id,
        mydeposits_client_secret_encrypted,
        mydeposits_member_id,
        mydeposits_branch_id,
        mydeposits_scheme_type,
        mydeposits_environment,
        mydeposits_connected_at,
        mydeposits_access_token_encrypted,
        mydeposits_last_tested_at,
        mydeposits_last_test_status
      `)
      .eq('company_id', companyId)
      .single()

    if (integrationError && integrationError.code !== 'PGRST116') {
      console.error('Error fetching mydeposits integration:', integrationError)
    }

    const configured = !!(integration?.mydeposits_client_id)
    const authorized = !!(integration?.mydeposits_access_token_encrypted)

    // Generate client secret hint (last 4 chars) if configured
    let clientSecretHint: string | null = null
    if (integration?.mydeposits_client_secret_encrypted) {
      // The encrypted value exists, so we show a hint
      // We'll just indicate it's configured since we can't decrypt here easily
      clientSecretHint = '••••••••••••'
    }

    res.json({
      configured,
      authorized,
      clientId: integration?.mydeposits_client_id || null,
      clientSecretHint,
      memberId: integration?.mydeposits_member_id || null,
      branchId: integration?.mydeposits_branch_id || null,
      schemeType: integration?.mydeposits_scheme_type || 'custodial',
      environment: integration?.mydeposits_environment || 'sandbox',
      connectedAt: integration?.mydeposits_connected_at || null,
      lastTestedAt: integration?.mydeposits_last_tested_at || null,
      lastTestStatus: integration?.mydeposits_last_test_status || null
    })
  } catch (error) {
    console.error('Error getting mydeposits settings:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

// ============================================================================
// CONFIGURATION ENDPOINTS
// ============================================================================

/**
 * POST /api/settings/mydeposits
 * Save mydeposits client credentials (before OAuth)
 */
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { clientId, clientSecret, schemeType, environment } = req.body

    if (!clientId || !clientSecret) {
      return res.status(400).json({ error: 'Client ID and Client Secret are required' })
    }

    if (schemeType && schemeType !== 'custodial') {
      return res.status(400).json({ error: 'Only custodial scheme is supported' })
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

    const result = await saveMyDepositsConfig(companyData.companyId, {
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      schemeType: schemeType || 'custodial',
      environment: environment || 'sandbox'
    })

    if (!result.success) {
      return res.status(500).json({ error: result.error })
    }

    res.json({ success: true, message: 'mydeposits credentials saved. Please link your account to complete setup.' })
  } catch (error) {
    console.error('Error saving mydeposits settings:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * DELETE /api/settings/mydeposits
 * Remove mydeposits integration
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

    const result = await removeMyDepositsConfig(companyData.companyId)

    if (!result.success) {
      return res.status(500).json({ error: result.error })
    }

    res.json({ success: true, message: 'mydeposits integration removed' })
  } catch (error) {
    console.error('Error removing mydeposits settings:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

// ============================================================================
// OAUTH ENDPOINTS
// ============================================================================

/**
 * GET /api/settings/mydeposits/auth/start
 * Start OAuth flow - returns auth URL and code verifier
 */
router.get('/auth/start', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const redirectUri = req.query.redirect_uri as string

    if (!redirectUri) {
      return res.status(400).json({ error: 'redirect_uri is required' })
    }

    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Ensure company_integrations record exists with platform credentials
    let config = await getCompanyMyDepositsConfig(companyId)
    if (!config) {
      // Auto-create with platform credentials
      const { saveMyDepositsConfig } = await import('../services/mydepositsService')
      await saveMyDepositsConfig(companyId, {
        clientId: 'platform',
        environment: 'live',
        schemeType: 'custodial'
      })
      config = await getCompanyMyDepositsConfig(companyId)
    }

    if (!config) {
      return res.status(500).json({ error: 'Failed to initialize mydeposits configuration' })
    }

    // Generate PKCE values
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)

    // Generate state for CSRF protection
    const state = Buffer.from(JSON.stringify({
      companyId: companyId,
      timestamp: Date.now()
    })).toString('base64')

    const authUrl = getAuthorizationUrl(
      {},
      redirectUri,
      codeChallenge,
      state
    )

    res.json({ authUrl, codeVerifier, state })
  } catch (error) {
    console.error('Error starting mydeposits OAuth:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * POST /api/settings/mydeposits/auth/callback
 * Handle OAuth callback - exchange code for tokens
 */
router.post('/auth/callback', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { code, codeVerifier, redirectUri } = req.body

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' })
    }

    if (!codeVerifier) {
      return res.status(400).json({ error: 'Code verifier is required' })
    }

    if (!redirectUri) {
      return res.status(400).json({ error: 'Redirect URI is required' })
    }

    const companyData = await getUserCompanyAndRole(req)

    if (!companyData) {
      return res.status(404).json({ error: 'Company not found' })
    }

    if (!['admin', 'owner'].includes(companyData.role)) {
      return res.status(403).json({ error: 'Only admins and owners can authorize integrations' })
    }

    const config = await getCompanyMyDepositsConfig(companyData.companyId)

    if (!config || !config.clientId || !config.clientSecret) {
      return res.status(400).json({ error: 'mydeposits is not configured' })
    }

    // Exchange code for tokens
    const tokenResult = await exchangeCodeForTokens(
      {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        environment: config.environment
      },
      code,
      codeVerifier,
      redirectUri
    )

    if (!tokenResult.success || !tokenResult.accessToken) {
      return res.status(400).json({ error: tokenResult.error || 'Failed to exchange code for tokens' })
    }

    // Save tokens
    const saveResult = await saveMyDepositsTokens(
      companyData.companyId,
      tokenResult.accessToken,
      tokenResult.refreshToken || '',
      tokenResult.expiresIn || 3600,
      tokenResult.memberId,
      tokenResult.branchId
    )

    if (!saveResult.success) {
      return res.status(500).json({ error: saveResult.error })
    }

    // Auto-mark as connected — OAuth success is proof of working connection
    await updateMyDepositsTestStatus(companyData.companyId, 'success')

    res.json({
      success: true,
      message: 'mydeposits account linked successfully',
      memberId: tokenResult.memberId,
      branchId: tokenResult.branchId
    })
  } catch (error) {
    console.error('Error handling mydeposits callback:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

// ============================================================================
// TEST CONNECTION
// ============================================================================

/**
 * POST /api/settings/mydeposits/test
 * Test mydeposits connection
 */
router.post('/test', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyMyDepositsConfig(companyId)

    if (!config) {
      return res.status(400).json({ error: 'mydeposits is not configured' })
    }

    if (!config.accessToken) {
      return res.status(400).json({ error: 'mydeposits is not authorized. Please link your account.' })
    }

    const result = await testConnection(companyId, config)
    await updateMyDepositsTestStatus(companyId, result.success ? 'success' : 'failed')

    if (result.success) {
      res.json({ success: true, message: result.message })
    } else {
      res.status(400).json({ success: false, error: result.message })
    }
  } catch (error) {
    console.error('Error testing mydeposits connection:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

export default router

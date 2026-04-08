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
    const { supplierId, apiKey, environment, defaultAgentId } = req.body

    // Referrer Token is always PropertyGoose's — hardcoded, not user-configurable
    const referrerToken = 'propertygoose_live_c5RzPdoy0D6dnPN'

    if (!supplierId) {
      return res.status(400).json({ error: 'Account ID is required' })
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

    // API Key required for new config, can keep existing on update
    if (!apiKey && !existingConfig) {
      return res.status(400).json({ error: 'Account ID and API Key are required' })
    }

    const finalApiKey = apiKey ? apiKey.trim() : existingConfig?.apiKey

    if (!finalApiKey) {
      return res.status(400).json({ error: 'API Key is required' })
    }

    const result = await saveRepositConfig(companyData.companyId, {
      referrerToken,
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

/**
 * POST /api/settings/reposit/request-integration
 * Send integration request email to Reposit
 */
router.post('/request-integration', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyData = await getUserCompanyAndRole(req)
    if (!companyData) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // Get user profile
    const { data: authUser } = await supabase.auth.admin.getUserById(userId)
    const userName = authUser?.user?.user_metadata?.full_name || 'Unknown'
    const userEmail = authUser?.user?.email || 'Unknown'

    // Get company name (try encrypted first, then fallback)
    const { decrypt } = await import('../services/encryption')
    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyData.companyId)
      .maybeSingle()

    const co = company as any
    const companyName = co?.name || (co?.name_encrypted ? decrypt(co.name_encrypted) : null) || co?.company_name || 'Unknown Company'

    // Send email to Reposit
    const { sendEmail } = await import('../services/emailService')

    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr><td style="background-color:#f97316;padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">PropertyGoose Integration Request</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
            Hi Reposit Team,
          </p>
          <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
            A PropertyGoose customer would like to integrate Reposit deposit replacement into their tenancy management workflow.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;padding:20px;margin-bottom:24px;">
            <tr><td style="padding:12px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:14px;width:140px;">Company Name</td>
                  <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">${companyName}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:14px;">Contact Name</td>
                  <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">${userName}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:14px;">Contact Email</td>
                  <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">${userEmail}</td>
                </tr>
              </table>
            </td></tr>
          </table>
          <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
            Please provide the following credentials for this company:
          </p>
          <ul style="margin:0 0 24px;padding-left:20px;color:#374151;font-size:15px;line-height:1.8;">
            <li><strong>Supplier ID</strong></li>
            <li><strong>Referrer Token</strong></li>
            <li><strong>API Key</strong></li>
          </ul>
          <p style="margin:0 0 8px;color:#374151;font-size:15px;line-height:1.6;">
            Please send responses back to <a href="mailto:dev@propertygoose.co.uk" style="color:#f97316;text-decoration:none;font-weight:600;">dev@propertygoose.co.uk</a>
          </p>
          <p style="margin:24px 0 0;color:#9ca3af;font-size:13px;">
            This is an automated request from the PropertyGoose platform.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    await sendEmail({
      to: 'partners@reposit.co.uk',
      cc: 'dev@propertygoose.co.uk',
      subject: `Reposit Integration Request — ${companyName}`,
      html
    })

    console.log(`[Reposit] Integration request sent for ${companyName} by ${userName} (${userEmail})`)
    res.json({ success: true })
  } catch (error) {
    console.error('Error sending Reposit integration request:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

export default router

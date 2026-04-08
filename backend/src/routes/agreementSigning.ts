import { Router, Request, Response } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { signatureService } from '../services/signatureService'
import { pdfGenerationService, AgreementPDFData } from '../services/pdfGenerationService'
import { supabase } from '../config/supabase'

const router = Router()

/**
 * Helper to get user's company ID with multi-branch support
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

// In-memory deduplication for email sends (prevents double-click duplicate sends)
const recentEmailSends = new Map<string, number>()
const EMAIL_SEND_COOLDOWN_MS = 5000 // 5 seconds

function isDuplicateEmailSend(key: string): boolean {
  const now = Date.now()
  const lastSend = recentEmailSends.get(key)

  if (lastSend && now - lastSend < EMAIL_SEND_COOLDOWN_MS) {
    return true // Duplicate within cooldown period
  }

  recentEmailSends.set(key, now)

  // Cleanup old entries (older than cooldown period)
  for (const [k, timestamp] of recentEmailSends.entries()) {
    if (now - timestamp > EMAIL_SEND_COOLDOWN_MS) {
      recentEmailSends.delete(k)
    }
  }

  return false
}

/**
 * Helper to extract client info from request
 */
function getClientInfo(req: Request) {
  return {
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        'unknown',
    userAgent: req.headers['user-agent'] || 'unknown'
  }
}

// ==========================================
// PUBLIC ROUTES (Magic Link Authenticated)
// ==========================================

/**
 * GET /api/signing/:token
 * Verify token and return agreement preview + signer info
 */
router.get('/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params

    const signature = await signatureService.verifySigningToken(token)

    if (!signature) {
      return res.status(400).json({
        error: 'This signing link is not valid. Please check the URL or contact the agent for assistance.',
        code: 'INVALID_TOKEN'
      })
    }

    // Log document view
    const clientInfo = getClientInfo(req)
    await signatureService.recordDocumentView(token, clientInfo)

    // Get signing status of all parties
    const signingStatus = await signatureService.getSigningStatus(signature.agreement_id)

    // Build response
    const agreement = signature.agreements
    const propertyAddress = [
      agreement.property_address.line1,
      agreement.property_address.line2,
      agreement.property_address.city,
      agreement.property_address.postcode
    ].filter(Boolean).join(', ')

    res.json({
      signatureId: signature.id,
      signerName: signature.signer_name,
      signerEmail: signature.signer_email,
      signerType: signature.signer_type,
      status: signature.status,
      alreadySigned: signature.status === 'signed',
      signedAt: signature.signed_at,
      agreement: {
        id: agreement.id,
        propertyAddress,
        language: agreement.language || 'english',
        templateType: agreement.template_type,
        rentAmount: agreement.rent_amount,
        depositAmount: agreement.deposit_amount,
        tenancyStartDate: agreement.tenancy_start_date,
        tenancyEndDate: agreement.tenancy_end_date
      },
      signingStatus,
      tokenExpiresAt: signature.token_expires_at
    })
  } catch (error: any) {
    console.error('Error verifying signing token:', error)
    res.status(500).json({ error: 'Failed to verify signing link' })
  }
})

/**
 * GET /api/signing/:token/pdf
 * Stream the unsigned PDF for preview
 */
router.get('/:token/pdf', async (req: Request, res: Response) => {
  try {
    const { token } = req.params

    const signature = await signatureService.verifySigningToken(token)

    if (!signature) {
      return res.status(400).json({
        error: 'This signing link is not valid. Please check the URL or contact the agent for assistance.',
        code: 'INVALID_TOKEN'
      })
    }

    const agreement = signature.agreements

    // Build PDF data
    const pdfData: AgreementPDFData = {
      templateType: agreement.template_type,
      agreementType: (agreement.agreement_type || 'ast') as any,
      language: agreement.language || 'english',
      propertyAddress: agreement.property_address,
      landlords: agreement.landlords,
      tenants: agreement.tenants,
      guarantors: agreement.guarantors || [],
      depositAmount: agreement.deposit_amount,
      rentAmount: agreement.rent_amount,
      tenancyStartDate: agreement.tenancy_start_date,
      tenancyEndDate: agreement.tenancy_end_date,
      rentDueDay: agreement.rent_due_day,
      depositSchemeType: agreement.deposit_scheme_type,
      permittedOccupiers: agreement.permitted_occupiers,
      bankAccountName: agreement.bank_account_name,
      bankAccountNumber: agreement.bank_account_number,
      bankSortCode: agreement.bank_sort_code,
      tenantEmail: agreement.tenant_email,
      landlordEmail: agreement.landlord_email,
      agentEmail: agreement.agent_email,
      managementType: agreement.management_type,
      breakClause: agreement.break_clause,
      specialClauses: agreement.special_clauses
    }

    // Generate preview PDF (without signatures)
    const pdfBuffer = await pdfGenerationService.generatePreviewPDF(pdfData)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'inline; filename="agreement_preview.pdf"')
    res.send(pdfBuffer)
  } catch (error: any) {
    console.error('Error generating PDF preview:', error)
    res.status(500).json({ error: 'Failed to generate PDF preview' })
  }
})

/**
 * POST /api/signing/:token/sign
 * Submit signature
 */
router.post('/:token/sign', async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const { signatureData, signatureType, typedName, geolocation } = req.body

    // Validate input
    if (!signatureData) {
      return res.status(400).json({ error: 'Signature data is required' })
    }

    if (!signatureType || !['draw', 'type'].includes(signatureType)) {
      return res.status(400).json({ error: 'Invalid signature type' })
    }

    if (signatureType === 'type' && !typedName) {
      return res.status(400).json({ error: 'Typed name is required for type signatures' })
    }

    const clientInfo = {
      ...getClientInfo(req),
      geolocation: geolocation || undefined
    }

    const result = await signatureService.submitSignature(
      token,
      signatureData,
      signatureType,
      typedName || null,
      clientInfo
    )

    res.json({
      success: true,
      message: result.allSigned
        ? 'All parties have signed. The completed agreement will be emailed to everyone.'
        : 'Signature recorded successfully. Waiting for other parties to sign.',
      allSigned: result.allSigned
    })
  } catch (error: any) {
    console.error('Error submitting signature:', error)

    if (error.message.includes('Invalid or expired')) {
      return res.status(400).json({
        error: error.message,
        code: 'INVALID_TOKEN'
      })
    }

    if (error.message.includes('already been signed')) {
      return res.status(400).json({
        error: error.message,
        code: 'ALREADY_SIGNED'
      })
    }

    res.status(500).json({ error: 'Failed to submit signature' })
  }
})

/**
 * POST /api/signing/:token/decline
 * Decline to sign
 */
router.post('/:token/decline', async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const { reason } = req.body

    const clientInfo = getClientInfo(req)

    await signatureService.declineSignature(token, reason || 'No reason provided', clientInfo)

    res.json({
      success: true,
      message: 'You have declined to sign this agreement.'
    })
  } catch (error: any) {
    console.error('Error declining signature:', error)
    res.status(500).json({ error: 'Failed to decline signature' })
  }
})

// ==========================================
// AUTHENTICATED ROUTES (Landlord/Agent)
// ==========================================

/**
 * Handler for initiating the signing workflow
 * Used by both /send-for-signing and /initiate-signing endpoints
 */
const initiateSigningHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const userId = req.user?.id

    // Get user's company with multi-branch support
    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Verify agreement ownership
    const { data: agreement } = await supabase
      .from('agreements')
      .select('id, company_id, signing_status')
      .eq('id', id)
      .single()

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' })
    }

    if (agreement.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    if (agreement.signing_status !== 'draft') {
      return res.status(400).json({
        error: 'Signing has already been initiated for this agreement',
        signingStatus: agreement.signing_status
      })
    }

    // Check for duplicate send (prevents race condition if called twice simultaneously)
    const dedupeKey = `initiate-${id}-${userId}`
    if (isDuplicateEmailSend(dedupeKey)) {
      return res.status(429).json({
        error: 'Signing is already being initiated, please wait'
      })
    }

    // Initiate signing workflow
    await signatureService.initiateSigning(id)

    res.json({
      success: true,
      message: 'Signing workflow initiated. Emails have been sent to all parties.'
    })
  } catch (error: any) {
    console.error('Error initiating signing:', error)
    res.status(500).json({ error: error.message || 'Failed to initiate signing' })
  }
}

/**
 * POST /api/agreements/:id/send-for-signing
 * POST /api/agreements/:id/initiate-signing
 * Start the signing workflow (both endpoints do the same thing)
 */
router.post('/agreements/:id/send-for-signing', authenticateToken, initiateSigningHandler)
router.post('/agreements/:id/initiate-signing', authenticateToken, initiateSigningHandler)

/**
 * GET /api/agreements/:id/signing-status
 * Get current signing progress
 */
router.get('/agreements/:id/signing-status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    // Get user's company with multi-branch support
    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Verify agreement ownership
    const { data: agreement } = await supabase
      .from('agreements')
      .select('id, company_id, signing_status, signing_initiated_at, signing_completed_at, signing_expires_at, signed_pdf_url')
      .eq('id', id)
      .single()

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' })
    }

    if (agreement.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Get signing status of all parties
    const signers = await signatureService.getSigningStatus(id)

    res.json({
      signingStatus: agreement.signing_status,
      initiatedAt: agreement.signing_initiated_at,
      completedAt: agreement.signing_completed_at,
      expiresAt: agreement.signing_expires_at,
      signedPdfUrl: agreement.signed_pdf_url,
      signers
    })
  } catch (error: any) {
    console.error('Error getting signing status:', error)
    res.status(500).json({ error: 'Failed to get signing status' })
  }
})

/**
 * POST /api/agreements/:id/send-reminder/:signatureId
 * Manually trigger reminder for specific signer
 * Body: { email?: string } - optionally update the signer's email before sending
 */
router.post('/agreements/:id/send-reminder/:signatureId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id, signatureId } = req.params
    const { email } = req.body
    const userId = req.user?.id

    // Get user's company with multi-branch support
    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Verify agreement ownership
    const { data: agreement } = await supabase
      .from('agreements')
      .select('id, company_id')
      .eq('id', id)
      .single()

    if (!agreement || agreement.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Check for duplicate send (prevents double-click duplicate emails)
    const dedupeKey = `reminder-${signatureId}-${userId}`
    if (isDuplicateEmailSend(dedupeKey)) {
      return res.status(429).json({
        error: 'Please wait a few seconds before sending another reminder'
      })
    }

    // If email provided, update the signature record first
    if (email) {
      await supabase
        .from('agreement_signatures')
        .update({ signer_email: email })
        .eq('id', signatureId)
    }

    await signatureService.sendReminderEmail(signatureId)

    res.json({
      success: true,
      message: 'Reminder email sent successfully'
    })
  } catch (error: any) {
    console.error('Error sending reminder:', error)
    res.status(500).json({ error: error.message || 'Failed to send reminder' })
  }
})

/**
 * POST /api/agreements/:id/cancel-signing
 * Cancel signing and expire all tokens
 * Query param: ?revertToDraft=true to reset status to draft instead of cancelled
 */
router.post('/agreements/:id/cancel-signing', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const revertToDraft = req.query.revertToDraft === 'true' || req.body.revertToDraft === true

    // Get user's company with multi-branch support
    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Verify agreement ownership
    const { data: agreement } = await supabase
      .from('agreements')
      .select('id, company_id')
      .eq('id', id)
      .single()

    if (!agreement || agreement.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Expire all signing tokens
    await supabase
      .from('agreement_signatures')
      .update({
        token_expires_at: new Date().toISOString()
      })
      .eq('agreement_id', id)
      .neq('status', 'signed')

    // Delete signature records so they can be recreated on next send
    await supabase
      .from('agreement_signatures')
      .delete()
      .eq('agreement_id', id)

    // Set status to draft or cancelled
    const newStatus = revertToDraft ? 'draft' : 'cancelled'
    await supabase
      .from('agreements')
      .update({
        signing_status: newStatus,
        signing_initiated_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    res.json({
      success: true,
      message: revertToDraft ? 'Agreement recalled to draft' : 'Signing has been cancelled',
      newStatus
    })
  } catch (error: any) {
    console.error('Error cancelling signing:', error)
    res.status(500).json({ error: 'Failed to cancel signing' })
  }
})

/**
 * POST /api/agreements/:id/resend-all
 * Resend signing emails to all pending signers
 */
router.post('/agreements/:id/resend-all', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const userId = req.user?.id

    // Get user's company with multi-branch support
    const companyId = await getUserCompanyId(req)

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Verify agreement ownership
    const { data: agreement } = await supabase
      .from('agreements')
      .select('id, company_id')
      .eq('id', id)
      .single()

    if (!agreement || agreement.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Check for duplicate send (prevents double-click duplicate emails)
    const dedupeKey = `resend-all-${id}-${userId}`
    if (isDuplicateEmailSend(dedupeKey)) {
      return res.status(429).json({
        error: 'Please wait a few seconds before resending emails'
      })
    }

    await signatureService.sendAllSigningEmails(id)

    res.json({
      success: true,
      message: 'Signing emails resent to all pending signers'
    })
  } catch (error: any) {
    console.error('Error resending emails:', error)
    res.status(500).json({ error: 'Failed to resend emails' })
  }
})

export default router

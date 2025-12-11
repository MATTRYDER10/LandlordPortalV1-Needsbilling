import { Router, Request, Response } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { signatureService } from '../services/signatureService'
import { pdfGenerationService, AgreementPDFData } from '../services/pdfGenerationService'
import { supabase } from '../config/supabase'

const router = Router()

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
        error: 'Invalid or expired signing link',
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
        error: 'Invalid or expired signing link',
        code: 'INVALID_TOKEN'
      })
    }

    const agreement = signature.agreements

    // Build PDF data
    const pdfData: AgreementPDFData = {
      templateType: agreement.template_type,
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
 * POST /api/agreements/:id/initiate-signing
 * Start the signing workflow
 */
router.post('/agreements/:id/initiate-signing', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const userId = req.user?.id

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .single()

    if (!companyUser?.company_id) {
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

    if (agreement.company_id !== companyUser.company_id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    if (agreement.signing_status !== 'draft') {
      return res.status(400).json({
        error: 'Signing has already been initiated for this agreement',
        signingStatus: agreement.signing_status
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
})

/**
 * GET /api/agreements/:id/signing-status
 * Get current signing progress
 */
router.get('/agreements/:id/signing-status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const userId = req.user?.id

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .single()

    if (!companyUser?.company_id) {
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

    if (agreement.company_id !== companyUser.company_id) {
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
 */
router.post('/agreements/:id/send-reminder/:signatureId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id, signatureId } = req.params
    const userId = req.user?.id

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .single()

    if (!companyUser?.company_id) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Verify agreement ownership
    const { data: agreement } = await supabase
      .from('agreements')
      .select('id, company_id')
      .eq('id', id)
      .single()

    if (!agreement || agreement.company_id !== companyUser.company_id) {
      return res.status(403).json({ error: 'Access denied' })
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
 */
router.post('/agreements/:id/cancel-signing', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const userId = req.user?.id

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .single()

    if (!companyUser?.company_id) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Verify agreement ownership
    const { data: agreement } = await supabase
      .from('agreements')
      .select('id, company_id')
      .eq('id', id)
      .single()

    if (!agreement || agreement.company_id !== companyUser.company_id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    await signatureService.cancelSigning(id)

    res.json({
      success: true,
      message: 'Signing has been cancelled'
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

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .single()

    if (!companyUser?.company_id) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Verify agreement ownership
    const { data: agreement } = await supabase
      .from('agreements')
      .select('id, company_id')
      .eq('id', id)
      .single()

    if (!agreement || agreement.company_id !== companyUser.company_id) {
      return res.status(403).json({ error: 'Access denied' })
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

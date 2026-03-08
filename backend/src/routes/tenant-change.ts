/**
 * Tenant Change Routes
 *
 * API endpoints for the 7-stage Change of Tenant (Sharer) workflow
 */

import express, { Router } from 'express'
import { authenticateToken, AuthRequest, getCompanyIdForRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import * as tenantChangeService from '../services/tenantChangeService'

const router: Router = express.Router()

// ============================================================================
// AUTHENTICATED ROUTES
// ============================================================================

/**
 * Create a new tenant change (Stage 1)
 * POST /api/tenant-change
 */
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { tenancyId, outgoingTenantIds, incomingTenants, expectedMoveOutDate, expectedMoveInDate } = req.body

    if (!tenancyId) {
      return res.status(400).json({ error: 'tenancyId is required' })
    }

    if (!outgoingTenantIds || !Array.isArray(outgoingTenantIds) || outgoingTenantIds.length === 0) {
      return res.status(400).json({ error: 'At least one outgoing tenant is required' })
    }

    if (!incomingTenants || !Array.isArray(incomingTenants) || incomingTenants.length === 0) {
      return res.status(400).json({ error: 'At least one incoming tenant is required' })
    }

    // Validate incoming tenants have required fields
    for (const tenant of incomingTenants) {
      if (!tenant.firstName || !tenant.lastName) {
        return res.status(400).json({ error: 'Each incoming tenant must have firstName and lastName' })
      }
    }

    const tenantChange = await tenantChangeService.createTenantChange({
      tenancyId,
      companyId,
      outgoingTenantIds,
      incomingTenants,
      expectedMoveOutDate,
      expectedMoveInDate
    }, userId)

    res.status(201).json({ tenantChange })
  } catch (error: any) {
    console.error('[TenantChange] Create error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get tenant change by ID
 * GET /api/tenant-change/:id
 */
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }
    const tenantChange = await tenantChangeService.getTenantChange(req.params.id, companyId)

    if (!tenantChange) {
      return res.status(404).json({ error: 'Tenant change not found' })
    }

    res.json({ tenantChange })
  } catch (error: any) {
    console.error('[TenantChange] Get error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get active tenant change for a tenancy
 * GET /api/tenant-change/tenancy/:tenancyId
 */
router.get('/tenancy/:tenancyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Verify company owns this tenancy
    const { data: tenancy } = await supabase
      .from('tenancies')
      .select('id')
      .eq('id', req.params.tenancyId)
      .eq('company_id', companyId)
      .single()

    if (!tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    const tenantChange = await tenantChangeService.getActiveTenantChange(req.params.tenancyId)
    res.json({ tenantChange })
  } catch (error: any) {
    console.error('[TenantChange] Get active error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Update tenant change details
 * PATCH /api/tenant-change/:id
 */
router.patch('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { outgoing_tenant_ids, incoming_tenants, expected_move_out_date, expected_move_in_date } = req.body

    const updates: any = {}
    if (outgoing_tenant_ids !== undefined) updates.outgoing_tenant_ids = outgoing_tenant_ids
    if (incoming_tenants !== undefined) updates.incoming_tenants = incoming_tenants
    if (expected_move_out_date !== undefined) updates.expected_move_out_date = expected_move_out_date
    if (expected_move_in_date !== undefined) updates.expected_move_in_date = expected_move_in_date

    const tenantChange = await tenantChangeService.updateTenantChange(
      req.params.id,
      companyId,
      updates,
      userId
    )

    res.json({ tenantChange })
  } catch (error: any) {
    console.error('[TenantChange] Update error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Advance to next stage
 * POST /api/tenant-change/:id/advance
 */
router.post('/:id/advance', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const tenantChange = await tenantChangeService.advanceStage(req.params.id, companyId, userId)
    res.json({ tenantChange })
  } catch (error: any) {
    console.error('[TenantChange] Advance error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Set referencing decision (Stage 2)
 * POST /api/tenant-change/:id/referencing
 */
router.post('/:id/referencing', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }
    const { requiresReferencing } = req.body

    if (requiresReferencing === undefined) {
      return res.status(400).json({ error: 'requiresReferencing is required' })
    }

    const tenantChange = await tenantChangeService.setReferencingDecision(
      req.params.id,
      companyId,
      requiresReferencing,
      userId
    )

    res.json({ tenantChange })
  } catch (error: any) {
    console.error('[TenantChange] Referencing decision error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Override referencing (Stage 2)
 * POST /api/tenant-change/:id/override-referencing
 */
router.post('/:id/override-referencing', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }
    const { reason } = req.body

    if (!reason) {
      return res.status(400).json({ error: 'reason is required' })
    }

    const tenantChange = await tenantChangeService.overrideReferencing(
      req.params.id,
      companyId,
      reason,
      userId
    )

    res.json({ tenantChange })
  } catch (error: any) {
    console.error('[TenantChange] Override referencing error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Calculate pro-rata amounts (Stage 3)
 * POST /api/tenant-change/:id/calculate-pro-rata
 */
router.post('/:id/calculate-pro-rata', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }
    const { changeoverDate } = req.body

    if (!changeoverDate) {
      return res.status(400).json({ error: 'changeoverDate is required' })
    }

    const tenantChange = await tenantChangeService.getTenantChange(req.params.id, companyId)
    if (!tenantChange) {
      return res.status(404).json({ error: 'Tenant change not found' })
    }

    const proRata = await tenantChangeService.calculateProRata(tenantChange.tenancy_id, changeoverDate)
    res.json({ proRata })
  } catch (error: any) {
    console.error('[TenantChange] Calculate pro-rata error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Update fee details (Stage 3)
 * PATCH /api/tenant-change/:id/fee-details
 */
router.patch('/:id/fee-details', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const tenantChange = await tenantChangeService.updateFeeDetails(
      req.params.id,
      companyId,
      req.body,
      userId
    )

    res.json({ tenantChange })
  } catch (error: any) {
    console.error('[TenantChange] Update fee details error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Send fee invoice (Stage 3)
 * POST /api/tenant-change/:id/send-invoice
 */
router.post('/:id/send-invoice', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const tenantChange = await tenantChangeService.sendFeeInvoice(req.params.id, companyId, userId)
    res.json({ tenantChange })
  } catch (error: any) {
    console.error('[TenantChange] Send invoice error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Mark fee as received (Stage 3)
 * POST /api/tenant-change/:id/mark-fee-received
 */
router.post('/:id/mark-fee-received', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }
    const { amount, notes } = req.body

    if (amount === undefined || amount < 0) {
      return res.status(400).json({ error: 'Valid amount is required' })
    }

    const tenantChange = await tenantChangeService.markFeeReceived(
      req.params.id,
      companyId,
      { amount, notes },
      userId
    )

    res.json({ tenantChange })
  } catch (error: any) {
    console.error('[TenantChange] Mark fee received error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Send addendum for signing (Stage 4)
 * POST /api/tenant-change/:id/send-for-signing
 */
router.post('/:id/send-for-signing', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const tenantChange = await tenantChangeService.sendAddendumForSigning(
      req.params.id,
      companyId,
      userId
    )

    res.json({ tenantChange })
  } catch (error: any) {
    console.error('[TenantChange] Send for signing error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get signing status (Stage 5)
 * GET /api/tenant-change/:id/signing-status
 */
router.get('/:id/signing-status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const status = await tenantChangeService.getSigningStatus(req.params.id, companyId)
    res.json(status)
  } catch (error: any) {
    console.error('[TenantChange] Get signing status error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Resend signing email
 * POST /api/tenant-change/:id/resend/:signatureId
 */
router.post('/:id/resend/:signatureId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    await tenantChangeService.resendSigningEmail(req.params.signatureId, companyId, userId)
    res.json({ success: true })
  } catch (error: any) {
    console.error('[TenantChange] Resend signing email error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Complete changeover (Stage 6)
 * POST /api/tenant-change/:id/complete
 */
router.post('/:id/complete', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const tenantChange = await tenantChangeService.completeChangeover(
      req.params.id,
      companyId,
      userId
    )

    res.json({ tenantChange })
  } catch (error: any) {
    console.error('[TenantChange] Complete error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Update checklist (Stage 7)
 * PATCH /api/tenant-change/:id/checklist
 */
router.patch('/:id/checklist', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const tenantChange = await tenantChangeService.updateChecklist(
      req.params.id,
      companyId,
      req.body,
      userId
    )

    res.json({ tenantChange })
  } catch (error: any) {
    console.error('[TenantChange] Update checklist error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Finalize tenant change (Stage 7 completion)
 * POST /api/tenant-change/:id/finalize
 *
 * This completes the tenant change after checklist is done:
 * 1. Verifies all checklist items are complete
 * 2. Uploads signed addendum to documents
 * 3. Sends signed addendum PDF to all signers
 * 4. Updates tenants (archive old, add new)
 * 5. Marks as completed
 */
router.post('/:id/finalize', authenticateToken, async (req: AuthRequest, res) => {
  console.log(`[TenantChange] Finalize request received for ID: ${req.params.id}`)
  try {
    const userId = req.user!.id
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }
    console.log(`[TenantChange] Finalizing tenant change ${req.params.id} for company ${companyId}`)

    const tenantChange = await tenantChangeService.finalizeTenantChange(
      req.params.id,
      companyId,
      userId
    )

    console.log(`[TenantChange] Finalize complete - status: ${tenantChange.status}`)
    res.json({ tenantChange })
  } catch (error: any) {
    console.error('[TenantChange] Finalize error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Cancel tenant change
 * POST /api/tenant-change/:id/cancel
 */
router.post('/:id/cancel', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }
    const { reason } = req.body

    if (!reason) {
      return res.status(400).json({ error: 'reason is required' })
    }

    const tenantChange = await tenantChangeService.cancelTenantChange(
      req.params.id,
      companyId,
      reason,
      userId
    )

    res.json({ tenantChange })
  } catch (error: any) {
    console.error('[TenantChange] Cancel error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// PUBLIC ROUTES (Payment Confirmation)
// ============================================================================

/**
 * Get payment info by token (public)
 * GET /api/tenant-change/confirm-payment/:token
 */
router.get('/confirm-payment/:token', async (req, res) => {
  try {
    const result = await tenantChangeService.getTenantChangeByPaymentToken(req.params.token)

    if (!result) {
      return res.status(404).json({ error: 'Invalid or expired payment link' })
    }

    res.json(result)
  } catch (error: any) {
    console.error('[TenantChange] Get payment info error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Confirm payment (public, tenant click from email)
 * POST /api/tenant-change/confirm-payment/:token
 */
router.post('/confirm-payment/:token', async (req, res) => {
  try {
    const result = await tenantChangeService.confirmPaymentByTenant(req.params.token)

    res.json(result)
  } catch (error: any) {
    console.error('[TenantChange] Confirm payment error:', error)
    res.status(400).json({ error: error.message })
  }
})

// ============================================================================
// PUBLIC ROUTES (Magic Link Signing)
// ============================================================================

/**
 * Get signer info and document preview (public)
 * GET /api/tenant-change/sign/:token
 */
router.get('/sign/:token', async (req, res) => {
  try {
    const result = await tenantChangeService.getSignatureByToken(req.params.token)

    if (!result) {
      return res.status(404).json({ error: 'Invalid or expired signing link' })
    }

    // Don't expose full signature data
    res.json({
      signerName: result.signature.signer_name,
      signerType: result.signature.signer_type,
      status: result.signature.status,
      propertyAddress: result.propertyAddress,
      changeoverDate: result.tenantChange.changeover_date,
      incomingTenantCount: result.tenantChange.incoming_tenants?.length || 0,
      addendumPdfUrl: result.tenantChange.addendum_pdf_url
    })
  } catch (error: any) {
    console.error('[TenantChange] Get signer info error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Submit signature (public)
 * POST /api/tenant-change/sign/:token/sign
 */
router.post('/sign/:token/sign', async (req, res) => {
  try {
    const { signatureData, signatureType, typedName } = req.body

    if (!signatureData) {
      return res.status(400).json({ error: 'signatureData is required' })
    }

    if (!signatureType || !['draw', 'type'].includes(signatureType)) {
      return res.status(400).json({ error: 'signatureType must be "draw" or "type"' })
    }

    if (signatureType === 'type' && !typedName) {
      return res.status(400).json({ error: 'typedName is required for typed signatures' })
    }

    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown'
    const userAgent = req.headers['user-agent'] || 'unknown'

    const result = await tenantChangeService.submitSignature(
      req.params.token,
      signatureData,
      signatureType,
      typedName,
      ipAddress,
      userAgent
    )

    res.json(result)
  } catch (error: any) {
    console.error('[TenantChange] Submit signature error:', error)
    res.status(400).json({ error: error.message })
  }
})

/**
 * Decline to sign (public)
 * POST /api/tenant-change/sign/:token/decline
 */
router.post('/sign/:token/decline', async (req, res) => {
  try {
    const { reason } = req.body

    if (!reason) {
      return res.status(400).json({ error: 'reason is required' })
    }

    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown'
    const userAgent = req.headers['user-agent'] || 'unknown'

    await tenantChangeService.declineSignature(
      req.params.token,
      reason,
      ipAddress,
      userAgent
    )

    res.json({ success: true })
  } catch (error: any) {
    console.error('[TenantChange] Decline signature error:', error)
    res.status(400).json({ error: error.message })
  }
})

export default router

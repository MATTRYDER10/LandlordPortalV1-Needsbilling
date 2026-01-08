import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { agreementService, AgreementData, PropertyIntegration } from '../services/agreementService'
import { pdfGenerationService, AgreementPDFData } from '../services/pdfGenerationService'
import { supabase } from '../config/supabase'
import { decrypt } from '../services/encryption'
import * as billingService from '../services/billingService'
import * as creditService from '../services/creditService'
import { signatureService } from '../services/signatureService'

const router = Router()

/**
 * POST /api/agreements
 * Create a new agreement
 */
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .single()

    const companyId = companyUser?.company_id

    if (!userId || !companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Check credits BEFORE creating agreement (0.25 credits required)
    const hasEnoughCredits = await creditService.hasCredits(companyId, 0.25)
    if (!hasEnoughCredits) {
      return res.status(402).json({
        error: 'Insufficient credits',
        message: 'You need at least 0.25 credits to generate an agreement.',
        requires_credits: true
      })
    }

    // DEBUG: Log the ENTIRE request body
    console.log('===== FULL REQUEST BODY =====')
    console.log(JSON.stringify(req.body, null, 2))
    console.log('=============================')

    const {
      templateType,
      propertyAddress,
      landlords,
      tenants,
      guarantors,
      depositAmount,
      rentAmount,
      tenancyStartDate,
      tenancyEndDate,
      rentDueDay,
      depositSchemeType,
      permittedOccupiers,
      bankAccountName,
      bankAccountNumber,
      bankSortCode,
      tenantEmail,
      landlordEmail,
      agentEmail,
      managementType,
      breakClause,
      specialClauses,
      billsIncluded,
      language,
      referenceId,
      propertyId,
      complianceOverride
    }: AgreementData & {
      referenceId?: string
      propertyId?: string
      complianceOverride?: { acknowledged: boolean; reason?: string }
    } = req.body

    console.log('DEBUG Extracted values:')
    console.log('  rentDueDay:', rentDueDay)
    console.log('  depositSchemeType:', depositSchemeType)
    console.log('  permittedOccupiers:', permittedOccupiers)

    // Validation
    if (!templateType || !propertyAddress || !landlords || !tenants) {
      return res.status(400).json({
        error: 'Missing required fields: templateType, propertyAddress, landlords, tenants'
      })
    }

    // Validate array limits
    if (landlords.length === 0 || landlords.length > 20) {
      return res.status(400).json({
        error: 'Landlords must be between 1 and 20'
      })
    }

    if (tenants.length === 0 || tenants.length > 20) {
      return res.status(400).json({
        error: 'Tenants must be between 1 and 20'
      })
    }

    if (guarantors && guarantors.length > 20) {
      return res.status(400).json({
        error: 'Guarantors cannot exceed 20'
      })
    }

    // If propertyId is provided, check compliance status
    let hasExpiredCompliance = false
    let expiredComplianceTypes: string[] = []

    if (propertyId) {
      // Fetch compliance records for the property
      const { data: complianceRecords, error: complianceError } = await supabase
        .from('compliance_records')
        .select('compliance_type, status, expiry_date')
        .eq('property_id', propertyId)

      if (complianceError) {
        console.error('Error fetching compliance records:', complianceError)
      } else if (complianceRecords) {
        // Check for expired compliance
        const expired = complianceRecords.filter(r => r.status === 'expired')
        if (expired.length > 0) {
          hasExpiredCompliance = true
          expiredComplianceTypes = expired.map(r => r.compliance_type)
        }
      }

      // If there's expired compliance but no override acknowledgment, reject
      if (hasExpiredCompliance && !complianceOverride?.acknowledged) {
        return res.status(400).json({
          error: 'Compliance override required',
          message: 'The selected property has expired compliance certificates. Please acknowledge the override to proceed.',
          expiredComplianceTypes,
          requiresComplianceOverride: true
        })
      }
    }

    const agreementData: AgreementData = {
      templateType,
      propertyAddress,
      landlords,
      tenants,
      guarantors: guarantors || [],
      depositAmount,
      rentAmount,
      tenancyStartDate,
      tenancyEndDate,
      rentDueDay,
      depositSchemeType,
      permittedOccupiers,
      bankAccountName,
      bankAccountNumber,
      bankSortCode,
      tenantEmail,
      landlordEmail,
      agentEmail,
      managementType,
      breakClause,
      specialClauses,
      billsIncluded,
      language: language || 'english'
    }

    // Save to database with optional property integration
    const propertyIntegration = propertyId ? {
      propertyId,
      complianceOverride: complianceOverride || undefined
    } : undefined

    const agreementId = await agreementService.saveAgreement(
      agreementData,
      companyId,
      userId,
      referenceId,
      propertyIntegration
    )

    // Get the saved agreement
    const agreement = await agreementService.getAgreement(agreementId)

    res.status(201).json({
      message: 'Agreement created successfully',
      agreement
    })
  } catch (error: any) {
    console.error('Error creating agreement:', error)
    res.status(500).json({
      error: 'Failed to create agreement',
      details: error.message
    })
  }
})

/**
 * POST /api/agreements/:id/generate
 * Generate the DOCX file for an agreement
 */
router.post('/:id/generate', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const userId = req.user?.id

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .single()

    const companyId = companyUser?.company_id

    if (!userId || !companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Get the agreement
    const agreement = await agreementService.getAgreement(id)

    // Verify company ownership
    if (agreement.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Fetch company details (always needed for logo, address only for managed)
    let companyName: string | undefined
    let companyAddress: any | undefined
    let companyLogoUrl: string | undefined

    const { data: companyData } = await supabase
      .from('companies')
      .select('name_encrypted, address_encrypted, city_encrypted, postcode_encrypted, logo_url')
      .eq('id', companyId)
      .single()

    if (companyData) {
      companyLogoUrl = companyData.logo_url || undefined

      if (agreement.management_type === 'managed') {
        companyName = decrypt(companyData.name_encrypted) || ''
        companyAddress = {
          line1: decrypt(companyData.address_encrypted) || '',
          line2: '',
          city: decrypt(companyData.city_encrypted) || '',
          county: '',
          postcode: decrypt(companyData.postcode_encrypted) || ''
        }
      }
    }

    // Prepare agreement data
    const agreementData: AgreementData = {
      templateType: agreement.template_type,
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
      specialClauses: agreement.special_clauses,
      billsIncluded: agreement.bills_included,
      language: agreement.language || 'english',
      companyName,
      companyAddress
    }

    // Charge 0.25 credits for agreement generation BEFORE generating the PDF
    try {
      console.log(`Charging company ${companyId} 0.25 credits for agreement ${id}`)
      await creditService.deductCredits(
        companyId,
        0.25,
        null, // Not a reference, so pass null to avoid FK constraint violation
        `Agreement generation (${id})`,
        userId
      )
      console.log(`Successfully deducted 0.25 credits for agreement ${id}`)
    } catch (creditError: any) {
      console.error('Credit deduction failed for agreement:', creditError)
      return res.status(402).json({
        error: 'Insufficient credits',
        message: creditError.message || 'Unable to charge for agreement generation. Please add more credits.',
        requires_credits: true
      })
    }

    // Convert AgreementData to AgreementPDFData
    const pdfData: AgreementPDFData = {
      templateType: agreementData.templateType,
      language: agreementData.language || 'english',
      propertyAddress: agreementData.propertyAddress,
      landlords: agreementData.landlords,
      tenants: agreementData.tenants,
      guarantors: agreementData.guarantors,
      depositAmount: agreementData.depositAmount,
      rentAmount: agreementData.rentAmount,
      tenancyStartDate: agreementData.tenancyStartDate,
      tenancyEndDate: agreementData.tenancyEndDate,
      rentDueDay: agreementData.rentDueDay,
      depositSchemeType: agreementData.depositSchemeType,
      permittedOccupiers: agreementData.permittedOccupiers,
      bankAccountName: agreementData.bankAccountName,
      bankAccountNumber: agreementData.bankAccountNumber,
      bankSortCode: agreementData.bankSortCode,
      tenantEmail: agreementData.tenantEmail,
      landlordEmail: agreementData.landlordEmail,
      agentEmail: agreementData.agentEmail,
      managementType: agreementData.managementType,
      breakClause: agreementData.breakClause,
      specialClauses: agreementData.specialClauses,
      billsIncluded: agreementData.billsIncluded,
      companyName: agreementData.companyName,
      companyAddress: agreementData.companyAddress,
      companyLogoUrl
    }

    // Generate PDF (only after successful payment)
    const pdfBuffer = await pdfGenerationService.generatePreviewPDF(pdfData)

    // Generate filename
    const contractType = agreementData.language === 'welsh' ? 'WOC' : 'AST'
    const fileName = `${contractType}_${agreement.template_type}_${new Date().toISOString().split('T')[0]}.pdf`

    // Upload to storage
    const fileUrl = await agreementService.uploadAgreementFile(
      id,
      pdfBuffer,
      fileName
    )

    // Update agreement with file URL
    await agreementService.updateAgreementPdfUrl(id, fileUrl)

    // Check if signing should be initiated immediately (for backward compatibility)
    // By default, we no longer auto-initiate signing - user goes to preview page first
    const initiateSigning = req.query.initiateSigning === 'true'
    let signingInitiated = false

    if (initiateSigning) {
      try {
        console.log(`Initiating signing for agreement ${id}`)
        await signatureService.initiateSigning(id)
        console.log(`Signing initiated successfully for agreement ${id}`)
        signingInitiated = true
      } catch (signingError: any) {
        console.error('Failed to initiate signing:', signingError)
        // Don't fail the whole request - agreement was generated successfully
        // User can manually initiate signing from Agreement History or Preview page
      }
    }

    res.json({
      message: 'Agreement generated successfully',
      fileUrl,
      fileName,
      signingInitiated,
      agreementId: id
    })
  } catch (error: any) {
    console.error('Error generating agreement:', error)
    res.status(500).json({
      error: 'Failed to generate agreement',
      details: error.message
    })
  }
})

/**
 * GET /api/agreements/:id
 * Get agreement by ID
 */
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const userId = req.user?.id

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .single()

    const companyId = companyUser?.company_id

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const agreement = await agreementService.getAgreement(id)

    // Verify company ownership
    if (agreement.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    res.json({ agreement })
  } catch (error: any) {
    console.error('Error fetching agreement:', error)
    res.status(500).json({
      error: 'Failed to fetch agreement',
      details: error.message
    })
  }
})

/**
 * GET /api/agreements/reference/:referenceId
 * Get all agreements for a reference
 */
router.get('/reference/:referenceId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { referenceId } = req.params
    const userId = req.user?.id

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .single()

    const companyId = companyUser?.company_id

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const agreements = await agreementService.getAgreementsByReference(referenceId)

    res.json({ agreements })
  } catch (error: any) {
    console.error('Error fetching agreements:', error)
    res.status(500).json({
      error: 'Failed to fetch agreements',
      details: error.message
    })
  }
})

/**
 * GET /api/agreements
 * Get all agreements for the user's company
 */
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .single()

    const companyId = companyUser?.company_id

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const agreements = await agreementService.getAgreementsByCompany(companyId)

    res.json({ agreements })
  } catch (error: any) {
    console.error('Error fetching agreements:', error)
    res.status(500).json({
      error: 'Failed to fetch agreements',
      details: error.message
    })
  }
})

/**
 * PUT /api/agreements/:id
 * Update a draft agreement
 * Only allowed for agreements with signing_status = 'draft' or null
 */
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const userId = req.user?.id

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .single()

    const companyId = companyUser?.company_id

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Get the agreement to verify ownership and status
    const agreement = await agreementService.getAgreement(id)

    // Verify company ownership
    if (agreement.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Only allow editing draft agreements
    if (agreement.signing_status && agreement.signing_status !== 'draft') {
      return res.status(400).json({
        error: 'Cannot edit agreement',
        message: 'Only draft agreements can be edited directly. Use recall-and-edit for sent agreements.'
      })
    }

    const {
      templateType,
      propertyAddress,
      landlords,
      tenants,
      guarantors,
      depositAmount,
      rentAmount,
      tenancyStartDate,
      tenancyEndDate,
      rentDueDay,
      depositSchemeType,
      permittedOccupiers,
      bankAccountName,
      bankAccountNumber,
      bankSortCode,
      tenantEmail,
      landlordEmail,
      agentEmail,
      managementType,
      breakClause,
      specialClauses,
      billsIncluded,
      language
    }: AgreementData = req.body

    // Update the agreement
    const { error } = await supabase
      .from('agreements')
      .update({
        template_type: templateType,
        property_address: propertyAddress,
        landlords,
        tenants,
        guarantors: guarantors || [],
        deposit_amount: depositAmount,
        rent_amount: rentAmount,
        tenancy_start_date: tenancyStartDate,
        tenancy_end_date: tenancyEndDate,
        rent_due_day: rentDueDay,
        deposit_scheme_type: depositSchemeType,
        permitted_occupiers: permittedOccupiers,
        bank_account_name: bankAccountName,
        bank_account_number: bankAccountNumber,
        bank_sort_code: bankSortCode,
        tenant_email: tenantEmail,
        landlord_email: landlordEmail,
        agent_email: agentEmail,
        management_type: managementType,
        break_clause: breakClause,
        special_clauses: specialClauses,
        bills_included: billsIncluded,
        language: language || 'english',
        // Clear PDF since content has changed - user will need to regenerate
        pdf_url: null,
        pdf_generated_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to update agreement: ${error.message}`)
    }

    // Fetch updated agreement
    const updatedAgreement = await agreementService.getAgreement(id)

    res.json({
      message: 'Agreement updated successfully',
      agreement: updatedAgreement
    })
  } catch (error: any) {
    console.error('Error updating agreement:', error)
    res.status(500).json({
      error: 'Failed to update agreement',
      details: error.message
    })
  }
})

/**
 * POST /api/agreements/:id/recall-and-edit
 * Cancel a sent agreement and create a new draft with the provided data
 * Only allowed for pending_signatures or partially_signed agreements
 */
router.post('/:id/recall-and-edit', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const userId = req.user?.id

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .single()

    const companyId = companyUser?.company_id

    if (!userId || !companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Get the original agreement
    const originalAgreement = await agreementService.getAgreement(id)

    // Verify company ownership
    if (originalAgreement.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Only allow recall for sent agreements
    const recallableStatuses = ['pending_signatures', 'partially_signed']
    if (!recallableStatuses.includes(originalAgreement.signing_status)) {
      return res.status(400).json({
        error: 'Cannot recall agreement',
        message: `Agreements with status "${originalAgreement.signing_status}" cannot be recalled. Only pending or partially signed agreements can be recalled.`
      })
    }

    // Cancel the original agreement's signing process
    await signatureService.cancelSigning(id)
    console.log(`Cancelled signing for agreement ${id} during recall-and-edit`)

    // Get the modified data from request body (or use original values)
    const agreementData: AgreementData = {
      templateType: req.body.templateType || originalAgreement.template_type,
      propertyAddress: req.body.propertyAddress || originalAgreement.property_address,
      landlords: req.body.landlords || originalAgreement.landlords,
      tenants: req.body.tenants || originalAgreement.tenants,
      guarantors: req.body.guarantors || originalAgreement.guarantors || [],
      depositAmount: req.body.depositAmount ?? originalAgreement.deposit_amount,
      rentAmount: req.body.rentAmount ?? originalAgreement.rent_amount,
      tenancyStartDate: req.body.tenancyStartDate || originalAgreement.tenancy_start_date,
      tenancyEndDate: req.body.tenancyEndDate || originalAgreement.tenancy_end_date,
      rentDueDay: req.body.rentDueDay || originalAgreement.rent_due_day,
      depositSchemeType: req.body.depositSchemeType || originalAgreement.deposit_scheme_type,
      permittedOccupiers: req.body.permittedOccupiers ?? originalAgreement.permitted_occupiers,
      bankAccountName: req.body.bankAccountName || originalAgreement.bank_account_name,
      bankAccountNumber: req.body.bankAccountNumber || originalAgreement.bank_account_number,
      bankSortCode: req.body.bankSortCode || originalAgreement.bank_sort_code,
      tenantEmail: req.body.tenantEmail || originalAgreement.tenant_email,
      landlordEmail: req.body.landlordEmail || originalAgreement.landlord_email,
      agentEmail: req.body.agentEmail || originalAgreement.agent_email,
      managementType: req.body.managementType || originalAgreement.management_type,
      breakClause: req.body.breakClause ?? originalAgreement.break_clause,
      specialClauses: req.body.specialClauses ?? originalAgreement.special_clauses,
      language: req.body.language || originalAgreement.language || 'english'
    }

    // Create new draft agreement
    const newAgreementId = await agreementService.saveAgreement(
      agreementData,
      companyId,
      userId,
      originalAgreement.reference_id // Link to same reference if exists
    )

    // Get the new agreement
    const newAgreement = await agreementService.getAgreement(newAgreementId)

    res.status(201).json({
      message: 'Agreement recalled and new draft created',
      originalAgreementId: id,
      newAgreementId,
      agreement: newAgreement
    })
  } catch (error: any) {
    console.error('Error in recall-and-edit:', error)
    res.status(500).json({
      error: 'Failed to recall and edit agreement',
      details: error.message
    })
  }
})

/**
 * PUT /api/agreements/:id/recipients
 * Update recipient emails for a draft agreement
 * Only allowed for draft agreements
 */
router.put('/:id/recipients', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const userId = req.user?.id

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .single()

    const companyId = companyUser?.company_id

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Get the agreement to verify ownership and status
    const agreement = await agreementService.getAgreement(id)

    // Verify company ownership
    if (agreement.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Only allow updating recipients for draft agreements
    if (agreement.signing_status && agreement.signing_status !== 'draft') {
      return res.status(400).json({
        error: 'Cannot update recipients',
        message: 'Recipients can only be updated for draft agreements.'
      })
    }

    const { recipients } = req.body

    if (!recipients || !Array.isArray(recipients)) {
      return res.status(400).json({ error: 'Recipients array is required' })
    }

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    // Update email fields based on recipient type and index
    for (const recipient of recipients) {
      if (recipient.type === 'landlord' && recipient.index === 0) {
        updateData.landlord_email = recipient.email
      } else if (recipient.type === 'tenant' && recipient.index === 0) {
        updateData.tenant_email = recipient.email
      } else if (recipient.type === 'guarantor') {
        // For guarantors, we need to update the guarantors array
        const guarantors = [...(agreement.guarantors || [])]
        if (guarantors[recipient.index]) {
          guarantors[recipient.index] = {
            ...guarantors[recipient.index],
            email: recipient.email
          }
          updateData.guarantors = guarantors
        }
      }
    }

    // Update the agreement
    const { error } = await supabase
      .from('agreements')
      .update(updateData)
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to update recipients: ${error.message}`)
    }

    // Fetch updated agreement
    const updatedAgreement = await agreementService.getAgreement(id)

    res.json({
      message: 'Recipients updated successfully',
      agreement: updatedAgreement
    })
  } catch (error: any) {
    console.error('Error updating recipients:', error)
    res.status(500).json({
      error: 'Failed to update recipients',
      details: error.message
    })
  }
})

/**
 * DELETE /api/agreements/:id
 * Delete an agreement (with status validation)
 *
 * Allowed statuses: draft, pending_signatures, cancelled
 * Not allowed: partially_signed, fully_signed, expired
 */
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const userId = req.user?.id

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .single()

    const companyId = companyUser?.company_id

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Get the agreement to verify ownership and status
    const agreement = await agreementService.getAgreement(id)

    // Verify company ownership
    if (agreement.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Validate signing status - only block delete for fully_signed (completed) agreements
    const currentStatus = agreement.signing_status

    if (currentStatus === 'fully_signed') {
      return res.status(400).json({
        error: 'Cannot delete agreement',
        message: 'Fully signed agreements cannot be deleted.',
        signing_status: currentStatus
      })
    }

    // If pending_signatures, cancel signing first
    if (currentStatus === 'pending_signatures') {
      try {
        await signatureService.cancelSigning(id)
        console.log(`Cancelled signing for agreement ${id} before deletion`)
      } catch (cancelError) {
        console.error('Error cancelling signing before delete:', cancelError)
        // Continue with deletion even if cancel fails
      }
    }

    // Delete associated signature records first (foreign key constraint)
    const { error: signaturesError } = await supabase
      .from('agreement_signatures')
      .delete()
      .eq('agreement_id', id)

    if (signaturesError) {
      console.error('Error deleting signatures:', signaturesError)
      // Continue - some agreements may not have signatures
    }

    // Delete signature events
    const { error: eventsError } = await supabase
      .from('agreement_signature_events')
      .delete()
      .eq('agreement_id', id)

    if (eventsError) {
      console.error('Error deleting signature events:', eventsError)
    }

    // Delete the agreement
    const { error } = await supabase
      .from('agreements')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to delete agreement: ${error.message}`)
    }

    res.json({
      message: 'Agreement deleted successfully',
      wasPending: currentStatus === 'pending_signatures'
    })
  } catch (error: any) {
    console.error('Error deleting agreement:', error)
    res.status(500).json({
      error: 'Failed to delete agreement',
      details: error.message
    })
  }
})

export default router

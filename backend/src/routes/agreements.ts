import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { agreementService, AgreementData } from '../services/agreementService'
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
      language,
      referenceId
    }: AgreementData & { referenceId?: string } = req.body

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
      language: language || 'english'
    }

    // Save to database
    const agreementId = await agreementService.saveAgreement(
      agreementData,
      companyId,
      userId,
      referenceId
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

    // Automatically initiate signing and send emails to all signers
    try {
      console.log(`Initiating signing for agreement ${id}`)
      await signatureService.initiateSigning(id)
      console.log(`Signing initiated successfully for agreement ${id}`)
    } catch (signingError: any) {
      console.error('Failed to initiate signing:', signingError)
      // Don't fail the whole request - agreement was generated successfully
      // User can manually initiate signing from Agreement History
    }

    res.json({
      message: 'Agreement generated successfully',
      fileUrl,
      fileName,
      signingInitiated: true
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
 * DELETE /api/agreements/:id
 * Delete an agreement
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

    // Get the agreement to verify ownership
    const agreement = await agreementService.getAgreement(id)

    // Verify company ownership
    if (agreement.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Delete from Supabase
    const { error } = await supabase
      .from('agreements')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to delete agreement: ${error.message}`)
    }

    res.json({ message: 'Agreement deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting agreement:', error)
    res.status(500).json({
      error: 'Failed to delete agreement',
      details: error.message
    })
  }
})

export default router

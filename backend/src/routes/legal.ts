/**
 * Legal Routes - Section 8 and other legal notice generation
 */

import express, { Response, NextFunction } from 'express'
import multer from 'multer'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { S8_GROUNDS, calculateEarliestCourtDate, checkGround8Threshold } from '../data/section8Grounds'
import { pdfGenerationService } from '../services/pdfGenerationService'
import { supabase } from '../config/supabase'
import { decrypt } from '../services/encryption'
import crypto from 'crypto'

const router = express.Router()

// Multer configuration for additional file uploads
const serveAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 10 // Max 10 files
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only PDF, JPEG, PNG, DOC, and DOCX are allowed.'))
    }
  }
})

// Helper to get company ID for authenticated user
async function getCompanyIdForRequest(req: AuthRequest): Promise<string | null> {
  const userId = req.user?.id
  if (!userId) return null

  const { data: companyUsers } = await supabase
    .from('company_users')
    .select('company_id')
    .eq('user_id', userId)
    .limit(1)

  return companyUsers?.[0]?.company_id || null
}

/**
 * GET /api/legal/section8-grounds
 * Returns all Section 8 grounds data for the frontend form
 */
router.get('/section8-grounds', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    res.json({
      grounds: S8_GROUNDS,
      mandatory: S8_GROUNDS.filter(g => g.type === 'mandatory'),
      discretionary: S8_GROUNDS.filter(g => g.type === 'discretionary'),
    })
  } catch (error: any) {
    console.error('Error fetching Section 8 grounds:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/legal/section8-calculate-date
 * Calculate earliest court date based on selected grounds
 */
router.post('/section8-calculate-date', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { groundIds, serviceDate } = req.body

    if (!groundIds || !Array.isArray(groundIds) || groundIds.length === 0) {
      return res.status(400).json({ error: 'At least one ground must be selected' })
    }

    const parsedServiceDate = serviceDate ? new Date(serviceDate) : new Date()
    const result = calculateEarliestCourtDate(groundIds, parsedServiceDate)

    res.json({
      earliestCourtDate: result.date.toISOString().split('T')[0],
      longestGround: result.longestGround,
      periodDays: result.periodDays,
      explanation: result.explanation,
    })
  } catch (error: any) {
    console.error('Error calculating Section 8 date:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/legal/section8-check-ground8
 * Check if Ground 8 threshold is met based on rent and arrears
 */
router.post('/section8-check-ground8', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { rentFrequency, rentAmount, totalArrears } = req.body

    if (!rentFrequency || !rentAmount || totalArrears === undefined) {
      return res.status(400).json({ error: 'rentFrequency, rentAmount, and totalArrears are required' })
    }

    const result = checkGround8Threshold(rentFrequency, rentAmount, totalArrears)

    res.json(result)
  } catch (error: any) {
    console.error('Error checking Ground 8 threshold:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/legal/generate-section8
 * Generate Section 8 Form 3 PDF document, store it, and log activity
 */
router.post('/generate-section8', authenticateToken, async (req: AuthRequest, res: Response) => {
  console.log('\n========== SECTION 8 NOTICE REQUEST ==========')
  try {
    const userId = req.user?.id
    const companyId = await getCompanyIdForRequest(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const formData = req.body

    // Validate required fields
    const errors: string[] = []

    // Step 1 validation
    if (!formData.tenantNames || formData.tenantNames.length === 0) {
      errors.push('At least one tenant name is required')
    }
    if (!formData.propertyAddress?.line1 || !formData.propertyAddress?.town || !formData.propertyAddress?.postcode) {
      errors.push('Complete property address is required')
    }

    // Step 2 validation
    if (!formData.landlordNames || formData.landlordNames.length === 0) {
      errors.push('At least one landlord name is required')
    }
    if (!formData.landlordAddress?.line1 || !formData.landlordAddress?.town || !formData.landlordAddress?.postcode) {
      errors.push('Complete landlord address is required')
    }

    // Step 3 validation
    if (!formData.tenancyStartDate) {
      errors.push('Tenancy start date is required')
    }
    if (!formData.rentAmount || formData.rentAmount <= 0) {
      errors.push('Valid rent amount is required')
    }
    if (!formData.rentFrequency) {
      errors.push('Rent frequency is required')
    }

    // Step 4 validation
    if (!formData.selectedGroundIds || formData.selectedGroundIds.length === 0) {
      errors.push('At least one ground must be selected')
    }
    if (!formData.serviceDate) {
      errors.push('Service date is required')
    }

    // Step 6 validation - explanations for each ground
    if (formData.selectedGroundIds && formData.groundExplanations) {
      for (const groundId of formData.selectedGroundIds) {
        const explanation = formData.groundExplanations[groundId]
        if (!explanation || explanation.trim().length < 50) {
          const ground = S8_GROUNDS.find(g => g.id === groundId)
          errors.push(`Explanation for ${ground?.number || groundId} must be at least 50 characters`)
        }
      }
    }

    // Step 7 validation
    if (!formData.signatoryName) {
      errors.push('Signatory name is required')
    }
    if (!formData.signatoryCapacity) {
      errors.push('Signatory capacity is required')
    }
    if (!formData.serviceMethod) {
      errors.push('Service method is required')
    }
    if (!formData.signature) {
      errors.push('Signature is required')
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors })
    }

    // Calculate earliest court date if not provided
    if (!formData.earliestCourtDate) {
      const { date, explanation } = calculateEarliestCourtDate(
        formData.selectedGroundIds,
        new Date(formData.serviceDate)
      )
      formData.earliestCourtDate = date.toISOString().split('T')[0]
      formData.noticeExplanation = explanation
    }

    // Get tenancy ID to link the document
    // Try to find the tenancy by property address
    let tenancyId: string | undefined
    let propertyId: string | undefined

    // If tenancyId is provided in the request, use it
    if (formData.tenancyId) {
      tenancyId = formData.tenancyId
      console.log('[S8] Got tenancyId from request:', tenancyId)
      const { data: tenancy, error: tenancyError } = await supabase
        .from('tenancies')
        .select('property_id')
        .eq('id', tenancyId)
        .single()
      propertyId = tenancy?.property_id
      console.log('[S8] Property ID from tenancy:', propertyId, tenancyError?.message || 'OK')
    } else {
      console.warn('[S8] No tenancyId in request!')
    }

    // Get company details for agent info
    const { data: companyRaw } = await supabase
      .from('companies')
      .select('name_encrypted, logo_url, phone_encrypted, email_encrypted')
      .eq('id', companyId)
      .single()

    const companyName = companyRaw?.name_encrypted ? decrypt(companyRaw.name_encrypted) || 'Property Management' : 'Property Management'
    const companyLogoUrl = companyRaw?.logo_url || undefined
    const companyPhone = companyRaw?.phone_encrypted ? (decrypt(companyRaw.phone_encrypted) || undefined) : undefined
    const companyEmail = companyRaw?.email_encrypted ? (decrypt(companyRaw.email_encrypted) || undefined) : undefined

    // Generate document reference
    const documentRef = `S8-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`

    // Prepare grounds data with explanations
    const groundsData = formData.selectedGroundIds.map((groundId: string) => {
      const ground = S8_GROUNDS.find(g => g.id === groundId)
      return {
        id: groundId,
        number: ground?.number || '',
        type: ground?.type || 'discretionary',
        title: ground?.title || '',
        statutoryWording: ground?.statutoryWording || '',
        explanation: formData.groundExplanations[groundId] || ''
      }
    })

    // Calculate total arrears
    const totalArrears = formData.arrearsRows?.reduce((sum: number, row: any) => sum + (row.balance || 0), 0) || 0

    // Generate the PDF
    console.log('[S8] Generating PDF...')
    const pdfBuffer = await pdfGenerationService.generateSection8Notice({
      tenantNames: formData.tenantNames,
      propertyAddress: formData.propertyAddress,
      landlordNames: formData.landlordNames,
      landlordAddress: formData.landlordAddress,
      servedByAgent: formData.servedByAgent,
      agentName: formData.agentName || companyName,
      agentAddress: formData.agentAddress,
      agentLogoUrl: companyLogoUrl,
      agentPhone: companyPhone,
      agentEmail: companyEmail,
      tenancyStartDate: formData.tenancyStartDate,
      rentAmount: formData.rentAmount,
      rentFrequency: formData.rentFrequency,
      rentDueDay: formData.rentDueDay,
      grounds: groundsData,
      serviceDate: formData.serviceDate,
      earliestCourtDate: formData.earliestCourtDate,
      noticeExplanation: formData.noticeExplanation || '',
      arrearsRows: formData.arrearsRows,
      totalArrears,
      arrearsNotes: formData.arrearsNotes,
      serviceMethod: formData.serviceMethod,
      signatoryName: formData.signatoryName,
      signatoryCapacity: formData.signatoryCapacity,
      signature: formData.signature,
      signatureMethod: formData.signatureMethod || 'type',
      documentRef
    })
    console.log('[S8] PDF generated:', pdfBuffer.length, 'bytes')

    // Generate filename
    const propertyShort = formData.propertyAddress.postcode.replace(/\s/g, '')
    const dateStr = new Date().toISOString().split('T')[0]
    const filename = `Section8_Notice_${propertyShort}_${dateStr}.pdf`

    // Upload PDF to Supabase storage
    const storagePath = tenancyId
      ? `notices/section8/${tenancyId}/${filename}`
      : `notices/section8/${companyId}/${filename}`

    console.log('[S8] Uploading PDF to storage:', storagePath)
    const { error: uploadError } = await supabase.storage
      .from('property-documents')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      })

    let uploadSucceeded = false
    if (uploadError) {
      console.error('[S8] Upload failed:', uploadError.message)
      // Continue without storage - we still have the buffer for immediate download
    } else {
      console.log('[S8] PDF uploaded to storage successfully')
      uploadSucceeded = true
    }

    // Create document record ONLY if we have a property AND upload succeeded
    // Store the storage path (not signed URL) - signed URLs should be generated on-demand
    let documentId: string | undefined
    const groundNumbers = groundsData.map((g: any) => g.number).join(', ')

    if (propertyId && uploadSucceeded) {
      console.log('[S8] Creating document record for property:', propertyId)
      const { data: docRecord, error: docError } = await supabase
        .from('property_documents')
        .insert({
          property_id: propertyId,
          file_name: filename,
          file_path: storagePath,  // Store raw path, not signed URL
          file_size: pdfBuffer.length,
          file_type: 'application/pdf',
          tag: 'notice',  // Valid tags: gas, epc, agreement, reference, inventory, insurance, rent_notice, notice, other
          source_type: 'tenancy',
          source_id: tenancyId,
          description: `Section 8 Notice - ${groundNumbers}${totalArrears > 0 ? ` - £${totalArrears.toFixed(2)} arrears` : ''}`,
          uploaded_by: userId
        })
        .select('id')
        .single()

      if (docError) {
        console.error('[S8] Document record failed:', docError.message, docError.details, docError.hint)
      } else {
        documentId = docRecord?.id
        console.log('[S8] Document record created:', documentId)
      }
    } else {
      if (!propertyId) {
        console.warn('[S8] No propertyId available - skipping document record. tenancyId:', tenancyId)
      } else if (!uploadSucceeded) {
        console.warn('[S8] Storage upload failed - skipping document record to avoid broken link')
      }
    }

    // Create Section 8 notice record
    console.log('[S8] Creating notice record...')
    const { data: noticeRecord, error: noticeError } = await supabase
      .from('section8_notices')
      .insert({
        company_id: companyId,
        tenancy_id: tenancyId || null,
        property_address: `${formData.propertyAddress.line1}, ${formData.propertyAddress.postcode}`,
        tenant_names: formData.tenantNames.join(', '),
        grounds: formData.selectedGroundIds,
        ground_numbers: groundNumbers,
        total_arrears: totalArrears,
        service_date: formData.serviceDate,
        earliest_court_date: formData.earliestCourtDate,
        service_method: formData.serviceMethod,
        status: 'generated',
        document_id: documentId,
        document_ref: documentRef,
        created_by: userId
      })
      .select('id')
      .single()

    if (noticeError) {
      console.error('[S8] Notice record failed:', noticeError.message, noticeError.details, noticeError.hint)
      console.error('[S8] This may indicate the section8_notices table does not exist. Run migration 180.')
    } else {
      console.log('[S8] Notice record created:', noticeRecord?.id)
    }

    // Log activity if we have a tenancy
    if (tenancyId) {
      const effectiveDate = new Date(formData.earliestCourtDate).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric'
      })

      console.log('[S8] Creating activity log for tenancy:', tenancyId)
      const { error: activityError } = await supabase.from('tenancy_activity').insert({
        tenancy_id: tenancyId,
        action: 'SECTION8_NOTICE_GENERATED',
        category: 'notice',  // Valid categories: tenant, agreement, payment, notice, general
        title: 'Section 8 Notice Generated',
        description: `Section 8 notice generated citing ${groundNumbers}. Earliest court date: ${effectiveDate}.${totalArrears > 0 ? ` Total arrears: £${totalArrears.toFixed(2)}` : ''}`,
        metadata: {
          noticeId: noticeRecord?.id,
          documentId,
          documentRef,
          grounds: formData.selectedGroundIds,
          groundNumbers,
          totalArrears,
          serviceDate: formData.serviceDate,
          earliestCourtDate: formData.earliestCourtDate,
          serviceMethod: formData.serviceMethod
        },
        performed_by: userId
      })

      if (activityError) {
        console.error('[S8] Activity log failed:', activityError.message, activityError.details)
      } else {
        console.log('[S8] Activity log created')
      }
    } else {
      console.warn('[S8] No tenancyId - skipping activity log')
    }

    console.log('[S8] Complete. docRef:', documentRef, 'documentId:', documentId, 'noticeId:', noticeRecord?.id)

    // Generate signed URL for immediate viewing (1 hour expiry for download)
    const { data: signedUrlData } = await supabase.storage
      .from('property-documents')
      .createSignedUrl(storagePath, 60 * 60) // 1 hour for immediate download

    const pdfUrl = signedUrlData?.signedUrl || null

    // Return document info for download with status
    res.json({
      success: true,
      documentRef,
      documentId: documentId || null,
      noticeId: noticeRecord?.id || null,
      pdfUrl,
      storagePath, // Include storage path for debugging
      filename,
      // Status info for debugging
      savedToDocuments: !!documentId,
      savedNoticeRecord: !!noticeRecord?.id,
      hadTenancyId: !!tenancyId,
      hadPropertyId: !!propertyId,
      // Also include the PDF buffer for immediate download
      pdfBase64: pdfBuffer.toString('base64')
    })
  } catch (error: any) {
    console.error('[S8] FATAL ERROR:', error.message, error.stack)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/legal/section8-notices/:noticeId/documents
 * Get available compliance documents for serving the Section 8 notice
 */
router.get('/section8-notices/:noticeId/documents', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { noticeId } = req.params
    const companyId = await getCompanyIdForRequest(req)

    if (!companyId) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    // Get the notice
    const { data: notice, error: noticeError } = await supabase
      .from('section8_notices')
      .select('id, tenancy_id, document_id, document_ref, ground_numbers, service_date, earliest_court_date, total_arrears, status')
      .eq('id', noticeId)
      .eq('company_id', companyId)
      .single()

    if (noticeError || !notice) {
      return res.status(404).json({ error: 'Notice not found' })
    }

    if (!notice.tenancy_id) {
      return res.json({
        notice: {
          id: notice.id,
          tenancy_id: null,
          document_ref: notice.document_ref,
          ground_numbers: notice.ground_numbers,
          service_date: notice.service_date,
          earliest_court_date: notice.earliest_court_date,
          total_arrears: notice.total_arrears,
          status: notice.status
        },
        documents: []
      })
    }

    // Get tenancy with property
    console.log('[S8 Docs] Fetching tenancy:', notice.tenancy_id)
    const { data: tenancy, error: tenancyError } = await supabase
      .from('tenancies')
      .select('property_id, agreement_id')
      .eq('id', notice.tenancy_id)
      .single()

    console.log('[S8 Docs] Tenancy result:', tenancy?.property_id || 'no property_id', tenancyError?.message || 'OK')

    if (!tenancy?.property_id) {
      console.log('[S8 Docs] No property_id, returning empty documents')
      return res.json({
        notice: {
          id: notice.id,
          tenancy_id: notice.tenancy_id,
          document_ref: notice.document_ref,
          ground_numbers: notice.ground_numbers,
          service_date: notice.service_date,
          earliest_court_date: notice.earliest_court_date,
          total_arrears: notice.total_arrears,
          status: notice.status
        },
        documents: []
      })
    }

    // Get compliance documents - same pattern as compliance-pack endpoint
    console.log('[S8 Docs] Fetching compliance for property:', tenancy.property_id)
    const { data: complianceRecords, error: complianceError } = await supabase
      .from('compliance_records')
      .select(`
        id,
        compliance_type,
        custom_type_name,
        issue_date,
        expiry_date,
        status,
        compliance_documents (
          id,
          file_name,
          file_path
        )
      `)
      .eq('property_id', tenancy.property_id)
      .in('status', ['valid', 'expiring_soon'])

    console.log('[S8 Docs] Compliance records found:', complianceRecords?.length || 0)
    if (complianceError) {
      console.error('[S8 Docs] Compliance error:', complianceError.message)
    }

    // Log each record for debugging
    for (const record of complianceRecords || []) {
      console.log('[S8 Docs] Record:', record.compliance_type, 'status:', record.status, 'docs:', (record.compliance_documents || []).length)
    }

    const complianceTypeLabels: Record<string, string> = {
      gas_safety: 'Gas Safety Certificate',
      epc: 'Energy Performance Certificate (EPC)',
      eicr: 'Electrical Safety Certificate (EICR)',
      fire_safety: 'Fire Safety Certificate',
      legionella: 'Legionella Risk Assessment',
      smoke_alarm: 'Smoke & CO Alarms Certificate'
    }

    const documents: { id: string; name: string; type: string; filePath: string }[] = []

    // Add compliance documents
    for (const record of complianceRecords || []) {
      const docs = record.compliance_documents || []
      for (const doc of docs) {
        if (doc.file_path) {
          documents.push({
            id: `compliance-${doc.id}`,
            name: doc.file_name || complianceTypeLabels[record.compliance_type] || record.custom_type_name || 'Document',
            type: record.compliance_type,
            filePath: doc.file_path
          })
        }
      }
    }

    // Add signed agreement if available
    if (tenancy.agreement_id) {
      const { data: agreement } = await supabase
        .from('agreements')
        .select('signed_pdf_url, pdf_url, signing_status')
        .eq('id', tenancy.agreement_id)
        .single()

      if (agreement?.signed_pdf_url || agreement?.pdf_url) {
        documents.push({
          id: 'agreement',
          name: 'Signed Tenancy Agreement',
          type: 'tenancy_agreement',
          filePath: agreement.signed_pdf_url || agreement.pdf_url
        })
      }
    }

    // How to Rent guide (always available - static gov.uk URL)
    documents.push({
      id: 'how_to_rent',
      name: 'How to Rent Guide',
      type: 'how_to_rent',
      filePath: 'https://www.gov.uk/government/publications/how-to-rent/how-to-rent-the-checklist-for-renting-in-england'
    })

    res.json({
      notice: {
        id: notice.id,
        tenancy_id: notice.tenancy_id,
        document_ref: notice.document_ref,
        ground_numbers: notice.ground_numbers,
        service_date: notice.service_date,
        earliest_court_date: notice.earliest_court_date,
        total_arrears: notice.total_arrears,
        status: notice.status
      },
      documents
    })
  } catch (error: any) {
    console.error('Error fetching Section 8 documents:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/legal/section8-notices/:noticeId/serve
 * Officially serve the Section 8 notice to tenant(s) with selected compliance documents
 */
// Wrapper to handle multer errors
const handleServeUpload = (req: AuthRequest, res: Response, next: express.NextFunction) => {
  serveAttachmentUpload.array('additionalFiles', 10)(req, res, (err: any) => {
    if (err) {
      console.error('[Serve S8] Upload error:', err.message)
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 10MB per file.' })
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'Too many files. Maximum is 10 files.' })
      }
      return res.status(400).json({ error: err.message || 'Upload failed' })
    }
    next()
  })
}

router.post('/section8-notices/:noticeId/serve', authenticateToken, handleServeUpload, async (req: AuthRequest, res: Response) => {
  // Set longer timeout for this endpoint (5 minutes) as it involves file uploads and email sending
  req.setTimeout(300000)
  res.setTimeout(300000)

  console.log('\n========== SERVE SECTION 8 NOTICE ==========')
  try {
    const { noticeId } = req.params
    const userId = req.user?.id
    const companyId = await getCompanyIdForRequest(req)

    if (!companyId) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    // Parse FormData - selectedDocumentIds comes as JSON string
    let selectedDocumentIds: string[] = []
    if (req.body.selectedDocumentIds) {
      try {
        selectedDocumentIds = JSON.parse(req.body.selectedDocumentIds)
      } catch {
        selectedDocumentIds = req.body.selectedDocumentIds
      }
    }
    const emailMessage = req.body.emailMessage

    // Get additional uploaded files
    const additionalFiles = (req.files as Express.Multer.File[]) || []
    console.log('[Serve S8] Additional files uploaded:', additionalFiles.length)

    // Get the notice with related data
    const { data: notice, error: noticeError } = await supabase
      .from('section8_notices')
      .select(`
        *,
        document:property_documents(id, file_path, file_name)
      `)
      .eq('id', noticeId)
      .eq('company_id', companyId)
      .single()

    if (noticeError || !notice) {
      return res.status(404).json({ error: 'Notice not found' })
    }

    console.log('[Serve S8] Notice found:', {
      id: notice.id,
      tenancy_id: notice.tenancy_id,
      status: notice.status,
      document_ref: notice.document_ref,
      document_id: notice.document_id,
      document: notice.document ? { id: notice.document.id, file_name: notice.document.file_name } : null
    })

    if (notice.status !== 'generated') {
      return res.status(400).json({ error: 'Notice has already been served or is not in a valid state' })
    }

    if (!notice.tenancy_id) {
      console.error('[Serve S8] Notice has no tenancy_id!')
      return res.status(400).json({ error: 'Notice must be linked to a tenancy to serve via email' })
    }

    // Get tenancy with tenants
    console.log('[Serve S8] Fetching tenancy:', notice.tenancy_id)
    const { data: tenancy, error: tenancyError } = await supabase
      .from('tenancies')
      .select(`
        id,
        property_id,
        agreement_id
      `)
      .eq('id', notice.tenancy_id)
      .single()

    if (tenancyError) {
      console.error('[Serve S8] Tenancy fetch error:', tenancyError.message, tenancyError.details, tenancyError.hint)
      return res.status(404).json({ error: 'Tenancy not found: ' + tenancyError.message })
    }

    if (!tenancy) {
      console.error('[Serve S8] No tenancy returned')
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    console.log('[Serve S8] Tenancy found:', tenancy.id, 'property_id:', tenancy.property_id)

    // Get tenants from tenancy_tenants table (not tenants table)
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenancy_tenants')
      .select('id, tenant_email_encrypted, tenant_name_encrypted, is_active')
      .eq('tenancy_id', notice.tenancy_id)

    if (tenantsError) {
      console.error('[Serve S8] Tenants fetch error:', tenantsError.message)
    }

    console.log('[Serve S8] Found tenants:', tenants?.length || 0, 'Data:', JSON.stringify(tenants))

    // Get property separately (with encrypted columns)
    const { data: property } = await supabase
      .from('properties')
      .select('address_line1_encrypted, city_encrypted, postcode')
      .eq('id', tenancy.property_id)
      .single()

    // Get active tenants with decrypted emails
    // Note: tenancy_tenants uses is_active (boolean), not status
    const activeTenants = (tenants || [])
      .filter((t: any) => t.is_active && t.tenant_email_encrypted)
      .map((t: any) => {
        // Parse full name into first/last
        const fullName = t.tenant_name_encrypted ? (decrypt(t.tenant_name_encrypted) || '') : ''
        const nameParts = fullName.trim().split(' ')
        return {
          email: decrypt(t.tenant_email_encrypted) as string,
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || ''
        }
      })
      .filter(t => t.email) // Filter out any tenants with null emails

    console.log('[Serve S8] Active tenants with email:', activeTenants.length)

    if (activeTenants.length === 0) {
      return res.status(400).json({ error: 'No active tenants with email addresses found' })
    }

    // Get company details
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted, email_encrypted, logo_url')
      .eq('id', companyId)
      .single()

    const companyName = company?.name_encrypted ? decrypt(company.name_encrypted) : 'Your letting agent'
    const companyEmail = company?.email_encrypted ? decrypt(company.email_encrypted) : undefined
    const companyLogoUrl = company?.logo_url

    // Build property address (decrypt encrypted columns)
    const propertyAddress = [
      property?.address_line1_encrypted ? decrypt(property.address_line1_encrypted) : null,
      property?.city_encrypted ? decrypt(property.city_encrypted) : null,
      property?.postcode
    ].filter(Boolean).join(', ')

    console.log('[Serve S8] Property address:', propertyAddress)

    // Prepare attachments
    const attachments: { filename: string; content?: Buffer; path?: string }[] = []
    const complianceDocsSent: Record<string, boolean> = {}

    // Get Section 8 notice PDF
    if (notice.document?.file_path) {
      console.log('[Serve S8] Document file_path:', notice.document.file_path)

      // Clean up the file path - remove bucket prefix if present
      let filePath = notice.document.file_path
      if (filePath.includes('property-documents/')) {
        filePath = filePath.replace('property-documents/', '')
      }

      // If it's a signed URL (legacy), try to fetch it
      if (filePath.startsWith('http')) {
        console.log('[Serve S8] Attempting to fetch from signed URL')
        try {
          const response = await fetch(filePath)
          if (response.ok) {
            const buffer = Buffer.from(await response.arrayBuffer())
            attachments.push({
              filename: notice.document.file_name || 'Section_8_Notice.pdf',
              content: buffer
            })
            console.log('[Serve S8] PDF fetched from signed URL, size:', buffer.length)
          } else {
            console.error('[Serve S8] Failed to fetch signed URL:', response.status, response.statusText)
          }
        } catch (fetchError: any) {
          console.error('[Serve S8] Error fetching signed URL:', fetchError.message)
        }
      } else {
        // Download from Supabase storage using storage path
        console.log('[Serve S8] Downloading from storage:', filePath)
        const { data: pdfData, error: downloadError } = await supabase.storage
          .from('property-documents')
          .download(filePath)

        if (downloadError) {
          console.error('[Serve S8] Storage download error:', downloadError.message)
        } else if (pdfData) {
          const buffer = Buffer.from(await pdfData.arrayBuffer())
          attachments.push({
            filename: notice.document.file_name || 'Section_8_Notice.pdf',
            content: buffer
          })
          console.log('[Serve S8] PDF downloaded from storage, size:', buffer.length)
        }
      }
    } else {
      console.warn('[Serve S8] No document file_path found on notice')
    }

    // Add selected compliance documents
    if (selectedDocumentIds && Array.isArray(selectedDocumentIds)) {
      // Get compliance records
      const { data: complianceRecords } = await supabase
        .from('compliance_records')
        .select(`
          id,
          compliance_type,
          compliance_documents (
            id,
            file_name,
            file_path
          )
        `)
        .eq('property_id', tenancy.property_id)

      // Get agreement URL if needed
      let agreementPdfUrl: string | null = null
      if (tenancy.agreement_id && selectedDocumentIds.includes('agreement')) {
        const { data: agreement } = await supabase
          .from('agreements')
          .select('signed_pdf_url, pdf_url')
          .eq('id', tenancy.agreement_id)
          .single()
        agreementPdfUrl = agreement?.signed_pdf_url || agreement?.pdf_url || null
      }

      for (const docId of selectedDocumentIds) {
        if (docId === 'agreement' && agreementPdfUrl) {
          // Fetch signed agreement
          try {
            const response = await fetch(agreementPdfUrl)
            if (response.ok) {
              const buffer = Buffer.from(await response.arrayBuffer())
              attachments.push({
                filename: 'Signed_Tenancy_Agreement.pdf',
                content: buffer
              })
              complianceDocsSent.agreement = true
            }
          } catch (e) {
            console.error('[Serve S8] Failed to fetch agreement:', e)
          }
        } else if (docId === 'how_to_rent') {
          complianceDocsSent.how_to_rent = true
          // Note: How to Rent is a link, not an attachment
        } else if (docId.startsWith('compliance-')) {
          // Format: compliance-{recordId}-{docId}
          const parts = docId.replace('compliance-', '').split('-')
          // Handle UUID format which contains dashes - extract last UUID as doc ID
          // Pattern: recordId-docId where each is a UUID
          const compRecordId = parts.slice(0, 5).join('-') // First UUID
          const compDocId = parts.slice(5).join('-') // Second UUID

          console.log('[Serve S8] Looking for compliance doc:', { docId, compRecordId, compDocId })

          for (const record of complianceRecords || []) {
            if (record.id !== compRecordId) continue

            for (const doc of record.compliance_documents || []) {
              if (doc.id === compDocId && doc.file_path) {
                console.log('[Serve S8] Found compliance doc:', doc.file_name)

                // Download compliance document
                let filePath = doc.file_path
                if (filePath.includes('property-documents/')) {
                  filePath = filePath.replace('property-documents/', '')
                }

                if (filePath.startsWith('http')) {
                  try {
                    console.log('[Serve S8] Fetching compliance doc from URL')
                    const response = await fetch(filePath)
                    if (response.ok) {
                      const buffer = Buffer.from(await response.arrayBuffer())
                      attachments.push({
                        filename: doc.file_name || `${record.compliance_type}.pdf`,
                        content: buffer
                      })
                      complianceDocsSent[record.compliance_type] = true
                      console.log('[Serve S8] Compliance doc attached:', doc.file_name)
                    } else {
                      console.error('[Serve S8] Failed to fetch compliance doc URL:', response.status)
                    }
                  } catch (e) {
                    console.error('[Serve S8] Failed to fetch compliance doc:', e)
                  }
                } else {
                  console.log('[Serve S8] Downloading compliance doc from storage:', filePath)
                  const { data: docData, error: docError } = await supabase.storage
                    .from('property-documents')
                    .download(filePath)

                  if (docError) {
                    console.error('[Serve S8] Storage download error:', docError.message)
                  } else if (docData) {
                    const buffer = Buffer.from(await docData.arrayBuffer())
                    attachments.push({
                      filename: doc.file_name || `${record.compliance_type}.pdf`,
                      content: buffer
                    })
                    complianceDocsSent[record.compliance_type] = true
                    console.log('[Serve S8] Compliance doc attached:', doc.file_name)
                  }
                }
              }
            }
          }
        }
      }
    }

    // Add additional uploaded files to attachments
    for (const file of additionalFiles) {
      attachments.push({
        filename: file.originalname,
        content: file.buffer
      })
      console.log('[Serve S8] Additional file attached:', file.originalname)
    }

    console.log('[Serve S8] Prepared', attachments.length, 'attachments')

    // Format dates for email
    const serviceDateFormatted = new Date(notice.service_date).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    })
    const courtDateFormatted = new Date(notice.earliest_court_date).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    })

    // Import email service
    const { sendCustomTenantEmail } = await import('../services/emailService')

    // Build email body - custom message is included as an additional note, not a replacement
    const agentNoteSection = emailMessage
      ? `\n---\n\nMessage from your letting agent:\n\n"${emailMessage}"\n\n---\n`
      : ''

    const message = `Dear Tenant,

Please find attached an important legal notice – a Section 8 Notice under the Housing Act 1988 – concerning the property at ${propertyAddress}.

This notice cites the following grounds: ${notice.ground_numbers}.

The notice was served on ${serviceDateFormatted}. The earliest date on which court proceedings may begin is ${courtDateFormatted}.

${notice.total_arrears > 0 ? `The current arrears balance is £${Number(notice.total_arrears).toFixed(2)}.\n` : ''}
It is important that you read this notice carefully. You may wish to seek independent legal advice.
${agentNoteSection}
${complianceDocsSent.how_to_rent ? 'For information about your rights as a tenant, please see the How to Rent guide: https://www.gov.uk/government/publications/how-to-rent/how-to-rent-the-checklist-for-renting-in-england\n' : ''}
If you have any questions, please contact us.

Kind regards,
${companyName}`

    // Send to all active tenants, CC to agent
    for (const tenant of activeTenants) {
      const tenantName = [tenant.firstName, tenant.lastName].filter(Boolean).join(' ') || 'Tenant'

      await sendCustomTenantEmail({
        to: tenant.email,
        cc: companyEmail || undefined,
        subject: `IMPORTANT: Section 8 Notice - ${propertyAddress}`,
        message: message.replace('Dear Tenant', `Dear ${tenantName}`),
        replyTo: companyEmail || undefined,
        attachments: attachments.map(a => ({
          filename: a.filename,
          content: a.content!
        }))
      })

      console.log('[Serve S8] Email sent to:', tenant.email)
    }

    // Update notice status
    const { error: updateError } = await supabase
      .from('section8_notices')
      .update({
        status: 'served',
        served_at: new Date().toISOString(),
        served_by: userId,
        compliance_docs_sent: complianceDocsSent
      })
      .eq('id', noticeId)

    if (updateError) {
      console.error('[Serve S8] Update failed:', updateError)
    }

    // Log activity
    const { error: serveActivityError } = await supabase.from('tenancy_activity').insert({
      tenancy_id: notice.tenancy_id,
      action: 'SECTION8_NOTICE_SERVED',
      category: 'notice',  // Valid categories: tenant, agreement, payment, notice, general
      title: 'Section 8 Notice Served',
      description: `Section 8 notice (${notice.ground_numbers}) officially served to ${activeTenants.length} tenant(s) via email with ${attachments.length} attachment(s)`,
      metadata: {
        noticeId,
        documentRef: notice.document_ref,
        tenantEmails: activeTenants.map(t => t.email),
        complianceDocsSent,
        attachmentCount: attachments.length,
        ccTo: companyEmail
      },
      performed_by: userId
    })

    if (serveActivityError) {
      console.error('[Serve S8] Activity log failed:', serveActivityError.message, serveActivityError.details)
    } else {
      console.log('[Serve S8] Activity log created')
    }

    console.log('[Serve S8] Complete')

    res.json({
      success: true,
      emailsSent: activeTenants.length,
      attachmentCount: attachments.length,
      complianceDocsSent
    })
  } catch (error: any) {
    console.error('[Serve S8] FATAL ERROR:', error.message, error.stack)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/legal/section8-notices/:noticeId/pdf
 * Download the PDF for a specific Section 8 notice
 */
router.get('/section8-notices/:noticeId/pdf', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { noticeId } = req.params
    const companyId = await getCompanyIdForRequest(req)

    if (!companyId) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    // Get the notice with document reference
    const { data: notice, error: noticeError } = await supabase
      .from('section8_notices')
      .select('*, document:property_documents(id, file_path, file_name)')
      .eq('id', noticeId)
      .eq('company_id', companyId)
      .single()

    if (noticeError || !notice) {
      return res.status(404).json({ error: 'Notice not found' })
    }

    // If there's a stored document, redirect to its URL
    if (notice.document?.file_path) {
      return res.redirect(notice.document.file_path)
    }

    return res.status(404).json({ error: 'PDF document not found for this notice' })
  } catch (error: any) {
    console.error('Error downloading Section 8 notice PDF:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// SECTION 48 NOTICE - Address for Service of Notices
// Landlord and Tenant Act 1987
// ============================================================================

/**
 * POST /api/legal/generate-section48
 * Generate Section 48 Notice PDF, store it, log activity, and optionally email
 */
router.post('/generate-section48', authenticateToken, async (req: AuthRequest, res: Response) => {
  console.log('\n========== SECTION 48 NOTICE REQUEST ==========')
  try {
    const userId = req.user?.id
    const companyId = await getCompanyIdForRequest(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const formData = req.body

    // Validate required fields
    const errors: string[] = []

    if (!formData.tenantNames || formData.tenantNames.length === 0) {
      errors.push('At least one tenant name is required')
    }
    if (!formData.propertyAddress?.line1 || !formData.propertyAddress?.postcode) {
      errors.push('Complete property address is required')
    }
    if (!formData.landlordNames || formData.landlordNames.length === 0) {
      errors.push('At least one landlord name is required')
    }
    if (!formData.addressForService?.line1 || !formData.addressForService?.postcode) {
      errors.push('Address for service is required')
    }
    if (!formData.dateOfNotice) {
      errors.push('Date of notice is required')
    }
    if (!formData.signatoryName) {
      errors.push('Signatory name is required')
    }

    // Validate address is not a PO Box
    const addressLine1 = formData.addressForService?.line1 || ''
    if (/p\.?o\.?\s*box/i.test(addressLine1)) {
      errors.push('Address for service cannot be a PO Box')
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors })
    }

    const { tenancyId, propertyId } = formData

    // Get company details for agent info
    const { data: companyRaw } = await supabase
      .from('companies')
      .select('name_encrypted, logo_url, phone_encrypted, email_encrypted, address_encrypted, city_encrypted, postcode_encrypted')
      .eq('id', companyId)
      .single()

    const companyName = companyRaw?.name_encrypted ? decrypt(companyRaw.name_encrypted) || 'Property Management' : 'Property Management'
    const companyLogoUrl = companyRaw?.logo_url || undefined
    const companyPhone = companyRaw?.phone_encrypted ? (decrypt(companyRaw.phone_encrypted) || undefined) : undefined
    const companyEmail = companyRaw?.email_encrypted ? (decrypt(companyRaw.email_encrypted) || undefined) : undefined
    const companyAddress = {
      line1: companyRaw?.address_encrypted ? decrypt(companyRaw.address_encrypted) || '' : '',
      city: companyRaw?.city_encrypted ? decrypt(companyRaw.city_encrypted) || '' : '',
      postcode: companyRaw?.postcode_encrypted ? decrypt(companyRaw.postcode_encrypted) || '' : ''
    }

    // Generate document reference
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const documentRef = `S48-${tenancyId ? tenancyId.substring(0, 8) : crypto.randomBytes(4).toString('hex')}-${dateStr}`

    // Format dates for display
    const noticeDateFormatted = new Date(formData.dateOfNotice).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    })
    const tenancyStartFormatted = formData.tenancyStartDate
      ? new Date(formData.tenancyStartDate).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', year: 'numeric'
        })
      : ''

    // Determine landlord display name
    const landlordDisplay = formData.isCompanyLandlord && formData.companyRegisteredName
      ? formData.companyRegisteredName
      : formData.landlordNames.join(' and ')

    // Format addresses
    const formatAddr = (addr: any) => [addr.line1, addr.line2, addr.city, addr.county, addr.postcode].filter(Boolean).join(', ')
    const formatAddrMultiline = (addr: any) => [addr.line1, addr.line2, addr.city, addr.county, addr.postcode].filter(Boolean)

    // Reason text for address change
    const isAddressChange = formData.reasonForServing === 'address_changed' || formData.reasonForServing === 'change_of_agent'
    const reasonText = isAddressChange
      ? 'This notice supersedes any previous address for service of notices that may have been given. Please use the above address for all future notices to the Landlord.'
      : ''

    // Generate PDF using pdfGenerationService
    console.log('[S48] Generating PDF...')
    const pdfBuffer = await pdfGenerationService.generateSection48Notice({
      tenantNames: formData.tenantNames,
      propertyAddress: formData.propertyAddress,
      landlordNames: formData.landlordNames,
      landlordDisplay,
      landlordAddress: formData.landlordAddress,
      isCompanyLandlord: formData.isCompanyLandlord,
      companyRegisteredName: formData.companyRegisteredName,
      companyRegistrationNumber: formData.companyRegistrationNumber,
      addressForService: formData.addressForService,
      addressForServiceName: formData.addressForServiceName,
      reasonForServing: formData.reasonForServing,
      reasonText,
      tenancyStartDate: tenancyStartFormatted,
      dateOfNotice: noticeDateFormatted,
      signatoryName: formData.signatoryName,
      signatoryCapacity: formData.signatoryCapacity,
      agentName: companyName,
      agentAddress: companyAddress,
      agentLogoUrl: companyLogoUrl,
      agentPhone: companyPhone,
      agentEmail: companyEmail,
      documentRef
    })
    console.log('[S48] PDF generated:', pdfBuffer.length, 'bytes')

    // Generate filename
    const tenantSurname = formData.tenantNames[0]?.split(' ').pop() || 'Tenant'
    const postcodeClean = formData.propertyAddress.postcode.replace(/\s/g, '')
    const filename = `Section48_Notice_${tenantSurname}_${postcodeClean}_${formData.dateOfNotice}.pdf`

    // Upload PDF to Supabase storage
    const storagePath = tenancyId
      ? `notices/section48/${tenancyId}/${filename}`
      : `notices/section48/${companyId}/${filename}`

    console.log('[S48] Uploading PDF to storage:', storagePath)
    const { error: uploadError } = await supabase.storage
      .from('property-documents')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      })

    let uploadSucceeded = false
    if (uploadError) {
      console.error('[S48] Upload failed:', uploadError.message)
    } else {
      console.log('[S48] PDF uploaded to storage successfully')
      uploadSucceeded = true
    }

    // Create document record if we have a property and upload succeeded
    let documentId: string | undefined
    if (propertyId && uploadSucceeded) {
      console.log('[S48] Creating document record for property:', propertyId)
      const { data: docRecord, error: docError } = await supabase
        .from('property_documents')
        .insert({
          property_id: propertyId,
          file_name: filename,
          file_path: storagePath,
          file_size: pdfBuffer.length,
          file_type: 'application/pdf',
          tag: 'notice',
          source_type: 'tenancy',
          source_id: tenancyId,
          description: `Section 48 Notice - Address for Service: ${formData.addressForServiceName}`,
          uploaded_by: userId
        })
        .select('id')
        .single()

      if (docError) {
        console.error('[S48] Document record failed:', docError.message)
      } else {
        documentId = docRecord?.id
        console.log('[S48] Document record created:', documentId)
      }
    }

    // Log activity if we have a tenancy
    if (tenancyId) {
      const reasonLabels: Record<string, string> = {
        first_service: 'First service',
        address_changed: 'Address changed',
        change_of_agent: 'Change of agent',
        precautionary: 'Precautionary re-service',
        other: 'Other'
      }
      const reasonLabel = reasonLabels[formData.reasonForServing] || formData.reasonForServing

      console.log('[S48] Creating activity log for tenancy:', tenancyId)
      const { error: activityError } = await supabase.from('tenancy_activity').insert({
        tenancy_id: tenancyId,
        action: 'SECTION48_NOTICE_GENERATED',
        category: 'notice',
        title: 'Section 48 Notice Generated',
        description: `Section 48 notice issued. Address for service: ${formData.addressForServiceName}, ${formatAddr(formData.addressForService)}. Reason: ${reasonLabel}`,
        metadata: {
          documentId,
          documentRef,
          addressForService: formData.addressForService,
          addressForServiceName: formData.addressForServiceName,
          reasonForServing: formData.reasonForServing,
          dateOfNotice: formData.dateOfNotice,
          signatoryName: formData.signatoryName
        },
        performed_by: userId
      })

      if (activityError) {
        console.error('[S48] Activity log failed:', activityError.message)
      } else {
        console.log('[S48] Activity log created')
      }
    }

    // Send emails if requested
    let emailStatus: 'sent' | 'failed' | 'not-sent' = 'not-sent'
    const emailsSentTo: string[] = []

    const allRecipients = [
      ...(formData.sendToTenants ? formData.tenantEmails : []),
      ...(formData.sendCopyToLandlord && formData.landlordEmail ? [formData.landlordEmail] : []),
      ...(formData.ccToOffice && formData.officeEmail ? [formData.officeEmail] : []),
      ...(formData.additionalRecipients || [])
    ].filter(Boolean)

    if (allRecipients.length > 0) {
      try {
        const { sendEmail } = await import('../services/emailService')

        // Build email HTML
        const propertyAddr = formatAddr(formData.propertyAddress)
        const serviceAddr = formatAddr(formData.addressForService)
        const tenantNamesStr = formData.tenantNames.join(' and ')

        const emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 24px 30px; border-radius: 12px 12px 0 0;">
              <span style="display: inline-block; background: rgba(255,255,255,0.2); color: white; font-size: 11px; font-weight: 600; padding: 4px 12px; border-radius: 20px; letter-spacing: 0.5px; text-transform: uppercase;">Legal Notice</span>
              <h1 style="color: white; font-size: 24px; font-weight: 700; margin: 12px 0 4px 0;">Section 48 Notice</h1>
              <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0;">Landlord and Tenant Act 1987</p>
            </div>

            <!-- Body -->
            <div style="padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="color: #374151; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">Dear ${tenantNamesStr},</p>

              <p style="color: #374151; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
                Please find attached your <strong>Section 48 Notice</strong> regarding your tenancy at:
              </p>

              <!-- Property Box -->
              <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; border-left: 4px solid #f59e0b;">
                <p style="font-size: 12px; color: #92400e; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px 0;">Property</p>
                <p style="font-size: 15px; color: #78350f; font-weight: 600; margin: 0;">${propertyAddr}</p>
              </div>

              <p style="color: #374151; font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
                This notice provides you with the address where notices may be served on your landlord:
              </p>

              <!-- Service Address Box -->
              <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 8px; padding: 18px 22px; margin-bottom: 24px; border: 1px solid #bfdbfe;">
                <p style="font-size: 12px; color: #1e40af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px 0;">📍 Address for Service</p>
                <p style="font-size: 15px; color: #1e3a8a; font-weight: 600; line-height: 1.5; margin: 0;">
                  ${formData.addressForServiceName}<br/>
                  ${formatAddrMultiline(formData.addressForService).join('<br/>')}
                </p>
              </div>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-bottom: 28px; padding: 14px 16px; background: #f9fafb; border-radius: 6px; border-left: 3px solid #d1d5db;">
                Please retain this document for your records. A PDF copy is attached to this email.
              </p>

              <p style="color: #374151; font-size: 15px; line-height: 1.6; margin-bottom: 6px;">Kind regards,</p>
              <p style="color: #111827; font-size: 15px; font-weight: 600; margin: 0;">${formData.signatoryName}</p>
              <p style="color: #6b7280; font-size: 14px; margin: 4px 0 0 0;">${companyName}</p>
            </div>

            <!-- Footer -->
            <div style="text-align: center; padding: 20px 30px;">
              <p style="font-size: 13px; color: #6b7280; margin: 0;">
                <strong style="color: #374151;">${companyName}</strong>
              </p>
              <p style="font-size: 12px; color: #9ca3af; margin: 6px 0 0 0;">
                ${companyAddress.line1 ? `${formatAddr(companyAddress)}` : ''}${companyPhone ? ` · ${companyPhone}` : ''}${companyEmail ? ` · ${companyEmail}` : ''}
              </p>
            </div>
          </div>
        `

        // Send to primary tenant recipients
        for (const email of formData.tenantEmails || []) {
          if (!email) continue
          try {
            await sendEmail({
              to: email,
              subject: `Important Notice — Section 48 Landlord and Tenant Act 1987 — ${propertyAddr}`,
              html: emailHtml,
              attachments: [{
                filename,
                content: pdfBuffer
              }]
            })
            emailsSentTo.push(email)
            console.log('[S48] Email sent to tenant:', email)
          } catch (emailErr: any) {
            console.error('[S48] Failed to send to tenant:', email, emailErr.message)
          }
        }

        // Send copy to landlord
        if (formData.sendCopyToLandlord && formData.landlordEmail) {
          try {
            const landlordEmailHtml = `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #f9fafb; border-radius: 12px; padding: 24px 28px; border: 1px solid #e5e7eb;">
                  <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
                    <span style="font-size: 20px;">✅</span>
                    <h2 style="color: #111827; font-size: 18px; font-weight: 600; margin: 0;">Section 48 Notice Served</h2>
                  </div>

                  <p style="color: #374151; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
                    A Section 48 Notice has been served on the tenant(s) at the property below. A copy is attached for your records.
                  </p>

                  <div style="background: white; border-radius: 8px; padding: 16px; margin-bottom: 16px; border: 1px solid #e5e7eb;">
                    <p style="font-size: 11px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px 0;">Property</p>
                    <p style="font-size: 14px; color: #111827; font-weight: 500; margin: 0;">${propertyAddr}</p>
                  </div>

                  <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                    <div style="flex: 1; background: white; border-radius: 8px; padding: 12px 16px; border: 1px solid #e5e7eb;">
                      <p style="font-size: 11px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px 0;">Date Served</p>
                      <p style="font-size: 14px; color: #111827; font-weight: 500; margin: 0;">${noticeDateFormatted}</p>
                    </div>
                  </div>

                  <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 8px; padding: 14px 18px; border: 1px solid #bfdbfe;">
                    <p style="font-size: 11px; color: #1e40af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px 0;">Address for Service</p>
                    <p style="font-size: 14px; color: #1e3a8a; font-weight: 500; margin: 0;">${formData.addressForServiceName}, ${serviceAddr}</p>
                  </div>
                </div>

                <p style="text-align: center; font-size: 12px; color: #9ca3af; margin-top: 20px;">
                  Sent by ${companyName}
                </p>
              </div>
            `
            await sendEmail({
              to: formData.landlordEmail,
              subject: `Section 48 Notice Served — ${propertyAddr} — ${noticeDateFormatted}`,
              html: landlordEmailHtml,
              attachments: [{
                filename,
                content: pdfBuffer
              }]
            })
            emailsSentTo.push(formData.landlordEmail)
            console.log('[S48] Email sent to landlord:', formData.landlordEmail)
          } catch (emailErr: any) {
            console.error('[S48] Failed to send to landlord:', emailErr.message)
          }
        }

        // CC to office
        if (formData.ccToOffice && formData.officeEmail) {
          try {
            await sendEmail({
              to: formData.officeEmail,
              subject: `[Copy] Section 48 Notice — ${propertyAddr}`,
              html: `<p>Copy of Section 48 Notice served for ${propertyAddr}.</p>`,
              attachments: [{
                filename,
                content: pdfBuffer
              }]
            })
            emailsSentTo.push(formData.officeEmail)
            console.log('[S48] Email CC to office:', formData.officeEmail)
          } catch (emailErr: any) {
            console.error('[S48] Failed to CC to office:', emailErr.message)
          }
        }

        // Additional recipients
        for (const email of formData.additionalRecipients || []) {
          if (!email) continue
          try {
            await sendEmail({
              to: email,
              subject: `Section 48 Notice — ${propertyAddr}`,
              html: emailHtml,
              attachments: [{
                filename,
                content: pdfBuffer
              }]
            })
            emailsSentTo.push(email)
            console.log('[S48] Email sent to additional recipient:', email)
          } catch (emailErr: any) {
            console.error('[S48] Failed to send to additional:', email, emailErr.message)
          }
        }

        emailStatus = emailsSentTo.length > 0 ? 'sent' : 'failed'

        // Update activity log with email status
        if (tenancyId && emailsSentTo.length > 0) {
          await supabase.from('tenancy_activity').insert({
            tenancy_id: tenancyId,
            action: 'SECTION48_NOTICE_SERVED',
            category: 'notice',
            title: 'Section 48 Notice Served by Email',
            description: `Notice emailed to: ${emailsSentTo.join(', ')}`,
            metadata: {
              documentRef,
              emailsSentTo,
              serviceMethod: 'email'
            },
            performed_by: userId
          })
        }

      } catch (emailErr: any) {
        console.error('[S48] Email sending error:', emailErr.message)
        emailStatus = 'failed'
      }
    }

    console.log('[S48] Complete. docRef:', documentRef, 'documentId:', documentId, 'emails:', emailsSentTo.length)

    // Generate signed URL for immediate viewing
    const { data: signedUrlData } = await supabase.storage
      .from('property-documents')
      .createSignedUrl(storagePath, 60 * 60)

    res.json({
      success: true,
      noticeId: documentRef,
      documentId: documentId || null,
      documentRef,
      filename,
      fileUrl: signedUrlData?.signedUrl || null,
      emailsSent: {
        tenants: formData.tenantEmails?.filter((e: string) => emailsSentTo.includes(e)) || [],
        landlord: formData.landlordEmail && emailsSentTo.includes(formData.landlordEmail) ? formData.landlordEmail : undefined,
        cc: emailsSentTo.filter((e: string) => e !== formData.landlordEmail && !formData.tenantEmails?.includes(e))
      },
      emailStatus,
      pdfBase64: pdfBuffer.toString('base64')
    })

  } catch (error: any) {
    console.error('[S48] FATAL ERROR:', error.message, error.stack)
    res.status(500).json({ error: error.message })
  }
})

export default router

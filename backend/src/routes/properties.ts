import { Router } from 'express'
import { authenticateToken, requireMember, AuthRequest, getCompanyIdForRequest } from '../middleware/auth'
import { propertyService, PropertyData, PropertyFilters, ComplianceData } from '../services/propertyService'
import {
  auditPropertyCreated,
  auditPropertyUpdated,
  auditPropertyDeleted,
  auditComplianceAdded,
  auditDocumentUploaded,
  getPropertyAuditLog,
  logPropertyAuditAction
} from '../services/propertyAuditService'
import {
  matchOrCreateProperty,
  searchProperties,
  getPropertyForLinking,
  validatePropertyAccess
} from '../services/propertyMatchingService'
import { supabase } from '../config/supabase'
import multer from 'multer'
import { encrypt, decrypt } from '../services/encryption'

const router = Router()

// Fix properties with null addresses by copying from references
router.post('/fix-addresses', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const branchId = req.headers['x-branch-id'] as string

    if (!branchId) {
      return res.status(400).json({ error: 'Branch ID required' })
    }

    // Get properties with null addresses
    const { data: properties } = await supabase
      .from('properties')
      .select('id, postcode')
      .eq('company_id', branchId)
      .is('address_line1_encrypted', null)

    if (!properties || properties.length === 0) {
      return res.json({ message: 'No properties need fixing', fixed: 0 })
    }

    // Get references for this company
    const { data: references } = await supabase
      .from('tenant_references')
      .select('id, property_postcode_encrypted, property_address_encrypted, property_city_encrypted')
      .eq('company_id', branchId)
      .not('property_address_encrypted', 'is', null)

    if (!references || references.length === 0) {
      return res.json({ message: 'No references with addresses found', fixed: 0 })
    }

    // Build a map of postcode -> reference
    const postcodeMap = new Map<string, any>()
    for (const ref of references) {
      const postcode = decrypt(ref.property_postcode_encrypted)?.toUpperCase().replace(/\s/g, '')
      if (postcode && !postcodeMap.has(postcode)) {
        postcodeMap.set(postcode, ref)
      }
    }

    // Fix each property
    let fixed = 0
    for (const prop of properties) {
      const normalizedPostcode = prop.postcode?.toUpperCase().replace(/\s/g, '')
      const matchingRef = postcodeMap.get(normalizedPostcode)

      if (matchingRef) {
        await supabase
          .from('properties')
          .update({
            address_line1_encrypted: matchingRef.property_address_encrypted,
            city_encrypted: matchingRef.property_city_encrypted,
            full_address_encrypted: matchingRef.property_address_encrypted,
            updated_at: new Date().toISOString()
          })
          .eq('id', prop.id)
        fixed++
      }
    }

    res.json({ message: `Fixed ${fixed} properties`, fixed })
  } catch (error: any) {
    console.error('Fix addresses error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, JPEG, PNG, CSV, DOCX'))
    }
  }
})

const PROPERTY_DOCS_BUCKET = 'property-documents'

const ensurePropertyDocumentsBucket = async (): Promise<void> => {
  const { data, error } = await supabase.storage.getBucket(PROPERTY_DOCS_BUCKET)
  if (data && !error) return

  const createResult = await supabase.storage.createBucket(PROPERTY_DOCS_BUCKET, {
    public: false,
    fileSizeLimit: 50 * 1024 * 1024,
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  })

  if (createResult.error) {
    throw new Error(`Failed to create ${PROPERTY_DOCS_BUCKET} bucket: ${createResult.error.message}`)
  }
}

/**
 * Sanitize filename for Supabase Storage
 * Removes/replaces special characters that are invalid in storage keys
 */
const sanitizeFilename = (filename: string): string => {
  return filename
    // Replace unicode dashes (em-dash, en-dash) with regular dash
    .replace(/[\u2013\u2014\u2015\u2212]/g, '-')
    // Replace spaces with underscores
    .replace(/\s+/g, '_')
    // Remove parentheses and brackets
    .replace(/[()[\]{}]/g, '')
    // Replace any remaining non-alphanumeric chars (except dash, underscore, period) with underscore
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    // Collapse multiple underscores
    .replace(/_+/g, '_')
    // Remove leading/trailing underscores
    .replace(/^_+|_+$/g, '')
}

// ============================================================================
// PROPERTY STATS
// ============================================================================

/**
 * GET /api/properties/stats
 * Get property statistics for the dashboard
 */
router.get('/stats', authenticateToken, requireMember, async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId!
    const stats = await propertyService.getPropertyStats(companyId)
    res.json(stats)
  } catch (error: any) {
    console.error('[Properties] Error getting stats:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// CSV TEMPLATE (must be before /:id route)
// ============================================================================

/**
 * GET /api/properties/csv-template
 * Download CSV template for property import
 */
router.get('/csv-template', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const headers = [
      'Address Line 1',
      'Address Line 2',
      'City',
      'County',
      'Postcode',
      'Property Type',
      'Furnished Status',
      'Management Type',
      'Bedrooms'
    ]

    const csv = headers.join(',') + '\n'

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="property-import-template.csv"')
    res.send(csv)
  } catch (error: any) {
    console.error('Error generating CSV template:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// PROPERTY CRUD
// ============================================================================

/**
 * GET /api/properties
 * List properties with pagination, search, and filters
 */
router.get('/', authenticateToken, requireMember, async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId!
    const {
      page,
      limit,
      search,
      status,
      compliance_status,
      has_landlord,
      is_licensed,
      sortBy,
      sortOrder
    } = req.query

    const filters: PropertyFilters = {
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      search: search as string | undefined,
      status: status as 'vacant' | 'in_tenancy' | undefined,
      compliance_status: compliance_status as 'valid' | 'expiring_soon' | 'expired' | undefined,
      has_landlord: has_landlord === 'true' ? true : has_landlord === 'false' ? false : undefined,
      is_licensed: is_licensed === 'true' ? true : is_licensed === 'false' ? false : undefined,
      sortBy: sortBy as 'created_at' | 'postcode' | 'status' | undefined,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined
    }

    const result = await propertyService.listProperties(companyId, filters)
    res.json(result)
  } catch (error: any) {
    console.error('[Properties] Error listing properties:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/properties
 * Create a new property
 */
router.post('/', authenticateToken, requireMember, async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId!
    const userId = req.user!.id
    const data: PropertyData = req.body

    // Validate required fields
    if (!data.address?.postcode) {
      return res.status(400).json({ error: 'Postcode is required' })
    }

    const result = await propertyService.createProperty(data, companyId, userId)

    // Audit log
    const addressDisplay = data.address.full_address || data.address.line1 || data.address.postcode
    await auditPropertyCreated(result.id, companyId, userId, addressDisplay)

    res.status(201).json({
      message: 'Property created successfully',
      property: result
    })
  } catch (error: any) {
    console.error('[Properties] Error creating property:', error)
    res.status(400).json({ error: error.message })
  }
})

// ============================================================================
// PROPERTY SEARCH - Must be before /:id to avoid route conflicts
// ============================================================================

/**
 * Search properties by address
 * Used for autocomplete and property selection in forms
 */
router.get('/search', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID not found' })
    }

    const { q, limit = '10' } = req.query
    const searchTerm = typeof q === 'string' ? q : ''
    const limitNum = Math.min(parseInt(limit as string) || 10, 50)

    if (!searchTerm || searchTerm.length < 2) {
      return res.json({ properties: [] })
    }

    const properties = await searchProperties(companyId, searchTerm, limitNum)

    res.json({ properties })
  } catch (error: any) {
    console.error('[Properties Search] Error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/properties/:id
 * Get property detail
 */
router.get('/:id', authenticateToken, requireMember, async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId!
    const propertyId = req.params.id

    const propertyData = await propertyService.getProperty(propertyId, companyId)

    if (!propertyData) {
      return res.status(404).json({ error: 'Property not found' })
    }

    // Extract related data for frontend
    const { landlords, compliance, documents, tenancies, ...property } = propertyData

    res.json({
      property,
      landlords: landlords || [],
      compliance: compliance || [],
      documents: documents || [],
      tenancies: tenancies || []
    })
  } catch (error: any) {
    console.error('[Properties] Error getting property:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * PUT /api/properties/:id
 * Update a property
 */
router.put('/:id', authenticateToken, requireMember, async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId!
    const userId = req.user!.id
    const propertyId = req.params.id
    const data: Partial<PropertyData> = req.body

    await propertyService.updateProperty(propertyId, data, companyId, userId)

    // Also update landlords if provided in the request
    if (data.landlords !== undefined) {
      await propertyService.updatePropertyLandlords(propertyId, data.landlords || [], companyId, userId)
    }

    // Audit log
    const changedFields = Object.keys(data)
    await auditPropertyUpdated(propertyId, companyId, userId, changedFields)

    res.json({ message: 'Property updated successfully' })
  } catch (error: any) {
    console.error('[Properties] Error updating property:', error)
    res.status(400).json({ error: error.message })
  }
})

/**
 * DELETE /api/properties/:id
 * Soft delete a property
 */
router.delete('/:id', authenticateToken, requireMember, async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId!
    const userId = req.user!.id
    const propertyId = req.params.id

    await propertyService.deleteProperty(propertyId, companyId, userId)

    // Audit log
    await auditPropertyDeleted(propertyId, companyId, userId)

    res.json({ message: 'Property deleted successfully' })
  } catch (error: any) {
    console.error('[Properties] Error deleting property:', error)
    res.status(400).json({ error: error.message })
  }
})

// ============================================================================
// LANDLORD MANAGEMENT
// ============================================================================

/**
 * PUT /api/properties/:id/landlords
 * Update landlord ownership for a property
 */
router.put('/:id/landlords', authenticateToken, requireMember, async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId!
    const userId = req.user!.id
    const propertyId = req.params.id
    const { landlords } = req.body

    if (!Array.isArray(landlords)) {
      return res.status(400).json({ error: 'Landlords must be an array' })
    }

    await propertyService.updatePropertyLandlords(propertyId, landlords, companyId, userId)

    res.json({ message: 'Landlords updated successfully' })
  } catch (error: any) {
    console.error('[Properties] Error updating landlords:', error)
    res.status(400).json({ error: error.message })
  }
})

// ============================================================================
// SPECIAL CLAUSES
// ============================================================================

/**
 * GET /api/properties/:id/special-clauses
 * Get special clauses for a property
 */
router.get('/:id/special-clauses', authenticateToken, requireMember, async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId!
    const propertyId = req.params.id

    const { data: property, error } = await supabase
      .from('properties')
      .select('special_clauses')
      .eq('id', propertyId)
      .eq('company_id', companyId)
      .single()

    if (error) throw error

    res.json({ clauses: property?.special_clauses || [] })
  } catch (error: any) {
    console.error('[Properties] Error getting special clauses:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * PUT /api/properties/:id/special-clauses
 * Update special clauses for a property
 */
router.put('/:id/special-clauses', authenticateToken, requireMember, async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId!
    const userId = req.user!.id
    const propertyId = req.params.id
    const { clauses } = req.body

    if (!Array.isArray(clauses)) {
      return res.status(400).json({ error: 'Clauses must be an array of strings' })
    }

    // Validate each clause is a non-empty string
    const validClauses = clauses.filter((c: any) => typeof c === 'string' && c.trim().length > 0)

    const { error } = await supabase
      .from('properties')
      .update({ special_clauses: validClauses })
      .eq('id', propertyId)
      .eq('company_id', companyId)

    if (error) throw error

    // Audit log
    await logPropertyAuditAction({
      propertyId,
      companyId,
      userId,
      action: 'SPECIAL_CLAUSES_UPDATED',
      description: `Special clauses updated (${validClauses.length} clause${validClauses.length === 1 ? '' : 's'})`,
      metadata: { clause_count: validClauses.length }
    })

    res.json({ message: 'Special clauses updated successfully', clauses: validClauses })
  } catch (error: any) {
    console.error('[Properties] Error updating special clauses:', error)
    res.status(400).json({ error: error.message })
  }
})

/**
 * POST /api/properties/:id/enhance-clause
 * Use GooseAI (Claude) to enhance a single rough clause into formal UK tenancy agreement language
 */
router.post('/:id/enhance-clause', authenticateToken, requireMember, async (req: AuthRequest, res) => {
  try {
    const { roughText } = req.body

    if (!roughText?.trim()) {
      return res.status(400).json({ error: 'Clause text is required' })
    }

    // Import the service dynamically to avoid loading if not needed
    const { enhanceClause } = await import('../services/clauseEnhancementService')

    const result = await enhanceClause(roughText)

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to enhance clause' })
    }

    res.json({ enhancedText: result.enhancedText })
  } catch (error: any) {
    console.error('[Properties] Error enhancing clause:', error)
    res.status(500).json({ error: error.message || 'Failed to enhance clause' })
  }
})

/**
 * POST /api/properties/:id/enhance-clauses
 * Use GooseAI (Claude) to enhance multiple clauses at once, keeping them separate
 */
router.post('/:id/enhance-clauses', authenticateToken, requireMember, async (req: AuthRequest, res) => {
  try {
    const { clauses } = req.body

    if (!Array.isArray(clauses) || clauses.length === 0) {
      return res.status(400).json({ error: 'Clauses array is required' })
    }

    // Import the service dynamically to avoid loading if not needed
    const { enhanceClauses } = await import('../services/clauseEnhancementService')

    const result = await enhanceClauses(clauses)

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to enhance clauses' })
    }

    res.json({ enhancedClauses: result.enhancedClauses })
  } catch (error: any) {
    console.error('[Properties] Error enhancing clauses:', error)
    res.status(500).json({ error: error.message || 'Failed to enhance clauses' })
  }
})

// ============================================================================
// COMPLIANCE
// ============================================================================

/**
 * GET /api/properties/:id/compliance
 * Get compliance records for a property
 */
router.get('/:id/compliance', authenticateToken, requireMember, async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId!
    const propertyId = req.params.id

    const compliance = await propertyService.getComplianceRecords(propertyId, companyId)
    res.json({ compliance })
  } catch (error: any) {
    console.error('[Properties] Error getting compliance:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/properties/:id/compliance-status
 * Get compliance status summary (for agreement integration)
 */
router.get('/:id/compliance-status', authenticateToken, requireMember, async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId!
    const propertyId = req.params.id

    const status = await propertyService.getComplianceStatus(propertyId, companyId)
    res.json(status)
  } catch (error: any) {
    console.error('[Properties] Error getting compliance status:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/properties/:id/compliance
 * Add a compliance record
 */
router.post('/:id/compliance', authenticateToken, requireMember, upload.single('document'), async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId!
    const userId = req.user!.id
    const propertyId = req.params.id
    const data: ComplianceData = req.body

    // Parse data if it comes as form data
    const complianceData: ComplianceData = {
      compliance_type: data.compliance_type,
      custom_type_name: data.custom_type_name,
      issue_date: data.issue_date,
      expiry_date: data.expiry_date,
      certificate_number: data.certificate_number,
      issuer_name: data.issuer_name,
      issuer_company: data.issuer_company,
      notes: data.notes
    }

    if (!complianceData.compliance_type || !complianceData.issue_date) {
      return res.status(400).json({ error: 'Compliance type and issue date are required' })
    }

    const result = await propertyService.addComplianceRecord(propertyId, complianceData, companyId, userId)

    // Handle document upload if provided
    if (req.file) {
      await ensurePropertyDocumentsBucket()
      const sanitizedName = sanitizeFilename(req.file.originalname)
      const fileName = `${Date.now()}_${sanitizedName}`
      const filePath = `${companyId}/${propertyId}/compliance/${result.id}/${fileName}`

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from(PROPERTY_DOCS_BUCKET)
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype
        })

      if (uploadError) {
        console.error('[Properties] Error uploading compliance document:', uploadError)
        return res.status(500).json({ error: `Failed to upload compliance document: ${uploadError.message}` })
      } else {
        // Link document to compliance record
        await supabase
          .from('compliance_documents')
          .insert({
            compliance_record_id: result.id,
            file_name: req.file.originalname,
            file_path: filePath,
            file_size: req.file.size,
            file_type: req.file.mimetype,
            uploaded_by: userId
          })
      }
    }

    // Audit log
    const expiryDate = complianceData.expiry_date || 'auto-calculated'
    await auditComplianceAdded(propertyId, companyId, userId, complianceData.compliance_type, expiryDate)

    res.status(201).json({
      message: 'Compliance record added successfully',
      compliance: result
    })
  } catch (error: any) {
    console.error('[Properties] Error adding compliance:', error)
    res.status(400).json({ error: error.message })
  }
})

/**
 * PUT /api/properties/:id/compliance/:complianceId
 * Update a compliance record
 */
router.put('/:id/compliance/:complianceId', authenticateToken, requireMember, upload.single('document'), async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId!
    const userId = req.user!.id
    const propertyId = req.params.id
    const complianceId = req.params.complianceId
    const data: Partial<ComplianceData> = req.body

    await propertyService.updateComplianceRecord(complianceId, data, companyId)

    // Handle new document upload if provided
    if (req.file) {
      await ensurePropertyDocumentsBucket()
      // Mark existing documents as not current
      await supabase
        .from('compliance_documents')
        .update({ is_current: false })
        .eq('compliance_record_id', complianceId)

      // Upload new document
      const sanitizedName = sanitizeFilename(req.file.originalname)
      const fileName = `${Date.now()}_${sanitizedName}`
      const filePath = `${companyId}/${propertyId}/compliance/${complianceId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from(PROPERTY_DOCS_BUCKET)
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype
        })

      if (uploadError) {
        console.error('[Properties] Error uploading compliance document:', uploadError)
        return res.status(500).json({ error: `Failed to upload compliance document: ${uploadError.message}` })
      } else {
        // Get current version
        const { data: existingDocs } = await supabase
          .from('compliance_documents')
          .select('version')
          .eq('compliance_record_id', complianceId)
          .order('version', { ascending: false })
          .limit(1)

        const nextVersion = (existingDocs?.[0]?.version || 0) + 1

        await supabase
          .from('compliance_documents')
          .insert({
            compliance_record_id: complianceId,
            file_name: req.file.originalname,
            file_path: filePath,
            file_size: req.file.size,
            file_type: req.file.mimetype,
            version: nextVersion,
            uploaded_by: userId
          })
      }
    }

    // Log the compliance update
    await logPropertyAuditAction({
      propertyId,
      companyId,
      action: 'COMPLIANCE_UPDATED',
      description: `Compliance record updated${data.compliance_type ? ` (${data.compliance_type})` : ''}`,
      metadata: { compliance_id: complianceId },
      userId
    })

    res.json({ message: 'Compliance record updated successfully' })
  } catch (error: any) {
    console.error('[Properties] Error updating compliance:', error)
    res.status(400).json({ error: error.message })
  }
})

/**
 * DELETE /api/properties/:id/compliance/:complianceId
 * Delete a compliance record
 */
router.delete('/:id/compliance/:complianceId', authenticateToken, requireMember, async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId!
    const userId = req.user!.id
    const propertyId = req.params.id
    const complianceId = req.params.complianceId

    await propertyService.deleteComplianceRecord(complianceId, companyId)

    // Log the compliance deletion
    await logPropertyAuditAction({
      propertyId,
      companyId,
      action: 'COMPLIANCE_DELETED',
      description: 'Compliance record deleted',
      metadata: { compliance_id: complianceId },
      userId
    })

    res.json({ message: 'Compliance record deleted successfully' })
  } catch (error: any) {
    console.error('[Properties] Error deleting compliance:', error)
    res.status(400).json({ error: error.message })
  }
})

/**
 * GET /api/properties/:id/compliance/:complianceId/document/:documentId
 * Download a compliance document
 */
router.get('/:id/compliance/:complianceId/document/:documentId', authenticateToken, requireMember, async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId!
    const { complianceId, documentId } = req.params

    // Get the document record
    const { data: document, error: docError } = await supabase
      .from('compliance_documents')
      .select('*')
      .eq('id', documentId)
      .eq('compliance_record_id', complianceId)
      .single()

    if (docError || !document) {
      return res.status(404).json({ error: 'Document not found' })
    }

    // Verify company ownership through compliance record
    const { data: compliance } = await supabase
      .from('compliance_records')
      .select('company_id')
      .eq('id', complianceId)
      .single()

    if (!compliance || compliance.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Download from Supabase storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(PROPERTY_DOCS_BUCKET)
      .download(document.file_path)

    if (downloadError || !fileData) {
      console.error('[Properties] Error downloading compliance document:', downloadError)
      return res.status(500).json({ error: 'Failed to download document' })
    }

    // Convert to buffer and send
    const buffer = Buffer.from(await fileData.arrayBuffer())

    res.setHeader('Content-Type', document.file_type || 'application/octet-stream')
    const forceDownload = req.query.download === 'true'
    res.setHeader('Content-Disposition', `${forceDownload ? 'attachment' : 'inline'}; filename="${document.file_name}"`)
    res.setHeader('Content-Length', buffer.length)
    res.send(buffer)
  } catch (error: any) {
    console.error('[Properties] Error downloading compliance document:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// DOCUMENTS
// ============================================================================

/**
 * GET /api/properties/:id/documents
 * Get documents for a property
 */
router.get('/:id/documents', authenticateToken, requireMember, async (req: AuthRequest, res) => {
  try {
    const propertyId = req.params.id
    const { tag } = req.query

    const documents = await propertyService.getPropertyDocuments(propertyId, tag as string | undefined)
    res.json({ documents })
  } catch (error: any) {
    console.error('[Properties] Error getting documents:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/properties/:id/documents
 * Upload a document to a property
 */
router.post('/:id/documents', authenticateToken, requireMember, upload.single('document'), async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId!
    const userId = req.user!.id
    const propertyId = req.params.id
    const { tag, custom_tag_name, description, file_name: customFileName, source_type, source_id } = req.body

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' })
    }

    if (!tag) {
      return res.status(400).json({ error: 'Tag is required' })
    }

    await ensurePropertyDocumentsBucket()
    // Upload to Supabase storage - sanitize filename for storage key
    const sanitizedName = sanitizeFilename(req.file.originalname)
    const fileName = `${Date.now()}_${sanitizedName}`
    const filePath = `${companyId}/${propertyId}/documents/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from(PROPERTY_DOCS_BUCKET)
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype
      })

    if (uploadError) {
      console.error('[Properties] Error uploading document:', uploadError)
      return res.status(500).json({ error: `Failed to upload document: ${uploadError.message}` })
    }

    // Create document record - use custom file name if provided, otherwise use original
    const displayFileName = customFileName?.trim() || req.file.originalname
    const result = await propertyService.addPropertyDocument(propertyId, {
      file_name: displayFileName,
      file_path: filePath,
      file_size: req.file.size,
      file_type: req.file.mimetype,
      tag,
      custom_tag_name,
      description,
      source_type,
      source_id
    }, userId)

    // Audit log
    await auditDocumentUploaded(propertyId, companyId, userId, displayFileName, tag)

    res.status(201).json({
      message: 'Document uploaded successfully',
      document: result
    })
  } catch (error: any) {
    console.error('[Properties] Error uploading document:', error)
    res.status(400).json({ error: error.message })
  }
})

/**
 * GET /api/properties/:id/documents/:documentId/download
 * Download a property document
 */
router.get('/:id/documents/:documentId/download', authenticateToken, requireMember, async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId!
    const { id: propertyId, documentId } = req.params

    // Get the document record
    const { data: document, error: docError } = await supabase
      .from('property_documents')
      .select('*')
      .eq('id', documentId)
      .eq('property_id', propertyId)
      .single()

    if (docError || !document) {
      return res.status(404).json({ error: 'Document not found' })
    }

    // Verify company ownership through property
    const { data: property } = await supabase
      .from('properties')
      .select('company_id')
      .eq('id', propertyId)
      .single()

    if (!property || property.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Handle both storage paths and signed URLs
    let filePath = document.file_path

    // If it's a signed URL, extract the path or fetch directly
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      console.log('[Properties] file_path is a URL, attempting direct fetch:', filePath.substring(0, 50) + '...')
      try {
        const response = await fetch(filePath)
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer())
          res.setHeader('Content-Type', document.file_type || 'application/octet-stream')
          const forceDownload = req.query.download === 'true'
          res.setHeader('Content-Disposition', `${forceDownload ? 'attachment' : 'inline'}; filename="${document.file_name}"`)
          res.setHeader('Content-Length', buffer.length)
          return res.send(buffer)
        } else {
          console.error('[Properties] Failed to fetch URL:', response.status)
          return res.status(500).json({ error: 'Failed to download document - URL expired or invalid' })
        }
      } catch (fetchError: any) {
        console.error('[Properties] Error fetching URL:', fetchError.message)
        return res.status(500).json({ error: 'Failed to download document' })
      }
    }

    // Clean up the file path - remove bucket prefix if present
    if (filePath.includes('property-documents/')) {
      filePath = filePath.replace('property-documents/', '')
    }

    // Download from Supabase storage
    console.log('[Properties] Downloading from storage path:', filePath)
    console.log('[Properties] Full document record:', JSON.stringify(document, null, 2))

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('property-documents')
      .download(filePath)

    if (downloadError || !fileData) {
      console.error('[Properties] Error downloading property document:', {
        error: downloadError,
        message: downloadError?.message,
        filePath,
        documentId,
        propertyId
      })
      return res.status(500).json({
        error: 'Failed to download document',
        details: downloadError?.message || 'Unknown error',
        filePath
      })
    }

    // Convert to buffer and send
    const buffer = Buffer.from(await fileData.arrayBuffer())

    res.setHeader('Content-Type', document.file_type || 'application/octet-stream')
    const forceDownload = req.query.download === 'true'
    res.setHeader('Content-Disposition', `${forceDownload ? 'attachment' : 'inline'}; filename="${document.file_name}"`)
    res.setHeader('Content-Length', buffer.length)
    res.send(buffer)
  } catch (error: any) {
    console.error('[Properties] Error downloading property document:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * DELETE /api/properties/:id/documents/:documentId
 * Remove document association (does not delete the file)
 */
router.delete('/:id/documents/:documentId', authenticateToken, requireMember, async (req: AuthRequest, res) => {
  try {
    const propertyId = req.params.id
    const documentId = req.params.documentId

    await propertyService.removePropertyDocument(documentId, propertyId)

    res.json({ message: 'Document association removed successfully' })
  } catch (error: any) {
    console.error('[Properties] Error removing document:', error)
    res.status(400).json({ error: error.message })
  }
})

// ============================================================================
// CSV IMPORT
// ============================================================================

/**
 * POST /api/properties/import-csv
 * Import properties from CSV
 */
router.post('/import-csv', authenticateToken, requireMember, upload.single('csv'), async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId!
    const userId = req.user!.id

    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file provided' })
    }

    const csvContent = req.file.buffer.toString('utf-8')
    const lines = csvContent.split('\n').filter(line => line.trim())

    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV must have at least a header row and one data row' })
    }

    // Parse header
    const headerLine = lines[0]
    const headers = parseCSVLine(headerLine)
    const headersLower = headers.map(h => h.toLowerCase().trim())

    // Check for manual field mapping from frontend
    let columnMapping: Record<string, number | undefined>
    const fieldMappingStr = req.body.fieldMapping

    if (fieldMappingStr) {
      // Use manual mapping provided by frontend (safely parse JSON)
      let fieldMapping: Record<string, string>
      try {
        fieldMapping = JSON.parse(fieldMappingStr) as Record<string, string>
      } catch {
        return res.status(400).json({ error: 'Invalid field mapping format' })
      }
      columnMapping = {}

      // Convert header names to column indices
      for (const [field, headerName] of Object.entries(fieldMapping)) {
        if (headerName) {
          const index = headers.findIndex(h => h === headerName)
          if (index !== -1) {
            columnMapping[field] = index
          }
        }
      }
    } else {
      // Fall back to auto-detect column mappings
      columnMapping = detectColumnMapping(headersLower)
    }

    if (columnMapping.postcode === undefined) {
      return res.status(400).json({ error: 'CSV must have a postcode column mapped' })
    }

    // Parse and import data rows
    const results = {
      total_rows: lines.length - 1,
      imported: 0,
      skipped: 0,
      errors: [] as Array<{ row: number; error: string }>
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      try {
        const values = parseCSVLine(line)
        const postcode = values[columnMapping.postcode!]?.trim()

        if (!postcode) {
          results.skipped++
          results.errors.push({ row: i + 1, error: 'Missing required postcode' })
          continue
        }

        // Build property data
        const propertyData: PropertyData = {
          address: {
            postcode,
            line1: columnMapping.address_line1 !== undefined ? values[columnMapping.address_line1]?.trim() : undefined,
            line2: columnMapping.address_line2 !== undefined ? values[columnMapping.address_line2]?.trim() : undefined,
            city: columnMapping.city !== undefined ? values[columnMapping.city]?.trim() : undefined,
            county: columnMapping.county !== undefined ? values[columnMapping.county]?.trim() : undefined,
            full_address: columnMapping.full_address !== undefined ? values[columnMapping.full_address]?.trim() : undefined
          },
          property_type: columnMapping.property_type !== undefined ? normalizePropertyType(values[columnMapping.property_type]?.trim()) : undefined,
          furnishing_status: columnMapping.furnishing_status !== undefined ? normalizeFurnishingStatus(values[columnMapping.furnishing_status]?.trim()) : undefined,
          management_type: columnMapping.management_type !== undefined ? normalizeManagementType(values[columnMapping.management_type]?.trim()) : undefined,
          number_of_bedrooms: columnMapping.bedrooms !== undefined ? parseInt(values[columnMapping.bedrooms]) || undefined : undefined
        }

        await propertyService.createProperty(propertyData, companyId, userId)
        results.imported++
      } catch (error: any) {
        results.skipped++
        results.errors.push({ row: i + 1, error: error.message })
      }
    }

    res.json({
      message: 'CSV import completed',
      summary: results
    })
  } catch (error: any) {
    console.error('[Properties] Error importing CSV:', error)
    res.status(400).json({ error: error.message })
  }
})

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse a CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      // Handle escaped quotes
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

/**
 * Auto-detect column mapping from headers
 */
function detectColumnMapping(headers: string[]): Record<string, number | undefined> {
  const mapping: Record<string, number | undefined> = {}

  headers.forEach((header, index) => {
    const h = header.toLowerCase().replace(/[^a-z0-9]/g, '')

    // Postcode variations
    if (['postcode', 'postalcode', 'zipcode', 'zip'].includes(h)) {
      mapping.postcode = index
    }
    // Address line 1
    else if (['addressline1', 'address1', 'line1', 'street', 'streetaddress'].includes(h)) {
      mapping.address_line1 = index
    }
    // Address line 2
    else if (['addressline2', 'address2', 'line2'].includes(h)) {
      mapping.address_line2 = index
    }
    // City
    else if (['city', 'town', 'locality'].includes(h)) {
      mapping.city = index
    }
    // County
    else if (['county', 'state', 'region'].includes(h)) {
      mapping.county = index
    }
    // Full address
    else if (['fulladdress', 'address', 'propertyaddress'].includes(h)) {
      mapping.full_address = index
    }
    // Property type
    else if (['propertytype', 'type', 'buildingtype'].includes(h)) {
      mapping.property_type = index
    }
    // Furnished status
    else if (['furnishedstatus', 'furnished', 'furnishing', 'furnishingstatus'].includes(h)) {
      mapping.furnishing_status = index
    }
    // Management type
    else if (['managementtype', 'management', 'lettingtype', 'servicetype'].includes(h)) {
      mapping.management_type = index
    }
    // Bedrooms
    else if (['bedrooms', 'beds', 'numberofbedrooms'].includes(h)) {
      mapping.bedrooms = index
    }
  })

  return mapping
}

/**
 * Normalize property type value from CSV
 */
function normalizePropertyType(value: string | undefined): string | undefined {
  if (!value) return undefined
  const v = value.toLowerCase().trim()
  const mapping: Record<string, string> = {
    'flat': 'flat',
    'apartment': 'flat',
    'studio': 'studio',
    'house': 'house',
    'bungalow': 'bungalow',
    'hmo': 'hmo',
    'commercial': 'commercial',
    'other': 'other'
  }
  return mapping[v] || undefined
}

/**
 * Normalize furnishing status value from CSV
 */
function normalizeFurnishingStatus(value: string | undefined): string | undefined {
  if (!value) return undefined
  const v = value.toLowerCase().trim().replace(/[\s_-]+/g, '')
  const mapping: Record<string, string> = {
    'furnished': 'furnished',
    'unfurnished': 'unfurnished',
    'partfurnished': 'part_furnished',
    'partlyfurnished': 'part_furnished'
  }
  return mapping[v] || undefined
}

/**
 * Normalize management type value from CSV
 */
function normalizeManagementType(value: string | undefined): 'managed' | 'let_only' | undefined {
  if (!value) return undefined
  const v = value.toLowerCase().trim().replace(/[\s_-]+/g, '')
  const mapping: Record<string, 'managed' | 'let_only'> = {
    'managed': 'managed',
    'fullmanagement': 'managed',
    'fullmanaged': 'managed',
    'agentmanaged': 'managed',
    'letonly': 'let_only',
    'landlordmanaged': 'let_only',
    'tenantfind': 'let_only',
    'introonly': 'let_only'
  }
  return mapping[v] || undefined
}

/**
 * POST /api/properties/:id/activity
 * Add an activity note for a property
 */
router.post('/:id/activity', authenticateToken, requireMember, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const companyId = req.companyId!
    const userId = req.user!.id
    const { description, metadata } = req.body || {}

    if (!description || typeof description !== 'string') {
      return res.status(400).json({ error: 'Description is required' })
    }

    // Verify property belongs to company
    const property = await propertyService.getProperty(id, companyId)
    if (!property) {
      return res.status(404).json({ error: 'Property not found' })
    }

    await logPropertyAuditAction({
      propertyId: id,
      companyId,
      userId,
      action: 'AML_BYPASSED',
      description,
      metadata: metadata && typeof metadata === 'object' ? metadata : {}
    })

    res.status(201).json({ message: 'Activity logged' })
  } catch (error: any) {
    console.error('Error logging property activity:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/properties/:id/activity
 * Get activity/audit log for a property
 */
router.get('/:id/activity', authenticateToken, requireMember, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const companyId = req.companyId!
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0

    // Verify property belongs to company
    const property = await propertyService.getProperty(id, companyId)
    if (!property) {
      return res.status(404).json({ error: 'Property not found' })
    }

    // Get audit log entries
    const { logs, total } = await getPropertyAuditLog(id, companyId, { limit, offset })

    res.json({
      activities: logs,
      total,
      limit,
      offset
    })
  } catch (error: any) {
    console.error('Error fetching property activity:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// PROPERTY MATCHING ENDPOINTS
// ============================================================================

/**
 * Search properties by address
 * Used for autocomplete and property selection in forms
 */
router.get('/search', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID not found' })
    }

    const { q, limit = '10' } = req.query
    const searchTerm = typeof q === 'string' ? q : ''
    const limitNum = Math.min(parseInt(limit as string) || 10, 50)

    if (!searchTerm || searchTerm.length < 2) {
      return res.json({ properties: [] })
    }

    const properties = await searchProperties(companyId, searchTerm, limitNum)

    res.json({ properties })
  } catch (error: any) {
    console.error('Error searching properties:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Match an address to an existing property or suggest creating one
 * Returns matched property or suggestions for fuzzy matches
 */
router.post('/match', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId
    const userId = req.user?.id
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID not found' })
    }

    const { address_line1, address_line2, city, county, postcode, auto_create, landlord_id } = req.body

    if (!address_line1 || !postcode) {
      return res.status(400).json({ error: 'Address line 1 and postcode are required' })
    }

    const result = await matchOrCreateProperty(companyId, {
      line1: address_line1,
      line2: address_line2,
      city,
      county,
      postcode
    }, {
      autoCreate: auto_create === true,
      landlordId: landlord_id,
      userId
    })

    res.json(result)
  } catch (error: any) {
    console.error('Error matching property:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get property details for linking (used in forms)
 */
router.get('/for-linking/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID not found' })
    }

    const { id } = req.params

    const property = await getPropertyForLinking(id, companyId)
    if (!property) {
      return res.status(404).json({ error: 'Property not found' })
    }

    res.json({ property })
  } catch (error: any) {
    console.error('Error getting property for linking:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Validate property access (check if property exists and belongs to company)
 */
router.get('/validate/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID not found' })
    }

    const { id } = req.params

    const hasAccess = await validatePropertyAccess(id, companyId)

    res.json({ valid: hasAccess })
  } catch (error: any) {
    console.error('Error validating property:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/properties/:id/landlord-move-in-pack
 * Send compliance documents to landlord(s) linked to this property
 */
router.post('/:id/landlord-move-in-pack', authenticateToken, requireMember, async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId!
    const userId = req.user?.id
    const propertyId = req.params.id

    const { selectedDocuments, additionalInfo } = req.body

    if (!selectedDocuments || !Array.isArray(selectedDocuments)) {
      return res.status(400).json({ error: 'selectedDocuments array is required' })
    }

    // Get property details
    const { data: prop, error: propError } = await supabase
      .from('properties')
      .select('id, address_line1_encrypted, city_encrypted, postcode, full_address_encrypted, company_id')
      .eq('id', propertyId)
      .eq('company_id', companyId)
      .single()

    if (propError || !prop) {
      return res.status(404).json({ error: 'Property not found' })
    }

    const addressLine1 = prop.address_line1_encrypted ? decrypt(prop.address_line1_encrypted) : ''
    const city = prop.city_encrypted ? decrypt(prop.city_encrypted) : ''
    const propertyAddress = [addressLine1, city, prop.postcode].filter(Boolean).join(', ')

    // Get landlords linked to this property
    const { data: propertyLandlords, error: landlordError } = await supabase
      .from('property_landlords')
      .select(`
        landlord_id,
        is_primary_contact,
        landlords (
          id,
          first_name_encrypted,
          last_name_encrypted,
          email_encrypted
        )
      `)
      .eq('property_id', propertyId)

    if (landlordError) {
      console.error('[LandlordPack] Error fetching landlords:', landlordError)
      return res.status(500).json({ error: 'Failed to fetch landlords' })
    }

    // Build landlord recipients list
    const landlordRecipients: { email: string; name: string }[] = []
    for (const pl of propertyLandlords || []) {
      const landlord = pl.landlords as any
      if (!landlord) continue

      const firstName = landlord.first_name_encrypted ? decrypt(landlord.first_name_encrypted) || '' : ''
      const lastName = landlord.last_name_encrypted ? decrypt(landlord.last_name_encrypted) || '' : ''
      const email = landlord.email_encrypted ? decrypt(landlord.email_encrypted) || '' : ''

      if (email) {
        landlordRecipients.push({
          email,
          name: [firstName, lastName].filter(Boolean).join(' ') || 'Landlord'
        })
      }
    }

    if (landlordRecipients.length === 0) {
      return res.status(400).json({ error: 'No landlords with email addresses found for this property' })
    }

    // Get company details for branding
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted, phone_encrypted, email_encrypted, logo_url')
      .eq('id', companyId)
      .single()

    const companyName = company?.name_encrypted ? decrypt(company.name_encrypted) || 'PropertyGoose' : 'PropertyGoose'
    const companyPhone = company?.phone_encrypted ? decrypt(company.phone_encrypted) || '' : ''
    const companyEmail = company?.email_encrypted ? decrypt(company.email_encrypted) || '' : ''

    // Get compliance records for this property
    const { data: complianceRecords } = await supabase
      .from('compliance_records')
      .select(`
        id,
        compliance_type,
        custom_type_name,
        compliance_documents (
          id,
          file_name,
          file_path
        )
      `)
      .eq('property_id', propertyId)
      .in('status', ['valid', 'expiring_soon'])

    // Also get property documents
    const { data: propDocuments } = await supabase
      .from('property_documents')
      .select('id, file_name, file_path')
      .eq('property_id', propertyId)

    // Generate signed URLs for selected documents
    const complianceTypeLabels: Record<string, string> = {
      gas_safety: 'Gas Safety Certificate',
      epc: 'Energy Performance Certificate (EPC)',
      eicr: 'Electrical Safety Certificate (EICR)',
      fire_safety: 'Fire Safety Certificate',
      legionella: 'Legionella Risk Assessment',
      smoke_alarm: 'Smoke & CO Alarms Certificate'
    }

    const documents: { name: string; url: string; type: string }[] = []

    // Process compliance documents
    for (const record of complianceRecords || []) {
      if (!selectedDocuments.includes(record.id)) continue

      const docs = record.compliance_documents || []
      for (const doc of docs) {
        if (doc.file_path) {
          const { data: signedUrlData } = await supabase.storage
            .from('property-documents')
            .createSignedUrl(doc.file_path.replace('property-documents/', ''), 86400)

          if (signedUrlData?.signedUrl) {
            documents.push({
              name: doc.file_name || complianceTypeLabels[record.compliance_type] || record.custom_type_name || 'Document',
              url: signedUrlData.signedUrl,
              type: complianceTypeLabels[record.compliance_type] || record.custom_type_name || record.compliance_type
            })
          }
        }
      }
    }

    // Process property documents
    for (const doc of propDocuments || []) {
      if (!selectedDocuments.includes(doc.id)) continue

      if (doc.file_path) {
        const { data: signedUrlData } = await supabase.storage
          .from('property-documents')
          .createSignedUrl(doc.file_path.replace('property-documents/', ''), 86400)

        if (signedUrlData?.signedUrl) {
          documents.push({
            name: doc.file_name || 'Document',
            url: signedUrlData.signedUrl,
            type: 'Property Document'
          })
        }
      }
    }

    // Build additional info HTML
    let additionalInfoHtml = ''
    if (additionalInfo && additionalInfo.trim()) {
      additionalInfoHtml = `
        <tr>
          <td style="padding: 20px 0; border-bottom: 1px solid #e5e7eb;">
            <h3 style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">Additional Information</h3>
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
              <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${additionalInfo}</p>
            </div>
          </td>
        </tr>
      `
    }

    // Send email via email service
    const { sendLandlordMoveInPack } = await import('../services/emailService')
    await sendLandlordMoveInPack(
      landlordRecipients,
      propertyAddress,
      documents,
      { name: companyName, email: companyEmail, phone: companyPhone },
      companyName,
      company?.logo_url,
      additionalInfoHtml
    )

    // Log activity
    await logPropertyAuditAction({
      propertyId,
      companyId,
      action: 'LANDLORD_PACK_SENT',
      description: `Compliance pack with ${documents.length} document(s) sent to ${landlordRecipients.length} landlord(s)`,
      metadata: {
        documentCount: documents.length,
        landlordEmails: landlordRecipients.map(l => l.email)
      },
      userId
    })

    res.json({
      success: true,
      documentsSent: documents.length,
      recipientCount: landlordRecipients.length
    })
  } catch (error: any) {
    console.error('Error in POST /api/properties/:id/landlord-move-in-pack:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router

import { Router } from 'express'
import { authenticateToken, requireMember, AuthRequest } from '../middleware/auth'
import { propertyService, PropertyData, PropertyFilters, ComplianceData } from '../services/propertyService'
import {
  auditPropertyCreated,
  auditPropertyUpdated,
  auditPropertyDeleted,
  auditComplianceAdded,
  auditDocumentUploaded
} from '../services/propertyAuditService'
import { supabase } from '../config/supabase'
import multer from 'multer'

const router = Router()

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
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
      const fileName = `${Date.now()}_${req.file.originalname}`
      const filePath = `${companyId}/${propertyId}/compliance/${result.id}/${fileName}`

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('property-documents')
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype
        })

      if (uploadError) {
        console.error('[Properties] Error uploading compliance document:', uploadError)
        // Continue without document - compliance record is already created
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
      // Mark existing documents as not current
      await supabase
        .from('compliance_documents')
        .update({ is_current: false })
        .eq('compliance_record_id', complianceId)

      // Upload new document
      const fileName = `${Date.now()}_${req.file.originalname}`
      const filePath = `${companyId}/${propertyId}/compliance/${complianceId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('property-documents')
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype
        })

      if (!uploadError) {
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
    const complianceId = req.params.complianceId

    await propertyService.deleteComplianceRecord(complianceId, companyId)

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
      .from('property-documents')
      .download(document.file_path)

    if (downloadError || !fileData) {
      console.error('[Properties] Error downloading compliance document:', downloadError)
      return res.status(500).json({ error: 'Failed to download document' })
    }

    // Convert to buffer and send
    const buffer = Buffer.from(await fileData.arrayBuffer())

    res.setHeader('Content-Type', document.file_type || 'application/octet-stream')
    res.setHeader('Content-Disposition', `inline; filename="${document.file_name}"`)
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
    const { tag, custom_tag_name, description, file_name: customFileName } = req.body

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' })
    }

    if (!tag) {
      return res.status(400).json({ error: 'Tag is required' })
    }

    // Upload to Supabase storage
    const fileName = `${Date.now()}_${req.file.originalname}`
    const filePath = `${companyId}/${propertyId}/documents/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('property-documents')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype
      })

    if (uploadError) {
      console.error('[Properties] Error uploading document:', uploadError)
      return res.status(500).json({ error: 'Failed to upload document' })
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
      description
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

    // Download from Supabase storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('property-documents')
      .download(document.file_path)

    if (downloadError || !fileData) {
      console.error('[Properties] Error downloading property document:', downloadError)
      return res.status(500).json({ error: 'Failed to download document' })
    }

    // Convert to buffer and send
    const buffer = Buffer.from(await fileData.arrayBuffer())

    res.setHeader('Content-Type', document.file_type || 'application/octet-stream')
    res.setHeader('Content-Disposition', `inline; filename="${document.file_name}"`)
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
      // Use manual mapping provided by frontend
      const fieldMapping = JSON.parse(fieldMappingStr) as Record<string, string>
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
          property_type: columnMapping.property_type !== undefined ? values[columnMapping.property_type]?.trim() : undefined,
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
    // Bedrooms
    else if (['bedrooms', 'beds', 'numberofbedrooms'].includes(h)) {
      mapping.bedrooms = index
    }
  })

  return mapping
}

export default router

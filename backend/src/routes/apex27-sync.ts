import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import {
  getCompanyApex27Config,
  syncProperties,
  syncLandlords,
  pushDocument,
  previewSync,
  confirmSync,
  previewTenancySync,
  confirmTenancySync,
  apex27Fetch
} from '../services/apex27Service'
import { decrypt } from '../services/encryption'
import { normalizePostcode, normalizeAddressLine } from '../services/propertyMatchingService'
import { sendEmail, loadEmailTemplate } from '../services/emailService'
import { generateTenancySummary } from '../services/tenancySummaryService'

const router = Router()

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getUserCompanyAndRole(req: AuthRequest): Promise<{ companyId: string; role: string; userId: string } | null> {
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
      return { companyId: branchMembership[0].company_id, role: branchMembership[0].role, userId }
    }
  }

  const { data: companyUsers } = await supabase
    .from('company_users')
    .select('company_id, role')
    .eq('user_id', userId)
    .limit(1)

  if (companyUsers && companyUsers.length > 0) {
    return { companyId: companyUsers[0].company_id, role: companyUsers[0].role, userId }
  }

  return null
}

// ============================================================================
// INITIAL SYNC (PREVIEW + CONFIRM)
// ============================================================================

/**
 * POST /api/apex27/preview
 * Preview what the initial sync would do — no DB writes
 */
router.post('/preview', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyData = await getUserCompanyAndRole(req)

    if (!companyData) {
      return res.status(404).json({ error: 'Company not found' })
    }

    if (!['admin', 'owner'].includes(companyData.role)) {
      return res.status(403).json({ error: 'Only admins and owners can sync' })
    }

    const result = await previewSync(companyData.companyId)

    if (!result.success) {
      return res.status(500).json({ error: result.error })
    }

    res.json({ success: true, items: result.items })
  } catch (error) {
    console.error('[Apex27] Error previewing sync:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * POST /api/apex27/confirm
 * Confirm initial sync — write only approved items
 */
router.post('/confirm', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { items } = req.body

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'items array is required' })
    }

    const companyData = await getUserCompanyAndRole(req)

    if (!companyData) {
      return res.status(404).json({ error: 'Company not found' })
    }

    if (!['admin', 'owner'].includes(companyData.role)) {
      return res.status(403).json({ error: 'Only admins and owners can sync' })
    }

    const result = await confirmSync(companyData.companyId, items)

    if (!result.success) {
      return res.status(500).json({ error: result.error })
    }

    // Send email notification to the user
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', companyData.userId)
        .single()

      if (profile?.email) {
        const r = result.result!
        const html = loadEmailTemplate('apex27-sync-complete', {
          AgentName: profile.full_name || 'there',
          PropertiesCreated: String(r.records_created),
          PropertiesLinked: String(r.records_updated),
          PropertiesSkipped: String(r.records_skipped),
          TotalProcessed: String(r.records_processed),
          ErrorCount: String(r.errors.length),
          DashboardLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/properties`
        })

        await sendEmail({
          to: profile.email,
          subject: `Apex27 Sync Complete — ${r.records_created} created, ${r.records_updated} linked - PropertyGoose`,
          html
        })
      }
    } catch (emailErr) {
      console.error('[Apex27] Failed to send sync notification email:', emailErr)
      // Don't fail the response for email errors
    }

    res.json({ success: true, ...result.result })
  } catch (error) {
    console.error('[Apex27] Error confirming sync:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

// ============================================================================
// PROPERTY SYNC (REFRESH — updates existing linked records)
// ============================================================================

/**
 * POST /api/apex27/properties
 * Trigger property sync from Apex27
 */
router.post('/properties', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyData = await getUserCompanyAndRole(req)

    if (!companyData) {
      return res.status(404).json({ error: 'Company not found' })
    }

    if (!['admin', 'owner'].includes(companyData.role)) {
      return res.status(403).json({ error: 'Only admins and owners can sync properties' })
    }

    const result = await syncProperties(companyData.companyId)

    if (!result.success) {
      return res.status(500).json({ error: result.error })
    }

    res.json({ success: true, ...result.result })
  } catch (error) {
    console.error('[Apex27] Error syncing properties:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

// ============================================================================
// LANDLORD SYNC
// ============================================================================

/**
 * POST /api/apex27/landlords
 * Trigger landlord sync from Apex27
 */
router.post('/landlords', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyData = await getUserCompanyAndRole(req)

    if (!companyData) {
      return res.status(404).json({ error: 'Company not found' })
    }

    if (!['admin', 'owner'].includes(companyData.role)) {
      return res.status(403).json({ error: 'Only admins and owners can sync landlords' })
    }

    const result = await syncLandlords(companyData.companyId)

    if (!result.success) {
      return res.status(500).json({ error: result.error })
    }

    res.json({ success: true, ...result.result })
  } catch (error) {
    console.error('[Apex27] Error syncing landlords:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

// ============================================================================
// TENANCY SYNC (PREVIEW + CONFIRM)
// ============================================================================

/**
 * POST /api/apex27/tenancies/preview
 * Preview tenancy import — no DB writes
 */
router.post('/tenancies/preview', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyData = await getUserCompanyAndRole(req)

    if (!companyData) {
      return res.status(404).json({ error: 'Company not found' })
    }

    if (!['admin', 'owner'].includes(companyData.role)) {
      return res.status(403).json({ error: 'Only admins and owners can sync tenancies' })
    }

    const result = await previewTenancySync(companyData.companyId)

    if (!result.success) {
      return res.status(500).json({ error: result.error })
    }

    res.json({ success: true, items: result.items })
  } catch (error) {
    console.error('[Apex27] Error previewing tenancy sync:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * POST /api/apex27/tenancies/confirm
 * Confirm tenancy import — write approved items
 */
router.post('/tenancies/confirm', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { items } = req.body

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'items array is required' })
    }

    const companyData = await getUserCompanyAndRole(req)

    if (!companyData) {
      return res.status(404).json({ error: 'Company not found' })
    }

    if (!['admin', 'owner'].includes(companyData.role)) {
      return res.status(403).json({ error: 'Only admins and owners can sync tenancies' })
    }

    const result = await confirmTenancySync(companyData.companyId, companyData.userId, items)

    if (!result.success) {
      return res.status(500).json({ error: result.error })
    }

    res.json({ success: true, ...result.result })
  } catch (error) {
    console.error('[Apex27] Error confirming tenancy sync:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

// ============================================================================
// SYNC LOGS
// ============================================================================

/**
 * GET /api/apex27/logs
 * Get sync history
 */
router.get('/logs', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyData = await getUserCompanyAndRole(req)

    if (!companyData) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { data: logs, error } = await supabase
      .from('apex27_sync_logs')
      .select('*')
      .eq('company_id', companyData.companyId)
      .order('started_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('[Apex27] Error fetching sync logs:', error)
      return res.status(500).json({ error: 'Failed to fetch sync logs' })
    }

    res.json({ logs: logs || [] })
  } catch (error) {
    console.error('[Apex27] Error getting sync logs:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

// ============================================================================
// DOCUMENT PUSH
// ============================================================================

/**
 * Fuzzy-resolve an apex27_listing_id from a property ID.
 * 3-level fallback: direct link → PG postcode search → Apex27 API search
 */
async function resolveApex27ListingId(
  propertyId: string | null,
  companyId: string,
  apiKey: string
): Promise<string | null> {
  if (!propertyId) return null

  // 1. Direct: property has apex27_listing_id
  const { data: property } = await supabase
    .from('properties')
    .select('apex27_listing_id, postcode, address_line1_encrypted')
    .eq('id', propertyId)
    .eq('company_id', companyId)
    .single()

  if (property?.apex27_listing_id) return property.apex27_listing_id

  // Need postcode for fallback searches
  const postcode = property?.postcode
  const address = property?.address_line1_encrypted ? decrypt(property.address_line1_encrypted) : null
  if (!postcode) return null

  // 2. PG search: other properties with same postcode that are linked
  const { data: matchedProps } = await supabase
    .from('properties')
    .select('id, apex27_listing_id, address_line1_encrypted')
    .eq('company_id', companyId)
    .eq('postcode', postcode)
    .not('apex27_listing_id', 'is', null)

  if (matchedProps && matchedProps.length > 0) {
    if (matchedProps.length === 1) return matchedProps[0].apex27_listing_id

    if (address) {
      const normAddr = normalizeAddressLine(address)
      for (const p of matchedProps) {
        const pAddr = p.address_line1_encrypted ? decrypt(p.address_line1_encrypted) : null
        if (pAddr && normalizeAddressLine(pAddr) === normAddr) {
          console.log(`[Apex27] Fuzzy-matched property to listing ${p.apex27_listing_id} via PG postcode search`)
          return p.apex27_listing_id
        }
      }
    }
    console.log(`[Apex27] Best-guess matched property to listing ${matchedProps[0].apex27_listing_id}`)
    return matchedProps[0].apex27_listing_id
  }

  // 3. Apex27 API search by postcode
  const searchResult = await apex27Fetch<any[]>(apiKey, '/listings', {
    transactionType: 'rent',
    postalCode: postcode,
    pageSize: 25
  })

  if (searchResult.success && Array.isArray(searchResult.data) && searchResult.data.length > 0) {
    const listings = searchResult.data
    if (listings.length === 1) {
      console.log(`[Apex27] Matched property to Apex27 listing ${listings[0].id} via API search`)
      return String(listings[0].id)
    }
    if (address) {
      const normAddr = normalizeAddressLine(address)
      for (const l of listings) {
        if (l.address1 && normalizeAddressLine(l.address1) === normAddr) {
          console.log(`[Apex27] Matched property to Apex27 listing ${l.id} via API search + address`)
          return String(l.id)
        }
      }
    }
    console.log(`[Apex27] Best-guess matched property to Apex27 listing ${listings[0].id}`)
    return String(listings[0].id)
  }

  return null
}

/**
 * POST /api/apex27/documents/push
 * Push a document to Apex27
 * Supports: tenancy_document, reference_report, property_document
 */
router.post('/documents/push', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { sourceType, sourceId, apex27ListingId } = req.body

    if (!sourceType || !sourceId) {
      return res.status(400).json({ error: 'sourceType and sourceId are required' })
    }

    const companyData = await getUserCompanyAndRole(req)

    if (!companyData) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyApex27Config(companyData.companyId)
    if (!config) {
      return res.status(400).json({ error: 'Apex27 is not configured' })
    }

    let documentName = ''
    let documentUrl = '' // direct URL (for reference reports)
    let documentPath = '' // storage path (needs signed URL)
    let propertyId: string | null = null
    let resolvedListingId = apex27ListingId || null

    // ---- Resolve document info based on source type ----

    if (sourceType === 'tenancy_document') {
      const { data: doc } = await supabase
        .from('tenancy_documents')
        .select('name, file_path, tenancy_id')
        .eq('id', sourceId)
        .single()

      if (!doc) return res.status(404).json({ error: 'Document not found' })

      documentName = doc.name
      documentPath = doc.file_path

      if (doc.tenancy_id) {
        const { data: tenancy } = await supabase
          .from('tenancies')
          .select('property_id')
          .eq('id', doc.tenancy_id)
          .single()
        propertyId = tenancy?.property_id || null
      }

    } else if (sourceType === 'property_document') {
      const { data: doc } = await supabase
        .from('property_documents')
        .select('id, file_name, file_path, property_id')
        .eq('id', sourceId)
        .single()

      if (!doc) return res.status(404).json({ error: 'Document not found' })

      documentName = doc.file_name
      documentPath = doc.file_path
      propertyId = doc.property_id

    } else if (sourceType === 'reference_report') {
      const { data: ref } = await supabase
        .from('tenant_references_v2')
        .select('id, report_pdf_url, linked_property_id, property_address_encrypted, property_postcode_encrypted')
        .eq('id', sourceId)
        .single()

      if (!ref) return res.status(404).json({ error: 'Reference not found' })
      if (!ref.report_pdf_url) return res.status(400).json({ error: 'Reference report has not been generated yet. Generate the report first.' })

      documentName = `Reference Report - ${sourceId.substring(0, 8)}`
      documentUrl = ref.report_pdf_url
      propertyId = ref.linked_property_id

      // For references without a linked property, try fuzzy by reference address
      if (!propertyId && ref.property_postcode_encrypted) {
        const refPostcode = decrypt(ref.property_postcode_encrypted)
        if (refPostcode) {
          // Search PG properties by postcode
          const { data: matchedProps } = await supabase
            .from('properties')
            .select('id, apex27_listing_id, postcode, address_line1_encrypted')
            .eq('company_id', companyData.companyId)
            .eq('postcode', normalizePostcode(refPostcode))
            .not('apex27_listing_id', 'is', null)

          if (matchedProps && matchedProps.length > 0) {
            const refAddr = ref.property_address_encrypted ? decrypt(ref.property_address_encrypted) : null
            if (matchedProps.length === 1) {
              resolvedListingId = matchedProps[0].apex27_listing_id
            } else if (refAddr) {
              const normRefAddr = normalizeAddressLine(refAddr)
              for (const p of matchedProps) {
                const pAddr = p.address_line1_encrypted ? decrypt(p.address_line1_encrypted) : null
                if (pAddr && normalizeAddressLine(pAddr) === normRefAddr) {
                  resolvedListingId = p.apex27_listing_id
                  break
                }
              }
            }
            if (!resolvedListingId) resolvedListingId = matchedProps[0].apex27_listing_id
          }

          // Last resort: search Apex27 API
          if (!resolvedListingId) {
            const refAddr = ref.property_address_encrypted ? decrypt(ref.property_address_encrypted) : null
            const searchResult = await apex27Fetch<any[]>(config.apiKey, '/listings', {
              transactionType: 'rent', postalCode: refPostcode, pageSize: 25
            })
            if (searchResult.success && Array.isArray(searchResult.data) && searchResult.data.length > 0) {
              if (searchResult.data.length === 1) {
                resolvedListingId = String(searchResult.data[0].id)
              } else if (refAddr) {
                const normRefAddr = normalizeAddressLine(refAddr)
                for (const l of searchResult.data) {
                  if (l.address1 && normalizeAddressLine(l.address1) === normRefAddr) {
                    resolvedListingId = String(l.id)
                    break
                  }
                }
              }
              if (!resolvedListingId) resolvedListingId = String(searchResult.data[0].id)
            }
          }

          if (resolvedListingId) {
            console.log(`[Apex27] Matched reference to Apex27 listing ${resolvedListingId} via fuzzy search`)
          }
        }
      }
    } else {
      return res.status(400).json({ error: 'Invalid sourceType. Must be tenancy_document, property_document, or reference_report' })
    }

    // ---- Resolve listing ID via property (3-level fallback) ----

    if (!resolvedListingId && propertyId) {
      resolvedListingId = await resolveApex27ListingId(propertyId, companyData.companyId, config.apiKey)
    }

    if (!resolvedListingId) {
      return res.status(400).json({ error: 'Could not find a matching Apex27 listing for this property. Link the property via Initial Sync first.' })
    }

    // ---- Push the document ----

    let finalUrl = documentUrl
    if (!finalUrl && documentPath) {
      // Property documents use 'property-documents' bucket, others use 'documents'
      const bucket = (sourceType === 'property_document') ? 'property-documents' : 'documents'
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(documentPath, 3600)

      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.error(`[Apex27] Error generating signed URL (bucket: ${bucket}):`, signedUrlError)
        return res.status(500).json({ error: 'Failed to generate document URL' })
      }
      finalUrl = signedUrlData.signedUrl
    }

    const pushResult = await pushDocument(config.apiKey, {
      listingId: resolvedListingId,
      name: documentName,
      url: finalUrl
    })

    // Log
    await supabase
      .from('apex27_document_pushes')
      .insert({
        company_id: companyData.companyId,
        source_type: sourceType,
        source_id: sourceId,
        apex27_listing_id: resolvedListingId,
        document_name: documentName,
        document_url: finalUrl,
        status: pushResult.success ? 'success' : 'failed',
        apex27_response: pushResult.response || pushResult.error,
        pushed_by: companyData.userId
      })

    if (!pushResult.success) {
      return res.status(500).json({ error: pushResult.error })
    }

    res.json({ success: true, message: 'Document pushed to Apex27 successfully' })
  } catch (error) {
    console.error('[Apex27] Error pushing document:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

// ============================================================================
// TENANCY SUMMARY
// ============================================================================

/**
 * GET /api/apex27/tenancy-summary/:tenancyId
 * Generate a comprehensive tenancy summary document (HTML)
 */
router.get('/tenancy-summary/:tenancyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyData = await getUserCompanyAndRole(req)

    if (!companyData) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const result = await generateTenancySummary(req.params.tenancyId, companyData.companyId)

    if (!result.success) {
      return res.status(500).json({ error: result.error })
    }

    res.json({ success: true, html: result.html, title: result.title })
  } catch (error) {
    console.error('[Apex27] Error generating tenancy summary:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

/**
 * POST /api/apex27/tenancy-summary/:tenancyId/push
 * Generate tenancy summary and push to Apex27
 */
router.post('/tenancy-summary/:tenancyId/push', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyData = await getUserCompanyAndRole(req)

    if (!companyData) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const config = await getCompanyApex27Config(companyData.companyId)
    if (!config) {
      return res.status(400).json({ error: 'Apex27 is not configured' })
    }

    // Generate summary
    const summary = await generateTenancySummary(req.params.tenancyId, companyData.companyId)
    if (!summary.success || !summary.html) {
      return res.status(500).json({ error: summary.error || 'Failed to generate summary' })
    }

    // Store summary as a file in Supabase Storage
    const fileName = `tenancy-summaries/${companyData.companyId}/${req.params.tenancyId}-${Date.now()}.html`
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, Buffer.from(summary.html), {
        contentType: 'text/html',
        upsert: true
      })

    if (uploadError) {
      console.error('[Apex27] Error uploading summary:', uploadError)
      return res.status(500).json({ error: 'Failed to store summary document' })
    }

    // Generate signed URL
    const { data: signedUrlData } = await supabase.storage
      .from('documents')
      .createSignedUrl(fileName, 3600)

    if (!signedUrlData?.signedUrl) {
      return res.status(500).json({ error: 'Failed to generate document URL' })
    }

    // Resolve Apex27 listing ID with fuzzy fallback
    const { data: tenancy } = await supabase
      .from('tenancies')
      .select('property_id')
      .eq('id', req.params.tenancyId)
      .single()

    const listingId = tenancy?.property_id
      ? await resolveApex27ListingId(tenancy.property_id, companyData.companyId, config.apiKey)
      : null

    if (!listingId) {
      return res.status(400).json({ error: 'Could not find a matching Apex27 listing for this property.' })
    }

    // Push to Apex27
    const pushResult = await pushDocument(config.apiKey, {
      listingId,
      name: summary.title || 'Tenancy Summary',
      url: signedUrlData.signedUrl
    })

    // Log
    await supabase
      .from('apex27_document_pushes')
      .insert({
        company_id: companyData.companyId,
        source_type: 'tenancy_summary',
        source_id: req.params.tenancyId,
        apex27_listing_id: listingId || null,
        document_name: summary.title || 'Tenancy Summary',
        document_url: signedUrlData.signedUrl,
        status: pushResult.success ? 'success' : 'failed',
        apex27_response: pushResult.response || pushResult.error,
        pushed_by: companyData.userId
      })

    if (!pushResult.success) {
      return res.status(500).json({ error: pushResult.error })
    }

    res.json({ success: true, message: 'Tenancy summary pushed to Apex27' })
  } catch (error) {
    console.error('[Apex27] Error pushing tenancy summary:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
  }
})

export default router

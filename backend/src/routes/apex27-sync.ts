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
 * POST /api/apex27/documents/push
 * Push a document to Apex27
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

    // Look up the document and auto-resolve apex27_listing_id
    let documentName = ''
    let documentPath = ''
    let resolvedListingId = apex27ListingId || null

    if (sourceType === 'tenancy_document') {
      const { data: doc } = await supabase
        .from('tenancy_documents')
        .select('name, file_path, tenancy_id')
        .eq('id', sourceId)
        .single()

      if (!doc) {
        return res.status(404).json({ error: 'Document not found' })
      }

      documentName = doc.name
      documentPath = doc.file_path

      // Auto-resolve apex27_listing_id from the tenancy's property
      if (!resolvedListingId && doc.tenancy_id) {
        const { data: tenancy } = await supabase
          .from('tenancies')
          .select('property_id')
          .eq('id', doc.tenancy_id)
          .single()

        if (tenancy?.property_id) {
          const { data: property } = await supabase
            .from('properties')
            .select('apex27_listing_id')
            .eq('id', tenancy.property_id)
            .single()

          resolvedListingId = property?.apex27_listing_id || null
        }
      }
    } else if (sourceType === 'reference_report') {
      const { data: ref } = await supabase
        .from('tenant_references_v2')
        .select('id, report_pdf_url, linked_property_id, property_address_encrypted, property_postcode_encrypted')
        .eq('id', sourceId)
        .single()

      if (!ref) {
        return res.status(404).json({ error: 'Reference not found' })
      }

      if (!ref.report_pdf_url) {
        return res.status(400).json({ error: 'Reference report has not been generated yet. Generate the report first.' })
      }

      documentName = `Reference Report - ${sourceId.substring(0, 8)}`

      // 1. Try to resolve via linked property's apex27_listing_id
      if (!resolvedListingId && ref.linked_property_id) {
        const { data: property } = await supabase
          .from('properties')
          .select('apex27_listing_id')
          .eq('id', ref.linked_property_id)
          .single()

        resolvedListingId = property?.apex27_listing_id || null
      }

      // 2. Fallback: search all company properties by postcode for an apex27 link
      if (!resolvedListingId && ref.property_postcode_encrypted) {
        const refPostcode = decrypt(ref.property_postcode_encrypted)
        if (refPostcode) {
          const normPC = normalizePostcode(refPostcode)
          const { data: matchedProps } = await supabase
            .from('properties')
            .select('id, apex27_listing_id, address_line1_encrypted')
            .eq('company_id', companyData.companyId)
            .eq('postcode', normPC)
            .not('apex27_listing_id', 'is', null)

          if (matchedProps && matchedProps.length > 0) {
            // If only one match, use it
            if (matchedProps.length === 1) {
              resolvedListingId = matchedProps[0].apex27_listing_id
            } else {
              // Multiple matches — fuzzy match by address
              const refAddr = ref.property_address_encrypted ? decrypt(ref.property_address_encrypted) : null
              if (refAddr) {
                const normRefAddr = normalizeAddressLine(refAddr)
                for (const prop of matchedProps) {
                  const propAddr = prop.address_line1_encrypted ? decrypt(prop.address_line1_encrypted) : null
                  if (propAddr && normalizeAddressLine(propAddr) === normRefAddr) {
                    resolvedListingId = prop.apex27_listing_id
                    break
                  }
                }
              }
              // Still no match — use first result as best guess
              if (!resolvedListingId) {
                resolvedListingId = matchedProps[0].apex27_listing_id
              }
            }
            console.log(`[Apex27] Fuzzy-matched reference property to listing ${resolvedListingId}`)
          }
        }
      }

      // 3. Last resort: search Apex27 directly by postcode
      if (!resolvedListingId && ref.property_postcode_encrypted) {
        const refPostcode = decrypt(ref.property_postcode_encrypted)
        const refAddr = ref.property_address_encrypted ? decrypt(ref.property_address_encrypted) : null
        if (refPostcode) {
          const searchResult = await apex27Fetch<any[]>(config.apiKey, '/listings', {
            transactionType: 'rent',
            postalCode: refPostcode,
            pageSize: 25
          })

          if (searchResult.success && Array.isArray(searchResult.data)) {
            const listings = searchResult.data
            if (listings.length === 1) {
              resolvedListingId = String(listings[0].id)
            } else if (listings.length > 1 && refAddr) {
              const normRefAddr = normalizeAddressLine(refAddr)
              for (const l of listings) {
                if (l.address1 && normalizeAddressLine(l.address1) === normRefAddr) {
                  resolvedListingId = String(l.id)
                  break
                }
              }
              if (!resolvedListingId) {
                resolvedListingId = String(listings[0].id)
              }
            }
            if (resolvedListingId) {
              console.log(`[Apex27] Matched reference to Apex27 listing ${resolvedListingId} via API search`)
            }
          }
        }
      }

      if (!resolvedListingId) {
        return res.status(400).json({ error: 'Could not find a matching Apex27 listing for this property. Link the property via Initial Sync first.' })
      }

      // Push directly — report_pdf_url is already a public URL
      const pushResult = await pushDocument(config.apiKey, {
        listingId: resolvedListingId,
        name: documentName,
        url: ref.report_pdf_url
      })

      // Log and return early
      await supabase
        .from('apex27_document_pushes')
        .insert({
          company_id: companyData.companyId,
          source_type: sourceType,
          source_id: sourceId,
          apex27_listing_id: resolvedListingId || null,
          document_name: documentName,
          document_url: ref.report_pdf_url,
          status: pushResult.success ? 'success' : 'failed',
          apex27_response: pushResult.response || pushResult.error,
          pushed_by: companyData.userId
        })

      if (!pushResult.success) {
        return res.status(500).json({ error: pushResult.error })
      }

      return res.json({ success: true, message: 'Reference report pushed to Apex27' })
    } else {
      return res.status(400).json({ error: 'Invalid sourceType. Must be tenancy_document or reference_report' })
    }

    if (!resolvedListingId) {
      return res.status(400).json({ error: 'This property is not linked to Apex27. Run an Initial Sync first to link properties.' })
    }

    // Generate a signed URL for the document (1 hour expiry)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(documentPath, 3600)

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('[Apex27] Error generating signed URL:', signedUrlError)
      return res.status(500).json({ error: 'Failed to generate document URL' })
    }

    // Push to Apex27
    const pushResult = await pushDocument(config.apiKey, {
      listingId: resolvedListingId,
      name: documentName,
      url: signedUrlData.signedUrl
    })

    // Log the push
    await supabase
      .from('apex27_document_pushes')
      .insert({
        company_id: companyData.companyId,
        source_type: sourceType,
        source_id: sourceId,
        apex27_listing_id: resolvedListingId || null,
        document_name: documentName,
        document_url: signedUrlData.signedUrl,
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

    // Get property's apex27_listing_id
    const { data: tenancy } = await supabase
      .from('tenancies')
      .select('property_id')
      .eq('id', req.params.tenancyId)
      .single()

    let listingId: string | undefined
    if (tenancy?.property_id) {
      const { data: property } = await supabase
        .from('properties')
        .select('apex27_listing_id')
        .eq('id', tenancy.property_id)
        .single()
      listingId = property?.apex27_listing_id || undefined
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

/**
 * V2 Sections Routes (Staff)
 *
 * Endpoints for managing verification sections and queues.
 * Used by staff dashboard for section-by-section verification.
 */

import { Router } from 'express'
import { authenticateStaff, StaffAuthRequest } from '../../middleware/staffAuth'
import { supabase } from '../../config/supabase'
import { decrypt, encrypt, generateToken, hash } from '../../services/encryption'
import {
  getQueueCounts,
  getSectionsInQueue,
  getSection,
  claimSection,
  releaseSection,
  submitSectionDecision
} from '../../services/v2/sectionServiceV2'
import { getReference, editReferenceField } from '../../services/v2/referenceServiceV2'
import { getVerbalReferenceForSection } from '../../services/v2/verbalReferenceService'
import { reactivateOrCreateChaseItem } from '../../services/v2/chaseServiceV2'
import { logActivity } from '../../services/v2/activityServiceV2'
import { loadEmailTemplate, sendEmail } from '../../services/emailService'
import { getV2FrontendUrl } from '../../utils/frontendUrl'
import { V2SectionType, V2SectionDecision, TENANT_SECTIONS, GUARANTOR_SECTIONS } from '../../services/v2/types'

const router = Router()

// ============================================================================
// QUEUE DASHBOARD
// ============================================================================

/**
 * Get comprehensive stats for V2 dashboard
 */
router.get('/stats', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const staffUser = req.staffUser

    // Initialize stats object
    const stats: any = {
      sections: {
        IDENTITY: { ready: 0, in_progress: 0 },
        RTR: { ready: 0, in_progress: 0 },
        INCOME: { ready: 0, in_progress: 0 },
        RESIDENTIAL: { ready: 0, in_progress: 0 },
        CREDIT: { ready: 0, in_progress: 0 },
        AML: { ready: 0, in_progress: 0 }
      },
      chase: { pending: 0, overdue: 0 },
      finalReview: { pending: 0, in_progress: 0 },
      groupAssessment: { pending: 0, in_progress: 0 },
      myItems: 0
    }

    // Get section counts by type and status
    const { data: sectionCounts } = await supabase
      .from('reference_sections_v2')
      .select('section_type, queue_status')
      .in('queue_status', ['READY', 'IN_PROGRESS'])

    if (sectionCounts) {
      for (const row of sectionCounts) {
        const sectionType = row.section_type as V2SectionType
        if (stats.sections[sectionType]) {
          if (row.queue_status === 'READY') {
            stats.sections[sectionType].ready++
          } else if (row.queue_status === 'IN_PROGRESS') {
            stats.sections[sectionType].in_progress++
          }
        }
      }
    }

    // Get chase queue stats
    const { count: chaseCount } = await supabase
      .from('chase_items_v2')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'IN_CHASE_QUEUE')

    stats.chase.pending = chaseCount || 0

    // Get overdue chase items (next_chase_due in the past)
    const { count: overdueCount } = await supabase
      .from('chase_items_v2')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'IN_CHASE_QUEUE')
      .lt('next_chase_due', new Date().toISOString())

    stats.chase.overdue = overdueCount || 0

    // Get final review stats
    const { data: finalReviewData } = await supabase
      .from('work_items_v2')
      .select('status')
      .eq('work_type', 'FINAL_REVIEW')
      .in('status', ['AVAILABLE', 'IN_PROGRESS'])

    if (finalReviewData) {
      stats.finalReview.pending = finalReviewData.filter(r => r.status === 'AVAILABLE').length
      stats.finalReview.in_progress = finalReviewData.filter(r => r.status === 'IN_PROGRESS').length
    }

    // Get group assessment stats
    const { data: groupAssessmentData } = await supabase
      .from('work_items_v2')
      .select('status')
      .eq('work_type', 'GROUP_ASSESSMENT')
      .in('status', ['AVAILABLE', 'IN_PROGRESS'])

    if (groupAssessmentData) {
      stats.groupAssessment.pending = groupAssessmentData.filter((r: any) => r.status === 'AVAILABLE').length
      stats.groupAssessment.in_progress = groupAssessmentData.filter((r: any) => r.status === 'IN_PROGRESS').length
    }

    // Get my items count
    if (staffUser) {
      const { count: myCount } = await supabase
        .from('reference_sections_v2')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', staffUser.id)
        .eq('queue_status', 'IN_PROGRESS')

      stats.myItems = myCount || 0
    }

    res.json({ stats })
  } catch (error: any) {
    console.error('[V2 Sections] Error getting stats:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Debug: Get all sections + work items for a reference to diagnose final review issues
 * Accepts UUID or reference_number (e.g. PG-2603-0001)
 */
router.get('/debug/:referenceId', async (req, res) => {
  try {
    let referenceId = req.params.referenceId

    // If it looks like a reference number (not UUID), look it up
    if (referenceId.startsWith('PG-')) {
      const { data: ref } = await supabase
        .from('tenant_references_v2')
        .select('id')
        .eq('reference_number', referenceId)
        .single()
      if (!ref) return res.status(404).json({ error: 'Reference not found for number: ' + referenceId })
      referenceId = ref.id
    }

    const { data: sections } = await supabase
      .from('reference_sections_v2')
      .select('id, section_type, queue_status, decision, condition_text, completed_at')
      .eq('reference_id', referenceId)
      .order('section_order')

    const { data: workItems } = await supabase
      .from('work_items_v2')
      .select('id, work_type, status, reference_id')
      .eq('reference_id', referenceId)

    const { data: reference, error: refError } = await supabase
      .from('tenant_references_v2')
      .select('id, status, reference_number, is_group_parent, parent_reference_id')
      .eq('id', referenceId)
      .maybeSingle()

    if (refError) {
      console.error('[Debug] Reference query error:', refError)
    }

    const allHaveDecisions = sections?.every(s => s.decision !== null) || false
    const hasFinalReviewWorkItem = workItems?.some(w => w.work_type === 'FINAL_REVIEW') || false

    res.json({
      _resolvedReferenceId: referenceId,
      _refError: refError?.message || null,
      reference,
      sections,
      workItems,
      analysis: {
        totalSections: sections?.length || 0,
        sectionsWithDecisions: sections?.filter(s => s.decision !== null).length || 0,
        sectionsWithoutDecisions: sections?.filter(s => s.decision === null).map(s => s.section_type) || [],
        allHaveDecisions,
        hasFinalReviewWorkItem,
        shouldTriggerFinalReview: allHaveDecisions && !hasFinalReviewWorkItem
      }
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * Force trigger final review check for a reference
 * Accepts UUID or reference_number (e.g. PG-2603-0001)
 */
router.post('/trigger-final-review/:referenceId', async (req, res) => {
  try {
    let referenceId = req.params.referenceId

    if (referenceId.startsWith('PG-')) {
      const { data: ref } = await supabase
        .from('tenant_references_v2')
        .select('id')
        .eq('reference_number', referenceId)
        .single()
      if (!ref) return res.status(404).json({ error: 'Reference not found' })
      referenceId = ref.id
    }

    // Direct update — no fancy logic, just set it
    const { error: updateErr } = await supabase
      .from('tenant_references_v2')
      .update({ status: 'IN_REVIEW', updated_at: new Date().toISOString() })
      .eq('id', referenceId)

    if (updateErr) {
      return res.json({ triggered: false, error: updateErr.message, referenceId })
    }

    // Verify it stuck
    const { data: check } = await supabase
      .from('tenant_references_v2')
      .select('status')
      .eq('id', referenceId)
      .maybeSingle()

    res.json({ triggered: true, referenceId, newStatus: check?.status, updateError: null })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get queue items for a specific section type (frontend query param style)
 */
router.get('/queue', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { sectionType, limit } = req.query

    // Validate section type (include both tenant and guarantor section types)
    const validTypes: V2SectionType[] = [...new Set([...TENANT_SECTIONS, ...GUARANTOR_SECTIONS])]
    if (!sectionType || !validTypes.includes(sectionType as V2SectionType)) {
      return res.status(400).json({ error: 'Invalid or missing sectionType' })
    }

    const sections = await getSectionsInQueue(
      sectionType as V2SectionType,
      limit ? parseInt(limit as string) : 50
    ) as any[] | null

    if (!sections) {
      return res.json({ items: [] })
    }

    // Filter out guarantor sections that shouldn't exist (RESIDENTIAL, RTR)
    const guarantorExcludedTypes = ['RESIDENTIAL', 'RTR']
    const filteredSections = guarantorExcludedTypes.includes(sectionType as string)
      ? sections.filter((s: any) => !s.reference?.is_guarantor)
      : sections

    // Get company names for each section
    const companyIds = [...new Set(filteredSections.map((s: any) => s.reference?.company_id).filter(Boolean))]
    const { data: companies } = await supabase
      .from('companies')
      .select('*')
      .in('id', companyIds)

    const companyMap = new Map((companies || []).map((c: any) => [c.id, c.name || (c.name_encrypted ? decrypt(c.name_encrypted) : null) || c.company_name || 'Unknown']))

    // Get staff names for claimed sections
    const staffIds = [...new Set(filteredSections.filter(s => s.assigned_to).map(s => s.assigned_to))]
    const { data: staffUsers } = staffIds.length > 0 ? await supabase
      .from('staff_users')
      .select('id, name')
      .in('id', staffIds) : { data: [] }

    const staffMap = new Map(staffUsers?.map(s => [s.id, s.name]) || [])

    // Transform to frontend format
    const items = filteredSections.map((section: any) => ({
      id: section.id,
      section_id: section.id,
      section_type: section.section_type,
      queue_status: section.queue_status,
      reference_id: section.reference_id,
      tenant_name: section.reference
        ? `${decrypt(section.reference.tenant_first_name_encrypted)} ${decrypt(section.reference.tenant_last_name_encrypted)}`
        : 'Unknown',
      property_address: section.reference
        ? decrypt(section.reference.property_address_encrypted)
        : 'Unknown',
      company_name: companyMap.get(section.reference?.company_id) || 'Unknown',
      rent_share: section.reference?.rent_share || null,
      monthly_rent: section.reference?.monthly_rent || null,
      is_guarantor: section.reference?.is_guarantor || false,
      claimed_by: section.assigned_to,
      claimed_by_name: staffMap.get(section.assigned_to) || null,
      claimed_at: section.assigned_at,
      hours_in_queue: section.queue_entered_at
        ? Math.round((Date.now() - new Date(section.queue_entered_at).getTime()) / (1000 * 60 * 60))
        : 0,
      urgency: section.queue_entered_at && (Date.now() - new Date(section.queue_entered_at).getTime()) > 48 * 60 * 60 * 1000
        ? 'URGENT'
        : section.queue_entered_at && (Date.now() - new Date(section.queue_entered_at).getTime()) > 24 * 60 * 60 * 1000
        ? 'WARNING'
        : 'NORMAL',
      created_at: section.created_at
    }))

    res.json({ items })
  } catch (error: any) {
    console.error('[V2 Sections] Error getting queue:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get my active tasks (claimed sections)
 */
router.get('/my-tasks', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const staffUser = req.staffUser

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' })
    }

    // Get all sections claimed by this staff member
    const { data: sections, error } = await supabase
      .from('reference_sections_v2')
      .select(`
        *,
        reference:tenant_references_v2!reference_sections_v2_reference_id_fkey (
          id,
          company_id,
          tenant_first_name_encrypted,
          tenant_last_name_encrypted,
          property_address_encrypted,
          is_guarantor
        )
      `)
      .eq('assigned_to', staffUser.id)
      .eq('queue_status', 'IN_PROGRESS')

    if (error) {
      throw error
    }

    // Get company names
    const companyIds = [...new Set(sections?.map(s => s.reference?.company_id).filter(Boolean))]
    const { data: companies } = companyIds.length > 0 ? await supabase
      .from('companies')
      .select('*')
      .in('id', companyIds) : { data: [] }

    const companyMap = new Map((companies || []).map((c: any) => [c.id, c.name || (c.name_encrypted ? decrypt(c.name_encrypted) : null) || c.company_name || 'Unknown']))

    // Transform to frontend format
    const items = (sections || []).map((section: any) => ({
      id: section.id,
      section_id: section.id,
      section_type: section.section_type,
      reference_id: section.reference_id,
      work_type: 'SECTION_REVIEW',
      tenant_name: section.reference
        ? `${decrypt(section.reference.tenant_first_name_encrypted)} ${decrypt(section.reference.tenant_last_name_encrypted)}`
        : 'Unknown',
      property_address: section.reference
        ? decrypt(section.reference.property_address_encrypted)
        : 'Unknown',
      company_name: companyMap.get(section.reference?.company_id) || 'Unknown',
      is_guarantor: section.reference?.is_guarantor || false,
      claimed_at: section.assigned_at,
      created_at: section.created_at
    }))

    // Also get final review items claimed by this staff member
    const { data: finalReviews } = await supabase
      .from('work_items_v2')
      .select(`
        *,
        reference:tenant_references_v2!work_items_v2_reference_id_fkey (
          id,
          company_id,
          tenant_first_name_encrypted,
          tenant_last_name_encrypted,
          property_address_encrypted
        )
      `)
      .eq('assigned_to', staffUser.id)
      .eq('work_type', 'FINAL_REVIEW')
      .eq('status', 'IN_PROGRESS')

    if (finalReviews) {
      for (const review of finalReviews) {
        items.push({
          id: review.id,
          section_id: null,
          section_type: null,
          reference_id: review.reference_id,
          work_type: 'FINAL_REVIEW',
          tenant_name: review.reference
            ? `${decrypt(review.reference.tenant_first_name_encrypted)} ${decrypt(review.reference.tenant_last_name_encrypted)}`
            : 'Unknown',
          property_address: review.reference
            ? decrypt(review.reference.property_address_encrypted)
            : 'Unknown',
          company_name: companyMap.get(review.reference?.company_id) || 'Unknown',
          is_guarantor: false,
          claimed_at: review.assigned_at,
          created_at: review.created_at
        })
      }
    }

    res.json({ items })
  } catch (error: any) {
    console.error('[V2 Sections] Error getting my tasks:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get queue counts for dashboard tiles (legacy endpoint)
 */
router.get('/queues', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const counts = await getQueueCounts()
    res.json({ counts })
  } catch (error: any) {
    console.error('[V2 Sections] Error getting queue counts:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get items in a specific queue
 */
router.get('/queues/:type', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { type } = req.params
    const { limit } = req.query

    // Validate section type
    const validTypes: V2SectionType[] = ['IDENTITY', 'RTR', 'INCOME', 'RESIDENTIAL', 'CREDIT', 'AML']
    if (!validTypes.includes(type as V2SectionType)) {
      return res.status(400).json({ error: 'Invalid queue type' })
    }

    const sections = await getSectionsInQueue(
      type as V2SectionType,
      limit ? parseInt(limit as string) : 50
    )

    if (!sections) {
      return res.status(500).json({ error: 'Failed to get queue' })
    }

    // Decrypt reference data for display
    const enrichedSections = sections.map((section: any) => ({
      ...section,
      reference: section.reference ? {
        ...section.reference,
        tenant_first_name: decrypt(section.reference.tenant_first_name_encrypted),
        tenant_last_name: decrypt(section.reference.tenant_last_name_encrypted),
        property_address: decrypt(section.reference.property_address_encrypted)
      } : null
    }))

    res.json({ sections: enrichedSections })
  } catch (error: any) {
    console.error('[V2 Sections] Error getting queue:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// SECTION OPERATIONS
// ============================================================================

/**
 * Get section details for review
 */
router.get('/:id', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params

    const section = await getSection(id)
    if (!section) {
      return res.status(404).json({ error: 'Section not found' })
    }

    // Get reference details
    const reference = await getReference(section.reference_id)
    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Check for verbal reference
    const verbalReference = await getVerbalReferenceForSection(id)

    // Decrypt form_data for the relevant section
    const formData = reference.form_data || {}
    const sectionFormDataKey: Record<string, string> = {
      IDENTITY: 'identity', RTR: 'rtr', INCOME: 'income',
      RESIDENTIAL: 'residential', ADDRESS: 'residential', CREDIT: 'credit', AML: 'aml'
    }
    const sectionKey = sectionFormDataKey[section.section_type] || section.section_type.toLowerCase()
    const sectionFormData: any = formData[sectionKey] || {}

    // Decrypt specific fields in form data
    if (sectionFormData.phone) try { sectionFormData.phone = decrypt(sectionFormData.phone) } catch {}
    if (sectionFormData.dateOfBirth) try { sectionFormData.dateOfBirth = decrypt(sectionFormData.dateOfBirth) } catch {}
    if (sectionFormData.shareCode) try { sectionFormData.shareCode = decrypt(sectionFormData.shareCode) } catch {}
    if (sectionFormData.employerAddress) try { sectionFormData.employerAddress = decrypt(sectionFormData.employerAddress) } catch {}

    // Get evidence files for this section
    const { data: evidenceFiles } = await supabase
      .from('evidence_v2')
      .select('id, section_type, evidence_type, file_path, file_name, file_type, created_at')
      .eq('reference_id', section.reference_id)
      .eq('section_type', section.section_type)
      .order('created_at', { ascending: false })

    // Build evidence map for frontend
    const evidence: Record<string, any> = {}
    for (const file of (evidenceFiles || [])) {
      const key = file.file_name?.includes('selfie') ? 'selfie'
        : file.file_name?.includes('id') || file.evidence_type === 'id_document' ? 'id_document'
        : file.section_type === 'RTR' ? 'rtr_document'
        : file.section_type === 'INCOME' ? 'payslips'
        : (file.section_type === 'RESIDENTIAL' || file.section_type === 'ADDRESS') ? 'proof_of_address'
        : 'document'

      // Get signed URL (1 hour expiry)
      const { data: urlData } = await supabase.storage.from('reference-documents').createSignedUrl(file.file_path, 3600)

      evidence[key] = {
        url: urlData?.signedUrl || file.file_path,
        filename: file.file_name,
        type: file.file_type,
        uploadedAt: file.created_at
      }
    }

    // Re-sign any Supabase storage URL to get a fresh authenticated URL
    async function resignUrl(storedUrl: string): Promise<string> {
      if (!storedUrl) return storedUrl
      // Extract the file path from a Supabase public URL
      const match = storedUrl.match(/\/storage\/v1\/object\/public\/reference-documents\/(.+)/)
      if (match) {
        const filePath = decodeURIComponent(match[1])
        const { data } = await supabase.storage.from('reference-documents').createSignedUrl(filePath, 3600)
        return data?.signedUrl || storedUrl
      }
      return storedUrl
    }

    // Also extract document URLs from form_data (re-sign if they're Supabase URLs)
    if (sectionFormData.selfieUrl) evidence.selfie = { url: await resignUrl(sectionFormData.selfieUrl), filename: 'Selfie' }
    if (sectionFormData.idDocumentUrl) evidence.id_document = { url: await resignUrl(sectionFormData.idDocumentUrl), filename: 'ID Document' }

    // Fallback: If no id_document from form_data, check Identity section form_data and evidence_v2
    if (!evidence.id_document && section.section_type === 'IDENTITY') {
      const identityFormData: any = formData.identity || {}
      if (identityFormData.idDocumentUrl) {
        evidence.id_document = { url: await resignUrl(identityFormData.idDocumentUrl), filename: 'ID Document' }
      }
      // Also check evidence_v2 table
      if (!evidence.id_document) {
        const { data: idEvidence } = await supabase
          .from('evidence_v2')
          .select('file_path, file_name, file_type')
          .eq('reference_id', section.reference_id)
          .eq('section_type', 'IDENTITY')
          .or('evidence_type.eq.id_document,evidence_type.eq.document')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (idEvidence) {
          const { data: urlData } = await supabase.storage.from('reference-documents').createSignedUrl(idEvidence.file_path, 3600)
          evidence.id_document = { url: urlData?.signedUrl || idEvidence.file_path, filename: idEvidence.file_name || 'ID Document' }
        }
      }
    }
    if (sectionFormData.passportDocUrl) evidence.rtr_document = { url: await resignUrl(sectionFormData.passportDocUrl), filename: 'Passport' }
    if (sectionFormData.alternativeDocUrl) evidence.rtr_document = { url: await resignUrl(sectionFormData.alternativeDocUrl), filename: 'Alternative ID' }
    if (sectionFormData.proofOfAddressUrl) evidence.proof_of_address = { url: await resignUrl(sectionFormData.proofOfAddressUrl), filename: 'Proof of Address' }
    if (sectionFormData.payslipsUrl) evidence.payslips = { url: await resignUrl(sectionFormData.payslipsUrl), filename: 'Payslips' }
    if (sectionFormData.taxReturnUrl) evidence.tax_return = { url: await resignUrl(sectionFormData.taxReturnUrl), filename: 'Tax Return' }

    // Override with newer issue_document evidence — tenant's issue response takes priority over original form_data
    const { data: issueDocuments } = await supabase
      .from('evidence_v2')
      .select('id, evidence_type, file_path, file_name, notes, created_at')
      .eq('reference_id', section.reference_id)
      .eq('section_type', section.section_type)
      .in('evidence_type', ['issue_document', 'tenant_response'])
      .order('created_at', { ascending: false })

    if (issueDocuments && issueDocuments.length > 0) {
      for (const issueDoc of issueDocuments) {
        if (issueDoc.evidence_type === 'issue_document' && issueDoc.file_path) {
          const { data: signedUrl } = await supabase.storage.from('reference-documents').createSignedUrl(issueDoc.file_path, 3600)
          const url = signedUrl?.signedUrl || issueDoc.file_path

          if (section.section_type === 'RTR') {
            evidence.rtr_replacement_document = { url, filename: issueDoc.file_name || 'Updated RTR Document', isReplacement: true }
            // Also set as main rtr_document so it's the primary display
            evidence.rtr_document = { url, filename: issueDoc.file_name || 'Updated RTR Document', isReplacement: true }
          } else if (section.section_type === 'IDENTITY') {
            evidence.id_document = { url, filename: issueDoc.file_name || 'Updated ID Document', isReplacement: true }
          } else if (section.section_type === 'INCOME') {
            evidence.payslips = { url, filename: issueDoc.file_name || 'Updated Income Evidence', isReplacement: true }
          } else if (section.section_type === 'RESIDENTIAL' || section.section_type === 'ADDRESS') {
            evidence.proof_of_address = { url, filename: issueDoc.file_name || 'Updated Address Evidence', isReplacement: true }
          }
        }
      }
    }

    // For RTR sections: include DOB from identity form_data for RTR verification
    if (section.section_type === 'RTR') {
      const identityDob = (formData.identity || {} as any).dateOfBirth
      if (identityDob) {
        try { sectionFormData.dateOfBirth = decrypt(identityDob) } catch { sectionFormData.dateOfBirth = identityDob }
      }
    }

    // For RTR sections: also pull the passport/ID from the Identity section if not already present
    if (section.section_type === 'RTR') {
      // Check Identity form_data from the main reference form_data
      const identityFormData: any = formData.identity || {}

      // Also check Identity section's evidence_v2 records
      const { data: identityEvidence } = await supabase
        .from('evidence_v2')
        .select('id, evidence_type, file_path, file_name, file_type')
        .eq('reference_id', section.reference_id)
        .eq('section_type', 'IDENTITY')

      for (const ev of (identityEvidence || [])) {
        const { data: urlData } = await supabase.storage.from('reference-documents').createSignedUrl(ev.file_path, 3600)
        const url = urlData?.signedUrl || ev.file_path

        if (ev.evidence_type === 'id_document' || ev.file_name?.toLowerCase().includes('id')) {
          if (!evidence.id_document_cross_ref) {
            evidence.id_document_cross_ref = { url, filename: ev.file_name || 'ID Document (from ID section)' }
          }
        }
        if (ev.evidence_type === 'passport' || ev.file_name?.toLowerCase().includes('passport')) {
          if (!evidence.passport) {
            evidence.passport = { url, filename: ev.file_name || 'Passport' }
          }
        }
      }

      // Fall back to form_data URLs
      if (!evidence.passport && identityFormData.passportDocUrl) {
        evidence.passport = { url: identityFormData.passportDocUrl, filename: 'Passport (from ID)' }
      }
      if (!evidence.id_document_cross_ref && identityFormData.idDocumentUrl) {
        evidence.id_document_cross_ref = { url: identityFormData.idDocumentUrl, filename: 'ID Document (from ID section)' }
      }

      // Also check section_data on the Identity section record (legacy path)
      if (!evidence.passport || !evidence.id_document_cross_ref) {
        const { data: identitySection } = await supabase
          .from('reference_sections_v2')
          .select('section_data')
          .eq('reference_id', section.reference_id)
          .eq('section_type', 'IDENTITY')
          .maybeSingle()

        const sectionIdentityData: any = identitySection?.section_data?.form_data || identitySection?.section_data || {}
        if (!evidence.passport && sectionIdentityData.passportDocUrl) {
          evidence.passport = { url: sectionIdentityData.passportDocUrl, filename: 'Passport (from ID)' }
        }
        if (!evidence.id_document_cross_ref && sectionIdentityData.idDocumentUrl) {
          evidence.id_document_cross_ref = { url: sectionIdentityData.idDocumentUrl, filename: 'ID Document (from ID section)' }
        }
      }
    }

    // Get referee form submissions for INCOME (employer/accountant) and RESIDENTIAL (landlord)
    let refereeFormData: any = null
    if (section.section_type === 'INCOME' || section.section_type === 'RESIDENTIAL') {
      const refereeType = section.section_type === 'INCOME' ? ['EMPLOYER', 'ACCOUNTANT'] : ['LANDLORD']
      const { data: referees } = await supabase
        .from('referees_v2')
        .select('id, referee_type, referee_name, form_data, completed_at')
        .eq('reference_id', section.reference_id)
        .in('referee_type', refereeType)

      if (referees && referees.length > 0) {
        refereeFormData = referees.map(r => ({
          id: r.id,
          referee_type: r.referee_type,
          referee_name: r.referee_name,
          form_data: r.form_data,
          completed_at: r.completed_at
        }))
      }
    }

    // Get credit check(s) if CREDIT section
    let creditCheck = null
    let creditRequestData: any = null
    let allCreditChecks: any[] = []
    let proofOfAddressForCredit: any = null
    if (section.section_type === 'CREDIT') {
      const { data: credits } = await supabase
        .from('creditsafe_verifications_v2')
        .select('*')
        .eq('reference_id', section.reference_id)
        .order('created_at', { ascending: false })

      if (credits && credits.length > 0) {
        allCreditChecks = credits.map(credit => {
          let responseData: any = null
          let requestData: any = null
          if (credit.response_data_encrypted) {
            try { responseData = JSON.parse(decrypt(credit.response_data_encrypted) || '{}') } catch {}
          }
          if (credit.request_data_encrypted) {
            try { requestData = JSON.parse(decrypt(credit.request_data_encrypted) || '{}') } catch {}
          }
          return { ...credit, responseData, requestData, response_data_encrypted: undefined, request_data_encrypted: undefined }
        })
        // Primary = most recent current-address check (or just the first)
        const currentCheck = allCreditChecks.find(c => c.address_type !== 'previous') || allCreditChecks[0]
        creditCheck = currentCheck
        creditRequestData = currentCheck?.requestData || null
      }

      // Fetch proof of address from RESIDENTIAL section evidence for cross-reference
      const { data: resEvidence } = await supabase
        .from('evidence_v2')
        .select('file_path, file_name, file_type, created_at')
        .eq('reference_id', section.reference_id)
        .eq('section_type', 'RESIDENTIAL')
        .limit(5)
      if (resEvidence && resEvidence.length > 0) {
        for (const file of resEvidence) {
          const { data: urlData } = await supabase.storage.from('reference-documents').createSignedUrl(file.file_path, 3600)
          proofOfAddressForCredit = {
            url: urlData?.signedUrl || file.file_path,
            filename: file.file_name,
            type: file.file_type,
            uploadedAt: file.created_at
          }
          break
        }
      }
      // Also check form_data from residential section for proofOfAddressUrl
      if (!proofOfAddressForCredit) {
        const { data: resSection } = await supabase
          .from('reference_sections_v2')
          .select('section_data')
          .eq('reference_id', section.reference_id)
          .eq('section_type', 'RESIDENTIAL')
          .maybeSingle()
        const resFormData = (resSection?.section_data as any) || {}
        if (resFormData.proofOfAddressUrl) {
          proofOfAddressForCredit = { url: resFormData.proofOfAddressUrl, filename: 'Proof of Address' }
        }
      }
    }

    // Get AML check if AML section
    let amlCheck = null
    if (section.section_type === 'AML') {
      const { data: aml } = await supabase
        .from('sanctions_screenings_v2')
        .select('*')
        .eq('reference_id', section.reference_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      amlCheck = aml
    }

    // Get company name
    let companyName = 'Unknown'
    if (reference.company_id) {
      const { data: company } = await supabase
        .from('companies')
        .select('*')
        .eq('id', reference.company_id)
        .maybeSingle()
      if (company) {
        const co = company as any
        companyName = co.name || (co.name_encrypted ? decrypt(co.name_encrypted) : null) || co.company_name || 'Unknown'
      }
    }

    // Decrypt data for display
    const decryptedReference = {
      ...reference,
      tenant_first_name: decrypt(reference.tenant_first_name_encrypted),
      tenant_last_name: decrypt(reference.tenant_last_name_encrypted),
      tenant_email: decrypt(reference.tenant_email_encrypted),
      tenant_phone: decrypt(reference.tenant_phone_encrypted),
      property_address: decrypt(reference.property_address_encrypted),
      property_city: decrypt(reference.property_city_encrypted),
      property_postcode: decrypt(reference.property_postcode_encrypted),
      employer_ref_name: decrypt(reference.employer_ref_name_encrypted),
      employer_ref_email: decrypt(reference.employer_ref_email_encrypted),
      previous_landlord_name: decrypt(reference.previous_landlord_name_encrypted),
      previous_landlord_email: decrypt(reference.previous_landlord_email_encrypted)
    }

    // Include pending/outstanding referee info and chase items for this section
    let pendingReferees: any[] = []
    let sectionChaseItems: any[] = []
    if (section.section_type === 'INCOME' || section.section_type === 'RESIDENTIAL') {
      const refereeTypeFilter = section.section_type === 'INCOME' ? ['EMPLOYER', 'ACCOUNTANT'] : ['LANDLORD']

      // Get all referees for this section type (submitted or not)
      const { data: allReferees } = await supabase
        .from('referees_v2')
        .select('id, referee_type, referee_name, referee_email_encrypted, completed_at, form_data')
        .eq('reference_id', section.reference_id)
        .in('referee_type', refereeTypeFilter)

      pendingReferees = (allReferees || []).map(r => ({
        id: r.id,
        referee_type: r.referee_type,
        referee_name: r.referee_name,
        referee_email: decrypt(r.referee_email_encrypted) || '',
        submitted: !!r.completed_at,
        submitted_at: r.completed_at
      }))

      // Get chase items for this section
      const { data: chaseItems } = await supabase
        .from('chase_items_v2')
        .select('id, referee_type, status, chase_count, emails_sent, sms_sent, calls_made, initial_sent_at, last_chased_at, resolved_at, resolution_type')
        .eq('reference_id', section.reference_id)
        .in('referee_type', refereeTypeFilter)

      sectionChaseItems = chaseItems || []
    }

    res.json({
      ...section,
      section_data: section.section_data || sectionFormData,
      form_data: sectionFormData,
      evidence,
      credit_check: creditCheck,
      credit_checks: allCreditChecks,
      credit_request_data: creditRequestData,
      proof_of_address_for_credit: proofOfAddressForCredit,
      aml_check: amlCheck,
      referee_submissions: refereeFormData,
      pending_referees: pendingReferees,
      chase_items: sectionChaseItems,
      rent_share: reference.rent_share || reference.monthly_rent,
      monthly_rent: reference.monthly_rent,
      company_name: companyName,
      reference_number: reference.reference_number || null,
      tenant_name: `${decryptedReference.tenant_first_name || ''} ${decryptedReference.tenant_last_name || ''}`.trim(),
      property_address: decryptedReference.property_address,
      reference: decryptedReference,
      verbalReference,
      hasVerbalReference: !!verbalReference
    })
  } catch (error: any) {
    console.error('[V2 Sections] Error getting section:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Re-run Creditsafe check for a CREDIT section
 * Allows assessor to re-run with corrected address if needed
 */
router.post('/:id/rerun-credit-check', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params
    const staffUser = req.staffUser

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' })
    }

    // Get section
    const { data: section, error: secErr } = await supabase
      .from('reference_sections_v2')
      .select('id, reference_id, section_type')
      .eq('id', id)
      .single()

    if (secErr || !section) {
      return res.status(404).json({ error: 'Section not found' })
    }

    if (section.section_type !== 'CREDIT') {
      return res.status(400).json({ error: 'Can only re-run credit checks for CREDIT sections' })
    }

    // Get reference for tenant data
    const { data: reference } = await supabase
      .from('tenant_references_v2')
      .select('*')
      .eq('id', section.reference_id)
      .single()

    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Get tenant identity from form_data
    const formData = (reference.form_data as any) || {}
    const identity = formData.identity || formData.personal || {}
    const residential = formData.residential || {}
    const currentAddress = residential.currentAddress || {}

    // Always use the decrypted top-level fields (form_data identity may contain titles or encrypted values)
    let firstName = decrypt(reference.tenant_first_name_encrypted) || identity.firstName || ''
    let lastName = decrypt(reference.tenant_last_name_encrypted) || identity.lastName || ''
    const dateOfBirth = (reference.tenant_dob_encrypted ? decrypt(reference.tenant_dob_encrypted) : null) || identity.dateOfBirth || ''

    // Strip common titles from firstName (e.g. "Mr", "Mrs", "Miss", "Ms", "Dr")
    const titles = ['mr', 'mrs', 'miss', 'ms', 'dr', 'prof', 'sir', 'lord', 'lady']
    if (titles.includes(firstName.toLowerCase().trim())) {
      // firstName is actually a title — split lastName into first + last
      const parts = lastName.trim().split(/\s+/)
      firstName = parts[0] || ''
      lastName = parts.slice(1).join(' ') || ''
    }

    // Build address from current address fields (street only — no city, Creditsafe uses postcode for locality)
    let address = currentAddress.line1 || ''
    if (currentAddress.line2) address += ', ' + currentAddress.line2
    const postcode = currentAddress.postcode || ''

    // Allow overrides from request body
    const overrides = req.body || {}
    const finalAddress = overrides.address || address
    const finalPostcode = overrides.postcode || postcode

    if (!firstName || !lastName || !dateOfBirth || !finalAddress || !finalPostcode) {
      return res.status(400).json({
        error: 'Missing required data for credit check',
        available: { firstName: !!firstName, lastName: !!lastName, dateOfBirth: !!dateOfBirth, address: !!finalAddress, postcode: !!finalPostcode }
      })
    }

    // Run Creditsafe check
    const { creditsafeService } = await import('../../services/creditsafeService')

    if (!creditsafeService.isEnabled()) {
      return res.status(503).json({ error: 'Creditsafe integration is not enabled' })
    }

    console.log(`[V2 Sections] Re-running credit check for ${firstName} ${lastName} at ${finalAddress}, ${finalPostcode}`)

    const result = await creditsafeService.verifyIndividual({
      firstName,
      lastName,
      dateOfBirth,
      address: finalAddress,
      postcode: finalPostcode
    })

    const requestPayload = { firstName, lastName, dateOfBirth, address: finalAddress, postcode: finalPostcode }

    // Store new result in V2 table
    await supabase.from('creditsafe_verifications_v2').insert({
      reference_id: section.reference_id,
      request_data_encrypted: encrypt(JSON.stringify(requestPayload)),
      response_data_encrypted: encrypt(JSON.stringify(result)),
      transaction_id: result.transactionId || null,
      risk_level: result.riskLevel,
      risk_score: result.riskScore,
      status: result.status,
      fraud_indicators: (result as any).fraudIndicators || null
    })

    // Update section_data with new results
    const existingSectionData = (await supabase.from('reference_sections_v2').select('section_data').eq('id', id).single()).data?.section_data || {}
    await supabase.from('reference_sections_v2').update({
      section_data: {
        ...(existingSectionData as any),
        status: result.status,
        riskLevel: result.riskLevel,
        riskScore: result.riskScore,
        verifyMatch: result.verifyMatch,
        notFound: result.notFound,
        ccjMatch: result.ccjMatch,
        insolvencyMatch: result.insolvencyMatch,
        electoralRegisterMatch: result.electoralRegisterMatch,
        deceasedRegisterMatch: result.deceasedRegisterMatch,
        ccjCount: result.countyCourtJudgments?.length || 0,
        insolvencyCount: result.insolvencies?.length || 0,
        transactionId: result.transactionId,
        checkedAt: new Date().toISOString(),
        rerunBy: staffUser.id,
        rerunAt: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    }).eq('id', id)

    await logActivity({
      referenceId: section.reference_id,
      sectionId: id,
      action: 'CREDIT_RERUN',
      performedBy: staffUser.id,
      performedByType: 'STAFF',
      notes: `Re-ran Creditsafe check: ${result.status}, score ${result.riskScore}`
    })

    res.json({
      message: 'Credit check re-run completed',
      result: {
        status: result.status,
        riskLevel: result.riskLevel,
        riskScore: result.riskScore,
        verifyMatch: result.verifyMatch,
        ccjMatch: result.ccjMatch,
        insolvencyMatch: result.insolvencyMatch,
        electoralRegisterMatch: result.electoralRegisterMatch,
        deceasedRegisterMatch: result.deceasedRegisterMatch,
        transactionId: result.transactionId,
        rawResponse: result.rawResponse
      },
      requestUsed: requestPayload
    })
  } catch (error: any) {
    console.error('[V2 Sections] Error re-running credit check:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Claim a section for review
 */
router.post('/:id/claim', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params
    const staffUser = req.staffUser

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' })
    }

    const success = await claimSection(id, staffUser.id)
    if (!success) {
      return res.status(400).json({ error: 'Failed to claim section. It may have been claimed by another assessor.' })
    }

    res.json({ message: 'Section claimed', sectionId: id })
  } catch (error: any) {
    console.error('[V2 Sections] Error claiming section:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Release a section back to queue
 */
router.post('/:id/release', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params

    const success = await releaseSection(id)
    if (!success) {
      return res.status(400).json({ error: 'Failed to release section' })
    }

    res.json({ message: 'Section released to queue', sectionId: id })
  } catch (error: any) {
    console.error('[V2 Sections] Error releasing section:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Submit decision for a section
 */
router.post('/:id/decision', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params
    const staffUser = req.staffUser
    // Accept both naming conventions from frontend
    const {
      decision,
      conditionText,
      condition_text,
      failReason,
      decision_notes,
      assessorNotes,
      checklist_results
    } = req.body

    const finalConditionText = conditionText || condition_text
    const finalNotes = assessorNotes || decision_notes

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' })
    }

    // Validate decision
    const validDecisions: V2SectionDecision[] = ['PASS', 'PASS_WITH_CONDITION', 'FAIL']
    if (!validDecisions.includes(decision)) {
      return res.status(400).json({ error: 'Invalid decision. Must be PASS, PASS_WITH_CONDITION, or FAIL' })
    }

    // Require condition text for PASS_WITH_CONDITION
    if (decision === 'PASS_WITH_CONDITION' && !finalConditionText) {
      return res.status(400).json({ error: 'Condition text required for PASS_WITH_CONDITION' })
    }

    // Require notes for FAIL
    if (decision === 'FAIL' && !finalNotes && !failReason) {
      return res.status(400).json({ error: 'Notes or fail reason required for FAIL decision' })
    }

    // Store checklist_results in section_data if provided
    if (checklist_results && Object.keys(checklist_results).length > 0) {
      const { data: existingSection } = await supabase
        .from('reference_sections_v2')
        .select('section_data')
        .eq('id', id)
        .single()

      const existingData = (existingSection?.section_data as Record<string, any>) || {}
      await supabase
        .from('reference_sections_v2')
        .update({
          section_data: { ...existingData, checklist_results }
        })
        .eq('id', id)
    }

    // Note: previously blocked passing INCOME with pending employer reference,
    // but staff should be able to pass based on uploaded evidence (payslips etc.)
    // and deal with pending employer references separately

    const success = await submitSectionDecision({
      sectionId: id,
      decision,
      conditionText: finalConditionText,
      failReason: failReason || finalNotes,
      assessorNotes: finalNotes,
      staffUserId: staffUser.id
    })

    if (!success) {
      return res.status(500).json({ error: 'Failed to submit decision' })
    }

    res.json({ message: 'Decision submitted', sectionId: id, decision })
  } catch (error: any) {
    console.error('[V2 Sections] Error submitting decision:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get evidence for a section
 */
router.get('/:id/evidence', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params

    const section = await getSection(id)
    if (!section) {
      return res.status(404).json({ error: 'Section not found' })
    }

    // TODO: Fetch actual evidence from storage/database
    // For now return empty array - evidence integration will be added in Sprint 3
    const evidence: any[] = []

    res.json({ evidence })
  } catch (error: any) {
    console.error('[V2 Sections] Error getting evidence:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// ISSUE RESOLUTION
// ============================================================================

/**
 * Report an issue with a section (staff auth)
 */
router.post('/:id/report-issue', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params
    const { issueType, notes, requestType } = req.body
    const staffUser = req.staffUser

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' })
    }

    if (!issueType || !notes) {
      return res.status(400).json({ error: 'issueType and notes are required' })
    }

    const section = await getSection(id)
    if (!section) {
      return res.status(404).json({ error: 'Section not found' })
    }

    const reference = await getReference(section.reference_id)
    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    const reqType = requestType || 'document'

    // Check for active referee linked to this section type
    let hasActiveReferee = false
    let activeRefereeType: string | null = null
    let activeRefereeCompleted = false
    const refereeTypes = section.section_type === 'RESIDENTIAL' ? ['LANDLORD'] :
      section.section_type === 'INCOME' ? ['EMPLOYER', 'ACCOUNTANT'] : []

    if (refereeTypes.length > 0) {
      const { data: referees } = await supabase
        .from('referees_v2')
        .select('id, referee_type, completed_at')
        .eq('reference_id', section.reference_id)
        .in('referee_type', refereeTypes)

      if (referees && referees.length > 0) {
        hasActiveReferee = true
        activeRefereeType = referees[0].referee_type
        activeRefereeCompleted = !!referees[0].completed_at
      }
    }

    // Update section: set PENDING, store issue data, clear assignment
    const sectionData = {
      ...(section.section_data || {}),
      issue_type: issueType,
      issue_notes: notes,
      issue_reported_at: new Date().toISOString(),
      issue_request_type: reqType,
      issue_status: 'OPEN',
      has_active_referee: hasActiveReferee,
      active_referee_type: activeRefereeType,
      active_referee_completed: activeRefereeCompleted,
      evidence_status: hasActiveReferee ? 'AWAITING_REFEREE' : (section.section_data as any)?.evidence_status || undefined
    }

    await supabase
      .from('reference_sections_v2')
      .update({
        queue_status: 'PENDING',
        assigned_to: null,
        assigned_at: null,
        section_data: sectionData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    // Reactivate or create chase item
    await reactivateOrCreateChaseItem(section.reference_id, id, `Issue reported: ${issueType}`)

    // Generate upload/response link
    const token = generateToken()
    const tokenHash = hash(token)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    await supabase
      .from('upload_links')
      .insert({
        reference_id: section.reference_id,
        token_hash: tokenHash,
        field: reqType === 'document' ? 'issue_document' : 'issue_response',
        document_name: `Issue: ${issueType}`,
        section: section.section_type,
        expires_at: expiresAt
      })

    const frontendUrl = getV2FrontendUrl()
    const tenantName = `${decrypt(reference.tenant_first_name_encrypted) || ''} ${decrypt(reference.tenant_last_name_encrypted) || ''}`.trim()
    const tenantEmail = decrypt(reference.tenant_email_encrypted) || ''
    const propertyAddress = decrypt(reference.property_address_encrypted) || ''

    // Get company details for branding
    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('id', reference.company_id)
      .maybeSingle()

    const co = company as any
    const companyName = co?.name || (co?.name_encrypted ? decrypt(co.name_encrypted) : null) || co?.company_name || 'PropertyGoose'
    const agentLogoUrl = company?.logo_url || 'https://app.propertygoose.co.uk/PropertyGooseLogo.png'

    // Send tenant email
    if (reqType === 'document') {
      const uploadLink = `${frontendUrl}/issue-upload/${token}`
      const html = loadEmailTemplate('issue-document-request', {
        AgentLogoUrl: agentLogoUrl,
        CompanyName: companyName,
        TenantName: tenantName,
        PropertyAddress: propertyAddress,
        IssueNote: notes,
        UploadLink: uploadLink
      })
      await sendEmail({
        to: tenantEmail,
        subject: `Document Required - ${companyName}`,
        html
      })
    } else {
      const responseLink = `${frontendUrl}/issue-response/${token}`
      const html = loadEmailTemplate('issue-information-request', {
        AgentLogoUrl: agentLogoUrl,
        CompanyName: companyName,
        TenantName: tenantName,
        PropertyAddress: propertyAddress,
        IssueNote: notes,
        ResponseLink: responseLink
      })
      await sendEmail({
        to: tenantEmail,
        subject: `Information Required - ${companyName}`,
        html
      })
    }

    // Send agent notification email
    const { data: agentUser } = await supabase
      .from('users')
      .select('email')
      .eq('company_id', reference.company_id)
      .limit(1)
      .maybeSingle()

    if (agentUser?.email) {
      const sectionLabels: Record<string, string> = {
        IDENTITY: 'Identity', RTR: 'Right to Rent', INCOME: 'Income',
        RESIDENTIAL: 'Residential', CREDIT: 'Credit', AML: 'AML', ADDRESS: 'Address'
      }
      const agentHtml = loadEmailTemplate('issue-agent-notification', {
        TenantName: tenantName,
        PropertyAddress: propertyAddress,
        SectionType: sectionLabels[section.section_type] || section.section_type,
        IssueNote: notes,
        RequestAction: reqType === 'document' ? 'upload a new document' : 'provide additional information'
      })
      await sendEmail({
        to: agentUser.email,
        subject: `Reference Issue Found - ${tenantName}`,
        html: agentHtml
      })
    }

    // Log activity
    await logActivity({
      referenceId: section.reference_id,
      sectionId: id,
      action: 'ISSUE_REPORTED',
      performedBy: staffUser.id,
      performedByType: 'staff',
      notes: `${issueType}: ${notes}`
    })

    res.json({ success: true, message: 'Issue reported — tenant and agent notified' })
  } catch (error: any) {
    console.error('[V2 Sections] Error reporting issue:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// TENANT RESPONSE ENDPOINTS (Public, no auth)
// ============================================================================

/**
 * Get issue upload context (public - token auth)
 */
router.get('/issue-upload/:token', async (req, res) => {
  try {
    const { token } = req.params
    const tokenHash = hash(token)

    const { data: link } = await supabase
      .from('upload_links')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (!link) {
      return res.status(404).json({ error: 'Invalid or expired link' })
    }

    if (new Date(link.expires_at) < new Date()) {
      return res.status(410).json({ error: 'This link has expired' })
    }

    // Get reference and company for branding
    const { data: reference } = await supabase
      .from('tenant_references_v2')
      .select('company_id')
      .eq('id', link.reference_id)
      .single()

    let companyName = 'PropertyGoose'
    let logoUrl = ''
    if (reference) {
      const { data: company } = await supabase
        .from('companies')
        .select('name, logo_url')
        .eq('id', reference.company_id)
        .single()
      companyName = company?.name || companyName
      logoUrl = company?.logo_url || ''
    }

    // Get section data for issue description
    let issueDescription = ''
    let sectionType = link.section || ''
    if (link.reference_id) {
      const { data: sections } = await supabase
        .from('reference_sections_v2')
        .select('section_type, section_data')
        .eq('reference_id', link.reference_id)
        .eq('section_type', sectionType)
        .maybeSingle()

      if (sections?.section_data) {
        const sd = sections.section_data as Record<string, any>
        issueDescription = sd.issue_notes || ''
      }
    }

    res.json({
      companyName,
      logoUrl,
      sectionType,
      issueDescription,
      alreadyUploaded: !!link.uploaded_at
    })
  } catch (error: any) {
    console.error('[V2 Sections] Error getting upload context:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Upload file for issue (public - token auth)
 */
router.post('/issue-upload/:token/upload', async (req, res) => {
  try {
    const { token } = req.params
    const { fileData, fileName, fileType } = req.body
    const tokenHash = hash(token)

    const { data: link } = await supabase
      .from('upload_links')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (!link) {
      return res.status(404).json({ error: 'Invalid or expired link' })
    }

    if (new Date(link.expires_at) < new Date()) {
      return res.status(410).json({ error: 'This link has expired' })
    }

    if (!fileData || !fileName) {
      return res.status(400).json({ error: 'fileData and fileName are required' })
    }

    // Get reference for file path
    const { data: reference } = await supabase
      .from('tenant_references_v2')
      .select('company_id')
      .eq('id', link.reference_id)
      .single()

    const companyId = reference?.company_id || 'unknown'
    const sectionType = (link.section || 'general').toLowerCase()

    // Upload file
    const buffer = Buffer.from(fileData, 'base64')
    const timestamp = Date.now()
    const filePath = `v2-evidence/${companyId}/${link.reference_id}/${sectionType}/${timestamp}-${fileName}`

    const _mimeMap: Record<string, string> = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif' }
    const _ext = '.' + (fileName || '').split('.').pop()?.toLowerCase()
    const _resolvedType = (fileType && fileType !== 'application/octet-stream' && fileType !== '') ? fileType : _mimeMap[_ext] || 'application/pdf'

    const { error: uploadError } = await supabase.storage
      .from('reference-documents')
      .upload(filePath, buffer, { contentType: _resolvedType })

    if (uploadError) {
      console.error('[V2 Sections] Upload error:', uploadError)
      return res.status(500).json({ error: 'Failed to upload file' })
    }

    // Create evidence record
    await supabase
      .from('evidence_v2')
      .insert({
        reference_id: link.reference_id,
        section_type: link.section || 'IDENTITY',
        evidence_type: 'issue_document',
        file_path: filePath,
        file_name: fileName,
        file_type: fileType || 'application/octet-stream',
        uploaded_by: 'tenant'
      })

    // Mark upload link as used
    await supabase
      .from('upload_links')
      .update({
        uploaded_at: new Date().toISOString(),
        uploaded_file_path: filePath
      })
      .eq('id', link.id)

    // Update section issue_status
    const { data: sectionRow } = await supabase
      .from('reference_sections_v2')
      .select('id, section_data')
      .eq('reference_id', link.reference_id)
      .eq('section_type', link.section)
      .maybeSingle()

    if (sectionRow) {
      const sectionData = { ...(sectionRow.section_data as Record<string, any> || {}) }
      sectionData.issue_status = 'RESPONSE_PENDING_REVIEW'
      await supabase
        .from('reference_sections_v2')
        .update({ section_data: sectionData, updated_at: new Date().toISOString() })
        .eq('id', sectionRow.id)

      await logActivity({
        referenceId: link.reference_id,
        sectionId: sectionRow.id,
        action: 'TENANT_UPLOAD',
        performedBy: 'tenant',
        performedByType: 'tenant',
        notes: `Uploaded ${fileName} in response to issue`
      })
    }

    res.json({ success: true })
  } catch (error: any) {
    console.error('[V2 Sections] Error uploading issue document:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get issue response context (public - token auth)
 */
router.get('/issue-response/:token', async (req, res) => {
  try {
    const { token } = req.params
    const tokenHash = hash(token)

    const { data: link } = await supabase
      .from('upload_links')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (!link) {
      return res.status(404).json({ error: 'Invalid or expired link' })
    }

    if (new Date(link.expires_at) < new Date()) {
      return res.status(410).json({ error: 'This link has expired' })
    }

    // Get company branding
    const { data: reference } = await supabase
      .from('tenant_references_v2')
      .select('company_id')
      .eq('id', link.reference_id)
      .single()

    let companyName = 'PropertyGoose'
    let logoUrl = ''
    if (reference) {
      const { data: company } = await supabase
        .from('companies')
        .select('name, logo_url')
        .eq('id', reference.company_id)
        .single()
      companyName = company?.name || companyName
      logoUrl = company?.logo_url || ''
    }

    // Get issue description
    let issueDescription = ''
    if (link.reference_id && link.section) {
      const { data: sections } = await supabase
        .from('reference_sections_v2')
        .select('section_data')
        .eq('reference_id', link.reference_id)
        .eq('section_type', link.section)
        .maybeSingle()

      if (sections?.section_data) {
        const sd = sections.section_data as Record<string, any>
        issueDescription = sd.issue_notes || ''
      }
    }

    res.json({
      companyName,
      logoUrl,
      sectionType: link.section || '',
      issueDescription,
      alreadyResponded: !!link.uploaded_at
    })
  } catch (error: any) {
    console.error('[V2 Sections] Error getting response context:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Submit text response for issue (public - token auth)
 */
router.post('/issue-response/:token/submit', async (req, res) => {
  try {
    const { token } = req.params
    const { responseText, fileData, fileName, fileType } = req.body
    const tokenHash = hash(token)

    const { data: link } = await supabase
      .from('upload_links')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (!link) {
      return res.status(404).json({ error: 'Invalid or expired link' })
    }

    if (new Date(link.expires_at) < new Date()) {
      return res.status(410).json({ error: 'This link has expired' })
    }

    if (!responseText && !fileData) {
      return res.status(400).json({ error: 'Response text or file is required' })
    }

    const { data: reference } = await supabase
      .from('tenant_references_v2')
      .select('company_id')
      .eq('id', link.reference_id)
      .single()

    const companyId = reference?.company_id || 'unknown'

    // Store text response as evidence
    if (responseText) {
      await supabase
        .from('evidence_v2')
        .insert({
          reference_id: link.reference_id,
          section_type: link.section || 'IDENTITY',
          evidence_type: 'tenant_response',
          file_path: '',
          file_name: 'Text Response',
          file_type: 'text/plain',
          uploaded_by: 'tenant',
          notes: responseText
        })
    }

    // Handle optional file upload
    if (fileData && fileName) {
      const buffer = Buffer.from(fileData, 'base64')
      const sectionType = (link.section || 'general').toLowerCase()
      const timestamp = Date.now()
      const filePath = `v2-evidence/${companyId}/${link.reference_id}/${sectionType}/${timestamp}-${fileName}`

      const __mimeMap: Record<string, string> = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif' }
      const __ext = '.' + (fileName || '').split('.').pop()?.toLowerCase()
      const __resolvedType = (fileType && fileType !== 'application/octet-stream' && fileType !== '') ? fileType : __mimeMap[__ext] || 'application/pdf'

      await supabase.storage
        .from('reference-documents')
        .upload(filePath, buffer, { contentType: __resolvedType })

      await supabase
        .from('evidence_v2')
        .insert({
          reference_id: link.reference_id,
          section_type: link.section || 'IDENTITY',
          evidence_type: 'issue_document',
          file_path: filePath,
          file_name: fileName,
          file_type: fileType || 'application/octet-stream',
          uploaded_by: 'tenant'
        })
    }

    // Mark upload link as used
    await supabase
      .from('upload_links')
      .update({ uploaded_at: new Date().toISOString() })
      .eq('id', link.id)

    // Update section issue_status
    const { data: sectionRow } = await supabase
      .from('reference_sections_v2')
      .select('id, section_data')
      .eq('reference_id', link.reference_id)
      .eq('section_type', link.section)
      .maybeSingle()

    if (sectionRow) {
      const sectionData = { ...(sectionRow.section_data as Record<string, any> || {}) }
      sectionData.issue_status = 'RESPONSE_PENDING_REVIEW'
      await supabase
        .from('reference_sections_v2')
        .update({ section_data: sectionData, updated_at: new Date().toISOString() })
        .eq('id', sectionRow.id)

      await logActivity({
        referenceId: link.reference_id,
        sectionId: sectionRow.id,
        action: 'TENANT_RESPONSE',
        performedBy: 'tenant',
        performedByType: 'tenant',
        notes: responseText ? 'Text response submitted' : 'File uploaded'
      })
    }

    res.json({ success: true })
  } catch (error: any) {
    console.error('[V2 Sections] Error submitting response:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// RESPONSE REVIEW (Staff)
// ============================================================================

/**
 * Get pending response evidence for a section
 */
router.get('/:id/pending-responses', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params

    const section = await getSection(id)
    if (!section) {
      return res.status(404).json({ error: 'Section not found' })
    }

    const { data: evidence } = await supabase
      .from('evidence_v2')
      .select('*')
      .eq('reference_id', section.reference_id)
      .eq('section_type', section.section_type)
      .in('evidence_type', ['issue_document', 'tenant_response'])
      .order('created_at', { ascending: false })

    // Get public URLs for files
    const enrichedEvidence = await Promise.all((evidence || []).map(async e => {
      let fileUrl = ''
      if (e.file_path) {
        const { data: urlData } = await supabase.storage.from('reference-documents').createSignedUrl(e.file_path, 3600)
        fileUrl = urlData?.signedUrl || ''
      }
      return { ...e, file_url: fileUrl }
    }))

    res.json({ evidence: enrichedEvidence })
  } catch (error: any) {
    console.error('[V2 Sections] Error getting pending responses:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Review a tenant response and take action
 */
router.post('/:id/review-response', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params
    const { action, notes, updatedFields } = req.body
    const staffUser = req.staffUser

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' })
    }

    if (!action || !['accept_and_verify', 'accept_and_chase'].includes(action)) {
      return res.status(400).json({ error: 'action must be accept_and_verify or accept_and_chase' })
    }

    const section = await getSection(id)
    if (!section) {
      return res.status(404).json({ error: 'Section not found' })
    }

    const sectionData = { ...(section.section_data as Record<string, any> || {}) }

    if (action === 'accept_and_verify') {
      // Evidence gate: for RESIDENTIAL and INCOME, check evidence exists before allowing verify
      const evidenceGatedTypes = ['RESIDENTIAL', 'INCOME']
      if (evidenceGatedTypes.includes(section.section_type)) {
        const hasEvidence = section.referee_submitted_at || section.evidence_submitted_at
        const hasReferee = sectionData.has_active_referee === true

        if (!hasEvidence && hasReferee) {
          return res.status(400).json({
            error: 'Cannot send to verify queue: waiting for referee form submission. Use accept_and_chase to chase the referee instead.'
          })
        }

        // If no evidence and no referee, the tenant response itself is the evidence
        if (!hasEvidence && !hasReferee) {
          sectionData.evidence_status = 'EVIDENCE_RECEIVED'
        }
      }

      // Merge new evidence from issue response into form_data so verify page shows updated data
      try {
        const { data: issueEvidence } = await supabase
          .from('evidence_v2')
          .select('id, evidence_type, file_path, file_name, notes, section_type')
          .eq('reference_id', section.reference_id)
          .eq('section_type', section.section_type)
          .in('evidence_type', ['issue_document', 'tenant_response'])
          .order('created_at', { ascending: false })

        if (issueEvidence && issueEvidence.length > 0) {
          // Get the reference to update form_data
          const { data: reference } = await supabase
            .from('tenant_references_v2')
            .select('form_data')
            .eq('id', section.reference_id)
            .single()

          if (reference?.form_data) {
            const updatedFormData = { ...reference.form_data }
            const sectionKey = section.section_type === 'ADDRESS' ? 'residential'
              : section.section_type.toLowerCase()
            const sectionFormData = { ...(updatedFormData[sectionKey] || {}) }

            for (const ev of issueEvidence) {
              if (ev.evidence_type === 'issue_document' && ev.file_path) {
                // Get public URL for the new document
                const { data: urlData } = supabase.storage
                  .from('reference-documents')
                  .getPublicUrl(ev.file_path)
                const newUrl = urlData?.publicUrl || ev.file_path

                // Update the appropriate URL field based on section type
                if (section.section_type === 'RTR') {
                  sectionFormData.supportingDocUrl = newUrl
                  sectionFormData.issueReplacementDocUrl = newUrl
                  sectionFormData.issueReplacementDocName = ev.file_name
                } else if (section.section_type === 'IDENTITY') {
                  sectionFormData.idDocumentUrl = newUrl
                } else if (section.section_type === 'INCOME') {
                  sectionFormData.payslipsUrl = newUrl
                } else if (section.section_type === 'RESIDENTIAL' || section.section_type === 'ADDRESS') {
                  sectionFormData.proofOfAddressUrl = newUrl
                }
              }

              if (ev.evidence_type === 'tenant_response' && ev.notes) {
                // Text response — could be updated share code, address, etc.
                if (section.section_type === 'RTR') {
                  // Store new share code (encrypt it like the original)
                  sectionFormData.shareCode = encrypt(ev.notes.trim())
                  sectionFormData.shareCodeUpdatedAt = new Date().toISOString()
                }
                sectionFormData.tenantResponseText = ev.notes
              }
            }

            sectionFormData.evidenceUpdatedFromIssueResponse = true
            sectionFormData.evidenceUpdatedAt = new Date().toISOString()
            updatedFormData[sectionKey] = sectionFormData

            await supabase
              .from('tenant_references_v2')
              .update({ form_data: updatedFormData })
              .eq('id', section.reference_id)

            console.log(`[V2 Sections] Merged ${issueEvidence.length} issue evidence record(s) into form_data for section ${id}`)
          }
        }
      } catch (mergeErr) {
        console.error('[V2 Sections] Failed to merge issue evidence into form_data (non-fatal):', mergeErr)
      }

      // Set section back to READY so it enters the verify queue
      sectionData.issue_status = 'RESOLVED'
      const now = new Date().toISOString()
      await supabase
        .from('reference_sections_v2')
        .update({
          queue_status: 'READY',
          queue_entered_at: now,
          evidence_submitted_at: now,
          section_data: sectionData,
          updated_at: now
        })
        .eq('id', id)

      await logActivity({
        referenceId: section.reference_id,
        sectionId: id,
        action: 'RESPONSE_ACCEPTED_VERIFY',
        performedBy: staffUser.id,
        performedByType: 'staff',
        notes: notes || 'Response accepted, section sent to verify queue'
      })
    } else if (action === 'accept_and_chase') {
      // Apply any field edits
      if (updatedFields && Array.isArray(updatedFields)) {
        for (const { field, value } of updatedFields) {
          await editReferenceField(
            section.reference_id,
            field,
            value,
            staffUser.id,
            'staff'
          )
        }
      }

      // Create new chase item for the updated referee
      sectionData.issue_status = 'CHASING_UPDATED'
      await supabase
        .from('reference_sections_v2')
        .update({
          section_data: sectionData,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      await reactivateOrCreateChaseItem(
        section.reference_id,
        id,
        'Response reviewed, chasing updated referee'
      )

      await logActivity({
        referenceId: section.reference_id,
        sectionId: id,
        action: 'RESPONSE_ACCEPTED_CHASE',
        performedBy: staffUser.id,
        performedByType: 'staff',
        notes: notes || 'Response accepted, chasing updated referee details'
      })
    }

    res.json({ success: true })
  } catch (error: any) {
    console.error('[V2 Sections] Error reviewing response:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/v2/sections/:id/upload-evidence
 * Staff uploads evidence document to a section
 */
router.post('/:id/upload-evidence', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params
    const { fileData, fileName, fileType } = req.body

    if (!fileData || !fileName) {
      return res.status(400).json({ error: 'fileData and fileName are required' })
    }

    // Get section with reference info
    const { data: section, error: secErr } = await supabase
      .from('reference_sections_v2')
      .select('id, reference_id, section_type, queue_status, section_data')
      .eq('id', id)
      .single()

    if (secErr || !section) {
      return res.status(404).json({ error: 'Section not found' })
    }

    // Get reference for company/storage path
    const { data: reference } = await supabase
      .from('tenant_references_v2')
      .select('id, company_id')
      .eq('id', section.reference_id)
      .single()

    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Upload to Supabase storage
    const filePath = `v2-evidence/${reference.company_id}/${reference.id}/${section.section_type}/${Date.now()}-${fileName}`
    const buffer = Buffer.from(fileData, 'base64')

    const { error: uploadErr } = await supabase.storage
      .from('reference-documents')
      .upload(filePath, buffer, {
        contentType: fileType || 'application/octet-stream',
        upsert: false
      })

    if (uploadErr) {
      console.error('[V2 Sections] Upload error:', uploadErr)
      return res.status(500).json({ error: 'Failed to upload file' })
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('reference-documents')
      .getPublicUrl(filePath)

    // Store in evidence_v2 table
    await supabase.from('evidence_v2').insert({
      reference_id: reference.id,
      section_id: section.id,
      section_type: section.section_type,
      evidence_type: 'staff_upload',
      file_path: filePath,
      file_name: fileName,
      file_type: fileType || null,
      uploaded_by: req.staffUser?.id || null
    })

    // Update section_data evidence_status
    const updatedSectionData = {
      ...(section.section_data || {}),
      evidence_status: 'EVIDENCE_UPLOADED',
      staff_evidence_url: urlData?.publicUrl || null,
      staff_evidence_filename: fileName
    }

    await supabase
      .from('reference_sections_v2')
      .update({
        section_data: updatedSectionData,
        evidence_submitted_at: new Date().toISOString()
      })
      .eq('id', section.id)

    // If section is PENDING, move to READY
    if (section.queue_status === 'PENDING') {
      await supabase
        .from('reference_sections_v2')
        .update({
          queue_status: 'READY',
          queue_entered_at: new Date().toISOString()
        })
        .eq('id', section.id)
    }

    res.json({ success: true, filePath, fileName })
  } catch (error: any) {
    console.error('[V2 Sections] Error uploading evidence:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router

/**
 * V2 Final Review Routes (Senior Staff Only)
 *
 * Endpoints for final review decisions.
 * Only accessible to staff with FINAL_REVIEW or higher role.
 */

import { Router } from 'express'
import { authenticateStaff, StaffAuthRequest } from '../../middleware/staffAuth'
import { supabase } from '../../config/supabase'
import { decrypt } from '../../services/encryption'
import {
  getReference,
  getReferenceDecrypted,
  updateReferenceStatus,
  getGroupChildren,
  getGuarantor
} from '../../services/v2/referenceServiceV2'
import { getSections, getSection } from '../../services/v2/sectionServiceV2'
import {
  getFinalReviewItems,
  claimWorkItem,
  releaseWorkItem,
  completeWorkItem,
  getWorkItem
} from '../../services/v2/workQueueServiceV2'
import { getVerbalReferencesForReference, getVerbalReferenceForSection } from '../../services/v2/verbalReferenceService'
import { V2ReferenceStatus } from '../../services/v2/types'
import { generateAndUploadV2Report } from '../../services/v2/pdfReportServiceV2'
import { sendEmail, loadEmailTemplate } from '../../services/emailService'

const router = Router()

// ============================================================================
// ROLE CHECK MIDDLEWARE
// ============================================================================

/**
 * Middleware to check if staff has Final Review permission
 */
async function requireFinalReviewRole(req: StaffAuthRequest, res: any, next: any) {
  const staffUser = req.staffUser

  if (!staffUser) {
    return res.status(401).json({ error: 'Staff authentication required' })
  }

  // Staff auth already verified the user is active — allow through
  // Role-based restrictions can be added later when role column exists
  next()
}

// ============================================================================
// FINAL REVIEW QUEUE
// ============================================================================

/**
 * Get final review queue
 */
router.get('/', authenticateStaff, requireFinalReviewRole, async (req: StaffAuthRequest, res) => {
  return finalReviewQueueHandler(req, res)
})

/**
 * Get final review queue (alias for /queue endpoint)
 */
router.get('/queue', authenticateStaff, requireFinalReviewRole, async (req: StaffAuthRequest, res) => {
  return finalReviewQueueHandler(req, res)
})

/**
 * Shared handler for final review queue
 */
async function finalReviewQueueHandler(req: StaffAuthRequest, res: any) {
  try {
    const { limit } = req.query

    const items = await getFinalReviewItems(limit ? parseInt(limit as string) : 50)

    // Get company names
    const companyIds = [...new Set(items.map((i: any) => i.reference?.company_id).filter(Boolean))]
    let companyMap = new Map<string, string>()
    if (companyIds.length > 0) {
      const { data: companies, error: compErr } = await supabase
        .from('companies')
        .select('*')
        .in('id', companyIds)
      if (compErr) {
        console.error('[V2 FinalReview] Company query error:', compErr)
      }
      for (const c of (companies || [])) {
        const co = c as any
        const compName = co.name || (co.name_encrypted ? decrypt(co.name_encrypted) : null) || co.company_name || 'Unknown'
        companyMap.set(c.id, compName)
      }
    }

    // Filter out already-decided references (each individual gets their own review)
    const decidedStatuses = ['ACCEPTED', 'ACCEPTED_WITH_GUARANTOR', 'ACCEPTED_ON_CONDITION', 'REJECTED', 'INDIVIDUAL_COMPLETE', 'GROUP_ASSESSMENT']
    const filteredItems = items.filter((item: any) => {
      if (decidedStatuses.includes(item.reference?.status)) return false
      return true
    })

    // Flatten for frontend
    const enrichedItems = filteredItems.map((item: any) => {
      const ref = item.reference
      const tenantName = ref
        ? `${decrypt(ref.tenant_first_name_encrypted) || ''} ${decrypt(ref.tenant_last_name_encrypted) || ''}`.trim() || 'Unknown'
        : 'Unknown'
      const propertyAddress = ref
        ? [decrypt(ref.property_address_encrypted), decrypt(ref.property_city_encrypted)].filter(Boolean).join(', ') || 'Unknown'
        : 'Unknown'

      return {
        id: item.id,
        reference_id: item.reference_id,
        work_type: item.work_type,
        status: item.status,
        tenant_name: tenantName,
        property_address: propertyAddress,
        company_name: ref ? (companyMap.get(ref.company_id) || 'Unknown') : 'Unknown',
        monthly_rent: ref?.monthly_rent || 0,
        rent_share: ref?.rent_share || ref?.monthly_rent || 0,
        is_group_parent: ref?.is_group_parent || false,
        group_size: 1,
        reference_number: ref?.reference_number || null
      }
    })

    res.json({ items: enrichedItems })
  } catch (error: any) {
    console.error('[V2 FinalReview] Error getting queue:', error)
    res.status(500).json({ error: error.message })
  }
}

/**
 * Get enriched section detail for final review modal
 */
router.get('/section-detail/:sectionId', authenticateStaff, requireFinalReviewRole, async (req: StaffAuthRequest, res) => {
  try {
    const { sectionId } = req.params

    const section = await getSection(sectionId)
    if (!section) {
      return res.status(404).json({ error: 'Section not found' })
    }

    // Get reference details
    const reference = await getReference(section.reference_id)
    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Check for verbal reference
    const verbalReference = await getVerbalReferenceForSection(sectionId)

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
        : file.section_type === 'RESIDENTIAL' ? 'proof_of_address'
        : 'document'

      const { data: urlData } = supabase.storage.from('reference-documents').getPublicUrl(file.file_path)

      evidence[key] = {
        url: urlData?.publicUrl || file.file_path,
        filename: file.file_name,
        type: file.file_type,
        uploadedAt: file.created_at
      }
    }

    // Also extract document URLs from form_data
    if (sectionFormData.selfieUrl) evidence.selfie = { url: sectionFormData.selfieUrl, filename: 'Selfie' }
    if (sectionFormData.idDocumentUrl) evidence.id_document = { url: sectionFormData.idDocumentUrl, filename: 'ID Document' }
    if (sectionFormData.passportDocUrl) evidence.rtr_document = { url: sectionFormData.passportDocUrl, filename: 'Passport' }
    if (sectionFormData.alternativeDocUrl) evidence.rtr_document = { url: sectionFormData.alternativeDocUrl, filename: 'Alternative ID' }
    if (sectionFormData.proofOfAddressUrl) evidence.proof_of_address = { url: sectionFormData.proofOfAddressUrl, filename: 'Proof of Address' }
    if (sectionFormData.payslipsUrl) evidence.payslips = { url: sectionFormData.payslipsUrl, filename: 'Payslips' }
    if (sectionFormData.taxReturnUrl) evidence.tax_return = { url: sectionFormData.taxReturnUrl, filename: 'Tax Return' }

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

    // Get credit check if CREDIT section
    let creditCheck = null
    if (section.section_type === 'CREDIT') {
      const { data: credit } = await supabase
        .from('creditsafe_verifications_v2')
        .select('*')
        .eq('reference_id', section.reference_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (credit) {
        let responseData: any = null
        if (credit.response_data_encrypted) {
          try { responseData = JSON.parse(decrypt(credit.response_data_encrypted) || '{}') } catch {}
        }
        creditCheck = { ...credit, responseData }
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
      const co = company as any
      companyName = co?.name || (co?.name_encrypted ? decrypt(co.name_encrypted) : null) || co?.company_name || 'Unknown'
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

    res.json({
      ...section,
      section_data: section.section_data || sectionFormData,
      form_data: sectionFormData,
      evidence,
      credit_check: creditCheck,
      aml_check: amlCheck,
      referee_submissions: refereeFormData,
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
    console.error('[V2 FinalReview] Error getting section detail:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get final review details for a reference
 */
router.get('/:id', authenticateStaff, requireFinalReviewRole, async (req: StaffAuthRequest, res) => {
  try {
    let id = req.params.id

    // The frontend may pass a work item ID instead of a reference ID
    // Try as reference first, then fall back to work item lookup
    let refResult = await getReferenceDecrypted(id)
    if (!refResult) {
      // Try looking up as a work item ID
      const { data: workItem } = await supabase
        .from('work_items_v2')
        .select('reference_id')
        .eq('id', id)
        .maybeSingle()

      if (workItem?.reference_id) {
        id = workItem.reference_id
        refResult = await getReferenceDecrypted(id)
      }
    }
    if (!refResult) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Get all sections with decisions
    const sections = await getSections(id)

    // Get verbal references
    const verbalReferences = await getVerbalReferencesForReference(id)

    // Get company name
    let companyName = 'Unknown'
    if (refResult.reference.company_id) {
      const { data: company } = await supabase
        .from('companies')
        .select('*')
        .eq('id', refResult.reference.company_id)
        .maybeSingle()
      if (company) {
        const co = company as any
        companyName = co.name || (co.name_encrypted ? decrypt(co.name_encrypted) : null) || co.company_name || 'Unknown'
      }
    }

    // Build response based on whether group or single
    let response: any = {
      reference: {
        ...refResult.reference,
        tenant_first_name: decrypt(refResult.reference.tenant_first_name_encrypted),
        tenant_last_name: decrypt(refResult.reference.tenant_last_name_encrypted),
        tenant_email: decrypt(refResult.reference.tenant_email_encrypted),
        property_address: decrypt(refResult.reference.property_address_encrypted),
        property_city: decrypt(refResult.reference.property_city_encrypted),
        property_postcode: decrypt(refResult.reference.property_postcode_encrypted),
        company_name: companyName
      },
      sections,
      verbalReferences,
      isGroup: refResult.reference.is_group_parent
    }

    // If group parent, get all children with their sections
    if (refResult.reference.is_group_parent) {
      const children = await getGroupChildren(id)

      const childrenWithDetails = await Promise.all(
        children.map(async (child) => {
          const childSections = await getSections(child.id)
          const childVerbalRefs = await getVerbalReferencesForReference(child.id)
          const guarantor = await getGuarantor(child.id)

          let guarantorDetails = null
          if (guarantor) {
            const guarantorSections = await getSections(guarantor.id)
            guarantorDetails = {
              ...guarantor,
              tenant_first_name: decrypt(guarantor.tenant_first_name_encrypted),
              tenant_last_name: decrypt(guarantor.tenant_last_name_encrypted),
              sections: guarantorSections
            }
          }

          return {
            ...child,
            tenant_first_name: decrypt(child.tenant_first_name_encrypted),
            tenant_last_name: decrypt(child.tenant_last_name_encrypted),
            sections: childSections,
            verbalReferences: childVerbalRefs,
            guarantor: guarantorDetails
          }
        })
      )

      response.children = childrenWithDetails
    } else {
      // Single tenant - check for guarantor
      const guarantor = await getGuarantor(id)
      if (guarantor) {
        const guarantorSections = await getSections(guarantor.id)
        response.guarantor = {
          ...guarantor,
          tenant_first_name: decrypt(guarantor.tenant_first_name_encrypted),
          tenant_last_name: decrypt(guarantor.tenant_last_name_encrypted),
          sections: guarantorSections
        }
      }
    }

    res.json(response)
  } catch (error: any) {
    console.error('[V2 FinalReview] Error getting details:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Claim a final review work item
 */
router.post('/:id/claim', authenticateStaff, requireFinalReviewRole, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params // This is the work item ID
    const staffUser = req.staffUser

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' })
    }

    const success = await claimWorkItem(id, staffUser.id)
    if (!success) {
      return res.status(400).json({ error: 'Failed to claim. Item may have been claimed by another assessor.' })
    }

    res.json({ message: 'Final review claimed', workItemId: id })
  } catch (error: any) {
    console.error('[V2 FinalReview] Error claiming:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Release a final review work item
 */
router.post('/:id/release', authenticateStaff, requireFinalReviewRole, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params

    const success = await releaseWorkItem(id)
    if (!success) {
      return res.status(400).json({ error: 'Failed to release work item' })
    }

    res.json({ message: 'Final review released', workItemId: id })
  } catch (error: any) {
    console.error('[V2 FinalReview] Error releasing:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Submit final decision
 */
router.post('/:referenceId/decision', authenticateStaff, requireFinalReviewRole, async (req: StaffAuthRequest, res) => {
  try {
    const { referenceId } = req.params
    const staffUser = req.staffUser
    const { decision, notes, workItemId, conditionText } = req.body

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' })
    }

    // Validate decision
    const validDecisions: V2ReferenceStatus[] = [
      'ACCEPTED',
      'ACCEPTED_WITH_GUARANTOR',
      'ACCEPTED_ON_CONDITION',
      'REJECTED'
    ]

    if (!validDecisions.includes(decision)) {
      return res.status(400).json({
        error: 'Invalid decision. Must be ACCEPTED, ACCEPTED_WITH_GUARANTOR, ACCEPTED_ON_CONDITION, or REJECTED'
      })
    }

    // Require notes for conditional acceptance or rejection
    if ((decision === 'ACCEPTED_ON_CONDITION' || decision === 'REJECTED') && !notes) {
      return res.status(400).json({ error: 'Notes required for this decision type' })
    }

    // Build final notes with condition text if provided
    const finalNotes = conditionText ? `CONDITION: ${conditionText}\n\n${notes || ''}`.trim() : (notes || null)

    // Determine if this reference is part of a group (multi-tenant or has guarantor)
    const reference = await getReference(referenceId)
    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Safety net: ensure all sections on this reference have a decision before allowing
    // a final review decision. Prevents the bug where references could be approved/rejected
    // with incomplete sections (e.g. INCOME never assessed).
    {
      const { supabase: sb } = await import('../../config/supabase')
      const { data: refSections } = await sb
        .from('reference_sections_v2')
        .select('section_type, decision')
        .eq('reference_id', referenceId)

      const undecided = (refSections || []).filter(s => !s.decision).map(s => s.section_type)
      if (undecided.length > 0) {
        return res.status(400).json({
          error: `Cannot submit final decision — the following sections still need to be assessed: ${undecided.join(', ')}`,
          undecided_sections: undecided,
        })
      }
    }

    const hasParent = !!reference.parent_reference_id
    const isGroupParent = !!reference.is_group_parent
    const guarantor = await getGuarantor(referenceId)
    const hasGuarantor = !!guarantor
    const isGuarantorRef = !!reference.is_guarantor || !!reference.guarantor_for_reference_id

    // Determine if this is a multi/guarantor flow
    // Also includes when this reference IS a guarantor (needs INDIVIDUAL_COMPLETE before group assessment)
    const isMultiOrGuarantor = hasParent || isGroupParent || hasGuarantor || isGuarantorRef

    if (isMultiOrGuarantor) {
      // ============================================================
      // MULTI-TENANT / GUARANTOR FLOW: Mark INDIVIDUAL_COMPLETE
      // ============================================================
      console.log(`[V2 FinalReview] Multi/guarantor flow for ${referenceId}. Setting INDIVIDUAL_COMPLETE.`)

      // Update THIS reference to INDIVIDUAL_COMPLETE (not the final decision)
      const success = await updateReferenceStatus(referenceId, 'INDIVIDUAL_COMPLETE' as V2ReferenceStatus, {
        finalDecisionNotes: finalNotes,
        finalDecisionBy: staffUser.id
      })

      if (!success) {
        return res.status(500).json({ error: 'Failed to update reference status' })
      }

      // Store the intended decision in final_decision_notes so group assessor can see it
      // We prefix with the intended decision for reference
      const intendedDecisionNote = `INDIVIDUAL_DECISION: ${decision}${finalNotes ? '\n' + finalNotes : ''}`
      await supabase
        .from('tenant_references_v2')
        .update({ final_decision_notes: intendedDecisionNote })
        .eq('id', referenceId)

      // Complete the FINAL_REVIEW work item
      if (workItemId) {
        await completeWorkItem(workItemId)
      } else {
        const { data: workItem } = await supabase
          .from('work_items_v2')
          .select('id')
          .eq('reference_id', referenceId)
          .eq('work_type', 'FINAL_REVIEW')
          .in('status', ['AVAILABLE', 'IN_PROGRESS', 'ASSIGNED'])
          .maybeSingle()
        if (workItem) {
          await completeWorkItem(workItem.id)
        }
      }

      // Generate individual PDF report
      let reportPdfUrl: string | null = null
      try {
        reportPdfUrl = await generateAndUploadV2Report(referenceId)
        console.log(`[V2 FinalReview] Individual PDF report generated: ${reportPdfUrl}`)
      } catch (pdfError: any) {
        console.error('[V2 FinalReview] Error generating individual PDF:', pdfError.message)
      }

      // Send brief agent notification about individual completion
      try {
        const result = await getReferenceDecrypted(referenceId)
        if (result) {
          const { data: company } = await supabase
            .from('companies')
            .select('*')
            .eq('id', result.reference.company_id)
            .maybeSingle()

          const co = company as any
          let agentEmail: string | null = null
          if (result.reference.created_by) {
            const { data: authUser } = await supabase.auth.admin.getUserById(result.reference.created_by)
            if (authUser?.user?.email) agentEmail = authUser.user.email
          }
          if (!agentEmail && co?.email_encrypted) agentEmail = decrypt(co.email_encrypted)
          if (!agentEmail && co?.email) agentEmail = co.email

          if (agentEmail) {
            const agentHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f3f4f6;">
              <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                <div style="background:#f97316;padding:24px;text-align:center;">
                  <img src="https://app.propertygoose.co.uk/PropertyGooseLogo.png" alt="PropertyGoose" style="height:40px;" />
                </div>
                <div style="padding:32px;">
                  <div style="background:#eff6ff;border-radius:8px;padding:12px;text-align:center;margin-bottom:20px;">
                    <h2 style="margin:0;color:#1d4ed8;font-size:20px;">Individual Assessment Complete</h2>
                  </div>
                  <p style="font-size:15px;color:#374151;">The individual assessment for <strong>${result.tenantName}</strong> at <strong>${result.propertyAddress || 'the property'}</strong> has been completed. Awaiting group assessment.</p>
                  <p style="font-size:13px;color:#9ca3af;margin-top:20px;">Reference: ${result.reference.reference_number || referenceId}</p>
                </div>
                <div style="padding:16px;text-align:center;border-top:1px solid #e5e7eb;">
                  <p style="font-size:12px;color:#9ca3af;margin:0;">&copy; ${new Date().getFullYear()} PropertyGoose. This is an automated message.</p>
                </div>
              </div>
            </body></html>`

            await sendEmail({
              to: agentEmail,
              subject: `Individual Assessment Complete - ${result.tenantName} - Awaiting Group Assessment`,
              html: agentHtml
            })
            console.log(`[V2 FinalReview] Individual complete notification sent to agent: ${agentEmail}`)
          }
        }
      } catch (notifyErr: any) {
        console.error('[V2 FinalReview] Error sending individual complete notification:', notifyErr.message || notifyErr)
      }

      // Check if ALL group members are now INDIVIDUAL_COMPLETE
      // For guarantors, find the tenant they're guaranteeing and check from that context
      let parentId = reference.parent_reference_id || (isGroupParent ? referenceId : null)
      let tenantForGuarantor: string | null = null
      let allGroupComplete = false

      if (isGuarantorRef && reference.guarantor_for_reference_id) {
        // This IS a guarantor — find the tenant it belongs to
        tenantForGuarantor = reference.guarantor_for_reference_id
        const tenantRef = await getReference(tenantForGuarantor)
        if (tenantRef?.parent_reference_id) {
          // Tenant is part of a multi-tenant group
          parentId = tenantRef.parent_reference_id
        }
      }

      if (parentId) {
        allGroupComplete = await checkAllGroupMembersComplete(parentId)
      } else if (isGuarantorRef && tenantForGuarantor) {
        // Guarantor for a single tenant (no group parent)
        // Check if the tenant is also INDIVIDUAL_COMPLETE
        const tenantRef = await getReference(tenantForGuarantor)
        allGroupComplete = tenantRef?.status === 'INDIVIDUAL_COMPLETE'
        if (!allGroupComplete) {
          console.log(`[V2 FinalReview] Tenant ${tenantForGuarantor} not yet INDIVIDUAL_COMPLETE. Waiting for tenant.`)
        }
      } else if (hasGuarantor && !hasParent && !isGroupParent) {
        // Single tenant with guarantor — check if guarantor is also done
        const guarantorRef = await getReference(guarantor!.id)
        allGroupComplete = guarantorRef?.status === 'INDIVIDUAL_COMPLETE'
        if (!allGroupComplete) {
          console.log(`[V2 FinalReview] Guarantor ${guarantor!.id} not yet INDIVIDUAL_COMPLETE. Waiting.`)
        }
      }

      if (allGroupComplete && parentId) {
        console.log(`[V2 FinalReview] All group members INDIVIDUAL_COMPLETE for parent ${parentId}. Creating GROUP_ASSESSMENT.`)

        // Move all to GROUP_ASSESSMENT status
        const parentRef = await getReference(parentId)
        const children = await getGroupChildren(parentId)
        const allMemberIds = [parentId, ...children.map(c => c.id)]

        // Also get all guarantors
        for (const child of children) {
          const childGuarantor = await getGuarantor(child.id)
          if (childGuarantor) allMemberIds.push(childGuarantor.id)
        }
        if (parentRef && !parentRef.is_group_parent) {
          const parentGuarantor = await getGuarantor(parentId)
          if (parentGuarantor) allMemberIds.push(parentGuarantor.id)
        }

        // Update all to GROUP_ASSESSMENT
        for (const memberId of allMemberIds) {
          await supabase
            .from('tenant_references_v2')
            .update({
              status: 'GROUP_ASSESSMENT',
              updated_at: new Date().toISOString()
            })
            .eq('id', memberId)
        }

        // Create GROUP_ASSESSMENT work item on the parent reference
        const { data: existingGroupWI } = await supabase
          .from('work_items_v2')
          .select('id')
          .eq('reference_id', parentId)
          .eq('work_type', 'GROUP_ASSESSMENT')
          .maybeSingle()

        if (!existingGroupWI) {
          await supabase.from('work_items_v2').insert({
            reference_id: parentId,
            section_id: null,
            work_type: 'GROUP_ASSESSMENT',
            status: 'AVAILABLE',
            priority: 15
          })
          console.log(`[V2 FinalReview] GROUP_ASSESSMENT work item created for parent ${parentId}`)
        }
      } else if (allGroupComplete && !parentId && (hasGuarantor || isGuarantorRef)) {
        // Single tenant + guarantor case — both complete, create group assessment
        const tenantId = isGuarantorRef ? tenantForGuarantor! : referenceId
        const guarantorId = isGuarantorRef ? referenceId : guarantor!.id
        console.log(`[V2 FinalReview] Tenant + guarantor both INDIVIDUAL_COMPLETE. Creating GROUP_ASSESSMENT for tenant ${tenantId}.`)

        await supabase
          .from('tenant_references_v2')
          .update({ status: 'GROUP_ASSESSMENT', updated_at: new Date().toISOString() })
          .eq('id', tenantId)
        await supabase
          .from('tenant_references_v2')
          .update({ status: 'GROUP_ASSESSMENT', updated_at: new Date().toISOString() })
          .eq('id', guarantorId)

        const { data: existingGroupWI } = await supabase
          .from('work_items_v2')
          .select('id')
          .eq('reference_id', tenantId)
          .eq('work_type', 'GROUP_ASSESSMENT')
          .maybeSingle()

        if (!existingGroupWI) {
          await supabase.from('work_items_v2').insert({
            reference_id: tenantId,
            section_id: null,
            work_type: 'GROUP_ASSESSMENT',
            status: 'AVAILABLE',
            priority: 15
          })
          console.log(`[V2 FinalReview] GROUP_ASSESSMENT work item created for tenant+guarantor ${tenantId}`)
        }
      }

      res.json({
        message: 'Individual assessment complete. Awaiting group assessment.',
        referenceId,
        decision: 'INDIVIDUAL_COMPLETE',
        intendedDecision: decision,
        notes,
        reportPdfUrl
      })
    } else {
      // ============================================================
      // SINGLE TENANT FLOW: Keep existing behavior exactly
      // ============================================================

      // Update reference status
      const success = await updateReferenceStatus(referenceId, decision, {
        finalDecisionNotes: finalNotes,
        finalDecisionBy: staffUser.id
      })

      if (!success) {
        return res.status(500).json({ error: 'Failed to update reference status' })
      }

      // Complete the FINAL_REVIEW work item
      if (workItemId) {
        await completeWorkItem(workItemId)
      } else {
        const { data: workItem } = await supabase
          .from('work_items_v2')
          .select('id')
          .eq('reference_id', referenceId)
          .eq('work_type', 'FINAL_REVIEW')
          .in('status', ['AVAILABLE', 'IN_PROGRESS', 'ASSIGNED'])
          .maybeSingle()
        if (workItem) {
          await completeWorkItem(workItem.id)
        }
      }

      // Generate PDF report
      let reportPdfUrl: string | null = null
      try {
        reportPdfUrl = await generateAndUploadV2Report(referenceId)
        console.log(`[V2 FinalReview] PDF report generated: ${reportPdfUrl}`)
      } catch (pdfError: any) {
        console.error('[V2 FinalReview] Error generating PDF:', pdfError.message)
      }

      // Send notification email to agent
      try {
        const result = await getReferenceDecrypted(referenceId)
        if (result) {
          const { data: company } = await supabase
            .from('companies')
            .select('*')
            .eq('id', result.reference.company_id)
            .maybeSingle()

          const co = company as any
          const agentCompanyName = co?.name || (co?.name_encrypted ? decrypt(co.name_encrypted) : null) || 'PropertyGoose'

          let agentEmail: string | null = null
          if (result.reference.created_by) {
            const { data: authUser } = await supabase.auth.admin.getUserById(result.reference.created_by)
            if (authUser?.user?.email) agentEmail = authUser.user.email
          }
          if (!agentEmail && co?.email_encrypted) {
            agentEmail = decrypt(co.email_encrypted)
          }
          if (!agentEmail && co?.email) {
            agentEmail = co.email
          }

          if (agentEmail) {
            const isAccepted = ['ACCEPTED', 'ACCEPTED_WITH_GUARANTOR', 'ACCEPTED_ON_CONDITION'].includes(decision)
            const statusLabel = isAccepted ? 'Accepted' : 'Rejected'
            const statusColor = isAccepted ? '#16a34a' : '#dc2626'
            const statusBg = isAccepted ? '#f0fdf4' : '#fef2f2'
            const reportButton = reportPdfUrl ? `
              <div style="margin: 20px 0; text-align: center;">
                <a href="${reportPdfUrl}" style="display: inline-block; padding: 12px 28px; background-color: #f97316; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 8px; font-size: 14px;">View Full Report</a>
              </div>` : ''

            const agentHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f3f4f6;">
              <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                <div style="background:#f97316;padding:24px;text-align:center;">
                  <img src="https://app.propertygoose.co.uk/PropertyGooseLogo.png" alt="PropertyGoose" style="height:40px;" />
                </div>
                <div style="padding:32px;">
                  <div style="background:${statusBg};border-radius:8px;padding:12px;text-align:center;margin-bottom:20px;">
                    <h2 style="margin:0;color:${statusColor};font-size:20px;">Reference ${statusLabel}</h2>
                  </div>
                  <p style="font-size:15px;color:#374151;">The reference for <strong>${result.tenantName}</strong> at <strong>${result.propertyAddress || 'the property'}</strong> has been <strong style="color:${statusColor}">${statusLabel}</strong>.</p>
                  ${finalNotes ? `<p style="font-size:14px;color:#6b7280;margin-top:12px;"><em>Notes: ${finalNotes}</em></p>` : ''}
                  ${reportButton}
                  <p style="font-size:13px;color:#9ca3af;margin-top:20px;">Reference: ${result.reference.reference_number || referenceId}</p>
                </div>
                <div style="padding:16px;text-align:center;border-top:1px solid #e5e7eb;">
                  <p style="font-size:12px;color:#9ca3af;margin:0;">&copy; ${new Date().getFullYear()} PropertyGoose. This is an automated message.</p>
                </div>
              </div>
            </body></html>`

            await sendEmail({
              to: agentEmail,
              subject: `Reference ${statusLabel} - ${result.tenantName} - ${result.propertyAddress || 'Property'}`,
              html: agentHtml
            })
            console.log(`[V2 FinalReview] Notification sent to agent: ${agentEmail}`)
          } else {
            console.warn('[V2 FinalReview] No agent email found for notification')
          }
        }
      } catch (notifyErr: any) {
        console.error('[V2 FinalReview] Error sending agent notification:', notifyErr.message || notifyErr)
      }

      // Send tenant email notification — neutral "References Completed" (don't reveal decision)
      try {
        const buildTenantEmailHtml = (propertyAddress: string, refNumber: string | null) => {
          const bodyText = `<p style="margin: 0 0 16px; font-size: 15px; color: #374151;">Your reference checks for <strong>${propertyAddress}</strong> have now been completed.</p><p style="margin: 0 0 16px; font-size: 15px; color: #374151;">Your letting agent will be in touch with the next steps regarding your application.</p>`
          const refLine = refNumber ? `<p style="margin: 0 0 16px; font-size: 13px; color: #6b7280;">Reference: ${refNumber}</p>` : ''
          return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f3f4f6;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);"><tr><td style="background-color:#f97316;padding:24px;text-align:center;"><img src="https://app.propertygoose.co.uk/PropertyGooseLogo.png" alt="PropertyGoose" style="height:40px;" /></td></tr><tr><td style="padding:32px;"><div style="background-color:#f0fdf4;border-radius:8px;padding:16px;margin-bottom:24px;text-align:center;"><span style="font-size:18px;font-weight:700;color:#16a34a;">References Completed</span></div>${bodyText}${refLine}</td></tr><tr><td style="padding:24px;background-color:#f9fafb;text-align:center;border-top:1px solid #e5e7eb;"><p style="margin:0;font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} PropertyGoose. This is an automated message.</p></td></tr></table></td></tr></table></body></html>`
        }

        const sendTenantNotification = async (refId: string) => {
          const refData = await getReferenceDecrypted(refId)
          if (!refData) return
          const tenantEmail = decrypt(refData.reference.tenant_email_encrypted)
          if (!tenantEmail) return
          const propertyAddress = refData.propertyAddress || 'your property'
          const refNumber = refData.reference.reference_number || null
          const html = buildTenantEmailHtml(propertyAddress, refNumber)
          await sendEmail({
            to: tenantEmail,
            subject: `References Completed - ${propertyAddress}`,
            html
          })
          console.log(`[V2 FinalReview] Tenant notification sent to: ${tenantEmail}`)
        }

        await sendTenantNotification(referenceId)
      } catch (tenantNotifyErr) {
        console.error('[V2 FinalReview] Error sending tenant notification:', tenantNotifyErr)
      }

      res.json({
        message: 'Final decision submitted',
        referenceId,
        decision,
        notes,
        reportPdfUrl
      })
    }
  } catch (error: any) {
    console.error('[V2 FinalReview] Error submitting decision:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Regenerate PDF report for a reference
 */
router.post('/:referenceId/regenerate-report', authenticateStaff, requireFinalReviewRole, async (req: StaffAuthRequest, res) => {
  try {
    const { referenceId } = req.params
    const pdfUrl = await generateAndUploadV2Report(referenceId)
    res.json({ success: true, reportPdfUrl: pdfUrl })
  } catch (error: any) {
    console.error('[V2 FinalReview] Error regenerating PDF:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if all group members (parent + children + guarantors) are INDIVIDUAL_COMPLETE
 */
async function checkAllGroupMembersComplete(parentReferenceId: string): Promise<boolean> {
  try {
    // Get parent
    const { data: parent } = await supabase
      .from('tenant_references_v2')
      .select('id, status, is_group_parent')
      .eq('id', parentReferenceId)
      .single()

    if (!parent) return false

    // Get all children (tenants, not guarantors)
    const { data: children } = await supabase
      .from('tenant_references_v2')
      .select('id, status, is_guarantor')
      .eq('parent_reference_id', parentReferenceId)
      .eq('is_guarantor', false)

    if (!children || children.length === 0) return false

    // Statuses that count as "individually complete" — INDIVIDUAL_COMPLETE is canonical,
    // but children may already be ACCEPTED if processed earlier
    const completedStatuses = ['INDIVIDUAL_COMPLETE', 'ACCEPTED', 'ACCEPTED_WITH_GUARANTOR', 'ACCEPTED_ON_CONDITION', 'GROUP_ASSESSMENT']

    // Check all children are individually complete
    for (const child of children) {
      if (!completedStatuses.includes(child.status)) {
        console.log(`[V2 FinalReview] Child ${child.id} status is ${child.status}, not yet complete`)
        return false
      }

      // Check child's guarantor if any
      const { data: childGuarantor } = await supabase
        .from('tenant_references_v2')
        .select('id, status')
        .eq('guarantor_for_reference_id', child.id)
        .eq('is_guarantor', true)
        .maybeSingle()

      if (childGuarantor && !completedStatuses.includes(childGuarantor.status)) {
        console.log(`[V2 FinalReview] Guarantor ${childGuarantor.id} for child ${child.id} status is ${childGuarantor.status}, not yet complete`)
        return false
      }
    }

    // If parent is not a pure group parent (it also has sections), check its status too
    if (!parent.is_group_parent && !completedStatuses.includes(parent.status)) {
      return false
    }

    // Check parent's guarantor if any
    if (!parent.is_group_parent) {
      const { data: parentGuarantor } = await supabase
        .from('tenant_references_v2')
        .select('id, status')
        .eq('guarantor_for_reference_id', parentReferenceId)
        .eq('is_guarantor', true)
        .maybeSingle()

      if (parentGuarantor && !completedStatuses.includes(parentGuarantor.status)) {
        console.log(`[V2 FinalReview] Parent guarantor ${parentGuarantor.id} status is ${parentGuarantor.status}, not yet complete`)
        return false
      }
    }

    return true
  } catch (error) {
    console.error('[V2 FinalReview] Error checking group completion:', error)
    return false
  }
}

export default router

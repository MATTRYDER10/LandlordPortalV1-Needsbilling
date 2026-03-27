/**
 * V2 Group Assessment Routes
 *
 * Endpoints for group assessment decisions after all individual reviews are complete.
 * Allows assessor to review combined affordability and adjust rent shares.
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
import { getSections } from '../../services/v2/sectionServiceV2'
import {
  claimWorkItem,
  releaseWorkItem,
  completeWorkItem
} from '../../services/v2/workQueueServiceV2'
import { V2ReferenceStatus } from '../../services/v2/types'
import { generateAndUploadGroupCertificate } from '../../services/v2/groupCertificateV2'
import { sendEmail } from '../../services/emailService'

const router = Router()

// ============================================================================
// QUEUE
// ============================================================================

/**
 * Get group assessment queue
 */
router.get('/queue', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { limit } = req.query

    const { data: items, error } = await supabase
      .from('work_items_v2')
      .select(`
        *,
        reference:tenant_references_v2!work_items_v2_reference_id_fkey (
          id,
          company_id,
          reference_number,
          is_group_parent,
          tenant_first_name_encrypted,
          tenant_last_name_encrypted,
          property_address_encrypted,
          property_city_encrypted,
          monthly_rent,
          rent_share,
          status
        )
      `)
      .eq('work_type', 'GROUP_ASSESSMENT')
      .in('status', ['AVAILABLE', 'IN_PROGRESS'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit ? parseInt(limit as string) : 50)

    if (error) {
      console.error('[V2 GroupAssessment] Error getting queue:', error)
      return res.status(500).json({ error: error.message })
    }

    // Get company names
    const companyIds = [...new Set((items || []).map((i: any) => i.reference?.company_id).filter(Boolean))]
    let companyMap = new Map<string, string>()
    if (companyIds.length > 0) {
      const { data: companies } = await supabase
        .from('companies')
        .select('*')
        .in('id', companyIds)
      for (const c of (companies || [])) {
        const co = c as any
        const compName = co.name || (co.name_encrypted ? decrypt(co.name_encrypted) : null) || co.company_name || 'Unknown'
        companyMap.set(c.id, compName)
      }
    }

    // Count group members for each item
    const enrichedItems = await Promise.all(
      (items || []).map(async (item: any) => {
        const ref = item.reference
        const tenantName = ref
          ? `${decrypt(ref.tenant_first_name_encrypted) || ''} ${decrypt(ref.tenant_last_name_encrypted) || ''}`.trim() || 'Unknown'
          : 'Unknown'
        const propertyAddress = ref
          ? [decrypt(ref.property_address_encrypted), decrypt(ref.property_city_encrypted)].filter(Boolean).join(', ') || 'Unknown'
          : 'Unknown'

        let groupSize = 1
        if (ref) {
          const { count } = await supabase
            .from('tenant_references_v2')
            .select('*', { count: 'exact', head: true })
            .eq('parent_reference_id', ref.id)
            .eq('is_guarantor', false)

          groupSize = (count || 0) + 1 // +1 for parent or main tenant
        }

        return {
          id: item.id,
          reference_id: item.reference_id,
          work_type: item.work_type,
          status: item.status,
          assigned_to: item.assigned_to,
          tenant_name: tenantName,
          property_address: propertyAddress,
          company_name: ref ? (companyMap.get(ref.company_id) || 'Unknown') : 'Unknown',
          monthly_rent: ref?.monthly_rent || 0,
          rent_share: ref?.rent_share || ref?.monthly_rent || 0,
          is_group_parent: ref?.is_group_parent || false,
          group_size: groupSize,
          reference_number: ref?.reference_number || null
        }
      })
    )

    res.json({ items: enrichedItems })
  } catch (error: any) {
    console.error('[V2 GroupAssessment] Error getting queue:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// DETAIL
// ============================================================================

/**
 * Get full group details for assessment
 */
router.get('/:parentId', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    let parentId = req.params.parentId

    // The frontend may pass a work item ID — try as reference first, then look up work item
    let parentResult = await getReferenceDecrypted(parentId)
    if (!parentResult) {
      const { data: workItem } = await supabase
        .from('work_items_v2')
        .select('reference_id')
        .eq('id', parentId)
        .maybeSingle()
      if (workItem?.reference_id) {
        parentId = workItem.reference_id
        parentResult = await getReferenceDecrypted(parentId)
      }
    }
    if (!parentResult) {
      return res.status(404).json({ error: 'Parent reference not found' })
    }

    const parentRef = parentResult.reference

    // Get company info
    let companyName = 'Unknown'
    if (parentRef.company_id) {
      const { data: company } = await supabase
        .from('companies')
        .select('*')
        .eq('id', parentRef.company_id)
        .maybeSingle()
      if (company) {
        const co = company as any
        companyName = co.name || (co.name_encrypted ? decrypt(co.name_encrypted) : null) || co.company_name || 'Unknown'
      }
    }

    // Build parent detail
    const parentSections = await getSections(parentId)
    const parentDecrypted = {
      id: parentRef.id,
      reference_number: parentRef.reference_number,
      status: parentRef.status,
      is_group_parent: parentRef.is_group_parent,
      tenant_first_name: decrypt(parentRef.tenant_first_name_encrypted),
      tenant_last_name: decrypt(parentRef.tenant_last_name_encrypted),
      tenant_email: decrypt(parentRef.tenant_email_encrypted),
      property_address: decrypt(parentRef.property_address_encrypted),
      property_city: decrypt(parentRef.property_city_encrypted),
      property_postcode: decrypt(parentRef.property_postcode_encrypted),
      monthly_rent: parentRef.monthly_rent,
      rent_share: parentRef.rent_share,
      annual_income: parentRef.annual_income,
      affordability_ratio: parentRef.affordability_ratio,
      affordability_pass: parentRef.affordability_pass,
      final_decision_notes: parentRef.final_decision_notes,
      final_decision_by: parentRef.final_decision_by,
      sections: parentSections,
      company_name: companyName
    }

    // Helper: get effective annual income from checklist_results (assessor verified) or reference field
    function getEffectiveIncome(sections: any[], refAnnualIncome: number | null): number {
      const incomeSection = (sections || []).find((s: any) => s.section_type === 'INCOME')
      const checklist = (incomeSection?.section_data as any)?.checklist_results || {}
      return parseFloat(checklist.total_effective_income) || parseFloat(checklist.annual_income) || refAnnualIncome || 0
    }

    // Helper: parse intended decision from final_decision_notes or status
    function getIntendedDecision(notes: string | null, status?: string | null): string {
      // First try parsing from notes (INDIVIDUAL_DECISION: prefix)
      if (notes) {
        const match = notes.match(/INDIVIDUAL_DECISION:\s*(\w+)/)
        if (match) return match[1]
      }
      // Fallback: if status is a final decision status, use it directly
      // This handles guarantors that went through the single-tenant flow
      const finalStatuses = ['ACCEPTED', 'ACCEPTED_WITH_GUARANTOR', 'ACCEPTED_ON_CONDITION', 'REJECTED', 'INDIVIDUAL_COMPLETE', 'GROUP_ASSESSMENT']
      if (status && finalStatuses.includes(status)) {
        // INDIVIDUAL_COMPLETE and GROUP_ASSESSMENT mean they passed individual review
        if (status === 'INDIVIDUAL_COMPLETE' || status === 'GROUP_ASSESSMENT') return 'ACCEPTED'
        return status
      }
      return 'PENDING'
    }

    // Get all children with their sections and guarantors
    const children = await getGroupChildren(parentId)
    const childrenDetails = await Promise.all(
      children.filter(c => !c.is_guarantor).map(async (child) => {
        const childSections = await getSections(child.id)
        const childGuarantor = await getGuarantor(child.id)
        const effectiveIncome = getEffectiveIncome(childSections || [], child.annual_income)

        let guarantorDetail = null
        if (childGuarantor) {
          const guarantorSections = await getSections(childGuarantor.id)
          const gIncome = getEffectiveIncome(guarantorSections || [], childGuarantor.annual_income)

          guarantorDetail = {
            id: childGuarantor.id,
            reference_number: childGuarantor.reference_number,
            status: childGuarantor.status,
            tenant_first_name: decrypt(childGuarantor.tenant_first_name_encrypted),
            tenant_last_name: decrypt(childGuarantor.tenant_last_name_encrypted),
            tenant_email: decrypt(childGuarantor.tenant_email_encrypted),
            annual_income: gIncome,
            max_affordable_rent: gIncome ? Math.round((gIncome / 32) * 100) / 100 : null,
            final_decision_notes: childGuarantor.final_decision_notes,
            individual_decision: getIntendedDecision(childGuarantor.final_decision_notes, childGuarantor.status),
            report_pdf_url: childGuarantor.report_pdf_url,
            sections: guarantorSections
          }
        }

        // If tenant has no income but has guarantor, use guarantor's max affordable rent
        let maxAffordableRent = effectiveIncome ? Math.round((effectiveIncome / 30) * 100) / 100 : null
        if (!maxAffordableRent && guarantorDetail) {
          maxAffordableRent = guarantorDetail.max_affordable_rent
        }

        return {
          id: child.id,
          reference_number: child.reference_number,
          status: child.status,
          tenant_first_name: decrypt(child.tenant_first_name_encrypted),
          tenant_last_name: decrypt(child.tenant_last_name_encrypted),
          tenant_email: decrypt(child.tenant_email_encrypted),
          annual_income: effectiveIncome,
          rent_share: child.rent_share,
          max_affordable_rent: maxAffordableRent,
          final_decision_notes: child.final_decision_notes,
          individual_decision: getIntendedDecision(child.final_decision_notes, child.status),
          report_pdf_url: child.report_pdf_url,
          sections: childSections,
          guarantor: guarantorDetail
        }
      })
    )

    // Check if parent has a guarantor (works for both single tenant and group parent)
    let parentGuarantor = null
    {
      const gRef = await getGuarantor(parentId)
      if (gRef) {
        const gSections = await getSections(gRef.id)
        const gEffectiveIncome = getEffectiveIncome(gSections || [], gRef.annual_income)
        const maxAffordableRent = gEffectiveIncome
          ? Math.round((gEffectiveIncome / 32) * 100) / 100
          : null

        parentGuarantor = {
          id: gRef.id,
          reference_number: gRef.reference_number,
          status: gRef.status,
          tenant_first_name: decrypt(gRef.tenant_first_name_encrypted),
          tenant_last_name: decrypt(gRef.tenant_last_name_encrypted),
          tenant_email: decrypt(gRef.tenant_email_encrypted),
          annual_income: gEffectiveIncome,
          affordability_ratio: gRef.affordability_ratio,
          affordability_pass: gRef.affordability_pass,
          max_affordable_rent: maxAffordableRent,
          final_decision_notes: gRef.final_decision_notes,
          sections: gSections
        }
      }
    }

    // Calculate parent income and affordability from sections
    const parentEffectiveIncome = getEffectiveIncome(parentSections || [], parentRef.annual_income)
    let parentMaxAffordableRent = parentEffectiveIncome
      ? Math.round((parentEffectiveIncome / 30) * 100) / 100
      : null
    // If parent has no income but has guarantor, use guarantor's max affordable rent
    if (!parentMaxAffordableRent && parentGuarantor) {
      parentMaxAffordableRent = parentGuarantor.max_affordable_rent
    }

    // Build full members list — parent + children (for frontend to iterate)
    const allMembers = []

    // Include parent as a member if it has sections (it's both parent and tenant)
    if (parentSections && parentSections.length > 0) {
      allMembers.push({
        id: parentRef.id,
        reference_number: parentRef.reference_number,
        status: parentRef.status,
        tenant_first_name: decrypt(parentRef.tenant_first_name_encrypted),
        tenant_last_name: decrypt(parentRef.tenant_last_name_encrypted),
        annual_income: parentEffectiveIncome,
        rent_share: parentRef.rent_share,
        max_affordable_rent: parentMaxAffordableRent,
        final_decision_notes: parentRef.final_decision_notes,
        individual_decision: getIntendedDecision(parentRef.final_decision_notes, parentRef.status),
        report_pdf_url: parentRef.report_pdf_url,
        sections: parentSections,
        guarantor: parentGuarantor,
        is_parent: true
      })
    }

    // Add children
    for (const child of childrenDetails) {
      allMembers.push({ ...child, is_parent: false })
    }

    res.json({
      parent: {
        ...parentDecrypted,
        annual_income: parentEffectiveIncome,
        max_affordable_rent: parentMaxAffordableRent,
        individual_decision: getIntendedDecision(parentRef.final_decision_notes, parentRef.status),
        report_pdf_url: parentRef.report_pdf_url,
        guarantor: parentGuarantor
      },
      children: childrenDetails,
      members: allMembers,
      totalMonthlyRent: parentRef.monthly_rent || 0,
      companyName
    })
  } catch (error: any) {
    console.error('[V2 GroupAssessment] Error getting group details:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// CLAIM / RELEASE
// ============================================================================

/**
 * Claim a group assessment work item
 */
router.post('/:id/claim', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params
    const staffUser = req.staffUser

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' })
    }

    const success = await claimWorkItem(id, staffUser.id)
    if (!success) {
      return res.status(400).json({ error: 'Failed to claim. Item may have been claimed by another assessor.' })
    }

    res.json({ message: 'Group assessment claimed', workItemId: id })
  } catch (error: any) {
    console.error('[V2 GroupAssessment] Error claiming:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Release a group assessment work item
 */
router.post('/:id/release', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params

    const success = await releaseWorkItem(id)
    if (!success) {
      return res.status(400).json({ error: 'Failed to release work item' })
    }

    res.json({ message: 'Group assessment released', workItemId: id })
  } catch (error: any) {
    console.error('[V2 GroupAssessment] Error releasing:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// DECISION
// ============================================================================

/**
 * Submit group assessment decision
 */
router.post('/:parentId/decision', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { parentId } = req.params
    const staffUser = req.staffUser
    const { decision, notes, rentShares, workItemId } = req.body

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

    if ((decision === 'ACCEPTED_ON_CONDITION' || decision === 'REJECTED') && !notes) {
      return res.status(400).json({ error: 'Notes required for this decision type' })
    }

    const finalNotes = notes || null

    // Get parent reference
    const parentRef = await getReference(parentId)
    if (!parentRef) {
      return res.status(404).json({ error: 'Parent reference not found' })
    }

    // Update rent shares if provided
    if (rentShares && Array.isArray(rentShares)) {
      for (const rs of rentShares) {
        if (rs.referenceId && rs.rentShare !== undefined) {
          await supabase
            .from('tenant_references_v2')
            .update({
              rent_share: rs.rentShare,
              updated_at: new Date().toISOString()
            })
            .eq('id', rs.referenceId)
        }
      }
    }

    // Collect all member IDs
    const allMemberIds: string[] = [parentId]
    const children = await getGroupChildren(parentId)
    const tenantChildren = children.filter(c => !c.is_guarantor)

    for (const child of tenantChildren) {
      allMemberIds.push(child.id)
      const childGuarantor = await getGuarantor(child.id)
      if (childGuarantor) {
        allMemberIds.push(childGuarantor.id)
      }
    }

    // Also check for parent's guarantor (single tenant + guarantor case)
    const parentGuarantor = await getGuarantor(parentId)
    if (parentGuarantor) {
      allMemberIds.push(parentGuarantor.id)
    }

    // Update ALL group members to the final decision status
    for (const memberId of allMemberIds) {
      await updateReferenceStatus(memberId, decision, {
        finalDecisionNotes: finalNotes,
        finalDecisionBy: staffUser.id
      })
    }

    // Complete the GROUP_ASSESSMENT work item
    if (workItemId) {
      await completeWorkItem(workItemId)
    } else {
      const { data: wi } = await supabase
        .from('work_items_v2')
        .select('id')
        .eq('reference_id', parentId)
        .eq('work_type', 'GROUP_ASSESSMENT')
        .in('status', ['AVAILABLE', 'IN_PROGRESS', 'ASSIGNED'])
        .maybeSingle()
      if (wi) {
        await completeWorkItem(wi.id)
      }
    }

    // Generate group certificate PDF
    let certificatePdfUrl: string | null = null
    try {
      certificatePdfUrl = await generateAndUploadGroupCertificate(parentId)
      console.log(`[V2 GroupAssessment] Group certificate generated: ${certificatePdfUrl}`)
    } catch (pdfError: any) {
      console.error('[V2 GroupAssessment] Error generating group certificate:', pdfError.message)
    }

    // Send agent notification
    try {
      const parentResult = await getReferenceDecrypted(parentId)
      if (parentResult) {
        const { data: company } = await supabase
          .from('companies')
          .select('*')
          .eq('id', parentResult.reference.company_id)
          .maybeSingle()

        const co = company as any
        let agentEmail: string | null = null
        if (parentResult.reference.created_by) {
          const { data: authUser } = await supabase.auth.admin.getUserById(parentResult.reference.created_by)
          if (authUser?.user?.email) agentEmail = authUser.user.email
        }
        if (!agentEmail && co?.email_encrypted) agentEmail = decrypt(co.email_encrypted)
        if (!agentEmail && co?.email) agentEmail = co.email

        if (agentEmail) {
          const isAccepted = ['ACCEPTED', 'ACCEPTED_WITH_GUARANTOR', 'ACCEPTED_ON_CONDITION'].includes(decision)
          const statusLabel = isAccepted ? 'Accepted' : 'Rejected'
          const statusColor = isAccepted ? '#16a34a' : '#dc2626'
          const statusBg = isAccepted ? '#f0fdf4' : '#fef2f2'
          const reportButton = certificatePdfUrl ? `
            <div style="margin: 20px 0; text-align: center;">
              <a href="${certificatePdfUrl}" style="display: inline-block; padding: 12px 28px; background-color: #f97316; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 8px; font-size: 14px;">View Group Certificate</a>
            </div>` : ''

          const tenantNames = tenantChildren.map(c =>
            `${decrypt(c.tenant_first_name_encrypted) || ''} ${decrypt(c.tenant_last_name_encrypted) || ''}`.trim()
          ).join(', ')

          const agentHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f3f4f6;">
            <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
              <div style="background:#f97316;padding:24px;text-align:center;">
                <img src="https://app.propertygoose.co.uk/PropertyGooseLogo.png" alt="PropertyGoose" style="height:40px;" />
              </div>
              <div style="padding:32px;">
                <div style="background:${statusBg};border-radius:8px;padding:12px;text-align:center;margin-bottom:20px;">
                  <h2 style="margin:0;color:${statusColor};font-size:20px;">Group Assessment ${statusLabel}</h2>
                </div>
                <p style="font-size:15px;color:#374151;">The group assessment for <strong>${tenantNames || parentResult.tenantName}</strong> at <strong>${parentResult.propertyAddress || 'the property'}</strong> has been <strong style="color:${statusColor}">${statusLabel}</strong>.</p>
                ${finalNotes ? `<p style="font-size:14px;color:#6b7280;margin-top:12px;"><em>Notes: ${finalNotes}</em></p>` : ''}
                ${reportButton}
                <p style="font-size:13px;color:#9ca3af;margin-top:20px;">Reference: ${parentResult.reference.reference_number || parentId}</p>
              </div>
              <div style="padding:16px;text-align:center;border-top:1px solid #e5e7eb;">
                <p style="font-size:12px;color:#9ca3af;margin:0;">&copy; ${new Date().getFullYear()} PropertyGoose. This is an automated message.</p>
              </div>
            </div>
          </body></html>`

          await sendEmail({
            to: agentEmail,
            subject: `Group Assessment ${statusLabel} - ${parentResult.propertyAddress || 'Property'}`,
            html: agentHtml
          })
          console.log(`[V2 GroupAssessment] Agent notification sent to: ${agentEmail}`)
        }
      }
    } catch (notifyErr: any) {
      console.error('[V2 GroupAssessment] Error sending agent notification:', notifyErr.message || notifyErr)
    }

    // Send tenant notifications — neutral "References Completed" (don't reveal decision)
    try {
      const sendTenantNotification = async (refId: string) => {
        const refData = await getReferenceDecrypted(refId)
        if (!refData) return
        const tenantEmail = decrypt(refData.reference.tenant_email_encrypted)
        if (!tenantEmail) return
        const propertyAddress = refData.propertyAddress || 'your property'
        const refNumber = refData.reference.reference_number || null
        const bodyText = `<p style="margin: 0 0 16px; font-size: 15px; color: #374151;">Your reference checks for <strong>${propertyAddress}</strong> have now been completed.</p><p style="margin: 0 0 16px; font-size: 15px; color: #374151;">Your letting agent will be in touch with the next steps regarding your application.</p>`
        const refLine = refNumber ? `<p style="margin: 0 0 16px; font-size: 13px; color: #6b7280;">Reference: ${refNumber}</p>` : ''
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f3f4f6;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);"><tr><td style="background-color:#f97316;padding:24px;text-align:center;"><img src="https://app.propertygoose.co.uk/PropertyGooseLogo.png" alt="PropertyGoose" style="height:40px;" /></td></tr><tr><td style="padding:32px;"><div style="background-color:#f0fdf4;border-radius:8px;padding:16px;margin-bottom:24px;text-align:center;"><span style="font-size:18px;font-weight:700;color:#16a34a;">References Completed</span></div>${bodyText}${refLine}</td></tr><tr><td style="padding:24px;background-color:#f9fafb;text-align:center;border-top:1px solid #e5e7eb;"><p style="margin:0;font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} PropertyGoose. This is an automated message.</p></td></tr></table></td></tr></table></body></html>`

        await sendEmail({
          to: tenantEmail,
          subject: `References Completed - ${propertyAddress}`,
          html
        })
        console.log(`[V2 GroupAssessment] Tenant notification sent to: ${tenantEmail}`)
      }

      // Send to all tenant children (not guarantors)
      for (const child of tenantChildren) {
        try { await sendTenantNotification(child.id) } catch (e) {
          console.error(`[V2 GroupAssessment] Error sending tenant notification for ${child.id}:`, e)
        }
      }

      // If parent is not a pure group parent, also notify the parent tenant
      if (!parentRef.is_group_parent) {
        try { await sendTenantNotification(parentId) } catch (e) {
          console.error(`[V2 GroupAssessment] Error sending tenant notification for parent ${parentId}:`, e)
        }
      }
    } catch (tenantNotifyErr) {
      console.error('[V2 GroupAssessment] Error sending tenant notifications:', tenantNotifyErr)
    }

    res.json({
      message: 'Group assessment decision submitted',
      parentId,
      decision,
      notes,
      certificatePdfUrl
    })
  } catch (error: any) {
    console.error('[V2 GroupAssessment] Error submitting decision:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router

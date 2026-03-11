/**
 * V2 Reports Routes
 *
 * Endpoints for generating and delivering reference decision reports.
 */

import { Router, Response } from 'express'
import { authenticateStaff, StaffAuthRequest } from '../../middleware/staffAuth'
import { authenticateToken, AuthRequest } from '../../middleware/auth'
import { supabase } from '../../config/supabase'
import { decrypt } from '../../services/encryption'
import {
  generateV2ReportPdf,
  generateAndUploadV2Report
} from '../../services/v2/pdfReportServiceV2'
import { getReference, getReferenceDecrypted } from '../../services/v2/referenceServiceV2'
import { getSections } from '../../services/v2/sectionServiceV2'
import { sendEmail, loadEmailTemplate } from '../../services/emailService'

const router = Router()

// ============================================================================
// PDF DOWNLOAD
// ============================================================================

/**
 * Download reference report PDF
 * Staff can download any report, agents can download their company's reports
 */
router.get('/:referenceId/pdf', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { referenceId } = req.params
    const { regenerate } = req.query

    // Get reference to check access
    const reference = await getReference(referenceId)
    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Check if user has access (same company)
    if (req.user?.companyId !== reference.company_id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Check if reference has a final decision
    const finalStatuses = ['ACCEPTED', 'ACCEPTED_WITH_GUARANTOR', 'ACCEPTED_ON_CONDITION', 'REJECTED']
    if (!finalStatuses.includes(reference.status)) {
      return res.status(400).json({ error: 'Reference has not been finalized yet' })
    }

    // Check if we have a cached PDF and regenerate not requested
    if (reference.report_pdf_url && regenerate !== 'true') {
      // Redirect to the existing PDF
      return res.redirect(reference.report_pdf_url)
    }

    // Generate new PDF
    const pdfBuffer = await generateV2ReportPdf(referenceId)

    // Set headers for PDF download
    const firstName = decrypt(reference.tenant_first_name_encrypted) || 'Tenant'
    const lastName = decrypt(reference.tenant_last_name_encrypted) || ''
    const fileName = `Reference-Report-${firstName}-${lastName}-${referenceId.substring(0, 8)}.pdf`

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.setHeader('Content-Length', pdfBuffer.length)

    res.send(pdfBuffer)
  } catch (error: any) {
    console.error('[V2 Reports] Error generating PDF:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Staff-only: Generate and store PDF for a reference
 */
router.post('/:referenceId/generate', authenticateStaff, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { referenceId } = req.params

    const reference = await getReference(referenceId)
    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Generate and upload
    const pdfUrl = await generateAndUploadV2Report(referenceId)

    res.json({
      message: 'PDF generated successfully',
      pdfUrl
    })
  } catch (error: any) {
    console.error('[V2 Reports] Error generating PDF:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// JSON SUMMARY
// ============================================================================

/**
 * Get JSON summary of reference decision
 */
router.get('/:referenceId/summary', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { referenceId } = req.params

    const refResult = await getReferenceDecrypted(referenceId)
    if (!refResult) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Check access
    if (req.user?.companyId !== refResult.reference.company_id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const sections = await getSections(referenceId)

    // Build summary
    const summary = {
      referenceId,
      status: refResult.reference.status,
      tenant: {
        firstName: decrypt(refResult.reference.tenant_first_name_encrypted),
        lastName: decrypt(refResult.reference.tenant_last_name_encrypted),
        email: decrypt(refResult.reference.tenant_email_encrypted)
      },
      property: {
        address: decrypt(refResult.reference.property_address_encrypted),
        city: decrypt(refResult.reference.property_city_encrypted),
        postcode: decrypt(refResult.reference.property_postcode_encrypted),
        monthlyRent: refResult.reference.monthly_rent,
        rentShare: refResult.reference.rent_share
      },
      affordability: {
        ratio: refResult.reference.affordability_ratio,
        passes: refResult.reference.affordability_pass
      },
      sections: (sections || []).map(s => ({
        type: s.section_type,
        decision: s.decision,
        conditionText: s.condition_text,
        failReason: s.fail_reason,
        completedAt: s.completed_at
      })),
      finalDecision: {
        status: refResult.reference.status,
        notes: refResult.reference.final_decision_notes,
        decidedAt: refResult.reference.final_decision_at,
        decidedBy: refResult.reference.final_decision_by
      },
      isGroup: refResult.reference.is_group_parent,
      hasGuarantor: !!refResult.reference.guarantor_for_reference_id,
      reportPdfUrl: refResult.reference.report_pdf_url,
      reportGeneratedAt: refResult.reference.report_generated_at
    }

    res.json(summary)
  } catch (error: any) {
    console.error('[V2 Reports] Error getting summary:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// EMAIL DELIVERY
// ============================================================================

/**
 * Email report to agent/company
 */
router.post('/:referenceId/email', authenticateStaff, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { referenceId } = req.params
    const { recipientEmail, includeAttachment } = req.body

    const reference = await getReference(referenceId)
    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Get company details
    const { data: company } = await supabase
      .from('companies')
      .select('name, contact_email')
      .eq('id', reference.company_id)
      .single()

    const email = recipientEmail || company?.contact_email
    if (!email) {
      return res.status(400).json({ error: 'No recipient email provided or found' })
    }

    // Prepare email content
    const tenantName = `${decrypt(reference.tenant_first_name_encrypted)} ${decrypt(reference.tenant_last_name_encrypted)}`
    const propertyAddress = decrypt(reference.property_address_encrypted) || 'Property'
    const statusLabel = reference.status.replace(/_/g, ' ')

    let attachments: any[] = []
    if (includeAttachment !== false) {
      // Generate or use existing PDF
      let pdfBuffer: Buffer
      if (reference.report_pdf_url) {
        // Download existing PDF
        const response = await fetch(reference.report_pdf_url)
        pdfBuffer = Buffer.from(await response.arrayBuffer())
      } else {
        pdfBuffer = await generateV2ReportPdf(referenceId)
      }

      attachments = [{
        filename: `Reference-Report-${tenantName.replace(/\s+/g, '-')}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }]
    }

    // Load and send email
    const htmlContent = await loadEmailTemplate('reference-decision-notification', {
      CompanyName: company?.name || 'PropertyGoose',
      TenantName: tenantName,
      PropertyAddress: propertyAddress,
      Decision: statusLabel,
      DecisionNotes: reference.final_decision_notes || 'No additional notes.',
      DecisionDate: reference.final_decision_at
        ? new Date(reference.final_decision_at).toLocaleDateString('en-GB')
        : new Date().toLocaleDateString('en-GB')
    })

    await sendEmail({
      to: email,
      subject: `Reference Decision: ${tenantName} - ${statusLabel}`,
      html: htmlContent,
      attachments
    })

    res.json({
      message: 'Email sent successfully',
      recipient: email
    })
  } catch (error: any) {
    console.error('[V2 Reports] Error sending email:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router

/**
 * V2 PDF Report Service
 *
 * Generates reference decision reports for the V2 section-based verification system.
 */

import PDFDocument from 'pdfkit'
import { supabase } from '../../config/supabase'
import { decrypt } from '../encryption'
import path from 'path'
import axios from 'axios'
import QRCode from 'qrcode'
import {
  V2ReferenceRow,
  V2SectionRow,
  V2ReferenceStatus,
  V2SectionType,
  V2SectionDecision
} from './types'

// Font paths for Space Grotesk
const FONT_REGULAR = path.join(__dirname, '../../../assets/fonts/SpaceGrotesk-Regular.ttf')
const FONT_BOLD = path.join(__dirname, '../../../assets/fonts/SpaceGrotesk-Bold.ttf')

// Brand colors
const COLORS = {
  primary: '#f97316', // Orange
  success: '#22c55e', // Green
  warning: '#eab308', // Yellow
  danger: '#ef4444', // Red
  dark: '#1e293b',
  gray: '#64748b',
  lightGray: '#e2e8f0',
  white: '#ffffff'
}

// Section display names
const SECTION_NAMES: Record<V2SectionType, string> = {
  IDENTITY: 'Identity Verification',
  RTR: 'Right to Rent',
  INCOME: 'Income Verification',
  RESIDENTIAL: 'Residential History',
  CREDIT: 'Credit Check',
  AML: 'AML/Sanctions'
}

// Decision display config
const DECISION_CONFIG: Record<V2SectionDecision, { label: string; color: string }> = {
  PASS: { label: 'Passed', color: COLORS.success },
  PASS_WITH_CONDITION: { label: 'Passed with Condition', color: COLORS.warning },
  FAIL: { label: 'Failed', color: COLORS.danger }
}

// Final status display config
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ACCEPTED: { label: 'ACCEPTED', color: COLORS.success },
  ACCEPTED_WITH_GUARANTOR: { label: 'ACCEPTED WITH GUARANTOR', color: COLORS.success },
  ACCEPTED_ON_CONDITION: { label: 'ACCEPTED ON CONDITION', color: COLORS.warning },
  REJECTED: { label: 'REJECTED', color: COLORS.danger }
}

interface V2ReportData {
  reference: V2ReferenceRow
  sections: V2SectionRow[]
  verbalReferences: any[]
  guarantor?: {
    reference: V2ReferenceRow
    sections: V2SectionRow[]
  }
  children?: Array<{
    reference: V2ReferenceRow
    sections: V2SectionRow[]
    guarantor?: {
      reference: V2ReferenceRow
      sections: V2SectionRow[]
    }
  }>
  company: {
    name: string
    logoUrl?: string
    primaryColor?: string
  }
  reviewedBy?: string
}

/**
 * Generate a V2 reference report PDF
 */
export async function generateV2ReportPdf(referenceId: string): Promise<Buffer> {
  console.log(`[V2 PDF] Generating report for reference ${referenceId}...`)

  // Fetch all data needed for the report
  const reportData = await fetchReportData(referenceId)

  // Create PDF
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    bufferPages: true
  })

  const chunks: Buffer[] = []
  doc.on('data', (chunk) => chunks.push(chunk))

  // Register fonts
  try {
    doc.registerFont('Regular', FONT_REGULAR)
    doc.registerFont('Bold', FONT_BOLD)
  } catch (e) {
    console.warn('[V2 PDF] Custom fonts not available, using defaults')
  }

  // Generate report content
  await renderReport(doc, reportData)

  // Finalize
  doc.end()

  return new Promise((resolve, reject) => {
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks)
      console.log(`[V2 PDF] Report generated: ${pdfBuffer.length} bytes`)
      resolve(pdfBuffer)
    })
    doc.on('error', reject)
  })
}

/**
 * Fetch all data needed for the report
 */
async function fetchReportData(referenceId: string): Promise<V2ReportData> {
  // Fetch reference
  const { data: reference, error: refError } = await supabase
    .from('tenant_references_v2')
    .select('*')
    .eq('id', referenceId)
    .single()

  if (refError || !reference) {
    throw new Error(`Reference not found: ${referenceId}`)
  }

  // Fetch sections
  const { data: sections } = await supabase
    .from('reference_sections_v2')
    .select('*')
    .eq('reference_id', referenceId)
    .order('section_order', { ascending: true })

  // Fetch verbal references
  const { data: verbalRefs } = await supabase
    .from('verbal_references_v2')
    .select('*')
    .eq('reference_id', referenceId)

  // Fetch company
  const { data: company } = await supabase
    .from('companies')
    .select('name, logo_url, primary_color')
    .eq('id', reference.company_id)
    .single()

  // Fetch reviewer info if available
  let reviewedBy: string | undefined
  if (reference.final_decision_by) {
    const { data: staff } = await supabase
      .from('staff_users')
      .select('first_name, last_name')
      .eq('id', reference.final_decision_by)
      .single()
    if (staff) {
      reviewedBy = `${staff.first_name} ${staff.last_name}`
    }
  }

  const reportData: V2ReportData = {
    reference,
    sections: sections || [],
    verbalReferences: verbalRefs || [],
    company: {
      name: company?.name || 'PropertyGoose',
      logoUrl: company?.logo_url,
      primaryColor: company?.primary_color || COLORS.primary
    },
    reviewedBy
  }

  // Handle guarantor
  if (!reference.is_guarantor) {
    const { data: guarantor } = await supabase
      .from('tenant_references_v2')
      .select('*')
      .eq('guarantor_for_reference_id', referenceId)
      .single()

    if (guarantor) {
      const { data: guarantorSections } = await supabase
        .from('reference_sections_v2')
        .select('*')
        .eq('reference_id', guarantor.id)
        .order('section_order', { ascending: true })

      reportData.guarantor = {
        reference: guarantor,
        sections: guarantorSections || []
      }
    }
  }

  // Handle group children
  if (reference.is_group_parent) {
    const { data: children } = await supabase
      .from('tenant_references_v2')
      .select('*')
      .eq('parent_reference_id', referenceId)
      .eq('is_guarantor', false)

    if (children && children.length > 0) {
      reportData.children = await Promise.all(
        children.map(async (child) => {
          const { data: childSections } = await supabase
            .from('reference_sections_v2')
            .select('*')
            .eq('reference_id', child.id)
            .order('section_order', { ascending: true })

          const { data: childGuarantor } = await supabase
            .from('tenant_references_v2')
            .select('*')
            .eq('guarantor_for_reference_id', child.id)
            .single()

          let guarantorData
          if (childGuarantor) {
            const { data: gSections } = await supabase
              .from('reference_sections_v2')
              .select('*')
              .eq('reference_id', childGuarantor.id)
              .order('section_order', { ascending: true })

            guarantorData = {
              reference: childGuarantor,
              sections: gSections || []
            }
          }

          return {
            reference: child,
            sections: childSections || [],
            guarantor: guarantorData
          }
        })
      )
    }
  }

  return reportData
}

/**
 * Render the full report
 */
async function renderReport(doc: PDFKit.PDFDocument, data: V2ReportData): Promise<void> {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
  const primaryColor = data.company.primaryColor || COLORS.primary

  // Header with logo
  await renderHeader(doc, data, pageWidth, primaryColor)

  // Final Decision Banner
  renderDecisionBanner(doc, data.reference, pageWidth)

  doc.moveDown(1)

  // Property Details
  renderPropertySection(doc, data.reference, pageWidth)

  doc.moveDown(0.5)

  // Main tenant or lead tenant for groups
  if (data.reference.is_group_parent && data.children) {
    // Group application - show each tenant
    doc.font('Bold').fontSize(14).fillColor(COLORS.dark)
      .text('Group Application', { underline: true })
    doc.moveDown(0.5)

    for (let i = 0; i < data.children.length; i++) {
      const child = data.children[i]
      doc.font('Bold').fontSize(12).fillColor(primaryColor)
        .text(`Tenant ${i + 1}:`)
      renderTenantSection(doc, child.reference, child.sections, pageWidth)

      if (child.guarantor) {
        doc.moveDown(0.5)
        doc.font('Bold').fontSize(11).fillColor(COLORS.gray)
          .text('Guarantor:')
        renderTenantSection(doc, child.guarantor.reference, child.guarantor.sections, pageWidth, true)
      }

      if (i < data.children.length - 1) {
        doc.moveDown(1)
        doc.moveTo(doc.x, doc.y)
          .lineTo(doc.x + pageWidth, doc.y)
          .strokeColor(COLORS.lightGray)
          .stroke()
        doc.moveDown(1)
      }
    }
  } else {
    // Single tenant
    renderTenantSection(doc, data.reference, data.sections, pageWidth)

    if (data.guarantor) {
      doc.moveDown(1)
      doc.font('Bold').fontSize(14).fillColor(COLORS.dark)
        .text('Guarantor Details', { underline: true })
      doc.moveDown(0.5)
      renderTenantSection(doc, data.guarantor.reference, data.guarantor.sections, pageWidth, true)
    }
  }

  // Verbal References if any
  if (data.verbalReferences.length > 0) {
    doc.addPage()
    renderVerbalReferences(doc, data.verbalReferences, pageWidth)
  }

  // Final notes
  if (data.reference.final_decision_notes) {
    doc.moveDown(1)
    doc.font('Bold').fontSize(12).fillColor(COLORS.dark)
      .text('Decision Notes:')
    doc.font('Regular').fontSize(10).fillColor(COLORS.gray)
      .text(data.reference.final_decision_notes)
  }

  // Footer with reviewer info and PropertyGoose branding
  await renderFooter(doc, data, pageWidth)
}

/**
 * Render header with logo
 */
async function renderHeader(
  doc: PDFKit.PDFDocument,
  data: V2ReportData,
  pageWidth: number,
  primaryColor: string
): Promise<void> {
  const startY = doc.y

  // Try to load company logo
  if (data.company.logoUrl) {
    try {
      const response = await axios.get(data.company.logoUrl, { responseType: 'arraybuffer' })
      const logoBuffer = Buffer.from(response.data)
      doc.image(logoBuffer, doc.x, startY, { height: 40 })
    } catch (e) {
      // Fallback to text
      doc.font('Bold').fontSize(20).fillColor(primaryColor)
        .text(data.company.name, doc.x, startY)
    }
  } else {
    doc.font('Bold').fontSize(20).fillColor(primaryColor)
      .text(data.company.name, doc.x, startY)
  }

  // Report title
  doc.font('Bold').fontSize(16).fillColor(COLORS.dark)
    .text('Reference Decision Report', doc.x, startY + 50)

  doc.font('Regular').fontSize(10).fillColor(COLORS.gray)
    .text(`Generated: ${new Date().toLocaleString('en-GB')}`, doc.x, startY + 70)

  doc.moveDown(2)
}

/**
 * Render final decision banner
 */
function renderDecisionBanner(
  doc: PDFKit.PDFDocument,
  reference: V2ReferenceRow,
  pageWidth: number
): void {
  const status = reference.status as string
  const config = STATUS_CONFIG[status] || { label: status, color: COLORS.gray }

  const bannerHeight = 40
  const y = doc.y

  // Background
  doc.rect(doc.page.margins.left, y, pageWidth, bannerHeight)
    .fill(config.color)

  // Text
  doc.font('Bold').fontSize(18).fillColor(COLORS.white)
    .text(config.label, doc.page.margins.left, y + 10, {
      width: pageWidth,
      align: 'center'
    })

  doc.y = y + bannerHeight + 10
}

/**
 * Render property section
 */
function renderPropertySection(
  doc: PDFKit.PDFDocument,
  reference: V2ReferenceRow,
  pageWidth: number
): void {
  doc.font('Bold').fontSize(12).fillColor(COLORS.dark)
    .text('Property Details')

  doc.font('Regular').fontSize(10).fillColor(COLORS.gray)

  const propertyAddress = decrypt(reference.property_address_encrypted || '') || 'Not specified'
  const propertyCity = decrypt(reference.property_city_encrypted || '') || ''
  const propertyPostcode = decrypt(reference.property_postcode_encrypted || '') || ''

  doc.text(`Address: ${propertyAddress}`)
  if (propertyCity || propertyPostcode) {
    doc.text(`         ${propertyCity} ${propertyPostcode}`.trim())
  }
  doc.text(`Rent: £${reference.monthly_rent?.toFixed(2) || '0.00'} per month`)
  if (reference.rent_share && reference.rent_share !== reference.monthly_rent) {
    doc.text(`Rent Share: £${reference.rent_share.toFixed(2)} per month`)
  }
  doc.text(`Move-in Date: ${reference.move_in_date ? new Date(reference.move_in_date).toLocaleDateString('en-GB') : 'TBC'}`)
  doc.text(`Term: ${reference.term_years || 0} years ${reference.term_months || 0} months`)
}

/**
 * Render tenant section with verification results
 */
function renderTenantSection(
  doc: PDFKit.PDFDocument,
  reference: V2ReferenceRow,
  sections: V2SectionRow[],
  pageWidth: number,
  isGuarantor = false
): void {
  const firstName = decrypt(reference.tenant_first_name_encrypted || '') || ''
  const lastName = decrypt(reference.tenant_last_name_encrypted || '') || ''
  const email = decrypt(reference.tenant_email_encrypted || '') || ''
  const dob = decrypt(reference.tenant_dob_encrypted || '') || ''

  const label = isGuarantor ? 'Guarantor' : 'Tenant'

  doc.font('Bold').fontSize(11).fillColor(COLORS.dark)
    .text(`${label}: ${firstName} ${lastName}`)

  doc.font('Regular').fontSize(10).fillColor(COLORS.gray)
  if (email) doc.text(`Email: ${email}`)
  if (dob) doc.text(`Date of Birth: ${new Date(dob).toLocaleDateString('en-GB')}`)

  // Affordability
  if (reference.affordability_ratio) {
    const affordabilityColor = reference.affordability_pass ? COLORS.success : COLORS.danger
    doc.text(`Affordability Ratio: `, { continued: true })
    doc.fillColor(affordabilityColor)
      .text(`${(reference.affordability_ratio * 100).toFixed(1)}% ${reference.affordability_pass ? '(PASS)' : '(FAIL)'}`)
    doc.fillColor(COLORS.gray)
  }

  doc.moveDown(0.5)

  // Section results table
  doc.font('Bold').fontSize(10).fillColor(COLORS.dark)
    .text('Verification Results:')

  doc.moveDown(0.3)

  const tableTop = doc.y
  const colWidths = [pageWidth * 0.4, pageWidth * 0.25, pageWidth * 0.35]
  const rowHeight = 22

  // Table header
  doc.rect(doc.page.margins.left, tableTop, pageWidth, rowHeight)
    .fill(COLORS.lightGray)

  doc.font('Bold').fontSize(9).fillColor(COLORS.dark)
  doc.text('Section', doc.page.margins.left + 5, tableTop + 6)
  doc.text('Decision', doc.page.margins.left + colWidths[0] + 5, tableTop + 6)
  doc.text('Notes', doc.page.margins.left + colWidths[0] + colWidths[1] + 5, tableTop + 6)

  let currentY = tableTop + rowHeight

  for (const section of sections) {
    const sectionName = SECTION_NAMES[section.section_type as V2SectionType] || section.section_type
    const decision = section.decision as V2SectionDecision
    const decisionConfig = decision ? DECISION_CONFIG[decision] : { label: 'Pending', color: COLORS.gray }

    // Row background (alternating)
    if (sections.indexOf(section) % 2 === 1) {
      doc.rect(doc.page.margins.left, currentY, pageWidth, rowHeight)
        .fill('#f8fafc')
    }

    // Section name
    doc.font('Regular').fontSize(9).fillColor(COLORS.dark)
      .text(sectionName, doc.page.margins.left + 5, currentY + 6, {
        width: colWidths[0] - 10
      })

    // Decision with color
    doc.fillColor(decisionConfig.color)
      .text(decisionConfig.label, doc.page.margins.left + colWidths[0] + 5, currentY + 6, {
        width: colWidths[1] - 10
      })

    // Notes (condition text or fail reason)
    const notes = section.condition_text || section.fail_reason || ''
    doc.font('Regular').fontSize(8).fillColor(COLORS.gray)
      .text(notes.substring(0, 40) + (notes.length > 40 ? '...' : ''),
        doc.page.margins.left + colWidths[0] + colWidths[1] + 5, currentY + 6, {
          width: colWidths[2] - 10
        })

    currentY += rowHeight
  }

  // Table border
  doc.rect(doc.page.margins.left, tableTop, pageWidth, currentY - tableTop)
    .stroke(COLORS.lightGray)

  doc.y = currentY + 5
}

/**
 * Render verbal references section
 */
function renderVerbalReferences(
  doc: PDFKit.PDFDocument,
  verbalRefs: any[],
  pageWidth: number
): void {
  doc.font('Bold').fontSize(14).fillColor(COLORS.dark)
    .text('Verbal References Obtained', { underline: true })

  doc.moveDown(0.5)

  for (const vRef of verbalRefs) {
    doc.font('Bold').fontSize(11).fillColor(COLORS.primary)
      .text(`${vRef.referee_type}: ${vRef.referee_name}`)

    doc.font('Regular').fontSize(10).fillColor(COLORS.gray)
      .text(`Phone: ${vRef.referee_phone}`)
      .text(`Call Date: ${new Date(vRef.call_datetime).toLocaleString('en-GB')}`)
      .text(`Duration: ${vRef.call_duration_minutes || 'N/A'} minutes`)

    if (vRef.responses && typeof vRef.responses === 'object') {
      doc.moveDown(0.3)
      doc.font('Bold').fontSize(10).text('Responses:')
      doc.font('Regular').fontSize(9)

      for (const [key, value] of Object.entries(vRef.responses)) {
        const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        doc.text(`${displayKey}: ${value}`)
      }
    }

    doc.moveDown(0.5)
  }
}

/**
 * Render footer
 */
async function renderFooter(
  doc: PDFKit.PDFDocument,
  data: V2ReportData,
  pageWidth: number
): Promise<void> {
  const pages = doc.bufferedPageRange()
  const lastPage = pages.count - 1

  // Generate QR code for verification
  const verificationUrl = `https://app.propertygoose.co.uk/verify/${data.reference.id}`
  let qrCodeDataUrl: string | null = null
  try {
    qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
      width: 80,
      margin: 1,
      color: { dark: '#1e293b', light: '#ffffff' }
    })
  } catch (e) {
    console.warn('[V2 PDF] Failed to generate QR code:', e)
  }

  // Add page numbers to all pages
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i)

    doc.font('Regular').fontSize(8).fillColor(COLORS.gray)
      .text(
        `Page ${i + 1} of ${pages.count}`,
        doc.page.margins.left,
        doc.page.height - 25,
        { width: pageWidth, align: 'center' }
      )
  }

  // Add PropertyGoose branding and QR code to last page
  doc.switchToPage(lastPage)

  const footerY = doc.page.height - 120

  // Divider line
  doc.moveTo(doc.page.margins.left, footerY)
    .lineTo(doc.page.margins.left + pageWidth, footerY)
    .strokeColor(COLORS.lightGray)
    .stroke()

  // QR Code section (left side)
  if (qrCodeDataUrl) {
    const qrBuffer = Buffer.from(qrCodeDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64')
    doc.image(qrBuffer, doc.page.margins.left, footerY + 10, { width: 60, height: 60 })

    doc.font('Regular').fontSize(8).fillColor(COLORS.gray)
      .text('Verify this report:', doc.page.margins.left + 70, footerY + 20)
      .text(verificationUrl, doc.page.margins.left + 70, footerY + 32, {
        link: verificationUrl,
        underline: true
      })
  }

  // PropertyGoose branding (right side)
  const brandX = doc.page.margins.left + pageWidth - 150

  // PropertyGoose logo (text fallback)
  doc.font('Bold').fontSize(12).fillColor(COLORS.primary)
    .text('PropertyGoose', brandX, footerY + 15, { width: 150, align: 'right' })

  doc.font('Regular').fontSize(9).fillColor(COLORS.gray)
    .text('Verified by PropertyGoose Ltd', brandX, footerY + 32, { width: 150, align: 'right' })
    .text('www.propertygoose.co.uk', brandX, footerY + 44, { width: 150, align: 'right' })

  // Reviewer info
  if (data.reviewedBy) {
    doc.font('Regular').fontSize(8).fillColor(COLORS.gray)
      .text(
        `Reviewed by: ${data.reviewedBy} | ${data.reference.final_decision_at ? new Date(data.reference.final_decision_at).toLocaleString('en-GB') : ''}`,
        doc.page.margins.left,
        footerY + 75,
        { width: pageWidth, align: 'center' }
      )
  }
}

/**
 * Upload PDF to Supabase Storage
 */
export async function uploadV2ReportPdf(
  referenceId: string,
  pdfBuffer: Buffer
): Promise<string> {
  const fileName = `v2-report-${referenceId}-${Date.now()}.pdf`
  const filePath = `reference-reports/${referenceId}/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true
    })

  if (uploadError) {
    throw new Error(`Failed to upload PDF: ${uploadError.message}`)
  }

  const { data: urlData } = supabase.storage
    .from('documents')
    .getPublicUrl(filePath)

  // Update reference with PDF URL
  await supabase
    .from('tenant_references_v2')
    .update({
      report_pdf_url: urlData.publicUrl,
      report_generated_at: new Date().toISOString()
    })
    .eq('id', referenceId)

  return urlData.publicUrl
}

/**
 * Generate and upload V2 report PDF
 */
export async function generateAndUploadV2Report(referenceId: string): Promise<string> {
  const pdfBuffer = await generateV2ReportPdf(referenceId)
  const pdfUrl = await uploadV2ReportPdf(referenceId, pdfBuffer)
  console.log(`[V2 PDF] Report uploaded: ${pdfUrl}`)
  return pdfUrl
}

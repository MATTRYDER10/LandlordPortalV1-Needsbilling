/**
 * V2 Group Certificate Service
 *
 * Generates a one-page group assessment certificate PDF using Puppeteer.
 * Shows combined affordability, individual results, and rent shares.
 */

import puppeteer from 'puppeteer'
import { supabase } from '../../config/supabase'
import { decrypt } from '../encryption'
import axios from 'axios'
import QRCode from 'qrcode'
import fs from 'fs'
import path from 'path'

// Load PropertyGoose logo as base64 once
let PG_LOGO_BASE64: string | null = null
try {
  // Use standard (dark) logo for group cert — it's on white background, not navy
  const logoPath = path.join(__dirname, '../../../assets/images/PropertyGooseLogo.png')
  const logoBuffer = fs.readFileSync(logoPath)
  PG_LOGO_BASE64 = `data:image/png;base64,${logoBuffer.toString('base64')}`
} catch (e) {
  console.warn('[V2 GroupCert] Could not load PropertyGoose logo from assets')
}

// ============================================================================
// TYPES
// ============================================================================

interface GroupMember {
  id: string
  name: string
  isGuarantor: boolean
  guarantorFor?: string
  individualResult: string
  annualIncome: number | null
  maxAffordableRent: number | null
  rentShare: number | null
  referenceNumber: string | null
}

interface GroupCertificateData {
  parentId: string
  referenceNumber: string | null
  propertyAddress: string
  propertyCity: string | null
  propertyPostcode: string | null
  totalMonthlyRent: number
  groupDecision: string
  decisionNotes: string | null
  assessorName: string | null
  decisionDate: string | null
  members: GroupMember[]
  companyName: string
  companyLogoBase64?: string
  qrCodeDataUrl?: string
  pgLogoBase64?: string
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function fetchGroupCertificateData(parentReferenceId: string): Promise<GroupCertificateData> {
  // Fetch parent reference
  const { data: parentRef, error: parentError } = await supabase
    .from('tenant_references_v2')
    .select('*')
    .eq('id', parentReferenceId)
    .single()

  if (parentError || !parentRef) {
    throw new Error(`Parent reference not found: ${parentReferenceId}`)
  }

  // Fetch company
  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', parentRef.company_id)
    .maybeSingle()

  const co = company as any
  const companyName = co?.name || (co?.name_encrypted ? decrypt(co.name_encrypted) : null) || 'PropertyGoose'

  // Fetch agent logo
  let companyLogoBase64: string | undefined
  if (company?.logo_url) {
    try {
      const response = await axios.get(company.logo_url, {
        responseType: 'arraybuffer',
        timeout: 10000
      })
      const contentType = response.headers['content-type'] || 'image/png'
      const base64 = Buffer.from(response.data).toString('base64')
      companyLogoBase64 = `data:${contentType};base64,${base64}`
    } catch (e) {
      console.warn('[V2 GroupCert] Failed to fetch agent logo:', e)
    }
  }

  // Fetch assessor name
  let assessorName: string | null = null
  if (parentRef.final_decision_by) {
    const { data: staff } = await supabase
      .from('staff_users')
      .select('first_name, last_name')
      .eq('id', parentRef.final_decision_by)
      .single()
    if (staff) {
      assessorName = `${staff.first_name} ${staff.last_name}`
    }
  }

  // Generate QR code
  const verificationUrl = `https://app.propertygoose.co.uk/verify/${parentRef.id}`
  let qrCodeDataUrl: string | undefined
  try {
    qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
      width: 120,
      margin: 1,
      color: { dark: '#1B3464', light: '#ffffff' }
    })
  } catch (e) {
    console.warn('[V2 GroupCert] Failed to generate QR code:', e)
  }

  // Helper: get effective income from section checklist or reference field
  async function getEffectiveIncome(refId: string, refAnnualIncome: number | null): Promise<number> {
    const { data: sections } = await supabase
      .from('reference_sections_v2')
      .select('section_type, section_data')
      .eq('reference_id', refId)
      .eq('section_type', 'INCOME')
      .maybeSingle()
    const checklist = (sections?.section_data as any)?.checklist_results || {}
    return parseFloat(checklist.total_effective_income) || parseFloat(checklist.annual_income) || refAnnualIncome || 0
  }

  // Build members list
  const members: GroupMember[] = []

  // Get children (non-guarantor)
  const { data: children } = await supabase
    .from('tenant_references_v2')
    .select('*')
    .eq('parent_reference_id', parentReferenceId)
    .eq('is_guarantor', false)
    .order('created_at')

  // Include parent as a member — they're always a tenant too
  {
    const parentName = `${decrypt(parentRef.tenant_first_name_encrypted) || ''} ${decrypt(parentRef.tenant_last_name_encrypted) || ''}`.trim()
    const individualResult = extractIndividualDecision(parentRef.final_decision_notes) || parentRef.status
    const parentIncome = await getEffectiveIncome(parentRef.id, parentRef.annual_income)
    members.push({
      id: parentRef.id,
      name: parentName || 'Unknown',
      isGuarantor: false,
      individualResult,
      annualIncome: parentIncome,
      maxAffordableRent: parentIncome ? Math.round((parentIncome / 30) * 100) / 100 : null,
      rentShare: parentRef.rent_share,
      referenceNumber: parentRef.reference_number
    })

    // Check for parent's guarantor
    const { data: parentGuarantor } = await supabase
      .from('tenant_references_v2')
      .select('*')
      .eq('guarantor_for_reference_id', parentReferenceId)
      .eq('is_guarantor', true)
      .maybeSingle()

    if (parentGuarantor) {
      const gName = `${decrypt(parentGuarantor.tenant_first_name_encrypted) || ''} ${decrypt(parentGuarantor.tenant_last_name_encrypted) || ''}`.trim()
      const gResult = extractIndividualDecision(parentGuarantor.final_decision_notes) || parentGuarantor.status
      const gIncome = await getEffectiveIncome(parentGuarantor.id, parentGuarantor.annual_income)
      members.push({
        id: parentGuarantor.id,
        name: gName || 'Unknown',
        isGuarantor: true,
        guarantorFor: parentName || 'Unknown',
        individualResult: gResult,
        annualIncome: gIncome || null,
        maxAffordableRent: gIncome ? Math.round((gIncome / 32) * 100) / 100 : null,
        rentShare: null,
        referenceNumber: parentGuarantor.reference_number
      })
    }
  }

  // Add children and their guarantors
  for (const child of (children || [])) {
    const childName = `${decrypt(child.tenant_first_name_encrypted) || ''} ${decrypt(child.tenant_last_name_encrypted) || ''}`.trim()
    const individualResult = extractIndividualDecision(child.final_decision_notes) || child.status

    const childIncome = await getEffectiveIncome(child.id, child.annual_income)
    members.push({
      id: child.id,
      name: childName || 'Unknown',
      isGuarantor: false,
      individualResult,
      annualIncome: childIncome,
      maxAffordableRent: childIncome ? Math.round((childIncome / 30) * 100) / 100 : null,
      rentShare: child.rent_share,
      referenceNumber: child.reference_number
    })

    // Check for child's guarantor
    const { data: childGuarantor } = await supabase
      .from('tenant_references_v2')
      .select('*')
      .eq('guarantor_for_reference_id', child.id)
      .eq('is_guarantor', true)
      .maybeSingle()

    if (childGuarantor) {
      const gName = `${decrypt(childGuarantor.tenant_first_name_encrypted) || ''} ${decrypt(childGuarantor.tenant_last_name_encrypted) || ''}`.trim()
      const gResult = extractIndividualDecision(childGuarantor.final_decision_notes) || childGuarantor.status
      const gChildIncome = await getEffectiveIncome(childGuarantor.id, childGuarantor.annual_income)
      members.push({
        id: childGuarantor.id,
        name: gName || 'Unknown',
        isGuarantor: true,
        guarantorFor: childName || 'Unknown',
        individualResult: gResult,
        annualIncome: gChildIncome || null,
        maxAffordableRent: gChildIncome ? Math.round((gChildIncome / 32) * 100) / 100 : null,
        rentShare: null,
        referenceNumber: childGuarantor.reference_number
      })
    }
  }

  return {
    parentId: parentReferenceId,
    referenceNumber: parentRef.reference_number,
    propertyAddress: decrypt(parentRef.property_address_encrypted) || 'Unknown',
    propertyCity: decrypt(parentRef.property_city_encrypted),
    propertyPostcode: decrypt(parentRef.property_postcode_encrypted),
    totalMonthlyRent: parentRef.monthly_rent || 0,
    groupDecision: parentRef.status,
    decisionNotes: parentRef.final_decision_notes,
    assessorName,
    decisionDate: parentRef.final_decision_at,
    members,
    companyName,
    companyLogoBase64,
    qrCodeDataUrl,
    pgLogoBase64: PG_LOGO_BASE64 || undefined
  }
}

/**
 * Extract the individual decision from the notes string
 * Notes are stored as "INDIVIDUAL_DECISION: ACCEPTED\n..."
 */
function extractIndividualDecision(notes: string | null): string | null {
  if (!notes) return null
  const match = notes.match(/INDIVIDUAL_DECISION:\s*(\S+)/)
  return match ? match[1] : null
}

// ============================================================================
// HTML TEMPLATE
// ============================================================================

function buildGroupCertificateHtml(data: GroupCertificateData): string {
  const isAccepted = ['ACCEPTED', 'ACCEPTED_WITH_GUARANTOR', 'ACCEPTED_ON_CONDITION'].includes(data.groupDecision)
  const decisionLabel = data.groupDecision === 'ACCEPTED' ? 'Accepted'
    : data.groupDecision === 'ACCEPTED_WITH_GUARANTOR' ? 'Accepted (with Guarantor)'
    : data.groupDecision === 'ACCEPTED_ON_CONDITION' ? 'Accepted on Condition'
    : data.groupDecision === 'REJECTED' ? 'Rejected'
    : data.groupDecision
  const decisionColor = isAccepted ? '#16a34a' : '#dc2626'
  const decisionBg = isAccepted ? '#f0fdf4' : '#fef2f2'
  const decisionBorder = isAccepted ? '#bbf7d0' : '#fecaca'

  const fullAddress = [data.propertyAddress, data.propertyCity, data.propertyPostcode].filter(Boolean).join(', ')

  // Build member rows
  const tenantRows = data.members.filter(m => !m.isGuarantor)
  const guarantorRows = data.members.filter(m => m.isGuarantor)

  const formatCurrency = (v: number | null) => v !== null ? `£${v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'
  const formatResult = (r: string) => {
    const accepted = ['ACCEPTED', 'ACCEPTED_WITH_GUARANTOR', 'ACCEPTED_ON_CONDITION'].includes(r)
    const color = accepted ? '#16a34a' : r === 'REJECTED' ? '#dc2626' : '#d97706'
    const label = r === 'ACCEPTED' ? 'Pass' : r === 'REJECTED' ? 'Fail' : r === 'ACCEPTED_WITH_GUARANTOR' ? 'Pass (G)' : r === 'ACCEPTED_ON_CONDITION' ? 'Conditional' : r
    return `<span style="color:${color};font-weight:600;">${label}</span>`
  }

  const memberTableRows = tenantRows.map(m => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${m.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:center;">${formatResult(m.individualResult)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;">${m.annualIncome ? formatCurrency(m.annualIncome) : 'N/A'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;">${formatCurrency(m.maxAffordableRent)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;font-weight:600;">${formatCurrency(m.rentShare)}</td>
    </tr>
  `).join('')

  const guarantorTableRows = guarantorRows.map(m => `
    <tr style="background-color:#fefce8;">
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${m.name} <span style="font-size:11px;color:#92400e;">(Guarantor for ${m.guarantorFor})</span></td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:center;">${formatResult(m.individualResult)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;">${m.annualIncome ? formatCurrency(m.annualIncome) : 'N/A'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;">${formatCurrency(m.maxAffordableRent)} <span style="font-size:10px;color:#6b7280;">(32x)</span></td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;color:#6b7280;">-</td>
    </tr>
  `).join('')

  // Totals
  const totalIncome = tenantRows.reduce((sum, m) => sum + (m.annualIncome || 0), 0)
  const totalMaxAffordable = tenantRows.reduce((sum, m) => sum + (m.maxAffordableRent || 0), 0)
  const totalRentShare = tenantRows.reduce((sum, m) => sum + (m.rentShare || 0), 0)

  const formatDate = (d: string | null) => {
    if (!d) return 'N/A'
    const date = new Date(d)
    if (isNaN(date.getTime())) return String(d)
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  // Clean notes (remove INDIVIDUAL_DECISION prefix if present)
  const cleanNotes = data.decisionNotes
    ? data.decisionNotes.replace(/INDIVIDUAL_DECISION:\s*\S+\n?/g, '').trim()
    : null

  // Header logos
  const pgLogo = data.pgLogoBase64
    ? `<img src="${data.pgLogoBase64}" style="height:36px;" />`
    : `<span style="font-size:18px;font-weight:700;color:#f97316;">PropertyGoose</span>`
  const agentLogo = data.companyLogoBase64
    ? `<img src="${data.companyLogoBase64}" style="height:36px;max-width:160px;object-fit:contain;" />`
    : `<span style="font-size:14px;font-weight:600;color:#374151;">${data.companyName}</span>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1f2937; background: #ffffff; }
    @page { margin: 0; }
  </style>
</head>
<body>
  <div style="padding:24px 32px;">
    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #f97316;">
      <div>${pgLogo}</div>
      <div style="text-align:center;">
        <h1 style="font-size:16px;font-weight:700;color:#1B3464;letter-spacing:0.5px;">GROUP ASSESSMENT CERTIFICATE</h1>
      </div>
      <div>${agentLogo}</div>
    </div>

    <!-- Property Details -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Property</div>
          <div style="font-size:14px;font-weight:600;margin-top:2px;">${fullAddress}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Total Monthly Rent</div>
          <div style="font-size:14px;font-weight:600;margin-top:2px;">${formatCurrency(data.totalMonthlyRent)}</div>
        </div>
      </div>
      ${data.referenceNumber ? `<div style="font-size:11px;color:#9ca3af;margin-top:4px;">Ref: ${data.referenceNumber}</div>` : ''}
    </div>

    <!-- Decision Badge -->
    <div style="background:${decisionBg};border:1px solid ${decisionBorder};border-radius:8px;padding:12px;text-align:center;margin-bottom:16px;">
      <span style="font-size:20px;font-weight:700;color:${decisionColor};">${decisionLabel}</span>
    </div>

    <!-- Members Table -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <thead>
        <tr style="background:#1B3464;">
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#ffffff;font-weight:600;">Tenant Name</th>
          <th style="padding:8px 12px;text-align:center;font-size:12px;color:#ffffff;font-weight:600;">Individual Result</th>
          <th style="padding:8px 12px;text-align:right;font-size:12px;color:#ffffff;font-weight:600;">Annual Income</th>
          <th style="padding:8px 12px;text-align:right;font-size:12px;color:#ffffff;font-weight:600;">Max Affordable (30x)</th>
          <th style="padding:8px 12px;text-align:right;font-size:12px;color:#ffffff;font-weight:600;">Final Rent Share</th>
        </tr>
      </thead>
      <tbody>
        ${memberTableRows}
        ${guarantorTableRows}
        <!-- Totals -->
        <tr style="background:#f3f4f6;font-weight:700;">
          <td style="padding:8px 12px;font-size:13px;">Combined Totals</td>
          <td style="padding:8px 12px;font-size:13px;text-align:center;">-</td>
          <td style="padding:8px 12px;font-size:13px;text-align:right;">${formatCurrency(totalIncome)}</td>
          <td style="padding:8px 12px;font-size:13px;text-align:right;">${formatCurrency(totalMaxAffordable)}</td>
          <td style="padding:8px 12px;font-size:13px;text-align:right;">${formatCurrency(totalRentShare)}</td>
        </tr>
      </tbody>
    </table>

    ${cleanNotes ? `
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;margin-bottom:16px;">
      <div style="font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Assessment Notes</div>
      <div style="font-size:13px;color:#78350f;">${cleanNotes}</div>
    </div>
    ` : ''}

    <!-- Footer -->
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:20px;padding-top:12px;border-top:1px solid #e5e7eb;">
      <div>
        <div style="font-size:12px;color:#6b7280;">Assessed by: <strong>PropertyGoose Referencing Limited</strong></div>
        <div style="font-size:12px;color:#6b7280;">Date: <strong>${formatDate(data.decisionDate)}</strong></div>
        <div style="font-size:10px;color:#9ca3af;margin-top:8px;">This certificate is generated by PropertyGoose reference checking system.</div>
        <div style="font-size:10px;color:#9ca3af;">Verify at: app.propertygoose.co.uk/verify/${data.parentId}</div>
      </div>
      ${data.qrCodeDataUrl ? `
      <div style="text-align:right;">
        <img src="${data.qrCodeDataUrl}" style="width:80px;height:80px;" />
        <div style="font-size:9px;color:#9ca3af;margin-top:2px;">Scan to verify</div>
      </div>
      ` : ''}
    </div>
  </div>
</body>
</html>`
}

// ============================================================================
// PDF GENERATION
// ============================================================================

/**
 * Generate the group certificate PDF as a Buffer
 */
export async function generateGroupCertificate(parentReferenceId: string): Promise<Buffer> {
  console.log(`[V2 GroupCert] Generating group certificate for ${parentReferenceId}...`)

  const data = await fetchGroupCertificateData(parentReferenceId)
  const html = buildGroupCertificateHtml(data)

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
    })

    console.log(`[V2 GroupCert] Certificate generated: ${pdfBuffer.length} bytes`)
    return Buffer.from(pdfBuffer)
  } finally {
    await browser.close()
  }
}

/**
 * Generate and upload the group certificate PDF
 */
export async function generateAndUploadGroupCertificate(parentReferenceId: string): Promise<string> {
  const pdfBuffer = await generateGroupCertificate(parentReferenceId)

  const fileName = `v2-group-certificate-${parentReferenceId}-${Date.now()}.pdf`
  const filePath = `reference-reports/${parentReferenceId}/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true
    })

  if (uploadError) {
    throw new Error(`Failed to upload group certificate: ${uploadError.message}`)
  }

  const { data: urlData } = supabase.storage
    .from('documents')
    .getPublicUrl(filePath)

  // Store the certificate URL on the parent reference (group_report_pdf_url, NOT report_pdf_url)
  await supabase
    .from('tenant_references_v2')
    .update({
      group_report_pdf_url: urlData.publicUrl
    })
    .eq('id', parentReferenceId)

  // Push to property_documents for Apex27 doc push and tenancy documents tab
  try {
    const { data: parentRef } = await supabase
      .from('tenant_references_v2')
      .select('company_id, linked_property_id, reference_number')
      .eq('id', parentReferenceId)
      .single()

    if (parentRef?.linked_property_id) {
      const { data: existing } = await supabase
        .from('property_documents')
        .select('id')
        .eq('source_type', 'reference')
        .eq('source_id', parentReferenceId)
        .eq('tag', 'reference')
        .ilike('file_name', '%Group Assessment%')
        .limit(1)

      if (!existing || existing.length === 0) {
        await supabase.from('property_documents').insert({
          company_id: parentRef.company_id,
          property_id: parentRef.linked_property_id,
          file_name: `Group Assessment Certificate - ${parentRef.reference_number || parentReferenceId}.pdf`,
          file_path: filePath,
          file_type: 'application/pdf',
          tag: 'reference',
          source_type: 'reference',
          source_id: parentReferenceId,
          description: `Group assessment certificate for reference ${parentRef.reference_number || ''}`,
          uploaded_by: null
        })
        console.log(`[V2 GroupCert] Pushed certificate to property_documents for property ${parentRef.linked_property_id}`)
      }
    }
  } catch (docErr) {
    console.error('[V2 GroupCert] Failed to push to property_documents (non-critical):', docErr)
  }

  console.log(`[V2 GroupCert] Certificate uploaded: ${urlData.publicUrl}`)
  return urlData.publicUrl
}

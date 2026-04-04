/**
 * V2 PDF Report Service
 *
 * Generates reference decision reports for the V2 section-based verification system.
 * Uses HTML templates rendered via Puppeteer for high-fidelity PDF output.
 */

import puppeteer from 'puppeteer'
import { supabase } from '../../config/supabase'
import { decrypt } from '../encryption'
import axios from 'axios'
import QRCode from 'qrcode'
import fs from 'fs'
import path from 'path'
import {
  V2ReferenceRow,
  V2SectionRow,
  V2SectionType,
  V2SectionDecision
} from './types'
import { buildReportHtml, V2ReportData } from './reportTemplateV2'

// Load PropertyGoose logo as base64 once
let PG_LOGO_BASE64: string | null = null
try {
  const logoPath = path.join(__dirname, '../../../assets/images/PropertyGooseLogoDark.png')
  const logoBuffer = fs.readFileSync(logoPath)
  PG_LOGO_BASE64 = `data:image/png;base64,${logoBuffer.toString('base64')}`
} catch (e) {
  console.warn('[V2 PDF] Could not load PropertyGoose logo from assets')
}

/**
 * Generate a V2 reference report PDF using Puppeteer
 */
export async function generateV2ReportPdf(referenceId: string): Promise<Buffer> {
  console.log(`[V2 PDF] Generating report for reference ${referenceId}...`)

  // Fetch all data needed for the report
  const reportData = await fetchReportData(referenceId)

  // Build the full HTML string
  const html = buildReportHtml(reportData)

  // Launch Puppeteer and render to PDF
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
      margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' }
    })

    console.log(`[V2 PDF] Report generated: ${pdfBuffer.length} bytes`)
    return Buffer.from(pdfBuffer)
  } finally {
    await browser.close()
  }
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

  // Fetch referee form submissions
  const { data: refereeSubmissions } = await supabase
    .from('referees_v2')
    .select('id, referee_type, referee_name, form_data, completed_at')
    .eq('reference_id', referenceId)
    .not('completed_at', 'is', null)

  // Fetch company (select all to handle both name and name_encrypted columns)
  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', reference.company_id)
    .maybeSingle()

  const co = company as any
  const companyName = co?.name || (co?.name_encrypted ? decrypt(co.name_encrypted) : null) || 'PropertyGoose'

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

  // Generate QR code
  const verificationUrl = `https://app.propertygoose.co.uk/verify/${reference.id}`
  let qrCodeDataUrl: string | undefined
  try {
    qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
      width: 120,
      margin: 1,
      color: { dark: '#1B3464', light: '#ffffff' }
    })
  } catch (e) {
    console.warn('[V2 PDF] Failed to generate QR code:', e)
  }

  // Fetch and convert agent logo to base64 if URL provided
  let logoBase64: string | undefined
  if (company?.logo_url) {
    try {
      const response = await axios.get(company.logo_url, {
        responseType: 'arraybuffer',
        timeout: 10000
      })
      const contentType = response.headers['content-type'] || 'image/png'
      const base64 = Buffer.from(response.data).toString('base64')
      logoBase64 = `data:${contentType};base64,${base64}`
    } catch (e) {
      console.warn('[V2 PDF] Failed to fetch agent logo:', e)
    }
  }

  // Fetch credit check data (all checks — current + previous address)
  const { data: creditChecks } = await supabase
    .from('creditsafe_verifications_v2')
    .select('*')
    .eq('reference_id', referenceId)
    .order('created_at', { ascending: false })

  const decryptCreditCheck = (cc: any) => ({
    ...cc,
    responseData: cc.response_data_encrypted
      ? (() => { try { return JSON.parse(decrypt(cc.response_data_encrypted) || '{}') } catch { return null } })()
      : null,
    requestData: cc.request_data_encrypted
      ? (() => { try { return JSON.parse(decrypt(cc.request_data_encrypted) || '{}') } catch { return null } })()
      : null,
    response_data_encrypted: undefined,
    request_data_encrypted: undefined
  })

  const allDecryptedChecks = (creditChecks || []).map(decryptCreditCheck)
  const currentAddressCheck = allDecryptedChecks.find(c => c.address_type !== 'previous') || allDecryptedChecks[0] || null
  const previousAddressCheck = allDecryptedChecks.find(c => c.address_type === 'previous') || null

  // Fetch AML / sanctions screening data
  const { data: amlCheck } = await supabase
    .from('sanctions_screenings_v2')
    .select('*')
    .eq('reference_id', referenceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const reportData: V2ReportData = {
    reference,
    sections: sections || [],
    verbalReferences: verbalRefs || [],
    refereeSubmissions: refereeSubmissions || [],
    creditCheck: currentAddressCheck || undefined,
    previousAddressCreditCheck: previousAddressCheck || undefined,
    amlCheck: amlCheck || undefined,
    company: {
      name: companyName,
      logoUrl: co?.logo_url,
      logoBase64,
      primaryColor: co?.primary_color || '#F48024'
    },
    reviewedBy,
    qrCodeDataUrl,
    pgLogoBase64: PG_LOGO_BASE64 || undefined
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
 * Push report PDF to the tenancy's property documents tab (if tenancy exists)
 */
async function pushReportToTenancyDocuments(referenceId: string, filePath: string): Promise<void> {
  try {
    // Find tenancy linked to this reference
    const { data: tenancy } = await supabase
      .from('tenancies')
      .select('id, property_id')
      .eq('primary_reference_id', referenceId)
      .is('deleted_at', null)
      .limit(1)
      .single()

    if (!tenancy?.property_id) {
      // Also check V2 references for linked_property_id
      const { data: ref } = await supabase
        .from('tenant_references_v2')
        .select('linked_property_id, tenant_first_name_encrypted, tenant_last_name_encrypted, reference_number')
        .eq('id', referenceId)
        .single()

      // Try finding tenancy by matching reference's parent
      const { data: parentTenancy } = await supabase
        .from('tenancies')
        .select('id, property_id')
        .eq('property_id', ref?.linked_property_id)
        .is('deleted_at', null)
        .in('status', ['active', 'pending', 'draft'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!parentTenancy?.property_id) {
        console.log(`[V2 PDF] No linked tenancy found for reference ${referenceId}, skipping document push`)
        return
      }

      const { decrypt } = await import('../encryption')
      const tenantName = ref
        ? `${decrypt(ref.tenant_first_name_encrypted) || ''} ${decrypt(ref.tenant_last_name_encrypted) || ''}`.trim()
        : 'Tenant'

      await supabase.from('property_documents').insert({
        property_id: parentTenancy.property_id,
        file_name: `Reference Report - ${tenantName}.pdf`,
        file_path: filePath,
        file_type: 'application/pdf',
        tag: 'reference',
        source_type: 'reference',
        source_id: referenceId,
        description: `Reference report ${ref?.reference_number || ''} - ${tenantName}`,
        uploaded_by: null
      })

      console.log(`[V2 PDF] Report pushed to property_documents for property ${parentTenancy.property_id}`)
      return
    }

    // Direct tenancy link found
    const { decrypt } = await import('../encryption')
    const { data: ref } = await supabase
      .from('tenant_references_v2')
      .select('tenant_first_name_encrypted, tenant_last_name_encrypted, reference_number')
      .eq('id', referenceId)
      .single()

    const tenantName = ref
      ? `${decrypt(ref.tenant_first_name_encrypted) || ''} ${decrypt(ref.tenant_last_name_encrypted) || ''}`.trim()
      : 'Tenant'

    // Check if already pushed (avoid duplicates)
    const { data: existing } = await supabase
      .from('property_documents')
      .select('id')
      .eq('source_type', 'reference')
      .eq('source_id', referenceId)
      .limit(1)

    if (existing && existing.length > 0) {
      console.log(`[V2 PDF] Report already in property_documents for reference ${referenceId}`)
      return
    }

    await supabase.from('property_documents').insert({
      property_id: tenancy.property_id,
      file_name: `Reference Report - ${tenantName}.pdf`,
      file_path: filePath,
      file_type: 'application/pdf',
      tag: 'reference',
      source_type: 'reference',
      source_id: referenceId,
      description: `Reference report ${ref?.reference_number || ''} - ${tenantName}`,
      uploaded_by: null
    })

    console.log(`[V2 PDF] Report pushed to property_documents for tenancy ${tenancy.id}`)
  } catch (err) {
    console.error(`[V2 PDF] Failed to push report to property_documents:`, err)
    // Don't throw — this is a nice-to-have, not critical
  }
}

/**
 * Generate and upload V2 report PDF
 */
export async function generateAndUploadV2Report(referenceId: string): Promise<string> {
  const pdfBuffer = await generateV2ReportPdf(referenceId)
  const pdfUrl = await uploadV2ReportPdf(referenceId, pdfBuffer)
  console.log(`[V2 PDF] Report uploaded: ${pdfUrl}`)

  // Extract storage path from the URL for property_documents
  const pathMatch = pdfUrl.match(/\/reference-reports\/[^\s?]+/)
  const storagePath = pathMatch ? pathMatch[0].replace(/^\//, '') : `reference-reports/${referenceId}/`
  await pushReportToTenancyDocuments(referenceId, storagePath)

  return pdfUrl
}

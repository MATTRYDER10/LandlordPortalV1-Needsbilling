import PDFDocument from 'pdfkit'
import { supabase } from '../config/supabase'
import { decrypt } from './encryption'
import path from 'path'

interface VerificationStep {
  step_number: number
  step_type: string
  overall_pass: boolean | null
  notes: string
  evidence_sources: string[]
  completed_at: string | null
}

export async function generateReferenceReportPDFV2(referenceId: string): Promise<{ buffer: Buffer; firstName: string; lastName: string }> {
  // Fetch reference data
  console.log(`[PDF V2] Fetching reference ${referenceId}...`)
  const { data: reference, error: refError } = await supabase
    .from('tenant_references')
    .select('*')
    .eq('id', referenceId)
    .single()

  if (refError || !reference) {
    console.error('[PDF V2] Error fetching reference:', refError)
    throw new Error('Reference not found')
  }

  // Decrypt sensitive fields
  const firstName = reference.first_name || (reference.tenant_first_name_encrypted ? decrypt(reference.tenant_first_name_encrypted) : '')
  const middleName = reference.middle_name || ''
  const lastName = reference.last_name || (reference.tenant_last_name_encrypted ? decrypt(reference.tenant_last_name_encrypted) : '')
  const email = reference.email || (reference.tenant_email_encrypted ? decrypt(reference.tenant_email_encrypted) : '')
  const phone = reference.phone || (reference.tenant_phone_encrypted ? decrypt(reference.tenant_phone_encrypted) : '')
  const dateOfBirth = reference.date_of_birth || (reference.date_of_birth_encrypted ? decrypt(reference.date_of_birth_encrypted) : '')
  const propertyAddress = reference.property_address || (reference.property_address_encrypted ? decrypt(reference.property_address_encrypted) : '')
  const propertyCity = reference.property_city || (reference.property_city_encrypted ? decrypt(reference.property_city_encrypted) : '')
  const propertyPostcode = reference.property_postcode || (reference.property_postcode_encrypted ? decrypt(reference.property_postcode_encrypted) : '')

  console.log(`[PDF V2] Reference found: ${firstName} ${lastName}`)

  // Fetch company name
  let companyName: string = 'N/A'
  if (reference.company_id) {
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted')
      .eq('id', reference.company_id)
      .single()
    if (company?.name_encrypted) {
      const decrypted = decrypt(company.name_encrypted)
      if (decrypted) companyName = decrypted
    }
  }

  // Fetch verification check for TAS decision
  const { data: verificationCheck } = await supabase
    .from('verification_checks')
    .select('tas_category, tas_reason, tas_score, status')
    .eq('reference_id', referenceId)
    .maybeSingle()

  // Fetch verification steps with evidence sources
  const { data: verificationSteps } = await supabase
    .from('verification_steps')
    .select('*')
    .eq('reference_id', referenceId)
    .order('step_number', { ascending: true })

  // Fetch evidence source labels
  const { data: evidenceSourceOptions } = await supabase
    .from('evidence_source_options')
    .select('*')
    .eq('active', true)
    .order('display_order', { ascending: true })

  // Create evidence type to label mapping
  const evidenceLabels: Record<string, string> = {}
  evidenceSourceOptions?.forEach((option: any) => {
    evidenceLabels[option.evidence_type] = option.display_label
  })

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      const chunks: Buffer[] = []
      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve({
        buffer: Buffer.concat(chunks),
        firstName,
        lastName
      }))
      doc.on('error', reject)

      const primaryColor = '#f97316'
      const darkGray = '#1f2937'
      const lightGray = '#6b7280'
      const passGreen = '#10b981'
      const failRed = '#ef4444'

      // ========== PAGE 1: SUMMARY & APPLICANT INFO ==========

      // Header
      const logoPath = path.join(__dirname, '../../assets/PropertyGooseIcon.png')
      try {
        doc.image(logoPath, 50, 45, { width: 50 })
      } catch (err) {
        console.error('Logo load failed:', err)
      }

      doc.fontSize(24).fillColor(darkGray).font('Helvetica-Bold').text('PropertyGoose', 110, 50)
      doc.fontSize(10).fillColor(lightGray).font('Helvetica').text('Tenant Reference Report', 110, 75)
      doc.moveTo(50, 100).lineTo(545, 100).strokeColor(primaryColor).lineWidth(2).stroke()

      let y = 120

      // TAS Decision Box (prominent)
      if (verificationCheck?.tas_category) {
        const tasColors: Record<string, string> = {
          'PASS_PLUS': passGreen,
          'PASS': '#3b82f6',
          'REFER': '#f59e0b',
          'FAIL': failRed
        }
        const tasColor = tasColors[verificationCheck.tas_category] || lightGray

        doc.roundedRect(50, y, 495, 60, 5)
          .fillAndStroke(tasColor, tasColor)

        doc.fontSize(12).fillColor('#ffffff').font('Helvetica-Bold')
          .text('TAS DECISION', 60, y + 15)

        doc.fontSize(20).fillColor('#ffffff').font('Helvetica-Bold')
          .text(verificationCheck.tas_category.replace('_', ' '), 60, y + 32)

        if (verificationCheck.tas_reason) {
          doc.fontSize(9).fillColor('#ffffff').font('Helvetica')
            .text(`Reason: ${verificationCheck.tas_reason}`, 250, y + 20, { width: 280 })
        }

        y += 75
      }

      // Two-column layout: Applicant Info (left) and Property Info (right)
      const leftColX = 50
      const rightColX = 310
      const labelWidth = 80

      // Applicant Info (left column)
      doc.fontSize(14).fillColor(darkGray).font('Helvetica-Bold').text('Applicant Information', leftColX, y)
      let leftY = y + 20
      doc.fontSize(9).fillColor(lightGray).font('Helvetica')
      const appInfo = [
        ['Name', `${firstName}${middleName ? ' ' + middleName : ''} ${lastName}`],
        ['Email', email || 'Not provided'],
        ['Phone', phone || 'Not provided'],
        ['Date of Birth', dateOfBirth ? new Date(dateOfBirth).toLocaleDateString('en-GB') : 'Not provided']
      ]
      appInfo.forEach(([label, value]) => {
        doc.font('Helvetica-Bold').text(`${label}:`, leftColX, leftY, { continued: false })
        doc.font('Helvetica').fillColor(darkGray).text(value, leftColX + labelWidth, leftY, { width: 200 })
        leftY += 15
      })

      // Property Info (right column)
      doc.fontSize(14).fillColor(darkGray).font('Helvetica-Bold').text('Property Information', rightColX, y)
      let rightY = y + 20
      doc.fontSize(9).fillColor(lightGray).font('Helvetica')
      const propInfo = [
        ['Address', propertyAddress || 'Not provided'],
        ['City', propertyCity || 'Not provided'],
        ['Postcode', propertyPostcode || 'Not provided'],
        ['Landlord', companyName]
      ]
      propInfo.forEach(([label, value]) => {
        doc.font('Helvetica-Bold').text(`${label}:`, rightColX, rightY, { continued: false })
        doc.font('Helvetica').fillColor(darkGray).text(value, rightColX + labelWidth, rightY, { width: 200 })
        rightY += 15
      })

      y = Math.max(leftY, rightY) + 20

      // Verification Summary Section
      doc.fontSize(14).fillColor(darkGray).font('Helvetica-Bold').text('Verification Summary', 50, y)
      y += 25

      if (verificationSteps && verificationSteps.length > 0) {
        const stepLabels: Record<string, string> = {
          'ID_SELFIE': 'Step 1: ID & Selfie Verification',
          'INCOME_AFFORDABILITY': 'Step 2: Income & Affordability',
          'RESIDENTIAL': 'Step 3: Residential History',
          'CREDIT_TAS': 'Step 4: Credit & TAS Check'
        }

        verificationSteps.forEach((step: VerificationStep) => {
          // Check if we need a new page
          if (y > 700) {
            doc.addPage()
            y = 50
          }

          const stepLabel = stepLabels[step.step_type] || `Step ${step.step_number}`
          const passColor = step.overall_pass ? passGreen : failRed
          const passText = step.overall_pass === true ? 'PASS' : step.overall_pass === false ? 'FAIL' : 'PENDING'

          // Step header with pass/fail badge
          doc.fontSize(11).fillColor(darkGray).font('Helvetica-Bold')
            .text(stepLabel, 50, y, { continued: true })

          doc.fontSize(9).fillColor(passColor).font('Helvetica-Bold')
            .text(` [${passText}]`, { continued: false })

          y += 20

          // Evidence sources used
          if (step.evidence_sources && step.evidence_sources.length > 0) {
            doc.fontSize(9).fillColor(lightGray).font('Helvetica-Bold')
              .text('Evidence Sources:', 60, y)
            y += 15

            step.evidence_sources.forEach((evidenceType: string) => {
              const label = evidenceLabels[evidenceType] || evidenceType
              doc.fontSize(8).fillColor(darkGray).font('Helvetica')
                .text(`• ${label}`, 70, y)
              y += 12
            })
          } else if (step.step_type !== 'ID_SELFIE') {
            doc.fontSize(8).fillColor(lightGray).font('Helvetica-Oblique')
              .text('No evidence sources recorded', 70, y)
            y += 12
          }

          // Notes
          if (step.notes && step.notes.trim().length > 0) {
            y += 5
            doc.fontSize(9).fillColor(lightGray).font('Helvetica-Bold')
              .text('Notes:', 60, y)
            y += 15
            doc.fontSize(8).fillColor(darkGray).font('Helvetica')
              .text(step.notes, 70, y, { width: 465 })
            y += doc.heightOfString(step.notes, { width: 465 }) + 5
          }

          y += 15 // Spacing between steps
        })
      } else {
        doc.fontSize(9).fillColor(lightGray).font('Helvetica-Oblique')
          .text('No verification steps completed', 60, y)
        y += 20
      }

      // ========== PAGE 2: DETAILED CHECKS & COMPLIANCE ==========
      doc.addPage()
      y = 50

      // Header on second page
      doc.fontSize(18).fillColor(darkGray).font('Helvetica-Bold')
        .text('Detailed Verification Checks', 50, y)
      doc.moveTo(50, y + 25).lineTo(545, y + 25).strokeColor(primaryColor).lineWidth(1).stroke()
      y += 40

      // Right to Rent Check
      doc.fontSize(12).fillColor(darkGray).font('Helvetica-Bold')
        .text('Right to Rent Compliance', 50, y)
      y += 20
      doc.fontSize(9).fillColor(darkGray).font('Helvetica')
        .text('All checks performed in accordance with UK Right to Rent requirements.', 60, y, { width: 475 })
      y += 30

      // Identity Verification Details
      const idStep = verificationSteps?.find((s: VerificationStep) => s.step_type === 'ID_SELFIE')
      if (idStep) {
        doc.fontSize(11).fillColor(darkGray).font('Helvetica-Bold')
          .text('Identity Verification', 50, y)
        y += 20
        doc.fontSize(9).fillColor(darkGray).font('Helvetica')
          .text('ID document verified against photo identification and selfie match.', 60, y, { width: 475 })
        y += 15
        if (idStep.notes) {
          doc.fontSize(8).fillColor(lightGray).font('Helvetica')
            .text(`Notes: ${idStep.notes}`, 60, y, { width: 475 })
          y += doc.heightOfString(`Notes: ${idStep.notes}`, { width: 475 })
        }
        y += 20
      }

      // Income & Affordability Details
      const incomeStep = verificationSteps?.find((s: VerificationStep) => s.step_type === 'INCOME_AFFORDABILITY')
      if (incomeStep) {
        doc.fontSize(11).fillColor(darkGray).font('Helvetica-Bold')
          .text('Income & Affordability Assessment', 50, y)
        y += 20

        if (incomeStep.evidence_sources && incomeStep.evidence_sources.length > 0) {
          doc.fontSize(9).fillColor(darkGray).font('Helvetica')
            .text('Verified using the following documentation:', 60, y)
          y += 15
          incomeStep.evidence_sources.forEach((evidenceType: string) => {
            const label = evidenceLabels[evidenceType] || evidenceType
            doc.fontSize(8).fillColor(darkGray).font('Helvetica')
              .text(`• ${label}`, 70, y)
            y += 12
          })
        }

        if (incomeStep.notes) {
          y += 5
          doc.fontSize(8).fillColor(lightGray).font('Helvetica')
            .text(`Assessment: ${incomeStep.notes}`, 60, y, { width: 475 })
          y += doc.heightOfString(`Assessment: ${incomeStep.notes}`, { width: 475 })
        }
        y += 20
      }

      // Residential History Details
      const residentialStep = verificationSteps?.find((s: VerificationStep) => s.step_type === 'RESIDENTIAL')
      if (residentialStep) {
        doc.fontSize(11).fillColor(darkGray).font('Helvetica-Bold')
          .text('Residential History Verification', 50, y)
        y += 20

        if (residentialStep.evidence_sources && residentialStep.evidence_sources.length > 0) {
          doc.fontSize(9).fillColor(darkGray).font('Helvetica')
            .text('Verified using the following documentation:', 60, y)
          y += 15
          residentialStep.evidence_sources.forEach((evidenceType: string) => {
            const label = evidenceLabels[evidenceType] || evidenceType
            doc.fontSize(8).fillColor(darkGray).font('Helvetica')
              .text(`• ${label}`, 70, y)
            y += 12
          })
        }

        if (residentialStep.notes) {
          y += 5
          doc.fontSize(8).fillColor(lightGray).font('Helvetica')
            .text(`Assessment: ${residentialStep.notes}`, 60, y, { width: 475 })
          y += doc.heightOfString(`Assessment: ${residentialStep.notes}`, { width: 475 })
        }
        y += 20
      }

      // Credit & TAS Details
      const creditStep = verificationSteps?.find((s: VerificationStep) => s.step_type === 'CREDIT_TAS')
      if (creditStep) {
        doc.fontSize(11).fillColor(darkGray).font('Helvetica-Bold')
          .text('Credit & Background Checks', 50, y)
        y += 20

        if (creditStep.evidence_sources && creditStep.evidence_sources.length > 0) {
          doc.fontSize(9).fillColor(darkGray).font('Helvetica')
            .text('Checks performed:', 60, y)
          y += 15
          creditStep.evidence_sources.forEach((evidenceType: string) => {
            const label = evidenceLabels[evidenceType] || evidenceType
            doc.fontSize(8).fillColor(darkGray).font('Helvetica')
              .text(`• ${label}`, 70, y)
            y += 12
          })
        }

        if (creditStep.notes) {
          y += 5
          doc.fontSize(8).fillColor(lightGray).font('Helvetica')
            .text(`Assessment: ${creditStep.notes}`, 60, y, { width: 475 })
          y += doc.heightOfString(`Assessment: ${creditStep.notes}`, { width: 475 })
        }
        y += 20
      }

      // Footer on both pages
      const addFooter = (pageNumber: number) => {
        const footerY = 770
        doc.fontSize(8).fillColor(lightGray).font('Helvetica')
          .text(
            `PropertyGoose Tenant Reference Report | Generated ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}`,
            50,
            footerY,
            { align: 'left', width: 300 }
          )
        doc.fontSize(8).fillColor(lightGray).font('Helvetica')
          .text(
            `Page ${pageNumber} of 2`,
            0,
            footerY,
            { align: 'right', width: 545 }
          )
      }

      // Add footers to both pages
      doc.switchToPage(0)
      addFooter(1)
      doc.switchToPage(1)
      addFooter(2)

      doc.end()
    } catch (error) {
      console.error('[PDF V2] Generation error:', error)
      reject(error)
    }
  })
}

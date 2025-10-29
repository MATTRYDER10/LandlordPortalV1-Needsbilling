import PDFDocument from 'pdfkit'
import { supabase } from '../config/supabase'
import { decrypt } from './encryption'
import path from 'path'

export async function generateReferenceReportPDF(referenceId: string): Promise<{ buffer: Buffer; firstName: string; lastName: string }> {
  // Fetch reference data
  console.log(`[PDF] Fetching reference ${referenceId}...`)
  const { data: reference, error: refError } = await supabase
    .from('tenant_references')
    .select('*')
    .eq('id', referenceId)
    .single()

  if (refError || !reference) {
    console.error('[PDF] Error fetching reference:', refError)
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

  console.log(`[PDF] Reference found: ${firstName} ${lastName}`)

  // Fetch company name
  let companyName = 'N/A'
  if (reference.company_id) {
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', reference.company_id)
      .single()
    if (company) companyName = company.name
  }

  // Fetch score
  const { data: score } = await supabase
    .from('reference_scores')
    .select('*')
    .eq('reference_id', referenceId)
    .maybeSingle()

  // Fetch Creditsafe verification data
  const { data: creditsafe } = await supabase
    .from('creditsafe_verifications')
    .select('*')
    .eq('reference_id', referenceId)
    .maybeSingle()

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
        ['DOB', dateOfBirth ? formatDate(dateOfBirth) : 'Not provided']
      ]
      appInfo.forEach(([label, value]) => {
        doc.text(`${label}:`, leftColX, leftY).fillColor(darkGray).font('Helvetica-Bold').text(value, leftColX + labelWidth, leftY, { width: 180 })
        doc.fillColor(lightGray).font('Helvetica')
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
        ['Rent', `£${reference.monthly_rent}`],
        ['Move-in', reference.move_in_date ? formatDate(reference.move_in_date) : 'Not provided']
      ]
      propInfo.forEach(([label, value]) => {
        doc.text(`${label}:`, rightColX, rightY).fillColor(darkGray).font('Helvetica-Bold').text(value, rightColX + labelWidth, rightY, { width: 155 })
        doc.fillColor(lightGray).font('Helvetica')
        rightY += 15
      })

      // Set y to the bottom of the tallest column
      y = Math.max(leftY, rightY) + 10

      // Score Section
      if (score) {
        doc.fontSize(14).fillColor(darkGray).font('Helvetica-Bold').text('Reference Score', 50, y)
        y += 25

        const decisionColor = score.decision === 'PASS' ? '#10b981' :
                             score.decision === 'PASS_WITH_GUARANTOR' ? '#f59e0b' :
                             score.decision === 'DECLINE' ? '#ef4444' : lightGray

        // Table layout for status and score
        const tableX = 50
        const labelCol = tableX
        const valueCol = tableX + 150

        // Draw table rows
        doc.fontSize(9).fillColor(lightGray).font('Helvetica').text('Decision:', labelCol, y)
        doc.fontSize(10).fillColor('#ffffff').rect(valueCol, y - 2, 120, 18).fill(decisionColor)
          .fillColor('#ffffff').font('Helvetica-Bold').text(formatDecision(score.decision), valueCol + 5, y + 2)
        y += 20

        doc.fontSize(9).fillColor(lightGray).font('Helvetica').text('Score:', labelCol, y)
        doc.fontSize(16).fillColor(decisionColor).font('Helvetica-Bold').text(`${score.score_total}/100`, valueCol, y - 2)
        y += 20

        doc.fontSize(9).fillColor(lightGray).font('Helvetica').text('Income Ratio:', labelCol, y)
        doc.fillColor(darkGray).font('Helvetica-Bold').text(`${score.ratio.toFixed(2)}×`, valueCol, y)
        y += 25

        // Score breakdown
        doc.fontSize(11).fillColor(darkGray).font('Helvetica-Bold').text('Score Breakdown', 50, y)
        y += 18
        const domains = [
          ['Credit & TAS', score.domain_scores.credit_tas, 35],
          ['Affordability', score.domain_scores.affordability, 30],
          ['Employment', score.domain_scores.employment, 15],
          ['Residential', score.domain_scores.residential, 15],
          ['ID & Data', score.domain_scores.id_data, 5]
        ]
        domains.forEach(([label, value, max]) => {
          doc.fontSize(9).fillColor(lightGray).font('Helvetica').text(label as string, 50, y)
            .fillColor(darkGray).font('Helvetica-Bold').text(`${value}/${max}`, 200, y)
          const barWidth = (150 * (value as number)) / (max as number)
          doc.rect(260, y, 150, 8).fillAndStroke('#e5e7eb', '#d1d5db')
          if (barWidth > 0) doc.rect(260, y, barWidth, 8).fill(primaryColor)
          y += 15
        })

        // Decline reasons
        if (score.decline_reasons && score.decline_reasons.length > 0) {
          y += 5
          doc.fontSize(10).fillColor('#ef4444').font('Helvetica-Bold').text('Decline Reasons:', 50, y)
          y += 15
          score.decline_reasons.forEach((reason: string) => {
            doc.fontSize(8).fillColor('#ef4444').font('Helvetica').text(`• ${reason}`, 60, y)
            y += 12
          })
        }

        // Guarantor required
        if (score.guarantor_required) {
          y += 5
          doc.fontSize(10).fillColor('#f59e0b').font('Helvetica-Bold').text('Guarantor Required', 50, y)
          y += 15
          doc.fontSize(8).fillColor(lightGray).font('Helvetica')
            .text(`Min Ratio: ${score.guarantor_min_ratio}× | Min TAS: ${score.guarantor_min_tas}`, 60, y)
        }
      }

      // Creditsafe Verification Section
      if (creditsafe) {
        y += 15
        doc.fontSize(14).fillColor(darkGray).font('Helvetica-Bold').text('Identity Verification', 50, y)
        y += 25

        // Verification Status Badge
        const statusColor = creditsafe.verification_status === 'passed' ? '#10b981' :
                          creditsafe.verification_status === 'failed' ? '#ef4444' :
                          creditsafe.verification_status === 'refer' ? '#f59e0b' : lightGray

        // Table layout matching Reference Score section
        const tableX = 50
        const labelCol = tableX
        const valueCol = tableX + 150

        // Draw table rows
        doc.fontSize(9).fillColor(lightGray).font('Helvetica').text('Status:', labelCol, y)
        doc.fontSize(10).fillColor('#ffffff').rect(valueCol, y - 2, 120, 18).fill(statusColor)
          .fillColor('#ffffff').font('Helvetica-Bold').text(
            creditsafe.verification_status?.toUpperCase() || 'PENDING',
            valueCol + 5,
            y + 2
          )
        y += 20

        // Verification Score
        if (creditsafe.verification_score !== null && creditsafe.verification_score !== undefined) {
          doc.fontSize(9).fillColor(lightGray).font('Helvetica').text('Score:', labelCol, y)
          doc.fontSize(16).fillColor(statusColor).font('Helvetica-Bold').text(
            `${creditsafe.verification_score}/100`,
            valueCol,
            y - 2
          )
          y += 20
        }

        // Risk Level
        if (creditsafe.risk_level) {
          const riskColor = creditsafe.risk_level === 'low' ? '#10b981' :
                          creditsafe.risk_level === 'medium' ? '#f59e0b' :
                          creditsafe.risk_level === 'high' ? '#ef4444' :
                          creditsafe.risk_level === 'very_high' ? '#991b1b' : lightGray

          doc.fontSize(9).fillColor(lightGray).font('Helvetica').text('Risk Level:', labelCol, y)
          doc.fillColor(riskColor).font('Helvetica-Bold').text(
            creditsafe.risk_level.toUpperCase().replace('_', ' '),
            valueCol,
            y
          )
          y += 20
        }

        // Document Verification
        if (creditsafe.document_verified !== null) {
          doc.fontSize(9).fillColor(lightGray).font('Helvetica').text('Document Verified:', labelCol, y)
          doc.fillColor(creditsafe.document_verified ? '#10b981' : '#ef4444').font('Helvetica-Bold')
            .text(creditsafe.document_verified ? 'YES' : 'NO', valueCol, y)
          y += 20
        }

        y += 5

        // Match Scores
        doc.fontSize(11).fillColor(darkGray).font('Helvetica-Bold').text('Identity Match Scores', 50, y)
        y += 18

        const matchScores = [
          ['Name Match', creditsafe.name_match_score],
          ['Address Match', creditsafe.address_match_score],
          ['DOB Match', creditsafe.dob_match_score]
        ].filter(([, score]) => score !== null && score !== undefined)

        matchScores.forEach(([label, score]) => {
          doc.fontSize(9).fillColor(lightGray).font('Helvetica').text(label as string, 50, y)
            .fillColor(darkGray).font('Helvetica-Bold').text(`${score}/100`, 200, y)
          const barWidth = (150 * (score as number)) / 100
          doc.rect(260, y, 150, 8).fillAndStroke('#e5e7eb', '#d1d5db')
          if (barWidth > 0) doc.rect(260, y, barWidth, 8).fill(primaryColor)
          y += 15
        })

        // Compliance Checks
        const hasComplianceChecks = creditsafe.pep_check_result !== null ||
                                   creditsafe.sanctions_check_result !== null ||
                                   creditsafe.adverse_media_result !== null

        if (hasComplianceChecks) {
          doc.fontSize(11).fillColor(darkGray).font('Helvetica-Bold').text('Compliance Checks', 50, y)
          y += 18

          const complianceChecks = []
          if (creditsafe.pep_check_result !== null) {
            complianceChecks.push(['PEP Check', creditsafe.pep_check_result ? 'FLAGGED' : 'CLEAR', creditsafe.pep_check_result])
          }
          if (creditsafe.sanctions_check_result !== null) {
            complianceChecks.push(['Sanctions Check', creditsafe.sanctions_check_result ? 'FLAGGED' : 'CLEAR', creditsafe.sanctions_check_result])
          }
          if (creditsafe.adverse_media_result !== null) {
            complianceChecks.push(['Adverse Media', creditsafe.adverse_media_result ? 'FLAGGED' : 'CLEAR', creditsafe.adverse_media_result])
          }

          complianceChecks.forEach(([label, text, isFlagged]) => {
            const checkColor = isFlagged ? '#ef4444' : '#10b981'
            doc.fontSize(9).fillColor(lightGray).font('Helvetica').text(label as string, 50, y)
            doc.fillColor(checkColor).font('Helvetica-Bold').text(text as string, valueCol, y)
            y += 15
          })
          y += 5
        }

        // Fraud Indicators
        if (creditsafe.fraud_indicators && Array.isArray(creditsafe.fraud_indicators) && creditsafe.fraud_indicators.length > 0) {
          y += 5
          doc.fontSize(10).fillColor('#ef4444').font('Helvetica-Bold').text('Fraud Indicators:', 50, y)
          y += 15
          creditsafe.fraud_indicators.forEach((indicator: any) => {
            const indicatorText = typeof indicator === 'string' ? indicator : indicator.message || JSON.stringify(indicator)
            doc.fontSize(8).fillColor('#ef4444').font('Helvetica').text(`• ${indicatorText}`, 60, y, { width: 485 })
            y += 12
          })
        }

        // Verification Date
        if (creditsafe.verified_at) {
          y += 5
          doc.fontSize(8).fillColor(lightGray).font('Helvetica').text(
            `Verified on ${formatDate(creditsafe.verified_at)}`,
            50,
            y
          )
        }
      }

      // Footer
      doc.fontSize(8).fillColor(lightGray).font('Helvetica')
        .text(`Generated on ${formatDate(new Date().toISOString())} | PropertyGoose Tenant Referencing`, 50, 750, { align: 'center', width: 495 })

      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}

function formatDecision(decision: string): string {
  const map: { [key: string]: string } = {
    'PASS': 'PASS',
    'PASS_WITH_GUARANTOR': 'PASS WITH GUARANTOR',
    'MANUAL_REVIEW': 'MANUAL REVIEW',
    'DECLINE': 'DECLINE'
  }
  return map[decision] || decision
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

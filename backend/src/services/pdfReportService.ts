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

      // Applicant Info
      doc.fontSize(14).fillColor(darkGray).font('Helvetica-Bold').text('Applicant Information', 50, y)
      y += 20
      doc.fontSize(9).fillColor(lightGray).font('Helvetica')
      const appInfo = [
        ['Name', `${firstName}${middleName ? ' ' + middleName : ''} ${lastName}`],
        ['Email', email || 'Not provided'],
        ['Phone', phone || 'Not provided'],
        ['DOB', dateOfBirth ? formatDate(dateOfBirth) : 'Not provided'],
        ['Company', companyName]
      ]
      appInfo.forEach(([label, value]) => {
        doc.text(`${label}:`, 50, y).fillColor(darkGray).font('Helvetica-Bold').text(value, 150, y)
        doc.fillColor(lightGray).font('Helvetica')
        y += 15
      })

      y += 5

      // Property Info
      doc.fontSize(14).fillColor(darkGray).font('Helvetica-Bold').text('Property Information', 50, y)
      y += 20
      doc.fontSize(9).fillColor(lightGray).font('Helvetica')
      const propInfo = [
        ['Address', propertyAddress || 'Not provided'],
        ['City', propertyCity || 'Not provided'],
        ['Postcode', propertyPostcode || 'Not provided'],
        ['Rent', `£${reference.monthly_rent}`],
        ['Move-in', reference.move_in_date ? formatDate(reference.move_in_date) : 'Not provided']
      ]
      propInfo.forEach(([label, value]) => {
        doc.text(`${label}:`, 50, y).fillColor(darkGray).font('Helvetica-Bold').text(value, 150, y)
        doc.fillColor(lightGray).font('Helvetica')
        y += 15
      })

      y += 10

      // Score Section
      if (score) {
        doc.fontSize(14).fillColor(darkGray).font('Helvetica-Bold').text('Reference Score', 50, y)
        y += 25

        const decisionColor = score.decision === 'PASS' ? '#10b981' :
                             score.decision === 'PASS_WITH_GUARANTOR' ? '#f59e0b' :
                             score.decision === 'DECLINE' ? '#ef4444' : lightGray

        doc.fontSize(12).fillColor('#ffffff').rect(50, y, 150, 25).fill(decisionColor)
          .fillColor('#ffffff').font('Helvetica-Bold').text(formatDecision(score.decision), 55, y + 6)
        doc.fontSize(28).fillColor(decisionColor).text(`${score.score_total}/100`, 220, y - 3)

        y += 35

        doc.fontSize(10).fillColor(lightGray).font('Helvetica')
          .text(`Income Ratio: ${score.ratio.toFixed(2)}×`, 50, y)
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

import PDFDocument from 'pdfkit'
import { supabase } from '../config/supabase'
import { decrypt } from './encryption'
import path from 'path'

interface ReferenceData {
  id: string
  first_name: string
  middle_name?: string
  last_name: string
  email: string
  phone?: string
  date_of_birth?: string
  property_address: string
  property_city?: string
  property_postcode?: string
  monthly_rent: number
  move_in_date?: string
  status: string
  created_at: string
  verified_at?: string
  companies?: {
    name: string
  }
}

interface ScoreData {
  decision: string
  score_total: number
  domain_scores: {
    credit_tas: number
    affordability: number
    employment: number
    residential: number
    id_data: number
  }
  ratio: number
  caps?: string[]
  review_flags?: string[]
  decline_reasons?: string[]
  guarantor_required: boolean
  guarantor_min_ratio?: number
  guarantor_min_tas?: number
  scored_at: string
}

export async function generateReferenceReportPDF(referenceId: string): Promise<Buffer> {
  // Fetch reference data
  const { data: reference, error: refError } = await supabase
    .from('tenant_references')
    .select('*, companies(name)')
    .eq('id', referenceId)
    .single()

  if (refError || !reference) {
    throw new Error('Reference not found')
  }

  // Fetch score data
  const { data: score, error: scoreError } = await supabase
    .from('reference_scores')
    .select('*')
    .eq('reference_id', referenceId)
    .maybeSingle()

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true
      })

      const chunks: Buffer[] = []
      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // Colors
      const primaryColor = '#f97316' // Orange
      const darkGray = '#1f2937'
      const lightGray = '#6b7280'
      const successGreen = '#10b981'
      const warningOrange = '#f59e0b'
      const errorRed = '#ef4444'

      // Header with logo and branding
      const logoPath = path.join(__dirname, '../../assets/PropertyGooseIcon.png')
      try {
        doc.image(logoPath, 50, 45, { width: 50 })
      } catch (err) {
        console.error('Failed to load logo:', err)
      }

      doc.fontSize(24)
        .fillColor(darkGray)
        .font('Helvetica-Bold')
        .text('PropertyGoose', 110, 50)

      doc.fontSize(10)
        .fillColor(lightGray)
        .font('Helvetica')
        .text('Tenant Reference Report', 110, 75)

      // Horizontal line
      doc.moveTo(50, 110)
        .lineTo(545, 110)
        .strokeColor(primaryColor)
        .lineWidth(2)
        .stroke()

      let yPosition = 130

      // Reference Status Badge
      const statusBg = reference.status === 'completed' ? successGreen :
                       reference.status === 'rejected' ? errorRed : lightGray

      doc.fontSize(12)
        .fillColor('#ffffff')
        .rect(50, yPosition, 150, 25)
        .fill(statusBg)
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .text(formatStatus(reference.status).toUpperCase(), 55, yPosition + 7)

      yPosition += 45

      // Applicant Information Section
      doc.fontSize(16)
        .fillColor(darkGray)
        .font('Helvetica-Bold')
        .text('Applicant Information', 50, yPosition)

      yPosition += 25

      const applicantData = [
        ['Name', `${reference.first_name}${reference.middle_name ? ' ' + reference.middle_name : ''} ${reference.last_name}`],
        ['Email', reference.email],
        ['Phone', reference.phone || 'Not provided'],
        ['Date of Birth', reference.date_of_birth ? formatDate(reference.date_of_birth) : 'Not provided'],
        ['Company', reference.companies?.name || 'N/A']
      ]

      applicantData.forEach(([label, value]) => {
        doc.fontSize(10)
          .fillColor(lightGray)
          .font('Helvetica')
          .text(label, 50, yPosition)
          .fillColor(darkGray)
          .font('Helvetica-Bold')
          .text(value, 200, yPosition)
        yPosition += 20
      })

      yPosition += 10

      // Property Information Section
      doc.fontSize(16)
        .fillColor(darkGray)
        .font('Helvetica-Bold')
        .text('Property Information', 50, yPosition)

      yPosition += 25

      const propertyData = [
        ['Address', reference.property_address],
        ['City', reference.property_city || 'Not provided'],
        ['Postcode', reference.property_postcode || 'Not provided'],
        ['Monthly Rent', `£${reference.monthly_rent}`],
        ['Move-in Date', reference.move_in_date ? formatDate(reference.move_in_date) : 'Not provided']
      ]

      propertyData.forEach(([label, value]) => {
        doc.fontSize(10)
          .fillColor(lightGray)
          .font('Helvetica')
          .text(label, 50, yPosition)
          .fillColor(darkGray)
          .font('Helvetica-Bold')
          .text(value, 200, yPosition)
        yPosition += 20
      })

      yPosition += 20

      // Score Section (if available)
      if (score) {
        // Add new page if needed
        if (yPosition > 650) {
          doc.addPage()
          yPosition = 50
        }

        doc.fontSize(16)
          .fillColor(darkGray)
          .font('Helvetica-Bold')
          .text('Reference Score', 50, yPosition)

        yPosition += 30

        // Decision Badge
        const decisionColor = score.decision === 'PASS' ? successGreen :
                             score.decision === 'PASS_WITH_GUARANTOR' ? warningOrange :
                             score.decision === 'DECLINE' ? errorRed : lightGray

        doc.fontSize(14)
          .fillColor('#ffffff')
          .rect(50, yPosition, 180, 30)
          .fill(decisionColor)
          .fillColor('#ffffff')
          .font('Helvetica-Bold')
          .text(formatDecision(score.decision), 55, yPosition + 8)

        // Total Score
        doc.fontSize(32)
          .fillColor(decisionColor)
          .font('Helvetica-Bold')
          .text(`${score.score_total}/100`, 250, yPosition - 5)

        yPosition += 50

        // Income to Rent Ratio
        doc.fontSize(12)
          .fillColor(lightGray)
          .font('Helvetica')
          .text('Income to Rent Ratio', 50, yPosition)
          .fontSize(20)
          .fillColor(darkGray)
          .font('Helvetica-Bold')
          .text(`${score.ratio.toFixed(2)}×`, 200, yPosition - 3)

        yPosition += 35

        // Score Breakdown
        doc.fontSize(14)
          .fillColor(darkGray)
          .font('Helvetica-Bold')
          .text('Score Breakdown', 50, yPosition)

        yPosition += 25

        const domainData = [
          ['Credit & TAS', score.domain_scores.credit_tas, 35],
          ['Affordability', score.domain_scores.affordability, 30],
          ['Employment', score.domain_scores.employment, 15],
          ['Residential History', score.domain_scores.residential, 15],
          ['ID & Data Quality', score.domain_scores.id_data, 5]
        ]

        domainData.forEach(([label, value, max]) => {
          doc.fontSize(10)
            .fillColor(lightGray)
            .font('Helvetica')
            .text(label as string, 50, yPosition)
            .fillColor(darkGray)
            .font('Helvetica-Bold')
            .text(`${value}/${max}`, 250, yPosition)

          // Progress bar
          const barWidth = 200
          const fillWidth = (barWidth * (value as number)) / (max as number)

          doc.rect(300, yPosition, barWidth, 10)
            .fillAndStroke('#e5e7eb', '#d1d5db')

          if (fillWidth > 0) {
            doc.rect(300, yPosition, fillWidth, 10)
              .fill(primaryColor)
          }

          yPosition += 25
        })

        yPosition += 10

        // Conditions and Flags
        if (score.caps && score.caps.length > 0) {
          doc.fontSize(12)
            .fillColor(darkGray)
            .font('Helvetica-Bold')
            .text('Conditions', 50, yPosition)

          yPosition += 20

          score.caps.forEach((cap: string) => {
            doc.fontSize(9)
              .fillColor(warningOrange)
              .font('Helvetica')
              .text(`• ${formatCap(cap)}`, 60, yPosition)
            yPosition += 15
          })

          yPosition += 5
        }

        if (score.review_flags && score.review_flags.length > 0) {
          doc.fontSize(12)
            .fillColor(darkGray)
            .font('Helvetica-Bold')
            .text('Review Flags', 50, yPosition)

          yPosition += 20

          score.review_flags.forEach((flag: string) => {
            doc.fontSize(9)
              .fillColor(lightGray)
              .font('Helvetica')
              .text(`• ${formatFlag(flag)}`, 60, yPosition)
            yPosition += 15
          })

          yPosition += 5
        }

        if (score.decline_reasons && score.decline_reasons.length > 0) {
          doc.fontSize(12)
            .fillColor(darkGray)
            .font('Helvetica-Bold')
            .text('Decline Reasons', 50, yPosition)

          yPosition += 20

          score.decline_reasons.forEach((reason: string) => {
            doc.fontSize(9)
              .fillColor(errorRed)
              .font('Helvetica')
              .text(`• ${reason}`, 60, yPosition)
            yPosition += 15
          })

          yPosition += 5
        }

        // Guarantor Requirements
        if (score.guarantor_required) {
          doc.fontSize(12)
            .fillColor(darkGray)
            .font('Helvetica-Bold')
            .text('Guarantor Required', 50, yPosition)

          yPosition += 20

          doc.fontSize(10)
            .fillColor(lightGray)
            .font('Helvetica')
            .text(`Minimum Income Ratio: ${score.guarantor_min_ratio}×`, 60, yPosition)

          yPosition += 15

          doc.text(`Minimum TAS Score: ${score.guarantor_min_tas}`, 60, yPosition)

          yPosition += 20
        }

        // Scored At
        yPosition += 10
        doc.fontSize(9)
          .fillColor(lightGray)
          .font('Helvetica-Oblique')
          .text(`Scored on ${formatDate(score.scored_at)}`, 50, yPosition)
      }

      // Footer
      const pageCount = doc.bufferedPageRange().count
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i)

        doc.fontSize(8)
          .fillColor(lightGray)
          .font('Helvetica')
          .text(
            `Generated on ${formatDate(new Date().toISOString())} | PropertyGoose Tenant Referencing`,
            50,
            750,
            { align: 'center', width: 495 }
          )

        doc.text(
          `Page ${i + 1} of ${pageCount}`,
          50,
          760,
          { align: 'center', width: 495 }
        )
      }

      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}

function formatStatus(status: string): string {
  const statusMap: { [key: string]: string } = {
    'pending': 'Pending',
    'in_progress': 'In Progress',
    'pending_verification': 'Pending Verification',
    'completed': 'Completed',
    'rejected': 'Rejected'
  }
  return statusMap[status] || status
}

function formatDecision(decision: string): string {
  const decisionMap: { [key: string]: string } = {
    'PASS': 'PASS',
    'PASS_WITH_GUARANTOR': 'PASS WITH GUARANTOR',
    'MANUAL_REVIEW': 'MANUAL REVIEW',
    'DECLINE': 'DECLINE'
  }
  return decisionMap[decision] || decision
}

function formatCap(cap: string): string {
  return cap
    .replace(/_/g, ' ')
    .replace(/</g, '< ')
    .replace(/>/g, '> ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatFlag(flag: string): string {
  return flag
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

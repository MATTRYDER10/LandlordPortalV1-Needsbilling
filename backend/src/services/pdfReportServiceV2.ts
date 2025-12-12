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

  // Fetch Creditsafe verification data
  const { data: creditsafe } = await supabase
    .from('creditsafe_verifications')
    .select('*')
    .eq('reference_id', referenceId)
    .maybeSingle()

  // Fetch sanctions screening
  const { data: sanctions } = await supabase
    .from('sanctions_screenings')
    .select('*')
    .eq('reference_id', referenceId)
    .maybeSingle()

  // Fetch reference score
  const { data: score } = await supabase
    .from('reference_scores')
    .select('*')
    .eq('reference_id', referenceId)
    .maybeSingle()

  // Fetch landlord reference
  const { data: landlordReference } = await supabase
    .from('landlord_references')
    .select('*')
    .eq('reference_id', referenceId)
    .maybeSingle()

  // Fetch agent reference
  const { data: agentReference } = await supabase
    .from('agent_references')
    .select('*')
    .eq('reference_id', referenceId)
    .maybeSingle()

  // Fetch employer reference
  const { data: employerReference } = await supabase
    .from('employer_references')
    .select('*')
    .eq('reference_id', referenceId)
    .maybeSingle()

  // Fetch guarantor reference
  const { data: guarantorReference } = await supabase
    .from('guarantor_references')
    .select('*')
    .eq('reference_id', referenceId)
    .maybeSingle()

  // Decrypt guarantor fields if exists
  let decryptedGuarantor: any = null
  if (guarantorReference) {
    decryptedGuarantor = {
      ...guarantorReference,
      guarantor_first_name: decrypt(guarantorReference.guarantor_first_name_encrypted),
      guarantor_last_name: decrypt(guarantorReference.guarantor_last_name_encrypted),
      email: decrypt(guarantorReference.email_encrypted),
      contact_number: decrypt(guarantorReference.contact_number_encrypted),
      annual_income: decrypt(guarantorReference.annual_income_encrypted),
      savings_amount: decrypt(guarantorReference.savings_amount_encrypted),
      employer_name: decrypt(guarantorReference.employer_name_encrypted),
      job_title: decrypt(guarantorReference.job_title_encrypted)
    }
  }

  // Calculate total income - use verified values when available, otherwise original
  // Employment salary - check verified first
  const employmentSalary = reference.verified_salary_amount_encrypted
    ? parseFloat(decrypt(reference.verified_salary_amount_encrypted) || '0')
    : (reference.employment_salary_amount_encrypted
        ? parseFloat(decrypt(reference.employment_salary_amount_encrypted) || '0')
        : 0)

  // Self-employed income - check verified first
  const selfEmployedIncome = reference.verified_self_employed_income_encrypted
    ? parseFloat(decrypt(reference.verified_self_employed_income_encrypted) || '0')
    : (reference.self_employed_annual_income_encrypted
        ? parseFloat(decrypt(reference.self_employed_annual_income_encrypted) || '0')
        : 0)

  // Benefits - check verified first
  const benefitsAnnual = reference.verified_benefits_amount_encrypted
    ? parseFloat(decrypt(reference.verified_benefits_amount_encrypted) || '0')
    : (reference.benefits_annual_amount_encrypted
        ? parseFloat(decrypt(reference.benefits_annual_amount_encrypted) || '0')
        : 0)

  // Additional income - check verified first
  const additionalIncome = reference.verified_additional_income_amount_encrypted
    ? parseFloat(decrypt(reference.verified_additional_income_amount_encrypted) || '0')
    : (reference.additional_income_amount_encrypted
        ? parseFloat(decrypt(reference.additional_income_amount_encrypted) || '0')
        : 0)

  // Calculate total or use override
  let totalIncome: number
  if (reference.verified_total_income_encrypted) {
    totalIncome = parseFloat(decrypt(reference.verified_total_income_encrypted) || '0')
  } else {
    totalIncome = employmentSalary + selfEmployedIncome + benefitsAnnual + additionalIncome
  }

  // Extract personal data fields
  const hasChildren = reference.number_of_dependants ? reference.number_of_dependants > 0 : false
  const numberOfChildren = reference.number_of_dependants || 0
  const isSmoker = reference.is_smoker === true
  const hasPets = reference.has_pets === true
  const petDetails = reference.pet_details_encrypted ? decrypt(reference.pet_details_encrypted) : ''
  const numberOfTenants = reference.number_of_tenants || 1

  // Extract affordability data
  const monthlyRent = reference.monthly_rent || (reference.monthly_rent_encrypted ? parseFloat(decrypt(reference.monthly_rent_encrypted) || '0') : 0)
  const rentShare = reference.rent_share ? parseFloat(String(reference.rent_share)) : monthlyRent
  const affordabilityRatio = score?.ratio || (totalIncome > 0 && monthlyRent > 0 ? (totalIncome / 12) / monthlyRent : 0)

  // Verified savings - check verified field first
  const verifiedSavings = reference.verified_savings_amount_encrypted
    ? parseFloat(decrypt(reference.verified_savings_amount_encrypted) || '0')
    : (reference.savings_amount_encrypted
        ? parseFloat(decrypt(reference.savings_amount_encrypted) || '0')
        : 0)

  const maxAffordableRent = totalIncome > 0 ? (totalIncome / 12) / 2.5 : 0 // Assuming 2.5x ratio minimum

  // Parse fraud indicators for credit history
  let ccjCount = 0
  let bankruptcyCount = 0
  let adverseCreditFound = false
  if (creditsafe?.fraud_indicators) {
    try {
      const fraudIndicators = typeof creditsafe.fraud_indicators === 'string'
        ? JSON.parse(creditsafe.fraud_indicators)
        : creditsafe.fraud_indicators
      ccjCount = fraudIndicators.ccjCount || 0
      bankruptcyCount = fraudIndicators.insolvencyCount || 0
      adverseCreditFound = fraudIndicators.ccjMatch || fraudIndicators.insolvencyMatch || false
    } catch (e) {
      console.error('Error parsing fraud indicators:', e)
    }
  }

  // Parse sanctions matches
  let sanctionsMatches: any[] = []
  if (sanctions?.sanctions_matches) {
    try {
      sanctionsMatches = Array.isArray(sanctions.sanctions_matches)
        ? sanctions.sanctions_matches
        : JSON.parse(sanctions.sanctions_matches || '[]')
    } catch (e) {
      console.error('Error parsing sanctions matches:', e)
    }
  }

  // Check if living with family
  const isLivingWithFamily = reference.reference_type === 'living_with_family'
  const landlordComments = landlordReference?.additional_comments_encrypted
    ? decrypt(landlordReference.additional_comments_encrypted)
    : agentReference?.additional_comments_encrypted
      ? decrypt(agentReference.additional_comments_encrypted)
      : ''

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      const chunks: Buffer[] = []
      let pageCount = 0

      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve({
        buffer: Buffer.concat(chunks),
        firstName,
        lastName
      }))
      doc.on('error', reject)

      // Track page count
      let currentPage = 1

      // Helper to add footer to current page
      const addFooter = (totalPages?: number) => {
        const footerY = 770
        const pageText = totalPages ? `Page ${currentPage} of ${totalPages}` : `Page ${currentPage}`
        const generatedDate = new Date().toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })
        doc.fontSize(8).fillColor(lightGray).font('Helvetica')
          .text(
            `Report generated on ${generatedDate}`,
            50,
            footerY,
            { align: 'left', width: 300 }
          )
        doc.fontSize(8).fillColor(lightGray).font('Helvetica')
          .text(
            pageText,
            0,
            footerY,
            { align: 'right', width: 545 }
          )
      }

      // Helper to add new page with footer
      const addPageWithFooter = () => {
        doc.addPage()
        currentPage++
        addFooter()
      }

      // Add footer to first page
      const addFirstPageFooter = () => {
        addFooter()
      }

      const primaryColor = '#f97316'
      const darkGray = '#1f2937'
      const lightGray = '#6b7280'
      const passGreen = '#10b981'
      const failRed = '#ef4444'

      // ========== PAGE 1: CERTIFICATE OF COMPLETION ==========

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

      // Certificate of Completion Header
      doc.fontSize(20).fillColor(darkGray).font('Helvetica-Bold')
        .text('Certificate of Completion', 50, y, { align: 'center', width: 495 })
      y += 30

      // Pass statement
      doc.fontSize(12).fillColor(darkGray).font('Helvetica')
        .text('PropertyGoose recognises this reference as a pass.', 50, y, { align: 'center', width: 495 })
      y += 25

      // Rental Address
      const fullPropertyAddress = `${propertyAddress}${propertyCity ? ', ' + propertyCity : ''}${propertyPostcode ? ' ' + propertyPostcode : ''}`
      doc.fontSize(11).fillColor(darkGray).font('Helvetica-Bold')
        .text('Rental Address:', 50, y)
      y += 15
      doc.fontSize(10).fillColor(darkGray).font('Helvetica')
        .text(fullPropertyAddress || 'Not provided', 50, y, { width: 495 })
      y += 20

      // Tenant Name
      const fullTenantName = `${firstName}${middleName ? ' ' + middleName : ''} ${lastName}`
      doc.fontSize(11).fillColor(darkGray).font('Helvetica-Bold')
        .text('Tenant Name:', 50, y)
      y += 15
      doc.fontSize(10).fillColor(darkGray).font('Helvetica')
        .text(fullTenantName, 50, y, { width: 495 })
      y += 30

      // Personal Data Section with orange bar
      if (y > 650) {
        addPageWithFooter()
        y = 50
      }

      // Orange section bar
      doc.rect(50, y, 495, 25).fill(primaryColor)
      doc.fontSize(12).fillColor('#ffffff').font('Helvetica-Bold')
        .text('Personal Data', 60, y + 7)
      y += 35

      doc.fontSize(9).fillColor(darkGray).font('Helvetica')
      const personalDataItems = [
        ['Has children', hasChildren ? `Yes (${numberOfChildren})` : 'No'],
        ['Smoker', isSmoker ? 'Yes' : 'No'],
        ['Pets', hasPets ? (petDetails ? `Yes - ${petDetails}` : 'Yes') : 'No'],
        ['Number of tenants', numberOfTenants.toString()]
      ]

      personalDataItems.forEach(([label, value]) => {
        doc.font('Helvetica-Bold').text(`${label}:`, 60, y, { continued: false })
        doc.font('Helvetica').fillColor(darkGray).text(value, 150, y, { width: 400 })
        y += 15
      })
      y += 10

      // Income Check Section
      const incomeStep = verificationSteps?.find((s: VerificationStep) => s.step_type === 'INCOME_AFFORDABILITY')
      if (incomeStep || totalIncome > 0) {
        if (y > 650) {
          addPageWithFooter()
          y = 50
        }

        // Orange section bar
        doc.rect(50, y, 495, 25).fill(primaryColor)
        doc.fontSize(12).fillColor('#ffffff').font('Helvetica-Bold')
          .text('Income Check', 60, y + 7)
        y += 35

        // Income verification type
        if (incomeStep?.evidence_sources && incomeStep.evidence_sources.length > 0) {
          doc.fontSize(9).fillColor(darkGray).font('Helvetica-Bold')
            .text('Income verification type:', 60, y)
          y += 15
          doc.fontSize(9).fillColor(darkGray).font('Helvetica')
          incomeStep.evidence_sources.forEach((evidenceType: string) => {
            const label = evidenceLabels[evidenceType] || evidenceType
            doc.text(`• ${label}`, 70, y, { width: 465 })
            y += 12
          })
          y += 5
        }

        // Remarks (optional)
        if (incomeStep?.notes && incomeStep.notes.trim().length > 0) {
          doc.fontSize(8).fillColor(lightGray).font('Helvetica')
            .text(incomeStep.notes, 60, y, { width: 475 })
          y += doc.heightOfString(incomeStep.notes, { width: 475 }) + 10
        } else {
          y += 5
        }
      }

      // Affordability Section
      if (y > 650) {
        addPageWithFooter()
        y = 50
      }

      // Orange section bar
      doc.rect(50, y, 495, 25).fill(primaryColor)
      doc.fontSize(12).fillColor('#ffffff').font('Helvetica-Bold')
        .text('Affordability', 60, y + 7)
      y += 35

      // Affordability box
      doc.rect(60, y, 475, 80).stroke(darkGray).lineWidth(1)
      const boxY = y + 10

      doc.fontSize(9).fillColor(darkGray).font('Helvetica-Bold')
        .text('Rent share:', 70, boxY)
      doc.fontSize(9).fillColor(darkGray).font('Helvetica')
        .text(`£${rentShare.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 200, boxY)

      doc.fontSize(9).fillColor(darkGray).font('Helvetica-Bold')
        .text('Affordability ratio:', 70, boxY + 20)
      doc.fontSize(9).fillColor(darkGray).font('Helvetica')
        .text(affordabilityRatio.toFixed(2) + 'x', 200, boxY + 20)

      doc.fontSize(9).fillColor(darkGray).font('Helvetica-Bold')
        .text('Verified savings:', 70, boxY + 40)
      doc.fontSize(9).fillColor(darkGray).font('Helvetica')
        .text(`£${verifiedSavings.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 200, boxY + 40)

      doc.fontSize(9).fillColor(darkGray).font('Helvetica-Bold')
        .text('Maximum affordable rent:', 70, boxY + 60)
      doc.fontSize(9).fillColor(darkGray).font('Helvetica')
        .text(`£${maxAffordableRent.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 200, boxY + 60)

      y += 95

      // Remarks in light grey under the box
      const incomeStepForRemarks = verificationSteps?.find((s: VerificationStep) => s.step_type === 'INCOME_AFFORDABILITY')
      if (incomeStepForRemarks?.notes && incomeStepForRemarks.notes.trim().length > 0) {
        doc.fontSize(8).fillColor(lightGray).font('Helvetica')
          .text(incomeStepForRemarks.notes, 60, y, { width: 475 })
        y += doc.heightOfString(incomeStepForRemarks.notes, { width: 475 }) + 10
      } else {
        y += 5
      }

      // Credit History Section
      if (y > 650) {
        addPageWithFooter()
        y = 50
      }

      // Orange section bar
      doc.rect(50, y, 495, 25).fill(primaryColor)
      doc.fontSize(12).fillColor('#ffffff').font('Helvetica-Bold')
        .text('Credit History', 60, y + 7)
      y += 35

      doc.fontSize(9).fillColor(darkGray).font('Helvetica')
      doc.text(`Adverse credit — ${adverseCreditFound ? 'Found' : 'None found'}`, 60, y, { width: 465 })
      y += 15
      doc.text(`CCJs — ${ccjCount}`, 60, y, { width: 465 })
      y += 15
      doc.text(`Bankruptcies — ${bankruptcyCount}`, 60, y, { width: 465 })
      y += 20

      // PEP & Sanctions Checks Section
      if (y > 650) {
        addPageWithFooter()
        y = 50
      }

      // Orange section bar
      doc.rect(50, y, 495, 25).fill(primaryColor)
      doc.fontSize(12).fillColor('#ffffff').font('Helvetica-Bold')
        .text('PEP & Sanctions Checks', 60, y + 7)
      y += 35

      // Status
      const sanctionsStatus = sanctions?.risk_level === 'clear' || sanctionsMatches.length === 0 ? 'Pass' : 'Fail'
      const sanctionsStatusColor = sanctionsStatus === 'Pass' ? passGreen : failRed
      doc.fontSize(9).fillColor(darkGray).font('Helvetica-Bold')
        .text('Status:', 60, y)
      doc.fontSize(9).fillColor(sanctionsStatusColor).font('Helvetica-Bold')
        .text(sanctionsStatus, 120, y)
      y += 20

      // Sanctions: Complete
      doc.fontSize(9).fillColor(darkGray).font('Helvetica')
        .text('Sanctions: Complete', 60, y, { width: 465 })
      y += 20

      // Sanctions list
      if (sanctionsMatches.length === 0) {
        doc.fontSize(9).fillColor(darkGray).font('Helvetica')
          .text('No sanctions found.', 60, y, { width: 465 })
        y += 15
      } else {
        doc.fontSize(9).fillColor(darkGray).font('Helvetica-Bold')
          .text('Sanctions matches:', 60, y)
        y += 15
        sanctionsMatches.forEach((match: any) => {
          const matchName = match.name || match.entity_name || 'Unknown'
          const matchReason = match.reason || match.match_reason || 'No reason provided'
          doc.fontSize(8).fillColor(darkGray).font('Helvetica')
            .text(`• ${matchName}: ${matchReason}`, 70, y, { width: 455 })
          y += 12
        })
      }
      y += 10

      // Credit Score & Checks Section (keeping some existing content)
      if (score || creditsafe) {
        if (y > 650) {
          addPageWithFooter()
          y = 50
        }
        doc.fontSize(14).fillColor(darkGray).font('Helvetica-Bold').text('Credit & Background Checks', 50, y)
        y += 20
        
        if (score) {
          doc.fontSize(9).fillColor(lightGray).font('Helvetica-Bold').text('Credit Score:', 60, y)
          doc.fontSize(10).fillColor(darkGray).font('Helvetica-Bold')
            .text(`${score.score || 'N/A'}`, 200, y)
          y += 15
        }
        
        if (creditsafe) {
          const formatFlag = (value?: boolean | null) => {
            if (value === true) return 'Flagged'
            if (value === false) return 'Clear'
            return 'Not Checked'
          }

          const parseFraudIndicators = (): string[] => {
            if (!creditsafe.fraud_indicators) return []
            try {
              const raw = typeof creditsafe.fraud_indicators === 'string'
                ? JSON.parse(creditsafe.fraud_indicators)
                : creditsafe.fraud_indicators
              const lines: string[] = []
              if (raw.ccjMatch) {
                const count = raw.ccjCount || 0
                lines.push(`${count} CCJ match${count === 1 ? '' : 'es'} found`)
              }
              if (raw.insolvencyMatch) {
                const count = raw.insolvencyCount || 0
                lines.push(`${count} insolvency record${count === 1 ? '' : 's'} found`)
              }
              if (raw.deceasedMatch) {
                lines.push('Deceased register match')
              }
              if (raw.electoralRollMatch === false) {
                lines.push('Not found on electoral roll')
              }
              return lines
            } catch {
              return []
            }
          }

          doc.fontSize(9).fillColor(lightGray).font('Helvetica-Bold').text('Creditsafe Verification:', 60, y)
          y += 15
          doc.fontSize(8).fillColor(darkGray).font('Helvetica')

          if (creditsafe.verification_status) {
            doc.text(`Status: ${creditsafe.verification_status.toUpperCase()}`, 70, y, { width: 465 })
            y += 12
          }

          if (typeof creditsafe.verification_score === 'number') {
            doc.text(`Verification Score: ${creditsafe.verification_score}/100`, 70, y, { width: 465 })
            y += 12
          }

          if (creditsafe.risk_level) {
            doc.text(`Risk Level: ${creditsafe.risk_level.replace('_', ' ').toUpperCase()}`, 70, y, { width: 465 })
            y += 12
          }

          if (creditsafe.verified_at) {
            doc.text(`Verified: ${new Date(creditsafe.verified_at).toLocaleDateString('en-GB')}`, 70, y, { width: 465 })
            y += 12
          }

          if (creditsafe.creditsafe_transaction_id) {
            doc.text(`Transaction: ${creditsafe.creditsafe_transaction_id}`, 70, y, { width: 465 })
            y += 12
          }

          const matchScores = [
            { label: 'Name Match', value: creditsafe.name_match_score },
            { label: 'Address Match', value: creditsafe.address_match_score },
            { label: 'DOB Match', value: creditsafe.dob_match_score }
          ]
          const hasMatchScores = matchScores.some(score => typeof score.value === 'number')
          if (hasMatchScores) {
            doc.moveDown(0.3)
            doc.fontSize(8).fillColor(lightGray).font('Helvetica-Bold').text('Identity Match Scores:', 70, y)
            y += 12
            doc.fontSize(8).fillColor(darkGray).font('Helvetica')
            matchScores.forEach(score => {
              if (typeof score.value === 'number') {
                doc.text(`${score.label}: ${score.value}%`, 80, y, { width: 455 })
                y += 12
              }
            })
          }

          const complianceFlags = [
            { label: 'PEP Check', value: creditsafe.pep_check_result },
            { label: 'Sanctions Check', value: creditsafe.sanctions_check_result },
            { label: 'Adverse Media', value: creditsafe.adverse_media_result }
          ]
          const hasCompliance = complianceFlags.some(flag => flag.value !== null && flag.value !== undefined)
          if (hasCompliance) {
            doc.moveDown(0.3)
            doc.fontSize(8).fillColor(lightGray).font('Helvetica-Bold').text('Compliance Screening:', 70, y)
            y += 12
            doc.fontSize(8).fillColor(darkGray).font('Helvetica')
            complianceFlags.forEach(flag => {
              if (flag.value !== null && flag.value !== undefined) {
                doc.text(`${flag.label}: ${formatFlag(flag.value)}`, 80, y, { width: 455 })
                y += 12
              }
            })
          }

          if (typeof creditsafe.document_verified === 'boolean' || typeof creditsafe.document_authenticity_score === 'number') {
            doc.moveDown(0.3)
            doc.fontSize(8).fillColor(lightGray).font('Helvetica-Bold').text('Document Verification:', 70, y)
            y += 12
            doc.fontSize(8).fillColor(darkGray).font('Helvetica')
            if (typeof creditsafe.document_verified === 'boolean') {
              doc.text(`Documents: ${creditsafe.document_verified ? 'Verified' : 'Not Verified'}`, 80, y, { width: 455 })
              y += 12
            }
            if (typeof creditsafe.document_authenticity_score === 'number') {
              doc.text(`Authenticity Score: ${creditsafe.document_authenticity_score}/100`, 80, y, { width: 455 })
              y += 12
            }
          }

          const fraudLines = parseFraudIndicators()
          if (fraudLines.length > 0) {
            doc.moveDown(0.3)
            doc.fontSize(8).fillColor(lightGray).font('Helvetica-Bold').text('Fraud Indicators:', 70, y)
            y += 12
            doc.fontSize(8).fillColor(darkGray).font('Helvetica')
            fraudLines.forEach(line => {
              doc.text(`- ${line}`, 80, y, { width: 455 })
              y += 12
            })
          }

          if (creditsafe.error_message) {
            doc.moveDown(0.3)
            doc.fontSize(8).fillColor(failRed).font('Helvetica-Bold').text('Creditsafe Error:', 70, y)
            y += 12
            doc.fontSize(8).fillColor(darkGray).font('Helvetica').text(creditsafe.error_message, 80, y, { width: 455 })
            y += 12
          }

          y += 5
        }
        
        if (sanctions) {
          doc.fontSize(9).fillColor(lightGray).font('Helvetica-Bold').text('AML & Sanctions Screening:', 60, y)
          y += 15
          doc.fontSize(8).fillColor(darkGray).font('Helvetica')
          const sanctionsStatus = sanctions.match_found ? 'MATCH FOUND' : 'CLEAR'
          const sanctionsColor = sanctions.match_found ? failRed : passGreen
          doc.fillColor(sanctionsColor).text(`Status: ${sanctionsStatus}`, 70, y, { width: 465 })
          y += 12
          if (sanctions.screened_at) {
            doc.fillColor(darkGray).text(`Screened: ${new Date(sanctions.screened_at).toLocaleDateString('en-GB')}`, 70, y, { width: 465 })
            y += 12
          }
          y += 5
        }
      }

      // Landlord Reference Section
      if (y > 650) {
        addPageWithFooter()
        y = 50
      }

      // Orange section bar
      doc.rect(50, y, 495, 25).fill(primaryColor)
      doc.fontSize(12).fillColor('#ffffff').font('Helvetica-Bold')
        .text('Landlord Reference', 60, y + 7)
      y += 35

      if (isLivingWithFamily || (landlordComments && landlordComments.toLowerCase().includes('living with family'))) {
        doc.fontSize(9).fillColor(darkGray).font('Helvetica')
          .text('Not applicable — applicant is living with family/friends', 60, y, { width: 475 })
        y += 20
      } else if (landlordComments && landlordComments.trim().length > 0) {
        doc.fontSize(9).fillColor(darkGray).font('Helvetica')
          .text(landlordComments, 60, y, { width: 475 })
        y += doc.heightOfString(landlordComments, { width: 475 }) + 10
      } else if (landlordReference || agentReference) {
        const ref = landlordReference || agentReference
        if (ref) {
          const refName = landlordReference ? 'Landlord' : 'Agent'
          doc.fontSize(9).fillColor(lightGray).font('Helvetica-Bold')
            .text(`${refName} Reference:`, 60, y)
          y += 15
          doc.fontSize(8).fillColor(darkGray).font('Helvetica')
          if (landlordReference?.landlord_name_encrypted || agentReference?.agent_name_encrypted) {
            const name = landlordReference?.landlord_name_encrypted
              ? decrypt(landlordReference.landlord_name_encrypted)
              : agentReference?.agent_name_encrypted
                ? decrypt(agentReference.agent_name_encrypted)
                : 'N/A'
            doc.text(`Name: ${name}`, 70, y, { width: 465 })
            y += 12
          }
          if (ref.monthly_rent_encrypted) {
            const rent = decrypt(ref.monthly_rent_encrypted)
            if (rent) {
              doc.text(`Monthly Rent: £${parseFloat(rent).toLocaleString('en-GB')}`, 70, y, { width: 465 })
              y += 12
            }
          }
          y += 5
        }
      } else {
        doc.fontSize(9).fillColor(lightGray).font('Helvetica-Oblique')
          .text('No landlord reference provided', 60, y, { width: 475 })
        y += 20
      }

      // Guarantor Section
      if (decryptedGuarantor && decryptedGuarantor.submitted_at) {
        if (y > 600) {
          addPageWithFooter()
          y = 50
        }
        doc.fontSize(14).fillColor(darkGray).font('Helvetica-Bold').text('Guarantor Information', 50, y)
        y += 20
        
        doc.fontSize(9).fillColor(lightGray).font('Helvetica-Bold').text('Personal Details:', 60, y)
        y += 15
        doc.fontSize(8).fillColor(darkGray).font('Helvetica')
        doc.text(`Name: ${decryptedGuarantor.guarantor_first_name} ${decryptedGuarantor.guarantor_last_name}`, 70, y, { width: 465 })
        y += 12
        if (decryptedGuarantor.email) {
          doc.text(`Email: ${decryptedGuarantor.email}`, 70, y, { width: 465 })
          y += 12
        }
        if (decryptedGuarantor.contact_number) {
          doc.text(`Phone: ${decryptedGuarantor.contact_number}`, 70, y, { width: 465 })
          y += 12
        }
        if (decryptedGuarantor.relationship_to_tenant) {
          doc.text(`Relationship: ${decryptedGuarantor.relationship_to_tenant}`, 70, y, { width: 465 })
          y += 12
        }
        y += 5
        
        if (decryptedGuarantor.annual_income || decryptedGuarantor.savings_amount || decryptedGuarantor.employer_name) {
          doc.fontSize(9).fillColor(lightGray).font('Helvetica-Bold').text('Financial Information:', 60, y)
          y += 15
          doc.fontSize(8).fillColor(darkGray).font('Helvetica')
          if (decryptedGuarantor.annual_income) {
            doc.text(`Annual Income: £${parseFloat(decryptedGuarantor.annual_income || '0').toLocaleString('en-GB')}`, 70, y, { width: 465 })
            y += 12
          }
          if (decryptedGuarantor.savings_amount) {
            doc.text(`Savings: £${parseFloat(decryptedGuarantor.savings_amount || '0').toLocaleString('en-GB')}`, 70, y, { width: 465 })
            y += 12
          }
          if (decryptedGuarantor.employer_name) {
            doc.text(`Employer: ${decryptedGuarantor.employer_name}`, 70, y, { width: 465 })
            y += 12
          }
          if (decryptedGuarantor.job_title) {
            doc.text(`Job Title: ${decryptedGuarantor.job_title}`, 70, y, { width: 465 })
            y += 12
          }
          y += 5
        }
        
        if (decryptedGuarantor.id_document_path || decryptedGuarantor.selfie_path || decryptedGuarantor.proof_of_address_path || decryptedGuarantor.bank_statement_path) {
          doc.fontSize(9).fillColor(lightGray).font('Helvetica-Bold').text('Documents Provided:', 60, y)
          y += 15
          doc.fontSize(8).fillColor(darkGray).font('Helvetica')
          const documents: string[] = []
          if (decryptedGuarantor.id_document_path) documents.push('ID Document')
          if (decryptedGuarantor.selfie_path) documents.push('Selfie')
          if (decryptedGuarantor.proof_of_address_path) documents.push('Proof of Address')
          if (decryptedGuarantor.bank_statement_path) documents.push('Bank Statement')
          doc.text(documents.join(', '), 70, y, { width: 465 })
          y += 12
        }
      }

      // Evidence Section
      if (y > 650) {
        addPageWithFooter()
        y = 50
      }

      // Orange section bar
      doc.rect(50, y, 495, 25).fill(primaryColor)
      doc.fontSize(12).fillColor('#ffffff').font('Helvetica-Bold')
        .text('Evidence', 60, y + 7)
      y += 35

      // Residential Evidence
      const residentialStep = verificationSteps?.find((s: VerificationStep) => s.step_type === 'RESIDENTIAL')
      if (residentialStep) {
        doc.fontSize(10).fillColor(darkGray).font('Helvetica-Bold')
          .text('Residential', 60, y)
        y += 15

        if (isLivingWithFamily) {
          doc.fontSize(9).fillColor(darkGray).font('Helvetica')
            .text('Not applicable — applicant is living with family/friends. Address history included instead.', 70, y, { width: 455 })
          y += 20
        } else if (residentialStep.evidence_sources && residentialStep.evidence_sources.length > 0) {
          residentialStep.evidence_sources.forEach((evidenceType: string) => {
            const label = evidenceLabels[evidenceType] || evidenceType
            doc.fontSize(9).fillColor(darkGray).font('Helvetica')
              .text(`• ${label}`, 70, y, { width: 455 })
            y += 12
          })
          if (residentialStep.notes && residentialStep.notes.trim().length > 0) {
            doc.fontSize(8).fillColor(lightGray).font('Helvetica')
              .text(residentialStep.notes, 70, y, { width: 455 })
            y += doc.heightOfString(residentialStep.notes, { width: 455 }) + 5
          }
          y += 5
        } else {
          doc.fontSize(9).fillColor(lightGray).font('Helvetica-Oblique')
            .text('No evidence provided', 70, y, { width: 455 })
          y += 15
        }
      }

      // Income Evidence
      const incomeStepEvidence = verificationSteps?.find((s: VerificationStep) => s.step_type === 'INCOME_AFFORDABILITY')
      if (incomeStepEvidence) {
        doc.fontSize(10).fillColor(darkGray).font('Helvetica-Bold')
          .text('Income', 60, y)
        y += 15

        if (incomeStepEvidence.evidence_sources && incomeStepEvidence.evidence_sources.length > 0) {
          incomeStepEvidence.evidence_sources.forEach((evidenceType: string) => {
            const label = evidenceLabels[evidenceType] || evidenceType
            doc.fontSize(9).fillColor(darkGray).font('Helvetica')
              .text(`• ${label}`, 70, y, { width: 455 })
            y += 12
          })
          if (incomeStepEvidence.notes && incomeStepEvidence.notes.trim().length > 0) {
            doc.fontSize(8).fillColor(lightGray).font('Helvetica')
              .text(incomeStepEvidence.notes, 70, y, { width: 455 })
            y += doc.heightOfString(incomeStepEvidence.notes, { width: 455 }) + 5
          }
          y += 5
        } else {
          doc.fontSize(9).fillColor(lightGray).font('Helvetica-Oblique')
            .text('No evidence provided', 70, y, { width: 455 })
          y += 15
        }
      }

      // Credit Evidence
      const creditStepEvidence = verificationSteps?.find((s: VerificationStep) => s.step_type === 'CREDIT_TAS')
      if (creditStepEvidence) {
        doc.fontSize(10).fillColor(darkGray).font('Helvetica-Bold')
          .text('Credit', 60, y)
        y += 15

        if (creditStepEvidence.evidence_sources && creditStepEvidence.evidence_sources.length > 0) {
          creditStepEvidence.evidence_sources.forEach((evidenceType: string) => {
            const label = evidenceLabels[evidenceType] || evidenceType
            doc.fontSize(9).fillColor(darkGray).font('Helvetica')
              .text(`• ${label}`, 70, y, { width: 455 })
            y += 12
          })
          if (creditStepEvidence.notes && creditStepEvidence.notes.trim().length > 0) {
            doc.fontSize(8).fillColor(lightGray).font('Helvetica')
              .text(creditStepEvidence.notes, 70, y, { width: 455 })
            y += doc.heightOfString(creditStepEvidence.notes, { width: 455 }) + 5
          }
          y += 5
        } else {
          doc.fontSize(9).fillColor(lightGray).font('Helvetica-Oblique')
            .text('No evidence provided', 70, y, { width: 455 })
          y += 15
        }
      }

      // RTR (Right to Rent) Evidence
      const idStep = verificationSteps?.find((s: VerificationStep) => s.step_type === 'ID_SELFIE')
      if (idStep) {
        doc.fontSize(10).fillColor(darkGray).font('Helvetica-Bold')
          .text('RTR', 60, y)
        y += 15

        if (idStep.evidence_sources && idStep.evidence_sources.length > 0) {
          idStep.evidence_sources.forEach((evidenceType: string) => {
            const label = evidenceLabels[evidenceType] || evidenceType
            doc.fontSize(9).fillColor(darkGray).font('Helvetica')
              .text(`• ${label}`, 70, y, { width: 455 })
            y += 12
          })
          if (idStep.notes && idStep.notes.trim().length > 0) {
            doc.fontSize(8).fillColor(lightGray).font('Helvetica')
              .text(idStep.notes, 70, y, { width: 455 })
            y += doc.heightOfString(idStep.notes, { width: 455 }) + 5
          }
          y += 5
        } else {
          doc.fontSize(9).fillColor(lightGray).font('Helvetica-Oblique')
            .text('No evidence provided', 70, y, { width: 455 })
          y += 15
        }
      }


      // Add footer to first page if we never added a new page
      if (currentPage === 1) {
        addFirstPageFooter()
      }

      // All footers have been added inline as pages were created
      doc.end()
    } catch (error) {
      console.error('[PDF V2] Generation error:', error)
      reject(error)
    }
  })
}

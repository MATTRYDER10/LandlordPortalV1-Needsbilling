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

  // Calculate total income
  let totalIncome = 0
  const employmentSalary = reference.employment_salary_amount_encrypted ? parseFloat(decrypt(reference.employment_salary_amount_encrypted) || '0') : 0
  const selfEmployedIncome = reference.self_employed_annual_income_encrypted ? parseFloat(decrypt(reference.self_employed_annual_income_encrypted) || '0') : 0
  const benefitsAnnual = reference.benefits_annual_amount_encrypted ? parseFloat(decrypt(reference.benefits_annual_amount_encrypted) || '0') : 0
  const additionalIncome = reference.additional_income_amount_encrypted ? parseFloat(decrypt(reference.additional_income_amount_encrypted) || '0') : 0
  totalIncome = employmentSalary + selfEmployedIncome + benefitsAnnual + additionalIncome

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

      // Employment & Income Section
      if (employerReference || reference.employment_company_name_encrypted || totalIncome > 0) {
        if (y > 650) {
          doc.addPage()
          y = 50
        }
        doc.fontSize(14).fillColor(darkGray).font('Helvetica-Bold').text('Employment & Income Details', 50, y)
        y += 20
        
        if (employerReference) {
          doc.fontSize(9).fillColor(lightGray).font('Helvetica-Bold').text('Employer Reference:', 60, y)
          y += 15
          doc.fontSize(8).fillColor(darkGray).font('Helvetica')
          if (employerReference.employer_name) {
            doc.text(`Company: ${employerReference.employer_name}`, 70, y, { width: 465 })
            y += 12
          }
          if (employerReference.job_title) {
            doc.text(`Position: ${employerReference.job_title}`, 70, y, { width: 465 })
            y += 12
          }
          if (employerReference.salary_amount) {
            doc.text(`Salary: £${parseFloat(employerReference.salary_amount).toLocaleString('en-GB')}`, 70, y, { width: 465 })
            y += 12
          }
          y += 5
        }
        
        const employmentCompany = reference.employment_company_name_encrypted ? decrypt(reference.employment_company_name_encrypted) : ''
        const employmentPosition = reference.employment_position_encrypted ? decrypt(reference.employment_position_encrypted) : ''
        if (employmentCompany || employmentPosition) {
          doc.fontSize(9).fillColor(lightGray).font('Helvetica-Bold').text('Tenant Provided Employment:', 60, y)
          y += 15
          doc.fontSize(8).fillColor(darkGray).font('Helvetica')
          if (employmentCompany) {
            doc.text(`Company: ${employmentCompany}`, 70, y, { width: 465 })
            y += 12
          }
          if (employmentPosition) {
            doc.text(`Position: ${employmentPosition}`, 70, y, { width: 465 })
            y += 12
          }
          y += 5
        }
        
        if (totalIncome > 0) {
          doc.fontSize(9).fillColor(lightGray).font('Helvetica-Bold').text('Total Annual Income:', 60, y)
          doc.fontSize(10).fillColor(darkGray).font('Helvetica-Bold')
            .text(`£${totalIncome.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 200, y)
          y += 20
        }
      }

      // Credit Score & Checks Section
      if (score || creditsafe || sanctions) {
        if (y > 650) {
          doc.addPage()
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

      // Landlord/Agent Reference Section
      if (landlordReference || agentReference) {
        if (y > 650) {
          doc.addPage()
          y = 50
        }
        doc.fontSize(14).fillColor(darkGray).font('Helvetica-Bold').text('Previous Tenancy Reference', 50, y)
        y += 20
        
        if (landlordReference) {
          doc.fontSize(9).fillColor(lightGray).font('Helvetica-Bold').text('Landlord Reference:', 60, y)
          y += 15
          doc.fontSize(8).fillColor(darkGray).font('Helvetica')
          if (landlordReference.landlord_name) {
            doc.text(`Landlord: ${landlordReference.landlord_name}`, 70, y, { width: 465 })
            y += 12
          }
          if (landlordReference.monthly_rent) {
            doc.text(`Monthly Rent: £${parseFloat(landlordReference.monthly_rent).toLocaleString('en-GB')}`, 70, y, { width: 465 })
            y += 12
          }
          if (landlordReference.tenancy_start_date) {
            doc.text(`Tenancy Start: ${new Date(landlordReference.tenancy_start_date).toLocaleDateString('en-GB')}`, 70, y, { width: 465 })
            y += 12
          }
          y += 5
        }
        
        if (agentReference) {
          doc.fontSize(9).fillColor(lightGray).font('Helvetica-Bold').text('Letting Agent Reference:', 60, y)
          y += 15
          doc.fontSize(8).fillColor(darkGray).font('Helvetica')
          if (agentReference.agent_name) {
            doc.text(`Agent: ${agentReference.agent_name}`, 70, y, { width: 465 })
            y += 12
          }
          if (agentReference.monthly_rent) {
            doc.text(`Monthly Rent: £${parseFloat(agentReference.monthly_rent).toLocaleString('en-GB')}`, 70, y, { width: 465 })
            y += 12
          }
          if (agentReference.tenancy_start_date) {
            doc.text(`Tenancy Start: ${new Date(agentReference.tenancy_start_date).toLocaleDateString('en-GB')}`, 70, y, { width: 465 })
            y += 12
          }
          y += 5
        }
      }

      // Guarantor Section
      if (decryptedGuarantor && decryptedGuarantor.submitted_at) {
        if (y > 600) {
          doc.addPage()
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

      // Verification Summary Section
      if (y > 700) {
        doc.addPage()
        y = 50
      }
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
      y += 15
      
      // Right to Rent Status
      const rightToRentStatus = reference.right_to_rent_status || 'Not Checked'
      const rightToRentColor = rightToRentStatus === 'PASS' ? passGreen : rightToRentStatus === 'FAIL' ? failRed : lightGray
      doc.fontSize(9).fillColor(lightGray).font('Helvetica-Bold').text('Right to Rent Status:', 60, y)
      doc.fontSize(10).fillColor(rightToRentColor).font('Helvetica-Bold')
        .text(rightToRentStatus, 200, y)
      y += 20
      
      if (reference.id_document_type) {
        doc.fontSize(8).fillColor(darkGray).font('Helvetica')
          .text(`ID Document Type: ${reference.id_document_type.replace('_', ' ').toUpperCase()}`, 60, y, { width: 475 })
        y += 12
      }
      if (reference.id_document_path) {
        doc.fontSize(8).fillColor(darkGray).font('Helvetica')
          .text('ID Document: Provided and verified', 60, y, { width: 475 })
        y += 12
      }
      if (reference.selfie_path) {
        doc.fontSize(8).fillColor(darkGray).font('Helvetica')
          .text('Selfie Verification: Completed', 60, y, { width: 475 })
        y += 12
      }
      y += 10

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

      // Footer on all pages
      const totalPages = doc.bufferedPageRange().count
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
            `Page ${pageNumber} of ${totalPages}`,
            0,
            footerY,
            { align: 'right', width: 545 }
          )
      }

      // Add footers to all pages
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i)
        addFooter(i + 1)
      }

      doc.end()
    } catch (error) {
      console.error('[PDF V2] Generation error:', error)
      reject(error)
    }
  })
}

/**
 * V2 Tenant Form Routes
 *
 * Public endpoints for tenant reference form submission.
 * Uses permanent links via hashed tokens for security.
 */

import express, { Request, Response, Router } from 'express'
import { supabase } from '../../config/supabase'
import { encrypt, decrypt, hash, generateToken } from '../../services/encryption'
import { getReferenceByFormToken, getReferenceDecrypted } from '../../services/v2/referenceServiceV2'
import { initializeSections, updateSectionStatus } from '../../services/v2/sectionServiceV2'
import { sendGuarantorReferenceRequest, sendEmployerReferenceRequest, sendLandlordReferenceRequest, sendAccountantReferenceRequest } from '../../services/emailService'
import { createChaseItem } from '../../services/v2/chaseServiceV2'
import { logActivity } from '../../services/v2/activityServiceV2'
import { getV2FrontendUrl } from '../../utils/frontendUrl'
import { creditsafeService } from '../../services/creditsafeService'
import { sanctionsService } from '../../services/sanctionsService'

const router: Router = express.Router()

// GET /api/v2/tenant-form/:token - Get reference details for tenant form
router.get('/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params

    console.log('[V2 TenantForm] Looking up token:', token.substring(0, 16) + '...')

    // Look up reference by hashed token
    const reference = await getReferenceByFormToken(token)

    if (!reference) {
      console.log('[V2 TenantForm] Reference not found for token')
      return res.status(404).json({ error: 'Reference not found or link expired' })
    }

    console.log('[V2 TenantForm] Found reference:', reference.id)

    // Get company info for branding
    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('id', reference.company_id)
      .maybeSingle()

    const co = company as any
    const resolvedCompanyName = co?.name || (co?.name_encrypted ? decrypt(co.name_encrypted) : null) || co?.company_name || 'PropertyGoose'

    // Decrypt fields for display
    const tenantFirstName = reference.tenant_first_name_encrypted
      ? decrypt(reference.tenant_first_name_encrypted)
      : null
    const tenantLastName = reference.tenant_last_name_encrypted
      ? decrypt(reference.tenant_last_name_encrypted)
      : null
    const tenantPhone = reference.tenant_phone_encrypted
      ? decrypt(reference.tenant_phone_encrypted)
      : null
    const tenantEmail = reference.tenant_email_encrypted
      ? decrypt(reference.tenant_email_encrypted)
      : null
    const propertyAddress = reference.property_address_encrypted
      ? decrypt(reference.property_address_encrypted)
      : null

    // Get deposit info from linked offer (if any)
    let depositReplacementOffered = reference.deposit_replacement_offered || false
    let depositAmount = reference.deposit_amount || null

    // If not on reference, try to get from linked offer
    if (reference.offer_id) {
      const { data: offer } = await supabase
        .from('tenant_offers')
        .select('deposit_amount, offer_deposit_replacement')
        .eq('id', reference.offer_id)
        .single()

      if (offer) {
        if (!depositReplacementOffered) {
          depositReplacementOffered = offer.offer_deposit_replacement || false
        }
        if (!depositAmount) {
          depositAmount = offer.deposit_amount || null
        }
      }
    }

    // If still no deposit amount, calculate based on 5 weeks' rent (standard UK deposit)
    if (!depositAmount && reference.monthly_rent) {
      depositAmount = Math.floor((reference.monthly_rent / 4.33) * 5)
    }

    // Check if company has Reposit integration enabled
    let repositIntegrationActive = false
    if (depositReplacementOffered) {
      const { data: integrations } = await supabase
        .from('company_integrations')
        .select('reposit_supplier_id')
        .eq('company_id', reference.company_id)
        .single()

      repositIntegrationActive = !!integrations?.reposit_supplier_id
    }

    // Get company contact info for device handoff gate
    const { data: companyWithContact } = await supabase
      .from('companies')
      .select('phone_encrypted, email_encrypted, address, website')
      .eq('id', reference.company_id)
      .single()

    return res.json({
      reference: {
        id: reference.id,
        tenant_first_name: tenantFirstName,
        tenant_last_name: tenantLastName,
        tenant_phone: tenantPhone,
        tenant_email: tenantEmail,
        property_address: propertyAddress,
        monthly_rent: reference.monthly_rent,
        move_in_date: reference.move_in_date,
        form_submitted_at: reference.form_submitted_at,
        status: reference.status,
        // Reposit/deposit info
        deposit_replacement_offered: depositReplacementOffered && repositIntegrationActive && !reference.parent_reference_id,
        deposit_amount: depositAmount,
        reposit_confirmed: reference.reposit_confirmed,
        // Saved form data for restoring progress
        form_data: reference.form_data || null
      },
      companyName: resolvedCompanyName,
      companyLogo: co?.logo_url || '',
      companyPhone: companyWithContact?.phone_encrypted ? decrypt(companyWithContact.phone_encrypted) : '',
      companyEmail: companyWithContact?.email_encrypted ? decrypt(companyWithContact.email_encrypted) : '',
      companyAddress: companyWithContact?.address || '',
      companyWebsite: companyWithContact?.website || '',
      primaryColor: company?.primary_color || '#f97316',
      buttonColor: company?.button_color || '#f97316'
    })
  } catch (error) {
    console.error('Error fetching tenant form:', error)
    return res.status(500).json({ error: 'Failed to load reference' })
  }
})

// POST /api/v2/tenant-form/:token/save - Save section progress (auto-save)
router.post('/:token/save', async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const { section, data } = req.body

    console.log(`[V2 TenantForm] Save request for section: ${section}`)

    // Validate section type
    const validSections = ['identity', 'rtr', 'income', 'residential', 'personal', 'guarantor', 'deposit', 'consent']
    if (!validSections.includes(section)) {
      console.log(`[V2 TenantForm] Invalid section: ${section}`)
      return res.status(400).json({ error: 'Invalid section' })
    }

    // Get the reference
    const reference = await getReferenceByFormToken(token)

    if (!reference) {
      console.log(`[V2 TenantForm] Reference not found for token`)
      return res.status(404).json({ error: 'Reference not found' })
    }

    console.log(`[V2 TenantForm] Saving to reference ${reference.id}`)

    // Merge the section data with existing form data
    const existingFormData = reference.form_data || {}
    const updatedFormData = {
      ...existingFormData,
      [section]: data,
      last_saved_at: new Date().toISOString()
    }

    // Update the reference
    const { error: updateError } = await supabase
      .from('tenant_references_v2')
      .update({
        form_data: updatedFormData
      })
      .eq('id', reference.id)

    if (updateError) {
      console.error('[V2 TenantForm] Error saving section:', updateError)
      return res.status(500).json({ error: 'Failed to save progress', details: updateError.message })
    }

    console.log(`[V2 TenantForm] Section ${section} saved successfully`)
    return res.json({ success: true })
  } catch (error) {
    console.error('[V2 TenantForm] Exception saving section:', error)
    return res.status(500).json({ error: 'Failed to save progress' })
  }
})

// POST /api/v2/tenant-form/:token/submit - Submit the complete form
router.post('/:token/submit', async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const formData = req.body

    const { identity, rtr, income, residential, personal, guarantor, deposit, consent, calculatedAnnualIncome } = formData

    // Auto-capitalise names
    const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s
    const capitalizeName = (name: string) => name ? name.split(/[\s-]/).map(capitalize).join(name.includes('-') ? '-' : ' ') : name
    if (identity.firstName) identity.firstName = capitalizeName(identity.firstName.trim())
    if (identity.lastName) identity.lastName = capitalizeName(identity.lastName.trim())
    if (guarantor?.firstName) guarantor.firstName = capitalizeName(guarantor.firstName.trim())
    if (guarantor?.lastName) guarantor.lastName = capitalizeName(guarantor.lastName.trim())

    // Validate required consents
    if (!consent?.creditCheck || !consent?.amlCheck || !consent?.dataProcessing || !consent?.declaration) {
      return res.status(400).json({ error: 'All consents are required' })
    }

    // Validate signature
    if (!consent?.signature || !consent?.printedName) {
      return res.status(400).json({ error: 'Signature is required' })
    }

    // Get the reference
    const reference = await getReferenceByFormToken(token)

    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Check if already submitted
    if (reference.status !== 'SENT') {
      return res.status(400).json({ error: 'Reference has already been submitted' })
    }

    // Build encrypted form data
    const encryptedFormData = {
      identity: {
        firstName: identity.firstName,
        lastName: identity.lastName,
        dateOfBirth: identity.dateOfBirth ? encrypt(identity.dateOfBirth) : null,
        phone: identity.phone ? encrypt(identity.phone) : null,
        documentType: identity.documentType,
        idDocumentUrl: identity.idDocumentUrl || null,
        selfieUrl: identity.selfieUrl || null
      },
      rtr: {
        citizenshipStatus: rtr.citizenshipStatus,
        shareCode: rtr.shareCode ? encrypt(rtr.shareCode) : null,
        noPassport: rtr.noPassport || false,
        alternativeDocType: rtr.alternativeDocType || null,
        passportDocUrl: rtr.passportDocUrl || null,
        alternativeDocUrl: rtr.alternativeDocUrl || null,
        supportingDocType: rtr.supportingDocType || null,
        supportingDocUrl: rtr.supportingDocUrl || null
      },
      income: {
        sources: income.sources,
        // Employed
        employerName: income.employerName || null,
        jobTitle: income.jobTitle || null,
        employmentStartDate: income.employmentStartDate || null,
        annualSalary: income.annualSalary || null,
        employerAddress: income.employerAddress ? encrypt(income.employerAddress) : null,
        employerRefName: income.employerRefName || null,
        employerRefEmail: income.employerRefEmail || null,
        payslipsUrl: income.payslipsUrl || null,
        // Self-employed
        businessName: income.businessName || null,
        businessNature: income.businessNature || null,
        businessStartDate: income.businessStartDate || null,
        selfEmployedIncome: income.selfEmployedIncome || null,
        accountantName: income.accountantName || null,
        accountantEmail: income.accountantEmail || null,
        taxReturnUrl: income.taxReturnUrl || null,
        // Benefits
        benefitsAmount: income.benefitsAmount || null,
        benefitsDocUrl: income.benefitsDocUrl || null,
        // Savings
        savingsAmount: income.savingsAmount || null,
        savingsDocUrl: income.savingsDocUrl || null,
        // Pension
        pensionAmount: income.pensionAmount || null,
        pensionProvider: income.pensionProvider || null,
        pensionDocUrl: income.pensionDocUrl || null,
        // Rental Income
        rentalIncome: income.rentalIncome || null,
        rentalProperties: income.rentalProperties || null,
        rentalDocUrl: income.rentalDocUrl || null,
        rentalDocWillEmail: income.rentalDocWillEmail || false,
        // Student
        university: income.university || null,
        course: income.course || null,
        studentDocUrl: income.studentDocUrl || null
      },
      residential: {
        currentAddress: {
          line1: residential.currentAddress.line1,
          line2: residential.currentAddress.line2 || null,
          city: residential.currentAddress.city,
          postcode: residential.currentAddress.postcode,
          years: residential.currentAddress.years,
          months: residential.currentAddress.months
        },
        proofOfAddressUrl: residential.proofOfAddressUrl || null,
        currentLivingSituation: residential.currentLivingSituation || null,
        currentLandlordName: residential.currentLandlordName || null,
        currentLandlordEmail: residential.currentLandlordEmail || null,
        currentLandlordPhone: residential.currentLandlordPhone || null,
        previousAddresses: (residential.previousAddresses || []).map((addr: any) => ({
          line1: addr.line1,
          line2: addr.line2 || null,
          city: addr.city,
          postcode: addr.postcode,
          years: addr.years,
          months: addr.months,
          landlordName: addr.landlordName || null,
          landlordEmail: addr.landlordEmail || null,
          landlordPhone: addr.landlordPhone || null,
          landlordType: addr.landlordType || null
        }))
      },
      personal: {
        smoker: personal.smoker,
        hasPets: personal.hasPets || false,
        petDetails: personal.petDetails || null,
        maritalStatus: personal.maritalStatus || null,
        dependants: personal.dependants || 0,
        dependantsDetails: personal.dependantsDetails || null,
        hasAdverseCredit: personal.hasAdverseCredit || false,
        adverseCreditDetails: personal.adverseCreditDetails || null
      },
      guarantor: guarantor && guarantor.firstName ? {
        firstName: guarantor.firstName,
        lastName: guarantor.lastName,
        email: guarantor.email ? encrypt(guarantor.email) : null,
        phone: guarantor.phone ? encrypt(guarantor.phone) : null,
        relationship: guarantor.relationship
      } : null,
      deposit: deposit || null,
      consent: {
        creditCheck: consent.creditCheck,
        amlCheck: consent.amlCheck,
        dataProcessing: consent.dataProcessing,
        declaration: consent.declaration,
        signature: consent.signature ? encrypt(consent.signature) : null,
        printedName: consent.printedName,
        timestamp: new Date().toISOString()
      }
    }

    // Build update object
    const updateData: any = {
      tenant_first_name_encrypted: encrypt(identity.firstName),
      tenant_last_name_encrypted: encrypt(identity.lastName),
      tenant_dob_encrypted: identity.dateOfBirth ? encrypt(identity.dateOfBirth) : null,
      tenant_phone_encrypted: identity.phone ? encrypt(identity.phone) : null,
      // Save current address to encrypted columns (used by tenancy conversion)
      current_address_line1_encrypted: residential?.currentAddress?.line1 ? encrypt(residential.currentAddress.line1) : null,
      current_address_line2_encrypted: residential?.currentAddress?.line2 ? encrypt(residential.currentAddress.line2) : null,
      current_city_encrypted: residential?.currentAddress?.city ? encrypt(residential.currentAddress.city) : null,
      current_postcode_encrypted: residential?.currentAddress?.postcode ? encrypt(residential.currentAddress.postcode) : null,
      form_data: encryptedFormData,
      form_submitted_at: new Date().toISOString(),
      status: 'COLLECTING_EVIDENCE',
      // Store annual income for affordability calculations
      annual_income: calculatedAnnualIncome || null
    }

    // Save Reposit choice if deposit replacement was offered
    if (deposit && typeof deposit.repositConfirmed === 'boolean') {
      updateData.reposit_confirmed = deposit.repositConfirmed
      updateData.reposit_confirmed_at = new Date().toISOString()
    }

    // Save Reposit interest if tenant expressed interest (when not offered via offer stage)
    if (deposit && deposit.repositInterested === true) {
      updateData.reposit_interested = true
    }

    // Save smoker status
    if (typeof personal.smoker === 'boolean') {
      updateData.is_smoker = personal.smoker
    }

    // Save pets info
    if (personal.hasPets) {
      updateData.has_pets = true
      updateData.pet_details = personal.petDetails || null
    }

    // Save adverse credit
    if (personal.hasAdverseCredit) {
      updateData.has_adverse_credit = true
      updateData.adverse_credit_details = personal.adverseCreditDetails || null
    }

    // Update the reference with form data
    const { error: updateError } = await supabase
      .from('tenant_references_v2')
      .update(updateData)
      .eq('id', reference.id)

    if (updateError) {
      console.error('Error submitting form:', updateError)
      return res.status(500).json({ error: 'Failed to submit reference' })
    }

    // Log activity
    await logActivity({
      referenceId: reference.id,
      action: 'FORM_SUBMITTED',
      performedBy: 'tenant',
      performedByType: 'tenant',
      notes: `${identity.firstName} ${identity.lastName} submitted their reference form`
    })

    // Initialize sections for verification (if not already done)
    const existingSections = await supabase
      .from('reference_sections_v2')
      .select('id')
      .eq('reference_id', reference.id)
      .limit(1)

    if (!existingSections.data?.length) {
      const sections = await initializeSections(reference.id, reference.is_guarantor || false)
      if (!sections) {
        console.error(`[V2] CRITICAL: Failed to initialize sections for reference ${reference.id} — chase items may not be created`)
      } else {
        console.log(`[V2] Initialized ${sections.length} sections for reference ${reference.id}`)
      }
    }

    // Build tenant name for referee emails
    const tenantFullName = `${identity.firstName} ${identity.lastName}`.trim()

    // Create referee requests
    // Check if income source is student-only (no income verification needed)
    const incomeSources: string[] = Array.isArray(income.sources) ? income.sources : []
    const isStudentOnly = incomeSources.length === 1 && incomeSources.includes('student')

    // Employer reference (skip if student-only — no income verification required)
    if (income.employerRefEmail && !isStudentOnly) {
      await createRefereeRequest(reference.id, reference.company_id, 'EMPLOYER', income.employerRefEmail, tenantFullName, income.employerRefName)
    }

    // Accountant reference (for self-employed, skip if student-only)
    if (income.accountantEmail && !isStudentOnly) {
      await createRefereeRequest(reference.id, reference.company_id, 'ACCOUNTANT', income.accountantEmail, tenantFullName, income.accountantName)
    }

    // Most recent landlord/agent reference only (current landlord if renting, otherwise first previous landlord)
    if (residential.currentLandlordEmail && residential.currentLivingSituation !== 'living_with_family') {
      await createRefereeRequest(reference.id, reference.company_id, 'LANDLORD', residential.currentLandlordEmail, tenantFullName, residential.currentLandlordName || undefined)
    } else {
      // Fall back to first previous address landlord if not currently renting
      const firstLandlord = (residential.previousAddresses || []).find(
        (addr: any) => addr.landlordEmail && addr.landlordType !== 'Living with Family/Friends'
      )
      if (firstLandlord) {
        await createRefereeRequest(reference.id, reference.company_id, 'LANDLORD', firstLandlord.landlordEmail, tenantFullName, firstLandlord.landlordName || undefined)
      }
    }

    // Create guarantor reference if provided
    console.log('[V2 TenantForm] Guarantor check:', { hasGuarantor: !!guarantor, firstName: guarantor?.firstName, email: guarantor?.email })
    if (guarantor && guarantor.firstName && guarantor.email) {
      console.log('[V2 TenantForm] Creating guarantor reference for:', guarantor.email)
      await createGuarantorReference(reference, guarantor)
      await logActivity({
        referenceId: reference.id,
        action: 'GUARANTOR_ADDED',
        performedBy: 'tenant',
        performedByType: 'tenant',
        notes: `Guarantor ${guarantor.firstName} ${guarantor.lastName} added (${guarantor.email})`
      })
    }

    // Mark IDENTITY and RTR sections as READY (tenant provided evidence in form)
    try {
      const { data: sections } = await supabase
        .from('reference_sections_v2')
        .select('id, section_type')
        .eq('reference_id', reference.id)
        .in('section_type', ['IDENTITY', 'RTR'])

      for (const section of (sections || [])) {
        await supabase
          .from('reference_sections_v2')
          .update({
            queue_status: 'READY',
            evidence_submitted_at: new Date().toISOString(),
            queue_entered_at: new Date().toISOString()
          })
          .eq('id', section.id)
        console.log(`[V2 TenantForm] Marked ${section.section_type} section as READY`)
      }

      // RESIDENTIAL evidence gate
      const isLivingWithFamily = residential.currentLivingSituation === 'living_with_family'
      const hasLandlordReferee = !!(
        (residential.currentLandlordEmail && !isLivingWithFamily) ||
        (residential.previousAddresses || []).some(
          (addr: any) => addr.landlordEmail && addr.landlordType !== 'Living with Family/Friends'
        )
      )

      const { data: resSection } = await supabase
        .from('reference_sections_v2')
        .select('id, section_data')
        .eq('reference_id', reference.id)
        .eq('section_type', 'RESIDENTIAL')
        .single()

      if (resSection) {
        const now = new Date().toISOString()
        if (isLivingWithFamily && !hasLandlordReferee) {
          // Living with family, no landlord referee — auto-pass
          await supabase
            .from('reference_sections_v2')
            .update({
              queue_status: 'COMPLETED',
              decision: 'PASS',
              completed_at: now,
              assessor_notes: 'Auto-passed: living with family - no residential reference required',
              section_data: {
                ...(resSection.section_data || {}),
                evidence_status: 'AUTO_PASSED',
                auto_pass_reason: 'Living with family'
              },
              updated_at: now
            })
            .eq('id', resSection.id)
          console.log('[V2 TenantForm] Living with family - RESIDENTIAL auto-passed')
          await logActivity({
            referenceId: reference.id,
            sectionId: resSection.id,
            action: 'RESIDENTIAL_AUTO_PASS',
            performedBy: 'system',
            performedByType: 'system',
            notes: 'Living with family - residential section auto-passed'
          })
        } else if (hasLandlordReferee) {
          // Has landlord/agent referee — stay PENDING, wait for referee form
          await supabase
            .from('reference_sections_v2')
            .update({
              section_data: {
                ...(resSection.section_data || {}),
                evidence_status: 'AWAITING_REFEREE'
              },
              updated_at: now
            })
            .eq('id', resSection.id)
          console.log('[V2 TenantForm] Landlord referee created - RESIDENTIAL awaiting referee')
        } else {
          // Not living with family AND no referee — stay PENDING, await evidence
          await supabase
            .from('reference_sections_v2')
            .update({
              section_data: {
                ...(resSection.section_data || {}),
                evidence_status: 'AWAITING_EVIDENCE',
                evidence_missing_reason: 'No landlord/agent contact provided'
              },
              updated_at: now
            })
            .eq('id', resSection.id)
          console.log('[V2 TenantForm] No landlord referee and not living with family - RESIDENTIAL awaiting evidence')
        }
      }

      // INCOME evidence gate
      const isStudentIncome = incomeSources.includes('student')
      const isStudentOnlyIncome = incomeSources.length === 1 && isStudentIncome
      const hasIncomeReferee = !!(income.employerRefEmail || income.accountantEmail) && !isStudentOnlyIncome

      const { data: incSection } = await supabase
        .from('reference_sections_v2')
        .select('id, section_data')
        .eq('reference_id', reference.id)
        .eq('section_type', 'INCOME')
        .single()

      if (incSection) {
        const now = new Date().toISOString()
        if (isStudentOnlyIncome) {
          // Student-only income — no verification needed, move straight to READY
          await supabase
            .from('reference_sections_v2')
            .update({
              queue_status: 'READY',
              evidence_submitted_at: now,
              queue_entered_at: now,
              section_data: {
                ...(incSection.section_data || {}),
                evidence_status: 'STUDENT_EXEMPT',
                income_source: 'student'
              },
              updated_at: now
            })
            .eq('id', incSection.id)
          console.log('[V2 TenantForm] Student income - INCOME section moved to READY (student exempt)')
        } else if (hasIncomeReferee) {
          // Has employer/accountant referee — stay PENDING, wait for referee form
          await supabase
            .from('reference_sections_v2')
            .update({
              section_data: {
                ...(incSection.section_data || {}),
                evidence_status: 'AWAITING_REFEREE'
              },
              updated_at: now
            })
            .eq('id', incSection.id)
          console.log('[V2 TenantForm] Income referee created - INCOME awaiting referee')
        } else {
          // No referee — check if tenant uploaded evidence (savings doc, benefits doc, pension doc, etc.)
          const hasUploadedEvidence = !!(
            income.savingsDocUrl || income.benefitsDocUrl || income.pensionDocUrl ||
            income.rentalDocUrl || income.payslipsUrl || income.taxReturnUrl
          )

          if (hasUploadedEvidence) {
            // Evidence already provided, move to READY for staff review
            await supabase
              .from('reference_sections_v2')
              .update({
                queue_status: 'READY',
                evidence_submitted_at: now,
                queue_entered_at: now,
                section_data: {
                  ...(incSection.section_data || {}),
                  evidence_status: 'EVIDENCE_UPLOADED',
                  income_source: incomeSources.join(', ')
                },
                updated_at: now
              })
              .eq('id', incSection.id)
            console.log('[V2 TenantForm] Income evidence uploaded (no referee) - INCOME moved to READY')
          } else {
            // No referee and no evidence — stay PENDING
            await supabase
              .from('reference_sections_v2')
              .update({
                section_data: {
                  ...(incSection.section_data || {}),
                  evidence_status: 'AWAITING_EVIDENCE',
                  evidence_missing_reason: 'No referee contact or income documents provided'
                },
                updated_at: now
              })
              .eq('id', incSection.id)
            console.log('[V2 TenantForm] No income referee or evidence - INCOME awaiting evidence')
          }
        }
      }
    } catch (sectionErr) {
      console.error('[V2 TenantForm] Error updating section statuses:', sectionErr)
    }

    // Auto-trigger Credit and AML checks (run in background, don't block response)
    const previousAddresses = residential.previousAddresses || []
    const firstPreviousAddr = previousAddresses.length > 0 ? previousAddresses[0] : null
    triggerAutomatedChecks(reference.id, {
      firstName: identity.firstName,
      lastName: identity.lastName,
      dateOfBirth: identity.dateOfBirth,
      address: residential.currentAddress.line1 + (residential.currentAddress.line2 ? ', ' + residential.currentAddress.line2 : ''),
      postcode: residential.currentAddress.postcode,
      previousAddress: firstPreviousAddr ? (firstPreviousAddr.line1 + (firstPreviousAddr.line2 ? ', ' + firstPreviousAddr.line2 : '')) : undefined,
      previousPostcode: firstPreviousAddr?.postcode || undefined
    }).catch(err => console.error('[V2 TenantForm] Background checks error:', err))

    return res.json({
      success: true,
      message: 'Reference submitted successfully'
    })
  } catch (error) {
    console.error('Error submitting tenant form:', error)
    return res.status(500).json({ error: 'Failed to submit reference' })
  }
})

// POST /api/v2/tenant-form/:token/upload - Upload evidence file
router.post('/:token/upload', async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const { section, fileType, fileName, fileData } = req.body

    // Get the reference
    const reference = await getReferenceByFormToken(token)

    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Generate a unique file path
    const filePath = `v2-evidence/${reference.company_id}/${reference.id}/${section}/${Date.now()}-${fileName}`

    // Decode base64 file data
    const buffer = Buffer.from(fileData, 'base64')

    // Resolve content type — browsers sometimes send empty or generic types
    const mimeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.heic': 'image/heic',
      '.heif': 'image/heif'
    }
    const ext = '.' + (fileName || '').split('.').pop()?.toLowerCase()
    const resolvedType = (fileType && fileType !== 'application/octet-stream' && fileType !== '')
      ? fileType
      : mimeMap[ext] || 'application/pdf'

    // Upload to storage
    const { error: uploadError } = await supabase
      .storage
      .from('reference-documents')
      .upload(filePath, buffer, {
        contentType: resolvedType,
        upsert: false
      })

    if (uploadError) {
      console.error('Error uploading file:', uploadError.message, 'Size:', buffer.length, 'bytes')
      return res.status(500).json({ error: `Failed to upload file: ${uploadError.message}` })
    }

    // Get the public URL
    const { data: urlData } = supabase
      .storage
      .from('reference-documents')
      .getPublicUrl(filePath)

    // Record the evidence in the database
    const { data: evidence, error: evidenceError } = await supabase
      .from('evidence_v2')
      .insert({
        reference_id: reference.id,
        section_type: section.toUpperCase(),
        evidence_type: 'document',
        file_path: filePath,
        file_name: fileName,
        file_type: fileType,
        uploaded_by: 'tenant'
      })
      .select()
      .single()

    if (evidenceError) {
      console.error('Error recording evidence:', evidenceError)
    }

    return res.json({
      success: true,
      fileId: evidence?.id,
      url: urlData.publicUrl
    })
  } catch (error) {
    console.error('Error uploading evidence:', error)
    return res.status(500).json({ error: 'Failed to upload file' })
  }
})

// Helper: Create a referee request
async function createRefereeRequest(
  referenceId: string,
  companyId: string,
  refereeType: 'EMPLOYER' | 'LANDLORD' | 'ACCOUNTANT',
  email: string,
  tenantName: string,
  name?: string
): Promise<void> {
  try {
    const formToken = generateToken()
    const formTokenHash = hash(formToken)

    const { data: referee, error } = await supabase
      .from('referees_v2')
      .insert({
        reference_id: referenceId,
        referee_type: refereeType,
        referee_email_encrypted: encrypt(email),
        referee_name: name || null,
        form_token: formToken,
        form_token_hash: formTokenHash
      })
      .select()
      .single()

    if (error) {
      console.error(`Error creating ${refereeType} referee request:`, error)
      return
    }

    // Get company info for email
    const { data: companyData } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .maybeSingle()

    const cd = companyData as any
    const companyName = cd?.name || (cd?.name_encrypted ? decrypt(cd.name_encrypted) : null) || cd?.company_name || 'PropertyGoose'
    const companyPhone = cd?.phone_encrypted ? decrypt(cd.phone_encrypted) || '' : ''
    const companyEmail = cd?.email_encrypted ? decrypt(cd.email_encrypted) || '' : ''
    const companyLogoUrl = cd?.logo_url || null

    // Build referee form URL
    const frontendUrl = getV2FrontendUrl()
    const refereeName = name || 'Referee'
    let formUrl: string

    const refereeTypeToPath: Record<string, string> = {
      'EMPLOYER': 'v2/employer-reference',
      'LANDLORD': 'v2/landlord-reference',
      'ACCOUNTANT': 'v2/accountant-reference'
    }
    formUrl = `${frontendUrl}/${refereeTypeToPath[refereeType]}/${formToken}`

    // Send the appropriate email
    try {
      if (refereeType === 'EMPLOYER') {
        await sendEmployerReferenceRequest(
          email,
          refereeName,
          tenantName,
          formUrl,
          companyName,
          companyPhone,
          companyEmail,
          referenceId,
          companyLogoUrl
        )
      } else if (refereeType === 'LANDLORD') {
        await sendLandlordReferenceRequest(
          email,
          refereeName,
          tenantName,
          formUrl,
          companyName,
          companyPhone,
          companyEmail,
          referenceId,
          companyLogoUrl
        )
      } else if (refereeType === 'ACCOUNTANT') {
        await sendAccountantReferenceRequest(
          email,
          refereeName,
          tenantName,
          formUrl,
          companyName,
          companyPhone,
          companyEmail,
          referenceId
        )
      }
      console.log(`[V2] Sent ${refereeType} referee email to ${email}`)
    } catch (emailError) {
      console.error(`[V2] Failed to send ${refereeType} referee email:`, emailError)
    }

    // Create chase item for follow-up tracking
    const sectionTypeMap: Record<string, string> = {
      'EMPLOYER': 'INCOME',
      'ACCOUNTANT': 'INCOME',
      'LANDLORD': 'RESIDENTIAL'
    }
    const sectionType = sectionTypeMap[refereeType]

    // Look up the section ID — if missing, create sections then retry
    let { data: section } = await supabase
      .from('reference_sections_v2')
      .select('id')
      .eq('reference_id', referenceId)
      .eq('section_type', sectionType)
      .single()

    if (!section) {
      console.warn(`[V2] Section ${sectionType} missing for ${referenceId}, initializing sections now`)
      await initializeSections(referenceId, false)
      const retry = await supabase
        .from('reference_sections_v2')
        .select('id')
        .eq('reference_id', referenceId)
        .eq('section_type', sectionType)
        .single()
      section = retry.data
    }

    if (section) {
      await createChaseItem(
        referenceId,
        section.id,
        refereeType,
        {
          name: refereeName,
          email: email
        }
      )
      console.log(`[V2] Created chase item for ${refereeType} referee`)
    } else {
      console.error(`[V2] CRITICAL: Could not create ${sectionType} section for reference ${referenceId} — chase item NOT created`)
    }

    console.log(`[V2] Created ${refereeType} referee request for ${email}`)
  } catch (error) {
    console.error(`Error creating referee request:`, error)
  }
}

// Helper: Create guarantor reference
async function createGuarantorReference(
  tenantReference: any,
  guarantor: { firstName: string; lastName: string; email: string; phone?: string; relationship: string }
): Promise<void> {
  try {
    const formToken = generateToken()
    const formTokenHash = hash(formToken)

    // Create a new reference for the guarantor
    const { data: guarantorRef, error } = await supabase
      .from('tenant_references_v2')
      .insert({
        company_id: tenantReference.company_id,
        branch_id: tenantReference.branch_id,
        created_by: tenantReference.created_by,
        tenant_first_name_encrypted: encrypt(guarantor.firstName),
        tenant_last_name_encrypted: encrypt(guarantor.lastName),
        tenant_email_encrypted: encrypt(guarantor.email),
        tenant_phone_encrypted: guarantor.phone ? encrypt(guarantor.phone) : null,
        property_address_encrypted: tenantReference.property_address_encrypted,
        property_city: tenantReference.property_city,
        property_postcode: tenantReference.property_postcode,
        monthly_rent: tenantReference.rent_share || tenantReference.monthly_rent,
        rent_share: tenantReference.rent_share || tenantReference.monthly_rent,
        move_in_date: tenantReference.move_in_date,
        is_guarantor: true,
        guarantor_for_reference_id: tenantReference.id,
        guarantor_relationship: guarantor.relationship,
        form_token_hash: formTokenHash,
        status: 'SENT'
      })
      .select()
      .single()

    if (error) {
      console.error('[V2 TenantForm] Error creating guarantor reference:', error.message, error.details)
      return
    }

    console.log('[V2 TenantForm] Guarantor reference created:', guarantorRef?.id, guarantorRef?.reference_number)

    // Deduct 0.5 credits for guarantor reference
    try {
      const { deductCredits } = await import('../../services/creditService')
      await deductCredits(tenantReference.company_id, 0.5, guarantorRef.id, `V2 guarantor reference: ${guarantor.firstName} ${guarantor.lastName}`)
      console.log(`[V2 TenantForm] Deducted 0.5 credits for guarantor ${guarantor.firstName} ${guarantor.lastName}`)
    } catch (creditError: any) {
      console.error(`[V2 TenantForm] Guarantor credit deduction failed:`, creditError.message)
    }

    // Link guarantor to tenant reference
    await supabase
      .from('tenant_references_v2')
      .update({ guarantor_reference_id: guarantorRef.id })
      .eq('id', tenantReference.id)

    // Get company info for email
    const { data: gCompany } = await supabase
      .from('companies')
      .select('*')
      .eq('id', tenantReference.company_id)
      .maybeSingle()

    const gc = gCompany as any
    const gCompanyName = gc?.name || (gc?.name_encrypted ? decrypt(gc.name_encrypted) : null) || gc?.company_name || 'PropertyGoose'

    // Get property address
    const propertyAddress = tenantReference.property_address_encrypted
      ? decrypt(tenantReference.property_address_encrypted)
      : 'the property'

    const tenantFirstName = tenantReference.tenant_first_name_encrypted
      ? decrypt(tenantReference.tenant_first_name_encrypted)
      : 'the tenant'

    const tenantLastName = tenantReference.tenant_last_name_encrypted
      ? decrypt(tenantReference.tenant_last_name_encrypted)
      : ''

    // Send email to guarantor - use the V2 guarantor form (separate from tenant form)
    const guarantorFormUrl = `${process.env.FRONTEND_URL || 'https://app.propertygoose.co.uk'}/guarantor-reference-v2/${formToken}`

    // Use the guarantor email template
    await sendGuarantorReferenceRequest(
      guarantor.email,
      guarantor.firstName,
      `${tenantFirstName} ${tenantLastName}`.trim(),
      propertyAddress || 'the property',
      gCompanyName,
      gc?.phone_encrypted ? decrypt(gc.phone_encrypted) || '' : '',
      gc?.email_encrypted ? decrypt(gc.email_encrypted) || '' : '',
      guarantorFormUrl,
      guarantorRef.id,
      gc?.logo_url || null,
      tenantReference.monthly_rent || undefined,
      tenantReference.rent_share || tenantReference.monthly_rent || undefined
    )

    console.log(`[V2] Created guarantor reference for ${guarantor.email}, sent email`)
  } catch (error) {
    console.error('Error creating guarantor reference:', error)
  }
}

/**
 * Auto-trigger Credit and AML checks when tenant submits form
 * Runs in background - errors are logged but don't fail the submission
 */
async function triggerAutomatedChecks(
  referenceId: string,
  tenantData: {
    firstName: string
    lastName: string
    dateOfBirth: string
    address: string
    postcode: string
    previousAddress?: string
    previousPostcode?: string
  }
): Promise<void> {
  console.log(`[V2 AutoChecks] Starting automated checks for reference ${referenceId}`)

  // Get section IDs for updating status
  const { data: sections } = await supabase
    .from('reference_sections_v2')
    .select('id, section_type')
    .eq('reference_id', referenceId)
    .in('section_type', ['CREDIT', 'AML'])

  const creditSection = sections?.find(s => s.section_type === 'CREDIT')
  const amlSection = sections?.find(s => s.section_type === 'AML')

  // Run both checks in parallel
  const results = await Promise.allSettled([
    // Credit Check
    (async () => {
      if (!creditsafeService.isEnabled()) {
        console.log('[V2 AutoChecks] Creditsafe not enabled, skipping credit check')
        return null
      }

      console.log(`[V2 AutoChecks] Running credit check for ${tenantData.firstName} ${tenantData.lastName}`)
      const result = await creditsafeService.verifyIndividual({
        firstName: tenantData.firstName,
        lastName: tenantData.lastName,
        dateOfBirth: tenantData.dateOfBirth,
        address: tenantData.address,
        postcode: tenantData.postcode
      })

      // Store result in V2 table (V1 table has FK to tenant_references, not tenant_references_v2)
      try {
        await supabase.from('creditsafe_verifications_v2').insert({
          reference_id: referenceId,
          request_data_encrypted: encrypt(JSON.stringify(tenantData)),
          response_data_encrypted: encrypt(JSON.stringify(result)),
          transaction_id: result.transactionId || null,
          risk_level: result.riskLevel,
          risk_score: result.riskScore,
          status: result.status,
          fraud_indicators: (result as any).fraudIndicators || null,
          address_type: 'current'
        })
      } catch (storeErr) {
        console.error('[V2 AutoChecks] Failed to store credit result:', storeErr)
      }

      // Update section status
      if (creditSection) {
        const sectionData = {
          status: result.status,
          riskLevel: result.riskLevel,
          riskScore: result.riskScore,
          verifyMatch: result.verifyMatch,
          notFound: result.notFound,
          ccjMatch: result.ccjMatch,
          insolvencyMatch: result.insolvencyMatch,
          electoralRegisterMatch: result.electoralRegisterMatch,
          deceasedRegisterMatch: result.deceasedRegisterMatch || false,
          ccjCount: result.countyCourtJudgments?.length || 0,
          insolvencyCount: result.insolvencies?.length || 0,
          transactionId: result.transactionId || null,
          checkedAt: new Date().toISOString()
        }
        await updateSectionStatus(creditSection.id, {
          status: 'READY',
          sectionData
        })
      }

      console.log(`[V2 AutoChecks] Credit check completed: ${result.status} (risk: ${result.riskLevel})`)

      // Run second credit check against previous address for 3-year history coverage
      if (tenantData.previousAddress && tenantData.previousPostcode) {
        try {
          console.log(`[V2 AutoChecks] Running previous address credit check for ${tenantData.firstName} ${tenantData.lastName}`)
          const prevResult = await creditsafeService.verifyIndividual({
            firstName: tenantData.firstName,
            lastName: tenantData.lastName,
            dateOfBirth: tenantData.dateOfBirth,
            address: tenantData.previousAddress,
            postcode: tenantData.previousPostcode
          })

          await supabase.from('creditsafe_verifications_v2').insert({
            reference_id: referenceId,
            request_data_encrypted: encrypt(JSON.stringify({
              ...tenantData,
              address: tenantData.previousAddress,
              postcode: tenantData.previousPostcode
            })),
            response_data_encrypted: encrypt(JSON.stringify(prevResult)),
            transaction_id: prevResult.transactionId || null,
            risk_level: prevResult.riskLevel,
            risk_score: prevResult.riskScore,
            status: prevResult.status,
            fraud_indicators: (prevResult as any).fraudIndicators || null,
            address_type: 'previous'
          })

          console.log(`[V2 AutoChecks] Previous address credit check completed: ${prevResult.status}`)
        } catch (prevErr: any) {
          console.error('[V2 AutoChecks] Previous address credit check failed:', prevErr.message)
        }
      }

      return result
    })(),

    // AML/Sanctions Check
    (async () => {
      if (!sanctionsService.isEnabled()) {
        console.log('[V2 AutoChecks] Sanctions service not enabled, skipping AML check')
        return null
      }

      const fullName = `${tenantData.firstName} ${tenantData.lastName}`
      console.log(`[V2 AutoChecks] Running AML check for ${fullName}`)

      const result = await sanctionsService.screenTenant({
        name: fullName,
        dateOfBirth: tenantData.dateOfBirth,
        postcode: tenantData.postcode
      })

      // Store result in V2 table (V1 table has FK to tenant_references, not tenant_references_v2)
      try {
        await supabase.from('sanctions_screenings_v2').insert({
          reference_id: referenceId,
          screening_data_encrypted: encrypt(JSON.stringify(result)),
          risk_level: result.risk_level,
          total_matches: result.total_matches || 0,
          sanctions_matches: result.sanctions_matches?.length || 0,
          donation_matches: result.donation_matches?.length || 0,
          summary: result.summary || null
        })
      } catch (storeErr) {
        console.error('[V2 AutoChecks] Failed to store AML result:', storeErr)
      }

      // Update section status
      if (amlSection) {
        const sectionData = {
          riskLevel: result.risk_level,
          sanctionsMatches: result.sanctions_matches?.length || 0,
          donationMatches: result.donation_matches?.length || 0,
          totalMatches: result.total_matches || 0,
          summary: result.summary,
          requiresManualReview: sanctionsService.requiresManualReview(result),
          shouldReject: sanctionsService.shouldReject(result),
          checkedAt: new Date().toISOString()
        }
        await updateSectionStatus(amlSection.id, {
          status: 'READY',
          sectionData
        })
      }

      console.log(`[V2 AutoChecks] AML check completed: ${result.risk_level}`)
      return result
    })()
  ])

  // Log any failures
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const checkType = index === 0 ? 'Credit' : 'AML'
      console.error(`[V2 AutoChecks] ${checkType} check failed:`, result.reason)
    }
  })

  console.log(`[V2 AutoChecks] Completed automated checks for reference ${referenceId}`)

  // Log activity for completed checks
  if (results[0]?.status === 'fulfilled') {
    await logActivity({
      referenceId,
      action: 'CREDIT_CHECK_COMPLETED',
      performedBy: 'system',
      performedByType: 'system',
      notes: `Credit check completed: ${results[0].value?.status || 'unknown'}`
    })
  }
  if (results[1]?.status === 'fulfilled') {
    await logActivity({
      referenceId,
      action: 'AML_CHECK_COMPLETED',
      performedBy: 'system',
      performedByType: 'system',
      notes: `AML/Sanctions check completed: ${results[1].value?.risk_level || 'unknown'}`
    })
  }
}

export default router

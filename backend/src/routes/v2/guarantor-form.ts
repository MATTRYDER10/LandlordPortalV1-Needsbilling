/**
 * V2 Guarantor Form Routes
 *
 * Public endpoints for guarantor reference form submission.
 * Uses permanent links via hashed tokens for security.
 * Guarantors have 4 sections: Identity, Address, Income (32x requirement), Consent
 */

import express, { Request, Response, Router } from 'express'
import { supabase } from '../../config/supabase'
import { encrypt, decrypt, hash, generateToken } from '../../services/encryption'
import { getReferenceByFormToken } from '../../services/v2/referenceServiceV2'
import { logActivity } from '../../services/v2/activityServiceV2'
import { initializeSections, updateSectionStatus } from '../../services/v2/sectionServiceV2'
import { creditsafeService } from '../../services/creditsafeService'
import { sanctionsService } from '../../services/sanctionsService'
import { loadEmailTemplate, sendEmail } from '../../services/emailService'

const router: Router = express.Router()

// GET /api/v2/guarantor-form/:token - Get guarantor reference details
router.get('/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params

    console.log('[V2 GuarantorForm] Looking up token:', token.substring(0, 16) + '...')

    // Look up reference by hashed token
    const reference = await getReferenceByFormToken(token)

    if (!reference) {
      console.log('[V2 GuarantorForm] Reference not found for token')
      return res.status(404).json({ error: 'Reference not found or link expired' })
    }

    // Verify this is actually a guarantor reference
    if (!reference.is_guarantor) {
      console.log('[V2 GuarantorForm] Reference is not a guarantor reference')
      return res.status(400).json({ error: 'This is not a guarantor reference' })
    }

    console.log('[V2 GuarantorForm] Found guarantor reference:', reference.id)

    // Get company info for branding
    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('id', reference.company_id)
      .maybeSingle()

    // Decrypt fields for display
    const guarantorFirstName = reference.tenant_first_name_encrypted
      ? decrypt(reference.tenant_first_name_encrypted)
      : null
    const guarantorLastName = reference.tenant_last_name_encrypted
      ? decrypt(reference.tenant_last_name_encrypted)
      : null
    const guarantorPhone = reference.tenant_phone_encrypted
      ? decrypt(reference.tenant_phone_encrypted)
      : null
    const guarantorEmail = reference.tenant_email_encrypted
      ? decrypt(reference.tenant_email_encrypted)
      : null
    const propertyAddress = reference.property_address_encrypted
      ? decrypt(reference.property_address_encrypted)
      : null

    // Get tenant name from the parent reference
    let tenantName = 'the tenant'
    if (reference.guarantor_for_reference_id) {
      const { data: tenantRef } = await supabase
        .from('tenant_references_v2')
        .select('tenant_first_name_encrypted, tenant_last_name_encrypted')
        .eq('id', reference.guarantor_for_reference_id)
        .single()

      if (tenantRef) {
        const firstName = tenantRef.tenant_first_name_encrypted
          ? decrypt(tenantRef.tenant_first_name_encrypted)
          : ''
        const lastName = tenantRef.tenant_last_name_encrypted
          ? decrypt(tenantRef.tenant_last_name_encrypted)
          : ''
        tenantName = `${firstName} ${lastName}`.trim() || 'the tenant'
      }
    }

    // Get company contact info
    const { data: companyWithContact } = await supabase
      .from('companies')
      .select('phone_encrypted, email_encrypted, address, website')
      .eq('id', reference.company_id)
      .single()

    return res.json({
      reference: {
        id: reference.id,
        tenant_first_name: guarantorFirstName,
        tenant_last_name: guarantorLastName,
        tenant_phone: guarantorPhone,
        tenant_email: guarantorEmail,
        property_address: propertyAddress,
        monthly_rent: reference.monthly_rent,
        move_in_date: reference.move_in_date,
        form_submitted_at: reference.form_submitted_at,
        status: reference.status,
        is_guarantor: true,
        guarantor_relationship: reference.guarantor_relationship,
        form_data: reference.form_data || null
      },
      tenantName,
      companyName: (company as any)?.name || ((company as any)?.name_encrypted ? decrypt((company as any).name_encrypted) : null) || (company as any)?.company_name || 'PropertyGoose',
      companyLogo: (company as any)?.logo_url || '',
      companyPhone: companyWithContact?.phone_encrypted ? decrypt(companyWithContact.phone_encrypted) : '',
      companyEmail: companyWithContact?.email_encrypted ? decrypt(companyWithContact.email_encrypted) : '',
      companyAddress: companyWithContact?.address || '',
      companyWebsite: companyWithContact?.website || '',
      primaryColor: company?.primary_color || '#f97316',
      buttonColor: company?.button_color || '#f97316'
    })
  } catch (error) {
    console.error('Error fetching guarantor form:', error)
    return res.status(500).json({ error: 'Failed to load reference' })
  }
})

// POST /api/v2/guarantor-form/:token/save - Save section progress (auto-save)
router.post('/:token/save', async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const { section, data } = req.body

    console.log(`[V2 GuarantorForm] Save request for section: ${section}`)

    // Validate section type (guarantor has fewer sections)
    const validSections = ['identity', 'address', 'income', 'consent']
    if (!validSections.includes(section)) {
      console.log(`[V2 GuarantorForm] Invalid section: ${section}`)
      return res.status(400).json({ error: 'Invalid section' })
    }

    // Get the reference
    const reference = await getReferenceByFormToken(token)

    if (!reference) {
      console.log(`[V2 GuarantorForm] Reference not found for token`)
      return res.status(404).json({ error: 'Reference not found' })
    }

    if (!reference.is_guarantor) {
      return res.status(400).json({ error: 'This is not a guarantor reference' })
    }

    console.log(`[V2 GuarantorForm] Saving to reference ${reference.id}`)

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
      console.error('[V2 GuarantorForm] Error saving section:', updateError)
      return res.status(500).json({ error: 'Failed to save progress', details: updateError.message })
    }

    console.log(`[V2 GuarantorForm] Section ${section} saved successfully`)
    return res.json({ success: true })
  } catch (error) {
    console.error('[V2 GuarantorForm] Exception saving section:', error)
    return res.status(500).json({ error: 'Failed to save progress' })
  }
})

// POST /api/v2/guarantor-form/:token/submit - Submit the complete guarantor form
router.post('/:token/submit', async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const formData = req.body

    const { identity, address, income, consent, calculatedAnnualIncome } = formData

    // Validate required consents
    if (!consent?.creditCheck || !consent?.amlCheck || !consent?.dataProcessing || !consent?.guarantorAgreement || !consent?.declaration) {
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

    if (!reference.is_guarantor) {
      return res.status(400).json({ error: 'This is not a guarantor reference' })
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
        idDocumentWillEmail: identity.idDocumentWillEmail || false,
        selfieUrl: identity.selfieUrl || null
      },
      address: {
        line1: address.line1,
        line2: address.line2 || null,
        city: address.city,
        postcode: address.postcode,
        years: address.years,
        months: address.months,
        proofOfAddressUrl: address.proofOfAddressUrl || null,
        proofOfAddressWillEmail: address.proofOfAddressWillEmail || false
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
        payslipsWillEmail: income.payslipsWillEmail || false,
        // Self-employed
        businessName: income.businessName || null,
        businessNature: income.businessNature || null,
        businessStartDate: income.businessStartDate || null,
        selfEmployedIncome: income.selfEmployedIncome || null,
        accountantName: income.accountantName || null,
        accountantEmail: income.accountantEmail || null,
        taxReturnUrl: income.taxReturnUrl || null,
        taxReturnWillEmail: income.taxReturnWillEmail || false,
        // Savings
        savingsAmount: income.savingsAmount || null,
        savingsDocUrl: income.savingsDocUrl || null,
        savingsDocWillEmail: income.savingsDocWillEmail || false,
        // Pension
        pensionAmount: income.pensionAmount || null,
        pensionProvider: income.pensionProvider || null,
        pensionDocUrl: income.pensionDocUrl || null,
        pensionDocWillEmail: income.pensionDocWillEmail || false,
        // Landlord/Rental income
        rentalIncome: income.rentalIncome || null,
        rentalDocUrl: income.rentalDocUrl || null,
        rentalDocWillEmail: income.rentalDocWillEmail || false
      },
      consent: {
        creditCheck: consent.creditCheck,
        amlCheck: consent.amlCheck,
        dataProcessing: consent.dataProcessing,
        guarantorAgreement: consent.guarantorAgreement,
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
      form_data: encryptedFormData,
      form_submitted_at: new Date().toISOString(),
      status: 'COLLECTING_EVIDENCE',
      // Store annual income for affordability calculations (32x for guarantors)
      annual_income: calculatedAnnualIncome || null
    }

    // Update the reference with form data
    const { error: updateError } = await supabase
      .from('tenant_references_v2')
      .update(updateData)
      .eq('id', reference.id)

    if (updateError) {
      console.error('Error submitting guarantor form:', updateError)
      return res.status(500).json({ error: 'Failed to submit reference' })
    }

    // Initialize sections for verification (guarantor sections)
    const existingSections = await supabase
      .from('reference_sections_v2')
      .select('id')
      .eq('reference_id', reference.id)
      .limit(1)

    if (!existingSections.data?.length) {
      await initializeSections(reference.id, true) // true = is_guarantor
    }

    // Evidence-gated section transitions for guarantor
    const { data: guarantorSections } = await supabase
      .from('reference_sections_v2')
      .select('id, section_type, section_data')
      .eq('reference_id', reference.id)
      .in('section_type', ['IDENTITY', 'ADDRESS'])

    if (guarantorSections) {
      const now = new Date().toISOString()
      for (const section of guarantorSections) {
        const baseSectionData = {
          ...(section.section_data || {}),
          submittedByGuarantor: true,
          submittedAt: now
        }

        if (section.section_type === 'IDENTITY') {
          if (identity.idDocumentUrl && !identity.idDocumentWillEmail) {
            // ID uploaded in form — mark READY
            await updateSectionStatus(section.id, {
              status: 'READY',
              sectionData: { ...baseSectionData, evidence_status: 'EVIDENCE_RECEIVED' }
            })
            console.log('[V2 GuarantorForm] ID uploaded - IDENTITY marked READY')
          } else {
            // Will email ID — keep PENDING, chase system tracks via evidence_status
            await updateSectionStatus(section.id, {
              sectionData: { ...baseSectionData, evidence_status: 'AWAITING_UPLOAD' }
            })
            console.log('[V2 GuarantorForm] ID will email - IDENTITY marked WAITING')
          }
        } else if (section.section_type === 'ADDRESS') {
          if (address.proofOfAddressUrl && !address.proofOfAddressWillEmail) {
            // Proof of address uploaded — mark READY
            await updateSectionStatus(section.id, {
              status: 'READY',
              sectionData: { ...baseSectionData, evidence_status: 'EVIDENCE_RECEIVED' }
            })
            console.log('[V2 GuarantorForm] Proof of address uploaded - ADDRESS marked READY')
          } else {
            // Will email proof of address — keep PENDING, chase system tracks via evidence_status
            await updateSectionStatus(section.id, {
              sectionData: { ...baseSectionData, evidence_status: 'AWAITING_UPLOAD' }
            })
            console.log('[V2 GuarantorForm] Proof of address will email - ADDRESS marked WAITING')
          }
        }
      }
    }

    // Create referee requests for guarantor
    // Employer reference
    if (income.employerRefEmail) {
      await createRefereeRequest(reference.id, reference.company_id, 'EMPLOYER', income.employerRefEmail, income.employerRefName)
    }

    // Accountant reference (for self-employed)
    if (income.accountantEmail) {
      await createRefereeRequest(reference.id, reference.company_id, 'ACCOUNTANT', income.accountantEmail, income.accountantName)
    }

    // INCOME evidence gate for guarantor
    const hasGuarantorIncomeReferee = !!(income.employerRefEmail || income.accountantEmail)
    const hasIncomeDocsUploaded = !!(
      income.payslipsUrl || income.taxReturnUrl || income.savingsDocUrl ||
      income.pensionDocUrl || income.rentalDocUrl
    )
    const allIncomeWillEmail = !hasIncomeDocsUploaded && (
      income.payslipsWillEmail || income.taxReturnWillEmail || income.savingsDocWillEmail ||
      income.pensionDocWillEmail || income.rentalDocWillEmail
    )

    const { data: guarantorIncSection } = await supabase
      .from('reference_sections_v2')
      .select('id, section_data')
      .eq('reference_id', reference.id)
      .eq('section_type', 'INCOME')
      .single()

    if (guarantorIncSection) {
      const now = new Date().toISOString()
      if (hasGuarantorIncomeReferee) {
        // Has referee — keep PENDING, transitions to READY when referee submits
        await updateSectionStatus(guarantorIncSection.id, {
          sectionData: {
            ...(guarantorIncSection.section_data || {}),
            evidence_status: 'AWAITING_REFEREE'
          }
        })
        console.log('[V2 GuarantorForm] Income referee created - INCOME marked WAITING')
      } else if (hasIncomeDocsUploaded) {
        // Has uploaded income docs — mark READY
        await updateSectionStatus(guarantorIncSection.id, {
          status: 'READY',
          sectionData: {
            ...(guarantorIncSection.section_data || {}),
            evidence_status: 'EVIDENCE_RECEIVED'
          }
        })
        console.log('[V2 GuarantorForm] Income docs uploaded - INCOME marked READY')
      } else if (allIncomeWillEmail) {
        // All docs will email — keep PENDING, chase system tracks via evidence_status
        await updateSectionStatus(guarantorIncSection.id, {
          sectionData: {
            ...(guarantorIncSection.section_data || {}),
            evidence_status: 'AWAITING_UPLOAD'
          }
        })
        console.log('[V2 GuarantorForm] Income docs will email - INCOME marked WAITING')
      } else {
        // No referee, no docs, no will email — keep PENDING, needs chase
        await updateSectionStatus(guarantorIncSection.id, {
          sectionData: {
            ...(guarantorIncSection.section_data || {}),
            evidence_status: 'AWAITING_EVIDENCE',
            evidence_missing_reason: 'No referee contact or income documents provided'
          }
        })
        console.log('[V2 GuarantorForm] No income evidence - INCOME marked WAITING')
      }
    }

    // Auto-trigger Credit and AML checks
    triggerAutomatedChecks(reference.id, {
      firstName: identity.firstName,
      lastName: identity.lastName,
      dateOfBirth: identity.dateOfBirth,
      address: address.line1 + (address.line2 ? ', ' + address.line2 : ''),
      postcode: address.postcode
    }).catch(err => console.error('[V2 GuarantorForm] Background checks error:', err))

    // Log activity
    await logActivity({
      referenceId: reference.id,
      action: 'FORM_SUBMITTED',
      performedBy: 'guarantor',
      performedByType: 'guarantor',
      notes: `${identity.firstName} ${identity.lastName} submitted their guarantor form`
    })

    // Also log on the parent tenant's reference
    if (reference.guarantor_for_reference_id) {
      await logActivity({
        referenceId: reference.guarantor_for_reference_id,
        action: 'GUARANTOR_FORM_SUBMITTED',
        performedBy: 'guarantor',
        performedByType: 'guarantor',
        notes: `Guarantor ${identity.firstName} ${identity.lastName} submitted their form`
      })
    }

    return res.json({
      success: true,
      message: 'Guarantor reference submitted successfully'
    })
  } catch (error) {
    console.error('Error submitting guarantor form:', error)
    return res.status(500).json({ error: 'Failed to submit reference' })
  }
})

// POST /api/v2/guarantor-form/:token/upload - Upload evidence file
router.post('/:token/upload', async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const { section, fileType, fileName, fileData } = req.body

    // Get the reference
    const reference = await getReferenceByFormToken(token)

    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    if (!reference.is_guarantor) {
      return res.status(400).json({ error: 'This is not a guarantor reference' })
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
      console.error('Error uploading file:', uploadError)
      return res.status(500).json({ error: 'Failed to upload file' })
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
        uploaded_by: 'guarantor'
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

// POST /api/v2/guarantor-form/:token/send-upload-link - Send email with upload link
router.post('/:token/send-upload-link', async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const { section, field, documentName } = req.body

    // Get the reference
    const reference = await getReferenceByFormToken(token)

    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    if (!reference.is_guarantor) {
      return res.status(400).json({ error: 'This is not a guarantor reference' })
    }

    // Get guarantor email
    const guarantorEmail = reference.tenant_email_encrypted
      ? decrypt(reference.tenant_email_encrypted)
      : null

    if (!guarantorEmail) {
      return res.status(400).json({ error: 'No email address on file' })
    }

    // Generate a unique upload token
    const uploadToken = generateToken()
    const uploadTokenHash = hash(uploadToken)

    // Store the upload token with reference to what it's for
    const { error: insertError } = await supabase
      .from('upload_links')
      .insert({
        reference_id: reference.id,
        token_hash: uploadTokenHash,
        section,
        field,
        document_name: documentName,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      })

    if (insertError) {
      console.error('Error creating upload link:', insertError)
      return res.status(500).json({ error: 'Failed to create upload link' })
    }

    // Build upload URL
    const uploadUrl = `${process.env.FRONTEND_URL || 'https://app.propertygoose.co.uk'}/upload/${uploadToken}`

    // Get company info
    const { data: companyInfo } = await supabase
      .from('companies')
      .select('*')
      .eq('id', reference.company_id)
      .maybeSingle()

    const ci = companyInfo as any
    const ciName = ci?.name || (ci?.name_encrypted ? decrypt(ci.name_encrypted) : null) || ci?.company_name || 'PropertyGoose'

    const guarantorName = reference.tenant_first_name_encrypted
      ? (decrypt(reference.tenant_first_name_encrypted) || 'there')
      : 'there'

    // Send email with upload link
    const html = await loadEmailTemplate('upload-link', {
      RecipientName: guarantorName,
      CompanyName: ciName,
      DocumentName: documentName,
      UploadUrl: uploadUrl,
      ExpiryDays: '7'
    })

    await sendEmail({
      to: guarantorEmail,
      subject: `Upload your ${documentName} - ${ciName}`,
      html
    })

    console.log(`[V2 GuarantorForm] Upload link sent to ${guarantorEmail} for ${documentName}`)

    return res.json({ success: true })
  } catch (error) {
    console.error('Error sending upload link:', error)
    return res.status(500).json({ error: 'Failed to send upload link' })
  }
})

// Helper: Create a referee request
async function createRefereeRequest(
  referenceId: string,
  companyId: string,
  refereeType: 'EMPLOYER' | 'LANDLORD' | 'ACCOUNTANT',
  email: string,
  name?: string
): Promise<void> {
  try {
    const formToken = generateToken()
    const formTokenHash = hash(formToken)

    const { error } = await supabase
      .from('referees_v2')
      .insert({
        reference_id: referenceId,
        referee_type: refereeType,
        referee_email_encrypted: encrypt(email),
        referee_name: name || null,
        form_token: formToken,
        form_token_hash: formTokenHash
      })

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

    // Get guarantor name for the referee email
    const { data: reference } = await supabase
      .from('tenant_references_v2')
      .select('tenant_first_name_encrypted, tenant_last_name_encrypted')
      .eq('id', referenceId)
      .single()

    const tenantName = reference
      ? `${decrypt(reference.tenant_first_name_encrypted) || ''} ${decrypt(reference.tenant_last_name_encrypted) || ''}`.trim()
      : 'Guarantor'

    // Build referee form URL
    const { getV2FrontendUrl } = await import('../../utils/frontendUrl')
    const frontendUrl = getV2FrontendUrl()
    const refereeTypeToPath: Record<string, string> = {
      'EMPLOYER': 'v2/employer-reference',
      'LANDLORD': 'v2/landlord-reference',
      'ACCOUNTANT': 'v2/accountant-reference'
    }
    const formUrl = `${frontendUrl}/${refereeTypeToPath[refereeType]}/${formToken}`
    const refereeName = name || 'Referee'

    // Send the appropriate email
    try {
      if (refereeType === 'EMPLOYER') {
        const { sendEmployerReferenceRequest } = await import('../../services/emailService')
        await sendEmployerReferenceRequest(email, refereeName, tenantName, formUrl, companyName, companyPhone, companyEmail, referenceId, companyLogoUrl)
      } else if (refereeType === 'ACCOUNTANT') {
        const { sendAccountantReferenceRequest } = await import('../../services/emailService')
        await sendAccountantReferenceRequest(email, refereeName, tenantName, formUrl, companyName, companyPhone, companyEmail, referenceId)
      }
      console.log(`[V2 Guarantor] Sent ${refereeType} referee email to ${email}`)
    } catch (emailError) {
      console.error(`[V2 Guarantor] Failed to send ${refereeType} referee email:`, emailError)
    }

    // Create chase item
    const sectionTypeMap: Record<string, string> = { 'EMPLOYER': 'INCOME', 'ACCOUNTANT': 'INCOME' }
    const sectionType = sectionTypeMap[refereeType]
    if (sectionType) {
      const { data: section } = await supabase
        .from('reference_sections_v2')
        .select('id')
        .eq('reference_id', referenceId)
        .eq('section_type', sectionType)
        .single()

      if (section) {
        const { createChaseItem } = await import('../../services/v2/chaseServiceV2')
        await createChaseItem(referenceId, section.id, refereeType as any, { name: refereeName, email, phone: undefined })
      }
    }

    console.log(`[V2 Guarantor] Created ${refereeType} referee request for ${email}`)
  } catch (error) {
    console.error(`Error creating referee request:`, error)
  }
}

/**
 * Auto-trigger Credit and AML checks when guarantor submits form
 */
async function triggerAutomatedChecks(
  referenceId: string,
  guarantorData: {
    firstName: string
    lastName: string
    dateOfBirth: string
    address: string
    postcode: string
  }
): Promise<void> {
  console.log(`[V2 GuarantorChecks] Starting automated checks for guarantor reference ${referenceId}`)

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
        console.log('[V2 GuarantorChecks] Creditsafe not enabled, skipping credit check')
        return null
      }

      console.log(`[V2 GuarantorChecks] Running credit check for ${guarantorData.firstName} ${guarantorData.lastName}`)
      const result = await creditsafeService.verifyIndividual({
        firstName: guarantorData.firstName,
        lastName: guarantorData.lastName,
        dateOfBirth: guarantorData.dateOfBirth,
        address: guarantorData.address,
        postcode: guarantorData.postcode
      })

      // Store result in V2 table
      try {
        await supabase.from('creditsafe_verifications_v2').insert({
          reference_id: referenceId,
          request_data_encrypted: encrypt(JSON.stringify(guarantorData)),
          response_data_encrypted: encrypt(JSON.stringify(result)),
          transaction_id: result.transactionId || null,
          risk_level: result.riskLevel,
          risk_score: result.riskScore,
          status: result.status,
          fraud_indicators: (result as any).fraudIndicators || null
        })
      } catch (storeErr) {
        console.error('[V2 GuarantorChecks] Failed to store credit result:', storeErr)
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
          ccjCount: result.countyCourtJudgments?.length || 0,
          insolvencyCount: result.insolvencies?.length || 0,
          checkedAt: new Date().toISOString()
        }
        await updateSectionStatus(creditSection.id, {
          status: 'READY',
          sectionData
        })
      }

      console.log(`[V2 GuarantorChecks] Credit check completed: ${result.status} (risk: ${result.riskLevel})`)
      return result
    })(),

    // AML/Sanctions Check
    (async () => {
      if (!sanctionsService.isEnabled()) {
        console.log('[V2 GuarantorChecks] Sanctions service not enabled, skipping AML check')
        return null
      }

      const fullName = `${guarantorData.firstName} ${guarantorData.lastName}`
      console.log(`[V2 GuarantorChecks] Running AML check for ${fullName}`)

      const result = await sanctionsService.screenTenant({
        name: fullName,
        dateOfBirth: guarantorData.dateOfBirth,
        postcode: guarantorData.postcode
      })

      // Store result in V2 table
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
        console.error('[V2 GuarantorChecks] Failed to store AML result:', storeErr)
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

      console.log(`[V2 GuarantorChecks] AML check completed: ${result.risk_level}`)
      return result
    })()
  ])

  // Log any failures
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const checkType = index === 0 ? 'Credit' : 'AML'
      console.error(`[V2 GuarantorChecks] ${checkType} check failed:`, result.reason)
    }
  })

  console.log(`[V2 GuarantorChecks] Completed automated checks for guarantor reference ${referenceId}`)
}

export default router

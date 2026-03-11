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
import { initializeSections } from '../../services/v2/sectionServiceV2'
import { sendGuarantorReferenceRequest } from '../../services/emailService'

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
      .select('name, logo_url, primary_color, button_color')
      .eq('id', reference.company_id)
      .single()

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
      depositAmount = Math.round((reference.monthly_rent / 4.33) * 5 * 100) / 100
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
        deposit_replacement_offered: depositReplacementOffered && repositIntegrationActive,
        deposit_amount: depositAmount,
        reposit_confirmed: reference.reposit_confirmed,
        // Saved form data for restoring progress
        form_data: reference.form_data || null
      },
      companyName: company?.name || 'PropertyGoose',
      companyLogo: company?.logo_url || '',
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
        previousAddresses: (residential.previousAddresses || []).map((addr: any) => ({
          line1: addr.line1,
          line2: addr.line2 || null,
          city: addr.city,
          postcode: addr.postcode,
          years: addr.years,
          months: addr.months,
          landlordEmail: addr.landlordEmail || null
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

    // Initialize sections for verification (if not already done)
    const existingSections = await supabase
      .from('reference_sections_v2')
      .select('id')
      .eq('reference_id', reference.id)
      .limit(1)

    if (!existingSections.data?.length) {
      await initializeSections(reference.id, reference.is_guarantor || false)
    }

    // Create referee requests
    // Employer reference
    if (income.employerRefEmail) {
      await createRefereeRequest(reference.id, reference.company_id, 'EMPLOYER', income.employerRefEmail, income.employerRefName)
    }

    // Accountant reference (for self-employed)
    if (income.accountantEmail) {
      await createRefereeRequest(reference.id, reference.company_id, 'ACCOUNTANT', income.accountantEmail, income.accountantName)
    }

    // Previous landlord references
    for (const addr of (residential.previousAddresses || [])) {
      if (addr.landlordEmail) {
        await createRefereeRequest(reference.id, reference.company_id, 'LANDLORD', addr.landlordEmail)
      }
    }

    // Create guarantor reference if provided
    if (guarantor && guarantor.firstName && guarantor.email) {
      await createGuarantorReference(reference, guarantor)
    }

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

    // Upload to storage
    const { error: uploadError } = await supabase
      .storage
      .from('reference-documents')
      .upload(filePath, buffer, {
        contentType: fileType,
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
        form_token_hash: formTokenHash
      })

    if (error) {
      console.error(`Error creating ${refereeType} referee request:`, error)
      return
    }

    // TODO: Send email to referee with form link
    console.log(`[V2] Created ${refereeType} referee request for ${email}, token: ${formToken}`)
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
        monthly_rent: tenantReference.monthly_rent,
        move_in_date: tenantReference.move_in_date,
        is_guarantor: true,
        guarantor_for_reference_id: tenantReference.id,
        guarantor_relationship: guarantor.relationship,
        form_token_hash: formTokenHash,
        status: 'SENT',
        sent_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating guarantor reference:', error)
      return
    }

    // Link guarantor to tenant reference
    await supabase
      .from('tenant_references_v2')
      .update({ guarantor_reference_id: guarantorRef.id })
      .eq('id', tenantReference.id)

    // Get company info for email
    const { data: company } = await supabase
      .from('companies')
      .select('name, logo_url, primary_color, phone_encrypted, email_encrypted')
      .eq('id', tenantReference.company_id)
      .single()

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

    // Send email to guarantor
    const guarantorFormUrl = `${process.env.FRONTEND_URL || 'https://app.propertygoose.co.uk'}/submit-reference-v2/${formToken}`

    // Use the guarantor email template
    await sendGuarantorReferenceRequest(
      guarantor.email,
      guarantor.firstName,
      `${tenantFirstName} ${tenantLastName}`.trim(),
      propertyAddress || 'the property',
      company?.name || 'PropertyGoose',
      company?.phone_encrypted ? decrypt(company.phone_encrypted) || '' : '',
      company?.email_encrypted ? decrypt(company.email_encrypted) || '' : '',
      guarantorFormUrl,
      guarantorRef.id,
      company?.logo_url || null,
      tenantReference.monthly_rent || undefined,
      tenantReference.rent_share || tenantReference.monthly_rent || undefined
    )

    console.log(`[V2] Created guarantor reference for ${guarantor.email}, sent email`)
  } catch (error) {
    console.error('Error creating guarantor reference:', error)
  }
}

export default router

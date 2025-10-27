import { Router } from 'express'
import { supabase } from '../config/supabase'
import crypto from 'crypto'
import multer from 'multer'
import { hash, encrypt } from '../services/encryption'

const router = Router()

// Configure multer for file uploads (store in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only PDF and images are allowed.'))
    }
  }
})

// POST /api/guarantor-references/submit/:token
// Submit guarantor form with file uploads
router.post('/submit/:token', (req, res, next) => {
  const uploadMiddleware = upload.fields([
    { name: 'id_document', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
    { name: 'proof_of_address', maxCount: 1 },
    { name: 'bank_statement', maxCount: 1 },
    { name: 'payslips', maxCount: 10 }
  ])

  uploadMiddleware(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message })
    }
    next()
  })
}, async (req, res) => {
  try {
    const { token } = req.params
    const data = req.body
    const files = req.files as { [fieldname: string]: Express.Multer.File[] }

    console.log('=== GUARANTOR SUBMISSION ===')
    console.log('Token:', token)
    console.log('Form data keys:', Object.keys(data))
    console.log('Files:', files ? Object.keys(files) : 'none')

    // Hash the token to look up the reference securely
    const tokenHash = hash(token)

    // Get tenant reference by token hash
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('id, company_id, requires_guarantor, submitted_at')
      .eq('reference_token_hash', tokenHash)
      .gte('token_expires_at', new Date().toISOString())
      .single()

    if (refError || !reference) {
      console.error('Reference lookup error:', refError)
      return res.status(404).json({ error: 'Invalid or expired reference link' })
    }

    console.log('Found reference:', reference.id)
    console.log('Requires guarantor:', reference.requires_guarantor)

    // Verify the tenant reference actually requires a guarantor
    if (!reference.requires_guarantor) {
      return res.status(400).json({ error: 'This reference does not require a guarantor' })
    }

    // Verify tenant has submitted their form
    if (!reference.submitted_at) {
      return res.status(400).json({ error: 'Tenant must submit their reference before guarantor can submit' })
    }

    // Check if guarantor has already been submitted for this reference
    const { data: existingGuarantor } = await supabase
      .from('guarantor_references')
      .select('id')
      .eq('reference_id', reference.id)
      .single()

    if (existingGuarantor) {
      return res.status(400).json({ error: 'Guarantor reference has already been submitted for this tenant' })
    }

    // Upload files to storage
    let idDocumentPath: string | null = null
    let selfiePath: string | null = null
    let proofOfAddressPath: string | null = null
    let bankStatementPath: string | null = null
    const payslipPaths: string[] = []

    // Upload ID document
    if (files.id_document && files.id_document[0]) {
      const file = files.id_document[0]
      const fileExt = file.originalname.split('.').pop()
      const fileName = `${reference.id}/guarantor/id_document/${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('tenant-documents')
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        })

      if (uploadError) {
        console.error('ID document upload error:', uploadError)
        throw new Error(`Failed to upload ID document: ${uploadError.message}`)
      }

      idDocumentPath = fileName
      console.log('Uploaded ID document:', idDocumentPath)
    }

    // Upload selfie
    if (files.selfie && files.selfie[0]) {
      const file = files.selfie[0]
      const fileExt = file.originalname.split('.').pop()
      const fileName = `${reference.id}/guarantor/selfie/${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('tenant-documents')
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        })

      if (uploadError) {
        console.error('Selfie upload error:', uploadError)
        throw new Error(`Failed to upload selfie: ${uploadError.message}`)
      }

      selfiePath = fileName
      console.log('Uploaded selfie:', selfiePath)
    }

    // Upload proof of address
    if (files.proof_of_address && files.proof_of_address[0]) {
      const file = files.proof_of_address[0]
      const fileExt = file.originalname.split('.').pop()
      const fileName = `${reference.id}/guarantor/proof_of_address/${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('tenant-documents')
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        })

      if (uploadError) {
        console.error('Proof of address upload error:', uploadError)
        throw new Error(`Failed to upload proof of address: ${uploadError.message}`)
      }

      proofOfAddressPath = fileName
      console.log('Uploaded proof of address:', proofOfAddressPath)
    }

    // Upload bank statement
    if (files.bank_statement && files.bank_statement[0]) {
      const file = files.bank_statement[0]
      const fileExt = file.originalname.split('.').pop()
      const fileName = `${reference.id}/guarantor/bank_statement/${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('tenant-documents')
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        })

      if (uploadError) {
        console.error('Bank statement upload error:', uploadError)
        throw new Error(`Failed to upload bank statement: ${uploadError.message}`)
      }

      bankStatementPath = fileName
      console.log('Uploaded bank statement:', bankStatementPath)
    }

    // Upload payslips
    if (files.payslips) {
      for (const file of files.payslips) {
        const fileExt = file.originalname.split('.').pop()
        const fileName = `${reference.id}/guarantor/payslips/${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('tenant-documents')
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false
          })

        if (uploadError) {
          console.error('Payslip upload error:', uploadError)
          throw new Error(`Failed to upload ${file.originalname}: ${uploadError.message}`)
        }

        payslipPaths.push(fileName)
        console.log('Uploaded payslip:', fileName)
      }
    }

    // Build guarantor reference insert object with ALL fields from schema
    const guarantorData: any = {
      reference_id: reference.id,

      // Personal Information (encrypted)
      guarantor_first_name_encrypted: encrypt(data.first_name),
      guarantor_last_name_encrypted: encrypt(data.last_name),
      middle_name_encrypted: encrypt(data.middle_name || ''),
      date_of_birth_encrypted: encrypt(data.date_of_birth),
      contact_number_encrypted: encrypt(data.contact_number),
      email_encrypted: encrypt(data.email),
      nationality_encrypted: encrypt(data.nationality || ''),

      // Relationship to Tenant
      relationship_to_tenant: data.relationship_to_tenant,

      // ID Verification
      id_document_type: data.id_document_type || null,
      id_document_path: idDocumentPath,
      selfie_path: selfiePath,

      // Current Address (encrypted)
      current_address_line1_encrypted: encrypt(data.current_address_line1),
      current_address_line2_encrypted: encrypt(data.current_address_line2 || ''),
      current_city_encrypted: encrypt(data.current_city),
      current_postcode_encrypted: encrypt(data.current_postcode),
      current_country_encrypted: encrypt(data.current_country || ''),
      time_at_address_years: data.time_at_address_years || null,
      time_at_address_months: data.time_at_address_months || null,
      proof_of_address_path: proofOfAddressPath,

      // Home Ownership Status
      home_ownership_status: data.home_ownership_status || null,

      // Employment & Income Information
      employment_status: data.employment_status,

      // If Employed
      employer_name_encrypted: encrypt(data.employer_name || ''),
      job_title_encrypted: encrypt(data.job_title || ''),
      employment_start_date: data.employment_start_date || null,
      annual_income_encrypted: encrypt(data.annual_income ? String(data.annual_income) : ''),
      employment_contract_type: data.employment_contract_type || null,

      // If Self-Employed
      business_name_encrypted: encrypt(data.business_name || ''),
      nature_of_business_encrypted: encrypt(data.nature_of_business || ''),
      years_trading: data.years_trading || null,
      annual_turnover_encrypted: encrypt(data.annual_turnover ? String(data.annual_turnover) : ''),

      // If Retired
      pension_amount_encrypted: encrypt(data.pension_amount ? String(data.pension_amount) : ''),
      pension_frequency: data.pension_frequency || null,

      // Additional Income
      other_income_source_encrypted: encrypt(data.other_income_source || ''),
      other_income_amount_encrypted: encrypt(data.other_income_amount ? String(data.other_income_amount) : ''),

      // Savings & Assets
      savings_amount_encrypted: encrypt(data.savings_amount ? String(data.savings_amount) : ''),
      property_value_encrypted: encrypt(data.property_value ? String(data.property_value) : ''),
      other_assets_encrypted: encrypt(data.other_assets || ''),

      // Financial Obligations
      monthly_mortgage_rent_encrypted: encrypt(data.monthly_mortgage_rent ? String(data.monthly_mortgage_rent) : ''),
      other_monthly_commitments_encrypted: encrypt(data.other_monthly_commitments ? String(data.other_monthly_commitments) : ''),
      total_monthly_expenditure_encrypted: encrypt(data.total_monthly_expenditure ? String(data.total_monthly_expenditure) : ''),

      // Credit & Financial History
      adverse_credit: data.adverse_credit || false,
      adverse_credit_details_encrypted: encrypt(data.adverse_credit_details || ''),

      // Bank Details
      bank_statement_path: bankStatementPath,

      // Previous Guarantor Experience
      previously_acted_as_guarantor: data.previously_acted_as_guarantor || false,
      previous_guarantor_details_encrypted: encrypt(data.previous_guarantor_details || ''),

      // Understanding & Consent
      understands_obligations: data.understands_obligations || false,
      willing_to_pay_rent: data.willing_to_pay_rent || false,
      willing_to_pay_damages: data.willing_to_pay_damages || false,
      consent_signature: data.consent_signature || null,
      consent_signature_name: data.consent_signature_name || null,
      consent_date: data.consent_date || null,

      // Additional Information
      additional_comments_encrypted: encrypt(data.additional_comments || ''),

      // Submission tracking
      submitted_at: new Date().toISOString()
    }

    console.log('Inserting guarantor reference...')

    // Insert guarantor reference into database
    const { data: guarantorReference, error: insertError } = await supabase
      .from('guarantor_references')
      .insert(guarantorData)
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return res.status(400).json({ error: insertError.message })
    }

    console.log('Guarantor reference created successfully:', guarantorReference.id)

    res.json({
      message: 'Guarantor reference submitted successfully',
      guarantor_reference_id: guarantorReference.id,
      id_document_path: idDocumentPath,
      selfie_path: selfiePath,
      proof_of_address_path: proofOfAddressPath,
      bank_statement_path: bankStatementPath,
      payslip_paths: payslipPaths
    })
  } catch (error: any) {
    console.error('Guarantor submission error:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router

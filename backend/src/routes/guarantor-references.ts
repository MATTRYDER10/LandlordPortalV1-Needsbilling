import { Router } from 'express'
import { supabase } from '../config/supabase'
import crypto from 'crypto'
import multer from 'multer'
import { hash, encrypt } from '../services/encryption'

const router = Router()

// GET /api/guarantor-references/view/:token
// View guarantor reference details by token
router.get('/view/:token', async (req, res) => {
  try {
    const { token } = req.params
    const tokenHash = hash(token)
    const { decrypt } = await import('../services/encryption')

    // Get guarantor reference by token hash with tenant reference details
    const { data: guarantorRef, error: refError } = await supabase
      .from('guarantor_references')
      .select(`
        *,
        tenant_references!inner(
          tenant_first_name_encrypted,
          tenant_last_name_encrypted,
          property_address_encrypted,
          company_id,
          companies!inner(name_encrypted, logo_url, primary_color, button_color)
        )
      `)
      .eq('reference_token_hash', tokenHash)
      .gte('token_expires_at', new Date().toISOString())
      .single()

    if (refError || !guarantorRef) {
      console.error('Guarantor reference fetch error:', refError)
      return res.status(404).json({ error: 'Invalid or expired reference link' })
    }

    // Return guarantor reference data with tenant and property info
    res.json({
      id: guarantorRef.id,
      reference_id: guarantorRef.reference_id,
      status: guarantorRef.status,
      submitted_at: guarantorRef.submitted_at,
      relationship_to_tenant: guarantorRef.relationship_to_tenant,
      tenant_first_name: guarantorRef.tenant_references?.tenant_first_name_encrypted
        ? decrypt(guarantorRef.tenant_references.tenant_first_name_encrypted)
        : '',
      tenant_last_name: guarantorRef.tenant_references?.tenant_last_name_encrypted
        ? decrypt(guarantorRef.tenant_references.tenant_last_name_encrypted)
        : '',
      property_address: guarantorRef.tenant_references?.property_address_encrypted
        ? decrypt(guarantorRef.tenant_references.property_address_encrypted)
        : '',
      companies: guarantorRef.tenant_references?.companies || null
    })
  } catch (error: any) {
    console.error('Error fetching guarantor reference:', error)
    res.status(500).json({ error: error.message })
  }
})

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

// POST /api/guarantor-references/upload/:token
// Upload files incrementally as guarantor progresses through form
router.post('/upload/:token', (req, res, next) => {
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
    const tokenHash = hash(token)
    const files = req.files as { [fieldname: string]: Express.Multer.File[] }

    // Verify guarantor reference exists
    const { data: guarantorRef, error: refError } = await supabase
      .from('guarantor_references')
      .select('id')
      .eq('reference_token_hash', tokenHash)
      .gte('token_expires_at', new Date().toISOString())
      .single()

    if (refError || !guarantorRef) {
      return res.status(404).json({ error: 'Invalid or expired reference link' })
    }

    const uploadedPaths: any = {}

    // Upload files to Supabase Storage
    if (files.id_document && files.id_document[0]) {
      const file = files.id_document[0]
      const filename = `${guarantorRef.id}_id_${Date.now()}.${file.mimetype.split('/')[1]}`
      const { error: uploadError } = await supabase.storage
        .from('reference-documents')
        .upload(`guarantor-documents/${guarantorRef.id}/${filename}`, file.buffer, {
          contentType: file.mimetype
        })
      if (!uploadError) {
        uploadedPaths.id_document = `guarantor-documents/${guarantorRef.id}/${filename}`
      }
    }

    if (files.selfie && files.selfie[0]) {
      const file = files.selfie[0]
      const filename = `${guarantorRef.id}_selfie_${Date.now()}.${file.mimetype.split('/')[1]}`
      const { error: uploadError } = await supabase.storage
        .from('reference-documents')
        .upload(`guarantor-documents/${guarantorRef.id}/${filename}`, file.buffer, {
          contentType: file.mimetype
        })
      if (!uploadError) {
        uploadedPaths.selfie = `guarantor-documents/${guarantorRef.id}/${filename}`
      }
    }

    if (files.proof_of_address && files.proof_of_address[0]) {
      const file = files.proof_of_address[0]
      const filename = `${guarantorRef.id}_proof_of_address_${Date.now()}.${file.mimetype.split('/')[1]}`
      const { error: uploadError } = await supabase.storage
        .from('reference-documents')
        .upload(`guarantor-documents/${guarantorRef.id}/${filename}`, file.buffer, {
          contentType: file.mimetype
        })
      if (!uploadError) {
        uploadedPaths.proof_of_address = `guarantor-documents/${guarantorRef.id}/${filename}`
      }
    }

    if (files.bank_statement && files.bank_statement[0]) {
      const file = files.bank_statement[0]
      const filename = `${guarantorRef.id}_bank_statement_${Date.now()}.${file.mimetype.split('/')[1]}`
      const { error: uploadError } = await supabase.storage
        .from('reference-documents')
        .upload(`guarantor-documents/${guarantorRef.id}/${filename}`, file.buffer, {
          contentType: file.mimetype
        })
      if (!uploadError) {
        uploadedPaths.bank_statement = `guarantor-documents/${guarantorRef.id}/${filename}`
      }
    }

    if (files.payslips && files.payslips.length > 0) {
      const payslipPaths = []
      for (const [index, file] of files.payslips.entries()) {
        const filename = `${guarantorRef.id}_payslip_${index}_${Date.now()}.${file.mimetype.split('/')[1]}`
        const { error: uploadError } = await supabase.storage
          .from('reference-documents')
          .upload(`guarantor-documents/${guarantorRef.id}/${filename}`, file.buffer, {
            contentType: file.mimetype
          })
        if (!uploadError) {
          payslipPaths.push(`guarantor-documents/${guarantorRef.id}/${filename}`)
        }
      }
      if (payslipPaths.length > 0) {
        uploadedPaths.payslips = payslipPaths
      }
    }

    res.json(uploadedPaths)
  } catch (error: any) {
    console.error('Guarantor file upload error:', error)
    res.status(500).json({ error: error.message })
  }
})

// POST /api/guarantor-references/submit/:token
// Submit guarantor form (files already uploaded via upload endpoint)
router.post('/submit/:token', async (req, res) => {
  try {
    const { token } = req.params
    const data = req.body

    console.log('=== GUARANTOR SUBMISSION ===')
    console.log('Token:', token)
    console.log('Form data keys:', Object.keys(data))

    // Hash the token to look up the reference securely
    const tokenHash = hash(token)

    // Get guarantor reference by token hash, with tenant reference details
    const { data: guarantorRef, error: refError } = await supabase
      .from('guarantor_references')
      .select(`
        id,
        reference_id,
        submitted_at,
        tenant_references!inner(id, company_id, requires_guarantor, submitted_at)
      `)
      .eq('reference_token_hash', tokenHash)
      .gte('token_expires_at', new Date().toISOString())
      .single()

    if (refError || !guarantorRef) {
      console.error('Guarantor reference lookup error:', refError)
      return res.status(404).json({ error: 'Invalid or expired reference link' })
    }

    console.log('Found guarantor reference:', guarantorRef.id)
    console.log('Tenant reference:', guarantorRef.reference_id)

    // Check if guarantor has already been submitted
    if (guarantorRef.submitted_at) {
      return res.status(400).json({ error: 'Guarantor reference has already been submitted' })
    }

    // Files have already been uploaded via the incremental upload endpoint
    // We just need to use the paths from the form data

    // Build guarantor reference update object with ALL fields from schema
    const guarantorData: any = {

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
      id_document_path: data.id_document_path || null,
      selfie_path: data.selfie_path || null,

      // Current Address (encrypted)
      current_address_line1_encrypted: encrypt(data.current_address_line1),
      current_address_line2_encrypted: encrypt(data.current_address_line2 || ''),
      current_city_encrypted: encrypt(data.current_city),
      current_postcode_encrypted: encrypt(data.current_postcode),
      current_country_encrypted: encrypt(data.current_country || ''),
      time_at_address_years: data.time_at_address_years || null,
      time_at_address_months: data.time_at_address_months || null,
      proof_of_address_path: data.proof_of_address_path || null,

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
      bank_statement_path: data.bank_statement_path || null,

      // Previous Guarantor Experience
      previously_acted_as_guarantor: data.previously_acted_as_guarantor || false,
      previous_guarantor_details_encrypted: encrypt(data.previous_guarantor_details || ''),

      // Understanding & Consent
      understands_obligations: data.understands_obligations || false,
      willing_to_pay_rent: data.willing_to_pay_rent || false,
      willing_to_pay_damages: data.willing_to_pay_damages || false,
      consent_signature: data.consent_signature || null,
      consent_signature_name: data.consent_signature_name || null,
      consent_printed_name_encrypted: encrypt(data.consent_printed_name || ''),
      consent_date: data.consent_date || null,

      // Additional Information
      additional_comments_encrypted: encrypt(data.additional_comments || ''),

      // Submission tracking
      submitted_at: new Date().toISOString()
    }

    console.log('Updating guarantor reference...')

    // Update guarantor reference in database
    const { data: guarantorReference, error: updateError } = await supabase
      .from('guarantor_references')
      .update(guarantorData)
      .eq('id', guarantorRef.id)
      .select()
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
      return res.status(400).json({ error: updateError.message })
    }

    console.log('Guarantor reference submitted successfully:', guarantorReference.id)

    // Determine if guarantor should go to pending_verification immediately
    // This happens when: retired + owns home outright (no employer/landlord refs needed)
    const isRetired = data.employment_status === 'retired'
    const ownsHomeOutright = data.home_ownership_status === 'owner'

    if (isRetired && ownsHomeOutright) {
      console.log('Guarantor is retired and owns home outright - moving to pending_verification')
      await supabase
        .from('guarantor_references')
        .update({ status: 'pending_verification' })
        .eq('id', guarantorRef.id)
    } else {
      console.log('Guarantor requires additional references - staying in default status')
    }

    res.json({
      message: 'Guarantor reference submitted successfully',
      guarantor_reference_id: guarantorReference.id
    })
  } catch (error: any) {
    console.error('Guarantor submission error:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router

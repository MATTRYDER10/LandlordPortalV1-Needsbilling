import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import crypto from 'crypto'
import multer from 'multer'
import { sendTenantReferenceRequest, sendEmployerReferenceRequest, sendLandlordReferenceRequest, sendAgentReferenceRequest, sendAccountantReferenceRequest } from '../services/emailService'

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

// Get all references for company
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .single()

    if (!companyUser) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Get all references for the company (excluding child references)
    const { data: references, error } = await supabase
      .from('tenant_references')
      .select('*')
      .eq('company_id', companyUser.company_id)
      .is('parent_reference_id', null) // Only get top-level references (no children)
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // For each parent reference, count the children
    const referencesWithCount = await Promise.all(references.map(async (ref) => {
      if (ref.is_group_parent) {
        const { count } = await supabase
          .from('tenant_references')
          .select('*', { count: 'exact', head: true })
          .eq('parent_reference_id', ref.id)

        return { ...ref, tenant_count: count || 0 }
      }
      return ref
    }))

    res.json({ references: referencesWithCount })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get single reference
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const referenceId = req.params.id

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .single()

    if (!companyUser) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Get reference
    const { data: reference, error } = await supabase
      .from('tenant_references')
      .select('*')
      .eq('id', referenceId)
      .eq('company_id', companyUser.company_id)
      .single()

    if (error || !reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Get documents for this reference
    const { data: documents } = await supabase
      .from('reference_documents')
      .select('*')
      .eq('reference_id', referenceId)

    // Get landlord reference if exists
    const { data: landlordReference } = await supabase
      .from('landlord_references')
      .select('*')
      .eq('reference_id', referenceId)
      .single()

    // Get agent reference if exists
    const { data: agentReference } = await supabase
      .from('agent_references')
      .select('*')
      .eq('reference_id', referenceId)
      .single()

    // Get employer reference if exists
    const { data: employerReference } = await supabase
      .from('employer_references')
      .select('*')
      .eq('reference_id', referenceId)
      .single()

    // Get accountant reference if exists
    const { data: accountantReference } = await supabase
      .from('accountant_references')
      .select('*')
      .eq('tenant_reference_id', referenceId)
      .single()

    // Check if this is a parent reference and fetch children
    let childReferences = null
    if (reference.is_group_parent) {
      const { data: children } = await supabase
        .from('tenant_references')
        .select('*')
        .eq('parent_reference_id', referenceId)
        .order('tenant_position', { ascending: true })

      childReferences = children
    }

    // Check if this is a child reference and fetch parent + siblings
    let parentReference = null
    let siblingReferences = null
    if (reference.parent_reference_id) {
      const { data: parent } = await supabase
        .from('tenant_references')
        .select('*')
        .eq('id', reference.parent_reference_id)
        .single()

      parentReference = parent

      const { data: siblings } = await supabase
        .from('tenant_references')
        .select('*')
        .eq('parent_reference_id', reference.parent_reference_id)
        .neq('id', referenceId)
        .order('tenant_position', { ascending: true })

      siblingReferences = siblings
    }

    res.json({
      reference,
      documents,
      landlordReference,
      agentReference,
      employerReference,
      accountantReference,
      childReferences,
      parentReference,
      siblingReferences
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Create new reference
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    console.log('Creating reference for user:', userId)

    const {
      tenant_first_name,
      tenant_last_name,
      tenant_email,
      tenant_phone,
      tenants, // New: array of tenants for multi-tenant properties
      property_address,
      property_city,
      property_postcode,
      monthly_rent,
      move_in_date,
      term_years,
      term_months,
      notes
    } = req.body

    // Get user's company
    console.log('Looking up company for user:', userId)
    const { data: companyUser, error: companyError } = await supabase
      .from('company_users')
      .select('company_id, companies:company_id(name)')
      .eq('user_id', userId)
      .single()

    console.log('Company lookup result:', companyUser, 'Error:', companyError)

    if (!companyUser) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const companyName = (companyUser as any).companies?.name || 'Your agent'

    // Check if this is a multi-tenant reference
    if (tenants && Array.isArray(tenants) && tenants.length > 1) {
      // Multi-tenant flow
      console.log('Creating multi-tenant reference with', tenants.length, 'tenants')

      // Validate property fields
      if (!property_address || !monthly_rent) {
        return res.status(400).json({ error: 'Missing required property fields' })
      }

      // Validate all tenants have required fields and rent shares sum to monthly rent
      const totalRentShare = tenants.reduce((sum, t) => sum + (parseFloat(t.rent_share) || 0), 0)
      if (Math.abs(totalRentShare - parseFloat(monthly_rent)) > 0.01) {
        return res.status(400).json({ error: 'Rent shares must sum to total monthly rent' })
      }

      for (const tenant of tenants) {
        if (!tenant.first_name || !tenant.last_name || !tenant.email || !tenant.rent_share) {
          return res.status(400).json({ error: 'Each tenant must have first name, last name, email, and rent share' })
        }
      }

      // Token expires in 30 days
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)

      // Create parent reference (placeholder for the property)
      const { data: parentReference, error: parentError } = await supabase
        .from('tenant_references')
        .insert({
          company_id: companyUser.company_id,
          created_by: userId,
          tenant_first_name: 'Multi-Tenant',
          tenant_last_name: 'Property',
          tenant_email: tenants[0].email, // Use first tenant's email as primary
          tenant_phone: tenants[0].phone || null,
          property_address,
          property_city,
          property_postcode,
          monthly_rent,
          move_in_date,
          term_years: term_years || 0,
          term_months: term_months || 0,
          notes,
          reference_token: crypto.randomBytes(32).toString('hex'), // Parent token (not used for form)
          token_expires_at: expiresAt.toISOString(),
          status: 'pending',
          is_group_parent: true
        })
        .select()
        .single()

      if (parentError) {
        return res.status(400).json({ error: parentError.message })
      }

      // Create child references for each tenant
      const childReferences = []
      for (let i = 0; i < tenants.length; i++) {
        const tenant = tenants[i]
        const token = crypto.randomBytes(32).toString('hex')

        const { data: childReference, error: childError } = await supabase
          .from('tenant_references')
          .insert({
            company_id: companyUser.company_id,
            created_by: userId,
            parent_reference_id: parentReference.id,
            tenant_position: i + 1,
            tenant_first_name: tenant.first_name,
            tenant_last_name: tenant.last_name,
            tenant_email: tenant.email,
            tenant_phone: tenant.phone || null,
            property_address,
            property_city,
            property_postcode,
            monthly_rent, // Keep full rent for context
            rent_share: tenant.rent_share,
            move_in_date,
            term_years: term_years || 0,
            term_months: term_months || 0,
            notes,
            reference_token: token,
            token_expires_at: expiresAt.toISOString(),
            status: 'pending'
          })
          .select()
          .single()

        if (childError) {
          console.error('Error creating child reference:', childError)
          continue
        }

        childReferences.push(childReference)

        // Send email to each tenant
        const tenantUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/submit-reference/${token}`
        try {
          await sendTenantReferenceRequest(
            tenant.email,
            `${tenant.first_name} ${tenant.last_name}`,
            tenantUrl,
            companyName
          )
          console.log('Email sent successfully to tenant:', tenant.email)
        } catch (emailError: any) {
          console.error('Failed to send email to', tenant.email, emailError)
        }
      }

      res.json({
        reference: parentReference,
        childReferences,
        message: `Reference created successfully for ${tenants.length} tenants`
      })

    } else {
      // Single tenant flow (backward compatible)
      // Validate required fields
      if (!tenant_first_name || !tenant_last_name || !tenant_email || !property_address) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      // Generate unique token for tenant
      const token = crypto.randomBytes(32).toString('hex')

      // Token expires in 30 days
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)

      // Create reference
      const { data: reference, error } = await supabase
        .from('tenant_references')
        .insert({
          company_id: companyUser.company_id,
          created_by: userId,
          tenant_first_name,
          tenant_last_name,
          tenant_email,
          tenant_phone,
          property_address,
          property_city,
          property_postcode,
          monthly_rent,
          move_in_date,
          term_years: term_years || 0,
          term_months: term_months || 0,
          notes,
          reference_token: token,
          token_expires_at: expiresAt.toISOString(),
          status: 'pending'
        })
        .select()
        .single()

      if (error) {
        return res.status(400).json({ error: error.message })
      }

      // Send email to tenant with link to submit their information
      const tenantUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/submit-reference/${token}`

      try {
        await sendTenantReferenceRequest(
          tenant_email,
          `${tenant_first_name} ${tenant_last_name}`,
          tenantUrl,
          companyName
        )
        console.log('Email sent successfully to tenant:', tenant_email)
      } catch (emailError: any) {
        console.error('Failed to send email:', emailError)
        // Don't fail the request if email fails, just log it
      }

      res.json({
        reference,
        tenantUrl,
        message: 'Reference created successfully'
      })
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Update reference
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const referenceId = req.params.id
    const updates = req.body

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .single()

    if (!companyUser) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Update reference
    const { data: reference, error } = await supabase
      .from('tenant_references')
      .update(updates)
      .eq('id', referenceId)
      .eq('company_id', companyUser.company_id)
      .select()
      .single()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json({ reference, message: 'Reference updated successfully' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Delete reference
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const referenceId = req.params.id

    // Get user's company and role
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id, role')
      .eq('user_id', userId)
      .single()

    if (!companyUser) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Check if user is owner or admin
    if (companyUser.role !== 'owner' && companyUser.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }

    // Delete reference
    const { error } = await supabase
      .from('tenant_references')
      .delete()
      .eq('id', referenceId)
      .eq('company_id', companyUser.company_id)

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json({ message: 'Reference deleted successfully' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Tenant submits their information (public route)
router.post('/submit/:token', async (req, res) => {
  try {
    const { token } = req.params
    const data = req.body

    // Get reference by token
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('*')
      .eq('reference_token', token)
      .gte('token_expires_at', new Date().toISOString())
      .single()

    if (refError || !reference) {
      return res.status(404).json({ error: 'Invalid or expired reference link' })
    }

    // Check if already submitted
    if (reference.submitted_at) {
      return res.status(400).json({ error: 'Reference has already been submitted' })
    }

    // Build update object with all new fields
    const updateData: any = {
      // Personal Details (Page 2)
      tenant_first_name: data.first_name,
      tenant_last_name: data.last_name,
      middle_name: data.middle_name || null,
      date_of_birth: data.date_of_birth || null,
      contact_number: data.contact_number || null,
      nationality: data.nationality || null,

      // ID Document (Page 1)
      id_document_type: data.id_document_type || null,
      id_document_path: data.id_document_path || null,
      selfie_path: data.selfie_path || null,

      // Current Address (Page 4)
      current_address_line1: data.current_address_line1 || null,
      current_address_line2: data.current_address_line2 || null,
      current_city: data.current_city || null,
      current_postcode: data.current_postcode || null,
      current_country: data.current_country || null,
      proof_of_address_path: data.proof_of_address_path || null,

      // Financial Information - Income Sources (Page 6)
      income_regular_employment: data.income_regular_employment || false,
      income_self_employed: data.income_self_employed || false,
      income_benefits: data.income_benefits || false,
      income_savings_pension_investments: data.income_savings_pension_investments || false,
      income_student: data.income_student || false,
      income_unemployed: data.income_unemployed || false,

      // Employment Details (Page 6)
      employment_contract_type: data.employment_contract_type || null,
      employment_start_date: data.employment_start_date || null,
      employment_is_hourly: data.employment_is_hourly || false,
      employment_hours_per_month: data.employment_hours_per_month || null,
      employment_salary_amount: data.employment_salary_amount || null,
      employment_company_name: data.employment_company_name || null,
      employment_company_address_line1: data.employment_company_address_line1 || null,
      employment_company_address_line2: data.employment_company_address_line2 || null,
      employment_company_city: data.employment_company_city || null,
      employment_company_postcode: data.employment_company_postcode || null,
      employment_company_country: data.employment_company_country || null,
      employment_job_title: data.employment_job_title || null,
      payslip_files: data.payslip_files || [],

      // Employer Reference Contact (Page 6)
      employer_ref_position: data.employer_ref_position || null,
      employer_ref_name: data.employer_ref_name || null,
      employer_ref_email: data.employer_ref_email || null,
      employer_ref_phone: data.employer_ref_phone || null,

      // Self-Employed Details (Page 6)
      self_employed_business_name: data.self_employed_business_name || null,
      self_employed_start_date: data.self_employed_start_date || null,
      self_employed_nature_of_business: data.self_employed_nature_of_business || null,
      self_employed_annual_income: data.self_employed_annual_income || null,

      // Accountant Details (Page 6)
      accountant_name: data.accountant_name || null,
      accountant_contact_name: data.accountant_contact_name || null,
      accountant_email: data.accountant_email || null,
      accountant_phone: data.accountant_phone || null,

      // Additional Income (Page 7)
      has_additional_income: data.has_additional_income || false,
      additional_income_source: data.additional_income_source || null,
      additional_income_amount: data.additional_income_amount || null,
      additional_income_frequency: data.additional_income_frequency || null,

      // Adverse Credit (Page 8)
      has_adverse_credit: data.has_adverse_credit || false,
      adverse_credit_details: data.adverse_credit_details || null,

      // Tenant Details (Page 9)
      is_smoker: data.is_smoker,
      has_pets: data.has_pets || false,
      pet_details: data.pet_details || null,
      marital_status: data.marital_status || null,
      number_of_dependants: data.number_of_dependants || 0,
      dependants_details: data.dependants_details || null,

      // Previous Landlord Reference (Page 10)
      reference_type: data.reference_type || 'landlord',
      previous_landlord_name: data.previous_landlord_name || null,
      previous_landlord_email: data.previous_landlord_email || null,
      previous_landlord_phone: data.previous_landlord_phone || null,
      previous_rental_address_line1: data.previous_rental_address_line1 || null,
      previous_rental_address_line2: data.previous_rental_address_line2 || null,
      previous_rental_city: data.previous_rental_city || null,
      previous_rental_postcode: data.previous_rental_postcode || null,
      previous_rental_country: data.previous_rental_country || null,
      tenancy_years: data.tenancy_years || 0,
      tenancy_months: data.tenancy_months || 0,

      // Submission tracking
      submitted_at: new Date().toISOString(),
      status: 'in_progress'
    }

    // Update reference with tenant's information
    const { data: updatedReference, error } = await supabase
      .from('tenant_references')
      .update(updateData)
      .eq('id', reference.id)
      .select()
      .single()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // Send email to employer if employer reference details are provided
    if (data.employer_ref_email && data.employer_ref_name) {
      try {
        const employerReferenceUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/employer-reference/${updatedReference.id}`

        await sendEmployerReferenceRequest(
          data.employer_ref_email,
          data.employer_ref_name,
          `${data.first_name} ${data.last_name}`,
          employerReferenceUrl
        )
        console.log('Employer reference email sent successfully to:', data.employer_ref_email)
      } catch (emailError: any) {
        console.error('Failed to send employer reference email:', emailError)
        // Don't fail the request if email fails, just log it
      }
    }

    // Send email to landlord/agent if rental reference details are provided
    if (data.previous_landlord_email && data.previous_landlord_name) {
      try {
        const referenceType = data.reference_type || 'landlord'

        if (referenceType === 'agent') {
          const agentReferenceUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/agent-reference/${updatedReference.id}`

          await sendAgentReferenceRequest(
            data.previous_landlord_email,
            data.previous_landlord_name,
            `${data.first_name} ${data.last_name}`,
            agentReferenceUrl
          )
          console.log('Agent reference email sent successfully to:', data.previous_landlord_email)
        } else {
          const landlordReferenceUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/landlord-reference/${updatedReference.id}`

          await sendLandlordReferenceRequest(
            data.previous_landlord_email,
            data.previous_landlord_name,
            `${data.first_name} ${data.last_name}`,
            landlordReferenceUrl
          )
          console.log('Landlord reference email sent successfully to:', data.previous_landlord_email)
        }
      } catch (emailError: any) {
        console.error('Failed to send landlord/agent reference email:', emailError)
        // Don't fail the request if email fails, just log it
      }
    }

    // Send email to accountant if self-employed and accountant details are provided
    if (data.income_self_employed && data.accountant_email && data.accountant_contact_name) {
      try {
        // Create accountant reference record with unique token
        const accountantToken = crypto.randomBytes(32).toString('hex')
        const { data: accountantRef, error: accountantError } = await supabase
          .from('accountant_references')
          .insert({
            tenant_reference_id: updatedReference.id,
            token: accountantToken,
            accountant_firm_name: data.accountant_name || '',
            accountant_contact_name: data.accountant_contact_name,
            accountant_email: data.accountant_email,
            accountant_phone: data.accountant_phone || null,
          })
          .select()
          .single()

        if (accountantError) {
          console.error('Failed to create accountant reference:', accountantError)
        } else {
          const accountantReferenceUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/accountant-reference/${accountantToken}`

          await sendAccountantReferenceRequest(
            data.accountant_email,
            data.accountant_contact_name,
            `${data.first_name} ${data.last_name}`,
            accountantReferenceUrl
          )
          console.log('Accountant reference email sent successfully to:', data.accountant_email)
        }
      } catch (emailError: any) {
        console.error('Failed to send accountant reference email:', emailError)
        // Don't fail the request if email fails, just log it
      }
    }

    res.json({
      message: 'Reference submitted successfully',
      reference: updatedReference
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Test route
router.post('/upload-test/:token', async (req, res) => {
  res.json({ message: 'Test route works', token: req.params.token })
})

// Upload files for a reference (public route - for tenant) - MUST be before /view/:token
router.post('/upload/:token', (req, res, next) => {
  const uploadMiddleware = upload.fields([
    { name: 'id_document', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
    { name: 'proof_of_address', maxCount: 1 },
    { name: 'bank_statements', maxCount: 10 },
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
    const files = req.files as { [fieldname: string]: Express.Multer.File[] }

    // Get reference by token
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('id, company_id, reference_token')
      .eq('reference_token', token)
      .gte('token_expires_at', new Date().toISOString())
      .single()

    if (refError || !reference) {
      return res.status(404).json({ error: 'Invalid or expired reference link' })
    }

    let idDocumentPath: string | null = null
    let selfiePath: string | null = null
    let proofOfAddressPath: string | null = null
    const bankStatementPaths: string[] = []
    const payslipPaths: string[] = []

    // Upload ID document
    if (files.id_document && files.id_document[0]) {
      const file = files.id_document[0]
      const fileExt = file.originalname.split('.').pop()
      const fileName = `${reference.id}/id_document/${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('tenant-documents')
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        })

      if (uploadError) {
        throw new Error(`Failed to upload ID document: ${uploadError.message}`)
      }

      idDocumentPath = fileName
    }

    // Upload selfie
    if (files.selfie && files.selfie[0]) {
      const file = files.selfie[0]
      const fileExt = file.originalname.split('.').pop()
      const fileName = `${reference.id}/selfie/${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('tenant-documents')
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        })

      if (uploadError) {
        throw new Error(`Failed to upload selfie: ${uploadError.message}`)
      }

      selfiePath = fileName
    }

    // Upload proof of address
    if (files.proof_of_address && files.proof_of_address[0]) {
      const file = files.proof_of_address[0]
      const fileExt = file.originalname.split('.').pop()
      const fileName = `${reference.id}/proof_of_address/${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('tenant-documents')
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        })

      if (uploadError) {
        throw new Error(`Failed to upload proof of address: ${uploadError.message}`)
      }

      proofOfAddressPath = fileName
    }

    // Upload bank statements
    if (files.bank_statements) {
      for (const file of files.bank_statements) {
        const fileExt = file.originalname.split('.').pop()
        const fileName = `${reference.id}/bank_statements/${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('tenant-documents')
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false
          })

        if (uploadError) {
          throw new Error(`Failed to upload ${file.originalname}: ${uploadError.message}`)
        }

        bankStatementPaths.push(fileName)
      }
    }

    // Upload payslips
    if (files.payslips) {
      for (const file of files.payslips) {
        const fileExt = file.originalname.split('.').pop()
        const fileName = `${reference.id}/payslips/${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('tenant-documents')
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false
          })

        if (uploadError) {
          throw new Error(`Failed to upload ${file.originalname}: ${uploadError.message}`)
        }

        payslipPaths.push(fileName)
      }
    }

    res.json({
      message: 'Files uploaded successfully',
      id_document: idDocumentPath,
      selfie: selfiePath,
      proof_of_address: proofOfAddressPath,
      bank_statements: bankStatementPaths,
      payslips: payslipPaths
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get reference by token (public route - for tenant to view)
router.get('/view/:token', async (req, res) => {
  try {
    const { token } = req.params

    const { data: reference, error } = await supabase
      .from('tenant_references')
      .select(`
        id,
        tenant_first_name,
        tenant_last_name,
        tenant_email,
        property_address,
        property_city,
        property_postcode,
        monthly_rent,
        move_in_date,
        submitted_at,
        status,
        company_id,
        companies:company_id (
          logo_url,
          primary_color,
          button_color
        )
      `)
      .eq('reference_token', token)
      .gte('token_expires_at', new Date().toISOString())
      .single()

    if (error || !reference) {
      return res.status(404).json({ error: 'Invalid or expired reference link' })
    }

    res.json({ reference })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get company branding for a reference (public route - for landlord/employer forms)
router.get('/branding/:referenceId', async (req, res) => {
  try {
    const { referenceId } = req.params

    const { data: reference, error } = await supabase
      .from('tenant_references')
      .select(`
        company_id,
        companies:company_id (
          logo_url,
          primary_color,
          button_color
        )
      `)
      .eq('id', referenceId)
      .single()

    if (error || !reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    res.json({ branding: reference.companies })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get company branding for accountant reference by token (public route)
router.get('/accountant/branding/:token', async (req, res) => {
  try {
    const { token } = req.params

    // First, get the tenant_reference_id from the accountant_references table
    const { data: accountantRef, error: accountantError } = await supabase
      .from('accountant_references')
      .select('tenant_reference_id')
      .eq('token', token)
      .single()

    if (accountantError || !accountantRef) {
      return res.status(404).json({ error: 'Accountant reference not found' })
    }

    // Now fetch the branding using the tenant_reference_id
    const { data: reference, error } = await supabase
      .from('tenant_references')
      .select(`
        company_id,
        companies:company_id (
          logo_url,
          primary_color,
          button_color
        )
      `)
      .eq('id', accountantRef.tenant_reference_id)
      .single()

    if (error || !reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    res.json({ branding: reference.companies })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Check if landlord reference already submitted (public route)
router.get('/landlord/:referenceId/check', async (req, res) => {
  try {
    const { referenceId } = req.params

    const { data: landlordRef } = await supabase
      .from('landlord_references')
      .select('id')
      .eq('reference_id', referenceId)
      .single()

    res.json({ submitted: !!landlordRef })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Check if agent reference already submitted (public route)
router.get('/agent/:referenceId/check', async (req, res) => {
  try {
    const { referenceId } = req.params

    const { data: agentRef } = await supabase
      .from('agent_references')
      .select('id')
      .eq('reference_id', referenceId)
      .single()

    res.json({ submitted: !!agentRef })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Check if employer reference already submitted (public route)
router.get('/employer/:referenceId/check', async (req, res) => {
  try {
    const { referenceId } = req.params

    const { data: employerRef } = await supabase
      .from('employer_references')
      .select('id')
      .eq('reference_id', referenceId)
      .single()

    res.json({ submitted: !!employerRef })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Check if accountant reference already submitted (public route)
router.get('/accountant/:token/check', async (req, res) => {
  try {
    const { token } = req.params

    const { data: accountantRef } = await supabase
      .from('accountant_references')
      .select('id, submitted_at')
      .eq('token', token)
      .single()

    res.json({ submitted: !!(accountantRef && accountantRef.submitted_at) })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Landlord submits reference (public route)
router.post('/landlord/:referenceId', async (req, res) => {
  try {
    const { referenceId } = req.params
    const formData = req.body

    // Verify reference exists
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('id, status')
      .eq('id', referenceId)
      .single()

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Convert camelCase to snake_case for database
    const dbData = {
      reference_id: referenceId,
      landlord_name: formData.landlordName,
      landlord_email: formData.landlordEmail,
      landlord_phone: formData.landlordPhone,
      property_address: formData.propertyAddress,
      property_city: formData.propertyCity || null,
      property_postcode: formData.propertyPostcode || null,
      tenancy_start_date: formData.tenancyStartDate,
      tenancy_end_date: formData.tenancyEndDate,
      monthly_rent: formData.monthlyRent,
      rent_paid_on_time: formData.rentPaidOnTime,
      rent_paid_on_time_details: formData.rentPaidOnTimeDetails || null,
      property_condition: formData.propertyCondition,
      property_condition_details: formData.propertyConditionDetails || null,
      neighbour_complaints: formData.neighbourComplaints,
      neighbour_complaints_details: formData.neighbourComplaintsDetails || null,
      breach_of_tenancy: formData.breachOfTenancy,
      breach_of_tenancy_details: formData.breachOfTenancyDetails || null,
      would_rent_again: formData.wouldRentAgain,
      would_rent_again_details: formData.wouldRentAgainDetails || null,
      additional_comments: formData.additionalComments || null,
      signature_name: formData.signatureName,
      signature: formData.signature,
      date: formData.date,
      submitted_at: new Date().toISOString()
    }

    // Store landlord reference data
    const { error: insertError } = await supabase
      .from('landlord_references')
      .insert(dbData)

    if (insertError) {
      return res.status(400).json({ error: insertError.message })
    }

    // Update reference status based on required references
    const { data: tenantRef } = await supabase
      .from('tenant_references')
      .select('employer_ref_email, income_self_employed')
      .eq('id', referenceId)
      .single()

    // Check all required references
    let allReferencesSubmitted = true

    // Check employer reference if required
    if (tenantRef?.employer_ref_email) {
      const { data: employerRef } = await supabase
        .from('employer_references')
        .select('id')
        .eq('reference_id', referenceId)
        .single()

      if (!employerRef) {
        allReferencesSubmitted = false
      }
    }

    // Check accountant reference if required (self-employed)
    if (tenantRef?.income_self_employed) {
      const { data: accountantRef } = await supabase
        .from('accountant_references')
        .select('id, submitted_at')
        .eq('tenant_reference_id', referenceId)
        .single()

      if (!accountantRef || !accountantRef.submitted_at) {
        allReferencesSubmitted = false
      }
    }

    // Only mark as pending verification if all required references are submitted
    if (allReferencesSubmitted) {
      await supabase
        .from('tenant_references')
        .update({ status: 'pending_verification' })
        .eq('id', referenceId)
    }

    res.json({ message: 'Landlord reference submitted successfully' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Agent submits reference (public route)
router.post('/agent/:referenceId', async (req, res) => {
  try {
    const { referenceId } = req.params
    const formData = req.body

    // Verify reference exists
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('id, status')
      .eq('id', referenceId)
      .single()

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Convert camelCase to snake_case for database
    const dbData = {
      reference_id: referenceId,
      agent_name: formData.agentName,
      agent_email: formData.agentEmail,
      agent_phone: formData.agentPhone,
      agency_name: formData.agencyName || null,
      property_address: formData.propertyAddress,
      property_city: formData.propertyCity || null,
      property_postcode: formData.propertyPostcode || null,
      tenancy_start_date: formData.tenancyStartDate,
      tenancy_end_date: formData.tenancyEndDate,
      monthly_rent: formData.monthlyRent,
      rent_paid_on_time: formData.rentPaidOnTime,
      rent_paid_on_time_details: formData.rentPaidOnTimeDetails || null,
      property_condition: formData.propertyCondition,
      property_condition_details: formData.propertyConditionDetails || null,
      neighbour_complaints: formData.neighbourComplaints,
      neighbour_complaints_details: formData.neighbourComplaintsDetails || null,
      breach_of_tenancy: formData.breachOfTenancy,
      breach_of_tenancy_details: formData.breachOfTenancyDetails || null,
      would_rent_again: formData.wouldRentAgain,
      would_rent_again_details: formData.wouldRentAgainDetails || null,
      additional_comments: formData.additionalComments || null,
      signature_name: formData.signatureName,
      signature: formData.signature,
      date: formData.date,
      submitted_at: new Date().toISOString()
    }

    // Store agent reference data
    const { error: insertError } = await supabase
      .from('agent_references')
      .insert(dbData)

    if (insertError) {
      return res.status(400).json({ error: insertError.message })
    }

    // Update reference status based on required references
    const { data: tenantRef } = await supabase
      .from('tenant_references')
      .select('employer_ref_email, income_self_employed')
      .eq('id', referenceId)
      .single()

    // Check all required references
    let allReferencesSubmitted = true

    // Check employer reference if required
    if (tenantRef?.employer_ref_email) {
      const { data: employerRef } = await supabase
        .from('employer_references')
        .select('id')
        .eq('reference_id', referenceId)
        .single()

      if (!employerRef) {
        allReferencesSubmitted = false
      }
    }

    // Check accountant reference if required (self-employed)
    if (tenantRef?.income_self_employed) {
      const { data: accountantRef } = await supabase
        .from('accountant_references')
        .select('id, submitted_at')
        .eq('tenant_reference_id', referenceId)
        .single()

      if (!accountantRef || !accountantRef.submitted_at) {
        allReferencesSubmitted = false
      }
    }

    // Only mark as pending verification if all required references are submitted
    if (allReferencesSubmitted) {
      await supabase
        .from('tenant_references')
        .update({ status: 'pending_verification' })
        .eq('id', referenceId)
    }

    res.json({ message: 'Agent reference submitted successfully' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Employer submits reference (public route)
router.post('/employer/:referenceId', async (req, res) => {
  try {
    const { referenceId } = req.params
    const formData = req.body

    // Verify reference exists
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('id, status')
      .eq('id', referenceId)
      .single()

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Convert camelCase to snake_case for database
    const dbData: any = {
      reference_id: referenceId,
      company_name: formData.companyName,
      employer_name: formData.employerName,
      employer_position: formData.employerPosition,
      employer_email: formData.employerEmail,
      employer_phone: formData.employerPhone,
      employee_position: formData.employeePosition,
      employment_type: formData.employmentType,
      employment_start_date: formData.employmentStartDate,
      is_current_employee: formData.isCurrentEmployee,
      annual_salary: formData.annualSalary,
      salary_frequency: formData.salaryFrequency,
      is_probation: formData.isProbation,
      employment_status: formData.employmentStatus,
      performance_rating: formData.performanceRating,
      performance_details: formData.performanceDetails || null,
      disciplinary_issues: formData.disciplinaryIssues,
      disciplinary_details: formData.disciplinaryDetails || null,
      absence_record: formData.absenceRecord,
      absence_details: formData.absenceDetails || null,
      would_reemploy: formData.wouldReemploy,
      would_reemploy_details: formData.wouldReemployDetails || null,
      additional_comments: formData.additionalComments || null,
      signature_name: formData.signatureName,
      signature: formData.signature,
      date: formData.date,
      submitted_at: new Date().toISOString()
    }

    // Add optional date fields only if they have values
    if (formData.employmentEndDate) {
      dbData.employment_end_date = formData.employmentEndDate
    }
    if (formData.probationEndDate) {
      dbData.probation_end_date = formData.probationEndDate
    }

    // Store employer reference data
    const { error: insertError } = await supabase
      .from('employer_references')
      .insert(dbData)

    if (insertError) {
      return res.status(400).json({ error: insertError.message })
    }

    // Update reference status based on required references
    const { data: tenantRef } = await supabase
      .from('tenant_references')
      .select('previous_landlord_email, reference_type, income_self_employed')
      .eq('id', referenceId)
      .single()

    // Check all required references
    let allReferencesSubmitted = true

    // Check landlord or agent reference if required
    if (tenantRef?.previous_landlord_email) {
      if (tenantRef.reference_type === 'agent') {
        const { data: agentRef } = await supabase
          .from('agent_references')
          .select('id')
          .eq('reference_id', referenceId)
          .single()

        if (!agentRef) {
          allReferencesSubmitted = false
        }
      } else {
        const { data: landlordRef } = await supabase
          .from('landlord_references')
          .select('id')
          .eq('reference_id', referenceId)
          .single()

        if (!landlordRef) {
          allReferencesSubmitted = false
        }
      }
    }

    // Check accountant reference if required (self-employed)
    if (tenantRef?.income_self_employed) {
      const { data: accountantRef } = await supabase
        .from('accountant_references')
        .select('id, submitted_at')
        .eq('tenant_reference_id', referenceId)
        .single()

      if (!accountantRef || !accountantRef.submitted_at) {
        allReferencesSubmitted = false
      }
    }

    // Only mark as pending verification if all required references are submitted
    if (allReferencesSubmitted) {
      await supabase
        .from('tenant_references')
        .update({ status: 'pending_verification' })
        .eq('id', referenceId)
    }

    res.json({ message: 'Employer reference submitted successfully' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Accountant submits reference (public route)
router.post('/accountant/:token', async (req, res) => {
  try {
    const { token } = req.params
    const formData = req.body

    // Verify accountant reference exists by token
    const { data: accountantRef, error: refError } = await supabase
      .from('accountant_references')
      .select('*, tenant_reference_id')
      .eq('token', token)
      .single()

    if (refError || !accountantRef) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Check if already submitted
    if (accountantRef.submitted_at) {
      return res.status(400).json({ error: 'Reference already submitted' })
    }

    // Update accountant reference with form data
    const { error: updateError } = await supabase
      .from('accountant_references')
      .update({
        tenant_name: formData.tenantName,
        business_name: formData.businessName,
        nature_of_business: formData.natureOfBusiness,
        business_start_date: formData.businessStartDate,
        annual_turnover: formData.annualTurnover,
        annual_profit: formData.annualProfit,
        tax_returns_filed: formData.taxReturnsFiled,
        last_tax_return_date: formData.lastTaxReturnDate || null,
        accounts_prepared: formData.accountsPrepared,
        accounts_year_end: formData.accountsYearEnd || null,
        business_trading_status: formData.businessTradingStatus,
        any_outstanding_tax_liabilities: formData.anyOutstandingTaxLiabilities,
        tax_liabilities_details: formData.taxLiabilitiesDetails || null,
        business_financially_stable: formData.businessFinanciallyStable,
        accountant_confirms_income: formData.accountantConfirmsIncome,
        estimated_monthly_income: formData.estimatedMonthlyIncome,
        additional_comments: formData.additionalComments || null,
        would_recommend: formData.wouldRecommend,
        recommendation_comments: formData.recommendationComments || null,
        signature_name: formData.signatureName,
        signature: formData.signature,
        date: formData.date,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', accountantRef.id)

    if (updateError) {
      return res.status(400).json({ error: updateError.message })
    }

    // Update reference status based on required references
    const { data: tenantRef } = await supabase
      .from('tenant_references')
      .select('employer_ref_email, previous_landlord_email, reference_type')
      .eq('id', accountantRef.tenant_reference_id)
      .single()

    // Check all required references
    let allReferencesSubmitted = true

    // Check employer reference if required
    if (tenantRef?.employer_ref_email) {
      const { data: employerRef } = await supabase
        .from('employer_references')
        .select('id')
        .eq('reference_id', accountantRef.tenant_reference_id)
        .single()

      if (!employerRef) {
        allReferencesSubmitted = false
      }
    }

    // Check landlord or agent reference if required
    if (tenantRef?.previous_landlord_email) {
      if (tenantRef.reference_type === 'agent') {
        const { data: agentRef } = await supabase
          .from('agent_references')
          .select('id')
          .eq('reference_id', accountantRef.tenant_reference_id)
          .single()

        if (!agentRef) {
          allReferencesSubmitted = false
        }
      } else {
        const { data: landlordRef } = await supabase
          .from('landlord_references')
          .select('id')
          .eq('reference_id', accountantRef.tenant_reference_id)
          .single()

        if (!landlordRef) {
          allReferencesSubmitted = false
        }
      }
    }

    // Only mark as pending verification if all required references are submitted
    if (allReferencesSubmitted) {
      await supabase
        .from('tenant_references')
        .update({ status: 'pending_verification' })
        .eq('id', accountantRef.tenant_reference_id)
    }

    res.json({ message: 'Accountant reference submitted successfully' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Download file from reference (authenticated route)
router.get('/download/:referenceId/:folder/:filename', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const { referenceId, folder, filename } = req.params
    const filePath = `${referenceId}/${folder}/${filename}`

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .single()

    if (!companyUser) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Verify reference belongs to user's company
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('company_id')
      .eq('id', referenceId)
      .eq('company_id', companyUser.company_id)
      .single()

    if (refError || !reference) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Download file from storage
    const { data, error: downloadError } = await supabase.storage
      .from('tenant-documents')
      .download(filePath)

    if (downloadError) {
      return res.status(404).json({ error: 'File not found' })
    }

    // Get file extension to set correct content type
    const ext = filePath.split('.').pop()?.toLowerCase()
    const contentTypes: { [key: string]: string } = {
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png'
    }
    const contentType = contentTypes[ext || ''] || 'application/octet-stream'

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${filePath.split('/').pop()}"`)

    const buffer = Buffer.from(await data.arrayBuffer())
    res.send(buffer)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router

import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import crypto from 'crypto'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { sendTenantReferenceRequest, sendEmployerReferenceRequest, sendLandlordReferenceRequest, sendAgentReferenceRequest, sendAccountantReferenceRequest, sendConsentPDFToTenant } from '../services/emailService'
import { auditReferenceAction } from '../services/auditLog'
import { generateToken, hash, encrypt, decrypt } from '../services/encryption'
import pdfService from '../services/pdfService'
import { creditsafeService } from '../services/creditsafeService'

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
    console.log('=== FETCHING REFERENCES FOR USER:', userId)

    // Get ALL company_users entries to diagnose the issue
    const { data: allCompanyUsers } = await supabase
      .from('company_users')
      .select('id, company_id, role, created_at')
      .eq('user_id', userId)

    console.log('ALL company_users entries for this user:', JSON.stringify(allCompanyUsers, null, 2))

    // Get user's company (use limit(1) to handle duplicates)
    const { data: companyUsers } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)

    if (!companyUsers || companyUsers.length === 0) {
      console.log('ERROR: No company found for user')
      return res.status(404).json({ error: 'Company not found' })
    }

    const companyUser = companyUsers[0]
    console.log('Using company_id:', companyUser.company_id)

    // Count total references for this company
    const { count: totalCount } = await supabase
      .from('tenant_references')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyUser.company_id)

    console.log('Total references in this company:', totalCount)

    // Get all references for the company (excluding child references)
    const { data: references, error } = await supabase
      .from('tenant_references')
      .select('*')
      .eq('company_id', companyUser.company_id)
      .is('parent_reference_id', null) // Only get top-level references (no children)
      .order('created_at', { ascending: false })

    console.log('Top-level references found:', references?.length || 0)

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // For each parent reference, count the children and sync status
    const referencesWithCount = await Promise.all(references.map(async (ref) => {
      if (ref.is_group_parent) {
        const { data: children, count } = await supabase
          .from('tenant_references')
          .select('*', { count: 'exact' })
          .eq('parent_reference_id', ref.id)

        // Sync parent status with children's statuses
        if (children && children.length > 0) {
          const statuses = children.map(child => child.status)
          let parentStatus = ref.status

          // Determine parent status based on children
          // Priority order: rejected > cancelled > completed > pending_verification > in_progress > pending
          if (statuses.some(s => s === 'rejected')) {
            parentStatus = 'rejected'
          } else if (statuses.some(s => s === 'cancelled')) {
            parentStatus = 'cancelled'
          } else if (statuses.every(s => s === 'completed')) {
            parentStatus = 'completed'
          } else if (statuses.every(s => s === 'pending_verification' || s === 'completed')) {
            parentStatus = 'pending_verification'
          } else if (statuses.some(s => s === 'in_progress' || s === 'pending_verification')) {
            parentStatus = 'in_progress'
          } else if (statuses.every(s => s === 'pending')) {
            parentStatus = 'pending'
          }

          // Update parent if status changed
          if (parentStatus !== ref.status) {
            await supabase
              .from('tenant_references')
              .update({ status: parentStatus })
              .eq('id', ref.id)

            ref.status = parentStatus
          }
        }

        return { ...ref, tenant_count: count || 0 }
      }
      return ref
    }))

    // Decrypt tenant reference fields for list view
    const decryptedReferences = referencesWithCount.map(ref => ({
      ...ref,
      tenant_first_name: decrypt(ref.tenant_first_name_encrypted),
      tenant_last_name: decrypt(ref.tenant_last_name_encrypted),
      tenant_email: decrypt(ref.tenant_email_encrypted),
      tenant_phone: decrypt(ref.tenant_phone_encrypted),
      property_address: decrypt(ref.property_address_encrypted),
      property_city: decrypt(ref.property_city_encrypted),
      property_postcode: decrypt(ref.property_postcode_encrypted)
    }))

    res.json({ references: decryptedReferences })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get single reference
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const referenceId = req.params.id

    // Get user's company (use limit(1) to handle duplicates)
    const { data: companyUsers } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)

    if (!companyUsers || companyUsers.length === 0) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const companyUser = companyUsers[0]

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
    let { data: landlordReference } = await supabase
      .from('landlord_references')
      .select('*')
      .eq('reference_id', referenceId)
      .single()

    // Get agent reference if exists
    let { data: agentReference } = await supabase
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
    let { data: accountantReference } = await supabase
      .from('accountant_references')
      .select('*')
      .eq('tenant_reference_id', referenceId)
      .single()

    // If this is a child reference and no landlord/agent/accountant ref found, check siblings
    if (reference.parent_reference_id && (!landlordReference && !agentReference && !accountantReference)) {
      // Get all sibling references
      const { data: siblings } = await supabase
        .from('tenant_references')
        .select('id')
        .eq('parent_reference_id', reference.parent_reference_id)
        .neq('id', referenceId)

      if (siblings && siblings.length > 0) {
        // Check each sibling for references
        for (const sibling of siblings) {
          if (!landlordReference) {
            const { data: siblingLandlordRef } = await supabase
              .from('landlord_references')
              .select('*')
              .eq('reference_id', sibling.id)
              .single()
            if (siblingLandlordRef) landlordReference = siblingLandlordRef
          }

          if (!agentReference) {
            const { data: siblingAgentRef } = await supabase
              .from('agent_references')
              .select('*')
              .eq('reference_id', sibling.id)
              .single()
            if (siblingAgentRef) agentReference = siblingAgentRef
          }

          if (!accountantReference) {
            const { data: siblingAccountantRef } = await supabase
              .from('accountant_references')
              .select('*')
              .eq('tenant_reference_id', sibling.id)
              .single()
            if (siblingAccountantRef) accountantReference = siblingAccountantRef
          }

          // Break early if we found all references
          if (landlordReference && agentReference && accountantReference) break
        }
      }
    }

    // Check if this is a parent reference and fetch children
    let childReferences = null
    if (reference.is_group_parent) {
      const { data: children } = await supabase
        .from('tenant_references')
        .select('*')
        .eq('parent_reference_id', referenceId)
        .order('tenant_position', { ascending: true })

      childReferences = children

      // Sync parent status with children's statuses
      if (children && children.length > 0) {
        const statuses = children.map(child => child.status)
        let parentStatus = reference.status

        // Determine parent status based on children
        if (statuses.every(s => s === 'completed')) {
          parentStatus = 'completed'
        } else if (statuses.every(s => s === 'pending_verification' || s === 'completed')) {
          parentStatus = 'pending_verification'
        } else if (statuses.some(s => s === 'in_progress' || s === 'pending_verification')) {
          parentStatus = 'in_progress'
        } else if (statuses.every(s => s === 'pending')) {
          parentStatus = 'pending'
        }

        // Update parent if status changed
        if (parentStatus !== reference.status) {
          await supabase
            .from('tenant_references')
            .update({ status: parentStatus })
            .eq('id', referenceId)

          reference.status = parentStatus
        }
      }
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

    // Get previous addresses for 3-year history
    const { data: previousAddresses } = await supabase
      .from('tenant_reference_previous_addresses')
      .select('*')
      .eq('tenant_reference_id', referenceId)
      .order('address_order', { ascending: true })

    // Helper function to decrypt tenant reference fields
    const decryptTenantReference = (ref: any) => {
      if (!ref) return ref
      return {
        ...ref,
        tenant_first_name: decrypt(ref.tenant_first_name_encrypted),
        tenant_last_name: decrypt(ref.tenant_last_name_encrypted),
        middle_name: decrypt(ref.middle_name_encrypted),
        tenant_email: decrypt(ref.tenant_email_encrypted),
        tenant_phone: decrypt(ref.tenant_phone_encrypted),
        contact_number: decrypt(ref.contact_number_encrypted),
        date_of_birth: decrypt(ref.date_of_birth_encrypted),
        nationality: decrypt(ref.nationality_encrypted),
        property_address: decrypt(ref.property_address_encrypted),
        property_city: decrypt(ref.property_city_encrypted),
        property_postcode: decrypt(ref.property_postcode_encrypted),
        current_address_line1: decrypt(ref.current_address_line1_encrypted),
        current_address_line2: decrypt(ref.current_address_line2_encrypted),
        current_city: decrypt(ref.current_city_encrypted),
        current_postcode: decrypt(ref.current_postcode_encrypted),
        current_country: decrypt(ref.current_country_encrypted),
        employment_company_name: decrypt(ref.employment_company_name_encrypted),
        employment_job_title: decrypt(ref.employment_position_encrypted),
        employment_salary_amount: decrypt(ref.employment_salary_amount_encrypted),
        employment_company_address_line1: decrypt(ref.employment_company_address_line1_encrypted),
        employment_company_address_line2: decrypt(ref.employment_company_address_line2_encrypted),
        employment_company_city: decrypt(ref.employment_company_city_encrypted),
        employment_company_postcode: decrypt(ref.employment_company_postcode_encrypted),
        employment_company_country: decrypt(ref.employment_company_country_encrypted),
        employer_ref_name: decrypt(ref.employer_ref_name_encrypted),
        employer_ref_email: decrypt(ref.employer_ref_email_encrypted),
        employer_ref_phone: decrypt(ref.employer_ref_phone_encrypted),
        self_employed_business_name: decrypt(ref.self_employed_business_name_encrypted),
        self_employed_nature_of_business: decrypt(ref.self_employed_nature_of_business_encrypted),
        self_employed_annual_income: decrypt(ref.self_employed_annual_income_encrypted),
        savings_amount: decrypt(ref.savings_amount_encrypted),
        additional_income_source: decrypt(ref.additional_income_source_encrypted),
        additional_income_amount: decrypt(ref.additional_income_amount_encrypted),
        adverse_credit_details: decrypt(ref.adverse_credit_details_encrypted),
        pet_details: decrypt(ref.pet_details_encrypted),
        marital_status: decrypt(ref.marital_status_encrypted),
        dependants_details: decrypt(ref.dependants_details_encrypted),
        previous_landlord_name: decrypt(ref.previous_landlord_name_encrypted),
        previous_landlord_email: decrypt(ref.previous_landlord_email_encrypted),
        previous_landlord_phone: decrypt(ref.previous_landlord_phone_encrypted),
        previous_rental_address_line1: decrypt(ref.previous_rental_address_line1_encrypted),
        previous_rental_address_line2: decrypt(ref.previous_rental_address_line2_encrypted),
        previous_rental_city: decrypt(ref.previous_rental_city_encrypted),
        previous_rental_postcode: decrypt(ref.previous_rental_postcode_encrypted),
        previous_rental_country: decrypt(ref.previous_rental_country_encrypted),
        previous_monthly_rent: decrypt(ref.previous_monthly_rent_encrypted),
        previous_agency_name: decrypt(ref.previous_agency_name_encrypted),
        accountant_name: decrypt(ref.accountant_firm_encrypted),
        accountant_contact_name: decrypt(ref.accountant_name_encrypted),
        accountant_email: decrypt(ref.accountant_email_encrypted),
        accountant_phone: decrypt(ref.accountant_phone_encrypted),
        notes: decrypt(ref.notes_encrypted),
        internal_notes: decrypt(ref.internal_notes_encrypted),
        verification_notes: decrypt(ref.verification_notes_encrypted)
      }
    }

    // Helper function to decrypt previous addresses
    const decryptPreviousAddress = (addr: any) => {
      if (!addr) return addr
      return {
        ...addr,
        address_line1: decrypt(addr.address_line1_encrypted),
        address_line2: decrypt(addr.address_line2_encrypted),
        city: decrypt(addr.city_encrypted),
        postcode: decrypt(addr.postcode_encrypted),
        country: decrypt(addr.country_encrypted)
      }
    }

    // Decrypt all reference data
    const decryptedReference = decryptTenantReference(reference)
    const decryptedChildReferences = childReferences?.map(decryptTenantReference)
    const decryptedParentReference = decryptTenantReference(parentReference)
    const decryptedSiblingReferences = siblingReferences?.map(decryptTenantReference)
    const decryptedPreviousAddresses = previousAddresses?.map(decryptPreviousAddress)

    const decryptedLandlordReference = landlordReference ? {
      ...landlordReference,
      landlord_name: decrypt(landlordReference.landlord_name_encrypted),
      landlord_email: decrypt(landlordReference.landlord_email_encrypted),
      landlord_phone: decrypt(landlordReference.landlord_phone_encrypted),
      property_address: decrypt(landlordReference.property_address_encrypted),
      property_city: decrypt(landlordReference.property_city_encrypted),
      property_postcode: decrypt(landlordReference.property_postcode_encrypted),
      monthly_rent: decrypt(landlordReference.monthly_rent_encrypted),
      rent_paid_on_time_details: decrypt(landlordReference.rent_paid_on_time_details_encrypted),
      property_condition_details: decrypt(landlordReference.property_condition_details_encrypted),
      neighbour_complaints_details: decrypt(landlordReference.neighbour_complaints_details_encrypted),
      breach_of_tenancy_details: decrypt(landlordReference.breach_of_tenancy_details_encrypted),
      would_rent_again_details: decrypt(landlordReference.would_rent_again_details_encrypted),
      additional_comments: decrypt(landlordReference.additional_comments_encrypted),
      signature_name: decrypt(landlordReference.signature_name_encrypted),
      signature: decrypt(landlordReference.signature_encrypted)
    } : null

    const decryptedAgentReference = agentReference ? {
      ...agentReference,
      agent_name: decrypt(agentReference.agent_name_encrypted),
      agency_name: decrypt(agentReference.agency_name_encrypted),
      agent_email: decrypt(agentReference.agent_email_encrypted),
      agent_phone: decrypt(agentReference.agent_phone_encrypted),
      property_address: decrypt(agentReference.property_address_encrypted),
      property_city: decrypt(agentReference.property_city_encrypted),
      property_postcode: decrypt(agentReference.property_postcode_encrypted),
      monthly_rent: decrypt(agentReference.monthly_rent_encrypted),
      rent_paid_on_time_details: decrypt(agentReference.rent_paid_on_time_details_encrypted),
      property_condition_details: decrypt(agentReference.property_condition_details_encrypted),
      neighbour_complaints_details: decrypt(agentReference.neighbour_complaints_details_encrypted),
      breach_of_tenancy_details: decrypt(agentReference.breach_of_tenancy_details_encrypted),
      would_rent_again_details: decrypt(agentReference.would_rent_again_details_encrypted),
      additional_comments: decrypt(agentReference.additional_comments_encrypted),
      signature_name: decrypt(agentReference.signature_name_encrypted),
      signature: decrypt(agentReference.signature_encrypted)
    } : null

    const decryptedEmployerReference = employerReference ? {
      ...employerReference,
      company_name: decrypt(employerReference.company_name_encrypted),
      employer_name: decrypt(employerReference.employer_name_encrypted),
      employer_position: decrypt(employerReference.employer_position_encrypted),
      employer_email: decrypt(employerReference.employer_email_encrypted),
      employer_phone: decrypt(employerReference.employer_phone_encrypted),
      employee_position: decrypt(employerReference.employee_position_encrypted),
      annual_salary: decrypt(employerReference.annual_salary_encrypted),
      performance_details: decrypt(employerReference.performance_details_encrypted),
      disciplinary_details: decrypt(employerReference.disciplinary_details_encrypted),
      absence_details: decrypt(employerReference.absence_details_encrypted),
      would_reemploy_details: decrypt(employerReference.would_reemploy_details_encrypted),
      additional_comments: decrypt(employerReference.additional_comments_encrypted),
      signature: decrypt(employerReference.signature_encrypted)
    } : null

    const decryptedAccountantReference = accountantReference ? {
      ...accountantReference,
      accountant_name: decrypt(accountantReference.accountant_name_encrypted),
      accountant_firm: decrypt(accountantReference.accountant_firm_encrypted),
      accountant_email: decrypt(accountantReference.accountant_email_encrypted),
      accountant_phone: decrypt(accountantReference.accountant_phone_encrypted),
      business_name: decrypt(accountantReference.business_name_encrypted),
      nature_of_business: decrypt(accountantReference.nature_of_business_encrypted),
      annual_turnover: decrypt(accountantReference.annual_turnover_encrypted),
      annual_profit: decrypt(accountantReference.annual_profit_encrypted),
      tax_liabilities_details: decrypt(accountantReference.tax_liabilities_details_encrypted),
      estimated_monthly_income: decrypt(accountantReference.estimated_monthly_income_encrypted),
      additional_comments: decrypt(accountantReference.additional_comments_encrypted),
      recommendation_comments: decrypt(accountantReference.recommendation_comments_encrypted),
      signature: decrypt(accountantReference.signature_encrypted)
    } : null

    res.json({
      reference: decryptedReference,
      documents,
      landlordReference: decryptedLandlordReference,
      agentReference: decryptedAgentReference,
      employerReference: decryptedEmployerReference,
      accountantReference: decryptedAccountantReference,
      childReferences: decryptedChildReferences,
      parentReference: decryptedParentReference,
      siblingReferences: decryptedSiblingReferences,
      previousAddresses: decryptedPreviousAddresses || []
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

    // Get user's company (use limit(1) to handle duplicates)
    console.log('Looking up company for user:', userId)
    const { data: companyUsers, error: companyError } = await supabase
      .from('company_users')
      .select('company_id, companies:company_id(name_encrypted, phone_encrypted)')
      .eq('user_id', userId)
      .limit(1)

    console.log('Company lookup result:', companyUsers, 'Error:', companyError)

    if (!companyUsers || companyUsers.length === 0) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const companyUser = companyUsers[0]
    const companyName = (companyUser as any).companies?.name_encrypted
      ? (decrypt((companyUser as any).companies.name_encrypted) || 'Your agent')
      : 'Your agent'
    const companyPhone = (companyUser as any).companies?.phone_encrypted
      ? decrypt((companyUser as any).companies.phone_encrypted)
      : ''

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
      const parentToken = generateToken()
      const parentTokenHash = hash(parentToken)

      const { data: parentReference, error: parentError } = await supabase
        .from('tenant_references')
        .insert({
          company_id: companyUser.company_id,
          created_by: userId,
          tenant_first_name_encrypted: encrypt(tenants[0].first_name),
          tenant_last_name_encrypted: encrypt(tenants[0].last_name),
          tenant_email_encrypted: encrypt(tenants[0].email),
          tenant_phone_encrypted: encrypt(tenants[0].phone),
          property_address_encrypted: encrypt(property_address),
          property_city_encrypted: encrypt(property_city || ''),
          property_postcode_encrypted: encrypt(property_postcode || ''),
          monthly_rent,
          move_in_date,
          term_years: term_years || 0,
          term_months: term_months || 0,
          notes_encrypted: encrypt(notes || ''),
          reference_token_hash: parentTokenHash,
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
        const token = generateToken()
        const tokenHash = hash(token)

        const { data: childReference, error: childError } = await supabase
          .from('tenant_references')
          .insert({
            company_id: companyUser.company_id,
            created_by: userId,
            parent_reference_id: parentReference.id,
            tenant_position: i + 1,
            tenant_first_name_encrypted: encrypt(tenant.first_name),
            tenant_last_name_encrypted: encrypt(tenant.last_name),
            tenant_email_encrypted: encrypt(tenant.email),
            tenant_phone_encrypted: encrypt(tenant.phone),
            property_address_encrypted: encrypt(property_address),
            property_city_encrypted: encrypt(property_city || ''),
            property_postcode_encrypted: encrypt(property_postcode || ''),
            monthly_rent, // Keep full rent for context
            rent_share: tenant.rent_share,
            move_in_date,
            term_years: term_years || 0,
            term_months: term_months || 0,
            notes_encrypted: encrypt(notes || ''),
            reference_token_hash: tokenHash,
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
            companyName,
            property_address,
            companyPhone || undefined
          )
          console.log('Email sent successfully to tenant:', tenant.email)
        } catch (emailError: any) {
          console.error('Failed to send email to', tenant.email, emailError)
        }
      }

      // Audit log for multi-tenant reference
      await auditReferenceAction(
        companyUser.company_id,
        userId!,
        parentReference.id,
        'reference.created',
        `Created multi-tenant reference for ${tenants.length} tenants at ${property_address}`,
        req,
        {
          tenant_count: tenants.length,
          property_address,
          monthly_rent
        }
      )

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

      // Generate unique token for tenant and hash it
      const token = generateToken()
      const tokenHash = hash(token)

      // Token expires in 30 days
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)

      // Create reference
      const { data: reference, error } = await supabase
        .from('tenant_references')
        .insert({
          company_id: companyUser.company_id,
          created_by: userId,
          tenant_first_name_encrypted: encrypt(tenant_first_name),
          tenant_last_name_encrypted: encrypt(tenant_last_name),
          tenant_email_encrypted: encrypt(tenant_email),
          tenant_phone_encrypted: encrypt(tenant_phone),
          property_address_encrypted: encrypt(property_address),
          property_city_encrypted: encrypt(property_city || ''),
          property_postcode_encrypted: encrypt(property_postcode || ''),
          monthly_rent,
          move_in_date,
          term_years: term_years || 0,
          term_months: term_months || 0,
          notes_encrypted: encrypt(notes || ''),
          reference_token_hash: tokenHash,
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
          companyName,
          property_address,
          companyPhone || undefined
        )
        console.log('Email sent successfully to tenant:', tenant_email)
      } catch (emailError: any) {
        console.error('Failed to send email:', emailError)
        // Don't fail the request if email fails, just log it
      }

      // Audit log for single-tenant reference
      await auditReferenceAction(
        companyUser.company_id,
        userId!,
        reference.id,
        'reference.created',
        `Created reference for ${tenant_first_name} ${tenant_last_name} at ${property_address}`,
        req,
        {
          tenant_email,
          property_address,
          monthly_rent
        }
      )

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
// Update reference (PUT - full update)
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const referenceId = req.params.id
    const updates = req.body

    // Get user's company (use limit(1) to handle duplicates)
    const { data: companyUsers } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)

    if (!companyUsers || companyUsers.length === 0) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const companyUser = companyUsers[0]

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

    // Audit log
    const updatedFields = Object.keys(updates).join(', ')
    await auditReferenceAction(
      companyUser.company_id,
      userId!,
      referenceId,
      'reference.updated',
      `Updated reference: ${updatedFields}`,
      req,
      { updates }
    )

    res.json({ reference, message: 'Reference updated successfully' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Update reference (PATCH - partial update)
router.patch('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const referenceId = req.params.id
    const updates = req.body

    // Get user's company (use limit(1) to handle duplicates)
    const { data: companyUsers } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)

    if (!companyUsers || companyUsers.length === 0) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const companyUser = companyUsers[0]

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

    // Audit log
    const updatedFields = Object.keys(updates).join(', ')
    await auditReferenceAction(
      companyUser.company_id,
      userId!,
      referenceId,
      'reference.updated',
      `Updated reference: ${updatedFields}`,
      req,
      { updates }
    )

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

    // Get user's company and role (use limit(1) to handle duplicates)
    const { data: companyUsers } = await supabase
      .from('company_users')
      .select('company_id, role')
      .eq('user_id', userId)
      .limit(1)

    if (!companyUsers || companyUsers.length === 0) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const companyUser = companyUsers[0]

    // Check if user is owner or admin
    if (companyUser.role !== 'owner' && companyUser.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }

    // Get reference details for audit log before deletion
    const { data: reference } = await supabase
      .from('tenant_references')
      .select('tenant_first_name, tenant_last_name, property_address')
      .eq('id', referenceId)
      .eq('company_id', companyUser.company_id)
      .single()

    // Delete reference
    const { error } = await supabase
      .from('tenant_references')
      .delete()
      .eq('id', referenceId)
      .eq('company_id', companyUser.company_id)

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // Audit log
    if (reference) {
      await auditReferenceAction(
        companyUser.company_id,
        userId!,
        referenceId,
        'reference.deleted',
        `Deleted reference for ${reference.tenant_first_name} ${reference.tenant_last_name} at ${reference.property_address}`,
        req,
        {
          tenant_first_name: reference.tenant_first_name,
          tenant_last_name: reference.tenant_last_name,
          property_address: reference.property_address
        }
      )
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

    // Hash the token to look up the reference securely
    const tokenHash = hash(token)

    // Get reference by token hash
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('*')
      .eq('reference_token_hash', tokenHash)
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
      tenant_first_name_encrypted: encrypt(data.first_name),
      tenant_last_name_encrypted: encrypt(data.last_name),
      middle_name_encrypted: encrypt(data.middle_name || ''),
      date_of_birth_encrypted: encrypt(data.date_of_birth),
      contact_number_encrypted: encrypt(data.contact_number),
      nationality_encrypted: encrypt(data.nationality || ''),

      // ID Document (Page 1)
      id_document_type: data.id_document_type || null,
      id_document_path: data.id_document_path || null,
      selfie_path: data.selfie_path || null,

      // Current Address (Page 4)
      current_address_line1_encrypted: encrypt(data.current_address_line1 || ''),
      current_address_line2_encrypted: encrypt(data.current_address_line2 || ''),
      current_city_encrypted: encrypt(data.current_city || ''),
      current_postcode_encrypted: encrypt(data.current_postcode || ''),
      current_country_encrypted: encrypt(data.current_country || ''),
      time_at_address_years: data.time_at_address_years || null,
      time_at_address_months: data.time_at_address_months || null,
      proof_of_address_path: data.proof_of_address_path || null,

      // Financial Information - Income Sources (Page 6)
      income_regular_employment: data.income_regular_employment || false,
      income_self_employed: data.income_self_employed || false,
      income_benefits: data.income_benefits || false,
      income_savings_pension_investments: data.income_savings_pension_investments || false,
      income_student: data.income_student || false,
      income_unemployed: data.income_unemployed || false,

      // Benefits Details
      benefits_monthly_amount_encrypted: encrypt(data.benefits_monthly_amount ? String(data.benefits_monthly_amount) : null),
      benefits_annual_amount_encrypted: encrypt(data.benefits_annual_amount ? String(data.benefits_annual_amount) : null),

      // Savings, Pensions or Investments Details
      savings_amount_encrypted: encrypt(data.savings_amount ? String(data.savings_amount) : null),
      proof_of_funds_path: data.proof_of_funds_path || null,

      // Additional Income
      proof_of_additional_income_path: data.proof_of_additional_income_path || null,

      // Employment Details (Page 6)
      employment_contract_type: data.employment_contract_type || null,
      employment_start_date: data.employment_start_date || null,
      employment_end_date: data.employment_end_date || null,
      employment_is_hourly: data.employment_is_hourly || false,
      employment_hours_per_month: data.employment_hours_per_month || null,
      employment_salary_amount_encrypted: encrypt(data.employment_salary_amount ? String(data.employment_salary_amount) : null),
      employment_salary_frequency: data.employment_salary_frequency || null,
      employment_company_name_encrypted: encrypt(data.employment_company_name),
      employment_company_address_line1_encrypted: encrypt(data.employment_company_address_line1 || ''),
      employment_company_address_line2_encrypted: encrypt(data.employment_company_address_line2 || ''),
      employment_company_city_encrypted: encrypt(data.employment_company_city || ''),
      employment_company_postcode_encrypted: encrypt(data.employment_company_postcode || ''),
      employment_company_country_encrypted: encrypt(data.employment_company_country || ''),
      employment_position_encrypted: encrypt(data.employment_job_title),
      payslip_files: data.payslip_files || [],

      // Employer Reference Contact (Page 6)
      employer_ref_position: data.employer_ref_position || null,
      employer_ref_name_encrypted: encrypt(data.employer_ref_name || ''),
      employer_ref_email_encrypted: encrypt(data.employer_ref_email),
      employer_ref_phone_encrypted: encrypt(data.employer_ref_phone),

      // Self-Employed Details (Page 6)
      self_employed_business_name_encrypted: encrypt(data.self_employed_business_name || ''),
      self_employed_start_date: data.self_employed_start_date || null,
      self_employed_nature_of_business_encrypted: encrypt(data.self_employed_nature_of_business || ''),
      self_employed_annual_income_encrypted: encrypt(data.self_employed_annual_income ? String(data.self_employed_annual_income) : null),

      // Accountant Details (Page 6)
      accountant_firm_encrypted: encrypt(data.accountant_name),
      accountant_name_encrypted: encrypt(data.accountant_contact_name),
      accountant_email_encrypted: encrypt(data.accountant_email),
      accountant_phone_encrypted: encrypt(data.accountant_phone),

      // Additional Income (Page 7)
      has_additional_income: data.has_additional_income || false,
      additional_income_source_encrypted: encrypt(data.additional_income_source || ''),
      additional_income_amount_encrypted: encrypt(data.additional_income_amount ? String(data.additional_income_amount) : ''),
      additional_income_frequency: data.additional_income_frequency || null,

      // Adverse Credit (Page 8)
      has_adverse_credit: data.has_adverse_credit || false,
      adverse_credit_details_encrypted: encrypt(data.adverse_credit_details || ''),

      // Tenant Details (Page 9)
      is_smoker: data.is_smoker,
      has_pets: data.has_pets || false,
      pet_details_encrypted: encrypt(data.pet_details || ''),
      marital_status_encrypted: encrypt(data.marital_status || ''),
      number_of_dependants: data.number_of_dependants || 0,
      dependants_details_encrypted: encrypt(data.dependants_details || ''),

      // Previous Landlord Reference (Page 10)
      reference_type: data.reference_type || 'landlord',
      previous_landlord_name_encrypted: encrypt(data.previous_landlord_name),
      previous_landlord_email_encrypted: encrypt(data.previous_landlord_email),
      previous_landlord_phone_encrypted: encrypt(data.previous_landlord_phone),
      previous_rental_address_line1_encrypted: encrypt(data.previous_rental_address_line1 || ''),
      previous_rental_address_line2_encrypted: encrypt(data.previous_rental_address_line2 || ''),
      previous_rental_city_encrypted: encrypt(data.previous_rental_city || ''),
      previous_rental_postcode_encrypted: encrypt(data.previous_rental_postcode || ''),
      previous_rental_country_encrypted: encrypt(data.previous_rental_country || ''),
      tenancy_years: data.tenancy_years || 0,
      tenancy_months: data.tenancy_months || 0,
      previous_monthly_rent_encrypted: encrypt(data.previous_monthly_rent ? String(data.previous_monthly_rent) : null),
      previous_tenancy_start_date: data.previous_tenancy_start_date || null,
      previous_tenancy_end_date: data.previous_tenancy_end_date || null,
      previous_agency_name_encrypted: encrypt(data.previous_agency_name || ''),

      // Consent Declaration (Page 11)
      consent_signature: data.consent_signature || null,
      consent_printed_name_encrypted: encrypt(data.consent_printed_name || ''),
      consent_agreed_date: data.consent_agreed_date || null,

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

    // Save previous addresses for 3-year history tracking
    if (data.previous_addresses && Array.isArray(data.previous_addresses) && data.previous_addresses.length > 0) {
      try {
        const previousAddressesData = data.previous_addresses.map((addr: any, index: number) => ({
          tenant_reference_id: reference.id,
          address_line1_encrypted: encrypt(addr.address_line1 || ''),
          address_line2_encrypted: encrypt(addr.address_line2 || ''),
          city_encrypted: encrypt(addr.city || ''),
          postcode_encrypted: encrypt(addr.postcode || ''),
          country_encrypted: encrypt(addr.country || ''),
          time_at_address_years: addr.time_at_address_years || 0,
          time_at_address_months: addr.time_at_address_months || 0,
          address_order: index
        }))

        const { error: addressError } = await supabase
          .from('tenant_reference_previous_addresses')
          .insert(previousAddressesData)

        if (addressError) {
          console.error('Failed to save previous addresses:', addressError)
          // Don't fail the whole submission if previous addresses fail
        }
      } catch (addressErr) {
        console.error('Error saving previous addresses:', addressErr)
      }
    }

    // Send email to employer if employer reference details are provided
    if (data.employer_ref_email && data.employer_ref_name) {
      try {
        // Get company info for contact details
        const { data: companyData } = await supabase
          .from('companies')
          .select('name_encrypted, phone_encrypted, email_encrypted')
          .eq('id', reference.company_id)
          .single()

        const employerReferenceUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/employer-reference/${updatedReference.id}`

        await sendEmployerReferenceRequest(
          data.employer_ref_email,
          data.employer_ref_name,
          `${data.first_name} ${data.last_name}`,
          employerReferenceUrl,
          companyData?.name_encrypted ? decrypt(companyData.name_encrypted ?? '') ?? '' : '',
          companyData?.phone_encrypted ? decrypt(companyData.phone_encrypted ?? '') ?? '' : '',
          companyData?.email_encrypted ? decrypt(companyData.email_encrypted ?? '') ?? '' : ''
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
        // Get company info for contact details
        const { data: companyData } = await supabase
          .from('companies')
          .select('name_encrypted, phone_encrypted, email_encrypted')
          .eq('id', reference.company_id)
          .single()

        const referenceType = data.reference_type || 'landlord'

        if (referenceType === 'agent') {
          const agentReferenceUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/agent-reference/${updatedReference.id}`

          await sendAgentReferenceRequest(
            data.previous_landlord_email,
            data.previous_landlord_name,
            `${data.first_name} ${data.last_name}`,
            agentReferenceUrl,
            companyData?.name_encrypted ? decrypt(companyData.name_encrypted ?? '') ?? '' : '',
            companyData?.phone_encrypted ? decrypt(companyData.phone_encrypted ?? '') ?? '' : '',
            companyData?.email_encrypted ? decrypt(companyData.email_encrypted ?? '') ?? '' : ''
          )
          console.log('Agent reference email sent successfully to:', data.previous_landlord_email)
        } else {
          const landlordReferenceUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/landlord-reference/${updatedReference.id}`

          await sendLandlordReferenceRequest(
            data.previous_landlord_email,
            data.previous_landlord_name,
            `${data.first_name} ${data.last_name}`,
            landlordReferenceUrl,
            companyData?.name_encrypted ? decrypt(companyData.name_encrypted ?? '') ?? '' : '',
            companyData?.phone_encrypted ? decrypt(companyData.phone_encrypted ?? '') ?? '' : '',
            companyData?.email_encrypted ? decrypt(companyData.email_encrypted ?? '') ?? '' : ''
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
        // Get company info for contact details
        const { data: companyData } = await supabase
          .from('companies')
          .select('name_encrypted, phone_encrypted, email_encrypted')
          .eq('id', reference.company_id)
          .single()

        // Create accountant reference record with unique token and hash
        const accountantToken = generateToken()
        const accountantTokenHash = hash(accountantToken)

        const { data: accountantRef, error: accountantError } = await supabase
          .from('accountant_references')
          .insert({
            tenant_reference_id: updatedReference.id,
            token_hash: accountantTokenHash,
            accountant_firm_encrypted: encrypt(data.accountant_name || ''),
            accountant_name_encrypted: encrypt(data.accountant_contact_name),
            accountant_email_encrypted: encrypt(data.accountant_email),
            accountant_phone_encrypted: encrypt(data.accountant_phone),
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
            accountantReferenceUrl,
            companyData?.name_encrypted ? decrypt(companyData.name_encrypted ?? '') ?? '' : '',
            companyData?.phone_encrypted ? decrypt(companyData.phone_encrypted ?? '') ?? '' : '',
            companyData?.email_encrypted ? decrypt(companyData.email_encrypted ?? '') ?? '' : ''
          )
          console.log('Accountant reference email sent successfully to:', data.accountant_email)
        }
      } catch (emailError: any) {
        console.error('Failed to send accountant reference email:', emailError)
        // Don't fail the request if email fails, just log it
      }
    }

    // Generate consent PDF
    if (data.consent_signature && data.consent_printed_name && data.consent_agreed_date) {
      try {
        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(__dirname, '../../uploads/consent-pdfs')
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true })
        }

        // Generate unique filename
        const pdfFilename = `consent_${updatedReference.id}_${Date.now()}.pdf`
        const pdfPath = path.join(uploadsDir, pdfFilename)

        // Generate PDF
        await pdfService.generateConsentPDF({
          firstName: data.first_name,
          middleName: data.middle_name,
          lastName: data.last_name,
          consentPrintedName: data.consent_printed_name,
          consentAgreedDate: data.consent_agreed_date,
          consentSignature: data.consent_signature
        }, pdfPath)

        // Upload PDF to Supabase Storage
        const pdfBuffer = fs.readFileSync(pdfPath)
        const storagePath = `consent-pdfs/${updatedReference.id}/${pdfFilename}`

        const { error: uploadError } = await supabase.storage
          .from('reference-documents')
          .upload(storagePath, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: false
          })

        if (uploadError) {
          console.error('Failed to upload consent PDF to storage:', uploadError)
        } else {
          // Update reference with PDF path
          await supabase
            .from('tenant_references')
            .update({ consent_pdf_path: storagePath })
            .eq('id', updatedReference.id)

          console.log('Consent PDF generated and uploaded successfully')

          // Send PDF to tenant via email
          try {
            // Get tenant email
            const tenantEmail = reference.tenant_email_encrypted ? decrypt(reference.tenant_email_encrypted) : null

            if (tenantEmail) {
              await sendConsentPDFToTenant(
                tenantEmail,
                `${data.first_name} ${data.last_name}`,
                pdfBuffer,
                pdfFilename
              )
              console.log('Consent PDF sent to tenant email successfully')
            } else {
              console.warn('Tenant email not found, skipping PDF email')
            }
          } catch (emailError: any) {
            console.error('Failed to send consent PDF email to tenant:', emailError)
            // Don't fail the request if email fails
          }
        }

        // Clean up local file
        fs.unlinkSync(pdfPath)
      } catch (pdfError: any) {
        console.error('Failed to generate consent PDF:', pdfError)
        // Don't fail the request if PDF generation fails
      }
    }

    // Trigger Creditsafe Verify API check (non-blocking)
    // Checks Electoral Roll, CCJs, Insolvencies for tenant vetting
    if (creditsafeService.isEnabled()) {
      console.log('Triggering Creditsafe Verify check for reference:', updatedReference.id)

      // Build full address string for Creditsafe
      const fullAddress = [
        data.current_address_line1,
        data.current_address_line2,
        data.current_city
      ].filter(Boolean).join(', ')

      // Run verification in background - don't block the response
      creditsafeService.verifyIndividual({
        firstName: data.first_name,
        lastName: data.last_name,
        middleName: data.middle_name,
        dateOfBirth: data.date_of_birth,
        address: fullAddress,
        postcode: data.current_postcode
      }).then(async (verificationResult) => {
        console.log('Creditsafe verification completed:', verificationResult.status,
                    'Risk:', verificationResult.riskLevel,
                    'Score:', verificationResult.riskScore)

        // Store the verification result
        await creditsafeService.storeVerificationResult(
          updatedReference.id,
          {
            firstName: data.first_name,
            lastName: data.last_name,
            middleName: data.middle_name,
            dateOfBirth: data.date_of_birth,
            address: fullAddress,
            postcode: data.current_postcode
          },
          verificationResult
        )

        // Audit log for verification
        await auditReferenceAction(
          reference.company_id,
          'system', // System-initiated, not by specific user
          updatedReference.id,
          'verification.creditsafe_completed',
          `Creditsafe Verify check completed - Status: ${verificationResult.status}, Risk: ${verificationResult.riskLevel}`,
          {} as any,
          {
            status: verificationResult.status,
            riskLevel: verificationResult.riskLevel,
            riskScore: verificationResult.riskScore,
            ccjMatch: verificationResult.ccjMatch,
            electoralMatch: verificationResult.electoralRegisterMatch,
            transactionId: verificationResult.transactionId
          }
        )
      }).catch((error) => {
        console.error('Creditsafe verification failed:', error)
        // Log the error but don't fail the submission
        auditReferenceAction(
          reference.company_id,
          'system',
          updatedReference.id,
          'verification.creditsafe_failed',
          `Creditsafe verification failed: ${error.message}`,
          {} as any,
          { error: error.message }
        ).catch(console.error)
      })
    } else {
      console.log('Creditsafe verification is disabled, skipping')
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
    { name: 'proof_of_funds', maxCount: 1 },
    { name: 'proof_of_additional_income', maxCount: 1 },
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

    // Hash the token to look up the reference securely
    const tokenHash = hash(token)

    // Get reference by token hash
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('id, company_id')
      .eq('reference_token_hash', tokenHash)
      .gte('token_expires_at', new Date().toISOString())
      .single()

    if (refError || !reference) {
      return res.status(404).json({ error: 'Invalid or expired reference link' })
    }

    let idDocumentPath: string | null = null
    let selfiePath: string | null = null
    let proofOfAddressPath: string | null = null
    let proofOfFundsPath: string | null = null
    let proofOfAdditionalIncomePath: string | null = null
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

    // Upload proof of funds
    if (files.proof_of_funds && files.proof_of_funds[0]) {
      const file = files.proof_of_funds[0]
      const fileExt = file.originalname.split('.').pop()
      const fileName = `${reference.id}/proof_of_funds/${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('tenant-documents')
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        })

      if (uploadError) {
        throw new Error(`Failed to upload proof of funds: ${uploadError.message}`)
      }

      proofOfFundsPath = fileName
    }

    // Upload proof of additional income
    if (files.proof_of_additional_income && files.proof_of_additional_income[0]) {
      const file = files.proof_of_additional_income[0]
      const fileExt = file.originalname.split('.').pop()
      const fileName = `${reference.id}/proof_of_additional_income/${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('tenant-documents')
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        })

      if (uploadError) {
        throw new Error(`Failed to upload proof of additional income: ${uploadError.message}`)
      }

      proofOfAdditionalIncomePath = fileName
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
      proof_of_funds: proofOfFundsPath,
      proof_of_additional_income: proofOfAdditionalIncomePath,
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
    const tokenHash = hash(token)

    // Get reference by token hash
    const { data: reference, error } = await supabase
      .from('tenant_references')
      .select(`
        id,
        tenant_first_name_encrypted,
        tenant_last_name_encrypted,
        tenant_email_encrypted,
        property_address_encrypted,
        property_city_encrypted,
        property_postcode_encrypted,
        monthly_rent,
        move_in_date,
        submitted_at,
        status,
        company_id,
        companies:company_id (
          name_encrypted,
          logo_url,
          primary_color,
          button_color
        )
      `)
      .eq('reference_token_hash', tokenHash)
      .gte('token_expires_at', new Date().toISOString())
      .single()

    if (error) {
      console.error('Error fetching reference:', error)
      return res.status(404).json({ error: 'Invalid or expired reference link' })
    }

    if (!reference) {
      console.error('Reference not found for token hash')
      return res.status(404).json({ error: 'Invalid or expired reference link' })
    }

    // Decrypt fields for display
    const company = Array.isArray(reference.companies) ? reference.companies[0] : reference.companies
    const decryptedReference = {
      ...reference,
      tenant_first_name: decrypt((reference as any).tenant_first_name_encrypted),
      tenant_last_name: decrypt((reference as any).tenant_last_name_encrypted),
      tenant_email: decrypt((reference as any).tenant_email_encrypted),
      property_address: decrypt((reference as any).property_address_encrypted),
      property_city: decrypt((reference as any).property_city_encrypted),
      property_postcode: decrypt((reference as any).property_postcode_encrypted),
      company_name: company?.name_encrypted ? decrypt(company.name_encrypted) : ''
    }

    res.json({ reference: decryptedReference })
  } catch (error: any) {
    console.error('Exception in /view/:token:', error)
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
        tenant_first_name_encrypted,
        tenant_last_name_encrypted,
        employment_company_name_encrypted,
        employment_position_encrypted,
        employment_start_date,
        employment_contract_type,
        employment_salary_amount_encrypted,
        employment_salary_frequency,
        employer_ref_name_encrypted,
        employer_ref_email_encrypted,
        employer_ref_phone_encrypted,
        employer_ref_position,
        previous_landlord_name_encrypted,
        previous_landlord_email_encrypted,
        previous_landlord_phone_encrypted,
        previous_rental_address_line1_encrypted,
        previous_rental_address_line2_encrypted,
        previous_rental_city_encrypted,
        previous_rental_postcode_encrypted,
        previous_rental_country_encrypted,
        previous_tenancy_start_date,
        previous_tenancy_end_date,
        previous_monthly_rent_encrypted,
        previous_agency_name_encrypted,
        reference_type,
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

    // Decrypt tenant-provided information
    const tenantInfo = {
      // Tenant name
      tenantFirstName: reference.tenant_first_name_encrypted ? decrypt(reference.tenant_first_name_encrypted) : '',
      tenantLastName: reference.tenant_last_name_encrypted ? decrypt(reference.tenant_last_name_encrypted) : '',

      // Employer information
      companyName: reference.employment_company_name_encrypted ? decrypt(reference.employment_company_name_encrypted) : '',
      employeePosition: reference.employment_position_encrypted ? decrypt(reference.employment_position_encrypted) : '',
      employmentStartDate: reference.employment_start_date || '',
      employmentType: reference.employment_contract_type || '',
      annualSalary: reference.employment_salary_amount_encrypted ? decrypt(reference.employment_salary_amount_encrypted) : '',
      salaryFrequency: reference.employment_salary_frequency || 'annual',
      employerName: reference.employer_ref_name_encrypted ? decrypt(reference.employer_ref_name_encrypted) : '',
      employerEmail: reference.employer_ref_email_encrypted ? decrypt(reference.employer_ref_email_encrypted) : '',
      employerPhone: reference.employer_ref_phone_encrypted ? decrypt(reference.employer_ref_phone_encrypted) : '',
      employerPosition: reference.employer_ref_position || '',

      // Landlord/Agent information
      landlordName: reference.previous_landlord_name_encrypted ? decrypt(reference.previous_landlord_name_encrypted) : '',
      landlordEmail: reference.previous_landlord_email_encrypted ? decrypt(reference.previous_landlord_email_encrypted) : '',
      landlordPhone: reference.previous_landlord_phone_encrypted ? decrypt(reference.previous_landlord_phone_encrypted) : '',
      propertyAddress: reference.previous_rental_address_line1_encrypted ? decrypt(reference.previous_rental_address_line1_encrypted) : '',
      propertyAddress2: reference.previous_rental_address_line2_encrypted ? decrypt(reference.previous_rental_address_line2_encrypted) : '',
      propertyCity: reference.previous_rental_city_encrypted ? decrypt(reference.previous_rental_city_encrypted) : '',
      propertyPostcode: reference.previous_rental_postcode_encrypted ? decrypt(reference.previous_rental_postcode_encrypted) : '',
      propertyCountry: reference.previous_rental_country_encrypted ? decrypt(reference.previous_rental_country_encrypted) : '',
      tenancyStartDate: reference.previous_tenancy_start_date || '',
      tenancyEndDate: reference.previous_tenancy_end_date || '',
      monthlyRent: reference.previous_monthly_rent_encrypted ? decrypt(reference.previous_monthly_rent_encrypted) : '',
      agencyName: reference.previous_agency_name_encrypted ? decrypt(reference.previous_agency_name_encrypted) : '',
      referenceType: reference.reference_type || 'landlord'
    }

    res.json({
      branding: reference.companies,
      tenantInfo
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get company branding for accountant reference by token (public route)
router.get('/accountant/branding/:token', async (req, res) => {
  try {
    const { token } = req.params
    const tokenHash = hash(token)

    // Get the tenant_reference_id and accountant info using token hash
    const { data: accountantRef, error: accountantError } = await supabase
      .from('accountant_references')
      .select('tenant_reference_id, accountant_firm_encrypted, accountant_name_encrypted, accountant_email_encrypted, accountant_phone_encrypted')
      .eq('token_hash', tokenHash)
      .single()

    if (accountantError || !accountantRef) {
      return res.status(404).json({ error: 'Accountant reference not found' })
    }

    // Now fetch the branding and tenant info using the tenant_reference_id
    const { data: reference, error } = await supabase
      .from('tenant_references')
      .select(`
        company_id,
        self_employed_business_name_encrypted,
        self_employed_start_date,
        self_employed_nature_of_business_encrypted,
        self_employed_annual_income_encrypted,
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

    // Decrypt tenant-provided accountant and business information
    const tenantInfo = {
      accountantName: accountantRef.accountant_firm_encrypted ? decrypt(accountantRef.accountant_firm_encrypted) : '',
      accountantContactName: accountantRef.accountant_name_encrypted ? decrypt(accountantRef.accountant_name_encrypted) : '',
      accountantEmail: accountantRef.accountant_email_encrypted ? decrypt(accountantRef.accountant_email_encrypted) : '',
      accountantPhone: accountantRef.accountant_phone_encrypted ? decrypt(accountantRef.accountant_phone_encrypted) : '',
      businessName: reference.self_employed_business_name_encrypted ? decrypt(reference.self_employed_business_name_encrypted) : '',
      businessStartDate: reference.self_employed_start_date || '',
      natureOfBusiness: reference.self_employed_nature_of_business_encrypted ? decrypt(reference.self_employed_nature_of_business_encrypted) : '',
      estimatedIncome: reference.self_employed_annual_income_encrypted ? decrypt(reference.self_employed_annual_income_encrypted) : ''
    }

    res.json({
      branding: reference.companies,
      tenantInfo
    })
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
    const tokenHash = hash(token)

    // Check using token hash
    const { data: accountantRef } = await supabase
      .from('accountant_references')
      .select('id, submitted_at')
      .eq('token_hash', tokenHash)
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
    // Combine address lines if provided separately (frontend sends line1 and line2)
    const propertyAddress = formData.propertyAddress ||
      (formData.propertyAddressLine2
        ? `${formData.propertyAddressLine1}, ${formData.propertyAddressLine2}`
        : formData.propertyAddressLine1)

    const dbData = {
      reference_id: referenceId,
      landlord_name_encrypted: encrypt(formData.landlordName),
      landlord_email_encrypted: encrypt(formData.landlordEmail),
      landlord_phone_encrypted: encrypt(formData.landlordPhone),
      property_address_encrypted: encrypt(propertyAddress),
      property_city_encrypted: encrypt(formData.propertyCity || ''),
      property_postcode_encrypted: encrypt(formData.propertyPostcode || ''),
      tenancy_start_date: formData.tenancyStartDate,
      tenancy_end_date: formData.tenancyStillInProgress ? null : formData.tenancyEndDate,
      tenancy_still_in_progress: formData.tenancyStillInProgress || false,
      monthly_rent_encrypted: encrypt(formData.monthlyRent ? String(formData.monthlyRent) : null),
      address_correct: formData.addressCorrect,
      rent_paid_on_time: formData.rentPaidOnTime,
      good_tenant: formData.goodTenant,
      would_rent_again: formData.wouldRentAgain,
      additional_comments_encrypted: encrypt(formData.additionalComments || ''),
      signature_name_encrypted: encrypt(formData.signatureName),
      signature_encrypted: encrypt(formData.signature),
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
      agent_name_encrypted: encrypt(formData.agentName),
      agent_email_encrypted: encrypt(formData.agentEmail),
      agent_phone_encrypted: encrypt(formData.agentPhone),
      agency_name_encrypted: encrypt(formData.agencyName || ''),
      property_address_encrypted: encrypt(formData.propertyAddress),
      property_city_encrypted: encrypt(formData.propertyCity || ''),
      property_postcode_encrypted: encrypt(formData.propertyPostcode || ''),
      tenancy_start_date: formData.tenancyStartDate,
      tenancy_end_date: formData.tenancyEndDate,
      monthly_rent_encrypted: encrypt(formData.monthlyRent ? String(formData.monthlyRent) : null),
      rent_paid_on_time: formData.rentPaidOnTime,
      rent_paid_on_time_details_encrypted: encrypt(formData.rentPaidOnTimeDetails || ''),
      property_condition: formData.propertyCondition,
      property_condition_details_encrypted: encrypt(formData.propertyConditionDetails || ''),
      neighbour_complaints: formData.neighbourComplaints,
      neighbour_complaints_details_encrypted: encrypt(formData.neighbourComplaintsDetails || ''),
      breach_of_tenancy: formData.breachOfTenancy,
      breach_of_tenancy_details_encrypted: encrypt(formData.breachOfTenancyDetails || ''),
      would_rent_again: formData.wouldRentAgain,
      would_rent_again_details_encrypted: encrypt(formData.wouldRentAgainDetails || ''),
      additional_comments_encrypted: encrypt(formData.additionalComments || ''),
      signature_name_encrypted: encrypt(formData.signatureName),
      signature_encrypted: encrypt(formData.signature),
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
      company_name_encrypted: encrypt(formData.companyName),
      employer_name_encrypted: encrypt(formData.employerName),
      employer_position_encrypted: encrypt(formData.employerPosition),
      employer_email_encrypted: encrypt(formData.employerEmail),
      employer_phone_encrypted: encrypt(formData.employerPhone),
      employee_position_encrypted: encrypt(formData.employeePosition),
      employment_type: formData.employmentType,
      employment_start_date: formData.employmentStartDate,
      is_current_employee: formData.isCurrentEmployee,
      annual_salary_encrypted: encrypt(formData.annualSalary ? String(formData.annualSalary) : null),
      salary_frequency: formData.salaryFrequency,
      is_probation: formData.isProbation,
      employment_status: formData.employmentStatus,
      performance_rating: formData.performanceRating,
      performance_details_encrypted: encrypt(formData.performanceDetails || ''),
      disciplinary_issues: formData.disciplinaryIssues,
      disciplinary_details_encrypted: encrypt(formData.disciplinaryDetails || ''),
      absence_record: formData.absenceRecord,
      absence_details_encrypted: encrypt(formData.absenceDetails || ''),
      would_reemploy: formData.wouldReemploy,
      would_reemploy_details_encrypted: encrypt(formData.wouldReemployDetails || ''),
      additional_comments_encrypted: encrypt(formData.additionalComments || ''),
      signature_encrypted: encrypt(formData.signature),
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

    // Hash the token to look up securely
    const tokenHash = hash(token)

    // Verify accountant reference exists using token hash
    const { data: accountantRef, error: refError } = await supabase
      .from('accountant_references')
      .select('*, tenant_reference_id')
      .eq('token_hash', tokenHash)
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
        business_name_encrypted: encrypt(formData.businessName),
        nature_of_business_encrypted: encrypt(formData.natureOfBusiness || ''),
        business_start_date: formData.businessStartDate,
        annual_turnover_encrypted: encrypt(formData.annualTurnover ? String(formData.annualTurnover) : null),
        annual_profit_encrypted: encrypt(formData.annualProfit ? String(formData.annualProfit) : null),
        tax_returns_filed: formData.taxReturnsFiled,
        last_tax_return_date: formData.lastTaxReturnDate || null,
        accounts_prepared: formData.accountsPrepared,
        accounts_year_end: formData.accountsYearEnd || null,
        business_trading_status: formData.businessTradingStatus,
        any_outstanding_tax_liabilities: formData.anyOutstandingTaxLiabilities,
        tax_liabilities_details_encrypted: encrypt(formData.taxLiabilitiesDetails || ''),
        business_financially_stable: formData.businessFinanciallyStable,
        accountant_confirms_income: formData.accountantConfirmsIncome,
        estimated_monthly_income_encrypted: encrypt(formData.estimatedMonthlyIncome ? String(formData.estimatedMonthlyIncome) : null),
        additional_comments_encrypted: encrypt(formData.additionalComments || ''),
        would_recommend: formData.wouldRecommend,
        recommendation_comments_encrypted: encrypt(formData.recommendationComments || ''),
        signature_encrypted: encrypt(formData.signature),
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
// Download consent PDF from reference-documents bucket
router.get('/download/consent-pdfs/:referenceId/:filename', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const { referenceId, filename } = req.params
    const filePath = `consent-pdfs/${referenceId}/${filename}`

    // Get user's company (use limit(1) to handle duplicates)
    const { data: companyUsers } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)

    if (!companyUsers || companyUsers.length === 0) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const companyUser = companyUsers[0]

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

    // Download file from reference-documents storage bucket
    const { data, error: downloadError } = await supabase.storage
      .from('reference-documents')
      .download(filePath)

    if (downloadError) {
      return res.status(404).json({ error: 'File not found' })
    }

    // Set content type for PDF
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`)

    const buffer = Buffer.from(await data.arrayBuffer())
    res.send(buffer)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/download/:referenceId/:folder/:filename', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const { referenceId, folder, filename } = req.params
    const filePath = `${referenceId}/${folder}/${filename}`

    // Get user's company (use limit(1) to handle duplicates)
    const { data: companyUsers } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)

    if (!companyUsers || companyUsers.length === 0) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const companyUser = companyUsers[0]

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

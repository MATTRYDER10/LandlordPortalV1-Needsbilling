import { Router } from 'express'
import { authenticateStaff, StaffAuthRequest } from '../middleware/staffAuth'
import { supabase } from '../config/supabase'
import { decrypt, encrypt } from '../services/encryption'
import { creditsafeService, VerificationRequest } from '../services/creditsafeService'
import { sanctionsService } from '../services/sanctionsService'

const router = Router()

// Get all references across all companies (for staff dashboard)
router.get('/references', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { status, company_id, search } = req.query

    let query = supabase
      .from('tenant_references')
      .select(`
        *,
        companies:company_id (
          id,
          name_encrypted
        )
      `)
      .neq('is_group_parent', true) // Exclude parent multi-tenant references from staff view
      .order('created_at', { ascending: false })

    // Filter by status if provided
    if (status && typeof status === 'string') {
      query = query.eq('status', status)
    }

    // Filter by company if provided
    if (company_id && typeof company_id === 'string') {
      query = query.eq('company_id', company_id)
    }

    // Search by tenant name or email
    if (search && typeof search === 'string') {
      query = query.or(`tenant_first_name.ilike.%${search}%,tenant_last_name.ilike.%${search}%,tenant_email.ilike.%${search}%`)
    }

    const { data: references, error } = await query

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // Decrypt tenant reference fields for list view
    const decryptedReferences = references?.map(ref => ({
      ...ref,
      companies: ref.companies ? {
        ...ref.companies,
        name: decrypt(ref.companies.name_encrypted)
      } : null,
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

// Get chase list - references with missing responses that need follow-up
router.get('/chase-list', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    // Get all submitted references that aren't completed or verified
    const { data: references, error } = await supabase
      .from('tenant_references')
      .select(`
        *,
        companies:company_id (
          id,
          name_encrypted
        )
      `)
      .not('submitted_at', 'is', null) // Only submitted references
      .neq('is_group_parent', true) // Exclude parent multi-tenant references
      .in('status', ['in_progress', 'pending_verification']) // Not completed yet
      .order('created_at', { ascending: true }) // Oldest first for chasing

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // For each reference, check which responses are missing
    const chaseItems = await Promise.all(references.map(async (ref) => {
      const missingResponses: string[] = []
      const contactsToChase: Array<{type: string, name: string, email: string, phone?: string, sentDate?: string}> = []

      // Check for landlord reference
      if (!ref.income_self_employed) { // Only if not self-employed, as they need residential reference
        const { data: landlordRef } = await supabase
          .from('landlord_references')
          .select('submitted_at, landlord_name_encrypted, landlord_email_encrypted, landlord_phone_encrypted, created_at')
          .eq('reference_id', ref.id)
          .maybeSingle()

        const { data: agentRef } = await supabase
          .from('agent_references')
          .select('submitted_at, agent_name_encrypted, agent_email_encrypted, agent_phone_encrypted, created_at')
          .eq('reference_id', ref.id)
          .maybeSingle()

        // If neither landlord nor agent has responded
        if ((!landlordRef || !landlordRef.submitted_at) && (!agentRef || !agentRef.submitted_at)) {
          missingResponses.push('Residential Reference (Landlord/Agent)')

          // If landlordRef exists (email sent), use that
          if (landlordRef) {
            contactsToChase.push({
              type: 'Landlord',
              name: (decrypt(landlordRef.landlord_name_encrypted) || '') as string,
              email: (decrypt(landlordRef.landlord_email_encrypted) || '') as string,
              phone: (decrypt(landlordRef.landlord_phone_encrypted) || undefined) as string | undefined,
              sentDate: landlordRef.created_at
            })
          }
          // Otherwise, check if tenant provided landlord details (but email not sent yet)
          else if (ref.previous_landlord_name_encrypted && ref.previous_landlord_email_encrypted) {
            contactsToChase.push({
              type: 'Landlord',
              name: (decrypt(ref.previous_landlord_name_encrypted) || '') as string,
              email: (decrypt(ref.previous_landlord_email_encrypted) || '') as string,
              phone: (decrypt(ref.previous_landlord_phone_encrypted) || undefined) as string | undefined,
              sentDate: undefined
            })
          }

          // If agentRef exists (email sent), use that
          if (agentRef) {
            contactsToChase.push({
              type: 'Agent',
              name: (decrypt(agentRef.agent_name_encrypted) || '') as string,
              email: (decrypt(agentRef.agent_email_encrypted) || '') as string,
              phone: (decrypt(agentRef.agent_phone_encrypted) || undefined) as string | undefined,
              sentDate: agentRef.created_at
            })
          }
          // Otherwise, check if tenant provided agent details (but email not sent yet)
          else if (ref.previous_agency_name && ref.previous_landlord_email_encrypted && ref.reference_type === 'agent') {
            contactsToChase.push({
              type: 'Agent',
              name: ref.previous_agency_name,
              email: (decrypt(ref.previous_landlord_email_encrypted) || '') as string,
              phone: (decrypt(ref.previous_landlord_phone_encrypted) || undefined) as string | undefined,
              sentDate: undefined
            })
          }
        }
      }

      // Check for employer reference (if employed)
      if (ref.income_employment && !ref.income_self_employed) {
        const { data: employerRef } = await supabase
          .from('employer_references')
          .select('submitted_at, employer_name_encrypted, employer_email_encrypted, employer_phone_encrypted, created_at')
          .eq('reference_id', ref.id)
          .maybeSingle()

        if (!employerRef || !employerRef.submitted_at) {
          missingResponses.push('Employment Reference')

          // If employerRef exists (email sent), use that
          if (employerRef) {
            contactsToChase.push({
              type: 'Employer',
              name: (decrypt(employerRef.employer_name_encrypted) || '') as string,
              email: (decrypt(employerRef.employer_email_encrypted) || '') as string,
              phone: (decrypt(employerRef.employer_phone_encrypted) || undefined) as string | undefined,
              sentDate: employerRef.created_at
            })
          }
          // Otherwise, check if tenant provided employer details (but email not sent yet)
          else if (ref.employer_ref_name_encrypted && ref.employer_ref_email_encrypted) {
            contactsToChase.push({
              type: 'Employer',
              name: (decrypt(ref.employer_ref_name_encrypted) || '') as string,
              email: (decrypt(ref.employer_ref_email_encrypted) || '') as string,
              phone: (decrypt(ref.employer_ref_phone_encrypted) || undefined) as string | undefined,
              sentDate: undefined
            })
          }
        }
      }

      // Check for accountant reference (if self-employed)
      if (ref.income_self_employed) {
        const { data: accountantRef } = await supabase
          .from('accountant_references')
          .select('submitted_at, accountant_name_encrypted, accountant_email_encrypted, accountant_phone_encrypted, created_at')
          .eq('tenant_reference_id', ref.id)
          .maybeSingle()

        if (!accountantRef || !accountantRef.submitted_at) {
          missingResponses.push('Accountant Reference')

          // If accountantRef exists (email sent), use that
          if (accountantRef) {
            contactsToChase.push({
              type: 'Accountant',
              name: (decrypt(accountantRef.accountant_name_encrypted) || '') as string,
              email: (decrypt(accountantRef.accountant_email_encrypted) || '') as string,
              phone: (decrypt(accountantRef.accountant_phone_encrypted) || undefined) as string | undefined,
              sentDate: accountantRef.created_at
            })
          }
          // Otherwise, check if tenant provided accountant details (but email not sent yet)
          else if (ref.accountant_name_encrypted && ref.accountant_email_encrypted) {
            contactsToChase.push({
              type: 'Accountant',
              name: (decrypt(ref.accountant_name_encrypted) || '') as string,
              email: (decrypt(ref.accountant_email_encrypted) || '') as string,
              phone: (decrypt(ref.accountant_phone_encrypted) || undefined) as string | undefined,
              sentDate: undefined
            })
          }
        }
      }

      // Check for guarantor reference (if required)
      if (ref.requires_guarantor) {
        const { data: guarantorRef } = await supabase
          .from('guarantor_references')
          .select('submitted_at, guarantor_first_name_encrypted, guarantor_last_name_encrypted, email_encrypted, contact_number_encrypted, created_at')
          .eq('reference_id', ref.id)
          .maybeSingle()

        if (!guarantorRef || !guarantorRef.submitted_at) {
          missingResponses.push('Guarantor Reference')

          // If guarantorRef exists (email sent), use that
          if (guarantorRef) {
            contactsToChase.push({
              type: 'Guarantor',
              name: (`${decrypt(guarantorRef.guarantor_first_name_encrypted) || ''} ${decrypt(guarantorRef.guarantor_last_name_encrypted) || ''}`.trim()) as string,
              email: (decrypt(guarantorRef.email_encrypted) || '') as string,
              phone: (decrypt(guarantorRef.contact_number_encrypted) || undefined) as string | undefined,
              sentDate: guarantorRef.created_at
            })
          }
          // Otherwise, check if tenant provided guarantor details (but email not sent yet)
          else if (ref.guarantor_first_name_encrypted && ref.guarantor_email_encrypted) {
            contactsToChase.push({
              type: 'Guarantor',
              name: (`${decrypt(ref.guarantor_first_name_encrypted) || ''} ${decrypt(ref.guarantor_last_name_encrypted) || ''}`.trim()) as string,
              email: (decrypt(ref.guarantor_email_encrypted) || '') as string,
              phone: (decrypt(ref.guarantor_phone_encrypted) || undefined) as string | undefined,
              sentDate: undefined
            })
          }
        }
      }

      // Only return references that have missing responses
      if (missingResponses.length > 0) {
        return {
          id: ref.id,
          tenant_name: `${decrypt(ref.tenant_first_name_encrypted)} ${decrypt(ref.tenant_last_name_encrypted)}`,
          tenant_email: decrypt(ref.tenant_email_encrypted),
          property_address: decrypt(ref.property_address_encrypted),
          submitted_at: ref.submitted_at,
          created_at: ref.created_at,
          status: ref.status,
          company: ref.companies ? {
            id: ref.companies.id,
            name: decrypt(ref.companies.name_encrypted)
          } : null,
          missing_responses: missingResponses,
          contacts_to_chase: contactsToChase,
          days_pending: Math.floor((new Date().getTime() - new Date(ref.submitted_at).getTime()) / (1000 * 60 * 60 * 24))
        }
      }
      return null
    }))

    // Filter out null entries and sort by days pending (oldest first)
    const filteredChaseItems = chaseItems
      .filter(item => item !== null)
      .sort((a, b) => (b?.days_pending || 0) - (a?.days_pending || 0))

    res.json({
      chase_items: filteredChaseItems,
      total_count: filteredChaseItems.length
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get single reference with full details
router.get('/references/:id', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params

    // Get reference
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select(`
        *,
        companies:company_id (
          id,
          name_encrypted
        )
      `)
      .eq('id', id)
      .single()

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Get landlord reference if exists
    let { data: landlordReference } = await supabase
      .from('landlord_references')
      .select('*')
      .eq('reference_id', id)
      .single()

    // Get agent reference if exists
    let { data: agentReference } = await supabase
      .from('agent_references')
      .select('*')
      .eq('reference_id', id)
      .single()

    // Get employer reference if exists
    const { data: employerReference } = await supabase
      .from('employer_references')
      .select('*')
      .eq('reference_id', id)
      .single()

    // Get accountant reference if exists
    let { data: accountantReference } = await supabase
      .from('accountant_references')
      .select('*')
      .eq('tenant_reference_id', id)
      .single()

    // Get guarantor reference if exists
    const { data: guarantorReference } = await supabase
      .from('guarantor_references')
      .select('*')
      .eq('reference_id', id)
      .single()

    // If this is a child reference and no landlord/agent/accountant ref found, check siblings
    if (reference.parent_reference_id && (!landlordReference && !agentReference && !accountantReference)) {
      // Get all sibling references
      const { data: siblings } = await supabase
        .from('tenant_references')
        .select('id')
        .eq('parent_reference_id', reference.parent_reference_id)
        .neq('id', id)

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

    // Get documents
    const { data: documents } = await supabase
      .from('reference_documents')
      .select('*')
      .eq('reference_id', id)

    // Get previous addresses for 3-year history
    const { data: previousAddresses } = await supabase
      .from('tenant_reference_previous_addresses')
      .select('*')
      .eq('tenant_reference_id', id)
      .order('address_order', { ascending: true })

    // Helper function to decrypt tenant reference fields
    const decryptTenantReference = (ref: any) => {
      if (!ref) return ref
      return {
        ...ref,
        companies: ref.companies ? {
          ...ref.companies,
          name: decrypt(ref.companies.name_encrypted)
        } : null,
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
        benefits_monthly_amount: decrypt(ref.benefits_monthly_amount_encrypted),
        benefits_annual_amount: decrypt(ref.benefits_annual_amount_encrypted),
        savings_amount: decrypt(ref.savings_amount_encrypted),
        additional_income_type: ref.additional_income_type, // Not encrypted - 'income' or 'savings'
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
        previous_tenancy_start_date: ref.previous_tenancy_start_date, // Not encrypted
        previous_tenancy_end_date: ref.previous_tenancy_end_date, // Not encrypted
        previous_tenancy_still_in_progress: ref.previous_tenancy_still_in_progress, // Not encrypted
        accountant_name: decrypt(ref.accountant_firm_encrypted),
        accountant_contact_name: decrypt(ref.accountant_name_encrypted),
        accountant_email: decrypt(ref.accountant_email_encrypted),
        accountant_phone: decrypt(ref.accountant_phone_encrypted),
        tax_return_path: ref.tax_return_path, // Not encrypted - file path
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
    const decryptedPreviousAddresses = previousAddresses?.map(decryptPreviousAddress)

    const decryptedLandlordReference = landlordReference ? {
      ...landlordReference,
      landlord_name: decrypt(landlordReference.landlord_name_encrypted),
      landlord_email: decrypt(landlordReference.landlord_email_encrypted),
      landlord_phone: decrypt(landlordReference.landlord_phone_encrypted),
      property_address: decrypt(landlordReference.property_address_encrypted),
      property_city: decrypt(landlordReference.property_city_encrypted),
      property_postcode: decrypt(landlordReference.property_postcode_encrypted),
      address_correct: landlordReference.address_correct,
      corrected_address_line1: decrypt(landlordReference.corrected_address_line1_encrypted),
      corrected_address_line2: decrypt(landlordReference.corrected_address_line2_encrypted),
      corrected_city: decrypt(landlordReference.corrected_city_encrypted),
      corrected_postcode: decrypt(landlordReference.corrected_postcode_encrypted),
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
      address_correct: agentReference.address_correct,
      corrected_address_line1: decrypt(agentReference.corrected_address_line1_encrypted),
      corrected_address_line2: decrypt(agentReference.corrected_address_line2_encrypted),
      corrected_city: decrypt(agentReference.corrected_city_encrypted),
      corrected_postcode: decrypt(agentReference.corrected_postcode_encrypted),
      monthly_rent: decrypt(agentReference.monthly_rent_encrypted),
      rent_paid_on_time: agentReference.rent_paid_on_time,
      good_tenant: agentReference.good_tenant,
      would_rent_again: agentReference.would_rent_again,
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

    const decryptedGuarantorReference = guarantorReference ? {
      ...guarantorReference,
      guarantor_first_name: decrypt(guarantorReference.guarantor_first_name_encrypted),
      guarantor_last_name: decrypt(guarantorReference.guarantor_last_name_encrypted),
      middle_name: decrypt(guarantorReference.middle_name_encrypted),
      date_of_birth: decrypt(guarantorReference.date_of_birth_encrypted),
      contact_number: decrypt(guarantorReference.contact_number_encrypted),
      email: decrypt(guarantorReference.email_encrypted),
      nationality: decrypt(guarantorReference.nationality_encrypted),
      current_address_line1: decrypt(guarantorReference.current_address_line1_encrypted),
      current_address_line2: decrypt(guarantorReference.current_address_line2_encrypted),
      current_city: decrypt(guarantorReference.current_city_encrypted),
      current_postcode: decrypt(guarantorReference.current_postcode_encrypted),
      current_country: decrypt(guarantorReference.current_country_encrypted),
      employer_name: decrypt(guarantorReference.employer_name_encrypted),
      job_title: decrypt(guarantorReference.job_title_encrypted),
      annual_income: decrypt(guarantorReference.annual_income_encrypted),
      business_name: decrypt(guarantorReference.business_name_encrypted),
      nature_of_business: decrypt(guarantorReference.nature_of_business_encrypted),
      annual_turnover: decrypt(guarantorReference.annual_turnover_encrypted),
      pension_amount: decrypt(guarantorReference.pension_amount_encrypted),
      other_income_source: decrypt(guarantorReference.other_income_source_encrypted),
      other_income_amount: decrypt(guarantorReference.other_income_amount_encrypted),
      savings_amount: decrypt(guarantorReference.savings_amount_encrypted),
      property_value: decrypt(guarantorReference.property_value_encrypted),
      other_assets: decrypt(guarantorReference.other_assets_encrypted),
      monthly_mortgage_rent: decrypt(guarantorReference.monthly_mortgage_rent_encrypted),
      other_monthly_commitments: decrypt(guarantorReference.other_monthly_commitments_encrypted),
      total_monthly_expenditure: decrypt(guarantorReference.total_monthly_expenditure_encrypted),
      adverse_credit_details: decrypt(guarantorReference.adverse_credit_details_encrypted),
      previous_guarantor_details: decrypt(guarantorReference.previous_guarantor_details_encrypted),
      additional_comments: decrypt(guarantorReference.additional_comments_encrypted)
    } : null

    res.json({
      reference: decryptedReference,
      landlordReference: decryptedLandlordReference,
      agentReference: decryptedAgentReference,
      employerReference: decryptedEmployerReference,
      accountantReference: decryptedAccountantReference,
      guarantorReference: decryptedGuarantorReference,
      previousAddresses: decryptedPreviousAddresses || [],
      documents
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Verify and complete a reference
router.put('/references/:id/verify', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params
    const { notes } = req.body
    const staffUserId = req.staffUser?.id

    // Update reference status to completed
    const { data: reference, error } = await supabase
      .from('tenant_references')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        verified_by: staffUserId,
        verified_at: new Date().toISOString(),
        verification_notes_encrypted: encrypt(notes || '')
      })
      .eq('id', id)
      .eq('status', 'pending_verification') // Only allow verification if status is pending_verification
      .select()
      .single()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    if (!reference) {
      return res.status(404).json({ error: 'Reference not found or already verified' })
    }

    res.json({
      message: 'Reference verified successfully',
      reference
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Reject a reference (set back to in_progress for corrections)
router.put('/references/:id/reject', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params
    const { notes } = req.body
    const staffUserId = req.staffUser?.id

    if (!notes) {
      return res.status(400).json({ error: 'Rejection notes are required' })
    }

    // Update reference status to rejected
    // Allow rejection from pending_verification, in_progress, or pending statuses
    const { data: reference, error } = await supabase
      .from('tenant_references')
      .update({
        status: 'rejected',
        verified_by: staffUserId,
        verified_at: new Date().toISOString(),
        verification_notes_encrypted: encrypt(notes || '')
      })
      .eq('id', id)
      .in('status', ['pending_verification', 'in_progress', 'pending'])
      .select()
      .single()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    if (!reference) {
      return res.status(404).json({ error: 'Reference not found or already processed' })
    }

    // If this is a parent reference, also reject all children
    if (reference.is_group_parent) {
      await supabase
        .from('tenant_references')
        .update({
          status: 'rejected',
          verified_by: staffUserId,
          verified_at: new Date().toISOString(),
          verification_notes_encrypted: encrypt(notes || '')
        })
        .eq('parent_reference_id', id)
        .in('status', ['pending_verification', 'in_progress', 'pending'])
    }

    res.json({
      message: 'Reference rejected and sent back for corrections',
      reference
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get staff dashboard stats
router.get('/stats', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    // Count references by status (excluding parent multi-tenant references)
    const { data: stats, error } = await supabase
      .from('tenant_references')
      .select('status')
      .neq('is_group_parent', true) // Exclude parent multi-tenant references from stats

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    const statusCounts = stats.reduce((acc: any, ref: any) => {
      acc[ref.status] = (acc[ref.status] || 0) + 1
      return acc
    }, {})

    res.json({ stats: statusCounts })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Download file from reference (staff authenticated route)
router.get('/download/:referenceId/:folder/:filename', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { referenceId, folder, filename } = req.params

    // Verify the reference exists (staff can access all references)
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('id')
      .eq('id', referenceId)
      .single()

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Construct file path
    const filePath = `${referenceId}/${folder}/${filename}`

    // Download file from storage
    const { data, error: downloadError } = await supabase.storage
      .from('tenant-documents')
      .download(filePath)

    if (downloadError) {
      return res.status(404).json({ error: 'File not found' })
    }

    // Set content type based on file extension
    const ext = filename.split('.').pop()?.toLowerCase()
    const contentTypes: { [key: string]: string } = {
      'pdf': 'application/pdf',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp'
    }
    const contentType = contentTypes[ext || ''] || 'application/octet-stream'

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`)

    // Convert blob to buffer and send
    const buffer = Buffer.from(await data.arrayBuffer())
    res.send(buffer)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get Creditsafe verification results for a reference
router.get('/references/:id/creditsafe', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const referenceId = req.params.id

    // Verify reference exists
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('id, company_id')
      .eq('id', referenceId)
      .single()

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Get Creditsafe verification result
    const verification = await creditsafeService.getVerificationResult(referenceId)

    if (!verification) {
      return res.status(404).json({ error: 'No Creditsafe verification found for this reference' })
    }

    res.json({ verification })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Manually trigger Creditsafe verification for a reference (retry)
router.post('/references/:id/creditsafe/retry', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const referenceId = req.params.id
    const staffUserId = req.staffUser?.id

    if (!creditsafeService.isEnabled()) {
      return res.status(400).json({ error: 'Creditsafe verification is not enabled' })
    }

    // Get reference data
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('*')
      .eq('id', referenceId)
      .single()

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Verify that tenant has submitted the reference
    if (!reference.submitted_at) {
      return res.status(400).json({ error: 'Cannot verify - tenant has not yet submitted the reference' })
    }

    // Prepare verification request for Creditsafe Verify API
    const addressLine1 = reference.current_address_line1_encrypted ? decrypt(reference.current_address_line1_encrypted) || '' : ''
    const addressLine2 = reference.current_address_line2_encrypted ? decrypt(reference.current_address_line2_encrypted) || '' : ''
    const city = reference.current_city_encrypted ? decrypt(reference.current_city_encrypted) || '' : ''

    // Build full address string
    const fullAddress = [addressLine1, addressLine2, city].filter(Boolean).join(', ')

    const verificationRequest: VerificationRequest = {
      firstName: (decrypt(reference.tenant_first_name_encrypted) || '') as string,
      lastName: (decrypt(reference.tenant_last_name_encrypted) || '') as string,
      middleName: reference.middle_name_encrypted ? (decrypt(reference.middle_name_encrypted) || undefined) : undefined,
      dateOfBirth: (reference.date_of_birth_encrypted ? decrypt(reference.date_of_birth_encrypted) || '' : '') as string,
      address: fullAddress,
      postcode: (reference.current_postcode_encrypted ? decrypt(reference.current_postcode_encrypted) || '' : '') as string
    }

    // Run verification using Creditsafe Verify API
    const verificationResult = await creditsafeService.verifyIndividual(verificationRequest)

    // Check if verification already exists, delete if so (to allow retry)
    const { data: existingVerification } = await supabase
      .from('creditsafe_verifications')
      .select('id')
      .eq('reference_id', referenceId)
      .single()

    if (existingVerification) {
      await supabase
        .from('creditsafe_verifications')
        .delete()
        .eq('id', existingVerification.id)
    }

    // Store new verification result
    const verificationId = await creditsafeService.storeVerificationResult(
      referenceId,
      verificationRequest,
      verificationResult,
      staffUserId
    )

    if (!verificationId) {
      return res.status(500).json({ error: 'Failed to store verification result' })
    }

    res.json({
      message: 'Creditsafe verification completed',
      verification: {
        id: verificationId,
        status: verificationResult.status,
        riskScore: verificationResult.riskScore,
        riskLevel: verificationResult.riskLevel,
        verifyMatch: verificationResult.verifyMatch,
        ccjMatch: verificationResult.ccjMatch,
        electoralRegisterMatch: verificationResult.electoralRegisterMatch,
        insolvencyMatch: verificationResult.insolvencyMatch,
        deceasedRegisterMatch: verificationResult.deceasedRegisterMatch
      }
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get sanctions screening result for a reference
router.get('/references/:id/sanctions', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const referenceId = req.params.id

    // Verify reference exists
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('id, company_id')
      .eq('id', referenceId)
      .single()

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Get sanctions screening result
    const screening = await sanctionsService.getScreeningResult(referenceId)

    if (!screening) {
      return res.status(404).json({ error: 'No sanctions screening found for this reference' })
    }

    res.json({ screening })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router

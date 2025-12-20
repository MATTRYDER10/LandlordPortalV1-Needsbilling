import { Router } from 'express'
import multer from 'multer'
import crypto from 'crypto'
import { authenticateStaff, StaffAuthRequest } from '../middleware/staffAuth'
import { supabase } from '../config/supabase'
import { decrypt, encrypt, generateToken, hash } from '../services/encryption'
import { loadEmailTemplate, sendEmail } from '../services/emailService'
import { creditsafeService, VerificationRequest } from '../services/creditsafeService'
import { sanctionsService } from '../services/sanctionsService'
import {
  sendReferenceCompletedNotification,
  sendGuarantorReferenceRequest,
  sendLandlordReferenceRequest,
  sendAgentReferenceRequest,
  sendEmployerReferenceRequest,
  sendAccountantReferenceRequest,
  sendTenantAddGuarantorRequest
} from '../services/emailService'
import {
  sendGuarantorReferenceRequestSMS,
  sendLandlordReferenceRequestSMS,
  sendAgentReferenceRequestSMS,
  sendEmployerReferenceRequestSMS,
  sendAccountantReferenceRequestSMS
} from '../services/smsService'
import { logAuditAction } from '../services/auditService'
import {  reAssessApplicationScore, ReAssessmentPayload } from '../services/application-assesment/assessApplication'

const router = Router()

// Configure multer for staff file uploads (store in memory)
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

const parseEncryptedJsonField = (value?: string | null) => {
  if (!value) return null
  try {
    const decrypted = decrypt(value)
    if (!decrypted) return null
    return JSON.parse(decrypted)
  } catch (error) {
    console.error('Failed to parse encrypted JSON field:', error)
    return null
  }
}

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
      const tenantName = `${decrypt(ref.tenant_first_name_encrypted)} ${decrypt(ref.tenant_last_name_encrypted)}`
      console.log(`[Chase List] Processing reference ${ref.id} - Tenant: ${tenantName}, is_guarantor: ${ref.is_guarantor}, requires_guarantor: ${ref.requires_guarantor}`)

      const missingResponses: string[] = []
      const contactsToChase: Array<{type: string, name: string, email: string, phone?: string, sentDate?: string}> = []

      // Check for landlord reference
      // Skip if: self-employed (need accountant instead), is a guarantor, or homeowner (no landlord to reference)
      if (!ref.income_self_employed && !ref.is_guarantor && ref.home_ownership_status !== 'homeowner') {
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

          console.log(`[Chase List] Reference ${ref.id} missing residential - checking for contacts...`)
          console.log(`- landlordRef exists: ${!!landlordRef}`)
          console.log(`- agentRef exists: ${!!agentRef}`)
          console.log(`- Has previous_landlord_name: ${!!ref.previous_landlord_name_encrypted}`)
          console.log(`- Has previous_landlord_email: ${!!ref.previous_landlord_email_encrypted}`)

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

    // Also check standalone guarantor references from guarantor_references table
    const { data: guarantorReferences, error: guarantorError } = await supabase
      .from('guarantor_references')
      .select(`
        *,
        tenant_references!inner(
          id,
          tenant_first_name_encrypted,
          tenant_last_name_encrypted,
          property_address_encrypted,
          company_id,
          companies:company_id (
            id,
            name_encrypted
          )
        )
      `)
      .is('submitted_at', null) // Haven't completed yet (need to chase)
      .order('created_at', { ascending: true })

    if (!guarantorError && guarantorReferences) {
      for (const guarantorRef of guarantorReferences) {
        // Add guarantor as a chase item
        chaseItems.push({
          id: guarantorRef.reference_id,
          tenant_name: `${decrypt(guarantorRef.guarantor_first_name_encrypted)} ${decrypt(guarantorRef.guarantor_last_name_encrypted)} (Guarantor)`,
          tenant_email: decrypt(guarantorRef.email_encrypted),
          property_address: decrypt(guarantorRef.tenant_references.property_address_encrypted),
          submitted_at: guarantorRef.created_at,
          created_at: guarantorRef.created_at,
          status: 'in_progress',
          company: guarantorRef.tenant_references.companies ? {
            id: guarantorRef.tenant_references.companies.id,
            name: decrypt(guarantorRef.tenant_references.companies.name_encrypted)
          } : null,
          missing_responses: ['Guarantor Reference'],
          contacts_to_chase: [{
            type: 'Guarantor',
            name: `${decrypt(guarantorRef.guarantor_first_name_encrypted)} ${decrypt(guarantorRef.guarantor_last_name_encrypted)}`.trim(),
            email: decrypt(guarantorRef.email_encrypted) || '',
            phone: decrypt(guarantorRef.contact_number_encrypted) || undefined,
            sentDate: guarantorRef.created_at
          }],
          days_pending: Math.floor((new Date().getTime() - new Date(guarantorRef.created_at).getTime()) / (1000 * 60 * 60 * 24))
        })
      }
    }

    // Filter out null entries and sort by days pending (oldest first)
    const filteredChaseItems = chaseItems
      .filter(item => item !== null)
      .sort((a, b) => (b?.days_pending || 0) - (a?.days_pending || 0))

    // Get SMS cooldowns from the last 12 hours
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
    const { data: cooldowns } = await supabase
      .from('chase_sms_cooldowns')
      .select('reference_id, contact_type')
      .gte('sent_at', twelveHoursAgo)

    // Create a set of cooldown keys for quick lookup
    const cooldownSet = new Set(
      (cooldowns || []).map(c => `${c.reference_id}-${c.contact_type}`)
    )

    // Filter out contacts that are in SMS cooldown
    const itemsWithFilteredContacts = filteredChaseItems.map(item => {
      if (!item) return null
      const filteredContacts = item.contacts_to_chase.filter(
        (contact: { type: string }) => !cooldownSet.has(`${item.id}-${contact.type}`)
      )
      // If all contacts are in cooldown, hide the entire item
      if (filteredContacts.length === 0) return null
      return {
        ...item,
        contacts_to_chase: filteredContacts
      }
    }).filter(item => item !== null)

    res.json({
      chase_items: itemsWithFilteredContacts,
      total_count: itemsWithFilteredContacts.length
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

    // Get guarantor reference if exists (OLD SYSTEM - guarantor_references table)
    const { data: guarantorReference } = await supabase
      .from('guarantor_references')
      .select('*')
      .eq('reference_id', id)
      .single()

    // Get guarantor references (NEW SYSTEM - tenant_references with is_guarantor = true)
    const { data: guarantorReferences } = await supabase
      .from('tenant_references')
      .select('*')
      .eq('guarantor_for_reference_id', id)
      .eq('is_guarantor', true)
      .order('created_at', { ascending: true })

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
        submitted_ip_address: ref.submitted_ip_encrypted ? decrypt(ref.submitted_ip_encrypted) : null,
        submitted_geolocation: parseEncryptedJsonField(ref.submitted_geolocation_encrypted),
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
      signature: decrypt(landlordReference.signature_encrypted),
      submitted_ip_address: landlordReference.submitted_ip_encrypted ? decrypt(landlordReference.submitted_ip_encrypted) : null,
      submitted_geolocation: parseEncryptedJsonField(landlordReference.submitted_geolocation_encrypted)
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
      signature: decrypt(agentReference.signature_encrypted),
      submitted_ip_address: agentReference.submitted_ip_encrypted ? decrypt(agentReference.submitted_ip_encrypted) : null,
      submitted_geolocation: parseEncryptedJsonField(agentReference.submitted_geolocation_encrypted)
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
      signature: decrypt(accountantReference.signature_encrypted),
      submitted_ip_address: accountantReference.submitted_ip_encrypted ? decrypt(accountantReference.submitted_ip_encrypted) : null,
      submitted_geolocation: parseEncryptedJsonField(accountantReference.submitted_geolocation_encrypted)
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
      additional_comments: decrypt(guarantorReference.additional_comments_encrypted),
      submitted_ip_address: guarantorReference.submitted_ip_encrypted ? decrypt(guarantorReference.submitted_ip_encrypted) : null,
      submitted_geolocation: parseEncryptedJsonField(guarantorReference.submitted_geolocation_encrypted)
    } : null

    const { data: creditsafeVerification } = await supabase.from('creditsafe_verifications').select('*').eq('reference_id', reference.id).single()
    const { data: sanctionsScreening } = await supabase.from('sanctions_screenings').select('*').eq('reference_id', reference.id).single()
    const { data: score } = await supabase.from('reference_scores').select('*').eq('reference_id', reference.id).single()

    // Decrypt guarantor references (NEW SYSTEM)
    const decryptedGuarantorReferences = guarantorReferences?.map(decryptTenantReference) || []

    res.json({
      reference: decryptedReference,
      landlordReference: decryptedLandlordReference,
      agentReference: decryptedAgentReference,
      employerReference: decryptedEmployerReference,
      accountantReference: decryptedAccountantReference,
      guarantorReference: decryptedGuarantorReference,
      guarantorReferences: decryptedGuarantorReferences, // NEW SYSTEM
      previousAddresses: decryptedPreviousAddresses || [],
      documents,
      creditsafeVerification: creditsafeVerification,
      sanctionsScreening: sanctionsScreening,
      score: score,
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
      .select(`
        *,
        companies:company_id (
          id,
          name_encrypted,
          reference_notification_email
        )
      `)
      .single()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    if (!reference) {
      return res.status(404).json({ error: 'Reference not found or already verified' })
    }

    // Send email notification to the configured reference notification email
    try {
      const notificationEmail = reference.companies?.reference_notification_email

      if (notificationEmail) {
        const tenantName = decrypt(reference.tenant_name_encrypted) || 'Tenant'
        const propertyAddress = reference.property_address_encrypted
          ? decrypt(reference.property_address_encrypted) || 'N/A'
          : 'N/A'

        const companyName = reference.companies?.name_encrypted
          ? decrypt(reference.companies.name_encrypted) || 'Agent'
          : 'Agent'

        const dashboardLink = `${process.env.FRONTEND_URL || 'https://app.propertygoose.co.uk'}/dashboard/references/${reference.id}`

        await sendReferenceCompletedNotification(
          notificationEmail,
          companyName,
          tenantName,
          propertyAddress,
          dashboardLink,
          reference.completed_at || new Date().toISOString()
        )
      }
    } catch (emailError: any) {
      console.error('Error sending completion notification email:', emailError)
      // Don't fail the request if email fails
    }

    // Check if PASS_WITH_GUARANTOR and no guarantor assigned - send email to tenant
    try {
      // Get the score decision
      const { data: score } = await supabase
        .from('reference_scores')
        .select('decision')
        .eq('reference_id', id)
        .single()

      if (score?.decision === 'PASS_WITH_GUARANTOR') {
        // Check if guarantor already exists
        const { data: existingGuarantor } = await supabase
          .from('tenant_references')
          .select('id')
          .eq('guarantor_for_reference_id', id)
          .eq('is_guarantor', true)
          .maybeSingle()

        if (!existingGuarantor) {
          // Generate add-guarantor token
          const addGuarantorToken = generateToken()
          const addGuarantorTokenHash = hash(addGuarantorToken)
          const tokenExpiresAt = new Date()
          tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 14) // 14-day expiry

          // Save token to reference
          await supabase
            .from('tenant_references')
            .update({
              add_guarantor_token_hash: addGuarantorTokenHash,
              add_guarantor_token_expires_at: tokenExpiresAt.toISOString()
            })
            .eq('id', id)

          // Send email to tenant
          const tenantEmail = decrypt(reference.tenant_email_encrypted)
          const tenantFirstName = reference.tenant_first_name_encrypted
            ? decrypt(reference.tenant_first_name_encrypted) || ''
            : ''
          const tenantLastName = reference.tenant_last_name_encrypted
            ? decrypt(reference.tenant_last_name_encrypted) || ''
            : ''
          const tenantName = `${tenantFirstName} ${tenantLastName}`.trim() || 'Tenant'
          const propertyAddress = reference.property_address_encrypted
            ? decrypt(reference.property_address_encrypted) || 'the property'
            : 'the property'
          const companyName = reference.companies?.name_encrypted
            ? decrypt(reference.companies.name_encrypted) || 'Your agent'
            : 'Your agent'
          const formLink = `${process.env.FRONTEND_URL || 'https://app.propertygoose.co.uk'}/tenant-add-guarantor/${addGuarantorToken}`

          if (tenantEmail) {
            await sendTenantAddGuarantorRequest(
              tenantEmail,
              tenantName,
              propertyAddress,
              companyName,
              formLink,
              id
            )
            console.log('Sent tenant add guarantor email to:', tenantEmail)
          }
        }
      }
    } catch (guarantorEmailError: any) {
      console.error('Error sending tenant add guarantor email:', guarantorEmailError)
      // Don't fail the verification if email fails
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

// Download guarantor document (from reference-documents bucket)
router.get('/download-guarantor/:guarantorId/:filename', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { guarantorId, filename } = req.params

    // Verify the guarantor reference exists
    const { data: guarantorRef, error: refError } = await supabase
      .from('guarantor_references')
      .select('id, reference_id')
      .eq('id', guarantorId)
      .single()

    if (refError || !guarantorRef) {
      return res.status(404).json({ error: 'Guarantor reference not found' })
    }

    // Construct file path (guarantor-documents/{guarantorId}/{filename})
    const filePath = `guarantor-documents/${guarantorId}/${filename}`

    // Download file from reference-documents storage bucket
    const { data, error: downloadError } = await supabase.storage
      .from('reference-documents')
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

    // Debug: Log the data being sent to Creditsafe
    console.log('Running Creditsafe test check for:', `${verificationRequest.firstName} ${verificationRequest.lastName}`)
    console.log('Creditsafe request data:', {
      firstName: verificationRequest.firstName,
      lastName: verificationRequest.lastName,
      dateOfBirth: verificationRequest.dateOfBirth,
      postcode: verificationRequest.postcode,
      addressLength: verificationRequest.address?.length || 0
    })

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

// Manually trigger sanctions screening for a reference
router.post('/references/:id/sanctions/run', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const referenceId = req.params.id
    const staffUserId = req.staffUser?.id

    if (!sanctionsService.isEnabled()) {
      return res.status(400).json({ error: 'Sanctions screening is not enabled' })
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
      return res.status(400).json({ error: 'Cannot screen - tenant has not yet submitted the reference' })
    }

    // Prepare screening request
    const firstName = reference.tenant_first_name_encrypted ? decrypt(reference.tenant_first_name_encrypted) || '' : ''
    const lastName = reference.tenant_last_name_encrypted ? decrypt(reference.tenant_last_name_encrypted) || '' : ''
    const dateOfBirth = reference.date_of_birth_encrypted ? decrypt(reference.date_of_birth_encrypted) || '' : ''
    const postcode = reference.current_postcode_encrypted ? decrypt(reference.current_postcode_encrypted) || '' : ''

    // Run screening
    const screeningResult = await sanctionsService.screenTenant({
      name: `${firstName} ${lastName}`,
      dateOfBirth: dateOfBirth,
      postcode: postcode
    })

    // Check if screening already exists, delete if so (to allow re-run)
    const { data: existingScreening } = await supabase
      .from('sanctions_screenings')
      .select('id')
      .eq('reference_id', referenceId)
      .single()

    if (existingScreening) {
      await supabase
        .from('sanctions_screenings')
        .delete()
        .eq('id', existingScreening.id)
    }

    // Store new screening result
    await sanctionsService.storeScreeningResult(
      referenceId,
      {
        name: `${firstName} ${lastName}`,
        dateOfBirth: dateOfBirth,
        postcode: postcode
      },
      screeningResult
    )

    res.json({
      message: 'Sanctions screening completed',
      screening: {
        risk_level: screeningResult.risk_level,
        total_matches: screeningResult.total_matches,
        sanctions_matches: screeningResult.sanctions_matches.length,
        donation_matches: screeningResult.donation_matches.length,
        summary: screeningResult.summary
      }
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Re-assess application score
router.post('/references/:id/re-assess', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const referenceId = req.params.id
    const payload: ReAssessmentPayload = req.body

    if(!referenceId) {
      return res.status(400).json({ error: 'Reference ID is required' })
    }

    if (!payload) {
      return res.status(400).json({ error: 'Invalid payload' })
    }

    const result = await reAssessApplicationScore(referenceId, 'Staff', payload)
    if (!result) {
      return res.status(500).json({ error: 'Failed to re-assess application score' })
    }
    
    res.json({
      message: 'Application score re-assessed successfully',
      result
    })

  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to re-assess application score' })
  }
})

// Send chase reminder (email or SMS) for a specific contact type
router.post('/chase/:referenceId/send-reminder', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { referenceId } = req.params
    const { contactType, method, newEmail } = req.body as { contactType: string; method: 'email' | 'sms'; newEmail?: string }
    const staffUser = req.staffUser

    if (!contactType || !method) {
      return res.status(400).json({ error: 'contactType and method are required' })
    }

    if (!['Guarantor', 'Landlord', 'Agent', 'Employer', 'Accountant'].includes(contactType)) {
      return res.status(400).json({ error: 'Invalid contact type' })
    }

    if (!['email', 'sms'].includes(method)) {
      return res.status(400).json({ error: 'Method must be email or sms' })
    }

    // Validate new email if provided
    if (newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return res.status(400).json({ error: 'Invalid email format' })
    }

    // Get the reference
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('*')
      .eq('id', referenceId)
      .single()

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Get company info
    const { data: companyData } = await supabase
      .from('companies')
      .select('name_encrypted, phone_encrypted, email_encrypted')
      .eq('id', reference.company_id)
      .single()

    const tenantName = `${decrypt(reference.tenant_first_name_encrypted) || ''} ${decrypt(reference.tenant_last_name_encrypted) || ''}`.trim()
    const propertyAddress = decrypt(reference.property_address_encrypted) || ''
    const companyName = companyData?.name_encrypted ? decrypt(companyData.name_encrypted) || '' : ''
    const companyPhone = companyData?.phone_encrypted ? decrypt(companyData.phone_encrypted) || '' : ''
    const companyEmail = companyData?.email_encrypted ? decrypt(companyData.email_encrypted) || '' : ''

    let contactEmail = ''
    let contactPhone = ''
    let contactName = ''
    let formLink = ''
    let smsResult: { success: boolean; error?: string } | null = null

    // Handle each contact type
    switch (contactType) {
      case 'Guarantor': {
        // Try to get guarantor from guarantor_references table (legacy)
        const { data: guarantorRefLegacy } = await supabase
          .from('guarantor_references')
          .select('id, reference_token_hash, guarantor_first_name_encrypted, guarantor_last_name_encrypted, email_encrypted, contact_number_encrypted')
          .eq('reference_id', referenceId)
          .maybeSingle()

        // Try to get guarantor from tenant_references table (new method)
        const { data: guarantorRefNew } = await supabase
          .from('tenant_references')
          .select('id, reference_token_hash, tenant_first_name_encrypted, tenant_last_name_encrypted, tenant_email_encrypted, tenant_phone_encrypted')
          .eq('guarantor_for_reference_id', referenceId)
          .eq('is_guarantor', true)
          .maybeSingle()

        const isLegacyGuarantor = !!guarantorRefLegacy
        let guarantorId: string

        if (guarantorRefLegacy) {
          // Use guarantor_references table data (legacy)
          guarantorId = guarantorRefLegacy.id
          const currentGuarantorEmail = decrypt(guarantorRefLegacy.email_encrypted) || ''
          contactEmail = newEmail || currentGuarantorEmail
          contactPhone = decrypt(guarantorRefLegacy.contact_number_encrypted) || ''
          contactName = `${decrypt(guarantorRefLegacy.guarantor_first_name_encrypted) || ''} ${decrypt(guarantorRefLegacy.guarantor_last_name_encrypted) || ''}`.trim()

          // Update email if changed
          if (newEmail && newEmail !== currentGuarantorEmail) {
            await supabase
              .from('guarantor_references')
              .update({ email_encrypted: encrypt(newEmail) })
              .eq('id', guarantorRefLegacy.id)
            // Also update in parent reference
            await supabase
              .from('tenant_references')
              .update({ guarantor_email_encrypted: encrypt(newEmail) })
              .eq('id', referenceId)
          }

          // Generate new token
          const guarantorToken = generateToken()
          const guarantorTokenHash = hash(guarantorToken)
          await supabase
            .from('guarantor_references')
            .update({ reference_token_hash: guarantorTokenHash })
            .eq('id', guarantorRefLegacy.id)

          formLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/guarantor-reference/${guarantorToken}`

          if (method === 'email') {
            await sendGuarantorReferenceRequest(
              contactEmail,
              contactName,
              tenantName,
              propertyAddress,
              companyName,
              companyPhone,
              companyEmail,
              formLink,
              guarantorRefLegacy.id
            )
          } else {
            if (!contactPhone) {
              return res.status(400).json({ error: 'No phone number available for SMS' })
            }
            smsResult = await sendGuarantorReferenceRequestSMS(
              contactPhone,
              contactName,
              tenantName,
              formLink,
              guarantorRefLegacy.id
            )
          }
        } else if (guarantorRefNew) {
          // Use tenant_references table data (new method)
          guarantorId = guarantorRefNew.id
          const currentGuarantorEmail = decrypt(guarantorRefNew.tenant_email_encrypted) || ''
          contactEmail = newEmail || currentGuarantorEmail
          contactPhone = decrypt(guarantorRefNew.tenant_phone_encrypted) || ''
          contactName = `${decrypt(guarantorRefNew.tenant_first_name_encrypted) || ''} ${decrypt(guarantorRefNew.tenant_last_name_encrypted) || ''}`.trim()

          // Update email if changed
          if (newEmail && newEmail !== currentGuarantorEmail) {
            await supabase
              .from('tenant_references')
              .update({ tenant_email_encrypted: encrypt(newEmail) })
              .eq('id', guarantorRefNew.id)
            // Also update in parent reference
            await supabase
              .from('tenant_references')
              .update({ guarantor_email_encrypted: encrypt(newEmail) })
              .eq('id', referenceId)
          }

          // Generate new token
          const guarantorToken = generateToken()
          const guarantorTokenHash = hash(guarantorToken)
          const tokenExpiresAt = new Date()
          tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 21)

          await supabase
            .from('tenant_references')
            .update({
              reference_token_hash: guarantorTokenHash,
              token_expires_at: tokenExpiresAt.toISOString()
            })
            .eq('id', guarantorRefNew.id)

          formLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/guarantor-reference/${guarantorToken}`

          if (method === 'email') {
            await sendGuarantorReferenceRequest(
              contactEmail,
              contactName,
              tenantName,
              propertyAddress,
              companyName,
              companyPhone,
              companyEmail,
              formLink,
              guarantorRefNew.id
            )
          } else {
            if (!contactPhone) {
              return res.status(400).json({ error: 'No phone number available for SMS' })
            }
            smsResult = await sendGuarantorReferenceRequestSMS(
              contactPhone,
              contactName,
              tenantName,
              formLink,
              guarantorRefNew.id
            )
          }
        } else {
          return res.status(404).json({ error: 'Guarantor reference not found' })
        }
        break
      }

      case 'Landlord': {
        const currentLandlordEmail = decrypt(reference.previous_landlord_email_encrypted) || ''
        contactEmail = newEmail || currentLandlordEmail
        contactPhone = decrypt(reference.previous_landlord_phone_encrypted) || ''
        contactName = decrypt(reference.previous_landlord_name_encrypted) || ''
        formLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/landlord-reference/${referenceId}`

        // Update email if changed - update both tenant_references AND landlord_references
        if (newEmail && newEmail !== currentLandlordEmail) {
          await supabase
            .from('tenant_references')
            .update({ previous_landlord_email_encrypted: encrypt(newEmail) })
            .eq('id', referenceId)

          // Also update landlord_references if it exists
          await supabase
            .from('landlord_references')
            .update({ landlord_email_encrypted: encrypt(newEmail) })
            .eq('reference_id', referenceId)
        }

        if (method === 'email') {
          await sendLandlordReferenceRequest(
            contactEmail,
            contactName,
            tenantName,
            formLink,
            companyName,
            companyPhone,
            companyEmail,
            referenceId
          )
        } else {
          if (!contactPhone) {
            return res.status(400).json({ error: 'No phone number available for SMS' })
          }
          smsResult = await sendLandlordReferenceRequestSMS(
            contactPhone,
            contactName,
            tenantName,
            formLink,
            referenceId
          )
        }
        break
      }

      case 'Agent': {
        const currentAgentEmail = decrypt(reference.previous_landlord_email_encrypted) || ''
        contactEmail = newEmail || currentAgentEmail
        contactPhone = decrypt(reference.previous_landlord_phone_encrypted) || ''
        contactName = reference.previous_agency_name || ''
        formLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/agent-reference/${referenceId}`

        // Update email if changed - update both tenant_references AND agent_references
        if (newEmail && newEmail !== currentAgentEmail) {
          await supabase
            .from('tenant_references')
            .update({ previous_landlord_email_encrypted: encrypt(newEmail) })
            .eq('id', referenceId)

          // Also update agent_references if it exists
          await supabase
            .from('agent_references')
            .update({ agent_email_encrypted: encrypt(newEmail) })
            .eq('reference_id', referenceId)
        }

        if (method === 'email') {
          await sendAgentReferenceRequest(
            contactEmail,
            contactName,
            tenantName,
            formLink,
            companyName,
            companyPhone,
            companyEmail,
            referenceId
          )
        } else {
          if (!contactPhone) {
            return res.status(400).json({ error: 'No phone number available for SMS' })
          }
          smsResult = await sendAgentReferenceRequestSMS(
            contactPhone,
            contactName,
            tenantName,
            formLink,
            referenceId
          )
        }
        break
      }

      case 'Employer': {
        const currentEmployerEmail = decrypt(reference.employer_ref_email_encrypted) || ''
        contactEmail = newEmail || currentEmployerEmail
        contactPhone = decrypt(reference.employer_ref_phone_encrypted) || ''
        contactName = decrypt(reference.employer_ref_name_encrypted) || ''
        formLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/employer-reference/${referenceId}`

        // Update email if changed - update both tenant_references AND employer_references
        if (newEmail && newEmail !== currentEmployerEmail) {
          await supabase
            .from('tenant_references')
            .update({ employer_ref_email_encrypted: encrypt(newEmail) })
            .eq('id', referenceId)

          // Also update employer_references if it exists
          await supabase
            .from('employer_references')
            .update({ employer_email_encrypted: encrypt(newEmail) })
            .eq('reference_id', referenceId)
        }

        if (method === 'email') {
          await sendEmployerReferenceRequest(
            contactEmail,
            contactName,
            tenantName,
            formLink,
            companyName,
            companyPhone,
            companyEmail,
            referenceId
          )
        } else {
          if (!contactPhone) {
            return res.status(400).json({ error: 'No phone number available for SMS' })
          }
          smsResult = await sendEmployerReferenceRequestSMS(
            contactPhone,
            contactName,
            tenantName,
            formLink,
            referenceId
          )
        }
        break
      }

      case 'Accountant': {
        // Get accountant reference (may not exist yet if tenant provided details but email wasn't sent)
        let { data: accountantRef } = await supabase
          .from('accountant_references')
          .select('id, token_hash')
          .eq('tenant_reference_id', referenceId)
          .maybeSingle()

        const currentAccountantEmail = decrypt(reference.accountant_email_encrypted) || ''
        contactEmail = newEmail || currentAccountantEmail
        contactPhone = decrypt(reference.accountant_phone_encrypted) || ''
        contactName = decrypt(reference.accountant_name_encrypted) || ''

        // Update email if changed - update both tenant_references AND accountant_references
        if (newEmail && newEmail !== currentAccountantEmail) {
          await supabase
            .from('tenant_references')
            .update({ accountant_email_encrypted: encrypt(newEmail) })
            .eq('id', referenceId)

          // Also update accountant_references if it exists
          if (accountantRef) {
            await supabase
              .from('accountant_references')
              .update({ accountant_email_encrypted: encrypt(newEmail) })
              .eq('id', accountantRef.id)
          }
        }

        // If no accountant reference row exists, create one using tenant's provided details
        if (!accountantRef) {
          if (!contactEmail || !contactName) {
            return res.status(404).json({ error: 'Accountant reference not found - no contact details available' })
          }

          // Generate token for new record
          const newAccountantToken = generateToken()
          const newAccountantTokenHash = hash(newAccountantToken)

          const { data: newAccountantRef, error: insertError } = await supabase
            .from('accountant_references')
            .insert({
              tenant_reference_id: referenceId,
              token_hash: newAccountantTokenHash,
              accountant_firm_encrypted: encrypt(decrypt(reference.accountant_company_encrypted) || ''),
              accountant_name_encrypted: reference.accountant_name_encrypted,
              accountant_email_encrypted: newEmail ? encrypt(newEmail) : reference.accountant_email_encrypted,
              accountant_phone_encrypted: reference.accountant_phone_encrypted,
            })
            .select('id, token_hash')
            .single()

          if (insertError || !newAccountantRef) {
            console.error('Failed to create accountant reference:', insertError)
            return res.status(500).json({ error: 'Failed to create accountant reference record' })
          }

          accountantRef = newAccountantRef
          formLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/accountant-reference/${newAccountantToken}`
        } else {
          // Generate new token for existing record
          const accountantToken = generateToken()
          const accountantTokenHash = hash(accountantToken)
          await supabase
            .from('accountant_references')
            .update({ token_hash: accountantTokenHash })
            .eq('id', accountantRef.id)

          formLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/accountant-reference/${accountantToken}`
        }

        if (method === 'email') {
          await sendAccountantReferenceRequest(
            contactEmail,
            contactName,
            tenantName,
            formLink,
            companyName,
            companyPhone,
            companyEmail,
            accountantRef.id
          )
        } else {
          if (!contactPhone) {
            return res.status(400).json({ error: 'No phone number available for SMS' })
          }
          smsResult = await sendAccountantReferenceRequestSMS(
            contactPhone,
            contactName,
            tenantName,
            formLink,
            accountantRef.id
          )
        }
        break
      }
    }

    // Check if SMS failed
    if (method === 'sms' && smsResult && !smsResult.success) {
      return res.status(500).json({ error: smsResult.error || 'Failed to send SMS' })
    }

    // Log to audit trail
    await logAuditAction({
      referenceId,
      action: method === 'email' ? 'EMAIL_RESENT' : 'SMS_SENT',
      description: `Chase ${method} sent to ${contactType}: ${method === 'email' ? contactEmail : contactPhone}`,
      metadata: { contactType, method, recipient: method === 'email' ? contactEmail : contactPhone }
    })

    // Record SMS contact attempt for cooldown tracking (only if SMS succeeded)
    if (method === 'sms' && smsResult?.success) {
      await supabase.from('chase_sms_cooldowns').upsert({
        reference_id: referenceId,
        contact_type: contactType,
        sent_at: new Date().toISOString()
      }, {
        onConflict: 'reference_id,contact_type'
      })
    }

    res.json({
      message: `${method === 'email' ? 'Email' : 'SMS'} sent successfully to ${contactType}`,
      recipient: method === 'email' ? contactEmail : contactPhone
    })
  } catch (error: any) {
    console.error('Failed to send chase reminder:', error)
    res.status(500).json({ error: error.message || 'Failed to send reminder' })
  }
})

// Document type to database field mapping
const documentTypeToField: Record<string, string> = {
  'id_document': 'id_document_path',
  'selfie': 'selfie_path',
  'proof_of_address': 'proof_of_address_path',
  'proof_of_funds': 'proof_of_funds_path',
  'proof_of_additional_income': 'proof_of_additional_income_path',
  'bank_statements': 'bank_statements_paths',
  'payslips': 'payslip_files',  // Array field - ends with _files not _paths
  'tax_return': 'tax_return_path',
  'rtr_alternative_document': 'rtr_alternative_document_path'
}

const documentTypeLabels: Record<string, string> = {
  'id_document': 'ID Document',
  'selfie': 'Selfie',
  'proof_of_address': 'Proof of Address',
  'proof_of_funds': 'Proof of Funds',
  'proof_of_additional_income': 'Proof of Additional Income',
  'bank_statements': 'Bank Statements',
  'payslips': 'Payslips',
  'tax_return': 'Tax Return',
  'rtr_alternative_document': 'Right to Rent Alternative Document'
}

// Staff upload document on behalf of tenant
router.post('/references/:id/upload-document', authenticateStaff, upload.single('file'), async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params
    const { document_type } = req.body
    const file = req.file

    if (!file) {
      return res.status(400).json({ error: 'No file provided' })
    }

    if (!document_type || !documentTypeToField[document_type]) {
      return res.status(400).json({ error: 'Invalid document type' })
    }

    // Verify reference exists
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('id, tenant_first_name_encrypted, tenant_last_name_encrypted')
      .eq('id', id)
      .single()

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Upload file to Supabase storage
    const fileExt = file.originalname.split('.').pop()
    const fileName = `${id}/${document_type}/${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('tenant-documents')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      })

    if (uploadError) {
      throw new Error(`Failed to upload file: ${uploadError.message}`)
    }

    // Update the reference with the new file path
    const fieldName = documentTypeToField[document_type]
    const updateData: Record<string, any> = {}

    // Handle array fields (bank_statements_paths, payslip_files)
    const isArrayField = fieldName.endsWith('_paths') || fieldName.endsWith('_files')
    if (isArrayField) {
      // Get existing paths and append
      const { data: currentRef } = await supabase
        .from('tenant_references')
        .select(fieldName)
        .eq('id', id)
        .single()

      const existingPaths = (currentRef as Record<string, any>)?.[fieldName] || []
      updateData[fieldName] = [...existingPaths, fileName]
    } else {
      updateData[fieldName] = fileName
    }

    const { error: updateError } = await supabase
      .from('tenant_references')
      .update(updateData)
      .eq('id', id)

    if (updateError) {
      throw new Error(`Failed to update reference: ${updateError.message}`)
    }

    // Log audit action
    await logAuditAction({
      referenceId: id,
      action: 'DOCUMENT_UPLOADED_BY_STAFF',
      description: `Staff uploaded ${documentTypeLabels[document_type]}`,
      metadata: { document_type, file_name: fileName },
      userId: req.staffUser?.id
    })

    res.json({
      message: 'Document uploaded successfully',
      file_path: fileName
    })
  } catch (error: any) {
    console.error('Failed to upload document:', error)
    res.status(500).json({ error: error.message || 'Failed to upload document' })
  }
})

// Request document from tenant (pushes back to in_progress)
router.post('/references/:id/request-document', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params
    const { document_type, message } = req.body

    if (!document_type || !documentTypeLabels[document_type]) {
      return res.status(400).json({ error: 'Invalid document type' })
    }

    // Get reference details
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('id, tenant_first_name_encrypted, tenant_email_encrypted, status')
      .eq('id', id)
      .single()

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    const tenantFirstName = decrypt(reference.tenant_first_name_encrypted) || 'Tenant'
    const tenantEmail = decrypt(reference.tenant_email_encrypted)

    if (!tenantEmail) {
      return res.status(400).json({ error: 'Tenant email not found' })
    }

    // Generate a new token for the tenant to access the form
    const token = generateToken()
    const tokenHash = hash(token)

    // Token expires in 21 days
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 21)

    // Update status to in_progress and set new token
    const { error: statusError } = await supabase
      .from('tenant_references')
      .update({
        status: 'in_progress',
        reference_token_hash: tokenHash,
        token_expires_at: expiresAt.toISOString()
      })
      .eq('id', id)

    if (statusError) {
      throw new Error(`Failed to update status: ${statusError.message}`)
    }

    // Add note explaining why pushed back
    const noteText = `Reference pushed back to request ${documentTypeLabels[document_type]} from tenant.${message ? ` Staff note: ${message}` : ''}`

    const { error: noteError } = await supabase
      .from('reference_notes')
      .insert({
        reference_id: id,
        note: noteText,
        created_by: req.user?.id
      })

    if (noteError) {
      console.error('Failed to insert reference note:', noteError)
    }

    // Update VERIFY work queue item with awaiting documentation flag
    await supabase
      .from('work_items')
      .update({
        status: 'IN_PROGRESS',
        metadata: {
          awaiting_documentation: true,
          document_requested_at: new Date().toISOString(),
          document_type_requested: documentTypeLabels[document_type]
        }
      })
      .eq('reference_id', id)
      .eq('work_type', 'VERIFY')
      .eq('status', 'IN_PROGRESS')

    // Send email to tenant requesting the document
    const formUrl = `${process.env.FRONTEND_URL || 'https://app.propertygoose.co.uk'}/submit-reference/${token}`

    const emailHtml = await loadEmailTemplate('document-request', {
      TenantFirstName: tenantFirstName,
      DocumentType: documentTypeLabels[document_type],
      FormUrl: formUrl,
      CustomMessage: message || ''
    })

    await sendEmail({
      to: tenantEmail,
      subject: `Document Required - ${documentTypeLabels[document_type]} - PropertyGoose`,
      html: emailHtml
    })

    // Log audit action
    await logAuditAction({
      referenceId: id,
      action: 'DOCUMENT_REQUESTED',
      description: `Requested ${documentTypeLabels[document_type]} from tenant, pushed back to in_progress`,
      metadata: { document_type, previous_status: reference.status },
      userId: req.staffUser?.id
    })

    res.json({
      message: `Document request sent to tenant. Reference pushed back to In Progress.`,
      new_status: 'in_progress'
    })
  } catch (error: any) {
    console.error('Failed to request document:', error)
    res.status(500).json({ error: error.message || 'Failed to request document' })
  }
})

export default router

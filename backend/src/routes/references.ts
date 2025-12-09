import { Router, Request } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { checkCredits } from '../middleware/checkCredits'
import { checkPaymentMethod } from '../middleware/checkPaymentMethod'
import { supabase } from '../config/supabase'
import crypto from 'crypto'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { sendTenantReferenceRequest, sendEmployerReferenceRequest, sendLandlordReferenceRequest, sendAgentReferenceRequest, sendAccountantReferenceRequest, sendConsentPDFToTenant, sendGuarantorRequestNotification, sendGuarantorReferenceRequest, sendSanctionsAlert } from '../services/emailService'
import { sendTenantReferenceRequestSMS, sendGuarantorReferenceRequestSMS, sendLandlordReferenceRequestSMS, sendEmployerReferenceRequestSMS, sendAccountantReferenceRequestSMS, sendAgentReferenceRequestSMS } from '../services/smsService'
import { auditReferenceAction } from '../services/auditLog'
import { logAuditAction } from '../services/auditService'
import { generateToken, hash, encrypt, decrypt } from '../services/encryption'
import pdfService from '../services/pdfService'
import { creditsafeService } from '../services/creditsafeService'
import { sanctionsService, ScreeningResponse } from '../services/sanctionsService'
import { generateReferenceReportPDF } from '../services/pdfReportService'
import * as billingService from '../services/billingService'
import * as creditService from '../services/creditService'
import { getClientIpAddress, normalizeGeolocationPayload } from '../utils/requestMetadata'
import { isValidEmail } from '../utils/validation'
import { assessApplicationScore } from '../services/application-assesment/assessApplication'

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

// Get dashboard stats (efficient counts without fetching all data)
router.get('/stats', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id

    // Get user's company
    const { data: companyUsers } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)

    if (!companyUsers || companyUsers.length === 0) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const companyId = companyUsers[0].company_id

    // Run all COUNT queries in parallel (much faster than fetching all data)
    const [total, inProgress, pendingVerification, completed, rejected, pending] = await Promise.all([
      supabase.from('tenant_references').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('is_guarantor', false),
      supabase.from('tenant_references').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'in_progress').eq('is_guarantor', false),
      supabase.from('tenant_references').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'pending_verification').eq('is_guarantor', false),
      supabase.from('tenant_references').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'completed').eq('is_guarantor', false),
      supabase.from('tenant_references').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'rejected').eq('is_guarantor', false),
      supabase.from('tenant_references').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'pending').eq('is_guarantor', false)
    ])

    res.json({
      total: total.count || 0,
      inProgress: inProgress.count || 0,
      pendingVerification: pendingVerification.count || 0,
      completed: completed.count || 0,
      rejected: rejected.count || 0,
      pending: pending.count || 0
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get all references for company
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id

    // Pagination params (optional - defaults to all results for backward compatibility)
    const page = parseInt(req.query.page as string) || 0 // 0 means no pagination
    const limit = parseInt(req.query.limit as string) || 0 // 0 means no limit
    const offset = page > 0 && limit > 0 ? (page - 1) * limit : 0

    // Search and filter params
    const search = req.query.search as string | undefined
    const statusFilter = req.query.status as string | undefined

    console.log('=== FETCHING REFERENCES FOR USER:', userId, page > 0 ? `(page ${page}, limit ${limit})` : '(all)', search ? `search: "${search}"` : '', statusFilter ? `status: ${statusFilter}` : '')

    // Check if user is invited (to handle duplicate company entries from trigger bug)
    const { data: { user } } = await supabase.auth.admin.getUserById(userId!)
    const isInvited = user?.user_metadata?.is_invited === true

    // Get user's company - for invited users, prefer non-owner role (they were invited, not original)
    let companyUser: { company_id: string } | null = null

    if (isInvited) {
      // For invited users, try to get the company where they're NOT an owner
      const { data: nonOwnerCompanies } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', userId)
        .neq('role', 'owner')
        .limit(1)

      if (nonOwnerCompanies && nonOwnerCompanies.length > 0) {
        companyUser = nonOwnerCompanies[0]
      }
    }

    // Fallback: get any company association
    if (!companyUser) {
      const { data: companyUsers } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', userId)
        .limit(1)

      if (companyUsers && companyUsers.length > 0) {
        companyUser = companyUsers[0]
      }
    }

    if (!companyUser) {
      console.log('ERROR: No company found for user')
      return res.status(404).json({ error: 'Company not found' })
    }

    console.log('Using company_id:', companyUser.company_id, 'isInvited:', isInvited)

    // Count total references for this company (with status filter if specified)
    let countQuery = supabase
      .from('tenant_references')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyUser.company_id)

    if (statusFilter) {
      countQuery = countQuery.eq('status', statusFilter)
    }

    const { count: totalCount } = await countQuery

    console.log('Total references in this company:', totalCount, statusFilter ? `(filtered by status: ${statusFilter})` : '')

    // Get all references for the company (excluding child references, but including guarantors)
    // Note: Guarantors are included so they can be nested under parent tenants in the UI
    // Get top-level references (parent_reference_id is null) OR guarantors
    let refsQuery = supabase
      .from('tenant_references')
      .select('*')
      .eq('company_id', companyUser.company_id)
      .order('created_at', { ascending: false })

    // Apply status filter if specified (can be done at DB level)
    if (statusFilter) {
      refsQuery = refsQuery.eq('status', statusFilter)
    }

    // Apply pagination if specified AND no search (search requires full dataset for encrypted field filtering)
    if (page > 0 && limit > 0 && !search) {
      refsQuery = refsQuery.range(offset, offset + limit - 1)
    }

    const { data: allRefs, error: allRefsError } = await refsQuery

    if (allRefsError) {
      return res.status(400).json({ error: allRefsError.message })
    }

    // Include all references - group parents are needed for agreement imports
    // The frontend can filter based on context (e.g., hide group parents in References list)
    const references = allRefs || []

    console.log('Top-level references found:', references?.length || 0)

    // BATCH QUERIES - Fix N+1 problem by fetching all related data in single queries
    const refIds = references.map(r => r.id)

    // Only run batch queries if there are references
    let landlordMap = new Map<string, boolean>()
    let agentMap = new Map<string, boolean>()
    let employerMap = new Map<string, boolean>()
    let accountantMap = new Map<string, boolean>()
    let creditsafeMap = new Map<string, { id: string; verification_status: string } | null>()
    let scoresMap = new Map<string, string | null>()
    let guarantorMap = new Map<string, { id: string; status: string }>()
    let childrenCountMap = new Map<string, number>()
    let childrenByParent = new Map<string, any[]>()

    if (refIds.length > 0) {
      // Fetch all related data in parallel batch queries
      const [landlordRefs, agentRefs, employerRefs, accountantRefs, creditsafeRefs, scores, guarantorRefs, childRefs] = await Promise.all([
        supabase.from('landlord_references').select('reference_id').in('reference_id', refIds),
        supabase.from('agent_references').select('reference_id').in('reference_id', refIds),
        supabase.from('employer_references').select('reference_id').in('reference_id', refIds),
        supabase.from('accountant_references').select('tenant_reference_id').in('tenant_reference_id', refIds),
        supabase.from('creditsafe_verifications').select('id, reference_id, verification_status').in('reference_id', refIds),
        supabase.from('reference_scores').select('reference_id, final_remarks').in('reference_id', refIds),
        // Get all guarantor references for refs that require them
        supabase.from('tenant_references').select('id, status, guarantor_for_reference_id').in('guarantor_for_reference_id', refIds).eq('is_guarantor', true),
        // Get all child references for group parents
        supabase.from('tenant_references').select('id, status, parent_reference_id').in('parent_reference_id', refIds)
      ])

      // Build lookup maps
      landlordRefs.data?.forEach(r => landlordMap.set(r.reference_id, true))
      agentRefs.data?.forEach(r => agentMap.set(r.reference_id, true))
      employerRefs.data?.forEach(r => employerMap.set(r.reference_id, true))
      accountantRefs.data?.forEach(r => accountantMap.set(r.tenant_reference_id, true))
      creditsafeRefs.data?.forEach(r => creditsafeMap.set(r.reference_id, { id: r.id, verification_status: r.verification_status }))
      scores.data?.forEach(r => scoresMap.set(r.reference_id, r.final_remarks))
      guarantorRefs.data?.forEach(r => {
        if (r.guarantor_for_reference_id) {
          guarantorMap.set(r.guarantor_for_reference_id, { id: r.id, status: r.status })
        }
      })

      // Group children by parent and count
      childRefs.data?.forEach(child => {
        if (child.parent_reference_id) {
          const existing = childrenByParent.get(child.parent_reference_id) || []
          existing.push(child)
          childrenByParent.set(child.parent_reference_id, existing)
          childrenCountMap.set(child.parent_reference_id, existing.length)
        }
      })
    }

    // Map references with pre-fetched data (no additional queries needed)
    const referencesWithCount = await Promise.all(references.map(async (ref) => {
      const has_landlord_reference = landlordMap.has(ref.id)
      const has_agent_reference = agentMap.has(ref.id)
      const has_employer_reference = employerMap.has(ref.id)
      const has_accountant_reference = accountantMap.has(ref.id)
      const creditData = creditsafeMap.get(ref.id)
      const has_credit_check = creditData || null
      const credit_check_status = creditData?.verification_status || null
      const final_remarks = scoresMap.get(ref.id) || null

      // Check guarantor status from pre-fetched data
      let has_guarantor_reference = false
      let has_guarantor_assigned = false
      if (ref.requires_guarantor) {
        const guarantorRef = guarantorMap.get(ref.id)
        has_guarantor_assigned = !!guarantorRef
        has_guarantor_reference = !!guarantorRef && (guarantorRef.status === 'completed' || guarantorRef.status === 'pending_verification')
      }

      if (ref.is_group_parent) {
        const children = childrenByParent.get(ref.id) || []
        const count = childrenCountMap.get(ref.id) || 0

        // Sync parent status with children's statuses
        if (children.length > 0) {
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

        return {
          ...ref,
          tenant_count: count,
          has_landlord_reference,
          has_agent_reference,
          has_employer_reference,
          has_accountant_reference,
          has_guarantor_reference,
          has_guarantor_assigned,
          has_credit_check,
          credit_check_status,
          final_remarks
        }
      }
      return {
        ...ref,
        has_landlord_reference,
        has_agent_reference,
        has_employer_reference,
        has_accountant_reference,
        has_guarantor_reference,
        has_guarantor_assigned,
        has_credit_check,
        credit_check_status,
        final_remarks
      }
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

    // Apply search filter if provided (after decryption since fields are encrypted)
    let filteredReferences = decryptedReferences
    if (search) {
      const searchLower = search.toLowerCase().trim()
      filteredReferences = decryptedReferences.filter(ref => {
        const tenantName = `${ref.tenant_first_name || ''} ${ref.tenant_last_name || ''}`.toLowerCase()
        const tenantEmail = (ref.tenant_email || '').toLowerCase()
        const propertyAddress = (ref.property_address || '').toLowerCase()
        const propertyCity = (ref.property_city || '').toLowerCase()
        const propertyPostcode = (ref.property_postcode || '').toLowerCase()

        return tenantName.includes(searchLower) ||
          tenantEmail.includes(searchLower) ||
          propertyAddress.includes(searchLower) ||
          propertyCity.includes(searchLower) ||
          propertyPostcode.includes(searchLower)
      })
    }

    // Apply pagination to search results if searching
    let paginatedReferences = filteredReferences
    let finalTotal = search ? filteredReferences.length : (totalCount || 0)

    if (search && page > 0 && limit > 0) {
      paginatedReferences = filteredReferences.slice(offset, offset + limit)
    }

    // Return with pagination metadata if pagination was requested
    if (page > 0 && limit > 0) {
      res.json({
        references: paginatedReferences,
        pagination: {
          page,
          limit,
          total: finalTotal,
          totalPages: Math.ceil(finalTotal / limit)
        }
      })
    } else {
      res.json({ references: filteredReferences })
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get single reference
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const referenceId = req.params.id

    // await assessApplicationScore(referenceId,'System')

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

    // Get guarantor reference if exists (OLD SYSTEM - kept for backwards compatibility)
    const { data: guarantorReference } = await supabase
      .from('guarantor_references')
      .select('*')
      .eq('reference_id', referenceId)
      .single()

    // Get guarantor references (NEW SYSTEM - as tenant_references)
    const { data: guarantorReferences, error: guarantorError } = await supabase
      .from('tenant_references')
      .select('*')
      .eq('guarantor_for_reference_id', referenceId)
      .eq('is_guarantor', true)
      .order('created_at', { ascending: true })

    console.log(`[DEBUG] Looking for guarantors for reference ${referenceId}`)
    console.log(`[DEBUG] Found ${guarantorReferences?.length || 0} guarantor references`)
    if (guarantorError) console.error('[DEBUG] Guarantor query error:', guarantorError)
    if (guarantorReferences && guarantorReferences.length > 0) {
      console.log('[DEBUG] Guarantor IDs:', guarantorReferences.map(g => g.id))
    }

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

      // Fetch guarantors for each child
      if (children && children.length > 0) {
        const childrenWithGuarantors = await Promise.all(children.map(async (child) => {
          const { data: childGuarantors } = await supabase
            .from('tenant_references')
            .select('*')
            .eq('guarantor_for_reference_id', child.id)
            .eq('is_guarantor', true)
            .order('created_at', { ascending: true })

          return {
            ...child,
            guarantors: childGuarantors || []
          }
        }))
        childReferences = childrenWithGuarantors
      } else {
        childReferences = children
      }

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
        guarantor_first_name: decrypt(ref.guarantor_first_name_encrypted),
        guarantor_last_name: decrypt(ref.guarantor_last_name_encrypted),
        guarantor_email: decrypt(ref.guarantor_email_encrypted),
        guarantor_phone: decrypt(ref.guarantor_phone_encrypted),
        notes: decrypt(ref.notes_encrypted),
        internal_notes: decrypt(ref.internal_notes_encrypted),
        verification_notes: decrypt(ref.verification_notes_encrypted),
        consent_printed_name: decrypt(ref.consent_printed_name_encrypted)
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
    const decryptedChildReferences = childReferences?.map(child => {
      const decryptedChild = decryptTenantReference(child)
      // Decrypt guarantors for this child if they exist
      if (child.guarantors && child.guarantors.length > 0) {
        decryptedChild.guarantors = child.guarantors.map(decryptTenantReference)
      }
      return decryptedChild
    })
    const decryptedGuarantorReferences = guarantorReferences?.map(decryptTenantReference)
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
      middle_name: guarantorReference.middle_name_encrypted ? decrypt(guarantorReference.middle_name_encrypted) : null,
      date_of_birth: guarantorReference.date_of_birth_encrypted ? decrypt(guarantorReference.date_of_birth_encrypted) : null,
      contact_number: guarantorReference.contact_number_encrypted ? decrypt(guarantorReference.contact_number_encrypted) : null,
      email: guarantorReference.email_encrypted ? decrypt(guarantorReference.email_encrypted) : null,
      nationality: guarantorReference.nationality_encrypted ? decrypt(guarantorReference.nationality_encrypted) : null,
      current_address_line1: guarantorReference.current_address_line1_encrypted ? decrypt(guarantorReference.current_address_line1_encrypted) : null,
      current_address_line2: guarantorReference.current_address_line2_encrypted ? decrypt(guarantorReference.current_address_line2_encrypted) : null,
      current_city: guarantorReference.current_city_encrypted ? decrypt(guarantorReference.current_city_encrypted) : null,
      current_postcode: guarantorReference.current_postcode_encrypted ? decrypt(guarantorReference.current_postcode_encrypted) : null,
      current_country: guarantorReference.current_country_encrypted ? decrypt(guarantorReference.current_country_encrypted) : null,
      employer_name: guarantorReference.employer_name_encrypted ? decrypt(guarantorReference.employer_name_encrypted) : null,
      job_title: guarantorReference.job_title_encrypted ? decrypt(guarantorReference.job_title_encrypted) : null,
      annual_income: guarantorReference.annual_income_encrypted ? decrypt(guarantorReference.annual_income_encrypted) : null,
      business_name: guarantorReference.business_name_encrypted ? decrypt(guarantorReference.business_name_encrypted) : null,
      nature_of_business: guarantorReference.nature_of_business_encrypted ? decrypt(guarantorReference.nature_of_business_encrypted) : null,
      annual_turnover: guarantorReference.annual_turnover_encrypted ? decrypt(guarantorReference.annual_turnover_encrypted) : null,
      pension_amount: guarantorReference.pension_amount_encrypted ? decrypt(guarantorReference.pension_amount_encrypted) : null,
      other_income_source: guarantorReference.other_income_source_encrypted ? decrypt(guarantorReference.other_income_source_encrypted) : null,
      other_income_amount: guarantorReference.other_income_amount_encrypted ? decrypt(guarantorReference.other_income_amount_encrypted) : null,
      savings_amount: guarantorReference.savings_amount_encrypted ? decrypt(guarantorReference.savings_amount_encrypted) : null,
      property_value: guarantorReference.property_value_encrypted ? decrypt(guarantorReference.property_value_encrypted) : null,
      other_assets: guarantorReference.other_assets_encrypted ? decrypt(guarantorReference.other_assets_encrypted) : null,
      monthly_mortgage_rent: guarantorReference.monthly_mortgage_rent_encrypted ? decrypt(guarantorReference.monthly_mortgage_rent_encrypted) : null,
      other_monthly_commitments: guarantorReference.other_monthly_commitments_encrypted ? decrypt(guarantorReference.other_monthly_commitments_encrypted) : null,
      total_monthly_expenditure: guarantorReference.total_monthly_expenditure_encrypted ? decrypt(guarantorReference.total_monthly_expenditure_encrypted) : null,
      adverse_credit_details: guarantorReference.adverse_credit_details_encrypted ? decrypt(guarantorReference.adverse_credit_details_encrypted) : null,
      previous_guarantor_details: guarantorReference.previous_guarantor_details_encrypted ? decrypt(guarantorReference.previous_guarantor_details_encrypted) : null,
      additional_comments: guarantorReference.additional_comments_encrypted ? decrypt(guarantorReference.additional_comments_encrypted) : null,
      guarantor_email: guarantorReference.guarantor_email_encrypted ? decrypt(guarantorReference.guarantor_email_encrypted) : null,
      guarantor_phone: guarantorReference.guarantor_phone_encrypted ? decrypt(guarantorReference.guarantor_phone_encrypted) : null,
      consent_printed_name: guarantorReference.consent_printed_name_encrypted ? decrypt(guarantorReference.consent_printed_name_encrypted) : null
    } : null

    // Use service method to get decrypted verification data including verifyMatch
    const creditsafeVerification = await creditsafeService.getVerificationResult(reference.id)
    const { data: sanctionsScreening } = await supabase.from('sanctions_screenings').select('*').eq('reference_id', reference.id).single()
    const { data: score } = await supabase.from('reference_scores').select('*').eq('reference_id', reference.id).single()

    // Get tenant offer linked to this reference (for holding deposit info)
    const { data: tenantOffer } = await supabase
      .from('tenant_offers')
      .select('holding_deposit_amount_paid, holding_deposit_received_at')
      .eq('reference_id', referenceId)
      .single()

    res.json({
      reference: decryptedReference,
      documents,
      landlordReference: decryptedLandlordReference,
      agentReference: decryptedAgentReference,
      employerReference: decryptedEmployerReference,
      accountantReference: decryptedAccountantReference,
      guarantorReference: decryptedGuarantorReference, // OLD SYSTEM - kept for backwards compatibility
      guarantorReferences: decryptedGuarantorReferences || [], // NEW SYSTEM
      childReferences: decryptedChildReferences,
      parentReference: decryptedParentReference,
      siblingReferences: decryptedSiblingReferences,
      previousAddresses: decryptedPreviousAddresses || [],
      creditsafeVerification: creditsafeVerification,
      sanctionsScreening: sanctionsScreening,
      score: score,
      tenantOffer: tenantOffer,
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get score for a reference
router.get('/:id/score', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const referenceId = req.params.id

    // Check if user is staff (staff can view all scores)
    const { data: staffUser } = await supabase
      .from('staff_users')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (!staffUser) {
      // Not staff, must be company user - verify they own this reference
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
      const { data: reference } = await supabase
        .from('tenant_references')
        .select('id, company_id')
        .eq('id', referenceId)
        .eq('company_id', companyUser.company_id)
        .single()

      if (!reference) {
        return res.status(404).json({ error: 'Reference not found' })
      }
    }

    // Get score (RLS will handle permissions)
    const { data: score, error: scoreError } = await supabase
      .from('reference_scores')
      .select('*')
      .eq('reference_id', referenceId)
      .maybeSingle()

    if (scoreError) {
      return res.status(400).json({ error: scoreError.message })
    }

    if (!score) {
      return res.status(404).json({ error: 'Score not found. Reference may not be scored yet.' })
    }

    res.json({ score })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get sanctions screening for a reference (agents/company users)
router.get('/:id/sanctions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const referenceId = req.params.id

    // Check if user is staff (staff can view all screenings)
    const { data: staffUser } = await supabase
      .from('staff_users')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (!staffUser) {
      // Not staff, must be company user - verify they own this reference
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
      const { data: reference } = await supabase
        .from('tenant_references')
        .select('id, company_id')
        .eq('id', referenceId)
        .eq('company_id', companyUser.company_id)
        .single()

      if (!reference) {
        return res.status(404).json({ error: 'Reference not found' })
      }
    }

    // Get sanctions screening
    const screening = await sanctionsService.getScreeningResult(referenceId)

    if (!screening) {
      return res.status(404).json({ error: 'No sanctions screening found for this reference' })
    }

    res.json({ screening })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get Creditsafe verification for a reference (agents/company users)
router.get('/:id/creditsafe', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const referenceId = req.params.id

    // Check if user is staff (staff can view all verifications)
    const { data: staffUser } = await supabase
      .from('staff_users')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (!staffUser) {
      // Not staff, must be company user - verify they own this reference
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
      const { data: reference } = await supabase
        .from('tenant_references')
        .select('id, company_id')
        .eq('id', referenceId)
        .eq('company_id', companyUser.company_id)
        .single()

      if (!reference) {
        return res.status(404).json({ error: 'Reference not found' })
      }
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

// Create new reference
// Note: Order matters - checkCredits first (if no credits, ask for credits), then checkPaymentMethod (if no payment method, ask for that)
router.post('/', authenticateToken, checkCredits, checkPaymentMethod, async (req: AuthRequest, res) => {
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
      notes,
      // Guarantor fields
      guarantor_first_name,
      guarantor_last_name,
      guarantor_email,
      guarantor_phone
    } = req.body

    // Check if user is invited (to handle duplicate company entries from trigger bug)
    const { data: { user } } = await supabase.auth.admin.getUserById(userId!)
    const isInvited = user?.user_metadata?.is_invited === true

    // Get user's company - for invited users, prefer non-owner role (they were invited, not original)
    console.log('Looking up company for user:', userId, 'isInvited:', isInvited)
    let companyUser: any = null

    if (isInvited) {
      // For invited users, try to get the company where they're NOT an owner
      const { data: nonOwnerCompanies } = await supabase
        .from('company_users')
        .select('company_id, companies:company_id(name_encrypted, phone_encrypted, email_encrypted)')
        .eq('user_id', userId)
        .neq('role', 'owner')
        .limit(1)

      if (nonOwnerCompanies && nonOwnerCompanies.length > 0) {
        companyUser = nonOwnerCompanies[0]
      }
    }

    // Fallback: get any company association
    if (!companyUser) {
      const { data: companyUsers } = await supabase
        .from('company_users')
        .select('company_id, companies:company_id(name_encrypted, phone_encrypted, email_encrypted)')
        .eq('user_id', userId)
        .limit(1)

      if (companyUsers && companyUsers.length > 0) {
        companyUser = companyUsers[0]
      }
    }

    console.log('Company lookup result:', companyUser)

    if (!companyUser) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const companyName = companyUser.companies?.name_encrypted
      ? (decrypt(companyUser.companies.name_encrypted) || 'Your agent')
      : 'Your agent'
    const companyPhone = companyUser.companies?.phone_encrypted
      ? (decrypt(companyUser.companies.phone_encrypted) || '')
      : ''
    const companyEmail = companyUser.companies?.email_encrypted
      ? (decrypt(companyUser.companies.email_encrypted) || '')
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

      // Token expires in 21 days
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 21)

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
      const childTokens: string[] = []
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
        childTokens.push(token)

        // Send email to each tenant
        const tenantUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/submit-reference/${token}`
        try {
          await sendTenantReferenceRequest(
            tenant.email,
            `${tenant.first_name} ${tenant.last_name}`,
            tenantUrl,
            companyName,
            property_address,
            companyPhone || undefined,
            companyEmail || undefined,
            childReference.id
          )
          console.log('Email sent successfully to tenant:', tenant.email)
        } catch (emailError: any) {
          console.error('Failed to send email to', tenant.email, emailError)
        }

        // Send SMS to tenant (non-blocking)
        if (tenant.phone) {
          sendTenantReferenceRequestSMS(
            tenant.phone,
            `${tenant.first_name} ${tenant.last_name}`,
            tenantUrl,
            companyName,
            property_address,
            childReference.id
          ).catch(err => console.error('Failed to send SMS to', tenant.phone, err))
        }

        // Create guarantor reference if guarantor details provided for this tenant
        if (tenant.guarantor?.first_name && tenant.guarantor?.last_name && tenant.guarantor?.email) {
          try {
            const guarantorToken = generateToken()
            const guarantorTokenHash = hash(guarantorToken)
            const guarantorExpiresAt = new Date()
            guarantorExpiresAt.setDate(guarantorExpiresAt.getDate() + 21)

            // Encrypt parent tenant name for storage
            const parentFirstNameEncrypted = encrypt(tenant.first_name)
            const parentLastNameEncrypted = encrypt(tenant.last_name)

            const { data: guarantorRef, error: guarantorError } = await supabase
              .from('tenant_references')
              .insert({
                company_id: companyUser.company_id,
                created_by: userId,
                is_guarantor: true,
                guarantor_for_reference_id: childReference.id,
                property_address_encrypted: encrypt(property_address),
                property_city_encrypted: encrypt(property_city || ''),
                property_postcode_encrypted: encrypt(property_postcode || ''),
                monthly_rent,
                move_in_date,
                // Store guarantor's own info in tenant fields
                tenant_first_name_encrypted: encrypt(tenant.guarantor.first_name),
                tenant_last_name_encrypted: encrypt(tenant.guarantor.last_name),
                tenant_email_encrypted: encrypt(tenant.guarantor.email),
                tenant_phone_encrypted: tenant.guarantor.phone ? encrypt(tenant.guarantor.phone) : null,
                // Store parent tenant info for display in guarantor form
                guarantor_first_name_encrypted: parentFirstNameEncrypted,
                guarantor_last_name_encrypted: parentLastNameEncrypted,
                reference_token_hash: guarantorTokenHash,
                token_expires_at: guarantorExpiresAt.toISOString(),
                status: 'pending',
                reference_type: 'landlord'
              })
              .select()
              .single()

            if (guarantorError) {
              console.error('❌ Failed to create guarantor for tenant', tenant.email, ':', guarantorError)
            } else {
              // Mark child reference as requiring guarantor
              await supabase
                .from('tenant_references')
                .update({ requires_guarantor: true })
                .eq('id', childReference.id)

              // Send email to guarantor with guarantor-specific form link
              const guarantorUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/guarantor-reference/${guarantorToken}`
              const tenantFullName = `${tenant.first_name} ${tenant.last_name}`
              await sendGuarantorReferenceRequest(
                tenant.guarantor.email,
                `${tenant.guarantor.first_name} ${tenant.guarantor.last_name}`,
                tenantFullName,
                property_address,
                companyName,
                companyPhone,
                companyEmail,
                guarantorUrl,
                childReference.id
              )
              console.log('✅ Guarantor email sent to:', tenant.guarantor.email)

              // Send SMS to guarantor (non-blocking)
              if (tenant.guarantor.phone) {
                sendGuarantorReferenceRequestSMS(
                  tenant.guarantor.phone,
                  `${tenant.guarantor.first_name} ${tenant.guarantor.last_name}`,
                  tenantFullName,
                  guarantorUrl,
                  guarantorRef.id
                ).catch(err => console.error('Failed to send SMS to guarantor:', err))
              }

              // Deduct 0.5 credits for guarantor reference
              console.log('💳 Deducting 0.5 credits for guarantor reference...')
              try {
                await creditService.deductCredits(
                  companyUser.company_id,
                  0.5,
                  guarantorRef.id,
                  'Guarantor reference creation',
                  userId
                )
                console.log('✅ Guarantor reference credit deduction successful')
              } catch (creditError: any) {
                console.error('❌ Failed to deduct credits for guarantor reference:', creditError)
                // Delete the guarantor reference if credit deduction fails
                await supabase
                  .from('tenant_references')
                  .delete()
                  .eq('id', guarantorRef.id)
                console.log('🗑️  Deleted guarantor reference due to insufficient credits')
              }
            }
          } catch (guarantorError: any) {
            console.error('❌ Failed to send guarantor email for tenant', tenant.email, ':', guarantorError)
          }
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

      // Deduct 1 credit for the reference creation
      try {
        await billingService.consumeCreditForReference(
          companyUser.company_id,
          parentReference.id,
          userId
        )
        console.log(`Deducted 1 credit for reference ${parentReference.id}`)
      } catch (creditError: any) {
        console.error('Failed to deduct credit:', creditError)
        // Log error but don't fail the request - credit was already checked by middleware
      }

      res.json({
        reference: parentReference,
        childReferences,
        childTokens, // Include tokens for frontend redirect
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

      // Token expires in 21 days
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 21)

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
          companyPhone || undefined,
          companyEmail || undefined,
          reference.id
        )
        console.log('Email sent successfully to tenant:', tenant_email)
      } catch (emailError: any) {
        console.error('Failed to send email:', emailError)
        // Don't fail the request if email fails, just log it
      }

      // Send SMS to tenant (non-blocking)
      if (tenant_phone) {
        sendTenantReferenceRequestSMS(
          tenant_phone,
          `${tenant_first_name} ${tenant_last_name}`,
          tenantUrl,
          companyName,
          property_address,
          reference.id
        ).catch(err => console.error('Failed to send SMS to tenant:', err))
      }

      // Create guarantor reference if guarantor details provided
      let guarantorReference = null
      if (guarantor_first_name && guarantor_last_name && guarantor_email) {
        try {
          const guarantorToken = generateToken()
          const guarantorTokenHash = hash(guarantorToken)
          const guarantorExpiresAt = new Date()
          guarantorExpiresAt.setDate(guarantorExpiresAt.getDate() + 21)

          // Encrypt parent tenant name for storage
          const parentFirstNameEncrypted = encrypt(tenant_first_name)
          const parentLastNameEncrypted = encrypt(tenant_last_name)

          const { data: guarantorRef, error: guarantorError } = await supabase
            .from('tenant_references')
            .insert({
              company_id: companyUser.company_id,
              created_by: userId,
              is_guarantor: true,
              guarantor_for_reference_id: reference.id,
              property_address_encrypted: encrypt(property_address),
              property_city_encrypted: encrypt(property_city || ''),
              property_postcode_encrypted: encrypt(property_postcode || ''),
              monthly_rent,
              move_in_date,
              // Store guarantor's own info in tenant fields
              tenant_first_name_encrypted: encrypt(guarantor_first_name),
              tenant_last_name_encrypted: encrypt(guarantor_last_name),
              tenant_email_encrypted: encrypt(guarantor_email),
              tenant_phone_encrypted: guarantor_phone ? encrypt(guarantor_phone) : null,
              // Store parent tenant info for display in guarantor form
              guarantor_first_name_encrypted: parentFirstNameEncrypted,
              guarantor_last_name_encrypted: parentLastNameEncrypted,
              reference_token_hash: guarantorTokenHash,
              token_expires_at: guarantorExpiresAt.toISOString(),
              status: 'pending',
              reference_type: 'landlord'
            })
            .select()
            .single()

          if (guarantorError) {
            console.error('❌ Failed to create guarantor:', guarantorError)
          } else {
            guarantorReference = guarantorRef

            // Mark parent as requiring guarantor
            await supabase
              .from('tenant_references')
              .update({ requires_guarantor: true })
              .eq('id', reference.id)

            // Send email to guarantor with guarantor-specific form link
            const guarantorUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/guarantor-reference/${guarantorToken}`
            const tenantFullName = `${tenant_first_name} ${tenant_last_name}`
            await sendGuarantorReferenceRequest(
              guarantor_email,
              `${guarantor_first_name} ${guarantor_last_name}`,
              tenantFullName,
              property_address,
              companyName,
              companyPhone,
              companyEmail,
              guarantorUrl,
              reference.id
            )
            console.log('✅ Guarantor email sent to:', guarantor_email)

            // Send SMS to guarantor (non-blocking)
            if (guarantor_phone) {
              sendGuarantorReferenceRequestSMS(
                guarantor_phone,
                `${guarantor_first_name} ${guarantor_last_name}`,
                tenantFullName,
                guarantorUrl,
                guarantorRef.id
              ).catch(err => console.error('Failed to send SMS to guarantor:', err))
            }

            // Deduct 0.5 credits for guarantor reference
            console.log('💳 Deducting 0.5 credits for guarantor reference...')
            try {
              await creditService.deductCredits(
                companyUser.company_id,
                0.5,
                guarantorRef.id,
                'Guarantor reference creation',
                userId
              )
              console.log('✅ Guarantor reference credit deduction successful')
            } catch (creditError: any) {
              console.error('❌ Failed to deduct credits for guarantor reference:', creditError)
              // Delete the guarantor reference if credit deduction fails
              await supabase
                .from('tenant_references')
                .delete()
                .eq('id', guarantorRef.id)
              console.log('🗑️  Deleted guarantor reference due to insufficient credits')
              guarantorReference = null
            }
          }
        } catch (error: any) {
          console.error('❌ Error creating guarantor:', error)
        }
        console.log('=== GUARANTOR CREATION COMPLETE ===')
      }

      // Audit log for single-tenant reference
      await auditReferenceAction(
        companyUser.company_id,
        userId!,
        reference.id,
        'reference.created',
        `Created reference for ${tenant_first_name} ${tenant_last_name} at ${property_address}${guarantorReference ? ' with guarantor' : ''}`,
        req,
        {
          tenant_email,
          property_address,
          monthly_rent,
          has_guarantor: !!guarantorReference
        }
      )

      // Deduct 1 credit for the reference creation
      try {
        await billingService.consumeCreditForReference(
          companyUser.company_id,
          reference.id,
          userId
        )
        console.log(`Deducted 1 credit for reference ${reference.id}`)
      } catch (creditError: any) {
        console.error('Failed to deduct credit:', creditError)
        // Log error but don't fail the request - credit was already checked by middleware
      }

      res.json({
        reference,
        guarantorReference,
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

// Delete entire property reference (parent + all child tenant references)
router.delete('/property/:parentId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const parentId = req.params.parentId

    // Get user's company and role
    const { data: companyUsers } = await supabase
      .from('company_users')
      .select('company_id, role')
      .eq('user_id', userId)
      .limit(1)

    if (!companyUsers || companyUsers.length === 0) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const companyUser = companyUsers[0]

    // Check if user has permission
    const allowedRoles = ['owner', 'admin', 'agent', 'landlord']
    if (!allowedRoles.includes(companyUser.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }

    // Get all child references for this property (those with parent_reference_id matching)
    const { data: childRefs, error: childError } = await supabase
      .from('tenant_references')
      .select('id, status, is_guarantor, tenant_first_name_encrypted, tenant_last_name_encrypted, property_address_encrypted')
      .eq('parent_reference_id', parentId)
      .eq('company_id', companyUser.company_id)

    if (childError) {
      return res.status(400).json({ error: childError.message })
    }

    if (!childRefs || childRefs.length === 0) {
      return res.status(404).json({ error: 'Property reference not found or has no tenant references' })
    }

    // Get property address from first child for audit log
    const propertyAddress = decrypt(childRefs[0].property_address_encrypted)
    const tenantCount = childRefs.length

    // Get all guarantor references for these children
    const childIds = childRefs.map(c => c.id)
    const { data: guarantorRefs } = await supabase
      .from('tenant_references')
      .select('id, status')
      .in('guarantor_for_reference_id', childIds)
      .eq('is_guarantor', true)

    // Calculate credits to refund
    let creditsToRefund = 0

    // 1 credit for each pending tenant reference
    childRefs.forEach(child => {
      if (child.status === 'pending' && !child.is_guarantor) {
        creditsToRefund += 1
      }
    })

    // 0.5 credits for each pending guarantor
    if (guarantorRefs && guarantorRefs.length > 0) {
      const pendingGuarantorCount = guarantorRefs.filter(g => g.status === 'pending').length
      creditsToRefund += pendingGuarantorCount * 0.5
    }

    // Delete all child references (this will cascade delete guarantors via FK)
    const { error: deleteError } = await supabase
      .from('tenant_references')
      .delete()
      .eq('parent_reference_id', parentId)
      .eq('company_id', companyUser.company_id)

    if (deleteError) {
      return res.status(400).json({ error: deleteError.message })
    }

    // Also delete the parent reference if it exists
    await supabase
      .from('tenant_references')
      .delete()
      .eq('id', parentId)
      .eq('company_id', companyUser.company_id)

    // Refund credits if any are due
    if (creditsToRefund > 0) {
      try {
        await creditService.refundCredits(
          companyUser.company_id,
          creditsToRefund,
          parentId,
          `Refund for deleted property reference (${tenantCount} tenants)`,
          userId
        )
        console.log(`[Delete Property Reference] Refunded ${creditsToRefund} credit(s) for property ${parentId}`)
      } catch (refundError: any) {
        console.error(`[Delete Property Reference] Failed to refund credits:`, refundError)
      }
    }

    // Audit log
    await auditReferenceAction(
      companyUser.company_id,
      userId!,
      parentId,
      'reference.deleted',
      `Deleted property reference for ${tenantCount} tenant(s) at ${propertyAddress}${creditsToRefund > 0 ? ` (${creditsToRefund} credit(s) refunded)` : ''}`,
      req,
      {
        property_address: propertyAddress,
        tenants_deleted: tenantCount,
        credits_refunded: creditsToRefund
      }
    )

    res.json({
      message: 'Property reference deleted successfully',
      tenants_deleted: tenantCount,
      credits_refunded: creditsToRefund
    })
  } catch (error: any) {
    console.error('Error deleting property reference:', error)
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

    // Check if user is owner, admin, agent, or landlord
    const allowedRoles = ['owner', 'admin', 'agent', 'landlord']
    if (!allowedRoles.includes(companyUser.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }

    // Get reference details for audit log and refund check before deletion
    const { data: reference } = await supabase
      .from('tenant_references')
      .select('tenant_first_name_encrypted, tenant_last_name_encrypted, property_address_encrypted, status, is_guarantor')
      .eq('id', referenceId)
      .eq('company_id', companyUser.company_id)
      .single()

    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Decrypt for audit logging
    const tenantFirstName = decrypt(reference.tenant_first_name_encrypted)
    const tenantLastName = decrypt(reference.tenant_last_name_encrypted)
    const propertyAddress = decrypt(reference.property_address_encrypted)

    // Check for linked guarantor references that are also pending
    const { data: guarantorRefs } = await supabase
      .from('tenant_references')
      .select('id, status')
      .eq('guarantor_for_reference_id', referenceId)
      .eq('is_guarantor', true)

    // Calculate credits to refund
    let creditsToRefund = 0

    // Refund 1 credit for main reference if status is 'pending' (tenant hasn't filled it out)
    if (reference.status === 'pending' && !reference.is_guarantor) {
      creditsToRefund += 1
    }

    // Refund 0.5 credits for each pending guarantor reference
    if (guarantorRefs && guarantorRefs.length > 0) {
      const pendingGuarantorCount = guarantorRefs.filter(g => g.status === 'pending').length
      creditsToRefund += pendingGuarantorCount * 0.5
    }

    // Delete reference (this will cascade delete linked guarantor references)
    const { error } = await supabase
      .from('tenant_references')
      .delete()
      .eq('id', referenceId)
      .eq('company_id', companyUser.company_id)

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // Refund credits if any are due
    if (creditsToRefund > 0) {
      try {
        await creditService.refundCredits(
          companyUser.company_id,
          creditsToRefund,
          referenceId,
          'Refund for deleted unfilled reference',
          userId
        )
        console.log(`[Delete Reference] Refunded ${creditsToRefund} credit(s) for reference ${referenceId}`)
      } catch (refundError: any) {
        console.error(`[Delete Reference] Failed to refund credits for reference ${referenceId}:`, refundError)
        // Don't fail the delete operation if refund fails - just log it
      }
    }

    // Audit log
    await auditReferenceAction(
      companyUser.company_id,
      userId!,
      referenceId,
      'reference.deleted',
      `Deleted reference for ${tenantFirstName} ${tenantLastName} at ${propertyAddress}${creditsToRefund > 0 ? ` (${creditsToRefund} credit(s) refunded)` : ''}`,
      req,
      {
        tenant_first_name: tenantFirstName,
        tenant_last_name: tenantLastName,
        property_address: propertyAddress,
        credits_refunded: creditsToRefund
      }
    )

    res.json({
      message: 'Reference deleted successfully',
      credits_refunded: creditsToRefund
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Tenant submits their information (public route)
router.post('/submit/:token', async (req: Request, res) => {
  try {

    const { token } = req.params
    const data = req.body
    const clientIpAddress = getClientIpAddress(req)
    const geolocationPayload = normalizeGeolocationPayload(data.geolocation)
    if ('geolocation' in data) {
      delete data.geolocation
    }

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

      // Guarantor Details (for students/unemployed)
      requires_guarantor: data.requires_guarantor || false,
      guarantor_first_name_encrypted: encrypt(data.guarantor_first_name || ''),
      guarantor_last_name_encrypted: encrypt(data.guarantor_last_name || ''),
      guarantor_email_encrypted: encrypt(data.guarantor_email || ''),
      guarantor_phone_encrypted: encrypt(data.guarantor_phone || ''),
      guarantor_relationship: data.guarantor_relationship || null,

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
      tax_return_path: data.tax_return_path || null,

      // Additional Income or Savings (Page 7)
      has_additional_income: data.has_additional_income || false,
      additional_income_type: data.additional_income_type || null,
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

      // Right to Rent Verification (Page 2)
      is_british_citizen: data.is_british_citizen !== undefined ? data.is_british_citizen : null,
      rtr_share_code: data.rtr_share_code || null,
      rtr_verified: data.rtr_verified || false,
      rtr_verification_date: data.rtr_verification_date || null,
      rtr_verification_data: data.rtr_verification_data || null,
      rtr_alternative_document_type: data.rtr_alternative_document_type || null,
      rtr_alternative_document_path: data.rtr_alternative_document_path || null,

      // Submission tracking
      submitted_ip_encrypted: clientIpAddress ? encrypt(clientIpAddress) : reference.submitted_ip_encrypted || null,
      submitted_geolocation_encrypted: geolocationPayload ? encrypt(JSON.stringify(geolocationPayload)) : reference.submitted_geolocation_encrypted || null,
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
          companyData?.email_encrypted ? decrypt(companyData.email_encrypted ?? '') ?? '' : '',
          updatedReference.id
        )
        console.log('Employer reference email sent successfully to:', data.employer_ref_email)

        // Send SMS to employer (non-blocking)
        if (data.employer_ref_phone) {
          sendEmployerReferenceRequestSMS(
            data.employer_ref_phone,
            data.employer_ref_name,
            `${data.first_name} ${data.last_name}`,
            employerReferenceUrl,
            updatedReference.id
          ).catch(err => console.error('Failed to send SMS to employer:', err))
        }
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
            companyData?.email_encrypted ? decrypt(companyData.email_encrypted ?? '') ?? '' : '',
            updatedReference.id
          )
          console.log('Agent reference email sent successfully to:', data.previous_landlord_email)

          // Send SMS to agent (non-blocking)
          if (data.previous_landlord_phone) {
            sendAgentReferenceRequestSMS(
              data.previous_landlord_phone,
              data.previous_landlord_name,
              `${data.first_name} ${data.last_name}`,
              agentReferenceUrl,
              updatedReference.id
            ).catch(err => console.error('Failed to send SMS to agent:', err))
          }
        } else {
          const landlordReferenceUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/landlord-reference/${updatedReference.id}`

          await sendLandlordReferenceRequest(
            data.previous_landlord_email,
            data.previous_landlord_name,
            `${data.first_name} ${data.last_name}`,
            landlordReferenceUrl,
            companyData?.name_encrypted ? decrypt(companyData.name_encrypted ?? '') ?? '' : '',
            companyData?.phone_encrypted ? decrypt(companyData.phone_encrypted ?? '') ?? '' : '',
            companyData?.email_encrypted ? decrypt(companyData.email_encrypted ?? '') ?? '' : '',
            updatedReference.id
          )
          console.log('Landlord reference email sent successfully to:', data.previous_landlord_email)

          // Send SMS to landlord (non-blocking)
          if (data.previous_landlord_phone) {
            sendLandlordReferenceRequestSMS(
              data.previous_landlord_phone,
              data.previous_landlord_name,
              `${data.first_name} ${data.last_name}`,
              landlordReferenceUrl,
              updatedReference.id
            ).catch(err => console.error('Failed to send SMS to landlord:', err))
          }
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
            companyData?.email_encrypted ? decrypt(companyData.email_encrypted ?? '') ?? '' : '',
            accountantRef.id
          )
          console.log('Accountant reference email sent successfully to:', data.accountant_email)

          // Send SMS to accountant (non-blocking)
          if (data.accountant_phone) {
            sendAccountantReferenceRequestSMS(
              data.accountant_phone,
              data.accountant_contact_name,
              `${data.first_name} ${data.last_name}`,
              accountantReferenceUrl,
              accountantRef.id
            ).catch(err => console.error('Failed to send SMS to accountant:', err))
          }
        }
      } catch (emailError: any) {
        console.error('Failed to send accountant reference email:', emailError)
        // Don't fail the request if email fails, just log it
      }
    }

    // Create guarantor reference if requested (costs 0.5 credits)
    if (data.requires_guarantor && data.guarantor_first_name && data.guarantor_email) {
      console.log(`=== GUARANTOR CREATION START ===`)
      console.log(`GUARANTOR REQUIRED: Tenant ${data.first_name} ${data.last_name} has requested a guarantor: ${data.guarantor_first_name} ${data.guarantor_last_name || ''} (${data.guarantor_email})`)
      console.log(`Parent reference ID: ${updatedReference?.id}`)

      // Check if a guarantor already exists (added by agent during creation)
      const { data: existingGuarantor } = await supabase
        .from('tenant_references')
        .select('*')
        .eq('guarantor_for_reference_id', updatedReference.id)
        .eq('is_guarantor', true)
        .maybeSingle()

      if (existingGuarantor) {
        console.log('✅ Guarantor already exists (added by agent). Skipping creation.')
        console.log('Existing guarantor ID:', existingGuarantor.id)
        // Guarantor already exists, no need to create a new one
      } else {
        // Automatically create guarantor reference as a tenant_reference and send email to guarantor
        try {
          // Generate unique token for guarantor
          const guarantorToken = generateToken()
          const guarantorTokenHash = hash(guarantorToken)
          const guarantorExpiresAt = new Date()
          guarantorExpiresAt.setDate(guarantorExpiresAt.getDate() + 21)

          // Create guarantor reference as a full tenant_reference
          const { data: guarantorRef, error: guarantorError } = await supabase
            .from('tenant_references')
            .insert({
              company_id: reference.company_id,
              created_by: reference.created_by,

              // Mark as guarantor and link to parent
              is_guarantor: true,
              guarantor_for_reference_id: updatedReference.id,

              // Inherit property details from parent
              property_address_encrypted: reference.property_address_encrypted,
              property_city_encrypted: reference.property_city_encrypted,
              property_postcode_encrypted: reference.property_postcode_encrypted,
              monthly_rent: reference.monthly_rent,
              move_in_date: reference.move_in_date,

              // Store guarantor's own info in tenant fields
              tenant_first_name_encrypted: encrypt(data.guarantor_first_name),
              tenant_last_name_encrypted: encrypt(data.guarantor_last_name || ''),
              tenant_email_encrypted: encrypt(data.guarantor_email),
              tenant_phone_encrypted: data.guarantor_phone ? encrypt(data.guarantor_phone) : null,

              // Store parent tenant info for display in guarantor form
              guarantor_first_name_encrypted: encrypt(data.first_name),
              guarantor_last_name_encrypted: encrypt(data.last_name),

              // Token for form access
              reference_token_hash: guarantorTokenHash,
              token_expires_at: guarantorExpiresAt.toISOString(),

              // Initial status
              status: 'pending',

              reference_type: 'landlord' // Default, they'll select during form
            })
            .select()
            .single()

          if (guarantorError) {
            console.error('❌ Failed to create guarantor reference:', guarantorError)
            console.error('Full error details:', JSON.stringify(guarantorError, null, 2))
          } else {
            console.log('✅ Guarantor reference created as tenant_reference:', guarantorRef?.id)
            console.log('Guarantor details:', {
              id: guarantorRef?.id,
              is_guarantor: guarantorRef?.is_guarantor,
              guarantor_for_reference_id: guarantorRef?.guarantor_for_reference_id,
              status: guarantorRef?.status
            })

            // Send email to guarantor with tenant reference form link (not custom guarantor form)
            const tenantName = `${data.first_name} ${data.last_name}`
            const guarantorName = `${data.guarantor_first_name} ${data.guarantor_last_name || ''}`
            const propertyAddress = (reference.property_address_encrypted
              ? decrypt(reference.property_address_encrypted)
              : null) || 'the property'

            // Get company name for email
            const { data: companyData } = await supabase
              .from('companies')
              .select('name_encrypted, phone_encrypted, email_encrypted')
              .eq('id', reference.company_id)
              .single()

            const companyName = (companyData?.name_encrypted
              ? decrypt(companyData.name_encrypted)
              : null) || 'Your agent'
            const companyPhone = companyData?.phone_encrypted
              ? (decrypt(companyData.phone_encrypted) || '')
              : ''
            const companyEmail = companyData?.email_encrypted
              ? (decrypt(companyData.email_encrypted) || '')
              : ''

            // Use guarantor-specific form link
            const formLink = `${process.env.FRONTEND_URL}/guarantor-reference/${guarantorToken}`

            // Send guarantor reference email
            await sendGuarantorReferenceRequest(
              data.guarantor_email,
              `${data.guarantor_first_name} ${data.guarantor_last_name || ''}`,
              tenantName,
              propertyAddress,
              companyName,
              companyPhone,
              companyEmail,
              formLink,
              guarantorRef.id
            )

            console.log('✅ Guarantor reference email sent to:', data.guarantor_email)

            // Send SMS to guarantor (non-blocking)
            if (data.guarantor_phone) {
              sendGuarantorReferenceRequestSMS(
                data.guarantor_phone,
                `${data.guarantor_first_name} ${data.guarantor_last_name || ''}`,
                tenantName,
                formLink,
                guarantorRef.id
              ).catch(err => console.error('Failed to send SMS to guarantor:', err))
            }

            // Deduct 0.5 credits for guarantor reference
            console.log('💳 Deducting 0.5 credits for guarantor reference...')
            try {
              await creditService.deductCredits(
                reference.company_id,
                0.5,
                guarantorRef.id,
                'Guarantor reference creation',
                undefined // No userId for public tenant submission
              )
              console.log('✅ Guarantor reference credit deduction successful')
            } catch (creditError: any) {
              console.error('❌ Failed to deduct credits for guarantor reference:', creditError)
              // Delete the guarantor reference if credit deduction fails
              await supabase
                .from('tenant_references')
                .delete()
                .eq('id', guarantorRef.id)
              // Don't fail the tenant submission - just log the error
              // The agency may need to add credits and request the guarantor manually
            }
          }
        } catch (error: any) {
          console.error('❌ Failed to create/send guarantor reference:', error)
          console.error('Error stack:', error.stack)
          // Don't fail the tenant submission if guarantor creation fails
        }
      }
      console.log(`=== GUARANTOR CREATION END ===`)
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
              const { data: consentCompanyData } = await supabase
                .from('companies')
                .select('name_encrypted, phone_encrypted, email_encrypted')
                .eq('id', reference.company_id)
                .single()

              const consentCompanyName = consentCompanyData?.name_encrypted ? decrypt(consentCompanyData.name_encrypted ?? '') ?? '' : ''
              const consentCompanyPhone = consentCompanyData?.phone_encrypted ? decrypt(consentCompanyData.phone_encrypted ?? '') ?? '' : ''
              const consentCompanyEmail = consentCompanyData?.email_encrypted ? decrypt(consentCompanyData.email_encrypted ?? '') ?? '' : ''

              await sendConsentPDFToTenant(
                tenantEmail,
                `${data.first_name} ${data.last_name}`,
                pdfBuffer,
                pdfFilename,
                consentCompanyName || undefined,
                consentCompanyPhone || undefined,
                consentCompanyEmail || undefined
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

    //Check Creditsafe verification
    const address = [data.current_address_line1, data.current_address_line2, data.current_city, data.current_postcode, data.current_country].filter((add) => !!((add || '').trim())).join(', ')

    const creditSfaePayload = {
      firstName: data.first_name,
      lastName: data.last_name,
      dateOfBirth: data.date_of_birth,
      postcode: data.current_postcode,
      address
    };

    const creditsafeVerification = await creditsafeService.verifyIndividual(creditSfaePayload);
    //Delete existing verification if it exists
    const { data: existingVerification } = await supabase.from('creditsafe_verifications').select('id').eq('reference_id', updatedReference.id).single()
    if (existingVerification) {
      await supabase
        .from('creditsafe_verifications')
        .delete()
        .eq('id', existingVerification.id)
    }
    //Store new verification
    await creditsafeService.storeVerificationResult(updatedReference.id, creditSfaePayload, creditsafeVerification)

    if (creditsafeVerification.status === 'passed') {
      console.log('Creditsafe verification passed')
    } else {
      console.log('Creditsafe verification failed')
    }


    // Trigger UK Sanctions & Electoral Commission (PEP) screening (non-blocking)
    // Screens against UK Sanctions List (5,656 entities) and Electoral Commission donations (89,358 records)
    if (sanctionsService.isEnabled()) {
      console.log('Triggering UK Sanctions & PEP screening for reference:', updatedReference.id)

      // Run screening in background - don't block the response
      sanctionsService.screenTenant({
        name: `${data.first_name} ${data.last_name}`,
        dateOfBirth: data.date_of_birth,
        postcode: data.current_postcode
      }).then(async (result) => {
        const screeningResult = result;
        // Store the screening result
        await sanctionsService.storeScreeningResult(
          updatedReference.id,
          {
            name: `${data.first_name} ${data.last_name}`,
            dateOfBirth: data.date_of_birth,
            postcode: data.current_postcode
          },
          screeningResult
        )

        // Audit log for screening
        await auditReferenceAction(
          reference.company_id,
          'system', // System-initiated, not by specific user
          updatedReference.id,
          'verification.sanctions_screening_completed',
          `UK Sanctions & PEP screening completed - Risk: ${screeningResult.risk_level}, Matches: ${screeningResult.total_matches}`,
          undefined,
          {
            risk_level: screeningResult.risk_level,
            total_matches: screeningResult.total_matches,
            sanctions_matches: screeningResult.sanctions_matches.length,
            donation_matches: screeningResult.donation_matches.length,
            summary: screeningResult.summary
          }
        )

        // Send email alert if high risk (sanctions match)
        if (screeningResult.risk_level === 'high') {
          try {
            // Get company email for alert
            const { data: companyData } = await supabase
              .from('companies')
              .select('name_encrypted, email_encrypted')
              .eq('id', reference.company_id)
              .single()

            const companyEmail = companyData?.email_encrypted
              ? decrypt(companyData.email_encrypted)
              : null

            if (companyEmail) {
              const propertyAddress = reference.property_address_encrypted
                ? decrypt(reference.property_address_encrypted)
                : 'Unknown Property'

              const recommendedAction = screeningResult.sanctions_matches.length > 0
                ? 'REJECT TENANT APPLICATION - Tenant appears on UK Sanctions List. This is a legal requirement and tenant must not be accepted.'
                : 'MANUAL REVIEW REQUIRED - Multiple political donation records found. Review matches and make informed decision.'

              const referenceUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard/references/${updatedReference.id}`

              await sendSanctionsAlert(
                companyEmail,
                `${data.first_name} ${data.last_name}`,
                propertyAddress || '',
                screeningResult.risk_level,
                screeningResult.total_matches,
                screeningResult.summary,
                recommendedAction,
                referenceUrl,
                screeningResult.screening_date
              )

              console.log('✅ Sanctions alert email sent to:', companyEmail)

              // Log alert sent
              await auditReferenceAction(
                reference.company_id,
                'system',
                updatedReference.id,
                'verification.sanctions_alert_sent',
                `High-risk sanctions screening alert sent to company`,
                undefined,
                { company_email: companyEmail }
              )
            } else {
              console.warn('⚠️ Company email not found, skipping sanctions alert email')
            }
          } catch (emailError: any) {
            console.error('❌ Failed to send sanctions alert email:', emailError)
            // Don't fail the submission if email fails
          }
        }
      }).catch((error) => {
        console.error('Sanctions screening failed:', error)
        // Log the error but don't fail the submission
        auditReferenceAction(
          reference.company_id,
          'system',
          updatedReference.id,
          'verification.sanctions_screening_failed',
          `Sanctions screening failed: ${error.message}`,
          undefined,
          { error: error.message }
        ).catch(console.error)
      })
    } else {
      console.log('Sanctions screening is disabled, skipping')
    }

    await assessApplicationScore(updatedReference.id, 'System');
    console.log('Application assessed successfully')

    // Check if tenant requires any third-party references
    // If not, move directly to pending_verification so they enter the verification queue
    const requiresEmployerRef = !!data.employer_ref_email
    const requiresAccountantRef = data.income_self_employed && !!data.accountant_email
    const requiresResidentialRef = !!data.previous_landlord_email

    if (!requiresEmployerRef && !requiresAccountantRef && !requiresResidentialRef) {
      // No third-party references required - move to pending_verification
      await supabase
        .from('tenant_references')
        .update({ status: 'pending_verification' })
        .eq('id', updatedReference.id)

      console.log('No third-party references required - moved to pending_verification')
    }

    res.json({
      message: 'Reference submitted successfully',
      reference: updatedReference
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Check if guarantor already exists for a reference (public route)
router.get('/check-guarantor/:token', async (req, res) => {
  try {
    const { token } = req.params

    // Hash the token to look up the reference securely
    const tokenHash = hash(token)

    // Get reference by token hash
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('id')
      .eq('reference_token_hash', tokenHash)
      .gte('token_expires_at', new Date().toISOString())
      .single()

    if (refError || !reference) {
      return res.status(404).json({ error: 'Invalid or expired reference link' })
    }

    // Check if a guarantor already exists for this reference
    const { data: existingGuarantor } = await supabase
      .from('tenant_references')
      .select('id, tenant_first_name_encrypted, tenant_last_name_encrypted, tenant_email_encrypted, status')
      .eq('guarantor_for_reference_id', reference.id)
      .eq('is_guarantor', true)
      .maybeSingle()

    if (existingGuarantor) {
      // Decrypt guarantor info to send to frontend
      res.json({
        hasGuarantor: true,
        guarantor: {
          id: existingGuarantor.id,
          firstName: existingGuarantor.tenant_first_name_encrypted ? decrypt(existingGuarantor.tenant_first_name_encrypted) : '',
          lastName: existingGuarantor.tenant_last_name_encrypted ? decrypt(existingGuarantor.tenant_last_name_encrypted) : '',
          email: existingGuarantor.tenant_email_encrypted ? decrypt(existingGuarantor.tenant_email_encrypted) : '',
          status: existingGuarantor.status
        }
      })
    } else {
      res.json({
        hasGuarantor: false
      })
    }
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
    { name: 'rtr_alternative_document', maxCount: 1 },
    { name: 'bank_statements', maxCount: 10 },
    { name: 'payslips', maxCount: 10 },
    { name: 'tax_return', maxCount: 1 }
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
    let rtrAlternativeDocumentPath: string | null = null
    let taxReturnPath: string | null = null
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

    if (files.rtr_alternative_document && files.rtr_alternative_document[0]) {
      const file = files.rtr_alternative_document[0]
      const fileExt = file.originalname.split('.').pop()
      const fileName = `${reference.id}/rtr_alternative_document/${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('tenant-documents')
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        })

      if (uploadError) {
        throw new Error(`Failed to upload document: ${uploadError.message}`)
      }

      rtrAlternativeDocumentPath = fileName
    }

    // Upload tax return

    if (files.tax_return && files.tax_return[0]) {
      const file = files.tax_return[0]
      const fileExt = file.originalname.split('.').pop()
      const fileName = `${reference.id}/tax_return/${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('tenant-documents')
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        })

      if (uploadError) {
        throw new Error(`Failed to upload tax return: ${uploadError.message}`)
      }

      taxReturnPath = fileName
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
      rtr_alternative_document: rtrAlternativeDocumentPath,
      bank_statements: bankStatementPaths,
      payslips: payslipPaths,
      tax_return: taxReturnPath
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
        is_guarantor,
        guarantor_for_reference_id,
        guarantor_first_name_encrypted,
        guarantor_last_name_encrypted,
        companies:company_id (
          name_encrypted,
          logo_url,
          primary_color,
          button_color,
          phone_encrypted,
          email_encrypted,
          address_encrypted,
          city_encrypted,
          postcode_encrypted,
          website_encrypted
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
    const companyDetails = company ? {
      logo_url: company.logo_url || '',
      primary_color: company.primary_color || '#FF8C41',
      button_color: company.button_color || '#FF8C41',
      name: company?.name_encrypted ? decrypt(company.name_encrypted) : '',
      phone: company?.phone_encrypted ? decrypt(company.phone_encrypted) : '',
      email: company?.email_encrypted ? decrypt(company.email_encrypted) : '',
      address: company?.address_encrypted ? decrypt(company.address_encrypted) : '',
      city: company?.city_encrypted ? decrypt(company.city_encrypted) : '',
      postcode: company?.postcode_encrypted ? decrypt(company.postcode_encrypted) : '',
      website: company?.website_encrypted ? decrypt(company.website_encrypted) : ''
    } : null
    const decryptedReference: any = {
      ...reference,
      tenant_first_name: decrypt((reference as any).tenant_first_name_encrypted),
      tenant_last_name: decrypt((reference as any).tenant_last_name_encrypted),
      tenant_email: decrypt((reference as any).tenant_email_encrypted),
      property_address: decrypt((reference as any).property_address_encrypted),
      property_city: decrypt((reference as any).property_city_encrypted),
      property_postcode: decrypt((reference as any).property_postcode_encrypted),
      company_name: companyDetails?.name || ''
    }

    // If this is a guarantor reference, the parent tenant's name is stored in guarantor fields
    if (reference.is_guarantor) {
      // For guarantor references, guarantor_first_name actually contains the PARENT tenant's name
      // (yes, it's confusing - we reuse the guarantor fields to store parent tenant info)
      const guarantorFirstEncrypted = (reference as any).guarantor_first_name_encrypted
      const guarantorLastEncrypted = (reference as any).guarantor_last_name_encrypted

      if (guarantorFirstEncrypted && guarantorLastEncrypted) {
        decryptedReference.parent_tenant_first_name = decrypt(guarantorFirstEncrypted)
        decryptedReference.parent_tenant_last_name = decrypt(guarantorLastEncrypted)
      }
    }

    res.json({
      reference: {
        ...decryptedReference,
        companies: companyDetails,
        company_phone: companyDetails?.phone || '',
        company_email: companyDetails?.email || '',
        company_address: companyDetails?.address || '',
        company_city: companyDetails?.city || '',
        company_postcode: companyDetails?.postcode || '',
        company_website: companyDetails?.website || ''
      }
    })
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
router.post('/landlord/:referenceId', async (req: Request, res) => {
  try {
    const { referenceId } = req.params
    const formData = req.body
    const clientIpAddress = getClientIpAddress(req)
    const geolocationPayload = normalizeGeolocationPayload(formData.geolocation)
    if ('geolocation' in formData) {
      delete formData.geolocation
    }

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

    // Helper function to convert empty date strings to null
    const normalizeDate = (date: string | null | undefined): string | null => {
      if (!date || date.trim() === '') return null
      return date
    }

    // Determine if tenancy is still in progress based on status
    const tenancyStillInProgress = formData.tenancyStatus === 'in-situ' || formData.tenancyStatus === 'notice-served' || formData.tenancyStillInProgress

    const dbData = {
      reference_id: referenceId,
      landlord_name_encrypted: encrypt(formData.landlordName),
      landlord_email_encrypted: encrypt(formData.landlordEmail),
      landlord_phone_encrypted: encrypt(formData.landlordPhone),
      property_address_encrypted: encrypt(propertyAddress),
      property_city_encrypted: encrypt(formData.propertyCity || ''),
      property_postcode_encrypted: encrypt(formData.propertyPostcode || ''),
      tenancy_start_date: normalizeDate(formData.tenancyStartDate),
      tenancy_end_date: tenancyStillInProgress ? null : normalizeDate(formData.tenancyEndDate),
      tenancy_still_in_progress: tenancyStillInProgress,
      monthly_rent_encrypted: encrypt(formData.monthlyRent ? String(formData.monthlyRent) : null),
      address_correct: formData.addressCorrect,
      corrected_address_line1_encrypted: encrypt(formData.correctedAddressLine1 || ''),
      corrected_address_line2_encrypted: encrypt(formData.correctedAddressLine2 || ''),
      corrected_city_encrypted: encrypt(formData.correctedCity || ''),
      corrected_postcode_encrypted: encrypt(formData.correctedPostcode || ''),
      rent_paid_on_time: formData.rentPaidOnTime,
      good_tenant: formData.goodTenant,
      would_rent_again: formData.wouldRentAgain,
      additional_comments_encrypted: encrypt(formData.additionalComments || ''),
      signature_name_encrypted: encrypt(formData.signatureName),
      signature_encrypted: encrypt(formData.signature),
      date: normalizeDate(formData.date),
      submitted_ip_encrypted: clientIpAddress ? encrypt(clientIpAddress) : null,
      submitted_geolocation_encrypted: geolocationPayload ? encrypt(JSON.stringify(geolocationPayload)) : null,
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
router.post('/agent/:referenceId', async (req: Request, res) => {
  try {
    const { referenceId } = req.params
    const formData = req.body
    const clientIpAddress = getClientIpAddress(req)
    const geolocationPayload = normalizeGeolocationPayload(formData.geolocation)
    if ('geolocation' in formData) {
      delete formData.geolocation
    }

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

    // Helper function to convert empty date strings to null
    const normalizeDate = (date: string | null | undefined): string | null => {
      if (!date || date.trim() === '') return null
      return date
    }

    // Determine if tenancy is still in progress based on status
    const tenancyStillInProgress = formData.tenancyStatus === 'in-situ' || formData.tenancyStatus === 'notice-served' || formData.tenancyStillInProgress

    const dbData = {
      reference_id: referenceId,
      agent_name_encrypted: encrypt(formData.agentName),
      agent_email_encrypted: encrypt(formData.agentEmail),
      agent_phone_encrypted: encrypt(formData.agentPhone),
      agency_name_encrypted: encrypt(formData.agencyName || ''),
      property_address_encrypted: encrypt(propertyAddress),
      property_city_encrypted: encrypt(formData.propertyCity || ''),
      property_postcode_encrypted: encrypt(formData.propertyPostcode || ''),
      address_correct: formData.addressCorrect,
      corrected_address_line1_encrypted: encrypt(formData.correctedAddressLine1 || ''),
      corrected_address_line2_encrypted: encrypt(formData.correctedAddressLine2 || ''),
      corrected_city_encrypted: encrypt(formData.correctedCity || ''),
      corrected_postcode_encrypted: encrypt(formData.correctedPostcode || ''),
      tenancy_start_date: normalizeDate(formData.tenancyStartDate),
      tenancy_end_date: tenancyStillInProgress ? null : normalizeDate(formData.tenancyEndDate),
      tenancy_still_in_progress: tenancyStillInProgress,
      monthly_rent_encrypted: encrypt(formData.monthlyRent ? String(formData.monthlyRent) : null),
      rent_paid_on_time: formData.rentPaidOnTime,
      good_tenant: formData.goodTenant, // "Have they been a good tenant" question
      would_rent_again: formData.wouldRentAgain,
      additional_comments_encrypted: encrypt(formData.additionalComments || ''),
      signature_name_encrypted: encrypt(formData.signatureName),
      signature_encrypted: encrypt(formData.signature),
      date: normalizeDate(formData.date),
      submitted_ip_encrypted: clientIpAddress ? encrypt(clientIpAddress) : null,
      submitted_geolocation_encrypted: geolocationPayload ? encrypt(JSON.stringify(geolocationPayload)) : null,
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
router.post('/employer/:referenceId', async (req: Request, res) => {
  try {
    const { referenceId } = req.params
    const formData = req.body
    const clientIpAddress = getClientIpAddress(req)
    const geolocationPayload = normalizeGeolocationPayload(formData.geolocation)
    if ('geolocation' in formData) {
      delete formData.geolocation
    }

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
      employment_stable: formData.employmentStable,
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
      submitted_ip_encrypted: clientIpAddress ? encrypt(clientIpAddress) : null,
      submitted_geolocation_encrypted: geolocationPayload ? encrypt(JSON.stringify(geolocationPayload)) : null,
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
router.post('/accountant/:token', async (req: Request, res) => {
  try {
    const { token } = req.params
    const formData = req.body
    const clientIpAddress = getClientIpAddress(req)
    const geolocationPayload = normalizeGeolocationPayload(formData.geolocation)
    if ('geolocation' in formData) {
      delete formData.geolocation
    }

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
        submitted_ip_encrypted: clientIpAddress ? encrypt(clientIpAddress) : accountantRef.submitted_ip_encrypted || null,
        submitted_geolocation_encrypted: geolocationPayload ? encrypt(JSON.stringify(geolocationPayload)) : accountantRef.submitted_geolocation_encrypted || null,
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

// Resend landlord reference email
router.post('/:id/resend-landlord-email', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const referenceId = req.params.id
    const userId = req.user?.id

    // Get the reference
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('*, companies!inner(id)')
      .eq('id', referenceId)
      .single()

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Verify user has access to this reference's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .eq('company_id', reference.company_id)
      .single()

    if (!companyUser) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Get company info
    const { data: companyData } = await supabase
      .from('companies')
      .select('name_encrypted, phone_encrypted, email_encrypted')
      .eq('id', reference.company_id)
      .single()

    const landlordEmail = decrypt(reference.previous_landlord_email_encrypted) || ''
    const landlordName = decrypt(reference.previous_landlord_name_encrypted) || ''
    const tenantName = `${decrypt(reference.tenant_first_name_encrypted) || ''} ${decrypt(reference.tenant_last_name_encrypted) || ''}`
    const landlordReferenceUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/landlord-reference/${reference.id}`

    await sendLandlordReferenceRequest(
      landlordEmail,
      landlordName,
      tenantName,
      landlordReferenceUrl,
      companyData?.name_encrypted ? decrypt(companyData.name_encrypted ?? '') ?? '' : '',
      companyData?.phone_encrypted ? decrypt(companyData.phone_encrypted ?? '') ?? '' : '',
      companyData?.email_encrypted ? decrypt(companyData.email_encrypted ?? '') ?? '' : '',
      reference.id
    )

    // Send SMS to landlord (non-blocking)
    const landlordPhone = decrypt(reference.previous_landlord_phone_encrypted)
    if (landlordPhone) {
      sendLandlordReferenceRequestSMS(
        landlordPhone,
        landlordName,
        tenantName,
        landlordReferenceUrl,
        referenceId
      ).catch(err => console.error('Failed to send SMS to landlord:', err))
    }

    // Log to audit trail
    await logAuditAction({
      referenceId,
      action: 'EMAIL_RESENT',
      description: `Landlord reference email resent to ${landlordEmail}`,
      metadata: { emailType: 'landlord', recipient: landlordEmail },
      userId
    })

    res.json({ message: 'Landlord reference email resent successfully' })
  } catch (error: any) {
    console.error('Failed to resend landlord email:', error)
    res.status(500).json({ error: error.message })
  }
})

// Resend agent reference email
router.post('/:id/resend-agent-email', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const referenceId = req.params.id
    const userId = req.user?.id

    // Get the reference
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('*, companies!inner(id)')
      .eq('id', referenceId)
      .single()

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Verify user has access to this reference's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .eq('company_id', reference.company_id)
      .single()

    if (!companyUser) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Get company info
    const { data: companyData } = await supabase
      .from('companies')
      .select('name_encrypted, phone_encrypted, email_encrypted')
      .eq('id', reference.company_id)
      .single()

    const agentEmail = decrypt(reference.previous_landlord_email_encrypted) || ''
    const agentName = decrypt(reference.previous_landlord_name_encrypted) || ''
    const tenantName = `${decrypt(reference.tenant_first_name_encrypted) || ''} ${decrypt(reference.tenant_last_name_encrypted) || ''}`
    const agentReferenceUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/agent-reference/${reference.id}`

    await sendAgentReferenceRequest(
      agentEmail,
      agentName,
      tenantName,
      agentReferenceUrl,
      companyData?.name_encrypted ? decrypt(companyData.name_encrypted ?? '') ?? '' : '',
      companyData?.phone_encrypted ? decrypt(companyData.phone_encrypted ?? '') ?? '' : '',
      companyData?.email_encrypted ? decrypt(companyData.email_encrypted ?? '') ?? '' : '',
      reference.id
    )

    // Send SMS to agent (non-blocking)
    const agentPhone = decrypt(reference.previous_landlord_phone_encrypted)
    if (agentPhone) {
      sendAgentReferenceRequestSMS(
        agentPhone,
        agentName,
        tenantName,
        agentReferenceUrl,
        referenceId
      ).catch(err => console.error('Failed to send SMS to agent:', err))
    }

    // Log to audit trail
    await logAuditAction({
      referenceId,
      action: 'EMAIL_RESENT',
      description: `Agent reference email resent to ${agentEmail}`,
      metadata: { emailType: 'agent', recipient: agentEmail },
      userId
    })

    res.json({ message: 'Agent reference email resent successfully' })
  } catch (error: any) {
    console.error('Failed to resend agent email:', error)
    res.status(500).json({ error: error.message })
  }
})

// Resend tenant reference form email
router.post('/:id/resend-tenant-email', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const referenceId = req.params.id
    const userId = req.user?.id
    const { newEmail } = req.body

    // Get the reference
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('*, companies!inner(id)')
      .eq('id', referenceId)
      .single()

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Verify user has access to this reference's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .eq('company_id', reference.company_id)
      .single()

    if (!companyUser) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Get company info
    const { data: companyData } = await supabase
      .from('companies')
      .select('name_encrypted, phone_encrypted, email_encrypted')
      .eq('id', reference.company_id)
      .single()

    const currentEmail = decrypt(reference.tenant_email_encrypted) || ''
    const tenantFirstName = decrypt(reference.tenant_first_name_encrypted) || ''
    const tenantLastName = decrypt(reference.tenant_last_name_encrypted) || ''
    const tenantName = `${tenantFirstName} ${tenantLastName}`
    const propertyAddress = decrypt(reference.property_address_encrypted) || ''

    // Determine which email to use - new email if provided and different, otherwise current
    let tenantEmail = currentEmail
    let emailChanged = false

    if (newEmail && newEmail !== currentEmail) {
      // Validate new email
      if (!isValidEmail(newEmail)) {
        return res.status(400).json({ error: 'Invalid email address' })
      }

      // Update the email in the database
      await supabase
        .from('tenant_references')
        .update({ tenant_email_encrypted: encrypt(newEmail) })
        .eq('id', referenceId)

      tenantEmail = newEmail
      emailChanged = true

      // Log email change to audit trail
      await logAuditAction({
        referenceId,
        action: 'EMAIL_CHANGED',
        description: `Tenant email changed from ${currentEmail} to ${newEmail}`,
        metadata: { emailType: 'tenant', oldEmail: currentEmail, newEmail },
        userId
      })
    }

    // Generate a new token for this resend (original token is not stored, only hash)
    const newToken = generateToken()
    const newTokenHash = hash(newToken)

    // Update the reference with the new token hash
    await supabase
      .from('tenant_references')
      .update({ reference_token_hash: newTokenHash })
      .eq('id', referenceId)

    const tenantReferenceUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/submit-reference/${newToken}`

    const companyName = companyData?.name_encrypted ? decrypt(companyData.name_encrypted ?? '') ?? '' : ''
    const companyPhone = companyData?.phone_encrypted ? decrypt(companyData.phone_encrypted ?? '') ?? '' : ''
    const companyEmail = companyData?.email_encrypted ? decrypt(companyData.email_encrypted ?? '') ?? '' : ''

    await sendTenantReferenceRequest(
      tenantEmail,
      tenantName,
      tenantReferenceUrl,
      companyName,
      propertyAddress,
      companyPhone || undefined,
      companyEmail || undefined,
      referenceId
    )

    // Send SMS to tenant (non-blocking)
    const tenantPhone = decrypt(reference.tenant_phone_encrypted)
    if (tenantPhone) {
      sendTenantReferenceRequestSMS(
        tenantPhone,
        tenantName,
        tenantReferenceUrl,
        companyName,
        propertyAddress,
        referenceId
      ).catch(err => console.error('Failed to send SMS to tenant:', err))
    }

    // Log to audit trail
    await logAuditAction({
      referenceId,
      action: 'EMAIL_RESENT',
      description: `Tenant reference form email resent to ${tenantEmail}`,
      metadata: { emailType: 'tenant', recipient: tenantEmail },
      userId
    })

    res.json({
      message: 'Tenant reference form email resent successfully',
      emailChanged,
      email: tenantEmail
    })
  } catch (error: any) {
    console.error('Failed to resend tenant email:', error)
    res.status(500).json({ error: error.message })
  }
})

// Resend employer reference email
router.post('/:id/resend-employer-email', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const referenceId = req.params.id
    const userId = req.user?.id
    const { newEmail } = req.body

    // Get the reference
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('*, companies!inner(id)')
      .eq('id', referenceId)
      .single()

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Verify user has access to this reference's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .eq('company_id', reference.company_id)
      .single()

    if (!companyUser) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Get current email for comparison
    const currentEmail = decrypt(reference.employer_ref_email_encrypted) || ''

    // If new email provided and different, validate and update it
    if (newEmail && newEmail !== currentEmail) {
      if (!isValidEmail(newEmail)) {
        return res.status(400).json({ error: 'Invalid email format' })
      }

      // Update the email in database
      await supabase
        .from('tenant_references')
        .update({ employer_ref_email_encrypted: encrypt(newEmail) })
        .eq('id', referenceId)

      // Log email change in audit
      await logAuditAction({
        referenceId,
        action: 'EMAIL_CHANGED',
        description: `Employer reference email changed from ${currentEmail} to ${newEmail}`,
        metadata: { emailType: 'employer', previousEmail: currentEmail, newEmail: newEmail },
        userId
      })
    }

    // Use new email if provided, otherwise use current
    const employerEmail = newEmail || currentEmail

    // Get company info
    const { data: companyData } = await supabase
      .from('companies')
      .select('name_encrypted, phone_encrypted, email_encrypted')
      .eq('id', reference.company_id)
      .single()

    const employerName = decrypt(reference.employer_ref_name_encrypted) || ''
    const tenantName = `${decrypt(reference.tenant_first_name_encrypted) || ''} ${decrypt(reference.tenant_last_name_encrypted) || ''}`
    const employerReferenceUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/employer-reference/${reference.id}`

    await sendEmployerReferenceRequest(
      employerEmail,
      employerName,
      tenantName,
      employerReferenceUrl,
      companyData?.name_encrypted ? decrypt(companyData.name_encrypted ?? '') ?? '' : '',
      companyData?.phone_encrypted ? decrypt(companyData.phone_encrypted ?? '') ?? '' : '',
      companyData?.email_encrypted ? decrypt(companyData.email_encrypted ?? '') ?? '' : '',
      reference.id
    )

    // Send SMS to employer (non-blocking)
    const employerPhone = decrypt(reference.employer_ref_phone_encrypted)
    if (employerPhone) {
      sendEmployerReferenceRequestSMS(
        employerPhone,
        employerName,
        tenantName,
        employerReferenceUrl,
        referenceId
      ).catch(err => console.error('Failed to send SMS to employer:', err))
    }

    // Log to audit trail
    await logAuditAction({
      referenceId,
      action: 'EMAIL_RESENT',
      description: `Employer reference email resent to ${employerEmail}`,
      metadata: { emailType: 'employer', recipient: employerEmail },
      userId
    })

    res.json({ message: 'Employer reference email resent successfully' })
  } catch (error: any) {
    console.error('Failed to resend employer email:', error)
    res.status(500).json({ error: error.message })
  }
})

// Resend accountant reference email
router.post('/:id/resend-accountant-email', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const referenceId = req.params.id
    const userId = req.user?.id

    // Get the reference and accountant reference
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('*, companies!inner(id)')
      .eq('id', referenceId)
      .single()

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Verify user has access to this reference's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .eq('company_id', reference.company_id)
      .single()

    if (!companyUser) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Get accountant reference to get the token
    const { data: accountantRef } = await supabase
      .from('accountant_references')
      .select('id, reference_token_hash')
      .eq('tenant_reference_id', referenceId)
      .single()

    if (!accountantRef) {
      return res.status(404).json({ error: 'Accountant reference not found' })
    }

    // Generate new token for the form link
    const accountantToken = generateToken()
    const accountantTokenHash = hash(accountantToken)

    // Update the token hash
    await supabase
      .from('accountant_references')
      .update({ reference_token_hash: accountantTokenHash })
      .eq('id', accountantRef.id)

    // Get company info
    const { data: companyData } = await supabase
      .from('companies')
      .select('name_encrypted, phone_encrypted, email_encrypted')
      .eq('id', reference.company_id)
      .single()

    const accountantEmail = decrypt(reference.accountant_email_encrypted) || ''
    const accountantName = decrypt(reference.accountant_name_encrypted) || ''
    const tenantName = `${decrypt(reference.tenant_first_name_encrypted) || ''} ${decrypt(reference.tenant_last_name_encrypted) || ''}`
    const formLink = `${process.env.FRONTEND_URL}/accountant-reference/${accountantToken}`

    await sendAccountantReferenceRequest(
      accountantEmail,
      accountantName,
      tenantName,
      formLink,
      companyData?.name_encrypted ? decrypt(companyData.name_encrypted ?? '') ?? '' : '',
      companyData?.phone_encrypted ? decrypt(companyData.phone_encrypted ?? '') ?? '' : '',
      companyData?.email_encrypted ? decrypt(companyData.email_encrypted ?? '') ?? '' : '',
      accountantRef.id
    )

    // Send SMS to accountant (non-blocking)
    const accountantPhone = decrypt(reference.accountant_phone_encrypted)
    if (accountantPhone) {
      sendAccountantReferenceRequestSMS(
        accountantPhone,
        accountantName,
        tenantName,
        formLink,
        accountantRef.id
      ).catch(err => console.error('Failed to send SMS to accountant:', err))
    }

    // Log to audit trail
    await logAuditAction({
      referenceId,
      action: 'EMAIL_RESENT',
      description: `Accountant reference email resent to ${accountantEmail}`,
      metadata: { emailType: 'accountant', recipient: accountantEmail },
      userId
    })

    res.json({ message: 'Accountant reference email resent successfully' })
  } catch (error: any) {
    console.error('Failed to resend accountant email:', error)
    res.status(500).json({ error: error.message })
  }
})

// Add guarantor to an existing reference
router.post('/:id/add-guarantor', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const referenceId = req.params.id
    const userId = req.user?.id
    const { guarantor_first_name, guarantor_last_name, guarantor_email, guarantor_phone } = req.body

    console.log('=== ADD GUARANTOR ===')
    console.log('Reference ID:', referenceId)
    console.log('Guarantor:', guarantor_first_name, guarantor_last_name, guarantor_email)

    // Validate required fields
    if (!guarantor_first_name || !guarantor_last_name || !guarantor_email) {
      return res.status(400).json({ error: 'Missing required guarantor fields: first_name, last_name, email' })
    }

    // Get the parent reference
    const { data: parentReference, error: refError } = await supabase
      .from('tenant_references')
      .select('*, companies!inner(id, name_encrypted, phone_encrypted, email_encrypted)')
      .eq('id', referenceId)
      .single()

    if (refError || !parentReference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Verify user has access to this reference's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .eq('company_id', parentReference.company_id)
      .single()

    if (!companyUser) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Check if parent reference is itself a guarantor (can't add guarantor to a guarantor)
    if (parentReference.is_guarantor) {
      return res.status(400).json({ error: 'Cannot add a guarantor to a guarantor reference' })
    }

    // Check if a guarantor already exists for this reference
    const { data: existingGuarantor } = await supabase
      .from('tenant_references')
      .select('id')
      .eq('guarantor_for_reference_id', referenceId)
      .eq('is_guarantor', true)
      .maybeSingle()

    if (existingGuarantor) {
      return res.status(400).json({ error: 'A guarantor already exists for this reference' })
    }

    // Generate token for guarantor form
    const guarantorToken = generateToken()
    const guarantorTokenHash = hash(guarantorToken)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 21) // 21-day expiry

    // Create guarantor reference as a tenant_reference
    const { data: guarantorReference, error: createError } = await supabase
      .from('tenant_references')
      .insert({
        company_id: parentReference.company_id,
        created_by: userId,

        // Mark as guarantor and link to parent
        is_guarantor: true,
        guarantor_for_reference_id: referenceId,

        // Inherit property details from parent
        property_address_encrypted: parentReference.property_address_encrypted,
        property_city_encrypted: parentReference.property_city_encrypted,
        property_postcode_encrypted: parentReference.property_postcode_encrypted,
        monthly_rent: parentReference.monthly_rent,
        move_in_date: parentReference.move_in_date,

        // Store guarantor's own info in tenant fields
        tenant_first_name_encrypted: encrypt(guarantor_first_name),
        tenant_last_name_encrypted: encrypt(guarantor_last_name),
        tenant_email_encrypted: encrypt(guarantor_email),
        tenant_phone_encrypted: guarantor_phone ? encrypt(guarantor_phone) : null,

        // Store parent tenant info for display in guarantor form
        guarantor_first_name_encrypted: parentReference.tenant_first_name_encrypted,
        guarantor_last_name_encrypted: parentReference.tenant_last_name_encrypted,

        // Token for form access
        reference_token_hash: guarantorTokenHash,
        token_expires_at: expiresAt.toISOString(),

        // Initial status
        status: 'pending',

        reference_type: 'landlord' // Default, they'll select during form
      })
      .select()
      .single()

    if (createError || !guarantorReference) {
      console.error('Failed to create guarantor reference:', createError)
      return res.status(500).json({ error: 'Failed to create guarantor reference' })
    }

    console.log('Created guarantor reference:', guarantorReference.id)

    // Update parent reference to mark it requires guarantor
    await supabase
      .from('tenant_references')
      .update({ requires_guarantor: true })
      .eq('id', referenceId)

    // Send email to guarantor with guarantor-specific form link
    const tenantName = `${decrypt(parentReference.tenant_first_name_encrypted)} ${decrypt(parentReference.tenant_last_name_encrypted)}`
    const propertyAddress = decrypt(parentReference.property_address_encrypted) || 'the property'
    const companyName = parentReference.companies?.name_encrypted
      ? decrypt(parentReference.companies.name_encrypted) || 'Your agent'
      : 'Your agent'
    const companyPhone = parentReference.companies?.phone_encrypted
      ? (decrypt(parentReference.companies.phone_encrypted) || '')
      : ''
    const companyEmail = parentReference.companies?.email_encrypted
      ? (decrypt(parentReference.companies.email_encrypted) || '')
      : ''
    const formLink = `${process.env.FRONTEND_URL}/guarantor-reference/${guarantorToken}`

    await sendGuarantorReferenceRequest(
      guarantor_email,
      `${guarantor_first_name} ${guarantor_last_name}`,
      tenantName,
      propertyAddress,
      companyName,
      companyPhone,
      companyEmail,
      formLink,
      guarantorReference.id
    )

    console.log('Guarantor reference email sent to:', guarantor_email)

    // Send SMS to guarantor (non-blocking)
    if (guarantor_phone) {
      sendGuarantorReferenceRequestSMS(
        guarantor_phone,
        `${guarantor_first_name} ${guarantor_last_name}`,
        tenantName,
        formLink,
        guarantorReference.id
      ).catch(err => console.error('Failed to send SMS to guarantor:', err))
    }

    // Deduct 0.5 credits for guarantor reference
    console.log('💳 Deducting 0.5 credits for guarantor reference...')
    try {
      await creditService.deductCredits(
        parentReference.company_id,
        0.5,
        guarantorReference.id,
        'Guarantor reference creation',
        userId
      )
      console.log('✅ Guarantor reference credit deduction successful')
    } catch (creditError: any) {
      console.error('❌ Failed to deduct credits for guarantor reference:', creditError)
      // Delete the guarantor reference if credit deduction fails
      await supabase
        .from('tenant_references')
        .delete()
        .eq('id', guarantorReference.id)

      return res.status(402).json({
        error: 'Insufficient Credits',
        message: 'Not enough credits to create guarantor reference. Please purchase more credits.',
      })
    }

    // Log to audit trail
    await logAuditAction({
      referenceId,
      action: 'GUARANTOR_ADDED',
      description: `Guarantor ${guarantor_first_name} ${guarantor_last_name} added by agent`,
      metadata: {
        guarantorReferenceId: guarantorReference.id,
        guarantorEmail: guarantor_email
      },
      userId
    })

    res.json({
      message: 'Guarantor added successfully',
      guarantor_reference_id: guarantorReference.id
    })
  } catch (error: any) {
    console.error('Failed to add guarantor:', error)
    res.status(500).json({ error: error.message })
  }
})

// Resend guarantor reference email
router.post('/:id/resend-guarantor-email', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const referenceId = req.params.id
    const userId = req.user?.id
    const { newEmail } = req.body

    // Get the parent reference
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('*, companies!inner(id)')
      .eq('id', referenceId)
      .single()

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Verify user has access to this reference's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .eq('company_id', reference.company_id)
      .single()

    if (!companyUser) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // First, try to get guarantor from guarantor_references table (legacy)
    const { data: guarantorRefLegacy } = await supabase
      .from('guarantor_references')
      .select('id, reference_token_hash, guarantor_first_name_encrypted, guarantor_last_name_encrypted, guarantor_email_encrypted')
      .eq('reference_id', referenceId)
      .single()

    // If not found, try to get guarantor from tenant_references table (new method)
    const { data: guarantorRefNew } = await supabase
      .from('tenant_references')
      .select('id, reference_token_hash, tenant_first_name_encrypted, tenant_last_name_encrypted, tenant_email_encrypted')
      .eq('guarantor_for_reference_id', referenceId)
      .eq('is_guarantor', true)
      .single()

    if (!guarantorRefLegacy && !guarantorRefNew) {
      return res.status(404).json({ error: 'Guarantor reference not found' })
    }

    // Determine which type of guarantor we're dealing with
    const isLegacyGuarantor = !!guarantorRefLegacy

    // Get guarantor ID and current email based on type
    let guarantorId: string
    let currentEmail: string
    let guarantorFirstName: string
    let guarantorLastName: string

    if (isLegacyGuarantor && guarantorRefLegacy) {
      guarantorId = guarantorRefLegacy.id
      currentEmail = decrypt(guarantorRefLegacy.guarantor_email_encrypted) || ''
      guarantorFirstName = decrypt(guarantorRefLegacy.guarantor_first_name_encrypted) || ''
      guarantorLastName = decrypt(guarantorRefLegacy.guarantor_last_name_encrypted || '') || ''
    } else if (guarantorRefNew) {
      guarantorId = guarantorRefNew.id
      currentEmail = decrypt(guarantorRefNew.tenant_email_encrypted) || ''
      guarantorFirstName = decrypt(guarantorRefNew.tenant_first_name_encrypted) || ''
      guarantorLastName = decrypt(guarantorRefNew.tenant_last_name_encrypted || '') || ''
    } else {
      return res.status(404).json({ error: 'Guarantor reference not found' })
    }

    // If new email provided and different, validate and update it
    if (newEmail && newEmail !== currentEmail) {
      if (!isValidEmail(newEmail)) {
        return res.status(400).json({ error: 'Invalid email format' })
      }

      if (isLegacyGuarantor) {
        // Update the email in guarantor_references table
        await supabase
          .from('guarantor_references')
          .update({ guarantor_email_encrypted: encrypt(newEmail) })
          .eq('id', guarantorId)
      } else {
        // Update the email in the guarantor's tenant_reference
        await supabase
          .from('tenant_references')
          .update({ tenant_email_encrypted: encrypt(newEmail) })
          .eq('id', guarantorId)
      }

      // Also update in parent tenant_reference for display purposes
      await supabase
        .from('tenant_references')
        .update({ guarantor_email_encrypted: encrypt(newEmail) })
        .eq('id', referenceId)

      // Log email change in audit
      await logAuditAction({
        referenceId,
        action: 'EMAIL_CHANGED',
        description: `Guarantor email changed from ${currentEmail} to ${newEmail}`,
        metadata: { emailType: 'guarantor', previousEmail: currentEmail, newEmail: newEmail },
        userId
      })
    }

    // Use new email if provided, otherwise use current
    const guarantorEmail = newEmail || currentEmail

    // Generate new token for the form link
    const guarantorToken = generateToken()
    const guarantorTokenHash = hash(guarantorToken)
    const tokenExpiresAt = new Date()
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 21)

    // Update the token hash in the appropriate table
    if (isLegacyGuarantor) {
      await supabase
        .from('guarantor_references')
        .update({ reference_token_hash: guarantorTokenHash })
        .eq('id', guarantorId)
    } else {
      await supabase
        .from('tenant_references')
        .update({
          reference_token_hash: guarantorTokenHash,
          token_expires_at: tokenExpiresAt.toISOString()
        })
        .eq('id', guarantorId)
    }

    // Get company info
    const { data: companyData } = await supabase
      .from('companies')
      .select('name_encrypted, phone_encrypted, email_encrypted')
      .eq('id', reference.company_id)
      .single()

    const guarantorName = `${guarantorFirstName} ${guarantorLastName}`.trim()
    const tenantName = `${decrypt(reference.tenant_first_name_encrypted) || ''} ${decrypt(reference.tenant_last_name_encrypted) || ''}`
    const propertyAddress = decrypt(reference.property_address_encrypted) || 'the property'
    const companyName = companyData?.name_encrypted ? decrypt(companyData.name_encrypted) || 'Your agent' : 'Your agent'
    const companyPhone = companyData?.phone_encrypted ? (decrypt(companyData.phone_encrypted) || '') : ''
    const companyEmail = companyData?.email_encrypted ? (decrypt(companyData.email_encrypted) || '') : ''

    // Use guarantor-reference form link for both legacy and new method
    const formLink = `${process.env.FRONTEND_URL}/guarantor-reference/${guarantorToken}`

    await sendGuarantorReferenceRequest(
      guarantorEmail,
      guarantorName,
      tenantName,
      propertyAddress,
      companyName,
      companyPhone,
      companyEmail,
      formLink,
      guarantorId
    )

    // Send SMS to guarantor (non-blocking)
    const guarantorPhone = decrypt(reference.guarantor_phone_encrypted)
    if (guarantorPhone) {
      sendGuarantorReferenceRequestSMS(
        guarantorPhone,
        guarantorName,
        tenantName,
        formLink,
        guarantorId
      ).catch(err => console.error('Failed to send SMS to guarantor:', err))
    }

    // Log to audit trail
    await logAuditAction({
      referenceId,
      action: 'EMAIL_RESENT',
      description: `Guarantor reference email resent to ${guarantorEmail}`,
      metadata: { emailType: 'guarantor', recipient: guarantorEmail },
      userId
    })

    res.json({ message: 'Guarantor reference email resent successfully' })
  } catch (error: any) {
    console.error('Failed to resend guarantor email:', error)
    res.status(500).json({ error: error.message })
  }
})

// Resend email for a guarantor's own reference (when viewing the guarantor's tenant_reference page)
router.post('/:id/resend-guarantor-self-email', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const guarantorReferenceId = req.params.id
    const userId = req.user?.id
    const { newEmail } = req.body

    // Get the guarantor reference (which is a tenant_reference with is_guarantor = true)
    const { data: guarantorRef, error: refError } = await supabase
      .from('tenant_references')
      .select('*')
      .eq('id', guarantorReferenceId)
      .eq('is_guarantor', true)
      .single()

    if (refError || !guarantorRef) {
      return res.status(404).json({ error: 'Guarantor reference not found' })
    }

    // Verify user has access to this reference's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .eq('company_id', guarantorRef.company_id)
      .single()

    if (!companyUser) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Get the parent reference for tenant info
    const { data: parentRef } = await supabase
      .from('tenant_references')
      .select('tenant_first_name_encrypted, tenant_last_name_encrypted, property_address_encrypted')
      .eq('id', guarantorRef.guarantor_for_reference_id)
      .single()

    // Current email is stored in tenant_email_encrypted for guarantor references
    const currentEmail = decrypt(guarantorRef.tenant_email_encrypted) || ''

    // If new email provided and different, validate and update it
    if (newEmail && newEmail !== currentEmail) {
      if (!isValidEmail(newEmail)) {
        return res.status(400).json({ error: 'Invalid email format' })
      }

      // Update the email in the guarantor's tenant_reference
      await supabase
        .from('tenant_references')
        .update({ tenant_email_encrypted: encrypt(newEmail) })
        .eq('id', guarantorReferenceId)

      // Also update in parent reference's guarantor_email_encrypted for display
      if (guarantorRef.guarantor_for_reference_id) {
        await supabase
          .from('tenant_references')
          .update({ guarantor_email_encrypted: encrypt(newEmail) })
          .eq('id', guarantorRef.guarantor_for_reference_id)
      }

      // Log email change in audit
      await logAuditAction({
        referenceId: guarantorReferenceId,
        action: 'EMAIL_CHANGED',
        description: `Guarantor email changed from ${currentEmail} to ${newEmail}`,
        metadata: { emailType: 'guarantor_self', previousEmail: currentEmail, newEmail: newEmail },
        userId
      })
    }

    // Use new email if provided, otherwise use current
    const guarantorEmail = newEmail || currentEmail

    // Generate new token for the form link
    const guarantorToken = generateToken()
    const guarantorTokenHash = hash(guarantorToken)
    const tokenExpiresAt = new Date()
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 21)

    // Update the token hash in the guarantor reference
    await supabase
      .from('tenant_references')
      .update({
        reference_token_hash: guarantorTokenHash,
        token_expires_at: tokenExpiresAt.toISOString()
      })
      .eq('id', guarantorReferenceId)

    // Get company info
    const { data: companyData } = await supabase
      .from('companies')
      .select('name_encrypted, phone_encrypted, email_encrypted')
      .eq('id', guarantorRef.company_id)
      .single()

    // Guarantor's own name (stored in tenant fields for guarantor references)
    const guarantorName = `${decrypt(guarantorRef.tenant_first_name_encrypted) || ''} ${decrypt(guarantorRef.tenant_last_name_encrypted) || ''}`.trim()
    // Tenant's name (from parent reference)
    const tenantName = parentRef
      ? `${decrypt(parentRef.tenant_first_name_encrypted) || ''} ${decrypt(parentRef.tenant_last_name_encrypted) || ''}`.trim()
      : 'the tenant'
    const propertyAddress = parentRef?.property_address_encrypted
      ? decrypt(parentRef.property_address_encrypted) || 'the property'
      : 'the property'
    const companyName = companyData?.name_encrypted ? decrypt(companyData.name_encrypted) || 'Your agent' : 'Your agent'
    const companyPhone = companyData?.phone_encrypted ? (decrypt(companyData.phone_encrypted) || '') : ''
    const companyEmail = companyData?.email_encrypted ? (decrypt(companyData.email_encrypted) || '') : ''

    // Use submit-reference form link (guarantors fill out a tenant reference form)
    const formLink = `${process.env.FRONTEND_URL}/submit-reference/${guarantorToken}`

    await sendGuarantorReferenceRequest(
      guarantorEmail,
      guarantorName,
      tenantName,
      propertyAddress,
      companyName,
      companyPhone,
      companyEmail,
      formLink,
      guarantorRef.id
    )

    // Send SMS to guarantor (non-blocking)
    const guarantorPhoneValue = decrypt(guarantorRef.tenant_phone_encrypted)
    if (guarantorPhoneValue) {
      sendGuarantorReferenceRequestSMS(
        guarantorPhoneValue,
        guarantorName,
        tenantName,
        formLink,
        guarantorReferenceId
      ).catch(err => console.error('Failed to send SMS to guarantor:', err))
    }

    // Log to audit trail
    await logAuditAction({
      referenceId: guarantorReferenceId,
      action: 'EMAIL_RESENT',
      description: `Guarantor reference email resent to ${guarantorEmail}`,
      metadata: { emailType: 'guarantor_self', recipient: guarantorEmail },
      userId
    })

    res.json({ message: 'Guarantor reference email resent successfully' })
  } catch (error: any) {
    console.error('Failed to resend guarantor self email:', error)
    res.status(500).json({ error: error.message })
  }
})

// Generate and download PDF report for a reference
router.get('/:id/report', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const referenceId = req.params.id

    // Check if user is staff (staff can view all reports)
    const { data: staffUser } = await supabase
      .from('staff_users')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (!staffUser) {
      // Not staff, must be company user - verify they own this reference
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
      const { data: reference } = await supabase
        .from('tenant_references')
        .select('id, company_id')
        .eq('id', referenceId)
        .eq('company_id', companyUser.company_id)
        .single()

      if (!reference) {
        return res.status(404).json({ error: 'Reference not found' })
      }
    }

    // Generate the PDF (returns buffer and name)
    const pdfResult = await generateReferenceReportPDF(referenceId)

    console.log('[PDF] Generated PDF with names:', pdfResult.firstName, pdfResult.lastName)

    const filename = `PropertyGoose_Reference_Report_${pdfResult.firstName.replace(/\s+/g, '_')}_${pdfResult.lastName.replace(/\s+/g, '_')}.pdf`

    console.log('[PDF] Sending filename:', filename)

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', pdfResult.buffer.length)

    // Send the PDF
    res.send(pdfResult.buffer)
  } catch (error: any) {
    console.error('Failed to generate PDF report:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router

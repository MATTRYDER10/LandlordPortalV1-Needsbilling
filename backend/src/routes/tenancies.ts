import { Router } from 'express'
import multer from 'multer'
import { authenticateToken, AuthRequest, getCompanyIdForRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import { decrypt, encrypt } from '../services/encryption'
import { getFrontendUrl } from '../utils/frontendUrl'
import {
  sendInitialMoniesRequest,
  sendTenantPaymentConfirmedNotification,
  sendMoveInPack,
  sendEnhancedMoveInPack,
  sendMoveInTimeRequest,
  sendMoveInTimeSuggestions,
  sendMoveInTimeSubmittedNotification,
  sendMoveInTimeConfirmation
} from '../services/emailService'
import {
  Tenancy,
  TenancyPerson,
  TenancyStatus,
  StatusCounts,
  deriveTenancyStatus,
  calculateProgressSummary,
  // Batch functions for performance
  batchGetVerificationSections,
  batchGetChaseDependencies,
  batchGetReasonCodeLabels,
  buildTenancyPersonSync,
  generateBlockingSentenceSync
} from '../services/tenancyStatusService'
import { evaluateAndTransition } from '../services/verificationStateService'
import * as tenancyService from '../services/tenancyService'
import { cancelScheduleForTenancy, reactivateScheduleForTenancy, updateNoticeEndDate } from '../services/rentgooseService'
import * as conversionService from '../services/tenancyConversionService'
import * as emailService from '../services/emailService'

const router = Router()

// Multer configuration for email attachments
const emailAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Max 5 files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    ]
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type'))
    }
  }
})

/**
 * Check if an employer bounce should be suppressed from display
 * Suppresses if ANY of these conditions are true:
 * - Employer reference has been received (submitted_at is set)
 * - Reference is verified (status is 'completed')
 * - Proof of income exists (payslips uploaded)
 */
function shouldSuppressEmployerBounce(
  reference: any,
  emailIssue: { status: string; referenceType: string }
): boolean {
  // Only suppress employer bounces, not other types (landlord, tenant, etc.)
  if (emailIssue.referenceType !== 'employer') return false

  // Condition 1: Employer reference has been received
  const employerRef = reference.employer_references?.[0]
  if (employerRef?.submitted_at) return true

  // Condition 2: Reference is verified (completed status)
  if (reference.status === 'completed') return true

  // Condition 3: Proof of income exists (payslips uploaded)
  if (reference.payslip_files?.length > 0) return true

  return false
}

/**
 * GET /api/tenancies
 * Get all tenancies for the authenticated user's company
 *
 * Query params:
 * - status: Filter by tenancy status (IN_PROGRESS, AWAITING_VERIFICATION, ACTION_REQUIRED, COMPLETED, REJECTED)
 * - search: Search by property address or tenant name
 * - sortBy: Sort field (move_in_date, created_at) - default: move_in_date
 * - sortOrder: Sort direction (asc, desc) - default: asc
 */
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const statusFilter = req.query.status as string | undefined
    const search = req.query.search as string | undefined
    const sortBy = (req.query.sortBy as string) || 'move_in_date'
    const sortOrder = (req.query.sortOrder as string) || 'asc'

    // Get company ID (supports admin override)
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Fetch all references for the company (excluding standalone guarantors)
    // We'll group them into tenancies
    const { data: references, error: refError } = await supabase
      .from('tenant_references')
      .select(`
        id,
        company_id,
        status,
        verification_state,
        is_guarantor,
        parent_reference_id,
        is_group_parent,
        guarantor_for_reference_id,
        tenant_first_name_encrypted,
        tenant_last_name_encrypted,
        tenant_email_encrypted,
        tenant_phone_encrypted,
        property_address_encrypted,
        property_city_encrypted,
        property_postcode_encrypted,
        monthly_rent,
        move_in_date,
        rent_share,
        created_at,
        submitted_at,
        urgent_reverify,
        income_student,
        income_regular_employment,
        income_self_employed,
        income_benefits,
        income_unemployed,
        id_document_path,
        selfie_path,
        tax_return_path,
        payslip_files,
        proof_of_additional_income_path,
        benefits_annual_amount_encrypted,
        confirmed_residential_status,
        reference_type,
        previous_landlord_email_encrypted,
        employer_references (id, submitted_at),
        landlord_references (id, submitted_at),
        agent_references (id, submitted_at),
        accountant_references (id, submitted_at)
      `)
      .eq('company_id', companyId)
      .order(sortBy === 'move_in_date' ? 'move_in_date' : 'created_at', { ascending: sortOrder === 'asc' })

    if (refError) {
      console.error('Error fetching references:', refError)
      return res.status(500).json({ error: 'Failed to fetch references' })
    }

    console.log(`[Tenancies API] Found ${references?.length || 0} references for company ${companyId}`)

    const shouldRefresh =
      req.query.refresh === 'true' &&
      (req.hostname === 'localhost' || req.hostname === '127.0.0.1')

    if (shouldRefresh) {
      const refreshCandidates = references.filter(ref =>
        ref.verification_state === 'COLLECTING_EVIDENCE' && ref.submitted_at
      )

      await Promise.all(refreshCandidates.map(async (ref) => {
        const evaluation = await evaluateAndTransition(ref.id, 'Auto refresh on tenancies fetch', req.user?.id)
        if (evaluation.transitioned && evaluation.newState) {
          ref.verification_state = evaluation.newState
        }
      }))
    }

    // Group references into tenancies
    // A tenancy is either:
    // 1. A group parent reference (is_group_parent = true) with its children
    // 2. A standalone reference (no parent_reference_id and is_group_parent = false)
    const tenancyMap = new Map<string, {
      parentRef: any,
      children: any[],
      guarantors: any[]
    }>()

    // First pass: identify all group parents and standalone references
    for (const ref of references || []) {
      // Skip guarantor references in first pass
      if (ref.is_guarantor) continue

      if (ref.is_group_parent) {
        // This is a group parent - create tenancy entry
        tenancyMap.set(ref.id, {
          parentRef: ref,
          children: [],
          guarantors: []
        })
      } else if (!ref.parent_reference_id) {
        // Standalone reference (no parent) - create its own tenancy
        tenancyMap.set(ref.id, {
          parentRef: ref,
          children: [],
          guarantors: []
        })
      }
    }

    // Second pass: add children to their parents
    for (const ref of references || []) {
      if (ref.is_guarantor) continue

      if (ref.parent_reference_id) {
        // This is a child of a group - add to parent's children
        let parent = tenancyMap.get(ref.parent_reference_id)
        if (!parent) {
          // Parent might not be in the map if it wasn't marked as is_group_parent
          // In this case, find the parent ref and add it
          const parentRef = (references || []).find(r => r.id === ref.parent_reference_id)
          if (parentRef) {
            parent = {
              parentRef: parentRef,
              children: [],
              guarantors: []
            }
            tenancyMap.set(ref.parent_reference_id, parent)
          }
        }
        if (parent) {
          parent.children.push(ref)
        }
      }
    }

    // Third pass: add guarantors to their tenants
    for (const ref of references || []) {
      if (!ref.is_guarantor) continue

      // Find which tenancy this guarantor belongs to
      if (ref.guarantor_for_reference_id) {
        // Find the tenancy containing this tenant
        for (const [tenancyId, tenancy] of tenancyMap) {
          if (tenancy.parentRef.id === ref.guarantor_for_reference_id ||
              tenancy.children.some(c => c.id === ref.guarantor_for_reference_id)) {
            tenancy.guarantors.push(ref)
            break
          }
        }
      }
    }

    // PERFORMANCE OPTIMIZATION: Batch fetch all verification sections and dependencies upfront
    // This reduces 500+ queries down to just 2 queries
    const allReferenceIds: string[] = []
    for (const [, { parentRef, children, guarantors }] of tenancyMap) {
      allReferenceIds.push(parentRef.id)
      allReferenceIds.push(...children.map(c => c.id))
      allReferenceIds.push(...guarantors.map(g => g.id))
    }

    console.log(`[Tenancies API] Batch fetching data for ${allReferenceIds.length} references`)

    // Fetch all data in parallel (5 queries instead of 500+)
    const [sectionsMap, dependenciesMap, reasonCodeLabels, emailIssuesData, emailDeliveredData] = await Promise.all([
      batchGetVerificationSections(allReferenceIds),
      batchGetChaseDependencies(allReferenceIds),
      batchGetReasonCodeLabels(),
      // Fetch email delivery issues (bounced or complained)
      supabase
        .from('email_delivery_logs')
        .select('reference_id, reference_type, status, error_message, created_at')
        .in('reference_id', allReferenceIds)
        .in('status', ['bounced', 'complained']),
      // Fetch successful deliveries to check if bounce was superseded
      supabase
        .from('email_delivery_logs')
        .select('reference_id, reference_type, created_at')
        .in('reference_id', allReferenceIds)
        .eq('status', 'delivered')
    ])

    // Build a map of reference_id+reference_type -> latest delivery timestamp
    const latestDeliveryMap = new Map<string, Date>()
    if (emailDeliveredData.data) {
      for (const delivery of emailDeliveredData.data) {
        if (delivery.reference_id) {
          const key = `${delivery.reference_id}:${delivery.reference_type || 'tenant'}`
          const existingDate = latestDeliveryMap.get(key)
          const deliveryDate = new Date(delivery.created_at)
          if (!existingDate || deliveryDate > existingDate) {
            latestDeliveryMap.set(key, deliveryDate)
          }
        }
      }
    }

    // Build a map of reference_id -> array of email delivery issues (multiple types per reference)
    // Only include bounces that haven't been superseded by a successful delivery
    const emailIssuesMap = new Map<string, Array<{ status: string; referenceType: string; errorMessage?: string }>>()
    if (emailIssuesData.data) {
      for (const issue of emailIssuesData.data) {
        if (issue.reference_id) {
          const refType = issue.reference_type || 'tenant'
          const key = `${issue.reference_id}:${refType}`
          const latestDelivery = latestDeliveryMap.get(key)
          const bounceDate = new Date(issue.created_at)

          // Skip this bounce if there's a successful delivery after it
          if (latestDelivery && latestDelivery > bounceDate) {
            continue
          }

          const existing = emailIssuesMap.get(issue.reference_id) || []
          existing.push({
            status: issue.status,
            referenceType: refType,
            errorMessage: issue.error_message
          })
          emailIssuesMap.set(issue.reference_id, existing)
        }
      }
    }

    // Build tenancy objects (no more database queries needed!)
    const tenancies: Tenancy[] = []

    for (const [tenancyId, tenancyData] of tenancyMap) {
      const { parentRef, children, guarantors } = tenancyData

      // Build people array using sync functions (no queries)
      const people: TenancyPerson[] = []

      // Add tenants
      if (children.length > 0) {
        // Multi-tenant: use children as tenants
        for (const child of children) {
          const person = buildTenancyPersonSync(child, sectionsMap, dependenciesMap, reasonCodeLabels)
          // Check for email delivery issues for this person (tenant's own email or referee emails)
          const emailIssues = emailIssuesMap.get(person.id)
          if (emailIssues && emailIssues.length > 0) {
            // Find first non-suppressed issue (skip employer bounces when ref received/verified/has payslips)
            const validIssue = emailIssues.find(issue => !shouldSuppressEmployerBounce(child, issue))
            if (validIssue) {
              person.emailDeliveryIssue = {
                type: validIssue.status as 'bounced' | 'complained',
                referenceType: validIssue.referenceType as any,
                errorMessage: validIssue.errorMessage
              }
            }
          }
          people.push(person)
        }
      } else {
        // Single tenant: use parent as tenant
        const person = buildTenancyPersonSync(parentRef, sectionsMap, dependenciesMap, reasonCodeLabels)
        // Check for email delivery issues for this person (tenant's own email or referee emails)
        const emailIssues = emailIssuesMap.get(person.id)
        if (emailIssues && emailIssues.length > 0) {
          // Find first non-suppressed issue (skip employer bounces when ref received/verified/has payslips)
          const validIssue = emailIssues.find(issue => !shouldSuppressEmployerBounce(parentRef, issue))
          if (validIssue) {
            person.emailDeliveryIssue = {
              type: validIssue.status as 'bounced' | 'complained',
              referenceType: validIssue.referenceType as any,
              errorMessage: validIssue.errorMessage
            }
          }
        }
        people.push(person)
      }

      // Add guarantors
      for (const guarantor of guarantors) {
        const person = buildTenancyPersonSync(guarantor, sectionsMap, dependenciesMap, reasonCodeLabels)
        // Check for email delivery issues for this person
        const emailIssues = emailIssuesMap.get(person.id)
        if (emailIssues && emailIssues.length > 0) {
          // Find first non-suppressed issue (skip employer bounces when ref received/verified/has payslips)
          const validIssue = emailIssues.find(issue => !shouldSuppressEmployerBounce(guarantor, issue))
          if (validIssue) {
            person.emailDeliveryIssue = {
              type: validIssue.status as 'bounced' | 'complained',
              referenceType: validIssue.referenceType as any,
              errorMessage: validIssue.errorMessage
            }
          }
        }
        people.push(person)
      }

      // Derive tenancy status from people
      const tenancyStatus = deriveTenancyStatus(people)

      // Generate blocking sentence using pre-fetched data (no queries)
      const blockingSentence = generateBlockingSentenceSync(people, sectionsMap, dependenciesMap)

      // Calculate progress summary
      const progressSummary = calculateProgressSummary(people)

      // Check if any reference has urgent_reverify flag
      const urgentReverify = parentRef.urgent_reverify ||
        children.some(c => c.urgent_reverify) ||
        guarantors.some(g => g.urgent_reverify)

      const tenancy: Tenancy = {
        id: tenancyId,
        propertyAddress: decrypt(parentRef.property_address_encrypted) || '',
        propertyCity: decrypt(parentRef.property_city_encrypted) || '',
        propertyPostcode: decrypt(parentRef.property_postcode_encrypted) || '',
        moveInDate: parentRef.move_in_date || '',
        monthlyRent: parentRef.monthly_rent || 0,
        tenancyStatus,
        urgentReverify: urgentReverify || false,
        blockingSentence,
        progressSummary,
        people,
        createdAt: parentRef.created_at
      }

      tenancies.push(tenancy)
    }

    // Apply status filter
    let filteredTenancies = tenancies
    if (statusFilter) {
      const statusMap: Record<string, TenancyStatus> = {
        'in_progress': 'IN_PROGRESS',
        'awaiting_verification': 'AWAITING_VERIFICATION',
        'action_required': 'ACTION_REQUIRED',
        'completed': 'COMPLETED',
        'rejected': 'REJECTED',
        'sent': 'SENT'
      }
      const mappedStatus = statusMap[statusFilter.toLowerCase()] || statusFilter.toUpperCase() as TenancyStatus
      filteredTenancies = tenancies.filter(t => t.tenancyStatus === mappedStatus)
    }

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase()
      filteredTenancies = filteredTenancies.filter(t =>
        t.propertyAddress.toLowerCase().includes(searchLower) ||
        t.propertyCity.toLowerCase().includes(searchLower) ||
        t.propertyPostcode.toLowerCase().includes(searchLower) ||
        t.people.some(p => p.name.toLowerCase().includes(searchLower) ||
                         p.email.toLowerCase().includes(searchLower))
      )
    }

    // Calculate status counts
    // Note: IN_PROGRESS tab includes SENT, IN_PROGRESS, and COLLECTING_EVIDENCE statuses
    const inProgressStatuses = ['IN_PROGRESS', 'SENT', 'COLLECTING_EVIDENCE']
    const today = new Date().toISOString().split('T')[0]
    const statusCounts: StatusCounts = {
      all: tenancies.length,
      inProgress: tenancies.filter(t => inProgressStatuses.includes(t.tenancyStatus)).length,
      awaitingVerification: tenancies.filter(t => t.tenancyStatus === 'AWAITING_VERIFICATION').length,
      actionRequired: tenancies.filter(t => t.tenancyStatus === 'ACTION_REQUIRED').length,
      completed: tenancies.filter(t =>
        t.tenancyStatus === 'COMPLETED' && (!t.moveInDate || t.moveInDate >= today)
      ).length,
      movedIn: tenancies.filter(t =>
        t.tenancyStatus === 'COMPLETED' && t.moveInDate && t.moveInDate < today
      ).length,
      rejected: tenancies.filter(t => t.tenancyStatus === 'REJECTED').length
    }

    // Sort tenancies
    filteredTenancies.sort((a, b) => {
      let valueA: any, valueB: any

      if (sortBy === 'move_in_date') {
        valueA = a.moveInDate ? new Date(a.moveInDate).getTime() : 0
        valueB = b.moveInDate ? new Date(b.moveInDate).getTime() : 0
      } else {
        valueA = a.createdAt ? new Date(a.createdAt).getTime() : 0
        valueB = b.createdAt ? new Date(b.createdAt).getTime() : 0
      }

      if (sortOrder === 'asc') {
        return valueA - valueB
      } else {
        return valueB - valueA
      }
    })

    res.json({
      tenancies: filteredTenancies,
      statusCounts
    })
  } catch (error: any) {
    console.error('Error in GET /api/tenancies:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/tenancies/:id
 * Get a single tenancy by ID with full details
 */
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tenancyId = req.params.id

    // Get company from X-Branch-Id header or user's company
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Define the select fields for references (including readiness check fields)
    const referenceSelectFields = `
      *,
      employer_references (id, submitted_at),
      landlord_references (id, submitted_at),
      agent_references (id, submitted_at),
      accountant_references (id, submitted_at)
    `

    // Get the parent reference
    const { data: parentRef, error: parentError } = await supabase
      .from('tenant_references')
      .select(referenceSelectFields)
      .eq('id', tenancyId)
      .eq('company_id', companyId)
      .single()

    if (parentError || !parentRef) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    // Get children if this is a group parent
    const { data: children } = await supabase
      .from('tenant_references')
      .select(referenceSelectFields)
      .eq('parent_reference_id', tenancyId)
      .eq('is_guarantor', false)

    // Get guarantors
    const referenceIds = [tenancyId, ...(children?.map(c => c.id) || [])]
    const { data: guarantors } = await supabase
      .from('tenant_references')
      .select(referenceSelectFields)
      .in('guarantor_for_reference_id', referenceIds)
      .eq('is_guarantor', true)

    // Batch fetch verification sections, dependencies, and reason code labels for performance
    const allRefIds = [tenancyId, ...(children?.map(c => c.id) || []), ...(guarantors?.map(g => g.id) || [])]
    const [sectionsMap, dependenciesMap, reasonCodeLabels] = await Promise.all([
      batchGetVerificationSections(allRefIds),
      batchGetChaseDependencies(allRefIds),
      batchGetReasonCodeLabels()
    ])

    // Build people array using sync functions
    const people: TenancyPerson[] = []

    if (children && children.length > 0) {
      for (const child of children) {
        people.push(buildTenancyPersonSync(child, sectionsMap, dependenciesMap, reasonCodeLabels))
      }
    } else {
      people.push(buildTenancyPersonSync(parentRef, sectionsMap, dependenciesMap, reasonCodeLabels))
    }

    for (const guarantor of guarantors || []) {
      people.push(buildTenancyPersonSync(guarantor, sectionsMap, dependenciesMap, reasonCodeLabels))
    }

    // Derive status and generate blocking sentence
    const tenancyStatus = deriveTenancyStatus(people)
    const blockingSentence = generateBlockingSentenceSync(people, sectionsMap, dependenciesMap)
    const progressSummary = calculateProgressSummary(people)

    const urgentReverify = parentRef.urgent_reverify ||
      (children?.some(c => c.urgent_reverify)) ||
      (guarantors?.some(g => g.urgent_reverify))

    const tenancy: Tenancy = {
      id: tenancyId,
      propertyAddress: decrypt(parentRef.property_address_encrypted) || '',
      propertyCity: decrypt(parentRef.property_city_encrypted) || '',
      propertyPostcode: decrypt(parentRef.property_postcode_encrypted) || '',
      moveInDate: parentRef.move_in_date || '',
      monthlyRent: parentRef.monthly_rent || 0,
      tenancyStatus,
      urgentReverify: urgentReverify || false,
      blockingSentence,
      progressSummary,
      people,
      createdAt: parentRef.created_at
    }

    res.json({ tenancy })
  } catch (error: any) {
    console.error('Error in GET /api/tenancies/:id:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// ACTUAL TENANCIES (post-conversion tenancy records)
// These endpoints work with the tenancies table, not references
// NOTE: Routes are prefixed with /records/ or /convert/ to avoid collision
// with the wildcard /:id route above
// ============================================================================

/**
 * GET /api/tenancies/records/stats
 * Get tenancy statistics for the dashboard
 */
router.get('/records/stats', authenticateToken, async (req: AuthRequest, res) => {
  try {
    console.log('[Stats] Getting company ID for user:', req.user?.id)
    const companyId = await getCompanyIdForRequest(req)
    console.log('[Stats] Company ID:', companyId)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Get all tenancies for the company
    // Note: Column is tenancy_end_date or fixed_term_end_date, not end_date
    const { data: tenancies, error } = await supabase
      .from('tenancies')
      .select('id, status, fixed_term_end_date, deposit_amount, deposit_protected_at')
      .eq('company_id', companyId)
      .is('deleted_at', null)

    if (error) {
      console.error('Error fetching tenancy stats:', error.message, error.details, error.hint)
      return res.status(500).json({ error: 'Failed to fetch tenancy stats', details: error.message })
    }

    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    console.log(`[Stats] Found ${tenancies?.length || 0} tenancies for company ${companyId}`)

    // Log deposit info for debugging
    const pendingWithDeposit = tenancies?.filter(t =>
      t.status === 'pending' && t.deposit_amount && t.deposit_amount > 0
    ) || []
    console.log(`[Stats] Pending tenancies with deposit: ${pendingWithDeposit.length}`)
    pendingWithDeposit.forEach(t => {
      console.log(`  - ID: ${t.id}, deposit: ${t.deposit_amount}, protected: ${t.deposit_protected_at}`)
    })

    // Calculate stats
    const stats = {
      active: tenancies?.filter(t => t.status === 'active').length || 0,
      pending: tenancies?.filter(t => t.status === 'pending').length || 0,
      expiringSoon: tenancies?.filter(t => {
        if (t.status !== 'active' || !t.fixed_term_end_date) return false
        const endDate = new Date(t.fixed_term_end_date)
        return endDate >= now && endDate <= thirtyDaysFromNow
      }).length || 0,
      depositsToProtect: tenancies?.filter(t => {
        return t.deposit_amount && t.deposit_amount > 0 && !t.deposit_protected_at &&
          (t.status === 'active' || t.status === 'pending')
      }).length || 0,
      noticeGiven: tenancies?.filter(t => t.status === 'notice_given').length || 0,
      ended: tenancies?.filter(t => ['ended', 'terminated', 'expired', 'fallen_through'].includes(t.status)).length || 0,
      total: tenancies?.length || 0
    }

    console.log('[Stats] Calculated stats:', stats)
    res.json(stats)
  } catch (error: any) {
    console.error('Error in GET /api/tenancies/records/stats:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/tenancies/records/active
 * Get all active tenancies (from tenancies table, not references)
 */
router.get('/records/active', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { limit, offset, propertyId, search } = req.query

    const result = await tenancyService.listTenancies(companyId, {
      status: ['pending', 'active', 'notice_given'],
      propertyId: propertyId as string,
      search: search as string
    }, {
      limit: limit ? parseInt(limit as string) : 500,
      offset: offset ? parseInt(offset as string) : 0
    })

    // Enrich with UniHome data from linked offers via references
    const refIds = [...new Set(result.tenancies.map(t => t.primary_reference_id).filter(Boolean))]
    const offerUnihomesMap = new Map<string, { offer_unihomes: boolean; unihomes_interested: boolean }>()
    if (refIds.length > 0) {
      const { data: refs } = await supabase
        .from('tenant_references_v2')
        .select('id, offer_id')
        .in('id', refIds)
        .not('offer_id', 'is', null)
      const offerIds = [...new Set((refs || []).map(r => r.offer_id).filter(Boolean))]
      if (offerIds.length > 0) {
        const { data: offers } = await supabase
          .from('tenant_offers')
          .select('id, offer_unihomes, unihomes_interested')
          .in('id', offerIds)
        const offerMap = new Map((offers || []).map(o => [o.id, o]))
        for (const ref of (refs || [])) {
          if (ref.offer_id && offerMap.has(ref.offer_id)) {
            const offer = offerMap.get(ref.offer_id)!
            offerUnihomesMap.set(ref.id, { offer_unihomes: offer.offer_unihomes, unihomes_interested: offer.unihomes_interested })
          }
        }
      }
    }

    const enrichedTenancies = result.tenancies.map(t => {
      const uniData = t.primary_reference_id ? offerUnihomesMap.get(t.primary_reference_id) : null
      return {
        ...t,
        offer_unihomes: uniData?.offer_unihomes || false,
        unihomes_interested: uniData?.unihomes_interested || false
      }
    })

    res.json({ tenancies: enrichedTenancies, total: result.total })
  } catch (error: any) {
    console.error('Error in GET /api/tenancies/active:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/tenancies/records/archived
 * Get all archived (ended, terminated, expired) tenancies
 */
router.get('/records/archived', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { limit, offset, search } = req.query

    const result = await tenancyService.listTenancies(companyId, {
      status: ['ended', 'terminated', 'expired', 'fallen_through'],
      search: search as string
    }, {
      limit: limit ? parseInt(limit as string) : 100,
      offset: offset ? parseInt(offset as string) : 0
    })

    // Enrich with UniHome data from linked offers via references
    const refIds = [...new Set(result.tenancies.map(t => t.primary_reference_id).filter(Boolean))]
    const offerUnihomesMap = new Map<string, { offer_unihomes: boolean; unihomes_interested: boolean }>()
    if (refIds.length > 0) {
      const { data: refs } = await supabase
        .from('tenant_references_v2')
        .select('id, offer_id')
        .in('id', refIds)
        .not('offer_id', 'is', null)
      const offerIds = [...new Set((refs || []).map(r => r.offer_id).filter(Boolean))]
      if (offerIds.length > 0) {
        const { data: offers } = await supabase
          .from('tenant_offers')
          .select('id, offer_unihomes, unihomes_interested')
          .in('id', offerIds)
        const offerMap = new Map((offers || []).map(o => [o.id, o]))
        for (const ref of (refs || [])) {
          if (ref.offer_id && offerMap.has(ref.offer_id)) {
            const offer = offerMap.get(ref.offer_id)!
            offerUnihomesMap.set(ref.id, { offer_unihomes: offer.offer_unihomes, unihomes_interested: offer.unihomes_interested })
          }
        }
      }
    }

    const enrichedTenancies = result.tenancies.map(t => {
      const uniData = t.primary_reference_id ? offerUnihomesMap.get(t.primary_reference_id) : null
      return {
        ...t,
        offer_unihomes: uniData?.offer_unihomes || false,
        unihomes_interested: uniData?.unihomes_interested || false
      }
    })

    res.json({ tenancies: enrichedTenancies, total: result.total })
  } catch (error: any) {
    console.error('Error in GET /api/tenancies/records/archived:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/tenancies/records/calendar
 * Get upcoming move-in dates from the tenancies table for the dashboard calendar
 */
router.get('/records/calendar', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const now = new Date()
    const endDate = new Date(now.getFullYear(), now.getMonth() + 12, 0)

    // Show all pending/active tenancies with a start date
    const { data: tenancies, error } = await supabase
      .from('tenancies')
      .select('id, tenancy_start_date, monthly_rent, status, property_id, compliance_pack_sent_at, initial_monies_paid_at, move_in_time_confirmed, agreement_id')
      .eq('company_id', companyId)
      .in('status', ['pending', 'active'])
      .is('deleted_at', null)
      .not('tenancy_start_date', 'is', null)
      .lte('tenancy_start_date', endDate.toISOString().split('T')[0])
      .order('tenancy_start_date', { ascending: true })

    if (error) {
      console.error('Tenancy calendar query error:', error)
      return res.status(500).json({ error: 'Failed to fetch calendar data' })
    }

    // Deduplicate: one entry per tenancy ID (shouldn't duplicate, but safety check)
    // Also deduplicate per property - keep active over pending, then most recent
    const seenProperties = new Map<string, any>()
    const deduped = (tenancies || []).filter(t => {
      if (!t.property_id) return true
      const existing = seenProperties.get(t.property_id)
      if (!existing) {
        seenProperties.set(t.property_id, t)
        return true
      }
      // Prefer active over pending
      if (t.status === 'active' && existing.status === 'pending') {
        seenProperties.set(t.property_id, t)
        // Remove the old one by marking — we'll filter after
        ;(existing as any)._skip = true
        return true
      }
      return false
    }).filter(t => !(t as any)._skip)

    // Fetch property addresses and tenants separately to avoid join issues
    const propertyIds = [...new Set(deduped.map(t => t.property_id).filter(Boolean))]
    const tenancyIds = deduped.map(t => t.id)

    let propertyMap = new Map<string, any>()
    if (propertyIds.length > 0) {
      const { data: properties } = await supabase
        .from('properties')
        .select('id, address_line1_encrypted, city_encrypted, postcode')
        .in('id', propertyIds)
      if (properties) {
        for (const p of properties) {
          propertyMap.set(p.id, p)
        }
      }
    }

    let tenantMap = new Map<string, any[]>()
    if (tenancyIds.length > 0) {
      const { data: allTenants, error: tenantError } = await supabase
        .from('tenancy_tenants')
        .select('id, tenancy_id, tenant_name_encrypted, tenant_order, is_lead_tenant, status')
        .in('tenancy_id', tenancyIds)
        .eq('is_active', true)
      if (tenantError) {
        console.error('Tenant query error:', tenantError)
      }
      if (allTenants) {
        for (const t of allTenants) {
          if (!tenantMap.has(t.tenancy_id)) tenantMap.set(t.tenancy_id, [])
          tenantMap.get(t.tenancy_id)!.push(t)
        }
      }
    }

    // For each tenancy with an agreement_id, check if the agreement is signed
    const agreementIds = deduped
      .map(t => t.agreement_id)
      .filter((id): id is string => !!id)

    let agreementMap = new Map<string, string>()
    if (agreementIds.length > 0) {
      const { data: agreements } = await supabase
        .from('agreements')
        .select('id, signing_status')
        .in('id', agreementIds)

      if (agreements) {
        for (const a of agreements) {
          agreementMap.set(a.id, a.signing_status)
        }
      }
    }

    const entries = deduped.map(tenancy => {
      let propertyAddress = ''
      let propertyCity = ''
      let propertyPostcode = ''
      const prop = propertyMap.get(tenancy.property_id)
      if (prop) {
        try {
          propertyAddress = prop.address_line1_encrypted ? (decrypt(prop.address_line1_encrypted) || '') : ''
          propertyCity = prop.city_encrypted ? (decrypt(prop.city_encrypted) || '') : ''
          propertyPostcode = prop.postcode || ''
        } catch (e) {}
      }

      const tenantList: Array<{ id: string; name: string }> = []
      for (const tenant of (tenantMap.get(tenancy.id) || [])) {
        let tenantName = 'Unknown'
        try {
          tenantName = tenant.tenant_name_encrypted ? (decrypt(tenant.tenant_name_encrypted) || 'Unknown') : 'Unknown'
        } catch (e) {}
        tenantList.push({ id: tenant.id, name: tenantName })
      }

      // Sort tenants by order
      tenantList.sort((a, b) => {
        const tenantA = (tenantMap.get(tenancy.id) || []).find((t: any) => t.id === a.id)
        const tenantB = (tenantMap.get(tenancy.id) || []).find((t: any) => t.id === b.id)
        return (tenantA?.tenant_order || 99) - (tenantB?.tenant_order || 99)
      })

      // Check pre-tenancy actions
      const agreementSigned = tenancy.agreement_id
        ? ['fully_signed', 'executed'].includes(agreementMap.get(tenancy.agreement_id) || '')
        : false

      const allActionsComplete =
        !!tenancy.compliance_pack_sent_at &&
        !!agreementSigned &&
        !!tenancy.initial_monies_paid_at &&
        !!tenancy.move_in_time_confirmed

      return {
        tenancyId: tenancy.id,
        moveInDate: (tenancy as any).tenancy_start_date,
        property: {
          address: propertyAddress,
          city: propertyCity,
          postcode: propertyPostcode
        },
        rentAmount: tenancy.monthly_rent || null,
        tenants: tenantList,
        allActionsComplete,
        type: 'move_in' as const
      }
    })

    // Fetch upcoming move-out entries (notice_given tenancies with actual_end_date in range)
    let moveOutEntries: any[] = []
    try {
      const { data: moveOutTenancies, error: moveOutError } = await supabase
        .from('tenancies')
        .select('id, actual_end_date, monthly_rent, property_id')
        .eq('company_id', companyId)
        .eq('status', 'notice_given')
        .is('deleted_at', null)
        .not('actual_end_date', 'is', null)
        .gte('actual_end_date', now.toISOString().split('T')[0])
        .lte('actual_end_date', endDate.toISOString().split('T')[0])
        .order('actual_end_date', { ascending: true })

      if (moveOutError) {
        console.error('Move-out calendar query error:', moveOutError)
      } else if (moveOutTenancies && moveOutTenancies.length > 0) {
        const moPropertyIds = [...new Set(moveOutTenancies.map(t => t.property_id).filter(Boolean))]
        let moPropertyMap = new Map<string, any>()
        if (moPropertyIds.length > 0) {
          const { data: moProperties } = await supabase
            .from('properties')
            .select('id, address_line1_encrypted, city_encrypted, postcode')
            .in('id', moPropertyIds)
          if (moProperties) {
            for (const p of moProperties) moPropertyMap.set(p.id, p)
          }
        }

        const moTenancyIds = moveOutTenancies.map(t => t.id)
        let moTenantMap = new Map<string, any[]>()
        if (moTenancyIds.length > 0) {
          const { data: moTenants } = await supabase
            .from('tenancy_tenants')
            .select('id, tenancy_id, tenant_name_encrypted, tenant_order, is_lead_tenant, status')
            .in('tenancy_id', moTenancyIds)
            .eq('is_active', true)
          if (moTenants) {
            for (const t of moTenants) {
              if (!moTenantMap.has(t.tenancy_id)) moTenantMap.set(t.tenancy_id, [])
              moTenantMap.get(t.tenancy_id)!.push(t)
            }
          }
        }

        moveOutEntries = moveOutTenancies.map(tenancy => {
          const prop = moPropertyMap.get(tenancy.property_id)
          let propertyAddress = ''
          let propertyCity = ''
          let propertyPostcode = ''
          if (prop) {
            try {
              propertyAddress = prop.address_line1_encrypted ? (decrypt(prop.address_line1_encrypted) || '') : ''
              propertyCity = prop.city_encrypted ? (decrypt(prop.city_encrypted) || '') : ''
              propertyPostcode = prop.postcode || ''
            } catch (e) {}
          }

          const tenantList: Array<{ id: string; name: string }> = []
          for (const tenant of (moTenantMap.get(tenancy.id) || [])) {
            let tenantName = 'Unknown'
            try {
              tenantName = tenant.tenant_name_encrypted ? (decrypt(tenant.tenant_name_encrypted) || 'Unknown') : 'Unknown'
            } catch (e) {}
            tenantList.push({ id: tenant.id, name: tenantName })
          }
          tenantList.sort((a, b) => {
            const tenantA = (moTenantMap.get(tenancy.id) || []).find((t: any) => t.id === a.id)
            const tenantB = (moTenantMap.get(tenancy.id) || []).find((t: any) => t.id === b.id)
            return (tenantA?.tenant_order || 99) - (tenantB?.tenant_order || 99)
          })

          return {
            tenancyId: tenancy.id,
            moveInDate: tenancy.actual_end_date,
            property: {
              address: propertyAddress,
              city: propertyCity,
              postcode: propertyPostcode
            },
            rentAmount: tenancy.monthly_rent || null,
            tenants: tenantList,
            allActionsComplete: false,
            type: 'move_out' as const
          }
        })
      }
    } catch (e) {
      console.error('Error fetching move-out entries for calendar:', e)
    }

    // Fetch upcoming compliance expiries for all company properties
    let complianceExpiries: any[] = []
    try {
      const { data: expiringCompliance } = await supabase
        .from('compliance_records')
        .select('id, compliance_type, expiry_date, status, property_id')
        .eq('company_id', companyId)
        .not('expiry_date', 'is', null)
        .gte('expiry_date', now.toISOString().split('T')[0])
        .lte('expiry_date', endDate.toISOString().split('T')[0])
        .order('expiry_date', { ascending: true })

      if (expiringCompliance && expiringCompliance.length > 0) {
        // Fetch property addresses for compliance records
        const compPropertyIds = [...new Set(expiringCompliance.map(c => c.property_id))]
        let compPropertyMap = new Map<string, any>()
        if (compPropertyIds.length > 0) {
          const { data: compProperties } = await supabase
            .from('properties')
            .select('id, address_line1_encrypted, city_encrypted, postcode')
            .in('id', compPropertyIds)
          if (compProperties) {
            for (const p of compProperties) compPropertyMap.set(p.id, p)
          }
        }

        complianceExpiries = expiringCompliance.map(c => {
          const prop = compPropertyMap.get(c.property_id)
          let address = ''
          try {
            address = prop?.address_line1_encrypted ? (decrypt(prop.address_line1_encrypted) || '') : ''
          } catch (e) {}
          return {
            id: c.id,
            type: c.compliance_type,
            expiryDate: c.expiry_date,
            status: c.status,
            propertyId: c.property_id,
            propertyAddress: address,
            propertyPostcode: prop?.postcode || ''
          }
        })
      }
    } catch (e) {
      console.error('Error fetching compliance expiries for calendar:', e)
    }

    res.json({
      startDate: now.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      entries: [...entries, ...moveOutEntries],
      complianceExpiries
    })
  } catch (error: any) {
    console.error('Error in tenancy calendar:', error?.message, error?.stack)
    res.status(500).json({ error: error.message || 'Calendar error' })
  }
})

/**
 * GET /api/tenancies/records/:id
 * Get a specific tenancy record (from tenancies table)
 */
router.get('/records/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const tenancy = await tenancyService.getTenancy(req.params.id, companyId)
    if (!tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    // Enrich with UniHome data from linked offer via reference
    let offer_unihomes = false
    let unihomes_interested = false
    if (tenancy.primary_reference_id) {
      const { data: ref } = await supabase
        .from('tenant_references_v2')
        .select('offer_id')
        .eq('id', tenancy.primary_reference_id)
        .maybeSingle()
      if (ref?.offer_id) {
        const { data: offer } = await supabase
          .from('tenant_offers')
          .select('offer_unihomes, unihomes_interested')
          .eq('id', ref.offer_id)
          .maybeSingle()
        if (offer) {
          offer_unihomes = offer.offer_unihomes || false
          unihomes_interested = offer.unihomes_interested || false
        }
      }
    }

    res.json({ tenancy: { ...tenancy, offer_unihomes, unihomes_interested } })
  } catch (error: any) {
    console.error('Error in GET /api/tenancies/records/:id:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/tenancies/convert/validate/:referenceId
 * Validate if a reference can be converted to a tenancy
 */
router.get('/convert/validate/:referenceId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const validation = await conversionService.validateConversion(
      req.params.referenceId,
      companyId
    )

    res.json(validation)
  } catch (error: any) {
    console.error('Error in GET /api/tenancies/convert/validate:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/tenancies/convert/preview/:referenceId
 * Get preview data for conversion (same as validate but more explicit)
 */
router.get('/convert/preview/:referenceId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const preview = await conversionService.getConversionPreview(
      req.params.referenceId,
      companyId
    )

    res.json(preview)
  } catch (error: any) {
    console.error('Error in GET /api/tenancies/convert/preview:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/tenancies/convert
 * Convert a completed reference into an active tenancy
 */
router.post('/convert', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const userId = req.user?.id
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const {
      referenceId,
      depositScheme,
      depositReference,
      depositAmount,
      additionalCharges,
      rentDueDay,
      notes,
      activateImmediately
    } = req.body

    if (!referenceId) {
      return res.status(400).json({ error: 'Reference ID is required' })
    }

    const result = await conversionService.convertReferenceToTenancy(
      referenceId,
      companyId,
      {
        depositScheme,
        depositReference,
        depositAmount,
        additionalCharges,
        rentDueDay,
        notes,
        activateImmediately
      },
      userId
    )

    if (!result.success) {
      return res.status(400).json({ error: result.error })
    }

    res.status(201).json({ tenancy: result.tenancy })
  } catch (error: any) {
    console.error('Error in POST /api/tenancies/convert:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/tenancies/create
 * Create a new tenancy directly (without reference)
 */
router.post('/create', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const userId = req.user?.id
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const {
      propertyId,
      primaryReferenceId,
      tenancyType,
      startDate,
      endDate,
      monthlyRent,
      depositAmount,
      depositScheme,
      billsIncluded,
      additionalCharges,
      rentDueDay,
      hasBreakClause,
      breakClauseDate,
      breakClauseNoticeDays,
      notes,
      tenants,
      guarantors
    } = req.body

    // Validate required fields
    if (!propertyId || !startDate || !monthlyRent) {
      return res.status(400).json({ error: 'Property ID, start date, and monthly rent are required' })
    }

    const tenancy = await tenancyService.createTenancy({
      companyId,
      propertyId,
      primaryReferenceId,
      tenancyType,
      startDate,
      endDate,
      monthlyRent,
      depositAmount,
      depositScheme,
      billsIncluded,
      additionalCharges,
      rentDueDay,
      hasBreakClause,
      breakClauseDate,
      breakClauseNoticeDays,
      notes,
      createdBy: userId
    }, tenants)

    // Add guarantors if provided, linking to their tenant
    if (guarantors && Array.isArray(guarantors) && guarantors.length > 0) {
      // Fetch created tenant records to get their IDs
      const { data: tenantRecords } = await supabase
        .from('tenancy_tenants')
        .select('id, tenant_name_encrypted, is_lead_tenant')
        .eq('tenancy_id', tenancy.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })

      for (const g of guarantors) {
        // Match guarantor to tenant by index
        let guaranteesTenantId: string | undefined
        if (g.guarantorForTenantIndex !== undefined && tenantRecords && tenantRecords[g.guarantorForTenantIndex]) {
          guaranteesTenantId = tenantRecords[g.guarantorForTenantIndex].id
        }

        await tenancyService.addGuarantorToTenancy(tenancy.id, {
          firstName: g.firstName,
          lastName: g.lastName,
          email: g.email,
          addressLine1: g.residentialAddressLine1,
          addressLine2: g.residentialAddressLine2,
          city: g.residentialCity,
          postcode: g.residentialPostcode,
          guaranteesTenantId
        })
      }
    }

    res.status(201).json({ tenancy })
  } catch (error: any) {
    console.error('Error in POST /api/tenancies/create:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * PUT /api/tenancies/records/:id
 * Update a tenancy record
 */
router.put('/records/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const userId = req.user?.id
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const {
      status,
      startDate,
      endDate,
      actualEndDate,
      tenancyType,
      monthlyRent,
      rentDueDay,
      depositAmount,
      depositScheme,
      depositReference,
      depositProtectedAt,
      billsIncluded,
      additionalCharges,
      notes,
      managementType
    } = req.body

    const tenancy = await tenancyService.updateTenancy(req.params.id, companyId, {
      status,
      startDate,
      endDate,
      actualEndDate,
      tenancyType,
      monthlyRent,
      rentDueDay,
      depositAmount,
      depositScheme,
      depositReference,
      depositProtectedAt,
      billsIncluded,
      additionalCharges,
      notes,
      managementType
    }, userId)

    res.json({ tenancy })
  } catch (error: any) {
    console.error('Error in PUT /api/tenancies/records/:id:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/tenancies/records/:id/activate
 * Activate a pending tenancy
 */
router.post('/records/:id/activate', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const userId = req.user?.id
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const tenancy = await tenancyService.activateTenancy(req.params.id, companyId, userId)

    // Log activity
    await tenancyService.logTenancyActivity(req.params.id, {
      action: 'STATUS_CHANGED',
      category: 'general',
      title: 'Tenancy Activated',
      description: 'Tenancy status changed from pending to active',
      metadata: { oldStatus: 'pending', newStatus: 'active' },
      performedBy: userId
    })

    // Create notification
    try {
      const { notifyTenancyStarted } = await import('../services/notificationService')
      const propertyAddress = tenancy?.property
        ? `${tenancy.property.address_line1}, ${tenancy.property.city}`
        : 'Property'
      const tenantNames = tenancy?.tenants?.map((t: any) => `${t.first_name} ${t.last_name}`).join(', ') || 'Tenants'
      await notifyTenancyStarted(companyId, req.params.id, propertyAddress, tenantNames)
    } catch (notifError) {
      console.error('Failed to create tenancy started notification:', notifError)
    }

    // Fire-and-forget: push all documents to Apex27 on activation
    const tenancyId = req.params.id
    const tenancyPropertyId = tenancy.property_id
    const tenancyAgreementId = tenancy.agreement_id
    const tenancyPrimaryRefId = tenancy.primary_reference_id
    ;(async () => {
      try {
        const { getCompanyApex27Config, pushDocument, apex27Fetch } = await import('../services/apex27Service')
        const { generateTenancySummary } = await import('../services/tenancySummaryService')
        const { normalizeAddressLine } = await import('../services/propertyMatchingService')
        const { decrypt } = await import('../services/encryption')

        const apex27Config = await getCompanyApex27Config(companyId)
        if (!apex27Config) return

        // Resolve listing ID — filter by synced branch
        let listingId: string | null = null
        if (tenancyPropertyId) {
          const { data: prop } = await supabase
            .from('properties')
            .select('apex27_listing_id, postcode, address_line1_encrypted')
            .eq('id', tenancyPropertyId)
            .single()

          listingId = prop?.apex27_listing_id || null

          // Fuzzy fallback: search Apex27 by postcode, filtered by branch
          if (!listingId && prop?.postcode) {
            const searchParams: Record<string, any> = {
              transactionType: 'rent', postalCode: prop.postcode, pageSize: 25
            }
            // Filter by synced branch to avoid matching wrong office's listings
            if (apex27Config.branchId) {
              searchParams.branchId = apex27Config.branchId
            }
            const searchResult = await apex27Fetch<any[]>(apex27Config.apiKey, '/listings', searchParams)
            if (searchResult.success && Array.isArray(searchResult.data) && searchResult.data.length > 0) {
              const addr = prop.address_line1_encrypted ? decrypt(prop.address_line1_encrypted) : null
              if (searchResult.data.length === 1) {
                listingId = String(searchResult.data[0].id)
              } else if (addr) {
                const normAddr = normalizeAddressLine(addr)
                for (const l of searchResult.data) {
                  if (l.address1 && normalizeAddressLine(l.address1) === normAddr) {
                    listingId = String(l.id)
                    break
                  }
                }
              }
              // Don't blindly use first result — only match by address
              if (!listingId && addr) {
                console.warn('[Apex27] No branch-filtered listing matched for', addr)
              }
            }
          }
        }

        if (!listingId) {
          console.log('[Apex27] No listing ID resolved — skipping doc push')
          return
        }

        console.log(`[Apex27] Fire-and-forget doc push to listing ${listingId}`)
        let pushed = 0

        // 1. Tenancy summary
        try {
          const summary = await generateTenancySummary(tenancyId, companyId)
          if (summary.success && summary.html) {
            const fileName = `tenancy-summaries/${companyId}/${tenancyId}-${Date.now()}.html`
            const { error: uploadErr } = await supabase.storage
              .from('documents')
              .upload(fileName, Buffer.from(summary.html), { contentType: 'text/html', upsert: true })
            if (!uploadErr) {
              const { data: signedData } = await supabase.storage.from('documents').createSignedUrl(fileName, 3600)
              if (signedData?.signedUrl) {
                await pushDocument(apex27Config.apiKey, { listingId, name: summary.title || 'Tenancy Summary', url: signedData.signedUrl })
                pushed++
              }
            }
          }
        } catch (e) { console.error('[Apex27] Failed to push tenancy summary:', e) }

        // 2. Signed tenancy agreement
        if (tenancyAgreementId) {
          try {
            const { data: agreement } = await supabase
              .from('agreements')
              .select('id, signed_pdf_url, pdf_url')
              .eq('id', tenancyAgreementId)
              .single()
            const agreementUrl = agreement?.signed_pdf_url || agreement?.pdf_url
            if (agreementUrl) {
              await pushDocument(apex27Config.apiKey, { listingId, name: 'Tenancy Agreement (Signed)', url: agreementUrl })
              pushed++
            }
          } catch (e) { console.error('[Apex27] Failed to push agreement:', e) }
        }

        // 3. Reference reports (from the primary reference and any linked references)
        if (tenancyPrimaryRefId) {
          try {
            // Get all references linked to this tenancy's primary reference (including guarantors)
            const { data: refs } = await supabase
              .from('tenant_references_v2')
              .select('id, tenant_first_name_encrypted, tenant_last_name_encrypted, report_pdf_url')
              .or(`id.eq.${tenancyPrimaryRefId},guarantor_reference_id.eq.${tenancyPrimaryRefId}`)
              .eq('company_id', companyId)
            for (const ref of refs || []) {
              if (ref.report_pdf_url) {
                const name = `Reference Report - ${decrypt(ref.tenant_first_name_encrypted) || ''} ${decrypt(ref.tenant_last_name_encrypted) || ''}`.trim()
                await pushDocument(apex27Config.apiKey, { listingId, name, url: ref.report_pdf_url })
                pushed++
              }
            }
          } catch (e) { console.error('[Apex27] Failed to push references:', e) }
        }

        // 4. Safety certificates (compliance records for the property)
        if (tenancyPropertyId) {
          try {
            const { data: compliance } = await supabase
              .from('compliance_records')
              .select('id, compliance_type, file_path, status')
              .eq('property_id', tenancyPropertyId)
              .eq('status', 'valid')
            for (const cert of compliance || []) {
              if (cert.file_path) {
                const { data: signedData } = await supabase.storage.from('documents').createSignedUrl(cert.file_path, 3600)
                if (signedData?.signedUrl) {
                  const typeLabel = cert.compliance_type?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'Safety Certificate'
                  await pushDocument(apex27Config.apiKey, { listingId, name: typeLabel, url: signedData.signedUrl })
                  pushed++
                }
              }
            }
          } catch (e) { console.error('[Apex27] Failed to push safety certs:', e) }
        }

        // 5. Deposit certificate (if TDS/DPS registration exists)
        try {
          const { data: tdsReg } = await supabase
            .from('tds_registrations')
            .select('certificate_url')
            .eq('tenancy_id', tenancyId)
            .order('created_at', { ascending: false })
            .limit(1)
          if (tdsReg?.[0]?.certificate_url) {
            await pushDocument(apex27Config.apiKey, { listingId, name: 'Deposit Protection Certificate', url: tdsReg[0].certificate_url })
            pushed++
          }
        } catch (e) { console.error('[Apex27] Failed to push deposit cert:', e) }

        // 6. All property documents linked to this tenancy
        try {
          const { data: propDocs } = await supabase
            .from('property_documents')
            .select('id, file_name, file_path')
            .eq('property_id', tenancyPropertyId)
          for (const doc of propDocs || []) {
            if (doc.file_path) {
              const { data: signedData } = await supabase.storage.from('property-documents').createSignedUrl(doc.file_path, 3600)
              if (signedData?.signedUrl) {
                await pushDocument(apex27Config.apiKey, { listingId, name: doc.file_name, url: signedData.signedUrl })
                pushed++
              }
            }
          }
        } catch (e) { console.error('[Apex27] Failed to push property docs:', e) }

        console.log(`[Apex27] Activation doc push complete: ${pushed} documents pushed to listing ${listingId}`)
      } catch (apex27Error) {
        console.error('[Apex27] Fire-and-forget doc push failed:', apex27Error)
      }
    })()

    // Initialize RentGoose rent schedule for this tenancy
    try {
      const { initTenancySchedule } = await import('../services/rentgooseService')
      await initTenancySchedule(req.params.id, companyId)
      console.log(`[RentGoose] Schedule initialized for tenancy ${req.params.id}`)
    } catch (rgErr: any) {
      console.error('[RentGoose] Failed to init schedule on activation (non-blocking):', rgErr.message)
    }

    res.json({ tenancy })
  } catch (error: any) {
    console.error('Error in POST /api/tenancies/records/:id/activate:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/tenancies/records/:id/end
 * End a tenancy
 */
router.post('/records/:id/end', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const userId = req.user?.id
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { endDate, reason } = req.body
    if (!endDate) {
      return res.status(400).json({ error: 'End date is required' })
    }

    const tenancy = await tenancyService.endTenancy(
      req.params.id,
      companyId,
      endDate,
      reason,
      userId
    )

    // Log activity
    await tenancyService.logTenancyActivity(req.params.id, {
      action: 'STATUS_CHANGED',
      category: 'general',
      title: 'Tenancy Ended',
      description: reason ? `Tenancy ended: ${reason}` : 'Tenancy has been ended',
      metadata: { endDate, reason, newStatus: 'ended' },
      performedBy: userId
    })

    res.json({ tenancy })
  } catch (error: any) {
    console.error('Error in POST /api/tenancies/records/:id/end:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/tenancies/records/:id/send-move-out-notice
 * Send move-out confirmation email to tenants with pro-rata rent calculation
 * Returns the pro-rata rent details for RentGoose integration
 * Body: { proRataAmount?: number } - optional override for the calculated pro-rata amount
 */
router.post('/records/:id/send-move-out-notice', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { proRataAmount } = req.body // Optional override from agent

    // Fetch the tenancy with property and tenant details
    const tenancy = await tenancyService.getTenancy(req.params.id, companyId)
    if (!tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    // Check tenancy has notice_given status or ended
    if (!['notice_given', 'ended'].includes(tenancy.status)) {
      return res.status(400).json({ error: 'Tenancy must have notice served before sending move-out notice' })
    }

    // Get the end date (actual_end_date is set when notice is served)
    const endDateStr = tenancy.actual_end_date || tenancy.end_date
    if (!endDateStr) {
      return res.status(400).json({ error: 'No end date set for this tenancy' })
    }

    const endDate = new Date(endDateStr)
    const rentDueDay = tenancy.rent_due_day || 1
    const monthlyRent = tenancy.monthly_rent || 0

    // Calculate pro-rata rent
    const { calculateProRataRent, sendMoveOutConfirmation } = await import('../services/emailService')
    let proRataInfo = calculateProRataRent(monthlyRent, endDate, rentDueDay)

    // If agent provided an override amount, use that instead
    if (proRataAmount !== undefined && proRataInfo) {
      proRataInfo = {
        ...proRataInfo,
        amount: Number(proRataAmount)
      }
    }

    // Get company branding and bank details from the TENANCY's company
    // This ensures emails show the correct company for multi-branch users
    const tenancyCompanyId = tenancy.company_id || companyId
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted, logo_url, email_encrypted, phone_encrypted, website, bank_account_name_encrypted, bank_sort_code_encrypted, bank_account_number_encrypted')
      .eq('id', tenancyCompanyId)
      .single()

    console.log('[send-move-out-notice] Company data:', {
      hasCompany: !!company,
      hasNameEncrypted: !!company?.name_encrypted,
      companyId: tenancyCompanyId
    })

    const companyName = company?.name_encrypted ? decrypt(company.name_encrypted) : null
    const companyEmail = company?.email_encrypted ? decrypt(company.email_encrypted) : null
    const companyPhone = company?.phone_encrypted ? decrypt(company.phone_encrypted) : null

    console.log('[send-move-out-notice] Decrypted company name:', companyName)

    // Build a sensible company name - never use generic "Your Agent"
    let displayCompanyName = companyName
    if (!displayCompanyName && companyEmail) {
      // Extract domain from email as fallback (e.g., "info@rgproperty.co.uk" -> "RG Property")
      const domain = companyEmail.split('@')[1]?.split('.')[0]
      displayCompanyName = domain ? domain.charAt(0).toUpperCase() + domain.slice(1) + ' Property Management' : null
    }
    if (!displayCompanyName) {
      displayCompanyName = 'PropertyGoose'
    }

    const branding = {
      companyName: displayCompanyName,
      logoUrl: company?.logo_url || 'https://app.propertygoose.co.uk/PropertyGooseLogo.png',
      email: companyEmail || undefined,
      phone: companyPhone || undefined,
      website: company?.website || undefined
    }

    // Decrypt bank details
    let bankDetails: { accountName: string; sortCode: string; accountNumber: string } | null = null
    if (company?.bank_account_name_encrypted && company?.bank_sort_code_encrypted && company?.bank_account_number_encrypted) {
      const accountName = decrypt(company.bank_account_name_encrypted)
      const sortCode = decrypt(company.bank_sort_code_encrypted)
      const accountNumber = decrypt(company.bank_account_number_encrypted)

      // Only set bankDetails if all values decrypted successfully
      if (accountName && sortCode && accountNumber) {
        bankDetails = {
          accountName,
          sortCode,
          accountNumber
        }
      }
    }

    // Calculate next rent due date
    let nextRentDueDate: string | null = null
    if (proRataInfo) {
      const nextDue = new Date(endDate)
      nextDue.setDate(rentDueDay)
      // If the end date day is past the rent due day, next due is this month
      // Otherwise it's the previous month's cycle
      if (endDate.getDate() >= rentDueDay) {
        // Already past this month's due date, so this is when pro-rata is due
        nextRentDueDate = nextDue.toISOString().split('T')[0]
      }
    }

    // Get property address
    const propertyAddress = tenancy.property
      ? `${tenancy.property.address_line1}, ${tenancy.property.city} ${tenancy.property.postcode}`
      : 'the property'

    // Send email to all tenants
    const emailsSent: string[] = []
    const emailsFailed: string[] = []

    if (tenancy.tenants && tenancy.tenants.length > 0) {
      for (const tenant of tenancy.tenants) {
        if (tenant.email) {
          try {
            const tenantName = `${tenant.first_name || ''} ${tenant.last_name || ''}`.trim() || 'Tenant'
            await sendMoveOutConfirmation(
              tenant.email,
              tenantName,
              propertyAddress,
              endDateStr,
              proRataInfo,
              bankDetails,
              nextRentDueDate,
              branding
            )
            emailsSent.push(tenant.email)
          } catch (emailError: any) {
            console.error(`Failed to send move-out email to ${tenant.email}:`, emailError)
            emailsFailed.push(tenant.email)
          }
        }
      }
    }

    // Log the activity
    await tenancyService.logTenancyActivity(req.params.id, {
      action: 'MOVE_OUT_NOTICE_SENT',
      category: 'communication',
      title: 'Move Out Notice Sent',
      description: `Move out confirmation sent to ${emailsSent.length} tenant(s)${proRataInfo ? ` with pro-rata rent of £${proRataInfo.amount.toFixed(2)}` : ''}`,
      metadata: {
        emailsSent,
        emailsFailed,
        moveOutDate: endDateStr,
        proRataAmount: proRataInfo?.amount || null,
        proRataDays: proRataInfo?.daysCharged || null
      },
      performedBy: req.user?.id
    })

    // Return the pro-rata details (for RentGoose integration)
    res.json({
      success: true,
      emailsSent,
      emailsFailed,
      moveOutDate: endDateStr,
      proRata: proRataInfo ? {
        amount: proRataInfo.amount,
        daysCharged: proRataInfo.daysCharged,
        nextRentDueDate
      } : null
    })
  } catch (error: any) {
    console.error('Error in POST /api/tenancies/records/:id/send-move-out-notice:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/tenancies/records/:id/revert-to-active
 * Revert a notice_given tenancy back to active status
 * Clears the actual_end_date and sets status back to active
 */
router.post('/records/:id/revert-to-active', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const userId = req.user?.id
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Fetch current tenancy to verify status
    const { data: currentTenancy, error: fetchError } = await supabase
      .from('tenancies')
      .select('status, actual_end_date')
      .eq('id', req.params.id)
      .eq('company_id', companyId)
      .single()

    if (fetchError || !currentTenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    if (currentTenancy.status !== 'notice_given') {
      return res.status(400).json({ error: 'Can only revert tenancies with notice given status' })
    }

    // Update tenancy: clear end date and set status back to active
    const { data: tenancy, error } = await supabase
      .from('tenancies')
      .update({
        status: 'active',
        actual_end_date: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .eq('company_id', companyId)
      .select()
      .single()

    if (error) {
      console.error('Error reverting tenancy to active:', error)
      return res.status(500).json({ error: 'Failed to revert tenancy' })
    }

    // Reactivate RentGoose schedule (un-cancel entries, restore pro-rata)
    try {
      await reactivateScheduleForTenancy(req.params.id, companyId)
    } catch (rgErr: any) {
      console.error('[revert-to-active] RentGoose reactivation failed (non-blocking):', rgErr.message)
    }

    // Log activity
    await tenancyService.logTenancyActivity(req.params.id, {
      action: 'STATUS_CHANGED',
      category: 'general',
      title: 'Tenancy Reverted to Active',
      description: `Notice cancelled - tenancy reverted to active status`,
      metadata: { previousStatus: 'notice_given', newStatus: 'active', previousEndDate: currentTenancy.actual_end_date },
      performedBy: userId
    })

    res.json({ tenancy })
  } catch (error: any) {
    console.error('Error in POST /api/tenancies/records/:id/revert-to-active:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/tenancies/records/:id/revert-to-notice-served
 * Revert an archived tenancy back to notice_given status
 */
router.post('/records/:id/revert-to-notice-served', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const userId = req.user?.id
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Fetch current tenancy to verify status
    const { data: currentTenancy, error: fetchError } = await supabase
      .from('tenancies')
      .select('status, actual_end_date')
      .eq('id', req.params.id)
      .eq('company_id', companyId)
      .single()

    if (fetchError || !currentTenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    if (currentTenancy.status !== 'archived') {
      return res.status(400).json({ error: 'Can only revert archived tenancies to notice served status' })
    }

    const { actual_end_date } = req.body

    // Update tenancy: set status back to notice_given, with optional new end date
    const updateData: Record<string, any> = {
      status: 'notice_given',
      updated_at: new Date().toISOString()
    }
    if (actual_end_date) {
      updateData.actual_end_date = actual_end_date
    }

    const { data: tenancy, error } = await supabase
      .from('tenancies')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('company_id', companyId)
      .select()
      .single()

    if (error) {
      console.error('Error reverting tenancy to notice served:', error)
      return res.status(500).json({ error: 'Failed to revert tenancy' })
    }

    // Update RentGoose: reactivate schedule and apply new pro-rata end date
    try {
      const endDate = actual_end_date || currentTenancy.actual_end_date
      if (endDate) {
        await updateNoticeEndDate(req.params.id, endDate, companyId)
      } else {
        await reactivateScheduleForTenancy(req.params.id, companyId)
      }
    } catch (rgErr: any) {
      console.error('[revert-to-notice-served] RentGoose update failed (non-blocking):', rgErr.message)
    }

    // Log activity
    await tenancyService.logTenancyActivity(req.params.id, {
      action: 'STATUS_CHANGED',
      category: 'general',
      title: 'Tenancy Reverted to Notice Served',
      description: `Tenancy reverted from archived back to notice given status${actual_end_date ? ` with new end date ${actual_end_date}` : ''}`,
      metadata: { previousStatus: 'archived', newStatus: 'notice_given', newEndDate: actual_end_date || null },
      performedBy: userId
    })

    res.json({ tenancy })
  } catch (error: any) {
    console.error('Error in POST /api/tenancies/records/:id/revert-to-notice-served:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/tenancies/records/:id/calculate-pro-rata
 * Calculate pro-rata rent for a notice_given tenancy without sending email
 */
router.get('/records/:id/calculate-pro-rata', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const tenancy = await tenancyService.getTenancy(req.params.id, companyId)
    if (!tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    if (!['notice_given', 'ended'].includes(tenancy.status)) {
      return res.status(400).json({ error: 'Tenancy must have notice served' })
    }

    const endDateStr = tenancy.actual_end_date || tenancy.end_date
    if (!endDateStr) {
      return res.status(400).json({ error: 'No end date set for this tenancy' })
    }

    const endDate = new Date(endDateStr)
    const rentDueDay = tenancy.rent_due_day || 1
    const monthlyRent = tenancy.monthly_rent || 0

    const { calculateProRataRent } = await import('../services/emailService')
    const proRataInfo = calculateProRataRent(monthlyRent, endDate, rentDueDay)

    // Calculate next rent due date
    let nextRentDueDate: string | null = null
    if (proRataInfo) {
      const nextDue = new Date(endDate)
      nextDue.setDate(rentDueDay)
      if (endDate.getDate() >= rentDueDay) {
        nextRentDueDate = nextDue.toISOString().split('T')[0]
      }
    }

    // Get property address
    const propertyAddress = tenancy.property
      ? `${tenancy.property.address_line1}, ${tenancy.property.city} ${tenancy.property.postcode}`
      : 'the property'

    // Get tenant names
    const tenantEmails = tenancy.tenants?.filter((t: any) => t.email).map((t: any) => ({
      name: `${t.first_name || ''} ${t.last_name || ''}`.trim() || 'Tenant',
      email: t.email
    })) || []

    res.json({
      moveOutDate: endDateStr,
      propertyAddress,
      monthlyRent,
      rentDueDay,
      proRata: proRataInfo ? {
        amount: proRataInfo.amount,
        daysCharged: proRataInfo.daysCharged,
        daysInMonth: proRataInfo.daysInPeriod,
        nextRentDueDate
      } : null,
      tenants: tenantEmails
    })
  } catch (error: any) {
    console.error('Error in GET /api/tenancies/records/:id/calculate-pro-rata:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/tenancies/records/:id/revert-to-draft
 * Revert an active/ended tenancy back to draft (pending) status
 * Clears all progress flags so user must go through conversion again
 */
router.post('/records/:id/revert-to-draft', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const userId = req.user?.id
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // First fetch the current tenancy to log what we're reverting from
    const { data: currentTenancy, error: fetchError } = await supabase
      .from('tenancies')
      .select('status')
      .eq('id', req.params.id)
      .eq('company_id', companyId)
      .single()

    if (fetchError || !currentTenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    const previousStatus = currentTenancy.status

    // Reset the tenancy to draft state - clear all progress fields
    // Only update fields that are safe and known to exist
    const updateFields: Record<string, any> = {
      status: 'pending',
      updated_at: new Date().toISOString()
    }

    // Optionally clear these if they exist (won't error if they don't)
    const optionalResets = [
      'compliance_pack_sent_at',
      'initial_monies_paid_at',
      'move_in_time_confirmed',
      'move_in_time_requested_at'
    ]

    for (const field of optionalResets) {
      updateFields[field] = null
    }

    const { data: tenancy, error: updateError } = await supabase
      .from('tenancies')
      .update(updateFields)
      .eq('id', req.params.id)
      .eq('company_id', companyId)
      .select()
      .single()

    if (updateError) {
      console.error('Error reverting tenancy to draft:', updateError)
      return res.status(500).json({ error: `Failed to revert tenancy: ${updateError.message}` })
    }

    // Log activity (don't fail if this errors)
    try {
      await tenancyService.logTenancyActivity(req.params.id, {
        action: 'STATUS_CHANGED',
        category: 'general',
        title: 'Tenancy Reverted to Draft',
        description: `Tenancy reverted from ${previousStatus} to draft status. All progress has been reset.`,
        metadata: {
          previousStatus,
          newStatus: 'pending'
        },
        performedBy: userId
      })
    } catch (logError) {
      console.error('Failed to log activity:', logError)
    }

    res.json({ tenancy, message: 'Tenancy reverted to draft successfully' })
  } catch (error: any) {
    console.error('Error in POST /api/tenancies/records/:id/revert-to-draft:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/tenancies/records/:id/mark-fallen-through
 * Mark a pending (draft) tenancy as fallen through
 */
router.post('/records/:id/mark-fallen-through', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const userId = req.user?.id
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Fetch the current tenancy
    const { data: currentTenancy, error: fetchError } = await supabase
      .from('tenancies')
      .select('status')
      .eq('id', req.params.id)
      .eq('company_id', companyId)
      .single()

    if (fetchError || !currentTenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    // Only pending (draft) tenancies can be marked as fallen through
    if (currentTenancy.status !== 'pending') {
      return res.status(400).json({ error: 'Only draft/pending tenancies can be marked as fallen through' })
    }

    const { data: tenancy, error: updateError } = await supabase
      .from('tenancies')
      .update({
        status: 'fallen_through',
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .eq('company_id', companyId)
      .select()
      .single()

    if (updateError) {
      console.error('Error marking tenancy as fallen through:', updateError)
      return res.status(500).json({ error: `Failed to update tenancy: ${updateError.message}` })
    }

    // Cancel RentGoose schedule entries
    try {
      await cancelScheduleForTenancy(req.params.id)
    } catch (rgErr: any) {
      console.error('[mark-fallen-through] RentGoose cancellation failed (non-blocking):', rgErr.message)
    }

    // Log activity
    try {
      await tenancyService.logTenancyActivity(req.params.id, {
        action: 'STATUS_CHANGED',
        category: 'general',
        title: 'Tenancy Marked as Fallen Through',
        description: 'Pending tenancy was marked as fallen through and moved to archived.',
        metadata: {
          previousStatus: 'pending',
          newStatus: 'fallen_through'
        },
        performedBy: userId
      })
    } catch (logError) {
      console.error('Failed to log activity:', logError)
    }

    res.json({ tenancy, message: 'Tenancy marked as fallen through' })
  } catch (error: any) {
    console.error('Error in POST /api/tenancies/records/:id/mark-fallen-through:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * DELETE /api/tenancies/records/:id
 * Soft delete a tenancy
 */
router.delete('/records/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const userId = req.user?.id
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    await tenancyService.deleteTenancy(req.params.id, companyId, userId)

    res.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/tenancies/records/:id:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/tenancies/records/:id/tenants
 * Get tenants for a tenancy
 */
router.get('/records/:id/tenants', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Verify tenancy belongs to company
    const tenancy = await tenancyService.getTenancy(req.params.id, companyId)
    if (!tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    const includeInactive = req.query.includeInactive === 'true'
    const tenants = await tenancyService.getTenancyTenants(req.params.id, includeInactive)

    res.json({ tenants })
  } catch (error: any) {
    console.error('Error in GET /api/tenancies/records/:id/tenants:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/tenancies/records/:id/tenants
 * Add a tenant to a tenancy
 */
router.post('/records/:id/tenants', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Verify tenancy belongs to company
    const tenancy = await tenancyService.getTenancy(req.params.id, companyId)
    if (!tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      isLeadTenant,
      rentShare,
      rentSharePercentage,
      guarantorReferenceId
    } = req.body

    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First name and last name are required' })
    }

    const tenant = await tenancyService.addTenantToTenancy(req.params.id, {
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      isLeadTenant,
      rentShare,
      rentSharePercentage,
      guarantorReferenceId
    })

    // Log activity
    await tenancyService.logTenancyActivity(req.params.id, {
      action: 'TENANT_ADDED',
      category: 'tenant',
      title: 'Tenant Added',
      description: `${firstName} ${lastName} was added as a tenant`,
      metadata: { tenantId: tenant.id, firstName, lastName, isLeadTenant },
      performedBy: req.user?.id
    })

    res.status(201).json({ tenant })
  } catch (error: any) {
    console.error('Error in POST /api/tenancies/records/:id/tenants:', error)
    const message = error.message || 'An unexpected error occurred while adding the tenant'
    // Return 400 for known validation/business errors, 500 for unexpected
    const statusCode = message.includes('Failed to') ? 400 : 500
    res.status(statusCode).json({ error: message })
  }
})

/**
 * PATCH /api/tenancies/records/:id/tenants/:tenantId
 * Update a tenant's details
 */
/**
 * POST /api/tenancies/records/:id/backfill-addresses
 * Persists reference-sourced tenant addresses to tenancy_tenants so they load instantly next time.
 * Only writes rows that are currently missing an address — never overwrites existing data.
 */
router.post('/records/:id/backfill-addresses', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(404).json({ error: 'Company not found' })

    const { addresses } = req.body // [{ name: string (lowercase), address: { line1, line2, city, postcode } }]
    if (!Array.isArray(addresses) || addresses.length === 0) return res.json({ updated: 0 })

    // Verify tenancy belongs to company
    const { data: tenancy } = await supabase
      .from('tenancies')
      .select('id')
      .eq('id', req.params.id)
      .eq('company_id', companyId)
      .single()
    if (!tenancy) return res.status(404).json({ error: 'Tenancy not found' })

    // Fetch tenant rows that need addresses
    const { data: tenantRows } = await supabase
      .from('tenancy_tenants')
      .select('id, first_name_encrypted, last_name_encrypted, residential_address_line1_encrypted')
      .eq('tenancy_id', req.params.id)

    let updated = 0
    for (const row of (tenantRows || [])) {
      // Only backfill if no address stored yet
      if (row.residential_address_line1_encrypted) continue

      const firstName = decrypt(row.first_name_encrypted) || ''
      const lastName = decrypt(row.last_name_encrypted) || ''
      const fullName = `${firstName} ${lastName}`.trim().toLowerCase()

      const match = addresses.find((a: any) => a.name === fullName)
      if (!match?.address?.line1) continue

      await supabase
        .from('tenancy_tenants')
        .update({
          residential_address_line1_encrypted: match.address.line1 ? encrypt(match.address.line1) : null,
          residential_address_line2_encrypted: match.address.line2 ? encrypt(match.address.line2) : null,
          residential_city_encrypted: match.address.city ? encrypt(match.address.city) : null,
          residential_postcode_encrypted: match.address.postcode ? encrypt(match.address.postcode) : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', row.id)
      updated++
    }

    res.json({ updated })
  } catch (err: any) {
    console.error('[backfill-addresses] Error:', err.message)
    res.status(500).json({ error: 'Failed to backfill addresses' })
  }
})

router.patch('/records/:id/tenants/:tenantId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Verify tenancy belongs to company
    const tenancy = await tenancyService.getTenancy(req.params.id, companyId)
    if (!tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    // Verify tenant belongs to this tenancy
    const tenants = await tenancyService.getTenancyTenants(req.params.id, true)
    const tenant = tenants.find(t => t.id === req.params.tenantId)
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' })
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      isLeadTenant,
      rentShare,
      rentSharePercentage
    } = req.body

    const updatedTenant = await tenancyService.updateTenancyTenant(req.params.tenantId, {
      firstName,
      lastName,
      email,
      phone,
      isLeadTenant,
      rentShare,
      rentSharePercentage
    })

    // Log activity
    await tenancyService.logTenancyActivity(req.params.id, {
      action: 'TENANT_UPDATED',
      category: 'tenant',
      title: 'Tenant Updated',
      description: `${firstName || tenant.first_name} ${lastName || tenant.last_name}'s details were updated`,
      metadata: { tenantId: req.params.tenantId },
      performedBy: req.user?.id
    })

    res.json({ tenant: updatedTenant })
  } catch (error: any) {
    console.error('Error in PATCH /api/tenancies/records/:id/tenants/:tenantId:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * DELETE /api/tenancies/records/:id/tenants/:tenantId
 * Remove a tenant from a tenancy
 */
router.delete('/records/:id/tenants/:tenantId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Verify tenancy belongs to company
    const tenancy = await tenancyService.getTenancy(req.params.id, companyId)
    if (!tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    const { leftDate, replacementTenantId } = req.body

    const removedTenant = await tenancyService.removeTenantFromTenancy(
      req.params.tenantId,
      leftDate || new Date().toISOString().split('T')[0],
      replacementTenantId
    )

    // Log activity
    await tenancyService.logTenancyActivity(req.params.id, {
      action: 'TENANT_REMOVED',
      category: 'tenants',
      title: 'Tenant Removed',
      description: `${removedTenant.first_name} ${removedTenant.last_name} removed from tenancy`,
      metadata: { tenantId: req.params.tenantId, leftDate: leftDate || new Date().toISOString().split('T')[0] },
      performedBy: req.user?.id
    })

    res.json({ tenant: removedTenant })
  } catch (error: any) {
    console.error('Error in DELETE /api/tenancies/records/:id/tenants/:tenantId:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// GUARANTOR ENDPOINTS
// ============================================================================

/**
 * GET /api/tenancies/records/:id/guarantors
 * Get guarantors for a tenancy
 */
router.get('/records/:id/guarantors', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Verify tenancy belongs to company
    const tenancy = await tenancyService.getTenancy(req.params.id, companyId)
    if (!tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    const includeInactive = req.query.includeInactive === 'true'
    const guarantors = await tenancyService.getTenancyGuarantors(req.params.id, includeInactive)

    res.json({ guarantors })
  } catch (error: any) {
    console.error('Error in GET /api/tenancies/records/:id/guarantors:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/tenancies/records/:id/guarantors
 * Add a guarantor to a tenancy
 */
router.post('/records/:id/guarantors', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Verify tenancy belongs to company
    const tenancy = await tenancyService.getTenancy(req.params.id, companyId)
    if (!tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    const {
      guarantorReferenceId,
      guaranteesTenantId,
      firstName,
      lastName,
      email,
      phone,
      addressLine1,
      addressLine2,
      city,
      postcode,
      relationshipToTenant
    } = req.body

    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First name and last name are required' })
    }

    const guarantor = await tenancyService.addGuarantorToTenancy(req.params.id, {
      guarantorReferenceId,
      guaranteesTenantId,
      firstName,
      lastName,
      email,
      phone,
      addressLine1,
      addressLine2,
      city,
      postcode,
      relationshipToTenant
    })

    // Log activity
    await tenancyService.logTenancyActivity(req.params.id, {
      action: 'GUARANTOR_ADDED',
      category: 'tenants',
      title: 'Guarantor Added',
      description: `${firstName} ${lastName} added as guarantor`,
      metadata: { guarantorId: guarantor.id, name: `${firstName} ${lastName}` },
      performedBy: req.user?.id
    })

    res.status(201).json({ guarantor })
  } catch (error: any) {
    console.error('Error in POST /api/tenancies/records/:id/guarantors:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * PATCH /api/tenancies/records/:id/guarantors/:guarantorId
 * Update a guarantor's details
 */
router.patch('/records/:id/guarantors/:guarantorId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Verify tenancy belongs to company
    const tenancy = await tenancyService.getTenancy(req.params.id, companyId)
    if (!tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    // Verify guarantor belongs to this tenancy
    const guarantors = await tenancyService.getTenancyGuarantors(req.params.id, true)
    const guarantor = guarantors.find(g => g.id === req.params.guarantorId)
    if (!guarantor) {
      return res.status(404).json({ error: 'Guarantor not found' })
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      addressLine1,
      addressLine2,
      city,
      postcode,
      relationshipToTenant,
      guaranteesTenantId
    } = req.body

    const updatedGuarantor = await tenancyService.updateTenancyGuarantor(req.params.guarantorId, {
      firstName,
      lastName,
      email,
      phone,
      addressLine1,
      addressLine2,
      city,
      postcode,
      relationshipToTenant,
      guaranteesTenantId
    })

    // Log activity
    await tenancyService.logTenancyActivity(req.params.id, {
      action: 'GUARANTOR_UPDATED',
      category: 'tenants',
      title: 'Guarantor Updated',
      description: `Guarantor ${firstName || guarantor.first_name} ${lastName || guarantor.last_name} details updated`,
      metadata: { guarantorId: req.params.guarantorId },
      performedBy: req.user?.id
    })

    res.json({ guarantor: updatedGuarantor })
  } catch (error: any) {
    console.error('Error in PATCH /api/tenancies/records/:id/guarantors/:guarantorId:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * DELETE /api/tenancies/records/:id/guarantors/:guarantorId
 * Remove a guarantor from a tenancy
 */
router.delete('/records/:id/guarantors/:guarantorId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Verify tenancy belongs to company
    const tenancy = await tenancyService.getTenancy(req.params.id, companyId)
    if (!tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    const removedGuarantor = await tenancyService.removeGuarantorFromTenancy(req.params.guarantorId)

    // Log activity
    await tenancyService.logTenancyActivity(req.params.id, {
      action: 'GUARANTOR_REMOVED',
      category: 'tenants',
      title: 'Guarantor Removed',
      description: `Guarantor removed from tenancy`,
      metadata: { guarantorId: req.params.guarantorId },
      performedBy: req.user?.id
    })

    res.json({ guarantor: removedGuarantor })
  } catch (error: any) {
    console.error('Error in DELETE /api/tenancies/records/:id/guarantors/:guarantorId:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/tenancies/records/:id/compliance-pack
 * Send move-in pack with compliance documents to tenants
 */
router.post('/records/:id/compliance-pack', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const userId = req.user?.id
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Get full tenancy with property and tenants
    const tenancy = await tenancyService.getTenancy(req.params.id, companyId)
    if (!tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    // Get tenants with email addresses
    const activeTenants = (tenancy.tenants || []).filter(t => t.status === 'active' && t.email)
    if (activeTenants.length === 0) {
      return res.status(400).json({ error: 'No tenants with email addresses found' })
    }

    // Get company details from the TENANCY's company for correct branding
    const tenancyCompanyId = tenancy.company_id || companyId
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted, phone_encrypted, email_encrypted, logo_url')
      .eq('id', tenancyCompanyId)
      .single()

    const companyName = company?.name_encrypted ? decrypt(company.name_encrypted) || 'PropertyGoose' : 'PropertyGoose'
    const companyPhone = company?.phone_encrypted ? decrypt(company.phone_encrypted) || '' : ''
    const companyEmail = company?.email_encrypted ? decrypt(company.email_encrypted) || '' : ''

    // Get property compliance documents
    const { data: complianceRecords } = await supabase
      .from('compliance_records')
      .select(`
        id,
        compliance_type,
        custom_type_name,
        issue_date,
        expiry_date,
        status,
        compliance_documents (
          id,
          file_name,
          file_path
        )
      `)
      .eq('property_id', tenancy.property_id)
      .in('status', ['valid', 'expiring_soon'])

    // Generate signed URLs for documents
    const documents: { name: string; url: string; type: string }[] = []
    const complianceTypeLabels: Record<string, string> = {
      gas_safety: 'Gas Safety Certificate',
      epc: 'Energy Performance Certificate (EPC)',
      eicr: 'Electrical Safety Certificate (EICR)',
      fire_safety: 'Fire Safety Certificate',
      legionella: 'Legionella Risk Assessment',
      smoke_alarm: 'Smoke & CO Alarms Certificate'
    }

    for (const record of complianceRecords || []) {
      const docs = record.compliance_documents || []
      for (const doc of docs) {
        if (doc.file_path) {
          // Generate a 24-hour signed URL
          const { data: signedUrlData } = await supabase.storage
            .from('property-documents')
            .createSignedUrl(doc.file_path.replace('property-documents/', ''), 86400) // 24 hours

          if (signedUrlData?.signedUrl) {
            documents.push({
              name: doc.file_name || complianceTypeLabels[record.compliance_type] || record.custom_type_name || 'Document',
              url: signedUrlData.signedUrl,
              type: complianceTypeLabels[record.compliance_type] || record.custom_type_name || record.compliance_type
            })
          }
        }
      }
    }

    // Format property address
    const propertyAddress = [
      tenancy.property?.address_line1,
      tenancy.property?.city,
      tenancy.property?.postcode
    ].filter(Boolean).join(', ')

    // Format move-in date
    const moveInDate = tenancy.start_date
      ? new Date(tenancy.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'TBC'

    // Get agent's email for CC (proof of service)
    let agentEmail: string | null = null
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single()
      agentEmail = profile?.email || null
    }

    // Send email to all tenants, CC the agent
    await sendMoveInPack(
      activeTenants.map(t => ({ email: t.email!, name: `${t.first_name} ${t.last_name}`.trim() })),
      propertyAddress,
      moveInDate,
      tenancy.monthly_rent,
      tenancy.rent_due_day,
      tenancy.deposit_amount,
      tenancy.deposit_scheme,
      documents,
      { name: companyName, email: companyEmail, phone: companyPhone },
      companyName,
      company?.logo_url,
      agentEmail
    )

    // Update tenancy to mark compliance pack as sent
    const updatedTenancy = await tenancyService.updateTenancy(req.params.id, companyId, {
      compliancePackSentAt: new Date().toISOString(),
      compliancePackSentBy: userId
    }, userId)

    // Log activity
    await tenancyService.logTenancyActivity(req.params.id, {
      action: 'COMPLIANCE_PACK_SENT',
      category: 'documents',
      title: 'Compliance Pack Sent',
      description: `Compliance pack with ${documents.length} document(s) sent to tenants`,
      metadata: { documentCount: documents.length },
      performedBy: userId
    })

    res.json({ tenancy: updatedTenancy, documentsSent: documents.length })
  } catch (error: any) {
    console.error('Error in POST /api/tenancies/records/:id/compliance-pack:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/tenancies/records/:id/move-in-pack
 * Enhanced move-in pack with management info, rent payment details, and document selection
 */
router.post('/records/:id/move-in-pack', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const userId = req.user?.id
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { includeAgreement, selectedDocumentIds, additionalInfo, paymentReference, bankDetails } = req.body

    // Store bank details on tenancy if provided (for reliable future retrieval)
    if (bankDetails?.accountName || bankDetails?.sortCode || bankDetails?.accountNumber) {
      const updateData: any = {
        updated_at: new Date().toISOString()
      }
      if (bankDetails.accountName) {
        updateData.payment_bank_account_name_encrypted = encrypt(bankDetails.accountName)
      }
      if (bankDetails.sortCode) {
        updateData.payment_bank_sort_code_encrypted = encrypt(bankDetails.sortCode)
      }
      if (bankDetails.accountNumber) {
        updateData.payment_bank_account_number_encrypted = encrypt(bankDetails.accountNumber)
      }
      if (paymentReference) {
        updateData.payment_reference = paymentReference
      }

      await supabase
        .from('tenancies')
        .update(updateData)
        .eq('id', req.params.id)

      console.log('[MoveInPack] Stored payment details on tenancy:', req.params.id)
    }

    // Get full tenancy with property and tenants
    const tenancy = await tenancyService.getTenancy(req.params.id, companyId)
    if (!tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    // Get tenants with email addresses
    const activeTenants = (tenancy.tenants || []).filter(t => t.status === 'active' && t.email)
    if (activeTenants.length === 0) {
      return res.status(400).json({ error: 'No tenants with email addresses found' })
    }

    // Get company details from the TENANCY's company for correct branding
    const tenancyCompanyId = tenancy.company_id || companyId
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted, phone_encrypted, email_encrypted, logo_url, bank_account_name, bank_account_number, bank_sort_code, management_info')
      .eq('id', tenancyCompanyId)
      .single()

    const companyName = company?.name_encrypted ? decrypt(company.name_encrypted) || 'PropertyGoose' : 'PropertyGoose'
    const companyPhone = company?.phone_encrypted ? decrypt(company.phone_encrypted) || '' : ''
    const companyEmail = company?.email_encrypted ? decrypt(company.email_encrypted) || '' : ''

    // Determine management type - tenancy overrides property setting
    const managementType = tenancy.management_type || tenancy.property?.management_type || 'let_only'
    const isManaged = managementType === 'managed'

    // Get landlord details for let only properties
    let landlordName = ''
    let landlordPhone = ''
    let landlordEmail = ''
    let landlordBankAccountName = ''
    let landlordBankSortCode = ''
    let landlordBankAccountNumber = ''

    // First check if tenancy has payment details stored directly (new approach)
    const tenancyRaw = await supabase
      .from('tenancies')
      .select('payment_bank_account_name_encrypted, payment_bank_sort_code_encrypted, payment_bank_account_number_encrypted, payment_reference')
      .eq('id', req.params.id)
      .single()

    const tenancyPaymentDetails = tenancyRaw.data
    const hasStoredPaymentDetails = tenancyPaymentDetails?.payment_bank_account_name_encrypted ||
                                     tenancyPaymentDetails?.payment_bank_sort_code_encrypted ||
                                     tenancyPaymentDetails?.payment_bank_account_number_encrypted

    if (!isManaged) {
      // Join property_landlords with landlords table to get landlord details including encrypted bank info
      console.log('[MoveInPack] Let only property, looking up landlord. property_id:', tenancy.property_id)
      console.log('[MoveInPack] Has stored payment details on tenancy:', hasStoredPaymentDetails)

      const { data: propertyLandlords, error: landlordError } = await supabase
        .from('property_landlords')
        .select(`
          is_primary_contact,
          landlord_id,
          landlords (
            id,
            first_name_encrypted,
            last_name_encrypted,
            phone_encrypted,
            email_encrypted,
            bank_account_name_encrypted,
            bank_account_number_encrypted,
            bank_sort_code_encrypted
          )
        `)
        .eq('property_id', tenancy.property_id)
        .order('is_primary_contact', { ascending: false })

      console.log('[MoveInPack] property_landlords query result:', {
        count: propertyLandlords?.length || 0,
        error: landlordError?.message,
        data: propertyLandlords
      })

      const primaryLandlordLink = propertyLandlords?.[0]
      const primaryLandlord = primaryLandlordLink?.landlords as any

      console.log('[MoveInPack] primaryLandlord:', primaryLandlord ? 'found' : 'not found')

      if (primaryLandlord) {
        const firstName = primaryLandlord.first_name_encrypted ? decrypt(primaryLandlord.first_name_encrypted) || '' : ''
        const lastName = primaryLandlord.last_name_encrypted ? decrypt(primaryLandlord.last_name_encrypted) || '' : ''
        landlordName = [firstName, lastName].filter(Boolean).join(' ') || 'Your Landlord'
        landlordPhone = primaryLandlord.phone_encrypted ? decrypt(primaryLandlord.phone_encrypted) || '' : ''
        landlordEmail = primaryLandlord.email_encrypted ? decrypt(primaryLandlord.email_encrypted) || '' : ''
        landlordBankAccountName = primaryLandlord.bank_account_name_encrypted ? decrypt(primaryLandlord.bank_account_name_encrypted) || '' : ''
        landlordBankSortCode = primaryLandlord.bank_sort_code_encrypted ? decrypt(primaryLandlord.bank_sort_code_encrypted) || '' : ''
        landlordBankAccountNumber = primaryLandlord.bank_account_number_encrypted ? decrypt(primaryLandlord.bank_account_number_encrypted) || '' : ''

        console.log('[MoveInPack] Decrypted landlord details:', {
          name: landlordName ? 'set' : 'empty',
          phone: landlordPhone ? 'set' : 'empty',
          email: landlordEmail ? 'set' : 'empty',
          bankName: landlordBankAccountName ? 'set' : 'empty',
          bankSort: landlordBankSortCode ? 'set' : 'empty',
          bankNumber: landlordBankAccountNumber ? 'set' : 'empty'
        })
      }
    }

    // Get property compliance documents
    const { data: complianceRecords } = await supabase
      .from('compliance_records')
      .select(`
        id,
        compliance_type,
        custom_type_name,
        issue_date,
        expiry_date,
        status,
        compliance_documents (
          id,
          file_name,
          file_path
        )
      `)
      .eq('property_id', tenancy.property_id)
      .in('status', ['valid', 'expiring_soon'])

    // Generate signed URLs for selected documents
    const documents: { name: string; url: string; type: string }[] = []
    const complianceTypeLabels: Record<string, string> = {
      gas_safety: 'Gas Safety Certificate',
      epc: 'Energy Performance Certificate (EPC)',
      eicr: 'Electrical Safety Certificate (EICR)',
      fire_safety: 'Fire Safety Certificate',
      legionella: 'Legionella Risk Assessment',
      smoke_alarm: 'Smoke & CO Alarms Certificate'
    }

    for (const record of complianceRecords || []) {
      // Only include selected documents (or all if none specified)
      if (selectedDocumentIds && selectedDocumentIds.length > 0 && !selectedDocumentIds.includes(record.id)) {
        continue
      }

      const docs = record.compliance_documents || []
      for (const doc of docs) {
        if (doc.file_path) {
          const { data: signedUrlData } = await supabase.storage
            .from('property-documents')
            .createSignedUrl(doc.file_path.replace('property-documents/', ''), 86400)

          if (signedUrlData?.signedUrl) {
            documents.push({
              name: doc.file_name || complianceTypeLabels[record.compliance_type] || record.custom_type_name || 'Document',
              url: signedUrlData.signedUrl,
              type: complianceTypeLabels[record.compliance_type] || record.custom_type_name || record.compliance_type
            })
          }
        }
      }
    }

    // Include signed agreement if requested
    let signedAgreementUrl = null
    if (includeAgreement && tenancy.agreement_id) {
      const { data: agreement } = await supabase
        .from('agreements')
        .select('signed_pdf_url, pdf_url, signing_status')
        .eq('id', tenancy.agreement_id)
        .single()

      // Include agreement if fully_signed or executed (signed_pdf_url is set at fully_signed)
      if (agreement?.signing_status === 'fully_signed' || agreement?.signing_status === 'executed') {
        signedAgreementUrl = agreement.signed_pdf_url || agreement.pdf_url
        if (signedAgreementUrl) {
          documents.unshift({
            name: 'Signed Tenancy Agreement',
            url: signedAgreementUrl,
            type: 'Tenancy Agreement'
          })
        }
      }
    }

    // Format property address
    const propertyAddress = [
      tenancy.property?.address_line1,
      tenancy.property?.city,
      tenancy.property?.postcode
    ].filter(Boolean).join(', ')

    // Format move-in date
    const moveInDate = tenancy.start_date
      ? new Date(tenancy.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'TBC'

    // Build management info section
    let managementInfoHtml = ''
    if (isManaged) {
      const managementText = company?.management_info || `For any maintenance or property issues, please contact ${companyName} at ${companyEmail}${companyPhone ? ` or ${companyPhone}` : ''}.`
      managementInfoHtml = `
        <tr>
          <td style="padding: 20px 0; border-bottom: 1px solid #e5e7eb;">
            <h3 style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">Property Management</h3>
            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px;">
              <p style="color: #0369a1; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">Managed by ${companyName}</p>
              <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0;">${managementText.replace(/\n/g, '<br>')}</p>
            </div>
          </td>
        </tr>
      `
    } else {
      managementInfoHtml = `
        <tr>
          <td style="padding: 20px 0; border-bottom: 1px solid #e5e7eb;">
            <h3 style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">Property Management</h3>
            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px;">
              <p style="color: #92400e; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">Let Only - Landlord Managed</p>
              <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0;">
                This tenancy is managed by the landlord directly. For any property issues or maintenance, please contact them:
                <br><br>
                <strong>${landlordName}</strong>
                ${landlordPhone ? `<br>Phone: ${landlordPhone}` : ''}
                ${landlordEmail ? `<br>Email: ${landlordEmail}` : ''}
              </p>
            </div>
          </td>
        </tr>
      `
    }

    // Build rent payment section
    // Priority: 1. Stored on tenancy, 2. Agent (managed) or Landlord (let_only) lookup
    let bankAccountName = ''
    let bankSortCode = ''
    let bankAccountNumber = ''

    if (hasStoredPaymentDetails) {
      // Use stored payment details from tenancy
      bankAccountName = tenancyPaymentDetails.payment_bank_account_name_encrypted
        ? decrypt(tenancyPaymentDetails.payment_bank_account_name_encrypted) || ''
        : ''
      bankSortCode = tenancyPaymentDetails.payment_bank_sort_code_encrypted
        ? decrypt(tenancyPaymentDetails.payment_bank_sort_code_encrypted) || ''
        : ''
      bankAccountNumber = tenancyPaymentDetails.payment_bank_account_number_encrypted
        ? decrypt(tenancyPaymentDetails.payment_bank_account_number_encrypted) || ''
        : ''
      console.log('[MoveInPack] Using stored tenancy payment details')
    } else if (isManaged) {
      // Use agent/company bank details
      bankAccountName = company?.bank_account_name || ''
      bankSortCode = company?.bank_sort_code || ''
      bankAccountNumber = company?.bank_account_number || ''
      console.log('[MoveInPack] Using agent bank details')
    } else {
      // Use landlord bank details from lookup
      bankAccountName = landlordBankAccountName
      bankSortCode = landlordBankSortCode
      bankAccountNumber = landlordBankAccountNumber
      console.log('[MoveInPack] Using landlord bank details from lookup')
    }

    const rentPaymentRef = paymentReference ||
      tenancyPaymentDetails?.payment_reference ||
      propertyAddress.split(',')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''

    const rentPaymentHtml = `
      <tr>
        <td style="padding: 20px 0; border-bottom: 1px solid #e5e7eb;">
          <h3 style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">How to Pay Rent</h3>
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
            <p style="color: #374151; font-size: 14px; margin: 0 0 12px 0;">
              Please set up a standing order for your monthly rent of <strong>£${(tenancy.monthly_rent || 0).toFixed(2)}</strong>,
              due on the <strong>${ordinalSuffix(tenancy.rent_due_day || 1)}</strong> of each month.
            </p>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 140px;">Account Name:</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600;">${bankAccountName || 'Please confirm'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Sort Code:</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600;">${bankSortCode || 'Please confirm'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Account Number:</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600;">${bankAccountNumber || 'Please confirm'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Payment Reference:</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600;">${rentPaymentRef}</td>
              </tr>
            </table>
          </div>
        </td>
      </tr>
    `

    // Build additional info section if provided
    let additionalInfoHtml = ''
    if (additionalInfo && additionalInfo.trim()) {
      additionalInfoHtml = `
        <tr>
          <td style="padding: 20px 0; border-bottom: 1px solid #e5e7eb;">
            <h3 style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">Additional Information</h3>
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
              <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${additionalInfo}</p>
            </div>
          </td>
        </tr>
      `
    }

    // Get agent's email for CC (proof of service)
    let agentEmail: string | null = null
    if (userId) {
      const { data: agentProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single()
      agentEmail = agentProfile?.email || null
    }

    // Send enhanced move-in pack email
    await sendEnhancedMoveInPack(
      activeTenants.map(t => ({ email: t.email!, name: `${t.first_name} ${t.last_name}`.trim() })),
      propertyAddress,
      moveInDate,
      tenancy.monthly_rent,
      tenancy.rent_due_day,
      tenancy.deposit_amount,
      tenancy.deposit_scheme,
      documents,
      { name: companyName, email: companyEmail, phone: companyPhone },
      companyName,
      company?.logo_url,
      managementInfoHtml,
      rentPaymentHtml,
      additionalInfoHtml,
      agentEmail
    )

    // Update tenancy to mark compliance pack as sent
    const updatedTenancy = await tenancyService.updateTenancy(req.params.id, companyId, {
      compliancePackSentAt: new Date().toISOString(),
      compliancePackSentBy: userId
    }, userId)

    // Log activity
    await tenancyService.logTenancyActivity(req.params.id, {
      action: 'MOVE_IN_PACK_SENT',
      category: 'documents',
      title: 'Move-in Pack Sent',
      description: `Move-in pack with ${documents.length} document(s) sent to tenants`,
      metadata: { documentCount: documents.length, tenantEmails: activeTenants.map(t => t.email) },
      performedBy: userId
    })

    res.json({ tenancy: updatedTenancy, documentsSent: documents.length })
  } catch (error: any) {
    console.error('Error in POST /api/tenancies/records/:id/move-in-pack:', error)
    res.status(500).json({ error: error.message })
  }
})

// Helper function for ordinal suffixes
function ordinalSuffix(n: number): string {
  if (n >= 11 && n <= 13) return n + 'th'
  switch (n % 10) {
    case 1: return n + 'st'
    case 2: return n + 'nd'
    case 3: return n + 'rd'
    default: return n + 'th'
  }
}

/**
 * GET /api/tenancies/records/:id/initial-monies-preview
 * Get preview data for initial monies modal (amounts, recipient, etc.)
 */
router.get('/records/:id/initial-monies-preview', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Get full tenancy with property and tenants
    const tenancy = await tenancyService.getTenancy(req.params.id, companyId)
    if (!tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    // Find lead tenant or first tenant with email
    const leadTenant = (tenancy.tenants || []).find(t => t.is_lead_tenant && t.email && t.status === 'active')
    const targetTenant = leadTenant || (tenancy.tenants || []).find(t => t.email && t.status === 'active')

    // Get holding deposit — check tenancy field first (set during V2 conversion), then fall back to offer lookup
    let holdingDepositPaid = 0

    // 1. Check tenancy's own holding_deposit_amount (reliable for V2 conversions)
    if (tenancy.holding_deposit_amount && parseFloat(tenancy.holding_deposit_amount) > 0) {
      holdingDepositPaid = parseFloat(tenancy.holding_deposit_amount)
    }

    // 2. If not on tenancy, try tenant_offers via reference_id (V1 path)
    if (holdingDepositPaid === 0 && tenancy.primary_reference_id) {
      const { data: offer } = await supabase
        .from('tenant_offers')
        .select('holding_deposit_amount_paid, holding_deposit_amount')
        .eq('reference_id', tenancy.primary_reference_id)
        .maybeSingle()

      if (offer?.holding_deposit_amount_paid) {
        holdingDepositPaid = parseFloat(offer.holding_deposit_amount_paid) || 0
      } else if (offer?.holding_deposit_amount) {
        holdingDepositPaid = parseFloat(offer.holding_deposit_amount) || 0
      }
    }

    // 3. If still 0, try V2 reference path
    if (holdingDepositPaid === 0 && tenancy.primary_reference_id) {
      const { data: v2ref } = await supabase
        .from('tenant_references_v2')
        .select('holding_deposit_amount, offer_id')
        .eq('id', tenancy.primary_reference_id)
        .maybeSingle()

      if (v2ref?.holding_deposit_amount) {
        holdingDepositPaid = parseFloat(v2ref.holding_deposit_amount) || 0
      } else if (v2ref?.offer_id) {
        const { data: v2offer } = await supabase
          .from('tenant_offers')
          .select('holding_deposit_amount_paid, holding_deposit_amount')
          .eq('id', v2ref.offer_id)
          .maybeSingle()

        if (v2offer?.holding_deposit_amount_paid) {
          holdingDepositPaid = parseFloat(v2offer.holding_deposit_amount_paid) || 0
        } else if (v2offer?.holding_deposit_amount) {
          holdingDepositPaid = parseFloat(v2offer.holding_deposit_amount) || 0
        }
      }
    }

    // Self-heal: if we found the value via fallback but tenancy field is null, backfill it
    if (holdingDepositPaid > 0 && (!tenancy.holding_deposit_amount || parseFloat(tenancy.holding_deposit_amount) === 0)) {
      await supabase
        .from('tenancies')
        .update({ holding_deposit_amount: holdingDepositPaid })
        .eq('id', req.params.id)
        .eq('company_id', companyId)
      console.log(`[InitialMonies] Backfilled holding_deposit_amount=${holdingDepositPaid} on tenancy ${req.params.id}`)
    }

    // If deposit scheme is reposit, deposit amount should be 0 (no cash deposit)
    const isReposit = tenancy.deposit_scheme === 'reposit'

    // Format property address
    const propertyAddress = [
      tenancy.property?.address_line1,
      tenancy.property?.city,
      tenancy.property?.postcode
    ].filter(Boolean).join(', ')

    // Calculate due date (7 days from now or start date, whichever is sooner)
    const now = new Date()
    const startDate = tenancy.start_date ? new Date(tenancy.start_date) : null
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const dueDate = startDate && startDate < sevenDaysFromNow ? startDate : sevenDaysFromNow

    // Calculate term months from start/end dates
    let termMonths = 12
    if (tenancy.start_date && tenancy.end_date) {
      const start = new Date(tenancy.start_date)
      const end = new Date(tenancy.end_date)
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
      termMonths = months > 0 ? months : 12
    }

    // Calculate pro-rata rent if move-in day differs from rent due day
    const monthlyRent = tenancy.monthly_rent || 0
    const moveInDate = tenancy.start_date || ''
    const rentDueDay = tenancy.rent_due_day || 1
    let proRataAmount = 0
    let hasProRata = false

    if (moveInDate && monthlyRent > 0 && rentDueDay) {
      const moveInDateObj = new Date(moveInDate)
      const moveInDay = moveInDateObj.getDate()

      if (moveInDay !== rentDueDay) {
        const daysInMonth = new Date(moveInDateObj.getFullYear(), moveInDateObj.getMonth() + 1, 0).getDate()
        const dailyRate = monthlyRent / daysInMonth

        let proRataDays: number
        if (moveInDay < rentDueDay) {
          // Move-in before due day in same month
          proRataDays = rentDueDay - moveInDay
        } else {
          // Move-in after due day, pro-rata to next month's due day
          proRataDays = (daysInMonth - moveInDay) + rentDueDay
        }

        proRataAmount = Math.round(dailyRate * proRataDays * 100) / 100
        hasProRata = true
      }
    }

    // First month rent includes pro-rata if applicable
    const firstMonthRent = monthlyRent + proRataAmount

    res.json({
      propertyAddress,
      recipientName: targetTenant ? `${targetTenant.first_name} ${targetTenant.last_name}`.trim() : '',
      recipientEmail: targetTenant?.email || '',
      monthlyRent,
      firstMonthRent,
      depositAmount: isReposit ? 0 : (tenancy.deposit_amount || 0),
      depositScheme: tenancy.deposit_scheme || null,
      holdingDepositPaid,
      // Initial monies = rent + deposit only. Additional charges are now agent fees deducted from month 1 rent payout.
      additionalCharges: [],
      dueDate: dueDate.toISOString().split('T')[0],
      termMonths,
      moveInDate,
      rentDueDay,
      proRataAmount,
      hasProRata
    })
  } catch (error: any) {
    console.error('Error in GET /api/tenancies/records/:id/initial-monies-preview:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/tenancies/records/:id/request-initial-monies
 * Send initial monies request email to lead tenant
 */
router.post('/records/:id/request-initial-monies', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const userId = req.user?.id
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Get edited amounts from request body (if provided by modal)
    const {
      firstMonthRent: editedFirstMonthRent,
      depositAmount: editedDeposit,
      holdingDepositPaid: editedHoldingDeposit,
      additionalCharges: editedAdditionalCharges,
      dueDate: editedDueDate,
      // For payment_requests table
      rentUpFront,
      termMonths,
      monthlyRent: editedMonthlyRent,
      proRataAmount
    } = req.body

    // Get full tenancy with property and tenants
    const tenancy = await tenancyService.getTenancy(req.params.id, companyId)
    if (!tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    // Find lead tenant or first tenant with email
    const leadTenant = (tenancy.tenants || []).find(t => t.is_lead_tenant && t.email && t.status === 'active')
    const targetTenant = leadTenant || (tenancy.tenants || []).find(t => t.email && t.status === 'active')

    if (!targetTenant || !targetTenant.email) {
      return res.status(400).json({ error: 'No tenant with email address found' })
    }

    // Get company details from the TENANCY's company for correct branding
    const tenancyCompanyId = tenancy.company_id || companyId
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted, phone_encrypted, email_encrypted, bank_account_name, bank_account_number, bank_sort_code, logo_url')
      .eq('id', tenancyCompanyId)
      .single()

    if (!company?.bank_account_name || !company?.bank_account_number || !company?.bank_sort_code) {
      return res.status(400).json({ error: 'Company bank details not configured. Please update your company settings.' })
    }

    const companyName = company.name_encrypted ? decrypt(company.name_encrypted) || 'PropertyGoose' : 'PropertyGoose'
    const companyPhone = company.phone_encrypted ? decrypt(company.phone_encrypted) || '' : ''
    const companyEmail = company.email_encrypted ? decrypt(company.email_encrypted) || '' : ''

    // Get holding deposit paid — use modal override if provided, otherwise auto-detect
    let holdingDepositPaid = editedHoldingDeposit !== undefined ? editedHoldingDeposit : 0
    if (holdingDepositPaid === 0 && editedHoldingDeposit === undefined) {
      // 1. Check tenancy's own field (set during V2 conversion)
      if (tenancy.holding_deposit_amount && parseFloat(tenancy.holding_deposit_amount) > 0) {
        holdingDepositPaid = parseFloat(tenancy.holding_deposit_amount)
      }

      // 2. Try tenant_offers via reference_id (V1 path)
      if (holdingDepositPaid === 0 && tenancy.primary_reference_id) {
        const { data: offer } = await supabase
          .from('tenant_offers')
          .select('holding_deposit_amount_paid')
          .eq('reference_id', tenancy.primary_reference_id)
          .maybeSingle()

        if (offer?.holding_deposit_amount_paid) {
          holdingDepositPaid = parseFloat(offer.holding_deposit_amount_paid) || 0
        }
      }

      // 3. Try V2 reference path
      if (holdingDepositPaid === 0 && tenancy.primary_reference_id) {
        const { data: v2ref } = await supabase
          .from('tenant_references_v2')
          .select('holding_deposit_amount, offer_id')
          .eq('id', tenancy.primary_reference_id)
          .maybeSingle()

        if (v2ref?.holding_deposit_amount) {
          holdingDepositPaid = parseFloat(v2ref.holding_deposit_amount) || 0
        } else if (v2ref?.offer_id) {
          const { data: v2offer } = await supabase
            .from('tenant_offers')
            .select('holding_deposit_amount_paid')
            .eq('id', v2ref.offer_id)
            .maybeSingle()

          if (v2offer?.holding_deposit_amount_paid) {
            holdingDepositPaid = parseFloat(v2offer.holding_deposit_amount_paid) || 0
          }
        }
      }
    }

    // Calculate amounts - use edited values if provided, otherwise use tenancy values
    const firstMonthRent = editedFirstMonthRent !== undefined ? editedFirstMonthRent : (tenancy.monthly_rent || 0)
    const depositAmount = editedDeposit !== undefined ? editedDeposit : (tenancy.deposit_amount || 0)
    // Initial monies = rent + deposit only. All agent fees (management, letting, additional)
    // are landlord fees deducted from the rent payout via month 1 agent_charges, not the tenant.
    const additionalCharges: { name: string; amount: number }[] = []

    // Format property address
    const propertyAddress = [
      tenancy.property?.address_line1,
      tenancy.property?.city,
      tenancy.property?.postcode
    ].filter(Boolean).join(', ')

    // Calculate due date - use edited date if provided
    let dueDateFormatted: string
    if (editedDueDate) {
      const parsedDate = new Date(editedDueDate)
      dueDateFormatted = parsedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    } else {
      const now = new Date()
      const startDate = tenancy.start_date ? new Date(tenancy.start_date) : null
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      const dueDate = startDate && startDate < sevenDaysFromNow ? startDate : sevenDaysFromNow
      dueDateFormatted = dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    }

    // Payment reference (use property postcode or address)
    const paymentReference = tenancy.property?.postcode || propertyAddress.slice(0, 30)

    // Confirm payment link
    const frontendUrl = getFrontendUrl()
    const confirmPaymentLink = `${frontendUrl}/tenancy/payment-confirmed/${tenancy.id}`

    // Send email
    await sendInitialMoniesRequest(
      targetTenant.email,
      `${targetTenant.first_name} ${targetTenant.last_name}`.trim(),
      propertyAddress,
      firstMonthRent,
      depositAmount,
      additionalCharges,
      holdingDepositPaid,
      {
        accountName: company.bank_account_name,
        accountNumber: company.bank_account_number,
        sortCode: company.bank_sort_code
      },
      dueDateFormatted,
      paymentReference,
      confirmPaymentLink,
      companyName,
      { companyName, phone: companyPhone, email: companyEmail },
      company.logo_url
    )

    // Update tenancy to mark initial monies as requested
    const updatedTenancy = await tenancyService.updateTenancy(req.params.id, companyId, {
      initialMoniesRequestedAt: new Date().toISOString(),
      initialMoniesRequestedBy: userId
    }, userId)

    const totalDue = firstMonthRent + depositAmount - holdingDepositPaid

    // Save to payment_requests table for future rentgoose implementation
    const { error: paymentRequestError } = await supabase
      .from('payment_requests')
      .insert({
        tenancy_id: req.params.id,
        company_id: companyId,
        type: 'initial_monies',
        rent_amount: rentUpFront ? (editedMonthlyRent || tenancy.monthly_rent || 0) * (termMonths || 12) : (editedMonthlyRent || tenancy.monthly_rent || 0),
        deposit_amount: depositAmount,
        holding_deposit_deducted: holdingDepositPaid,
        pro_rata_amount: proRataAmount || 0,
        additional_charges: additionalCharges.length > 0 ? additionalCharges : null,
        total_amount: totalDue,
        is_rent_up_front: rentUpFront || false,
        term_months: termMonths || null,
        due_date: editedDueDate || null,
        status: 'pending',
        requested_by: userId
      })

    if (paymentRequestError) {
      console.error('Error saving payment request:', paymentRequestError)
      // Don't fail the whole request, just log the error
    }

    // Create expected payment for initial monies
    try {
      const { createExpectedPayment } = await import('../services/rentgooseService')

      // Get property details
      const propForEp = tenancy?.property || {}
      const propertyAddr = (propForEp as any).address_line1 || ''
      const propertyPc = (propForEp as any).postcode || ''

      // Build payout split
      // Initial monies = rent + deposit only. Fees are deducted from month 1 rent payout, not collected here.
      const payoutSplit: any[] = []
      const rentPortion = firstMonthRent - holdingDepositPaid
      if (rentPortion > 0) {
        payoutSplit.push({ type: 'landlord_rent', amount: rentPortion, description: 'First month rent (less holding deposit)' })
      }
      if (depositAmount > 0) {
        payoutSplit.push({ type: 'deposit_hold', amount: depositAmount, description: 'Security deposit' })
      }

      await createExpectedPayment(companyId, {
        tenancy_id: req.params.id,
        property_id: tenancy?.property_id || undefined,
        payment_type: 'initial_monies',
        source_type: 'payment_request',
        source_id: req.params.id,
        description: `Initial monies - ${propertyAddr || 'Property'}`,
        amount_due: totalDue,
        status: 'pending',
        due_date: editedDueDate || undefined,
        payout_type: 'mixed',
        payout_split: payoutSplit,
        property_address: propertyAddr || undefined,
        property_postcode: propertyPc || undefined,
        tenant_name: `${targetTenant.first_name} ${targetTenant.last_name}`,
        landlord_name: undefined,
      })
    } catch (epError) {
      console.error('[RentGoose] Failed to create initial monies expected payment:', epError)
    }

    // Log activity
    await tenancyService.logTenancyActivity(req.params.id, {
      action: 'INITIAL_MONIES_REQUESTED',
      category: 'payments',
      title: 'Initial Monies Requested',
      description: `Initial monies request of £${totalDue.toLocaleString()} sent to ${targetTenant.first_name} ${targetTenant.last_name}`,
      metadata: { totalDue, emailSentTo: targetTenant.email },
      performedBy: userId
    })

    res.json({
      tenancy: updatedTenancy,
      emailSentTo: targetTenant.email,
      breakdown: {
        firstMonthRent,
        depositAmount,
        additionalCharges,
        holdingDepositPaid,
        totalDue
      }
    })
  } catch (error: any) {
    console.error('Error in POST /api/tenancies/records/:id/request-initial-monies:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/tenancies/records/:id/payment-request
 * Get payment request details for manual receipt
 */
router.get('/records/:id/payment-request', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const tenancy = await tenancyService.getTenancy(req.params.id, companyId)
    if (!tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    // Get the payment request if it exists
    const { data: paymentRequest } = await supabase
      .from('payment_requests')
      .select('*')
      .eq('tenancy_id', req.params.id)
      .eq('type', 'initial_monies')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Calculate amounts
    const firstMonthRent = paymentRequest?.first_month_rent || tenancy.monthly_rent || 0
    const depositAmount = paymentRequest?.deposit_amount || tenancy.deposit_amount || 0
    const holdingDeposit = paymentRequest?.holding_deposit_paid || 0
    const additionalCharges = paymentRequest?.additional_charges_total || 0
    const totalAmount = firstMonthRent + depositAmount + additionalCharges - holdingDeposit

    const propertyAddress = [
      tenancy.property?.address_line1,
      tenancy.property?.city,
      tenancy.property?.postcode
    ].filter(Boolean).join(', ')

    res.json({
      propertyAddress,
      totalAmount,
      firstMonthRent,
      depositAmount,
      holdingDeposit,
      additionalCharges,
      requestedAt: tenancy.initial_monies_requested_at,
      status: paymentRequest?.status || 'pending'
    })
  } catch (error: any) {
    console.error('Error getting payment request:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/tenancies/records/:id/confirm-initial-monies
 * Agent confirms receipt of initial monies payment
 * Supports both: after tenant confirmation AND manual receipt
 */
router.post('/records/:id/confirm-initial-monies', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const userId = req.user?.id
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { amountReceived, notes, manualReceipt } = req.body

    // Get current tenancy to calculate the paid amount
    const currentTenancy = await tenancyService.getTenancy(req.params.id, companyId)
    if (!currentTenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    // Use provided amount or calculate from tenancy
    let totalPaidAmount: number
    if (amountReceived !== undefined && amountReceived !== null) {
      totalPaidAmount = parseFloat(amountReceived)
    } else {
      // Calculate the total initial monies amount
      const firstMonthRent = currentTenancy.monthly_rent || 0
      const depositAmount = currentTenancy.deposit_amount || 0
      const additionalCharges = (currentTenancy.additional_charges || [])
        .filter((c: any) => c.frequency === 'one_time')
        .reduce((sum: number, c: any) => sum + (parseFloat(String(c.amount)) || 0), 0)

      // Get holding deposit from tenant_offers if available
      let holdingDepositPaid = 0
      if (currentTenancy.primary_reference_id) {
        const { data: offer } = await supabase
          .from('tenant_offers')
          .select('holding_deposit_amount_paid')
          .eq('reference_id', currentTenancy.primary_reference_id)
          .single()
        if (offer?.holding_deposit_amount_paid) {
          holdingDepositPaid = parseFloat(offer.holding_deposit_amount_paid) || 0
        }
      }

      totalPaidAmount = firstMonthRent + depositAmount + additionalCharges - holdingDepositPaid
    }

    // Update tenancy with paid timestamp and amount
    const { error: updateError } = await supabase
      .from('tenancies')
      .update({
        initial_monies_paid_at: new Date().toISOString(),
        initial_monies_confirmed_by: userId,
        initial_monies_paid_amount: totalPaidAmount
      })
      .eq('id', req.params.id)
      .eq('company_id', companyId)

    if (updateError) {
      console.error('Error updating tenancy:', updateError)
      return res.status(500).json({ error: 'Failed to confirm payment' })
    }

    // Update payment_requests status to paid (handles both pending and tenant_confirmed)
    await supabase
      .from('payment_requests')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        confirmed_by: userId,
        notes: notes || null,
        manual_receipt: manualReceipt || false
      })
      .eq('tenancy_id', req.params.id)
      .eq('type', 'initial_monies')
      .in('status', ['pending', 'tenant_confirmed'])

    // Get updated tenancy
    const tenancy = await tenancyService.getTenancy(req.params.id, companyId)

    // Log activity
    const actionDescription = manualReceipt
      ? `Agent manually receipted £${totalPaidAmount.toLocaleString()} initial monies${notes ? ` - ${notes}` : ''}`
      : `Agent confirmed receipt of £${totalPaidAmount.toLocaleString()} initial monies payment`

    await tenancyService.logTenancyActivity(req.params.id, {
      action: 'INITIAL_MONIES_CONFIRMED',
      category: 'payments',
      title: manualReceipt ? 'Initial Monies Manually Receipted' : 'Initial Monies Confirmed',
      description: actionDescription,
      metadata: { amount: totalPaidAmount, manualReceipt: manualReceipt || false },
      performedBy: userId
    })

    // Receipt the expected payment (creates client account entries from payout split)
    try {
      const { createExpectedPayment, receiptExpectedPayment } = await import('../services/rentgooseService')
      const { supabase: sb } = await import('../config/supabase')

      // Find the expected payment for this tenancy's initial monies
      let { data: ep } = await sb
        .from('expected_payments')
        .select('id')
        .eq('company_id', companyId)
        .eq('tenancy_id', req.params.id)
        .eq('payment_type', 'initial_monies')
        .in('status', ['pending', 'due'])
        .limit(1)
        .single()

      // If no expected_payment exists (tenancy predates this feature), create one now
      if (!ep) {
        const propAddr = tenancy?.property?.address_line1 || ''
        const propPc = tenancy?.property?.postcode || ''

        // Calculate the breakdown from the tenancy data
        const firstMonthRent = parseFloat(String(currentTenancy.monthly_rent || 0))
        const depositAmt = parseFloat(String(currentTenancy.deposit_amount || 0))
        let holdingDepPaid = 0
        // 1. Check tenancy's own field (reliable for V2 conversions)
        if (currentTenancy.holding_deposit_amount && parseFloat(String(currentTenancy.holding_deposit_amount)) > 0) {
          holdingDepPaid = parseFloat(String(currentTenancy.holding_deposit_amount))
        }
        // 2. V1 offer lookup
        if (holdingDepPaid === 0 && currentTenancy.primary_reference_id) {
          const { data: offer } = await sb
            .from('tenant_offers')
            .select('holding_deposit_amount_paid')
            .eq('reference_id', currentTenancy.primary_reference_id)
            .maybeSingle()
          if (offer?.holding_deposit_amount_paid) {
            holdingDepPaid = parseFloat(offer.holding_deposit_amount_paid) || 0
          }
        }
        // 3. V2 reference lookup
        if (holdingDepPaid === 0 && currentTenancy.primary_reference_id) {
          const { data: v2ref } = await sb
            .from('tenant_references_v2')
            .select('holding_deposit_amount, offer_id')
            .eq('id', currentTenancy.primary_reference_id)
            .maybeSingle()
          if (v2ref?.holding_deposit_amount) {
            holdingDepPaid = parseFloat(v2ref.holding_deposit_amount) || 0
          } else if (v2ref?.offer_id) {
            const { data: v2offer } = await sb
              .from('tenant_offers')
              .select('holding_deposit_amount_paid')
              .eq('id', v2ref.offer_id)
              .maybeSingle()
            if (v2offer?.holding_deposit_amount_paid) {
              holdingDepPaid = parseFloat(v2offer.holding_deposit_amount_paid) || 0
            }
          }
        }

        // Initial monies = rent + deposit only. Fees are deducted from month 1 rent payout, not collected here.
        const payoutSplit: any[] = []
        const rentPortion = firstMonthRent - holdingDepPaid
        if (rentPortion > 0) {
          payoutSplit.push({ type: 'landlord_rent', amount: rentPortion, description: 'First month rent (less holding deposit)' })
        }
        if (depositAmt > 0) {
          payoutSplit.push({ type: 'deposit_hold', amount: depositAmt, description: 'Security deposit' })
        }

        const tenantNames = (currentTenancy.tenants || [])
          .filter((t: any) => t.status === 'active')
          .map((t: any) => `${t.first_name || ''} ${t.last_name || ''}`.trim())
          .join(', ')

        try {
          ep = await createExpectedPayment(companyId, {
            tenancy_id: req.params.id,
            property_id: currentTenancy.property_id || undefined,
            payment_type: 'initial_monies',
            source_type: 'payment_request',
            source_id: req.params.id,
            description: `Initial monies - ${propAddr || 'Property'}`,
            amount_due: totalPaidAmount,
            status: 'pending',
            payout_type: 'mixed',
            payout_split: payoutSplit,
            property_address: propAddr || undefined,
            property_postcode: propPc || undefined,
            tenant_name: tenantNames || undefined,
          })
        } catch (createErr: any) {
          // UNIQUE conflict means one already exists (possibly in a different status)
          if (createErr?.code === '23505') {
            const { data: existing } = await sb
              .from('expected_payments')
              .select('id')
              .eq('company_id', companyId)
              .eq('source_type', 'payment_request')
              .eq('source_id', req.params.id)
              .limit(1)
              .single()
            ep = existing
          } else {
            throw createErr
          }
        }
      }

      if (ep) {
        await receiptExpectedPayment(companyId, {
          expected_payment_id: ep.id,
          amount: totalPaidAmount,
          payment_method: 'bank_transfer',
          date_received: new Date().toISOString().split('T')[0],
          receipted_by: userId,
        })
      }
      // Auto-receipt month 1 if schedule already exists (tenancy activated before initial monies)
      try {
        const { autoReceiptMonth1FromInitialMonies } = await import('../services/rentgooseService')
        await autoReceiptMonth1FromInitialMonies(req.params.id, companyId)
      } catch (autoErr: any) {
        console.error('[RentGoose] Auto-receipt month 1 failed (non-blocking):', autoErr.message)
      }
    } catch (epError) {
      console.error('[RentGoose] Failed to receipt initial monies expected payment:', epError)
    }

    // Create notification
    try {
      const { notifyInitialMoniesPaid } = await import('../services/notificationService')
      const propertyAddress = tenancy?.property
        ? `${tenancy.property.address_line1}, ${tenancy.property.city}`
        : 'Property'
      await notifyInitialMoniesPaid(companyId, req.params.id, propertyAddress, totalPaidAmount)
    } catch (notifError) {
      console.error('Failed to create initial monies notification:', notifError)
    }

    res.json({ tenancy })
  } catch (error: any) {
    console.error('Error in POST /api/tenancies/records/:id/confirm-initial-monies:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/tenancies/public/:id/tenant-paid
 * Public endpoint for tenant to confirm they've paid (from email link)
 * No authentication required
 */
router.post('/public/:id/tenant-paid', async (req, res) => {
  try {
    const tenancyId = req.params.id
    console.log('[tenant-paid] Route hit! ID:', tenancyId)

    // Get tenancy (without company filter since this is public)
    const { data: tenancy, error: tenancyError } = await supabase
      .from('tenancies')
      .select(`
        id,
        company_id,
        property_id,
        rent_amount,
        deposit_amount,
        additional_charges,
        initial_monies_tenant_confirmed_at,
        properties (
          address_line1_encrypted,
          city_encrypted,
          postcode
        ),
        tenancy_tenants (
          id,
          tenant_name_encrypted,
          tenant_email_encrypted,
          tenant_phone_encrypted,
          tenant_order,
          is_active,
          status,
          left_date,
          rent_share_amount,
          rent_share_percentage
        )
      `)
      .eq('id', tenancyId)
      .is('deleted_at', null)
      .single()

    if (tenancyError || !tenancy) {
      console.log('[tenant-paid] Tenancy lookup failed:', {
        tenancyId,
        error: tenancyError?.message || tenancyError,
        code: tenancyError?.code
      })
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    // If already confirmed, just return success
    if (tenancy.initial_monies_tenant_confirmed_at) {
      return res.json({ success: true, alreadyConfirmed: true })
    }

    // Update tenant confirmed timestamp
    const { error: updateError } = await supabase
      .from('tenancies')
      .update({
        initial_monies_tenant_confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', tenancyId)

    if (updateError) {
      console.error('Error updating tenancy:', updateError)
      return res.status(500).json({ error: 'Failed to confirm payment' })
    }

    // Update payment_requests status to tenant_confirmed
    await supabase
      .from('payment_requests')
      .update({
        status: 'tenant_confirmed',
        tenant_confirmed_at: new Date().toISOString()
      })
      .eq('tenancy_id', tenancyId)
      .eq('type', 'initial_monies')
      .eq('status', 'pending')

    // Get company notification email
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted, email_encrypted, reference_notification_email')
      .eq('id', tenancy.company_id)
      .single()

    // Get agent email (prefer reference notification email, fallback to company email)
    let agentEmail = ''
    if (company?.reference_notification_email) {
      agentEmail = company.reference_notification_email
    }
    if (!agentEmail && company?.email_encrypted) {
      agentEmail = decrypt(company.email_encrypted) || ''
    }

    // Get tenant and property info for notification
    const leadTenant = (tenancy.tenancy_tenants || []).find((t: any) => t.tenant_order === 1 && t.is_active)
    const targetTenant = leadTenant || (tenancy.tenancy_tenants || [])[0]
    const tenantName = targetTenant?.tenant_name_encrypted
      ? decrypt(targetTenant.tenant_name_encrypted) || 'Unknown Tenant'
      : 'Unknown Tenant'

    const property = tenancy.properties as any
    const propertyAddress = [
      property?.address_line1_encrypted ? decrypt(property.address_line1_encrypted) : '',
      property?.city_encrypted ? decrypt(property.city_encrypted) : '',
      property?.postcode || ''
    ].filter(Boolean).join(', ')

    // Calculate amount due
    const rent = parseFloat(tenancy.rent_amount || '0')
    const deposit = parseFloat(tenancy.deposit_amount || '0')
    const chargesTotal = (tenancy.additional_charges || [])
      .filter((c: any) => c.frequency === 'one_time')
      .reduce((sum: number, c: any) => sum + (c.amount || 0), 0)
    const amountDue = rent + deposit + chargesTotal

    // Send email notification to agent
    if (agentEmail) {
      const frontendUrl = getFrontendUrl()
      const tenancyLink = `${frontendUrl}/tenancies?selected=${tenancyId}`
      const companyName = company?.name_encrypted ? decrypt(company.name_encrypted) || '' : ''

      await sendTenantPaymentConfirmedNotification(
        agentEmail,
        propertyAddress,
        tenantName,
        amountDue,
        tenancyLink,
        companyName
      )
    }

    // Create in-app notification
    try {
      const { notifyInitialMoniesTenantConfirmed } = await import('../services/notificationService')
      await notifyInitialMoniesTenantConfirmed(tenancy.company_id, tenancyId, propertyAddress, tenantName)
    } catch (notifError) {
      console.error('Failed to create tenant payment notification:', notifError)
    }

    res.json({ success: true })
  } catch (error: any) {
    console.error('Error in POST /api/tenancies/public/:id/tenant-paid:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/tenancies/records/:id/generate-agreement
 * Generate a tenancy agreement from the tenancy data
 */
router.post('/records/:id/generate-agreement', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const userId = req.user?.id
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Get full tenancy
    const tenancy = await tenancyService.getTenancy(req.params.id, companyId)
    if (!tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    // Check if agreement already exists
    if (tenancy.agreement_id) {
      // Return existing agreement info
      const { data: existingAgreement } = await supabase
        .from('agreements')
        .select('id, status, pdf_path')
        .eq('id', tenancy.agreement_id)
        .single()

      if (existingAgreement) {
        return res.json({
          agreement: existingAgreement,
          message: 'Agreement already exists for this tenancy'
        })
      }
    }

    // Get property with landlords
    const { data: property } = await supabase
      .from('properties')
      .select(`
        id,
        address_line1_encrypted,
        address_line2_encrypted,
        city_encrypted,
        county_encrypted,
        postcode,
        country,
        management_type,
        property_landlords (
          landlord_id,
          ownership_percentage,
          is_primary_contact,
          landlords (
            id,
            first_name_encrypted,
            last_name_encrypted,
            email_encrypted,
            phone_encrypted,
            address_line1_encrypted,
            city_encrypted,
            postcode_encrypted,
            bank_account_name_encrypted,
            bank_account_number_encrypted,
            bank_sort_code_encrypted
          )
        )
      `)
      .eq('id', tenancy.property_id)
      .single()

    if (!property) {
      return res.status(400).json({ error: 'Property not found' })
    }

    // Get company details from the TENANCY's company for correct branding
    const tenancyCompanyId = tenancy.company_id || companyId
    const { data: company } = await supabase
      .from('companies')
      .select('id, name_encrypted, bank_account_name, bank_account_number, bank_sort_code')
      .eq('id', tenancyCompanyId)
      .single()

    // Format property address
    const propertyAddress = [
      decrypt(property.address_line1_encrypted),
      decrypt(property.address_line2_encrypted),
      decrypt(property.city_encrypted),
      decrypt(property.county_encrypted),
      property.postcode,
      property.country
    ].filter(Boolean).join(', ')

    // Format landlords
    const landlords = (property.property_landlords || []).map((pl: any) => {
      const l = pl.landlords
      if (!l) return null
      return {
        name: `${decrypt(l.first_name_encrypted) || ''} ${decrypt(l.last_name_encrypted) || ''}`.trim(),
        email: decrypt(l.email_encrypted) || '',
        phone: decrypt(l.phone_encrypted) || '',
        address: [
          decrypt(l.address_line1_encrypted),
          decrypt(l.city_encrypted),
          decrypt(l.postcode_encrypted)
        ].filter(Boolean).join(', '),
        ownership_percentage: pl.ownership_percentage,
        is_primary_contact: pl.is_primary_contact
      }
    }).filter(Boolean)

    // Format tenants
    const tenants = (tenancy.tenants || [])
      .filter(t => t.status === 'active')
      .map(t => ({
        name: `${t.first_name} ${t.last_name}`.trim(),
        email: t.email || '',
        phone: t.phone || '',
        is_lead_tenant: t.is_lead_tenant
      }))

    if (tenants.length === 0) {
      return res.status(400).json({ error: 'No active tenants found' })
    }

    // Determine bank details based on management type
    let bankAccountName = ''
    let bankAccountNumber = ''
    let bankSortCode = ''

    if (property.management_type === 'managed' && company) {
      // Use company bank details for managed properties
      bankAccountName = company.bank_account_name || ''
      bankAccountNumber = company.bank_account_number || ''
      bankSortCode = company.bank_sort_code || ''
    } else {
      // Use primary landlord's bank details for let-only
      const primaryPropertyLandlord = (property.property_landlords || []).find((pl: any) => pl.is_primary_contact)
      const primaryLandlordData = primaryPropertyLandlord?.landlords as any
      if (primaryLandlordData) {
        bankAccountName = decrypt(primaryLandlordData.bank_account_name_encrypted) || ''
        bankAccountNumber = decrypt(primaryLandlordData.bank_account_number_encrypted) || ''
        bankSortCode = decrypt(primaryLandlordData.bank_sort_code_encrypted) || ''
      }
    }

    // Fetch guarantors from tenancy_guarantors
    const { data: guarantorRecords } = await supabase
      .from('tenancy_guarantors')
      .select('*')
      .eq('tenancy_id', tenancy.id)
      .eq('status', 'active')

    const resolvedGuarantors = await Promise.all((guarantorRecords || []).map(async (g: any) => {
      // Find which tenant this guarantor is linked to
      let guarantorForTenantName: string | undefined
      if (g.guarantees_tenant_id) {
        const { data: linkedTenant } = await supabase
          .from('tenancy_tenants')
          .select('tenant_name_encrypted')
          .eq('id', g.guarantees_tenant_id)
          .single()
        if (linkedTenant?.tenant_name_encrypted) {
          guarantorForTenantName = decrypt(linkedTenant.tenant_name_encrypted) || undefined
        }
      }

      return {
        name: `${decrypt(g.first_name_encrypted) || ''} ${decrypt(g.last_name_encrypted) || ''}`.trim(),
        email: decrypt(g.email_encrypted) || '',
        phone: decrypt(g.phone_encrypted) || '',
        address: {
          line1: decrypt(g.address_line1_encrypted) || '',
          line2: decrypt(g.address_line2_encrypted) || '',
          city: decrypt(g.city_encrypted) || '',
          postcode: decrypt(g.postcode_encrypted) || ''
        },
        relationship_to_tenant: g.relationship_to_tenant,
        guarantorForTenantId: g.guarantees_tenant_id || undefined,
        guarantorForTenantName
      }
    }))

    // Create agreement data
    const agreementData = {
      company_id: companyId,
      tenancy_id: tenancy.id,
      template_type: tenancy.deposit_scheme || 'dps',
      status: 'draft',
      property_address: propertyAddress,
      landlords: landlords,
      tenants: tenants,
      guarantors: resolvedGuarantors,
      deposit_amount: tenancy.deposit_amount || 0,
      rent_amount: tenancy.monthly_rent,
      tenancy_start_date: tenancy.start_date,
      tenancy_end_date: tenancy.end_date,
      rent_due_day: tenancy.rent_due_day,
      bills_included: tenancy.bills_included,
      bank_account_name: bankAccountName,
      bank_account_number: bankAccountNumber,
      bank_sort_code: bankSortCode,
      created_by: userId
    }

    // Create agreement
    const { data: agreement, error: agreementError } = await supabase
      .from('agreements')
      .insert(agreementData)
      .select()
      .single()

    if (agreementError) {
      console.error('Error creating agreement:', agreementError)
      return res.status(500).json({ error: 'Failed to create agreement' })
    }

    // Link agreement to tenancy
    await tenancyService.updateTenancy(req.params.id, companyId, {
      agreementId: agreement.id
    }, userId)

    // Log activity
    await tenancyService.logTenancyActivity(req.params.id, {
      action: 'AGREEMENT_GENERATED',
      category: 'documents',
      title: 'Agreement Generated',
      description: `Tenancy agreement created with ${tenants.length} tenant(s)`,
      metadata: { agreementId: agreement.id, tenantCount: tenants.length },
      performedBy: userId
    })

    res.json({
      agreement,
      message: 'Agreement created successfully. You can now generate the PDF and send for signing.'
    })
  } catch (error: any) {
    console.error('Error in POST /api/tenancies/records/:id/generate-agreement:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// MOVE-IN TIME REQUEST
// ============================================================================

/**
 * POST /api/tenancies/records/:id/request-move-in-time
 * Send move-in time request email to lead tenant
 * Supports two modes:
 * - tenant_chooses: Send link for tenant to select their preferred times
 * - agent_suggests: Agent provides two time options for tenant to choose from
 */
router.post('/records/:id/request-move-in-time', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const userId = req.user?.id
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { mode = 'tenant_chooses', suggestedDate, suggestedTime1, suggestedTime2 } = req.body

    // Validate agent_suggests mode
    if (mode === 'agent_suggests') {
      if (!suggestedDate) {
        return res.status(400).json({ error: 'Move-in date is required' })
      }
      if (!suggestedTime1 || !suggestedTime2) {
        return res.status(400).json({ error: 'Two time options are required' })
      }
      if (suggestedTime1 === suggestedTime2) {
        return res.status(400).json({ error: 'Time options must be different' })
      }
      // Check for Sunday
      const dateObj = new Date(suggestedDate)
      if (dateObj.getDay() === 0) {
        return res.status(400).json({ error: 'Sunday move-ins are not available. Please select a different date.' })
      }
    }

    // Get full tenancy with property and tenants
    const tenancy = await tenancyService.getTenancy(req.params.id, companyId)
    if (!tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    // Find lead tenant or first tenant with email
    const leadTenant = (tenancy.tenants || []).find(t => t.is_lead_tenant && t.email && t.status === 'active')
    const targetTenant = leadTenant || (tenancy.tenants || []).find(t => t.email && t.status === 'active')

    if (!targetTenant || !targetTenant.email) {
      return res.status(400).json({ error: 'No tenant with email address found' })
    }

    // Get company details from the TENANCY's company for correct branding
    const tenancyCompanyId = tenancy.company_id || companyId
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted, phone_encrypted, email_encrypted, logo_url')
      .eq('id', tenancyCompanyId)
      .single()

    const companyName = company?.name_encrypted ? decrypt(company.name_encrypted) || 'PropertyGoose' : 'PropertyGoose'
    const companyPhone = company?.phone_encrypted ? decrypt(company.phone_encrypted) || '' : ''
    const companyEmail = company?.email_encrypted ? decrypt(company.email_encrypted) || '' : ''

    // Format property address
    const propertyAddress = [
      tenancy.property?.address_line1,
      tenancy.property?.city,
      tenancy.property?.postcode
    ].filter(Boolean).join(', ')

    const frontendUrl = getFrontendUrl()

    if (mode === 'agent_suggests') {
      // Agent has suggested a date and two times - store them and send email for tenant to confirm
      // Format the suggested date for display
      const formattedSuggestedDate = new Date(suggestedDate).toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      })

      // Store the suggested date and times in the tenancy
      await supabase
        .from('tenancies')
        .update({
          move_in_time_date: suggestedDate,
          move_in_time_slot_1: suggestedTime1,
          move_in_time_slot_2: suggestedTime2,
          move_in_time_requested_at: new Date().toISOString()
        })
        .eq('id', tenancy.id)

      // Generate link for tenant to confirm one of the times
      const confirmTimeLink = `${frontendUrl}/tenancy/confirm-move-in-time/${tenancy.id}`

      // Send email with agent-suggested times
      await sendMoveInTimeSuggestions(
        targetTenant.email,
        `${targetTenant.first_name} ${targetTenant.last_name}`.trim(),
        propertyAddress,
        formattedSuggestedDate,
        suggestedTime1,
        suggestedTime2,
        confirmTimeLink,
        companyName,
        { phone: companyPhone, email: companyEmail },
        company?.logo_url
      )

      // Log activity
      await tenancyService.logTenancyActivity(req.params.id, {
        action: 'MOVE_IN_TIME_SUGGESTED',
        category: 'general',
        title: 'Move-in Time Options Sent',
        description: `Move-in on ${formattedSuggestedDate} (${suggestedTime1} or ${suggestedTime2}) sent to ${targetTenant.first_name} ${targetTenant.last_name}`,
        metadata: { emailSentTo: targetTenant.email, suggestedDate, suggestedTime1, suggestedTime2 },
        performedBy: userId
      })
    } else {
      // tenant_chooses mode - tenant will select their own date and times
      const selectTimeLink = `${frontendUrl}/tenancy/select-move-in-time/${tenancy.id}`

      // Format the default move-in date (tenancy start date) for display
      const defaultMoveInDate = tenancy.start_date
        ? new Date(tenancy.start_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        : 'TBC'

      // Update requested_at timestamp
      await supabase
        .from('tenancies')
        .update({
          move_in_time_requested_at: new Date().toISOString()
        })
        .eq('id', tenancy.id)

      // Send email
      await sendMoveInTimeRequest(
        targetTenant.email,
        `${targetTenant.first_name} ${targetTenant.last_name}`.trim(),
        propertyAddress,
        defaultMoveInDate,
        selectTimeLink,
        companyName,
        { phone: companyPhone, email: companyEmail },
        company?.logo_url
      )

      // Log activity
      await tenancyService.logTenancyActivity(req.params.id, {
        action: 'MOVE_IN_TIME_REQUESTED',
        category: 'general',
        title: 'Move-in Time Requested',
        description: `Move-in time selection request sent to ${targetTenant.first_name} ${targetTenant.last_name}`,
        metadata: { emailSentTo: targetTenant.email, defaultMoveInDate: tenancy.start_date },
        performedBy: userId
      })
    }

    res.json({
      success: true,
      emailSentTo: targetTenant.email,
      moveInDate: tenancy.start_date,
      mode
    })
  } catch (error: any) {
    console.error('Error in POST /api/tenancies/records/:id/request-move-in-time:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/tenancies/public/:id/move-in-time-form
 * Get tenancy info for move-in time selection form (public endpoint)
 */
router.get('/public/:id/move-in-time-form', async (req, res) => {
  try {
    const tenancyId = req.params.id

    // Get tenancy with limited info (public endpoint)
    const { data: tenancy, error: tenancyError } = await supabase
      .from('tenancies')
      .select(`
        id,
        tenancy_start_date,
        company_id,
        move_in_time_slot_1,
        move_in_time_slot_2,
        move_in_time_submitted_at,
        properties (
          address_line1_encrypted,
          city_encrypted,
          postcode
        )
      `)
      .eq('id', tenancyId)
      .is('deleted_at', null)
      .single()

    if (tenancyError || !tenancy) {
      console.error('Move-in time form - tenancy lookup failed:', {
        tenancyId,
        error: tenancyError?.message || tenancyError,
        code: tenancyError?.code
      })
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    // Get company info for branding
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted, logo_url, primary_color, button_color')
      .eq('id', tenancy.company_id)
      .single()

    const companyName = company?.name_encrypted ? decrypt(company.name_encrypted) || 'PropertyGoose' : 'PropertyGoose'

    // Decrypt property address
    const property = tenancy.properties as any
    const propertyAddress = [
      property?.address_line1_encrypted ? decrypt(property.address_line1_encrypted) : null,
      property?.city_encrypted ? decrypt(property.city_encrypted) : null,
      property?.postcode
    ].filter(Boolean).join(', ')

    // Default branding colors
    const DEFAULT_PRIMARY_COLOR = '#fe7a0f'
    const DEFAULT_BUTTON_COLOR = '#fe7a0f'

    // Check if already submitted
    const alreadySubmitted = !!(tenancy as any).move_in_time_submitted_at

    res.json({
      tenancyId: tenancy.id,
      moveInDate: tenancy.tenancy_start_date,
      propertyAddress,
      companyName,
      companyLogoUrl: company?.logo_url || null,
      primaryColor: company?.primary_color || DEFAULT_PRIMARY_COLOR,
      buttonColor: company?.button_color || DEFAULT_BUTTON_COLOR,
      alreadySubmitted,
      submittedSlot1: alreadySubmitted ? (tenancy as any).move_in_time_slot_1 : null,
      submittedSlot2: alreadySubmitted ? (tenancy as any).move_in_time_slot_2 : null
    })
  } catch (error: any) {
    console.error('Error in GET /api/tenancies/public/:id/move-in-time-form:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/tenancies/public/:id/submit-move-in-time
 * Submit move-in time preferences (public endpoint for tenant)
 */
router.post('/public/:id/submit-move-in-time', async (req, res) => {
  try {
    const tenancyId = req.params.id
    const { moveInDate, timeSlot1, timeSlot2, notes } = req.body

    if (!moveInDate) {
      return res.status(400).json({ error: 'Please select a move-in date' })
    }

    // Check for Sunday
    const dateObj = new Date(moveInDate)
    if (dateObj.getDay() === 0) {
      return res.status(400).json({ error: 'Sunday move-ins are not available. Please select a different date or contact the agent directly.' })
    }

    if (!timeSlot1 || !timeSlot2) {
      return res.status(400).json({ error: 'Please select two preferred time slots' })
    }

    // Get tenancy
    const { data: tenancy, error: tenancyError } = await supabase
      .from('tenancies')
      .select(`
        id,
        company_id,
        tenancy_start_date,
        properties (
          address_line1_encrypted,
          city_encrypted,
          postcode
        ),
        tenancy_tenants (
          id,
          tenant_name_encrypted,
          tenant_email_encrypted,
          tenant_phone_encrypted,
          tenant_order,
          is_active,
          status,
          left_date,
          rent_share_amount,
          rent_share_percentage
        )
      `)
      .eq('id', tenancyId)
      .is('deleted_at', null)
      .single()

    if (tenancyError || !tenancy) {
      console.error('Submit move-in time - tenancy lookup failed:', {
        tenancyId,
        error: tenancyError?.message || tenancyError,
        code: tenancyError?.code,
        details: tenancyError?.details
      })
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    // Save the date and time slot preferences to the database
    const { error: updateError } = await supabase
      .from('tenancies')
      .update({
        move_in_time_date: moveInDate,
        move_in_time_slot_1: timeSlot1,
        move_in_time_slot_2: timeSlot2,
        move_in_time_tenant_notes: notes || null,
        move_in_time_submitted_at: new Date().toISOString()
      })
      .eq('id', tenancyId)

    if (updateError) {
      console.error('Error saving move-in time preferences:', updateError)
      return res.status(500).json({ error: 'Failed to save preferences' })
    }

    // Get company details to send notification to agent
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted, email_encrypted, reference_notification_email, logo_url')
      .eq('id', tenancy.company_id)
      .single()

    const companyName = company?.name_encrypted ? decrypt(company.name_encrypted) || 'PropertyGoose' : 'PropertyGoose'
    // Prefer reference_notification_email, fallback to email_encrypted
    const agentEmail = company?.reference_notification_email || (company?.email_encrypted ? decrypt(company.email_encrypted) : null)

    console.log('[submit-move-in-time] Agent email lookup:', {
      reference_notification_email: company?.reference_notification_email || null,
      email_encrypted_exists: !!company?.email_encrypted,
      resolved_agentEmail: agentEmail
    })

    // Decrypt property address
    const property = tenancy.properties as any
    const propertyAddress = [
      property?.address_line1_encrypted ? decrypt(property.address_line1_encrypted) : null,
      property?.city_encrypted ? decrypt(property.city_encrypted) : null,
      property?.postcode
    ].filter(Boolean).join(', ')

    // Get tenant name (tenancy_tenants uses tenant_name_encrypted for full name)
    const tenants = tenancy.tenancy_tenants as any[] || []
    const leadTenant = tenants.find(t => t.tenant_order === 1 && t.is_active) || tenants.find(t => t.is_active)
    const tenantName = leadTenant?.tenant_name_encrypted ? decrypt(leadTenant.tenant_name_encrypted) || 'Tenant' : 'Tenant'

    // Format move-in date (use the date tenant selected)
    const formattedMoveInDate = new Date(moveInDate).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })

    // Send notification to agent
    if (agentEmail) {
      console.log('[submit-move-in-time] Sending agent notification to:', agentEmail)
      const frontendUrl = getFrontendUrl()
      const viewTenancyLink = `${frontendUrl}/tenancies?open=${tenancyId}`

      await sendMoveInTimeSubmittedNotification(
        agentEmail,
        tenantName,
        propertyAddress,
        formattedMoveInDate,
        timeSlot1,
        timeSlot2,
        notes || null,
        viewTenancyLink,
        companyName,
        company?.logo_url
      )
      console.log('[submit-move-in-time] Agent notification sent successfully')
    } else {
      console.log('[submit-move-in-time] WARNING: No agent email found, skipping notification')
    }

    // Create in-app notification
    try {
      const { notifyMoveInTimeSubmitted } = await import('../services/notificationService')
      await notifyMoveInTimeSubmitted(
        tenancy.company_id,
        tenancyId,
        propertyAddress,
        tenantName,
        formattedMoveInDate,
        `${timeSlot1} or ${timeSlot2}`
      )
    } catch (notifError) {
      console.error('Failed to create move-in time submitted notification:', notifError)
    }

    res.json({
      success: true,
      message: 'Your move-in time preferences have been submitted'
    })
  } catch (error: any) {
    console.error('Error in POST /api/tenancies/public/:id/submit-move-in-time:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/tenancies/public/:id/confirm-move-in-time-form
 * Get data for tenant to confirm agent-suggested move-in time (public endpoint)
 */
router.get('/public/:id/confirm-move-in-time-form', async (req, res) => {
  try {
    const tenancyId = req.params.id

    // Get tenancy with limited info (public endpoint)
    const { data: tenancy, error: tenancyError } = await supabase
      .from('tenancies')
      .select(`
        id,
        tenancy_start_date,
        company_id,
        move_in_time_date,
        move_in_time_slot_1,
        move_in_time_slot_2,
        move_in_time_confirmed,
        properties (
          address_line1_encrypted,
          city_encrypted,
          postcode
        )
      `)
      .eq('id', tenancyId)
      .is('deleted_at', null)
      .single()

    if (tenancyError || !tenancy) {
      console.error('Confirm move-in time form - tenancy lookup failed:', {
        tenancyId,
        error: tenancyError?.message || tenancyError,
        code: tenancyError?.code
      })
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    // Check if time slots exist (should have been set by agent)
    if (!(tenancy as any).move_in_time_slot_1 || !(tenancy as any).move_in_time_slot_2) {
      return res.status(400).json({ error: 'No time options available for this tenancy' })
    }

    // Get company info for branding
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted, logo_url, primary_color, button_color')
      .eq('id', tenancy.company_id)
      .single()

    const companyName = company?.name_encrypted ? decrypt(company.name_encrypted) || 'PropertyGoose' : 'PropertyGoose'

    // Decrypt property address
    const property = tenancy.properties as any
    const propertyAddress = [
      property?.address_line1_encrypted ? decrypt(property.address_line1_encrypted) : null,
      property?.city_encrypted ? decrypt(property.city_encrypted) : null,
      property?.postcode
    ].filter(Boolean).join(', ')

    // Default branding colors
    const DEFAULT_PRIMARY_COLOR = '#fe7a0f'
    const DEFAULT_BUTTON_COLOR = '#fe7a0f'

    // Check if already confirmed
    const alreadyConfirmed = !!(tenancy as any).move_in_time_confirmed

    // Use agent-suggested date or fall back to tenancy start date
    const moveInDate = (tenancy as any).move_in_time_date || tenancy.tenancy_start_date

    res.json({
      tenancyId: tenancy.id,
      moveInDate,
      propertyAddress,
      companyName,
      companyLogoUrl: company?.logo_url || null,
      primaryColor: company?.primary_color || DEFAULT_PRIMARY_COLOR,
      buttonColor: company?.button_color || DEFAULT_BUTTON_COLOR,
      timeSlot1: (tenancy as any).move_in_time_slot_1,
      timeSlot2: (tenancy as any).move_in_time_slot_2,
      alreadyConfirmed,
      confirmedTime: alreadyConfirmed ? (tenancy as any).move_in_time_confirmed : null
    })
  } catch (error: any) {
    console.error('Error in GET /api/tenancies/public/:id/confirm-move-in-time-form:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/tenancies/public/:id/confirm-move-in-time
 * Tenant confirms their selected move-in time from agent suggestions (public endpoint)
 */
router.post('/public/:id/confirm-move-in-time', async (req, res) => {
  try {
    const tenancyId = req.params.id
    const { confirmedTime } = req.body

    if (!confirmedTime) {
      return res.status(400).json({ error: 'Please select a time slot' })
    }

    // Get tenancy
    const { data: tenancy, error: tenancyError } = await supabase
      .from('tenancies')
      .select(`
        id,
        company_id,
        tenancy_start_date,
        move_in_time_slot_1,
        move_in_time_slot_2,
        move_in_time_confirmed,
        properties (
          address_line1_encrypted,
          city_encrypted,
          postcode
        ),
        tenancy_tenants (
          id,
          tenant_name_encrypted,
          tenant_email_encrypted,
          tenant_phone_encrypted,
          tenant_order,
          is_active,
          status,
          left_date,
          rent_share_amount,
          rent_share_percentage
        )
      `)
      .eq('id', tenancyId)
      .is('deleted_at', null)
      .single()

    if (tenancyError || !tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    // Check if already confirmed
    if ((tenancy as any).move_in_time_confirmed) {
      return res.status(400).json({ error: 'Move-in time has already been confirmed' })
    }

    // Validate that the confirmed time is one of the suggested times
    const slot1 = (tenancy as any).move_in_time_slot_1
    const slot2 = (tenancy as any).move_in_time_slot_2
    if (confirmedTime !== slot1 && confirmedTime !== slot2) {
      return res.status(400).json({ error: 'Please select one of the available time slots' })
    }

    // Update the tenancy with confirmed time
    const { error: updateError } = await supabase
      .from('tenancies')
      .update({
        move_in_time_confirmed: confirmedTime,
        move_in_time_confirmed_at: new Date().toISOString(),
        move_in_time_submitted_at: new Date().toISOString() // Mark as submitted since tenant made selection
      })
      .eq('id', tenancyId)

    if (updateError) {
      console.error('Error confirming move-in time:', updateError)
      return res.status(500).json({ error: 'Failed to confirm time' })
    }

    // Get company details
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted, email_encrypted, phone_encrypted, reference_notification_email, logo_url')
      .eq('id', tenancy.company_id)
      .single()

    const companyName = company?.name_encrypted ? decrypt(company.name_encrypted) || 'PropertyGoose' : 'PropertyGoose'
    const agentEmail = company?.reference_notification_email || (company?.email_encrypted ? decrypt(company.email_encrypted) : null)
    const companyPhone = company?.phone_encrypted ? decrypt(company.phone_encrypted) : null

    console.log('[public/confirm-move-in-time] Agent email lookup:', {
      tenancyId,
      reference_notification_email: company?.reference_notification_email || null,
      email_encrypted_exists: !!company?.email_encrypted,
      resolved_agentEmail: agentEmail
    })

    // Decrypt property address
    const property = tenancy.properties as any
    const propertyAddress = [
      property?.address_line1_encrypted ? decrypt(property.address_line1_encrypted) : null,
      property?.city_encrypted ? decrypt(property.city_encrypted) : null,
      property?.postcode
    ].filter(Boolean).join(', ')

    // Get tenant info (tenancy_tenants uses tenant_name_encrypted for full name)
    const tenants = tenancy.tenancy_tenants as any[] || []
    const leadTenant = tenants.find(t => t.tenant_order === 1 && t.is_active) || tenants.find(t => t.is_active)
    const tenantName = leadTenant?.tenant_name_encrypted ? decrypt(leadTenant.tenant_name_encrypted) || 'Tenant' : 'Tenant'
    const tenantEmail = leadTenant?.tenant_email_encrypted ? decrypt(leadTenant.tenant_email_encrypted) : null

    // Parse move-in date and time for calendar invite
    const moveInDateStr = tenancy.tenancy_start_date
    const moveInDateObj = moveInDateStr ? new Date(moveInDateStr) : new Date()

    // Parse time (e.g., "10:30 AM" -> hours and minutes)
    const timeMatch = confirmedTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10)
      const minutes = parseInt(timeMatch[2], 10)
      const isPM = timeMatch[3].toUpperCase() === 'PM'

      if (isPM && hours !== 12) hours += 12
      if (!isPM && hours === 12) hours = 0

      moveInDateObj.setHours(hours, minutes, 0, 0)
    }

    // Generate .ics calendar content
    const endTime = new Date(moveInDateObj.getTime() + 60 * 60 * 1000) // 1 hour duration
    const formatICSDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    }

    const uid = `movein-${tenancyId}@propertygoose.co.uk`
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//PropertyGoose//Move-In//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART:${formatICSDate(moveInDateObj)}`,
      `DTEND:${formatICSDate(endTime)}`,
      `SUMMARY:Move-In: ${propertyAddress}`,
      `DESCRIPTION:Move-in appointment for ${propertyAddress}. Please arrive at ${confirmedTime}.`,
      `LOCATION:${propertyAddress}`,
      `ORGANIZER;CN=${companyName}:mailto:${agentEmail || 'noreply@propertygoose.co.uk'}`,
      tenantEmail ? `ATTENDEE;CN=${tenantName};RSVP=TRUE:mailto:${tenantEmail}` : '',
      'STATUS:CONFIRMED',
      'SEQUENCE:0',
      `DTSTAMP:${formatICSDate(new Date())}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].filter(Boolean).join('\r\n')

    // Format date for email
    const formattedDate = moveInDateObj.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })

    // Send confirmation emails with calendar invites
    if (tenantEmail) {
      await sendMoveInTimeConfirmation(
        tenantEmail,
        tenantName,
        propertyAddress,
        formattedDate,
        confirmedTime,
        companyName,
        { phone: companyPhone, email: agentEmail },
        company?.logo_url,
        icsContent
      )
    }

    // Also send to agent with .ics
    if (agentEmail) {
      console.log('[public/confirm-move-in-time] Sending agent confirmation to:', agentEmail)
      await sendMoveInTimeConfirmation(
        agentEmail,
        tenantName,
        propertyAddress,
        formattedDate,
        confirmedTime,
        companyName,
        null, // No contact details needed for agent email
        company?.logo_url,
        icsContent
      )
      console.log('[public/confirm-move-in-time] Agent confirmation sent successfully')
    } else {
      console.log('[public/confirm-move-in-time] WARNING: No agent email found, skipping notification')
    }

    // Create in-app notification
    try {
      const { notifyMoveInTimeConfirmed } = await import('../services/notificationService')
      await notifyMoveInTimeConfirmed(
        tenancy.company_id,
        tenancyId,
        propertyAddress,
        tenantName,
        `${formattedDate} at ${confirmedTime}`
      )
    } catch (notifError) {
      console.error('Failed to create move-in time confirmed notification:', notifError)
    }

    res.json({
      success: true,
      message: 'Your move-in time has been confirmed'
    })
  } catch (error: any) {
    console.error('Error in POST /api/tenancies/public/:id/confirm-move-in-time:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/tenancies/records/:id/confirm-move-in-time
 * Confirm a move-in time and send calendar invites (authenticated - agent use)
 */
router.post('/records/:id/confirm-move-in-time', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const userId = req.user?.id
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { confirmedTime } = req.body
    if (!confirmedTime) {
      return res.status(400).json({ error: 'Please specify the confirmed time' })
    }

    // Get full tenancy with property and tenants
    const tenancy = await tenancyService.getTenancy(req.params.id, companyId)
    if (!tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    // Update the tenancy with confirmed time
    const { error: updateError } = await supabase
      .from('tenancies')
      .update({
        move_in_time_confirmed: confirmedTime,
        move_in_time_confirmed_at: new Date().toISOString(),
        move_in_time_confirmed_by: userId
      })
      .eq('id', req.params.id)

    if (updateError) {
      throw new Error(`Failed to update tenancy: ${updateError.message}`)
    }

    // Get lead tenant email
    const activeTenants = (tenancy.tenants || []).filter((t: any) => t.status === 'active')
    const leadTenant = activeTenants.find((t: any) => t.is_lead_tenant) || activeTenants[0]

    if (!leadTenant?.email) {
      return res.status(400).json({ error: 'No tenant email available' })
    }

    // Get company details from the TENANCY's company for correct branding
    const tenancyCompanyId = tenancy.company_id || companyId
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted, email_encrypted, phone_encrypted, reference_notification_email, logo_url')
      .eq('id', tenancyCompanyId)
      .single()

    const companyName = company?.name_encrypted ? decrypt(company.name_encrypted) || 'PropertyGoose' : 'PropertyGoose'
    const companyEmail = company?.reference_notification_email || (company?.email_encrypted ? decrypt(company.email_encrypted) : null)

    // Build property address
    const propertyAddress = [
      tenancy.property?.address_line1,
      tenancy.property?.city,
      tenancy.property?.postcode
    ].filter(Boolean).join(', ')

    // Parse the move-in date and time for calendar invite
    const moveInDate = tenancy.start_date ? new Date(tenancy.start_date) : new Date()

    // Parse time (e.g., "10:30 AM" -> hours and minutes)
    const timeMatch = confirmedTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10)
      const minutes = parseInt(timeMatch[2], 10)
      const isPM = timeMatch[3].toUpperCase() === 'PM'

      if (isPM && hours !== 12) hours += 12
      if (!isPM && hours === 12) hours = 0

      moveInDate.setHours(hours, minutes, 0, 0)
    }

    // Generate .ics calendar content
    const endTime = new Date(moveInDate.getTime() + 60 * 60 * 1000) // 1 hour duration
    const formatICSDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    }

    const uid = `movein-${req.params.id}@propertygoose.co.uk`
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//PropertyGoose//Move-In//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART:${formatICSDate(moveInDate)}`,
      `DTEND:${formatICSDate(endTime)}`,
      `SUMMARY:Move-In: ${propertyAddress}`,
      `DESCRIPTION:Move-in appointment for ${propertyAddress}. Please arrive at ${confirmedTime}.`,
      `LOCATION:${propertyAddress}`,
      `ORGANIZER;CN=${companyName}:mailto:${companyEmail || 'noreply@propertygoose.co.uk'}`,
      `ATTENDEE;CN=${leadTenant.first_name} ${leadTenant.last_name};RSVP=TRUE:mailto:${leadTenant.email}`,
      'STATUS:CONFIRMED',
      'SEQUENCE:0',
      `DTSTAMP:${formatICSDate(new Date())}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n')

    // Format date for email
    const formattedDate = moveInDate.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })

    // Send confirmation email to tenant with .ics attachment
    await sendMoveInTimeConfirmation(
      leadTenant.email,
      `${leadTenant.first_name} ${leadTenant.last_name}`.trim(),
      propertyAddress,
      formattedDate,
      confirmedTime,
      companyName,
      { phone: company?.phone_encrypted ? decrypt(company.phone_encrypted) : null, email: companyEmail },
      company?.logo_url,
      icsContent
    )

    // Also send to agent
    if (companyEmail) {
      await sendMoveInTimeConfirmation(
        companyEmail,
        companyName,
        propertyAddress,
        formattedDate,
        confirmedTime,
        companyName,
        null, // No contact details needed for agent email
        company?.logo_url,
        icsContent
      )
    }

    // Log activity
    await tenancyService.logTenancyActivity(req.params.id, {
      action: 'MOVE_IN_TIME_CONFIRMED',
      category: 'general',
      title: 'Move-in Time Confirmed',
      description: `Move-in time confirmed for ${confirmedTime} on ${formattedDate}`,
      metadata: { confirmedTime, date: formattedDate, emailSentTo: leadTenant.email },
      performedBy: userId
    })

    res.json({
      success: true,
      confirmedTime,
      emailSentTo: leadTenant.email
    })
  } catch (error: any) {
    console.error('Error in POST /api/tenancies/records/:id/confirm-move-in-time:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/tenancies/records/:id/email-tenants
 * Send a custom email to selected tenants with optional attachments
 */
router.post('/records/:id/email-tenants', authenticateToken, emailAttachmentUpload.array('attachments', 5), async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const userId = req.user?.id
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { tenantIds, subject, message, templateKey } = req.body
    const attachments = req.files as Express.Multer.File[] || []

    // Parse tenantIds if it's a string (from FormData) - safely handle JSON parse
    let parsedTenantIds: string[]
    if (typeof tenantIds === 'string') {
      try {
        parsedTenantIds = JSON.parse(tenantIds)
      } catch {
        return res.status(400).json({ error: 'Invalid tenant IDs format' })
      }
    } else {
      parsedTenantIds = tenantIds || []
    }

    if (!parsedTenantIds || parsedTenantIds.length === 0) {
      return res.status(400).json({ error: 'At least one tenant must be selected' })
    }

    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required' })
    }

    // Get tenancy with property details
    const { data: tenancy, error: tenancyError } = await supabase
      .from('tenancies')
      .select(`
        id,
        company_id,
        properties (
          id,
          address_line1_encrypted,
          city_encrypted,
          postcode
        )
      `)
      .eq('id', req.params.id)
      .eq('company_id', companyId)
      .single()

    if (tenancyError || !tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    // Get selected tenants
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenancy_tenants')
      .select('id, tenant_name_encrypted, tenant_email_encrypted')
      .eq('tenancy_id', req.params.id)
      .in('id', parsedTenantIds)

    if (tenantsError) {
      return res.status(500).json({ error: 'Failed to fetch tenants' })
    }

    // Get company/agent details from the TENANCY's company for correct branding
    const tenancyCompanyId = tenancy.company_id || companyId
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('name_encrypted, email_encrypted, logo_url, primary_color, reference_notification_email')
      .eq('id', tenancyCompanyId)
      .single()

    if (companyError) {
      console.error('[email-tenants] Company fetch error:', companyError)
      return res.status(500).json({ error: 'Failed to fetch company details' })
    }

    const companyName = decrypt(company?.name_encrypted) || 'Property Management'
    const companyEmail = company?.reference_notification_email || decrypt(company?.email_encrypted) || null

    // Get agent (user) details
    const { data: agent, error: agentError } = await supabase
      .from('users')
      .select('first_name, last_name, email')
      .eq('id', userId)
      .single()

    const agentName = agent ? `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || companyName : companyName
    const agentEmail = agent?.email || companyEmail

    // Decrypt property address
    const property = tenancy.properties as { address_line1_encrypted?: string; city_encrypted?: string; postcode?: string } | null
    const propertyAddress = property
      ? `${decrypt(property.address_line1_encrypted ?? null) || ''}, ${decrypt(property.city_encrypted ?? null) || ''} ${property.postcode || ''}`.trim()
      : 'Property'

    // Send email to each tenant
    let sentCount = 0
    const errors: string[] = []

    for (const tenant of tenants || []) {
      const tenantEmail = decrypt(tenant.tenant_email_encrypted)
      const tenantName = decrypt(tenant.tenant_name_encrypted) || 'Tenant'

      if (!tenantEmail) {
        errors.push(`${tenantName}: No email address`)
        continue
      }

      // Replace template variables
      const personalizedSubject = subject
        .replace(/\{\{\s*tenant_name\s*\}\}/g, tenantName)
        .replace(/\{\{\s*property_address\s*\}\}/g, propertyAddress)
        .replace(/\{\{\s*agent_name\s*\}\}/g, agentName)
        .replace(/\{\{\s*company_name\s*\}\}/g, companyName)

      const personalizedMessage = message
        .replace(/\{\{\s*tenant_name\s*\}\}/g, tenantName)
        .replace(/\{\{\s*property_address\s*\}\}/g, propertyAddress)
        .replace(/\{\{\s*agent_name\s*\}\}/g, agentName)
        .replace(/\{\{\s*company_name\s*\}\}/g, companyName)

      try {
        await emailService.sendCustomTenantEmail({
          to: tenantEmail,
          subject: personalizedSubject,
          message: personalizedMessage,
          replyTo: agentEmail,
          attachments: attachments.map(f => ({
            filename: f.originalname,
            content: f.buffer
          })),
          branding: {
            logo_url: company?.logo_url,
            primary_color: company?.primary_color,
            company_name: companyName
          }
        })
        sentCount++
      } catch (emailError: any) {
        console.error(`Failed to send email to ${tenantEmail}:`, emailError)
        errors.push(`${tenantName}: ${emailError.message}`)
      }
    }

    // Log activity
    await tenancyService.logTenancyActivity(req.params.id, {
      action: 'EMAIL_SENT',
      category: 'communication',
      title: 'Email Sent to Tenants',
      description: `Email "${subject.substring(0, 50)}..." sent to ${sentCount} tenant(s)`,
      metadata: {
        templateKey,
        subject,
        recipientCount: sentCount,
        attachmentCount: attachments.length,
        errors: errors.length > 0 ? errors : undefined
      },
      performedBy: userId
    })

    res.json({
      success: true,
      sentCount,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error: any) {
    console.error('Error in POST /api/tenancies/records/:id/email-tenants:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/tenancies/records/bulk-email
 * Send a custom email to all active tenants across multiple tenancies
 * Each tenant receives their own personalised email (no shared details)
 */
router.post('/records/bulk-email', authenticateToken, emailAttachmentUpload.array('attachments', 5), async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const userId = req.user?.id
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { tenancyIds, subject, message, templateKey } = req.body
    const attachments = req.files as Express.Multer.File[] || []

    let parsedTenancyIds: string[]
    if (typeof tenancyIds === 'string') {
      try {
        parsedTenancyIds = JSON.parse(tenancyIds)
      } catch {
        return res.status(400).json({ error: 'Invalid tenancy IDs format' })
      }
    } else {
      parsedTenancyIds = tenancyIds || []
    }

    if (!parsedTenancyIds || parsedTenancyIds.length === 0) {
      return res.status(400).json({ error: 'At least one tenancy must be selected' })
    }

    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required' })
    }

    // Get all tenancies with property details (verify company ownership)
    const { data: tenancies, error: tenanciesError } = await supabase
      .from('tenancies')
      .select(`
        id,
        company_id,
        properties (
          id,
          address_line1_encrypted,
          city_encrypted,
          postcode
        )
      `)
      .in('id', parsedTenancyIds)
      .eq('company_id', companyId)

    if (tenanciesError || !tenancies || tenancies.length === 0) {
      return res.status(404).json({ error: 'No valid tenancies found' })
    }

    // Get all active tenants across selected tenancies
    const { data: allTenants, error: tenantsError } = await supabase
      .from('tenancy_tenants')
      .select('id, tenancy_id, tenant_name_encrypted, tenant_email_encrypted')
      .in('tenancy_id', tenancies.map(t => t.id))
      .eq('status', 'active')

    if (tenantsError) {
      return res.status(500).json({ error: 'Failed to fetch tenants' })
    }

    // Get company/agent details
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted, email_encrypted, logo_url, primary_color, reference_notification_email')
      .eq('id', companyId)
      .single()

    const companyName = decrypt(company?.name_encrypted) || 'Property Management'
    const companyEmail = company?.reference_notification_email || decrypt(company?.email_encrypted) || null

    const { data: agent } = await supabase
      .from('users')
      .select('first_name, last_name, email')
      .eq('id', userId)
      .single()

    const agentName = agent ? `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || companyName : companyName
    const agentEmail = agent?.email || companyEmail

    // Build tenancy-to-property map
    const tenancyPropertyMap = new Map<string, string>()
    for (const t of tenancies) {
      const property = t.properties as { address_line1_encrypted?: string; city_encrypted?: string; postcode?: string } | null
      const addr = property
        ? `${decrypt(property.address_line1_encrypted ?? null) || ''}, ${decrypt(property.city_encrypted ?? null) || ''} ${property.postcode || ''}`.trim()
        : 'Property'
      tenancyPropertyMap.set(t.id, addr)
    }

    // Send individual emails to each tenant (BCC style - each gets their own)
    let sentCount = 0
    const errors: string[] = []

    for (const tenant of allTenants || []) {
      const tenantEmail = decrypt(tenant.tenant_email_encrypted)
      const tenantName = decrypt(tenant.tenant_name_encrypted) || 'Tenant'
      const propertyAddress = tenancyPropertyMap.get(tenant.tenancy_id) || 'Property'

      if (!tenantEmail) {
        errors.push(`${tenantName}: No email address`)
        continue
      }

      const personalizedSubject = subject
        .replace(/\{\{\s*tenant_name\s*\}\}/g, tenantName)
        .replace(/\{\{\s*property_address\s*\}\}/g, propertyAddress)
        .replace(/\{\{\s*agent_name\s*\}\}/g, agentName)
        .replace(/\{\{\s*company_name\s*\}\}/g, companyName)

      const personalizedMessage = message
        .replace(/\{\{\s*tenant_name\s*\}\}/g, tenantName)
        .replace(/\{\{\s*property_address\s*\}\}/g, propertyAddress)
        .replace(/\{\{\s*agent_name\s*\}\}/g, agentName)
        .replace(/\{\{\s*company_name\s*\}\}/g, companyName)

      try {
        await emailService.sendCustomTenantEmail({
          to: tenantEmail,
          subject: personalizedSubject,
          message: personalizedMessage,
          replyTo: agentEmail,
          attachments: attachments.map(f => ({
            filename: f.originalname,
            content: f.buffer
          })),
          branding: {
            logo_url: company?.logo_url,
            primary_color: company?.primary_color,
            company_name: companyName
          }
        })
        sentCount++
      } catch (emailError: any) {
        console.error(`[bulk-email] Failed to send to ${tenantEmail}:`, emailError)
        errors.push(`${tenantName}: ${emailError.message}`)
      }
    }

    // Log activity on each tenancy
    for (const tenancyId of tenancies.map(t => t.id)) {
      await tenancyService.logTenancyActivity(tenancyId, {
        action: 'EMAIL_SENT',
        category: 'communication',
        title: 'Bulk Email Sent',
        description: `Bulk email "${subject.substring(0, 50)}..." sent across ${tenancies.length} tenancies`,
        metadata: { templateKey, subject, bulkSend: true, totalRecipients: sentCount },
        performedBy: userId
      })
    }

    res.json({
      success: true,
      sentCount,
      tenancyCount: tenancies.length,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error: any) {
    console.error('Error in POST /api/tenancies/records/bulk-email:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/tenancies/records/:id/dismiss-aml-warning
 * Dismiss the landlord AML warning for a tenancy
 */
router.post('/records/:id/dismiss-aml-warning', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const userId = req.user?.id
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Update the tenancy to mark AML warning as dismissed
    const { error } = await supabase
      .from('tenancies')
      .update({
        aml_warning_dismissed_at: new Date().toISOString(),
        aml_warning_dismissed_by: userId
      })
      .eq('id', req.params.id)
      .eq('company_id', companyId)

    if (error) {
      throw new Error(`Failed to dismiss AML warning: ${error.message}`)
    }

    res.json({ success: true })
  } catch (error: any) {
    console.error('Error in POST /api/tenancies/records/:id/dismiss-aml-warning:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// NOTES
// ============================================================================

/**
 * GET /api/tenancies/records/:id/notes
 * Get all notes for a tenancy
 */
router.get('/records/:id/notes', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const notes = await tenancyService.getTenancyNotes(req.params.id)
    res.json({ notes })
  } catch (error: any) {
    console.error('Error fetching tenancy notes:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/tenancies/records/:id/notes
 * Add a note to a tenancy
 */
router.post('/records/:id/notes', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { content, isPinned } = req.body

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Note content is required' })
    }

    const note = await tenancyService.addTenancyNote(
      req.params.id,
      content.trim(),
      userId,
      isPinned || false
    )

    res.status(201).json({ note })
  } catch (error: any) {
    console.error('Error adding tenancy note:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * PATCH /api/tenancies/records/:id/notes/:noteId
 * Update a note
 */
router.patch('/records/:id/notes/:noteId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { content, isPinned } = req.body

    const updates: { content?: string; is_pinned?: boolean } = {}
    if (content !== undefined) updates.content = content
    if (isPinned !== undefined) updates.is_pinned = isPinned

    await tenancyService.updateTenancyNote(req.params.noteId, updates, userId)
    res.json({ success: true })
  } catch (error: any) {
    console.error('Error updating tenancy note:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * DELETE /api/tenancies/records/:id/notes/:noteId
 * Delete a note
 */
router.delete('/records/:id/notes/:noteId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    await tenancyService.deleteTenancyNote(req.params.noteId, userId)
    res.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting tenancy note:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// ACTIVITY LOG
// ============================================================================

/**
 * GET /api/tenancies/records/:id/activity
 * Get activity log for a tenancy
 */
router.get('/records/:id/activity', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { limit, offset, category } = req.query

    const result = await tenancyService.getTenancyActivity(req.params.id, {
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
      category: category as string | undefined
    })

    res.json(result)
  } catch (error: any) {
    console.error('Error fetching tenancy activity:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// RENT DUE DATE CHANGE
// ============================================================================

/**
 * POST /api/tenancies/rent-due-date-change/:token/confirm-payment
 * PUBLIC endpoint - Tenant confirms they have paid the pro-rata amount
 */
router.post('/rent-due-date-change/:token/confirm-payment', async (req, res) => {
  try {
    // Get change record by confirmation token
    const { data: change, error: changeError } = await supabase
      .from('rent_due_date_changes')
      .select(`
        *,
        tenancies (
          id,
          company_id,
          properties (
            address_line1_encrypted,
            city_encrypted,
            postcode
          )
        )
      `)
      .eq('confirmation_token', req.params.token)
      .single()

    if (changeError || !change) {
      console.log('[rent-due-date-change/confirm] Token lookup failed:', req.params.token, changeError?.message)
      return res.status(404).json({ error: 'Rent due date change request not found or link has expired' })
    }

    if (change.status !== 'pending_payment') {
      // Idempotent - if already confirmed, return success
      if (change.status === 'payment_confirmed' || change.status === 'activated') {
        return res.json({
          success: true,
          message: 'Payment already confirmed',
          alreadyConfirmed: true
        })
      }
      return res.status(400).json({ error: 'This rent due date change has been cancelled' })
    }

    // Update to payment_confirmed
    const { error: updateError } = await supabase
      .from('rent_due_date_changes')
      .update({
        status: 'payment_confirmed',
        tenant_confirmed_at: new Date().toISOString()
      })
      .eq('id', change.id)

    if (updateError) {
      console.error('Error confirming payment:', updateError)
      return res.status(500).json({ error: 'Failed to confirm payment' })
    }

    // Log activity
    await tenancyService.logTenancyActivity(change.tenancy_id, {
      action: 'RENT_DUE_DATE_CHANGE_PAYMENT_CONFIRMED',
      category: 'financial',
      title: 'Tenant confirmed payment',
      description: `Lead tenant confirmed payment of £${parseFloat(change.total_amount).toFixed(2)} for rent due date change`,
      isSystemAction: true,
      metadata: {
        changeId: change.id,
        totalAmount: parseFloat(change.total_amount)
      }
    })

    // Get property address for response
    const changeData = change.tenancies as any
    const propertyAddress = changeData?.properties
      ? [
          changeData.properties.address_line1_encrypted ? decrypt(changeData.properties.address_line1_encrypted) : null,
          changeData.properties.city_encrypted ? decrypt(changeData.properties.city_encrypted) : null,
          changeData.properties.postcode
        ].filter(Boolean).join(', ')
      : 'your property'

    res.json({
      success: true,
      message: 'Payment confirmation received',
      propertyAddress,
      totalAmount: parseFloat(change.total_amount),
      newDueDay: change.new_due_day
    })
  } catch (error: any) {
    console.error('Error confirming rent due date change payment:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/tenancies/rent-due-date-change/:token
 * PUBLIC endpoint - Get rent due date change details for confirmation page
 */
router.get('/rent-due-date-change/:token', async (req, res) => {
  try {
    // Get change record by confirmation token
    const { data: change, error: changeError } = await supabase
      .from('rent_due_date_changes')
      .select(`
        id,
        current_due_day,
        new_due_day,
        effective_month,
        effective_year,
        monthly_rent,
        pro_rata_days,
        daily_rate,
        pro_rata_amount,
        admin_fee,
        total_amount,
        status,
        tenant_confirmed_at,
        tenancies (
          properties (
            address_line1_encrypted,
            city_encrypted,
            postcode
          ),
          companies (
            name_encrypted,
            logo_url
          )
        )
      `)
      .eq('confirmation_token', req.params.token)
      .single()

    if (changeError || !change) {
      console.log('[rent-due-date-change] Token lookup failed:', req.params.token, changeError?.message)
      return res.status(404).json({ error: 'Rent due date change request not found or link has expired' })
    }

    const tenancyData = change.tenancies as any
    const propertyAddress = tenancyData?.properties
      ? [
          tenancyData.properties.address_line1_encrypted ? decrypt(tenancyData.properties.address_line1_encrypted) : null,
          tenancyData.properties.city_encrypted ? decrypt(tenancyData.properties.city_encrypted) : null,
          tenancyData.properties.postcode
        ].filter(Boolean).join(', ')
      : ''

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

    const companyName = tenancyData?.companies?.name_encrypted
      ? decrypt(tenancyData.companies.name_encrypted) || ''
      : ''

    res.json({
      id: change.id,
      propertyAddress,
      companyName,
      companyLogoUrl: tenancyData?.companies?.logo_url || '',
      currentDueDay: change.current_due_day,
      newDueDay: change.new_due_day,
      effectiveDate: `${change.new_due_day}${getDaySuffix(change.new_due_day)} ${monthNames[change.effective_month - 1]} ${change.effective_year}`,
      monthlyRent: parseFloat(change.monthly_rent as any),
      proRataDays: change.pro_rata_days,
      dailyRate: parseFloat(change.daily_rate as any),
      proRataAmount: parseFloat(change.pro_rata_amount as any),
      adminFee: parseFloat(change.admin_fee as any),
      totalAmount: parseFloat(change.total_amount as any),
      status: change.status,
      alreadyConfirmed: change.status !== 'pending_payment'
    })
  } catch (error: any) {
    console.error('Error fetching rent due date change:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/tenancies/records/:id/rent-due-date-change
 * Create a new rent due date change request and email lead tenant
 */
router.post('/records/:id/rent-due-date-change', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const companyId = await getCompanyIdForRequest(req)

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { newDueDay, adminFee = 0 } = req.body
    const adminFeeNum = Number(adminFee || 0)

    // Validate inputs
    if (!newDueDay || newDueDay < 1 || newDueDay > 31) {
      return res.status(400).json({ error: 'New due day must be between 1 and 31' })
    }
    if (adminFeeNum < 0 || adminFeeNum > 50) {
      return res.status(400).json({ error: 'Admin fee must be between £0 and £50 (Tenant Fee Ban Act 2019)' })
    }

    // Get tenancy with company_id filter

    const { data: tenancy, error: tenancyError } = await supabase
      .from('tenancies')
      .select(`
        id, company_id, rent_due_day, rent_amount, tenancy_start_date, status, agreement_id, property_id,
        properties!inner(id, company_id, address_line1_encrypted, city_encrypted, postcode),
        tenancy_tenants(id, tenant_order, tenant_name_encrypted, tenant_email_encrypted)
      `)
      .eq('id', req.params.id)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .single()

    if (tenancyError || !tenancy) {
      console.error('[RentDueDateChange] Tenancy not found:', tenancyError?.message)
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    // Extract property and tenants from the joined query
    const propertyData = tenancy.properties as any
    const tenants = tenancy.tenancy_tenants as any[]

    if (tenancy.status !== 'active') {
      return res.status(400).json({ error: 'Can only change rent due date for active tenancies' })
    }

    const currentDueDay = tenancy.rent_due_day
    if (!currentDueDay) {
      return res.status(400).json({ error: 'Tenancy does not have a current rent due day set' })
    }

    if (currentDueDay === newDueDay) {
      return res.status(400).json({ error: 'New due day is the same as current due day' })
    }

    // Check for existing pending change
    const { data: existingChange } = await supabase
      .from('rent_due_date_changes')
      .select('id')
      .eq('tenancy_id', req.params.id)
      .in('status', ['pending_payment', 'payment_confirmed'])
      .single()

    if (existingChange) {
      return res.status(400).json({ error: 'There is already a pending rent due date change for this tenancy' })
    }

    // Calculate pro-rata days and amount
    const today = new Date()
    let effectiveMonth = today.getMonth() + 1 // 1-indexed
    let effectiveYear = today.getFullYear()

    // If we're past the current due day this month, effective date is next month
    if (today.getDate() > currentDueDay) {
      effectiveMonth++
      if (effectiveMonth > 12) {
        effectiveMonth = 1
        effectiveYear++
      }
    }

    // Calculate days between current due day and new due day
    // Use the effective month to get accurate calendar days
    const daysInEffectiveMonth = new Date(effectiveYear, effectiveMonth, 0).getDate()

    let proRataDays: number
    if (newDueDay > currentDueDay) {
      proRataDays = newDueDay - currentDueDay
    } else {
      // Wrapping around to next month
      proRataDays = (daysInEffectiveMonth - currentDueDay) + newDueDay
    }

    // Calculate daily rate: (rent_amount × 12) / 365
    const monthlyRent = parseFloat(tenancy.rent_amount)
    const dailyRate = (monthlyRent * 12) / 365
    const proRataAmount = dailyRate * proRataDays
    const totalAmount = proRataAmount + adminFeeNum

    // Get lead tenant (tenant_order === 1 is the lead tenant)
    const leadTenant = tenants?.find((t: any) => t.tenant_order === 1)
    if (!leadTenant) {
      return res.status(400).json({ error: 'No lead tenant found for this tenancy' })
    }

    const leadTenantEmail = decrypt(leadTenant.tenant_email_encrypted)
    const leadTenantName = decrypt(leadTenant.tenant_name_encrypted) || 'Tenant'

    if (!leadTenantEmail) {
      return res.status(400).json({ error: 'Lead tenant email not found' })
    }

    // Get company details from the TENANCY's company for correct branding
    const tenancyCompanyId = (tenancy as any).company_id || companyId
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted, logo_url, bank_account_name, bank_account_number, bank_sort_code, email_encrypted, phone_encrypted')
      .eq('id', tenancyCompanyId)
      .single()

    if (!company?.bank_account_name || !company?.bank_account_number || !company?.bank_sort_code) {
      return res.status(400).json({ error: 'Company bank details not configured. Please add bank details in settings.' })
    }

    // Decrypt company details
    let companyName = company.name_encrypted ? decrypt(company.name_encrypted) : null
    const companyEmail = company.email_encrypted ? decrypt(company.email_encrypted) || '' : ''
    const companyPhone = company.phone_encrypted ? decrypt(company.phone_encrypted) || '' : ''

    // Build a sensible company name - never use generic "Your Agent"
    if (!companyName && companyEmail) {
      const domain = companyEmail.split('@')[1]?.split('.')[0]
      companyName = domain ? domain.charAt(0).toUpperCase() + domain.slice(1) + ' Property Management' : 'PropertyGoose'
    }
    if (!companyName) {
      companyName = 'PropertyGoose'
    }

    // Create rent due date change record
    const { data: changeRecord, error: insertError } = await supabase
      .from('rent_due_date_changes')
      .insert({
        tenancy_id: req.params.id,
        company_id: companyId,
        current_due_day: currentDueDay,
        new_due_day: newDueDay,
        effective_month: effectiveMonth,
        effective_year: effectiveYear,
        monthly_rent: monthlyRent,
        pro_rata_days: proRataDays,
        daily_rate: parseFloat(dailyRate.toFixed(4)),
        pro_rata_amount: parseFloat(proRataAmount.toFixed(2)),
        admin_fee: adminFeeNum,
        total_amount: parseFloat(totalAmount.toFixed(2)),
        lead_tenant_id: leadTenant.id,
        lead_tenant_email_encrypted: leadTenant.tenant_email_encrypted,
        created_by: userId
      })
      .select()
      .single()

    if (insertError || !changeRecord) {
      console.error('Error creating rent due date change:', insertError)
      return res.status(500).json({ error: 'Failed to create rent due date change request' })
    }

    // Send email to lead tenant
    const propertyAddress = [
      propertyData?.address_line1_encrypted ? decrypt(propertyData.address_line1_encrypted) : null,
      propertyData?.city_encrypted ? decrypt(propertyData.city_encrypted) : null,
      propertyData?.postcode
    ].filter(Boolean).join(', ')

    const frontendUrl = getFrontendUrl()
    const confirmationUrl = `${frontendUrl}/confirm-rent-change/${changeRecord.confirmation_token}`

    // Format effective date
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const effectiveDate = `${newDueDay}${getDaySuffix(newDueDay)} ${monthNames[effectiveMonth - 1]} ${effectiveYear}`

    // Build admin fee row if applicable
    let adminFeeRow = ''
    if (adminFeeNum > 0) {
      adminFeeRow = `
        <tr>
          <td style="padding: 8px 0; font-size: 14px; color: #78350f;">Administration fee:</td>
          <td style="padding: 8px 0; font-size: 14px; color: #92400e; font-weight: 600; text-align: right;">£${adminFeeNum.toFixed(2)}</td>
        </tr>
      `
    }

    // Build contact section
    let contactSection = ''
    if (companyEmail || companyPhone) {
      contactSection = `
        <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #111827;">Contact Us</h3>
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            ${companyEmail ? `Email: ${companyEmail}` : ''}
            ${companyEmail && companyPhone ? ' | ' : ''}
            ${companyPhone ? `Phone: ${companyPhone}` : ''}
          </p>
        </div>
      `
    }

    const { loadEmailTemplate, sendEmail } = await import('../services/emailService')

    const html = loadEmailTemplate('rent-due-date-change-request', {
      TenantName: leadTenantName,
      PropertyAddress: propertyAddress,
      CurrentDueDay: `${currentDueDay}${getDaySuffix(currentDueDay)} of each month`,
      NewDueDay: `${newDueDay}${getDaySuffix(newDueDay)} of each month`,
      EffectiveDate: effectiveDate,
      MonthlyRent: monthlyRent.toFixed(2),
      DailyRate: dailyRate.toFixed(2),
      ProRataDays: proRataDays.toString(),
      ProRataAmount: proRataAmount.toFixed(2),
      AdminFeeRow: adminFeeRow,
      TotalAmount: totalAmount.toFixed(2),
      BankAccountName: company.bank_account_name,
      BankSortCode: company.bank_sort_code,
      BankAccountNumber: company.bank_account_number,
      PaymentReference: `RDC-${changeRecord.id.slice(0, 8).toUpperCase()}`,
      ConfirmationUrl: confirmationUrl,
      CompanyName: companyName,
      AgentLogoUrl: company.logo_url || 'https://app.propertygoose.co.uk/PropertyGooseLogo.png',
      ContactSection: contactSection
    })

    await sendEmail({
      to: leadTenantEmail,
      subject: `${companyName} - Rent Due Date Change Request - ${propertyAddress}`,
      html
    })

    // Update email_sent_at
    await supabase
      .from('rent_due_date_changes')
      .update({ email_sent_at: new Date().toISOString() })
      .eq('id', changeRecord.id)

    // Log activity
    await tenancyService.logTenancyActivity(req.params.id, {
      action: 'RENT_DUE_DATE_CHANGE_INITIATED',
      category: 'financial',
      title: 'Rent due date change initiated',
      description: `Change from ${currentDueDay}${getDaySuffix(currentDueDay)} to ${newDueDay}${getDaySuffix(newDueDay)} requested. Pro-rata: £${proRataAmount.toFixed(2)}${adminFeeNum > 0 ? ` + £${adminFeeNum.toFixed(2)} fee` : ''} = £${totalAmount.toFixed(2)}`,
      performedBy: userId,
      metadata: {
        changeId: changeRecord.id,
        currentDueDay,
        newDueDay,
        proRataDays,
        proRataAmount: parseFloat(proRataAmount.toFixed(2)),
        adminFee: adminFeeNum,
        totalAmount: parseFloat(totalAmount.toFixed(2))
      }
    })

    // Create expected payment for rent due date change
    try {
      const { createExpectedPayment } = await import('../services/rentgooseService')

      const payoutSplit: any[] = []
      if (proRataAmount > 0) {
        payoutSplit.push({ type: 'landlord_prorata', amount: parseFloat(proRataAmount.toFixed(2)), description: 'Pro-rata rent adjustment' })
      }
      if (adminFeeNum > 0) {
        payoutSplit.push({ type: 'agent_fee', amount: adminFeeNum, description: 'Administration fee' })
      }

      await createExpectedPayment(companyId, {
        tenancy_id: req.params.id,
        property_id: propertyData?.id || undefined,
        payment_type: 'rent_change_fee',
        source_type: 'rent_due_date_change',
        source_id: changeRecord.id,
        description: `Rent due date change - ${propertyAddress || 'Property'}`,
        amount_due: parseFloat(totalAmount.toFixed(2)),
        status: 'pending',
        payout_type: 'mixed',
        payout_split: payoutSplit,
        property_address: propertyAddress || undefined,
        tenant_name: leadTenantName,
      })
    } catch (epError) {
      console.error('[RentGoose] Failed to create rent change expected payment:', epError)
    }

    res.status(201).json({
      change: {
        id: changeRecord.id,
        currentDueDay,
        newDueDay,
        effectiveMonth,
        effectiveYear,
        proRataDays,
        dailyRate: parseFloat(dailyRate.toFixed(4)),
        proRataAmount: parseFloat(proRataAmount.toFixed(2)),
        adminFee: adminFeeNum,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        status: 'pending_payment'
      }
    })
  } catch (error: any) {
    console.error('Error creating rent due date change:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/tenancies/records/:id/rent-due-date-changes
 * Get rent due date change history for a tenancy
 */
router.get('/records/:id/rent-due-date-changes', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Verify tenancy belongs to company
    const { data: tenancy, error: tenancyError } = await supabase
      .from('tenancies')
      .select('id')
      .eq('id', req.params.id)
      .eq('company_id', companyId)
      .single()

    if (tenancyError || !tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    const { data: changes, error } = await supabase
      .from('rent_due_date_changes')
      .select(`
        id,
        current_due_day,
        new_due_day,
        effective_month,
        effective_year,
        monthly_rent,
        pro_rata_days,
        daily_rate,
        pro_rata_amount,
        admin_fee,
        total_amount,
        status,
        email_sent_at,
        tenant_confirmed_at,
        activated_at,
        cancelled_at,
        cancelled_reason,
        payment_received_at,
        payment_reference,
        notice_document_id,
        created_at
      `)
      .eq('tenancy_id', req.params.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching rent due date changes:', error)
      return res.status(500).json({ error: 'Failed to fetch rent due date changes' })
    }

    res.json({ changes: changes || [] })
  } catch (error: any) {
    console.error('Error fetching rent due date changes:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/tenancies/records/:id/rent-due-date-change/:changeId/activate
 * Agent activates the rent due date change after verifying payment
 */
router.post('/records/:id/rent-due-date-change/:changeId/activate', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Get optional payment receipt details from request body
    const { paymentReceivedAt, paymentReference } = req.body

    // Get the change record
    const { data: change, error: changeError } = await supabase
      .from('rent_due_date_changes')
      .select('*')
      .eq('id', req.params.changeId)
      .eq('tenancy_id', req.params.id)
      .single()

    if (changeError || !change) {
      return res.status(404).json({ error: 'Rent due date change not found' })
    }

    // Allow activation from pending_payment (manual receipt) or payment_confirmed (tenant confirmed)
    if (!['pending_payment', 'payment_confirmed'].includes(change.status)) {
      return res.status(400).json({ error: 'This change has already been activated or cancelled' })
    }

    // Get tenancy with tenants and property
    const { data: tenancy, error: tenancyError } = await supabase
      .from('tenancies')
      .select(`
        id,
        company_id,
        property_id,
        rent_due_day,
        properties (
          id,
          address_line1_encrypted,
          city_encrypted,
          postcode
        ),
        tenancy_tenants (
          id,
          tenant_name_encrypted,
          tenant_email_encrypted
        )
      `)
      .eq('id', req.params.id)
      .eq('company_id', companyId)
      .single()

    if (tenancyError || !tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    // Update tenancy rent_due_day
    const { error: updateTenancyError } = await supabase
      .from('tenancies')
      .update({ rent_due_day: change.new_due_day })
      .eq('id', req.params.id)

    if (updateTenancyError) {
      console.error('Error updating tenancy rent due day:', updateTenancyError)
      return res.status(500).json({ error: 'Failed to update tenancy' })
    }

    // Propagate new due day to future RentGoose schedule entries
    try {
      const { updateFutureRentDueDates } = await import('../services/rentgooseService')
      await updateFutureRentDueDates(req.params.id, change.new_due_day)
    } catch (err) {
      console.error('[activate] Failed to propagate due date change to schedule:', err)
    }

    // Get company details for email and PDF
    const { data: companyRaw } = await supabase
      .from('companies')
      .select('name_encrypted, logo_url, email_encrypted, phone_encrypted, address_encrypted, city_encrypted, postcode_encrypted')
      .eq('id', tenancy.company_id)
      .single()

    // Decrypt company fields
    const company = companyRaw ? {
      name: decrypt(companyRaw.name_encrypted) || 'PropertyGoose',
      logo_url: companyRaw.logo_url,
      email: decrypt(companyRaw.email_encrypted) || undefined,
      phone: decrypt(companyRaw.phone_encrypted) || undefined,
      address_line1: decrypt(companyRaw.address_encrypted) || undefined,
      city: decrypt(companyRaw.city_encrypted) || undefined,
      postcode: decrypt(companyRaw.postcode_encrypted) || undefined
    } : null

    // Build property address
    const tenancyProperty = tenancy.properties as any
    const propertyAddress = [
      tenancyProperty?.address_line1_encrypted ? decrypt(tenancyProperty.address_line1_encrypted) : null,
      tenancyProperty?.city_encrypted ? decrypt(tenancyProperty.city_encrypted) : null,
      tenancyProperty?.postcode
    ].filter(Boolean).join(', ')

    const { loadEmailTemplate, sendEmail } = await import('../services/emailService')

    // Calculate next rent due date
    let nextRentMonth = change.effective_month
    let nextRentYear = change.effective_year
    const nextRentDueDate = new Date(nextRentYear, nextRentMonth - 1, change.new_due_day)

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

    // Format dates
    const effectiveDate = `${change.new_due_day}${getDaySuffix(change.new_due_day)} ${monthNames[nextRentMonth - 1]} ${nextRentYear}`
    const paymentReceivedDate = paymentReceivedAt
      ? new Date(paymentReceivedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : new Date(change.tenant_confirmed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const nextRentDueDateStr = nextRentDueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

    // Get lead tenant name for PDF
    const leadTenant = tenancy.tenancy_tenants?.[0]
    const leadTenantName = leadTenant ? decrypt(leadTenant.tenant_name_encrypted) || 'Tenant' : 'Tenant'

    // Build company address for PDF
    const companyAddress = [company?.address_line1, company?.city, company?.postcode].filter(Boolean).join(', ')

    // Generate PDF confirmation notice
    let noticeDocumentId: string | null = null
    console.log('[activate] Starting PDF generation...')
    try {
      const { pdfGenerationService } = await import('../services/pdfGenerationService')
      console.log('[activate] PDF service loaded, calling generateRentDueDateChangeConfirmation')

      const pdfBuffer = await pdfGenerationService.generateRentDueDateChangeConfirmation({
        tenantName: leadTenantName,
        propertyAddress,
        previousDueDay: change.current_due_day,
        newDueDay: change.new_due_day,
        effectiveDate,
        monthlyRent: parseFloat(change.monthly_rent),
        proRataDays: change.pro_rata_days,
        proRataAmount: parseFloat(change.pro_rata_amount),
        adminFee: parseFloat(change.admin_fee || 0),
        totalAmount: parseFloat(change.total_amount),
        paymentReceivedDate,
        paymentReference: paymentReference || undefined,
        nextRentDueDate: nextRentDueDateStr,
        companyName: company?.name || 'Property Management',
        companyAddress: companyAddress || undefined,
        companyEmail: company?.email || undefined,
        companyPhone: company?.phone || undefined,
        companyLogoUrl: company?.logo_url || undefined,
        documentRef: change.id.substring(0, 8).toUpperCase()
      })

      // Upload PDF to Supabase Storage (property-documents bucket)
      const fileName = `rent-due-date-change-confirmation-${change.id.substring(0, 8)}.pdf`
      const filePath = `notices/${req.params.id}/${fileName}`
      console.log('[activate] Generated PDF, uploading to storage:', filePath)

      const { error: uploadError } = await supabase.storage
        .from('property-documents')
        .upload(filePath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true
        })

      if (uploadError) {
        console.error('[activate] Error uploading PDF to storage:', uploadError)
        // Continue without document - don't fail the activation
      } else {
        console.log('[activate] PDF uploaded successfully')

        // Create property_documents record with storage path (not signed URL)
        const propertyId = tenancy.property_id || tenancyProperty?.id
        console.log('[activate] Creating property_documents record. propertyId:', propertyId, 'storagePath:', filePath)

        if (propertyId) {
          const { data: docRecord, error: docError } = await supabase
            .from('property_documents')
            .insert({
              property_id: propertyId,
              file_name: fileName,
              file_path: filePath,  // Store storage path, not signed URL
              file_size: pdfBuffer.length,
              file_type: 'application/pdf',
              tag: 'rent_notice',
              source_type: 'system_generated',
              source_id: change.id,
              description: `Rent Due Date Change Confirmation - ${change.current_due_day}${getDaySuffix(change.current_due_day)} to ${change.new_due_day}${getDaySuffix(change.new_due_day)}`,
              uploaded_by: userId
            })
            .select('id')
            .single()

          if (docError) {
            console.error('[activate] Error creating property_documents record:', docError)
          } else {
            console.log('[activate] Document record created with ID:', docRecord?.id)
            noticeDocumentId = docRecord?.id || null
          }
        } else {
          console.warn('[activate] Missing propertyId, skipping document record')
        }
      }
    } catch (pdfError) {
      console.error('[activate] Error generating PDF notice:', pdfError)
      // Continue without PDF - don't fail the activation
    }

    // Update change record to activated
    const now = new Date().toISOString()
    const { error: updateChangeError } = await supabase
      .from('rent_due_date_changes')
      .update({
        status: 'activated',
        activated_at: now,
        activated_by: userId,
        payment_received_at: paymentReceivedAt || change.tenant_confirmed_at,
        payment_reference: paymentReference || null,
        notice_document_id: noticeDocumentId
      })
      .eq('id', req.params.changeId)

    if (updateChangeError) {
      console.error('Error updating change record:', updateChangeError)
      return res.status(500).json({ error: 'Failed to activate change' })
    }

    // Build admin fee row for email
    let adminFeeRow = ''
    if (change.admin_fee > 0) {
      adminFeeRow = `
        <tr>
          <td style="padding: 8px 0; font-size: 14px; color: #6b7280;">Administration fee:</td>
          <td style="padding: 8px 0; font-size: 14px; color: #111827; font-weight: 600; text-align: right;">£${parseFloat(change.admin_fee).toFixed(2)}</td>
        </tr>
      `
    }

    // Build contact section for email
    let contactSection = ''
    if (company?.email || company?.phone) {
      contactSection = `
        <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #111827;">Contact Us</h3>
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            ${company.email ? `Email: ${company.email}` : ''}
            ${company.email && company.phone ? ' | ' : ''}
            ${company.phone ? `Phone: ${company.phone}` : ''}
          </p>
        </div>
      `
    }

    // Send confirmation email to ALL tenants
    for (const tenant of tenancy.tenancy_tenants || []) {
      const tenantEmail = decrypt(tenant.tenant_email_encrypted)
      if (!tenantEmail) continue // Skip tenants without email

      const tenantName = decrypt(tenant.tenant_name_encrypted) || 'Tenant'

      const html = loadEmailTemplate('rent-due-date-change-confirmed', {
        TenantName: tenantName,
        PropertyAddress: propertyAddress,
        PreviousDueDay: `${change.current_due_day}${getDaySuffix(change.current_due_day)} of each month`,
        NewDueDay: `${change.new_due_day}${getDaySuffix(change.new_due_day)} of each month`,
        EffectiveDate: effectiveDate,
        ProRataAmount: parseFloat(change.pro_rata_amount).toFixed(2),
        AdminFeeRow: adminFeeRow,
        TotalAmount: parseFloat(change.total_amount).toFixed(2),
        PaymentConfirmedDate: paymentReceivedDate,
        MonthlyRent: parseFloat(change.monthly_rent).toFixed(2),
        NextRentDueDate: nextRentDueDateStr,
        CompanyName: company?.name || 'PropertyGoose',
        AgentLogoUrl: company?.logo_url || 'https://app.propertygoose.co.uk/PropertyGooseLogo.png',
        ContactSection: contactSection
      })

      await sendEmail({
        to: tenantEmail,
        subject: `${company?.name || 'PropertyGoose'} - Rent Due Date Changed - ${propertyAddress}`,
        html
      })
    }

    // Log activity
    try {
      console.log('[activate] Logging activity for tenancy:', req.params.id)
      await tenancyService.logTenancyActivity(req.params.id, {
        action: 'RENT_DUE_DATE_CHANGE_ACTIVATED',
        category: 'financial',
        title: 'Rent due date changed',
        description: `Rent due date changed from ${change.current_due_day}${getDaySuffix(change.current_due_day)} to ${change.new_due_day}${getDaySuffix(change.new_due_day)}. Payment of £${parseFloat(change.total_amount).toFixed(2)} confirmed.`,
        performedBy: userId,
        metadata: {
          changeId: change.id,
          previousDueDay: change.current_due_day,
          newDueDay: change.new_due_day,
          totalAmount: parseFloat(change.total_amount),
          noticeDocumentId
        }
      })
      console.log('[activate] Activity logged successfully')
    } catch (activityError) {
      console.error('[activate] Failed to log activity:', activityError)
    }

    // Receipt the expected payment for this rent change
    try {
      const { receiptExpectedPayment } = await import('../services/rentgooseService')

      const { data: ep } = await supabase
        .from('expected_payments')
        .select('id')
        .eq('company_id', companyId)
        .eq('source_type', 'rent_due_date_change')
        .eq('source_id', req.params.changeId)
        .in('status', ['pending', 'due'])
        .limit(1)
        .single()

      if (ep) {
        await receiptExpectedPayment(companyId, {
          expected_payment_id: ep.id,
          amount: parseFloat(change.total_amount),
          payment_method: 'bank_transfer',
          payment_reference: paymentReference || undefined,
          date_received: new Date().toISOString().split('T')[0],
          receipted_by: userId,
        })
      }
    } catch (epError) {
      console.error('[RentGoose] Failed to receipt rent change expected payment:', epError)
    }

    console.log('[activate] Returning success. Document ID:', noticeDocumentId)
    res.json({ success: true, newDueDay: change.new_due_day, noticeDocumentId })
  } catch (error: any) {
    console.error('Error activating rent due date change:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/tenancies/records/:id/rent-due-date-change/:changeId/cancel
 * Cancel a pending rent due date change
 */
router.post('/records/:id/rent-due-date-change/:changeId/cancel', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { reason } = req.body

    // Verify tenancy belongs to company first
    const { data: tenancy, error: tenancyError } = await supabase
      .from('tenancies')
      .select('id')
      .eq('id', req.params.id)
      .eq('company_id', companyId)
      .single()

    if (tenancyError || !tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    // Get the change record
    const { data: change, error: changeError } = await supabase
      .from('rent_due_date_changes')
      .select('*')
      .eq('id', req.params.changeId)
      .eq('tenancy_id', req.params.id)
      .single()

    if (changeError || !change) {
      return res.status(404).json({ error: 'Rent due date change not found' })
    }

    if (!['pending_payment', 'payment_confirmed'].includes(change.status)) {
      return res.status(400).json({ error: 'Cannot cancel a change that has already been activated or cancelled' })
    }

    // Update to cancelled
    const { error: updateError } = await supabase
      .from('rent_due_date_changes')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: userId,
        cancelled_reason: reason || null
      })
      .eq('id', req.params.changeId)

    if (updateError) {
      console.error('Error cancelling change:', updateError)
      return res.status(500).json({ error: 'Failed to cancel change' })
    }

    // Log activity
    await tenancyService.logTenancyActivity(req.params.id, {
      action: 'RENT_DUE_DATE_CHANGE_CANCELLED',
      category: 'financial',
      title: 'Rent due date change cancelled',
      description: `Change from ${change.current_due_day}${getDaySuffix(change.current_due_day)} to ${change.new_due_day}${getDaySuffix(change.new_due_day)} was cancelled.${reason ? ` Reason: ${reason}` : ''}`,
      performedBy: userId,
      metadata: {
        changeId: change.id,
        reason
      }
    })

    res.json({ success: true })
  } catch (error: any) {
    console.error('Error cancelling rent due date change:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/tenancies/records/:id/rent-due-date-change/:changeId/resend
 * Resend the payment request email
 */
router.post('/records/:id/rent-due-date-change/:changeId/resend', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Get the change record with tenancy details
    const { data: change, error: changeError } = await supabase
      .from('rent_due_date_changes')
      .select('*')
      .eq('id', req.params.changeId)
      .eq('tenancy_id', req.params.id)
      .single()

    if (changeError || !change) {
      return res.status(404).json({ error: 'Rent due date change not found' })
    }

    if (change.status !== 'pending_payment') {
      return res.status(400).json({ error: 'Can only resend email for pending payment changes' })
    }

    // Get tenancy with tenants
    const { data: tenancy, error: tenancyError } = await supabase
      .from('tenancies')
      .select(`
        id,
        company_id,
        properties (
          address_line1_encrypted,
          city_encrypted,
          postcode
        ),
        tenancy_tenants (
          id,
          tenant_order,
          tenant_name_encrypted,
          tenant_email_encrypted
        )
      `)
      .eq('id', req.params.id)
      .eq('company_id', companyId)
      .single()

    if (tenancyError || !tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    // Lead tenant is tenant_order === 1
    const leadTenant = tenancy.tenancy_tenants?.find((t: any) => t.tenant_order === 1)
    if (!leadTenant) {
      return res.status(400).json({ error: 'No lead tenant found' })
    }

    const leadTenantEmail = decrypt(leadTenant.tenant_email_encrypted)
    const leadTenantName = decrypt(leadTenant.tenant_name_encrypted) || 'Tenant'

    if (!leadTenantEmail) {
      return res.status(400).json({ error: 'Lead tenant email not found' })
    }

    // Get company details
    const { data: companyRaw } = await supabase
      .from('companies')
      .select('name_encrypted, logo_url, bank_account_name, bank_account_number, bank_sort_code, email_encrypted, phone_encrypted')
      .eq('id', tenancy.company_id)
      .single()

    // Decrypt company fields
    const company = companyRaw ? {
      name: decrypt(companyRaw.name_encrypted) || 'PropertyGoose',
      logo_url: companyRaw.logo_url,
      email: decrypt(companyRaw.email_encrypted) || undefined,
      phone: decrypt(companyRaw.phone_encrypted) || undefined,
      bank_account_name: companyRaw.bank_account_name,
      bank_account_number: companyRaw.bank_account_number,
      bank_sort_code: companyRaw.bank_sort_code
    } : null

    const tenancyProperty = tenancy.properties as any
    const propertyAddress = [
      tenancyProperty?.address_line1_encrypted ? decrypt(tenancyProperty.address_line1_encrypted) : null,
      tenancyProperty?.city_encrypted ? decrypt(tenancyProperty.city_encrypted) : null,
      tenancyProperty?.postcode
    ].filter(Boolean).join(', ')

    const frontendUrl = getFrontendUrl()
    const confirmationUrl = `${frontendUrl}/confirm-rent-change/${change.confirmation_token}`

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const effectiveDate = `${change.new_due_day}${getDaySuffix(change.new_due_day)} ${monthNames[change.effective_month - 1]} ${change.effective_year}`

    let adminFeeRow = ''
    if (change.admin_fee > 0) {
      adminFeeRow = `
        <tr>
          <td style="padding: 8px 0; font-size: 14px; color: #78350f;">Administration fee:</td>
          <td style="padding: 8px 0; font-size: 14px; color: #92400e; font-weight: 600; text-align: right;">£${parseFloat(change.admin_fee).toFixed(2)}</td>
        </tr>
      `
    }

    let contactSection = ''
    if (company?.email || company?.phone) {
      contactSection = `
        <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #111827;">Contact Us</h3>
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            ${company.email ? `Email: ${company.email}` : ''}
            ${company.email && company.phone ? ' | ' : ''}
            ${company.phone ? `Phone: ${company.phone}` : ''}
          </p>
        </div>
      `
    }

    const { loadEmailTemplate, sendEmail } = await import('../services/emailService')

    const html = loadEmailTemplate('rent-due-date-change-request', {
      TenantName: leadTenantName,
      PropertyAddress: propertyAddress,
      CurrentDueDay: `${change.current_due_day}${getDaySuffix(change.current_due_day)} of each month`,
      NewDueDay: `${change.new_due_day}${getDaySuffix(change.new_due_day)} of each month`,
      EffectiveDate: effectiveDate,
      MonthlyRent: parseFloat(change.monthly_rent).toFixed(2),
      DailyRate: parseFloat(change.daily_rate).toFixed(2),
      ProRataDays: change.pro_rata_days.toString(),
      ProRataAmount: parseFloat(change.pro_rata_amount).toFixed(2),
      AdminFeeRow: adminFeeRow,
      TotalAmount: parseFloat(change.total_amount).toFixed(2),
      BankAccountName: company?.bank_account_name || '',
      BankSortCode: company?.bank_sort_code || '',
      BankAccountNumber: company?.bank_account_number || '',
      PaymentReference: `RDC-${change.id.slice(0, 8).toUpperCase()}`,
      ConfirmationUrl: confirmationUrl,
      CompanyName: company?.name || 'PropertyGoose',
      AgentLogoUrl: company?.logo_url || 'https://app.propertygoose.co.uk/PropertyGooseLogo.png',
      ContactSection: contactSection
    })

    await sendEmail({
      to: leadTenantEmail,
      subject: `${company?.name || 'PropertyGoose'} - Reminder: Rent Due Date Change Request - ${propertyAddress}`,
      html
    })

    // Update reminder_sent_at
    await supabase
      .from('rent_due_date_changes')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', req.params.changeId)

    // Log activity
    await tenancyService.logTenancyActivity(req.params.id, {
      action: 'RENT_DUE_DATE_CHANGE_REMINDER_SENT',
      category: 'financial',
      title: 'Payment reminder sent',
      description: `Reminder sent for rent due date change (£${parseFloat(change.total_amount).toFixed(2)})`,
      performedBy: userId
    })

    res.json({ success: true })
  } catch (error: any) {
    console.error('Error resending rent due date change email:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Helper function to get ordinal suffix for a day
 */
function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th'
  switch (day % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

// ============================================================================
// RENT INCREASE NOTICE (Section 13)
// ============================================================================

/**
 * POST /api/tenancies/records/:id/rent-increase-notice
 * Serve a Section 13 rent increase notice (Form 4)
 */
router.post('/records/:id/rent-increase-notice', authenticateToken, async (req: AuthRequest, res) => {
  console.log('\n========== SECTION 13 NOTICE REQUEST ==========')
  console.log('[S13] tenancyId:', req.params.id)
  console.log('[S13] deliveryMethod:', req.body.deliveryMethod)
  console.log('[S13] newRent:', req.body.newRent)
  console.log('================================================\n')
  try {
    const companyId = await getCompanyIdForRequest(req)
    const userId = req.user?.id
    console.log('[S13] companyId:', companyId, 'userId:', userId)
    if (!companyId) {
      console.log('[rent-increase-notice] No company found for user')
      return res.status(404).json({ error: 'Company not found' })
    }

    const {
      newRent,
      rentFrequency = 'monthly',
      effectiveDate,
      deliveryMethod,
      previousS13Date,
      isFirstS13,
      charges,
      signature,
      signatureMethod,
      signatoryName
    } = req.body

    if (!newRent || !effectiveDate) {
      return res.status(400).json({ error: 'New rent and effective date are required' })
    }

    // Simple fetch by ID only
    const { data: tenancy, error: tenancyError } = await supabase
      .from('tenancies')
      .select('*, properties(*)')
      .eq('id', req.params.id)
      .single()

    if (tenancyError || !tenancy) {
      console.error('[rent-increase-notice] Tenancy lookup failed:', tenancyError)
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    // Get all tenants for this tenancy
    // Note: tenancy_tenants uses is_active (boolean), not status
    // Column is tenant_email_encrypted NOT email_encrypted
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenancy_tenants')
      .select('id, tenant_name_encrypted, tenant_email_encrypted, tenant_order')
      .eq('tenancy_id', req.params.id)
      .eq('is_active', true)
      .order('tenant_order', { ascending: true })

    console.log('[S13] Tenants query result:', tenants?.length, 'error:', tenantsError?.message)

    const tenantNames = tenants?.map(t => {
      const name = decrypt(t.tenant_name_encrypted) || ''
      return name.trim()
    }).filter(Boolean).join(', ') || 'Tenant'
    const leadTenant = tenants?.find(t => t.tenant_order === 1) || tenants?.[0]
    const leadTenantEmail = leadTenant ? decrypt(leadTenant.tenant_email_encrypted) : null

    console.log('[S13] Lead tenant email:', leadTenantEmail || 'NULL/EMPTY')

    // Get company details from the TENANCY's company (not user's active branch)
    // This ensures emails show the correct company for multi-branch users
    const tenancyCompanyId = tenancy.company_id || companyId
    const { data: companyRaw } = await supabase
      .from('companies')
      .select('name_encrypted, email_encrypted, phone_encrypted, address_encrypted, city_encrypted, postcode_encrypted, logo_url')
      .eq('id', tenancyCompanyId)
      .single()

    // Decrypt company data
    const company = companyRaw ? {
      name: decrypt(companyRaw.name_encrypted) || 'Property Management',
      email: decrypt(companyRaw.email_encrypted) || '',
      phone: decrypt(companyRaw.phone_encrypted) || '',
      address: decrypt(companyRaw.address_encrypted) || '',
      city: decrypt(companyRaw.city_encrypted) || '',
      postcode: decrypt(companyRaw.postcode_encrypted) || '',
      logo_url: companyRaw.logo_url || undefined
    } : null

    // Get landlord details - first try tenancy_landlords, then fall back to property_landlords
    let landlordName = 'The Landlord'
    let landlordAddress = ''

    // Try tenancy_landlords first
    const { data: tenancyLandlords } = await supabase
      .from('tenancy_landlords')
      .select('landlord_name_encrypted, address_line1_encrypted, city_encrypted, postcode_encrypted')
      .eq('tenancy_id', req.params.id)
      .limit(1)

    const tenancyLandlord = tenancyLandlords?.[0]
    if (tenancyLandlord && tenancyLandlord.landlord_name_encrypted) {
      landlordName = decrypt(tenancyLandlord.landlord_name_encrypted) || 'The Landlord'
      landlordAddress = [
        decrypt(tenancyLandlord.address_line1_encrypted),
        decrypt(tenancyLandlord.city_encrypted),
        tenancyLandlord.postcode_encrypted ? decrypt(tenancyLandlord.postcode_encrypted) : ''
      ].filter(Boolean).join(', ')
    } else {
      // Fall back to property landlords
      const propertyId = tenancy.property_id
      if (propertyId) {
        const { data: propertyLandlords } = await supabase
          .from('property_landlords')
          .select(`
            is_primary_contact,
            landlords (
              id,
              first_name_encrypted,
              last_name_encrypted,
              address_line1_encrypted,
              city_encrypted,
              postcode_encrypted
            )
          `)
          .eq('property_id', propertyId)
          .order('is_primary_contact', { ascending: false })
          .limit(1)

        const primaryLandlord = propertyLandlords?.[0]?.landlords as any
        if (primaryLandlord) {
          const firstName = decrypt(primaryLandlord.first_name_encrypted) || ''
          const lastName = decrypt(primaryLandlord.last_name_encrypted) || ''
          landlordName = `${firstName} ${lastName}`.trim() || 'The Landlord'
          landlordAddress = [
            decrypt(primaryLandlord.address_line1_encrypted),
            decrypt(primaryLandlord.city_encrypted),
            primaryLandlord.postcode_encrypted ? decrypt(primaryLandlord.postcode_encrypted) : ''
          ].filter(Boolean).join(', ')
        }
      }
    }

    const rentProperty = tenancy.properties as any
    const propertyAddress = rentProperty
      ? `${decrypt(rentProperty.address_line1_encrypted) || ''}, ${decrypt(rentProperty.city_encrypted) || ''} ${rentProperty.postcode || ''}`.trim()
      : 'Property'

    const currentRentAmount = (tenancy as any).monthly_rent || (tenancy as any).rent_amount || 0
    const noticeDate = new Date().toISOString().split('T')[0]

    // Calculate anchor date: previous S13 date if exists, otherwise tenancy start date
    const tenancyStartDate = (tenancy as any).start_date || (tenancy as any).tenancy_start_date || effectiveDate
    const anchorDate = previousS13Date || tenancyStartDate

    // Generate document reference
    const documentRef = `${Date.now().toString(36).toUpperCase()}-${req.params.id.substring(0, 8).toUpperCase()}`

    // Import PDF generation service
    const { pdfGenerationService } = await import('../services/pdfGenerationService')

    // Generate the Form 4 PDF
    console.log('[rent-increase-notice] Generating Form 4 PDF...')
    const pdfBuffer = await pdfGenerationService.generateSection13Notice({
      tenantNames,
      propertyAddress,
      currentRent: currentRentAmount,
      newRent,
      rentFrequency,
      effectiveDate,
      noticeDate,
      anchorDate,
      charges: charges || {
        councilTax: { existing: '', proposed: '' },
        water: { existing: '', proposed: '' },
        serviceCharges: { existing: '', proposed: '' }
      },
      landlordName: landlordName || 'The Landlord',
      landlordAddress: landlordAddress || '',
      agentName: company?.name || 'Property Management',
      agentAddress: company ? [company.address, company.city, company.postcode].filter(Boolean).join(', ') : '',
      agentEmail: company?.email || '',
      agentPhone: company?.phone || '',
      agentLogoUrl: company?.logo_url || undefined,
      signature: signature || '',
      signatureMethod: signatureMethod || 'type',
      signerName: signatoryName
        ? `${signatoryName}${company?.name ? ', ' + company.name : ''}`
        : (company?.name || 'Agent'),
      documentRef
    })
    console.log('[rent-increase-notice] PDF generated:', pdfBuffer.length, 'bytes')

    // Upload PDF to Supabase storage (property-documents bucket)
    const pdfFilename = `section-13-${documentRef}.pdf`
    const storagePath = `notices/${req.params.id}/${pdfFilename}`

    console.log('[rent-increase-notice] Uploading PDF to storage. Path:', storagePath, 'Size:', pdfBuffer.length)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('property-documents')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      })

    if (uploadError) {
      console.error('[rent-increase-notice] PDF upload failed:', JSON.stringify(uploadError))
      // Continue without storage - we still have the buffer for email
    } else {
      console.log('[rent-increase-notice] PDF upload success:', uploadData?.path)
    }

    // Get signed URL for the PDF (property-documents is private)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('property-documents')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365) // 1 year signed URL

    if (signedUrlError) {
      console.error('[rent-increase-notice] Signed URL generation failed:', JSON.stringify(signedUrlError))
    }

    const pdfPublicUrl = signedUrlData?.signedUrl || null
    console.log('[rent-increase-notice] PDF URL:', pdfPublicUrl ? 'generated successfully' : 'FAILED - no URL')

    // Create property_documents record (requires property_id AND successful upload)
    // Store the storage path, not signed URL - signed URLs expire
    let documentId: string | undefined
    const propertyId = (tenancy as any).property_id || rentProperty?.id
    console.log('[rent-increase-notice] Document creation check - propertyId:', propertyId, 'uploadError:', !!uploadError)

    if (propertyId && !uploadError) {
      // Store the raw storage path - download endpoint will handle generating signed URLs
      console.log('[rent-increase-notice] Creating property_documents record. propertyId:', propertyId, 'storagePath:', storagePath)
      const { data: docRecord, error: docError } = await supabase
        .from('property_documents')
        .insert({
          property_id: propertyId,
          file_name: pdfFilename,
          file_path: storagePath,  // Store storage path, not signed URL
          file_size: pdfBuffer.length,
          file_type: 'application/pdf',
          tag: 'rent_notice',
          source_type: 'tenancy',
          source_id: req.params.id, // tenancy ID - links to tenancy drawer docs tab
          description: `Section 13 Rent Increase Notice - £${currentRentAmount || 0} to £${newRent}`,
          uploaded_by: userId
        })
        .select('id')
        .single()

      if (docError) {
        console.error('[rent-increase-notice] Document record creation failed:', JSON.stringify(docError))
      } else {
        documentId = docRecord?.id
        console.log('[rent-increase-notice] Document record created:', documentId)
      }
    } else {
      if (!propertyId) {
        console.error('[rent-increase-notice] Cannot create document record - no propertyId')
      } else {
        console.error('[rent-increase-notice] Cannot create document record - upload failed:', uploadError?.message)
      }
    }

    // Store the rent increase notice
    const { data: notice, error: noticeError } = await supabase
      .from('rent_increase_notices')
      .insert({
        tenancy_id: req.params.id,
        company_id: companyId,
        current_rent: currentRentAmount,
        new_rent: newRent,
        effective_date: effectiveDate,
        notice_date: noticeDate,
        delivery_method: deliveryMethod,
        status: 'served',
        document_id: documentId || null,
        created_by: userId
      })
      .select()
      .single()

    if (noticeError) {
      console.error('Error creating rent increase notice:', noticeError)
      return res.status(500).json({ error: 'Failed to create notice record' })
    }

    // Track email sending status
    let tenantEmailSent = false
    let agentEmailSent = false

    // If email delivery, the email MUST be sent - this is a legal requirement
    if (deliveryMethod === 'email') {
      console.log('[rent-increase-notice] Email delivery selected, email is MANDATORY')
      console.log('[rent-increase-notice] leadTenantEmail:', leadTenantEmail ? 'present' : 'MISSING')

      // Validate we have an email address BEFORE proceeding
      if (!leadTenantEmail) {
        console.error('[rent-increase-notice] CRITICAL: No lead tenant email found for email delivery')
        // Rollback the notice record since email cannot be sent
        await supabase.from('rent_increase_notices').delete().eq('id', notice.id)
        return res.status(400).json({
          error: 'Cannot send Section 13 notice by email: No email address found for the lead tenant. Please add a tenant email or select a different delivery method.'
        })
      }

      console.log('[rent-increase-notice] Attempting to send email to:', leadTenantEmail)
      try {
        const effectiveDateFormatted = new Date(effectiveDate).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', year: 'numeric'
        })

        console.log('[rent-increase-notice] Calling sendCustomTenantEmail with PDF attachment size:', pdfBuffer.length)
        await emailService.sendCustomTenantEmail({
          to: leadTenantEmail,
          subject: `${company?.name || 'PropertyGoose'} - Section 13 Rent Increase Notice - ${propertyAddress}`,
          message: `Dear ${tenantNames},

Please find attached your formal Section 13 Rent Increase Notice (Form 4) under the Housing Act 1988.

This notice proposes a new rent of £${newRent.toLocaleString()} ${rentFrequency === 'weekly' ? 'per week' : rentFrequency === 'yearly' ? 'per year' : 'per month'}, to take effect from ${effectiveDateFormatted}.

IMPORTANT: If you wish to refer this rent increase to a First-tier Tribunal (Property Chamber), you must do so BEFORE the proposed start date. The Tribunal may set a rent that is higher, lower, or the same as the proposed amount.

For more information about your rights, visit www.gov.uk/private-renting or contact Citizens Advice.

If you have any questions about this notice, please do not hesitate to contact us.

Kind regards,
${company?.name || 'PropertyGoose'}`,
          replyTo: company?.email,
          attachments: [{
            filename: `Section_13_Notice_${propertyAddress.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
            content: pdfBuffer
          }]
        })

        // Update notice as delivered
        await supabase
          .from('rent_increase_notices')
          .update({ delivered_at: new Date().toISOString() })
          .eq('id', notice.id)

        tenantEmailSent = true
        console.log('[rent-increase-notice] ✓ Email with PDF sent successfully to:', leadTenantEmail)
      } catch (emailError: any) {
        // EMAIL FAILED - This is a critical failure, rollback and fail the request
        console.error('[rent-increase-notice] CRITICAL: Failed to send S13 email:', emailError?.message || emailError)
        console.error('[rent-increase-notice] Full email error:', JSON.stringify(emailError, null, 2))

        // Rollback: Delete the notice record since email failed
        await supabase.from('rent_increase_notices').delete().eq('id', notice.id)

        // Return clear error to user
        return res.status(500).json({
          error: `Failed to send Section 13 notice email to tenant. The notice has NOT been served. Error: ${emailError?.message || 'Email service error'}. Please try again or contact support.`
        })
      }
    } else {
      console.log('[rent-increase-notice] Non-email delivery method:', deliveryMethod)
    }

    // Send confirmation email to agent (always, regardless of delivery method)
    if (company?.email) {
      try {
        const effectiveDateFormatted = new Date(effectiveDate).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', year: 'numeric'
        })
        const noticeDateFormatted = new Date(noticeDate).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', year: 'numeric'
        })

        await emailService.sendEmail({
          to: company.email,
          subject: `Section 13 Notice Served - ${propertyAddress}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #f97316; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">Section 13 Notice Served</h1>
              </div>
              <div style="padding: 24px; background: #ffffff;">
                <p style="margin: 0 0 16px; color: #374151;">A Section 13 Rent Increase Notice has been served for:</p>

                <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                  <p style="margin: 0 0 8px;"><strong>Property:</strong> ${propertyAddress}</p>
                  <p style="margin: 0 0 8px;"><strong>Tenant(s):</strong> ${tenantNames}</p>
                  <p style="margin: 0 0 8px;"><strong>Current Rent:</strong> £${currentRentAmount?.toLocaleString() || 0}</p>
                  <p style="margin: 0 0 8px;"><strong>New Rent:</strong> £${newRent.toLocaleString()}</p>
                  <p style="margin: 0 0 8px;"><strong>Effective Date:</strong> ${effectiveDateFormatted}</p>
                  <p style="margin: 0;"><strong>Notice Date:</strong> ${noticeDateFormatted}</p>
                </div>

                <div style="background: ${tenantEmailSent ? '#dcfce7' : '#fef3c7'}; padding: 12px 16px; border-radius: 6px; margin-bottom: 16px;">
                  <p style="margin: 0; color: ${tenantEmailSent ? '#166534' : '#92400e'}; font-size: 14px;">
                    <strong>${deliveryMethod === 'email' ? '✓ Tenant email sent successfully' : 'Notice delivered via: ' + deliveryMethod}</strong>
                  </p>
                </div>

                <p style="margin: 0; color: #6b7280; font-size: 14px;">
                  The notice document has been saved to the property documents. ${documentId ? `Document ID: ${documentId}` : ''}
                </p>
              </div>
              <div style="padding: 16px 24px; background: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                <p style="margin: 0; color: #9ca3af; font-size: 12px;">This is an automated notification from PropertyGoose</p>
              </div>
            </div>
          `
        })
        agentEmailSent = true
        console.log('[rent-increase-notice] ✓ Agent notification sent to:', company.email)
      } catch (agentError: any) {
        // Agent notification failure is not critical - log but don't fail
        console.error('[rent-increase-notice] Failed to send agent notification (non-critical):', agentError?.message || agentError)
      }
    } else {
      console.log('[rent-increase-notice] No agent email configured, skipping agent notification')
    }

    // Log activity - format date for UK display
    const effectiveDateForActivity = new Date(effectiveDate).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    })
    await tenancyService.logTenancyActivity(req.params.id, {
      action: 'RENT_INCREASE_NOTICE_SERVED',
      category: 'financial',
      title: 'Rent Increase Notice Served',
      description: `Section 13 notice served: £${currentRentAmount || 0} → £${newRent} (effective ${effectiveDateForActivity})`,
      metadata: {
        noticeId: notice.id,
        documentId,
        currentRent: currentRentAmount,
        newRent,
        rentFrequency,
        effectiveDate,
        deliveryMethod,
        previousS13Date,
        isFirstS13
      },
      performedBy: userId
    })

    console.log('[rent-increase-notice] Completed. noticeId:', notice.id, 'documentId:', documentId, 'pdfUrl:', pdfPublicUrl ? 'yes' : 'no')

    // Build response - if we get here, tenant email was successful (or not required)
    res.json({
      success: true,
      noticeId: notice.id,
      documentId,
      pdfUrl: pdfPublicUrl || (deliveryMethod === 'download' ? `/api/tenancies/rent-increase-notices/${notice.id}/pdf` : undefined),
      tenantEmailSent: deliveryMethod === 'email' ? tenantEmailSent : null,
      agentEmailSent,
      deliveryMethod
    })
  } catch (error: any) {
    console.error('[rent-increase-notice] FATAL ERROR:', error.message, error.stack)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/tenancies/records/:id/rent-increase-notices
 * Get all rent increase notices for a tenancy
 */
router.get('/records/:id/rent-increase-notices', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { data: notices, error } = await supabase
      .from('rent_increase_notices')
      .select('*, document:property_documents(id, file_path, file_name)')
      .eq('tenancy_id', req.params.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[rent-increase-notices] Error fetching:', error)
      return res.status(500).json({ error: 'Failed to fetch notices' })
    }

    // Check for pending rent increase (served but not yet effective)
    const today = new Date().toISOString().split('T')[0]
    const pendingNotice = notices?.find((n: any) =>
      n.status === 'served' && n.effective_date > today
    )

    res.json({
      notices: notices || [],
      pendingIncrease: pendingNotice ? {
        noticeId: pendingNotice.id,
        newRent: pendingNotice.new_rent,
        effectiveDate: pendingNotice.effective_date,
        currentRent: pendingNotice.current_rent
      } : null
    })
  } catch (error: any) {
    console.error('Error fetching rent increase notices:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/tenancies/rent-increase-notices/:noticeId/pdf
 * Download the PDF for a specific rent increase notice
 */
router.get('/rent-increase-notices/:noticeId/pdf', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { noticeId } = req.params
    const companyId = await getCompanyIdForRequest(req)

    if (!companyId) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    // Get the notice with document reference
    const { data: notice, error: noticeError } = await supabase
      .from('rent_increase_notices')
      .select('*, document:property_documents(id, file_path, file_name)')
      .eq('id', noticeId)
      .eq('company_id', companyId)
      .single()

    if (noticeError || !notice) {
      return res.status(404).json({ error: 'Notice not found' })
    }

    // If there's a stored document, redirect to its URL
    if (notice.document?.file_path) {
      return res.redirect(notice.document.file_path)
    }

    // No stored document - return error
    return res.status(404).json({ error: 'PDF document not found for this notice' })
  } catch (error: any) {
    console.error('Error downloading rent increase notice PDF:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/tenancies/records/:id/section-8-notice
 * Serve a Section 8 notice (Housing Act 1988) seeking possession
 */
router.post('/records/:id/section-8-notice', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id: tenancyId } = req.params
    const userId = req.user?.id
    const companyId = await getCompanyIdForRequest(req)

    if (!companyId) {
      return res.status(403).json({ error: 'Company not found' })
    }

    // Get tenancy with property and tenants
    const { data: tenancy, error: tenancyError } = await supabase
      .from('tenancies')
      .select(`
        *,
        property:properties!tenancies_property_id_fkey(
          id, address_line1, address_line2, city, postcode, company_id
        ),
        tenants:tenancy_tenants(
          id, first_name, last_name, email, is_lead_tenant, status
        )
      `)
      .eq('id', tenancyId)
      .single()

    if (tenancyError || !tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' })
    }

    // Verify company ownership
    if (tenancy.property?.company_id !== companyId) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    // Only allow for active tenancies
    if (tenancy.status !== 'active' && tenancy.status !== 'notice_given') {
      return res.status(400).json({ error: 'Section 8 can only be served on active tenancies' })
    }

    const {
      grounds,           // Array of ground numbers (e.g., [8, 10])
      groundDetails,     // Details for each ground (e.g., { 8: "£2000 arrears", 10: "History of late payment" })
      hearingDate,       // Optional court hearing date if already scheduled
      deliveryMethod,    // 'email' | 'download'
      additionalNotes    // Free text for agent notes
    } = req.body

    if (!grounds || !Array.isArray(grounds) || grounds.length === 0) {
      return res.status(400).json({ error: 'At least one ground must be specified' })
    }

    // Valid Section 8 grounds (Housing Act 1988)
    const validGrounds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 14.1, 15, 16, 17]
    for (const ground of grounds) {
      if (!validGrounds.includes(ground)) {
        return res.status(400).json({ error: `Invalid ground: ${ground}` })
      }
    }

    // Calculate minimum notice period based on grounds
    // Grounds 1, 2, 5, 6, 7, 9, 16 require 2 months
    // Grounds 3, 4, 8, 10, 11, 12, 13, 14, 15, 17 require 2 weeks
    const twoMonthGrounds = [1, 2, 5, 6, 7, 9, 16]
    const requiresTwoMonths = grounds.some((g: number) => twoMonthGrounds.includes(g))

    const noticeDate = new Date()
    const earliestCourtDate = new Date(noticeDate)
    if (requiresTwoMonths) {
      earliestCourtDate.setMonth(earliestCourtDate.getMonth() + 2)
    } else {
      earliestCourtDate.setDate(earliestCourtDate.getDate() + 14)
    }

    // Prepare ground descriptions for email/PDF
    const groundDescriptions: Record<number, string> = {
      1: 'Owner-occupier seeking possession',
      2: 'Mortgagee seeking possession',
      3: 'Holiday let out of season',
      4: 'Student accommodation out of term',
      5: 'Minister of religion accommodation',
      6: 'Demolition or reconstruction',
      7: 'Death of previous tenant',
      8: 'Serious rent arrears (at least 2 months)',
      9: 'Suitable alternative accommodation available',
      10: 'Some rent arrears',
      11: 'Persistent delay in paying rent',
      12: 'Breach of tenancy agreement',
      13: 'Waste or neglect causing deterioration',
      14: 'Nuisance or annoyance',
      14.1: 'Anti-social behaviour',
      15: 'Damage to furniture',
      16: 'Employee accommodation',
      17: 'False statement to obtain tenancy'
    }

    // Get lead tenant for email
    const activeTenants = tenancy.tenants?.filter((t: any) => t.status === 'active') || []
    const leadTenant = activeTenants.find((t: any) => t.is_lead_tenant) || activeTenants[0]

    // Get company branding from the TENANCY's company for correct branding
    const tenancyCompanyId = tenancy.company_id || companyId
    const { data: company } = await supabase
      .from('companies')
      .select('name, branding')
      .eq('id', tenancyCompanyId)
      .single()

    // Record the notice
    const { data: notice, error: noticeError } = await supabase
      .from('section_notices')
      .insert({
        tenancy_id: tenancyId,
        notice_type: 'section_8',
        grounds: grounds,
        ground_details: groundDetails || {},
        notice_date: noticeDate.toISOString().split('T')[0],
        earliest_court_date: earliestCourtDate.toISOString().split('T')[0],
        hearing_date: hearingDate || null,
        delivery_method: deliveryMethod,
        additional_notes: additionalNotes || null,
        served_by: userId,
        status: 'served'
      })
      .select()
      .single()

    if (noticeError) {
      console.error('Error creating Section 8 notice:', noticeError)
      throw new Error('Failed to record Section 8 notice')
    }

    // Update tenancy status to notice_given
    await supabase
      .from('tenancies')
      .update({
        status: 'notice_given',
        notice_served_at: noticeDate.toISOString(),
        notice_type: 'section_8'
      })
      .eq('id', tenancyId)

    // Build property address
    const propertyAddress = [
      tenancy.property?.address_line1,
      tenancy.property?.address_line2,
      tenancy.property?.city,
      tenancy.property?.postcode
    ].filter(Boolean).join(', ')

    // Build grounds list for email
    const groundsList = grounds.map((g: number) => ({
      number: g,
      title: groundDescriptions[g] || `Ground ${g}`,
      details: groundDetails?.[g] || ''
    }))

    // Send email notification if method is email
    if (deliveryMethod === 'email' && leadTenant?.email) {
      try {
        await emailService.sendSection8Notice({
          to: leadTenant.email,
          tenantName: `${leadTenant.first_name} ${leadTenant.last_name}`,
          propertyAddress,
          grounds: groundsList,
          noticeDate: noticeDate.toISOString().split('T')[0],
          earliestCourtDate: earliestCourtDate.toISOString().split('T')[0],
          companyName: company?.name || 'Property Manager',
          branding: company?.branding
        })
      } catch (emailError) {
        console.error('Error sending Section 8 email:', emailError)
        // Don't fail the request, notice is still recorded
      }
    }

    // Log activity - format dates for UK display
    const earliestCourtDateFormatted = earliestCourtDate.toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    })
    await tenancyService.logTenancyActivity(tenancyId, {
      action: 'SECTION_8_SERVED',
      category: 'notices',
      title: 'Section 8 Notice Served',
      description: `Section 8 notice served citing grounds: ${grounds.join(', ')}. Earliest court date: ${earliestCourtDateFormatted}`,
      metadata: {
        notice_id: notice.id,
        grounds,
        delivery_method: deliveryMethod,
        notice_date: noticeDate.toISOString().split('T')[0],
        earliest_court_date: earliestCourtDate.toISOString().split('T')[0]
      },
      performedBy: userId || undefined
    })

    res.json({
      success: true,
      noticeId: notice.id,
      earliestCourtDate: earliestCourtDate.toISOString().split('T')[0],
      requiresTwoMonths,
      pdfUrl: deliveryMethod === 'download' ? `/api/tenancies/section-8-notices/${notice.id}/pdf` : undefined
    })
  } catch (error: any) {
    console.error('Error serving Section 8 notice:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router

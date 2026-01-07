import { Router } from 'express'
import { authenticateToken, AuthRequest, getCompanyIdForRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import { decrypt } from '../services/encryption'
import {
  Tenancy,
  TenancyPerson,
  TenancyStatus,
  StatusCounts,
  deriveTenancyStatus,
  generateBlockingSentence,
  calculateProgressSummary,
  buildTenancyPerson,
  // Batch functions for performance
  batchGetVerificationSections,
  batchGetChaseDependencies,
  batchGetReasonCodeLabels,
  buildTenancyPersonSync,
  generateBlockingSentenceSync
} from '../services/tenancyStatusService'

const router = Router()

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
        id_document_path,
        selfie_path,
        tax_return_path,
        payslip_files,
        proof_of_additional_income_path,
        benefits_annual_amount_encrypted,
        confirmed_residential_status,
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

    // Fetch all data in parallel (4 queries instead of 500+)
    const [sectionsMap, dependenciesMap, reasonCodeLabels, emailIssuesData] = await Promise.all([
      batchGetVerificationSections(allReferenceIds),
      batchGetChaseDependencies(allReferenceIds),
      batchGetReasonCodeLabels(),
      // Fetch email delivery issues (bounced or complained)
      supabase
        .from('email_delivery_logs')
        .select('reference_id, reference_type, status, error_message')
        .in('reference_id', allReferenceIds)
        .in('status', ['bounced', 'complained'])
    ])

    // Build a map of reference_id -> array of email delivery issues (multiple types per reference)
    const emailIssuesMap = new Map<string, Array<{ status: string; referenceType: string; errorMessage?: string }>>()
    if (emailIssuesData.data) {
      for (const issue of emailIssuesData.data) {
        if (issue.reference_id) {
          const existing = emailIssuesMap.get(issue.reference_id) || []
          existing.push({
            status: issue.status,
            referenceType: issue.reference_type || 'tenant',
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
    const today = new Date().toISOString().split('T')[0]
    const statusCounts: StatusCounts = {
      all: tenancies.length,
      inProgress: tenancies.filter(t => t.tenancyStatus === 'IN_PROGRESS').length,
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
    const userId = req.user?.id
    const tenancyId = req.params.id

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

export default router

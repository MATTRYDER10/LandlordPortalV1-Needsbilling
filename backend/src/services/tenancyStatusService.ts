import { supabase } from '../config/supabase'
import { decrypt } from './encryption'
import { DependencyStatus, DependencyType } from './chaseDependencyService'
import { SectionDecision, SectionType } from './verificationSectionService'
import { isReadyForVerificationSync } from './verificationReadinessService'

// Person Status (derived from verification_sections + chase_dependencies)
export type PersonStatus =
  | 'NOT_STARTED'           // No form activity, no data submitted
  | 'IN_PROGRESS'           // Form started OR references sent OR external dependency outstanding
  | 'AWAITING_VERIFICATION' // All required data and references returned, awaiting staff review
  | 'ACTION_REQUIRED'       // Staff have failed one or more verification sections
  | 'VERIFIED_PASS'
  | 'VERIFIED_CONDITIONAL'
  | 'VERIFIED_FAIL'
  | 'ARCHIVED'              // Person replaced; excluded from all rollups

// Tenancy Status (derived from active people)
export type TenancyStatus =
  | 'SENT'                  // Nobody has started
  | 'IN_PROGRESS'           // Any external dependency exists
  | 'AWAITING_VERIFICATION' // All required data for all people returned, none require action
  | 'ACTION_REQUIRED'       // Any person has ACTION_REQUIRED
  | 'COMPLETED'             // Final staff-set state
  | 'REJECTED'              // Final staff-set state

// Section status for display (simplified from full VerificationSection)
export interface SectionStatus {
  type: SectionType
  decision: SectionDecision
  hasActionRequired: boolean
  actionReasonCode?: string
  actionAgentNote?: string
}

// Person data for tenancy response
export interface TenancyPerson {
  id: string
  role: 'TENANT' | 'GUARANTOR'
  name: string
  email: string
  phone: string
  rentShare: number
  status: PersonStatus
  guarantorForTenantId?: string
  sectionStatuses: SectionStatus[]
  actionRequiredTasks: ActionRequiredTask[]
}

// Action required task
export interface ActionRequiredTask {
  sectionType: string
  reasonCode: string
  staffNote: string
  requiredActionType: string
}

// Progress summary for collapsed view
export interface ProgressSummary {
  tenantsVerified: number
  tenantsTotal: number
  guarantorsVerified: number
  guarantorsTotal: number
  checkFailures: Record<string, number>
}

// Full tenancy data
export interface Tenancy {
  id: string
  propertyAddress: string
  propertyCity: string
  propertyPostcode: string
  moveInDate: string
  monthlyRent: number
  tenancyStatus: TenancyStatus
  urgentReverify: boolean
  blockingSentence: string
  progressSummary: ProgressSummary
  people: TenancyPerson[]
  createdAt: string
}

// Status counts for tabs
export interface StatusCounts {
  all: number
  inProgress: number
  awaitingVerification: number
  actionRequired: number
  completed: number
  rejected: number
}

/**
 * Derive person status from verification sections, chase dependencies, and reference status
 */
export async function derivePersonStatus(referenceId: string): Promise<PersonStatus> {
  try {
    // Get reference details
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('status, is_guarantor, submitted_at')
      .eq('id', referenceId)
      .single()

    if (refError || !reference) {
      return 'NOT_STARTED'
    }

    // Check for terminal statuses first
    if (reference.status === 'completed') {
      // Need to check if it was conditional or not from verification sections
      const { data: sections } = await supabase
        .from('verification_sections')
        .select('decision')
        .eq('reference_id', referenceId)

      const hasConditional = sections?.some(s => s.decision === 'PASS_WITH_CONDITION')
      const hasFail = sections?.some(s => s.decision === 'FAIL')

      if (hasFail) return 'VERIFIED_FAIL'
      if (hasConditional) return 'VERIFIED_CONDITIONAL'
      return 'VERIFIED_PASS'
    }

    if (reference.status === 'rejected' || reference.status === 'cancelled') {
      return 'VERIFIED_FAIL'
    }

    // Check for action_required from verification sections
    const { data: sections } = await supabase
      .from('verification_sections')
      .select('decision')
      .eq('reference_id', referenceId)

    if (sections?.some(s => s.decision === 'ACTION_REQUIRED')) {
      return 'ACTION_REQUIRED'
    }

    // Check if in pending_verification AND form was actually submitted
    if (reference.status === 'pending_verification') {
      // If form not submitted yet, they're still NOT_STARTED (corrupted status from previous bug)
      if (!reference.submitted_at) {
        return 'NOT_STARTED'
      }
      return 'AWAITING_VERIFICATION'
    }

    // Check for outstanding dependencies
    const { data: dependencies } = await supabase
      .from('chase_dependencies')
      .select('status')
      .eq('reference_id', referenceId)
      .in('status', ['PENDING', 'CHASING', 'EXHAUSTED', 'ACTION_REQUIRED'])

    if (dependencies && dependencies.length > 0) {
      // Has dependency with ACTION_REQUIRED status
      if (dependencies.some(d => d.status === 'ACTION_REQUIRED')) {
        return 'ACTION_REQUIRED'
      }
      return 'IN_PROGRESS'
    }

    // Check if form was submitted
    if (reference.submitted_at || reference.status === 'in_progress') {
      return 'IN_PROGRESS'
    }

    // Default - nothing started
    if (reference.status === 'pending') {
      return 'NOT_STARTED'
    }

    return 'IN_PROGRESS'
  } catch (error) {
    console.error('Error deriving person status:', error)
    return 'NOT_STARTED'
  }
}

/**
 * Derive tenancy status from all active people
 * Priority: ACTION_REQUIRED > AWAITING_VERIFICATION > IN_PROGRESS > SENT
 */
export function deriveTenancyStatus(people: TenancyPerson[]): TenancyStatus {
  // Filter out archived people
  const activePeople = people.filter(p => p.status !== 'ARCHIVED')

  if (activePeople.length === 0) {
    return 'SENT'
  }

  // Check for ACTION_REQUIRED (highest priority)
  if (activePeople.some(p => p.status === 'ACTION_REQUIRED')) {
    return 'ACTION_REQUIRED'
  }

  // Check if all verified (completed or failed)
  const allVerified = activePeople.every(p =>
    ['VERIFIED_PASS', 'VERIFIED_CONDITIONAL', 'VERIFIED_FAIL'].includes(p.status)
  )

  if (allVerified) {
    // If any failed, tenancy is rejected
    if (activePeople.some(p => p.status === 'VERIFIED_FAIL')) {
      return 'REJECTED'
    }
    return 'COMPLETED'
  }

  // Check if all are either verified or awaiting verification
  const allReadyOrVerified = activePeople.every(p =>
    ['VERIFIED_PASS', 'VERIFIED_CONDITIONAL', 'VERIFIED_FAIL', 'AWAITING_VERIFICATION'].includes(p.status)
  )

  if (allReadyOrVerified) {
    return 'AWAITING_VERIFICATION'
  }

  // Check if any in progress
  if (activePeople.some(p => p.status === 'IN_PROGRESS' || p.status === 'AWAITING_VERIFICATION')) {
    return 'IN_PROGRESS'
  }

  // All NOT_STARTED
  if (activePeople.every(p => p.status === 'NOT_STARTED')) {
    return 'SENT'
  }

  return 'IN_PROGRESS'
}

/**
 * Generate a blocking sentence describing what's blocking progress
 * Format: "Waiting: [Person Name] - [What's blocking]"
 * Examples:
 * - "Waiting: John Smith - Action Required (Right to Rent)"
 * - "Waiting: Jane Doe - Awaiting Verification"
 * - "Waiting: Bob Jones - Employer Reference"
 */
export async function generateBlockingSentence(
  referenceIds: string[],
  people: TenancyPerson[]
): Promise<string> {
  try {
    // Priority 1: Action Required from verification sections
    const actionRequiredPeople = people.filter(p => p.status === 'ACTION_REQUIRED')
    if (actionRequiredPeople.length > 0) {
      const person = actionRequiredPeople[0]
      // Get the specific sections with action required
      const { data: sections } = await supabase
        .from('verification_sections')
        .select('section_type, action_reason_code')
        .in('reference_id', referenceIds)
        .eq('decision', 'ACTION_REQUIRED')

      if (sections && sections.length > 0) {
        const sectionTypes = [...new Set(sections.map(s => formatSectionType(s.section_type)))]
        if (actionRequiredPeople.length > 1) {
          return `Waiting: ${person.name} - Action Required (${sectionTypes.join(', ')}) +${actionRequiredPeople.length - 1} more`
        }
        return `Waiting: ${person.name} - Action Required (${sectionTypes.join(', ')})`
      }
      if (actionRequiredPeople.length > 1) {
        return `Waiting: ${person.name} - Action Required +${actionRequiredPeople.length - 1} more`
      }
      return `Waiting: ${person.name} - Action Required`
    }

    // Priority 2: Awaiting verification
    const awaitingVerification = people.filter(p => p.status === 'AWAITING_VERIFICATION')
    if (awaitingVerification.length > 0) {
      const person = awaitingVerification[0]
      if (awaitingVerification.length > 1) {
        return `Waiting: ${person.name} - Awaiting Verification +${awaitingVerification.length - 1} more`
      }
      return `Waiting: ${person.name} - Awaiting Verification`
    }

    // Priority 3: Outstanding dependencies - find who has them
    const { data: dependencies } = await supabase
      .from('chase_dependencies')
      .select('reference_id, dependency_type, status')
      .in('reference_id', referenceIds)
      .in('status', ['PENDING', 'CHASING'])

    if (dependencies && dependencies.length > 0) {
      // Find the person with the first dependency
      const firstDep = dependencies[0]
      const person = people.find(p => p.id === firstDep.reference_id)
      const depLabel = formatDependencyType(firstDep.dependency_type)

      if (person) {
        if (dependencies.length > 1) {
          return `Waiting: ${person.name} - ${capitalizeFirst(depLabel)} +${dependencies.length - 1} more`
        }
        return `Waiting: ${person.name} - ${capitalizeFirst(depLabel)}`
      }

      // Fallback if person not found
      if (dependencies.length > 1) {
        return `Waiting: ${capitalizeFirst(depLabel)} +${dependencies.length - 1} more`
      }
      return `Waiting: ${capitalizeFirst(depLabel)}`
    }

    // Priority 4: Form not started
    const notStarted = people.filter(p => p.status === 'NOT_STARTED')
    if (notStarted.length > 0) {
      const person = notStarted[0]
      const formType = person.role === 'TENANT' ? 'Tenant Form' : 'Guarantor Form'
      if (notStarted.length > 1) {
        return `Waiting: ${person.name} - ${formType} Not Started +${notStarted.length - 1} more`
      }
      return `Waiting: ${person.name} - ${formType} Not Started`
    }

    // In progress - generic
    const inProgress = people.filter(p => p.status === 'IN_PROGRESS')
    if (inProgress.length > 0) {
      const person = inProgress[0]
      if (inProgress.length > 1) {
        return `Waiting: ${person.name} - In Progress +${inProgress.length - 1} more`
      }
      return `Waiting: ${person.name} - In Progress`
    }

    return ''
  } catch (error) {
    console.error('Error generating blocking sentence:', error)
    return ''
  }
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Aggregate check failures across all people for the progress chips
 */
export function aggregateCheckFailures(people: TenancyPerson[]): Record<string, number> {
  const failures: Record<string, number> = {
    ID: 0,
    RTR: 0,
    Income: 0,
    Residential: 0,
    Credit: 0,
    AML: 0
  }

  for (const person of people) {
    for (const section of person.sectionStatuses) {
      if (section.decision === 'FAIL' || section.decision === 'ACTION_REQUIRED') {
        const key = mapSectionTypeToChipKey(section.type)
        if (key && failures[key] !== undefined) {
          failures[key]++
        }
      }
    }
  }

  return failures
}

/**
 * Calculate progress summary for a tenancy
 */
export function calculateProgressSummary(people: TenancyPerson[]): ProgressSummary {
  const tenants = people.filter(p => p.role === 'TENANT' && p.status !== 'ARCHIVED')
  const guarantors = people.filter(p => p.role === 'GUARANTOR' && p.status !== 'ARCHIVED')

  const verifiedStatuses: PersonStatus[] = ['VERIFIED_PASS', 'VERIFIED_CONDITIONAL']

  return {
    tenantsVerified: tenants.filter(t => verifiedStatuses.includes(t.status)).length,
    tenantsTotal: tenants.length,
    guarantorsVerified: guarantors.filter(g => verifiedStatuses.includes(g.status)).length,
    guarantorsTotal: guarantors.length,
    checkFailures: aggregateCheckFailures(people)
  }
}

/**
 * Get section statuses for a person
 */
export async function getPersonSectionStatuses(referenceId: string): Promise<SectionStatus[]> {
  const { data: sections, error } = await supabase
    .from('verification_sections')
    .select('*')
    .eq('reference_id', referenceId)
    .order('section_order', { ascending: true })

  if (error || !sections) {
    return []
  }

  return sections.map(s => ({
    type: s.section_type as SectionType,
    decision: s.decision as SectionDecision,
    hasActionRequired: s.decision === 'ACTION_REQUIRED',
    actionReasonCode: s.action_reason_code || undefined,
    actionAgentNote: s.action_agent_note || undefined
  }))
}

/**
 * Get action required tasks for a person
 */
export async function getPersonActionRequiredTasks(referenceId: string): Promise<ActionRequiredTask[]> {
  const { data: sections, error } = await supabase
    .from('verification_sections')
    .select('section_type, action_reason_code, action_agent_note')
    .eq('reference_id', referenceId)
    .eq('decision', 'ACTION_REQUIRED')

  if (error || !sections) {
    return []
  }

  return sections.map(s => ({
    sectionType: s.section_type,
    reasonCode: s.action_reason_code || '',
    staffNote: s.action_agent_note || '',
    requiredActionType: mapReasonToActionType(s.action_reason_code)
  }))
}

/**
 * Build full person data for tenancy response
 */
export async function buildTenancyPerson(reference: any): Promise<TenancyPerson> {
  const status = await derivePersonStatus(reference.id)
  const sectionStatuses = await getPersonSectionStatuses(reference.id)
  const actionRequiredTasks = status === 'ACTION_REQUIRED'
    ? await getPersonActionRequiredTasks(reference.id)
    : []

  return {
    id: reference.id,
    role: reference.is_guarantor ? 'GUARANTOR' : 'TENANT',
    name: `${decrypt(reference.tenant_first_name_encrypted) || ''} ${decrypt(reference.tenant_last_name_encrypted) || ''}`.trim(),
    email: decrypt(reference.tenant_email_encrypted) || '',
    phone: decrypt(reference.tenant_phone_encrypted) || '',
    rentShare: reference.rent_share || 0,
    status,
    guarantorForTenantId: reference.guarantor_for_reference_id || undefined,
    sectionStatuses,
    actionRequiredTasks
  }
}

// --- Helper Functions ---

function formatSectionType(type: string): string {
  const mapping: Record<string, string> = {
    'IDENTITY_SELFIE': 'ID',
    'RTR': 'Right to Rent',
    'INCOME': 'Income',
    'RESIDENTIAL': 'Residential',
    'CREDIT': 'Credit',
    'AML': 'AML'
  }
  return mapping[type] || type
}

function formatDependencyType(type: DependencyType): string {
  const mapping: Record<DependencyType, string> = {
    'TENANT_FORM': 'tenant form',
    'GUARANTOR_FORM': 'guarantor form',
    'EMPLOYER_REF': 'employer reference',
    'RESIDENTIAL_REF': 'residential reference',
    'ACCOUNTANT_REF': 'accountant reference'
  }
  return mapping[type] || type
}

function mapSectionTypeToChipKey(type: SectionType): string | null {
  const mapping: Record<string, string> = {
    'IDENTITY_SELFIE': 'ID',
    'RTR': 'RTR',
    'INCOME': 'Income',
    'RESIDENTIAL': 'Residential',
    'CREDIT': 'Credit',
    'AML': 'AML'
  }
  return mapping[type] || null
}

function mapReasonToActionType(reasonCode: string | null): string {
  if (!reasonCode) return 'REVIEW'

  // Map common reason codes to action types
  const actionTypes: Record<string, string> = {
    'DOCUMENT_UNCLEAR': 'UPLOAD_DOCUMENT',
    'DOCUMENT_EXPIRED': 'UPLOAD_DOCUMENT',
    'DOCUMENT_MISSING': 'UPLOAD_DOCUMENT',
    'INCOME_INSUFFICIENT': 'PROVIDE_INFO',
    'INCOME_UNVERIFIED': 'PROVIDE_INFO',
    'REFEREE_UNRESPONSIVE': 'UPDATE_REFEREE',
    'REFEREE_INVALID': 'UPDATE_REFEREE',
    'RTR_EXPIRED': 'UPDATE_RTR',
    'RTR_INVALID': 'UPDATE_RTR'
  }

  return actionTypes[reasonCode] || 'REVIEW'
}

// ============================================================================
// BATCH FUNCTIONS - For performance optimization (avoid N+1 queries)
// ============================================================================

/**
 * Batch fetch verification sections for multiple references at once
 * Returns a Map keyed by reference_id
 */
export async function batchGetVerificationSections(referenceIds: string[]): Promise<Map<string, any[]>> {
  if (referenceIds.length === 0) {
    return new Map()
  }

  const { data, error } = await supabase
    .from('verification_sections')
    .select('*')
    .in('reference_id', referenceIds)

  if (error) {
    console.error('Error batch fetching verification sections:', error)
    return new Map()
  }

  // Group by reference_id
  const byRef = new Map<string, any[]>()
  for (const section of data || []) {
    const arr = byRef.get(section.reference_id) || []
    arr.push(section)
    byRef.set(section.reference_id, arr)
  }
  return byRef
}

/**
 * Batch fetch chase dependencies for multiple references at once
 * Returns a Map keyed by reference_id
 */
export async function batchGetChaseDependencies(referenceIds: string[]): Promise<Map<string, any[]>> {
  if (referenceIds.length === 0) {
    return new Map()
  }

  const { data, error } = await supabase
    .from('chase_dependencies')
    .select('reference_id, dependency_type, status')
    .in('reference_id', referenceIds)
    .in('status', ['PENDING', 'CHASING', 'EXHAUSTED', 'ACTION_REQUIRED'])

  if (error) {
    console.error('Error batch fetching chase dependencies:', error)
    return new Map()
  }

  // Group by reference_id
  const byRef = new Map<string, any[]>()
  for (const dep of data || []) {
    const arr = byRef.get(dep.reference_id) || []
    arr.push(dep)
    byRef.set(dep.reference_id, arr)
  }
  return byRef
}

/**
 * Sync version of derivePersonStatus that uses pre-fetched data
 * No database queries - uses passed-in sections and dependencies
 *
 * The reference object should include all fields needed for readiness checking:
 * - Basic: id, status, submitted_at, is_guarantor
 * - Income: income_student, income_regular_employment, income_self_employed, income_benefits
 * - Identity: id_document_path, selfie_path
 * - Income evidence: payslip_files, tax_return_path, proof_of_additional_income_path, benefits_annual_amount_encrypted
 * - Residential: confirmed_residential_status, previous_landlord_email_encrypted
 * - References: employer_references, landlord_references, agent_references, accountant_references
 */
export function derivePersonStatusSync(
  reference: any,
  sections: any[] | undefined,
  dependencies: any[] | undefined
): PersonStatus {
  // Check for terminal statuses first
  if (reference.status === 'completed') {
    const hasConditional = sections?.some(s => s.decision === 'PASS_WITH_CONDITION')
    const hasFail = sections?.some(s => s.decision === 'FAIL')

    if (hasFail) return 'VERIFIED_FAIL'
    if (hasConditional) return 'VERIFIED_CONDITIONAL'
    return 'VERIFIED_PASS'
  }

  if (reference.status === 'rejected' || reference.status === 'cancelled') {
    return 'VERIFIED_FAIL'
  }

  // Check for action_required from verification sections
  if (sections?.some(s => s.decision === 'ACTION_REQUIRED')) {
    return 'ACTION_REQUIRED'
  }

  // Check if in pending_verification - but verify they're actually ready
  if (reference.status === 'pending_verification') {
    // If form not submitted yet, they're still NOT_STARTED (corrupted status from previous bug)
    if (!reference.submitted_at) {
      return 'NOT_STARTED'
    }

    // Check if reference is actually ready for verification
    // This handles cases where status was set incorrectly due to previous bugs
    const readiness = isReadyForVerificationSync(reference)
    if (!readiness.isReady) {
      // Not actually ready - show as IN_PROGRESS
      return 'IN_PROGRESS'
    }

    return 'AWAITING_VERIFICATION'
  }

  // Check for outstanding dependencies
  if (dependencies && dependencies.length > 0) {
    // Has dependency with ACTION_REQUIRED status
    if (dependencies.some(d => d.status === 'ACTION_REQUIRED')) {
      return 'ACTION_REQUIRED'
    }
    return 'IN_PROGRESS'
  }

  // Check if form was submitted
  if (reference.submitted_at || reference.status === 'in_progress') {
    return 'IN_PROGRESS'
  }

  // Default - nothing started
  if (reference.status === 'pending') {
    return 'NOT_STARTED'
  }

  return 'IN_PROGRESS'
}

/**
 * Convert pre-fetched sections to SectionStatus format
 */
export function getSectionStatusesFromData(sections: any[] | undefined): SectionStatus[] {
  if (!sections || sections.length === 0) {
    return []
  }

  // Sort by section_order
  const sorted = [...sections].sort((a, b) => (a.section_order || 0) - (b.section_order || 0))

  return sorted.map(s => ({
    type: s.section_type as SectionType,
    decision: s.decision as SectionDecision,
    hasActionRequired: s.decision === 'ACTION_REQUIRED',
    actionReasonCode: s.action_reason_code || undefined,
    actionAgentNote: s.action_agent_note || undefined
  }))
}

/**
 * Get action required tasks from pre-fetched sections
 */
export function getActionRequiredTasksFromData(sections: any[] | undefined): ActionRequiredTask[] {
  if (!sections) {
    return []
  }

  const actionRequired = sections.filter(s => s.decision === 'ACTION_REQUIRED')

  return actionRequired.map(s => ({
    sectionType: s.section_type,
    reasonCode: s.action_reason_code || '',
    staffNote: s.action_agent_note || '',
    requiredActionType: mapReasonToActionType(s.action_reason_code)
  }))
}

/**
 * Sync version of buildTenancyPerson that uses pre-fetched data
 * No database queries - uses passed-in maps
 */
export function buildTenancyPersonSync(
  reference: any,
  sectionsMap: Map<string, any[]>,
  dependenciesMap: Map<string, any[]>
): TenancyPerson {
  const sections = sectionsMap.get(reference.id)
  const dependencies = dependenciesMap.get(reference.id)

  const status = derivePersonStatusSync(reference, sections, dependencies)
  const sectionStatuses = getSectionStatusesFromData(sections)
  const actionRequiredTasks = status === 'ACTION_REQUIRED'
    ? getActionRequiredTasksFromData(sections)
    : []

  return {
    id: reference.id,
    role: reference.is_guarantor ? 'GUARANTOR' : 'TENANT',
    name: `${decrypt(reference.tenant_first_name_encrypted) || ''} ${decrypt(reference.tenant_last_name_encrypted) || ''}`.trim(),
    email: decrypt(reference.tenant_email_encrypted) || '',
    phone: decrypt(reference.tenant_phone_encrypted) || '',
    rentShare: reference.rent_share || 0,
    status,
    guarantorForTenantId: reference.guarantor_for_reference_id || undefined,
    sectionStatuses,
    actionRequiredTasks
  }
}

/**
 * Sync version of generateBlockingSentence that uses pre-fetched data
 */
export function generateBlockingSentenceSync(
  people: TenancyPerson[],
  sectionsMap: Map<string, any[]>,
  dependenciesMap: Map<string, any[]>
): string {
  // Priority 1: Action Required from verification sections
  const actionRequiredPeople = people.filter(p => p.status === 'ACTION_REQUIRED')
  if (actionRequiredPeople.length > 0) {
    const person = actionRequiredPeople[0]
    // Get the specific sections with action required from pre-fetched data
    const allActionSections: any[] = []
    for (const p of actionRequiredPeople) {
      const sections = sectionsMap.get(p.id) || []
      allActionSections.push(...sections.filter(s => s.decision === 'ACTION_REQUIRED'))
    }

    if (allActionSections.length > 0) {
      const sectionTypes = [...new Set(allActionSections.map(s => formatSectionType(s.section_type)))]
      if (actionRequiredPeople.length > 1) {
        return `Waiting: ${person.name} - Action Required (${sectionTypes.join(', ')}) +${actionRequiredPeople.length - 1} more`
      }
      return `Waiting: ${person.name} - Action Required (${sectionTypes.join(', ')})`
    }
    if (actionRequiredPeople.length > 1) {
      return `Waiting: ${person.name} - Action Required +${actionRequiredPeople.length - 1} more`
    }
    return `Waiting: ${person.name} - Action Required`
  }

  // Priority 2: Awaiting verification
  const awaitingVerification = people.filter(p => p.status === 'AWAITING_VERIFICATION')
  if (awaitingVerification.length > 0) {
    const person = awaitingVerification[0]
    if (awaitingVerification.length > 1) {
      return `Waiting: ${person.name} - Awaiting Verification +${awaitingVerification.length - 1} more`
    }
    return `Waiting: ${person.name} - Awaiting Verification`
  }

  // Priority 3: Outstanding dependencies - find who has them
  const allDependencies: Array<{ personId: string; dep: any }> = []
  for (const person of people) {
    const deps = dependenciesMap.get(person.id) || []
    for (const dep of deps) {
      if (dep.status === 'PENDING' || dep.status === 'CHASING') {
        allDependencies.push({ personId: person.id, dep })
      }
    }
  }

  if (allDependencies.length > 0) {
    const firstDep = allDependencies[0]
    const person = people.find(p => p.id === firstDep.personId)
    const depLabel = formatDependencyType(firstDep.dep.dependency_type)

    if (person) {
      if (allDependencies.length > 1) {
        return `Waiting: ${person.name} - ${capitalizeFirst(depLabel)} +${allDependencies.length - 1} more`
      }
      return `Waiting: ${person.name} - ${capitalizeFirst(depLabel)}`
    }

    // Fallback if person not found
    if (allDependencies.length > 1) {
      return `Waiting: ${capitalizeFirst(depLabel)} +${allDependencies.length - 1} more`
    }
    return `Waiting: ${capitalizeFirst(depLabel)}`
  }

  // Priority 4: Form not started
  const notStarted = people.filter(p => p.status === 'NOT_STARTED')
  if (notStarted.length > 0) {
    const person = notStarted[0]
    const formType = person.role === 'TENANT' ? 'Tenant Form' : 'Guarantor Form'
    if (notStarted.length > 1) {
      return `Waiting: ${person.name} - ${formType} Not Started +${notStarted.length - 1} more`
    }
    return `Waiting: ${person.name} - ${formType} Not Started`
  }

  // In progress - generic
  const inProgress = people.filter(p => p.status === 'IN_PROGRESS')
  if (inProgress.length > 0) {
    const person = inProgress[0]
    if (inProgress.length > 1) {
      return `Waiting: ${person.name} - In Progress +${inProgress.length - 1} more`
    }
    return `Waiting: ${person.name} - In Progress`
  }

  return ''
}

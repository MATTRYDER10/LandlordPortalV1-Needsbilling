import { supabase } from '../config/supabase'
import { decrypt } from './encryption'
import { DependencyStatus, DependencyType } from './chaseDependencyService'
import { SectionDecision, SectionType } from './verificationSectionService'
import { isReadyForVerificationSync } from './verificationReadinessService'

// Note: PersonStatus type removed - replaced by verification_state field (Phase 5-6 simplification)

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

// Email delivery issue (bounced or complained)
export interface EmailDeliveryIssue {
  type: 'bounced' | 'complained'
  referenceType: 'tenant' | 'guarantor' | 'employer' | 'landlord' | 'accountant' | 'agent'
  errorMessage?: string
}

// Person data for tenancy response
export interface TenancyPerson {
  id: string
  role: 'TENANT' | 'GUARANTOR'
  name: string
  email: string
  phone: string
  rentShare: number
  verificationState: string  // Direct from database verification_state field
  guarantorForTenantId?: string
  sectionStatuses: SectionStatus[]
  actionRequiredTasks: ActionRequiredTask[]
  emailDeliveryIssue?: EmailDeliveryIssue
}

// Action required task
export interface ActionRequiredTask {
  sectionType: string
  reasonCode: string
  reasonLabel: string
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
  movedIn: number
  rejected: number
}

/**
 * Derive person status from verification sections, chase dependencies, and reference status
 */
// derivePersonStatus() REMOVED - Phase 5-6 cleanup
// Now using verification_state field directly from database instead of derivation

/**
 * Derive tenancy status from all active people (simplified - uses verification_state)
 * Priority: ACTION_REQUIRED > READY_FOR_REVIEW/IN_VERIFICATION > IN_PROGRESS > SENT
 */
export function deriveTenancyStatus(people: TenancyPerson[]): TenancyStatus {
  // Filter out cancelled/archived people
  const activePeople = people.filter(p =>
    p.verificationState !== 'CANCELLED' && p.verificationState !== 'ARCHIVED'
  )

  if (activePeople.length === 0) {
    return 'SENT'
  }

  // Check for ACTION_REQUIRED (highest priority)
  if (activePeople.some(p => p.verificationState === 'ACTION_REQUIRED')) {
    return 'ACTION_REQUIRED'
  }

  // Check if all completed or rejected
  const allCompleted = activePeople.every(p => p.verificationState === 'COMPLETED')
  const allRejected = activePeople.every(p => p.verificationState === 'REJECTED')

  if (allCompleted || allRejected) {
    return allRejected ? 'REJECTED' : 'COMPLETED'
  }

  // Check if any rejected
  if (activePeople.some(p => p.verificationState === 'REJECTED')) {
    return 'REJECTED'
  }

  // Check if all are awaiting verification (ready for review or being verified)
  const allAwaitingVerification = activePeople.every(p =>
    p.verificationState === 'READY_FOR_REVIEW' ||
    p.verificationState === 'IN_VERIFICATION' ||
    p.verificationState === 'COMPLETED'
  )

  if (allAwaitingVerification) {
    return 'AWAITING_VERIFICATION'
  }

  // Check if any in progress
  if (activePeople.some(p =>
    p.verificationState === 'COLLECTING_EVIDENCE' ||
    p.verificationState === 'WAITING_ON_REFERENCES' ||
    p.verificationState === 'READY_FOR_REVIEW' ||
    p.verificationState === 'IN_VERIFICATION'
  )) {
    return 'IN_PROGRESS'
  }

  // Default
  return 'SENT'
}

/**
 * Generate a blocking sentence describing what's blocking progress
 * Format: "Waiting: [Person Name] - [What's blocking]"
 * Examples:
 * - "Waiting: John Smith - Action Required (Right to Rent)"
 * - "Waiting: Jane Doe - Awaiting Verification"
 * - "Waiting: Bob Jones - Employer Reference"
 */
// generateBlockingSentence() REMOVED - Phase 5-6 cleanup
// Now using generateBlockingSentenceSync() which uses verification_state

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
  const tenants = people.filter(p => p.role === 'TENANT' && p.verificationState !== 'CANCELLED')
  const guarantors = people.filter(p => p.role === 'GUARANTOR' && p.verificationState !== 'CANCELLED')

  return {
    tenantsVerified: tenants.filter(t => t.verificationState === 'COMPLETED').length,
    tenantsTotal: tenants.length,
    guarantorsVerified: guarantors.filter(g => g.verificationState === 'COMPLETED').length,
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

// Map chase dependency types to section types (or keep as-is for form types)
function mapDependencyTypeToSection(dependencyType: string): string {
  const mapping: Record<string, string> = {
    'EMPLOYER_REF': 'INCOME',
    'ACCOUNTANT_REF': 'INCOME',
    'RESIDENTIAL_REF': 'RESIDENTIAL',
    'TENANT_FORM': 'TENANT_FORM',
    'GUARANTOR_FORM': 'GUARANTOR_FORM'
  }
  return mapping[dependencyType] || dependencyType
}

// Get human-readable label for dependency type
function getDependencyTypeLabel(dependencyType: string): string {
  const labels: Record<string, string> = {
    'EMPLOYER_REF': 'Employer Reference',
    'ACCOUNTANT_REF': 'Accountant Reference',
    'RESIDENTIAL_REF': 'Landlord Reference',
    'TENANT_FORM': 'Tenant',
    'GUARANTOR_FORM': 'Guarantor'
  }
  return labels[dependencyType] || dependencyType
}

/**
 * Get action required tasks for a person
 */
export async function getPersonActionRequiredTasks(referenceId: string): Promise<ActionRequiredTask[]> {
  // Fetch verification sections with ACTION_REQUIRED
  const { data: sections, error } = await supabase
    .from('verification_sections')
    .select('section_type, action_reason_code, action_agent_note')
    .eq('reference_id', referenceId)
    .eq('decision', 'ACTION_REQUIRED')

  // Also fetch chase dependencies with ACTION_REQUIRED status
  const { data: chaseDeps } = await supabase
    .from('chase_dependencies')
    .select('dependency_type, metadata')
    .eq('reference_id', referenceId)
    .eq('status', 'ACTION_REQUIRED')

  const tasks: ActionRequiredTask[] = []

  // Collect all reason codes to look up display labels
  const reasonCodes = new Set<string>()
  if (sections) {
    sections.forEach(s => {
      if (s.action_reason_code) reasonCodes.add(s.action_reason_code)
    })
  }
  // Add CHASE_EXHAUSTED if we have exhausted chase dependencies
  if (chaseDeps && chaseDeps.length > 0) {
    reasonCodes.add('CHASE_EXHAUSTED')
  }

  let reasonCodeLabels: Record<string, string> = {}
  if (reasonCodes.size > 0) {
    const { data: codes } = await supabase
      .from('action_reason_codes')
      .select('code, display_label')
      .in('code', Array.from(reasonCodes))

    if (codes) {
      reasonCodeLabels = codes.reduce((acc, c) => {
        acc[c.code] = c.display_label
        return acc
      }, {} as Record<string, string>)
    }
  }

  // Add tasks from verification sections
  if (sections) {
    for (const s of sections) {
      tasks.push({
        sectionType: s.section_type,
        reasonCode: s.action_reason_code || '',
        reasonLabel: s.action_reason_code ? (reasonCodeLabels[s.action_reason_code] || s.action_reason_code) : '',
        staffNote: s.action_agent_note || '',
        requiredActionType: mapReasonToActionType(s.action_reason_code)
      })
    }
  }

  // Add tasks from exhausted chase dependencies
  if (chaseDeps) {
    for (const dep of chaseDeps) {
      const depLabel = getDependencyTypeLabel(dep.dependency_type)
      tasks.push({
        sectionType: mapDependencyTypeToSection(dep.dependency_type),
        reasonCode: 'CHASE_EXHAUSTED',
        reasonLabel: reasonCodeLabels['CHASE_EXHAUSTED'] || 'Reference Not Responding',
        staffNote: `${depLabel} has not responded after multiple contact attempts`,
        requiredActionType: 'UPDATE_REFEREE'
      })
    }
  }

  return tasks
}

// buildTenancyPerson() REMOVED - Phase 5-6 cleanup
// Now using buildTenancyPersonSync() which uses verification_state instead of deriving status

// --- Helper Functions ---

function formatSectionType(type: string): string {
  const mapping: Record<string, string> = {
    'IDENTITY_SELFIE': 'ID',
    'RTR': 'Right to Rent',
    'INCOME': 'Income',
    'RESIDENTIAL': 'Residential',
    'CREDIT': 'Credit',
    'AML': 'AML',
    'TENANT_FORM': 'Tenant Form',
    'GUARANTOR_FORM': 'Guarantor Form',
    'EMPLOYER_REF': 'Employer Reference',
    'RESIDENTIAL_REF': 'Landlord Reference',
    'ACCOUNTANT_REF': 'Accountant Reference',
    'EMPLOYER_REFERENCE': 'Employer Reference',
    'LANDLORD_REFERENCE': 'Landlord Reference',
    'ACCOUNTANT_REFERENCE': 'Accountant Reference'
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
 * Batch fetch all action reason code labels
 * Returns a Map of code -> display_label
 */
export async function batchGetReasonCodeLabels(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('action_reason_codes')
    .select('code, display_label')
    .eq('active', true)

  if (error) {
    console.error('Error batch fetching reason code labels:', error)
    return new Map()
  }

  const labels = new Map<string, string>()
  for (const code of data || []) {
    labels.set(code.code, code.display_label)
  }
  return labels
}

// derivePersonStatusSync() REMOVED - Phase 5-6 cleanup
// Now using verification_state field directly from database instead of derivation

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
 * Get action required tasks from pre-fetched sections and dependencies
 */
export function getActionRequiredTasksFromData(
  sections: any[] | undefined,
  dependencies: any[] | undefined,
  reasonCodeLabels: Map<string, string>
): ActionRequiredTask[] {
  const tasks: ActionRequiredTask[] = []

  // Add tasks from verification sections with ACTION_REQUIRED
  if (sections) {
    const actionRequired = sections.filter(s => s.decision === 'ACTION_REQUIRED')
    for (const s of actionRequired) {
      const reasonCode = s.action_reason_code || ''
      tasks.push({
        sectionType: s.section_type,
        reasonCode,
        reasonLabel: reasonCode ? (reasonCodeLabels.get(reasonCode) || reasonCode) : '',
        staffNote: s.action_agent_note || '',
        requiredActionType: mapReasonToActionType(s.action_reason_code)
      })
    }
  }

  // Add tasks from chase dependencies with ACTION_REQUIRED status
  if (dependencies) {
    const exhaustedDeps = dependencies.filter(d => d.status === 'ACTION_REQUIRED')
    for (const dep of exhaustedDeps) {
      const depLabel = getDependencyTypeLabel(dep.dependency_type)
      tasks.push({
        sectionType: mapDependencyTypeToSection(dep.dependency_type),
        reasonCode: 'CHASE_EXHAUSTED',
        reasonLabel: reasonCodeLabels.get('CHASE_EXHAUSTED') || 'Reference Not Responding',
        staffNote: `${depLabel} has not responded after multiple contact attempts`,
        requiredActionType: 'UPDATE_REFEREE'
      })
    }
  }

  return tasks
}

/**
 * Sync version of buildTenancyPerson that uses pre-fetched data
 * No database queries - uses passed-in maps
 */
export function buildTenancyPersonSync(
  reference: any,
  sectionsMap: Map<string, any[]>,
  dependenciesMap: Map<string, any[]>,
  reasonCodeLabels: Map<string, string>
): TenancyPerson {
  const sections = sectionsMap.get(reference.id)

  const sectionStatuses = getSectionStatusesFromData(sections)
  const actionRequiredTasks = reference.verification_state === 'ACTION_REQUIRED'
    ? getActionRequiredTasksFromData(sections, dependenciesMap.get(reference.id), reasonCodeLabels)
    : []

  return {
    id: reference.id,
    role: reference.is_guarantor ? 'GUARANTOR' : 'TENANT',
    name: `${decrypt(reference.tenant_first_name_encrypted) || ''} ${decrypt(reference.tenant_last_name_encrypted) || ''}`.trim(),
    email: decrypt(reference.tenant_email_encrypted) || '',
    phone: decrypt(reference.tenant_phone_encrypted) || '',
    rentShare: reference.rent_share || 0,
    verificationState: reference.verification_state,  // Direct from database
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
  const actionRequiredPeople = people.filter(p => p.verificationState === 'ACTION_REQUIRED')
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
  const awaitingVerification = people.filter(p => p.verificationState === 'READY_FOR_REVIEW' || p.verificationState === 'IN_VERIFICATION')
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

  // Priority 4: Collecting evidence (not started yet)
  const collectingEvidence = people.filter(p => p.verificationState === 'COLLECTING_EVIDENCE')
  if (collectingEvidence.length > 0) {
    const person = collectingEvidence[0]
    const formType = person.role === 'TENANT' ? 'Tenant Form' : 'Guarantor Form'
    if (collectingEvidence.length > 1) {
      return `Waiting: ${person.name} - ${formType} In Progress +${collectingEvidence.length - 1} more`
    }
    return `Waiting: ${person.name} - ${formType} In Progress`
  }

  // Priority 5: Waiting on references
  const waitingOnRefs = people.filter(p => p.verificationState === 'WAITING_ON_REFERENCES')
  if (waitingOnRefs.length > 0) {
    const person = waitingOnRefs[0]
    if (waitingOnRefs.length > 1) {
      return `Waiting: ${person.name} - Awaiting References +${waitingOnRefs.length - 1} more`
    }
    return `Waiting: ${person.name} - Awaiting References`
  }

  return ''
}

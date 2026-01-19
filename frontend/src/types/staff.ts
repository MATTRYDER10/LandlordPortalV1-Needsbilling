// Staff Portal Types for Verify/Chase System Rebuild

// ============================================================================
// SECTION TYPES
// ============================================================================

export type SectionDecision = 'NOT_REVIEWED' | 'PASS' | 'PASS_WITH_CONDITION' | 'ACTION_REQUIRED' | 'FAIL'

export type TenantSectionType = 'IDENTITY_SELFIE' | 'RTR' | 'INCOME' | 'RESIDENTIAL' | 'CREDIT' | 'AML'
export type GuarantorSectionType = 'IDENTITY_SELFIE' | 'INCOME' | 'CREDIT' | 'AML'
export type ExternalReferenceSectionType = 'EMPLOYER_REFERENCE' | 'LANDLORD_REFERENCE' | 'ACCOUNTANT_REFERENCE'
export type SectionType = TenantSectionType | GuarantorSectionType | ExternalReferenceSectionType

export type PersonType = 'TENANT' | 'GUARANTOR'

export type FinalDecision = 'PASS' | 'PASS_WITH_CONDITION' | 'PASS_WITH_GUARANTOR' | 'REFER' | 'FAIL'

export type Urgency = 'NORMAL' | 'WARNING' | 'URGENT'

// Verification state (explicit state machine for verify queue)
export type VerificationState =
  | 'SENT'
  | 'COLLECTING_EVIDENCE'
  | 'WAITING_ON_REFERENCES'
  | 'READY_FOR_REVIEW'
  | 'IN_VERIFICATION'
  | 'ACTION_REQUIRED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'

// ============================================================================
// VERIFICATION SECTION
// ============================================================================

export interface VerificationSection {
  id: string
  referenceId: string
  personType: PersonType
  sectionType: SectionType
  sectionOrder: number
  decision: SectionDecision
  decisionNotes?: string
  decisionBy?: string
  decisionAt?: string
  conditionText?: string
  actionReasonCode?: string
  actionAgentNote?: string
  actionInternalNote?: string
  failReason?: string
  correctionCycle: number
  evidenceSources: EvidenceSource[]
  evidenceFiles: EvidenceFile[]
  checks: SectionCheck[]
  scoreImpact: number
  createdAt: string
  updatedAt: string
}

export interface EvidenceSource {
  sourceType: string
  sourceId?: string
  verified?: boolean
  verifiedAt?: string
  verifiedBy?: string
}

export interface EvidenceFile {
  fileId: string
  fileName: string
  uploadedAt: string
}

export interface SectionCheck {
  name: string
  result: 'pass' | 'fail' | 'na'
  notes?: string
  checkedAt?: string
  checkedBy?: string
}

// ============================================================================
// VERIFY QUEUE
// ============================================================================

export interface VerifyQueueItem {
  id: string
  referenceId: string
  workType: 'VERIFY'
  status: 'AVAILABLE' | 'ASSIGNED' | 'IN_PROGRESS' | 'RETURNED'
  verificationState: VerificationState
  priority: number
  urgency: Urgency
  urgencyReason?: string
  hoursInQueue: number
  createdAt: string
  assignedTo?: string
  assignedAt?: string
  assignedStaffName?: string
  person: {
    name: string
    email: string
    role: PersonType
  }
  property: {
    address: string
  }
  company: {
    name: string
  }
}

// ============================================================================
// CHASE TYPES
// ============================================================================

export type DependencyType = 'TENANT_FORM' | 'GUARANTOR_FORM' | 'EMPLOYER_REF' | 'RESIDENTIAL_REF' | 'ACCOUNTANT_REF'
export type DependencyStatus = 'PENDING' | 'CHASING' | 'RECEIVED' | 'EXHAUSTED' | 'ACTION_REQUIRED'

export type ContactType = 'tenant' | 'guarantor' | 'employer' | 'landlord' | 'accountant' | 'agent'

export interface ChaseDependency {
  id: string
  referenceId: string
  dependencyType: DependencyType
  status: DependencyStatus
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  initialRequestSentAt?: string
  lastChaseSentAt?: string
  nextChaseDueAt?: string
  chaseCycle: number
  emailAttempts: number
  smsAttempts: number
  linkedTable?: string
  linkedRecordId?: string
  createdAt: string
  updatedAt: string
}

export interface ChaseQueueItem extends ChaseDependency {
  tenantName: string
  propertyAddress: string
  companyName: string
  daysSinceRequest: number
  urgency: Urgency
}

// ============================================================================
// EMAIL ISSUES
// ============================================================================

export interface EmailIssueItem {
  id: string
  referenceId: string
  personName: string
  personRole: PersonType
  contactType: ContactType
  email: string
  issueType: 'bounced' | 'complained'
  errorMessage?: string
  propertyAddress: string
  companyName: string
  createdAt: string
}

// ============================================================================
// SOFT LOCKING
// ============================================================================

export interface SoftLock {
  id: string
  workItemId: string
  lockedBy: string
  lockedByName: string
  lockedAt: string
  expiresAt: string
}

export interface LockStatus {
  isLocked: boolean
  lock?: SoftLock & { isExpired: boolean }
  isLockedByMe: boolean
}

// ============================================================================
// WORK ITEM
// ============================================================================

export interface WorkItem {
  id: string
  referenceId: string
  workType: 'VERIFY' | 'CHASE'
  status: 'AVAILABLE' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'RETURNED'
  priority: number
  assignedTo?: string
  assignedAt?: string
  cooldownUntil?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
  urgency?: Urgency
  urgencyReason?: string
  dependencyId?: string
}

// ============================================================================
// ACTION REASON CODES
// ============================================================================

export interface ActionReasonCode {
  code: string
  displayLabel: string
  defaultAgentMessage: string
}

// ============================================================================
// VERIFICATION PROGRESS
// ============================================================================

export interface VerificationProgress {
  totalSections: number
  completedSections: number
  sectionsWithIssues: number
  canFinalize: boolean
  hasActionRequired: boolean
  hasFail: boolean
  sections: Array<{
    type: SectionType
    decision: SectionDecision
  }>
}

// ============================================================================
// QUEUE STATS
// ============================================================================

export interface QueueStats {
  chase: {
    available: number
    assigned: number
    inProgress: number
    myItems: number
    total: number
  }
  verify: {
    available: number
    assigned: number
    inProgress: number
    awaitingDocs: number
    myItems: number
    total: number
  }
  emailIssues: {
    total: number
  }
}

// ============================================================================
// ACTIVE TASK (Unified view)
// ============================================================================

export interface ActiveTask {
  id: string
  referenceId: string
  workType: 'VERIFY' | 'CHASE'
  status: string
  personName: string
  personRole: PersonType
  propertyAddress: string
  urgency: Urgency
  hoursInQueue: number
  createdAt: string
  // For CHASE
  dependencyType?: DependencyType
  dependencyStatus?: DependencyStatus
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getSectionLabel(type: SectionType): string {
  const labels: Record<SectionType, string> = {
    IDENTITY_SELFIE: 'Identity & Selfie',
    RTR: 'Right to Rent',
    INCOME: 'Income & Affordability',
    RESIDENTIAL: 'Residential',
    CREDIT: 'Credit',
    AML: 'AML / PEP / Sanctions',
    EMPLOYER_REFERENCE: 'Employer Reference',
    LANDLORD_REFERENCE: 'Landlord Reference',
    ACCOUNTANT_REFERENCE: 'Accountant Reference'
  }
  return labels[type] || type
}

export function getDecisionColor(decision: SectionDecision): string {
  const colors: Record<SectionDecision, string> = {
    NOT_REVIEWED: 'gray',
    PASS: 'green',
    PASS_WITH_CONDITION: 'amber',
    ACTION_REQUIRED: 'orange',
    FAIL: 'red'
  }
  return colors[decision] || 'gray'
}

export function getUrgencyColor(urgency: Urgency): string {
  const colors: Record<Urgency, string> = {
    NORMAL: 'green',
    WARNING: 'yellow',
    URGENT: 'red'
  }
  return colors[urgency] || 'green'
}

export function getDependencyTypeLabel(type: DependencyType): string {
  const labels: Record<DependencyType, string> = {
    TENANT_FORM: 'Tenant Form',
    GUARANTOR_FORM: 'Guarantor Form',
    EMPLOYER_REF: 'Employer Reference',
    RESIDENTIAL_REF: 'Residential Reference',
    ACCOUNTANT_REF: 'Accountant Reference'
  }
  return labels[type] || type
}

export function getVerificationStateLabel(state: VerificationState): string {
  const labels: Record<VerificationState, string> = {
    SENT: 'Sent',
    COLLECTING_EVIDENCE: 'Collecting Evidence',
    WAITING_ON_REFERENCES: 'Waiting on References',
    READY_FOR_REVIEW: 'Ready for Review',
    IN_VERIFICATION: 'In Verification',
    ACTION_REQUIRED: 'Action Required',
    COMPLETED: 'Completed',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled'
  }
  return labels[state] || state
}

export function getVerificationStateColor(state: VerificationState): string {
  const colors: Record<VerificationState, string> = {
    SENT: 'gray',
    COLLECTING_EVIDENCE: 'gray',
    WAITING_ON_REFERENCES: 'yellow',
    READY_FOR_REVIEW: 'blue',
    IN_VERIFICATION: 'purple',
    ACTION_REQUIRED: 'orange',
    COMPLETED: 'green',
    REJECTED: 'red',
    CANCELLED: 'gray'
  }
  return colors[state] || 'gray'
}

export function getContactTypeLabel(type: ContactType): string {
  const labels: Record<ContactType, string> = {
    tenant: 'Tenant',
    guarantor: 'Guarantor',
    employer: 'Employer',
    landlord: 'Landlord',
    accountant: 'Accountant',
    agent: 'Agent'
  }
  return labels[type] || type
}

/**
 * Section 8 Notice Generator Types
 */

export interface Address {
  line1: string
  line2?: string
  town: string
  county?: string
  postcode: string
}

export type RentFrequency = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly'
export type ServiceMethod = 'email' | 'first_class_post' | 'personal_service' | 'email_and_post'
export type SignatoryCapacity = 'landlord' | 'agent' | 'joint_landlord'

export interface S8Ground {
  id: string
  number: string
  type: 'mandatory' | 'discretionary'
  noticePeriodDays: number
  noticePeriodLabel: string
  title: string
  statutoryWording: string
  staffGuidance: string
}

export interface ArrearsRow {
  id: string
  period: string
  dueDate: string
  amountDue: number
  amountPaid: number
  paidDate: string
  balance: number
}

export interface S8FormState {
  // Step 1 - Tenant Details
  tenantNames: string[]
  propertyAddress: Address
  tenantEmail: string
  tenantPhone: string

  // Step 2 - Landlord Details
  landlordNames: string[]
  landlordAddress: Address
  servedByAgent: boolean
  agentName: string
  agentAddress: Address

  // Step 3 - Tenancy Details
  tenancyStartDate: string
  rentAmount: number | null
  rentFrequency: RentFrequency | null
  rentDueDay: string

  // Step 4 - Grounds
  selectedGroundIds: string[]
  serviceDate: string
  earliestCourtDate: string | null
  longestNoticeGround: string | null
  noticeExplanation: string | null

  // Step 5 - Arrears (conditional)
  arrearsRows: ArrearsRow[]
  arrearsNotes: string

  // Step 6 - Ground Explanations
  groundExplanations: Record<string, string>

  // Step 7 - Service Details
  serviceMethod: ServiceMethod | null
  emailServedTo: string
  signatoryName: string
  signatoryCapacity: SignatoryCapacity | null
  signature: string
  signatureMethod: 'draw' | 'type'

  // UI State
  currentStep: number
  pgDataLoaded: boolean
  pgDataAvailable: boolean
}

export interface StepValidation {
  isValid: boolean
  errors: string[]
}

export const STEP_TITLES = [
  'Tenant',
  'Landlord',
  'Tenancy',
  'Grounds',
  'Arrears',
  'Explanations',
  'Service',
  'Review',
]

export const ARREARS_GROUNDS = ['ground-8', 'ground-10', 'ground-11']

export function createEmptyAddress(): Address {
  return {
    line1: '',
    line2: '',
    town: '',
    county: '',
    postcode: '',
  }
}

export function createInitialFormState(): S8FormState {
  const today = new Date().toISOString().split('T')[0]!

  return {
    // Step 1
    tenantNames: [''],
    propertyAddress: createEmptyAddress(),
    tenantEmail: '',
    tenantPhone: '',

    // Step 2
    landlordNames: [''],
    landlordAddress: createEmptyAddress(),
    servedByAgent: true,
    agentName: '',
    agentAddress: createEmptyAddress(),

    // Step 3
    tenancyStartDate: '',
    rentAmount: null,
    rentFrequency: 'monthly',
    rentDueDay: '',

    // Step 4
    selectedGroundIds: [],
    serviceDate: today,
    earliestCourtDate: null,
    longestNoticeGround: null,
    noticeExplanation: null,

    // Step 5
    arrearsRows: [],
    arrearsNotes: '',

    // Step 6
    groundExplanations: {},

    // Step 7
    serviceMethod: 'first_class_post',
    emailServedTo: '',
    signatoryName: '',
    signatoryCapacity: 'agent',
    signature: '',
    signatureMethod: 'type',

    // UI
    currentStep: 1,
    pgDataLoaded: false,
    pgDataAvailable: false,
  }
}

export function getStepCount(formState: S8FormState): number {
  // Step 5 (Arrears) only shows if arrears grounds are selected
  const hasArrearsGround = formState.selectedGroundIds.some(id => ARREARS_GROUNDS.includes(id))
  return hasArrearsGround ? 8 : 7
}

export function getActualStep(formState: S8FormState, displayStep: number): number {
  const hasArrearsGround = formState.selectedGroundIds.some(id => ARREARS_GROUNDS.includes(id))

  if (!hasArrearsGround && displayStep >= 5) {
    // Skip step 5 (Arrears) if no arrears grounds selected
    return displayStep + 1
  }
  return displayStep
}

export function getDisplayStep(formState: S8FormState, actualStep: number): number {
  const hasArrearsGround = formState.selectedGroundIds.some(id => ARREARS_GROUNDS.includes(id))

  if (!hasArrearsGround && actualStep >= 6) {
    // Adjust display step when arrears step is hidden
    return actualStep - 1
  }
  return actualStep
}

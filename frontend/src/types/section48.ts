// Section 48 Notice Types - Landlord and Tenant Act 1987
// Address for Service of Notices

export interface Address {
  line1: string
  line2?: string
  city: string
  county?: string
  postcode: string
  country?: string
}

export type AddressForServiceType = 'agent' | 'landlord' | 'other'

export type ReasonForServing =
  | 'first_service'
  | 'address_changed'
  | 'change_of_agent'
  | 'precautionary'
  | 'other'

export const REASON_LABELS: Record<ReasonForServing, string> = {
  first_service: 'First service — address not previously provided',
  address_changed: 'Address has changed — landlord/agent has moved',
  change_of_agent: 'Change of managing agent',
  precautionary: 'Precautionary re-service before legal proceedings',
  other: 'Other'
}

export type SignatoryCapacity =
  | 'agent_for_landlord'
  | 'landlord'
  | 'authorised_agent'
  | 'custom'

export const SIGNATORY_CAPACITY_LABELS: Record<SignatoryCapacity, string> = {
  agent_for_landlord: 'For and on behalf of {agentName}, Letting Agents for the Landlord',
  landlord: 'Landlord',
  authorised_agent: 'Authorised Agent for the Landlord',
  custom: 'Custom'
}

export interface TenantEmailTarget {
  name: string
  email: string
  selected: boolean
}

export interface Section48FormState {
  // Step 1 - Address for Service
  addressForServiceType: AddressForServiceType
  addressForService: Address
  addressForServiceName: string // "RG Property Bristol" or landlord name or custom
  reasonForServing: ReasonForServing
  reasonForServingCustom?: string

  // Step 2 - Landlord Details
  landlordNames: string[]
  isCompanyLandlord: boolean
  companyRegisteredName?: string
  companyRegistrationNumber?: string
  landlordAddress: Address

  // Step 3 - Tenant & Property
  tenantNames: string[]
  propertyAddress: Address
  tenancyStartDate: string
  dateOfNotice: string // defaults to today

  // Step 4 - Review & Generate
  signatoryName: string
  signatoryCapacity: SignatoryCapacity
  signatoryCapacityCustom?: string
  sendToTenants: boolean
  tenantEmailTargets: TenantEmailTarget[]
  sendCopyToLandlord: boolean
  landlordEmail?: string
  ccToOffice: boolean
  officeEmail: string
  additionalRecipients: string

  // UI State
  currentStep: number
  isLoading: boolean
  isGenerating: boolean
  isSending: boolean
  error?: string
}

export interface Section48GenerateRequest {
  tenancyId: string
  propertyId: string

  // Address for service
  addressForServiceType: AddressForServiceType
  addressForService: Address
  addressForServiceName: string
  reasonForServing: ReasonForServing
  reasonForServingCustom?: string

  // Landlord
  landlordNames: string[]
  isCompanyLandlord: boolean
  companyRegisteredName?: string
  companyRegistrationNumber?: string
  landlordAddress: Address

  // Tenant & Property
  tenantNames: string[]
  propertyAddress: Address
  tenancyStartDate: string
  dateOfNotice: string

  // Signatory
  signatoryName: string
  signatoryCapacity: string

  // Email options
  sendToTenants: boolean
  tenantEmails: string[]
  sendCopyToLandlord: boolean
  landlordEmail?: string
  ccToOffice: boolean
  officeEmail?: string
  additionalRecipients?: string[]
}

export interface Section48GenerateResponse {
  success: boolean
  noticeId?: string
  documentId?: string
  documentRef?: string
  fileUrl?: string
  filename?: string
  emailsSent?: {
    tenants: string[]
    landlord?: string
    cc?: string[]
  }
  emailStatus: 'sent' | 'failed' | 'not-sent'
  error?: string
}

export interface Section48Notice {
  id: string
  tenancyId: string
  propertyId: string
  documentRef: string
  addressForService: Address
  addressForServiceName: string
  reasonForServing: string
  landlordNames: string[]
  tenantNames: string[]
  dateOfNotice: string
  signatoryName: string
  signatoryCapacity: string
  documentId?: string
  fileUrl?: string
  emailsSentTo: string[]
  emailStatus: 'sent' | 'failed' | 'not-sent'
  createdAt: string
  createdBy: string
}

// Validation helpers
export function isValidEnglandWalesPostcode(postcode: string): boolean {
  if (!postcode) return false
  const cleaned = postcode.toUpperCase().replace(/\s/g, '')
  // England and Wales postcodes - exclude Scottish (AB, DD, DG, EH, FK, G, HS, IV, KA, KW, KY, ML, PA, PH, TD, ZE)
  // and Northern Ireland (BT)
  const scottishPrefixes = ['AB', 'DD', 'DG', 'EH', 'FK', 'HS', 'IV', 'KA', 'KW', 'KY', 'ML', 'PA', 'PH', 'TD', 'ZE']
  const niPrefix = 'BT'

  // Check if it starts with a Scottish or NI prefix
  for (const prefix of scottishPrefixes) {
    if (cleaned.startsWith(prefix)) return false
  }
  if (cleaned.startsWith(niPrefix)) return false

  // Special case for Glasgow (G postcode) - check if it's just G followed by number
  if (/^G\d/.test(cleaned)) return false

  return true
}

export function isPOBox(address: string): boolean {
  if (!address) return false
  return /p\.?o\.?\s*box/i.test(address)
}

export function formatAddress(address: Address): string {
  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.county,
    address.postcode
  ].filter(Boolean)
  return parts.join(', ')
}

export function formatAddressMultiline(address: Address): string[] {
  return [
    address.line1,
    address.line2,
    address.city,
    address.county,
    address.postcode
  ].filter(Boolean) as string[]
}

export const INITIAL_FORM_STATE: Section48FormState = {
  addressForServiceType: 'agent',
  addressForService: {
    line1: '',
    city: '',
    postcode: ''
  },
  addressForServiceName: '',
  reasonForServing: 'first_service',

  landlordNames: [],
  isCompanyLandlord: false,
  landlordAddress: {
    line1: '',
    city: '',
    postcode: ''
  },

  tenantNames: [],
  propertyAddress: {
    line1: '',
    city: '',
    postcode: ''
  },
  tenancyStartDate: '',
  dateOfNotice: new Date().toISOString().split('T')[0],

  signatoryName: '',
  signatoryCapacity: 'agent_for_landlord',
  sendToTenants: true,
  tenantEmailTargets: [],
  sendCopyToLandlord: false,
  ccToOffice: true,
  officeEmail: '',
  additionalRecipients: '',

  currentStep: 1,
  isLoading: false,
  isGenerating: false,
  isSending: false
}

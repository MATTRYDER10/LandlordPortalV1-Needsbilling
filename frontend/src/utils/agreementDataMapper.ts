/**
 * Agreement Data Mapper
 * Converts between database format (snake_case) and frontend form format (camelCase)
 */

export interface Address {
  line1: string
  line2?: string
  city: string
  county?: string
  postcode: string
}

export interface Party {
  name: string
  email?: string
  address: Address
}

export interface AgreementFormData {
  language: 'english' | 'welsh'
  templateType: string
  propertyAddress: Address
  rentAmount?: number
  depositAmount?: number
  tenancyStartDate?: string
  tenancyTerm: string | number
  tenancyEndDate?: string
  rentDueDay: string
  depositSchemeType: string
  permittedOccupiers?: string
  managementType: 'managed' | 'let_only'
  agentSignsOnBehalf: boolean
  tenantEmail?: string
  landlordEmail?: string
  agentEmail?: string
  bankAccountName?: string
  bankAccountNumber?: string
  bankSortCode?: string
  paymentReference?: string
  breakClauseEnabled: boolean
  breakClauseMonths?: number | null
  breakClauseNoticePeriod?: number | null
  breakClause?: string
  specialClauses?: string
  billsIncluded: boolean
  landlords: Party[]
  tenants: Party[]
  guarantors: Party[]
}

export interface DatabaseAgreement {
  id: string
  company_id: string
  reference_id?: string
  template_type: string
  language?: string
  property_address: Address
  landlords: Party[]
  tenants: Party[]
  guarantors?: Party[]
  deposit_amount?: number
  rent_amount?: number
  tenancy_start_date?: string
  tenancy_end_date?: string
  rent_due_day?: string
  deposit_scheme_type?: string
  permitted_occupiers?: string
  bank_account_name?: string
  bank_account_number?: string
  bank_sort_code?: string
  payment_reference?: string
  tenant_email?: string
  landlord_email?: string
  agent_email?: string
  management_type?: string
  agent_signs_on_behalf?: boolean
  break_clause?: string
  special_clauses?: string
  bills_included?: boolean
  pdf_url?: string
  pdf_generated_at?: string
  signing_status?: string
  created_at: string
  updated_at?: string
}

/**
 * Get default form data for a new agreement
 */
export function getDefaultFormData(): AgreementFormData {
  return {
    language: 'english',
    templateType: '',
    propertyAddress: {
      line1: '',
      line2: '',
      city: '',
      county: '',
      postcode: ''
    },
    rentAmount: undefined,
    depositAmount: undefined,
    tenancyStartDate: '',
    tenancyTerm: 12,
    tenancyEndDate: '',
    rentDueDay: '1st',
    depositSchemeType: '',
    permittedOccupiers: '',
    managementType: 'let_only',
    agentSignsOnBehalf: false,
    tenantEmail: '',
    landlordEmail: '',
    agentEmail: '',
    bankAccountName: '',
    bankAccountNumber: '',
    bankSortCode: '',
    paymentReference: '',
    breakClauseEnabled: false,
    breakClauseMonths: null,
    breakClauseNoticePeriod: null,
    breakClause: '',
    specialClauses: '',
    billsIncluded: false,
    landlords: [
      {
        name: '',
        address: { line1: '', line2: '', city: '', county: '', postcode: '' }
      }
    ],
    tenants: [
      {
        name: '',
        address: { line1: '', line2: '', city: '', county: '', postcode: '' }
      }
    ],
    guarantors: []
  }
}

/**
 * Convert database agreement to form data format
 */
export function agreementToFormData(agreement: DatabaseAgreement): AgreementFormData {
  // Calculate tenancy term from start and end dates if available
  let tenancyTerm: string | number = 12

  if (agreement.tenancy_start_date && agreement.tenancy_end_date) {
    const startDate = new Date(agreement.tenancy_start_date)
    const endDate = new Date(agreement.tenancy_end_date)
    const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
      (endDate.getMonth() - startDate.getMonth())
    tenancyTerm = monthsDiff > 0 ? monthsDiff : 12
  }

  // Determine if break clause is enabled
  const breakClauseEnabled = !!agreement.break_clause && agreement.break_clause.length > 0

  // Try to parse break clause months from the text if present
  let breakClauseMonths: number | null = null
  let breakClauseNoticePeriod: number | null = null

  if (agreement.break_clause) {
    // Try to extract months from break clause text
    const monthsMatch = agreement.break_clause.match(/after (\d+) months/)
    if (monthsMatch && monthsMatch[1]) {
      breakClauseMonths = parseInt(monthsMatch[1], 10)
    }
    const noticeMatch = agreement.break_clause.match(/(\d+) months['']? notice/)
    if (noticeMatch && noticeMatch[1]) {
      breakClauseNoticePeriod = parseInt(noticeMatch[1], 10)
    }
  }

  return {
    language: (agreement.language as 'english' | 'welsh') || 'english',
    templateType: agreement.template_type || '',
    propertyAddress: agreement.property_address || {
      line1: '',
      line2: '',
      city: '',
      county: '',
      postcode: ''
    },
    rentAmount: agreement.rent_amount,
    depositAmount: agreement.deposit_amount,
    tenancyStartDate: agreement.tenancy_start_date || '',
    tenancyTerm,
    tenancyEndDate: agreement.tenancy_end_date,
    rentDueDay: agreement.rent_due_day || '1st',
    depositSchemeType: agreement.deposit_scheme_type || '',
    permittedOccupiers: agreement.permitted_occupiers || '',
    managementType: (agreement.management_type as 'managed' | 'let_only') || 'let_only',
    agentSignsOnBehalf: agreement.agent_signs_on_behalf ?? (agreement.management_type === 'managed'),
    tenantEmail: agreement.tenant_email || '',
    landlordEmail: agreement.landlord_email || '',
    agentEmail: agreement.agent_email || '',
    bankAccountName: agreement.bank_account_name || '',
    bankAccountNumber: agreement.bank_account_number || '',
    bankSortCode: agreement.bank_sort_code || '',
    paymentReference: agreement.payment_reference || '',
    breakClauseEnabled,
    breakClauseMonths,
    breakClauseNoticePeriod,
    breakClause: agreement.break_clause || '',
    specialClauses: agreement.special_clauses || '',
    billsIncluded: agreement.bills_included || false,
    landlords: agreement.landlords && agreement.landlords.length > 0
      ? agreement.landlords
      : [{ name: '', address: { line1: '', line2: '', city: '', county: '', postcode: '' } }],
    tenants: agreement.tenants && agreement.tenants.length > 0
      ? agreement.tenants
      : [{ name: '', address: { line1: '', line2: '', city: '', county: '', postcode: '' } }],
    guarantors: agreement.guarantors || []
  }
}

/**
 * Convert form data to API request format
 */
export function formDataToAgreementRequest(formData: AgreementFormData): Record<string, any> {
  return {
    language: formData.language,
    templateType: formData.templateType,
    propertyAddress: formData.propertyAddress,
    landlords: formData.landlords,
    tenants: formData.tenants,
    guarantors: formData.guarantors,
    rentAmount: formData.rentAmount,
    depositAmount: formData.depositAmount,
    tenancyStartDate: formData.tenancyStartDate,
    tenancyEndDate: formData.tenancyEndDate,
    rentDueDay: formData.rentDueDay,
    depositSchemeType: formData.depositSchemeType,
    permittedOccupiers: formData.permittedOccupiers,
    managementType: formData.managementType,
    agentSignsOnBehalf: formData.agentSignsOnBehalf,
    tenantEmail: formData.tenantEmail,
    landlordEmail: formData.landlordEmail,
    agentEmail: formData.agentEmail,
    bankAccountName: formData.bankAccountName,
    bankAccountNumber: formData.bankAccountNumber,
    bankSortCode: formData.bankSortCode,
    paymentReference: formData.paymentReference,
    breakClause: formData.breakClause,
    specialClauses: formData.specialClauses,
    billsIncluded: formData.billsIncluded
  }
}

/**
 * Validate form data completeness for a specific step
 */
export function validateStep(formData: AgreementFormData, step: number): boolean {
  switch (step) {
    case 1: // Template
      return !!formData.templateType
    case 2: // Property Address
      return !!(
        formData.propertyAddress.line1 &&
        formData.propertyAddress.city &&
        formData.propertyAddress.postcode
      )
    case 3: // Agreement Details
      return !!(
        formData.rentAmount &&
        formData.tenancyStartDate &&
        formData.tenancyTerm
      )
    case 4: // Landlords
      return formData.landlords.length > 0 &&
        formData.landlords.every(l =>
          l.name &&
          l.address.line1 &&
          l.address.city &&
          l.address.postcode
        )
    case 5: // Tenants
      return formData.tenants.length > 0 &&
        formData.tenants.every(t =>
          t.name &&
          t.address.line1 &&
          t.address.city &&
          t.address.postcode
        )
    case 6: // Guarantors (optional step)
      return true
    default:
      return true
  }
}

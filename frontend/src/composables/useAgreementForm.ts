/**
 * Shared composable for agreement form logic
 * Used by both Agreements.vue and TenancyAgreementModal.vue
 */
import { ref, computed, watch } from 'vue'
import {
  type AgreementFormData,
  type Party,
  type Address,
  getDefaultFormData,
  formDataToAgreementRequest
} from '@/utils/agreementDataMapper'

export interface UseAgreementFormOptions {
  initialData?: Partial<AgreementFormData>
}

export function useAgreementForm(options: UseAgreementFormOptions = {}) {
  // Form data
  const formData = ref<AgreementFormData>({
    ...getDefaultFormData(),
    ...options.initialData
  })

  // Track manual edits
  const depositManuallyEdited = ref(false)
  const endDateManuallyEdited = ref(false)

  // Template options
  const templateOptions = [
    { value: 'ast', label: 'Assured Shorthold Tenancy (AST)' },
    { value: 'company_let', label: 'Company Let' },
    { value: 'lodger', label: 'Lodger Agreement' }
  ]

  const depositSchemeOptions = [
    { value: 'dps_custodial', label: 'DPS Custodial' },
    { value: 'dps_insured', label: 'DPS Insured' },
    { value: 'mydeposits_custodial', label: 'MyDeposits Custodial' },
    { value: 'mydeposits_insured', label: 'MyDeposits Insured' },
    { value: 'tds_custodial', label: 'TDS Custodial' },
    { value: 'tds_insured', label: 'TDS Insured' },
    { value: 'landlord_held', label: 'Landlord Held' },
    { value: 'reposit', label: 'Reposit (Deposit-free)' },
    { value: 'no_deposit', label: 'No Deposit' }
  ]

  const rentDueDayOptions = [
    '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th',
    '11th', '12th', '13th', '14th', '15th', '16th', '17th', '18th', '19th', '20th',
    '21st', '22nd', '23rd', '24th', '25th', '26th', '27th', '28th', '29th', '30th', '31st', 'Last'
  ]

  // Computed: Auto-calculate deposit (5 weeks rent)
  const calculatedDeposit = computed(() => {
    if (formData.value.rentAmount && formData.value.rentAmount > 0) {
      return Math.round((formData.value.rentAmount * 12 / 52) * 5 * 100) / 100
    }
    return 0
  })

  // Auto-update deposit when rent changes (if not manually edited)
  watch(() => formData.value.rentAmount, (newRent) => {
    if (!depositManuallyEdited.value && newRent && newRent > 0) {
      formData.value.depositAmount = calculatedDeposit.value
    }
  })

  // Computed: Calculate end date from start date + term
  const calculatedEndDate = computed(() => {
    if (!formData.value.tenancyStartDate || !formData.value.tenancyTerm) {
      return ''
    }
    const term = Number(formData.value.tenancyTerm)
    if (term === 0) return '' // Rolling tenancy

    const startDate = new Date(formData.value.tenancyStartDate)
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + term)
    endDate.setDate(endDate.getDate() - 1) // End date is day before next period
    return endDate.toISOString().split('T')[0]
  })

  // Auto-update end date when start date or term changes (if not manually edited)
  watch([() => formData.value.tenancyStartDate, () => formData.value.tenancyTerm], () => {
    if (!endDateManuallyEdited.value && calculatedEndDate.value) {
      formData.value.tenancyEndDate = calculatedEndDate.value
    }
  })

  // Computed: Generated break clause text
  const generatedBreakClause = computed(() => {
    if (!formData.value.breakClauseEnabled) return ''
    const months = formData.value.breakClauseMonths
    const notice = formData.value.breakClauseNoticePeriod
    if (!months || !notice) return ''

    return `Either party may terminate this tenancy after ${months} months from the start date by giving at least ${notice} months' written notice to the other party. The notice must expire on or after the end of the initial ${months} month period.`
  })

  // Auto-update break clause text when parameters change
  watch([
    () => formData.value.breakClauseEnabled,
    () => formData.value.breakClauseMonths,
    () => formData.value.breakClauseNoticePeriod
  ], () => {
    if (formData.value.breakClauseEnabled && generatedBreakClause.value) {
      formData.value.breakClause = generatedBreakClause.value
      console.log('[AgreementForm] Break clause updated:', generatedBreakClause.value.substring(0, 50) + '...')
    } else if (!formData.value.breakClauseEnabled) {
      formData.value.breakClause = ''
    }
  }, { immediate: true })

  // Party management methods
  const createEmptyParty = (): Party => ({
    name: '',
    email: '',
    address: {
      line1: '',
      line2: '',
      city: '',
      county: '',
      postcode: ''
    },
    bankAccountName: '',
    bankAccountNumber: '',
    bankSortCode: ''
  })

  const addLandlord = () => {
    if (formData.value.landlords.length < 20) {
      formData.value.landlords.push(createEmptyParty())
    }
  }

  const removeLandlord = (index: number) => {
    if (formData.value.landlords.length > 1) {
      formData.value.landlords.splice(index, 1)
    }
  }

  const addTenant = () => {
    if (formData.value.tenants.length < 20) {
      formData.value.tenants.push(createEmptyParty())
    }
  }

  const removeTenant = (index: number) => {
    if (formData.value.tenants.length > 1) {
      formData.value.tenants.splice(index, 1)
    }
  }

  const addGuarantor = () => {
    if (formData.value.guarantors.length < 20) {
      formData.value.guarantors.push(createEmptyParty())
    }
  }

  const removeGuarantor = (index: number) => {
    formData.value.guarantors.splice(index, 1)
  }

  // Address handlers
  const handleAddressSelected = (
    target: 'property' | 'landlord' | 'tenant' | 'guarantor',
    index: number | null,
    addressData: { line1: string; city: string; postcode: string; county?: string }
  ) => {
    const address: Address = {
      line1: addressData.line1 || '',
      line2: '',
      city: addressData.city || '',
      county: addressData.county || '',
      postcode: addressData.postcode || ''
    }

    switch (target) {
      case 'property':
        formData.value.propertyAddress = address
        break
      case 'landlord':
        if (index !== null && formData.value.landlords[index]) {
          formData.value.landlords[index].address = address
        }
        break
      case 'tenant':
        if (index !== null && formData.value.tenants[index]) {
          formData.value.tenants[index].address = address
        }
        break
      case 'guarantor':
        if (index !== null && formData.value.guarantors[index]) {
          formData.value.guarantors[index].address = address
        }
        break
    }
  }

  // Validation
  const isValidEmail = (email: string): boolean => {
    if (!email) return false
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const validatePropertyAddress = computed(() => {
    const addr = formData.value.propertyAddress
    return !!(addr.line1 && addr.city && addr.postcode)
  })

  const validateDetails = computed(() => {
    const fd = formData.value
    const basicValid = !!(
      fd.rentAmount && fd.rentAmount > 0 &&
      fd.depositAmount !== undefined && fd.depositAmount >= 0 &&
      fd.tenancyStartDate &&
      fd.tenancyTerm !== undefined &&
      fd.rentDueDay &&
      fd.depositSchemeType
    )

    // If break clause enabled, must have months and notice period
    if (fd.breakClauseEnabled) {
      if (!fd.breakClauseMonths || !fd.breakClauseNoticePeriod) {
        return false
      }
    }

    // If let_only, require landlord email and bank details
    if (fd.managementType === 'let_only') {
      if (!fd.landlordEmail || !isValidEmail(fd.landlordEmail)) return false
      if (!fd.bankAccountName || !fd.bankAccountNumber || !fd.bankSortCode) return false
    }

    return basicValid
  })

  const validateLandlords = computed(() => {
    if (formData.value.landlords.length === 0) return false
    return formData.value.landlords.every(l =>
      l.name &&
      l.email &&
      isValidEmail(l.email) &&
      l.address.line1 &&
      l.address.city &&
      l.address.postcode
    )
  })

  const validateTenants = computed(() => {
    if (formData.value.tenants.length === 0) return false
    return formData.value.tenants.every(t =>
      t.name &&
      t.address.line1 &&
      t.address.city &&
      t.address.postcode
    )
  })

  const validateGuarantors = computed(() => {
    // Guarantors are optional, but if present, must be complete
    if (formData.value.guarantors.length === 0) return true
    return formData.value.guarantors.every(g =>
      g.name &&
      g.email &&
      isValidEmail(g.email) &&
      g.address.line1 &&
      g.address.city &&
      g.address.postcode
    )
  })

  const isFormValid = computed(() => {
    return (
      formData.value.templateType &&
      formData.value.depositSchemeType &&
      validatePropertyAddress.value &&
      validateDetails.value &&
      validateLandlords.value &&
      validateTenants.value &&
      validateGuarantors.value
    )
  })

  // Get API request data
  const getRequestData = () => {
    return formDataToAgreementRequest(formData.value)
  }

  // Reset form
  const resetForm = () => {
    formData.value = getDefaultFormData()
    depositManuallyEdited.value = false
    endDateManuallyEdited.value = false
  }

  // Pre-fill from tenancy data
  // Options can include landlords, specialClauses, tenantAddresses, and guarantorsData from separate sources
  const prefillFromTenancy = (tenancy: any, options?: {
    landlords?: any[],
    specialClauses?: string[],
    tenantAddresses?: Map<string, any>,
    guarantorsData?: any[]
  }) => {
    if (!tenancy) return

    // Property address
    if (tenancy.property) {
      formData.value.propertyAddress = {
        line1: tenancy.property.address_line1 || '',
        line2: tenancy.property.address_line2 || '',
        city: tenancy.property.city || '',
        county: tenancy.property.county || '',
        postcode: tenancy.property.postcode || ''
      }
    }

    // Dates and financials
    if (tenancy.start_date) formData.value.tenancyStartDate = tenancy.start_date
    if (tenancy.end_date) {
      formData.value.tenancyEndDate = tenancy.end_date
      endDateManuallyEdited.value = true
    }
    if (tenancy.monthly_rent) formData.value.rentAmount = tenancy.monthly_rent
    if (tenancy.deposit_amount) {
      formData.value.depositAmount = tenancy.deposit_amount
      depositManuallyEdited.value = true
    }
    if (tenancy.deposit_scheme) formData.value.depositSchemeType = tenancy.deposit_scheme
    if (tenancy.rent_due_day) formData.value.rentDueDay = `${tenancy.rent_due_day}${getOrdinalSuffix(tenancy.rent_due_day)}`
    if (tenancy.bills_included) formData.value.billsIncluded = tenancy.bills_included
    if (tenancy.tenancy_type) formData.value.templateType = tenancy.tenancy_type

    // Calculate term from dates if both present
    if (tenancy.start_date && tenancy.end_date) {
      const start = new Date(tenancy.start_date)
      const end = new Date(tenancy.end_date)
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
      formData.value.tenancyTerm = months > 0 ? months : 12
    }

    // Landlords - prefer options.landlords (from property), fall back to tenancy.landlords
    const landlordsList = options?.landlords || tenancy.landlords || []
    if (landlordsList.length > 0) {
      formData.value.landlords = landlordsList.map((ll: any) => ({
        name: ll.full_name || ll.name || '',
        email: ll.email || '',
        address: {
          line1: ll.address_line1 || ll.address?.line1 || '',
          line2: ll.address_line2 || ll.address?.line2 || '',
          city: ll.city || ll.address?.city || '',
          county: ll.county || ll.address?.county || '',
          postcode: ll.postcode || ll.address?.postcode || ''
        },
        bankAccountName: ll.bank_account_name || '',
        bankAccountNumber: ll.bank_account_number || '',
        bankSortCode: ll.bank_sort_code || ''
      }))
      // Set primary landlord email and bank details for form-level fields
      const primary = landlordsList.find((ll: any) => ll.is_primary_contact || ll.is_primary) || landlordsList[0]
      if (primary) {
        formData.value.landlordEmail = primary.email || ''
        formData.value.bankAccountName = primary.bank_account_name || ''
        formData.value.bankAccountNumber = primary.bank_account_number || ''
        formData.value.bankSortCode = primary.bank_sort_code || ''
      }
    }

    // Special clauses - from property
    if (options?.specialClauses && options.specialClauses.length > 0) {
      formData.value.specialClauses = options.specialClauses.join('\n\n')
    }

    // Tenants - use tenantAddresses map from reference data if available
    const tenantAddressMap = options?.tenantAddresses
    if (tenancy.tenants && tenancy.tenants.length > 0) {
      formData.value.tenants = tenancy.tenants.map((t: any) => {
        // Handle multiple field name patterns (first_name/last_name, tenant_first_name/tenant_last_name, or full name)
        const firstName = t.first_name || t.tenant_first_name || ''
        const lastName = t.last_name || t.tenant_last_name || ''
        const name = `${firstName} ${lastName}`.trim() || t.name || ''

        // Look up address from reference data by name
        const refAddress = tenantAddressMap?.get(name.toLowerCase())

        return {
          name,
          email: t.email || t.tenant_email || '',
          address: {
            // Check residential_ fields first (from tenancy_tenants), then reference data, then legacy fields
            line1: t.residential_address_line1 || refAddress?.line1 || t.current_address_line1 || t.address?.line1 || '',
            line2: t.residential_address_line2 || refAddress?.line2 || t.current_address_line2 || t.address?.line2 || '',
            city: t.residential_city || refAddress?.city || t.current_city || t.address?.city || '',
            county: refAddress?.county || t.current_county || t.address?.county || '',
            postcode: t.residential_postcode || refAddress?.postcode || t.current_postcode || t.address?.postcode || ''
          }
        }
      })
      // Set primary tenant email
      const lead = tenancy.tenants.find((t: any) => t.is_lead || t.is_lead_tenant) || tenancy.tenants[0]
      if (lead) {
        formData.value.tenantEmail = lead.email || ''
      }
    }

    // Guarantors - prefer options.guarantorsData (from reference), fall back to tenancy.guarantors
    const guarantorsList = options?.guarantorsData || tenancy.guarantors || []
    if (guarantorsList.length > 0) {
      formData.value.guarantors = guarantorsList.map((g: any) => ({
        name: `${g.first_name || ''} ${g.last_name || ''}`.trim() || g.name || '',
        email: g.email || '',
        address: {
          line1: g.current_address_line1 || g.address_line1 || g.address?.line1 || '',
          line2: g.current_address_line2 || g.address_line2 || g.address?.line2 || '',
          city: g.current_city || g.city || g.address?.city || '',
          county: g.current_county || g.county || g.address?.county || '',
          postcode: g.current_postcode || g.postcode || g.address?.postcode || ''
        }
      }))
    }

    // Management type (default to managed if agent is creating)
    formData.value.managementType = tenancy.management_type || 'managed'
  }

  return {
    // Data
    formData,
    depositManuallyEdited,
    endDateManuallyEdited,

    // Options
    templateOptions,
    depositSchemeOptions,
    rentDueDayOptions,

    // Computed values
    calculatedDeposit,
    calculatedEndDate,
    generatedBreakClause,

    // Validation
    validatePropertyAddress,
    validateDetails,
    validateLandlords,
    validateTenants,
    validateGuarantors,
    isFormValid,
    isValidEmail,

    // Party management
    addLandlord,
    removeLandlord,
    addTenant,
    removeTenant,
    addGuarantor,
    removeGuarantor,
    handleAddressSelected,

    // Methods
    getRequestData,
    resetForm,
    prefillFromTenancy
  }
}

// Helper function
function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  const idx = (v - 20) % 10
  if (idx >= 0 && idx < s.length && s[idx]) return s[idx]
  if (v >= 0 && v < s.length && s[v]) return s[v]
  return s[0] as string
}

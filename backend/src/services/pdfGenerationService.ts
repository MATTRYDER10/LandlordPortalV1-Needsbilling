import puppeteer from 'puppeteer'
import { marked } from 'marked'
import fs from 'fs'
import path from 'path'
import { BRAND_COLORS } from '../config/colors'

export type TemplateType = 'dps' | 'mydeposits' | 'tds' | 'no_deposit' | 'reposit'
export type Language = 'english' | 'welsh'

export interface Party {
  id?: string
  name: string
  email?: string
  address: {
    line1: string
    line2?: string
    city: string
    county?: string
    postcode: string
  }
  rentShare?: number
  guarantorForTenantId?: string
  guarantorForTenantName?: string
  guarantorRentShare?: number
}

export interface PropertyAddress {
  line1: string
  line2?: string
  city: string
  county?: string
  postcode: string
}

export interface SignatureData {
  signerType: 'landlord' | 'tenant' | 'guarantor'
  signerIndex: number
  signerName: string
  signatureImage: string // Base64 PNG
  signatureType: 'draw' | 'type'
  typedName?: string
  signedAt: string
  ipAddress: string
}

export interface AgreementPDFData {
  templateType: TemplateType
  language: Language
  propertyAddress: PropertyAddress
  landlords: Party[]
  tenants: Party[]
  guarantors: Party[]
  depositAmount?: number
  rentAmount?: number
  tenancyStartDate?: string
  tenancyEndDate?: string
  rentDueDay?: string
  depositSchemeType?: string
  permittedOccupiers?: string
  bankAccountName?: string
  bankAccountNumber?: string
  bankSortCode?: string
  paymentReference?: string
  tenantEmail?: string
  landlordEmail?: string
  agentEmail?: string
  managementType?: 'managed' | 'let_only'
  agreementType?: 'ast' | 'apta' | 'company_let' | 'lodger'
  breakClause?: string
  specialClauses?: string
  billsIncluded?: boolean
  billsIncludedUtilities?: string[]
  companyName?: string
  companyAddress?: PropertyAddress
  companyLogoUrl?: string
}

export interface PDFGenerationOptions {
  agreementData: AgreementPDFData
  signatures?: SignatureData[]
  includeAuditPage?: boolean
  agreementId?: string
}

// Template file mapping for English contracts
const ENGLISH_TEMPLATE_MAP: Record<TemplateType, { standard: string; guarantor: string }> = {
  dps: {
    standard: 'PGAST-DPS.md',
    guarantor: 'PGAST-DPS Guarantor.md'
  },
  mydeposits: {
    standard: 'PGAST-MyDep .md',
    guarantor: 'PGAST - MyDep - Guarantor.md'
  },
  tds: {
    standard: 'PGAST- TDS.md',
    guarantor: 'PGAST - TDS - GUARANTOR.md'
  },
  no_deposit: {
    standard: 'PGAST-NoDeposit.md',
    guarantor: 'PGAST-NoDeposit - Guarantor.md'
  },
  reposit: {
    standard: 'PGAST - REPOSIT.md',
    guarantor: 'PGAST - REPOSIT - GUARANTOR.md'
  }
}

// Template file mapping for Welsh contracts
const WELSH_TEMPLATE_MAP: Record<TemplateType, { standard: string; guarantor: string }> = {
  dps: {
    standard: 'DPS - Welsh Occupation Contract.md',
    guarantor: 'G DPS - Welsh Occupation Contract.md'
  },
  mydeposits: {
    standard: 'MyDep - Welsh Occupation Contract.md',
    guarantor: 'G MyDep - Welsh Occupation Contract.md'
  },
  tds: {
    standard: 'TDS - Welsh Occupation Contract.md',
    guarantor: 'G TDS - Welsh Occupation Contract.md'
  },
  no_deposit: {
    standard: 'PGAST-NoDeposit.md', // Welsh doesn't have no_deposit specific, use English
    guarantor: 'PGAST-NoDeposit - Guarantor.md'
  },
  reposit: {
    standard: 'Reposit - Welsh Occupation Contract.md',
    guarantor: 'G Reposit - Welsh Occupation Contract.md'
  }
}

// Template file mapping for English APTA contracts (Renters' Rights Act 2025)
const ENGLISH_APTA_TEMPLATE_MAP: Record<TemplateType, { standard: string; guarantor: string }> = {
  dps: {
    standard: 'PGAPTA-DPS.md',
    guarantor: 'PGAPTA-DPS Guarantor.md'
  },
  mydeposits: {
    standard: 'PGAPTA-MyDep.md',
    guarantor: 'PGAPTA-MyDep Guarantor.md'
  },
  tds: {
    standard: 'PGAPTA-TDS.md',
    guarantor: 'PGAPTA-TDS Guarantor.md'
  },
  no_deposit: {
    standard: 'PGAPTA-NoDeposit.md',
    guarantor: 'PGAPTA-NoDeposit Guarantor.md'
  },
  reposit: {
    standard: 'PGAPTA-REPOSIT.md',
    guarantor: 'PGAPTA-REPOSIT Guarantor.md'
  }
}

class PDFGenerationService {
  private readonly contractsDir: string

  constructor() {
    // Contracts folder is inside the backend directory
    this.contractsDir = path.join(__dirname, '../../Contracts')
  }

  /**
   * Get the template file path based on language, template type, and guarantor presence
   */
  private getTemplatePath(language: Language, templateType: TemplateType, hasGuarantor: boolean, agreementType?: string): string {
    const langDir = language === 'welsh' ? 'Welsh Contracts Markdown' : 'English Contracts Markdown'
    let templateMap: Record<TemplateType, { standard: string; guarantor: string }>
    if (agreementType === 'apta' && language !== 'welsh') {
      templateMap = ENGLISH_APTA_TEMPLATE_MAP
    } else if (language === 'welsh') {
      templateMap = WELSH_TEMPLATE_MAP
    } else {
      templateMap = ENGLISH_TEMPLATE_MAP
    }
    const templateFile = hasGuarantor ? templateMap[templateType].guarantor : templateMap[templateType].standard

    const templatePath = path.join(this.contractsDir, langDir, templateFile)

    if (!fs.existsSync(templatePath)) {
      console.error(`Template not found: ${templatePath}`)
      throw new Error(`Template file not found: ${templateFile}`)
    }

    return templatePath
  }

  /**
   * Format address as a single line or multi-line string
   */
  private formatAddress(address: PropertyAddress, multiLine = false): string {
    const parts = [
      address.line1,
      address.line2,
      address.city,
      address.county,
      address.postcode
    ].filter(Boolean)

    return multiLine ? parts.join('\n') : parts.join(', ')
  }

  /**
   * Format party name and address
   */
  private formatPartyWithAddress(party: Party): string {
    return `${party.name} of ${this.formatAddress(party.address)}`
  }

  /**
   * Format currency amount (without £ symbol - templates already include it)
   */
  private formatCurrency(amount?: number): string {
    if (!amount) return '0.00'
    return amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  private buildGuarantorLiabilityClause(data: AgreementPDFData): string {
    const guarantors = data.guarantors || []
    if (guarantors.length === 0) return 'N/A'

    const tenants = data.tenants || []
    const defaultRentShare = data.rentAmount && tenants.length > 0
      ? data.rentAmount / tenants.length
      : undefined

    const tenantById = new Map<string, Party>()
    const tenantByName = new Map<string, Party>()
    tenants.forEach((tenant) => {
      if (tenant.id) tenantById.set(tenant.id, tenant)
      const normalizedName = tenant.name.trim().toLowerCase()
      if (normalizedName) tenantByName.set(normalizedName, tenant)
    })

    return guarantors.map((guarantor, index) => {
      let matchedTenant: Party | undefined
      if (guarantor.guarantorForTenantId && tenantById.has(guarantor.guarantorForTenantId)) {
        matchedTenant = tenantById.get(guarantor.guarantorForTenantId)
      } else if (guarantor.guarantorForTenantName) {
        matchedTenant = tenantByName.get(guarantor.guarantorForTenantName.trim().toLowerCase())
      } else if (tenants[index]) {
        matchedTenant = tenants[index]
      }

      const tenantName = matchedTenant?.name || guarantor.guarantorForTenantName || 'the Tenant'
      const tenantRentShare = matchedTenant?.rentShare ?? guarantor.guarantorRentShare ?? defaultRentShare
      const guarantorRentShare = guarantor.guarantorRentShare ?? tenantRentShare ?? defaultRentShare
      const tenantShareText = tenantRentShare ? `£${this.formatCurrency(tenantRentShare)}` : '________'
      const guarantorShareText = guarantorRentShare ? `£${this.formatCurrency(guarantorRentShare)}` : '________'

      return `${index + 1}. Guarantor ${index + 1} (${guarantor.name}) is liable for ${tenantName} to the value of their share of rent ${guarantorShareText} (Tenant liability: ${tenantShareText}; Guarantor liability: ${guarantorShareText}).`
    }).join('\n')
  }

  /**
   * Build rent share clause for multi-tenant agreements
   * Returns null if not applicable (single tenant or no tenants)
   */
  private buildRentShareClause(data: AgreementPDFData): string | null {
    const tenants = data.tenants || []
    if (tenants.length <= 1) return null
    if (!data.rentAmount || data.rentAmount <= 0) return null

    // Build tenant portions list
    const tenantParts = tenants.map(t => {
      const share = t.rentShare ?? (data.rentAmount! / tenants.length)
      const pct = ((share / data.rentAmount!) * 100).toFixed(0)
      return `${t.name} - £${this.formatCurrency(share)} (${pct}%)`
    })

    // Use appropriate term based on language
    const term = data.language === 'welsh' ? 'Contract-Holder' : 'tenant'

    return `**Rent Proportions:** The total monthly rent of £${this.formatCurrency(data.rentAmount)} ` +
      `is payable in the following proportions: ${tenantParts.join('; ')}. ` +
      `Each ${term} is jointly and severally liable for the total rent.`
  }

  /**
   * Format date for display
   */
  private formatDate(dateStr?: string): string {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  /**
   * Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
   */
  private getOrdinalSuffix(n: number): string {
    const s = ['th', 'st', 'nd', 'rd']
    const v = n % 100
    return n + (s[(v - 20) % 10] || s[v] || s[0])
  }

  /**
   * Replace template variables in the markdown content
   */
  private replaceVariables(content: string, data: AgreementPDFData): string {
    let result = content

    // Step 1: Normalize escaped characters in markdown
    // Templates have \[ALL\_LANDLORD\_NAMES\] but we need [ALL_LANDLORD_NAMES]
    // This handles: \_ -> _, \[ -> [, \] -> ], \# -> #
    result = result.replace(/\\([_\[\]#])/g, '$1')

    // Note: Do NOT remove markdown table alignment syntax (| :---- | :---- |)
    // These are required for markdown tables to render as actual HTML tables

    // Property address (multiple variants)
    result = result.replace(/\[PROPERTY ADDRESS\]|\[property_address\]|\[Property_Address\]/gi,
      this.formatAddress(data.propertyAddress))

    // Landlord names
    const landlordNames = data.landlords.map(l => l.name).join(', ')
    result = result.replace(/\[ALL_LANDLORD_NAMES\]/gi, landlordNames)

    // Landlord address (first landlord's address for Welsh contracts)
    // For managed properties, show C/O agency address
    const landlordAddress = data.landlords[0]
      ? (data.managementType === 'managed' && data.companyName && data.companyAddress
          ? `C/O ${data.companyName}, ${this.formatAddress(data.companyAddress)}`
          : this.formatAddress(data.landlords[0].address))
      : '________'
    result = result.replace(/\[Landlord_Address\]/gi, landlordAddress)

    // Landlord names and addresses - generate individual boxes for each landlord
    // We need to replace the entire table structure, not just the placeholder
    // Pattern matches: | (1) | [ALL_LANDLORD_NAMES_AND_ADDRESSES] |\n| :---- | :---- |
    const landlordTablePattern = /\|\s*\(1\)\s*\|\s*\[ALL_LANDLORD_NAMES_AND_ADDRESSES\]\s*\|\s*\n\|\s*:----\s*\|\s*:----\s*\|/gi
    const landlordBoxes = data.landlords.map((l, index) => {
      // For managed properties, show landlord C/O agency address
      const address = data.managementType === 'managed' && data.companyName && data.companyAddress
        ? `C/O ${data.companyName}, ${this.formatAddress(data.companyAddress)}`
        : this.formatAddress(l.address)
      return `| **(${index + 1}) ${l.name}** |\n| :---- |\n| ${address} |`
    }).join('\n\n')
    result = result.replace(landlordTablePattern, landlordBoxes)

    // Fallback: Also handle plain placeholder if table pattern not found
    const landlordNamesAndAddresses = data.landlords.map((l, index) => {
      // For managed properties, show landlord C/O agency address
      if (data.managementType === 'managed' && data.companyName && data.companyAddress) {
        // Add number prefix for multiple landlords
        const prefix = data.landlords.length > 1 ? `(${index + 1}) ` : ''
        return `${prefix}${l.name} C/O ${data.companyName}, ${this.formatAddress(data.companyAddress)}`
      }
      const prefix = data.landlords.length > 1 ? `(${index + 1}) ` : ''
      return `${prefix}${this.formatPartyWithAddress(l)}`
    }).join('<br>')
    result = result.replace(/\[ALL_LANDLORD_NAMES_AND_ADDRESSES\]/gi, landlordNamesAndAddresses)

    // Tenant names (handle both space and underscore variants)
    const tenantNames = data.tenants.map(t => t.name).join(', ')
    result = result.replace(/\[ALL_TENANT[ _]NAME\(S\)\]/gi, tenantNames)

    // Tenant names and addresses - generate individual boxes for each tenant
    // Pattern matches: | (2) | [ALL_TENANT_NAMES_AND_ADDRESSES] |\n| :---- | :---- |
    const tenantTablePattern = /\|\s*\(2\)\s*\|\s*\[ALL_TENANT_NAMES_AND_ADDRESSES\]\s*\|\s*\n\|\s*:----\s*\|\s*:----\s*\|/gi
    const tenantBoxes = data.tenants.map((t, index) => {
      const address = this.formatAddress(t.address)
      return `| **(${index + 1}) ${t.name.trim()}** |\n| :---- |\n| ${address} |`
    }).join('\n\n')
    result = result.replace(tenantTablePattern, tenantBoxes)

    // Fallback: Also handle plain placeholder if table pattern not found
    const tenantNamesAndAddresses = data.tenants.map((t, index) => {
      // Add number prefix for multiple tenants
      const prefix = data.tenants.length > 1 ? `(${index + 1}) ` : ''
      return `${prefix}${this.formatPartyWithAddress(t)}`
    }).join('<br>')
    result = result.replace(/\[ALL_TENANT_NAMES_AND_ADDRESSES\]/gi, tenantNamesAndAddresses)

    // Lead tenant address (for Welsh contracts)
    const leadTenantAddress = data.tenants[0] ? this.formatAddress(data.tenants[0].address) : '________'
    result = result.replace(/\[LEAD_TENANT_ADDRESS\]/gi, leadTenantAddress)

    // Guarantor names and addresses (use <br> for table cells, \n\n breaks markdown tables)
    if (data.guarantors && data.guarantors.length > 0) {
      const guarantorNamesAndAddresses = data.guarantors.map(g => this.formatPartyWithAddress(g)).join('<br><br>')
      result = result.replace(/\[GUARANTOR NAMES and address\]/gi, guarantorNamesAndAddresses)
    } else {
      result = result.replace(/\[GUARANTOR NAMES and address\]/gi, 'N/A')
    }

    // Permitted occupiers
    result = result.replace(/\[PERMITTED OCCUPIER NAMES\]/gi, data.permittedOccupiers || 'None')

    // APTA-specific replacements
    const utilityLabels: Record<string, string> = {
      gas: 'Gas', electric: 'Electricity', water: 'Water',
      council_tax: 'Council Tax', internet: 'Internet/Broadband', tv_licence: 'TV Licence'
    }
    const allUtilityKeys = ['gas', 'electric', 'water', 'council_tax', 'internet', 'tv_licence']
    const billsUtilities = (data.billsIncludedUtilities || []).map(u => utilityLabels[u] || u)
    const billsListStr = billsUtilities.length > 0 ? billsUtilities.join(', ') : 'None'
    const hasBillsIncluded = data.billsIncluded || billsUtilities.length > 0

    // Excluded utilities = all standard utilities not in billsIncludedUtilities
    const includedKeys = data.billsIncludedUtilities || []
    const excludedKeys = allUtilityKeys.filter(u => !includedKeys.includes(u))
    const excludedLabels = excludedKeys.map(u => utilityLabels[u] || u)
    const billsExcludedStr = excludedLabels.length > 0 && hasBillsIncluded
      ? excludedLabels.join(', ')
      : hasBillsIncluded ? 'None' : 'All utilities payable by the Tenant'

    // [BILLS_STATEMENT] — legal prose replacing the old Q&A block in APTA templates
    const billsStatement = hasBillsIncluded && billsUtilities.length > 0
      ? `The following utilities and services are included within the monthly Rent: **${billsListStr}**. All other utilities and services are the responsibility of the Tenant and must be paid directly by the Tenant.`
      : hasBillsIncluded
      ? `Utility bills are included within the monthly Rent. All other utilities and services not listed are the responsibility of the Tenant.`
      : `No utility bills or services are included within the monthly Rent. All utilities and services are the responsibility of the Tenant and must be paid directly by the Tenant.`
    result = result.replace(/\[BILLS_STATEMENT\]/gi, billsStatement)

    // Legacy individual placeholders (AST templates still use these)
    result = result.replace(/\[BILLS_INCLUDED\]/gi, hasBillsIncluded ? 'included' : 'not included')
    result = result.replace(/\[BILLS_INCLUDED_LIST\]/gi, billsUtilities.length > 0 ? billsListStr : 'None')
    result = result.replace(/\[BILLS_EXCLUDED_DETAILS\]/gi, billsExcludedStr)

    result = result.replace(/\[TENANCY_TYPE_LABEL\]/gi, data.agreementType === 'apta' ? 'Assured Periodic Tenancy' : 'Assured Shorthold Tenancy')
    result = result.replace(/\[NOTICE_PERIOD\]/gi, data.agreementType === 'apta' ? '2 months' : 'As per agreement terms')
    result = result.replace(/\[LEAD_TENANT_NAME\]/gi, data.tenants?.[0]?.name || 'Tenant')
    result = result.replace(/\[AGENT_OR_LANDLORD\]/gi, data.managementType === 'managed' ? 'Agent' : 'Landlord')
    result = result.replace(/\[POSSESSIONS_REMOVAL_PERIOD\]/gi, '1 month')

    // Agent details block
    const agentDetailsStr = data.managementType === 'managed' && data.companyName
      ? `${data.companyName}${data.companyAddress ? ', ' + this.formatAddress(data.companyAddress) : ''}`
      : data.agentEmail || ''
    result = result.replace(/\[AGENT_DETAILS\]/gi, agentDetailsStr)

    // [SIGNATORY_NAME] kept for backward compat but APTA templates now use static "THE LANDLORD(S)"
    result = result.replace(/\[SIGNATORY_NAME\]/gi,
      data.managementType === 'managed' ? (data.companyName || 'Agent') : (data.landlords?.[0]?.name || 'Landlord'))

    // "Acting as agent..." line only appears for managed agreements
    if (data.managementType !== 'managed') {
      result = result.replace(/\n\nActing as agent, for and on behalf of, the Landlord\(s\)\n/g, '\n')
      result = result.replace(/Acting as agent, for and on behalf of, the Landlord\(s\)\n/g, '')
    }

    // Guarantor address/email for APTA templates
    const guarantorAddr = data.guarantors?.[0]?.address ? this.formatAddress(data.guarantors[0].address) : 'N/A'
    result = result.replace(/\[GUARANTOR_ADDRESS\]/gi, guarantorAddr)
    result = result.replace(/\[GUARANTOR_EMAIL\]/gi, data.guarantors?.[0]?.email || 'N/A')

    // Financial details
    // Some templates have £[amount] (need just the number), others have [amount] alone (need £ + number)
    // Add "(bills included)" suffix if bills are included in rent
    const hasBills = data.billsIncluded || billsUtilities.length > 0
    const billsSuffix = hasBills
      ? (billsUtilities.length > 0 ? ` (${billsListStr} included)` : ' (bills included)')
      : ''
    const rentAmountStr = `£${this.formatCurrency(data.rentAmount)}${billsSuffix}`
    // First replace £[amount] with just the number to avoid ££
    result = result.replace(/£\[RENT_AMOUNT\]|£\[rent_amount\]/gi, rentAmountStr)
    result = result.replace(/£\[DEPOSIT_?\s*AMOUNT\]|£\[deposit_amount\]/gi, `£${this.formatCurrency(data.depositAmount)}`)
    // Then replace standalone [amount] patterns with £ + number
    result = result.replace(/\[RENT_AMOUNT\]|\[rent_amount\]/gi, rentAmountStr)
    // Handle typo in template: [DEPOSIT_ AMOUNT] with space
    result = result.replace(/\[DEPOSIT_?\s*AMOUNT\]/gi, `£${this.formatCurrency(data.depositAmount)}`)

    // Dates - handle multiple variants including malformed ones like [tenancy_end_date)
    result = result.replace(/\[tenancy_start_date\]|\[TENANCY_START_DATE\]/gi, this.formatDate(data.tenancyStartDate))
    const endDateStr = (data.agreementType === 'apta' && !data.tenancyEndDate)
      ? 'Rolling periodic — no fixed end date'
      : this.formatDate(data.tenancyEndDate)
    result = result.replace(/\[tenancy_end_date\)|\[tenancy_end_date\]/gi, endDateStr)
    // [date] is when the contract is made - use current date
    result = result.replace(/\[date\]/gi, this.formatDate(new Date().toISOString()))

    // Rent due day/date
    const rentDueDay = data.rentDueDay || '1st'
    result = result.replace(/\[RENT DUE DATE\]|\[rent_due_date\]/gi, `${rentDueDay} of each month`)

    // Break clause for Welsh contracts
    const hasBreakClause = !!data.breakClause?.trim()
    if (data.language === 'welsh' && !hasBreakClause) {
      result = result.replace(/\[Break_Clause\]/gi, '')
      result = result.replace(/\[Break_Clause_minus_1[ _]?Month\]/gi, '')
      result = result.replace(/\(notice cannot be served before\s*\.\s*\)/gi, '')
      result = result.replace(/\(notice cannot be served before\s*\)/gi, '')
    } else {
      const breakClauseText = data.breakClause || '6 months'
      result = result.replace(/\[Break_Clause\]/gi, breakClauseText)
      // Calculate break clause notice date (1 month before break clause period from start)
      const breakClauseNoticeDate = this.calculateBreakClauseNoticeDate(data.tenancyStartDate, breakClauseText)
      result = result.replace(/\[Break_Clause_minus_1[ _]?Month\]/gi, breakClauseNoticeDate)
    }

    // Deposit scheme type - handle both patterns:
    // 1. Combined values like 'tds_custodial', 'dps_insured' (from TenancyAgreementModal)
    // 2. Separate values where depositSchemeType is 'Custodial'/'Insured' and templateType is 'tds'/'dps' (from Agreements.vue)
    const depositSchemeType = (typeof data.depositSchemeType === 'string' ? data.depositSchemeType : '') || 'custodial'
    const templateType = (typeof data.templateType === 'string' ? data.templateType : '') || ''
    let depositType = 'Custodial'
    let depositSchemeName = 'TDS'

    // Determine deposit type (Custodial or Insured)
    const lowerSchemeType = depositSchemeType.toLowerCase()
    if (lowerSchemeType.includes('insured') || lowerSchemeType === 'insured') {
      depositType = 'Insured'
    } else if (lowerSchemeType.includes('custodial') || lowerSchemeType === 'custodial') {
      depositType = 'Custodial'
    }

    // Determine scheme name - check depositSchemeType first (combined), then templateType (separate)
    const schemeSource = depositSchemeType.toLowerCase() + '_' + templateType.toLowerCase()
    if (schemeSource.includes('tds')) {
      depositSchemeName = 'TDS'
    } else if (schemeSource.includes('dps')) {
      depositSchemeName = 'DPS'
    } else if (schemeSource.includes('mydeposits')) {
      depositSchemeName = 'MyDeposits'
    } else if (schemeSource.includes('reposit')) {
      depositSchemeName = 'Reposit'
      depositType = 'Deposit-free'
    } else if (schemeSource.includes('no_deposit')) {
      depositSchemeName = 'N/A'
      depositType = 'No Deposit'
    }

    result = result.replace(/\[Insured_Custodial\]/gi, depositType)
    result = result.replace(/\[Deposit_Scheme_Name\]/gi, depositSchemeName)
    result = result.replace(/\[Deposit_Scheme_Full\]/gi, `${depositSchemeName} ${depositType}`)

    // Bank details
    result = result.replace(/\[LANDLORD\/AGENT_ACCOUNT_NUMBER\]/gi, data.bankAccountNumber || '________')
    result = result.replace(/\[LANDLORD\/AGENT_SORT_CODE\]/gi, data.bankSortCode || '________')
    result = result.replace(/\[LANDLORD\/AGENT_ACCOUNT_NAME\]/gi, data.bankAccountName || '________')
    const paymentReference = data.paymentReference?.trim()
      ? data.paymentReference
      : this.formatAddress(data.propertyAddress)
    result = result.replace(/\[PAYMENT_REFERENCE\]/gi, paymentReference)
    if (!/Payment Reference:/i.test(result)) {
      // Add payment reference on a new line after sort code
      result = result.replace(
        /(Sort Code:\s*[^\n]+)\n/i,
        `$1\n\nPayment Reference: ${paymentReference}\n`
      )
    }

    // Email addresses (handle multiple variants)
    result = result.replace(/\[TENANT_EMAIL\]/gi, data.tenantEmail || '________')
    // For managed properties, use agent email; for let only, use landlord email
    const noticeEmail = data.managementType === 'managed'
      ? (data.agentEmail || '________')
      : (data.landlordEmail || '________')
    result = result.replace(/\[LANDLORD\/AGENT_EMAIL\]|\[Landlord\/Agent Email\]/gi, noticeEmail)

    // Phone numbers (leave empty for cleaner look in tables)
    result = result.replace(/\[LANDLORD\/AGENT_Phone_Number\]/gi, '')

    // Landlord/Agent address (for notices)
    const noticeAddress = data.managementType === 'managed' && data.companyAddress
      ? this.formatAddress(data.companyAddress)
      : data.landlords[0] ? this.formatAddress(data.landlords[0].address) : '________'
    result = result.replace(/\[LANDLORD\/AGENT_ADDRESS\]/gi, noticeAddress)

    // Deposit payer (all tenants)
    const depositPayer = data.tenants.length > 0
      ? data.tenants.map(t => this.formatPartyWithAddress(t)).join(' and ')
      : '________'
    result = result.replace(/\[DEPOSIT_PAYER_NAME_AND_ADDRESS\]/gi, depositPayer)

    // Build special terms clauses with dynamic numbering (removes empty clause numbers)
    // Welsh contracts use "Additional Term X" format, English uses "11.X" format
    const specialTermsClauses: string[] = []
    let clauseNumber = 1

    const breakClauseStr = typeof data.breakClause === 'string' ? data.breakClause : ''
    const specialClausesStr = typeof data.specialClauses === 'string' ? data.specialClauses : ''
    console.log('[PDF Gen] Break clause received:', breakClauseStr ? `"${breakClauseStr.substring(0, 50)}..."` : 'NONE')
    console.log('[PDF Gen] Special clauses received:', specialClausesStr ? `"${specialClausesStr.substring(0, 50)}..."` : 'NONE')

    if (data.breakClause?.trim()) {
      const prefix = data.language === 'welsh'
        ? `**Additional Term ${clauseNumber}:**`
        : `**11.${clauseNumber + 1}**`
      specialTermsClauses.push(`${prefix} **Break Clause:** ${data.breakClause}`)
      clauseNumber++
      console.log('[PDF Gen] Added break clause to special terms')
    }

    // Add rent share clause for multi-tenant agreements
    const rentShareClause = this.buildRentShareClause(data)
    if (rentShareClause) {
      const prefix = data.language === 'welsh'
        ? `**Additional Term ${clauseNumber}:**`
        : `**11.${clauseNumber + 1}**`
      specialTermsClauses.push(`${prefix} ${rentShareClause}`)
      clauseNumber++
      console.log('[PDF Gen] Added rent share clause to special terms')
    }

    // Handle special clauses - can be a single string or multiple clauses separated by double newlines
    if (data.specialClauses?.trim()) {
      // Split on double newlines to get individual clauses, or treat as single clause
      const clausesList = data.specialClauses
        .split(/\n\n+/)
        .map(c => c.trim())
        .filter(c => c.length > 0)

      clausesList.forEach((clause) => {
        const prefix = data.language === 'welsh'
          ? `**Additional Term ${clauseNumber}:**`
          : `**11.${clauseNumber + 1}**`
        specialTermsClauses.push(`${prefix} ${clause}`)
        clauseNumber++
      })
    }

    result = result.replace(/\[special_terms_numbered_clauses\]/gi, specialTermsClauses.join('\n\n'))

    // Welsh contracts - Contract Holders block
    result = this.processContractHoldersBlock(result, data)

    // Guarantor liability clause
    result = result.replace(/\[GUARANTOR_LIABILITY_CLAUSE\]/gi, this.buildGuarantorLiabilityClause(data))

    // Handle logo: use company logo if available, otherwise PropertyGoose default
    const defaultLogoUrl = 'https://app.propertygoose.co.uk/PropertyGooseLogo.png'
    const logoUrl = data.companyLogoUrl || defaultLogoUrl
    // Replace the logo placeholder with an image tag
    const logoHtml = `<img src="${logoUrl}" alt="Logo" style="max-height: 80px; max-width: 200px; object-fit: contain;" />`
    result = result.replace(/\[AGREEMENT_LOGO\]/gi, logoHtml)

    // Remove handlebars conditionals (they're for the old system) - logo is always shown
    result = result.replace(/\{\{#if.*?\}\}/gi, '')
    result = result.replace(/\{\{\/if\}\}/gi, '')

    // Handle handlebars loops for signatures
    result = this.processSignatureLoops(result, data)

    // NOTE: Don't remove [Anchor: ...] placeholders here - they're needed by embedSignatures()
    // They will be cleaned up after signature embedding in embedSignatures()

    return result
  }

  /**
   * Add page breaks before Annex headings for Welsh contracts
   * This ensures each Annex starts on a new page for better readability
   */
  private addAnnexPageBreaks(html: string): string {
    // Add page-break-before style to h1 elements containing "Annex"
    // The markdown `# Annex 1:` becomes `<h1>Annex 1:` in HTML
    return html.replace(/<h1>Annex/gi, '<h1 style="page-break-before: always;">Annex')
  }

  /**
   * Add page breaks for English Guarantor agreements
   * - Page break before "DEED OF GUARANTEE AND INDEMNITY" section
   */
  private addGuarantorPageBreaks(html: string): string {
    // Add page break before the Deed of Guarantee section
    // The markdown `**DEED OF GUARANTEE AND INDEMNITY**` becomes `<strong>DEED OF GUARANTEE` in HTML
    return html.replace(
      /<strong>DEED OF GUARANTEE/gi,
      '<strong style="page-break-before: always; display: block;">DEED OF GUARANTEE'
    )
  }

  /**
   * Calculate the date when break clause notice can first be served
   * (1 month before the break clause period from start date)
   */
  private calculateBreakClauseNoticeDate(startDateStr?: string, breakClause?: string): string {
    if (!startDateStr) return '________'

    const startDate = new Date(startDateStr)

    // Parse break clause to get months (e.g., "6 months" -> 6)
    const monthsMatch = breakClause?.match(/(\d+)\s*month/i)
    const breakMonths = monthsMatch ? parseInt(monthsMatch[1]) : 6

    // Notice can be served 1 month before the break clause kicks in
    // So for a 6-month break, notice can be served from month 5
    const noticeMonth = breakMonths - 1

    const noticeDate = new Date(startDate)
    noticeDate.setMonth(noticeDate.getMonth() + noticeMonth)

    return this.formatDate(noticeDate.toISOString())
  }

  /**
   * Process the Welsh CONTRACT-HOLDERS BLOCK
   * Handles the full structure including:
   * - [INTERNAL INSTRUCTIONS — DO NOT OUTPUT] ... [END INTERNAL INSTRUCTIONS]
   * - [REPEAT CONTRACT_HOLDER_BLOCK FOR EACH CONTRACT-HOLDER IN ARRAY] ... [END REPEAT CONTRACT_HOLDER_BLOCK]
   * - [CONTRACT-HOLDERS BLOCK] ... [END CONTRACT-HOLDERS BLOCK]
   * Outputs a markdown table for each contract holder matching the expected format
   */
  private processContractHoldersBlock(content: string, data: AgreementPDFData): string {
    let result = content

    // Step 1: Remove the INTERNAL INSTRUCTIONS block entirely (including surrounding text)
    result = result.replace(/\*?\*?\[INTERNAL INSTRUCTIONS[^\]]*\][\s\S]*?\[END INTERNAL INSTRUCTIONS\]\*?\*?\s*/gi, '')

    // Step 2: Remove the REPEAT wrapper markers
    result = result.replace(/\*?\*?\[REPEAT CONTRACT_?HOLDER_?BLOCK[^\]]*\]\*?\*?\s*/gi, '')
    result = result.replace(/\*?\*?\[END REPEAT CONTRACT_?HOLDER_?BLOCK\]\*?\*?\s*/gi, '')

    // Step 3: Process the "Between" section CONTRACT-HOLDERS BLOCK (simpler format)
    // Pattern: [CONTRACT-HOLDERS BLOCK — repeat this block once per Contract-Holder] ... [END CONTRACT-HOLDERS BLOCK]
    const betweenBlockMatch = result.match(/\*?\*?\[CONTRACT-HOLDERS BLOCK\s*[—–-]\s*repeat[^\]]*\]\*?\*?\s*([\s\S]*?)\s*\*?\*?\[END CONTRACT-HOLDERS BLOCK\]\*?\*?/i)

    if (betweenBlockMatch) {
      // Generate individual contract holder entries for the "Between" section
      // Each contract holder gets their own table/box for better readability
      const contractHolders = data.tenants.map((tenant, index) => {
        const tenantAddress = this.formatAddress(tenant.address)
        return `**Contract-Holder #${index + 1}:**\n\n| **${tenant.name.trim()}** |\n| :---- |\n| ${tenantAddress} |`
      }).join('\n\n')

      result = result.replace(betweenBlockMatch[0], contractHolders)
    }

    // Step 4: Find and process the Annex 4 CONTRACT-HOLDERS BLOCK (table format)
    const annexBlockMatch = result.match(/\*?\*?\[CONTRACT-HOLDERS BLOCK\]\*?\*?\s*([\s\S]*?)\s*\*?\*?\[END CONTRACT-HOLDERS BLOCK\]\*?\*?/i)

    if (annexBlockMatch) {
      // Generate individual contract holder entries as tables (matching the expected format)
      // Each contract holder gets their own table matching the Landlord's Details table structure
      // Post-Contract fields use the tenant's current address/email as default
      const contractHolders = data.tenants.map((tenant, index) => {
        const tenantAddress = this.formatAddress(tenant.address)
        const tenantEmail = data.tenantEmail || ''

        // Create a markdown table for each contract holder
        // Format: | Label: Value | Label: Value |
        let entry = `**Contract-Holder's Details (${index + 1}):**\n\n`
        entry += `| Name: ${tenant.name} | Telephone Number: |\n`
        entry += `| :---- | :---- |\n`
        entry += `| Address: ${tenantAddress} | Email: ${tenantEmail} |\n`
        entry += `| Post-Contract Address: ${tenantAddress} | Post-Contract Telephone Number: |\n`
        entry += `| Post-Contract Email: ${tenantEmail} | |`
        return entry
      }).join('\n\n')

      result = result.replace(annexBlockMatch[0], contractHolders)
    }

    // Remove the standalone "Contract-Holder's Details:" header (the block generates numbered ones)
    result = result.replace(/\*\*Contract-Holder's Details:\*\*\s*\n/gi, '')

    // Also handle simpler placeholder patterns
    result = result.replace(/Contract-Holder #\{n\}:/gi, '')
    result = result.replace(/\{index\}/gi, '')

    return result
  }

  /**
   * Process handlebars-style loops for landlords, tenants, and guarantors
   * Note: Some templates have malformed closing tags ({{/tenants} instead of {{/tenants}})
   * Welsh templates may have multiple signature blocks that all need processing
   */
  private processSignatureLoops(content: string, data: AgreementPDFData): string {
    let result = content

    // Process ALL landlords loops (there may be multiple in Welsh contracts)
    const landlordLoopRegex = /\{\{#landlords\}\}([\s\S]*?)\{\{\/landlords\}?\}/gi
    result = result.replace(landlordLoopRegex, (match, template) => {
      return data.landlords.map((landlord, index) => {
        return template
          .replace(/\{\{display_name\}\}/gi, landlord.name.trim())
          .replace(/\{\{id\}\}/gi, `landlord_${index}`)
      }).join('\n')
    })

    // Process ALL tenants loops
    const tenantLoopRegex = /\{\{#tenants\}\}([\s\S]*?)\{\{\/tenants\}?\}/gi
    result = result.replace(tenantLoopRegex, (match, template) => {
      return data.tenants.map((tenant, index) => {
        return template
          .replace(/\{\{display_name\}\}/gi, tenant.name.trim())
          .replace(/\{\{id\}\}/gi, `tenant_${index}`)
      }).join('\n')
    })

    // Process ALL guarantors loops
    const guarantorLoopRegex = /\{\{#guarantors\}\}([\s\S]*?)\{\{\/guarantors\}?\}/gi
    result = result.replace(guarantorLoopRegex, (match, template) => {
      return (data.guarantors || []).map((guarantor, index) => {
        return template
          .replace(/\{\{display_name\}\}/gi, guarantor.name.trim())
          .replace(/\{\{id\}\}/gi, `guarantor_${index}`)
      }).join('\n')
    })

    return result
  }

  /**
   * Generate signature HTML for embedding in the document
   */
  private generateSignatureHtml(signatures: SignatureData[], signerType: 'landlord' | 'tenant' | 'guarantor', index: number): string {
    const signature = signatures.find(s => s.signerType === signerType && s.signerIndex === index)

    if (!signature) {
      return '<div class="signature-line">_____________________________</div><div class="signature-date">Date: _____________</div>'
    }

    const signatureElement = signature.signatureType === 'draw'
      ? `<img src="${signature.signatureImage}" alt="Signature" class="signature-image" style="max-height: 80px; max-width: 300px; object-fit: contain;" />`
      : `<div class="typed-signature" style="font-family: 'Brush Script MT', cursive; font-size: 24px;">${signature.typedName}</div>`

    return `
      <div class="signature-container">
        ${signatureElement}
        <div class="signature-date">Signed: ${new Date(signature.signedAt).toLocaleDateString('en-GB')}</div>
      </div>
    `
  }

  /**
   * Embed signatures into the HTML content
   * Replaces the SIGNED: ___ and DATED: ___ lines with actual signatures
   */
  private embedSignatures(html: string, signatures: SignatureData[], data: AgreementPDFData): string {
    let result = html

    // After markdown->HTML conversion, the signature blocks look like:
    // <p>SIGNED: _______________</p>
    // <p>DATED: ________________</p>
    // <p>[Anchor: LANDLORD_SIGNATURE landlord_0]</p>

    // We need to find the anchor and replace the preceding SIGNED/DATED paragraphs

    // Replace signature blocks for landlords
    data.landlords.forEach((_, index) => {
      const signature = signatures.find(s => s.signerType === 'landlord' && s.signerIndex === index)
      if (signature) {
        result = this.replaceSignatureBlock(result, `landlord_${index}`, 'LANDLORD_SIGNATURE', signature)
      }
    })

    // Replace signature blocks for tenants
    data.tenants.forEach((_, index) => {
      const signature = signatures.find(s => s.signerType === 'tenant' && s.signerIndex === index)
      if (signature) {
        result = this.replaceSignatureBlock(result, `tenant_${index}`, 'TENANT_SIGNATURE', signature)
      }
    })

    // Replace signature blocks for guarantors
    ;(data.guarantors || []).forEach((_, index) => {
      const signature = signatures.find(s => s.signerType === 'guarantor' && s.signerIndex === index)
      if (signature) {
        result = this.replaceSignatureBlock(result, `guarantor_${index}`, 'GUARANTOR_SIGNATURE', signature)
      }
    })

    // Clean up any remaining anchor placeholders
    result = result.replace(/\[Anchor:.*?\]/gi, '')

    return result
  }

  /**
   * Replace a signature block in the HTML
   */
  private replaceSignatureBlock(html: string, signerId: string, anchorType: string, signature: SignatureData): string {
    // Pattern to find SIGNED line, DATED line, and anchor - allowing for HTML tags between them
    // The markdown converts to: <p>SIGNED: ___</p>\n<p>DATED: ___</p>\n<p>[Anchor: ...]</p>
    // We need a flexible pattern that handles various whitespace and potential HTML variations
    const pattern = new RegExp(
      `<p>SIGNED:[^<]*<\\/p>[\\s\\n]*<p>DATED:[^<]*<\\/p>[\\s\\n]*<p>\\[Anchor:\\s*${anchorType}\\s+${signerId}\\]<\\/p>`,
      'gi'
    )

    const replaced = html.replace(pattern, this.formatSignatureBlock(signature))

    // Debug log to see if replacement happened
    if (replaced === html) {
      console.log(`[DEBUG] Signature block NOT found for ${anchorType} ${signerId}`)
    } else {
      console.log(`[DEBUG] Signature block replaced for ${anchorType} ${signerId}`)
    }

    return replaced
  }

  /**
   * Format a signature block with the actual signature image/text
   */
  private formatSignatureBlock(signature: SignatureData): string {
    const signedDate = new Date(signature.signedAt).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })

    if (signature.signatureType === 'draw') {
      return `
        <div class="signature-block" style="margin: 15px 0;">
          <p style="margin-bottom: 5px;">SIGNED:</p>
          <img src="${signature.signatureImage}" alt="Signature" style="max-height: 80px; max-width: 300px; object-fit: contain; display: block; margin: 5px 0;" />
          <p style="margin-top: 10px;">DATED: ${signedDate}</p>
        </div>
      `
    } else {
      // Typed signature
      return `
        <div class="signature-block" style="margin: 15px 0;">
          <p style="margin-bottom: 5px;">SIGNED:</p>
          <p style="font-family: 'Brush Script MT', 'Segoe Script', cursive; font-size: 24pt; color: #1e40af; margin: 5px 0;">${signature.typedName || signature.signerName}</p>
          <p style="margin-top: 10px;">DATED: ${signedDate}</p>
        </div>
      `
    }
  }

  /**
   * Generate audit certificate page HTML
   */
  private generateAuditCertificateHtml(options: PDFGenerationOptions): string {
    const { agreementData, signatures, agreementId } = options

    if (!signatures || signatures.length === 0) {
      return ''
    }

    const signerRows = signatures.map(sig => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${sig.signerName}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-transform: capitalize;">${sig.signerType}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${new Date(sig.signedAt).toLocaleString('en-GB')}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${sig.ipAddress}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-transform: capitalize;">${sig.signatureType}</td>
      </tr>
    `).join('')

    return `
      <div class="audit-certificate" style="page-break-before: always; padding: 40px;">
        <h1 style="text-align: center; color: ${BRAND_COLORS.primary}; margin-bottom: 30px;">Certificate of Completion</h1>

        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
          <h2 style="margin-top: 0;">Document Details</h2>
          <p><strong>Document Type:</strong> ${agreementData.language === 'welsh' ? 'Welsh Occupation Contract' : 'Assured Shorthold Tenancy Agreement'}</p>
          <p><strong>Property:</strong> ${this.formatAddress(agreementData.propertyAddress)}</p>
          ${agreementId ? `<p><strong>Document ID:</strong> ${agreementId}</p>` : ''}
          <p><strong>Generated:</strong> ${new Date().toLocaleString('en-GB')}</p>
        </div>

        <h2>Electronic Signatures</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Name</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Role</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Signed At</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">IP Address</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Method</th>
            </tr>
          </thead>
          <tbody>
            ${signerRows}
          </tbody>
        </table>

        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
          <p style="margin: 0; font-size: 12px;">
            <strong>Legal Notice:</strong> This document was signed electronically using PropertyGoose's secure e-signing platform.
            All parties received the document via email and signed using unique secure links.
            Each signature was captured with the signer's IP address, timestamp, and verification of email ownership.
            This electronic signature is legally binding under the Electronic Communications Act 2000 and
            the eIDAS Regulation (EU) No 910/2014.
          </p>
        </div>

        <div style="text-align: center; margin-top: 40px; color: #6b7280; font-size: 11px;">
          <p>Powered by PropertyGoose - www.propertygoose.co.uk</p>
        </div>
      </div>
    `
  }

  /**
   * Wrap HTML content in a styled document
   */
  private wrapInStyledDocument(htmlContent: string, auditCertificate: string = '', isWelsh: boolean = false): string {
    // Both Welsh and English use 9pt font for better fit
    const fontSize = '9pt'

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tenancy Agreement</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4;
      margin: 20mm 15mm 20mm 15mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      font-family: 'Space Grotesk', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: ${fontSize};
      line-height: 1.6;
      color: #1f2937;
      margin: 0;
      padding: 0;
    }

    h1 {
      font-size: 18pt;
      color: #111827;
      margin-top: 24pt;
      margin-bottom: 12pt;
      page-break-after: avoid;
    }

    h2 {
      font-size: 14pt;
      color: #374151;
      margin-top: 18pt;
      margin-bottom: 10pt;
      page-break-after: avoid;
    }

    h3 {
      font-size: 12pt;
      color: #4b5563;
      margin-top: 14pt;
      margin-bottom: 8pt;
      page-break-after: avoid;
    }

    p {
      margin: 0 0 10pt 0;
      text-align: justify;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12pt 0;
      page-break-inside: avoid;
    }

    th, td {
      border: 1px solid #d1d5db;
      padding: 8pt;
      text-align: left;
      vertical-align: top;
    }

    th {
      background-color: #f3f4f6;
      font-weight: 600;
    }

    ul, ol {
      margin: 10pt 0;
      padding-left: 20pt;
    }

    li {
      margin-bottom: 6pt;
    }

    strong {
      font-weight: 600;
    }

    .signature-section {
      margin-top: 30pt;
      page-break-inside: avoid;
    }

    .signature-block {
      margin-bottom: 40pt;
    }

    .signature-line {
      border-bottom: 1px solid #000;
      width: 200px;
      margin: 20pt 0 5pt 0;
    }

    .signature-image {
      max-height: 60px;
      max-width: 200px;
    }

    .typed-signature {
      font-family: 'Brush Script MT', 'Segoe Script', cursive;
      font-size: 24pt;
      color: #1e40af;
    }

    .page-break {
      page-break-before: always;
    }

    /* Header styling for PropertyGoose branding */
    .document-header {
      text-align: center;
      margin-bottom: 30pt;
      padding-bottom: 15pt;
      border-bottom: 2px solid ${BRAND_COLORS.primary};
    }

    .document-header img {
      max-height: 50px;
      margin-bottom: 10pt;
    }
  </style>
</head>
<body>
  <div class="document-content">
    ${htmlContent}
  </div>
  ${auditCertificate}
</body>
</html>
    `
  }

  /**
   * Generate agreement PDF
   */
  async generateAgreementPDF(options: PDFGenerationOptions): Promise<Buffer> {
    const { agreementData, signatures, includeAuditPage } = options
    const hasGuarantor = (agreementData.guarantors?.length || 0) > 0

    try {
      // 1. Load the appropriate markdown template
      const templatePath = this.getTemplatePath(
        agreementData.language || 'english',
        agreementData.templateType,
        hasGuarantor,
        agreementData.agreementType
      )
      console.log(`Loading template: ${templatePath}`)

      const markdownContent = fs.readFileSync(templatePath, 'utf-8')

      // 2. Replace template variables
      const populatedMarkdown = this.replaceVariables(markdownContent, agreementData)

      // 3. Convert markdown to HTML
      const htmlContent = await marked(populatedMarkdown)

      // 4. Embed signatures if provided
      let finalHtml = htmlContent
      if (signatures && signatures.length > 0) {
        finalHtml = this.embedSignatures(finalHtml, signatures, agreementData)
      }

      // 5. Add page breaks based on contract type
      const isWelsh = agreementData.language === 'welsh'

      if (isWelsh) {
        // Welsh contracts: page break before each Annex
        finalHtml = this.addAnnexPageBreaks(finalHtml)
      }

      if (!isWelsh && hasGuarantor) {
        // English Guarantor contracts: page break before Deed of Guarantee
        finalHtml = this.addGuarantorPageBreaks(finalHtml)
      }

      // 6. Generate audit certificate if needed
      const auditCertificate = (includeAuditPage && signatures && signatures.length > 0)
        ? this.generateAuditCertificateHtml(options)
        : ''

      // 7. Wrap in styled HTML document (Welsh uses smaller font)
      const fullHtml = this.wrapInStyledDocument(finalHtml, auditCertificate, isWelsh)

      // 8. Generate PDF using Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })

      const page = await browser.newPage()
      await page.setContent(fullHtml, { waitUntil: 'networkidle0' })

      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `
          <div style="font-size: 9px; color: #6b7280; text-align: center; width: 100%; padding: 0 15mm;">
            <span class="pageNumber"></span> of <span class="totalPages"></span>
          </div>
        `
      })

      await browser.close()

      console.log(`PDF generated successfully: ${pdfBuffer.length} bytes`)
      return Buffer.from(pdfBuffer)
    } catch (error: any) {
      console.error('Error generating PDF:', error)
      throw new Error(`Failed to generate agreement PDF: ${error.message}`)
    }
  }

  /**
   * Generate preview PDF (without signatures)
   */
  async generatePreviewPDF(agreementData: AgreementPDFData): Promise<Buffer> {
    return this.generateAgreementPDF({
      agreementData,
      signatures: undefined,
      includeAuditPage: false
    })
  }

  /**
   * Generate final signed PDF (with signatures and audit page)
   */
  async generateSignedPDF(agreementData: AgreementPDFData, signatures: SignatureData[], agreementId: string): Promise<Buffer> {
    return this.generateAgreementPDF({
      agreementData,
      signatures,
      includeAuditPage: true,
      agreementId
    })
  }

  /**
   * Generate rent due date change confirmation letter PDF
   */
  async generateRentDueDateChangeConfirmation(data: {
    tenantName: string
    propertyAddress: string
    previousDueDay: number
    newDueDay: number
    effectiveDate: string
    monthlyRent: number
    proRataDays: number
    proRataAmount: number
    adminFee: number
    totalAmount: number
    paymentReceivedDate: string
    paymentReference?: string
    nextRentDueDate: string
    companyName: string
    companyAddress?: string
    companyEmail?: string
    companyPhone?: string
    companyLogoUrl?: string
    documentRef: string
  }): Promise<Buffer> {
    try {
      // Load the HTML template
      const templatePath = path.join(__dirname, '../../email-templates/rent-due-date-change-notice.html')
      let htmlContent = fs.readFileSync(templatePath, 'utf-8')

      // Helper for ordinal suffix
      const getOrdinal = (n: number): string => {
        const s = ['th', 'st', 'nd', 'rd']
        const v = n % 100
        return n + (s[(v - 20) % 10] || s[v] || s[0])
      }

      // Build admin fee row if applicable
      let adminFeeRow = ''
      if (data.adminFee > 0) {
        adminFeeRow = `
          <tr>
            <td class="label">Administration fee</td>
            <td class="value">&pound;${data.adminFee.toFixed(2)}</td>
          </tr>
        `
      }

      // Payment reference text
      const paymentRefText = data.paymentReference
        ? ` (Reference: ${data.paymentReference})`
        : ''

      // Format date
      const documentDate = new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })

      // Default logo if none provided
      const logoUrl = data.companyLogoUrl || 'https://app.propertygoose.co.uk/PropertyGooseLogo.png'

      // Replace all template variables
      const replacements: Record<string, string> = {
        '{{ TenantName }}': data.tenantName,
        '{{ PropertyAddress }}': data.propertyAddress,
        '{{ PreviousDueDay }}': getOrdinal(data.previousDueDay),
        '{{ NewDueDay }}': getOrdinal(data.newDueDay),
        '{{ EffectiveDate }}': data.effectiveDate,
        '{{ MonthlyRent }}': data.monthlyRent.toFixed(2),
        '{{ ProRataDays }}': data.proRataDays.toString(),
        '{{ ProRataAmount }}': data.proRataAmount.toFixed(2),
        '{{ AdminFeeRow }}': adminFeeRow,
        '{{ TotalAmount }}': data.totalAmount.toFixed(2),
        '{{ PaymentReceivedDate }}': data.paymentReceivedDate,
        '{{ PaymentReferenceText }}': paymentRefText,
        '{{ NextRentDueDate }}': data.nextRentDueDate,
        '{{ CompanyName }}': data.companyName || 'Property Management',
        '{{ CompanyAddress }}': data.companyAddress || '',
        '{{ CompanyEmail }}': data.companyEmail || '',
        '{{ CompanyPhone }}': data.companyPhone || '',
        '{{ AgentLogoUrl }}': logoUrl,
        '{{ DocumentDate }}': documentDate,
        '{{ DocumentRef }}': data.documentRef
      }

      for (const [key, value] of Object.entries(replacements)) {
        htmlContent = htmlContent.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value)
      }

      // Generate PDF using Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })

      const page = await browser.newPage()
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' })

      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '25mm',
          right: '20mm',
          bottom: '25mm',
          left: '20mm'
        },
        printBackground: true
      })

      await browser.close()

      console.log(`[PDF] Rent due date change confirmation generated: ${pdfBuffer.length} bytes`)
      return Buffer.from(pdfBuffer)
    } catch (error: any) {
      console.error('Error generating rent due date change confirmation PDF:', error)
      throw new Error(`Failed to generate confirmation PDF: ${error.message}`)
    }
  }

  /**
   * Generate Section 13 Form 4 rent increase notice PDF
   */
  async generateSection13Notice(data: {
    tenantNames: string
    propertyAddress: string
    currentRent: number
    newRent: number
    rentFrequency: 'weekly' | 'monthly' | 'yearly'
    effectiveDate: string
    noticeDate: string
    anchorDate: string // Previous S13 date or tenancy start date
    charges: {
      councilTax: { existing: string; proposed: string }
      water: { existing: string; proposed: string }
      serviceCharges: { existing: string; proposed: string }
    }
    landlordName: string
    landlordAddress: string
    agentName?: string
    agentAddress?: string
    agentEmail?: string
    agentPhone?: string
    agentLogoUrl?: string
    signature: string
    signatureMethod: 'draw' | 'type'
    signerName: string
    documentRef: string
  }): Promise<Buffer> {
    try {
      // Load the HTML template
      const templatePath = path.join(__dirname, '../../email-templates/section-13-form-4.html')
      let htmlContent = fs.readFileSync(templatePath, 'utf-8')

      // Format rent frequency text
      const rentFrequencyMap: Record<string, string> = {
        'weekly': 'per week',
        'monthly': 'per month',
        'yearly': 'per year'
      }
      const rentFrequencyText = rentFrequencyMap[data.rentFrequency] || 'per month'

      // Format dates
      const formatDateForNotice = (dateStr: string): string => {
        if (!dateStr) return ''
        return new Date(dateStr).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })
      }

      // Format currency - show 'nil' if empty or zero
      const formatCharge = (value: string): string => {
        if (!value || value.trim() === '' || value === '0' || value === '0.00') {
          return 'nil'
        }
        const num = parseFloat(value)
        if (isNaN(num) || num === 0) return 'nil'
        return `£${num.toFixed(2)}`
      }

      // Build signature HTML
      let signatureHtml = ''
      if (data.signatureMethod === 'draw' && data.signature.startsWith('data:image')) {
        signatureHtml = `<img src="${data.signature}" class="signature-image" alt="Signature" />`
      } else {
        signatureHtml = `<span class="typed-signature">${data.signature || data.signerName}</span>`
      }

      // Build agent details section (paragraph 7)
      let agentDetailsSection = ''
      if (data.agentName) {
        agentDetailsSection = `
          <div class="section">
            <div class="paragraph">
              <span class="paragraph-number">7.</span>
              <span>If signed by agent, address of agent:</span>
            </div>
            <div class="field-box">
              <div class="field-value">${data.agentName}${data.agentAddress ? ', ' + data.agentAddress : ''}</div>
            </div>
          </div>
        `
      } else {
        agentDetailsSection = `
          <div class="section">
            <div class="paragraph">
              <span class="paragraph-number">7.</span>
              <span>If signed by agent, address of agent: N/A</span>
            </div>
          </div>
        `
      }

      // Build logo HTML - only show if logo URL provided
      const agentLogoHtml = data.agentLogoUrl
        ? `<img src="${data.agentLogoUrl}" alt="${data.agentName || 'Agent'}" class="agent-logo" />`
        : ''

      // Replace all template variables
      const replacements: Record<string, string> = {
        '{{ TenantNames }}': data.tenantNames,
        '{{ PropertyAddress }}': data.propertyAddress,
        '{{ NewRent }}': data.newRent.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        '{{ RentFrequencyText }}': rentFrequencyText,
        '{{ EffectiveDate }}': formatDateForNotice(data.effectiveDate),
        '{{ AnchorDate }}': formatDateForNotice(data.anchorDate),
        '{{ CouncilTaxExisting }}': formatCharge(data.charges.councilTax.existing),
        '{{ CouncilTaxProposed }}': formatCharge(data.charges.councilTax.proposed),
        '{{ WaterExisting }}': formatCharge(data.charges.water.existing),
        '{{ WaterProposed }}': formatCharge(data.charges.water.proposed),
        '{{ ServiceChargesExisting }}': formatCharge(data.charges.serviceCharges.existing),
        '{{ ServiceChargesProposed }}': formatCharge(data.charges.serviceCharges.proposed),
        '{{ LandlordNameAndAddress }}': `${data.landlordName}${data.landlordAddress ? ', ' + data.landlordAddress : ''}`,
        '{{ AgentDetailsSection }}': agentDetailsSection,
        '{{ SignatureHtml }}': signatureHtml,
        '{{ SignerName }}': data.signerName,
        '{{ NoticeDate }}': formatDateForNotice(data.noticeDate),
        '{{ AgentName }}': data.agentName || 'Property Management',
        '{{ AgentAddress }}': data.agentAddress || '',
        '{{ AgentEmail }}': data.agentEmail || '',
        '{{ AgentPhone }}': data.agentPhone || '',
        '{{ AgentLogoHtml }}': agentLogoHtml,
        '{{ DocumentRef }}': data.documentRef,
        '{{ GeneratedDate }}': formatDateForNotice(new Date().toISOString())
      }

      for (const [key, value] of Object.entries(replacements)) {
        htmlContent = htmlContent.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value)
      }

      // Generate PDF using Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })

      const page = await browser.newPage()
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' })

      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '15mm',
          right: '15mm',
          bottom: '15mm',
          left: '15mm'
        },
        printBackground: true
      })

      await browser.close()

      console.log(`[PDF] Section 13 notice generated: ${pdfBuffer.length} bytes`)
      return Buffer.from(pdfBuffer)
    } catch (error: any) {
      console.error('Error generating Section 13 notice PDF:', error)
      throw new Error(`Failed to generate Section 13 notice PDF: ${error.message}`)
    }
  }

  /**
   * Generate Section 8 Form 3 notice seeking possession PDF
   */
  async generateSection8Notice(data: {
    tenantNames: string[]
    propertyAddress: {
      line1: string
      line2?: string
      town: string
      county?: string
      postcode: string
    }
    landlordNames: string[]
    landlordAddress: {
      line1: string
      line2?: string
      town: string
      county?: string
      postcode: string
    }
    servedByAgent: boolean
    agentName?: string
    agentAddress?: {
      line1: string
      line2?: string
      town: string
      county?: string
      postcode: string
    }
    agentLogoUrl?: string
    agentPhone?: string
    agentEmail?: string
    tenancyStartDate: string
    rentAmount: number
    rentFrequency: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly'
    rentDueDay: string
    grounds: Array<{
      id: string
      number: string
      type: 'mandatory' | 'discretionary'
      title: string
      statutoryWording: string
      explanation: string
    }>
    serviceDate: string
    earliestCourtDate: string
    noticeExplanation: string
    arrearsRows?: Array<{
      period: string
      dueDate?: string
      amountDue: number
      amountPaid: number
      paidDate?: string
      balance: number
    }>
    totalArrears?: number
    arrearsNotes?: string
    serviceMethod: string
    signatoryName: string
    signatoryCapacity: string
    signature: string
    signatureMethod: 'draw' | 'type'
    documentRef: string
  }): Promise<Buffer> {
    try {
      // Load the HTML template
      const templatePath = path.join(__dirname, '../../email-templates/section-8-form-3.html')
      let htmlContent = fs.readFileSync(templatePath, 'utf-8')

      // Helper to format address
      const formatAddr = (addr: { line1: string; line2?: string; town: string; county?: string; postcode: string }): string => {
        const parts = [addr.line1, addr.line2, addr.town, addr.county, addr.postcode].filter(Boolean)
        return parts.join(', ')
      }

      // Format date
      const formatDateForNotice = (dateStr: string): string => {
        if (!dateStr) return ''
        return new Date(dateStr).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })
      }

      // Build tenant names (combined string)
      const tenantNames = data.tenantNames.join(', ')

      // Build ground numbers string (e.g., "Ground 8, Ground 10")
      const groundNumbers = data.grounds.map(g => g.number).join(', ')

      // Build grounds statutory content (full text of each ground)
      const groundsStatutoryContent = data.grounds.map(ground => `
        <div class="ground-item" style="margin-top: 15px;">
          <div class="ground-header"><strong>${ground.number}</strong> (${ground.type === 'mandatory' ? 'Mandatory' : 'Discretionary'}) - ${ground.title}</div>
          <div class="ground-statutory">
            <div class="statutory-label">Statutory wording:</div>
            ${ground.statutoryWording}
          </div>
        </div>
      `).join('\n')

      // Build grounds explanation content
      const groundsExplanationContent = data.grounds.map(ground => `
        <div class="ground-item">
          <div class="ground-explanation">
            <div class="explanation-label">${ground.number}:</div>
            ${ground.explanation.replace(/\n/g, '<br>')}
          </div>
        </div>
      `).join('\n')

      // Build arrears section if applicable
      let arrearsSection = ''
      if (data.arrearsRows && data.arrearsRows.length > 0) {
        const arrearsRowsHtml = data.arrearsRows.map(row => {
          const isLate = row.dueDate && row.paidDate && new Date(row.paidDate) > new Date(row.dueDate)
          const lateClass = isLate ? ' class="late"' : ''
          return `
            <tr>
              <td>${row.period}</td>
              <td class="date">${row.dueDate ? formatDateForNotice(row.dueDate) : '-'}</td>
              <td class="amount">£${row.amountDue.toFixed(2)}</td>
              <td class="amount">£${row.amountPaid.toFixed(2)}</td>
              <td class="date"${lateClass}>${row.paidDate ? formatDateForNotice(row.paidDate) : '-'}</td>
              <td class="amount" style="font-weight: bold; ${row.balance > 0 ? 'color: #b91c1c;' : ''}">£${row.balance.toFixed(2)}</td>
            </tr>
          `
        }).join('\n')

        arrearsSection = `
          <div class="arrears-section">
            <p style="font-weight: bold; margin-bottom: 10px;">Schedule of Rent Arrears:</p>
            <table class="arrears-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th class="date">Due Date</th>
                  <th class="amount">Amount Due</th>
                  <th class="amount">Amount Paid</th>
                  <th class="date">Paid Date</th>
                  <th class="amount">Balance</th>
                </tr>
              </thead>
              <tbody>
                ${arrearsRowsHtml}
                <tr class="total-row">
                  <td colspan="5" style="text-align: right;">TOTAL ARREARS:</td>
                  <td class="amount" style="color: #b91c1c;">£${(data.totalArrears || 0).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
            ${data.arrearsNotes ? `<p class="arrears-notes"><strong>Notes:</strong> ${data.arrearsNotes.replace(/\n/g, '<br>')}</p>` : ''}
          </div>
        `
      }

      // Build signature HTML
      let signatureHtml = ''
      if (data.signatureMethod === 'draw' && data.signature.startsWith('data:image')) {
        signatureHtml = `<img src="${data.signature}" class="signature-image" alt="Signature" />`
      } else {
        signatureHtml = `<span class="typed-signature">${data.signature || data.signatoryName}</span>`
      }

      // Build signatory address
      const signatoryAddress = data.servedByAgent && data.agentAddress
        ? formatAddr(data.agentAddress)
        : formatAddr(data.landlordAddress)

      // Build signatory phone (agent phone when served by agent)
      const signatoryPhone = data.servedByAgent && data.agentPhone ? data.agentPhone : ''

      // Capacity checkboxes
      const capacityLandlord = data.signatoryCapacity === 'landlord' ? 'checked' : ''
      const capacityJointLandlord = data.signatoryCapacity === 'joint_landlord' ? 'checked' : ''
      const capacityAgent = data.signatoryCapacity === 'agent' ? 'checked' : ''

      // Replace all template variables
      const replacements: Record<string, string> = {
        '{{ TenantNames }}': tenantNames,
        '{{ PropertyAddress }}': formatAddr(data.propertyAddress),
        '{{ GroundNumbers }}': groundNumbers,
        '{{ GroundsStatutoryContent }}': groundsStatutoryContent,
        '{{ GroundsExplanationContent }}': groundsExplanationContent,
        '{{ ArrearsSection }}': arrearsSection,
        '{{ EarliestCourtDate }}': formatDateForNotice(data.earliestCourtDate),
        '{{ NoticeExplanation }}': data.noticeExplanation || `(Based on the ${data.grounds.length > 1 ? 'grounds' : 'ground'} cited requiring the longest notice period)`,
        '{{ LandlordNames }}': data.landlordNames.join(', '),
        '{{ LandlordAddress }}': formatAddr(data.landlordAddress),
        '{{ SignatureHtml }}': signatureHtml,
        '{{ SignatoryName }}': data.signatoryName,
        '{{ SignatoryAddress }}': signatoryAddress,
        '{{ SignatoryPhone }}': signatoryPhone,
        '{{ CapacityLandlord }}': capacityLandlord,
        '{{ CapacityJointLandlord }}': capacityJointLandlord,
        '{{ CapacityAgent }}': capacityAgent,
        '{{ ServiceDate }}': formatDateForNotice(data.serviceDate),
        '{{ AgentName }}': data.agentName || 'Property Management',
        '{{ DocumentRef }}': data.documentRef
      }

      for (const [key, value] of Object.entries(replacements)) {
        htmlContent = htmlContent.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value)
      }

      // Generate PDF using Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })

      const page = await browser.newPage()
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' })

      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '15mm',
          right: '15mm',
          bottom: '15mm',
          left: '15mm'
        },
        printBackground: true
      })

      await browser.close()

      console.log(`[PDF] Section 8 notice generated: ${pdfBuffer.length} bytes`)
      return Buffer.from(pdfBuffer)
    } catch (error: any) {
      console.error('Error generating Section 8 notice PDF:', error)
      throw new Error(`Failed to generate Section 8 notice PDF: ${error.message}`)
    }
  }

  /**
   * Generate Section 48 Notice - Address for Service of Notices
   * Landlord and Tenant Act 1987
   */
  async generateSection48Notice(data: {
    tenantNames: string[]
    propertyAddress: {
      line1: string
      line2?: string
      city: string
      county?: string
      postcode: string
    }
    landlordNames: string[]
    landlordDisplay: string
    landlordAddress: {
      line1: string
      line2?: string
      city: string
      county?: string
      postcode: string
    }
    isCompanyLandlord: boolean
    companyRegisteredName?: string
    companyRegistrationNumber?: string
    addressForService: {
      line1: string
      line2?: string
      city: string
      county?: string
      postcode: string
    }
    addressForServiceName: string
    reasonForServing: string
    reasonText?: string
    tenancyStartDate: string
    dateOfNotice: string
    signatoryName: string
    signatoryCapacity: string
    agentName: string
    agentAddress?: {
      line1?: string
      city?: string
      postcode?: string
    }
    agentLogoUrl?: string
    agentPhone?: string
    agentEmail?: string
    documentRef: string
  }): Promise<Buffer> {
    try {
      // Helper to format address
      const formatAddr = (addr: { line1?: string; line2?: string; city?: string; county?: string; postcode?: string }): string => {
        const parts = [addr.line1, addr.line2, addr.city, addr.county, addr.postcode].filter(Boolean)
        return parts.join(', ')
      }

      const formatAddrMultiline = (addr: { line1?: string; line2?: string; city?: string; county?: string; postcode?: string }): string => {
        const parts = [addr.line1, addr.line2, addr.city, addr.county, addr.postcode].filter(Boolean)
        return parts.join('<br/>')
      }

      const tenantNamesStr = data.tenantNames.join(' and ')
      const propertyAddrStr = formatAddr(data.propertyAddress)
      const landlordAddrStr = formatAddr(data.landlordAddress)
      const serviceAddrStr = formatAddrMultiline(data.addressForService)

      // Company registration info
      const companyInfo = data.isCompanyLandlord && data.companyRegisteredName
        ? `<p style="font-size: 11px; color: #666; margin-top: 3px;">
             ${data.companyRegisteredName}${data.companyRegistrationNumber ? ` (Company No. ${data.companyRegistrationNumber})` : ''}
           </p>`
        : ''

      // Reason text paragraph
      const reasonParagraph = data.reasonText
        ? `<p style="margin-top: 15px;">${data.reasonText}</p>`
        : ''

      // Build HTML content - Modern, clean design while remaining legally professional
      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Section 48 Notice</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #374151;
      padding: 40px;
      background: #fff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 35px;
      padding-bottom: 25px;
      border-bottom: 1px solid #e5e7eb;
    }
    .header-title {
      flex: 1;
    }
    .header-badge {
      display: inline-block;
      background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
      color: white;
      font-size: 9pt;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 20px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    .header-title h1 {
      font-size: 22pt;
      font-weight: 700;
      color: #111827;
      margin-bottom: 4px;
      letter-spacing: -0.5px;
    }
    .header-title h2 {
      font-size: 11pt;
      font-weight: 400;
      color: #6b7280;
    }
    .logo {
      max-height: 55px;
      max-width: 160px;
    }
    .ref-line {
      font-size: 9pt;
      color: #9ca3af;
      margin-bottom: 30px;
      font-weight: 500;
      letter-spacing: 0.3px;
    }
    .parties-section {
      display: flex;
      gap: 30px;
      margin-bottom: 30px;
    }
    .party-box {
      flex: 1;
      background: #f9fafb;
      border-radius: 10px;
      padding: 18px 20px;
      border: 1px solid #f3f4f6;
    }
    .party-label {
      font-weight: 600;
      font-size: 9pt;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 8px;
    }
    .party-content {
      font-size: 10.5pt;
      color: #374151;
      line-height: 1.5;
    }
    .info-row {
      display: flex;
      gap: 30px;
      margin-bottom: 25px;
    }
    .info-item {
      flex: 1;
    }
    .info-label {
      font-size: 9pt;
      color: #9ca3af;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .info-value {
      font-size: 11pt;
      color: #111827;
      font-weight: 500;
    }
    .property-highlight {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 28px;
      border-left: 4px solid #f59e0b;
    }
    .property-highlight-label {
      font-size: 9pt;
      color: #92400e;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 3px;
    }
    .property-highlight-value {
      font-size: 11pt;
      color: #78350f;
      font-weight: 600;
    }
    .body-text {
      margin-bottom: 16px;
      color: #374151;
      line-height: 1.7;
    }
    .service-address-box {
      margin: 28px 0;
      padding: 24px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-radius: 12px;
      border: 1px solid #bfdbfe;
    }
    .service-address-box .label {
      font-weight: 600;
      font-size: 9pt;
      color: #1e40af;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .service-address-box .label::before {
      content: '📍';
      font-size: 12pt;
    }
    .service-address-box .address {
      font-size: 12pt;
      font-weight: 600;
      line-height: 1.6;
      color: #1e3a8a;
    }
    .legal-reference {
      margin-top: 28px;
      padding: 16px 20px;
      background: #f9fafb;
      border-radius: 8px;
      font-size: 10pt;
      color: #6b7280;
      border-left: 3px solid #d1d5db;
    }
    .signature-section {
      margin-top: 45px;
    }
    .signature-section p {
      color: #6b7280;
      margin-bottom: 25px;
    }
    .signature-block {
      display: inline-block;
    }
    .signature-name {
      font-size: 13pt;
      font-weight: 600;
      color: #111827;
      border-bottom: 2px solid #f97316;
      padding-bottom: 4px;
      display: inline-block;
    }
    .signature-capacity {
      font-size: 10pt;
      color: #6b7280;
      margin-top: 6px;
    }
    .signature-date {
      font-size: 9pt;
      color: #9ca3af;
      margin-top: 4px;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 9pt;
      color: #9ca3af;
      text-align: center;
      line-height: 1.6;
    }
    .footer-brand {
      font-weight: 600;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-title">
      <div class="header-badge">Legal Notice</div>
      <h1>Section 48 Notice</h1>
      <h2>Landlord and Tenant Act 1987 — Address for Service</h2>
    </div>
    ${data.agentLogoUrl ? `<img src="${data.agentLogoUrl}" class="logo" alt="Logo" />` : ''}
  </div>

  <div class="ref-line">
    Reference: ${data.documentRef}
  </div>

  <div class="parties-section">
    <div class="party-box">
      <div class="party-label">Tenant</div>
      <div class="party-content">
        <strong>${tenantNamesStr}</strong><br/>
        ${formatAddrMultiline(data.propertyAddress)}
      </div>
    </div>
    <div class="party-box">
      <div class="party-label">Landlord</div>
      <div class="party-content">
        <strong>${data.landlordDisplay}</strong>
        ${companyInfo}
        ${landlordAddrStr ? `<br/>${formatAddrMultiline(data.landlordAddress)}` : ''}
      </div>
    </div>
  </div>

  <div class="info-row">
    <div class="info-item">
      <div class="info-label">Date of Notice</div>
      <div class="info-value">${data.dateOfNotice}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Tenancy Commenced</div>
      <div class="info-value">${data.tenancyStartDate || '—'}</div>
    </div>
  </div>

  <div class="property-highlight">
    <div class="property-highlight-label">Property</div>
    <div class="property-highlight-value">${propertyAddrStr}</div>
  </div>

  <p class="body-text">
    Dear ${tenantNamesStr},
  </p>

  <p class="body-text">
    We write on behalf of ${data.landlordDisplay} ("<strong>the Landlord</strong>") regarding the above property.
  </p>

  <p class="body-text">
    Pursuant to <strong>Section 48 of the Landlord and Tenant Act 1987</strong>, you are hereby notified that the address in England and Wales at which notices (including notices in legal proceedings) may be served on the Landlord is:
  </p>

  <div class="service-address-box">
    <div class="label">Address for Service of Notices</div>
    <div class="address">
      ${data.addressForServiceName}<br/>
      ${serviceAddrStr}
    </div>
  </div>

  ${reasonParagraph}

  <div class="legal-reference">
    This notice is given under and in accordance with Section 48 of the Landlord and Tenant Act 1987.
  </div>

  <div class="signature-section">
    <p>Yours sincerely,</p>

    <div class="signature-block">
      <div class="signature-name">${data.signatoryName}</div>
      <div class="signature-capacity">${data.signatoryCapacity}</div>
      <div class="signature-date">${data.dateOfNotice}</div>
    </div>
  </div>

  <div class="footer">
    <span class="footer-brand">${data.agentName}</span>${data.agentAddress?.line1 ? ` · ${formatAddr(data.agentAddress)}` : ''}<br/>
    ${data.agentPhone ? `${data.agentPhone}` : ''}${data.agentPhone && data.agentEmail ? ' · ' : ''}${data.agentEmail ? `${data.agentEmail}` : ''}
  </div>
</body>
</html>
      `

      // Generate PDF using Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })

      const page = await browser.newPage()
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' })

      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '15mm',
          right: '15mm',
          bottom: '15mm',
          left: '15mm'
        },
        printBackground: true
      })

      await browser.close()

      console.log(`[PDF] Section 48 notice generated: ${pdfBuffer.length} bytes`)
      return Buffer.from(pdfBuffer)
    } catch (error: any) {
      console.error('Error generating Section 48 notice PDF:', error)
      throw new Error(`Failed to generate Section 48 notice PDF: ${error.message}`)
    }
  }

  /**
   * Generate Tenant Change Addendum PDF
   */
  async generateTenantChangeAddendum(data: {
    documentRef: string
    documentDate: string
    propertyAddress: string
    outgoingTenants: Array<{
      name: string
      email?: string
    }>
    incomingTenants: Array<{
      name: string
      email?: string
      currentAddress?: string
    }>
    remainingTenants: Array<{
      name: string
      email?: string
    }>
    landlordName: string
    landlordAddress?: string
    tenancyStartDate: string
    monthlyRent: number
    rentDueDay: number | string
    changeoverDate: string
    depositAmount: number
    depositScheme: string
    depositReference?: string
    incomingDepositPayment: number
    outgoingDepositRefund: number
    companyName: string
    agentLogoUrl?: string
    primaryColor?: string
    signatures?: Array<{
      signerType: 'outgoing_tenant' | 'incoming_tenant' | 'remaining_tenant' | 'landlord_agent'
      signerIndex: number
      signerName: string
      signatureData?: string
      signatureType?: 'draw' | 'type'
      typedName?: string
      signedAt?: string
      ipAddress?: string
    }>
    includeAuditPage?: boolean
  }): Promise<Buffer> {
    try {
      // Load the HTML template
      const templatePath = path.join(__dirname, '../../email-templates/tenant-change-addendum-pdf.html')
      let htmlContent = fs.readFileSync(templatePath, 'utf-8')

      const primaryColor = data.primaryColor || BRAND_COLORS.primary

      // Format helpers
      const formatDate = (dateStr: string): string => {
        if (!dateStr) return ''
        return new Date(dateStr).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })
      }

      const formatCurrency = (amount: number): string => {
        return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      }

      const getOrdinal = (n: number): string => {
        const s = ['th', 'st', 'nd', 'rd']
        const v = n % 100
        return n + (s[(v - 20) % 10] || s[v] || s[0])
      }

      // Build logo HTML
      const agentLogoHtml = data.agentLogoUrl
        ? `<img src="${data.agentLogoUrl}" class="logo" alt="Logo" />`
        : ''

      // Build outgoing tenants HTML
      const outgoingTenantsHtml = data.outgoingTenants.map(tenant => `
        <div class="party-box">
          <div class="party-name">${tenant.name}</div>
          ${tenant.email ? `<div class="party-detail">${tenant.email}</div>` : ''}
        </div>
      `).join('')

      // Build incoming tenants HTML
      const incomingTenantsHtml = data.incomingTenants.map(tenant => `
        <div class="party-box">
          <div class="party-name">${tenant.name}</div>
          ${tenant.email ? `<div class="party-detail">${tenant.email}</div>` : ''}
          ${tenant.currentAddress ? `<div class="party-detail" style="margin-top: 4px; font-size: 9pt;">Current address: ${tenant.currentAddress}</div>` : ''}
        </div>
      `).join('')

      // Build remaining tenants section (only if there are remaining tenants)
      let remainingTenantsSection = ''
      if (data.remainingTenants && data.remainingTenants.length > 0) {
        const remainingTenantsHtml = data.remainingTenants.map(tenant => `
          <div class="party-box">
            <div class="party-name">${tenant.name}</div>
            ${tenant.email ? `<div class="party-detail">${tenant.email}</div>` : ''}
          </div>
        `).join('')

        remainingTenantsSection = `
          <div style="margin-bottom: 15px;">
            <div class="party-label">Remaining Tenant(s)</div>
            <div class="parties-grid">
              ${remainingTenantsHtml}
            </div>
          </div>
        `
      }

      // Signature type definition for internal use
      type SignatureEntry = {
        signerType: 'outgoing_tenant' | 'incoming_tenant' | 'remaining_tenant' | 'landlord_agent'
        signerIndex: number
        signerName: string
        signatureData?: string
        signatureType?: 'draw' | 'type'
        typedName?: string
        signedAt?: string
        ipAddress?: string
      }

      // Build signature blocks
      const buildSignatureBlock = (
        signerName: string,
        signerType: string,
        signature?: SignatureEntry
      ): string => {
        let signatureContent = ''
        let dateContent = 'Date: _________________'

        if (signature && signature.signatureData) {
          if (signature.signatureType === 'draw' && signature.signatureData.startsWith('data:image')) {
            signatureContent = `<img src="${signature.signatureData}" class="signature-image" alt="Signature" />`
          } else if (signature.signatureType === 'type') {
            signatureContent = `<span class="typed-signature">${signature.typedName || signerName}</span>`
          }
          if (signature.signedAt) {
            dateContent = `Signed: ${formatDate(signature.signedAt)}`
          }
        }

        return `
          <div class="signature-block">
            <div class="signature-type">${signerType}</div>
            <div class="signature-name">${signerName}</div>
            <div class="signature-line">${signatureContent}</div>
            <div class="signature-date">${dateContent}</div>
          </div>
        `
      }

      // Cast signatures to the proper type
      const signatures = data.signatures as SignatureEntry[] | undefined

      // Build outgoing signatures
      const outgoingSignaturesHtml = data.outgoingTenants.map((tenant, index) => {
        const sig = signatures?.find(s => s.signerType === 'outgoing_tenant' && s.signerIndex === index)
        return buildSignatureBlock(tenant.name, 'Outgoing Tenant', sig)
      }).join('')

      // Build incoming signatures
      const incomingSignaturesHtml = data.incomingTenants.map((tenant, index) => {
        const sig = signatures?.find(s => s.signerType === 'incoming_tenant' && s.signerIndex === index)
        return buildSignatureBlock(tenant.name, 'Incoming Tenant', sig)
      }).join('')

      // Build remaining signatures section
      let remainingSignaturesSection = ''
      if (data.remainingTenants && data.remainingTenants.length > 0) {
        const remainingSignaturesHtml = data.remainingTenants.map((tenant, index) => {
          const sig = signatures?.find(s => s.signerType === 'remaining_tenant' && s.signerIndex === index)
          return buildSignatureBlock(tenant.name, 'Remaining Tenant', sig)
        }).join('')

        remainingSignaturesSection = `
          <div style="margin-bottom: 25px;">
            <div class="party-label" style="margin-bottom: 10px;">Remaining Tenant(s)</div>
            <div class="signature-grid">
              ${remainingSignaturesHtml}
            </div>
          </div>
        `
      }

      // Build agent signature
      const agentSig = signatures?.find(s => s.signerType === 'landlord_agent')
      const agentSignatureHtml = buildSignatureBlock(
        data.landlordName,
        'On behalf of Landlord',
        agentSig
      )

      // Build audit certificate if needed
      let auditCertificateHtml = ''
      if (data.includeAuditPage && signatures && signatures.filter(s => s.signedAt).length > 0) {
        const signedSignatures = signatures.filter(s => s.signedAt)
        const signerRows = signedSignatures.map(sig => `
          <tr>
            <td>${sig.signerName}</td>
            <td style="text-transform: capitalize;">${sig.signerType.replace('_', ' ')}</td>
            <td>${sig.signedAt ? new Date(sig.signedAt).toLocaleString('en-GB') : ''}</td>
            <td>${sig.ipAddress || 'N/A'}</td>
            <td style="text-transform: capitalize;">${sig.signatureType || 'N/A'}</td>
          </tr>
        `).join('')

        auditCertificateHtml = `
          <div class="audit-page">
            <div class="audit-header">
              <h1>Certificate of Completion</h1>
              <p style="font-size: 11pt; color: #6b7280;">Electronic Signature Audit Trail</p>
            </div>

            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
              <h3 style="margin: 0 0 15px; font-size: 12pt; color: #111827;">Document Details</h3>
              <p style="margin: 5px 0; font-size: 10pt;"><strong>Document Type:</strong> Change of Tenant Addendum</p>
              <p style="margin: 5px 0; font-size: 10pt;"><strong>Property:</strong> ${data.propertyAddress}</p>
              <p style="margin: 5px 0; font-size: 10pt;"><strong>Document Reference:</strong> ${data.documentRef}</p>
              <p style="margin: 5px 0; font-size: 10pt;"><strong>Changeover Date:</strong> ${formatDate(data.changeoverDate)}</p>
              <p style="margin: 5px 0; font-size: 10pt;"><strong>Generated:</strong> ${new Date().toLocaleString('en-GB')}</p>
            </div>

            <h3 style="font-size: 12pt; margin-bottom: 15px;">Electronic Signatures</h3>
            <table class="audit-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Signed At</th>
                  <th>IP Address</th>
                  <th>Method</th>
                </tr>
              </thead>
              <tbody>
                ${signerRows}
              </tbody>
            </table>

            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 25px; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; font-size: 10pt; color: #92400e;">
                <strong>Legal Notice:</strong> This document was signed electronically using a secure e-signing platform.
                All parties received the document via email and signed using unique secure links.
                Each signature was captured with the signer's IP address, timestamp, and verification of email ownership.
                This electronic signature is legally binding under the Electronic Communications Act 2000 and
                the eIDAS Regulation (EU) No 910/2014.
              </p>
            </div>

            <div style="text-align: center; margin-top: 30px; color: #9ca3af; font-size: 10pt;">
              <p>Powered by PropertyGoose - www.propertygoose.co.uk</p>
            </div>
          </div>
        `
      }

      // Replace all template variables
      const rentDueDay = typeof data.rentDueDay === 'number'
        ? getOrdinal(data.rentDueDay)
        : data.rentDueDay

      const replacements: Record<string, string> = {
        '{{ PrimaryColor }}': primaryColor,
        '{{ DocumentRef }}': data.documentRef,
        '{{ DocumentDate }}': formatDate(data.documentDate),
        '{{ PropertyAddress }}': data.propertyAddress,
        '{{ AgentLogoHtml }}': agentLogoHtml,
        '{{ OutgoingTenantsHtml }}': outgoingTenantsHtml,
        '{{ IncomingTenantsHtml }}': incomingTenantsHtml,
        '{{ RemainingTenantsSection }}': remainingTenantsSection,
        '{{ LandlordName }}': data.landlordName,
        '{{ LandlordAddress }}': data.landlordAddress || '',
        '{{ TenancyStartDate }}': formatDate(data.tenancyStartDate),
        '{{ MonthlyRent }}': formatCurrency(data.monthlyRent),
        '{{ RentDueDay }}': rentDueDay,
        '{{ ChangeoverDate }}': formatDate(data.changeoverDate),
        '{{ DepositAmount }}': formatCurrency(data.depositAmount),
        '{{ DepositScheme }}': data.depositScheme,
        '{{ DepositReference }}': data.depositReference || 'To be updated',
        '{{ IncomingDepositPayment }}': formatCurrency(data.incomingDepositPayment),
        '{{ OutgoingDepositRefund }}': formatCurrency(data.outgoingDepositRefund),
        '{{ OutgoingSignaturesHtml }}': outgoingSignaturesHtml,
        '{{ IncomingSignaturesHtml }}': incomingSignaturesHtml,
        '{{ RemainingSignaturesSection }}': remainingSignaturesSection,
        '{{ AgentSignatureHtml }}': agentSignatureHtml,
        '{{ CompanyName }}': data.companyName,
        '{{ AuditCertificateHtml }}': auditCertificateHtml
      }

      for (const [key, value] of Object.entries(replacements)) {
        htmlContent = htmlContent.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value)
      }

      // Generate PDF using Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })

      const page = await browser.newPage()
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' })

      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `
          <div style="font-size: 9px; color: #9ca3af; text-align: center; width: 100%; padding: 0 15mm;">
            <span class="pageNumber"></span> of <span class="totalPages"></span>
          </div>
        `
      })

      await browser.close()

      console.log(`[PDF] Tenant change addendum generated: ${pdfBuffer.length} bytes`)
      return Buffer.from(pdfBuffer)
    } catch (error: any) {
      console.error('Error generating tenant change addendum PDF:', error)
      throw new Error(`Failed to generate tenant change addendum PDF: ${error.message}`)
    }
  }
}

export const pdfGenerationService = new PDFGenerationService()

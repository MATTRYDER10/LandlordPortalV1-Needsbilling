import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import fs from 'fs'
import path from 'path'
import { supabase } from '../config/supabase'

export type TemplateType = 'dps' | 'mydeposits' | 'tds' | 'no_deposit'

export interface Party {
  name: string
  address: {
    line1: string
    line2?: string
    city: string
    county?: string
    postcode: string
  }
}

export interface PropertyAddress {
  line1: string
  line2?: string
  city: string
  county?: string
  postcode: string
}

export interface AgreementData {
  templateType: TemplateType
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
  // Bank details
  bankAccountName?: string
  bankAccountNumber?: string
  bankSortCode?: string
  // Email addresses
  tenantEmail?: string
  landlordEmail?: string
  agentEmail?: string
  // Property management type
  managementType?: 'managed' | 'let_only'
  // Clauses
  breakClause?: string
  specialClauses?: string
}

export class AgreementService {
  private readonly TEMPLATES_DIR = path.join(__dirname, '../../../Forms & ASTs/ASTs')
  private readonly TEMPLATES_ROOT = path.join(__dirname, '../../../Forms & ASTs')

  /**
   * Get the template file path based on deposit type
   */
  private getTemplatePath(templateType: TemplateType): string {
    // Map template type to specific template file
    const templateFileMap: Record<TemplateType, string> = {
      mydeposits: 'PGAST-MyDeposits.docx',
      dps: 'PGAST-DPS.docx',
      tds: 'PGAST-TDS.docx',
      no_deposit: 'PGAST-NoDeposit.docx'
    }

    const templateFile = templateFileMap[templateType]
    const templatePath = path.join(this.TEMPLATES_ROOT, templateFile)

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`)
    }

    console.log('Using template at:', templatePath)
    return templatePath
  }

  /**
   * Get Clause 7 text based on deposit scheme type
   */
  private getClause7Text(templateType: TemplateType, depositAmount: number, depositSchemeType: string): string {
    const clauseFilePath = path.join(this.TEMPLATES_ROOT, 'CLAUSE 7.docx')

    if (!fs.existsSync(clauseFilePath)) {
      console.warn('CLAUSE 7.docx not found, using default clause')
      return ''
    }

    try {
      // Read the CLAUSE 7 document using docxtemplater to preserve formatting
      const content = fs.readFileSync(clauseFilePath, 'binary')
      const zip = new PizZip(content)

      // Extract XML to find the text
      const xml = zip.file('word/document.xml')?.asText()
      if (!xml) {
        console.warn('Could not read CLAUSE 7 document.xml')
        return ''
      }

      // Map template type to scheme name in document
      const schemeMap: Record<TemplateType, string> = {
        mydeposits: 'MyDeposits:',
        dps: 'DPS',
        tds: 'TDS',
        no_deposit: 'No deposit'
      }

      const searchTerm = schemeMap[templateType]

      // Parse XML and extract raw text
      const fullText = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

      // Find the section for this scheme
      const schemeStart = fullText.indexOf(searchTerm)
      if (schemeStart === -1) {
        console.warn(`Could not find clause for ${templateType} (searched for: ${searchTerm})`)
        console.log('Available text sample:', fullText.substring(0, 500))
        return ''
      }

      // Find the next scheme marker or extract a reasonable amount (3000 chars should cover one full clause)
      const nextSchemePos = Math.min(
        fullText.indexOf('MyDeposits:', schemeStart + 1),
        fullText.indexOf('DPS', schemeStart + 100), // Skip 100 chars to avoid matching "DPS" within the current section
        fullText.indexOf('TDS', schemeStart + 100),
        fullText.indexOf('No deposit', schemeStart + 1)
      )

      const endPos = nextSchemePos > schemeStart ? nextSchemePos : schemeStart + 3000
      let clause = fullText.substring(schemeStart, endPos)

      // Clean up the clause text but preserve basic structure
      clause = clause.replace(/\s+/g, ' ').trim()

      console.log(`Extracted clause for ${templateType}: ${clause.substring(0, 200)}...`)
      return clause
    } catch (error) {
      console.error('Error extracting Clause 7:', error)
      return ''
    }
  }

  /**
   * Format property address
   */
  private formatPropertyAddress(address: PropertyAddress): string {
    const parts = [
      address.line1,
      address.line2,
      address.city,
      address.county,
      address.postcode
    ].filter(Boolean)

    return parts.join(', ')
  }

  /**
   * Format full address for template
   */
  private formatFullAddress(address: PropertyAddress): string {
    return `${address.line1}${address.line2 ? ', ' + address.line2 : ''}, ${address.city}${address.county ? ', ' + address.county : ''}, ${address.postcode}`
  }

  /**
   * Format date from ISO (YYYY-MM-DD) to UK format (DD/MM/YYYY)
   */
  private formatDateToUK(dateString: string): string {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB')
  }

  /**
   * Prepare template data for Non Guarantor TA template (uses [variable] format)
   */
  private prepareTemplateData(data: AgreementData): Record<string, any> {
    // Clause 7 is now baked into the template files, so we don't need to inject it
    // const clause7 = this.getClause7Text(data.templateType, data.depositAmount || 0, data.depositSchemeType || 'Custodial')

    // Format deposit scheme with both name and type (e.g., "DPS Insured", "MyDeposits Custodial")
    const schemeNameMap: Record<TemplateType, string> = {
      mydeposits: 'MyDeposits',
      dps: 'DPS',
      tds: 'TDS',
      no_deposit: 'No Deposit'
    }
    const schemeName = schemeNameMap[data.templateType]
    const fullDepositScheme = `${schemeName} ${data.depositSchemeType || 'Custodial'}`
    // Parse names (assuming "First Last" format)
    const parseName = (fullName: string) => {
      const parts = fullName.trim().split(' ')
      return {
        first: parts[0] || '',
        last: parts.slice(1).join(' ') || parts[0]
      }
    }

    // Format multiple parties into a single string
    const formatPartyNames = (parties: Party[]) => {
      if (parties.length === 0) return ''
      if (parties.length === 1) return parties[0].name
      if (parties.length === 2) return `${parties[0].name} AND ${parties[1].name}`
      // For 3+, use commas with AND before the last one
      const allButLast = parties.slice(0, -1).map(p => p.name).join(', ')
      const last = parties[parties.length - 1].name
      return `${allButLast} AND ${last}`
    }

    const formatPartyNamesWithAddresses = (parties: Party[]) => {
      if (parties.length === 0) return ''
      if (parties.length === 1) return `${parties[0].name} of ${this.formatFullAddress(parties[0].address)}`
      if (parties.length === 2) {
        return `${parties[0].name} of ${this.formatFullAddress(parties[0].address)} AND ${parties[1].name} of ${this.formatFullAddress(parties[1].address)}`
      }
      // For 3+, use AND before the last one
      const allButLast = parties.slice(0, -1).map(p => `${p.name} of ${this.formatFullAddress(p.address)}`).join(', ')
      const last = parties[parties.length - 1]
      return `${allButLast} AND ${last.name} of ${this.formatFullAddress(last.address)}`
    }

    // Get first landlord for legacy single-value fields
    const landlord = data.landlords[0] || { name: '', address: {} as PropertyAddress }
    const tenant = data.tenants[0] || { name: '', address: {} as PropertyAddress }
    const guarantor = data.guarantors[0] || null

    const landlordName = parseName(landlord.name)
    const tenantName = parseName(tenant.name)
    const guarantorName = guarantor ? parseName(guarantor.name) : { first: '', last: '' }

    // Format all landlords, tenants, guarantors for different contexts
    const allLandlordNames = formatPartyNames(data.landlords)
    const allTenantNames = formatPartyNames(data.tenants)
    const allGuarantorNames = data.guarantors.length > 0 ? formatPartyNames(data.guarantors) : 'None'

    // For definitions section - use the proper formatting with AND
    const landlordDefinitions = formatPartyNamesWithAddresses(data.landlords)
    const tenantDefinitions = formatPartyNamesWithAddresses(data.tenants)

    return {
      // New template variables for Non Guarantor TA.docx
      'ALL_LANDLORD_NAMES': allLandlordNames,
      'ALL_LANDLORD_NAMES_AND_ADDRESSES': landlordDefinitions,
      'ALL_TENANT NAME(S)': allTenantNames,
      'ALL_TENANT_NAMES_AND_ADDRESSES': tenantDefinitions,

      // Clause 7 is now baked into each template file
      // 'CLAUSE_7': clause7,

      // Property and financial details
      'PROPERTY ADDRESS': this.formatPropertyAddress(data.propertyAddress),
      'property_address': this.formatPropertyAddress(data.propertyAddress),
      'RENT_AMOUNT': data.rentAmount ? `£${data.rentAmount.toFixed(2)}` : '£0.00',
      'DEPOSIT_ AMOUNT': data.depositAmount ? `£${data.depositAmount.toFixed(2)}` : '£0.00',
      'DEPOSIT_SCHEME_ DEPOSIT_TYPE_INSURED_ CUSTODIAL': fullDepositScheme, // e.g., "DPS Insured" or "MyDeposits Custodial"
      'RENT DUE DATE': data.rentDueDay || '1st',

      // Dates
      'TENANCY_START_DATE': data.tenancyStartDate ? this.formatDateToUK(data.tenancyStartDate) : new Date().toLocaleDateString('en-GB'),
      'tenancy_start_date': data.tenancyStartDate ? this.formatDateToUK(data.tenancyStartDate) : new Date().toLocaleDateString('en-GB'),
      'tenancy_end_date': data.tenancyEndDate ? this.formatDateToUK(data.tenancyEndDate) : 'and thereafter from month-to-month',
      'date': new Date().toLocaleDateString('en-GB'),

      // Landlord/Agent details - use agent if managed, landlord if let only
      'LANDLORD/AGENT_ADDRESS': data.managementType === 'managed' && data.agentEmail
        ? '' // Agent address would be provided separately
        : (data.landlords.length > 0 ? this.formatFullAddress(data.landlords[0].address) : ''),
      'LANDLORD/AGENT_EMAIL': data.managementType === 'managed'
        ? (data.agentEmail || '')
        : (data.landlordEmail || (data.landlords[0] ? '' : '')),
      'LANDLORD/AGENT_ACCOUNT_NAME': data.bankAccountName || '',
      'LANDLORD/AGENT_ACCOUNT_NUMBER': data.bankAccountNumber || '',
      'LANDLORD/AGENT_SORT_CODE': data.bankSortCode || '',

      // Tenant details (using first tenant)
      'TENANT_EMAIL': data.tenantEmail || (data.tenants[0] ? '' : ''),

      // Guarantor details
      'GUARANTOR NAMES and address': data.guarantors.length > 0 ? formatPartyNamesWithAddresses(data.guarantors) : 'N/A',

      // Permitted Occupiers
      'PERMITTED OCCUPIER NAMES': data.permittedOccupiers || 'None',

      // Tenant signatures (up to 6 tenants)
      'TENANT1NAME': data.tenants[0]?.name || '',
      'TENANT1SIGN': '',
      'TENANT1SIGNDATE': '',
      'TENANT2NAME': data.tenants[1]?.name || '',
      'TENANT2SIGN': '',
      'TENANT2SIGNDATE': '',
      'TENANT3NAME': data.tenants[2]?.name || '',
      'TENANT3SIGN': '',
      'TENANT3SIGNDATE': '',
      'TENANT4NAME': data.tenants[3]?.name || '',
      'TENANT4SIGN': '',
      'TENANT4SIGNDATE': '',
      'TENANT5NAME': data.tenants[4]?.name || '',
      'TENANT5SIGN': '',
      'TENANT5SIGNDATE': '',
      'TENANT6NAME': data.tenants[5]?.name || '',
      'TENANT6SIGN': '',
      'TENANT6SIGNDATE': '',

      // Clauses
      'tenancy_break_clause': data.breakClause || '',
      'tenancy_special_clause': data.specialClauses || '',

      // Landlord signatures (up to 4 signers)
      'signer_signature_1': '',
      'signer_name_1': data.landlords[0]?.name || '',
      'signer_date_1': '',
      'signer_signature_2': '',
      'signer_name_2': data.landlords[1]?.name || '',
      'signer_date_2': '',
      'signer_signature_3': '',
      'signer_name_3': data.landlords[2]?.name || '',
      'signer_date_3': '',
      'signer_signature_4': '',
      'signer_name_4': data.landlords[3]?.name || '',
      'signer_date_4': ''
    }
  }

  /**
   * Generate a filled DOCX file from template
   */
  async generateAgreementDocx(data: AgreementData): Promise<Buffer> {
    try {
      // Load the template
      const templatePath = this.getTemplatePath(data.templateType)
      const content = fs.readFileSync(templatePath, 'binary')

      // Create a PizZip instance with the content
      const zip = new PizZip(content)

      // Prepare template data
      const templateData = this.prepareTemplateData(data)

      console.log('Template data:', JSON.stringify(templateData, null, 2))

      // Create docxtemplater instance with square bracket delimiters
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: {
          start: '[',
          end: ']'
        }
      })

      // Render the document with data
      try {
        doc.render(templateData)
      } catch (error: any) {
        console.error('Error rendering template:', error)
        console.error('Error properties:', error.properties)
        throw new Error(`Template rendering failed: ${error.message}`)
      }

      // Get the generated document as a buffer
      const buffer = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      })

      return buffer
    } catch (error: any) {
      console.error('Error generating agreement DOCX:', error)
      throw new Error(`Failed to generate agreement: ${error.message}`)
    }
  }

  /**
   * Save agreement to database
   */
  async saveAgreement(
    agreementData: AgreementData,
    companyId: string,
    userId: string,
    referenceId?: string
  ): Promise<string> {
    const { data, error } = await supabase
      .from('agreements')
      .insert({
        template_type: agreementData.templateType,
        property_address: agreementData.propertyAddress,
        landlords: agreementData.landlords,
        tenants: agreementData.tenants,
        guarantors: agreementData.guarantors,
        deposit_amount: agreementData.depositAmount,
        rent_amount: agreementData.rentAmount,
        tenancy_start_date: agreementData.tenancyStartDate,
        tenancy_end_date: agreementData.tenancyEndDate,
        rent_due_day: agreementData.rentDueDay,
        deposit_scheme_type: agreementData.depositSchemeType,
        permitted_occupiers: agreementData.permittedOccupiers,
        bank_account_name: agreementData.bankAccountName,
        bank_account_number: agreementData.bankAccountNumber,
        bank_sort_code: agreementData.bankSortCode,
        tenant_email: agreementData.tenantEmail,
        landlord_email: agreementData.landlordEmail,
        agent_email: agreementData.agentEmail,
        management_type: agreementData.managementType,
        break_clause: agreementData.breakClause,
        special_clauses: agreementData.specialClauses,
        company_id: companyId,
        reference_id: referenceId || null,
        created_by: userId
      })
      .select('id')
      .single()

    if (error) {
      throw new Error(`Failed to save agreement: ${error.message}`)
    }

    return data.id
  }

  /**
   * Upload generated DOCX to Supabase Storage
   */
  async uploadAgreementFile(
    agreementId: string,
    buffer: Buffer,
    fileName: string
  ): Promise<string> {
    const filePath = `agreements/${agreementId}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true
      })

    if (uploadError) {
      throw new Error(`Failed to upload agreement file: ${uploadError.message}`)
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath)

    return urlData.publicUrl
  }

  /**
   * Update agreement with PDF URL
   */
  async updateAgreementPdfUrl(agreementId: string, pdfUrl: string): Promise<void> {
    const { error } = await supabase
      .from('agreements')
      .update({
        pdf_url: pdfUrl,
        pdf_generated_at: new Date().toISOString()
      })
      .eq('id', agreementId)

    if (error) {
      throw new Error(`Failed to update agreement PDF URL: ${error.message}`)
    }
  }

  /**
   * Get agreement by ID
   */
  async getAgreement(agreementId: string) {
    const { data, error } = await supabase
      .from('agreements')
      .select('*')
      .eq('id', agreementId)
      .single()

    if (error) {
      throw new Error(`Failed to fetch agreement: ${error.message}`)
    }

    return data
  }

  /**
   * Get agreements by reference ID
   */
  async getAgreementsByReference(referenceId: string) {
    const { data, error } = await supabase
      .from('agreements')
      .select('*')
      .eq('reference_id', referenceId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch agreements: ${error.message}`)
    }

    return data
  }

  /**
   * Get agreements by company ID
   */
  async getAgreementsByCompany(companyId: string) {
    const { data, error } = await supabase
      .from('agreements')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch agreements: ${error.message}`)
    }

    return data
  }
}

export const agreementService = new AgreementService()

import puppeteer from 'puppeteer'
import { marked } from 'marked'
import fs from 'fs'
import path from 'path'

export type TemplateType = 'dps' | 'mydeposits' | 'tds' | 'no_deposit' | 'reposit'
export type Language = 'english' | 'welsh'

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
  tenantEmail?: string
  landlordEmail?: string
  agentEmail?: string
  managementType?: 'managed' | 'let_only'
  breakClause?: string
  specialClauses?: string
  companyName?: string
  companyAddress?: PropertyAddress
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

class PDFGenerationService {
  private readonly contractsDir: string

  constructor() {
    // Contracts folder is at the root of the project
    this.contractsDir = path.join(__dirname, '../../../Contracts')
  }

  /**
   * Get the template file path based on language, template type, and guarantor presence
   */
  private getTemplatePath(language: Language, templateType: TemplateType, hasGuarantor: boolean): string {
    const langDir = language === 'welsh' ? 'Welsh Contracts Markdown' : 'English Contracts Markdown'
    const templateMap = language === 'welsh' ? WELSH_TEMPLATE_MAP : ENGLISH_TEMPLATE_MAP
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
    const landlordAddress = data.landlords[0] ? this.formatAddress(data.landlords[0].address) : '________'
    result = result.replace(/\[Landlord_Address\]/gi, landlordAddress)

    // Landlord names and addresses - generate individual boxes for each landlord
    // We need to replace the entire table structure, not just the placeholder
    // Pattern matches: | (1) | [ALL_LANDLORD_NAMES_AND_ADDRESSES] |\n| :---- | :---- |
    const landlordTablePattern = /\|\s*\(1\)\s*\|\s*\[ALL_LANDLORD_NAMES_AND_ADDRESSES\]\s*\|\s*\n\|\s*:----\s*\|\s*:----\s*\|/gi
    const landlordBoxes = data.landlords.map((l, index) => {
      const address = this.formatAddress(l.address)
      return `| **(${index + 1}) ${l.name}** |\n| :---- |\n| ${address} |`
    }).join('\n\n')
    result = result.replace(landlordTablePattern, landlordBoxes)

    // Fallback: Also handle plain placeholder if table pattern not found
    const landlordNamesAndAddresses = data.landlords.map(l => this.formatPartyWithAddress(l)).join('<br><br>')
    result = result.replace(/\[ALL_LANDLORD_NAMES_AND_ADDRESSES\]/gi, landlordNamesAndAddresses)

    // Tenant names (handle both space and underscore variants)
    const tenantNames = data.tenants.map(t => t.name).join(', ')
    result = result.replace(/\[ALL_TENANT[ _]NAME\(S\)\]/gi, tenantNames)

    // Tenant names and addresses - generate individual boxes for each tenant
    // Pattern matches: | (2) | [ALL_TENANT_NAMES_AND_ADDRESSES] |\n| :---- | :---- |
    const tenantTablePattern = /\|\s*\(2\)\s*\|\s*\[ALL_TENANT_NAMES_AND_ADDRESSES\]\s*\|\s*\n\|\s*:----\s*\|\s*:----\s*\|/gi
    const tenantBoxes = data.tenants.map((t, index) => {
      const address = this.formatAddress(t.address)
      return `| **(${index + 1}) ${t.name}** |\n| :---- |\n| ${address} |`
    }).join('\n\n')
    result = result.replace(tenantTablePattern, tenantBoxes)

    // Fallback: Also handle plain placeholder if table pattern not found
    const tenantNamesAndAddresses = data.tenants.map(t => this.formatPartyWithAddress(t)).join('<br><br>')
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

    // Financial details
    // Some templates have £[amount] (need just the number), others have [amount] alone (need £ + number)
    // First replace £[amount] with just the number to avoid ££
    result = result.replace(/£\[RENT_AMOUNT\]|£\[rent_amount\]/gi, `£${this.formatCurrency(data.rentAmount)}`)
    result = result.replace(/£\[DEPOSIT_?\s*AMOUNT\]|£\[deposit_amount\]/gi, `£${this.formatCurrency(data.depositAmount)}`)
    // Then replace standalone [amount] patterns with £ + number
    result = result.replace(/\[RENT_AMOUNT\]|\[rent_amount\]/gi, `£${this.formatCurrency(data.rentAmount)}`)
    // Handle typo in template: [DEPOSIT_ AMOUNT] with space
    result = result.replace(/\[DEPOSIT_?\s*AMOUNT\]/gi, `£${this.formatCurrency(data.depositAmount)}`)

    // Dates - handle multiple variants including malformed ones like [tenancy_end_date)
    result = result.replace(/\[tenancy_start_date\]|\[TENANCY_START_DATE\]/gi, this.formatDate(data.tenancyStartDate))
    result = result.replace(/\[tenancy_end_date\)|\[tenancy_end_date\]/gi, this.formatDate(data.tenancyEndDate))
    // [date] is when the contract is made - use current date
    result = result.replace(/\[date\]/gi, this.formatDate(new Date().toISOString()))

    // Rent due day/date
    const rentDueDay = data.rentDueDay || '1st'
    result = result.replace(/\[RENT DUE DATE\]|\[rent_due_date\]/gi, `${rentDueDay} of each month`)

    // Break clause for Welsh contracts
    const breakClauseText = data.breakClause || '6 months'
    result = result.replace(/\[Break_Clause\]/gi, breakClauseText)
    // Calculate break clause notice date (1 month before break clause period from start)
    const breakClauseNoticeDate = this.calculateBreakClauseNoticeDate(data.tenancyStartDate, breakClauseText)
    result = result.replace(/\[Break_Clause_minus_1[ _]?Month\]/gi, breakClauseNoticeDate)

    // Deposit scheme type
    result = result.replace(/\[Insured_Custodial\]/gi, data.depositSchemeType || 'Custodial')

    // Bank details
    result = result.replace(/\[LANDLORD\/AGENT_ACCOUNT_NUMBER\]/gi, data.bankAccountNumber || '________')
    result = result.replace(/\[LANDLORD\/AGENT_SORT_CODE\]/gi, data.bankSortCode || '________')
    result = result.replace(/\[LANDLORD\/AGENT_ACCOUNT_NAME\]/gi, data.bankAccountName || '________')

    // Email addresses (handle multiple variants)
    result = result.replace(/\[TENANT_EMAIL\]/gi, data.tenantEmail || '________')
    result = result.replace(/\[LANDLORD\/AGENT_EMAIL\]|\[Landlord\/Agent Email\]/gi, data.landlordEmail || data.agentEmail || '________')

    // Phone numbers (leave empty for cleaner look in tables)
    result = result.replace(/\[LANDLORD\/AGENT_Phone_Number\]/gi, '')

    // Landlord/Agent address (for notices)
    const noticeAddress = data.managementType === 'managed' && data.companyAddress
      ? this.formatAddress(data.companyAddress)
      : data.landlords[0] ? this.formatAddress(data.landlords[0].address) : '________'
    result = result.replace(/\[LANDLORD\/AGENT_ADDRESS\]/gi, noticeAddress)

    // Deposit payer (usually first tenant)
    const depositPayer = data.tenants[0] ? this.formatPartyWithAddress(data.tenants[0]) : '________'
    result = result.replace(/\[DEPOSIT_PAYER_NAME_AND_ADDRESS\]/gi, depositPayer)

    // Break clause (English contracts)
    result = result.replace(/\[tenancy_break_clause\]/gi, data.breakClause || '')

    // Special clauses
    result = result.replace(/\[tenancy_special_clause\]/gi, data.specialClauses || '')

    // Welsh contracts - Contract Holders block
    result = this.processContractHoldersBlock(result, data)

    // Remove handlebars conditionals (they're for the old system)
    result = result.replace(/\{\{#if.*?\}\}/gi, '')
    result = result.replace(/\{\{\/if\}\}/gi, '')

    // Handle handlebars loops for signatures
    result = this.processSignatureLoops(result, data)

    // Remove [Anchor: ...] placeholders (legacy signing system)
    result = result.replace(/\[Anchor:.*?\]/gi, '')

    return result
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
        return `**Contract-Holder #${index + 1}:**\n\n| **${tenant.name}** |\n| :---- |\n| ${tenantAddress} |`
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
          .replace(/\{\{display_name\}\}/gi, landlord.name)
          .replace(/\{\{id\}\}/gi, `landlord_${index}`)
      }).join('\n')
    })

    // Process ALL tenants loops
    const tenantLoopRegex = /\{\{#tenants\}\}([\s\S]*?)\{\{\/tenants\}?\}/gi
    result = result.replace(tenantLoopRegex, (match, template) => {
      return data.tenants.map((tenant, index) => {
        return template
          .replace(/\{\{display_name\}\}/gi, tenant.name)
          .replace(/\{\{id\}\}/gi, `tenant_${index}`)
      }).join('\n')
    })

    // Process ALL guarantors loops
    const guarantorLoopRegex = /\{\{#guarantors\}\}([\s\S]*?)\{\{\/guarantors\}?\}/gi
    result = result.replace(guarantorLoopRegex, (match, template) => {
      return (data.guarantors || []).map((guarantor, index) => {
        return template
          .replace(/\{\{display_name\}\}/gi, guarantor.name)
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
      ? `<img src="${signature.signatureImage}" alt="Signature" class="signature-image" style="max-height: 60px; max-width: 200px;" />`
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
   */
  private embedSignatures(html: string, signatures: SignatureData[], data: AgreementPDFData): string {
    let result = html

    // Replace signature placeholders for landlords
    data.landlords.forEach((_, index) => {
      const placeholder = `[Anchor: LANDLORD_SIGNATURE landlord_${index}]`
      const signatureHtml = this.generateSignatureHtml(signatures, 'landlord', index)
      result = result.replace(placeholder, signatureHtml)
    })

    // Replace signature placeholders for tenants
    data.tenants.forEach((_, index) => {
      const placeholder = `[Anchor: TENANT_SIGNATURE tenant_${index}]`
      const signatureHtml = this.generateSignatureHtml(signatures, 'tenant', index)
      result = result.replace(placeholder, signatureHtml)
    })

    // Replace signature placeholders for guarantors
    ;(data.guarantors || []).forEach((_, index) => {
      const placeholder = `[Anchor: GUARANTOR_SIGNATURE guarantor_${index}]`
      const signatureHtml = this.generateSignatureHtml(signatures, 'guarantor', index)
      result = result.replace(placeholder, signatureHtml)
    })

    // Clean up any remaining anchor placeholders
    result = result.replace(/\[Anchor:.*?\]/gi, '')

    return result
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
        <h1 style="text-align: center; color: #f97316; margin-bottom: 30px;">Certificate of Completion</h1>

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
  private wrapInStyledDocument(htmlContent: string, auditCertificate: string = ''): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tenancy Agreement</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 15mm 20mm 15mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11pt;
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
      border-bottom: 2px solid #f97316;
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
        hasGuarantor
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

      // 5. Generate audit certificate if needed
      const auditCertificate = (includeAuditPage && signatures && signatures.length > 0)
        ? this.generateAuditCertificateHtml(options)
        : ''

      // 6. Wrap in styled HTML document
      const fullHtml = this.wrapInStyledDocument(finalHtml, auditCertificate)

      // 7. Generate PDF using Puppeteer
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
}

export const pdfGenerationService = new PDFGenerationService()

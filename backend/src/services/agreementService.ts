import { supabase } from '../config/supabase'

export type TemplateType = 'dps' | 'mydeposits' | 'tds' | 'no_deposit' | 'reposit'

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

export type Language = 'english' | 'welsh'

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
  paymentReference?: string
  // Email addresses
  tenantEmail?: string
  landlordEmail?: string
  agentEmail?: string
  // Property management type
  managementType?: 'managed' | 'let_only'
  // Agent signing on behalf (for managed properties)
  agentSignsOnBehalf?: boolean
  // Clauses
  breakClause?: string
  specialClauses?: string
  // Bills
  billsIncluded?: boolean
  // Company details (for managed properties)
  companyName?: string
  companyAddress?: PropertyAddress
  // Language for the agreement
  language?: Language
}

export interface ComplianceOverride {
  acknowledged: boolean
  reason?: string
}

export interface PropertyIntegration {
  propertyId?: string
  complianceOverride?: ComplianceOverride
}

export class AgreementService {
  /**
   * Save agreement to database
   */
  async saveAgreement(
    agreementData: AgreementData,
    companyId: string,
    userId: string,
    referenceId?: string,
    propertyIntegration?: PropertyIntegration
  ): Promise<string> {
    const payload: Record<string, any> = {
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
      payment_reference: agreementData.paymentReference,
      tenant_email: agreementData.tenantEmail,
      landlord_email: agreementData.landlordEmail,
      agent_email: agreementData.agentEmail,
      management_type: agreementData.managementType,
      agent_signs_on_behalf: agreementData.agentSignsOnBehalf || false,
      break_clause: agreementData.breakClause,
      special_clauses: agreementData.specialClauses,
      bills_included: agreementData.billsIncluded || false,
      language: agreementData.language || 'english',
      company_id: companyId,
      reference_id: referenceId || null,
      created_by: userId,
      created_by_user_id: userId,
      // Property integration
      property_id: propertyIntegration?.propertyId || null,
      compliance_override_acknowledged: propertyIntegration?.complianceOverride?.acknowledged || false,
      compliance_override_reason: propertyIntegration?.complianceOverride?.reason || null,
      compliance_override_at: propertyIntegration?.complianceOverride?.acknowledged ? new Date().toISOString() : null,
      compliance_override_by: propertyIntegration?.complianceOverride?.acknowledged ? userId : null
    }

    let { data, error } = await supabase
      .from('agreements')
      .insert(payload)
      .select('id')
      .single()

    if (error && error.message?.includes('payment_reference')) {
      const fallbackPayload = { ...payload }
      delete fallbackPayload.payment_reference
      const fallback = await supabase
        .from('agreements')
        .insert(fallbackPayload)
        .select('id')
        .single()
      data = fallback.data
      error = fallback.error
    }

    if (error) {
      throw new Error(`Failed to save agreement: ${error.message}`)
    }

    if (!data?.id) {
      throw new Error('Failed to save agreement: no id returned')
    }

    return data.id
  }

  /**
   * Upload generated PDF to Supabase Storage
   */
  async uploadAgreementFile(
    agreementId: string,
    buffer: Buffer,
    fileName: string
  ): Promise<string> {
    const filePath = `agreements/${agreementId}/${fileName}`

    const contentType = 'application/pdf'

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, buffer, {
        contentType,
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

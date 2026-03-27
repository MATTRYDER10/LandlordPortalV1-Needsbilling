/**
 * Tenancy Conversion Service
 *
 * Handles the conversion of completed references into active tenancies.
 * This is a critical workflow that:
 * 1. Validates the reference is ready for conversion
 * 2. Creates the tenancy record
 * 3. Copies tenant data
 * 4. Updates property status
 * 5. Links everything together
 */

import { supabase } from '../config/supabase'
import { encrypt, decrypt } from './encryption'
import {
  createTenancy,
  addTenantToTenancy,
  Tenancy,
  TenancyTenantInput,
  AdditionalCharge
} from './tenancyService'
import { logTenancyEvent } from './unifiedAuditService'

// ============================================================================
// INTERFACES
// ============================================================================

export interface ConversionValidationResult {
  canConvert: boolean
  errors: string[]
  warnings: string[]
  referenceData?: ReferenceDataForConversion
}

export interface ReferenceDataForConversion {
  referenceId: string
  companyId: string
  propertyId: string
  propertyAddress: string
  propertyCity: string
  propertyPostcode: string
  propertyManagementType: 'managed' | 'let_only' | null
  monthlyRent: number
  moveInDate: string
  termYears: number
  termMonths: number
  billsIncluded: boolean
  agreementId?: string
  agreementSigned: boolean
  depositAmount?: number
  tenants: TenantDataForConversion[]
  isGroupTenancy: boolean
  holdingDepositAmount?: number
  holdingDepositReceivedAt?: string
}

export interface TenantDataForConversion {
  referenceId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  rentShare?: number
  isLeadTenant: boolean
  guarantorReferenceId?: string
  status: string
  // Residential address
  residentialAddressLine1?: string
  residentialCity?: string
  residentialPostcode?: string
}

export interface ConversionOptions {
  depositScheme?: 'dps' | 'mydeposits' | 'tds' | 'custodial' | 'insured'
  depositReference?: string
  depositAmount?: number
  additionalCharges?: AdditionalCharge[]
  rentDueDay?: number
  notes?: string
  activateImmediately?: boolean
  managementType?: 'managed' | 'let_only'
}

export interface ConversionResult {
  success: boolean
  tenancy?: Tenancy
  error?: string
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate that a reference can be converted to a tenancy
 */
export async function validateConversion(
  referenceId: string,
  companyId: string
): Promise<ConversionValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []

  // Fetch the reference with all related data
  const { data: reference, error: refError } = await supabase
    .from('tenant_references')
    .select(`
      *,
      child_references:tenant_references!parent_reference_id(
        id,
        status,
        verification_state,
        tenant_first_name_encrypted,
        tenant_last_name_encrypted,
        tenant_email_encrypted,
        tenant_phone_encrypted,
        current_address_line1_encrypted,
        current_city_encrypted,
        current_postcode_encrypted,
        rent_share,
        guarantor_for_reference_id,
        is_guarantor
      ),
      agreements(
        id,
        signing_status,
        signing_completed_at,
        deposit_amount
      )
    `)
    .eq('id', referenceId)
    .eq('company_id', companyId)
    .single()

  if (refError) {
    console.error('[ConversionService] Error fetching reference:', refError)
    return {
      canConvert: false,
      errors: [`Reference not found: ${refError.message}`],
      warnings: []
    }
  }

  if (!reference) {
    console.log('[ConversionService] Reference not found for id:', referenceId, 'company:', companyId)
    return {
      canConvert: false,
      errors: ['Reference not found'],
      warnings: []
    }
  }

  // Check if this is a group parent or standalone reference
  const isGroupParent = reference.is_group_parent === true
  const isStandalone = !reference.parent_reference_id && !isGroupParent

  // For child references, we should convert from the parent
  if (reference.parent_reference_id) {
    return {
      canConvert: false,
      errors: ['Cannot convert a child reference directly. Please convert from the parent reference.'],
      warnings: []
    }
  }

  // Check if already converted
  const { data: existingTenancy } = await supabase
    .from('tenancies')
    .select('id')
    .eq('primary_reference_id', referenceId)
    .is('deleted_at', null)
    .single()

  if (existingTenancy) {
    return {
      canConvert: false,
      errors: ['This reference has already been converted to a tenancy'],
      warnings: []
    }
  }

  // Check property is linked (frontend handles this by allowing property selection)
  if (!reference.linked_property_id) {
    errors.push('Reference is not linked to a property. Please link a property before converting.')
  }

  // Fetch property management_type
  let propertyManagementType: 'managed' | 'let_only' | null = null
  if (reference.linked_property_id) {
    const { data: property } = await supabase
      .from('properties')
      .select('management_type')
      .eq('id', reference.linked_property_id)
      .single()
    propertyManagementType = property?.management_type || null
  }

  // Note: We allow conversion for ANY reference status (sent, completed, rejected, etc.)
  // The tenancy system handles all cases - this enables legacy data migration

  // Get agreement if exists (no warnings - agreements are handled within tenancy management)
  const agreement = reference.agreements?.[0]

  // Build reference data for conversion
  let referenceData: ReferenceDataForConversion | undefined

  if (errors.length === 0 || (errors.length === 0 && warnings.length > 0)) {
    const tenants: TenantDataForConversion[] = []

    if (isGroupParent) {
      // Add all non-guarantor children as tenants
      const children = reference.child_references || []
      for (const child of children) {
        if (child.is_guarantor) continue

        // Find if this tenant has a guarantor
        const guarantor = children.find((c: any) =>
          c.is_guarantor && c.guarantor_for_reference_id === child.id
        )

        tenants.push({
          referenceId: child.id,
          firstName: decrypt(child.tenant_first_name_encrypted) || '',
          lastName: decrypt(child.tenant_last_name_encrypted) || '',
          email: decrypt(child.tenant_email_encrypted) || '',
          phone: decrypt(child.tenant_phone_encrypted) || '',
          rentShare: child.rent_share,
          isLeadTenant: tenants.length === 0, // First tenant is lead
          guarantorReferenceId: guarantor?.id,
          status: child.status,
          // Current address from reference (stored as current_* in tenant_references)
          residentialAddressLine1: decrypt(child.current_address_line1_encrypted) || '',
          residentialCity: decrypt(child.current_city_encrypted) || '',
          residentialPostcode: decrypt(child.current_postcode_encrypted) || ''
        })
      }
    } else {
      // Standalone reference - single tenant
      tenants.push({
        referenceId: reference.id,
        firstName: decrypt(reference.tenant_first_name_encrypted) || '',
        lastName: decrypt(reference.tenant_last_name_encrypted) || '',
        email: decrypt(reference.tenant_email_encrypted) || '',
        phone: decrypt(reference.tenant_phone_encrypted) || '',
        rentShare: reference.monthly_rent,
        isLeadTenant: true,
        status: reference.status,
        // Current address from reference (stored as current_* in tenant_references)
        residentialAddressLine1: decrypt(reference.current_address_line1_encrypted) || '',
        residentialCity: decrypt(reference.current_city_encrypted) || '',
        residentialPostcode: decrypt(reference.current_postcode_encrypted) || ''
      })
    }

    referenceData = {
      referenceId: reference.id,
      companyId: reference.company_id,
      propertyId: reference.linked_property_id,
      propertyAddress: decrypt(reference.property_address_encrypted) || '',
      propertyCity: decrypt(reference.property_city_encrypted) || '',
      propertyPostcode: decrypt(reference.property_postcode_encrypted) || '',
      propertyManagementType,
      monthlyRent: reference.monthly_rent,
      moveInDate: reference.move_in_date,
      termYears: reference.term_years || 0,
      termMonths: reference.term_months || 0,
      billsIncluded: reference.bills_included || false,
      agreementId: agreement?.id,
      agreementSigned: !!agreement?.signing_completed_at,
      depositAmount: agreement?.deposit_amount,
      tenants,
      isGroupTenancy: isGroupParent,
      holdingDepositAmount: reference.holding_deposit_amount || undefined,
      holdingDepositReceivedAt: reference.holding_deposit_received_at || undefined
    }
  }

  return {
    canConvert: errors.length === 0,
    errors,
    warnings,
    referenceData
  }
}

// ============================================================================
// CONVERSION
// ============================================================================

/**
 * Convert a reference to a tenancy
 */
export async function convertReferenceToTenancy(
  referenceId: string,
  companyId: string,
  options: ConversionOptions = {},
  userId?: string
): Promise<ConversionResult> {
  // First validate
  const validation = await validateConversion(referenceId, companyId)

  if (!validation.canConvert) {
    return {
      success: false,
      error: validation.errors.join('; ')
    }
  }

  const refData = validation.referenceData!

  try {
    // Calculate end date
    let endDate: string | undefined
    if (refData.termYears || refData.termMonths) {
      const startDate = new Date(refData.moveInDate)
      startDate.setFullYear(startDate.getFullYear() + refData.termYears)
      startDate.setMonth(startDate.getMonth() + refData.termMonths)
      endDate = startDate.toISOString().split('T')[0]
    }

    // Determine deposit amount
    const depositAmount = options.depositAmount ||
      refData.depositAmount ||
      Math.floor((refData.monthlyRent * 12 / 52) * 5) // Default to 5 weeks rent

    // Build tenant inputs
    const tenantInputs: TenancyTenantInput[] = refData.tenants.map(t => ({
      referenceId: t.referenceId,
      firstName: t.firstName,
      lastName: t.lastName,
      email: t.email,
      phone: t.phone,
      isLeadTenant: t.isLeadTenant,
      rentShare: t.rentShare,
      guarantorReferenceId: t.guarantorReferenceId,
      // Residential address from reference
      residentialAddressLine1: t.residentialAddressLine1,
      residentialCity: t.residentialCity,
      residentialPostcode: t.residentialPostcode
    }))

    // Create the tenancy
    // Management type: use option if provided, otherwise default to property setting
    const managementType = options.managementType || refData.propertyManagementType || undefined

    const tenancy = await createTenancy({
      companyId: refData.companyId,
      propertyId: refData.propertyId,
      primaryReferenceId: refData.referenceId,
      agreementId: refData.agreementId,
      tenancyType: 'ast',
      startDate: refData.moveInDate,
      endDate,
      fixedTermEndDate: endDate,
      monthlyRent: refData.monthlyRent,
      depositAmount,
      depositScheme: options.depositScheme,
      depositReference: options.depositReference,
      billsIncluded: refData.billsIncluded,
      additionalCharges: options.additionalCharges || [],
      rentDueDay: options.rentDueDay || 1,
      notes: options.notes,
      createdBy: userId,
      managementType,
      holdingDepositAmount: refData.holdingDepositAmount,
      holdingDepositReceivedAt: refData.holdingDepositReceivedAt
    }, tenantInputs)

    // If activateImmediately, update status to active
    if (options.activateImmediately) {
      const { error: updateError } = await supabase
        .from('tenancies')
        .update({ status: 'active' })
        .eq('id', tenancy.id)

      if (!updateError) {
        tenancy.status = 'active'
      }
    }

    // Update property address if it's null (for legacy properties without encrypted addresses)
    if (refData.propertyId && (refData.propertyAddress || refData.propertyCity)) {
      // Check if property has null address fields
      const { data: property } = await supabase
        .from('properties')
        .select('address_line1_encrypted, city_encrypted')
        .eq('id', refData.propertyId)
        .single()

      if (property && !property.address_line1_encrypted && !property.city_encrypted) {
        // Update property with address from reference
        const updateData: Record<string, any> = {
          updated_at: new Date().toISOString()
        }
        if (refData.propertyAddress) {
          updateData.address_line1_encrypted = encrypt(refData.propertyAddress)
          updateData.full_address_encrypted = encrypt(
            [refData.propertyAddress, refData.propertyCity, refData.propertyPostcode].filter(Boolean).join(', ')
          )
        }
        if (refData.propertyCity) {
          updateData.city_encrypted = encrypt(refData.propertyCity)
        }

        await supabase
          .from('properties')
          .update(updateData)
          .eq('id', refData.propertyId)

        console.log('[ConversionService] Updated property address from reference:', refData.propertyId)
      }
    }

    // Update all related references to mark as converted
    const referenceIds = [refData.referenceId, ...refData.tenants.map(t => t.referenceId)]
    await supabase
      .from('tenant_references')
      .update({
        converted_to_tenancy_id: tenancy.id,
        converted_at: new Date().toISOString()
      })
      .in('id', referenceIds)

    // Update property_tenancies with tenancy_id
    await supabase
      .from('property_tenancies')
      .update({
        tenancy_id: tenancy.id,
        updated_at: new Date().toISOString()
      })
      .eq('property_id', refData.propertyId)
      .in('reference_id', referenceIds)

    // Log conversion event
    await logTenancyEvent('CONVERTED', {
      companyId,
      tenancyId: tenancy.id,
      propertyId: refData.propertyId,
      tenantNames: refData.tenants.map(t => `${t.firstName} ${t.lastName}`),
      userId,
      metadata: {
        source_reference_id: refData.referenceId,
        tenant_count: refData.tenants.length,
        agreement_signed: refData.agreementSigned
      }
    })

    return {
      success: true,
      tenancy
    }
  } catch (error: any) {
    console.error('[ConversionService] Conversion failed:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get conversion preview data for UI
 */
export async function getConversionPreview(
  referenceId: string,
  companyId: string
): Promise<ConversionValidationResult> {
  return validateConversion(referenceId, companyId)
}

/**
 * Check if a reference has been converted
 */
export async function isReferenceConverted(
  referenceId: string
): Promise<{ converted: boolean; tenancyId?: string }> {
  const { data } = await supabase
    .from('tenant_references')
    .select('converted_to_tenancy_id')
    .eq('id', referenceId)
    .single()

  return {
    converted: !!data?.converted_to_tenancy_id,
    tenancyId: data?.converted_to_tenancy_id
  }
}

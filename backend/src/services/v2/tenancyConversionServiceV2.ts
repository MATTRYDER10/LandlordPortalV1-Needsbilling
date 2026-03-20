/**
 * V2 Tenancy Conversion Service
 *
 * Handles conversion of V2 references into tenancies.
 * Cloned from V1 but reads from tenant_references_v2 table.
 */

import { supabase } from '../../config/supabase'
import { encrypt, decrypt } from '../encryption'
import {
  createTenancy,
  Tenancy,
  TenancyTenantInput,
  AdditionalCharge,
  DepositScheme
} from '../tenancyService'
import { logTenancyEvent } from '../unifiedAuditService'

// ============================================================================
// INTERFACES
// ============================================================================

export interface V2ConversionValidationResult {
  canConvert: boolean
  errors: string[]
  warnings: string[]
  referenceData?: V2ReferenceDataForConversion
}

export interface V2ReferenceDataForConversion {
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
  depositAmount?: number
  tenants: V2TenantDataForConversion[]
  isGroupTenancy: boolean
  holdingDepositAmount?: number
  offerId?: string
  depositReplacementOffered?: boolean
}

export interface V2TenantDataForConversion {
  referenceId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  rentShare?: number
  isLeadTenant: boolean
  guarantorReferenceId?: string
  status: string
  residentialAddressLine1?: string
  residentialCity?: string
  residentialPostcode?: string
}

export interface V2ConversionOptions {
  depositScheme?: string
  depositReference?: string
  depositAmount?: number
  additionalCharges?: AdditionalCharge[]
  rentDueDay?: number
  notes?: string
  activateImmediately?: boolean
  managementType?: 'managed' | 'let_only'
}

export interface V2ConversionResult {
  success: boolean
  tenancy?: Tenancy
  error?: string
}

// ============================================================================
// VALIDATION
// ============================================================================

export async function validateV2Conversion(
  referenceId: string,
  companyId: string
): Promise<V2ConversionValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []

  // Fetch the V2 reference
  const { data: reference, error: refError } = await supabase
    .from('tenant_references_v2')
    .select('*')
    .eq('id', referenceId)
    .eq('company_id', companyId)
    .single()

  if (refError || !reference) {
    return {
      canConvert: false,
      errors: ['Reference not found'],
      warnings: []
    }
  }

  // Check if child reference
  if (reference.parent_reference_id) {
    return {
      canConvert: false,
      errors: ['Cannot convert a child reference directly. Please convert from the parent reference.'],
      warnings: []
    }
  }

  // Check if already converted
  if (reference.converted_to_tenancy_id) {
    return {
      canConvert: false,
      errors: ['This reference has already been converted to a tenancy'],
      warnings: []
    }
  }

  // Also check tenancies table
  const { data: existingTenancy } = await supabase
    .from('tenancies')
    .select('id')
    .eq('primary_reference_id', referenceId)
    .is('deleted_at', null)
    .maybeSingle()

  if (existingTenancy) {
    return {
      canConvert: false,
      errors: ['This reference has already been converted to a tenancy'],
      warnings: []
    }
  }

  // Check property is linked
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

  // Check if group parent
  const isGroupParent = reference.is_group_parent === true

  // Build reference data
  let referenceData: V2ReferenceDataForConversion | undefined

  if (errors.length === 0) {
    const tenants: V2TenantDataForConversion[] = []

    if (isGroupParent) {
      // Fetch all children
      const { data: children } = await supabase
        .from('tenant_references_v2')
        .select('*')
        .eq('parent_reference_id', referenceId)
        .order('created_at')

      for (const child of (children || [])) {
        if (child.is_guarantor) continue

        // Find guarantor for this tenant
        const guarantor = (children || []).find((c: any) =>
          c.is_guarantor && c.guarantor_for_reference_id === child.id
        )

        tenants.push({
          referenceId: child.id,
          firstName: decrypt(child.tenant_first_name_encrypted) || '',
          lastName: decrypt(child.tenant_last_name_encrypted) || '',
          email: decrypt(child.tenant_email_encrypted) || '',
          phone: decrypt(child.tenant_phone_encrypted) || '',
          rentShare: child.rent_share,
          isLeadTenant: tenants.length === 0,
          guarantorReferenceId: guarantor?.id,
          status: child.status,
          residentialAddressLine1: decrypt(child.current_address_line1_encrypted) || '',
          residentialCity: decrypt(child.current_city_encrypted) || '',
          residentialPostcode: decrypt(child.current_postcode_encrypted) || ''
        })
      }
    } else {
      // Standalone - single tenant
      tenants.push({
        referenceId: reference.id,
        firstName: decrypt(reference.tenant_first_name_encrypted) || '',
        lastName: decrypt(reference.tenant_last_name_encrypted) || '',
        email: decrypt(reference.tenant_email_encrypted) || '',
        phone: decrypt(reference.tenant_phone_encrypted) || '',
        rentShare: reference.rent_share || reference.monthly_rent,
        isLeadTenant: true,
        status: reference.status,
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
      depositAmount: reference.deposit_amount,
      tenants,
      isGroupTenancy: isGroupParent,
      holdingDepositAmount: reference.holding_deposit_amount || undefined,
      offerId: reference.offer_id || undefined,
      depositReplacementOffered: reference.deposit_replacement_offered || false
    }

    // Add warnings
    if (!reference.form_submitted_at) {
      warnings.push('Tenant has not submitted their reference form yet')
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

export async function convertV2ReferenceToTenancy(
  referenceId: string,
  companyId: string,
  options: V2ConversionOptions = {},
  userId?: string
): Promise<V2ConversionResult> {
  const validation = await validateV2Conversion(referenceId, companyId)

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
      Math.round((refData.monthlyRent * 12 / 52) * 5 * 100) / 100

    // Build tenant inputs - don't pass referenceId or guarantorReferenceId
    // as those FKs point to tenant_references (V1), not V2
    const tenantInputs: TenancyTenantInput[] = refData.tenants.map(t => ({
      firstName: t.firstName,
      lastName: t.lastName,
      email: t.email,
      phone: t.phone,
      isLeadTenant: t.isLeadTenant,
      rentShare: t.rentShare,
      residentialAddressLine1: t.residentialAddressLine1,
      residentialCity: t.residentialCity,
      residentialPostcode: t.residentialPostcode
    }))

    const managementType = options.managementType || refData.propertyManagementType || undefined

    const tenancy = await createTenancy({
      companyId: refData.companyId,
      propertyId: refData.propertyId,
      // Don't set primaryReferenceId - FK points to tenant_references (V1), not V2
      tenancyType: 'ast',
      startDate: refData.moveInDate,
      endDate,
      fixedTermEndDate: endDate,
      monthlyRent: refData.monthlyRent,
      depositAmount,
      depositScheme: options.depositScheme as DepositScheme | undefined,
      depositReference: options.depositReference,
      billsIncluded: refData.billsIncluded,
      additionalCharges: options.additionalCharges || [],
      rentDueDay: options.rentDueDay || 1,
      notes: options.notes,
      createdBy: userId,
      managementType,
      holdingDepositAmount: refData.holdingDepositAmount
    }, tenantInputs)

    // Activate immediately if requested
    if (options.activateImmediately) {
      const { error: updateError } = await supabase
        .from('tenancies')
        .update({ status: 'active' })
        .eq('id', tenancy.id)

      if (!updateError) {
        tenancy.status = 'active'
      }
    }

    // Update property address if needed
    if (refData.propertyId && refData.propertyAddress) {
      const { data: property } = await supabase
        .from('properties')
        .select('address_line1_encrypted, city_encrypted')
        .eq('id', refData.propertyId)
        .single()

      if (property && !property.address_line1_encrypted && !property.city_encrypted) {
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
      }
    }

    // Mark V2 references as converted
    const referenceIds = [refData.referenceId, ...refData.tenants.map(t => t.referenceId)]
    await supabase
      .from('tenant_references_v2')
      .update({
        converted_to_tenancy_id: tenancy.id,
        converted_at: new Date().toISOString()
      })
      .in('id', referenceIds)

    // Update property_tenancies
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
        source_type: 'v2',
        tenant_count: refData.tenants.length
      }
    })

    return {
      success: true,
      tenancy
    }
  } catch (error: any) {
    console.error('[V2ConversionService] Conversion failed:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

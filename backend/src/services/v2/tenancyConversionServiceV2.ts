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
  addGuarantorToTenancy,
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
  guarantors: V2GuarantorDataForConversion[]
  isGroupTenancy: boolean
  holdingDepositAmount?: number
  offerId?: string
  depositReplacementOffered?: boolean
}

export interface V2GuarantorDataForConversion {
  referenceId: string
  firstName: string
  lastName: string
  email: string
  forTenantName: string
  status: string
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

      // Also fetch guarantors that point to the parent or any child
      // Check both directions: guarantor_for_reference_id on the guarantor, and guarantor_reference_id on the tenant
      const allRefIds = [referenceId, ...(children || []).map(c => c.id)]
      const { data: guarantorsByForId } = await supabase
        .from('tenant_references_v2')
        .select('*')
        .eq('is_guarantor', true)
        .in('guarantor_for_reference_id', allRefIds)

      // Also check reverse link: tenant refs that have guarantor_reference_id set
      const allRefs = [reference, ...(children || [])]
      const reverseGuarantorIds = allRefs
        .map(r => r.guarantor_reference_id)
        .filter(Boolean)
      let guarantorsByReverseId: any[] = []
      if (reverseGuarantorIds.length > 0) {
        const { data: reverseGuarantors } = await supabase
          .from('tenant_references_v2')
          .select('*')
          .eq('is_guarantor', true)
          .in('id', reverseGuarantorIds)
        guarantorsByReverseId = reverseGuarantors || []
      }

      // Merge and deduplicate guarantors
      const guarantorMap = new Map<string, any>()
      for (const g of [...(guarantorsByForId || []), ...guarantorsByReverseId]) {
        guarantorMap.set(g.id, g)
      }
      const guarantors = Array.from(guarantorMap.values())

      // Include the parent reference as the lead tenant
      const parentFormData = reference.form_data?.residential?.currentAddress
      const parentGuarantor = (guarantors || []).find((g: any) =>
        g.guarantor_for_reference_id === reference.id
      )
      tenants.push({
        referenceId: reference.id,
        firstName: decrypt(reference.tenant_first_name_encrypted) || '',
        lastName: decrypt(reference.tenant_last_name_encrypted) || '',
        email: decrypt(reference.tenant_email_encrypted) || '',
        phone: decrypt(reference.tenant_phone_encrypted) || '',
        rentShare: reference.rent_share,
        isLeadTenant: true,
        guarantorReferenceId: parentGuarantor?.id,
        status: reference.status,
        residentialAddressLine1: decrypt(reference.current_address_line1_encrypted) || (parentFormData?.line1 ? decrypt(parentFormData.line1) : '') || '',
        residentialCity: decrypt(reference.current_city_encrypted) || (parentFormData?.city ? decrypt(parentFormData.city) : '') || '',
        residentialPostcode: decrypt(reference.current_postcode_encrypted) || (parentFormData?.postcode ? decrypt(parentFormData.postcode) : '') || ''
      })

      // Add child tenant references
      for (const child of (children || [])) {
        if (child.is_guarantor) continue

        // Find guarantor for this tenant (search both children and standalone guarantors)
        const guarantor = (guarantors || []).find((g: any) =>
          g.guarantor_for_reference_id === child.id
        )

        const childFormData = child.form_data?.residential?.currentAddress
        tenants.push({
          referenceId: child.id,
          firstName: decrypt(child.tenant_first_name_encrypted) || '',
          lastName: decrypt(child.tenant_last_name_encrypted) || '',
          email: decrypt(child.tenant_email_encrypted) || '',
          phone: decrypt(child.tenant_phone_encrypted) || '',
          rentShare: child.rent_share,
          isLeadTenant: false,
          guarantorReferenceId: guarantor?.id,
          status: child.status,
          residentialAddressLine1: decrypt(child.current_address_line1_encrypted) || (childFormData?.line1 ? decrypt(childFormData.line1) : '') || '',
          residentialCity: decrypt(child.current_city_encrypted) || (childFormData?.city ? decrypt(childFormData.city) : '') || '',
          residentialPostcode: decrypt(child.current_postcode_encrypted) || (childFormData?.postcode ? decrypt(childFormData.postcode) : '') || ''
        })
      }
    } else {
      // Standalone - single tenant, check for guarantor (both directions)
      let standaloneGuarantorId: string | undefined
      // Check forward: guarantor whose guarantor_for_reference_id points to this ref
      const { data: standaloneGuarantors } = await supabase
        .from('tenant_references_v2')
        .select('id')
        .eq('is_guarantor', true)
        .eq('guarantor_for_reference_id', referenceId)
        .limit(1)
      standaloneGuarantorId = standaloneGuarantors?.[0]?.id
      // Check reverse: this reference has guarantor_reference_id set
      if (!standaloneGuarantorId && reference.guarantor_reference_id) {
        standaloneGuarantorId = reference.guarantor_reference_id
      }

      const refFormData = reference.form_data?.residential?.currentAddress
      tenants.push({
        referenceId: reference.id,
        firstName: decrypt(reference.tenant_first_name_encrypted) || '',
        lastName: decrypt(reference.tenant_last_name_encrypted) || '',
        email: decrypt(reference.tenant_email_encrypted) || '',
        phone: decrypt(reference.tenant_phone_encrypted) || '',
        rentShare: reference.rent_share || reference.monthly_rent,
        isLeadTenant: true,
        guarantorReferenceId: standaloneGuarantorId,
        status: reference.status,
        residentialAddressLine1: decrypt(reference.current_address_line1_encrypted) || (refFormData?.line1 ? decrypt(refFormData.line1) : '') || '',
        residentialCity: decrypt(reference.current_city_encrypted) || (refFormData?.city ? decrypt(refFormData.city) : '') || '',
        residentialPostcode: decrypt(reference.current_postcode_encrypted) || (refFormData?.postcode ? decrypt(refFormData.postcode) : '') || ''
      })
    }

    // Build guarantors list for display
    const guarantorDisplayList: V2GuarantorDataForConversion[] = []
    for (const tenant of tenants) {
      if (!tenant.guarantorReferenceId) continue
      const { data: gRef } = await supabase
        .from('tenant_references_v2')
        .select('id, tenant_first_name_encrypted, tenant_last_name_encrypted, tenant_email_encrypted, status')
        .eq('id', tenant.guarantorReferenceId)
        .single()
      if (gRef) {
        guarantorDisplayList.push({
          referenceId: gRef.id,
          firstName: decrypt(gRef.tenant_first_name_encrypted) || '',
          lastName: decrypt(gRef.tenant_last_name_encrypted) || '',
          email: decrypt(gRef.tenant_email_encrypted) || '',
          forTenantName: `${tenant.firstName} ${tenant.lastName}`.trim(),
          status: gRef.status
        })
      }
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
      guarantors: guarantorDisplayList,
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
      Math.floor((refData.monthlyRent * 12 / 52) * 5)

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
      // primary_reference_id has FK to V1 tenant_references — can't store V2 ID there
      // Store V2 ref ID separately after creation
      tenancyType: 'ast',
      startDate: refData.moveInDate,
      endDate,
      fixedTermEndDate: endDate,
      monthlyRent: refData.monthlyRent,
      depositAmount,
      depositScheme: refData.depositReplacementOffered ? 'reposit' as DepositScheme : options.depositScheme as DepositScheme | undefined,
      depositReference: options.depositReference,
      billsIncluded: refData.billsIncluded,
      additionalCharges: options.additionalCharges || [],
      rentDueDay: options.rentDueDay || 1,
      notes: options.notes,
      createdBy: userId,
      managementType,
      holdingDepositAmount: refData.holdingDepositAmount
    }, tenantInputs)

    // Store V2 reference ID on tenancy for offer/UniHome/Reposit lookups
    // Requires FK constraint to be dropped: ALTER TABLE tenancies DROP CONSTRAINT tenancies_primary_reference_id_fkey;
    const { error: refIdError } = await supabase
      .from('tenancies')
      .update({ primary_reference_id: referenceId })
      .eq('id', tenancy.id)

    if (refIdError) {
      console.warn(`[V2 Conversion] Could not store V2 ref ID on tenancy: ${refIdError.message}`)
    } else {
      console.log(`[V2 Conversion] Stored V2 reference ID ${referenceId} on tenancy ${tenancy.id}`)
    }

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

    // Create guarantor records from V2 guarantor references
    for (const tenant of refData.tenants) {
      if (!tenant.guarantorReferenceId) continue

      try {
        // Fetch guarantor reference details
        const { data: guarantorRef } = await supabase
          .from('tenant_references_v2')
          .select('id, tenant_first_name_encrypted, tenant_last_name_encrypted, tenant_email_encrypted, tenant_phone_encrypted, guarantor_relationship, form_data, current_address_line1_encrypted, current_city_encrypted, current_postcode_encrypted')
          .eq('id', tenant.guarantorReferenceId)
          .single()

        if (guarantorRef) {
          const gFirstName = decrypt(guarantorRef.tenant_first_name_encrypted) || ''
          const gLastName = decrypt(guarantorRef.tenant_last_name_encrypted) || ''
          const gEmail = decrypt(guarantorRef.tenant_email_encrypted) || ''
          const gPhone = decrypt(guarantorRef.tenant_phone_encrypted) || ''

          // Get address — form_data.address stores plaintext for guarantors, encrypted columns for tenants
          const gFormAddress = (guarantorRef.form_data as any)?.address || {}
          const gAddressLine1 = gFormAddress.line1 || decrypt(guarantorRef.current_address_line1_encrypted) || ''
          const gCity = gFormAddress.city || decrypt(guarantorRef.current_city_encrypted) || ''
          const gPostcode = gFormAddress.postcode || decrypt(guarantorRef.current_postcode_encrypted) || ''

          // Find the tenancy_tenant record to link guarantor to the correct tenant
          const { data: tenancyTenants } = await supabase
            .from('tenancy_tenants')
            .select('id, tenant_name_encrypted')
            .eq('tenancy_id', tenancy.id)
            .eq('is_active', true)

          // Match by name — the tenant this guarantor is for
          const tenantFullName = `${tenant.firstName} ${tenant.lastName}`.trim().toLowerCase()
          const matchedTenantRecord = (tenancyTenants || []).find((tt: any) => {
            const ttName = (decrypt(tt.tenant_name_encrypted) || '').trim().toLowerCase()
            return ttName === tenantFullName
          })

          await addGuarantorToTenancy(tenancy.id, {
            guarantorReferenceId: guarantorRef.id,
            guaranteesTenantId: matchedTenantRecord?.id || undefined,
            firstName: gFirstName,
            lastName: gLastName,
            email: gEmail,
            phone: gPhone,
            addressLine1: gAddressLine1,
            city: gCity,
            postcode: gPostcode,
            relationshipToTenant: guarantorRef.guarantor_relationship || undefined
          })

          console.log(`[V2 Conversion] Created guarantor record for ${gFirstName} ${gLastName} on tenancy ${tenancy.id}`)
        }
      } catch (guarantorError) {
        console.error(`[V2 Conversion] Failed to create guarantor record:`, guarantorError)
        // Non-blocking — continue conversion even if guarantor creation fails
      }
    }

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

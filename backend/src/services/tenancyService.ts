/**
 * Tenancy Service
 *
 * Provides CRUD operations for tenancies and related entities:
 * - Create tenancy from completed reference
 * - Get tenancy details
 * - List tenancies with filters
 * - Update tenancy
 * - End tenancy
 * - Manage tenancy tenants
 */

import { supabase } from '../config/supabase'
import { encrypt, decrypt } from './encryption'
import { logUnifiedAuditEvent, logTenancyEvent } from './unifiedAuditService'

// ============================================================================
// INTERFACES
// ============================================================================

export interface CreateTenancyInput {
  companyId: string
  propertyId: string
  primaryReferenceId?: string
  agreementId?: string
  tenancyType?: TenancyType
  startDate: string
  endDate?: string
  fixedTermEndDate?: string
  monthlyRent: number
  depositAmount?: number
  depositScheme?: DepositScheme
  depositReference?: string
  billsIncluded?: boolean
  additionalCharges?: AdditionalCharge[]
  rentDueDay?: number
  hasBreakClause?: boolean
  breakClauseDate?: string
  breakClauseNoticeDays?: number
  notes?: string
  createdBy?: string
  managementType?: 'managed' | 'let_only'
  holdingDepositAmount?: number
  holdingDepositReceivedAt?: string
}

export interface TenancyTenantInput {
  referenceId?: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  dateOfBirth?: string
  isLeadTenant?: boolean
  rentShare?: number
  rentSharePercentage?: number
  guarantorReferenceId?: string
  // Residential address
  residentialAddressLine1?: string
  residentialAddressLine2?: string
  residentialCity?: string
  residentialPostcode?: string
}

export interface UpdateTenancyInput {
  status?: TenancyStatus
  startDate?: string
  endDate?: string
  actualEndDate?: string
  tenancyType?: TenancyType
  monthlyRent?: number
  rentDueDay?: number
  depositAmount?: number
  depositScheme?: DepositScheme
  depositReference?: string
  depositProtectedAt?: string
  billsIncluded?: boolean
  hasRlp?: boolean
  additionalCharges?: AdditionalCharge[]
  compliancePackSentAt?: string
  compliancePackSentBy?: string
  notes?: string
  // Initial monies tracking
  initialMoniesRequestedAt?: string
  initialMoniesRequestedBy?: string
  initialMoniesTenantConfirmedAt?: string
  initialMoniesPaidAt?: string
  initialMoniesConfirmedBy?: string
  // Agreement linking
  agreementId?: string
  // Management type (overrides property setting)
  managementType?: 'managed' | 'let_only'
}

export interface TenancyFilters {
  status?: TenancyStatus | TenancyStatus[]
  propertyId?: string
  search?: string
  startDateFrom?: string
  startDateTo?: string
  includeDeleted?: boolean
}

export interface PaginationOptions {
  limit?: number
  offset?: number
  orderBy?: string
  orderDirection?: 'asc' | 'desc'
}

export type TenancyType = 'ast' | 'periodic' | 'company_let' | 'lodger' | 'license'
export type TenancyStatus = 'pending' | 'active' | 'notice_given' | 'ended' | 'terminated' | 'expired' | 'fallen_through'
export type DepositScheme = 'dps' | 'dps_custodial' | 'dps_insured' | 'mydeposits' | 'mydeposits_custodial' | 'mydeposits_insured' | 'tds' | 'tds_custodial' | 'tds_insured' | 'reposit' | 'custodial' | 'insured' | 'landlord_held' | 'no_deposit'

export interface AdditionalCharge {
  name: string
  amount: number
  frequency: 'one_time' | 'monthly' | 'annual'
}

export interface Tenancy {
  id: string
  company_id: string
  property_id: string
  primary_reference_id: string | null
  agreement_id: string | null
  tenancy_type: TenancyType
  status: TenancyStatus
  start_date: string
  end_date: string | null
  fixed_term_end_date: string | null
  actual_end_date: string | null
  notice_period_days: number
  monthly_rent: number
  deposit_amount: number | null
  deposit_scheme: DepositScheme | null
  deposit_reference: string | null
  deposit_protected_at: string | null
  bills_included: boolean
  has_rlp: boolean
  additional_charges: AdditionalCharge[]
  rent_due_day: number
  has_break_clause: boolean
  break_clause_date: string | null
  break_clause_notice_days: number | null
  compliance_pack_sent_at: string | null
  compliance_pack_sent_by: string | null
  // Initial monies tracking
  initial_monies_requested_at: string | null
  initial_monies_requested_by: string | null
  initial_monies_tenant_confirmed_at: string | null
  initial_monies_paid_at: string | null
  initial_monies_confirmed_by: string | null
  // Move-in time tracking
  move_in_time_requested_at?: string | null
  move_in_time_submitted_at?: string | null
  move_in_time_slot_1?: string | null
  move_in_time_slot_2?: string | null
  move_in_time_tenant_notes?: string | null
  move_in_time_confirmed?: string | null
  move_in_time_confirmed_at?: string | null
  // Holding deposit
  holding_deposit_amount: string | null
  // Management type (overrides property setting if set)
  management_type: 'managed' | 'let_only' | null
  notes: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  // Joined data
  property?: any
  tenants?: TenancyTenant[]
  agreement?: any
  // Computed - agreement signing status
  signing_status?: string | null
}

export interface TenancyTenant {
  id: string
  tenancy_id: string
  reference_id: string | null
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  date_of_birth: string | null
  is_lead_tenant: boolean
  rent_share: number | null
  rent_share_percentage: number | null
  tenant_order: number | null
  status: 'active' | 'replaced' | 'removed' | 'never_moved_in' | 'pending'
  left_date: string | null
  guarantor_reference_id: string | null
  // Residential address
  residential_address_line1: string | null
  residential_address_line2: string | null
  residential_city: string | null
  residential_postcode: string | null
}

// ============================================================================
// CREATE TENANCY
// ============================================================================

/**
 * Create a new tenancy
 */
export async function createTenancy(
  input: CreateTenancyInput,
  tenants?: TenancyTenantInput[]
): Promise<Tenancy> {
  const {
    companyId,
    propertyId,
    primaryReferenceId,
    agreementId,
    tenancyType = 'ast',
    startDate,
    endDate,
    fixedTermEndDate,
    monthlyRent,
    depositAmount,
    depositScheme,
    depositReference,
    billsIncluded = false,
    additionalCharges = [],
    rentDueDay = 1,
    hasBreakClause = false,
    breakClauseDate,
    breakClauseNoticeDays,
    notes,
    createdBy,
    managementType,
    holdingDepositAmount,
    holdingDepositReceivedAt
  } = input

  // Generate reference number (TEN-YYYYMMDD-XXXX format)
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase()
  const referenceNumber = `TEN-${datePart}-${randomPart}`

  // Auto-set tenancy type based on RRA cutoff if not explicitly periodic
  const RRA_CUTOFF = '2026-05-01'
  let resolvedTenancyType = tenancyType
  if (startDate && new Date(startDate) >= new Date(RRA_CUTOFF) && tenancyType === 'ast') {
    resolvedTenancyType = 'periodic'
  }

  // Create tenancy record - using actual table column names
  const insertData: Record<string, any> = {
    company_id: companyId,
    property_id: propertyId,
    reference_number: referenceNumber,
    status: 'pending',
    tenancy_type: resolvedTenancyType,
    tenancy_start_date: startDate,
    rent_amount: monthlyRent,
    created_by: createdBy
  }

  // Add optional fields only if they have values (using actual column names)
  if (primaryReferenceId) insertData.primary_reference_id = primaryReferenceId
  if (agreementId) insertData.agreement_id = agreementId
  if (endDate) insertData.tenancy_end_date = endDate
  if (fixedTermEndDate) insertData.fixed_term_end_date = fixedTermEndDate
  if (depositAmount) insertData.deposit_amount = depositAmount
  if (depositScheme) insertData.deposit_scheme = depositScheme
  if (depositReference) insertData.deposit_reference = depositReference
  if (billsIncluded !== undefined) insertData.bills_included = billsIncluded
  if (additionalCharges && additionalCharges.length > 0) insertData.additional_charges = additionalCharges
  if (rentDueDay) insertData.rent_due_day = rentDueDay
  if (hasBreakClause !== undefined) insertData.has_break_clause = hasBreakClause
  if (breakClauseDate) insertData.break_clause_date = breakClauseDate
  if (breakClauseNoticeDays) insertData.break_clause_notice_days = breakClauseNoticeDays
  if (notes) insertData.notes_encrypted = encrypt(notes)
  if (startDate) insertData.move_in_date = startDate
  if (managementType) insertData.management_type = managementType
  if (holdingDepositAmount) insertData.holding_deposit_amount = holdingDepositAmount
  if (holdingDepositReceivedAt) insertData.holding_deposit_received_at = holdingDepositReceivedAt

  const { data: tenancy, error } = await supabase
    .from('tenancies')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    console.error('[TenancyService] Failed to create tenancy:', error)
    throw new Error(`Failed to create tenancy: ${error.message}`)
  }

  // Add tenants if provided
  console.log('[TenancyService] createTenancy - tenants param:', JSON.stringify(tenants, null, 2))
  console.log('[TenancyService] createTenancy - tenants count:', tenants?.length || 0)

  if (tenants && tenants.length > 0) {
    for (let i = 0; i < tenants.length; i++) {
      console.log(`[TenancyService] Adding tenant ${i + 1}:`, JSON.stringify(tenants[i], null, 2))
      try {
        const result = await addTenantToTenancy(tenancy.id, tenants[i], i + 1)
        console.log(`[TenancyService] Tenant ${i + 1} added successfully:`, result.id)
      } catch (tenantError: any) {
        console.error(`[TenancyService] FAILED to add tenant ${i + 1}:`, tenantError.message)
        // Don't throw - continue with other tenants but log the error
      }
    }
  } else {
    console.log('[TenancyService] No tenants provided to createTenancy')
  }

  // Log audit event
  await logTenancyEvent('CREATED', {
    companyId,
    tenancyId: tenancy.id,
    propertyId,
    userId: createdBy,
    metadata: {
      tenancy_type: tenancyType,
      start_date: startDate,
      monthly_rent: monthlyRent,
      tenant_count: tenants?.length || 0
    }
  })

  // Update property_tenancies if reference exists
  if (primaryReferenceId) {
    await supabase
      .from('property_tenancies')
      .update({
        tenancy_id: tenancy.id,
        updated_at: new Date().toISOString()
      })
      .eq('reference_id', primaryReferenceId)
      .eq('property_id', propertyId)
  }

  return formatTenancy(tenancy)
}

/**
 * Create tenancy from a completed reference
 */
export async function createTenancyFromReference(
  referenceId: string,
  companyId: string,
  createdBy?: string
): Promise<Tenancy> {
  // Get reference with agreement
  const { data: reference, error: refError } = await supabase
    .from('tenant_references')
    .select(`
      *,
      agreements(*)
    `)
    .eq('id', referenceId)
    .eq('company_id', companyId)
    .single()

  if (refError || !reference) {
    throw new Error('Reference not found')
  }

  if (!reference.linked_property_id) {
    throw new Error('Reference is not linked to a property')
  }

  // Get agreement if exists
  const agreement = reference.agreements?.[0]

  // Get tenant names from reference
  const firstName = decrypt(reference.tenant_first_name_encrypted) || ''
  const lastName = decrypt(reference.tenant_last_name_encrypted) || ''
  const email = decrypt(reference.tenant_email_encrypted)
  const phone = decrypt(reference.tenant_phone_encrypted)

  // Calculate end date from term
  let endDate: string | undefined
  if (reference.term_years || reference.term_months) {
    const startDate = new Date(reference.move_in_date)
    startDate.setFullYear(startDate.getFullYear() + (reference.term_years || 0))
    startDate.setMonth(startDate.getMonth() + (reference.term_months || 0))
    endDate = startDate.toISOString().split('T')[0]
  }

  // Create tenancy
  const tenancy = await createTenancy({
    companyId,
    propertyId: reference.linked_property_id,
    primaryReferenceId: referenceId,
    agreementId: agreement?.id,
    tenancyType: 'ast',
    startDate: reference.move_in_date,
    endDate,
    fixedTermEndDate: endDate,
    monthlyRent: reference.monthly_rent,
    depositAmount: agreement?.deposit_amount || Math.floor((reference.monthly_rent * 12 / 52) * 5), // Default to 5 weeks rent
    billsIncluded: reference.bills_included || false,
    createdBy
  }, [{
    referenceId,
    firstName,
    lastName,
    email: email || undefined,
    phone: phone || undefined,
    isLeadTenant: true,
    rentShare: reference.rent_share || reference.monthly_rent
  }])

  return tenancy
}

// ============================================================================
// GET TENANCY
// ============================================================================

/**
 * Get a tenancy by ID
 */
export async function getTenancy(
  tenancyId: string,
  companyId: string
): Promise<Tenancy | null> {
  const { data, error } = await supabase
    .from('tenancies')
    .select(`
      *,
      properties(id, postcode, address_line1_encrypted, address_line2_encrypted, city_encrypted, full_address_encrypted, status, management_type),
      tenancy_tenants(*)
    `)
    .eq('id', tenancyId)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    console.error('[TenancyService] Failed to get tenancy:', error)
    throw new Error(`Failed to get tenancy: ${error.message}`)
  }

  // If tenancy has an agreement_id, fetch the agreement separately
  let agreementData = null
  if (data.agreement_id) {
    const { data: agreement } = await supabase
      .from('agreements')
      .select('id, status, signed_at')
      .eq('id', data.agreement_id)
      .single()
    agreementData = agreement
  }

  return formatTenancyWithRelations({ ...data, agreements: agreementData })
}

/**
 * List tenancies with filters
 */
export async function listTenancies(
  companyId: string,
  filters: TenancyFilters = {},
  pagination: PaginationOptions = {}
): Promise<{ tenancies: Tenancy[]; total: number }> {
  const {
    status,
    propertyId,
    search,
    startDateFrom,
    startDateTo,
    includeDeleted = false
  } = filters

  const {
    limit = 50,
    offset = 0,
    orderBy = 'created_at',
    orderDirection = 'desc'
  } = pagination

  // Build query - include agreements for signing_status
  let query = supabase
    .from('tenancies')
    .select(`
      *,
      properties(id, postcode, address_line1_encrypted, address_line2_encrypted, city_encrypted, full_address_encrypted, status, management_type),
      tenancy_tenants(*),
      agreements:agreement_id(id, signing_status)
    `, { count: 'exact' })
    .eq('company_id', companyId)

  // Apply filters
  if (!includeDeleted) {
    query = query.is('deleted_at', null)
  }

  if (status) {
    if (Array.isArray(status)) {
      query = query.in('status', status)
    } else {
      query = query.eq('status', status)
    }
  }

  if (propertyId) {
    query = query.eq('property_id', propertyId)
  }

  if (startDateFrom) {
    query = query.gte('start_date', startDateFrom)
  }

  if (startDateTo) {
    query = query.lte('start_date', startDateTo)
  }

  // Apply ordering and pagination
  query = query
    .order(orderBy, { ascending: orderDirection === 'asc' })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('[TenancyService] Failed to list tenancies:', error)
    throw new Error(`Failed to list tenancies: ${error.message}`)
  }

  // If search is provided, filter by tenant name (need to decrypt and search)
  let filteredData = data || []
  if (search && filteredData.length > 0) {
    const searchLower = search.toLowerCase()
    filteredData = filteredData.filter(tenancy => {
      // Check property postcode
      if (tenancy.properties?.postcode?.toLowerCase().includes(searchLower)) {
        return true
      }
      // Check tenant names
      for (const tenant of tenancy.tenancy_tenants || []) {
        const firstName = decrypt(tenant.first_name_encrypted)?.toLowerCase() || ''
        const lastName = decrypt(tenant.last_name_encrypted)?.toLowerCase() || ''
        if (firstName.includes(searchLower) || lastName.includes(searchLower)) {
          return true
        }
      }
      return false
    })
  }

  // Format tenancies and add landlord AML status
  const formattedTenancies = filteredData.map(formatTenancyWithRelations)

  // Fetch landlord AML status for all tenancies
  const propertyIds = [...new Set(filteredData.map(t => t.property_id).filter(Boolean))]
  if (propertyIds.length > 0) {
    // Get all property_landlords with their landlords and AML checks
    const { data: propertyLandlords } = await supabase
      .from('property_landlords')
      .select(`
        property_id,
        landlord_id,
        is_primary_contact,
        landlords (
          id,
          name_encrypted,
          landlord_aml_checks (
            verification_status
          )
        )
      `)
      .in('property_id', propertyIds)

    // Build a map of property_id -> landlord AML status
    const landlordAmlMap: Record<string, { hasLandlord: boolean; amlPassed: boolean; landlordName: string }> = {}
    for (const pl of propertyLandlords || []) {
      const landlord = pl.landlords as any
      if (!landlordAmlMap[pl.property_id] && landlord) {
        const amlCheck = landlord.landlord_aml_checks?.[0]
        landlordAmlMap[pl.property_id] = {
          hasLandlord: true,
          amlPassed: amlCheck?.verification_status === 'passed',
          landlordName: decrypt(landlord.name_encrypted) || 'Unknown'
        }
      }
    }

    // Add landlord AML info to each tenancy
    for (const tenancy of formattedTenancies) {
      const amlInfo = landlordAmlMap[tenancy.property_id]
      ;(tenancy as any).landlord_aml_status = amlInfo ? {
        has_landlord: amlInfo.hasLandlord,
        aml_passed: amlInfo.amlPassed,
        landlord_name: amlInfo.landlordName
      } : {
        has_landlord: false,
        aml_passed: false,
        landlord_name: null
      }

      // Include dismiss flag from raw data
      const rawTenancy = filteredData.find(t => t.id === tenancy.id)
      ;(tenancy as any).aml_warning_dismissed_at = rawTenancy?.aml_warning_dismissed_at || null
    }
  }

  return {
    tenancies: formattedTenancies,
    total: count || 0
  }
}

// ============================================================================
// UPDATE TENANCY
// ============================================================================

/**
 * Update a tenancy
 */
export async function updateTenancy(
  tenancyId: string,
  companyId: string,
  input: UpdateTenancyInput,
  userId?: string
): Promise<Tenancy> {
  const updateData: any = {
    updated_at: new Date().toISOString()
  }

  // Map input fields to database columns
  // Note: Database uses tenancy_start_date, tenancy_end_date (not start_date, end_date)
  if (input.status !== undefined) updateData.status = input.status
  if (input.startDate !== undefined) updateData.tenancy_start_date = input.startDate
  if (input.endDate !== undefined) updateData.tenancy_end_date = input.endDate
  if (input.actualEndDate !== undefined) updateData.actual_end_date = input.actualEndDate
  if (input.tenancyType !== undefined) updateData.tenancy_type = input.tenancyType
  if (input.monthlyRent !== undefined) {
    updateData.monthly_rent = input.monthlyRent
    updateData.rent_amount = input.monthlyRent  // Keep both columns in sync
  }
  if (input.rentDueDay !== undefined) updateData.rent_due_day = input.rentDueDay
  if (input.depositAmount !== undefined) updateData.deposit_amount = input.depositAmount
  if (input.depositScheme !== undefined) updateData.deposit_scheme = input.depositScheme
  if (input.depositReference !== undefined) updateData.deposit_reference = input.depositReference
  if (input.depositProtectedAt !== undefined) updateData.deposit_protected_at = input.depositProtectedAt
  if (input.billsIncluded !== undefined) updateData.bills_included = input.billsIncluded
  if (input.hasRlp !== undefined) updateData.has_rlp = input.hasRlp
  if (input.additionalCharges !== undefined) updateData.additional_charges = input.additionalCharges
  if (input.compliancePackSentAt !== undefined) {
    updateData.compliance_pack_sent_at = input.compliancePackSentAt
    updateData.compliance_pack_sent_by = userId
  }
  if (input.notes !== undefined) updateData.notes_encrypted = input.notes ? encrypt(input.notes) : null
  // Initial monies tracking
  if (input.initialMoniesRequestedAt !== undefined) updateData.initial_monies_requested_at = input.initialMoniesRequestedAt
  if (input.initialMoniesRequestedBy !== undefined) updateData.initial_monies_requested_by = input.initialMoniesRequestedBy
  if (input.initialMoniesTenantConfirmedAt !== undefined) updateData.initial_monies_tenant_confirmed_at = input.initialMoniesTenantConfirmedAt
  if (input.initialMoniesPaidAt !== undefined) updateData.initial_monies_paid_at = input.initialMoniesPaidAt
  if (input.initialMoniesConfirmedBy !== undefined) updateData.initial_monies_confirmed_by = input.initialMoniesConfirmedBy
  // Agreement linking
  if (input.agreementId !== undefined) updateData.agreement_id = input.agreementId
  // Management type
  if (input.managementType !== undefined) updateData.management_type = input.managementType

  const { data, error } = await supabase
    .from('tenancies')
    .update(updateData)
    .eq('id', tenancyId)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .select()
    .single()

  if (error) {
    console.error('[TenancyService] Failed to update tenancy:', error)
    throw new Error(`Failed to update tenancy: ${error.message}`)
  }

  // Sync management_type to the property — single source of truth on tenancy, mirrored globally
  if (input.managementType !== undefined && data.property_id) {
    await supabase
      .from('properties')
      .update({ management_type: input.managementType })
      .eq('id', data.property_id)
  }

  // Log audit event
  await logTenancyEvent('UPDATED', {
    companyId,
    tenancyId,
    propertyId: data.property_id,
    userId,
    metadata: { updated_fields: Object.keys(input) }
  })

  // Log to tenancy_activity for user-facing activity log
  const updatedFields = Object.keys(input).filter(k => input[k as keyof UpdateTenancyInput] !== undefined)
  if (updatedFields.length > 0) {
    const fieldLabels: Record<string, string> = {
      status: 'Status',
      startDate: 'Start Date',
      endDate: 'End Date',
      tenancyType: 'Tenancy Type',
      monthlyRent: 'Monthly Rent',
      rentDueDay: 'Rent Due Day',
      depositAmount: 'Deposit Amount',
      depositScheme: 'Deposit Scheme',
      depositProtectedAt: 'Deposit Protection',
      billsIncluded: 'Bills Included',
      notes: 'Notes'
    }
    const readableFields = updatedFields
      .map(f => fieldLabels[f] || f)
      .filter(f => f !== 'actualEndDate') // Don't show internal fields
      .join(', ')

    if (readableFields) {
      await logTenancyActivity(tenancyId, {
        action: 'TENANCY_UPDATED',
        category: 'general',
        title: 'Tenancy Details Updated',
        description: `Updated: ${readableFields}`,
        metadata: { updated_fields: updatedFields },
        performedBy: userId
      })
    }
  }

  // Propagate rent amount changes to future RentGoose schedule entries
  if (input.monthlyRent !== undefined) {
    try {
      const { updateFutureRentAmounts } = await import('./rentgooseService')
      await updateFutureRentAmounts(tenancyId, input.monthlyRent)
    } catch (err) {
      console.error('[TenancyService] Failed to propagate rent change to schedule:', err)
    }
  }

  // Propagate rent due day changes to future RentGoose schedule entries
  if (input.rentDueDay !== undefined) {
    try {
      const { updateFutureRentDueDates } = await import('./rentgooseService')
      await updateFutureRentDueDates(tenancyId, input.rentDueDay)
    } catch (err) {
      console.error('[TenancyService] Failed to propagate rent due day change to schedule:', err)
    }
  }

  // When deposit scheme changes away from reposit, clear Reposit data and restore deposit
  if (input.depositScheme !== undefined && input.depositScheme !== 'reposit') {
    try {
      console.log(`[TenancyService] Deposit scheme changed to "${input.depositScheme}" for tenancy ${tenancyId}, checking for Reposit registrations to cancel`)

      // Cancel ALL non-terminal Reposit registrations for this tenancy
      const { data: repositRegs } = await supabase
        .from('reposit_registrations')
        .select('id, status')
        .eq('tenancy_id', tenancyId)
        .not('status', 'in', '("cancelled","closed","deactivated")')

      if (repositRegs && repositRegs.length > 0) {
        for (const reg of repositRegs) {
          await supabase
            .from('reposit_registrations')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', reg.id)
          console.log(`[TenancyService] Cancelled Reposit registration ${reg.id} (was ${reg.status}) for tenancy ${tenancyId}`)
        }
      } else {
        console.log(`[TenancyService] No active Reposit registrations found for tenancy ${tenancyId}`)
      }

      // If deposit is currently £0 (Reposit replaces deposit), recalculate to 5 weeks rent
      const currentDeposit = parseFloat(data.deposit_amount) || 0
      if (currentDeposit === 0) {
        const monthlyRent = parseFloat(data.monthly_rent) || 0
        if (monthlyRent > 0) {
          const fiveWeeksDeposit = Math.floor((monthlyRent * 12 / 52) * 5)
          await supabase
            .from('tenancies')
            .update({
              deposit_amount: fiveWeeksDeposit,
              deposit_protected_at: null,
              deposit_reference: null
            })
            .eq('id', tenancyId)

          console.log(`[TenancyService] Restored deposit to £${fiveWeeksDeposit} for tenancy ${tenancyId} (was Reposit)`)
        }
      }
    } catch (err) {
      console.error('[TenancyService] Failed to clear Reposit data:', err)
    }
  }

  return formatTenancy(data)
}

/**
 * Activate a tenancy (change status from pending to active)
 */
export async function activateTenancy(
  tenancyId: string,
  companyId: string,
  userId?: string
): Promise<Tenancy> {
  return updateTenancy(tenancyId, companyId, { status: 'active' }, userId)
}

/**
 * End a tenancy
 * If end date is in the future, sets status to 'notice_given'
 * If end date is today or in the past, sets status to 'ended'
 */
export async function endTenancy(
  tenancyId: string,
  companyId: string,
  endDate: string,
  reason?: string,
  userId?: string
): Promise<Tenancy> {
  // Determine status based on end date
  const endDateObj = new Date(endDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  endDateObj.setHours(0, 0, 0, 0)

  const status = endDateObj > today ? 'notice_given' : 'ended'

  const tenancy = await updateTenancy(tenancyId, companyId, {
    status,
    actualEndDate: endDate
  }, userId)

  // Log audit event
  const eventType = status === 'notice_given' ? 'NOTICE_GIVEN' : 'ENDED'
  await logTenancyEvent(eventType, {
    companyId,
    tenancyId,
    propertyId: tenancy.property_id,
    userId,
    metadata: { end_date: endDate, reason }
  })

  // Automatically update RentGoose — cancel future schedule entries and pro-rate final period
  try {
    const { handleNotice } = await import('./rentgooseService')
    await handleNotice(tenancyId, endDate, companyId)
  } catch (err) {
    console.error('Failed to update RentGoose schedule after notice:', err)
  }

  return tenancy
}

/**
 * Soft delete a tenancy
 */
export async function deleteTenancy(
  tenancyId: string,
  companyId: string,
  userId?: string
): Promise<void> {
  const { error } = await supabase
    .from('tenancies')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: userId
    })
    .eq('id', tenancyId)
    .eq('company_id', companyId)

  if (error) {
    console.error('[TenancyService] Failed to delete tenancy:', error)
    throw new Error(`Failed to delete tenancy: ${error.message}`)
  }
}

// ============================================================================
// TENANT MANAGEMENT
// ============================================================================

/**
 * Return all tenant_order values currently in use on a tenancy (active + removed),
 * so we never collide with the UNIQUE (tenancy_id, tenant_order) constraint when
 * inserting or demoting.
 */
async function getUsedTenantOrders(tenancyId: string): Promise<Set<number>> {
  const { data } = await supabase
    .from('tenancy_tenants')
    .select('tenant_order')
    .eq('tenancy_id', tenancyId)
  return new Set((data || []).map(r => r.tenant_order).filter((n): n is number => typeof n === 'number'))
}

/**
 * Find the first tenant_order >= startFrom that isn't already used on the tenancy.
 * Skips gaps caused by removed tenants whose rows still occupy a slot.
 */
function firstFreeOrder(used: Set<number>, startFrom: number): number {
  let n = startFrom
  while (used.has(n)) n++
  return n
}

/**
 * Add a tenant to a tenancy.
 *
 * The tenancy_tenants table has a UNIQUE(tenancy_id, tenant_order) index
 * (idx_tenancy_tenants_order), so the order we pick must not collide with
 * ANY existing row on the tenancy — including removed ones whose rows are
 * soft-deleted via status but still occupy a slot.
 */
export async function addTenantToTenancy(
  tenancyId: string,
  tenant: TenancyTenantInput,
  tenantOrder?: number
): Promise<TenancyTenant> {
  const fullName = `${tenant.firstName} ${tenant.lastName}`.trim()

  // Each retry re-reads the order list and re-does any demotion. This keeps
  // concurrent lead-tenant adds correct: if another request demoted & took
  // slot 1 between our attempts, we still land as lead at the next free 1
  // by demoting whoever is there now.
  for (let attempt = 0; attempt < 3; attempt++) {
    const used = await getUsedTenantOrders(tenancyId)

    let resolvedOrder: number
    if (typeof tenantOrder === 'number' && !used.has(tenantOrder)) {
      // Caller requested a specific order and it's free — honour it.
      resolvedOrder = tenantOrder
    } else if (tenant.isLeadTenant) {
      resolvedOrder = 1
      if (used.has(1)) {
        const demoteOrder = firstFreeOrder(used, 2)
        const { error: demoteError } = await supabase
          .from('tenancy_tenants')
          .update({
            tenant_order: demoteOrder,
            is_lead_tenant: false,
            updated_at: new Date().toISOString(),
          })
          .eq('tenancy_id', tenancyId)
          .eq('tenant_order', 1)
        if (demoteError) {
          console.error('[TenancyService] Failed to demote current lead tenant:', demoteError)
          throw new Error(`Failed to demote current lead tenant: ${demoteError.message}`)
        }
      }
    } else {
      resolvedOrder = firstFreeOrder(used, 2)
    }

    const { data, error } = await supabase
      .from('tenancy_tenants')
      .insert({
        tenancy_id: tenancyId,
        tenant_reference_id: tenant.referenceId || null,
        tenant_name_encrypted: encrypt(fullName),
        tenant_email_encrypted: tenant.email ? encrypt(tenant.email) : null,
        tenant_phone_encrypted: tenant.phone ? encrypt(tenant.phone) : null,
        tenant_order: resolvedOrder,
        is_lead_tenant: resolvedOrder === 1,
        rent_share_amount: tenant.rentShare,
        rent_share_percentage: tenant.rentSharePercentage,
        is_active: true,
        residential_address_line1_encrypted: tenant.residentialAddressLine1 ? encrypt(tenant.residentialAddressLine1) : null,
        residential_address_line2_encrypted: tenant.residentialAddressLine2 ? encrypt(tenant.residentialAddressLine2) : null,
        residential_city_encrypted: tenant.residentialCity ? encrypt(tenant.residentialCity) : null,
        residential_postcode_encrypted: tenant.residentialPostcode ? encrypt(tenant.residentialPostcode) : null,
      })
      .select()
      .single()

    if (!error) return formatTenancyTenant(data)

    // 23505 = unique_violation — another request beat us here. Retry with a
    // fresh read (which will also redo demotion if needed).
    if ((error as any).code === '23505' && attempt < 2) {
      console.warn(`[TenancyService] tenant_order ${resolvedOrder} collided, retrying (${attempt + 1}/3)`)
      continue
    }

    console.error('[TenancyService] Failed to add tenant:', error)
    throw new Error(`Failed to add tenant: ${error.message}`)
  }

  throw new Error('Failed to add tenant: exhausted retries finding a free tenant_order')
}

/**
 * Remove a tenant from a tenancy (mark as removed)
 */
export async function removeTenantFromTenancy(
  tenancyTenantId: string,
  leftDate: string,
  replacementTenantId?: string
): Promise<TenancyTenant> {
  const { data, error } = await supabase
    .from('tenancy_tenants')
    .update({
      status: replacementTenantId ? 'replaced' : 'removed',
      left_date: leftDate,
      replacement_tenant_id: replacementTenantId,
      updated_at: new Date().toISOString()
    })
    .eq('id', tenancyTenantId)
    .select()
    .single()

  if (error) {
    console.error('[TenancyService] Failed to remove tenant:', error)
    throw new Error(`Failed to remove tenant: ${error.message}`)
  }

  return formatTenancyTenant(data)
}

/**
 * Update a tenant's details
 */
export interface UpdateTenantInput {
  firstName?: string
  lastName?: string
  email?: string | null
  phone?: string | null
  isLeadTenant?: boolean
  rentShare?: number | null
  rentSharePercentage?: number | null
}

export async function updateTenancyTenant(
  tenantId: string,
  input: UpdateTenantInput
): Promise<TenancyTenant> {
  // First get the existing tenant to merge names if only one is provided
  const { data: existing, error: fetchError } = await supabase
    .from('tenancy_tenants')
    .select('*')
    .eq('id', tenantId)
    .single()

  if (fetchError || !existing) {
    throw new Error('Tenant not found')
  }

  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString()
  }

  // Handle name updates
  if (input.firstName !== undefined || input.lastName !== undefined) {
    const existingName = decrypt(existing.tenant_name_encrypted) || ''
    const nameParts = existingName.trim().split(' ')
    const existingFirst = nameParts[0] || ''
    const existingLast = nameParts.slice(1).join(' ') || ''

    const newFirst = input.firstName !== undefined ? input.firstName : existingFirst
    const newLast = input.lastName !== undefined ? input.lastName : existingLast
    const fullName = `${newFirst} ${newLast}`.trim()

    updateData.tenant_name_encrypted = encrypt(fullName)
  }

  // Handle email update
  if (input.email !== undefined) {
    updateData.tenant_email_encrypted = input.email ? encrypt(input.email) : null
  }

  // Handle phone update
  if (input.phone !== undefined) {
    updateData.tenant_phone_encrypted = input.phone ? encrypt(input.phone) : null
  }

  // Handle lead tenant update - only if lead status is actually changing
  if (input.isLeadTenant !== undefined) {
    const currentIsLead = existing.is_lead_tenant || existing.tenant_order === 1

    if (input.isLeadTenant && !currentIsLead) {
      // Promoting to lead — first demote the current lead tenant
      const tenancyId = existing.tenancy_id
      const usedOrders = await getUsedTenantOrders(tenancyId)
      const demoteOrder = firstFreeOrder(usedOrders, 2)

      const { error: demoteError } = await supabase
        .from('tenancy_tenants')
        .update({
          tenant_order: demoteOrder,
          is_lead_tenant: false,
          updated_at: new Date().toISOString()
        })
        .eq('tenancy_id', tenancyId)
        .eq('tenant_order', 1)
        .eq('is_active', true)
        .neq('id', tenantId)

      if (demoteError) {
        console.error('[TenancyService] Failed to demote current lead tenant:', demoteError)
      }

      updateData.tenant_order = 1
      updateData.is_lead_tenant = true
    } else if (!input.isLeadTenant && currentIsLead) {
      // Demoting from lead — find a free order slot
      const tenancyId = existing.tenancy_id
      const usedOrders = await getUsedTenantOrders(tenancyId)
      const demoteOrder = firstFreeOrder(usedOrders, 2)
      updateData.tenant_order = demoteOrder
      updateData.is_lead_tenant = false
    }
    // If lead status isn't changing, don't touch tenant_order at all
  }

  // Handle rent share updates
  if (input.rentShare !== undefined) {
    updateData.rent_share_amount = input.rentShare
  }
  if (input.rentSharePercentage !== undefined) {
    updateData.rent_share_percentage = input.rentSharePercentage
  }

  const { data, error } = await supabase
    .from('tenancy_tenants')
    .update(updateData)
    .eq('id', tenantId)
    .select()
    .single()

  if (error) {
    console.error('[TenancyService] Failed to update tenant:', error)
    throw new Error(`Failed to update tenant: ${error.message}`)
  }

  return formatTenancyTenant(data)
}

/**
 * Get tenants for a tenancy
 */
export async function getTenancyTenants(
  tenancyId: string,
  includeInactive: boolean = false
): Promise<TenancyTenant[]> {
  let query = supabase
    .from('tenancy_tenants')
    .select('*')
    .eq('tenancy_id', tenancyId)
    .order('tenant_order', { ascending: true })

  if (!includeInactive) {
    query = query.eq('status', 'active')
  }

  const { data, error } = await query

  if (error) {
    console.error('[TenancyService] Failed to get tenants:', error)
    throw new Error(`Failed to get tenants: ${error.message}`)
  }

  return (data || []).map(formatTenancyTenant)
}

/**
 * Reorder tenants within a tenancy.
 * Accepts an array of { id, tenant_order } and swaps via a temp order to avoid unique constraint violations.
 */
export async function reorderTenants(
  tenancyId: string,
  orderedTenantIds: string[]
): Promise<void> {
  // Fetch current tenants to validate
  const { data: currentTenants, error: fetchError } = await supabase
    .from('tenancy_tenants')
    .select('id, tenant_order')
    .eq('tenancy_id', tenancyId)
    .eq('status', 'active')
    .order('tenant_order', { ascending: true })

  if (fetchError) {
    throw new Error(`Failed to fetch tenants: ${fetchError.message}`)
  }

  if (!currentTenants || currentTenants.length === 0) {
    throw new Error('No active tenants found')
  }

  // Validate all IDs are present
  const currentIds = new Set(currentTenants.map(t => t.id))
  for (const id of orderedTenantIds) {
    if (!currentIds.has(id)) {
      throw new Error(`Tenant ${id} not found in this tenancy`)
    }
  }

  // Move all to high temp orders first to avoid unique constraint collisions
  const tempOffset = 10000
  for (let i = 0; i < orderedTenantIds.length; i++) {
    const { error } = await supabase
      .from('tenancy_tenants')
      .update({ tenant_order: tempOffset + i + 1 })
      .eq('id', orderedTenantIds[i])
    if (error) throw new Error(`Failed to set temp order: ${error.message}`)
  }

  // Now set final orders starting from 1
  for (let i = 0; i < orderedTenantIds.length; i++) {
    const newOrder = i + 1
    const { error } = await supabase
      .from('tenancy_tenants')
      .update({ tenant_order: newOrder, is_lead_tenant: newOrder === 1 })
      .eq('id', orderedTenantIds[i])
    if (error) throw new Error(`Failed to reorder tenant: ${error.message}`)
  }
}

// ============================================================================
// GUARANTOR MANAGEMENT
// ============================================================================

export interface TenancyGuarantor {
  id: string
  tenancy_id: string
  guarantor_reference_id: string | null
  guarantees_tenant_id: string | null
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  postcode: string | null
  relationship_to_tenant: string | null
  status: 'active' | 'removed'
  created_at: string
  updated_at: string
}

export interface GuarantorInput {
  guarantorReferenceId?: string
  guaranteesTenantId?: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  postcode?: string
  relationshipToTenant?: string
}

export interface UpdateGuarantorInput {
  firstName?: string
  lastName?: string
  email?: string | null
  phone?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  postcode?: string | null
  relationshipToTenant?: string | null
  guaranteesTenantId?: string | null
}

/**
 * Add a guarantor to a tenancy
 */
export async function addGuarantorToTenancy(
  tenancyId: string,
  input: GuarantorInput
): Promise<TenancyGuarantor> {
  const { data, error } = await supabase
    .from('tenancy_guarantors')
    .insert({
      tenancy_id: tenancyId,
      guarantor_reference_id: input.guarantorReferenceId || null,
      guarantees_tenant_id: input.guaranteesTenantId || null,
      first_name_encrypted: encrypt(`${input.firstName}`),
      last_name_encrypted: encrypt(`${input.lastName}`),
      email_encrypted: input.email ? encrypt(input.email) : null,
      phone_encrypted: input.phone ? encrypt(input.phone) : null,
      address_line1_encrypted: input.addressLine1 ? encrypt(input.addressLine1) : null,
      address_line2_encrypted: input.addressLine2 ? encrypt(input.addressLine2) : null,
      city_encrypted: input.city ? encrypt(input.city) : null,
      postcode_encrypted: input.postcode ? encrypt(input.postcode) : null,
      relationship_to_tenant: input.relationshipToTenant || null,
      status: 'active'
    })
    .select()
    .single()

  if (error) {
    console.error('[TenancyService] Failed to add guarantor:', error)
    throw new Error(`Failed to add guarantor: ${error.message}`)
  }

  return formatTenancyGuarantor(data)
}

/**
 * Update a guarantor's details
 */
export async function updateTenancyGuarantor(
  guarantorId: string,
  input: UpdateGuarantorInput
): Promise<TenancyGuarantor> {
  // First get existing guarantor
  const { data: existing, error: fetchError } = await supabase
    .from('tenancy_guarantors')
    .select('*')
    .eq('id', guarantorId)
    .single()

  if (fetchError || !existing) {
    throw new Error('Guarantor not found')
  }

  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString()
  }

  // Handle name updates
  if (input.firstName !== undefined) {
    updateData.first_name_encrypted = encrypt(input.firstName)
  }
  if (input.lastName !== undefined) {
    updateData.last_name_encrypted = encrypt(input.lastName)
  }

  // Handle contact updates
  if (input.email !== undefined) {
    updateData.email_encrypted = input.email ? encrypt(input.email) : null
  }
  if (input.phone !== undefined) {
    updateData.phone_encrypted = input.phone ? encrypt(input.phone) : null
  }

  // Handle address updates
  if (input.addressLine1 !== undefined) {
    updateData.address_line1_encrypted = input.addressLine1 ? encrypt(input.addressLine1) : null
  }
  if (input.addressLine2 !== undefined) {
    updateData.address_line2_encrypted = input.addressLine2 ? encrypt(input.addressLine2) : null
  }
  if (input.city !== undefined) {
    updateData.city_encrypted = input.city ? encrypt(input.city) : null
  }
  if (input.postcode !== undefined) {
    updateData.postcode_encrypted = input.postcode ? encrypt(input.postcode) : null
  }

  // Handle relationship update
  if (input.relationshipToTenant !== undefined) {
    updateData.relationship_to_tenant = input.relationshipToTenant
  }

  // Handle tenant link update
  if (input.guaranteesTenantId !== undefined) {
    updateData.guarantees_tenant_id = input.guaranteesTenantId
  }

  const { data, error } = await supabase
    .from('tenancy_guarantors')
    .update(updateData)
    .eq('id', guarantorId)
    .select()
    .single()

  if (error) {
    console.error('[TenancyService] Failed to update guarantor:', error)
    throw new Error(`Failed to update guarantor: ${error.message}`)
  }

  return formatTenancyGuarantor(data)
}

/**
 * Remove a guarantor from a tenancy
 */
export async function removeGuarantorFromTenancy(
  guarantorId: string
): Promise<TenancyGuarantor> {
  const { data, error } = await supabase
    .from('tenancy_guarantors')
    .update({
      status: 'removed',
      updated_at: new Date().toISOString()
    })
    .eq('id', guarantorId)
    .select()
    .single()

  if (error) {
    console.error('[TenancyService] Failed to remove guarantor:', error)
    throw new Error(`Failed to remove guarantor: ${error.message}`)
  }

  return formatTenancyGuarantor(data)
}

/**
 * Get guarantors for a tenancy
 */
export async function getTenancyGuarantors(
  tenancyId: string,
  includeInactive: boolean = false
): Promise<TenancyGuarantor[]> {
  let query = supabase
    .from('tenancy_guarantors')
    .select('*')
    .eq('tenancy_id', tenancyId)

  if (!includeInactive) {
    query = query.eq('status', 'active')
  }

  const { data, error } = await query

  if (error) {
    console.error('[TenancyService] Failed to get guarantors:', error)
    throw new Error(`Failed to get guarantors: ${error.message}`)
  }

  const guarantors = (data || []).map(formatTenancyGuarantor)

  // Sort guarantors by their linked tenant's tenant_order
  if (guarantors.some(g => g.guarantees_tenant_id)) {
    const tenantIds = [...new Set(guarantors.map(g => g.guarantees_tenant_id).filter(Boolean))]
    if (tenantIds.length > 0) {
      const { data: tenantOrders } = await supabase
        .from('tenancy_tenants')
        .select('id, tenant_order')
        .in('id', tenantIds as string[])
      const orderMap = new Map<string, number>()
      for (const t of tenantOrders || []) {
        orderMap.set(t.id, t.tenant_order ?? 999)
      }
      guarantors.sort((a, b) => {
        const orderA = a.guarantees_tenant_id ? (orderMap.get(a.guarantees_tenant_id) ?? 999) : 999
        const orderB = b.guarantees_tenant_id ? (orderMap.get(b.guarantees_tenant_id) ?? 999) : 999
        return orderA - orderB
      })
    }
  }

  return guarantors
}

function formatTenancyGuarantor(data: any): TenancyGuarantor {
  return {
    id: data.id,
    tenancy_id: data.tenancy_id,
    guarantor_reference_id: data.guarantor_reference_id,
    guarantees_tenant_id: data.guarantees_tenant_id,
    first_name: decrypt(data.first_name_encrypted) || '',
    last_name: decrypt(data.last_name_encrypted) || '',
    email: data.email_encrypted ? decrypt(data.email_encrypted) : null,
    phone: data.phone_encrypted ? decrypt(data.phone_encrypted) : null,
    address_line1: data.address_line1_encrypted ? decrypt(data.address_line1_encrypted) : null,
    address_line2: data.address_line2_encrypted ? decrypt(data.address_line2_encrypted) : null,
    city: data.city_encrypted ? decrypt(data.city_encrypted) : null,
    postcode: data.postcode_encrypted ? decrypt(data.postcode_encrypted) : null,
    relationship_to_tenant: data.relationship_to_tenant,
    status: data.status,
    created_at: data.created_at,
    updated_at: data.updated_at
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function formatTenancy(data: any): Tenancy {
  // Map actual database column names to interface names
  // Database uses: tenancy_start_date, tenancy_end_date, rent_amount
  return {
    id: data.id,
    company_id: data.company_id,
    property_id: data.property_id,
    primary_reference_id: data.primary_reference_id,
    agreement_id: data.agreement_id,
    tenancy_type: data.tenancy_type || 'ast',
    status: data.status,
    start_date: data.tenancy_start_date || data.start_date,
    end_date: data.tenancy_end_date || data.end_date,
    fixed_term_end_date: data.fixed_term_end_date,
    actual_end_date: data.actual_end_date,
    notice_period_days: data.notice_period_days || 30,
    monthly_rent: parseFloat(data.monthly_rent || data.rent_amount || 0),
    deposit_amount: data.deposit_amount ? parseFloat(data.deposit_amount) : null,
    deposit_scheme: data.deposit_scheme,
    deposit_reference: data.deposit_reference,
    deposit_protected_at: data.deposit_protected_at,
    bills_included: data.bills_included,
    has_rlp: data.has_rlp || false,
    additional_charges: data.additional_charges || [],
    rent_due_day: data.rent_due_day || 1,
    has_break_clause: data.has_break_clause,
    break_clause_date: data.break_clause_date,
    break_clause_notice_days: data.break_clause_notice_days,
    compliance_pack_sent_at: data.compliance_pack_sent_at,
    compliance_pack_sent_by: data.compliance_pack_sent_by,
    // Initial monies tracking
    initial_monies_requested_at: data.initial_monies_requested_at,
    initial_monies_requested_by: data.initial_monies_requested_by,
    initial_monies_tenant_confirmed_at: data.initial_monies_tenant_confirmed_at,
    initial_monies_paid_at: data.initial_monies_paid_at,
    initial_monies_confirmed_by: data.initial_monies_confirmed_by,
    // Move-in time tracking
    move_in_time_requested_at: data.move_in_time_requested_at,
    move_in_time_submitted_at: data.move_in_time_submitted_at,
    move_in_time_slot_1: data.move_in_time_slot_1,
    move_in_time_slot_2: data.move_in_time_slot_2,
    move_in_time_tenant_notes: data.move_in_time_tenant_notes,
    move_in_time_confirmed: data.move_in_time_confirmed,
    move_in_time_confirmed_at: data.move_in_time_confirmed_at,
    // Holding deposit
    holding_deposit_amount: data.holding_deposit_amount || null,
    // Management type
    management_type: data.management_type,
    notes: data.notes_encrypted ? decrypt(data.notes_encrypted) : null,
    created_at: data.created_at,
    updated_at: data.updated_at,
    created_by: data.created_by
  }
}

function formatTenancyWithRelations(data: any): Tenancy {
  const tenancy = formatTenancy(data)

  // Format property
  if (data.properties) {
    const line1 = decrypt(data.properties.address_line1_encrypted) || ''
    const line2 = decrypt(data.properties.address_line2_encrypted) || ''
    const city = decrypt(data.properties.city_encrypted) || ''
    const fullStored = decrypt(data.properties.full_address_encrypted) || ''
    // Compose a display string that always has the most complete address available
    const composedFromParts = [line1, line2, city].filter(Boolean).join(', ')
    // Prefer composed (with line1+line2+city) but fall back to stored full if line1 is missing
    const displayAddress = composedFromParts || fullStored
    tenancy.property = {
      id: data.properties.id,
      postcode: data.properties.postcode,
      address_line1: line1 || displayAddress,
      address_line2: line2 || null,
      city: city || null,
      status: data.properties.status,
      management_type: data.properties.management_type || null
    }
  }

  // Format tenants sorted by tenant_order
  if (data.tenancy_tenants) {
    tenancy.tenants = data.tenancy_tenants
      .sort((a: any, b: any) => (a.tenant_order ?? 999) - (b.tenant_order ?? 999))
      .map(formatTenancyTenant)
  }

  // Format agreement and extract signing_status
  if (data.agreements) {
    tenancy.agreement = data.agreements
    tenancy.signing_status = data.agreements.signing_status || null
  }

  return tenancy
}

function formatTenancyTenant(data: any): TenancyTenant {
  // Parse full name into first/last (actual DB stores combined name)
  const fullName = decrypt(data.tenant_name_encrypted) || ''
  const nameParts = fullName.trim().split(' ')
  const firstName = nameParts[0] || ''
  const lastName = nameParts.slice(1).join(' ') || ''

  // Determine status - use explicit status field if available, otherwise derive from is_active
  // For future tenants: is_active=false but status='active' in DB means pending move-in
  type TenantStatus = 'active' | 'replaced' | 'removed' | 'never_moved_in' | 'pending'
  let status: TenantStatus = 'active'
  if (data.status && ['removed', 'replaced', 'never_moved_in'].includes(data.status)) {
    status = data.status as TenantStatus
  } else if (!data.is_active && data.status === 'active') {
    // is_active=false but status='active' means pending/future tenant
    status = 'pending'
  } else if (!data.is_active) {
    status = 'removed'
  }

  return {
    id: data.id,
    tenancy_id: data.tenancy_id,
    reference_id: data.tenant_reference_id,
    first_name: firstName,
    last_name: lastName,
    email: decrypt(data.tenant_email_encrypted),
    phone: decrypt(data.tenant_phone_encrypted),
    date_of_birth: null,
    is_lead_tenant: data.tenant_order === 1,
    tenant_order: data.tenant_order ?? null,
    rent_share: data.rent_share_amount ? parseFloat(data.rent_share_amount) : null,
    rent_share_percentage: data.rent_share_percentage ? parseFloat(data.rent_share_percentage) : null,
    status,
    left_date: data.left_date || null,
    guarantor_reference_id: null,
    // Residential address
    residential_address_line1: decrypt(data.residential_address_line1_encrypted),
    residential_address_line2: decrypt(data.residential_address_line2_encrypted),
    residential_city: decrypt(data.residential_city_encrypted),
    residential_postcode: decrypt(data.residential_postcode_encrypted)
  }
}

// ============================================================================
// NOTES
// ============================================================================

export interface TenancyNote {
  id: string
  tenancy_id: string
  content: string
  is_pinned: boolean
  created_by: string
  created_by_name?: string
  created_at: string
  updated_at: string
}

export async function getTenancyNotes(tenancyId: string): Promise<TenancyNote[]> {
  const { data, error } = await supabase
    .from('tenancy_notes')
    .select('*')
    .eq('tenancy_id', tenancyId)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching tenancy notes:', error)
    throw new Error(`Failed to fetch notes: ${error.message}`)
  }

  return (data || []).map((note: any) => ({
    id: note.id,
    tenancy_id: note.tenancy_id,
    content: note.content,
    is_pinned: note.is_pinned || false,
    created_by: note.created_by,
    created_by_name: 'Agent',
    created_at: note.created_at,
    updated_at: note.updated_at
  }))
}

export async function addTenancyNote(
  tenancyId: string,
  content: string,
  userId: string,
  isPinned: boolean = false
): Promise<TenancyNote> {
  const { data, error } = await supabase
    .from('tenancy_notes')
    .insert({
      tenancy_id: tenancyId,
      content,
      is_pinned: isPinned,
      created_by: userId
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding tenancy note:', error)
    throw new Error(`Failed to add note: ${error.message}`)
  }

  // Log activity
  await logTenancyActivity(tenancyId, {
    action: 'NOTE_ADDED',
    category: 'general',
    title: 'Note Added',
    description: content.length > 100 ? content.substring(0, 100) + '...' : content,
    performedBy: userId
  })

  return {
    id: data.id,
    tenancy_id: data.tenancy_id,
    content: data.content,
    is_pinned: data.is_pinned,
    created_by: data.created_by,
    created_at: data.created_at,
    updated_at: data.updated_at
  }
}

export async function updateTenancyNote(
  noteId: string,
  updates: { content?: string; is_pinned?: boolean },
  userId: string
): Promise<void> {
  const updateData: any = { updated_at: new Date().toISOString() }
  if (updates.content !== undefined) updateData.content = updates.content
  if (updates.is_pinned !== undefined) updateData.is_pinned = updates.is_pinned

  const { error } = await supabase
    .from('tenancy_notes')
    .update(updateData)
    .eq('id', noteId)
    .eq('created_by', userId) // Only allow updating own notes

  if (error) {
    console.error('Error updating tenancy note:', error)
    throw new Error(`Failed to update note: ${error.message}`)
  }
}

export async function deleteTenancyNote(noteId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('tenancy_notes')
    .delete()
    .eq('id', noteId)
    .eq('created_by', userId) // Only allow deleting own notes

  if (error) {
    console.error('Error deleting tenancy note:', error)
    throw new Error(`Failed to delete note: ${error.message}`)
  }
}

// ============================================================================
// ACTIVITY LOG
// ============================================================================

export interface TenancyActivity {
  id: string
  tenancy_id: string
  action: string
  category: string
  title: string
  description: string | null
  metadata: Record<string, any>
  performed_by: string | null
  performed_by_name?: string
  is_system_action: boolean
  created_at: string
}

export interface LogActivityInput {
  action: string
  category?: string
  title: string
  description?: string
  metadata?: Record<string, any>
  performedBy?: string
  isSystemAction?: boolean
}

export async function getTenancyActivity(
  tenancyId: string,
  options: { limit?: number; offset?: number; category?: string } = {}
): Promise<{ activities: TenancyActivity[]; total: number }> {
  const { limit = 50, offset = 0, category } = options

  let query = supabase
    .from('tenancy_activity')
    .select('*', { count: 'exact' })
    .eq('tenancy_id', tenancyId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (category) {
    query = query.eq('category', category)
  }

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching tenancy activity:', error)
    throw new Error(`Failed to fetch activity: ${error.message}`)
  }

  return {
    activities: (data || []).map((activity: any) => ({
      id: activity.id,
      tenancy_id: activity.tenancy_id,
      action: activity.action,
      category: activity.category,
      title: activity.title,
      description: activity.description,
      metadata: activity.metadata || {},
      performed_by: activity.performed_by,
      performed_by_name: activity.is_system_action ? 'System' : 'Agent',
      is_system_action: activity.is_system_action,
      created_at: activity.created_at
    })),
    total: count || 0
  }
}

export async function logTenancyActivity(
  tenancyId: string,
  input: LogActivityInput
): Promise<void> {
  console.log('[logTenancyActivity] Inserting activity:', { tenancyId, action: input.action, title: input.title })

  const { data, error } = await supabase
    .from('tenancy_activity')
    .insert({
      tenancy_id: tenancyId,
      action: input.action,
      category: input.category || 'general',
      title: input.title,
      description: input.description || null,
      metadata: input.metadata || {},
      performed_by: input.performedBy || null,
      is_system_action: input.isSystemAction ?? !input.performedBy
    })

  if (error) {
    // Don't throw - activity logging should not break main operations
    console.error('[logTenancyActivity] Error:', error)
  } else {
    console.log('[logTenancyActivity] Success')
  }
}

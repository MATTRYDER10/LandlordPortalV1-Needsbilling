/**
 * Tenant Change Service
 *
 * Manages the 7-stage Change of Tenant (Sharer) workflow:
 * Stage 1: Tenant selection (outgoing/incoming)
 * Stage 2: Referencing decision
 * Stage 3: Fee & Date configuration
 * Stage 4: Addendum generation
 * Stage 5: Awaiting signatures
 * Stage 6: Completion
 * Stage 7: Post-completion checklist
 */

import { supabase } from '../config/supabase'
import { encrypt, decrypt, generateToken, hash } from './encryption'
import { logTenancyActivity } from './tenancyService'
import { loadEmailTemplate, sendEmail, sendTenantReferenceRequest } from './emailService'
import { getFrontendUrl, getV2FrontendUrl } from '../utils/frontendUrl'
import { pdfGenerationService } from './pdfGenerationService'
import { v4 as uuidv4 } from 'uuid'
import { createReference as createV2Reference } from './v2/referenceServiceV2'
import crypto from 'crypto'

const PROPERTY_DOCS_BUCKET = 'property-documents'

// ============================================================================
// INTERFACES
// ============================================================================

export interface IncomingTenant {
  title?: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  dob?: string
  currentAddress?: {
    line1: string
    line2?: string
    city: string
    postcode: string
  }
  hasGuarantor?: boolean
  guarantor?: {
    title?: string
    firstName: string
    lastName: string
    email?: string
    phone?: string
    address?: {
      line1: string
      line2?: string
      city: string
      postcode: string
    }
  }
}

export interface TenantChange {
  id: string
  tenancy_id: string
  company_id: string
  stage: number
  status: 'in_progress' | 'completed' | 'cancelled'
  outgoing_tenant_ids: string[]
  incoming_tenants: IncomingTenant[]
  expected_move_out_date: string | null
  expected_move_in_date: string | null
  referencing_skipped: boolean
  referencing_overridden: boolean
  referencing_override_reason: string | null
  incoming_tenant_reference_ids: string[]
  changeover_date: string | null
  fee_amount: number
  fee_waived: boolean
  fee_waived_reason: string | null
  fee_above_50_justification: string | null
  fee_payable_by: 'outgoing' | 'incoming' | 'split'
  payment_reference: string | null
  bank_name: string | null
  sort_code: string | null
  account_number: string | null
  pro_rata_outgoing: number
  pro_rata_incoming: number
  fee_invoice_sent_at: string | null
  fee_invoice_sent_to: string | null
  fee_received_at: string | null
  fee_received_by: string | null
  fee_received_amount: number | null
  fee_received_notes: string | null
  addendum_document_id: string | null
  addendum_pdf_url: string | null
  addendum_sent_at: string | null
  addendum_fully_signed_at: string | null
  signed_addendum_pdf_url: string | null
  completed_at: string | null
  completed_by: string | null
  checklist_deposit_updated: boolean
  checklist_deposit_updated_at: string | null
  checklist_prescribed_info_sent: boolean
  checklist_prescribed_info_sent_at: string | null
  checklist_deposit_share_confirmed: boolean
  checklist_deposit_share_confirmed_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  cancelled_at: string | null
  cancelled_by: string | null
  cancellation_reason: string | null
}

export interface TenantChangeSignature {
  id: string
  tenant_change_id: string
  signer_type: 'outgoing_tenant' | 'incoming_tenant' | 'remaining_tenant' | 'landlord_agent'
  signer_index: number
  signer_name: string
  signer_email: string
  signature_data: string | null
  signature_type: 'draw' | 'type' | null
  typed_name: string | null
  status: 'pending' | 'sent' | 'viewed' | 'signed' | 'declined'
  decline_reason: string | null
  signing_token: string
  token_expires_at: string
  ip_address: string | null
  user_agent: string | null
  geolocation: any | null
  signed_at: string | null
  last_email_sent_at: string | null
  email_send_count: number
  created_at: string
}

export interface CreateTenantChangeInput {
  tenancyId: string
  companyId: string
  outgoingTenantIds: string[]
  incomingTenants: IncomingTenant[]
  expectedMoveOutDate?: string
  expectedMoveInDate?: string
}

export interface UpdateFeeDetailsInput {
  changeover_date?: string
  fee_amount?: number
  fee_waived?: boolean
  fee_waived_reason?: string
  fee_above_50_justification?: string
  fee_payable_by?: 'outgoing' | 'incoming' | 'split'
  bank_name?: string
  sort_code?: string
  account_number?: string
}

export interface MarkFeeReceivedInput {
  amount: number
  notes?: string
}

export interface ChecklistUpdate {
  deposit_updated?: boolean
  prescribed_info_sent?: boolean
  deposit_share_confirmed?: boolean
}

// ============================================================================
// STAGE 1: CREATE TENANT CHANGE
// ============================================================================

/**
 * Create a new tenant change workflow
 */
export async function createTenantChange(
  input: CreateTenantChangeInput,
  userId: string
): Promise<TenantChange> {
  const { tenancyId, companyId, outgoingTenantIds, incomingTenants, expectedMoveOutDate, expectedMoveInDate } = input

  // Check for existing in-progress change
  const existing = await getActiveTenantChange(tenancyId)
  if (existing) {
    throw new Error('A tenant change is already in progress for this tenancy. Please complete or cancel it before starting a new one.')
  }

  // Get company bank details for defaults
  const { data: company } = await supabase
    .from('companies')
    .select('bank_account_name, bank_account_number, bank_sort_code')
    .eq('id', companyId)
    .single()

  // Generate payment reference
  const paymentReference = `COT-${Date.now().toString(36).toUpperCase()}`

  const { data, error } = await supabase
    .from('tenant_changes')
    .insert({
      tenancy_id: tenancyId,
      company_id: companyId,
      stage: 1,
      status: 'in_progress',
      outgoing_tenant_ids: outgoingTenantIds,
      incoming_tenants: incomingTenants,
      expected_move_out_date: expectedMoveOutDate || null,
      expected_move_in_date: expectedMoveInDate || null,
      payment_reference: paymentReference,
      bank_name: company?.bank_account_name || null,
      sort_code: company?.bank_sort_code || null,
      account_number: company?.bank_account_number || null,
      created_by: userId
    })
    .select()
    .single()

  if (error) {
    console.error('[TenantChangeService] Failed to create tenant change:', error)
    throw new Error(`Failed to create tenant change: ${error.message}`)
  }

  // Log activity
  await logTenancyActivity(tenancyId, {
    action: 'TENANT_CHANGE_INITIATED',
    category: 'tenant_change',
    title: 'Change of Tenant Initiated',
    description: `Started change of tenant process for ${outgoingTenantIds.length} outgoing and ${incomingTenants.length} incoming tenant(s)`,
    metadata: {
      tenant_change_id: data.id,
      outgoing_count: outgoingTenantIds.length,
      incoming_count: incomingTenants.length
    },
    performedBy: userId
  })

  return formatTenantChange(data)
}

/**
 * Get a tenant change by ID
 */
export async function getTenantChange(
  tenantChangeId: string,
  companyId: string
): Promise<TenantChange | null> {
  const { data, error } = await supabase
    .from('tenant_changes')
    .select('*')
    .eq('id', tenantChangeId)
    .eq('company_id', companyId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Failed to get tenant change: ${error.message}`)
  }

  return formatTenantChange(data)
}

/**
 * Get active (in-progress) tenant change for a tenancy
 */
export async function getActiveTenantChange(
  tenancyId: string
): Promise<TenantChange | null> {
  const { data, error } = await supabase
    .from('tenant_changes')
    .select('*')
    .eq('tenancy_id', tenancyId)
    .eq('status', 'in_progress')
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to get active tenant change: ${error.message}`)
  }

  return data ? formatTenantChange(data) : null
}

/**
 * Update tenant change details (Stage 1)
 */
export async function updateTenantChange(
  tenantChangeId: string,
  companyId: string,
  updates: Partial<{
    outgoing_tenant_ids: string[]
    incoming_tenants: IncomingTenant[]
    expected_move_out_date: string
    expected_move_in_date: string
  }>,
  userId: string
): Promise<TenantChange> {
  const { data, error } = await supabase
    .from('tenant_changes')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', tenantChangeId)
    .eq('company_id', companyId)
    .eq('status', 'in_progress')
    .select()

  if (error) {
    throw new Error(`Failed to update tenant change: ${error.message}`)
  }

  if (!data || data.length === 0) {
    throw new Error('Tenant change not found or is not in progress')
  }

  return formatTenantChange(data[0])
}

/**
 * Advance to next stage
 */
export async function advanceStage(
  tenantChangeId: string,
  companyId: string,
  userId: string
): Promise<TenantChange> {
  const existing = await getTenantChange(tenantChangeId, companyId)
  if (!existing) {
    throw new Error('Tenant change not found')
  }

  if (existing.stage >= 7) {
    throw new Error('Already at final stage')
  }

  const { data, error } = await supabase
    .from('tenant_changes')
    .update({
      stage: existing.stage + 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', tenantChangeId)
    .eq('company_id', companyId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to advance stage: ${error.message}`)
  }

  return formatTenantChange(data)
}

// ============================================================================
// STAGE 2: REFERENCING
// ============================================================================

/**
 * Set referencing decision and create references for incoming tenants if required
 */
export async function setReferencingDecision(
  tenantChangeId: string,
  companyId: string,
  requiresReferencing: boolean,
  userId: string
): Promise<TenantChange> {
  // Get current tenant change
  const tenantChange = await getTenantChange(tenantChangeId, companyId)
  if (!tenantChange) {
    throw new Error('Tenant change not found')
  }

  // If referencing is required, create references for each incoming tenant
  // But skip if references were already created (user navigated back and re-submitted)
  const referenceIds: string[] = []
  const existingReferenceIds = tenantChange.incoming_tenant_reference_ids || []

  if (requiresReferencing && existingReferenceIds.length > 0) {
    // References already exist — verify they're still valid
    const { data: existingRefs } = await supabase
      .from('tenant_references_v2')
      .select('id')
      .in('id', existingReferenceIds)

    if (existingRefs && existingRefs.length > 0) {
      // References already exist, just advance stage without re-creating
      const { data, error } = await supabase
        .from('tenant_changes')
        .update({
          referencing_skipped: false,
          stage: Math.max(tenantChange.stage, 2),
          updated_at: new Date().toISOString()
        })
        .eq('id', tenantChangeId)
        .eq('company_id', companyId)
        .select()
        .single()

      if (error) {
        throw new Error(`Failed to set referencing decision: ${error.message}`)
      }

      return formatTenantChange(data)
    }
  }

  if (requiresReferencing && tenantChange.incoming_tenants && tenantChange.incoming_tenants.length > 0) {
    // Get tenancy and property details
    const { data: tenancy } = await supabase
      .from('tenancies')
      .select(`
        *,
        properties(address_line1_encrypted, city_encrypted, postcode)
      `)
      .eq('id', tenantChange.tenancy_id)
      .single()

    if (!tenancy) {
      throw new Error('Tenancy not found')
    }

    const properties = tenancy.properties as { address_line1_encrypted?: string; city_encrypted?: string; postcode?: string } | null
    const propertyAddress = decrypt(properties?.address_line1_encrypted || null) || ''
    const propertyCity = decrypt(properties?.city_encrypted || null) || ''
    const propertyPostcode = properties?.postcode || ''

    // Get company details for email
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted, phone_encrypted, email_encrypted, logo_url')
      .eq('id', companyId)
      .single()

    const companyName = company?.name_encrypted ? (decrypt(company.name_encrypted) || 'PropertyGoose') : 'PropertyGoose'
    const companyPhone = company?.phone_encrypted ? (decrypt(company.phone_encrypted) || '') : ''
    const companyEmail = company?.email_encrypted ? (decrypt(company.email_encrypted) || '') : ''
    const companyLogoUrl = company?.logo_url

    // Create V2 reference for each incoming tenant
    for (const incomingTenant of tenantChange.incoming_tenants) {
      const reference = await createV2Reference({
        companyId,
        tenantFirstName: incomingTenant.firstName,
        tenantLastName: incomingTenant.lastName,
        tenantEmail: incomingTenant.email || '',
        tenantPhone: incomingTenant.phone || undefined,
        propertyAddress,
        propertyCity,
        propertyPostcode,
        linkedPropertyId: tenancy.property_id || undefined,
        monthlyRent: tenancy.rent_amount || 0,
        moveInDate: tenantChange.expected_move_in_date || new Date().toISOString().split('T')[0],
        createdBy: userId
      })

      if (!reference) {
        console.error('Failed to create V2 reference for incoming tenant:', incomingTenant.firstName)
        continue
      }

      referenceIds.push(reference.id)

      // Send V2 reference request email to tenant
      const tenantEmail = incomingTenant.email?.trim()
      if (tenantEmail) {
        // Get the form token from the reference
        const formToken = generateToken()
        const formTokenHash = hash(formToken)
        await supabase
          .from('tenant_references_v2')
          .update({ form_token_hash: formTokenHash })
          .eq('id', reference.id)

        const tenantUrl = `${getV2FrontendUrl()}/submit-reference-v2/${formToken}`
        try {
          await sendTenantReferenceRequest(
            tenantEmail,
            `${incomingTenant.firstName} ${incomingTenant.lastName}`.trim(),
            tenantUrl,
            companyName,
            propertyAddress || undefined,
            companyPhone || undefined,
            companyEmail || undefined,
            reference.id,
            companyLogoUrl
          )
          console.log(`[TenantChange] V2 Reference request sent to ${tenantEmail}`)
        } catch (emailError) {
          console.error(`[TenantChange] Failed to send reference email to ${tenantEmail}:`, emailError)
        }
      }
    }

    // Log activity
    await logTenancyActivity(tenantChange.tenancy_id, {
      action: 'TENANT_CHANGE_REFERENCING_STARTED',
      category: 'tenant_change',
      title: 'Referencing Started',
      description: `Reference requests sent to ${referenceIds.length} incoming tenant(s)`,
      metadata: {
        tenant_change_id: tenantChangeId,
        reference_count: referenceIds.length,
        reference_ids: referenceIds
      },
      performedBy: userId
    })
  }

  // Update tenant change
  const { data, error } = await supabase
    .from('tenant_changes')
    .update({
      referencing_skipped: !requiresReferencing,
      incoming_tenant_reference_ids: referenceIds.length > 0 ? referenceIds : undefined,
      stage: 2,
      updated_at: new Date().toISOString()
    })
    .eq('id', tenantChangeId)
    .eq('company_id', companyId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to set referencing decision: ${error.message}`)
  }

  return formatTenantChange(data)
}

/**
 * Override referencing (proceed without passed referencing)
 */
export async function overrideReferencing(
  tenantChangeId: string,
  companyId: string,
  reason: string,
  userId: string
): Promise<TenantChange> {
  const { data, error } = await supabase
    .from('tenant_changes')
    .update({
      referencing_overridden: true,
      referencing_override_reason: reason,
      updated_at: new Date().toISOString()
    })
    .eq('id', tenantChangeId)
    .eq('company_id', companyId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to override referencing: ${error.message}`)
  }

  await logTenancyActivity(data.tenancy_id, {
    action: 'REFERENCING_OVERRIDDEN',
    category: 'tenant_change',
    title: 'Referencing Override',
    description: `Referencing requirement overridden: ${reason}`,
    metadata: { tenant_change_id: tenantChangeId, reason },
    performedBy: userId
  })

  return formatTenantChange(data)
}

// ============================================================================
// STAGE 3: FEE & DATE
// ============================================================================

/**
 * Calculate pro-rata amounts
 */
export async function calculateProRata(
  tenancyId: string,
  changeoverDate: string
): Promise<{ outgoing: number; incoming: number; dailyRate: number }> {
  // Get tenancy details
  const { data: tenancy, error } = await supabase
    .from('tenancies')
    .select('rent_amount, rent_due_day')
    .eq('id', tenancyId)
    .single()

  if (error || !tenancy) {
    throw new Error('Tenancy not found')
  }

  const monthlyRent = parseFloat(tenancy.rent_amount || 0)
  const rentDueDay = tenancy.rent_due_day || 1
  const changeDate = new Date(changeoverDate)

  // Calculate daily rate (monthly rent * 12 / 365)
  const dailyRate = (monthlyRent * 12) / 365

  // Get days in the current rent period
  const changeDay = changeDate.getDate()

  // Days from changeover to end of rent period
  // Assuming rent period is from rent_due_day to rent_due_day
  let daysRemaining: number
  if (changeDay >= rentDueDay) {
    // Changeover after rent due day - days until next rent due day
    const nextMonth = new Date(changeDate.getFullYear(), changeDate.getMonth() + 1, rentDueDay)
    daysRemaining = Math.ceil((nextMonth.getTime() - changeDate.getTime()) / (1000 * 60 * 60 * 24))
  } else {
    // Changeover before rent due day - days until current month's rent due day
    const thisMonth = new Date(changeDate.getFullYear(), changeDate.getMonth(), rentDueDay)
    daysRemaining = Math.ceil((thisMonth.getTime() - changeDate.getTime()) / (1000 * 60 * 60 * 24))
  }

  // Pro-rata amounts
  const outgoing = Math.round(dailyRate * daysRemaining * 100) / 100 // Amount to refund
  const incoming = outgoing // Amount incoming tenant pays

  return {
    outgoing,
    incoming,
    dailyRate: Math.round(dailyRate * 100) / 100
  }
}

/**
 * Update fee details
 */
export async function updateFeeDetails(
  tenantChangeId: string,
  companyId: string,
  input: UpdateFeeDetailsInput,
  userId: string
): Promise<TenantChange> {
  const updates: Record<string, any> = {
    updated_at: new Date().toISOString()
  }

  if (input.changeover_date !== undefined) updates.changeover_date = input.changeover_date
  if (input.fee_amount !== undefined) updates.fee_amount = input.fee_amount
  if (input.fee_waived !== undefined) updates.fee_waived = input.fee_waived
  if (input.fee_waived_reason !== undefined) updates.fee_waived_reason = input.fee_waived_reason
  if (input.fee_above_50_justification !== undefined) updates.fee_above_50_justification = input.fee_above_50_justification
  if (input.fee_payable_by !== undefined) updates.fee_payable_by = input.fee_payable_by
  if (input.bank_name !== undefined) updates.bank_name = input.bank_name
  if (input.sort_code !== undefined) updates.sort_code = input.sort_code
  if (input.account_number !== undefined) updates.account_number = input.account_number

  // Calculate pro-rata if changeover date is set
  if (input.changeover_date) {
    const existing = await getTenantChange(tenantChangeId, companyId)
    if (existing) {
      const proRata = await calculateProRata(existing.tenancy_id, input.changeover_date)
      updates.pro_rata_outgoing = proRata.outgoing
      updates.pro_rata_incoming = proRata.incoming
    }
  }

  const { data, error } = await supabase
    .from('tenant_changes')
    .update(updates)
    .eq('id', tenantChangeId)
    .eq('company_id', companyId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update fee details: ${error.message}`)
  }

  return formatTenantChange(data)
}

/**
 * Send fee invoice
 */
export async function sendFeeInvoice(
  tenantChangeId: string,
  companyId: string,
  userId: string
): Promise<TenantChange> {
  const tenantChange = await getTenantChange(tenantChangeId, companyId)
  if (!tenantChange) {
    throw new Error('Tenant change not found')
  }

  // Get tenancy and property details
  const { data: tenancy } = await supabase
    .from('tenancies')
    .select(`
      *,
      properties(postcode, address_line1_encrypted, city_encrypted)
    `)
    .eq('id', tenantChange.tenancy_id)
    .single()

  if (!tenancy) {
    throw new Error('Tenancy not found')
  }

  // Get company details
  const { data: company } = await supabase
    .from('companies')
    .select('name_encrypted, email_encrypted, phone_encrypted, reference_notification_email, logo_url')
    .eq('id', companyId)
    .single()

  const companyName = company?.name_encrypted ? decrypt(company.name_encrypted) : 'PropertyGoose'
  const companyEmail = company?.reference_notification_email || (company?.email_encrypted ? decrypt(company.email_encrypted) : null)
  const companyPhone = company?.phone_encrypted ? decrypt(company.phone_encrypted) : null

  // Determine who to send invoice to based on fee_payable_by
  let recipientEmail: string | null = null
  let recipientName: string = ''

  if (tenantChange.fee_payable_by === 'outgoing' || tenantChange.fee_payable_by === 'split') {
    // Get outgoing tenant email
    if (tenantChange.outgoing_tenant_ids.length > 0) {
      const { data: outgoingTenant } = await supabase
        .from('tenancy_tenants')
        .select('tenant_name_encrypted, tenant_email_encrypted')
        .eq('id', tenantChange.outgoing_tenant_ids[0])
        .single()

      if (outgoingTenant) {
        recipientEmail = decrypt(outgoingTenant.tenant_email_encrypted)
        recipientName = decrypt(outgoingTenant.tenant_name_encrypted) || 'Tenant'
      }
    }
  } else if (tenantChange.fee_payable_by === 'incoming') {
    // Get incoming tenant email
    if (tenantChange.incoming_tenants.length > 0) {
      recipientEmail = tenantChange.incoming_tenants[0].email || null
      recipientName = `${tenantChange.incoming_tenants[0].firstName} ${tenantChange.incoming_tenants[0].lastName}`
    }
  }

  if (!recipientEmail) {
    throw new Error('No valid email address found for fee recipient')
  }

  const propertyAddress = [
    decrypt(tenancy.properties?.address_line1_encrypted),
    tenancy.properties?.postcode
  ].filter(Boolean).join(', ')

  // Generate payment confirmation token
  const paymentToken = uuidv4().replace(/-/g, '').substring(0, 24)
  const confirmPaymentUrl = `${getFrontendUrl()}/confirm-payment/${paymentToken}`

  // Load and send email - fee only, no pro-rata (changeover happens on rent due date)
  const feeAmount = tenantChange.fee_waived ? 0 : tenantChange.fee_amount
  const html = loadEmailTemplate('tenant-change-fee-invoice', {
    RecipientName: recipientName,
    PropertyAddress: propertyAddress,
    ChangeoverDate: tenantChange.changeover_date ? new Date(tenantChange.changeover_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'TBC',
    FeeAmount: feeAmount.toFixed(2),
    FeeWaived: tenantChange.fee_waived ? 'Yes (Waived)' : 'No',
    BankAccountName: tenantChange.bank_name || companyName || 'TBC',
    BankSortCode: tenantChange.sort_code || 'TBC',
    BankAccountNumber: tenantChange.account_number || 'TBC',
    PaymentReference: tenantChange.payment_reference || '',
    ConfirmPaymentUrl: confirmPaymentUrl,
    CompanyName: companyName || 'PropertyGoose',
    AgentLogoUrl: company?.logo_url || 'https://app.propertygoose.co.uk/PropertyGooseLogo.png'
  })

  await sendEmail({
    to: recipientEmail,
    subject: `Change of Tenant Fee Invoice - ${propertyAddress}`,
    html,
    contactDetails: {
      companyName: companyName || undefined,
      email: companyEmail || undefined,
      phone: companyPhone || undefined
    },
    tenancyId: tenantChange.tenancy_id,
    companyId: tenantChange.company_id,
    emailCategory: 'tenant_change_fee_invoice'
  })

  // Update tenant change record with payment token
  const { data, error } = await supabase
    .from('tenant_changes')
    .update({
      fee_invoice_sent_at: new Date().toISOString(),
      fee_invoice_sent_to: recipientEmail,
      fee_payment_token: paymentToken,
      stage: 3,
      updated_at: new Date().toISOString()
    })
    .eq('id', tenantChangeId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update tenant change: ${error.message}`)
  }

  // Log activity
  await logTenancyActivity(tenantChange.tenancy_id, {
    action: 'TENANT_CHANGE_FEE_SENT',
    category: 'tenant_change',
    title: 'Fee Invoice Sent',
    description: `Fee invoice sent to ${recipientName} (${recipientEmail})`,
    metadata: {
      tenant_change_id: tenantChangeId,
      recipient_email: recipientEmail,
      fee_amount: feeAmount
    },
    performedBy: userId
  })

  // Create expected payment for tenant change fee
  try {
    const { createExpectedPayment } = await import('./rentgooseService')
    const feeAmt = tenantChange.fee_waived ? 0 : tenantChange.fee_amount
    if (feeAmt > 0) {
      await createExpectedPayment(companyId, {
        tenancy_id: tenantChange.tenancy_id,
        payment_type: 'tenant_change_fee',
        source_type: 'tenant_change',
        source_id: tenantChangeId,
        description: `Tenant change fee - ${propertyAddress}`,
        amount_due: feeAmt,
        status: 'pending',
        payout_type: 'agent',
        payout_split: [{ type: 'agent_fee', amount: feeAmt, description: 'Tenant change administration fee' }],
        property_address: propertyAddress || undefined,
        tenant_name: recipientName,
      })
    }
  } catch (epError) {
    console.error('[RentGoose] Failed to create tenant change fee expected payment:', epError)
  }

  return formatTenantChange(data)
}

/**
 * Mark fee as received
 */
export async function markFeeReceived(
  tenantChangeId: string,
  companyId: string,
  input: MarkFeeReceivedInput,
  userId: string
): Promise<TenantChange> {
  const tenantChange = await getTenantChange(tenantChangeId, companyId)
  if (!tenantChange) {
    throw new Error('Tenant change not found')
  }

  const { data, error } = await supabase
    .from('tenant_changes')
    .update({
      fee_received_at: new Date().toISOString(),
      fee_received_by: userId,
      fee_received_amount: input.amount,
      fee_received_notes: input.notes || null,
      stage: Math.max(tenantChange.stage, 4), // Advance to stage 4 if not already there
      updated_at: new Date().toISOString()
    })
    .eq('id', tenantChangeId)
    .eq('company_id', companyId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to mark fee received: ${error.message}`)
  }

  // Log activity
  await logTenancyActivity(tenantChange.tenancy_id, {
    action: 'TENANT_CHANGE_FEE_RECEIVED',
    category: 'tenant_change',
    title: 'Fee Payment Received',
    description: `Payment of £${input.amount.toFixed(2)} received`,
    metadata: {
      tenant_change_id: tenantChangeId,
      amount: input.amount,
      notes: input.notes
    },
    performedBy: userId
  })

  // Receipt the expected payment
  try {
    const { receiptExpectedPayment } = await import('./rentgooseService')
    const { supabase: sb } = await import('../config/supabase')

    const { data: ep } = await sb
      .from('expected_payments')
      .select('id')
      .eq('company_id', companyId)
      .eq('source_type', 'tenant_change')
      .eq('source_id', tenantChangeId)
      .in('status', ['pending', 'due'])
      .limit(1)
      .single()

    if (ep) {
      await receiptExpectedPayment(companyId, {
        expected_payment_id: ep.id,
        amount: input.amount,
        payment_method: 'bank_transfer',
        date_received: new Date().toISOString().split('T')[0],
        receipted_by: userId,
      })
    }
  } catch (epError) {
    console.error('[RentGoose] Failed to receipt tenant change fee:', epError)
  }

  return formatTenantChange(data)
}

/**
 * Tenant confirms payment (public, via email link)
 */
export async function confirmPaymentByTenant(
  paymentToken: string
): Promise<{ success: boolean; propertyAddress: string }> {
  // Find tenant change by payment token
  const { data: tenantChange, error } = await supabase
    .from('tenant_changes')
    .select(`
      *,
      tenancies(
        id,
        properties(postcode, address_line1_encrypted)
      )
    `)
    .eq('fee_payment_token', paymentToken)
    .single()

  if (error || !tenantChange) {
    throw new Error('Invalid or expired payment confirmation link')
  }

  if (tenantChange.fee_tenant_confirmed_at) {
    // Already confirmed - just return success
    const properties = tenantChange.tenancies?.properties as { address_line1_encrypted?: string; postcode?: string } | null
    return {
      success: true,
      propertyAddress: [decrypt(properties?.address_line1_encrypted || null), properties?.postcode].filter(Boolean).join(', ')
    }
  }

  // Mark as tenant confirmed
  await supabase
    .from('tenant_changes')
    .update({
      fee_tenant_confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', tenantChange.id)

  // Get company details for notification
  const { data: company } = await supabase
    .from('companies')
    .select('name_encrypted, email_encrypted, reference_notification_email, logo_url')
    .eq('id', tenantChange.company_id)
    .single()

  const companyName = company?.name_encrypted ? decrypt(company.name_encrypted) : 'PropertyGoose'
  const agentEmail = company?.reference_notification_email || (company?.email_encrypted ? decrypt(company.email_encrypted) : null)

  const properties = tenantChange.tenancies?.properties as { address_line1_encrypted?: string; postcode?: string } | null
  const propertyAddress = [decrypt(properties?.address_line1_encrypted || null), properties?.postcode].filter(Boolean).join(', ')

  // Send notification email to agent
  if (agentEmail) {
    // Fee only, no pro-rata (changeover happens on rent due date)
    const totalAmount = tenantChange.fee_waived ? 0 : tenantChange.fee_amount

    const html = loadEmailTemplate('tenant-change-payment-confirmed', {
      PropertyAddress: propertyAddress,
      PaymentReference: tenantChange.payment_reference || 'N/A',
      TotalAmount: totalAmount.toFixed(2),
      TenantName: tenantChange.fee_invoice_sent_to || 'Tenant',
      ConfirmedAt: new Date().toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' }),
      CompanyName: companyName || 'PropertyGoose',
      AgentLogoUrl: company?.logo_url || 'https://app.propertygoose.co.uk/PropertyGooseLogo.png'
    })

    await sendEmail({
      to: agentEmail,
      subject: `Payment Confirmed - Change of Tenant at ${propertyAddress}`,
      html,
      tenancyId: tenantChange.tenancy_id,
      companyId: tenantChange.company_id,
      emailCategory: 'tenant_change_payment_confirmed'
    })
  }

  // Log activity
  await logTenancyActivity(tenantChange.tenancy_id, {
    action: 'TENANT_CHANGE_PAYMENT_CONFIRMED',
    category: 'tenant_change',
    title: 'Tenant Confirmed Payment',
    description: `Tenant confirmed they have made the payment`,
    metadata: {
      tenant_change_id: tenantChange.id,
      confirmed_at: new Date().toISOString()
    }
  })

  return { success: true, propertyAddress }
}

/**
 * Get tenant change by payment token (public)
 */
export async function getTenantChangeByPaymentToken(
  paymentToken: string
): Promise<{ propertyAddress: string; totalAmount: number; paymentReference: string; alreadyConfirmed: boolean } | null> {
  const { data: tenantChange, error } = await supabase
    .from('tenant_changes')
    .select(`
      *,
      tenancies(
        properties(postcode, address_line1_encrypted)
      )
    `)
    .eq('fee_payment_token', paymentToken)
    .single()

  if (error || !tenantChange) {
    return null
  }

  const properties = tenantChange.tenancies?.properties as { address_line1_encrypted?: string; postcode?: string } | null
  const propertyAddress = [decrypt(properties?.address_line1_encrypted || null), properties?.postcode].filter(Boolean).join(', ')
  // Fee only, no pro-rata (changeover happens on rent due date)
  const totalAmount = tenantChange.fee_waived ? 0 : tenantChange.fee_amount

  return {
    propertyAddress,
    totalAmount,
    paymentReference: tenantChange.payment_reference || '',
    alreadyConfirmed: !!tenantChange.fee_tenant_confirmed_at
  }
}

// ============================================================================
// STAGE 4-5: ADDENDUM & SIGNING
// ============================================================================

/**
 * Generate signing token
 */
function generateSigningToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Create signature records for all parties
 */
export async function createSignatureRecords(
  tenantChangeId: string,
  companyId: string,
  userId: string
): Promise<TenantChangeSignature[]> {
  const tenantChange = await getTenantChange(tenantChangeId, companyId)
  if (!tenantChange) {
    throw new Error('Tenant change not found')
  }

  // Get tenancy and current tenants
  const { data: tenancy } = await supabase
    .from('tenancies')
    .select('*')
    .eq('id', tenantChange.tenancy_id)
    .single()

  // Get all current active tenants
  const { data: currentTenants } = await supabase
    .from('tenancy_tenants')
    .select('id, tenant_name_encrypted, tenant_email_encrypted')
    .eq('tenancy_id', tenantChange.tenancy_id)
    .eq('is_active', true)

  const signatures: any[] = []
  const tokenExpiry = new Date()
  tokenExpiry.setDate(tokenExpiry.getDate() + 30) // 30 days expiry

  // 1. Outgoing tenants
  for (let i = 0; i < tenantChange.outgoing_tenant_ids.length; i++) {
    const tenantId = tenantChange.outgoing_tenant_ids[i]
    const tenant = currentTenants?.find(t => t.id === tenantId)
    if (tenant) {
      signatures.push({
        tenant_change_id: tenantChangeId,
        signer_type: 'outgoing_tenant',
        signer_index: i,
        signer_name: decrypt(tenant.tenant_name_encrypted) || 'Tenant',
        signer_email: decrypt(tenant.tenant_email_encrypted) || '',
        signing_token: generateSigningToken(),
        token_expires_at: tokenExpiry.toISOString(),
        status: 'pending'
      })
    }
  }

  // 2. Incoming tenants
  for (let i = 0; i < tenantChange.incoming_tenants.length; i++) {
    const tenant = tenantChange.incoming_tenants[i]
    signatures.push({
      tenant_change_id: tenantChangeId,
      signer_type: 'incoming_tenant',
      signer_index: i,
      signer_name: `${tenant.firstName} ${tenant.lastName}`,
      signer_email: tenant.email || '',
      signing_token: generateSigningToken(),
      token_expires_at: tokenExpiry.toISOString(),
      status: 'pending'
    })
  }

  // 3. Remaining tenants (current tenants who are not leaving)
  const remainingTenants = currentTenants?.filter(
    t => !tenantChange.outgoing_tenant_ids.includes(t.id)
  ) || []

  for (let i = 0; i < remainingTenants.length; i++) {
    const tenant = remainingTenants[i]
    signatures.push({
      tenant_change_id: tenantChangeId,
      signer_type: 'remaining_tenant',
      signer_index: i,
      signer_name: decrypt(tenant.tenant_name_encrypted) || 'Tenant',
      signer_email: decrypt(tenant.tenant_email_encrypted) || '',
      signing_token: generateSigningToken(),
      token_expires_at: tokenExpiry.toISOString(),
      status: 'pending'
    })
  }

  // 4. Landlord/Agent signature (agent signs on behalf)
  // Get company name for display
  const { data: company } = await supabase
    .from('companies')
    .select('name')
    .eq('id', companyId)
    .single()

  // Get the initiating user's email - this is who signs as the agent
  const { data: { user: initiatingUser } } = await supabase.auth.admin.getUserById(userId)
  const agentEmail = initiatingUser?.email || ''
  const agentName = initiatingUser?.user_metadata?.full_name || initiatingUser?.email || 'Agent'

  signatures.push({
    tenant_change_id: tenantChangeId,
    signer_type: 'landlord_agent',
    signer_index: 0,
    signer_name: `${agentName} (${company?.name || 'Agent'})`,
    signer_email: agentEmail,
    signing_token: generateSigningToken(),
    token_expires_at: tokenExpiry.toISOString(),
    status: 'pending'
  })

  // Insert all signatures
  const { data, error } = await supabase
    .from('tenant_change_signatures')
    .insert(signatures)
    .select()

  if (error) {
    throw new Error(`Failed to create signature records: ${error.message}`)
  }

  return data.map(formatSignature)
}

/**
 * Build addendum PDF data from tenant change and related records
 */
async function buildAddendumPdfData(
  tenantChangeId: string,
  companyId: string,
  includeSignatures: boolean = false
): Promise<{
  pdfData: Parameters<typeof pdfGenerationService.generateTenantChangeAddendum>[0]
  tenantChange: TenantChange
  propertyAddress: string
  company: any
}> {
  const tenantChange = await getTenantChange(tenantChangeId, companyId)
  if (!tenantChange) {
    throw new Error('Tenant change not found')
  }

  // Get tenancy and property details
  const { data: tenancy } = await supabase
    .from('tenancies')
    .select(`
      *,
      properties(id, postcode, address_line1_encrypted, address_line2_encrypted, city_encrypted)
    `)
    .eq('id', tenantChange.tenancy_id)
    .single()

  if (!tenancy) {
    throw new Error('Tenancy not found')
  }

  // Get company details
  const { data: company } = await supabase
    .from('companies')
    .select('name_encrypted, email_encrypted, phone_encrypted, reference_notification_email, logo_url, address_line1_encrypted, city_encrypted, postcode')
    .eq('id', companyId)
    .single()

  const companyName = company?.name_encrypted ? decrypt(company.name_encrypted) : 'PropertyGoose'

  const tenancyProperties = tenancy?.properties as {
    id?: string
    address_line1_encrypted?: string
    address_line2_encrypted?: string
    city_encrypted?: string
    postcode?: string
  } | null

  const propertyAddress = [
    decrypt(tenancyProperties?.address_line1_encrypted || null),
    decrypt(tenancyProperties?.address_line2_encrypted || null),
    decrypt(tenancyProperties?.city_encrypted || null),
    tenancyProperties?.postcode
  ].filter(Boolean).join(', ')

  // Get outgoing tenant details
  const { data: outgoingTenantsData } = await supabase
    .from('tenancy_tenants')
    .select('id, tenant_name_encrypted, tenant_email_encrypted')
    .in('id', tenantChange.outgoing_tenant_ids)

  const outgoingTenants = (outgoingTenantsData || []).map(t => ({
    name: decrypt(t.tenant_name_encrypted) || 'Tenant',
    email: decrypt(t.tenant_email_encrypted) || undefined
  }))

  // Get remaining tenants (current active tenants not leaving)
  const { data: currentTenantsData } = await supabase
    .from('tenancy_tenants')
    .select('id, tenant_name_encrypted, tenant_email_encrypted')
    .eq('tenancy_id', tenantChange.tenancy_id)
    .eq('is_active', true)

  const remainingTenants = (currentTenantsData || [])
    .filter(t => !tenantChange.outgoing_tenant_ids.includes(t.id))
    .map(t => ({
      name: decrypt(t.tenant_name_encrypted) || 'Tenant',
      email: decrypt(t.tenant_email_encrypted) || undefined
    }))

  // Format incoming tenants
  const incomingTenants = tenantChange.incoming_tenants.map(t => ({
    name: `${t.firstName} ${t.lastName}`.trim(),
    email: t.email,
    currentAddress: t.currentAddress
      ? [t.currentAddress.line1, t.currentAddress.line2, t.currentAddress.city, t.currentAddress.postcode].filter(Boolean).join(', ')
      : undefined
  }))

  // Get landlord details
  const { data: landlords } = await supabase
    .from('tenancy_landlords')
    .select('landlord_name_encrypted, landlord_address_encrypted')
    .eq('tenancy_id', tenantChange.tenancy_id)
    .eq('is_active', true)

  const landlordName = landlords && landlords.length > 0
    ? decrypt(landlords[0].landlord_name_encrypted) || companyName || 'Landlord'
    : companyName || 'Landlord'

  const companyAddress = [
    company?.address_line1_encrypted ? decrypt(company.address_line1_encrypted) : null,
    company?.city_encrypted ? decrypt(company.city_encrypted) : null,
    company?.postcode
  ].filter(Boolean).join(', ')

  const landlordAddress = landlords && landlords.length > 0 && landlords[0].landlord_address_encrypted
    ? decrypt(landlords[0].landlord_address_encrypted)
    : companyAddress

  // Calculate deposit splits (equal share per tenant)
  const depositAmount = parseFloat(tenancy.deposit_amount || 0)
  const totalTenants = outgoingTenants.length + incomingTenants.length + remainingTenants.length
  const outgoingShare = outgoingTenants.length > 0
    ? Math.round((depositAmount * outgoingTenants.length / (outgoingTenants.length + remainingTenants.length)) * 100) / 100
    : 0
  const incomingShare = incomingTenants.length > 0
    ? Math.round((depositAmount * incomingTenants.length / (incomingTenants.length + remainingTenants.length)) * 100) / 100
    : 0

  // Get signatures if needed
  let signatures: any[] = []
  if (includeSignatures) {
    const { data: sigData } = await supabase
      .from('tenant_change_signatures')
      .select('*')
      .eq('tenant_change_id', tenantChangeId)

    signatures = (sigData || []).map(s => ({
      signerType: s.signer_type,
      signerIndex: s.signer_index,
      signerName: s.signer_name,
      signatureData: s.signature_data,
      signatureType: s.signature_type,
      typedName: s.typed_name,
      signedAt: s.signed_at,
      ipAddress: s.ip_address
    }))
  }

  const documentRef = `COT-${tenantChangeId.substring(0, 8).toUpperCase()}`

  const pdfData = {
    documentRef,
    documentDate: new Date().toISOString(),
    propertyAddress,
    outgoingTenants,
    incomingTenants,
    remainingTenants,
    landlordName,
    landlordAddress: landlordAddress || undefined,
    tenancyStartDate: tenancy.tenancy_start_date || tenancy.start_date || '',
    monthlyRent: parseFloat(tenancy.rent_amount || 0),
    rentDueDay: tenancy.rent_due_day || 1,
    changeoverDate: tenantChange.changeover_date || '',
    depositAmount,
    depositScheme: tenancy.deposit_scheme || 'TDS',
    depositReference: tenancy.deposit_certificate_number || undefined,
    incomingDepositPayment: incomingShare,
    outgoingDepositRefund: outgoingShare,
    companyName: companyName || 'PropertyGoose',
    agentLogoUrl: company?.logo_url || undefined,
    signatures: includeSignatures ? signatures : undefined,
    includeAuditPage: includeSignatures
  }

  return { pdfData, tenantChange, propertyAddress, company }
}

/**
 * Generate and store the signed addendum PDF
 * Returns both the storage path (for property_documents) and signed URL (for emails/display)
 */
async function generateAndStoreSignedAddendum(
  tenantChangeId: string,
  companyId: string
): Promise<{ storagePath: string; signedUrl: string; pdfSize: number }> {
  console.log(`[TenantChange] Generating signed addendum PDF for ${tenantChangeId}`)

  const { pdfData, tenantChange, propertyAddress, company } = await buildAddendumPdfData(tenantChangeId, companyId, true)

  // Generate the signed PDF with audit page
  const pdfBuffer = await pdfGenerationService.generateTenantChangeAddendum(pdfData)

  // Get tenancy for property ID
  const { data: tenancy } = await supabase
    .from('tenancies')
    .select('property_id')
    .eq('id', tenantChange.tenancy_id)
    .single()

  // Upload to Supabase storage
  const fileName = `tenant-change-addendum-signed-${tenantChangeId.substring(0, 8)}-${Date.now()}.pdf`
  const storagePath = `${companyId}/${tenancy?.property_id || 'unknown'}/tenant-changes/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from(PROPERTY_DOCS_BUCKET)
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true
    })

  if (uploadError) {
    console.error('[TenantChange] Failed to upload signed addendum:', uploadError)
    throw new Error(`Failed to upload signed addendum: ${uploadError.message}`)
  }

  // Get signed URL (valid for 1 year)
  const { data: signedUrlData } = await supabase.storage
    .from(PROPERTY_DOCS_BUCKET)
    .createSignedUrl(storagePath, 365 * 24 * 60 * 60)

  const signedUrl = signedUrlData?.signedUrl || storagePath

  // Update tenant change with signed PDF URL (store signed URL for easy access)
  await supabase
    .from('tenant_changes')
    .update({
      signed_addendum_pdf_url: signedUrl,
      updated_at: new Date().toISOString()
    })
    .eq('id', tenantChangeId)

  console.log(`[TenantChange] Signed addendum stored: ${storagePath}`)
  return { storagePath, signedUrl, pdfSize: pdfBuffer.length }
}

/**
 * Send addendum for signing
 */
export async function sendAddendumForSigning(
  tenantChangeId: string,
  companyId: string,
  userId: string
): Promise<TenantChange> {
  const tenantChange = await getTenantChange(tenantChangeId, companyId)
  if (!tenantChange) {
    throw new Error('Tenant change not found')
  }

  // Create signature records if they don't exist
  const { data: existingSignatures } = await supabase
    .from('tenant_change_signatures')
    .select('id')
    .eq('tenant_change_id', tenantChangeId)

  if (!existingSignatures || existingSignatures.length === 0) {
    await createSignatureRecords(tenantChangeId, companyId, userId)
  }

  // Get all signatures
  const { data: signatures } = await supabase
    .from('tenant_change_signatures')
    .select('*')
    .eq('tenant_change_id', tenantChangeId)

  // Build PDF data and generate preview PDF (without signatures)
  const { pdfData, propertyAddress, company } = await buildAddendumPdfData(tenantChangeId, companyId, false)

  // Generate the unsigned preview PDF
  console.log('[TenantChange] Generating unsigned addendum PDF for preview')
  const pdfBuffer = await pdfGenerationService.generateTenantChangeAddendum(pdfData)

  // Get tenancy for property ID
  const { data: tenancy } = await supabase
    .from('tenancies')
    .select('property_id')
    .eq('id', tenantChange.tenancy_id)
    .single()

  // Upload preview PDF to storage
  const fileName = `tenant-change-addendum-preview-${tenantChangeId.substring(0, 8)}-${Date.now()}.pdf`
  const filePath = `${companyId}/${tenancy?.property_id || 'unknown'}/tenant-changes/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from(PROPERTY_DOCS_BUCKET)
    .upload(filePath, pdfBuffer, {
      contentType: 'application/pdf'
    })

  if (uploadError) {
    console.error('[TenantChange] Failed to upload addendum preview:', uploadError)
    // Don't fail the whole process if upload fails - emails can still be sent
  }

  // Get signed URL for the preview PDF
  let previewUrl = ''
  if (!uploadError) {
    const { data: signedUrlData } = await supabase.storage
      .from(PROPERTY_DOCS_BUCKET)
      .createSignedUrl(filePath, 30 * 24 * 60 * 60) // 30 days
    previewUrl = signedUrlData?.signedUrl || ''
  }

  const companyName = company?.name_encrypted ? decrypt(company.name_encrypted) : 'PropertyGoose'
  const companyEmail = company?.reference_notification_email || (company?.email_encrypted ? decrypt(company.email_encrypted) : null)
  const companyPhone = company?.phone_encrypted ? decrypt(company.phone_encrypted) : null

  // Send signing email to each party
  for (const sig of signatures || []) {
    if (!sig.signer_email) continue

    const signingUrl = `${getFrontendUrl()}/sign-tenant-change/${sig.signing_token}`

    const html = loadEmailTemplate('tenant-change-addendum-signing', {
      SignerName: sig.signer_name,
      PropertyAddress: propertyAddress,
      SignerType: formatSignerType(sig.signer_type),
      SigningUrl: signingUrl,
      ExpiryDate: new Date(sig.token_expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      CompanyName: companyName || 'PropertyGoose',
      AgentLogoUrl: company?.logo_url || 'https://app.propertygoose.co.uk/PropertyGooseLogo.png'
    })

    await sendEmail({
      to: sig.signer_email,
      subject: `Please Sign: Change of Tenant Addendum - ${propertyAddress}`,
      html,
      contactDetails: {
        companyName: companyName || undefined,
        email: companyEmail || undefined,
        phone: companyPhone || undefined
      },
      tenancyId: tenantChange.tenancy_id,
      companyId: tenantChange.company_id,
      emailCategory: 'tenant_change_addendum_signing'
    })

    // Update signature status
    await supabase
      .from('tenant_change_signatures')
      .update({
        status: 'sent',
        last_email_sent_at: new Date().toISOString(),
        email_send_count: (sig.email_send_count || 0) + 1
      })
      .eq('id', sig.id)

    // Log signature event
    await supabase
      .from('tenant_change_signature_events')
      .insert({
        signature_id: sig.id,
        tenant_change_id: tenantChangeId,
        event_type: 'email_sent'
      })
  }

  // Update tenant change status
  const { data, error } = await supabase
    .from('tenant_changes')
    .update({
      addendum_sent_at: new Date().toISOString(),
      addendum_pdf_url: previewUrl || null,
      stage: 5,
      updated_at: new Date().toISOString()
    })
    .eq('id', tenantChangeId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update tenant change: ${error.message}`)
  }

  // Log activity
  await logTenancyActivity(tenantChange.tenancy_id, {
    action: 'TENANT_CHANGE_ADDENDUM_SENT',
    category: 'tenant_change',
    title: 'Addendum Sent for Signing',
    description: `Addendum sent to ${signatures?.length || 0} parties for signature`,
    metadata: {
      tenant_change_id: tenantChangeId,
      signer_count: signatures?.length || 0,
      pdf_generated: !!previewUrl
    },
    performedBy: userId
  })

  return formatTenantChange(data)
}

/**
 * Get signing status
 */
export async function getSigningStatus(
  tenantChangeId: string,
  companyId: string
): Promise<{ signatures: TenantChangeSignature[]; allSigned: boolean; signedCount: number; totalCount: number }> {
  // Verify company access
  const tenantChange = await getTenantChange(tenantChangeId, companyId)
  if (!tenantChange) {
    throw new Error('Tenant change not found')
  }

  const { data: signatures, error } = await supabase
    .from('tenant_change_signatures')
    .select('*')
    .eq('tenant_change_id', tenantChangeId)
    .order('signer_type')
    .order('signer_index')

  if (error) {
    throw new Error(`Failed to get signing status: ${error.message}`)
  }

  const formattedSignatures = (signatures || []).map(formatSignature)
  const signedCount = formattedSignatures.filter(s => s.status === 'signed').length
  const totalCount = formattedSignatures.length

  return {
    signatures: formattedSignatures,
    allSigned: signedCount === totalCount && totalCount > 0,
    signedCount,
    totalCount
  }
}

/**
 * Get signature by token (public - for signing page)
 */
export async function getSignatureByToken(
  token: string
): Promise<{ signature: TenantChangeSignature; tenantChange: any; propertyAddress: string; originalAgreementPdfUrl: string | null; tenancyStartDate: string | null } | null> {
  const { data: signature, error } = await supabase
    .from('tenant_change_signatures')
    .select('*')
    .eq('signing_token', token)
    .single()

  if (error || !signature) {
    return null
  }

  // Check token expiry
  if (new Date(signature.token_expires_at) < new Date()) {
    return null
  }

  // Get tenant change details
  const { data: tenantChange } = await supabase
    .from('tenant_changes')
    .select(`
      *,
      tenancies!inner(
        *,
        properties(postcode, address_line1_encrypted, city_encrypted)
      )
    `)
    .eq('id', signature.tenant_change_id)
    .single()

  if (!tenantChange) {
    return null
  }

  const propertyAddress = [
    decrypt(tenantChange.tenancies?.properties?.address_line1_encrypted),
    tenantChange.tenancies?.properties?.postcode
  ].filter(Boolean).join(', ')

  // Look up the original tenancy agreement PDF
  let originalAgreementPdfUrl: string | null = null
  const tenancyId = tenantChange.tenancy_id

  // First check agreements table for a signed agreement
  const { data: agreement } = await supabase
    .from('agreements')
    .select('signed_pdf_url, pdf_url')
    .eq('tenancy_id', tenancyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (agreement?.signed_pdf_url) {
    originalAgreementPdfUrl = agreement.signed_pdf_url
  } else if (agreement?.pdf_url) {
    originalAgreementPdfUrl = agreement.pdf_url
  }

  // If not found in agreements, check property_documents with tag='agreement'
  if (!originalAgreementPdfUrl) {
    const { data: doc } = await supabase
      .from('property_documents')
      .select('file_path')
      .eq('source_type', 'tenancy')
      .eq('source_id', tenancyId)
      .eq('tag', 'agreement')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (doc?.file_path) {
      // If it's already a full URL, use it directly; otherwise generate a signed URL
      if (doc.file_path.startsWith('http')) {
        originalAgreementPdfUrl = doc.file_path
      } else {
        const { data: signedUrlData } = await supabase.storage
          .from(PROPERTY_DOCS_BUCKET)
          .createSignedUrl(doc.file_path, 3600) // 1 hour
        originalAgreementPdfUrl = signedUrlData?.signedUrl || null
      }
    }
  }

  // Get tenancy start date for legal text
  const tenancyStartDate = tenantChange.tenancies?.start_date || null

  return {
    signature: formatSignature(signature),
    tenantChange: {
      id: tenantChange.id,
      changeover_date: tenantChange.changeover_date,
      incoming_tenants: tenantChange.incoming_tenants,
      outgoing_tenant_ids: tenantChange.outgoing_tenant_ids,
      addendum_pdf_url: tenantChange.addendum_pdf_url
    },
    propertyAddress,
    originalAgreementPdfUrl,
    tenancyStartDate
  }
}

/**
 * Submit signature (public)
 */
export async function submitSignature(
  token: string,
  signatureData: string,
  signatureType: 'draw' | 'type',
  typedName: string | null,
  ipAddress: string,
  userAgent: string
): Promise<{ success: boolean; allSigned: boolean }> {
  // Get signature by token
  const { data: signature, error } = await supabase
    .from('tenant_change_signatures')
    .select('*')
    .eq('signing_token', token)
    .single()

  if (error || !signature) {
    throw new Error('Invalid signing token')
  }

  // Check token expiry
  if (new Date(signature.token_expires_at) < new Date()) {
    throw new Error('Signing link has expired')
  }

  // Check if already signed
  if (signature.status === 'signed') {
    throw new Error('This document has already been signed')
  }

  // Update signature
  const { error: updateError } = await supabase
    .from('tenant_change_signatures')
    .update({
      signature_data: signatureData,
      signature_type: signatureType,
      typed_name: typedName,
      status: 'signed',
      signed_at: new Date().toISOString(),
      ip_address: ipAddress,
      user_agent: userAgent
    })
    .eq('id', signature.id)

  if (updateError) {
    throw new Error(`Failed to submit signature: ${updateError.message}`)
  }

  // Log signature event
  await supabase
    .from('tenant_change_signature_events')
    .insert({
      signature_id: signature.id,
      tenant_change_id: signature.tenant_change_id,
      event_type: 'signature_completed',
      ip_address: ipAddress,
      user_agent: userAgent
    })

  // Check if all signatures are complete
  const { data: allSignatures } = await supabase
    .from('tenant_change_signatures')
    .select('status')
    .eq('tenant_change_id', signature.tenant_change_id)

  const allSigned = allSignatures?.every(s => s.status === 'signed') || false

  // If all signed, generate the signed PDF and update tenant change
  if (allSigned) {
    // Get the tenant change to find company_id
    const { data: tc } = await supabase
      .from('tenant_changes')
      .select('tenancy_id, company_id')
      .eq('id', signature.tenant_change_id)
      .single()

    let signedPdfUrl: string | null = null

    if (tc) {
      // Generate and store the signed PDF
      try {
        const pdfResult = await generateAndStoreSignedAddendum(signature.tenant_change_id, tc.company_id)
        signedPdfUrl = pdfResult.signedUrl
        console.log(`[TenantChange] Signed PDF generated: ${pdfResult.storagePath}`)
      } catch (pdfError) {
        console.error('[TenantChange] Failed to generate signed PDF:', pdfError)
        // Don't fail the signing process if PDF generation fails
      }

      // Log activity
      await logTenancyActivity(tc.tenancy_id, {
        action: 'TENANT_CHANGE_SIGNED',
        category: 'tenant_change',
        title: 'Addendum Fully Signed',
        description: 'All parties have signed the change of tenant addendum',
        metadata: {
          tenant_change_id: signature.tenant_change_id,
          signed_pdf_generated: !!signedPdfUrl
        },
        isSystemAction: true
      })
    }

    // Update tenant change with signed status and PDF URL
    await supabase
      .from('tenant_changes')
      .update({
        addendum_fully_signed_at: new Date().toISOString(),
        signed_addendum_pdf_url: signedPdfUrl,
        stage: 6,
        updated_at: new Date().toISOString()
      })
      .eq('id', signature.tenant_change_id)
  }

  return { success: true, allSigned }
}

/**
 * Decline to sign (public)
 */
export async function declineSignature(
  token: string,
  reason: string,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  const { data: signature, error } = await supabase
    .from('tenant_change_signatures')
    .select('*')
    .eq('signing_token', token)
    .single()

  if (error || !signature) {
    throw new Error('Invalid signing token')
  }

  await supabase
    .from('tenant_change_signatures')
    .update({
      status: 'declined',
      decline_reason: reason,
      ip_address: ipAddress,
      user_agent: userAgent
    })
    .eq('id', signature.id)

  // Log event
  await supabase
    .from('tenant_change_signature_events')
    .insert({
      signature_id: signature.id,
      tenant_change_id: signature.tenant_change_id,
      event_type: 'signature_declined',
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { reason }
    })
}

/**
 * Resend signing email
 */
export async function resendSigningEmail(
  signatureId: string,
  companyId: string,
  userId: string
): Promise<void> {
  const { data: signature, error } = await supabase
    .from('tenant_change_signatures')
    .select('*')
    .eq('id', signatureId)
    .single()

  if (error || !signature) {
    throw new Error('Signature not found')
  }

  // Verify company access
  const tenantChange = await getTenantChange(signature.tenant_change_id, companyId)
  if (!tenantChange) {
    throw new Error('Unauthorized')
  }

  if (!signature.signer_email) {
    throw new Error('No email address for this signer')
  }

  // Get property details
  const { data: tenancy } = await supabase
    .from('tenancies')
    .select(`
      properties(postcode, address_line1_encrypted)
    `)
    .eq('id', tenantChange.tenancy_id)
    .single()

  const { data: company } = await supabase
    .from('companies')
    .select('name_encrypted, email_encrypted, phone_encrypted, reference_notification_email, logo_url')
    .eq('id', companyId)
    .single()

  const companyName = company?.name_encrypted ? decrypt(company.name_encrypted) : 'PropertyGoose'
  const companyEmail = company?.reference_notification_email || (company?.email_encrypted ? decrypt(company.email_encrypted) : null)
  const companyPhone = company?.phone_encrypted ? decrypt(company.phone_encrypted) : null

  const tenancyProperties = tenancy?.properties as { address_line1_encrypted?: string; postcode?: string } | null
  const propertyAddress = [
    decrypt(tenancyProperties?.address_line1_encrypted || null),
    tenancyProperties?.postcode
  ].filter(Boolean).join(', ')

  const signingUrl = `${getFrontendUrl()}/sign-tenant-change/${signature.signing_token}`

  const html = loadEmailTemplate('tenant-change-addendum-reminder', {
    SignerName: signature.signer_name,
    PropertyAddress: propertyAddress,
    SignerType: formatSignerType(signature.signer_type),
    SigningUrl: signingUrl,
    ExpiryDate: new Date(signature.token_expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    CompanyName: companyName || 'PropertyGoose',
    AgentLogoUrl: company?.logo_url || 'https://app.propertygoose.co.uk/PropertyGooseLogo.png'
  })

  await sendEmail({
    to: signature.signer_email,
    subject: `Reminder: Please Sign Change of Tenant Addendum - ${propertyAddress}`,
    html,
    contactDetails: {
      companyName: companyName || undefined,
      email: companyEmail || undefined,
      phone: companyPhone || undefined
    },
    tenancyId: tenantChange.tenancy_id,
    companyId: tenantChange.company_id,
    emailCategory: 'tenant_change_addendum_reminder'
  })

  // Update signature
  await supabase
    .from('tenant_change_signatures')
    .update({
      last_email_sent_at: new Date().toISOString(),
      email_send_count: (signature.email_send_count || 0) + 1
    })
    .eq('id', signatureId)

  // Log event
  await supabase
    .from('tenant_change_signature_events')
    .insert({
      signature_id: signatureId,
      tenant_change_id: signature.tenant_change_id,
      event_type: 'reminder_sent'
    })
}

// ============================================================================
// STAGE 6: COMPLETION
// ============================================================================

/**
 * Complete the tenant change
 */
export async function completeChangeover(
  tenantChangeId: string,
  companyId: string,
  userId: string
): Promise<TenantChange> {
  const tenantChange = await getTenantChange(tenantChangeId, companyId)
  if (!tenantChange) {
    throw new Error('Tenant change not found')
  }

  // Verify all signatures are complete
  const signingStatus = await getSigningStatus(tenantChangeId, companyId)
  if (!signingStatus.allSigned) {
    throw new Error('Not all parties have signed the addendum')
  }

  // 1. Archive outgoing tenants (mark as removed)
  for (const tenantId of tenantChange.outgoing_tenant_ids) {
    await supabase
      .from('tenancy_tenants')
      .update({
        is_active: false,
        status: 'removed',
        left_date: tenantChange.changeover_date
      })
      .eq('id', tenantId)
  }

  // 2. Add incoming tenants
  // Get next tenant order
  const { data: existingTenants } = await supabase
    .from('tenancy_tenants')
    .select('tenant_order')
    .eq('tenancy_id', tenantChange.tenancy_id)
    .eq('is_active', true)
    .order('tenant_order', { ascending: false })
    .limit(1)

  let nextOrder = (existingTenants?.[0]?.tenant_order || 0) + 1

  for (const tenant of tenantChange.incoming_tenants) {
    const fullName = `${tenant.firstName} ${tenant.lastName}`.trim()

    await supabase
      .from('tenancy_tenants')
      .insert({
        tenancy_id: tenantChange.tenancy_id,
        tenant_name_encrypted: encrypt(fullName),
        tenant_email_encrypted: tenant.email ? encrypt(tenant.email) : null,
        tenant_phone_encrypted: tenant.phone ? encrypt(tenant.phone) : null,
        tenant_order: nextOrder++,
        is_active: true
      })

    // Add guarantor if present
    if (tenant.hasGuarantor && tenant.guarantor) {
      const guarantorName = `${tenant.guarantor.firstName} ${tenant.guarantor.lastName}`.trim()

      await supabase
        .from('tenancy_guarantors')
        .insert({
          tenancy_id: tenantChange.tenancy_id,
          guarantor_name_encrypted: encrypt(guarantorName),
          guarantor_email_encrypted: tenant.guarantor.email ? encrypt(tenant.guarantor.email) : null,
          guarantor_phone_encrypted: tenant.guarantor.phone ? encrypt(tenant.guarantor.phone) : null,
          is_active: true
        })
    }
  }

  // 3. Update tenant change status
  const { data, error } = await supabase
    .from('tenant_changes')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by: userId,
      stage: 7,
      updated_at: new Date().toISOString()
    })
    .eq('id', tenantChangeId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to complete changeover: ${error.message}`)
  }

  // Log activity
  await logTenancyActivity(tenantChange.tenancy_id, {
    action: 'TENANT_CHANGE_COMPLETED',
    category: 'tenant_change',
    title: 'Change of Tenant Completed',
    description: `Tenant change completed. ${tenantChange.outgoing_tenant_ids.length} tenant(s) removed, ${tenantChange.incoming_tenants.length} tenant(s) added.`,
    metadata: {
      tenant_change_id: tenantChangeId,
      outgoing_count: tenantChange.outgoing_tenant_ids.length,
      incoming_count: tenantChange.incoming_tenants.length,
      changeover_date: tenantChange.changeover_date
    },
    performedBy: userId
  })

  return formatTenantChange(data)
}

// ============================================================================
// STAGE 7: POST-COMPLETION CHECKLIST
// ============================================================================

/**
 * Update post-completion checklist
 */
export async function updateChecklist(
  tenantChangeId: string,
  companyId: string,
  updates: ChecklistUpdate,
  userId: string
): Promise<TenantChange> {
  const tenantChange = await getTenantChange(tenantChangeId, companyId)
  if (!tenantChange) {
    throw new Error('Tenant change not found')
  }

  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString()
  }

  if (updates.deposit_updated !== undefined) {
    updateData.checklist_deposit_updated = updates.deposit_updated
    if (updates.deposit_updated) {
      updateData.checklist_deposit_updated_at = new Date().toISOString()
    }
  }

  if (updates.prescribed_info_sent !== undefined) {
    updateData.checklist_prescribed_info_sent = updates.prescribed_info_sent
    if (updates.prescribed_info_sent) {
      updateData.checklist_prescribed_info_sent_at = new Date().toISOString()
    }
  }

  if (updates.deposit_share_confirmed !== undefined) {
    updateData.checklist_deposit_share_confirmed = updates.deposit_share_confirmed
    if (updates.deposit_share_confirmed) {
      updateData.checklist_deposit_share_confirmed_at = new Date().toISOString()
    }
  }

  const { data, error } = await supabase
    .from('tenant_changes')
    .update(updateData)
    .eq('id', tenantChangeId)
    .eq('company_id', companyId)
    .select()

  if (error) {
    throw new Error(`Failed to update checklist: ${error.message}`)
  }

  if (!data || data.length === 0) {
    throw new Error('Tenant change not found or update failed')
  }

  return formatTenantChange(data[0])
}

// ============================================================================
// FINALIZE (Stage 7 Completion)
// ============================================================================

/**
 * Finalize tenant change after checklist completion
 * 1. Verifies all checklist items are complete
 * 2. Uploads signed addendum to documents
 * 3. Sends signed addendum PDF to all signers
 * 4. Updates tenants (archive old, add new)
 * 5. Marks as completed
 */
export async function finalizeTenantChange(
  tenantChangeId: string,
  companyId: string,
  userId: string
): Promise<TenantChange> {
  const tenantChange = await getTenantChange(tenantChangeId, companyId)
  if (!tenantChange) {
    throw new Error('Tenant change not found')
  }

  // Verify all checklist items are complete
  if (!tenantChange.checklist_deposit_updated ||
      !tenantChange.checklist_prescribed_info_sent ||
      !tenantChange.checklist_deposit_share_confirmed) {
    throw new Error('Please complete all checklist items before finalizing')
  }

  // Verify all signatures are complete
  const signingStatus = await getSigningStatus(tenantChangeId, companyId)
  if (!signingStatus.allSigned) {
    throw new Error('Not all parties have signed the addendum')
  }

  // Get or generate the signed addendum PDF
  let signedPdfUrl = tenantChange.signed_addendum_pdf_url
  let storagePath: string | null = null
  let pdfSize: number | null = null

  // Generate signed PDF if it doesn't exist yet
  if (!signedPdfUrl) {
    try {
      console.log('[finalizeTenantChange] Generating signed addendum PDF...')
      const pdfResult = await generateAndStoreSignedAddendum(tenantChangeId, companyId)
      signedPdfUrl = pdfResult.signedUrl
      storagePath = pdfResult.storagePath
      pdfSize = pdfResult.pdfSize
    } catch (pdfError) {
      console.error('[finalizeTenantChange] Failed to generate signed PDF:', pdfError)
      // Don't fail the whole process if PDF generation fails
    }
  }

  // 1. Upload signed addendum to property documents
  if (signedPdfUrl) {
    try {
      const { data: tenancy } = await supabase
        .from('tenancies')
        .select('property_id')
        .eq('id', tenantChange.tenancy_id)
        .single()

      if (tenancy?.property_id) {
        const fileName = `tenant-change-addendum-${tenantChangeId.substring(0, 8)}.pdf`

        // If we don't have the storage path, try to extract it from the signed URL
        // Format: https://xxx.supabase.co/storage/v1/object/sign/property-documents/path/to/file.pdf?token=xxx
        if (!storagePath && signedPdfUrl.includes('/property-documents/')) {
          const match = signedPdfUrl.match(/\/property-documents\/([^?]+)/)
          if (match) {
            storagePath = match[1]
          }
        }

        // Use storage path if available, otherwise fall back to signed URL
        const filePathToStore = storagePath || signedPdfUrl

        const { data: docRecord, error: docError } = await supabase
          .from('property_documents')
          .insert({
            property_id: tenancy.property_id,
            file_name: fileName,
            file_path: filePathToStore,
            file_size: pdfSize || null,
            file_type: 'application/pdf',
            tag: 'agreement',  // Valid tags: gas, epc, agreement, reference, inventory, insurance, rent_notice, notice, other
            source_type: 'tenancy',
            source_id: tenantChange.tenancy_id,
            description: `Change of Tenant Addendum - ${new Date().toISOString().split('T')[0]}`,
            uploaded_by: userId
          })
          .select('id')
          .single()

        if (docError) {
          console.error('[finalizeTenantChange] Failed to create document record:', docError.message, docError.details, docError.hint)
        } else {
          console.log('[finalizeTenantChange] Created document record:', docRecord?.id, 'with path:', filePathToStore)
        }
      }
    } catch (docError) {
      console.error('[finalizeTenantChange] Failed to upload addendum to documents:', docError)
      // Don't fail the whole process if document upload fails
    }
  }

  // 2. Send signed addendum (and original agreement) to all signers
  if (signedPdfUrl) {
    try {
      const { data: signatures } = await supabase
        .from('tenant_change_signatures')
        .select('signer_name, signer_email')
        .eq('tenant_change_id', tenantChangeId)
        .eq('status', 'signed')

      const { data: companyData } = await supabase
        .from('companies')
        .select('name_encrypted, logo_url')
        .eq('id', companyId)
        .single()

      const companyName = decrypt(companyData?.name_encrypted) || 'PropertyGoose'

      // Get property address
      const { data: tenancyData } = await supabase
        .from('tenancies')
        .select('properties(address_line1_encrypted, postcode)')
        .eq('id', tenantChange.tenancy_id)
        .single()

      const properties = tenancyData?.properties as { address_line1_encrypted?: string; postcode?: string } | null
      const propertyAddress = [decrypt(properties?.address_line1_encrypted || null), properties?.postcode].filter(Boolean).join(', ')

      // Download signed addendum PDF as Buffer for attachment
      let addendumBuffer: Buffer | null = null
      try {
        const addendumResponse = await fetch(signedPdfUrl)
        if (addendumResponse.ok) {
          addendumBuffer = Buffer.from(await addendumResponse.arrayBuffer())
        }
      } catch (dlErr) {
        console.error('[finalizeTenantChange] Failed to download addendum PDF for attachment:', dlErr)
      }

      // Look up and download original agreement PDF
      let originalAgreementBuffer: Buffer | null = null
      try {
        const agreementResult = await checkOriginalAgreement(tenantChangeId, companyId)
        if (agreementResult.available && agreementResult.url) {
          const agreementResponse = await fetch(agreementResult.url)
          if (agreementResponse.ok) {
            originalAgreementBuffer = Buffer.from(await agreementResponse.arrayBuffer())
          }
        }
      } catch (agErr) {
        console.error('[finalizeTenantChange] Failed to download original agreement for attachment:', agErr)
      }

      // Build attachments array
      const attachments: { filename: string; content: Buffer }[] = []
      const docRef = `COT-${tenantChangeId.substring(0, 8).toUpperCase()}`
      if (addendumBuffer) {
        attachments.push({ filename: `Change-of-Tenant-Addendum-${docRef}.pdf`, content: addendumBuffer })
      }
      if (originalAgreementBuffer) {
        attachments.push({ filename: 'Original-Tenancy-Agreement.pdf', content: originalAgreementBuffer })
      }

      if (signatures && signatures.length > 0) {
        for (const sig of signatures) {
          if (sig.signer_email) {
            try {
              const html = loadEmailTemplate('tenant-change-addendum-complete', {
                SignerName: sig.signer_name,
                PropertyAddress: propertyAddress,
                AddendumUrl: signedPdfUrl,
                CompanyName: companyName,
                AgentLogoUrl: companyData?.logo_url || 'https://app.propertygoose.co.uk/PropertyGooseLogo.png'
              })

              await sendEmail({
                to: sig.signer_email,
                subject: `Signed Addendum - Change of Tenant at ${propertyAddress}`,
                html,
                attachments: attachments.length > 0 ? attachments : undefined,
                tenancyId: tenantChange.tenancy_id,
                companyId: tenantChange.company_id,
                emailCategory: 'tenant_change_addendum_complete'
              })

              console.log(`[finalizeTenantChange] Sent signed addendum to ${sig.signer_email}`)
            } catch (emailError) {
              console.error(`[finalizeTenantChange] Failed to send addendum to ${sig.signer_email}:`, emailError)
            }
          }
        }
      }

      // Push to Apex27 if configured
      try {
        const { data: tenancyForApex } = await supabase
          .from('tenancies')
          .select('property_id')
          .eq('id', tenantChange.tenancy_id)
          .single()

        if (tenancyForApex?.property_id) {
          const { data: property } = await supabase
            .from('properties')
            .select('apex27_listing_id')
            .eq('id', tenancyForApex.property_id)
            .single()

          if (property?.apex27_listing_id) {
            const { data: integration } = await supabase
              .from('company_integrations')
              .select('apex27_api_key_encrypted')
              .eq('company_id', companyId)
              .single()

            if (integration?.apex27_api_key_encrypted) {
              const apiKey = decrypt(integration.apex27_api_key_encrypted)
              if (apiKey) {
                const { pushDocument } = await import('./apex27Service')
                const pushResult = await pushDocument(apiKey, {
                  listingId: property.apex27_listing_id,
                  name: `Change of Tenant Addendum - ${docRef}`,
                  url: signedPdfUrl
                })

                if (pushResult.success) {
                  console.log(`[finalizeTenantChange] Pushed addendum to Apex27 for listing ${property.apex27_listing_id}`)

                  // Log to apex27_document_pushes
                  await supabase
                    .from('apex27_document_pushes')
                    .insert({
                      company_id: companyId,
                      listing_id: property.apex27_listing_id,
                      document_name: `Change of Tenant Addendum - ${docRef}`,
                      document_url: signedPdfUrl,
                      push_status: 'success'
                    })
                } else {
                  console.error(`[finalizeTenantChange] Apex27 push failed:`, pushResult.error)
                  await supabase
                    .from('apex27_document_pushes')
                    .insert({
                      company_id: companyId,
                      listing_id: property.apex27_listing_id,
                      document_name: `Change of Tenant Addendum - ${docRef}`,
                      document_url: signedPdfUrl,
                      push_status: 'failed',
                      error_message: pushResult.error
                    })
                }
              }
            }
          }
        }
      } catch (apex27Error) {
        console.error('[finalizeTenantChange] Apex27 push error:', apex27Error)
      }
    } catch (sendError) {
      console.error('[finalizeTenantChange] Failed to send signed addendum:', sendError)
      // Don't fail the whole process if email sending fails
    }
  }

  // Check if changeover date is today or in the past
  const changeoverDate = tenantChange.changeover_date ? new Date(tenantChange.changeover_date) : new Date()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  changeoverDate.setHours(0, 0, 0, 0)
  const isChangeoverDue = changeoverDate <= today

  console.log(`[finalizeTenantChange] Changeover date: ${tenantChange.changeover_date}, isChangeoverDue: ${isChangeoverDue}`)

  // 3. Archive outgoing tenants (only if changeover date is today or past)
  if (isChangeoverDue) {
    console.log(`[finalizeTenantChange] Archiving ${tenantChange.outgoing_tenant_ids.length} outgoing tenant(s):`, tenantChange.outgoing_tenant_ids)
    for (const tenantId of tenantChange.outgoing_tenant_ids) {
      const { error: archiveError, data: archiveData } = await supabase
        .from('tenancy_tenants')
        .update({
          is_active: false,
          status: 'removed',
          left_date: tenantChange.changeover_date
        })
        .eq('id', tenantId)
        .select()

      if (archiveError) {
        console.error(`[finalizeTenantChange] Failed to archive tenant ${tenantId}:`, archiveError)
      } else {
        console.log(`[finalizeTenantChange] Archived tenant ${tenantId}:`, archiveData)
      }
    }
  } else {
    console.log(`[finalizeTenantChange] Changeover date is in future - outgoing tenants remain active until ${tenantChange.changeover_date}`)
  }

  // 4. Add incoming tenants
  console.log(`[finalizeTenantChange] Adding ${tenantChange.incoming_tenants.length} incoming tenant(s):`, tenantChange.incoming_tenants)

  // Get next tenant order
  const { data: existingTenants } = await supabase
    .from('tenancy_tenants')
    .select('tenant_order')
    .eq('tenancy_id', tenantChange.tenancy_id)
    .eq('is_active', true)
    .order('tenant_order', { ascending: false })
    .limit(1)

  let nextOrder = (existingTenants?.[0]?.tenant_order || 0) + 1

  for (const tenant of tenantChange.incoming_tenants) {
    const fullName = `${tenant.firstName} ${tenant.lastName}`.trim()
    console.log(`[finalizeTenantChange] Inserting tenant: ${fullName}, is_active: ${isChangeoverDue}`)

    const { error: insertError, data: insertData } = await supabase
      .from('tenancy_tenants')
      .insert({
        tenancy_id: tenantChange.tenancy_id,
        tenant_name_encrypted: encrypt(fullName),
        tenant_email_encrypted: tenant.email ? encrypt(tenant.email) : null,
        tenant_phone_encrypted: tenant.phone ? encrypt(tenant.phone) : null,
        tenant_order: nextOrder++,
        is_active: isChangeoverDue, // Only active if changeover is today/past
        status: 'active' // Always 'active' - combined with is_active=false means pending tenant
      })
      .select()

    if (insertError) {
      console.error(`[finalizeTenantChange] Failed to insert tenant ${fullName}:`, insertError)
    } else {
      console.log(`[finalizeTenantChange] Inserted tenant:`, insertData)
    }

    // Add guarantor if present
    if (tenant.hasGuarantor && tenant.guarantor) {
      const guarantorName = `${tenant.guarantor.firstName} ${tenant.guarantor.lastName}`.trim()
      const { error: guarantorError } = await supabase
        .from('tenancy_guarantors')
        .insert({
          tenancy_id: tenantChange.tenancy_id,
          guarantor_name_encrypted: encrypt(guarantorName),
          guarantor_email_encrypted: tenant.guarantor.email ? encrypt(tenant.guarantor.email) : null,
          guarantor_phone_encrypted: tenant.guarantor.phone ? encrypt(tenant.guarantor.phone) : null,
          is_active: isChangeoverDue
        })

      if (guarantorError) {
        console.error(`[finalizeTenantChange] Failed to insert guarantor:`, guarantorError)
      }
    }
  }

  // 5. Update tenant change status to completed
  const { data, error } = await supabase
    .from('tenant_changes')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by: userId,
      updated_at: new Date().toISOString()
    })
    .eq('id', tenantChangeId)
    .select()

  if (error) {
    throw new Error(`Failed to complete tenant change: ${error.message}`)
  }

  if (!data || data.length === 0) {
    throw new Error('Tenant change not found during finalization')
  }

  // Log activity
  await logTenancyActivity(tenantChange.tenancy_id, {
    action: 'TENANT_CHANGE_COMPLETED',
    category: 'tenant_change',
    title: 'Change of Tenant Completed',
    description: `Tenant change finalized. ${tenantChange.outgoing_tenant_ids.length} tenant(s) archived, ${tenantChange.incoming_tenants.length} tenant(s) added.`,
    metadata: {
      tenant_change_id: tenantChangeId,
      outgoing_count: tenantChange.outgoing_tenant_ids.length,
      incoming_count: tenantChange.incoming_tenants.length,
      changeover_date: tenantChange.changeover_date,
      addendum_uploaded: !!signedPdfUrl
    },
    performedBy: userId
  })

  return formatTenantChange(data[0])
}

// ============================================================================
// ORIGINAL AGREEMENT CHECK / UPLOAD / SELECT
// ============================================================================

/**
 * Get all PDF documents for this tenancy's property (for picker)
 */
export async function getTenancyDocuments(
  tenantChangeId: string,
  companyId: string
): Promise<{ id: string; file_name: string; tag: string; description: string | null; created_at: string }[]> {
  const tenantChange = await getTenantChange(tenantChangeId, companyId)
  if (!tenantChange) {
    throw new Error('Tenant change not found')
  }

  const { data: tenancy } = await supabase
    .from('tenancies')
    .select('property_id')
    .eq('id', tenantChange.tenancy_id)
    .single()

  if (!tenancy?.property_id) {
    return []
  }

  const { data: docs } = await supabase
    .from('property_documents')
    .select('id, file_name, tag, description, created_at')
    .eq('property_id', tenancy.property_id)
    .eq('file_type', 'application/pdf')
    .order('created_at', { ascending: false })

  return docs || []
}

/**
 * Select an existing property document as the original agreement
 */
export async function selectExistingAgreement(
  tenantChangeId: string,
  companyId: string,
  documentId: string
): Promise<{ url: string }> {
  const tenantChange = await getTenantChange(tenantChangeId, companyId)
  if (!tenantChange) {
    throw new Error('Tenant change not found')
  }

  // Get the document
  const { data: doc } = await supabase
    .from('property_documents')
    .select('id, file_path, file_name, tag')
    .eq('id', documentId)
    .single()

  if (!doc) {
    throw new Error('Document not found')
  }

  // Generate a URL
  let url: string
  if (doc.file_path.startsWith('http')) {
    url = doc.file_path
  } else {
    const { data: signedUrlData } = await supabase.storage
      .from(PROPERTY_DOCS_BUCKET)
      .createSignedUrl(doc.file_path, 365 * 24 * 60 * 60)
    url = signedUrlData?.signedUrl || doc.file_path
  }

  // If the document isn't already tagged as an agreement for this tenancy, create a copy record
  if (doc.tag !== 'agreement') {
    const { data: tenancy } = await supabase
      .from('tenancies')
      .select('property_id')
      .eq('id', tenantChange.tenancy_id)
      .single()

    if (tenancy?.property_id) {
      // Check if there's already an agreement doc for this tenancy
      const { data: existing } = await supabase
        .from('property_documents')
        .select('id')
        .eq('source_type', 'tenancy')
        .eq('source_id', tenantChange.tenancy_id)
        .eq('tag', 'agreement')
        .limit(1)
        .single()

      if (!existing) {
        await supabase
          .from('property_documents')
          .insert({
            property_id: tenancy.property_id,
            file_name: doc.file_name,
            file_path: doc.file_path,
            file_type: 'application/pdf',
            tag: 'agreement',
            source_type: 'tenancy',
            source_id: tenantChange.tenancy_id,
            description: 'Original Tenancy Agreement (linked from existing document)'
          })
      }
    }
  }

  return { url }
}

/**
 * Check if an original tenancy agreement PDF is available
 */
export async function checkOriginalAgreement(
  tenantChangeId: string,
  companyId: string
): Promise<{ available: boolean; url: string | null }> {
  const tenantChange = await getTenantChange(tenantChangeId, companyId)
  if (!tenantChange) {
    throw new Error('Tenant change not found')
  }

  // Check agreements table
  const { data: agreement } = await supabase
    .from('agreements')
    .select('signed_pdf_url, pdf_url')
    .eq('tenancy_id', tenantChange.tenancy_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (agreement?.signed_pdf_url) {
    return { available: true, url: agreement.signed_pdf_url }
  }
  if (agreement?.pdf_url) {
    return { available: true, url: agreement.pdf_url }
  }

  // Check property_documents
  const { data: doc } = await supabase
    .from('property_documents')
    .select('file_path')
    .eq('source_type', 'tenancy')
    .eq('source_id', tenantChange.tenancy_id)
    .eq('tag', 'agreement')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (doc?.file_path) {
    if (doc.file_path.startsWith('http')) {
      return { available: true, url: doc.file_path }
    }
    const { data: signedUrlData } = await supabase.storage
      .from(PROPERTY_DOCS_BUCKET)
      .createSignedUrl(doc.file_path, 3600)
    return { available: true, url: signedUrlData?.signedUrl || null }
  }

  return { available: false, url: null }
}

/**
 * Upload an original agreement PDF for a tenancy
 */
export async function uploadOriginalAgreement(
  tenantChangeId: string,
  companyId: string,
  fileBuffer: Buffer,
  originalFilename: string,
  userId: string
): Promise<{ url: string }> {
  const tenantChange = await getTenantChange(tenantChangeId, companyId)
  if (!tenantChange) {
    throw new Error('Tenant change not found')
  }

  // Get tenancy property_id
  const { data: tenancy } = await supabase
    .from('tenancies')
    .select('property_id')
    .eq('id', tenantChange.tenancy_id)
    .single()

  if (!tenancy?.property_id) {
    throw new Error('Tenancy property not found')
  }

  // Upload to storage
  const fileName = `original-agreement-${tenantChange.tenancy_id.substring(0, 8)}-${Date.now()}.pdf`
  const storagePath = `${companyId}/${tenancy.property_id}/agreements/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from(PROPERTY_DOCS_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: 'application/pdf',
      upsert: true
    })

  if (uploadError) {
    throw new Error(`Failed to upload agreement: ${uploadError.message}`)
  }

  // Get signed URL
  const { data: signedUrlData } = await supabase.storage
    .from(PROPERTY_DOCS_BUCKET)
    .createSignedUrl(storagePath, 365 * 24 * 60 * 60)

  const url = signedUrlData?.signedUrl || storagePath

  // Create property_documents record
  await supabase
    .from('property_documents')
    .insert({
      property_id: tenancy.property_id,
      file_name: originalFilename || fileName,
      file_path: storagePath,
      file_size: fileBuffer.length,
      file_type: 'application/pdf',
      tag: 'agreement',
      source_type: 'tenancy',
      source_id: tenantChange.tenancy_id,
      description: 'Original Tenancy Agreement',
      uploaded_by: userId
    })

  return { url }
}

// ============================================================================
// CANCEL
// ============================================================================

/**
 * Cancel a tenant change
 */
export async function cancelTenantChange(
  tenantChangeId: string,
  companyId: string,
  reason: string,
  userId: string
): Promise<TenantChange> {
  const tenantChange = await getTenantChange(tenantChangeId, companyId)
  if (!tenantChange) {
    throw new Error('Tenant change not found')
  }

  if (tenantChange.status !== 'in_progress') {
    throw new Error('Can only cancel in-progress tenant changes')
  }

  // Cancel any associated V2 references for incoming tenants
  if (tenantChange.incoming_tenant_reference_ids && tenantChange.incoming_tenant_reference_ids.length > 0) {
    // Only cancel references that haven't already completed
    const { error: refCancelError } = await supabase
      .from('tenant_references_v2')
      .update({
        status: 'REJECTED',
        updated_at: new Date().toISOString()
      })
      .in('id', tenantChange.incoming_tenant_reference_ids)
      .in('status', ['SENT', 'COLLECTING_EVIDENCE', 'ACTION_REQUIRED'])

    if (refCancelError) {
      console.error('[cancelTenantChange] Failed to cancel V2 references:', refCancelError)
      // Don't throw - continue with cancellation even if reference cancellation fails
    } else {
      console.log(`[cancelTenantChange] Cancelled ${tenantChange.incoming_tenant_reference_ids.length} V2 reference(s)`)
    }
  }

  // Invalidate all signature tokens by expiring them immediately
  const { error: sigExpireError } = await supabase
    .from('tenant_change_signatures')
    .update({
      token_expires_at: new Date().toISOString(), // Expire immediately
      status: 'declined' // Mark as declined so no reminders sent
    })
    .eq('tenant_change_id', tenantChangeId)
    .in('status', ['pending', 'sent', 'viewed']) // Only update unsigned ones

  if (sigExpireError) {
    console.error('[cancelTenantChange] Failed to invalidate signatures:', sigExpireError)
  } else {
    console.log('[cancelTenantChange] Invalidated all pending signature tokens')
  }

  const { data, error } = await supabase
    .from('tenant_changes')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: userId,
      cancellation_reason: reason,
      updated_at: new Date().toISOString()
    })
    .eq('id', tenantChangeId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to cancel tenant change: ${error.message}`)
  }

  // Log activity
  await logTenancyActivity(tenantChange.tenancy_id, {
    action: 'TENANT_CHANGE_CANCELLED',
    category: 'tenant_change',
    title: 'Change of Tenant Cancelled',
    description: `Tenant change cancelled: ${reason}`,
    metadata: {
      tenant_change_id: tenantChangeId,
      reason
    },
    performedBy: userId
  })

  return formatTenantChange(data)
}

// ============================================================================
// HELPERS
// ============================================================================

function formatTenantChange(data: any): TenantChange {
  return {
    id: data.id,
    tenancy_id: data.tenancy_id,
    company_id: data.company_id,
    stage: data.stage,
    status: data.status,
    outgoing_tenant_ids: data.outgoing_tenant_ids || [],
    incoming_tenants: data.incoming_tenants || [],
    expected_move_out_date: data.expected_move_out_date,
    expected_move_in_date: data.expected_move_in_date,
    referencing_skipped: data.referencing_skipped || false,
    referencing_overridden: data.referencing_overridden || false,
    referencing_override_reason: data.referencing_override_reason,
    incoming_tenant_reference_ids: data.incoming_tenant_reference_ids || [],
    changeover_date: data.changeover_date,
    fee_amount: parseFloat(data.fee_amount || 50),
    fee_waived: data.fee_waived || false,
    fee_waived_reason: data.fee_waived_reason,
    fee_above_50_justification: data.fee_above_50_justification,
    fee_payable_by: data.fee_payable_by || 'outgoing',
    payment_reference: data.payment_reference,
    bank_name: data.bank_name,
    sort_code: data.sort_code,
    account_number: data.account_number,
    pro_rata_outgoing: parseFloat(data.pro_rata_outgoing || 0),
    pro_rata_incoming: parseFloat(data.pro_rata_incoming || 0),
    fee_invoice_sent_at: data.fee_invoice_sent_at,
    fee_invoice_sent_to: data.fee_invoice_sent_to,
    fee_received_at: data.fee_received_at,
    fee_received_by: data.fee_received_by,
    fee_received_amount: data.fee_received_amount ? parseFloat(data.fee_received_amount) : null,
    fee_received_notes: data.fee_received_notes,
    addendum_document_id: data.addendum_document_id,
    addendum_pdf_url: data.addendum_pdf_url,
    addendum_sent_at: data.addendum_sent_at,
    addendum_fully_signed_at: data.addendum_fully_signed_at,
    signed_addendum_pdf_url: data.signed_addendum_pdf_url,
    completed_at: data.completed_at,
    completed_by: data.completed_by,
    checklist_deposit_updated: data.checklist_deposit_updated || false,
    checklist_deposit_updated_at: data.checklist_deposit_updated_at,
    checklist_prescribed_info_sent: data.checklist_prescribed_info_sent || false,
    checklist_prescribed_info_sent_at: data.checklist_prescribed_info_sent_at,
    checklist_deposit_share_confirmed: data.checklist_deposit_share_confirmed || false,
    checklist_deposit_share_confirmed_at: data.checklist_deposit_share_confirmed_at,
    created_at: data.created_at,
    updated_at: data.updated_at,
    created_by: data.created_by,
    cancelled_at: data.cancelled_at,
    cancelled_by: data.cancelled_by,
    cancellation_reason: data.cancellation_reason
  }
}

function formatSignature(data: any): TenantChangeSignature {
  return {
    id: data.id,
    tenant_change_id: data.tenant_change_id,
    signer_type: data.signer_type,
    signer_index: data.signer_index,
    signer_name: data.signer_name,
    signer_email: data.signer_email,
    signature_data: data.signature_data,
    signature_type: data.signature_type,
    typed_name: data.typed_name,
    status: data.status,
    decline_reason: data.decline_reason,
    signing_token: data.signing_token,
    token_expires_at: data.token_expires_at,
    ip_address: data.ip_address,
    user_agent: data.user_agent,
    geolocation: data.geolocation,
    signed_at: data.signed_at,
    last_email_sent_at: data.last_email_sent_at,
    email_send_count: data.email_send_count || 0,
    created_at: data.created_at
  }
}

function formatSignerType(type: string): string {
  switch (type) {
    case 'outgoing_tenant':
      return 'Outgoing Tenant'
    case 'incoming_tenant':
      return 'Incoming Tenant'
    case 'remaining_tenant':
      return 'Remaining Tenant'
    case 'landlord_agent':
      return 'Landlord/Agent'
    default:
      return type
  }
}

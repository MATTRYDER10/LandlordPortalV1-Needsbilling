/**
 * V2 Reference Service
 *
 * Handles creation and management of V2 references.
 * Integrates with section service for verification workflow.
 */

import { supabase } from '../../config/supabase'
import { encrypt, decrypt, generateToken, hash } from '../encryption'
import {
  V2ReferenceRow,
  V2ReferenceStatus,
  CreateV2ReferenceInput
} from './types'
import { initializeSections } from './sectionServiceV2'
import { updateReferenceAffordability } from './affordabilityService'
import { logActivity } from './activityServiceV2'

// ============================================================================
// FEATURE FLAG
// ============================================================================

/**
 * Check if a company should use V2 references
 */
export async function shouldUseV2(_companyId: string): Promise<boolean> {
  // V2 is now enabled for all companies
  return true
}

/**
 * Enable V2 for a company
 */
export async function enableV2ForCompany(companyId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('companies')
      .update({ use_references_v2: true })
      .eq('id', companyId)

    if (error) {
      console.error('[ReferenceServiceV2] Error enabling V2:', error)
      return false
    }

    console.log(`[ReferenceServiceV2] V2 enabled for company ${companyId}`)
    return true
  } catch (error) {
    console.error('[ReferenceServiceV2] Error:', error)
    return false
  }
}

// ============================================================================
// REFERENCE CRUD
// ============================================================================

/**
 * Create a new V2 reference
 */
export async function createReference(
  input: CreateV2ReferenceInput
): Promise<V2ReferenceRow | null> {
  try {
    // Generate form token
    const formToken = generateToken()
    const formTokenHash = hash(formToken)

    // Get deposit info from offer if not provided directly
    let depositReplacementOffered = input.depositReplacementOffered || false
    let depositAmount = input.depositAmount || null

    if (input.offerId && !input.depositReplacementOffered) {
      // Fetch deposit info from the linked offer
      const { data: offer } = await supabase
        .from('tenant_offers')
        .select('deposit_amount, offer_deposit_replacement')
        .eq('id', input.offerId)
        .single()

      if (offer) {
        depositReplacementOffered = offer.offer_deposit_replacement || false
        depositAmount = offer.deposit_amount || null
      }
    }

    // Prepare encrypted data
    const referenceData = {
      company_id: input.companyId,
      linked_property_id: input.linkedPropertyId || null,
      property_address_encrypted: input.propertyAddress ? encrypt(input.propertyAddress) : null,
      property_city_encrypted: input.propertyCity ? encrypt(input.propertyCity) : null,
      property_postcode_encrypted: input.propertyPostcode ? encrypt(input.propertyPostcode) : null,
      monthly_rent: input.monthlyRent,
      rent_share: input.rentShare || input.monthlyRent, // Default to full rent if not specified
      move_in_date: input.moveInDate,
      term_years: input.termYears || 0,
      term_months: input.termMonths || 0,
      bills_included: input.billsIncluded || false,
      tenant_first_name_encrypted: encrypt(input.tenantFirstName),
      tenant_last_name_encrypted: encrypt(input.tenantLastName),
      tenant_email_encrypted: encrypt(input.tenantEmail),
      tenant_phone_encrypted: input.tenantPhone ? encrypt(input.tenantPhone) : null,
      tenant_dob_encrypted: input.tenantDob ? encrypt(input.tenantDob) : null,
      is_guarantor: input.isGuarantor || false,
      guarantor_for_reference_id: input.guarantorForReferenceId || null,
      parent_reference_id: input.parentReferenceId || null,
      is_group_parent: input.isGroupParent || false,
      form_token_hash: formTokenHash,
      status: 'SENT' as V2ReferenceStatus,
      created_by: input.createdBy || null,
      holding_deposit_amount: input.holdingDepositAmount || null,
      offer_id: input.offerId || null,
      deposit_replacement_offered: depositReplacementOffered,
      deposit_amount: depositAmount
    }

    const { data, error } = await supabase
      .from('tenant_references_v2')
      .insert(referenceData)
      .select()
      .single()

    if (error) {
      console.error('[ReferenceServiceV2] Error creating reference:', error)
      return null
    }

    // Initialize sections for this reference
    const sections = await initializeSections(data.id, input.isGuarantor || false)
    if (!sections) {
      console.error('[ReferenceServiceV2] Failed to initialize sections')
      // Don't fail the whole operation - sections can be created later
    }

    console.log(`[ReferenceServiceV2] Created V2 reference ${data.id} with ${sections?.length || 0} sections`)

    // Log activity
    await logActivity({
      referenceId: data.id,
      action: 'REFERENCE_CREATED',
      performedBy: input.createdBy || 'system',
      performedByType: 'agent',
      notes: `Reference created for ${input.tenantFirstName} ${input.tenantLastName}`
    })

    // Return the reference with the form token (needed for sending email)
    return {
      ...data,
      _formToken: formToken // Not stored in DB, just returned for email
    } as V2ReferenceRow & { _formToken: string }
  } catch (error) {
    console.error('[ReferenceServiceV2] Error:', error)
    return null
  }
}

/**
 * Get a V2 reference by ID
 */
export async function getReference(referenceId: string): Promise<V2ReferenceRow | null> {
  try {
    const { data, error } = await supabase
      .from('tenant_references_v2')
      .select('*')
      .eq('id', referenceId)
      .single()

    if (error) {
      console.error('[ReferenceServiceV2] Error getting reference:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('[ReferenceServiceV2] Error:', error)
    return null
  }
}

/**
 * Get a V2 reference by form token hash
 */
export async function getReferenceByFormToken(token: string): Promise<V2ReferenceRow | null> {
  try {
    const tokenHash = hash(token)
    console.log('[ReferenceServiceV2] Looking up token hash:', tokenHash.substring(0, 16) + '...')

    const { data, error } = await supabase
      .from('tenant_references_v2')
      .select('*')
      .eq('form_token_hash', tokenHash)
      .single()

    if (error) {
      console.log('[ReferenceServiceV2] Token lookup failed:', error.message)
      return null
    }

    return data
  } catch (error) {
    console.error('[ReferenceServiceV2] Error:', error)
    return null
  }
}

/**
 * Get V2 references for a company
 */
export async function getCompanyReferences(
  companyId: string,
  options?: {
    status?: V2ReferenceStatus
    limit?: number
    offset?: number
    excludeChildren?: boolean
  }
): Promise<{ references: V2ReferenceRow[]; total: number }> {
  try {
    let query = supabase
      .from('tenant_references_v2')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)

    if (options?.status) {
      query = query.eq('status', options.status)
    }

    if (options?.excludeChildren) {
      query = query.is('parent_reference_id', null)
    }

    query = query.order('created_at', { ascending: false })

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('[ReferenceServiceV2] Error getting references:', error)
      return { references: [], total: 0 }
    }

    return { references: data || [], total: count || 0 }
  } catch (error) {
    console.error('[ReferenceServiceV2] Error:', error)
    return { references: [], total: 0 }
  }
}

/**
 * Get V2 reference with decrypted fields (for display)
 */
export async function getReferenceDecrypted(referenceId: string): Promise<{
  reference: V2ReferenceRow
  tenantName: string
  tenantEmail: string
  tenantPhone: string | null
  propertyAddress: string | null
} | null> {
  const reference = await getReference(referenceId)
  if (!reference) return null

  return {
    reference,
    tenantName: `${decrypt(reference.tenant_first_name_encrypted) || ''} ${decrypt(reference.tenant_last_name_encrypted) || ''}`.trim(),
    tenantEmail: decrypt(reference.tenant_email_encrypted) || '',
    tenantPhone: decrypt(reference.tenant_phone_encrypted),
    propertyAddress: reference.property_address_encrypted
      ? `${decrypt(reference.property_address_encrypted)}, ${decrypt(reference.property_city_encrypted) || ''} ${decrypt(reference.property_postcode_encrypted) || ''}`.trim()
      : null
  }
}

// ============================================================================
// STATUS UPDATES
// ============================================================================

/**
 * Update reference status
 */
export async function updateReferenceStatus(
  referenceId: string,
  status: V2ReferenceStatus,
  options?: {
    finalDecisionNotes?: string
    finalDecisionBy?: string
  }
): Promise<boolean> {
  try {
    const now = new Date().toISOString()

    const updateData: Partial<V2ReferenceRow> = {
      status,
      updated_at: now
    }

    // Add final decision fields for terminal statuses (and INDIVIDUAL_COMPLETE as intermediate decision)
    if (['ACCEPTED', 'ACCEPTED_WITH_GUARANTOR', 'ACCEPTED_ON_CONDITION', 'REJECTED', 'INDIVIDUAL_COMPLETE'].includes(status)) {
      updateData.final_decision_at = now
      if (options?.finalDecisionNotes) {
        updateData.final_decision_notes = options.finalDecisionNotes
      }
      if (options?.finalDecisionBy) {
        updateData.final_decision_by = options.finalDecisionBy
      }
    }

    const { error } = await supabase
      .from('tenant_references_v2')
      .update(updateData)
      .eq('id', referenceId)

    if (error) {
      console.error('[ReferenceServiceV2] Error updating status:', error)
      return false
    }

    console.log(`[ReferenceServiceV2] Reference ${referenceId} status updated to ${status}`)
    return true
  } catch (error) {
    console.error('[ReferenceServiceV2] Error:', error)
    return false
  }
}

/**
 * Mark reference as form started
 */
export async function markFormStarted(referenceId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('tenant_references_v2')
      .update({
        status: 'COLLECTING_EVIDENCE',
        form_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', referenceId)
      .eq('status', 'SENT') // Only update if still SENT

    if (error) {
      console.error('[ReferenceServiceV2] Error marking form started:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('[ReferenceServiceV2] Error:', error)
    return false
  }
}

/**
 * Mark reference as form submitted
 */
export async function markFormSubmitted(referenceId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('tenant_references_v2')
      .update({
        form_submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', referenceId)

    if (error) {
      console.error('[ReferenceServiceV2] Error marking form submitted:', error)
      return false
    }

    // Update affordability after form submission
    await updateReferenceAffordability(referenceId)

    return true
  } catch (error) {
    console.error('[ReferenceServiceV2] Error:', error)
    return false
  }
}

// ============================================================================
// RENT SHARE
// ============================================================================

/**
 * Update rent share for a reference
 */
export async function updateRentShare(
  referenceId: string,
  rentShare: number
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('tenant_references_v2')
      .update({
        rent_share: rentShare,
        updated_at: new Date().toISOString()
      })
      .eq('id', referenceId)

    if (error) {
      console.error('[ReferenceServiceV2] Error updating rent share:', error)
      return false
    }

    // Recalculate affordability
    await updateReferenceAffordability(referenceId)

    return true
  } catch (error) {
    console.error('[ReferenceServiceV2] Error:', error)
    return false
  }
}

// ============================================================================
// GROUP REFERENCES
// ============================================================================

/**
 * Get all children of a group parent
 */
export async function getGroupChildren(parentReferenceId: string): Promise<V2ReferenceRow[]> {
  try {
    const { data, error } = await supabase
      .from('tenant_references_v2')
      .select('*')
      .eq('parent_reference_id', parentReferenceId)
      .order('created_at')

    if (error) {
      console.error('[ReferenceServiceV2] Error getting children:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('[ReferenceServiceV2] Error:', error)
    return []
  }
}

/**
 * Get guarantor for a reference
 */
export async function getGuarantor(referenceId: string): Promise<V2ReferenceRow | null> {
  try {
    const { data, error } = await supabase
      .from('tenant_references_v2')
      .select('*')
      .eq('guarantor_for_reference_id', referenceId)
      .eq('is_guarantor', true)
      .single()

    if (error) {
      return null
    }

    return data
  } catch (error) {
    console.error('[ReferenceServiceV2] Error:', error)
    return null
  }
}

// ============================================================================
// FIELD EDITING
// ============================================================================

// Fields that can be edited by agents/staff
const EDITABLE_FIELDS: Record<string, { column: string; isEncrypted: boolean; isRefereeField: boolean; formDataPath?: string }> = {
  tenant_first_name: { column: 'tenant_first_name_encrypted', isEncrypted: true, isRefereeField: false },
  tenant_last_name: { column: 'tenant_last_name_encrypted', isEncrypted: true, isRefereeField: false },
  tenant_email: { column: 'tenant_email_encrypted', isEncrypted: true, isRefereeField: false },
  tenant_phone: { column: 'tenant_phone_encrypted', isEncrypted: true, isRefereeField: false },
  current_address_line1: { column: 'current_address_line1_encrypted', isEncrypted: true, isRefereeField: false },
  current_address_line2: { column: 'current_address_line2_encrypted', isEncrypted: true, isRefereeField: false },
  current_city: { column: 'current_city_encrypted', isEncrypted: true, isRefereeField: false },
  current_postcode: { column: 'current_postcode_encrypted', isEncrypted: true, isRefereeField: false },
  employer_ref_name: { column: 'employer_ref_name_encrypted', isEncrypted: true, isRefereeField: true, formDataPath: 'income.employerRefName' },
  employer_ref_email: { column: 'employer_ref_email_encrypted', isEncrypted: true, isRefereeField: true, formDataPath: 'income.employerRefEmail' },
  employer_ref_phone: { column: 'employer_ref_phone_encrypted', isEncrypted: true, isRefereeField: true, formDataPath: 'income.employerRefPhone' },
  previous_landlord_name: { column: 'previous_landlord_name_encrypted', isEncrypted: true, isRefereeField: true, formDataPath: 'residential.currentLandlordName' },
  previous_landlord_email: { column: 'previous_landlord_email_encrypted', isEncrypted: true, isRefereeField: true, formDataPath: 'residential.currentLandlordEmail' },
  previous_landlord_phone: { column: 'previous_landlord_phone_encrypted', isEncrypted: true, isRefereeField: true, formDataPath: 'residential.currentLandlordPhone' },
  accountant_name: { column: 'accountant_name_encrypted', isEncrypted: true, isRefereeField: true, formDataPath: 'income.accountantName' },
  accountant_email: { column: 'accountant_email_encrypted', isEncrypted: true, isRefereeField: true, formDataPath: 'income.accountantEmail' },
  accountant_phone: { column: 'accountant_phone_encrypted', isEncrypted: true, isRefereeField: true, formDataPath: 'income.accountantPhone' },
  move_in_date: { column: 'move_in_date', isEncrypted: false, isRefereeField: false },
  monthly_rent: { column: 'monthly_rent', isEncrypted: false, isRefereeField: false },
  rent_share: { column: 'rent_share', isEncrypted: false, isRefereeField: false },
}

/**
 * Edit a field on a reference with audit logging
 */
export async function editReferenceField(
  referenceId: string,
  field: string,
  value: string,
  performedBy: string,
  performedByType: string
): Promise<{ success: boolean; isRefereeField: boolean; error?: string }> {
  try {
    const fieldConfig = EDITABLE_FIELDS[field]
    if (!fieldConfig) {
      return { success: false, isRefereeField: false, error: `Field '${field}' is not editable` }
    }

    const reference = await getReference(referenceId)
    if (!reference) {
      return { success: false, isRefereeField: false, error: 'Reference not found' }
    }

    // Get old value for audit log
    const oldValue = fieldConfig.isEncrypted
      ? decrypt((reference as any)[fieldConfig.column]) || ''
      : (reference as any)[fieldConfig.column] || ''

    // Update the main column
    const updateData: Record<string, any> = {
      [fieldConfig.column]: fieldConfig.isEncrypted ? encrypt(value) : value,
      updated_at: new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .from('tenant_references_v2')
      .update(updateData)
      .eq('id', referenceId)

    if (updateError) {
      console.error('[ReferenceServiceV2] Error updating field:', updateError)
      return { success: false, isRefereeField: false, error: updateError.message }
    }

    // Update form_data if this field has a formDataPath
    if (fieldConfig.formDataPath) {
      const formData = { ...(reference.form_data || {}) } as Record<string, any>
      const [section, key] = fieldConfig.formDataPath.split('.')
      if (!formData[section]) formData[section] = {}
      formData[section][key] = value

      await supabase
        .from('tenant_references_v2')
        .update({ form_data: formData })
        .eq('id', referenceId)
    }

    // Update matching referees_v2 record if this is a referee field
    if (fieldConfig.isRefereeField) {
      await updateRefereeRecord(referenceId, field, value)
    }

    // Log the activity
    await logActivity({
      referenceId,
      action: 'FIELD_EDITED',
      fieldName: field,
      oldValue,
      newValue: value,
      performedBy,
      performedByType
    })

    console.log(`[ReferenceServiceV2] Field '${field}' updated on reference ${referenceId}`)
    return { success: true, isRefereeField: fieldConfig.isRefereeField }
  } catch (error) {
    console.error('[ReferenceServiceV2] Error editing field:', error)
    return { success: false, isRefereeField: false, error: 'Internal error' }
  }
}

/**
 * Update matching referee record when referee details change
 */
async function updateRefereeRecord(referenceId: string, field: string, value: string): Promise<void> {
  try {
    let refereeType: string | null = null
    let updateColumn: string | null = null

    if (field.startsWith('employer_ref_')) {
      refereeType = 'EMPLOYER'
      if (field === 'employer_ref_name') updateColumn = 'referee_name_encrypted'
      else if (field === 'employer_ref_email') updateColumn = 'referee_email_encrypted'
      else if (field === 'employer_ref_phone') updateColumn = 'referee_phone_encrypted'
    } else if (field.startsWith('previous_landlord_')) {
      refereeType = 'LANDLORD'
      if (field === 'previous_landlord_name') updateColumn = 'referee_name_encrypted'
      else if (field === 'previous_landlord_email') updateColumn = 'referee_email_encrypted'
      else if (field === 'previous_landlord_phone') updateColumn = 'referee_phone_encrypted'
    } else if (field.startsWith('accountant_')) {
      refereeType = 'ACCOUNTANT'
      if (field === 'accountant_name') updateColumn = 'referee_name_encrypted'
      else if (field === 'accountant_email') updateColumn = 'referee_email_encrypted'
      else if (field === 'accountant_phone') updateColumn = 'referee_phone_encrypted'
    }

    if (!refereeType || !updateColumn) return

    const { data: referee } = await supabase
      .from('referees_v2')
      .select('id')
      .eq('reference_id', referenceId)
      .eq('referee_type', refereeType)
      .maybeSingle()

    if (referee) {
      await supabase
        .from('referees_v2')
        .update({
          [updateColumn]: encrypt(value),
          updated_at: new Date().toISOString()
        })
        .eq('id', referee.id)
    }

    // Also update the section's referee fields if they exist
    const sectionTypeMap: Record<string, string> = {
      EMPLOYER: 'INCOME',
      LANDLORD: 'RESIDENTIAL',
      ACCOUNTANT: 'INCOME'
    }
    const sectionType = sectionTypeMap[refereeType]
    if (sectionType && updateColumn) {
      await supabase
        .from('reference_sections_v2')
        .update({
          [updateColumn]: encrypt(value),
          updated_at: new Date().toISOString()
        })
        .eq('reference_id', referenceId)
        .eq('section_type', sectionType)
    }
  } catch (error) {
    console.error('[ReferenceServiceV2] Error updating referee record:', error)
  }
}

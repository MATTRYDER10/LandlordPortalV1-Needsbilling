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

// ============================================================================
// FEATURE FLAG
// ============================================================================

/**
 * Check if a company should use V2 references
 */
export async function shouldUseV2(companyId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('use_references_v2')
      .eq('id', companyId)
      .single()

    if (error) {
      console.error('[ReferenceServiceV2] Error checking feature flag:', error)
      return false
    }

    return data?.use_references_v2 === true
  } catch (error) {
    console.error('[ReferenceServiceV2] Error:', error)
    return false
  }
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

    // Add final decision fields for terminal statuses
    if (['ACCEPTED', 'ACCEPTED_WITH_GUARANTOR', 'ACCEPTED_ON_CONDITION', 'REJECTED'].includes(status)) {
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

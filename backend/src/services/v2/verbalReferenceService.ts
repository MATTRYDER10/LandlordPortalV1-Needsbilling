/**
 * V2 Verbal Reference Service
 *
 * Handles recording of verbal references captured by assessors over the phone.
 * Uses the same form structure as online referee submissions.
 */

import { supabase } from '../../config/supabase'
import {
  V2VerbalReferenceRow,
  V2RefereeType,
  RecordVerbalReferenceInput
} from './types'
import { markChaseVerbalObtained } from './chaseServiceV2'

// ============================================================================
// EMPLOYER REFERENCE FORM FIELDS
// ============================================================================

export interface EmployerReferenceResponses {
  is_employed: boolean
  job_title: string
  annual_salary: number
  employment_type: 'permanent' | 'contract' | 'temporary' | 'part_time'
  start_date: string
  end_date?: string
  performance_issues: boolean
  performance_notes?: string
  would_reemploy: boolean
  additional_comments?: string
}

// ============================================================================
// LANDLORD/AGENT REFERENCE FORM FIELDS
// ============================================================================

export interface LandlordReferenceResponses {
  was_tenant: boolean
  tenancy_start_date: string
  tenancy_end_date?: string
  monthly_rent: number
  rent_paid_on_time: 'always' | 'usually' | 'sometimes' | 'rarely'
  rent_arrears: boolean
  arrears_amount?: number
  property_condition: 'excellent' | 'good' | 'fair' | 'poor'
  any_issues: boolean
  issues_description?: string
  would_rent_again: boolean
  additional_comments?: string
}

// ============================================================================
// ACCOUNTANT REFERENCE FORM FIELDS
// ============================================================================

export interface AccountantReferenceResponses {
  is_client: boolean
  client_since: string
  business_type: string
  annual_income: number
  income_stable: boolean
  financial_concerns: boolean
  concerns_description?: string
  additional_comments?: string
}

// ============================================================================
// VERBAL REFERENCE CRUD
// ============================================================================

/**
 * Record a verbal reference
 */
export async function recordVerbalReference(
  input: RecordVerbalReferenceInput
): Promise<V2VerbalReferenceRow | null> {
  try {
    const { data, error } = await supabase
      .from('verbal_references_v2')
      .insert({
        reference_id: input.referenceId,
        section_id: input.sectionId,
        chase_item_id: input.chaseItemId || null,
        referee_type: input.refereeType,
        referee_name: input.refereeName,
        referee_position: input.refereePosition || null,
        referee_phone: input.refereePhone,
        call_datetime: input.callDatetime.toISOString(),
        call_duration_minutes: input.callDurationMinutes || null,
        responses: input.responses,
        recorded_by: input.staffUserId
      })
      .select()
      .single()

    if (error) {
      console.error('[VerbalReferenceService] Error recording verbal reference:', error)
      return null
    }

    // If there's a chase item, mark it as verbal obtained
    if (input.chaseItemId) {
      await markChaseVerbalObtained(input.chaseItemId, data.id)
    }

    console.log(`[VerbalReferenceService] Recorded verbal reference ${data.id}`)
    return data
  } catch (error) {
    console.error('[VerbalReferenceService] Error:', error)
    return null
  }
}

/**
 * Get verbal reference by ID
 */
export async function getVerbalReference(verbalRefId: string): Promise<V2VerbalReferenceRow | null> {
  try {
    const { data, error } = await supabase
      .from('verbal_references_v2')
      .select('*')
      .eq('id', verbalRefId)
      .single()

    if (error) {
      return null
    }

    return data
  } catch (error) {
    console.error('[VerbalReferenceService] Error:', error)
    return null
  }
}

/**
 * Get verbal reference for a section
 */
export async function getVerbalReferenceForSection(sectionId: string): Promise<V2VerbalReferenceRow | null> {
  try {
    const { data, error } = await supabase
      .from('verbal_references_v2')
      .select('*')
      .eq('section_id', sectionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      return null
    }

    return data
  } catch (error) {
    console.error('[VerbalReferenceService] Error:', error)
    return null
  }
}

/**
 * Get all verbal references for a reference
 */
export async function getVerbalReferencesForReference(referenceId: string): Promise<V2VerbalReferenceRow[]> {
  try {
    const { data, error } = await supabase
      .from('verbal_references_v2')
      .select(`
        *,
        staff:staff_users!verbal_references_v2_recorded_by_fkey (
          full_name
        )
      `)
      .eq('reference_id', referenceId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[VerbalReferenceService] Error getting verbal references:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('[VerbalReferenceService] Error:', error)
    return []
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate employer reference responses
 */
export function validateEmployerResponses(responses: Record<string, unknown>): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (typeof responses.is_employed !== 'boolean') {
    errors.push('is_employed is required')
  }

  if (!responses.job_title || typeof responses.job_title !== 'string') {
    errors.push('job_title is required')
  }

  if (typeof responses.annual_salary !== 'number' || responses.annual_salary < 0) {
    errors.push('annual_salary must be a positive number')
  }

  if (!['permanent', 'contract', 'temporary', 'part_time'].includes(responses.employment_type as string)) {
    errors.push('employment_type must be permanent, contract, temporary, or part_time')
  }

  if (!responses.start_date) {
    errors.push('start_date is required')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Validate landlord reference responses
 */
export function validateLandlordResponses(responses: Record<string, unknown>): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (typeof responses.was_tenant !== 'boolean') {
    errors.push('was_tenant is required')
  }

  if (!responses.tenancy_start_date) {
    errors.push('tenancy_start_date is required')
  }

  if (typeof responses.monthly_rent !== 'number' || responses.monthly_rent < 0) {
    errors.push('monthly_rent must be a positive number')
  }

  if (!['always', 'usually', 'sometimes', 'rarely'].includes(responses.rent_paid_on_time as string)) {
    errors.push('rent_paid_on_time must be always, usually, sometimes, or rarely')
  }

  if (!['excellent', 'good', 'fair', 'poor'].includes(responses.property_condition as string)) {
    errors.push('property_condition must be excellent, good, fair, or poor')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Get empty form template for a referee type
 */
export function getFormTemplate(refereeType: V2RefereeType): Record<string, unknown> {
  switch (refereeType) {
    case 'EMPLOYER':
      return {
        is_employed: null,
        job_title: '',
        annual_salary: null,
        employment_type: null,
        start_date: '',
        end_date: '',
        performance_issues: false,
        performance_notes: '',
        would_reemploy: null,
        additional_comments: ''
      }

    case 'LANDLORD':
    case 'AGENT':
      return {
        was_tenant: null,
        tenancy_start_date: '',
        tenancy_end_date: '',
        monthly_rent: null,
        rent_paid_on_time: null,
        rent_arrears: false,
        arrears_amount: null,
        property_condition: null,
        any_issues: false,
        issues_description: '',
        would_rent_again: null,
        additional_comments: ''
      }

    case 'ACCOUNTANT':
      return {
        is_client: null,
        client_since: '',
        business_type: '',
        annual_income: null,
        income_stable: null,
        financial_concerns: false,
        concerns_description: '',
        additional_comments: ''
      }

    default:
      return {}
  }
}

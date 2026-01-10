import { supabase } from '../config/supabase'
import { logAuditAction } from './auditService'

/**
 * Verification State Service
 *
 * Manages explicit state transitions for the verification workflow.
 * Replaces derived readiness checks with deterministic state management.
 *
 * State Model:
 * - COLLECTING_EVIDENCE: Tenant/Guarantor still uploading evidence
 * - READY_FOR_REVIEW: Minimum evidence met, appears in verify queue
 * - IN_VERIFICATION: Staff has picked up item, actively reviewing
 * - ACTION_REQUIRED: Staff requested more info, tenant must upload
 * - COMPLETED: Verification passed
 * - REJECTED: Verification failed
 *
 * Key Behaviors:
 * 1. No cooldowns, no awaiting_documentation flag
 * 2. Automatic transitions on evidence upload
 * 3. Queue visibility based ONLY on state
 * 4. ACTION_REQUIRED -> upload -> auto-return to READY_FOR_REVIEW (loop)
 */

export type VerificationState =
  | 'COLLECTING_EVIDENCE'
  | 'READY_FOR_REVIEW'
  | 'IN_VERIFICATION'
  | 'ACTION_REQUIRED'
  | 'COMPLETED'
  | 'REJECTED'

export interface EvidenceCategory {
  identity: boolean
  rightToRent: boolean
  income: boolean
  residential: boolean
}

export interface EvidenceCheckResult {
  isComplete: boolean
  categories: EvidenceCategory
  missingCategories: string[]
  isGuarantor: boolean
}

/**
 * Evaluate if minimum evidence requirements are met.
 *
 * TENANTS require (ONE each):
 * - Identity: selfie_path AND id_document_path (both required)
 * - Right to Rent: is_british_citizen=true OR RTR document uploaded
 * - Income: ONE OF - employer ref, payslip, accountant ref, tax return, other_proof_of_funds_path
 * - Residential: ONE OF - confirmed_residential_status set, landlord ref, agent ref, tenancy_agreement_path
 *
 * GUARANTORS require ONLY:
 * - Identity: selfie_path AND id_document_path (both required)
 * - Income: Same as tenant
 * - NO Residential, NO Right to Rent
 */
export async function evaluateMinimumEvidence(referenceId: string): Promise<EvidenceCheckResult> {
  const { data: reference, error } = await supabase
    .from('tenant_references')
    .select(`
      id,
      status,
      is_guarantor,
      is_british_citizen,
      income_unemployed,
      id_document_path,
      selfie_path,
      rtr_share_code,
      rtr_alternative_document_path,
      tax_return_path,
      payslip_files,
      other_proof_of_funds_path,
      proof_of_additional_income_path,
      tenancy_agreement_path,
      confirmed_residential_status,
      reference_type,
      employer_references (id, submitted_at),
      landlord_references (id, submitted_at),
      agent_references (id, submitted_at),
      accountant_references (id, submitted_at)
    `)
    .eq('id', referenceId)
    .single()

  if (error || !reference) {
    console.error(`[VerificationState] Failed to fetch reference ${referenceId}:`, error?.message)
    return {
      isComplete: false,
      categories: { identity: false, rightToRent: false, income: false, residential: false },
      missingCategories: ['Reference not found'],
      isGuarantor: false
    }
  }

  const isGuarantor = reference.is_guarantor === true
  const missingCategories: string[] = []

  // -------------------------------------------------------------------------
  // IDENTITY: Both selfie AND ID document required
  // -------------------------------------------------------------------------
  const hasIdentity = !!(reference.selfie_path && reference.id_document_path)
  if (!hasIdentity) {
    missingCategories.push('Identity')
  }

  // -------------------------------------------------------------------------
  // RIGHT TO RENT: British citizen auto-completes, else need document
  // Guarantors skip this check entirely
  // -------------------------------------------------------------------------
  let hasRightToRent = true
  if (!isGuarantor) {
    if (reference.is_british_citizen === true) {
      hasRightToRent = true
    } else {
      // Need RTR document(s)
      hasRightToRent = !!(reference.rtr_share_code || reference.rtr_alternative_document_path)
    }
    if (!hasRightToRent) {
      missingCategories.push('Right to Rent')
    }
  }

  // -------------------------------------------------------------------------
  // INCOME: ONE of employer ref, payslip, accountant ref, tax return, other proof of funds, additional income proof
  // SPECIAL CASE: Unemployed + Living with Family = auto-pass (no income evidence required)
  // -------------------------------------------------------------------------
  const isUnemployed = reference.income_unemployed === true
  // Check both confirmed_residential_status (new field) and reference_type (legacy field)
  const isLivingWithFamily =
    reference.confirmed_residential_status === 'Living with Family' ||
    reference.reference_type === 'living_with_family'

  // Auto-pass income check for unemployed + living with family
  let hasIncome = false
  if (isUnemployed && isLivingWithFamily) {
    hasIncome = true
  } else {
    const hasEmployerRef = (reference.employer_references || []).some((er: any) => er.submitted_at)
    const hasPayslips = Array.isArray(reference.payslip_files) && reference.payslip_files.length > 0
    const hasAccountantRef = (reference.accountant_references || []).some((ar: any) => ar.submitted_at)
    const hasTaxReturn = !!reference.tax_return_path
    const hasOtherProofOfFunds = !!reference.other_proof_of_funds_path
    const hasAdditionalIncomeProof = !!reference.proof_of_additional_income_path

    hasIncome = hasEmployerRef || hasPayslips || hasAccountantRef || hasTaxReturn || hasOtherProofOfFunds || hasAdditionalIncomeProof
  }

  if (!hasIncome) {
    missingCategories.push('Income')
  }

  // -------------------------------------------------------------------------
  // RESIDENTIAL: ONE of confirmed status, living_with_family, landlord ref, agent ref, tenancy agreement
  // Guarantors skip this check entirely
  // -------------------------------------------------------------------------
  let hasResidential = true
  if (!isGuarantor) {
    const hasConfirmedStatus = !!reference.confirmed_residential_status
    const isLivingWithFamily = reference.reference_type === 'living_with_family'
    const hasLandlordRef = (reference.landlord_references || []).some((lr: any) => lr.submitted_at)
    const hasAgentRef = (reference.agent_references || []).some((ar: any) => ar.submitted_at)
    const hasTenancyAgreement = !!reference.tenancy_agreement_path

    hasResidential = hasConfirmedStatus || isLivingWithFamily || hasLandlordRef || hasAgentRef || hasTenancyAgreement
    if (!hasResidential) {
      missingCategories.push('Residential')
    }
  }

  // For guarantors, RTR and Residential are always considered complete
  const categories: EvidenceCategory = {
    identity: hasIdentity,
    rightToRent: isGuarantor ? true : hasRightToRent,
    income: hasIncome,
    residential: isGuarantor ? true : hasResidential
  }

  const isComplete = hasIdentity && hasRightToRent && hasIncome && hasResidential

  return {
    isComplete,
    categories,
    missingCategories,
    isGuarantor
  }
}

/**
 * Transition a reference to a new verification state.
 * Uses optimistic locking to handle race conditions.
 */
export async function transitionState(
  referenceId: string,
  newState: VerificationState,
  reason?: string,
  staffUserId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current state
    const { data: current, error: getError } = await supabase
      .from('tenant_references')
      .select('verification_state, updated_at')
      .eq('id', referenceId)
      .single()

    if (getError || !current) {
      return { success: false, error: 'Reference not found' }
    }

    // Idempotent: if already in target state, do nothing
    if (current.verification_state === newState) {
      console.log(`[VerificationState] Reference ${referenceId} already in state ${newState}`)
      return { success: true }
    }

    // Map verification_state to legacy status field for backwards compatibility
    // The frontend/tenancyStatusService still relies on the status field
    const legacyStatusMap: Record<VerificationState, string | null> = {
      'COLLECTING_EVIDENCE': null, // Don't change - could be pending or in_progress
      'READY_FOR_REVIEW': 'pending_verification',
      'IN_VERIFICATION': 'pending_verification',
      'ACTION_REQUIRED': 'in_progress', // Back to in_progress while tenant fixes issues
      'COMPLETED': 'completed',
      'REJECTED': 'rejected'
    }
    const legacyStatus = legacyStatusMap[newState]

    // Atomic update with timestamp for optimistic locking
    const updatePayload: Record<string, any> = {
      verification_state: newState,
      updated_at: new Date().toISOString()
    }
    if (legacyStatus) {
      updatePayload.status = legacyStatus
    }

    const { error: updateError } = await supabase
      .from('tenant_references')
      .update(updatePayload)
      .eq('id', referenceId)
      .eq('updated_at', current.updated_at)

    if (updateError) {
      // Concurrent update detected - retry once
      console.log(`[VerificationState] Concurrent update for ${referenceId}, retrying...`)
      return transitionState(referenceId, newState, reason, staffUserId)
    }

    // Log audit
    await logAuditAction({
      referenceId,
      action: 'VERIFICATION_STATE_TRANSITION',
      description: `Verification state changed to ${newState}${reason ? `: ${reason}` : ''}`,
      metadata: {
        oldState: current.verification_state,
        newState,
        reason,
        visible_to_agent: ['ACTION_REQUIRED', 'COMPLETED', 'REJECTED'].includes(newState)
      },
      userId: staffUserId
    })

    console.log(`[VerificationState] Reference ${referenceId}: ${current.verification_state} -> ${newState}`)
    return { success: true }
  } catch (error) {
    console.error(`[VerificationState] Failed to transition ${referenceId} to ${newState}:`, error)
    return { success: false, error: String(error) }
  }
}

/**
 * Ensure a VERIFY work item exists for a reference.
 * Creates a new one or reactivates an existing one.
 */
export async function ensureVerifyWorkItem(referenceId: string): Promise<{ success: boolean; workItemId?: string }> {
  try {
    // Check for existing work item
    const { data: existing } = await supabase
      .from('work_items')
      .select('id, status')
      .eq('reference_id', referenceId)
      .eq('work_type', 'VERIFY')
      .single()

    if (!existing) {
      // Create new work item
      const { data: created, error: createError } = await supabase
        .from('work_items')
        .insert({
          reference_id: referenceId,
          work_type: 'VERIFY',
          status: 'AVAILABLE',
          priority: 0
        })
        .select('id')
        .single()

      if (createError) {
        console.error(`[VerificationState] Failed to create work item for ${referenceId}:`, createError.message)
        return { success: false }
      }

      console.log(`[VerificationState] Created new VERIFY work item for ${referenceId}`)
      return { success: true, workItemId: created?.id }
    }

    // Reactivate if completed
    if (existing.status === 'COMPLETED') {
      const { error: updateError } = await supabase
        .from('work_items')
        .update({
          status: 'AVAILABLE',
          assigned_to: null,
          assigned_at: null,
          completed_at: null,
          metadata: {} // Clear any old metadata
        })
        .eq('id', existing.id)

      if (updateError) {
        console.error(`[VerificationState] Failed to reactivate work item:`, updateError.message)
        return { success: false }
      }

      console.log(`[VerificationState] Reactivated VERIFY work item for ${referenceId}`)
    }

    return { success: true, workItemId: existing.id }
  } catch (error) {
    console.error(`[VerificationState] ensureVerifyWorkItem failed:`, error)
    return { success: false }
  }
}

/**
 * Handle evidence upload - check if minimum evidence is now met and auto-transition.
 * Called after any evidence is uploaded (document, reference returned, etc.)
 *
 * Only auto-transitions from COLLECTING_EVIDENCE or ACTION_REQUIRED states.
 */
export async function handleEvidenceUpload(
  referenceId: string,
  evidenceType: string
): Promise<{ transitioned: boolean; newState?: VerificationState }> {
  try {
    // Get current state
    const { data: reference, error } = await supabase
      .from('tenant_references')
      .select('verification_state')
      .eq('id', referenceId)
      .single()

    if (error || !reference) {
      console.error(`[VerificationState] handleEvidenceUpload: Reference ${referenceId} not found`)
      return { transitioned: false }
    }

    const currentState = reference.verification_state as VerificationState | null

    // Only auto-transition from these states (null is treated as COLLECTING_EVIDENCE)
    const allowedStates: (VerificationState | null)[] = ['COLLECTING_EVIDENCE', 'ACTION_REQUIRED', null]
    if (!allowedStates.includes(currentState)) {
      console.log(`[VerificationState] Reference ${referenceId} in ${currentState}, skipping auto-transition`)
      return { transitioned: false }
    }

    // Evaluate if minimum evidence is now met
    const evidence = await evaluateMinimumEvidence(referenceId)

    if (evidence.isComplete) {
      // Transition to READY_FOR_REVIEW
      const reason = currentState === 'ACTION_REQUIRED'
        ? `Evidence uploaded after action required: ${evidenceType}`
        : `Minimum evidence requirements met: ${evidenceType} uploaded`

      await transitionState(referenceId, 'READY_FOR_REVIEW', reason)

      // Ensure work item exists
      await ensureVerifyWorkItem(referenceId)

      console.log(`[VerificationState] Reference ${referenceId} auto-transitioned to READY_FOR_REVIEW after ${evidenceType} upload`)

      return { transitioned: true, newState: 'READY_FOR_REVIEW' }
    }

    console.log(`[VerificationState] Reference ${referenceId} still missing: ${evidence.missingCategories.join(', ')}`)
    return { transitioned: false }
  } catch (error) {
    console.error(`[VerificationState] handleEvidenceUpload failed:`, error)
    return { transitioned: false }
  }
}

/**
 * Get the current verification state for a reference.
 */
export async function getVerificationState(referenceId: string): Promise<VerificationState | null> {
  const { data, error } = await supabase
    .from('tenant_references')
    .select('verification_state')
    .eq('id', referenceId)
    .single()

  if (error || !data) {
    return null
  }

  return data.verification_state as VerificationState
}

/**
 * Check if a reference should appear in the verify queue.
 * Used for quick filtering without full evidence evaluation.
 */
export function isInVerifyQueueState(state: VerificationState | null): boolean {
  return state === 'READY_FOR_REVIEW' || state === 'IN_VERIFICATION'
}

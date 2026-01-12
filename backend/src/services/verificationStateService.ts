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
 * - WAITING_ON_REFERENCES: Evidence uploaded but waiting for external references (employer/landlord)
 * - READY_FOR_REVIEW: All requirements met, appears in verify queue
 * - IN_VERIFICATION: Staff has picked up item, actively reviewing
 * - ACTION_REQUIRED: Staff requested more info, tenant must upload
 * - COMPLETED: Verification passed
 * - REJECTED: Verification failed
 * - CANCELLED: Reference cancelled by agent or tenant
 *
 * Key Behaviors:
 * 1. No cooldowns, no awaiting_documentation flag
 * 2. Automatic transitions on evidence upload
 * 3. Queue visibility based ONLY on state
 * 4. ACTION_REQUIRED -> upload -> auto-return to READY_FOR_REVIEW (loop)
 */

export type VerificationState =
  | 'COLLECTING_EVIDENCE'
  | 'WAITING_ON_REFERENCES'
  | 'READY_FOR_REVIEW'
  | 'IN_VERIFICATION'
  | 'ACTION_REQUIRED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'

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
      'WAITING_ON_REFERENCES': 'in_progress', // Still collecting data, but waiting on external parties
      'READY_FOR_REVIEW': 'pending_verification',
      'IN_VERIFICATION': 'pending_verification',
      'ACTION_REQUIRED': 'in_progress', // Back to in_progress while tenant fixes issues
      'COMPLETED': 'completed',
      'REJECTED': 'rejected',
      'CANCELLED': 'cancelled'
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
        visible_to_agent: ['ACTION_REQUIRED', 'COMPLETED', 'REJECTED', 'CANCELLED'].includes(newState)
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
 * Handle evidence upload - delegates to consolidated state machine.
 * Called after any evidence is uploaded (document, reference returned, etc.)
 *
 * @deprecated Use evaluateAndTransition() directly for new code
 */
export async function handleEvidenceUpload(
  referenceId: string,
  evidenceType: string
): Promise<{ transitioned: boolean; newState?: VerificationState }> {
  console.log(`[VerificationState] handleEvidenceUpload: ${evidenceType} uploaded for ${referenceId}`)

  // Delegate to consolidated state machine
  const result = await evaluateAndTransition(
    referenceId,
    `Evidence uploaded: ${evidenceType}`
  )

  return {
    transitioned: result.transitioned,
    newState: result.newState
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

/**
 * CONSOLIDATED STATE MACHINE - Single source of truth for state transitions
 *
 * Evaluates ALL conditions and determines the correct verification_state:
 * 1. Checks evidence completeness
 * 2. Checks external reference sections (EMPLOYER_REFERENCE, LANDLORD_REFERENCE, ACCOUNTANT_REFERENCE)
 * 3. Determines target state based on all conditions
 * 4. Performs transition if needed
 *
 * Called from:
 * - Evidence upload handlers
 * - External reference submission
 * - Staff actions that affect evidence/sections
 *
 * State Transition Rules:
 * - COLLECTING_EVIDENCE: Evidence incomplete
 * - WAITING_ON_REFERENCES: Evidence complete, but external refs pending (NOT_REVIEWED)
 * - READY_FOR_REVIEW: Everything complete, ready for staff verification
 * - Terminal states (COMPLETED, REJECTED, CANCELLED): Never auto-transition FROM these
 * - IN_VERIFICATION: Don't auto-transition (staff is working on it)
 * - ACTION_REQUIRED: Can transition back to COLLECTING_EVIDENCE or WAITING_ON_REFERENCES or READY_FOR_REVIEW
 */
export async function evaluateAndTransition(
  referenceId: string,
  reason?: string,
  staffUserId?: string
): Promise<{ success: boolean; transitioned: boolean; newState?: VerificationState; error?: string }> {
  try {
    // Get current state
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('verification_state, status')
      .eq('id', referenceId)
      .single()

    if (refError || !reference) {
      return { success: false, transitioned: false, error: 'Reference not found' }
    }

    const currentState = reference.verification_state as VerificationState | null

    // Don't auto-transition from terminal states
    const terminalStates: VerificationState[] = ['COMPLETED', 'REJECTED', 'CANCELLED']
    if (currentState && terminalStates.includes(currentState)) {
      console.log(`[VerificationState] Reference ${referenceId} in terminal state ${currentState}, skipping evaluation`)
      return { success: true, transitioned: false }
    }

    // Don't auto-transition from IN_VERIFICATION (staff is actively working)
    if (currentState === 'IN_VERIFICATION') {
      console.log(`[VerificationState] Reference ${referenceId} in IN_VERIFICATION, skipping evaluation`)
      return { success: true, transitioned: false }
    }

    // Step 1: Evaluate minimum evidence
    const evidence = await evaluateMinimumEvidence(referenceId)

    // If evidence incomplete, target state is COLLECTING_EVIDENCE
    if (!evidence.isComplete) {
      const targetState: VerificationState = 'COLLECTING_EVIDENCE'
      if (currentState !== targetState) {
        await transitionState(
          referenceId,
          targetState,
          reason || `Evidence incomplete: ${evidence.missingCategories.join(', ')}`,
          staffUserId
        )
        return { success: true, transitioned: true, newState: targetState }
      }
      return { success: true, transitioned: false }
    }

    // Step 2: Evidence complete - check for pending external references
    const { data: pendingExternalRefs, error: sectionsError } = await supabase
      .from('verification_sections')
      .select('id, section_type, decision')
      .eq('reference_id', referenceId)
      .in('section_type', ['EMPLOYER_REFERENCE', 'LANDLORD_REFERENCE', 'ACCOUNTANT_REFERENCE'])
      .eq('decision', 'NOT_REVIEWED')

    if (sectionsError) {
      console.error(`[VerificationState] Failed to check external refs for ${referenceId}:`, sectionsError.message)
      return { success: false, transitioned: false, error: 'Failed to check external references' }
    }

    const hasPendingExternalRefs = (pendingExternalRefs || []).length > 0

    // Determine target state
    let targetState: VerificationState

    if (hasPendingExternalRefs) {
      // Evidence complete but waiting on external refs
      targetState = 'WAITING_ON_REFERENCES'
    } else {
      // Everything complete - ready for staff review
      targetState = 'READY_FOR_REVIEW'
    }

    // Perform transition if state changed
    if (currentState !== targetState) {
      const transitionReason = reason || (
        targetState === 'WAITING_ON_REFERENCES'
          ? `Evidence complete, waiting on: ${pendingExternalRefs!.map(r => r.section_type).join(', ')}`
          : 'All evidence and external references received'
      )

      await transitionState(referenceId, targetState, transitionReason, staffUserId)

      // Ensure work item exists if transitioning to READY_FOR_REVIEW
      if (targetState === 'READY_FOR_REVIEW') {
        await ensureVerifyWorkItem(referenceId)
      }

      console.log(`[VerificationState] Reference ${referenceId}: ${currentState} -> ${targetState}`)
      return { success: true, transitioned: true, newState: targetState }
    }

    console.log(`[VerificationState] Reference ${referenceId} already in correct state: ${targetState}`)
    return { success: true, transitioned: false }

  } catch (error) {
    console.error(`[VerificationState] evaluateAndTransition failed for ${referenceId}:`, error)
    return { success: false, transitioned: false, error: String(error) }
  }
}

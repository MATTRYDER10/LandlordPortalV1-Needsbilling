import { supabase } from '../config/supabase'
import { encrypt, decrypt, generateToken, hash } from './encryption'
import { logAuditAction } from './auditService'
import { isReadyForVerification } from './verificationReadinessService'
import { transitionState } from './verificationStateService'
import {
  sendTenantReferenceRequest,
  sendEmployerReferenceRequest,
  sendLandlordReferenceRequest,
  sendAgentReferenceRequest,
  sendAccountantReferenceRequest,
  sendGuarantorReferenceRequest
} from './emailService'
import {
  sendTenantReferenceRequestSMS,
  sendEmployerReferenceRequestSMS,
  sendLandlordReferenceRequestSMS,
  sendAgentReferenceRequestSMS,
  sendAccountantReferenceRequestSMS,
  sendGuarantorReferenceRequestSMS
} from './smsService'
import {
  initiateCall,
  isWithinCallHours,
  isVapiConfigured
} from './vapiService'

// Chase timing constants
const CHASE_RULES = {
  CHASE_QUEUE_DELAY_HOURS: 8,   // Items appear in chase queue 8 hours after initial/last chase
  QUIET_HOURS_START: 20,        // 8 PM GMT
  QUIET_HOURS_END: 8,           // 8 AM GMT
  MAX_CYCLES: 3                 // After 3 full cycles (email + SMS each), exhausted
}

export type DependencyType = 'TENANT_FORM' | 'GUARANTOR_FORM' | 'EMPLOYER_REF' | 'RESIDENTIAL_REF' | 'ACCOUNTANT_REF'
export type DependencyStatus = 'PENDING' | 'CHASING' | 'RECEIVED' | 'EXHAUSTED' | 'ACTION_REQUIRED'

export interface ChaseDependency {
  id: string
  referenceId: string
  dependencyType: DependencyType
  status: DependencyStatus
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  initialRequestSentAt?: string
  lastChaseSentAt?: string
  nextChaseDueAt?: string
  chaseCycle: number
  emailAttempts: number
  smsAttempts: number
  callAttempts: number
  linkedTable?: string
  linkedRecordId?: string
  createdAt: string
  updatedAt: string
}

export interface ChaseQueueItem extends ChaseDependency {
  tenantName: string
  propertyAddress: string
  companyName: string
  daysSinceRequest: number
  urgency: 'NORMAL' | 'WARNING' | 'URGENT'
}

/**
 * Create dependencies for a reference based on what's missing
 */
export async function createDependenciesForReference(referenceId: string): Promise<ChaseDependency[]> {
  try {
    // Get reference details
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select(`
        *,
        employer_references (id, submitted_at),
        landlord_references (id, submitted_at),
        agent_references (id, submitted_at),
        accountant_references (id, submitted_at),
        guarantor_references (id, submitted_at)
      `)
      .eq('id', referenceId)
      .single()

    if (refError || !reference) {
      throw new Error('Reference not found')
    }

    const now = new Date().toISOString()
    const dependenciesToCreate: Array<{
      reference_id: string
      dependency_type: DependencyType
      contact_name_encrypted?: string
      contact_email_encrypted?: string
      contact_phone_encrypted?: string
      linked_table?: string
      linked_record_id?: string
      initial_request_sent_at: string
    }> = []

    // Check tenant form status (skip for guarantor references - they don't fill tenant form)
    if (reference.status === 'pending' && !reference.is_guarantor) {
      dependenciesToCreate.push({
        reference_id: referenceId,
        dependency_type: 'TENANT_FORM',
        contact_name_encrypted: reference.tenant_first_name_encrypted,
        contact_email_encrypted: reference.tenant_email_encrypted,
        contact_phone_encrypted: reference.tenant_phone_encrypted,
        initial_request_sent_at: now
      })
    }

    // Check employer reference (if employed)
    const hasEmployerRef = reference.employer_references?.some((er: any) => er.submitted_at)
    if (!hasEmployerRef && reference.employer_ref_email_encrypted) {
      dependenciesToCreate.push({
        reference_id: referenceId,
        dependency_type: 'EMPLOYER_REF',
        contact_name_encrypted: reference.employer_ref_name_encrypted,
        contact_email_encrypted: reference.employer_ref_email_encrypted,
        contact_phone_encrypted: reference.employer_ref_phone_encrypted,
        linked_table: 'employer_references',
        initial_request_sent_at: now
      })
    }

    // Check residential reference (landlord or agent)
    // Skip if confirmed_residential_status is set (e.g., living with family, owner occupier)
    // These tenants don't need a landlord/agent reference
    const hasLandlordRef = reference.landlord_references?.some((lr: any) => lr.submitted_at)
    const hasAgentRef = reference.agent_references?.some((ar: any) => ar.submitted_at)
    const hasConfirmedResidentialStatus = !!reference.confirmed_residential_status

    if (!hasLandlordRef && !hasAgentRef && !hasConfirmedResidentialStatus && reference.previous_landlord_email_encrypted) {
      dependenciesToCreate.push({
        reference_id: referenceId,
        dependency_type: 'RESIDENTIAL_REF',
        contact_name_encrypted: reference.previous_landlord_name_encrypted,
        contact_email_encrypted: reference.previous_landlord_email_encrypted,
        contact_phone_encrypted: reference.previous_landlord_phone_encrypted,
        linked_table: reference.reference_type === 'agent' ? 'agent_references' : 'landlord_references',
        initial_request_sent_at: now
      })
    }

    // Check accountant reference (if self-employed)
    const hasAccountantRef = reference.accountant_references?.some((ar: any) => ar.submitted_at)
    if (!hasAccountantRef && reference.accountant_email_encrypted) {
      dependenciesToCreate.push({
        reference_id: referenceId,
        dependency_type: 'ACCOUNTANT_REF',
        contact_name_encrypted: reference.accountant_name_encrypted,
        contact_email_encrypted: reference.accountant_email_encrypted,
        contact_phone_encrypted: reference.accountant_phone_encrypted,
        linked_table: 'accountant_references',
        initial_request_sent_at: now
      })
    }

    // Check guarantor (if required)
    // EXCEPTION: Students with guarantor contact details bypass guarantor form requirement
    // They can proceed to verification without waiting for the guarantor form
    if (reference.requires_guarantor) {
      const isStudentOnly = reference.income_student &&
                            !reference.income_regular_employment &&
                            !reference.income_self_employed &&
                            !reference.income_benefits
      const hasGuarantorContactDetails = !!(reference.guarantor_email_encrypted || reference.guarantor_first_name_encrypted)

      // Skip creating GUARANTOR_FORM dependency for student-only tenants with guarantor details
      if (isStudentOnly && hasGuarantorContactDetails) {
        // Student with guarantor - no need to chase guarantor form
        console.log(`[Chase] Skipping GUARANTOR_FORM dependency for student with guarantor: ${referenceId}`)
      } else {
        const hasGuarantorRef = reference.guarantor_references?.some((gr: any) => gr.submitted_at)
        if (!hasGuarantorRef && reference.guarantor_email_encrypted) {
          const guarantorName = `${decrypt(reference.guarantor_first_name_encrypted) || ''} ${decrypt(reference.guarantor_last_name_encrypted) || ''}`.trim()
          dependenciesToCreate.push({
            reference_id: referenceId,
            dependency_type: 'GUARANTOR_FORM',
            contact_name_encrypted: encrypt(guarantorName) ?? undefined,
            contact_email_encrypted: reference.guarantor_email_encrypted,
            contact_phone_encrypted: reference.guarantor_phone_encrypted,
            linked_table: 'guarantor_references',
            initial_request_sent_at: now
          })
        }
      }
    }

    if (dependenciesToCreate.length === 0) {
      return []
    }

    // Insert dependencies (upsert to handle existing)
    const { data: created, error: insertError } = await supabase
      .from('chase_dependencies')
      .upsert(dependenciesToCreate, { onConflict: 'reference_id,dependency_type' })
      .select()

    if (insertError) throw insertError

    return (created || []).map(mapDependencyFromDb)
  } catch (error) {
    console.error('Failed to create dependencies:', error)
    throw error
  }
}

/**
 * Get all active chase dependencies (for chase queue)
 *
 * Chase Queue Timing Logic:
 * - Items appear 8 hours after initial_request_sent_at (when form was first sent)
 * - After a chase is sent, item leaves queue and reappears 8 hours after last_chase_sent_at
 * - Items are excluded if reference is already completed, rejected, action_required, or pending_verification
 */
export async function getChaseQueue(): Promise<ChaseQueueItem[]> {
  try {
    const { data: dependencies, error } = await supabase
      .from('chase_dependencies')
      .select(`
        *,
        reference:tenant_references!chase_dependencies_reference_id_fkey (
          id,
          tenant_first_name_encrypted,
          tenant_last_name_encrypted,
          property_address_encrypted,
          status,
          company:companies!inner(name_encrypted)
        )
      `)
      .in('status', ['PENDING', 'CHASING'])
      .order('initial_request_sent_at', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) throw error

    console.log(`[ChaseQueue] Raw dependencies count: ${dependencies?.length || 0}`)

    // Calculate 8-hour threshold
    const eightHoursAgo = new Date()
    eightHoursAgo.setHours(eightHoursAgo.getHours() - CHASE_RULES.CHASE_QUEUE_DELAY_HOURS)

    console.log(`[ChaseQueue] 8 hours ago threshold: ${eightHoursAgo.toISOString()}`)

    // Filter dependencies based on:
    // 1. Reference must exist and not be in terminal/processed status
    // 2. Initial request must have been sent
    // 3. Must be 8+ hours since initial request OR last chase
    const activeDeps = (dependencies || []).filter((dep: any) => {
      if (!dep.reference) {
        console.log(`[ChaseQueue] Filtered out dep ${dep.id}: no reference`)
        return false
      }

      // Exclude references that are completed, rejected, action_required, or already in pending_verification
      const excludedStatuses = ['completed', 'rejected', 'cancelled', 'action_required', 'pending_verification']
      if (excludedStatuses.includes(dep.reference.status)) {
        console.log(`[ChaseQueue] Filtered out dep ${dep.id}: reference status is ${dep.reference.status}`)
        return false
      }

      // Must have initial request sent (form was actually sent to the referee)
      if (!dep.initial_request_sent_at) {
        console.log(`[ChaseQueue] Filtered out dep ${dep.id}: no initial_request_sent_at`)
        return false
      }

      // Check 8-hour window:
      // - If no chase sent yet -> check initial_request_sent_at > 8 hours ago
      // - If chase was sent -> check last_chase_sent_at > 8 hours ago
      const relevantTimestamp = dep.last_chase_sent_at || dep.initial_request_sent_at
      const timestampDate = new Date(relevantTimestamp)

      // Item should appear in queue only if 8+ hours have passed since relevant timestamp
      const passesTimeFilter = timestampDate <= eightHoursAgo
      if (!passesTimeFilter) {
        console.log(`[ChaseQueue] Filtered out dep ${dep.id}: timestamp ${timestampDate.toISOString()} is after ${eightHoursAgo.toISOString()}`)
      }
      return passesTimeFilter
    })

    console.log(`[ChaseQueue] Active deps after filter: ${activeDeps.length}`)

    return activeDeps.map((dep: any) => {
      const daysSinceRequest = dep.initial_request_sent_at
        ? Math.floor((Date.now() - new Date(dep.initial_request_sent_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0

      let urgency: 'NORMAL' | 'WARNING' | 'URGENT' = 'NORMAL'
      if (daysSinceRequest > 3) {
        urgency = 'URGENT'
      } else if (daysSinceRequest > 1) {
        urgency = 'WARNING'
      }

      return {
        ...mapDependencyFromDb(dep),
        tenantName: `${decrypt(dep.reference.tenant_first_name_encrypted) || ''} ${decrypt(dep.reference.tenant_last_name_encrypted) || ''}`.trim(),
        propertyAddress: decrypt(dep.reference.property_address_encrypted) || '',
        companyName: decrypt(dep.reference.company?.name_encrypted) || '',
        daysSinceRequest,
        urgency
      }
    })
  } catch (error) {
    console.error('Failed to get chase queue:', error)
    throw error
  }
}

/**
 * Get dependencies for a specific reference
 */
export async function getDependenciesForReference(referenceId: string): Promise<ChaseDependency[]> {
  try {
    const { data, error } = await supabase
      .from('chase_dependencies')
      .select('*')
      .eq('reference_id', referenceId)
      .order('created_at', { ascending: true })

    if (error) throw error

    return (data || []).map(mapDependencyFromDb)
  } catch (error) {
    console.error('Failed to get dependencies:', error)
    throw error
  }
}

/**
 * Record that a chase was sent (email, SMS, or call)
 * @param dependencyId - The dependency ID
 * @param method - 'email', 'sms', or 'call'
 * @param staffId - Staff user ID (use 'SYSTEM' for auto-chases)
 * @param actualSend - Whether to actually send the email/SMS/call (default true)
 */
export async function recordChase(
  dependencyId: string,
  method: 'email' | 'sms' | 'call',
  staffId: string,
  actualSend: boolean = true
): Promise<ChaseDependency> {
  try {
    // Get current dependency
    const { data: current, error: getError } = await supabase
      .from('chase_dependencies')
      .select('*, reference:tenant_references!chase_dependencies_reference_id_fkey(id)')
      .eq('id', dependencyId)
      .single()

    if (getError || !current) {
      throw new Error('Dependency not found')
    }

    // Actually send the chase if requested
    if (actualSend) {
      const sendResult = await sendChaseForDependency(dependencyId, method)
      if (!sendResult.sent && !sendResult.skipped) {
        throw new Error(`Failed to send ${method}: ${sendResult.reason}`)
      }
      if (sendResult.skipped) {
        console.log(`[Chase] Skipped sending ${method} for ${dependencyId}: ${sendResult.reason}`)
        // Don't throw - still record the chase attempt even if skipped
      }
    }

    // Calculate next chase time
    const now = new Date()
    const emailAttempts = method === 'email' ? current.email_attempts + 1 : current.email_attempts
    const smsAttempts = method === 'sms' ? current.sms_attempts + 1 : current.sms_attempts
    const callAttempts = method === 'call' ? (current.call_attempts || 0) + 1 : (current.call_attempts || 0)

    // Increment cycle if email, SMS, AND call sent in this cycle
    let newChaseCycle = current.chase_cycle
    if (emailAttempts > newChaseCycle && smsAttempts > newChaseCycle && callAttempts > newChaseCycle) {
      newChaseCycle++
    }

    // Check if exhausted
    let newStatus = 'CHASING'
    let nextChaseDueAt: string | null = null

    if (newChaseCycle >= CHASE_RULES.MAX_CYCLES) {
      newStatus = 'EXHAUSTED'
    } else {
      nextChaseDueAt = calculateNextChaseTime(now, newChaseCycle)?.toISOString() || null
    }

    // Update dependency
    const { data: updated, error: updateError } = await supabase
      .from('chase_dependencies')
      .update({
        status: newStatus,
        last_chase_sent_at: now.toISOString(),
        next_chase_due_at: nextChaseDueAt,
        chase_cycle: newChaseCycle,
        email_attempts: emailAttempts,
        sms_attempts: smsAttempts,
        call_attempts: callAttempts,
        initial_request_sent_at: current.initial_request_sent_at || now.toISOString()
      })
      .eq('id', dependencyId)
      .select()
      .single()

    if (updateError) throw updateError

    // Log audit
    await logAuditAction({
      referenceId: current.reference.id,
      action: 'CHASE_SENT',
      description: `${method.toUpperCase()} chase sent for ${current.dependency_type}`,
      metadata: {
        dependencyType: current.dependency_type,
        method,
        chaseCycle: newChaseCycle,
        emailAttempts,
        smsAttempts,
        callAttempts,
        actualSend
      },
      userId: staffId
    })

    return mapDependencyFromDb(updated)
  } catch (error) {
    console.error('Failed to record chase:', error)
    throw error
  }
}

/**
 * Mark a dependency as received
 * Also checks if ALL dependencies are now received and if so, moves reference to verify queue
 */
export async function markReceived(dependencyId: string, staffId: string): Promise<ChaseDependency> {
  try {
    const { data: current, error: getError } = await supabase
      .from('chase_dependencies')
      .select('*, reference:tenant_references!chase_dependencies_reference_id_fkey(id, status)')
      .eq('id', dependencyId)
      .single()

    if (getError || !current) {
      throw new Error('Dependency not found')
    }

    const { data: updated, error: updateError } = await supabase
      .from('chase_dependencies')
      .update({
        status: 'RECEIVED',
        next_chase_due_at: null
      })
      .eq('id', dependencyId)
      .select()
      .single()

    if (updateError) throw updateError

    // Log audit
    await logAuditAction({
      referenceId: current.reference.id,
      action: 'DEPENDENCY_RECEIVED',
      description: `${current.dependency_type} received`,
      metadata: {
        dependencyType: current.dependency_type
      },
      userId: staffId
    })

    // Check if ALL dependencies for this reference are now RECEIVED
    // If so, check if reference is ready for verification and auto-transition
    await checkAndTransitionToVerify(current.reference.id)

    return mapDependencyFromDb(updated)
  } catch (error) {
    console.error('Failed to mark received:', error)
    throw error
  }
}

/**
 * Auto-mark a chase dependency as received when a form is submitted
 * Called automatically when employer, landlord, agent, accountant, or guarantor forms are submitted
 */
export async function markDependencyReceivedByType(
  referenceId: string,
  dependencyType: DependencyType
): Promise<void> {
  try {
    // Find the dependency for this reference and type
    const { data: dependency, error: findError } = await supabase
      .from('chase_dependencies')
      .select('id, status')
      .eq('reference_id', referenceId)
      .eq('dependency_type', dependencyType)
      .single()

    if (findError || !dependency) {
      // No chase dependency exists for this - that's OK, might not have been created
      console.log(`[Chase] No ${dependencyType} dependency found for reference ${referenceId}`)
      return
    }

    // Only update if currently PENDING or CHASING
    if (dependency.status !== 'PENDING' && dependency.status !== 'CHASING') {
      console.log(`[Chase] ${dependencyType} dependency already ${dependency.status}`)
      return
    }

    // Update to RECEIVED
    const { error: updateError } = await supabase
      .from('chase_dependencies')
      .update({
        status: 'RECEIVED',
        next_chase_due_at: null
      })
      .eq('id', dependency.id)

    if (updateError) {
      console.error(`[Chase] Error updating ${dependencyType} to RECEIVED:`, updateError)
      return
    }

    console.log(`[Chase] Auto-marked ${dependencyType} as RECEIVED for reference ${referenceId}`)

    // Check if all dependencies received -> transition to verify
    await checkAndTransitionToVerify(referenceId)
  } catch (error) {
    console.error(`[Chase] Error in markDependencyReceivedByType:`, error)
  }
}

/**
 * Cleanup stale chase dependencies based on current reference data.
 * Call this when a reference is updated to ensure dependencies match current state.
 *
 * This handles cases where:
 * - Tenant sets confirmed_residential_status (living at home) -> RESIDENTIAL_REF not needed
 * - Student with guarantor details -> GUARANTOR_FORM not needed
 */
export async function cleanupStaleDependencies(referenceId: string): Promise<void> {
  try {
    // Get current reference data
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select(`
        confirmed_residential_status,
        income_student,
        income_regular_employment,
        income_self_employed,
        income_benefits,
        requires_guarantor,
        guarantor_email_encrypted,
        guarantor_first_name_encrypted
      `)
      .eq('id', referenceId)
      .single()

    if (refError || !reference) {
      console.log(`[Chase] Reference not found for cleanup: ${referenceId}`)
      return
    }

    // Get active dependencies
    const { data: dependencies } = await supabase
      .from('chase_dependencies')
      .select('id, dependency_type, status')
      .eq('reference_id', referenceId)
      .in('status', ['PENDING', 'CHASING', 'EXHAUSTED', 'ACTION_REQUIRED'])

    if (!dependencies || dependencies.length === 0) {
      return // No active dependencies to cleanup
    }

    const depsToReceive: string[] = []

    for (const dep of dependencies) {
      // Check RESIDENTIAL_REF - not needed if confirmed_residential_status is set
      if (dep.dependency_type === 'RESIDENTIAL_REF' && reference.confirmed_residential_status) {
        console.log(`[Chase] Cleanup: RESIDENTIAL_REF not needed - tenant has confirmed_residential_status: ${reference.confirmed_residential_status}`)
        depsToReceive.push(dep.id)
      }

      // Check GUARANTOR_FORM - not needed for student-only with guarantor details
      if (dep.dependency_type === 'GUARANTOR_FORM') {
        const isStudentOnly = reference.income_student &&
                              !reference.income_regular_employment &&
                              !reference.income_self_employed &&
                              !reference.income_benefits
        const hasGuarantorContactDetails = !!(reference.guarantor_email_encrypted || reference.guarantor_first_name_encrypted)

        if (isStudentOnly && hasGuarantorContactDetails) {
          console.log(`[Chase] Cleanup: GUARANTOR_FORM not needed - student with guarantor details`)
          depsToReceive.push(dep.id)
        }
      }
    }

    // Mark identified dependencies as RECEIVED
    if (depsToReceive.length > 0) {
      const { error: updateError } = await supabase
        .from('chase_dependencies')
        .update({
          status: 'RECEIVED',
          next_chase_due_at: null,
          metadata: {
            auto_cleanup: true,
            auto_cleanup_at: new Date().toISOString(),
            auto_cleanup_reason: 'Dependency no longer required based on reference data'
          }
        })
        .in('id', depsToReceive)

      if (updateError) {
        console.error(`[Chase] Error cleaning up dependencies:`, updateError)
        return
      }

      console.log(`[Chase] Cleaned up ${depsToReceive.length} stale dependencies for ${referenceId}`)

      // Check if reference can now transition to verify
      await checkAndTransitionToVerify(referenceId)
    }
  } catch (error) {
    console.error(`[Chase] Error in cleanupStaleDependencies:`, error)
  }
}

/**
 * Check if all dependencies are received and reference is ready for verification
 * If ready, automatically transition to pending_verification and create VERIFY work item
 */
async function checkAndTransitionToVerify(referenceId: string): Promise<boolean> {
  try {
    // Get all dependencies for this reference
    const allDeps = await getDependenciesForReference(referenceId)

    // Check if any dependencies are still pending/chasing
    const hasUnresolvedDeps = allDeps.some(dep =>
      dep.status === 'PENDING' || dep.status === 'CHASING' || dep.status === 'EXHAUSTED'
    )

    if (hasUnresolvedDeps) {
      return false // Still waiting on some dependencies
    }

    // Get current reference status
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('status')
      .eq('id', referenceId)
      .single()

    if (refError || !reference) {
      return false
    }

    // Only transition if reference is in a state that can move to verify
    const canTransitionStatuses = ['in_progress', 'action_required']
    if (!canTransitionStatuses.includes(reference.status)) {
      return false
    }

    // Check if reference is actually ready for verification
    const readiness = await isReadyForVerification(referenceId)

    if (!readiness.isReady) {
      console.log(`Reference ${referenceId} not ready for verification:`, readiness.missingItems)
      return false
    }

    // Update reference status to pending_verification
    const { error: updateError } = await supabase
      .from('tenant_references')
      .update({
        status: 'pending_verification',
        updated_at: new Date().toISOString()
      })
      .eq('id', referenceId)

    if (updateError) {
      console.error('Failed to update reference status:', updateError)
      return false
    }

    // Create VERIFY work item or reactivate if completed (uses UPSERT to prevent duplicates)
    const { data: existingVerify } = await supabase
      .from('work_items')
      .select('id, status')
      .eq('reference_id', referenceId)
      .eq('work_type', 'VERIFY')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!existingVerify) {
      // Use upsert with ON CONFLICT to prevent duplicates
      await supabase
        .from('work_items')
        .upsert({
          reference_id: referenceId,
          work_type: 'VERIFY',
          status: 'AVAILABLE',
          priority: 0
        }, {
          onConflict: 'reference_id,work_type',
          ignoreDuplicates: true
        })
    } else if (existingVerify.status === 'COMPLETED') {
      // Reactivate the completed work item instead of creating a duplicate
      await supabase
        .from('work_items')
        .update({ status: 'AVAILABLE', assigned_to: null, assigned_at: null, completed_at: null })
        .eq('id', existingVerify.id)
    }

    // Log audit
    await logAuditAction({
      referenceId,
      action: 'AUTO_MOVED_TO_VERIFY',
      description: 'All dependencies received - automatically moved to verification queue',
      metadata: { visible_to_agent: false }
    })

    console.log(`Reference ${referenceId} auto-transitioned to pending_verification`)
    // Set verification_state to READY_FOR_REVIEW so it appears in verify queue
    await transitionState(referenceId, 'READY_FOR_REVIEW', 'All dependencies received - automatically ready for verification')
    return true
  } catch (error) {
    console.error('Error in checkAndTransitionToVerify:', error)
    return false
  }
}

/**
 * Manually send to ACTION_REQUIRED
 */
export async function sendToActionRequired(
  dependencyId: string,
  staffId: string,
  reason?: string
): Promise<ChaseDependency> {
  try {
    const { data: current, error: getError } = await supabase
      .from('chase_dependencies')
      .select('*, reference:tenant_references!chase_dependencies_reference_id_fkey(id)')
      .eq('id', dependencyId)
      .single()

    if (getError || !current) {
      throw new Error('Dependency not found')
    }

    const { data: updated, error: updateError } = await supabase
      .from('chase_dependencies')
      .update({
        status: 'ACTION_REQUIRED',
        next_chase_due_at: null,
        metadata: {
          ...current.metadata,
          action_required_reason: reason,
          action_required_at: new Date().toISOString(),
          action_required_by: staffId
        }
      })
      .eq('id', dependencyId)
      .select()
      .single()

    if (updateError) throw updateError

    // Log audit with agent visibility
    await logAuditAction({
      referenceId: current.reference.id,
      action: 'CHASE_ACTION_REQUIRED',
      description: `${current.dependency_type} sent to action required${reason ? `: ${reason}` : ''}`,
      metadata: {
        dependencyType: current.dependency_type,
        reason,
        visible_to_agent: true
      },
      userId: staffId
    })

    return mapDependencyFromDb(updated)
  } catch (error) {
    console.error('Failed to send to action required:', error)
    throw error
  }
}

/**
 * Get dependencies that need automatic chasing
 */
export async function getDependenciesDueForChase(): Promise<ChaseDependency[]> {
  try {
    const now = new Date()
    const hour = now.getUTCHours()

    // Don't chase during quiet hours (20:00-08:00 GMT)
    if (hour >= CHASE_RULES.QUIET_HOURS_START || hour < CHASE_RULES.QUIET_HOURS_END) {
      return []
    }

    const { data, error } = await supabase
      .from('chase_dependencies')
      .select('*')
      .eq('status', 'CHASING')
      .lte('next_chase_due_at', now.toISOString())

    if (error) throw error

    return (data || []).map(mapDependencyFromDb)
  } catch (error) {
    console.error('Failed to get dependencies due for chase:', error)
    return []
  }
}

/**
 * Auto-exhaust dependencies and mark as ACTION_REQUIRED
 * Also updates the reference status to 'action_required' so agents can see it needs intervention
 */
export async function processExhaustedDependencies(): Promise<number> {
  try {
    const { data: exhausted, error: getError } = await supabase
      .from('chase_dependencies')
      .select('id, reference_id, dependency_type')
      .eq('status', 'EXHAUSTED')

    if (getError) throw getError

    if (!exhausted || exhausted.length === 0) return 0

    // Update all exhausted dependencies to ACTION_REQUIRED
    const { error: updateError } = await supabase
      .from('chase_dependencies')
      .update({
        status: 'ACTION_REQUIRED',
        metadata: {
          auto_action_required: true,
          auto_action_required_at: new Date().toISOString()
        }
      })
      .eq('status', 'EXHAUSTED')

    if (updateError) throw updateError

    // Group exhausted dependencies by reference_id
    const referenceIds = [...new Set(exhausted.map(d => d.reference_id))]

    // Update each affected reference to 'action_required' status
    for (const refId of referenceIds) {
      // Get reference current status
      const { data: ref } = await supabase
        .from('tenant_references')
        .select('status')
        .eq('id', refId)
        .single()

      // Only update if reference is not already in a terminal status
      const terminalStatuses = ['completed', 'rejected', 'cancelled']
      if (ref && !terminalStatuses.includes(ref.status)) {
        await supabase
          .from('tenant_references')
          .update({
            status: 'action_required',
            updated_at: new Date().toISOString()
          })
          .eq('id', refId)

        // Get all exhausted dependency types for this reference for logging
        const exhaustedTypes = exhausted
          .filter(d => d.reference_id === refId)
          .map(d => d.dependency_type)

        // Log audit with agent visibility
        await logAuditAction({
          referenceId: refId,
          action: 'CHASE_EXHAUSTED_ACTION_REQUIRED',
          description: `Chase cycles exhausted for: ${exhaustedTypes.join(', ')} - reference requires agent intervention`,
          metadata: {
            exhaustedDependencies: exhaustedTypes,
            visible_to_agent: true
          }
        })
      }
    }

    // Log audit for each individual dependency
    for (const dep of exhausted) {
      await logAuditAction({
        referenceId: dep.reference_id,
        action: 'CHASE_AUTO_ACTION_REQUIRED',
        description: `Chase exhausted for ${dep.dependency_type} - automatically sent to action required`,
        metadata: {
          dependencyId: dep.id,
          dependencyType: dep.dependency_type,
          visible_to_agent: true
        }
      })
    }

    console.log(`Processed ${exhausted.length} exhausted dependencies, updated ${referenceIds.length} references to action_required`)
    return exhausted.length
  } catch (error) {
    console.error('Failed to process exhausted dependencies:', error)
    return 0
  }
}

// --- Helper Functions ---

function calculateNextChaseTime(lastChase: Date, cycle: number): Date | null {
  if (cycle >= CHASE_RULES.MAX_CYCLES) {
    return null // Exhausted
  }

  const nextChase = new Date(lastChase)

  // Add 8-hour interval for all chases (consistent with queue appearance timing)
  nextChase.setHours(nextChase.getHours() + CHASE_RULES.CHASE_QUEUE_DELAY_HOURS)

  // Adjust for quiet hours (GMT)
  const hour = nextChase.getUTCHours()
  if (hour >= CHASE_RULES.QUIET_HOURS_START || hour < CHASE_RULES.QUIET_HOURS_END) {
    // Push to 8 AM next day
    nextChase.setUTCHours(CHASE_RULES.QUIET_HOURS_END, 0, 0, 0)
    if (hour >= CHASE_RULES.QUIET_HOURS_START) {
      nextChase.setDate(nextChase.getDate() + 1)
    }
  }

  return nextChase
}

function mapDependencyFromDb(dbDep: any): ChaseDependency {
  return {
    id: dbDep.id,
    referenceId: dbDep.reference_id,
    dependencyType: dbDep.dependency_type,
    status: dbDep.status,
    contactName: dbDep.contact_name_encrypted ? (decrypt(dbDep.contact_name_encrypted) ?? undefined) : undefined,
    contactEmail: dbDep.contact_email_encrypted ? (decrypt(dbDep.contact_email_encrypted) ?? undefined) : undefined,
    contactPhone: dbDep.contact_phone_encrypted ? (decrypt(dbDep.contact_phone_encrypted) ?? undefined) : undefined,
    initialRequestSentAt: dbDep.initial_request_sent_at,
    lastChaseSentAt: dbDep.last_chase_sent_at,
    nextChaseDueAt: dbDep.next_chase_due_at,
    chaseCycle: dbDep.chase_cycle || 0,
    emailAttempts: dbDep.email_attempts || 0,
    smsAttempts: dbDep.sms_attempts || 0,
    callAttempts: dbDep.call_attempts || 0,
    linkedTable: dbDep.linked_table,
    linkedRecordId: dbDep.linked_record_id,
    createdAt: dbDep.created_at,
    updatedAt: dbDep.updated_at
  }
}

/**
 * Send a chase email, SMS, or voice call for a dependency
 * Handles token generation and link creation based on dependency type
 */
export async function sendChaseForDependency(
  dependencyId: string,
  method: 'email' | 'sms' | 'call'
): Promise<{ sent: boolean; skipped: boolean; reason?: string }> {
  try {
    // Get dependency with reference data
    const { data: dependency, error: depError } = await supabase
      .from('chase_dependencies')
      .select(`
        *,
        reference:tenant_references!chase_dependencies_reference_id_fkey (
          id,
          status,
          tenant_first_name_encrypted,
          tenant_last_name_encrypted,
          tenant_email_encrypted,
          tenant_phone_encrypted,
          property_address_encrypted,
          employer_ref_name_encrypted,
          employer_ref_email_encrypted,
          employer_ref_phone_encrypted,
          previous_landlord_name_encrypted,
          previous_landlord_email_encrypted,
          previous_landlord_phone_encrypted,
          reference_type,
          accountant_name_encrypted,
          accountant_email_encrypted,
          accountant_phone_encrypted,
          guarantor_first_name_encrypted,
          guarantor_last_name_encrypted,
          guarantor_email_encrypted,
          guarantor_phone_encrypted,
          reference_token_hash,
          company:companies(id, name_encrypted, phone_encrypted, email_encrypted)
        )
      `)
      .eq('id', dependencyId)
      .single()

    if (depError) {
      console.error('[Chase] Error fetching dependency:', depError)
      return { sent: false, skipped: false, reason: `Database error: ${depError.message}` }
    }

    if (!dependency) {
      return { sent: false, skipped: false, reason: 'Dependency not found' }
    }

    const reference = dependency.reference
    if (!reference) {
      return { sent: false, skipped: false, reason: 'Reference not found' }
    }

    // Skip if reference is in terminal status
    const terminalStatuses = ['completed', 'rejected', 'cancelled']
    if (terminalStatuses.includes(reference.status)) {
      return { sent: false, skipped: true, reason: `Reference status is ${reference.status}` }
    }

    // Get contact info from dependency
    const contactEmail = dependency.contact_email_encrypted ? decrypt(dependency.contact_email_encrypted) : null
    const contactPhone = dependency.contact_phone_encrypted ? decrypt(dependency.contact_phone_encrypted) : null

    if (method === 'email' && !contactEmail) {
      return { sent: false, skipped: true, reason: 'No email address' }
    }
    if (method === 'sms' && !contactPhone) {
      return { sent: false, skipped: true, reason: 'No phone number' }
    }
    if (method === 'call') {
      if (!contactPhone) {
        return { sent: false, skipped: true, reason: 'No phone number' }
      }
      // Check if VAPI is configured
      const vapiConfig = isVapiConfigured()
      if (!vapiConfig.configured) {
        return { sent: false, skipped: true, reason: `VAPI not configured: ${vapiConfig.missing.join(', ')}` }
      }
      // Check call hours (stricter than email/SMS)
      if (!isWithinCallHours()) {
        return { sent: false, skipped: true, reason: 'Outside call hours (9 AM - 7 PM GMT, weekdays)' }
      }
    }

    // Get reference data
    const tenantName = `${decrypt(reference.tenant_first_name_encrypted) || ''} ${decrypt(reference.tenant_last_name_encrypted) || ''}`.trim()
    const propertyAddress = decrypt(reference.property_address_encrypted) || ''
    const companyName = reference.company?.name_encrypted ? decrypt(reference.company.name_encrypted) || '' : ''
    const companyPhone = reference.company?.phone_encrypted ? decrypt(reference.company.phone_encrypted) || '' : ''
    const companyEmail = reference.company?.email_encrypted ? decrypt(reference.company.email_encrypted) || '' : ''
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

    // For calls, we handle all dependency types the same way (generic reminder)
    if (method === 'call') {
      const contactName = dependency.contact_name_encrypted
        ? decrypt(dependency.contact_name_encrypted)
        : 'there'

      const callResult = await initiateCall({
        to: contactPhone!,
        contactName: contactName || 'there',
        tenantName,
        dependencyType: dependency.dependency_type,
        referenceId: reference.id,
        dependencyId
      })

      if (callResult.success) {
        console.log(`[Chase] CALL initiated for ${dependency.dependency_type} dependency ${dependencyId}, callId: ${callResult.callId}`)
        return { sent: true, skipped: false }
      } else {
        return { sent: false, skipped: false, reason: callResult.error || 'Call failed' }
      }
    }

    // Send email/SMS based on dependency type
    switch (dependency.dependency_type) {
      case 'TENANT_FORM': {
        // Generate new token for tenant
        const newToken = generateToken()
        const newTokenHash = hash(newToken)
        const tokenExpiresAt = new Date()
        tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 21)

        await supabase
          .from('tenant_references')
          .update({
            reference_token_hash: newTokenHash,
            token_expires_at: tokenExpiresAt.toISOString()
          })
          .eq('id', reference.id)

        const tenantUrl = `${frontendUrl}/submit-reference/${newToken}`

        if (method === 'email') {
          await sendTenantReferenceRequest(
            contactEmail!,
            tenantName,
            tenantUrl,
            companyName,
            propertyAddress,
            companyPhone || undefined,
            companyEmail || undefined,
            reference.id
          )
        } else {
          await sendTenantReferenceRequestSMS(
            contactPhone!,
            tenantName,
            tenantUrl,
            companyName,
            propertyAddress,
            reference.id
          )
        }
        break
      }

      case 'EMPLOYER_REF': {
        const employerName = decrypt(reference.employer_ref_name_encrypted) || ''

        // Get or create employer reference record for token-based URL
        let { data: employerRef } = await supabase
          .from('employer_references')
          .select('id, reference_token_hash')
          .eq('reference_id', reference.id)
          .maybeSingle()

        let employerToken: string
        if (!employerRef) {
          // Create employer_references record with token
          employerToken = generateToken()
          const employerTokenHash = hash(employerToken)

          const { data: newEmployerRef, error: insertError } = await supabase
            .from('employer_references')
            .insert({
              reference_id: reference.id,
              reference_token_hash: employerTokenHash,
              employer_name_encrypted: reference.employer_ref_name_encrypted,
              employer_email_encrypted: reference.employer_ref_email_encrypted,
              employer_phone_encrypted: reference.employer_ref_phone_encrypted,
              employer_company_encrypted: reference.employer_company_name_encrypted,
            })
            .select('id')
            .single()

          if (insertError || !newEmployerRef) {
            console.error('Failed to create employer reference:', insertError)
            return { sent: false, skipped: true, reason: 'Failed to create employer reference record' }
          }
          employerRef = { ...newEmployerRef, reference_token_hash: employerTokenHash }
        } else {
          // Generate new token for existing record
          employerToken = generateToken()
          const employerTokenHash = hash(employerToken)

          await supabase
            .from('employer_references')
            .update({ reference_token_hash: employerTokenHash })
            .eq('id', employerRef.id)
        }

        const employerUrl = `${frontendUrl}/submit-employer-reference/${employerToken}`

        if (method === 'email') {
          await sendEmployerReferenceRequest(
            contactEmail!,
            employerName,
            tenantName,
            employerUrl,
            companyName,
            companyPhone,
            companyEmail,
            reference.id
          )
        } else {
          await sendEmployerReferenceRequestSMS(
            contactPhone!,
            employerName,
            tenantName,
            employerUrl,
            reference.id
          )
        }
        break
      }

      case 'RESIDENTIAL_REF': {
        const landlordName = decrypt(reference.previous_landlord_name_encrypted) || ''
        const isAgent = reference.reference_type === 'agent' || dependency.linked_table === 'agent_references'

        if (isAgent) {
          const agentUrl = `${frontendUrl}/agent-reference/${reference.id}`
          if (method === 'email') {
            await sendAgentReferenceRequest(
              contactEmail!,
              landlordName,
              tenantName,
              agentUrl,
              companyName,
              companyPhone,
              companyEmail,
              reference.id
            )
          } else {
            await sendAgentReferenceRequestSMS(
              contactPhone!,
              landlordName,
              tenantName,
              agentUrl,
              reference.id
            )
          }
        } else {
          const landlordUrl = `${frontendUrl}/landlord-reference/${reference.id}`
          if (method === 'email') {
            await sendLandlordReferenceRequest(
              contactEmail!,
              landlordName,
              tenantName,
              landlordUrl,
              companyName,
              companyPhone,
              companyEmail,
              reference.id
            )
          } else {
            await sendLandlordReferenceRequestSMS(
              contactPhone!,
              landlordName,
              tenantName,
              landlordUrl,
              reference.id
            )
          }
        }
        break
      }

      case 'ACCOUNTANT_REF': {
        const accountantName = decrypt(reference.accountant_name_encrypted) || ''

        // Get or create accountant reference record
        const { data: accountantRef } = await supabase
          .from('accountant_references')
          .select('id, token_hash')
          .eq('tenant_reference_id', reference.id)
          .single()

        if (!accountantRef) {
          return { sent: false, skipped: true, reason: 'Accountant reference record not found' }
        }

        // Generate new token
        const accountantToken = generateToken()
        const accountantTokenHash = hash(accountantToken)

        await supabase
          .from('accountant_references')
          .update({ token_hash: accountantTokenHash })
          .eq('id', accountantRef.id)

        const accountantUrl = `${frontendUrl}/accountant-reference/${accountantToken}`

        if (method === 'email') {
          await sendAccountantReferenceRequest(
            contactEmail!,
            accountantName,
            tenantName,
            accountantUrl,
            companyName,
            companyPhone,
            companyEmail,
            accountantRef.id
          )
        } else {
          await sendAccountantReferenceRequestSMS(
            contactPhone!,
            accountantName,
            tenantName,
            accountantUrl,
            accountantRef.id
          )
        }
        break
      }

      case 'GUARANTOR_FORM': {
        const guarantorFirstName = decrypt(reference.guarantor_first_name_encrypted) || ''
        const guarantorLastName = decrypt(reference.guarantor_last_name_encrypted) || ''
        const guarantorName = `${guarantorFirstName} ${guarantorLastName}`.trim()

        // Find guarantor reference - try legacy first, then new method
        const { data: guarantorRefLegacy } = await supabase
          .from('guarantor_references')
          .select('id, reference_token_hash')
          .eq('reference_id', reference.id)
          .single()

        const { data: guarantorRefNew } = await supabase
          .from('tenant_references')
          .select('id, reference_token_hash')
          .eq('guarantor_for_reference_id', reference.id)
          .eq('is_guarantor', true)
          .single()

        if (!guarantorRefLegacy && !guarantorRefNew) {
          return { sent: false, skipped: true, reason: 'Guarantor reference record not found' }
        }

        const isLegacyGuarantor = !!guarantorRefLegacy
        const guarantorId = isLegacyGuarantor ? guarantorRefLegacy.id : guarantorRefNew!.id

        // Generate new token
        const guarantorToken = generateToken()
        const guarantorTokenHash = hash(guarantorToken)
        const tokenExpiresAt = new Date()
        tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 21)

        if (isLegacyGuarantor) {
          await supabase
            .from('guarantor_references')
            .update({
              reference_token_hash: guarantorTokenHash,
              token_expires_at: tokenExpiresAt.toISOString()
            })
            .eq('id', guarantorId)
        } else {
          await supabase
            .from('tenant_references')
            .update({
              reference_token_hash: guarantorTokenHash,
              token_expires_at: tokenExpiresAt.toISOString()
            })
            .eq('id', guarantorId)
        }

        const guarantorUrl = `${frontendUrl}/guarantor-reference/${guarantorToken}`

        if (method === 'email') {
          await sendGuarantorReferenceRequest(
            contactEmail!,
            guarantorName,
            tenantName,
            propertyAddress,
            companyName,
            companyPhone,
            companyEmail,
            guarantorUrl,
            guarantorId
          )
        } else {
          await sendGuarantorReferenceRequestSMS(
            contactPhone!,
            guarantorName,
            tenantName,
            guarantorUrl,
            guarantorId
          )
        }
        break
      }

      default:
        return { sent: false, skipped: true, reason: `Unknown dependency type: ${dependency.dependency_type}` }
    }

    console.log(`[Chase] ${method.toUpperCase()} sent for ${dependency.dependency_type} dependency ${dependencyId}`)
    return { sent: true, skipped: false }
  } catch (error: any) {
    console.error(`[Chase] Failed to send ${method} for dependency ${dependencyId}:`, error)
    return { sent: false, skipped: false, reason: error.message }
  }
}

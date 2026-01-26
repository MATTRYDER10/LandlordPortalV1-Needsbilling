import { supabase } from '../config/supabase'
import { encrypt, decrypt, generateToken, hash } from './encryption'
import { getFrontendUrl } from '../utils/frontendUrl'
import { logAuditAction } from './auditService'
import { isReadyForVerification } from './verificationReadinessService'
import { evaluateAndTransition, transitionState } from './verificationStateService'
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
  CHASE_QUEUE_DELAY_HOURS: 8,   // Items appear in chase queue 8 hours after initial/last chase (legacy)
  CHASE_INTERVAL_HOURS: 24,     // Daily chase interval (24 hours)
  CHASE_HOUR_UTC: 12,           // 12:00 GMT
  QUIET_HOURS_START: 20,        // 8 PM GMT
  QUIET_HOURS_END: 8,           // 8 AM GMT
  MAX_CYCLES: 3                 // Deprecated - no auto-exhaustion
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
  lastMarkedDoneAt?: string
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
    // Create GUARANTOR_FORM dependency if guarantor is required
    if (reference.requires_guarantor) {
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

    if (dependenciesToCreate.length === 0) {
      return []
    }

    // Insert dependencies (upsert to handle existing)
    const { data: created, error: insertError } = await supabase
      .from('chase_dependencies')
      .upsert(dependenciesToCreate, { onConflict: 'reference_id,dependency_type' })
      .select()

    if (insertError) throw insertError

    // Also create verification_sections for external reference types
    // This ensures they show in the Pending Responses queue
    const externalRefMap: Record<string, { sectionType: string; order: number }> = {
      'EMPLOYER_REF': { sectionType: 'EMPLOYER_REFERENCE', order: 1 },
      'RESIDENTIAL_REF': { sectionType: 'LANDLORD_REFERENCE', order: 2 },
      'ACCOUNTANT_REF': { sectionType: 'ACCOUNTANT_REFERENCE', order: 3 }
    }

    const sectionsToCreate = dependenciesToCreate
      .filter(dep => externalRefMap[dep.dependency_type])
      .map(dep => {
        let sectionType = externalRefMap[dep.dependency_type].sectionType
        if (dep.dependency_type === 'RESIDENTIAL_REF' && dep.linked_table === 'agent_references') {
          sectionType = 'AGENT_REFERENCE'
        }

        return {
          reference_id: dep.reference_id,
          person_type: 'TENANT',
          section_type: sectionType,
          section_order: externalRefMap[dep.dependency_type].order,
          decision: 'NOT_REVIEWED',
          contact_name_encrypted: dep.contact_name_encrypted,
          contact_email_encrypted: dep.contact_email_encrypted,
          contact_phone_encrypted: dep.contact_phone_encrypted,
          initial_request_sent_at: dep.initial_request_sent_at
        }
      })

    if (sectionsToCreate.length > 0) {
      const { error: sectionError } = await supabase
        .from('verification_sections')
        .upsert(sectionsToCreate, { onConflict: 'reference_id,section_type' })

      if (sectionError) {
        console.error('Failed to create verification sections for external refs:', sectionError)
        // Don't throw - chase_dependencies were created successfully
      } else {
        console.log(`[Chase] Created ${sectionsToCreate.length} verification_sections for external references`)
      }
    }

    return (created || []).map(mapDependencyFromDb)
  } catch (error) {
    console.error('Failed to create dependencies:', error)
    throw error
  }
}

export async function ensureExternalVerificationSections(referenceId: string): Promise<void> {
  try {
    const { data: deps, error } = await supabase
      .from('chase_dependencies')
      .select('dependency_type, contact_name_encrypted, contact_email_encrypted, contact_phone_encrypted, linked_table, initial_request_sent_at')
      .eq('reference_id', referenceId)
      .in('dependency_type', ['EMPLOYER_REF', 'RESIDENTIAL_REF', 'ACCOUNTANT_REF'])

    if (error || !deps || deps.length === 0) {
      return
    }

    const externalRefMap: Record<string, { sectionType: string; order: number }> = {
      'EMPLOYER_REF': { sectionType: 'EMPLOYER_REFERENCE', order: 1 },
      'RESIDENTIAL_REF': { sectionType: 'LANDLORD_REFERENCE', order: 2 },
      'ACCOUNTANT_REF': { sectionType: 'ACCOUNTANT_REFERENCE', order: 3 }
    }

    const sectionsToCreate = deps
      .filter(dep => externalRefMap[dep.dependency_type])
      .map(dep => {
        let sectionType = externalRefMap[dep.dependency_type].sectionType
        if (dep.dependency_type === 'RESIDENTIAL_REF' && dep.linked_table === 'agent_references') {
          sectionType = 'AGENT_REFERENCE'
        }

        return {
          reference_id: referenceId,
          person_type: 'TENANT',
          section_type: sectionType,
          section_order: externalRefMap[dep.dependency_type].order,
          decision: 'NOT_REVIEWED',
          contact_name_encrypted: dep.contact_name_encrypted,
          contact_email_encrypted: dep.contact_email_encrypted,
          contact_phone_encrypted: dep.contact_phone_encrypted,
          initial_request_sent_at: dep.initial_request_sent_at
        }
      })

    if (sectionsToCreate.length === 0) {
      return
    }

    const { error: sectionError } = await supabase
      .from('verification_sections')
      .upsert(sectionsToCreate, { onConflict: 'reference_id,section_type' })

    if (sectionError) {
      console.error('Failed to ensure verification sections for external refs:', sectionError)
    }
  } catch (error) {
    console.error('Failed to ensure external verification sections:', error)
  }
}

/**
 * Get today's 12pm UK time threshold
 * Items marked done before this time should reappear in the queue
 */
function getTodayChaseThresholdUK(): Date {
  const now = new Date()

  // Get today's date in UK timezone
  const ukDate = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now)

  const ukDay = parseInt(ukDate.find(p => p.type === 'day')?.value || '1')
  const ukMonth = parseInt(ukDate.find(p => p.type === 'month')?.value || '1') - 1
  const ukYear = parseInt(ukDate.find(p => p.type === 'year')?.value || '2024')

  // Create threshold at 12:00pm (midday) UK time today
  // We need to convert this to UTC for comparison
  // Use a workaround: create the date as if it's UTC, then adjust
  const threshold = new Date(Date.UTC(ukYear, ukMonth, ukDay, 12, 0, 0, 0))

  // Determine if UK is in BST (British Summer Time) - roughly late March to late October
  // BST is UTC+1, GMT is UTC+0
  const jan = new Date(ukYear, 0, 1)
  const jul = new Date(ukYear, 6, 1)
  const janOffset = jan.getTimezoneOffset()
  const julOffset = jul.getTimezoneOffset()
  const isDSTTimezone = Math.max(janOffset, julOffset) !== janOffset

  // Check if current date is in DST
  const stdOffset = Math.max(janOffset, julOffset)
  const isDSTNow = now.getTimezoneOffset() < stdOffset

  // Adjust threshold for BST if needed
  // 12:00pm UK during BST is 11:00am UTC
  // 12:00pm UK during GMT is 12:00pm UTC
  if (isDSTTimezone && isDSTNow) {
    threshold.setUTCHours(11) // BST: UTC+1, so 12pm UK = 11am UTC
  } else {
    threshold.setUTCHours(12) // GMT: UTC+0, so 12pm UK = 12pm UTC
  }

  return threshold
}

/**
 * Get all active chase items (for chase queue - now called "Pending Responses")
 * NOW QUERIES VERIFICATION_SECTIONS instead of chase_dependencies
 *
 * Pending Responses Queue Timing Logic:
 * - Items appear after initial_request_sent_at (when form was first sent)
 * - After staff clicks "Mark Done for Today", item is hidden until 8:55am UK next day
 * - Items are excluded if reference is completed, rejected, or in verification
 * - Email/SMS sent does NOT remove item from queue (changed from previous behavior)
 */
export async function getChaseQueue(): Promise<ChaseQueueItem[]> {
  try {
    // Query verification_sections for external references
    // Note: last_marked_done_at may not exist if migration hasn't been run yet
    const { data: sections, error } = await supabase
      .from('verification_sections')
      .select(`
        id,
        reference_id,
        section_type,
        decision,
        contact_name_encrypted,
        contact_email_encrypted,
        contact_phone_encrypted,
        initial_request_sent_at,
        last_chase_sent_at,
        chase_cycle,
        email_attempts,
        sms_attempts,
        call_attempts,
        form_url,
        linked_table,
        linked_record_id,
        chase_metadata,
        created_at,
        updated_at,
        reference:tenant_references!verification_sections_reference_id_fkey (
          id,
          tenant_first_name_encrypted,
          tenant_last_name_encrypted,
          property_address_encrypted,
          status,
          verification_state,
          company:companies!inner(name_encrypted)
        )
      `)
      .in('section_type', ['EMPLOYER_REFERENCE', 'LANDLORD_REFERENCE', 'AGENT_REFERENCE', 'ACCOUNTANT_REFERENCE'])
      .eq('decision', 'NOT_REVIEWED')
      .order('initial_request_sent_at', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) throw error

    // Try to fetch last_marked_done_at separately (may not exist yet)
    let markedDoneMap = new Map<string, string>()
    try {
      const { data: markedDoneData } = await supabase
        .from('verification_sections')
        .select('id, last_marked_done_at')
        .in('section_type', ['EMPLOYER_REFERENCE', 'LANDLORD_REFERENCE', 'AGENT_REFERENCE', 'ACCOUNTANT_REFERENCE'])
        .not('last_marked_done_at', 'is', null)

      if (markedDoneData) {
        markedDoneData.forEach((row: any) => {
          if (row.last_marked_done_at) {
            markedDoneMap.set(row.id, row.last_marked_done_at)
          }
        })
      }
    } catch (markedDoneError) {
      // Column may not exist yet - ignore and proceed without filtering
      console.log('[ChaseQueue] last_marked_done_at column may not exist yet, skipping mark-done filtering')
    }

    console.log(`[ChaseQueue] Raw sections count: ${sections?.length || 0}`)

    // Get today's 12pm UK threshold for "mark done" filtering
    const todayChaseThreshold = getTodayChaseThresholdUK()
    console.log(`[ChaseQueue] Today's 12pm UK threshold: ${todayChaseThreshold.toISOString()}`)

    // Filter sections based on:
    // 1. Reference must exist and not be in terminal/processed state
    // 2. Initial request must have been sent
    // 3. Must NOT have been "marked done" today (after today's 12pm UK threshold)
    const activeSections = (sections || []).filter((section: any) => {
      if (!section.reference) {
        console.log(`[ChaseQueue] Filtered out section ${section.id}: no reference`)
        return false
      }

      // Exclude references in terminal or verification states
      const excludedVerificationStates = ['COMPLETED', 'REJECTED', 'CANCELLED', 'IN_VERIFICATION', 'READY_FOR_REVIEW']
      if (excludedVerificationStates.includes(section.reference.verification_state)) {
        console.log(`[ChaseQueue] Filtered out section ${section.id}: reference verification_state is ${section.reference.verification_state}`)
        return false
      }

      // Must have initial request sent (form was actually sent to the referee)
      if (!section.initial_request_sent_at) {
        console.log(`[ChaseQueue] Filtered out section ${section.id}: no initial_request_sent_at`)
        return false
      }

      // Check "marked done" filter:
      // - If last_marked_done_at is NULL, item is visible
      // - If last_marked_done_at is before today's 8:55am UK threshold, item reappears
      // - If last_marked_done_at is after today's 8:55am UK threshold, item is hidden
      const lastMarkedDoneAt = markedDoneMap.get(section.id)
      if (lastMarkedDoneAt) {
        const markedDoneAt = new Date(lastMarkedDoneAt)
        if (markedDoneAt >= todayChaseThreshold) {
          console.log(`[ChaseQueue] Filtered out section ${section.id}: marked done at ${markedDoneAt.toISOString()} (after threshold ${todayChaseThreshold.toISOString()})`)
          return false
        }
      }

      return true
    })

    console.log(`[ChaseQueue] Active sections after filter: ${activeSections.length}`)

    // Map sections to ChaseQueueItem format (maintains backward compatibility)
    return activeSections.map((section: any) => {
      const daysSinceRequest = section.initial_request_sent_at
        ? Math.floor((Date.now() - new Date(section.initial_request_sent_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0

      let urgency: 'NORMAL' | 'WARNING' | 'URGENT' = 'NORMAL'
      if (daysSinceRequest > 3) {
        urgency = 'URGENT'
      } else if (daysSinceRequest > 1) {
        urgency = 'WARNING'
      }

      // Map section_type to dependency_type for backward compatibility
      const dependencyTypeMap: Record<string, string> = {
        'EMPLOYER_REFERENCE': 'EMPLOYER_REF',
        'LANDLORD_REFERENCE': 'RESIDENTIAL_REF',
        'ACCOUNTANT_REFERENCE': 'ACCOUNTANT_REF'
      }

      return {
        id: section.id,
        referenceId: section.reference_id,
        dependencyType: dependencyTypeMap[section.section_type] || section.section_type,
        status: 'PENDING', // All items in chase queue are effectively pending
        contactName: section.contact_name_encrypted ? decrypt(section.contact_name_encrypted) : undefined,
        contactEmail: section.contact_email_encrypted ? decrypt(section.contact_email_encrypted) : undefined,
        contactPhone: section.contact_phone_encrypted ? decrypt(section.contact_phone_encrypted) : undefined,
        initialRequestSentAt: section.initial_request_sent_at,
        lastChaseSentAt: section.last_chase_sent_at,
        lastMarkedDoneAt: markedDoneMap.get(section.id),
        chaseCycle: section.chase_cycle || 0,
        emailAttempts: section.email_attempts || 0,
        smsAttempts: section.sms_attempts || 0,
        linkedTable: section.linked_table,
        linkedRecordId: section.linked_record_id,
        createdAt: section.created_at,
        updatedAt: section.updated_at,
        tenantName: `${decrypt(section.reference.tenant_first_name_encrypted) || ''} ${decrypt(section.reference.tenant_last_name_encrypted) || ''}`.trim(),
        propertyAddress: decrypt(section.reference.property_address_encrypted) || '',
        companyName: decrypt(section.reference.company?.name_encrypted) || '',
        daysSinceRequest,
        urgency
      } as ChaseQueueItem
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

    const newStatus = 'CHASING'
    const nextChaseDueAt = calculateNextChaseTime(now)?.toISOString() || null

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

      // GUARANTOR_FORM is always required if requires_guarantor is set
      // No exceptions for students - they still need guarantor to submit form
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
 * Check if reference is ready for verification and transition state accordingly
 * Delegates to consolidated state machine (evaluateAndTransition)
 *
 * @deprecated This function is kept for backward compatibility but now uses the consolidated state machine
 */
async function checkAndTransitionToVerify(referenceId: string): Promise<boolean> {
  try {
    console.log(`[Chase] Checking if reference ${referenceId} can transition to verify`)

    // Delegate to consolidated state machine
    // This will check evidence completeness AND external reference sections
    const result = await evaluateAndTransition(
      referenceId,
      'External reference received - checking if ready for verification'
    )

    if (result.success && result.transitioned) {
      console.log(`[Chase] Reference ${referenceId} transitioned to ${result.newState}`)

      // Log audit for visibility
      await logAuditAction({
        referenceId,
        action: 'AUTO_TRANSITION_CHECK',
        description: `Reference automatically transitioned to ${result.newState} after external reference received`,
        metadata: { visible_to_agent: false, newState: result.newState }
      })

      return true
    }

    return false
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

    // Only chase at 12:00 GMT
    if (hour !== CHASE_RULES.CHASE_HOUR_UTC) {
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
 * Disabled: keep dependencies in chase queue indefinitely
 */
export async function processExhaustedDependencies(): Promise<number> {
  return 0
}

// --- Helper Functions ---

function calculateNextChaseTime(lastChase: Date): Date | null {
  const nextChase = new Date(lastChase)
  nextChase.setUTCHours(CHASE_RULES.CHASE_HOUR_UTC, 0, 0, 0)
  if (lastChase >= nextChase) {
    nextChase.setUTCDate(nextChase.getUTCDate() + 1)
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
          company:companies(id, name_encrypted, phone_encrypted, email_encrypted, logo_url)
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
    const companyLogoUrl = reference.company?.logo_url || null
    const frontendUrl = getFrontendUrl()

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

        const tenantUrl = `${frontendUrl}/submit-reference/${reference.id}`

        if (method === 'email') {
          await sendTenantReferenceRequest(
            contactEmail!,
            tenantName,
            tenantUrl,
            companyName,
            propertyAddress,
            companyPhone || undefined,
            companyEmail || undefined,
            reference.id,
            companyLogoUrl
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

        // Get or create employer reference record
        let { data: employerRef } = await supabase
          .from('employer_references')
          .select('id')
          .eq('reference_id', reference.id)
          .maybeSingle()

        if (!employerRef) {
          // Create employer_references record (using ID-based URLs, not tokens)
          const { data: newEmployerRef, error: insertError } = await supabase
            .from('employer_references')
            .insert({
              reference_id: reference.id,
              employer_name_encrypted: reference.employer_ref_name_encrypted,
              employer_email_encrypted: reference.employer_ref_email_encrypted,
              employer_phone_encrypted: reference.employer_ref_phone_encrypted
            })
            .select('id')
            .single()

          if (insertError || !newEmployerRef) {
            console.error('Failed to create employer reference:', insertError)
            return { sent: false, skipped: true, reason: 'Failed to create employer reference record' }
          }
          employerRef = newEmployerRef
        }

        // Use employer_reference.id in URL - stable and doesn't change between chases
        const employerUrl = `${frontendUrl}/submit-employer-reference/${employerRef.id}`

        if (method === 'email') {
          await sendEmployerReferenceRequest(
            contactEmail!,
            employerName,
            tenantName,
            employerUrl,
            companyName,
            companyPhone,
            companyEmail,
            reference.id,
            companyLogoUrl
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
              reference.id,
              companyLogoUrl
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
        const accountantUrl = `${frontendUrl}/accountant-reference/${accountantRef.id}`

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

        const guarantorUrl = isLegacyGuarantor
          ? `${frontendUrl}/guarantor-reference/${guarantorToken}`
          : `${frontendUrl}/guarantor-reference/${guarantorId}`

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
            guarantorId,
            companyLogoUrl
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

/**
 * Send a chase email or SMS for a verification section (used by chase queue)
 * This is the new function that works with verification_sections IDs
 */
export async function sendChaseForSection(
  sectionId: string,
  method: 'email' | 'sms'
): Promise<{ sent: boolean; skipped: boolean; reason?: string }> {
  try {
        const frontendUrl = getFrontendUrl()

    // Get the verification section with reference data
    const { data: section, error: sectionError } = await supabase
      .from('verification_sections')
      .select(`
        *,
        reference:tenant_references!verification_sections_reference_id_fkey (
          id,
          status,
          tenant_first_name_encrypted,
          tenant_last_name_encrypted,
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
          company:companies(id, name_encrypted, phone_encrypted, email_encrypted, logo_url)
        )
      `)
      .eq('id', sectionId)
      .single()

    if (sectionError) {
      console.error('[Chase] Error fetching section:', sectionError)
      return { sent: false, skipped: false, reason: `Database error: ${sectionError.message}` }
    }

    if (!section) {
      return { sent: false, skipped: false, reason: 'Section not found' }
    }

    const reference = section.reference
    if (!reference) {
      return { sent: false, skipped: false, reason: 'Reference not found' }
    }

    // Skip if reference is in terminal status
    const terminalStatuses = ['completed', 'rejected', 'cancelled']
    if (terminalStatuses.includes(reference.status)) {
      return { sent: false, skipped: true, reason: `Reference status is ${reference.status}` }
    }

    // Get contact info from section
    const contactEmail = section.contact_email_encrypted ? decrypt(section.contact_email_encrypted) : null
    const contactPhone = section.contact_phone_encrypted ? decrypt(section.contact_phone_encrypted) : null
    const contactName = section.contact_name_encrypted ? decrypt(section.contact_name_encrypted) : null

    if (method === 'email' && !contactEmail) {
      return { sent: false, skipped: true, reason: 'No email address' }
    }
    if (method === 'sms' && !contactPhone) {
      return { sent: false, skipped: true, reason: 'No phone number' }
    }

    // Get reference data
    const tenantName = `${decrypt(reference.tenant_first_name_encrypted) || ''} ${decrypt(reference.tenant_last_name_encrypted) || ''}`.trim()
    const propertyAddress = decrypt(reference.property_address_encrypted) || ''
    const companyName = reference.company?.name_encrypted ? decrypt(reference.company.name_encrypted) || '' : ''
    const companyPhone = reference.company?.phone_encrypted ? decrypt(reference.company.phone_encrypted) || '' : ''
    const companyEmail = reference.company?.email_encrypted ? decrypt(reference.company.email_encrypted) || '' : ''
    const companyLogoUrl = reference.company?.logo_url || null

    // Send based on section type
    switch (section.section_type) {
      case 'EMPLOYER_REFERENCE': {
        const employerName = contactName || decrypt(reference.employer_ref_name_encrypted) || ''

        // Get or create employer reference record
        let employerRefId = section.linked_record_id

        if (!employerRefId) {
          // Try to find existing employer_references record
          const { data: existingRef } = await supabase
            .from('employer_references')
            .select('id')
            .eq('reference_id', reference.id)
            .maybeSingle()

          if (existingRef) {
            employerRefId = existingRef.id
          } else {
            // Create employer_references record
            const { data: newEmployerRef, error: insertError } = await supabase
              .from('employer_references')
              .insert({
                reference_id: reference.id,
                employer_name_encrypted: encrypt(employerName),
                employer_email_encrypted: section.contact_email_encrypted,
                employer_phone_encrypted: section.contact_phone_encrypted
              })
              .select('id')
              .single()

            if (insertError || !newEmployerRef) {
              console.error('Failed to create employer reference:', insertError)
              return { sent: false, skipped: true, reason: 'Failed to create employer reference record' }
            }
            employerRefId = newEmployerRef.id
          }

          // Update section with linked_record_id
          await supabase
            .from('verification_sections')
            .update({ linked_record_id: employerRefId, linked_table: 'employer_references' })
            .eq('id', sectionId)
        }

        const employerUrl = `${frontendUrl}/submit-employer-reference/${employerRefId}`

        if (method === 'email') {
          await sendEmployerReferenceRequest(
            contactEmail!,
            employerName,
            tenantName,
            employerUrl,
            companyName,
            companyPhone,
            companyEmail,
            reference.id,
            companyLogoUrl
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

      case 'LANDLORD_REFERENCE': {
        const landlordName = contactName || decrypt(reference.previous_landlord_name_encrypted) || ''
        const isAgent = reference.reference_type === 'agent' || section.linked_table === 'agent_references'

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
              reference.id,
              companyLogoUrl
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

      case 'ACCOUNTANT_REFERENCE': {
        const accountantName = contactName || decrypt(reference.accountant_name_encrypted) || ''

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
        const accountantUrl = `${frontendUrl}/accountant-reference/${accountantRef.id}`

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

      default:
        return { sent: false, skipped: true, reason: `Unknown section type: ${section.section_type}` }
    }

    console.log(`[Chase] ${method.toUpperCase()} sent for section ${sectionId} (${section.section_type})`)
    return { sent: true, skipped: false }
  } catch (error: any) {
    console.error(`[Chase] Failed to send ${method} for section ${sectionId}:`, error)
    return { sent: false, skipped: false, reason: error.message }
  }
}

/**
 * Record that a chase was sent for a verification section (used by chase queue)
 * This updates the verification_sections table instead of chase_dependencies
 */
export async function recordChaseForSection(
  sectionId: string,
  method: 'email' | 'sms',
  staffId: string,
  actualSend: boolean = true
): Promise<any> {
  try {
    // Get current section
    const { data: current, error: getError } = await supabase
      .from('verification_sections')
      .select('*, reference:tenant_references!verification_sections_reference_id_fkey(id)')
      .eq('id', sectionId)
      .single()

    if (getError || !current) {
      throw new Error('Section not found')
    }

    // Actually send the chase if requested
    if (actualSend) {
      const sendResult = await sendChaseForSection(sectionId, method)
      if (!sendResult.sent && !sendResult.skipped) {
        throw new Error(`Failed to send ${method}: ${sendResult.reason}`)
      }
      if (sendResult.skipped) {
        console.log(`[Chase] Skipped sending ${method} for section ${sectionId}: ${sendResult.reason}`)
      }
    }

    // Calculate updated values
    const now = new Date()
    const emailAttempts = method === 'email' ? (current.email_attempts || 0) + 1 : (current.email_attempts || 0)
    const smsAttempts = method === 'sms' ? (current.sms_attempts || 0) + 1 : (current.sms_attempts || 0)

    // Increment cycle if both email AND SMS sent in this cycle
    let newChaseCycle = current.chase_cycle || 0
    if (emailAttempts > newChaseCycle && smsAttempts > newChaseCycle) {
      newChaseCycle++
    }

    // Update section
    const { data: updated, error: updateError } = await supabase
      .from('verification_sections')
      .update({
        last_chase_sent_at: now.toISOString(),
        chase_cycle: newChaseCycle,
        email_attempts: emailAttempts,
        sms_attempts: smsAttempts,
        initial_request_sent_at: current.initial_request_sent_at || now.toISOString()
      })
      .eq('id', sectionId)
      .select()
      .single()

    if (updateError) throw updateError

    // Log audit
    await logAuditAction({
      referenceId: current.reference.id,
      action: 'CHASE_SENT',
      description: `${method.toUpperCase()} chase sent for ${current.section_type}`,
      metadata: {
        sectionType: current.section_type,
        method,
        chaseCycle: newChaseCycle,
        emailAttempts,
        smsAttempts,
        actualSend
      },
      userId: staffId
    })

    return updated
  } catch (error: any) {
    console.error(`[Chase] Error recording chase for section ${sectionId}:`, error)
    throw error
  }
}

/**
 * Mark a verification section as received (response has been submitted)
 * This removes the item from the chase queue permanently
 */
export async function markSectionReceived(sectionId: string, staffId: string): Promise<any> {
  try {
    const { data: current, error: getError } = await supabase
      .from('verification_sections')
      .select('*, reference:tenant_references!verification_sections_reference_id_fkey(id, status)')
      .eq('id', sectionId)
      .single()

    if (getError || !current) {
      throw new Error('Section not found')
    }

    // Update the section decision to mark it as received/reviewed
    // This removes it from the chase queue (which filters by decision = 'NOT_REVIEWED')
    const { data: updated, error: updateError } = await supabase
      .from('verification_sections')
      .update({
        decision: 'PASS', // Required to remove from Pending Responses queue
        decision_notes: 'Response received - marked via Pending Responses queue'
      })
      .eq('id', sectionId)
      .select()
      .single()

    if (updateError) throw updateError

    // Also update the corresponding chase_dependency to RECEIVED
    // This is needed for the state machine to properly transition to READY_FOR_REVIEW
    const sectionToDependencyMap: Record<string, DependencyType> = {
      'EMPLOYER_REFERENCE': 'EMPLOYER_REF',
      'LANDLORD_REFERENCE': 'RESIDENTIAL_REF',
      'ACCOUNTANT_REFERENCE': 'ACCOUNTANT_REF'
    }

    const dependencyType = sectionToDependencyMap[current.section_type]
    if (dependencyType) {
      const { error: depUpdateError } = await supabase
        .from('chase_dependencies')
        .update({
          status: 'RECEIVED',
          received_at: new Date().toISOString()
        })
        .eq('reference_id', current.reference.id)
        .eq('dependency_type', dependencyType)
        .in('status', ['PENDING', 'CHASING', 'ACTION_REQUIRED'])

      if (depUpdateError) {
        console.error(`[Chase] Failed to update chase_dependency for ${dependencyType}:`, depUpdateError)
      } else {
        console.log(`[Chase] Marked ${dependencyType} chase_dependency as RECEIVED`)
      }
    }

    // Log audit
    await logAuditAction({
      referenceId: current.reference.id,
      action: 'SECTION_RECEIVED',
      description: `${current.section_type} response received`,
      metadata: {
        sectionId,
        sectionType: current.section_type,
        visible_to_agent: true
      },
      userId: staffId
    })

    // Check if reference is ready for verification transition
    await checkAndTransitionToVerify(current.reference.id)

    return updated
  } catch (error) {
    console.error('Failed to mark section received:', error)
    throw error
  }
}

/**
 * Escalate a verification section to action required
 * This flags it for agent attention
 */
export async function escalateSectionToActionRequired(
  sectionId: string,
  staffId: string,
  reason?: string
): Promise<any> {
  try {
    const { data: current, error: getError } = await supabase
      .from('verification_sections')
      .select('*, reference:tenant_references!verification_sections_reference_id_fkey(id, verification_state)')
      .eq('id', sectionId)
      .single()

    if (getError || !current) {
      throw new Error('Section not found')
    }

    // Update chase_metadata to include action required info
    const updatedMetadata = {
      ...(current.chase_metadata || {}),
      action_required: true,
      action_required_reason: reason,
      action_required_at: new Date().toISOString(),
      action_required_by: staffId
    }

    const { data: updated, error: updateError } = await supabase
      .from('verification_sections')
      .update({
        chase_metadata: updatedMetadata,
        decision: 'ACTION_REQUIRED',
        // Store the reason in action_reason_code for display to agents
        action_reason_code: 'STAFF_ESCALATION',
        action_agent_note: reason || 'Escalated by staff - action required'
      })
      .eq('id', sectionId)
      .select()
      .single()

    if (updateError) throw updateError

    // Transition the reference state to ACTION_REQUIRED so it appears in agent's Action Required tab
    const referenceId = current.reference.id
    const currentRefState = current.reference.verification_state

    // Only transition if not already in a terminal state
    const terminalStates = ['COMPLETED', 'REJECTED', 'CANCELLED']
    if (!terminalStates.includes(currentRefState)) {
      await transitionState(
        referenceId,
        'ACTION_REQUIRED',
        `Staff escalated ${current.section_type}: ${reason || 'Action required'}`,
        staffId
      )
      console.log(`[Escalate] Reference ${referenceId} transitioned to ACTION_REQUIRED`)
    }

    // Log audit with agent visibility
    await logAuditAction({
      referenceId,
      action: 'SECTION_ACTION_REQUIRED',
      description: `${current.section_type} escalated to action required${reason ? `: ${reason}` : ''}`,
      metadata: {
        sectionId,
        sectionType: current.section_type,
        reason,
        visible_to_agent: true
      },
      userId: staffId
    })

    return updated
  } catch (error) {
    console.error('Failed to escalate section to action required:', error)
    throw error
  }
}

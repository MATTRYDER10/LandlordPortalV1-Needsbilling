/**
 * V2 Chase Service
 *
 * Manages chase items for external references (employer, landlord, etc.)
 * 24-hour cycle: items move to chase queue after 24hrs without response.
 */

import { supabase } from '../../config/supabase'
import { encrypt, decrypt } from '../encryption'
import {
  V2ChaseItemRow,
  V2ChaseStatus,
  V2ChaseType,
  V2RefereeType,
  V2SectionType
} from './types'
import { markSectionReady } from './sectionServiceV2'

// ============================================================================
// CHASE ITEM MANAGEMENT
// ============================================================================

/**
 * Create a chase item when external reference is sent
 */
export async function createChaseItem(
  referenceId: string,
  sectionId: string,
  refereeType: V2RefereeType,
  refereeDetails: {
    name: string
    email: string
    phone?: string
  }
): Promise<V2ChaseItemRow | null> {
  try {
    const now = new Date()
    const cooldownUntil = new Date(now.getTime() + 12 * 60 * 60 * 1000) // 12h cooldown

    const { data, error } = await supabase
      .from('chase_items_v2')
      .insert({
        reference_id: referenceId,
        section_id: sectionId,
        referee_type: refereeType,
        referee_name_encrypted: encrypt(refereeDetails.name),
        referee_email_encrypted: encrypt(refereeDetails.email),
        referee_phone_encrypted: refereeDetails.phone ? encrypt(refereeDetails.phone) : null,
        status: 'IN_CHASE_QUEUE',
        chase_queue_entered_at: now.toISOString(),
        initial_sent_at: now.toISOString(),
        cooldown_until: cooldownUntil.toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('[ChaseServiceV2] Error creating chase item:', error)
      return null
    }

    console.log(`[ChaseServiceV2] Created chase item for ${refereeType} on section ${sectionId}`)
    return data
  } catch (error) {
    console.error('[ChaseServiceV2] Error:', error)
    return null
  }
}

/**
 * Get chase item by ID
 */
export async function getChaseItem(chaseItemId: string): Promise<V2ChaseItemRow | null> {
  try {
    const { data, error } = await supabase
      .from('chase_items_v2')
      .select('*')
      .eq('id', chaseItemId)
      .single()

    if (error) {
      return null
    }

    return data
  } catch (error) {
    console.error('[ChaseServiceV2] Error:', error)
    return null
  }
}

/**
 * Get chase item for a section
 */
export async function getChaseItemForSection(sectionId: string): Promise<V2ChaseItemRow | null> {
  try {
    const { data, error } = await supabase
      .from('chase_items_v2')
      .select('*')
      .eq('section_id', sectionId)
      .single()

    if (error) {
      return null
    }

    return data
  } catch (error) {
    console.error('[ChaseServiceV2] Error:', error)
    return null
  }
}

/**
 * Get items in chase queue (including cooldown items)
 * Sorted: active (no cooldown) first by oldest-chased, cooldown items at bottom
 */
export async function getChaseQueue(limit: number = 50): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('chase_items_v2')
      .select(`
        *,
        reference:tenant_references_v2!chase_items_v2_reference_id_fkey (
          id,
          company_id,
          tenant_first_name_encrypted,
          tenant_last_name_encrypted,
          property_address_encrypted
        ),
        section:reference_sections_v2!chase_items_v2_section_id_fkey (
          id,
          section_type
        )
      `)
      .eq('status', 'IN_CHASE_QUEUE')
      .order('last_chased_at', { ascending: true, nullsFirst: true })
      .limit(limit)

    if (error) {
      console.error('[ChaseServiceV2] Error getting chase queue:', error)
      return []
    }

    if (!data) return []

    const now = Date.now()
    const twentyFourHoursMs = 24 * 60 * 60 * 1000

    // Enrich with computed fields and sort
    const enriched = data.map((item: any) => {
      const inCooldown = item.cooldown_until && new Date(item.cooldown_until).getTime() > now
      const isOverdue = item.last_chased_at
        && (now - new Date(item.last_chased_at).getTime()) > twentyFourHoursMs
        && !inCooldown

      return {
        ...item,
        is_overdue: !!isOverdue,
        in_cooldown: !!inCooldown
      }
    })

    // Sort: active first (no cooldown), then cooldown items
    enriched.sort((a: any, b: any) => {
      if (a.in_cooldown !== b.in_cooldown) return a.in_cooldown ? 1 : -1
      // Within same group, oldest chased first (nulls first = never chased)
      const aTime = a.last_chased_at ? new Date(a.last_chased_at).getTime() : 0
      const bTime = b.last_chased_at ? new Date(b.last_chased_at).getTime() : 0
      return aTime - bTime
    })

    return enriched
  } catch (error) {
    console.error('[ChaseServiceV2] Error:', error)
    return []
  }
}

/**
 * Get chase item with decrypted referee details
 */
export async function getChaseItemDecrypted(chaseItemId: string): Promise<{
  chaseItem: V2ChaseItemRow
  refereeName: string
  refereeEmail: string
  refereePhone: string | null
} | null> {
  const chaseItem = await getChaseItem(chaseItemId)
  if (!chaseItem) return null

  return {
    chaseItem,
    refereeName: decrypt(chaseItem.referee_name_encrypted) || '',
    refereeEmail: decrypt(chaseItem.referee_email_encrypted) || '',
    refereePhone: decrypt(chaseItem.referee_phone_encrypted)
  }
}

// ============================================================================
// CHASE QUEUE PROCESSING (Scheduled Job)
// ============================================================================

/**
 * Process items that should move to chase queue (12hrs passed)
 * Also creates tenant chase items and auto-resolves completed ones
 */
export async function processChaseQueue(): Promise<number> {
  try {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
    const now = new Date().toISOString()

    // Find referee items that have been waiting > 12hrs
    const { data: itemsToChase, error: fetchError } = await supabase
      .from('chase_items_v2')
      .select('id')
      .eq('status', 'WAITING')
      .lt('initial_sent_at', twelveHoursAgo)

    let movedCount = 0

    if (!fetchError && itemsToChase && itemsToChase.length > 0) {
      // Update them to IN_CHASE_QUEUE
      const { error: updateError } = await supabase
        .from('chase_items_v2')
        .update({
          status: 'IN_CHASE_QUEUE',
          chase_queue_entered_at: now,
          updated_at: now
        })
        .in('id', itemsToChase.map(i => i.id))

      if (updateError) {
        console.error('[ChaseServiceV2] Error moving items to chase queue:', updateError)
      } else {
        // Create CHASE work items for each
        for (const item of itemsToChase) {
          const chaseItem = await getChaseItem(item.id)
          if (chaseItem && chaseItem.section_id) {
            await supabase
              .from('work_items_v2')
              .insert({
                reference_id: chaseItem.reference_id,
                section_id: chaseItem.section_id,
                work_type: 'CHASE',
                status: 'AVAILABLE'
              })
          }
        }

        movedCount = itemsToChase.length
        console.log(`[ChaseServiceV2] Moved ${movedCount} items to chase queue`)
      }
    }

    // Create tenant chase items and auto-resolve completed ones
    const tenantCreated = await createTenantChaseItems()
    const tenantResolved = await autoResolveTenantChases()

    // Create guarantor chase items and auto-resolve completed ones
    const guarantorCreated = await createGuarantorChaseItems()
    const guarantorResolved = await autoResolveGuarantorChases()

    // Create chase items for "will email" doc uploads and auto-resolve completed ones
    const uploadCreated = await createWillEmailChaseItems()
    const uploadResolved = await autoResolveWillEmailChases()

    if (tenantCreated > 0) console.log(`[ChaseServiceV2] Created ${tenantCreated} tenant chase items`)
    if (tenantResolved > 0) console.log(`[ChaseServiceV2] Auto-resolved ${tenantResolved} tenant chases`)
    if (guarantorCreated > 0) console.log(`[ChaseServiceV2] Created ${guarantorCreated} guarantor chase items`)
    if (guarantorResolved > 0) console.log(`[ChaseServiceV2] Auto-resolved ${guarantorResolved} guarantor chases`)
    if (uploadCreated > 0) console.log(`[ChaseServiceV2] Created ${uploadCreated} will-email upload chase items`)
    if (uploadResolved > 0) console.log(`[ChaseServiceV2] Auto-resolved ${uploadResolved} will-email upload chases`)

    return movedCount + tenantCreated + guarantorCreated + uploadCreated
  } catch (error) {
    console.error('[ChaseServiceV2] Error processing chase queue:', error)
    return 0
  }
}

// ============================================================================
// CHASE ACTIONS
// ============================================================================

/**
 * Record a chase action (email, SMS, call)
 */
export async function recordChaseAction(
  chaseItemId: string,
  actionType: 'EMAIL' | 'SMS' | 'CALL' | 'RECEIVED',
  staffUserId: string,
  notes?: string
): Promise<boolean> {
  try {
    const chaseItem = await getChaseItem(chaseItemId)
    if (!chaseItem) return false

    const now = new Date().toISOString()
    const updateData: Partial<V2ChaseItemRow> = {
      last_chased_at: now,
      chase_count: chaseItem.chase_count + 1,
      updated_at: now
    }

    // Increment specific counter
    if (actionType === 'EMAIL') {
      updateData.emails_sent = chaseItem.emails_sent + 1
    } else if (actionType === 'SMS') {
      updateData.sms_sent = chaseItem.sms_sent + 1
    } else if (actionType === 'CALL') {
      updateData.calls_made = chaseItem.calls_made + 1
    }

    const { error } = await supabase
      .from('chase_items_v2')
      .update(updateData)
      .eq('id', chaseItemId)

    if (error) {
      console.error('[ChaseServiceV2] Error recording chase action:', error)
      return false
    }

    console.log(`[ChaseServiceV2] Recorded ${actionType} chase for ${chaseItemId}`)
    return true
  } catch (error) {
    console.error('[ChaseServiceV2] Error:', error)
    return false
  }
}

// ============================================================================
// CHASE RESOLUTION
// ============================================================================

/**
 * Mark chase item as received (referee submitted online)
 */
export async function markChaseReceived(chaseItemId: string): Promise<boolean> {
  try {
    const chaseItem = await getChaseItem(chaseItemId)
    if (!chaseItem) return false

    const now = new Date().toISOString()

    const { error } = await supabase
      .from('chase_items_v2')
      .update({
        status: 'RECEIVED',
        resolution_type: 'ONLINE_SUBMISSION',
        resolved_at: now,
        updated_at: now
      })
      .eq('id', chaseItemId)

    if (error) {
      console.error('[ChaseServiceV2] Error marking received:', error)
      return false
    }

    // Mark section as ready for verification
    if (chaseItem.section_id) {
      await markSectionReady(chaseItem.section_id, true)

      // Complete the work item
      await supabase
        .from('work_items_v2')
        .update({ status: 'COMPLETED', completed_at: now, updated_at: now })
        .eq('section_id', chaseItem.section_id)
        .eq('work_type', 'CHASE')
    }

    console.log(`[ChaseServiceV2] Chase item ${chaseItemId} marked as received`)
    return true
  } catch (error) {
    console.error('[ChaseServiceV2] Error:', error)
    return false
  }
}

/**
 * Mark chase item as verbal obtained
 */
export async function markChaseVerbalObtained(
  chaseItemId: string,
  verbalReferenceId: string
): Promise<boolean> {
  try {
    const chaseItem = await getChaseItem(chaseItemId)
    if (!chaseItem) return false

    const now = new Date().toISOString()

    const { error } = await supabase
      .from('chase_items_v2')
      .update({
        status: 'VERBAL_OBTAINED',
        resolution_type: 'VERBAL',
        verbal_reference_id: verbalReferenceId,
        resolved_at: now,
        updated_at: now
      })
      .eq('id', chaseItemId)

    if (error) {
      console.error('[ChaseServiceV2] Error marking verbal obtained:', error)
      return false
    }

    // Mark section as ready for verification (with verbal badge)
    if (chaseItem.section_id) {
      await markSectionReady(chaseItem.section_id, true)

      // Complete the CHASE work item
      await supabase
        .from('work_items_v2')
        .update({ status: 'COMPLETED', completed_at: now, updated_at: now })
        .eq('section_id', chaseItem.section_id)
        .eq('work_type', 'CHASE')
    }

    console.log(`[ChaseServiceV2] Chase item ${chaseItemId} marked as verbal obtained`)
    return true
  } catch (error) {
    console.error('[ChaseServiceV2] Error:', error)
    return false
  }
}

/**
 * Mark chase item as unable to obtain
 */
export async function markChaseUnable(
  chaseItemId: string,
  reason: string
): Promise<boolean> {
  try {
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('chase_items_v2')
      .update({
        status: 'UNABLE_TO_OBTAIN',
        resolution_type: 'UNABLE',
        unable_reason: reason,
        resolved_at: now,
        updated_at: now
      })
      .eq('id', chaseItemId)

    if (error) {
      console.error('[ChaseServiceV2] Error marking unable:', error)
      return false
    }

    // Complete the work item
    await supabase
      .from('work_items_v2')
      .update({ status: 'COMPLETED', completed_at: now, updated_at: now })
      .eq('id', chaseItemId)

    console.log(`[ChaseServiceV2] Chase item ${chaseItemId} marked as unable to obtain`)
    return true
  } catch (error) {
    console.error('[ChaseServiceV2] Error:', error)
    return false
  }
}

// ============================================================================
// TENANT CHASE ITEMS
// ============================================================================

/**
 * Create chase items for tenants who haven't submitted their form after 12hrs
 */
export async function createTenantChaseItems(): Promise<number> {
  try {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
    const now = new Date().toISOString()

    // Find references where tenant hasn't submitted and it's been > 12hrs
    const { data: refs, error: refError } = await supabase
      .from('tenant_references_v2')
      .select('id, tenant_first_name_encrypted, tenant_last_name_encrypted, tenant_email_encrypted, tenant_phone_encrypted, property_address_encrypted')
      .eq('status', 'SENT')
      .is('form_submitted_at', null)
      .lt('created_at', twelveHoursAgo)

    if (refError || !refs || refs.length === 0) return 0

    let created = 0
    for (const ref of refs) {
      // Check if active tenant chase already exists
      const { data: existing } = await supabase
        .from('chase_items_v2')
        .select('id')
        .eq('reference_id', ref.id)
        .eq('chase_type', 'TENANT')
        .in('status', ['WAITING', 'IN_CHASE_QUEUE'])
        .limit(1)
        .maybeSingle()

      if (existing) continue

      const tenantName = `${decrypt(ref.tenant_first_name_encrypted) || ''} ${decrypt(ref.tenant_last_name_encrypted) || ''}`.trim()
      const tenantEmail = decrypt(ref.tenant_email_encrypted) || ''
      const tenantPhone = decrypt(ref.tenant_phone_encrypted) || null

      const { error: insertError } = await supabase
        .from('chase_items_v2')
        .insert({
          reference_id: ref.id,
          section_id: null,
          referee_type: 'TENANT',
          chase_type: 'TENANT',
          referee_name_encrypted: encrypt(tenantName),
          referee_email_encrypted: encrypt(tenantEmail),
          referee_phone_encrypted: tenantPhone ? encrypt(tenantPhone) : null,
          status: 'IN_CHASE_QUEUE',
          chase_queue_entered_at: now,
          initial_sent_at: now
        })

      if (!insertError) created++
    }

    return created
  } catch (error) {
    console.error('[ChaseServiceV2] Error creating tenant chase items:', error)
    return 0
  }
}

/**
 * Auto-resolve tenant chase items where the tenant has now submitted their form
 */
export async function autoResolveTenantChases(): Promise<number> {
  try {
    const now = new Date().toISOString()

    // Find active tenant chases
    const { data: tenantChases, error } = await supabase
      .from('chase_items_v2')
      .select('id, reference_id')
      .eq('chase_type', 'TENANT')
      .in('status', ['WAITING', 'IN_CHASE_QUEUE'])

    if (error || !tenantChases || tenantChases.length === 0) return 0

    let resolved = 0
    for (const chase of tenantChases) {
      // Check if tenant has now submitted
      const { data: ref } = await supabase
        .from('tenant_references_v2')
        .select('form_submitted_at')
        .eq('id', chase.reference_id)
        .single()

      if (ref?.form_submitted_at) {
        await supabase
          .from('chase_items_v2')
          .update({
            status: 'RECEIVED',
            resolution_type: 'TENANT_SUBMITTED',
            resolved_at: now,
            updated_at: now
          })
          .eq('id', chase.id)
        resolved++
      }
    }

    return resolved
  } catch (error) {
    console.error('[ChaseServiceV2] Error auto-resolving tenant chases:', error)
    return 0
  }
}

/**
 * Create chase items for guarantors who haven't submitted their form after 12hrs
 */
export async function createGuarantorChaseItems(): Promise<number> {
  try {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
    const now = new Date().toISOString()

    // Find guarantor references where form hasn't been submitted and it's been > 12hrs
    const { data: refs, error: refError } = await supabase
      .from('tenant_references_v2')
      .select('id, tenant_first_name_encrypted, tenant_last_name_encrypted, tenant_email_encrypted, tenant_phone_encrypted, guarantor_for_reference_id')
      .eq('is_guarantor', true)
      .is('form_submitted_at', null)
      .in('status', ['SENT', 'COLLECTING_EVIDENCE'])
      .lt('created_at', twelveHoursAgo)

    if (refError || !refs || refs.length === 0) return 0

    let created = 0
    for (const ref of refs) {
      // Check if active guarantor chase already exists
      const { data: existing } = await supabase
        .from('chase_items_v2')
        .select('id')
        .eq('reference_id', ref.id)
        .eq('chase_type', 'GUARANTOR')
        .in('status', ['WAITING', 'IN_CHASE_QUEUE'])
        .limit(1)
        .maybeSingle()

      if (existing) continue

      const guarantorName = `${decrypt(ref.tenant_first_name_encrypted) || ''} ${decrypt(ref.tenant_last_name_encrypted) || ''}`.trim()
      const guarantorEmail = decrypt(ref.tenant_email_encrypted) || ''
      const guarantorPhone = decrypt(ref.tenant_phone_encrypted) || null

      // Get the parent tenant name for display
      let tenantName = 'Unknown Tenant'
      if (ref.guarantor_for_reference_id) {
        const { data: parentRef } = await supabase
          .from('tenant_references_v2')
          .select('tenant_first_name_encrypted, tenant_last_name_encrypted')
          .eq('id', ref.guarantor_for_reference_id)
          .single()
        if (parentRef) {
          tenantName = `${decrypt(parentRef.tenant_first_name_encrypted) || ''} ${decrypt(parentRef.tenant_last_name_encrypted) || ''}`.trim()
        }
      }

      const { error: insertError } = await supabase
        .from('chase_items_v2')
        .insert({
          reference_id: ref.id,
          section_id: null,
          referee_type: 'GUARANTOR',
          chase_type: 'GUARANTOR',
          referee_name_encrypted: encrypt(guarantorName),
          referee_email_encrypted: encrypt(guarantorEmail),
          referee_phone_encrypted: guarantorPhone ? encrypt(guarantorPhone) : null,
          status: 'IN_CHASE_QUEUE',
          chase_queue_entered_at: now,
          initial_sent_at: now
        })

      if (!insertError) created++
    }

    return created
  } catch (error) {
    console.error('[ChaseServiceV2] Error creating guarantor chase items:', error)
    return 0
  }
}

/**
 * Auto-resolve guarantor chase items where the guarantor has now submitted their form
 */
export async function autoResolveGuarantorChases(): Promise<number> {
  try {
    const now = new Date().toISOString()

    // Find active guarantor chases
    const { data: guarantorChases, error } = await supabase
      .from('chase_items_v2')
      .select('id, reference_id')
      .eq('chase_type', 'GUARANTOR')
      .in('status', ['WAITING', 'IN_CHASE_QUEUE'])

    if (error || !guarantorChases || guarantorChases.length === 0) return 0

    let resolved = 0
    for (const chase of guarantorChases) {
      // Check if guarantor has now submitted
      const { data: ref } = await supabase
        .from('tenant_references_v2')
        .select('form_submitted_at')
        .eq('id', chase.reference_id)
        .single()

      if (ref?.form_submitted_at) {
        await supabase
          .from('chase_items_v2')
          .update({
            status: 'RECEIVED',
            resolution_type: 'GUARANTOR_SUBMITTED',
            resolved_at: now,
            updated_at: now
          })
          .eq('id', chase.id)
        resolved++
      }
    }

    return resolved
  } catch (error) {
    console.error('[ChaseServiceV2] Error auto-resolving guarantor chases:', error)
    return 0
  }
}

/**
 * Create chase items for tenants/guarantors who selected "will email" docs but haven't uploaded yet (12hrs+)
 */
export async function createWillEmailChaseItems(): Promise<number> {
  try {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
    const now = new Date().toISOString()

    // Find references submitted 12+ hours ago that have form_data with willEmail flags still true
    const { data: refs, error } = await supabase
      .from('tenant_references_v2')
      .select('id, tenant_first_name_encrypted, tenant_last_name_encrypted, tenant_email_encrypted, tenant_phone_encrypted, form_data, is_guarantor')
      .not('form_submitted_at', 'is', null)
      .lt('form_submitted_at', twelveHoursAgo)
      .in('status', ['COLLECTING_EVIDENCE', 'ACTION_REQUIRED'])

    if (error || !refs || refs.length === 0) return 0

    // WillEmail field names to check across form_data sections
    const willEmailFields = [
      { section: 'income', fields: ['payslipsWillEmail', 'taxReturnWillEmail', 'savingsDocWillEmail', 'pensionDocWillEmail', 'rentalDocWillEmail'] },
      { section: 'identity', fields: ['idDocumentWillEmail'] },
      { section: 'address', fields: ['proofOfAddressWillEmail'] }
    ]

    let created = 0
    for (const ref of refs) {
      const formData = ref.form_data || {}

      // Check if any willEmail flag is still true (hasn't been uploaded yet)
      let hasOutstandingUpload = false
      for (const { section, fields } of willEmailFields) {
        const sectionData = formData[section] || {}
        for (const field of fields) {
          if (sectionData[field] === true) {
            // Check the corresponding URL field is still empty
            const urlField = field.replace('WillEmail', 'Url')
            if (!sectionData[urlField]) {
              hasOutstandingUpload = true
              break
            }
          }
        }
        if (hasOutstandingUpload) break
      }

      if (!hasOutstandingUpload) continue

      // Check if active chase already exists for this reference
      const { data: existing } = await supabase
        .from('chase_items_v2')
        .select('id')
        .eq('reference_id', ref.id)
        .eq('chase_type', 'UPLOAD')
        .in('status', ['WAITING', 'IN_CHASE_QUEUE'])
        .limit(1)
        .maybeSingle()

      if (existing) continue

      const name = `${decrypt(ref.tenant_first_name_encrypted) || ''} ${decrypt(ref.tenant_last_name_encrypted) || ''}`.trim()
      const email = decrypt(ref.tenant_email_encrypted) || ''
      const phone = decrypt(ref.tenant_phone_encrypted) || null

      const { error: insertError } = await supabase
        .from('chase_items_v2')
        .insert({
          reference_id: ref.id,
          section_id: null,
          referee_type: ref.is_guarantor ? 'GUARANTOR' : 'TENANT',
          chase_type: 'UPLOAD',
          referee_name_encrypted: encrypt(name),
          referee_email_encrypted: encrypt(email),
          referee_phone_encrypted: phone ? encrypt(phone) : null,
          status: 'IN_CHASE_QUEUE',
          chase_queue_entered_at: now,
          initial_sent_at: now
        })

      if (!insertError) created++
    }

    return created
  } catch (error) {
    console.error('[ChaseServiceV2] Error creating will-email chase items:', error)
    return 0
  }
}

/**
 * Auto-resolve will-email chase items where all outstanding docs have been uploaded
 */
export async function autoResolveWillEmailChases(): Promise<number> {
  try {
    const now = new Date().toISOString()

    const { data: uploadChases, error } = await supabase
      .from('chase_items_v2')
      .select('id, reference_id')
      .eq('chase_type', 'UPLOAD')
      .in('status', ['WAITING', 'IN_CHASE_QUEUE'])

    if (error || !uploadChases || uploadChases.length === 0) return 0

    const willEmailFields = [
      { section: 'income', fields: ['payslipsWillEmail', 'taxReturnWillEmail', 'savingsDocWillEmail', 'pensionDocWillEmail', 'rentalDocWillEmail'] },
      { section: 'identity', fields: ['idDocumentWillEmail'] },
      { section: 'address', fields: ['proofOfAddressWillEmail'] }
    ]

    let resolved = 0
    for (const chase of uploadChases) {
      const { data: ref } = await supabase
        .from('tenant_references_v2')
        .select('form_data')
        .eq('id', chase.reference_id)
        .single()

      if (!ref) continue

      const formData = ref.form_data || {}
      let stillOutstanding = false

      for (const { section, fields } of willEmailFields) {
        const sectionData = formData[section] || {}
        for (const field of fields) {
          if (sectionData[field] === true) {
            const urlField = field.replace('WillEmail', 'Url')
            if (!sectionData[urlField]) {
              stillOutstanding = true
              break
            }
          }
        }
        if (stillOutstanding) break
      }

      if (!stillOutstanding) {
        await supabase
          .from('chase_items_v2')
          .update({
            status: 'RECEIVED',
            resolution_type: 'DOCS_UPLOADED',
            resolved_at: now,
            updated_at: now
          })
          .eq('id', chase.id)
        resolved++
      }
    }

    return resolved
  } catch (error) {
    console.error('[ChaseServiceV2] Error auto-resolving will-email chases:', error)
    return 0
  }
}

/**
 * Complete a chase cycle (email + call done, add note, start cooldown)
 */
export async function completeChaseCycle(
  chaseItemId: string,
  note: string,
  staffUserId: string
): Promise<boolean> {
  try {
    const chaseItem = await getChaseItem(chaseItemId)
    if (!chaseItem) return false

    const now = new Date()
    const cooldownUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    const { error } = await supabase
      .from('chase_items_v2')
      .update({
        chase_note: note,
        last_chased_at: now.toISOString(),
        cooldown_until: cooldownUntil.toISOString(),
        email_checked: false,
        call_checked: false,
        chase_count: chaseItem.chase_count + 1,
        updated_at: now.toISOString()
      })
      .eq('id', chaseItemId)

    if (error) {
      console.error('[ChaseServiceV2] Error completing chase cycle:', error)
      return false
    }

    console.log(`[ChaseServiceV2] Completed chase cycle for ${chaseItemId}, cooldown until ${cooldownUntil.toISOString()}`)
    return true
  } catch (error) {
    console.error('[ChaseServiceV2] Error:', error)
    return false
  }
}

// ============================================================================
// CHASE REACTIVATION
// ============================================================================

/**
 * Reactivate an existing chase item or create a new one for issue resolution
 */
export async function reactivateOrCreateChaseItem(
  referenceId: string,
  sectionId: string,
  reason: string
): Promise<V2ChaseItemRow | null> {
  try {
    // Check for existing chase item for this section
    const existing = await getChaseItemForSection(sectionId)

    if (existing && existing.status !== 'RECEIVED' && existing.status !== 'VERBAL_OBTAINED') {
      // Reactivate existing chase item
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('chase_items_v2')
        .update({
          status: 'IN_CHASE_QUEUE',
          chase_queue_entered_at: now,
          updated_at: now
        })
        .eq('id', existing.id)

      if (error) {
        console.error('[ChaseServiceV2] Error reactivating chase item:', error)
        return null
      }

      // Create work item for the reactivated chase
      await supabase
        .from('work_items_v2')
        .insert({
          reference_id: referenceId,
          section_id: sectionId,
          work_type: 'CHASE',
          status: 'AVAILABLE'
        })

      console.log(`[ChaseServiceV2] Reactivated chase item ${existing.id} for section ${sectionId}: ${reason}`)
      return { ...existing, status: 'IN_CHASE_QUEUE' as V2ChaseStatus }
    }

    // Get section to determine referee type
    const { data: section } = await supabase
      .from('reference_sections_v2')
      .select('section_type, referee_name_encrypted, referee_email_encrypted, referee_phone_encrypted')
      .eq('id', sectionId)
      .single()

    if (!section) return null

    const refereeType = getSectionRefereeType(section.section_type as any)
    if (!refereeType) {
      // For sections without referees (IDENTITY, RTR, CREDIT, AML), no chase item needed
      console.log(`[ChaseServiceV2] No referee type for section type ${section.section_type}, skipping chase creation`)
      return null
    }

    // Get referee details from the reference
    const { data: reference } = await supabase
      .from('tenant_references_v2')
      .select('*')
      .eq('id', referenceId)
      .single()

    if (!reference) return null

    let name = '', email = '', phone: string | undefined
    if (refereeType === 'EMPLOYER') {
      name = decrypt(reference.employer_ref_name_encrypted) || ''
      email = decrypt(reference.employer_ref_email_encrypted) || ''
      phone = decrypt(reference.employer_ref_phone_encrypted) || undefined
    } else if (refereeType === 'LANDLORD') {
      name = decrypt(reference.previous_landlord_name_encrypted) || ''
      email = decrypt(reference.previous_landlord_email_encrypted) || ''
      phone = decrypt(reference.previous_landlord_phone_encrypted) || undefined
    } else if (refereeType === 'ACCOUNTANT') {
      name = decrypt(reference.accountant_name_encrypted) || ''
      email = decrypt(reference.accountant_email_encrypted) || ''
      phone = decrypt(reference.accountant_phone_encrypted) || undefined
    }

    if (!email) {
      console.log(`[ChaseServiceV2] No referee email found for ${refereeType}, skipping chase creation`)
      return null
    }

    return await createChaseItem(referenceId, sectionId, refereeType, { name, email, phone })
  } catch (error) {
    console.error('[ChaseServiceV2] Error in reactivateOrCreateChaseItem:', error)
    return null
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Map section type to referee type
 */
export function getSectionRefereeType(sectionType: V2SectionType): V2RefereeType | null {
  switch (sectionType) {
    case 'INCOME':
      return 'EMPLOYER' // Could also be ACCOUNTANT for self-employed
    case 'RESIDENTIAL':
      return 'LANDLORD' // Could also be AGENT
    default:
      return null
  }
}

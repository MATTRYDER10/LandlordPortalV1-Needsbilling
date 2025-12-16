/**
 * Reference Status Repair Script
 *
 * Validates and fixes references that may be in incorrect statuses.
 * Run with: npx ts-node scripts/repair-reference-statuses.ts
 * Apply changes: npx ts-node scripts/repair-reference-statuses.ts --apply
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const APPLY_MODE = process.argv.includes('--apply')

// Track changes for summary
interface ChangeRecord {
  referenceId: string
  name: string
  fromStatus: string
  toStatus: string
  reason: string
}

const changes: {
  pendingToInProgress: ChangeRecord[]
  inProgressToVerify: ChangeRecord[]
  verifyToInProgress: ChangeRecord[]
  actionRequiredToVerify: ChangeRecord[]
  guarantorFixes: ChangeRecord[]
  workItemsClosed: string[]
  workItemsCreated: string[]
} = {
  pendingToInProgress: [],
  inProgressToVerify: [],
  verifyToInProgress: [],
  actionRequiredToVerify: [],
  guarantorFixes: [],
  workItemsClosed: [],
  workItemsCreated: []
}

/**
 * Decrypt name for display purposes
 */
function decryptName(firstNameEnc: string | null, lastNameEnc: string | null): string {
  // For now just use the reference ID prefix - real decryption would need the encryption key
  // This is just for display purposes in the script output
  return firstNameEnc ? '[encrypted name]' : 'Unknown'
}

/**
 * Check if a reference is ready for verification (sync version)
 */
function isReadyForVerificationSync(reference: any): { isReady: boolean; reason?: string } {
  // 1. Check identity (ID + selfie required)
  if (!reference.id_document_path || !reference.selfie_path) {
    const missing = []
    if (!reference.id_document_path) missing.push('ID document')
    if (!reference.selfie_path) missing.push('selfie')
    return { isReady: false, reason: `Missing: ${missing.join(', ')}` }
  }

  // 2. Check income
  const incomeCheck = checkIncomeSection(reference)
  if (!incomeCheck.complete) {
    return { isReady: false, reason: incomeCheck.reason }
  }

  // 3. Check residential (only for tenants, not guarantors)
  if (!reference.is_guarantor) {
    const residentialCheck = checkResidentialSection(reference)
    if (!residentialCheck.complete) {
      return { isReady: false, reason: residentialCheck.reason }
    }
  }

  return { isReady: true }
}

function checkIncomeSection(reference: any): { complete: boolean; reason?: string } {
  const isStudent = !!reference.income_student
  const isEmployed = !!reference.income_regular_employment
  const isSelfEmployed = !!reference.income_self_employed
  const hasBenefits = !!reference.income_benefits

  // Student ONLY (no other income types) - auto-complete
  if (isStudent && !isEmployed && !isSelfEmployed && !hasBenefits) {
    return { complete: true }
  }

  const incomeIssues: string[] = []

  // If employed - need employer reference OR ANY payslips
  if (isEmployed) {
    const hasEmployerRef = reference.employer_references?.some((er: any) => er.submitted_at)
    const payslipCount = reference.payslip_files?.length || 0
    const hasPayslips = payslipCount > 0

    if (!hasEmployerRef && !hasPayslips) {
      incomeIssues.push('Employed: need employer ref OR payslips')
    }
  }

  // If self-employed - need accountant reference OR tax return
  if (isSelfEmployed) {
    const hasAccountantRef = reference.accountant_references?.some((ar: any) => ar.submitted_at)
    const hasTaxReturn = !!reference.tax_return_path

    if (!hasAccountantRef && !hasTaxReturn) {
      incomeIssues.push('Self-employed: need accountant ref OR tax return')
    }
  }

  // If benefits - need amount declared AND evidence uploaded
  if (hasBenefits) {
    const hasAmount = !!reference.benefits_annual_amount_encrypted
    const hasEvidence = !!reference.proof_of_additional_income_path

    if (!hasAmount || !hasEvidence) {
      incomeIssues.push('Benefits: need amount + evidence')
    }
  }

  if (incomeIssues.length > 0) {
    return { complete: false, reason: incomeIssues.join('; ') }
  }

  return { complete: true }
}

function checkResidentialSection(reference: any): { complete: boolean; reason?: string } {
  // If confirmed residential status is set
  if (reference.confirmed_residential_status) {
    return { complete: true }
  }

  // Check if landlord or agent reference exists
  const hasLandlordRef = reference.landlord_references?.some((lr: any) => lr.submitted_at)
  const hasAgentRef = reference.agent_references?.some((ar: any) => ar.submitted_at)

  if (hasLandlordRef || hasAgentRef) {
    return { complete: true }
  }

  // Check if landlord email was provided (meaning they expect a reference)
  if (reference.previous_landlord_email_encrypted) {
    return { complete: false, reason: 'Waiting for landlord/agent ref' }
  }

  // No landlord email provided - assume not renting
  return { complete: true }
}

// Standard select fields for references
const REFERENCE_SELECT = `
  id,
  status,
  is_guarantor,
  submitted_at,
  tenant_first_name_encrypted,
  tenant_last_name_encrypted,
  income_student,
  income_regular_employment,
  income_self_employed,
  income_benefits,
  benefits_annual_amount_encrypted,
  id_document_path,
  selfie_path,
  tax_return_path,
  payslip_files,
  proof_of_additional_income_path,
  confirmed_residential_status,
  previous_landlord_email_encrypted,
  employer_references (id, submitted_at),
  landlord_references (id, submitted_at),
  agent_references (id, submitted_at),
  accountant_references (id, submitted_at)
`

async function check1_PendingWithSubmittedForm() {
  console.log('\n[1] Checking: Submitted forms stuck in "pending" status')
  console.log('─'.repeat(60))

  const { data: refs, error } = await supabase
    .from('tenant_references')
    .select(REFERENCE_SELECT)
    .eq('status', 'pending')
    .not('submitted_at', 'is', null)

  if (error) {
    console.error('  Error:', error.message)
    return
  }

  if (!refs || refs.length === 0) {
    console.log('  ✓ No issues found')
    return
  }

  console.log(`  Found ${refs.length} reference(s) to fix:`)

  for (const ref of refs) {
    const name = decryptName(ref.tenant_first_name_encrypted, ref.tenant_last_name_encrypted)
    console.log(`    - ${ref.id.slice(0, 8)}... ${name}: pending → in_progress`)

    changes.pendingToInProgress.push({
      referenceId: ref.id,
      name,
      fromStatus: 'pending',
      toStatus: 'in_progress',
      reason: 'Form was submitted'
    })

    if (APPLY_MODE) {
      const { error: updateError } = await supabase
        .from('tenant_references')
        .update({ status: 'in_progress' })
        .eq('id', ref.id)

      if (updateError) {
        console.error(`      Error updating: ${updateError.message}`)
      } else {
        await logAudit(ref.id, 'STATUS_REPAIR', 'pending → in_progress', 'Form was submitted but status was pending')
      }
    }
  }
}

async function check2_InProgressReadyForVerification() {
  console.log('\n[2] Checking: "in_progress" references ready for verification')
  console.log('─'.repeat(60))

  const { data: refs, error } = await supabase
    .from('tenant_references')
    .select(REFERENCE_SELECT)
    .eq('status', 'in_progress')

  if (error) {
    console.error('  Error:', error.message)
    return
  }

  if (!refs || refs.length === 0) {
    console.log('  ✓ No in_progress references found')
    return
  }

  console.log(`  Checking ${refs.length} in_progress reference(s)...`)

  let fixCount = 0
  for (const ref of refs) {
    // Check if they have any pending/chasing dependencies
    const { data: deps } = await supabase
      .from('chase_dependencies')
      .select('id, status')
      .eq('reference_id', ref.id)
      .in('status', ['PENDING', 'CHASING'])

    const hasOutstandingDeps = deps && deps.length > 0

    if (hasOutstandingDeps) {
      continue // Still waiting on dependencies
    }

    const readiness = isReadyForVerificationSync(ref)
    if (readiness.isReady) {
      const name = decryptName(ref.tenant_first_name_encrypted, ref.tenant_last_name_encrypted)
      console.log(`    - ${ref.id.slice(0, 8)}... ${name}: in_progress → pending_verification`)
      fixCount++

      changes.inProgressToVerify.push({
        referenceId: ref.id,
        name,
        fromStatus: 'in_progress',
        toStatus: 'pending_verification',
        reason: 'Ready for verification'
      })

      if (APPLY_MODE) {
        const { error: updateError } = await supabase
          .from('tenant_references')
          .update({ status: 'pending_verification' })
          .eq('id', ref.id)

        if (updateError) {
          console.error(`      Error updating: ${updateError.message}`)
        } else {
          await logAudit(ref.id, 'STATUS_REPAIR', 'in_progress → pending_verification', 'Reference is ready for verification')
          // Also create work item if needed
          await ensureVerifyWorkItem(ref.id)
        }
      }
    }
  }

  if (fixCount === 0) {
    console.log('  ✓ No issues found')
  }
}

async function check3_PendingVerificationNotReady() {
  console.log('\n[3] Checking: "pending_verification" not actually ready')
  console.log('─'.repeat(60))

  const { data: refs, error } = await supabase
    .from('tenant_references')
    .select(REFERENCE_SELECT)
    .eq('status', 'pending_verification')

  if (error) {
    console.error('  Error:', error.message)
    return
  }

  if (!refs || refs.length === 0) {
    console.log('  ✓ No pending_verification references found')
    return
  }

  console.log(`  Checking ${refs.length} pending_verification reference(s)...`)

  let fixCount = 0
  for (const ref of refs) {
    const readiness = isReadyForVerificationSync(ref)
    if (!readiness.isReady) {
      const name = decryptName(ref.tenant_first_name_encrypted, ref.tenant_last_name_encrypted)
      console.log(`    - ${ref.id.slice(0, 8)}... ${name}: pending_verification → in_progress`)
      console.log(`      Reason: ${readiness.reason}`)
      fixCount++

      changes.verifyToInProgress.push({
        referenceId: ref.id,
        name,
        fromStatus: 'pending_verification',
        toStatus: 'in_progress',
        reason: readiness.reason || 'Not ready'
      })

      if (APPLY_MODE) {
        const { error: updateError } = await supabase
          .from('tenant_references')
          .update({ status: 'in_progress' })
          .eq('id', ref.id)

        if (updateError) {
          console.error(`      Error updating: ${updateError.message}`)
        } else {
          await logAudit(ref.id, 'STATUS_REPAIR', 'pending_verification → in_progress', `Not ready: ${readiness.reason}`)
        }
      }
    }
  }

  if (fixCount === 0) {
    console.log('  ✓ All pending_verification references are valid')
  }
}

async function check4_ActionRequiredWithResolvedDeps() {
  console.log('\n[4] Checking: "action_required" with all dependencies resolved')
  console.log('─'.repeat(60))

  const { data: refs, error } = await supabase
    .from('tenant_references')
    .select(REFERENCE_SELECT)
    .eq('status', 'action_required')

  if (error) {
    console.error('  Error:', error.message)
    return
  }

  if (!refs || refs.length === 0) {
    console.log('  ✓ No action_required references found')
    return
  }

  console.log(`  Checking ${refs.length} action_required reference(s)...`)

  let fixCount = 0
  for (const ref of refs) {
    // Check if all dependencies are resolved (RECEIVED)
    const { data: deps } = await supabase
      .from('chase_dependencies')
      .select('id, status')
      .eq('reference_id', ref.id)

    const hasUnresolvedDeps = deps?.some(d =>
      ['PENDING', 'CHASING', 'EXHAUSTED', 'ACTION_REQUIRED'].includes(d.status)
    )

    if (hasUnresolvedDeps) {
      continue // Still has unresolved dependencies
    }

    const readiness = isReadyForVerificationSync(ref)
    if (readiness.isReady) {
      const name = decryptName(ref.tenant_first_name_encrypted, ref.tenant_last_name_encrypted)
      console.log(`    - ${ref.id.slice(0, 8)}... ${name}: action_required → pending_verification`)
      fixCount++

      changes.actionRequiredToVerify.push({
        referenceId: ref.id,
        name,
        fromStatus: 'action_required',
        toStatus: 'pending_verification',
        reason: 'Dependencies resolved'
      })

      if (APPLY_MODE) {
        const { error: updateError } = await supabase
          .from('tenant_references')
          .update({ status: 'pending_verification' })
          .eq('id', ref.id)

        if (updateError) {
          console.error(`      Error updating: ${updateError.message}`)
        } else {
          await logAudit(ref.id, 'STATUS_REPAIR', 'action_required → pending_verification', 'All dependencies resolved')
          await ensureVerifyWorkItem(ref.id)
        }
      }
    }
  }

  if (fixCount === 0) {
    console.log('  ✓ No issues found')
  }
}

async function check5_GuarantorsInAwaitingGuarantor() {
  // Note: 'awaiting_guarantor' is NOT a database status - it's only used in app display layer
  // The actual DB statuses are: pending, in_progress, pending_verification, completed, rejected, cancelled, action_required
  // So this check is skipped as the status doesn't exist in the database
  console.log('\n[5] Checking: Guarantors incorrectly in "awaiting_guarantor" status')
  console.log('─'.repeat(60))
  console.log('  ✓ Skipped (awaiting_guarantor is not a database status)')
}

async function check6_TerminalStatusesWithOpenWorkItems() {
  console.log('\n[6] Checking: Terminal statuses with open work items')
  console.log('─'.repeat(60))

  // Get all non-completed work items
  const { data: workItems, error } = await supabase
    .from('work_items')
    .select('id, reference_id, work_type, status')
    .neq('status', 'COMPLETED')

  if (error) {
    console.error('  Error:', error.message)
    return
  }

  if (!workItems || workItems.length === 0) {
    console.log('  ✓ No open work items found')
    return
  }

  // Get all references for these work items
  const refIds = [...new Set(workItems.map(wi => wi.reference_id))]
  const { data: refs } = await supabase
    .from('tenant_references')
    .select('id, status')
    .in('id', refIds)

  const refStatusMap = new Map(refs?.map(r => [r.id, r.status]) || [])

  const terminalStatuses = ['completed', 'rejected', 'cancelled']
  const itemsToClose = workItems.filter(wi => {
    const refStatus = refStatusMap.get(wi.reference_id)
    return refStatus && terminalStatuses.includes(refStatus)
  })

  if (itemsToClose.length === 0) {
    console.log('  ✓ No issues found')
    return
  }

  console.log(`  Found ${itemsToClose.length} work item(s) to close:`)

  for (const wi of itemsToClose) {
    const refStatus = refStatusMap.get(wi.reference_id)
    console.log(`    - Work item ${wi.id.slice(0, 8)}... (${wi.work_type}) for ${refStatus} reference`)

    changes.workItemsClosed.push(wi.id)

    if (APPLY_MODE) {
      const { error: updateError } = await supabase
        .from('work_items')
        .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
        .eq('id', wi.id)

      if (updateError) {
        console.error(`      Error updating: ${updateError.message}`)
      }
    }
  }
}

async function check7_MissingVerifyWorkItems() {
  console.log('\n[7] Checking: Missing VERIFY work items for pending_verification')
  console.log('─'.repeat(60))

  // Get all pending_verification references
  const { data: refs, error } = await supabase
    .from('tenant_references')
    .select('id')
    .eq('status', 'pending_verification')

  if (error) {
    console.error('  Error:', error.message)
    return
  }

  if (!refs || refs.length === 0) {
    console.log('  ✓ No pending_verification references')
    return
  }

  // Get existing VERIFY work items
  const { data: workItems } = await supabase
    .from('work_items')
    .select('reference_id')
    .eq('work_type', 'VERIFY')
    .in('status', ['AVAILABLE', 'ASSIGNED', 'IN_PROGRESS', 'RETURNED'])

  const existingWorkItemRefs = new Set(workItems?.map(wi => wi.reference_id) || [])
  const missingRefs = refs.filter(r => !existingWorkItemRefs.has(r.id))

  if (missingRefs.length === 0) {
    console.log('  ✓ All pending_verification references have work items')
    return
  }

  console.log(`  Found ${missingRefs.length} reference(s) missing work items:`)

  for (const ref of missingRefs) {
    console.log(`    - ${ref.id.slice(0, 8)}... needs VERIFY work item`)

    changes.workItemsCreated.push(ref.id)

    if (APPLY_MODE) {
      await ensureVerifyWorkItem(ref.id)
    }
  }
}

async function ensureVerifyWorkItem(referenceId: string) {
  // Check if work item already exists
  const { data: existing } = await supabase
    .from('work_items')
    .select('id')
    .eq('reference_id', referenceId)
    .eq('work_type', 'VERIFY')
    .in('status', ['AVAILABLE', 'ASSIGNED', 'IN_PROGRESS', 'RETURNED'])
    .single()

  if (existing) return

  // Create new work item
  const { error } = await supabase
    .from('work_items')
    .insert({
      reference_id: referenceId,
      work_type: 'VERIFY',
      status: 'AVAILABLE',
      priority: 0,
      last_activity_at: new Date().toISOString()
    })

  if (error) {
    console.error(`      Error creating work item: ${error.message}`)
  }
}

async function logAudit(referenceId: string, action: string, statusChange: string, details: string) {
  await supabase.from('reference_audit_log').insert({
    reference_id: referenceId,
    action,
    details: {
      status_change: statusChange,
      reason: details,
      script: 'repair-reference-statuses.ts'
    },
    performed_by: null // System action
  })
}

function printSummary() {
  console.log('\n' + '═'.repeat(60))
  console.log('SUMMARY')
  console.log('═'.repeat(60))

  const totalChanges =
    changes.pendingToInProgress.length +
    changes.inProgressToVerify.length +
    changes.verifyToInProgress.length +
    changes.actionRequiredToVerify.length +
    changes.guarantorFixes.length +
    changes.workItemsClosed.length +
    changes.workItemsCreated.length

  if (totalChanges === 0) {
    console.log('\n✓ No issues found! All references are in correct statuses.')
    return
  }

  console.log(`\nTotal issues found: ${totalChanges}`)
  console.log('')

  if (changes.pendingToInProgress.length > 0) {
    console.log(`  • pending → in_progress: ${changes.pendingToInProgress.length}`)
  }
  if (changes.inProgressToVerify.length > 0) {
    console.log(`  • in_progress → pending_verification: ${changes.inProgressToVerify.length}`)
  }
  if (changes.verifyToInProgress.length > 0) {
    console.log(`  • pending_verification → in_progress: ${changes.verifyToInProgress.length}`)
  }
  if (changes.actionRequiredToVerify.length > 0) {
    console.log(`  • action_required → pending_verification: ${changes.actionRequiredToVerify.length}`)
  }
  if (changes.guarantorFixes.length > 0) {
    console.log(`  • Guarantor status fixes: ${changes.guarantorFixes.length}`)
  }
  if (changes.workItemsClosed.length > 0) {
    console.log(`  • Work items to close: ${changes.workItemsClosed.length}`)
  }
  if (changes.workItemsCreated.length > 0) {
    console.log(`  • Work items to create: ${changes.workItemsCreated.length}`)
  }

  if (!APPLY_MODE) {
    console.log('\n' + '─'.repeat(60))
    console.log('This was a DRY RUN. No changes were made.')
    console.log('Run with --apply to execute these changes.')
  } else {
    console.log('\n' + '─'.repeat(60))
    console.log('Changes have been applied.')
  }
}

async function main() {
  console.log('═'.repeat(60))
  console.log('REFERENCE STATUS REPAIR SCRIPT')
  console.log('═'.repeat(60))
  console.log(`Mode: ${APPLY_MODE ? 'APPLY (making changes)' : 'DRY RUN (report only)'}`)
  console.log(`Time: ${new Date().toISOString()}`)

  await check1_PendingWithSubmittedForm()
  await check2_InProgressReadyForVerification()
  await check3_PendingVerificationNotReady()
  await check4_ActionRequiredWithResolvedDeps()
  await check5_GuarantorsInAwaitingGuarantor()
  await check6_TerminalStatusesWithOpenWorkItems()
  await check7_MissingVerifyWorkItems()

  printSummary()
}

main().catch(console.error)

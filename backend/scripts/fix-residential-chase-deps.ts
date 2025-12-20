/**
 * Fix Residential Chase Dependencies Script
 *
 * Fixes RESIDENTIAL_REF chase dependencies for tenants who have a confirmed_residential_status
 * (e.g., "living at home", "owner occupier"). These tenants don't need a landlord/agent reference,
 * so any chase dependencies for them should be marked as RECEIVED.
 *
 * Run with: npx ts-node scripts/fix-residential-chase-deps.ts
 * Apply changes: npx ts-node scripts/fix-residential-chase-deps.ts --apply
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
const SPECIFIC_REF = process.argv.find(arg => arg.startsWith('--ref='))?.split('=')[1]

async function main() {
  console.log('═'.repeat(60))
  console.log('FIX RESIDENTIAL CHASE DEPENDENCIES')
  console.log('═'.repeat(60))
  console.log(`Mode: ${APPLY_MODE ? 'APPLY (making changes)' : 'DRY RUN (report only)'}`)
  if (SPECIFIC_REF) {
    console.log(`Targeting specific reference: ${SPECIFIC_REF}`)
  }
  console.log(`Time: ${new Date().toISOString()}`)
  console.log('')

  // Find all RESIDENTIAL_REF chase dependencies that shouldn't exist
  // because the tenant has a confirmed_residential_status
  let query = supabase
    .from('chase_dependencies')
    .select(`
      id,
      reference_id,
      status,
      dependency_type,
      reference:tenant_references!chase_dependencies_reference_id_fkey (
        id,
        confirmed_residential_status,
        status
      )
    `)
    .eq('dependency_type', 'RESIDENTIAL_REF')
    .in('status', ['PENDING', 'CHASING', 'EXHAUSTED', 'ACTION_REQUIRED'])

  if (SPECIFIC_REF) {
    query = query.eq('reference_id', SPECIFIC_REF)
  }

  const { data: deps, error } = await query

  if (error) {
    console.error('Error fetching dependencies:', error.message)
    process.exit(1)
  }

  // Filter to only those where confirmed_residential_status is set
  const depsToFix = (deps || []).filter((dep: any) => {
    return dep.reference?.confirmed_residential_status
  })

  if (depsToFix.length === 0) {
    console.log('✓ No residential chase dependencies need fixing')
    return
  }

  console.log(`Found ${depsToFix.length} chase dependency(ies) to fix:\n`)

  for (const dep of depsToFix as any[]) {
    console.log(`  Reference: ${dep.reference_id}`)
    console.log(`    Current dependency status: ${dep.status}`)
    console.log(`    Confirmed residential status: ${dep.reference.confirmed_residential_status}`)
    console.log(`    Reference status: ${dep.reference.status}`)
    console.log(`    → Will mark as RECEIVED (no landlord ref needed)\n`)

    if (APPLY_MODE) {
      // Mark dependency as RECEIVED
      const { error: updateError } = await supabase
        .from('chase_dependencies')
        .update({
          status: 'RECEIVED',
          next_chase_due_at: null,
          metadata: {
            auto_received: true,
            auto_received_reason: `Tenant has confirmed_residential_status: ${dep.reference.confirmed_residential_status}`,
            auto_received_at: new Date().toISOString()
          }
        })
        .eq('id', dep.id)

      if (updateError) {
        console.error(`    Error updating dependency: ${updateError.message}`)
        continue
      }

      console.log(`    ✓ Dependency marked as RECEIVED`)

      // Log audit
      await supabase.from('reference_audit_log').insert({
        reference_id: dep.reference_id,
        action: 'CHASE_DEP_AUTO_RECEIVED',
        details: {
          dependency_id: dep.id,
          dependency_type: 'RESIDENTIAL_REF',
          previous_status: dep.status,
          reason: `Tenant has confirmed_residential_status: ${dep.reference.confirmed_residential_status}`,
          script: 'fix-residential-chase-deps.ts'
        },
        performed_by: null
      })

      // Check if reference needs status update (from action_required to something else)
      if (dep.reference.status === 'action_required') {
        // Check if there are any other unresolved dependencies
        const { data: otherDeps } = await supabase
          .from('chase_dependencies')
          .select('id, status')
          .eq('reference_id', dep.reference_id)
          .neq('id', dep.id)
          .in('status', ['PENDING', 'CHASING', 'EXHAUSTED', 'ACTION_REQUIRED'])

        if (!otherDeps || otherDeps.length === 0) {
          // No other blocking dependencies - can move to pending_verification or in_progress
          const { error: refUpdateError } = await supabase
            .from('tenant_references')
            .update({
              status: 'pending_verification',
              updated_at: new Date().toISOString()
            })
            .eq('id', dep.reference_id)

          if (refUpdateError) {
            console.error(`    Error updating reference status: ${refUpdateError.message}`)
          } else {
            console.log(`    ✓ Reference status updated: action_required → pending_verification`)

            // Create/update work item
            const { data: existingWi } = await supabase
              .from('work_items')
              .select('id, status')
              .eq('reference_id', dep.reference_id)
              .eq('work_type', 'VERIFY')
              .order('created_at', { ascending: false })
              .limit(1)
              .single()

            if (!existingWi) {
              await supabase.from('work_items').insert({
                reference_id: dep.reference_id,
                work_type: 'VERIFY',
                status: 'AVAILABLE',
                priority: 0
              })
              console.log(`    ✓ Created VERIFY work item`)
            } else if (existingWi.status === 'COMPLETED') {
              await supabase
                .from('work_items')
                .update({ status: 'AVAILABLE', assigned_to: null, assigned_at: null, completed_at: null })
                .eq('id', existingWi.id)
              console.log(`    ✓ Reactivated VERIFY work item`)
            }
          }
        }
      }
    }
  }

  console.log('')
  if (!APPLY_MODE) {
    console.log('─'.repeat(60))
    console.log('This was a DRY RUN. No changes were made.')
    console.log('Run with --apply to execute these changes.')
    console.log('')
    console.log('To fix a specific reference:')
    console.log('  npx ts-node scripts/fix-residential-chase-deps.ts --ref=<reference-id> --apply')
  } else {
    console.log('─'.repeat(60))
    console.log('Changes applied successfully.')
  }
}

main().catch(console.error)

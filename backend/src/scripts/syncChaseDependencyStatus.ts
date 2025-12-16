/**
 * Script to sync chase dependency statuses with actual form submissions
 * Run with: npx ts-node src/scripts/syncChaseDependencyStatus.ts
 *
 * This fixes chase dependencies that should be RECEIVED but are still PENDING/CHASING
 * because the forms were submitted before the chase system was implemented.
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function syncChaseDependencyStatus() {
  console.log('Syncing chase dependency statuses with actual form submissions...')

  // Get all chase dependencies that are PENDING or CHASING
  const { data: dependencies, error: depError } = await supabase
    .from('chase_dependencies')
    .select(`
      id,
      reference_id,
      dependency_type,
      status,
      linked_table
    `)
    .in('status', ['PENDING', 'CHASING'])

  if (depError) {
    console.error('Error fetching dependencies:', depError)
    return
  }

  console.log(`Found ${dependencies?.length || 0} PENDING/CHASING dependencies to check`)

  let updatedCount = 0

  for (const dep of dependencies || []) {
    let shouldMarkReceived = false

    switch (dep.dependency_type) {
      case 'TENANT_FORM': {
        // Check if tenant has submitted their form (reference status is not 'pending')
        const { data: ref } = await supabase
          .from('tenant_references')
          .select('status, submitted_at')
          .eq('id', dep.reference_id)
          .single()

        // If reference is no longer pending OR has submitted_at, tenant form is done
        if (ref && (ref.status !== 'pending' || ref.submitted_at)) {
          shouldMarkReceived = true
        }
        break
      }

      case 'EMPLOYER_REF': {
        // Check if employer reference has been submitted
        const { data: empRefs } = await supabase
          .from('employer_references')
          .select('id, submitted_at')
          .eq('reference_id', dep.reference_id)
          .not('submitted_at', 'is', null)

        if (empRefs && empRefs.length > 0) {
          shouldMarkReceived = true
        }
        break
      }

      case 'RESIDENTIAL_REF': {
        // Check if landlord OR agent reference has been submitted
        const { data: landlordRefs } = await supabase
          .from('landlord_references')
          .select('id, submitted_at')
          .eq('reference_id', dep.reference_id)
          .not('submitted_at', 'is', null)

        const { data: agentRefs } = await supabase
          .from('agent_references')
          .select('id, submitted_at')
          .eq('reference_id', dep.reference_id)
          .not('submitted_at', 'is', null)

        if ((landlordRefs && landlordRefs.length > 0) || (agentRefs && agentRefs.length > 0)) {
          shouldMarkReceived = true
        }
        break
      }

      case 'ACCOUNTANT_REF': {
        // Check if accountant reference has been submitted
        const { data: accRefs } = await supabase
          .from('accountant_references')
          .select('id, submitted_at')
          .eq('tenant_reference_id', dep.reference_id)
          .not('submitted_at', 'is', null)

        if (accRefs && accRefs.length > 0) {
          shouldMarkReceived = true
        }
        break
      }

      case 'GUARANTOR_FORM': {
        // Check if guarantor reference has been submitted (either legacy or new)
        const { data: guarantorRefs } = await supabase
          .from('guarantor_references')
          .select('id, submitted_at')
          .eq('reference_id', dep.reference_id)
          .not('submitted_at', 'is', null)

        // Also check new-style guarantor (tenant_references with is_guarantor=true)
        const { data: guarantorNewRefs } = await supabase
          .from('tenant_references')
          .select('id, submitted_at')
          .eq('guarantor_for_reference_id', dep.reference_id)
          .eq('is_guarantor', true)
          .not('submitted_at', 'is', null)

        if ((guarantorRefs && guarantorRefs.length > 0) || (guarantorNewRefs && guarantorNewRefs.length > 0)) {
          shouldMarkReceived = true
        }
        break
      }
    }

    if (shouldMarkReceived) {
      const { error: updateError } = await supabase
        .from('chase_dependencies')
        .update({
          status: 'RECEIVED',
          next_chase_due_at: null
        })
        .eq('id', dep.id)

      if (updateError) {
        console.error(`  Error updating dependency ${dep.id}:`, updateError.message)
      } else {
        console.log(`  Updated ${dep.dependency_type} for reference ${dep.reference_id} -> RECEIVED`)
        updatedCount++
      }
    }
  }

  console.log(`\nDone! Updated ${updatedCount} dependencies to RECEIVED`)

  // Show summary
  const { data: summary } = await supabase
    .from('chase_dependencies')
    .select('status')

  const statusCounts: Record<string, number> = {}
  summary?.forEach((d: any) => {
    statusCounts[d.status] = (statusCounts[d.status] || 0) + 1
  })

  console.log('\nChase dependency status summary:')
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`)
  })
}

syncChaseDependencyStatus()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Script failed:', err)
    process.exit(1)
  })

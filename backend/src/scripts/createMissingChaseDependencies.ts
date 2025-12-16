/**
 * Script to create chase dependencies for all references that need them
 * Run with: npx ts-node src/scripts/createMissingChaseDependencies.ts
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function createMissingDependencies() {
  console.log('Fetching references that may need chase dependencies...')

  // Get all references that are in_progress or awaiting_guarantor (not completed/rejected/cancelled)
  const { data: references, error: refError } = await supabase
    .from('tenant_references')
    .select(`
      id,
      status,
      tenant_first_name_encrypted,
      tenant_email_encrypted,
      tenant_phone_encrypted,
      employer_ref_name_encrypted,
      employer_ref_email_encrypted,
      employer_ref_phone_encrypted,
      previous_landlord_name_encrypted,
      previous_landlord_email_encrypted,
      previous_landlord_phone_encrypted,
      accountant_name_encrypted,
      accountant_email_encrypted,
      accountant_phone_encrypted,
      guarantor_first_name_encrypted,
      guarantor_last_name_encrypted,
      guarantor_email_encrypted,
      guarantor_phone_encrypted,
      requires_guarantor,
      employer_references (id, submitted_at),
      landlord_references (id, submitted_at),
      agent_references (id, submitted_at),
      accountant_references (id, submitted_at),
      guarantor_references (id, submitted_at)
    `)
    .in('status', ['pending', 'in_progress'])

  if (refError) {
    console.error('Error fetching references:', refError)
    return
  }

  console.log(`Found ${references?.length || 0} active references`)

  let totalCreated = 0

  for (const reference of references || []) {
    const dependenciesToCreate: any[] = []
    const now = new Date().toISOString()

    // Check tenant form status
    if (reference.status === 'pending' && reference.tenant_email_encrypted) {
      dependenciesToCreate.push({
        reference_id: reference.id,
        dependency_type: 'TENANT_FORM',
        contact_name_encrypted: reference.tenant_first_name_encrypted,
        contact_email_encrypted: reference.tenant_email_encrypted,
        contact_phone_encrypted: reference.tenant_phone_encrypted,
        status: 'PENDING',
        initial_request_sent_at: now
      })
    }

    // Check employer reference (if employed)
    const hasEmployerRef = reference.employer_references?.some((er: any) => er.submitted_at)
    if (!hasEmployerRef && reference.employer_ref_email_encrypted) {
      dependenciesToCreate.push({
        reference_id: reference.id,
        dependency_type: 'EMPLOYER_REF',
        contact_name_encrypted: reference.employer_ref_name_encrypted,
        contact_email_encrypted: reference.employer_ref_email_encrypted,
        contact_phone_encrypted: reference.employer_ref_phone_encrypted,
        linked_table: 'employer_references',
        status: 'PENDING',
        initial_request_sent_at: now
      })
    }

    // Check residential reference (landlord or agent)
    const hasLandlordRef = reference.landlord_references?.some((lr: any) => lr.submitted_at)
    const hasAgentRef = reference.agent_references?.some((ar: any) => ar.submitted_at)

    if (!hasLandlordRef && !hasAgentRef && reference.previous_landlord_email_encrypted) {
      dependenciesToCreate.push({
        reference_id: reference.id,
        dependency_type: 'RESIDENTIAL_REF',
        contact_name_encrypted: reference.previous_landlord_name_encrypted,
        contact_email_encrypted: reference.previous_landlord_email_encrypted,
        contact_phone_encrypted: reference.previous_landlord_phone_encrypted,
        linked_table: 'landlord_references',
        status: 'PENDING',
        initial_request_sent_at: now
      })
    }

    // Check accountant reference (if self-employed)
    const hasAccountantRef = reference.accountant_references?.some((ar: any) => ar.submitted_at)
    if (!hasAccountantRef && reference.accountant_email_encrypted) {
      dependenciesToCreate.push({
        reference_id: reference.id,
        dependency_type: 'ACCOUNTANT_REF',
        contact_name_encrypted: reference.accountant_name_encrypted,
        contact_email_encrypted: reference.accountant_email_encrypted,
        contact_phone_encrypted: reference.accountant_phone_encrypted,
        linked_table: 'accountant_references',
        status: 'PENDING',
        initial_request_sent_at: now
      })
    }

    // Check guarantor (if required)
    if (reference.requires_guarantor && reference.guarantor_email_encrypted) {
      const hasGuarantorRef = reference.guarantor_references?.some((gr: any) => gr.submitted_at)
      if (!hasGuarantorRef) {
        dependenciesToCreate.push({
          reference_id: reference.id,
          dependency_type: 'GUARANTOR_FORM',
          contact_email_encrypted: reference.guarantor_email_encrypted,
          contact_phone_encrypted: reference.guarantor_phone_encrypted,
          linked_table: 'guarantor_references',
          status: 'PENDING',
          initial_request_sent_at: now
        })
      }
    }

    if (dependenciesToCreate.length > 0) {
      console.log(`Reference ${reference.id}: Creating ${dependenciesToCreate.length} dependencies`)

      // Upsert to avoid duplicates
      const { data: created, error: insertError } = await supabase
        .from('chase_dependencies')
        .upsert(dependenciesToCreate, {
          onConflict: 'reference_id,dependency_type',
          ignoreDuplicates: true
        })
        .select()

      if (insertError) {
        console.error(`  Error creating dependencies for ${reference.id}:`, insertError.message)
      } else {
        console.log(`  Created/updated ${created?.length || 0} dependencies`)
        totalCreated += created?.length || 0
      }
    }
  }

  console.log(`\nDone! Total dependencies created/updated: ${totalCreated}`)

  // Show summary of chase queue
  const { data: queueData, error: queueError } = await supabase
    .from('chase_dependencies')
    .select('status')
    .in('status', ['PENDING', 'CHASING'])

  if (!queueError) {
    console.log(`Chase queue now has ${queueData?.length || 0} items with PENDING/CHASING status`)
  }
}

createMissingDependencies()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Script failed:', err)
    process.exit(1)
  })

/**
 * One-time script to reprocess existing Creditsafe verifications
 * that failed due to "not found" (no credit history).
 *
 * This updates them to "refer" status with notFound flag,
 * without re-calling the Creditsafe API.
 *
 * Run with: npx ts-node scripts/reprocess-notfound-verifications.ts
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

async function reprocessNotFoundVerifications() {
  console.log('Finding failed verifications that were "not found"...\n')

  // Find all failed verifications where dob_match_score = 0 (indicates verifyMatch was false)
  const { data: failedVerifications, error: fetchError } = await supabase
    .from('creditsafe_verifications')
    .select('id, reference_id, verification_status, dob_match_score, fraud_indicators')
    .eq('verification_status', 'failed')
    .eq('dob_match_score', 0)  // dob_match_score = 0 means verifyMatch was false

  if (fetchError) {
    console.error('Error fetching verifications:', fetchError)
    process.exit(1)
  }

  if (!failedVerifications || failedVerifications.length === 0) {
    console.log('No "not found" failed verifications to reprocess.')
    return
  }

  console.log(`Found ${failedVerifications.length} verification(s) to reprocess:\n`)

  for (const verification of failedVerifications) {
    console.log(`Processing verification ${verification.id} (reference: ${verification.reference_id})`)

    // Parse existing fraud_indicators
    let fraudIndicators: any = {}
    try {
      if (verification.fraud_indicators) {
        fraudIndicators = typeof verification.fraud_indicators === 'string'
          ? JSON.parse(verification.fraud_indicators)
          : verification.fraud_indicators
      }
    } catch {
      console.log(`  - Could not parse fraud_indicators, using empty object`)
    }

    // Add notFound flag
    fraudIndicators.notFound = true

    // Update the verification
    const { error: updateError } = await supabase
      .from('creditsafe_verifications')
      .update({
        verification_status: 'refer',
        fraud_indicators: JSON.stringify(fraudIndicators)
      })
      .eq('id', verification.id)

    if (updateError) {
      console.error(`  - Error updating: ${updateError.message}`)
    } else {
      console.log(`  - Updated to 'refer' status with notFound flag`)
    }
  }

  console.log('\nDone!')
}

reprocessNotFoundVerifications()

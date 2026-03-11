/**
 * One-time script to send guarantor request emails to tenants
 * for completed references with PASS_WITH_GUARANTOR decision but no guarantor assigned.
 *
 * Usage:
 *   DRY_RUN=true npx ts-node scripts/send-guarantor-emails-backfill.ts   # Check what would be sent
 *   npx ts-node scripts/send-guarantor-emails-backfill.ts                 # Actually send emails
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { generateToken, hash, decrypt } from '../src/services/encryption'
import { sendTenantAddGuarantorRequest } from '../src/services/emailService'

dotenv.config()

const DRY_RUN = process.env.DRY_RUN === 'true'
const RESEND = process.env.RESEND === 'true' // Set to resend even if token already exists
const FRONTEND_URL = 'https://app.propertygoose.co.uk' // Always use production URL for backfill

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function backfillGuarantorEmails() {
  console.log(DRY_RUN ? '=== DRY RUN MODE ===' : '=== SENDING EMAILS ===')
  console.log('')

  // Find completed references with PASS_WITH_GUARANTOR decision
  const { data: scores, error: scoresError } = await supabase
    .from('reference_scores')
    .select('reference_id')
    .eq('decision', 'PASS_WITH_GUARANTOR')

  if (scoresError) {
    console.error('Error fetching scores:', scoresError)
    return
  }

  const totalWithDecision = scores?.length || 0
  console.log(`Found ${totalWithDecision} references with PASS_WITH_GUARANTOR decision`)

  if (!scores || scores.length === 0) {
    console.log('No references to process.')
    return
  }

  const referenceIds = scores.map(s => s.reference_id)
  let needsGuarantor = 0
  let emailsSent = 0
  let errors = 0

  for (const refId of referenceIds) {
    // Get reference details
    const { data: ref } = await supabase
      .from('tenant_references')
      .select(`
        id,
        status,
        tenant_email_encrypted,
        tenant_first_name_encrypted,
        tenant_last_name_encrypted,
        property_address_encrypted,
        is_guarantor,
        add_guarantor_token_hash,
        companies:company_id (
          id,
          name_encrypted
        )
      `)
      .eq('id', refId)
      .single()

    // Skip if not completed or is itself a guarantor reference
    if (!ref || ref.status !== 'completed' || ref.is_guarantor) continue

    // Check if guarantor exists (new system)
    const { data: guarantors } = await supabase
      .from('tenant_references')
      .select('id')
      .eq('guarantor_for_reference_id', refId)
      .eq('is_guarantor', true)

    // Check if guarantor exists (old system)
    const { data: oldGuarantor } = await supabase
      .from('guarantor_references')
      .select('id')
      .eq('reference_id', refId)
      .maybeSingle()

    const hasGuarantor = (guarantors && guarantors.length > 0) || oldGuarantor

    if (hasGuarantor) continue

    // This reference needs a guarantor but doesn't have one
    needsGuarantor++

    const tenantEmail = decrypt(ref.tenant_email_encrypted)
    const tenantFirstName = ref.tenant_first_name_encrypted ? decrypt(ref.tenant_first_name_encrypted) || '' : ''
    const tenantLastName = ref.tenant_last_name_encrypted ? decrypt(ref.tenant_last_name_encrypted) || '' : ''
    const tenantName = `${tenantFirstName} ${tenantLastName}`.trim() || 'Tenant'
    const propertyAddress = ref.property_address_encrypted ? decrypt(ref.property_address_encrypted) || 'the property' : 'the property'
    const company = (ref.companies as unknown) as { id: string; name_encrypted: string } | null
    const companyName = company?.name_encrypted ? decrypt(company.name_encrypted) || 'PropertyGoose' : 'PropertyGoose'

    console.log(`\nReference ${refId}:`)
    console.log(`  Tenant: ${tenantName}`)
    console.log(`  Email: ${tenantEmail}`)
    console.log(`  Property: ${propertyAddress}`)
    console.log(`  Agent: ${companyName}`)

    if (!tenantEmail) {
      console.log(`  ⚠️  No email address - SKIPPING`)
      continue
    }

    // Skip if already has a token (email was already sent) - unless RESEND is true
    if (ref.add_guarantor_token_hash && !RESEND) {
      console.log(`  ℹ️  Token already exists - SKIPPING (email was already sent)`)
      continue
    }
    if (ref.add_guarantor_token_hash && RESEND) {
      console.log(`  🔄 Token exists but RESEND=true - will regenerate and resend`)
    }

    if (DRY_RUN) {
      console.log(`  📧 Would send email to: ${tenantEmail}`)
    } else {
      try {
        // Generate token
        const addGuarantorToken = generateToken()
        const addGuarantorTokenHash = hash(addGuarantorToken)
        const tokenExpiresAt = new Date()
        tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 14) // 14-day expiry

        // Save token to reference
        await supabase
          .from('tenant_references')
          .update({
            add_guarantor_token_hash: addGuarantorTokenHash,
            add_guarantor_token_expires_at: tokenExpiresAt.toISOString()
          })
          .eq('id', refId)

        const formLink = `${FRONTEND_URL}/tenant-add-guarantor/${addGuarantorToken}`

        // Send email
        await sendTenantAddGuarantorRequest(
          tenantEmail,
          tenantName,
          propertyAddress,
          companyName,
          formLink,
          refId
        )

        console.log(`  ✅ Email sent successfully`)
        emailsSent++
      } catch (err: any) {
        console.log(`  ❌ Error: ${err.message}`)
        errors++
      }
    }
  }

  console.log('\n=== SUMMARY ===')
  console.log(`Total PASS_WITH_GUARANTOR: ${totalWithDecision}`)
  console.log(`Needing guarantor (no guarantor assigned): ${needsGuarantor}`)
  if (!DRY_RUN) {
    console.log(`Emails sent: ${emailsSent}`)
    console.log(`Errors: ${errors}`)
  }
}

backfillGuarantorEmails()
  .then(() => {
    console.log('\nDone.')
    process.exit(0)
  })
  .catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
  })

/**
 * Backfill missing referees_v2 records for V2 references
 *
 * Some form submissions failed to create referees_v2 records despite
 * having referee email addresses in form_data. This script:
 * 1. Finds all references with referee emails in form_data but no matching referees_v2 record
 * 2. Creates the referees_v2 record
 * 3. Populates the encrypted columns on tenant_references_v2
 * 4. Creates chase items for follow-up
 * 5. Sends the referee request emails
 *
 * Safe to re-run — checks for existing records before creating.
 *
 * Usage: npx tsx src/scripts/backfillMissingReferees.ts
 */

import { createClient } from '@supabase/supabase-js'
import { encrypt, decrypt } from '../services/encryption'
import { createChaseItem } from '../services/v2/chaseServiceV2'
import { initializeSections } from '../services/v2/sectionServiceV2'
import {
  sendEmployerReferenceRequest,
  sendLandlordReferenceRequest,
  sendAccountantReferenceRequest
} from '../services/emailService'
import crypto from 'crypto'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

function hash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function getV2FrontendUrl(): string {
  return process.env.FRONTEND_URL || 'https://app.propertygoose.co.uk'
}

async function backfill() {
  console.log('=== Backfilling missing V2 referees ===\n')

  // Get all non-guarantor refs with form_data
  const { data: allRefs } = await supabase
    .from('tenant_references_v2')
    .select('id, reference_number, status, company_id, form_data, tenant_first_name_encrypted, tenant_last_name_encrypted, employer_ref_email_encrypted, employer_ref_name_encrypted, previous_landlord_email_encrypted, previous_landlord_name_encrypted')
    .eq('is_guarantor', false)
    .not('form_data', 'is', null)

  if (!allRefs?.length) {
    console.log('No references found')
    return
  }

  let createdEmployer = 0, createdLandlord = 0, createdAccountant = 0, errors = 0

  for (const ref of allRefs) {
    const income = ref.form_data?.income
    const residential = ref.form_data?.residential
    const tenantName = `${decrypt(ref.tenant_first_name_encrypted) || ''} ${decrypt(ref.tenant_last_name_encrypted) || ''}`.trim()

    // Check if income-exempt (student/unemployed only)
    const sources: string[] = Array.isArray(income?.sources) ? income.sources : []
    const isIncomeExempt = (
      (sources.length === 1 && (sources.includes('student') || sources.includes('unemployed'))) ||
      (sources.length === 2 && sources.includes('student') && sources.includes('unemployed'))
    )

    // EMPLOYER
    if (income?.employerRefEmail && !isIncomeExempt) {
      const { data: existing } = await supabase
        .from('referees_v2')
        .select('id')
        .eq('reference_id', ref.id)
        .eq('referee_type', 'EMPLOYER')
        .maybeSingle()

      if (!existing) {
        try {
          await createReferee(ref, 'EMPLOYER', income.employerRefEmail, tenantName, income.employerRefName)
          createdEmployer++

          // Populate encrypted columns on reference
          await supabase.from('tenant_references_v2').update({
            employer_ref_email_encrypted: encrypt(income.employerRefEmail),
            employer_ref_name_encrypted: income.employerRefName ? encrypt(income.employerRefName) : null
          }).eq('id', ref.id)
        } catch (err) {
          console.error(`  ERROR creating EMPLOYER for ${ref.reference_number}:`, err)
          errors++
        }
      }
    }

    // LANDLORD
    const llEmail = residential?.currentLandlordEmail
    const llName = residential?.currentLandlordName
    if (llEmail && residential?.currentLivingSituation !== 'living_with_family') {
      const { data: existing } = await supabase
        .from('referees_v2')
        .select('id')
        .eq('reference_id', ref.id)
        .eq('referee_type', 'LANDLORD')
        .maybeSingle()

      if (!existing) {
        try {
          await createReferee(ref, 'LANDLORD', llEmail, tenantName, llName)
          createdLandlord++

          await supabase.from('tenant_references_v2').update({
            previous_landlord_email_encrypted: encrypt(llEmail),
            previous_landlord_name_encrypted: llName ? encrypt(llName) : null
          }).eq('id', ref.id)
        } catch (err) {
          console.error(`  ERROR creating LANDLORD for ${ref.reference_number}:`, err)
          errors++
        }
      }
    }

    // ACCOUNTANT
    if (income?.accountantEmail && !isIncomeExempt) {
      const { data: existing } = await supabase
        .from('referees_v2')
        .select('id')
        .eq('reference_id', ref.id)
        .eq('referee_type', 'ACCOUNTANT')
        .maybeSingle()

      if (!existing) {
        try {
          await createReferee(ref, 'ACCOUNTANT', income.accountantEmail, tenantName, income.accountantName)
          createdAccountant++
        } catch (err) {
          console.error(`  ERROR creating ACCOUNTANT for ${ref.reference_number}:`, err)
          errors++
        }
      }
    }
  }

  console.log(`\n=== Backfill complete ===`)
  console.log(`Created: ${createdEmployer} employer, ${createdLandlord} landlord, ${createdAccountant} accountant`)
  console.log(`Errors: ${errors}`)
}

async function createReferee(
  ref: any,
  refereeType: 'EMPLOYER' | 'LANDLORD' | 'ACCOUNTANT',
  email: string,
  tenantName: string,
  name?: string
) {
  const formToken = generateToken()
  const formTokenHash = hash(formToken)

  console.log(`  Creating ${refereeType} referee for ${ref.reference_number}: ${email}`)

  // Create referees_v2 record
  const { error: insertErr } = await supabase
    .from('referees_v2')
    .insert({
      reference_id: ref.id,
      referee_type: refereeType,
      referee_email_encrypted: encrypt(email),
      referee_name: name || null,
      form_token: formToken,
      form_token_hash: formTokenHash
    })

  if (insertErr) throw insertErr

  // Ensure sections exist
  const { data: sections } = await supabase
    .from('reference_sections_v2')
    .select('id, section_type')
    .eq('reference_id', ref.id)

  if (!sections?.length) {
    await initializeSections(ref.id, false)
  }

  // Create chase item
  const sectionTypeMap: Record<string, string> = { EMPLOYER: 'INCOME', ACCOUNTANT: 'INCOME', LANDLORD: 'RESIDENTIAL' }
  const sectionType = sectionTypeMap[refereeType]
  const { data: section } = await supabase
    .from('reference_sections_v2')
    .select('id')
    .eq('reference_id', ref.id)
    .eq('section_type', sectionType)
    .maybeSingle()

  if (section) {
    // Check if chase item already exists
    const { data: existingChase } = await supabase
      .from('chase_items_v2')
      .select('id')
      .eq('reference_id', ref.id)
      .eq('referee_type', refereeType)
      .eq('chase_type', 'REFEREE')
      .maybeSingle()

    if (!existingChase) {
      await createChaseItem(ref.id, section.id, refereeType, { name: name || 'Referee', email })
    }
  }

  // Send referee email
  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', ref.company_id)
    .maybeSingle()

  const cd = company as any
  const companyName = cd?.name || (cd?.name_encrypted ? decrypt(cd.name_encrypted) : null) || 'PropertyGoose'
  const companyPhone = cd?.phone_encrypted ? decrypt(cd.phone_encrypted) || '' : ''
  const companyEmail = cd?.email_encrypted ? decrypt(cd.email_encrypted) || '' : ''
  const companyLogoUrl = cd?.logo_url || null

  const frontendUrl = getV2FrontendUrl()
  const refereeName = name || 'Referee'
  const pathMap: Record<string, string> = {
    EMPLOYER: 'v2/employer-reference',
    LANDLORD: 'v2/landlord-reference',
    ACCOUNTANT: 'v2/accountant-reference'
  }
  const formUrl = `${frontendUrl}/${pathMap[refereeType]}/${formToken}`

  try {
    if (refereeType === 'EMPLOYER') {
      await sendEmployerReferenceRequest(email, refereeName, tenantName, formUrl, companyName, companyPhone, companyEmail, ref.id, companyLogoUrl)
    } else if (refereeType === 'LANDLORD') {
      await sendLandlordReferenceRequest(email, refereeName, tenantName, formUrl, companyName, companyPhone, companyEmail, ref.id, companyLogoUrl)
    } else if (refereeType === 'ACCOUNTANT') {
      await sendAccountantReferenceRequest(email, refereeName, tenantName, formUrl, companyName, companyPhone, companyEmail, ref.id)
    }
    console.log(`    ✓ Sent ${refereeType} email to ${email}`)
  } catch (emailErr) {
    console.error(`    ✗ Failed to send email to ${email}:`, emailErr)
  }
}

backfill().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

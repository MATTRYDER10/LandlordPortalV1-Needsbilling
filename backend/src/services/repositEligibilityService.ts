/**
 * Reposit Eligibility Service
 *
 * Checks if a V2 reference meets Reposit eligibility criteria:
 * 1. Identity verified (IDENTITY section passed)
 * 2. Affordability passes (30x rule - income >= 30x monthly rent)
 * 3. Credit history clean (no CCJ/IVA/bankruptcy - CREDIT section passed)
 * 4. Right to Rent verified (RTR section passed)
 */

import { supabase } from '../config/supabase'
import { calculateAffordability } from './v2/affordabilityService'

export interface RepositEligibilityResult {
  eligible: boolean
  notes: string
  checks: {
    identity: { passed: boolean; notes: string }
    affordability: { passed: boolean; notes: string; ratio?: number }
    credit: { passed: boolean; notes: string }
    rightToRent: { passed: boolean; notes: string }
  }
}

/**
 * Check if a V2 reference meets Reposit eligibility criteria
 */
export async function checkRepositEligibility(referenceId: string): Promise<RepositEligibilityResult> {
  try {
    // Get reference data
    const { data: reference, error: refError } = await supabase
      .from('tenant_references_v2')
      .select('id, annual_income, rent_share, is_guarantor, monthly_rent, affordability_ratio, affordability_pass')
      .eq('id', referenceId)
      .single()

    if (refError || !reference) {
      return {
        eligible: false,
        notes: 'Reference not found',
        checks: {
          identity: { passed: false, notes: 'Reference not found' },
          affordability: { passed: false, notes: 'Reference not found' },
          credit: { passed: false, notes: 'Reference not found' },
          rightToRent: { passed: false, notes: 'Reference not found' }
        }
      }
    }

    // Get section statuses
    const { data: sections, error: sectionsError } = await supabase
      .from('tenant_reference_sections_v2')
      .select('section_type, decision, queue_status, fail_reason')
      .eq('reference_id', referenceId)

    if (sectionsError) {
      console.error('[RepositEligibility] Error fetching sections:', sectionsError)
    }

    const sectionMap = new Map(sections?.map(s => [s.section_type, s]) || [])

    // 1. Identity Check
    const identitySection = sectionMap.get('IDENTITY')
    const identityPassed = identitySection?.decision === 'PASS'
    const identityNotes = identityPassed
      ? 'Identity verified'
      : identitySection?.decision === 'FAIL'
        ? `Identity check failed: ${identitySection.fail_reason || 'Not specified'}`
        : 'Identity verification pending'

    // 2. Affordability Check (30x rule for tenants, 32x for guarantors)
    let affordabilityPassed = false
    let affordabilityNotes = ''
    let affordabilityRatio: number | undefined

    const rentShare = reference.rent_share || reference.monthly_rent
    const annualIncome = reference.annual_income

    if (annualIncome && rentShare) {
      const affordability = calculateAffordability(
        annualIncome,
        rentShare,
        reference.is_guarantor || false
      )
      affordabilityPassed = affordability.passes
      affordabilityRatio = affordability.ratio
      affordabilityNotes = affordabilityPassed
        ? `Affordability passed (ratio: ${affordability.ratio})`
        : `Affordability failed - income £${annualIncome.toLocaleString()} requires £${affordability.annualIncomeRequired.toLocaleString()} for rent share £${rentShare}`
    } else if (!annualIncome) {
      affordabilityNotes = 'Income not provided'
    } else if (!rentShare) {
      affordabilityNotes = 'Rent share not set'
    }

    // 3. Credit Check (no CCJ/IVA/bankruptcy)
    const creditSection = sectionMap.get('CREDIT')
    const creditPassed = creditSection?.decision === 'PASS'
    let creditNotes = ''

    if (creditPassed) {
      creditNotes = 'Credit history clean'
    } else if (creditSection?.decision === 'FAIL') {
      creditNotes = `Credit check failed: ${creditSection.fail_reason || 'Adverse credit history'}`
    } else if (creditSection?.decision === 'PASS_WITH_CONDITION') {
      creditNotes = 'Credit check passed with condition (may not qualify for Reposit)'
    } else {
      creditNotes = 'Credit check pending'
    }

    // 4. Right to Rent Check
    const rtrSection = sectionMap.get('RTR')
    const rtrPassed = rtrSection?.decision === 'PASS'
    const rtrNotes = rtrPassed
      ? 'Right to Rent verified'
      : rtrSection?.decision === 'FAIL'
        ? `Right to Rent failed: ${rtrSection.fail_reason || 'Not specified'}`
        : 'Right to Rent verification pending'

    // Overall eligibility - all checks must pass
    const allChecksPassed = identityPassed && affordabilityPassed && creditPassed && rtrPassed

    // Build overall notes
    const failedChecks: string[] = []
    if (!identityPassed) failedChecks.push('Identity')
    if (!affordabilityPassed) failedChecks.push('Affordability')
    if (!creditPassed) failedChecks.push('Credit')
    if (!rtrPassed) failedChecks.push('Right to Rent')

    const overallNotes = allChecksPassed
      ? 'All Reposit eligibility criteria met'
      : `Failed checks: ${failedChecks.join(', ')}`

    return {
      eligible: allChecksPassed,
      notes: overallNotes,
      checks: {
        identity: { passed: identityPassed, notes: identityNotes },
        affordability: { passed: affordabilityPassed, notes: affordabilityNotes, ratio: affordabilityRatio },
        credit: { passed: creditPassed, notes: creditNotes },
        rightToRent: { passed: rtrPassed, notes: rtrNotes }
      }
    }
  } catch (error) {
    console.error('[RepositEligibility] Error:', error)
    return {
      eligible: false,
      notes: 'Error checking eligibility',
      checks: {
        identity: { passed: false, notes: 'Error' },
        affordability: { passed: false, notes: 'Error' },
        credit: { passed: false, notes: 'Error' },
        rightToRent: { passed: false, notes: 'Error' }
      }
    }
  }
}

/**
 * Update reference with Reposit eligibility status
 */
export async function updateReferenceRepositEligibility(
  referenceId: string,
  eligible: boolean,
  notes: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('tenant_references_v2')
      .update({
        reposit_eligible: eligible,
        reposit_eligibility_notes: notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', referenceId)

    if (error) {
      console.error('[RepositEligibility] Error updating reference:', error)
      return { success: false, error: 'Failed to update eligibility' }
    }

    return { success: true }
  } catch (error) {
    console.error('[RepositEligibility] Error:', error)
    return { success: false, error: 'Error updating eligibility' }
  }
}

/**
 * Check eligibility for all tenants in a tenancy
 */
export async function checkTenancyRepositEligibility(tenancyId: string): Promise<{
  allEligible: boolean
  tenants: Array<{
    referenceId: string
    tenantName: string
    eligibility: RepositEligibilityResult
  }>
}> {
  try {
    // Get all V2 references linked to this tenancy's offer
    // First, get the offer_id from the tenancy
    const { data: tenancy, error: tenancyError } = await supabase
      .from('tenancies')
      .select('offer_id')
      .eq('id', tenancyId)
      .single()

    if (tenancyError || !tenancy?.offer_id) {
      return { allEligible: false, tenants: [] }
    }

    // Get references from this offer
    const { data: references, error: refError } = await supabase
      .from('tenant_references_v2')
      .select('id, tenant_first_name_encrypted, tenant_last_name_encrypted, is_guarantor')
      .eq('offer_id', tenancy.offer_id)
      .eq('is_guarantor', false) // Only check tenant references, not guarantors

    if (refError || !references?.length) {
      return { allEligible: false, tenants: [] }
    }

    const results: Array<{
      referenceId: string
      tenantName: string
      eligibility: RepositEligibilityResult
    }> = []

    let allEligible = true

    for (const ref of references) {
      const eligibility = await checkRepositEligibility(ref.id)

      // Import decrypt function
      const { decrypt } = await import('./encryption')
      const firstName = decrypt(ref.tenant_first_name_encrypted) || ''
      const lastName = decrypt(ref.tenant_last_name_encrypted) || ''

      results.push({
        referenceId: ref.id,
        tenantName: `${firstName} ${lastName}`.trim() || 'Unknown',
        eligibility
      })

      if (!eligibility.eligible) {
        allEligible = false
      }
    }

    return { allEligible, tenants: results }
  } catch (error) {
    console.error('[RepositEligibility] Error checking tenancy eligibility:', error)
    return { allEligible: false, tenants: [] }
  }
}

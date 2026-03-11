/**
 * V2 Affordability Service
 *
 * Calculates affordability based on income/30 rule for tenants
 * and income/32 rule for guarantors.
 */

import { supabase } from '../../config/supabase'
import { AffordabilityResult } from './types'

/**
 * Calculate affordability ratio and pass/fail
 *
 * @param annualIncome - Annual gross income
 * @param monthlyRentShare - Monthly rent share for this tenant
 * @param isGuarantor - Whether this is a guarantor (stricter ratio)
 * @returns Affordability result with ratio and pass/fail
 */
export function calculateAffordability(
  annualIncome: number,
  monthlyRentShare: number,
  isGuarantor: boolean = false
): AffordabilityResult {
  // Divisor: 30 for tenants, 32 for guarantors (stricter)
  const divisor = isGuarantor ? 32 : 30

  // Calculate what their income allows them to pay per month
  // annual_income / 30 (or 32) must be >= monthly_rent_share
  const affordableRent = annualIncome / divisor

  // Ratio: how much they can afford vs what they need to pay
  // Higher is better. 1.0 = exactly affordable
  const ratio = monthlyRentShare > 0 ? affordableRent / monthlyRentShare : 0

  // Passes if their affordable rent >= their rent share
  const passes = affordableRent >= monthlyRentShare

  // Calculate minimum annual income required
  const annualIncomeRequired = monthlyRentShare * divisor

  return {
    ratio: Math.round(ratio * 100) / 100, // Round to 2 decimal places
    passes,
    annualIncomeRequired
  }
}

/**
 * Update affordability fields on a V2 reference
 *
 * @param referenceId - V2 reference ID
 * @returns Updated reference or null on error
 */
export async function updateReferenceAffordability(
  referenceId: string
): Promise<{ affordability_ratio: number | null; affordability_pass: boolean | null } | null> {
  try {
    // Get reference data
    const { data: reference, error: fetchError } = await supabase
      .from('tenant_references_v2')
      .select('annual_income, rent_share, is_guarantor')
      .eq('id', referenceId)
      .single()

    if (fetchError || !reference) {
      console.error('[AffordabilityService] Failed to fetch reference:', fetchError)
      return null
    }

    // If no income or rent share, can't calculate
    if (!reference.annual_income || !reference.rent_share) {
      return { affordability_ratio: null, affordability_pass: null }
    }

    // Calculate affordability
    const result = calculateAffordability(
      reference.annual_income,
      reference.rent_share,
      reference.is_guarantor || false
    )

    // Update reference
    const { error: updateError } = await supabase
      .from('tenant_references_v2')
      .update({
        affordability_ratio: result.ratio,
        affordability_pass: result.passes,
        updated_at: new Date().toISOString()
      })
      .eq('id', referenceId)

    if (updateError) {
      console.error('[AffordabilityService] Failed to update reference:', updateError)
      return null
    }

    return {
      affordability_ratio: result.ratio,
      affordability_pass: result.passes
    }
  } catch (error) {
    console.error('[AffordabilityService] Error:', error)
    return null
  }
}

/**
 * Calculate affordability for display (without saving)
 *
 * @param annualIncome - Annual gross income
 * @param monthlyRentShare - Monthly rent share
 * @param isGuarantor - Whether guarantor
 * @returns Human-readable affordability summary
 */
export function getAffordabilitySummary(
  annualIncome: number,
  monthlyRentShare: number,
  isGuarantor: boolean = false
): {
  calculation: string
  result: string
  passes: boolean
} {
  const divisor = isGuarantor ? 32 : 30
  const affordableRent = annualIncome / divisor
  const passes = affordableRent >= monthlyRentShare

  return {
    calculation: `£${annualIncome.toLocaleString()} ÷ ${divisor} = £${affordableRent.toFixed(2)}`,
    result: passes
      ? `✓ PASS (can afford £${affordableRent.toFixed(2)}/month, needs £${monthlyRentShare.toFixed(2)})`
      : `✗ FAIL (can afford £${affordableRent.toFixed(2)}/month, needs £${monthlyRentShare.toFixed(2)})`,
    passes
  }
}

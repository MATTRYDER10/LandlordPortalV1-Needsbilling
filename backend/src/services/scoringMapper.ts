import { supabase } from '../config/supabase'
import { decrypt } from './encryption'
import { ApplicantInput } from './scoringService'

/**
 * Maps database reference data to scoring engine input format
 * Fetches all related data: tenant, landlord, employer, guarantor, creditsafe verifications
 */
export async function mapReferenceToScoringInput(referenceId: string): Promise<ApplicantInput | null> {
  try {
    // Fetch tenant reference
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('*')
      .eq('id', referenceId)
      .single()

    if (refError || !reference) {
      console.error('Error fetching reference:', refError)
      return null
    }

    // Fetch landlord reference
    const { data: landlordRef } = await supabase
      .from('landlord_references')
      .select('*')
      .eq('reference_id', referenceId)
      .maybeSingle()

    // Fetch employer reference
    const { data: employerRef } = await supabase
      .from('employer_references')
      .select('*')
      .eq('reference_id', referenceId)
      .maybeSingle()

    // Fetch agent reference (alternative to landlord)
    const { data: agentRef } = await supabase
      .from('agent_references')
      .select('*')
      .eq('reference_id', referenceId)
      .maybeSingle()

    // Fetch creditsafe verification
    const { data: creditsafe } = await supabase
      .from('creditsafe_verifications')
      .select('*')
      .eq('reference_id', referenceId)
      .maybeSingle()

    // Fetch verification checks
    const { data: verification } = await supabase
      .from('verification_checks')
      .select('*')
      .eq('reference_id', referenceId)
      .maybeSingle()

    // Extract and decrypt data
    console.log('[ScoringMapper] Sample reference fields:', {
      monthly_rent: reference.monthly_rent,
      monthly_rent_encrypted: !!reference.monthly_rent_encrypted,
      rent_share: reference.rent_share,
      employment_status_encrypted: !!reference.employment_status_encrypted
    })

    // Try to get monthly rent from various possible fields (check non-encrypted first, then encrypted)
    let monthlyRent = 0
    if (reference.monthly_rent) {
      // Plain field
      monthlyRent = parseFloat(String(reference.monthly_rent))
      console.log('[ScoringMapper] Using monthly_rent (plain):', monthlyRent)
    } else if (reference.monthly_rent_encrypted) {
      monthlyRent = parseFloat(decrypt(reference.monthly_rent_encrypted) || '0')
      console.log('[ScoringMapper] Using monthly_rent_encrypted:', monthlyRent)
    } else if (reference.rent_share) {
      // If they have a rent share, use that
      monthlyRent = parseFloat(String(reference.rent_share))
      console.log('[ScoringMapper] Using rent_share:', monthlyRent)
    }

    const rentShareFraction = reference.rent_share_fraction || 1.0
    const tenancyMonths = reference.term_length || 12

    console.log('[ScoringMapper] Extracted rent values:', {
      monthlyRent,
      rentShareFraction,
      tenancyMonths
    })

    // Map TAS score from creditsafe (scale from 0-100 to 300-900 range)
    let tasScore: number | null = null
    if (creditsafe?.verification_score) {
      // Creditsafe scores are 0-100, TAS scores are typically 300-900
      // Map linearly: 0-100 → 300-900
      tasScore = 300 + (creditsafe.verification_score * 6)
    }

    // Credit events from creditsafe
    const hasCreditScore = !!creditsafe?.verification_score
    const declaredCCJs: { amount: number; satisfied: boolean }[] = []
    const declaredIVA = creditsafe?.fraud_indicators?.insolvency || false
    const declaredBankruptcy = creditsafe?.fraud_indicators?.bankruptcy || false
    const undeclaredAdverseFound = false // This would come from Creditsafe if they found undisclosed adverse

    // ID check from verification_checks
    const idPassed = verification?.id_valid && verification?.id_authentic && verification?.id_name_match && verification?.id_dob_match
    const documentFraud = creditsafe?.document_verified === false || verification?.id_authentic === false
    const proofOfResidency = verification?.address_history_complete || false

    // AML/PEP/Sanctions from creditsafe
    const sanctionsMatch = creditsafe?.sanctions_check_result === true
    const pep = creditsafe?.pep_check_result === true
    const amlAdverse = creditsafe?.adverse_media_result === true

    console.log('[ScoringMapper] Creditsafe AML checks:', {
      has_creditsafe: !!creditsafe,
      sanctionsMatch,
      pep,
      amlAdverse,
      raw_sanctions: creditsafe?.sanctions_check_result,
      raw_pep: creditsafe?.pep_check_result,
      raw_adverse: creditsafe?.adverse_media_result
    })

    // Income data from employer reference or tenant reference
    const employmentStatus = reference.employment_status_encrypted
      ? decrypt(reference.employment_status_encrypted)
      : 'unemployed'

    let incomeType: "employed" | "self_employed" | "temp" | "benefits" | "pension" | "unemployed" = 'unemployed'
    let grossAnnual = 0
    let startInDays = 0
    let contract = ''
    let professionalRole: boolean | null = null
    let selfEmployedYears = 0

    if (employerRef) {
      const annualSalary = employerRef.annual_salary_encrypted
        ? parseFloat(decrypt(employerRef.annual_salary_encrypted) || '0')
        : 0
      grossAnnual = annualSalary

      const employmentType = employerRef.employment_type_encrypted
        ? decrypt(employerRef.employment_type_encrypted)
        : 'permanent'

      if (employmentType?.toLowerCase().includes('temporary') || employmentType?.toLowerCase().includes('temp')) {
        incomeType = 'temp'
      } else {
        incomeType = 'employed'
      }

      contract = employmentType || 'permanent'

      // Calculate start date
      if (employerRef.employment_start_date) {
        const startDate = new Date(employerRef.employment_start_date)
        const now = new Date()
        const diffDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        startInDays = diffDays < 0 ? 0 : diffDays
      }
    } else if (employmentStatus) {
      const empStatus = employmentStatus.toLowerCase()

      if (empStatus.includes('employed') && !empStatus.includes('self')) {
        incomeType = 'employed'
        contract = 'permanent'
        // Try to get income from tenant reference
        if (reference.employed_annual_income_encrypted) {
          grossAnnual = parseFloat(decrypt(reference.employed_annual_income_encrypted) || '0')
        }
      } else if (empStatus.includes('self')) {
        incomeType = 'self_employed'
        if (reference.self_employed_annual_income_encrypted) {
          grossAnnual = parseFloat(decrypt(reference.self_employed_annual_income_encrypted) || '0')
        }
        if (reference.self_employed_years) {
          selfEmployedYears = reference.self_employed_years
        }
      } else if (empStatus.includes('benefit')) {
        incomeType = 'benefits'
        if (reference.benefits_amount_encrypted) {
          const benefitsAmount = parseFloat(decrypt(reference.benefits_amount_encrypted) || '0')
          // If benefits are monthly, annualize
          grossAnnual = benefitsAmount * 12
        }
      } else if (empStatus.includes('pension') || empStatus.includes('retired')) {
        incomeType = 'pension'
        if (reference.pension_amount_encrypted) {
          const pensionAmount = parseFloat(decrypt(reference.pension_amount_encrypted) || '0')
          grossAnnual = pensionAmount * 12
        }
      }
    }

    // Independent means (savings)
    const independentMeans = {
      has_proof: false, // Would need to check if bank statements uploaded
      funds_for_term: 0
    }
    if (reference.savings_amount_encrypted) {
      const savings = parseFloat(decrypt(reference.savings_amount_encrypted) || '0')
      if (savings > 0) {
        independentMeans.has_proof = true
        independentMeans.funds_for_term = savings
      }
    }

    // Landlord reference
    let landlordRefData: ApplicantInput['landlord_ref'] = {
      received: false,
      arrears: 'unknown',
      property_care: 'unknown',
      notes: ''
    }

    if (landlordRef) {
      landlordRefData.received = true

      // Map rent payment history to arrears
      const rentPaidOnTime = landlordRef.rent_paid_on_time_encrypted
        ? decrypt(landlordRef.rent_paid_on_time_encrypted)
        : ''

      if (rentPaidOnTime?.toLowerCase().includes('always') || rentPaidOnTime?.toLowerCase().includes('yes')) {
        landlordRefData.arrears = 'none'
      } else if (rentPaidOnTime?.toLowerCase().includes('sometimes') || rentPaidOnTime?.toLowerCase().includes('minor')) {
        landlordRefData.arrears = 'minor_cleared'
      } else if (rentPaidOnTime?.toLowerCase().includes('never') || rentPaidOnTime?.toLowerCase().includes('severe')) {
        landlordRefData.arrears = 'severe'
      }

      // Map property condition
      const propCondition = landlordRef.property_condition_encrypted
        ? decrypt(landlordRef.property_condition_encrypted)
        : ''

      if (propCondition?.toLowerCase().includes('excellent') || propCondition?.toLowerCase().includes('good')) {
        landlordRefData.property_care = 'good'
      } else if (propCondition?.toLowerCase().includes('fair') || propCondition?.toLowerCase().includes('average')) {
        landlordRefData.property_care = 'fair'
      } else if (propCondition?.toLowerCase().includes('poor') || propCondition?.toLowerCase().includes('bad')) {
        landlordRefData.property_care = 'bad'
      }

      landlordRefData.notes = landlordRef.additional_comments_encrypted
        ? decrypt(landlordRef.additional_comments_encrypted) || ''
        : ''
    } else if (agentRef) {
      landlordRefData.received = true

      const rentPaidOnTime = agentRef.rent_paid_on_time_encrypted
        ? decrypt(agentRef.rent_paid_on_time_encrypted)
        : ''

      if (rentPaidOnTime?.toLowerCase().includes('always') || rentPaidOnTime?.toLowerCase().includes('yes')) {
        landlordRefData.arrears = 'none'
      } else if (rentPaidOnTime?.toLowerCase().includes('sometimes') || rentPaidOnTime?.toLowerCase().includes('minor')) {
        landlordRefData.arrears = 'minor_cleared'
      } else if (rentPaidOnTime?.toLowerCase().includes('never') || rentPaidOnTime?.toLowerCase().includes('severe')) {
        landlordRefData.arrears = 'severe'
      }

      const propCondition = agentRef.property_condition_encrypted
        ? decrypt(agentRef.property_condition_encrypted)
        : ''

      if (propCondition?.toLowerCase().includes('excellent') || propCondition?.toLowerCase().includes('good')) {
        landlordRefData.property_care = 'good'
      } else if (propCondition?.toLowerCase().includes('fair') || propCondition?.toLowerCase().includes('average')) {
        landlordRefData.property_care = 'fair'
      } else if (propCondition?.toLowerCase().includes('poor') || propCondition?.toLowerCase().includes('bad')) {
        landlordRefData.property_care = 'bad'
      }

      landlordRefData.notes = agentRef.additional_comments_encrypted
        ? decrypt(agentRef.additional_comments_encrypted) || ''
        : ''
    }

    // Bank validation present (check if bank statements uploaded)
    const bankValidationPresent = !!reference.bank_statement_path

    // Rent protection underwriting (this would be a business rule)
    const needsRentProtectionUnderwriting = monthlyRent > 2000 // Example threshold

    // Build the ApplicantInput object
    const applicantInput: ApplicantInput = {
      monthly_rent_total: monthlyRent,
      rent_share_fraction: rentShareFraction,
      tenancy_months: tenancyMonths,
      tas_score: tasScore,
      credit_events: {
        declared_ccjs: declaredCCJs,
        declared_iva: declaredIVA,
        declared_bankruptcy: declaredBankruptcy,
        undeclared_adverse_found: undeclaredAdverseFound,
        has_score: hasCreditScore
      },
      id_check: {
        passed: idPassed || false,
        document_fraud: documentFraud || false,
        proof_of_residency_received: proofOfResidency
      },
      aml_pep_sanctions: {
        sanctions_match: sanctionsMatch || false,
        pep: pep || false,
        aml_adverse: amlAdverse || false
      },
      income: {
        type: incomeType,
        gross_annual: grossAnnual,
        start_in_days: startInDays,
        contract: contract,
        professional_role: professionalRole,
        self_employed_years: selfEmployedYears,
        independent_means: independentMeans
      },
      landlord_ref: landlordRefData,
      bank_validation_present: bankValidationPresent,
      needs_rent_protection_underwriting: needsRentProtectionUnderwriting
    }

    console.log('[ScoringMapper] Mapped input:', {
      monthly_rent_total: applicantInput.monthly_rent_total,
      rent_share_fraction: applicantInput.rent_share_fraction,
      tas_score: applicantInput.tas_score,
      has_credit_score: applicantInput.credit_events.has_score,
      id_passed: applicantInput.id_check.passed,
      income_type: applicantInput.income.type,
      gross_annual: applicantInput.income.gross_annual,
      landlord_received: applicantInput.landlord_ref.received,
      bank_validation: applicantInput.bank_validation_present
    })

    return applicantInput
  } catch (error) {
    console.error('[ScoringMapper] Error mapping reference to scoring input:', error)
    return null
  }
}

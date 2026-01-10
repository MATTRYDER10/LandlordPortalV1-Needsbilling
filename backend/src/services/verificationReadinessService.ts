import { supabase } from '../config/supabase'

/**
 * Verification Readiness Service
 *
 * Determines if a reference has minimum viable evidence to enter the Verify queue.
 * Uses simplified "one item per category" rules instead of complex employment-type logic.
 *
 * UPDATED: Now uses minimum viable evidence approach per GitHub Issue #40.
 */

export interface SectionStatus {
  complete: boolean
  reason?: string
}

export interface ReadinessCheck {
  isReady: boolean
  missingItems: string[]
  sectionStatus: {
    tenantForm: SectionStatus
    guarantorForm?: SectionStatus
    identity: SectionStatus
    rightToRent: SectionStatus
    income: SectionStatus
    residential: SectionStatus
  }
}

/**
 * Check if a reference is ready for verification.
 * Returns detailed status of each required section.
 *
 * TENANTS require:
 * - Identity: selfie_path AND id_document_path (both required)
 * - Right to Rent:
 *   - British citizen: passport OR (no_passport + driving license/birth certificate)
 *   - International: share_code (required)
 * - Income: ONE OF - employer ref, payslip, accountant ref, tax return, other_proof_of_funds
 * - Residential: ONE OF - confirmed_residential_status, landlord ref, agent ref, tenancy_agreement
 *
 * GUARANTORS require ONLY:
 * - Identity: selfie_path AND id_document_path
 * - Income: Same as tenant
 * - NO Residential, NO Right to Rent
 */
export async function isReadyForVerification(referenceId: string): Promise<ReadinessCheck> {
  try {
    // Get reference with all related data
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select(`
        id,
        status,
        is_guarantor,
        requires_guarantor,
        guarantor_for_reference_id,
        guarantor_email_encrypted,
        guarantor_first_name_encrypted,
        income_student,
        income_regular_employment,
        income_self_employed,
        income_benefits,
        income_unemployed,
        is_british_citizen,
        id_document_path,
        selfie_path,
        rtr_share_code,
        rtr_alternative_document_path,
        rtr_british_passport_path,
        rtr_british_no_passport,
        rtr_british_alt_doc_path,
        tax_return_path,
        payslip_files,
        other_proof_of_funds_path,
        proof_of_additional_income_path,
        tenancy_agreement_path,
        confirmed_residential_status,
        reference_type,
        employer_references (id, submitted_at),
        landlord_references (id, submitted_at),
        agent_references (id, submitted_at),
        accountant_references (id, submitted_at)
      `)
      .eq('id', referenceId)
      .single()

    if (refError || !reference) {
      return {
        isReady: false,
        missingItems: ['Reference not found'],
        sectionStatus: {
          tenantForm: { complete: false, reason: 'Reference not found' },
          identity: { complete: false },
          rightToRent: { complete: false },
          income: { complete: false },
          residential: { complete: false }
        }
      }
    }

    const isGuarantor = reference.is_guarantor === true
    const missingItems: string[] = []
    const sectionStatus: ReadinessCheck['sectionStatus'] = {
      tenantForm: { complete: false },
      identity: { complete: false },
      rightToRent: { complete: false },
      income: { complete: false },
      residential: { complete: false }
    }

    // -------------------------------------------------------------------------
    // 1. TENANT FORM - Check tenant has submitted (not in 'pending' status)
    // -------------------------------------------------------------------------
    if (reference.status === 'pending') {
      missingItems.push('Tenant form not submitted')
      sectionStatus.tenantForm = { complete: false, reason: 'Tenant has not submitted their form' }
    } else {
      sectionStatus.tenantForm = { complete: true }
    }

    // -------------------------------------------------------------------------
    // 2. GUARANTOR FORM - Check if required and submitted
    // -------------------------------------------------------------------------
    if (reference.requires_guarantor && !isGuarantor) {
      const isStudentOnly = reference.income_student &&
                            !reference.income_regular_employment &&
                            !reference.income_self_employed &&
                            !reference.income_benefits

      const hasGuarantorContactDetails = !!(
        reference.guarantor_email_encrypted ||
        reference.guarantor_first_name_encrypted
      )

      const { data: guarantorRef } = await supabase
        .from('tenant_references')
        .select('id, status')
        .eq('guarantor_for_reference_id', referenceId)
        .eq('is_guarantor', true)
        .single()

      if (isStudentOnly && hasGuarantorContactDetails) {
        sectionStatus.guarantorForm = {
          complete: true,
          reason: 'Student with guarantor - form pending but not blocking'
        }
      } else if (!guarantorRef) {
        missingItems.push('Guarantor form not submitted')
        sectionStatus.guarantorForm = { complete: false, reason: 'Guarantor reference not found' }
      } else if (guarantorRef.status === 'pending') {
        missingItems.push('Guarantor form not submitted')
        sectionStatus.guarantorForm = { complete: false, reason: 'Guarantor has not submitted their form' }
      } else {
        sectionStatus.guarantorForm = { complete: true }
      }
    }

    // -------------------------------------------------------------------------
    // 3. IDENTITY - Both selfie AND ID document required
    // -------------------------------------------------------------------------
    if (!reference.id_document_path || !reference.selfie_path) {
      const missing = []
      if (!reference.id_document_path) missing.push('ID document')
      if (!reference.selfie_path) missing.push('selfie')
      missingItems.push(`Missing identity: ${missing.join(', ')}`)
      sectionStatus.identity = { complete: false, reason: `Missing: ${missing.join(', ')}` }
    } else {
      sectionStatus.identity = { complete: true }
    }

    // -------------------------------------------------------------------------
    // 4. RIGHT TO RENT - British citizen auto-completes, else need document
    // Guarantors skip this check entirely
    // -------------------------------------------------------------------------
    if (isGuarantor) {
      sectionStatus.rightToRent = { complete: true, reason: 'Guarantors do not require Right to Rent' }
    } else {
      const rightToRentCheck = checkRightToRentSection(reference)
      sectionStatus.rightToRent = rightToRentCheck
      if (!rightToRentCheck.complete) {
        missingItems.push(rightToRentCheck.reason || 'Right to Rent verification incomplete')
      }
    }

    // -------------------------------------------------------------------------
    // 5. INCOME - ONE of: employer ref, payslip, accountant ref, tax return, other proof of funds
    // -------------------------------------------------------------------------
    const incomeCheck = checkIncomeSection(reference)
    sectionStatus.income = incomeCheck
    if (!incomeCheck.complete) {
      missingItems.push(incomeCheck.reason || 'Income verification incomplete')
    }

    // -------------------------------------------------------------------------
    // 6. RESIDENTIAL - ONE of: confirmed status, landlord ref, agent ref, tenancy agreement
    // Guarantors skip this check entirely
    // -------------------------------------------------------------------------
    if (isGuarantor) {
      sectionStatus.residential = { complete: true, reason: 'Guarantors do not require residential verification' }
    } else {
      const residentialCheck = checkResidentialSection(reference)
      sectionStatus.residential = residentialCheck
      if (!residentialCheck.complete) {
        missingItems.push(residentialCheck.reason || 'Residential verification incomplete')
      }
    }

    const isReady = missingItems.length === 0

    return {
      isReady,
      missingItems,
      sectionStatus
    }
  } catch (error) {
    console.error('Error checking verification readiness:', error)
    return {
      isReady: false,
      missingItems: ['Error checking readiness'],
      sectionStatus: {
        tenantForm: { complete: false },
        identity: { complete: false },
        rightToRent: { complete: false },
        income: { complete: false },
        residential: { complete: false }
      }
    }
  }
}

/**
 * Check Right to Rent section
 *
 * Rules (NEW references):
 * - British citizen: Need passport OR (no_passport + driving license/birth certificate)
 * - International: Need share code (required)
 *
 * Backwards compatibility (OLD references without new fields):
 * - British citizen without new doc fields: Auto-complete (old behavior)
 * - International with alternative_document but no share_code: Accept document
 */
function checkRightToRentSection(reference: any): SectionStatus {
  // British citizen
  if (reference.is_british_citizen === true) {
    const hasPassport = !!reference.rtr_british_passport_path
    const hasNoPassport = reference.rtr_british_no_passport === true
    const hasAltDoc = !!reference.rtr_british_alt_doc_path

    // New flow: passport or alt doc required
    if (hasPassport) {
      return { complete: true, reason: 'British citizen - passport uploaded' }
    }
    if (hasNoPassport && hasAltDoc) {
      return { complete: true, reason: 'British citizen - alternative document uploaded' }
    }
    if (hasNoPassport && !hasAltDoc) {
      return { complete: false, reason: 'British citizen without passport - driving license or birth certificate required' }
    }

    // Backwards compatibility: If no new RTR fields exist at all, this is an old reference
    // Old British citizens were auto-complete - don't break them
    const hasAnyNewRtrFields = hasPassport || hasNoPassport || hasAltDoc
    if (!hasAnyNewRtrFields) {
      return { complete: true, reason: 'British citizen (legacy reference)' }
    }

    // New reference in progress - needs documents
    return { complete: false, reason: 'British citizen - passport or alternative document required' }
  }

  // International
  if (reference.is_british_citizen === false) {
    const hasShareCode = !!reference.rtr_share_code
    const hasAlternativeDoc = !!reference.rtr_alternative_document_path

    // New flow: share code required
    if (hasShareCode) {
      return { complete: true, reason: 'RTR share code provided' }
    }

    // Backwards compatibility: Old references might only have alternative document
    if (hasAlternativeDoc) {
      return { complete: true, reason: 'RTR document uploaded (legacy reference)' }
    }

    return { complete: false, reason: 'Share code required for international tenants' }
  }

  // is_british_citizen is null - question not answered yet, don't block
  return { complete: true, reason: 'Citizenship status not yet confirmed' }
}

/**
 * Check income section - simplified "one item" rule
 *
 * Rules:
 * - ONE of: employer reference, payslip, accountant reference, tax return, other proof of funds
 * - SPECIAL CASE: Unemployed + Living with Family = auto-pass (no income evidence required)
 */
function checkIncomeSection(reference: any): SectionStatus {
  // Special case: Unemployed + Living with Family
  // These references should auto-pass to verify queue without income evidence
  // Check both confirmed_residential_status (new field) and reference_type (legacy field)
  const isUnemployed = reference.income_unemployed === true
  const isLivingWithFamily =
    reference.confirmed_residential_status === 'Living with Family' ||
    reference.reference_type === 'living_with_family'

  if (isUnemployed && isLivingWithFamily) {
    return { complete: true, reason: 'Unemployed and living with family - no income verification required' }
  }

  const hasEmployerRef = (reference.employer_references || []).some((er: any) => er.submitted_at)
  const hasPayslips = Array.isArray(reference.payslip_files) && reference.payslip_files.length > 0
  const hasAccountantRef = (reference.accountant_references || []).some((ar: any) => ar.submitted_at)
  const hasTaxReturn = !!reference.tax_return_path
  const hasOtherProofOfFunds = !!reference.other_proof_of_funds_path
  const hasAdditionalIncomeProof = !!reference.proof_of_additional_income_path

  // Check if ANY income evidence exists
  if (hasEmployerRef) {
    return { complete: true, reason: 'Employer reference received' }
  }
  if (hasPayslips) {
    return { complete: true, reason: 'Payslips uploaded' }
  }
  if (hasAccountantRef) {
    return { complete: true, reason: 'Accountant reference received' }
  }
  if (hasTaxReturn) {
    return { complete: true, reason: 'Tax return uploaded' }
  }
  if (hasOtherProofOfFunds) {
    return { complete: true, reason: 'Other proof of funds uploaded' }
  }
  if (hasAdditionalIncomeProof) {
    return { complete: true, reason: 'Proof of additional income uploaded' }
  }

  return { complete: false, reason: 'Income evidence required (payslip, employer ref, tax return, or other proof)' }
}

/**
 * Check residential section - simplified "one item" rule
 *
 * Rules:
 * - ONE of: confirmed residential status, landlord reference, agent reference, tenancy agreement
 */
function checkResidentialSection(reference: any): SectionStatus {
  // Confirmed status (living with family, owner occupier, etc.)
  if (reference.confirmed_residential_status) {
    return { complete: true, reason: `Residential status: ${reference.confirmed_residential_status}` }
  }

  // Tenant selected "living with family" - no landlord reference required
  if (reference.reference_type === 'living_with_family') {
    return { complete: true, reason: 'Living with family - no landlord reference required' }
  }

  // Landlord reference
  const hasLandlordRef = (reference.landlord_references || []).some((lr: any) => lr.submitted_at)
  if (hasLandlordRef) {
    return { complete: true, reason: 'Landlord reference received' }
  }

  // Agent reference
  const hasAgentRef = (reference.agent_references || []).some((ar: any) => ar.submitted_at)
  if (hasAgentRef) {
    return { complete: true, reason: 'Agent reference received' }
  }

  // Tenancy agreement (new evidence type)
  if (reference.tenancy_agreement_path) {
    return { complete: true, reason: 'Tenancy agreement uploaded' }
  }

  return { complete: false, reason: 'Residential evidence required (landlord ref, tenancy agreement, or confirm status)' }
}

/**
 * Quick check if reference is ready - returns boolean only
 */
export async function isReady(referenceId: string): Promise<boolean> {
  const result = await isReadyForVerification(referenceId)
  return result.isReady
}

/**
 * Sync version of readiness check for use with pre-fetched reference data.
 * This is used by the /references page to determine display status without additional DB calls.
 *
 * The reference object must include these fields:
 * - is_guarantor, status, is_british_citizen
 * - id_document_path, selfie_path, rtr_share_code, rtr_alternative_document_path
 * - rtr_british_passport_path, rtr_british_no_passport, rtr_british_alt_doc_path
 * - tax_return_path, payslip_files, other_proof_of_funds_path
 * - tenancy_agreement_path, confirmed_residential_status
 * - employer_references, landlord_references, agent_references, accountant_references (as arrays with submitted_at)
 */
export function isReadyForVerificationSync(reference: any): { isReady: boolean; reason?: string } {
  const isGuarantor = reference.is_guarantor === true

  // 1. Check identity (ID + selfie required)
  if (!reference.id_document_path || !reference.selfie_path) {
    const missing = []
    if (!reference.id_document_path) missing.push('ID document')
    if (!reference.selfie_path) missing.push('selfie')
    return { isReady: false, reason: `Missing: ${missing.join(', ')}` }
  }

  // 2. Check Right to Rent (tenants only)
  if (!isGuarantor) {
    const rtrCheck = checkRightToRentSectionSync(reference)
    if (!rtrCheck.complete) {
      return { isReady: false, reason: rtrCheck.reason }
    }
  }

  // 3. Check income
  const incomeCheck = checkIncomeSectionSync(reference)
  if (!incomeCheck.complete) {
    return { isReady: false, reason: incomeCheck.reason }
  }

  // 4. Check residential (tenants only)
  if (!isGuarantor) {
    const residentialCheck = checkResidentialSectionSync(reference)
    if (!residentialCheck.complete) {
      return { isReady: false, reason: residentialCheck.reason }
    }
  }

  return { isReady: true }
}

/**
 * Sync version of Right to Rent check (with backwards compatibility)
 */
function checkRightToRentSectionSync(reference: any): SectionStatus {
  // British citizen
  if (reference.is_british_citizen === true) {
    const hasPassport = !!reference.rtr_british_passport_path
    const hasNoPassport = reference.rtr_british_no_passport === true
    const hasAltDoc = !!reference.rtr_british_alt_doc_path

    if (hasPassport) {
      return { complete: true, reason: 'British citizen - passport' }
    }
    if (hasNoPassport && hasAltDoc) {
      return { complete: true, reason: 'British citizen - alt document' }
    }
    if (hasNoPassport && !hasAltDoc) {
      return { complete: false, reason: 'British citizen - alternative document required' }
    }

    // Backwards compatibility: old references without new fields
    const hasAnyNewRtrFields = hasPassport || hasNoPassport || hasAltDoc
    if (!hasAnyNewRtrFields) {
      return { complete: true, reason: 'British citizen (legacy)' }
    }

    return { complete: false, reason: 'British citizen - passport required' }
  }

  // International
  if (reference.is_british_citizen === false) {
    const hasShareCode = !!reference.rtr_share_code
    const hasAlternativeDoc = !!reference.rtr_alternative_document_path

    if (hasShareCode) {
      return { complete: true, reason: 'Share code provided' }
    }
    // Backwards compatibility: old references with only alternative document
    if (hasAlternativeDoc) {
      return { complete: true, reason: 'RTR document (legacy)' }
    }
    return { complete: false, reason: 'Share code required' }
  }

  return { complete: true, reason: 'Citizenship status not confirmed' }
}

/**
 * Sync version of income check - simplified "one item" rule
 * - SPECIAL CASE: Unemployed + Living with Family = auto-pass (no income evidence required)
 */
function checkIncomeSectionSync(reference: any): SectionStatus {
  // Special case: Unemployed + Living with Family
  // Check both confirmed_residential_status (new field) and reference_type (legacy field)
  const isUnemployed = reference.income_unemployed === true
  const isLivingWithFamily =
    reference.confirmed_residential_status === 'Living with Family' ||
    reference.reference_type === 'living_with_family'

  if (isUnemployed && isLivingWithFamily) {
    return { complete: true, reason: 'Unemployed and living with family - no income verification required' }
  }

  const hasEmployerRef = (reference.employer_references || []).some((er: any) => er.submitted_at)
  const hasPayslips = Array.isArray(reference.payslip_files) && reference.payslip_files.length > 0
  const hasAccountantRef = (reference.accountant_references || []).some((ar: any) => ar.submitted_at)
  const hasTaxReturn = !!reference.tax_return_path
  const hasOtherProofOfFunds = !!reference.other_proof_of_funds_path
  const hasAdditionalIncomeProof = !!reference.proof_of_additional_income_path

  if (hasEmployerRef || hasPayslips || hasAccountantRef || hasTaxReturn || hasOtherProofOfFunds || hasAdditionalIncomeProof) {
    return { complete: true }
  }

  return { complete: false, reason: 'Income evidence required' }
}

/**
 * Sync version of residential check - simplified "one item" rule
 */
function checkResidentialSectionSync(reference: any): SectionStatus {
  if (reference.confirmed_residential_status) {
    return { complete: true, reason: `Residential status: ${reference.confirmed_residential_status}` }
  }

  // Tenant selected "living with family" - no landlord reference required
  if (reference.reference_type === 'living_with_family') {
    return { complete: true, reason: 'Living with family' }
  }

  const hasLandlordRef = (reference.landlord_references || []).some((lr: any) => lr.submitted_at)
  const hasAgentRef = (reference.agent_references || []).some((ar: any) => ar.submitted_at)
  const hasTenancyAgreement = !!reference.tenancy_agreement_path

  if (hasLandlordRef || hasAgentRef || hasTenancyAgreement) {
    return { complete: true }
  }

  return { complete: false, reason: 'Residential evidence required' }
}

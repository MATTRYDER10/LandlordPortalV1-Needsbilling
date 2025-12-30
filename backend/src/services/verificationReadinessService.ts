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
 * - Right to Rent: is_british_citizen=true OR RTR document uploaded
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
        is_british_citizen,
        id_document_path,
        selfie_path,
        rtr_share_code,
        rtr_alternative_document_path,
        tax_return_path,
        payslip_files,
        other_proof_of_funds_path,
        tenancy_agreement_path,
        confirmed_residential_status,
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
 * Rules:
 * - British citizen (is_british_citizen=true) -> auto-complete
 * - Otherwise need RTR share code OR alternative document
 */
function checkRightToRentSection(reference: any): SectionStatus {
  // British citizen - auto-complete
  if (reference.is_british_citizen === true) {
    return { complete: true, reason: 'British citizen - Right to Rent verified' }
  }

  // Check for RTR documentation
  const hasShareCode = !!reference.rtr_share_code
  const hasAlternativeDoc = !!reference.rtr_alternative_document_path

  if (hasShareCode || hasAlternativeDoc) {
    return { complete: true, reason: hasShareCode ? 'RTR share code provided' : 'RTR document uploaded' }
  }

  // Not British and no RTR documentation
  // Only require RTR if explicitly not British (is_british_citizen === false)
  // If is_british_citizen is null, they haven't answered yet
  if (reference.is_british_citizen === false) {
    return { complete: false, reason: 'Right to Rent documentation required (non-British citizen)' }
  }

  // is_british_citizen is null - question not answered yet, don't block
  return { complete: true, reason: 'Citizenship status not yet confirmed' }
}

/**
 * Check income section - simplified "one item" rule
 *
 * Rules:
 * - ONE of: employer reference, payslip, accountant reference, tax return, other proof of funds
 */
function checkIncomeSection(reference: any): SectionStatus {
  const hasEmployerRef = (reference.employer_references || []).some((er: any) => er.submitted_at)
  const hasPayslips = Array.isArray(reference.payslip_files) && reference.payslip_files.length > 0
  const hasAccountantRef = (reference.accountant_references || []).some((ar: any) => ar.submitted_at)
  const hasTaxReturn = !!reference.tax_return_path
  const hasOtherProofOfFunds = !!reference.other_proof_of_funds_path

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
 * Sync version of Right to Rent check
 */
function checkRightToRentSectionSync(reference: any): SectionStatus {
  if (reference.is_british_citizen === true) {
    return { complete: true, reason: 'British citizen' }
  }

  const hasShareCode = !!reference.rtr_share_code
  const hasAlternativeDoc = !!reference.rtr_alternative_document_path

  if (hasShareCode || hasAlternativeDoc) {
    return { complete: true }
  }

  if (reference.is_british_citizen === false) {
    return { complete: false, reason: 'Right to Rent documentation required' }
  }

  return { complete: true, reason: 'Citizenship status not confirmed' }
}

/**
 * Sync version of income check - simplified "one item" rule
 */
function checkIncomeSectionSync(reference: any): SectionStatus {
  const hasEmployerRef = (reference.employer_references || []).some((er: any) => er.submitted_at)
  const hasPayslips = Array.isArray(reference.payslip_files) && reference.payslip_files.length > 0
  const hasAccountantRef = (reference.accountant_references || []).some((ar: any) => ar.submitted_at)
  const hasTaxReturn = !!reference.tax_return_path
  const hasOtherProofOfFunds = !!reference.other_proof_of_funds_path

  if (hasEmployerRef || hasPayslips || hasAccountantRef || hasTaxReturn || hasOtherProofOfFunds) {
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

  const hasLandlordRef = (reference.landlord_references || []).some((lr: any) => lr.submitted_at)
  const hasAgentRef = (reference.agent_references || []).some((ar: any) => ar.submitted_at)
  const hasTenancyAgreement = !!reference.tenancy_agreement_path

  if (hasLandlordRef || hasAgentRef || hasTenancyAgreement) {
    return { complete: true }
  }

  return { complete: false, reason: 'Residential evidence required' }
}

import { supabase } from '../config/supabase'

/**
 * Verification Readiness Service
 *
 * Determines if a reference has ALL required data to enter the Verify queue.
 * A reference should only be in 'pending_verification' status and appear in
 * the Verify queue if ALL required fields are filled out OR evidence is uploaded.
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
    income: SectionStatus
    residential: SectionStatus
    identity: SectionStatus
  }
}

/**
 * Check if a reference is ready for verification.
 * Returns detailed status of each required section.
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
        income_student,
        income_regular_employment,
        income_self_employed,
        income_benefits,
        employment_salary_amount_encrypted,
        benefits_annual_amount_encrypted,
        self_employed_annual_income_encrypted,
        id_document_path,
        selfie_path,
        tax_return_path,
        payslip_files,
        confirmed_residential_status,
        previous_landlord_email_encrypted,
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
          income: { complete: false },
          residential: { complete: false },
          identity: { complete: false }
        }
      }
    }

    const missingItems: string[] = []
    const sectionStatus: ReadinessCheck['sectionStatus'] = {
      tenantForm: { complete: false },
      income: { complete: false },
      residential: { complete: false },
      identity: { complete: false }
    }

    // 1. TENANT FORM - Check tenant has submitted (not in 'pending' status)
    if (reference.status === 'pending') {
      missingItems.push('Tenant form not submitted')
      sectionStatus.tenantForm = { complete: false, reason: 'Tenant has not submitted their form' }
    } else {
      sectionStatus.tenantForm = { complete: true }
    }

    // 2. GUARANTOR FORM - Check if required and submitted
    if (reference.requires_guarantor && !reference.is_guarantor) {
      // Find guarantor reference for this tenant
      const { data: guarantorRef } = await supabase
        .from('tenant_references')
        .select('id, status')
        .eq('guarantor_for_reference_id', referenceId)
        .eq('is_guarantor', true)
        .single()

      if (!guarantorRef) {
        missingItems.push('Guarantor form not submitted')
        sectionStatus.guarantorForm = { complete: false, reason: 'Guarantor reference not found' }
      } else if (guarantorRef.status === 'pending') {
        missingItems.push('Guarantor form not submitted')
        sectionStatus.guarantorForm = { complete: false, reason: 'Guarantor has not submitted their form' }
      } else {
        sectionStatus.guarantorForm = { complete: true }
      }
    }

    // 3. INCOME SECTION - Complex logic based on employment type
    const incomeComplete = checkIncomeSection(reference)
    sectionStatus.income = incomeComplete
    if (!incomeComplete.complete) {
      missingItems.push(incomeComplete.reason || 'Income verification incomplete')
    }

    // 4. RESIDENTIAL SECTION - Landlord/Agent reference or alternative status
    const residentialComplete = checkResidentialSection(reference)
    sectionStatus.residential = residentialComplete
    if (!residentialComplete.complete) {
      missingItems.push(residentialComplete.reason || 'Residential verification incomplete')
    }

    // 5. IDENTITY SECTION - ID document and selfie required
    if (!reference.id_document_path || !reference.selfie_path) {
      const missing = []
      if (!reference.id_document_path) missing.push('ID document')
      if (!reference.selfie_path) missing.push('selfie')
      missingItems.push(`Missing identity documents: ${missing.join(', ')}`)
      sectionStatus.identity = { complete: false, reason: `Missing: ${missing.join(', ')}` }
    } else {
      sectionStatus.identity = { complete: true }
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
        income: { complete: false },
        residential: { complete: false },
        identity: { complete: false }
      }
    }
  }
}

/**
 * Check if income section is complete based on employment type
 */
function checkIncomeSection(reference: any): SectionStatus {
  // Students don't need income proof
  if (reference.income_student) {
    return { complete: true, reason: 'Student - no income proof required' }
  }

  // If employed - need employer reference OR 3+ payslips
  if (reference.income_regular_employment) {
    const hasEmployerRef = reference.employer_references?.some((er: any) => er.submitted_at)
    const payslipCount = reference.payslip_files?.length || 0
    const hasEnoughPayslips = payslipCount >= 3

    if (hasEmployerRef) {
      return { complete: true }
    }
    if (hasEnoughPayslips) {
      return { complete: true, reason: '3+ payslips uploaded' }
    }

    return {
      complete: false,
      reason: `Employed: need employer reference OR 3+ payslips (have ${payslipCount})`
    }
  }

  // If self-employed - need accountant reference OR tax return
  if (reference.income_self_employed) {
    const hasAccountantRef = reference.accountant_references?.some((ar: any) => ar.submitted_at)
    const hasTaxReturn = !!reference.tax_return_path

    if (hasAccountantRef) {
      return { complete: true }
    }
    if (hasTaxReturn) {
      return { complete: true, reason: 'Tax return uploaded' }
    }

    return {
      complete: false,
      reason: 'Self-employed: need accountant reference OR tax return'
    }
  }

  // If benefits only - check benefits fields are filled
  if (reference.income_benefits) {
    if (reference.benefits_annual_amount_encrypted) {
      return { complete: true }
    }
    return {
      complete: false,
      reason: 'Benefits income: need benefits amount filled'
    }
  }

  // No income type selected - check if any income fields are filled
  const hasSalary = !!reference.employment_salary_amount_encrypted
  const hasBenefits = !!reference.benefits_annual_amount_encrypted
  const hasSelfEmployed = !!reference.self_employed_annual_income_encrypted

  if (hasSalary || hasBenefits || hasSelfEmployed) {
    // Some income declared - check if verification evidence exists
    const hasEmployerRef = reference.employer_references?.some((er: any) => er.submitted_at)
    const hasAccountantRef = reference.accountant_references?.some((ar: any) => ar.submitted_at)
    const payslipCount = reference.payslip_files?.length || 0
    const hasTaxReturn = !!reference.tax_return_path

    if (hasEmployerRef || hasAccountantRef || payslipCount >= 3 || hasTaxReturn) {
      return { complete: true }
    }

    return {
      complete: false,
      reason: 'Income declared but no verification evidence'
    }
  }

  // No income type and no income declared - might be zero income which is valid
  return { complete: true, reason: 'No income declared' }
}

/**
 * Check if residential section is complete
 */
function checkResidentialSection(reference: any): SectionStatus {
  // If confirmed residential status is set (e.g., living with family, owner occupier)
  // then no landlord/agent reference is needed
  if (reference.confirmed_residential_status) {
    return { complete: true, reason: `Residential status: ${reference.confirmed_residential_status}` }
  }

  // Check if landlord or agent reference exists
  const hasLandlordRef = reference.landlord_references?.some((lr: any) => lr.submitted_at)
  const hasAgentRef = reference.agent_references?.some((ar: any) => ar.submitted_at)

  if (hasLandlordRef || hasAgentRef) {
    return { complete: true }
  }

  // Check if landlord email was provided (meaning they expect a reference)
  if (reference.previous_landlord_email_encrypted) {
    return {
      complete: false,
      reason: 'Landlord/Agent reference requested but not received'
    }
  }

  // No landlord email provided - assume not renting or alternative living situation
  return { complete: true, reason: 'No landlord reference required' }
}

/**
 * Quick check if reference is ready - returns boolean only
 */
export async function isReady(referenceId: string): Promise<boolean> {
  const result = await isReadyForVerification(referenceId)
  return result.isReady
}

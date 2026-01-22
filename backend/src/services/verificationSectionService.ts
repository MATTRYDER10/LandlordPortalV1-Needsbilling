import { supabase } from '../config/supabase'
import { logAuditAction } from './auditService'
import { transitionState } from './verificationStateService'
import { sendActionRequiredNotification } from './emailService'

// Section types
export type SectionDecision = 'NOT_REVIEWED' | 'PASS' | 'PASS_WITH_CONDITION' | 'ACTION_REQUIRED' | 'FAIL'
export type TenantSectionType = 'IDENTITY_SELFIE' | 'RTR' | 'INCOME' | 'RESIDENTIAL' | 'CREDIT' | 'AML'
export type GuarantorSectionType = 'IDENTITY_SELFIE' | 'INCOME' | 'CREDIT' | 'AML'
export type ExternalReferenceSectionType = 'EMPLOYER_REFERENCE' | 'LANDLORD_REFERENCE' | 'ACCOUNTANT_REFERENCE'
export type SectionType = TenantSectionType | GuarantorSectionType | ExternalReferenceSectionType
export type PersonType = 'TENANT' | 'GUARANTOR'

const TENANT_SECTIONS: TenantSectionType[] = ['IDENTITY_SELFIE', 'RTR', 'INCOME', 'RESIDENTIAL', 'CREDIT', 'AML']
const GUARANTOR_SECTIONS: GuarantorSectionType[] = ['IDENTITY_SELFIE', 'INCOME', 'CREDIT', 'AML']

export interface VerificationSection {
  id: string
  referenceId: string
  personType: PersonType
  sectionType: SectionType
  sectionOrder: number
  decision: SectionDecision
  decisionNotes?: string
  decisionBy?: string
  decisionAt?: string
  conditionText?: string
  actionReasonCode?: string
  actionAgentNote?: string
  actionInternalNote?: string
  failReason?: string
  correctionCycle: number
  evidenceSources: any[]
  evidenceFiles: any[]
  checks: any[]
  scoreImpact: number
  createdAt: string
  updatedAt: string
}

export interface ActionRequiredParams {
  reasonCode: string
  agentNote: string
  internalNote?: string
}

export interface PassWithConditionParams {
  conditionText: string
}

export interface FailParams {
  failReason: string
}

/**
 * Initialize verification sections for a reference
 * Creates 6 sections for tenants, 4 for guarantors
 */
export async function initializeSections(referenceId: string): Promise<VerificationSection[]> {
  try {
    // Check if reference is a guarantor
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('is_guarantor')
      .eq('id', referenceId)
      .single()

    if (refError) throw refError

    const isGuarantor = reference?.is_guarantor || false
    const personType: PersonType = isGuarantor ? 'GUARANTOR' : 'TENANT'
    const sections = isGuarantor ? GUARANTOR_SECTIONS : TENANT_SECTIONS

    // Create sections
    const sectionsToInsert = sections.map((sectionType, index) => ({
      reference_id: referenceId,
      person_type: personType,
      section_type: sectionType,
      section_order: index + 1
    }))

    const { data: createdSections, error: insertError } = await supabase
      .from('verification_sections')
      .upsert(sectionsToInsert, { onConflict: 'reference_id,section_type' })
      .select()

    if (insertError) throw insertError

    return (createdSections || []).map(mapSectionFromDb)
  } catch (error) {
    console.error('Failed to initialize sections:', error)
    throw error
  }
}

/**
 * Get all sections for a reference
 */
export async function getSections(referenceId: string): Promise<VerificationSection[]> {
  try {
    const { data: sections, error } = await supabase
      .from('verification_sections')
      .select('*')
      .eq('reference_id', referenceId)
      .order('section_order', { ascending: true })

    if (error) throw error

    // If no sections exist, initialize them
    if (!sections || sections.length === 0) {
      return await initializeSections(referenceId)
    }

    // Check if standard verification sections are missing
    // (might only have external reference sections from chase_dependencies migration)
    const existingSectionTypes = sections.map(s => s.section_type)
    const hasIdentitySection = existingSectionTypes.includes('IDENTITY_SELFIE')

    if (!hasIdentitySection) {
      // Standard sections are missing - initialize them
      // initializeSections uses upsert so it won't duplicate existing sections
      await initializeSections(referenceId)

      // Re-fetch all sections after initialization
      const { data: updatedSections, error: refetchError } = await supabase
        .from('verification_sections')
        .select('*')
        .eq('reference_id', referenceId)
        .order('section_order', { ascending: true })

      if (refetchError) throw refetchError
      return (updatedSections || []).map(mapSectionFromDb)
    }

    return sections.map(mapSectionFromDb)
  } catch (error) {
    console.error('Failed to get sections:', error)
    throw error
  }
}

/**
 * Get a single section by ID
 */
export async function getSection(sectionId: string): Promise<VerificationSection | null> {
  try {
    const { data: section, error } = await supabase
      .from('verification_sections')
      .select('*')
      .eq('id', sectionId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }

    return mapSectionFromDb(section)
  } catch (error) {
    console.error('Failed to get section:', error)
    throw error
  }
}

/**
 * Update section decision to PASS
 */
export async function setPass(
  sectionId: string,
  staffId: string,
  notes?: string
): Promise<VerificationSection> {
  return await updateSectionDecision(sectionId, staffId, {
    decision: 'PASS',
    decisionNotes: notes,
    conditionText: null,
    actionReasonCode: null,
    actionAgentNote: null,
    actionInternalNote: null,
    failReason: null
  })
}

/**
 * Update section decision to PASS_WITH_CONDITION
 */
export async function setPassWithCondition(
  sectionId: string,
  staffId: string,
  params: PassWithConditionParams,
  notes?: string
): Promise<VerificationSection> {
  if (!params.conditionText?.trim()) {
    throw new Error('Condition text is required for PASS_WITH_CONDITION')
  }

  return await updateSectionDecision(sectionId, staffId, {
    decision: 'PASS_WITH_CONDITION',
    decisionNotes: notes,
    conditionText: params.conditionText.trim(),
    actionReasonCode: null,
    actionAgentNote: null,
    actionInternalNote: null,
    failReason: null
  })
}

/**
 * Update section decision to ACTION_REQUIRED
 * This immediately exits verification and sends back to the agent
 */
export async function setActionRequired(
  sectionId: string,
  staffId: string,
  params: ActionRequiredParams,
  notes?: string
): Promise<VerificationSection> {
  if (!params.reasonCode?.trim()) {
    throw new Error('Reason code is required for ACTION_REQUIRED')
  }
  if (!params.agentNote?.trim()) {
    throw new Error('Agent note is required for ACTION_REQUIRED')
  }

  // Get current section to increment correction cycle
  const currentSection = await getSection(sectionId)
  if (!currentSection) {
    throw new Error('Section not found')
  }

  const section = await updateSectionDecision(sectionId, staffId, {
    decision: 'ACTION_REQUIRED',
    decisionNotes: notes,
    conditionText: null,
    actionReasonCode: params.reasonCode.trim(),
    actionAgentNote: params.agentNote.trim(),
    actionInternalNote: params.internalNote?.trim() || null,
    failReason: null,
    correctionCycle: currentSection.correctionCycle + 1
  })

  // Transition verification state to ACTION_REQUIRED
  await transitionState(
    section.referenceId,
    'ACTION_REQUIRED',
    `Section ${section.sectionType} requires action: ${params.reasonCode}`,
    staffId
  )

  // Log audit with agent visibility
  await logAuditAction({
    referenceId: section.referenceId,
    action: 'ACTION_REQUIRED',
    description: `Section ${section.sectionType} requires action: ${params.reasonCode}`,
    metadata: {
      sectionType: section.sectionType,
      reasonCode: params.reasonCode,
      agentNote: params.agentNote,
      correctionCycle: section.correctionCycle,
      visible_to_agent: true
    },
    userId: staffId
  })

  // Send action required notification to agent
  // Don't await - let it run in background to not delay response
  sendActionRequiredNotification(
    section.referenceId,
    section.sectionType,
    params.reasonCode,
    params.agentNote
  ).catch(err => {
    console.error('[setActionRequired] Failed to send action required notification:', err)
  })

  return section
}

/**
 * Update section decision to FAIL
 */
export async function setFail(
  sectionId: string,
  staffId: string,
  params: FailParams,
  notes?: string
): Promise<VerificationSection> {
  if (!params.failReason?.trim()) {
    throw new Error('Fail reason is required for FAIL')
  }

  return await updateSectionDecision(sectionId, staffId, {
    decision: 'FAIL',
    decisionNotes: notes,
    conditionText: null,
    actionReasonCode: null,
    actionAgentNote: null,
    actionInternalNote: null,
    failReason: params.failReason.trim()
  })
}

/**
 * Reset section to NOT_REVIEWED
 */
export async function resetSection(
  sectionId: string,
  staffId: string
): Promise<VerificationSection> {
  return await updateSectionDecision(sectionId, staffId, {
    decision: 'NOT_REVIEWED',
    decisionNotes: null,
    conditionText: null,
    actionReasonCode: null,
    actionAgentNote: null,
    actionInternalNote: null,
    failReason: null
  })
}

/**
 * Update section checks (individual verification checks within a section)
 */
export async function updateSectionChecks(
  sectionId: string,
  checks: Array<{ name: string; result: 'pass' | 'fail' | 'na'; notes?: string }>,
  staffId: string
): Promise<VerificationSection> {
  const checksWithTimestamp = checks.map(check => ({
    ...check,
    checked_at: new Date().toISOString(),
    checked_by: staffId
  }))

  const { data: section, error } = await supabase
    .from('verification_sections')
    .update({
      checks: checksWithTimestamp
    })
    .eq('id', sectionId)
    .select()
    .single()

  if (error) throw error

  return mapSectionFromDb(section)
}

/**
 * Update section evidence sources
 */
export async function updateEvidenceSources(
  sectionId: string,
  evidenceSources: Array<{ sourceType: string; sourceId?: string; verified?: boolean }>,
  staffId: string
): Promise<VerificationSection> {
  const sourcesWithTimestamp = evidenceSources.map(source => ({
    ...source,
    verified_at: new Date().toISOString(),
    verified_by: staffId
  }))

  const { data: section, error } = await supabase
    .from('verification_sections')
    .update({
      evidence_sources: sourcesWithTimestamp
    })
    .eq('id', sectionId)
    .select()
    .single()

  if (error) throw error

  return mapSectionFromDb(section)
}

/**
 * Get verification progress for a reference
 */
export async function getVerificationProgress(referenceId: string): Promise<{
  totalSections: number
  completedSections: number
  sectionsWithIssues: number
  canFinalize: boolean
  hasActionRequired: boolean
  hasFail: boolean
  sections: Array<{
    type: SectionType
    decision: SectionDecision
  }>
}> {
  const allSections = await getSections(referenceId)

  // Filter out external reference sections - they're for chase queue, not verification
  const EXTERNAL_REFERENCE_TYPES = ['EMPLOYER_REFERENCE', 'LANDLORD_REFERENCE', 'ACCOUNTANT_REFERENCE']
  const sections = allSections.filter(s => !EXTERNAL_REFERENCE_TYPES.includes(s.sectionType))

  const completedSections = sections.filter(s =>
    s.decision !== 'NOT_REVIEWED'
  ).length

  const sectionsWithIssues = sections.filter(s =>
    s.decision === 'ACTION_REQUIRED' || s.decision === 'FAIL'
  ).length

  const hasActionRequired = sections.some(s => s.decision === 'ACTION_REQUIRED')
  const hasFail = sections.some(s => s.decision === 'FAIL')

  // Can finalize if all sections reviewed and no ACTION_REQUIRED
  const canFinalize = sections.length > 0 &&
    sections.every(s => s.decision !== 'NOT_REVIEWED') &&
    !hasActionRequired

  return {
    totalSections: sections.length,
    completedSections,
    sectionsWithIssues,
    canFinalize,
    hasActionRequired,
    hasFail,
    sections: sections.map(s => ({
      type: s.sectionType,
      decision: s.decision
    }))
  }
}

/**
 * Get action reason codes for a specific section type
 */
export async function getActionReasonCodes(sectionType?: SectionType): Promise<Array<{
  code: string
  displayLabel: string
  defaultAgentMessage: string
}>> {
  try {
    let query = supabase
      .from('action_reason_codes')
      .select('code, display_label, default_agent_message')
      .eq('active', true)
      .order('display_order', { ascending: true })

    if (sectionType) {
      query = query.contains('section_types', [sectionType])
    }

    const { data, error } = await query

    if (error) throw error

    return (data || []).map(code => ({
      code: code.code,
      displayLabel: code.display_label,
      defaultAgentMessage: code.default_agent_message || ''
    }))
  } catch (error) {
    console.error('Failed to get action reason codes:', error)
    return []
  }
}

// --- Private helpers ---

interface DecisionUpdateParams {
  decision: SectionDecision
  decisionNotes?: string | null
  conditionText?: string | null
  actionReasonCode?: string | null
  actionAgentNote?: string | null
  actionInternalNote?: string | null
  failReason?: string | null
  correctionCycle?: number
}

async function updateSectionDecision(
  sectionId: string,
  staffId: string,
  params: DecisionUpdateParams
): Promise<VerificationSection> {
  // Get current section for audit
  const currentSection = await getSection(sectionId)
  if (!currentSection) {
    throw new Error('Section not found')
  }

  const updateData: any = {
    decision: params.decision,
    decision_notes: params.decisionNotes,
    decision_by: staffId,
    decision_at: new Date().toISOString(),
    condition_text: params.conditionText,
    action_reason_code: params.actionReasonCode,
    action_agent_note: params.actionAgentNote,
    action_internal_note: params.actionInternalNote,
    fail_reason: params.failReason
  }

  if (params.correctionCycle !== undefined) {
    updateData.correction_cycle = params.correctionCycle
  }

  const { data: section, error } = await supabase
    .from('verification_sections')
    .update(updateData)
    .eq('id', sectionId)
    .select()
    .single()

  if (error) throw error

  // If RTR section is passed, update tenant_references.rtr_verified
  if (currentSection.sectionType === 'RTR' &&
      (params.decision === 'PASS' || params.decision === 'PASS_WITH_CONDITION')) {
    await supabase
      .from('tenant_references')
      .update({
        rtr_verified: true,
        rtr_verification_date: new Date().toISOString()
      })
      .eq('id', currentSection.referenceId)
  }

  // Log audit (not for ACTION_REQUIRED as it's logged separately with agent visibility)
  if (params.decision !== 'ACTION_REQUIRED') {
    await logAuditAction({
      referenceId: currentSection.referenceId,
      action: 'SECTION_DECISION_UPDATED',
      description: `Section ${currentSection.sectionType} decision changed from ${currentSection.decision} to ${params.decision}`,
      metadata: {
        sectionType: currentSection.sectionType,
        oldDecision: currentSection.decision,
        newDecision: params.decision,
        conditionText: params.conditionText,
        failReason: params.failReason
      },
      userId: staffId
    })
  }

  return mapSectionFromDb(section)
}

function mapSectionFromDb(dbSection: any): VerificationSection {
  return {
    id: dbSection.id,
    referenceId: dbSection.reference_id,
    personType: dbSection.person_type,
    sectionType: dbSection.section_type,
    sectionOrder: dbSection.section_order,
    decision: dbSection.decision,
    decisionNotes: dbSection.decision_notes,
    decisionBy: dbSection.decision_by,
    decisionAt: dbSection.decision_at,
    conditionText: dbSection.condition_text,
    actionReasonCode: dbSection.action_reason_code,
    actionAgentNote: dbSection.action_agent_note,
    actionInternalNote: dbSection.action_internal_note,
    failReason: dbSection.fail_reason,
    correctionCycle: dbSection.correction_cycle || 0,
    evidenceSources: dbSection.evidence_sources || [],
    evidenceFiles: dbSection.evidence_files || [],
    checks: dbSection.checks || [],
    scoreImpact: dbSection.score_impact || 0,
    createdAt: dbSection.created_at,
    updatedAt: dbSection.updated_at
  }
}

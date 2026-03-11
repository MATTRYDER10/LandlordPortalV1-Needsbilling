/**
 * V2 Reference System Types
 *
 * These types support the new section-based verification system.
 * V1 types remain unchanged in their original locations.
 */

// ============================================================================
// STATUS ENUMS
// ============================================================================

export type V2ReferenceStatus =
  | 'SENT'
  | 'COLLECTING_EVIDENCE'
  | 'ACTION_REQUIRED'
  | 'ACCEPTED'
  | 'ACCEPTED_WITH_GUARANTOR'
  | 'ACCEPTED_ON_CONDITION'
  | 'REJECTED'

export type V2SectionType =
  | 'IDENTITY'
  | 'RTR'
  | 'INCOME'
  | 'RESIDENTIAL'
  | 'CREDIT'
  | 'AML'

export type V2QueueStatus =
  | 'PENDING'
  | 'READY'
  | 'IN_PROGRESS'
  | 'COMPLETED'

export type V2SectionDecision =
  | 'PASS'
  | 'PASS_WITH_CONDITION'
  | 'FAIL'

export type V2ChaseStatus =
  | 'WAITING'
  | 'IN_CHASE_QUEUE'
  | 'RECEIVED'
  | 'VERBAL_OBTAINED'
  | 'UNABLE_TO_OBTAIN'

export type V2WorkItemStatus =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'RETURNED'

export type V2WorkType =
  | 'IDENTITY'
  | 'RTR'
  | 'INCOME'
  | 'RESIDENTIAL'
  | 'CREDIT'
  | 'AML'
  | 'CHASE'
  | 'FINAL_REVIEW'

export type V2RefereeType =
  | 'EMPLOYER'
  | 'LANDLORD'
  | 'AGENT'
  | 'ACCOUNTANT'

export type V2PreviousLandlordType =
  | 'landlord'
  | 'agent'
  | 'none'

// ============================================================================
// DATABASE ROW TYPES (matching Supabase schema)
// ============================================================================

export interface V2ReferenceRow {
  id: string
  company_id: string
  v1_reference_id: string | null
  parent_reference_id: string | null
  is_group_parent: boolean
  is_guarantor: boolean
  guarantor_for_reference_id: string | null
  status: V2ReferenceStatus
  final_decision_notes: string | null
  final_decision_by: string | null
  final_decision_at: string | null
  linked_property_id: string | null
  property_address_encrypted: string | null
  property_city_encrypted: string | null
  property_postcode_encrypted: string | null
  monthly_rent: number | null
  rent_share: number | null
  move_in_date: string | null
  term_years: number
  term_months: number
  bills_included: boolean
  tenant_first_name_encrypted: string | null
  tenant_last_name_encrypted: string | null
  tenant_email_encrypted: string | null
  tenant_phone_encrypted: string | null
  tenant_dob_encrypted: string | null
  current_address_line1_encrypted: string | null
  current_address_line2_encrypted: string | null
  current_city_encrypted: string | null
  current_postcode_encrypted: string | null
  current_country: string
  employer_ref_name_encrypted: string | null
  employer_ref_email_encrypted: string | null
  employer_ref_phone_encrypted: string | null
  employer_ref_position_encrypted: string | null
  previous_landlord_name_encrypted: string | null
  previous_landlord_email_encrypted: string | null
  previous_landlord_phone_encrypted: string | null
  previous_landlord_type: V2PreviousLandlordType | null
  accountant_name_encrypted: string | null
  accountant_email_encrypted: string | null
  accountant_phone_encrypted: string | null
  employment_status: string | null
  job_title_encrypted: string | null
  employer_name_encrypted: string | null
  annual_income: number | null
  affordability_ratio: number | null
  affordability_pass: boolean | null
  citizenship_status: string | null
  share_code: string | null
  share_code_expiry: string | null
  id_uploaded: boolean
  selfie_uploaded: boolean
  proof_of_income_uploaded: boolean
  form_token_hash: string | null
  form_started_at: string | null
  form_submitted_at: string | null
  form_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
  created_by: string | null
  converted_to_tenancy_id: string | null
  converted_at: string | null
  report_pdf_url: string | null
  report_generated_at: string | null
  holding_deposit_amount: number | null
  offer_id: string | null
  // Reposit fields
  deposit_replacement_offered: boolean | null
  deposit_amount: number | null
  reposit_confirmed: boolean | null
  reposit_confirmed_at: string | null
  reposit_eligible: boolean | null
  reposit_eligibility_notes: string | null
}

export interface V2SectionRow {
  id: string
  reference_id: string
  section_type: V2SectionType
  section_order: number
  queue_status: V2QueueStatus
  assigned_to: string | null
  assigned_at: string | null
  started_at: string | null
  completed_at: string | null
  decision: V2SectionDecision | null
  condition_text: string | null
  fail_reason: string | null
  assessor_notes: string | null
  evidence_submitted_at: string | null
  referee_submitted_at: string | null
  queue_entered_at: string | null
  referee_type: string | null
  referee_email_encrypted: string | null
  referee_phone_encrypted: string | null
  referee_name_encrypted: string | null
  created_at: string
  updated_at: string
}

export interface V2ChaseItemRow {
  id: string
  reference_id: string
  section_id: string
  referee_type: V2RefereeType
  referee_name_encrypted: string | null
  referee_email_encrypted: string | null
  referee_phone_encrypted: string | null
  status: V2ChaseStatus
  initial_sent_at: string
  last_chased_at: string | null
  chase_queue_entered_at: string | null
  resolved_at: string | null
  chase_count: number
  emails_sent: number
  sms_sent: number
  calls_made: number
  resolution_type: string | null
  unable_reason: string | null
  verbal_reference_id: string | null
  created_at: string
  updated_at: string
}

export interface V2VerbalReferenceRow {
  id: string
  reference_id: string
  section_id: string
  chase_item_id: string | null
  referee_type: V2RefereeType
  referee_name: string
  referee_position: string | null
  referee_phone: string
  call_datetime: string
  call_duration_minutes: number | null
  responses: Record<string, unknown>
  recorded_by: string
  recorded_at: string
  created_at: string
}

export interface V2WorkItemRow {
  id: string
  reference_id: string
  section_id: string | null
  work_type: V2WorkType
  status: V2WorkItemStatus
  assigned_to: string | null
  assigned_at: string | null
  started_at: string | null
  completed_at: string | null
  priority: number
  created_at: string
  updated_at: string
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface CreateV2ReferenceInput {
  companyId: string
  linkedPropertyId?: string
  propertyAddress?: string
  propertyCity?: string
  propertyPostcode?: string
  monthlyRent: number
  rentShare?: number
  moveInDate: string
  termYears?: number
  termMonths?: number
  billsIncluded?: boolean
  tenantFirstName: string
  tenantLastName: string
  tenantEmail: string
  tenantPhone?: string
  tenantDob?: string
  isGuarantor?: boolean
  guarantorForReferenceId?: string
  parentReferenceId?: string
  isGroupParent?: boolean
  createdBy?: string
  holdingDepositAmount?: number
  offerId?: string
  depositReplacementOffered?: boolean
  depositAmount?: number
}

export interface SubmitSectionDecisionInput {
  sectionId: string
  decision: V2SectionDecision
  conditionText?: string
  failReason?: string
  assessorNotes?: string
  staffUserId: string
}

export interface RecordVerbalReferenceInput {
  referenceId: string
  sectionId: string
  chaseItemId?: string
  refereeType: V2RefereeType
  refereeName: string
  refereePosition?: string
  refereePhone: string
  callDatetime: Date
  callDurationMinutes?: number
  responses: Record<string, unknown>
  staffUserId: string
}

// ============================================================================
// OUTPUT TYPES
// ============================================================================

export interface V2QueueCounts {
  IDENTITY: number
  RTR: number
  INCOME: number
  RESIDENTIAL: number
  CREDIT: number
  AML: number
  CHASE: number
  FINAL_REVIEW: number
}

export interface AffordabilityResult {
  ratio: number
  passes: boolean
  annualIncomeRequired: number
}

// Tenant sections (6)
export const TENANT_SECTIONS: V2SectionType[] = [
  'IDENTITY', 'RTR', 'INCOME', 'RESIDENTIAL', 'CREDIT', 'AML'
]

// Guarantor sections (5 - no RESIDENTIAL)
export const GUARANTOR_SECTIONS: V2SectionType[] = [
  'IDENTITY', 'RTR', 'INCOME', 'CREDIT', 'AML'
]

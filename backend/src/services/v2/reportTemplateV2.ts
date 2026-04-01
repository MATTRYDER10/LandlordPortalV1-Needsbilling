/**
 * V2 Report HTML Template
 *
 * Generates a full HTML string for the tenant reference report,
 * styled to match the PropertyGoose report design.
 * Used by pdfReportServiceV2.ts with Puppeteer for PDF generation.
 */

import { decrypt } from '../encryption'
import {
  V2ReferenceRow,
  V2SectionRow,
  V2SectionType,
  V2SectionDecision
} from './types'

// ============================================================================
// TYPES
// ============================================================================

export interface V2ReportData {
  reference: V2ReferenceRow
  sections: V2SectionRow[]
  verbalReferences: any[]
  refereeSubmissions: any[]
  creditCheck?: {
    id: string
    reference_id: string
    request_data_encrypted?: string
    response_data_encrypted?: string
    responseData?: {
      verifyMatch?: boolean
      flags?: {
        ccjMatch?: boolean
        electoralRegisterMatch?: boolean
        deceasedRegisterMatch?: boolean
        insolvencyMatch?: boolean
      }
      countyCourtJudgments?: Array<{ courtName?: string; amount?: number; dateOfJudgment?: string; caseStatus?: string }>
      electoralRolls?: Array<{ address?: string; dateOfRegistration?: string }>
      insolvencies?: Array<{ type?: string; caseType?: string; date?: string; startDate?: string; status?: string }>
    } | null
    requestData?: { address?: string; postcode?: string } | null
    transaction_id?: string
    risk_level?: string
    risk_score?: number
    status?: string
    address_type?: string
    fraud_indicators?: Record<string, any>
    created_at: string
  }
  previousAddressCreditCheck?: {
    id: string
    responseData?: any
    requestData?: { address?: string; postcode?: string } | null
    transaction_id?: string
    risk_level?: string
    risk_score?: number
    address_type?: string
    created_at: string
  }
  amlCheck?: {
    id: string
    reference_id: string
    screening_data_encrypted?: string
    risk_level?: string
    total_matches?: number
    sanctions_matches?: number
    donation_matches?: number
    summary?: string
    created_at: string
  }
  guarantor?: {
    reference: V2ReferenceRow
    sections: V2SectionRow[]
  }
  children?: Array<{
    reference: V2ReferenceRow
    sections: V2SectionRow[]
    guarantor?: {
      reference: V2ReferenceRow
      sections: V2SectionRow[]
    }
  }>
  company: {
    name: string
    logoUrl?: string
    logoBase64?: string
    primaryColor?: string
  }
  reviewedBy?: string
  qrCodeDataUrl?: string
  pgLogoBase64?: string
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDate(d: string | null | undefined): string {
  if (!d) return 'N/A'
  const date = new Date(d)
  if (isNaN(date.getTime())) return String(d)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateLong(d: string | null | undefined): string {
  if (!d) return 'N/A'
  const date = new Date(d)
  if (isNaN(date.getTime())) return String(d)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatMoney(v: any): string {
  if (v === null || v === undefined || v === '') return 'N/A'
  const num = typeof v === 'number' ? v : parseFloat(String(v))
  if (isNaN(num)) return String(v)
  return '\u00A3' + num.toLocaleString('en-GB', { maximumFractionDigits: 0 })
}

function formatValue(v: any): string {
  if (v === null || v === undefined || v === '') return 'N/A'
  if (typeof v === 'boolean') return v ? '\u2713 Yes' : '\u2717 No'
  if (v === 'true' || v === true) return '\u2713 Yes'
  if (v === 'false' || v === false) return '\u2717 No'
  const str = String(v)
  const map: Record<string, string> = {
    'always': 'Always On Time', 'mostly': 'Mostly On Time', 'sometimes': 'Sometimes Late', 'rarely': 'Frequently Late',
    'excellent': 'Excellent', 'good': 'Good', 'fair': 'Fair', 'poor': 'Poor',
    'full-time': 'Full-Time', 'full_time': 'Full-Time', 'temporary': 'Temporary', 'part-time': 'Part-Time', 'part_time': 'Part-Time', 'contract': 'Contract',
    'BRITISH_CITIZEN': 'British Citizen', 'EU_SETTLED': 'EU Settled Status', 'EU_PRE_SETTLED': 'EU Pre-Settled Status', 'VISA': 'Visa Holder', 'SHARE_CODE': 'Share Code Verified',
    'uk_citizen': 'UK Citizen', 'eu_settled': 'EU Settled Status', 'eu_pre_settled': 'EU Pre-Settled Status',
    'renting_landlord': 'Renting from Private Landlord', 'renting_agent': 'Renting via Letting Agent', 'living_with_family': 'Living with Family/Friends',
    'employed': 'Employed', 'self_employed': 'Self-Employed', 'self-employed': 'Self-Employed', 'benefits': 'Benefits', 'pension': 'Pension', 'student': 'Student',
    'PASSPORT': 'Passport', 'DRIVING_LICENSE': 'Driving Licence', 'ID_CARD': 'ID Card', 'BRP': 'BRP Card',
    'passport': 'Passport', 'driving_licence': 'Driving Licence',
    'single': 'Single', 'married': 'Married', 'divorced': 'Divorced', 'widowed': 'Widowed',
  }
  if (map[str]) return map[str]
  if (str.includes('_')) return str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  return str
}

function formatBoolHtml(v: any): string {
  if (v === true || v === 'true' || v === 'Yes' || v === 'yes') return '<span style="color: var(--pass-text);">\u2713 Yes</span>'
  if (v === false || v === 'false' || v === 'No' || v === 'no') return '<span style="color: var(--fail-text);">\u2717 No</span>'
  return formatValue(v)
}

function formatLabel(key: string): string {
  const labelMap: Record<string, string> = {
    'refereeName': 'Referee', 'confirmsTenancy': 'Confirms Tenancy', 'tenancyStartDate': 'Tenancy Start Date',
    'tenancyEndDate': 'Tenancy End Date', 'stillCurrentTenant': 'Still Current Tenant', 'monthlyRent': 'Monthly Rent',
    'rentPaymentTimeliness': 'Rent Payment Timeliness', 'propertyCondition': 'Property Condition',
    'propertyDamage': 'Property Damage', 'damageDetails': 'Damage Details', 'antiSocialBehaviour': 'Anti-Social Behaviour',
    'antiSocialDetails': 'Anti-Social Details', 'wouldRentAgain': 'Would Rent Again', 'additionalComments': 'Comments',
    'confirmsEmployment': 'Confirms Employment', 'jobTitle': 'Job Title', 'employmentStartDate': 'Employment Start Date',
    'annualSalary': 'Annual Salary', 'employmentType': 'Employment Type', 'inProbation': 'In Probation',
    'confirmsClient': 'Confirms Client', 'businessName': 'Business Name', 'clientDuration': 'Client Duration',
    'annualIncome': 'Annual Income', 'accountsUpToDate': 'Accounts Up To Date',
    'financialConcerns': 'Financial Concerns', 'financialConcernDetails': 'Concern Details',
    'submittedAt': '',
  }
  if (labelMap[key] !== undefined) return labelMap[key]
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).replace(/_/g, ' ').trim()
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SECTION_NAMES: Record<V2SectionType, string> = {
  IDENTITY: 'Identity',
  RTR: 'Right to Rent',
  INCOME: 'Income',
  RESIDENTIAL: 'Residential',
  ADDRESS: 'Address',
  CREDIT: 'Credit',
  AML: 'AML / Sanctions'
}

const SECTION_ICONS: Record<V2SectionType, string> = {
  IDENTITY: '<svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
  RTR: '<svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>',
  INCOME: '<svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v1m0 8v1M9.5 9.5a2.5 2 0 015 0c0 1.5-1 2-2.5 2.5S9.5 13 9.5 14.5a2.5 2 0 005 0"/></svg>',
  RESIDENTIAL: '<svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="2"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1z"/><path d="M9 21V12h6v9"/></svg>',
  ADDRESS: '<svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="2"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1z"/><path d="M9 21V12h6v9"/></svg>',
  CREDIT: '<svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
  AML: '<svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="2"><path d="M12 2L3 7v6c0 5 4 9 9 11 5-2 9-6 9-11V7z"/><path d="M9 12l2 2 4-4"/></svg>'
}

const STATUS_CONFIG: Record<string, { label: string; cssClass: string }> = {
  ACCEPTED: { label: 'ACCEPTED', cssClass: '' },
  ACCEPTED_WITH_GUARANTOR: { label: 'ACCEPTED WITH GUARANTOR', cssClass: '' },
  ACCEPTED_ON_CONDITION: { label: 'ACCEPTED ON CONDITION', cssClass: 'cond' },
  REJECTED: { label: 'REJECTED', cssClass: 'fail' }
}

const DECISION_LABELS: Record<V2SectionDecision, { label: string; cssClass: string }> = {
  PASS: { label: 'PASS', cssClass: '' },
  PASS_WITH_CONDITION: { label: 'CONDITION', cssClass: 'cond' },
  FAIL: { label: 'FAIL', cssClass: 'fail' },
  REFER: { label: 'REFER', cssClass: 'cond' }
}

// ============================================================================
// UTILITY HELPERS
// ============================================================================

function esc(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function decryptSafe(val: string | null | undefined): string {
  if (!val) return ''
  try {
    return decrypt(val) || ''
  } catch {
    return ''
  }
}

function getDecisionBadge(decision: V2SectionDecision | null): string {
  if (!decision) return '<div class="rr-card-badge cond">PENDING</div>'
  const config = DECISION_LABELS[decision]
  return `<div class="rr-card-badge ${config.cssClass}">${config.label}</div>`
}

function getDividerBadge(decision: V2SectionDecision | null): string {
  if (!decision) return '<div class="rr-section-divider-badge" style="background:var(--cond-bg);color:var(--cond-text);border-color:var(--cond-border)">PENDING</div>'
  const config = DECISION_LABELS[decision]
  const styleMap: Record<string, string> = {
    '': '',
    'cond': 'background:var(--cond-bg);color:var(--cond-text);border-color:var(--cond-border)',
    'fail': 'background:var(--fail-bg);color:var(--fail-text);border-color:var(--fail-border)'
  }
  const style = styleMap[config.cssClass] || ''
  return `<div class="rr-section-divider-badge" ${style ? `style="${style}"` : ''}>${config.label}</div>`
}

function getCardClass(decision: V2SectionDecision | null): string {
  if (!decision) return 'rr-card cond'
  if (decision === 'PASS_WITH_CONDITION' || decision === 'REFER') return 'rr-card cond'
  if (decision === 'FAIL') return 'rr-card fail'
  return 'rr-card'
}

function getCheckIcon(passed: boolean, isCondition = false): string {
  if (isCondition) return '<span class="ic ic-cond">\u26A0</span>'
  return passed
    ? '<span class="ic ic-pass">\u2713</span>'
    : '<span class="ic ic-fail">\u2717</span>'
}

function maskShareCode(code: string): string {
  return code || ''
}

function getRiskBadgeStyle(riskLevel: string): string {
  if (!riskLevel) return ''
  const level = riskLevel.toUpperCase()
  if (level.includes('LOW') || level === 'CLEAR') {
    return 'background:var(--pass-bg);color:var(--pass-text);border-color:var(--pass-border);'
  } else if (level.includes('MEDIUM') || level.includes('MOD')) {
    return 'background:var(--cond-bg);color:var(--cond-text);border-color:var(--cond-border);'
  } else if (level.includes('HIGH')) {
    return 'background:var(--fail-bg);color:var(--fail-text);border-color:var(--fail-border);'
  }
  return ''
}

/** Format a referee form field value for display in HTML */
function formatFieldHtml(key: string, value: any): string {
  // Fields where "No" is a GOOD result (green), "Yes" is bad (red)
  const negativeFields = ['propertyDamage', 'antiSocialBehaviour', 'financialConcerns', 'inProbation', 'disciplinaryIssues']
  if (typeof value === 'boolean' || value === 'true' || value === 'false') {
    const isBoolTrue = value === true || value === 'true'
    if (negativeFields.includes(key)) {
      // Inverted: No = good, Yes = bad
      return isBoolTrue
        ? '<span style="color: var(--fail-text);">\u2717 Yes</span>'
        : '<span style="color: var(--pass-text);">\u2713 No</span>'
    }
    return formatBoolHtml(value)
  }
  // Money fields
  const moneyKeys = ['monthlyRent', 'annualSalary', 'annualIncome', 'monthlyIncome', 'salary']
  if (moneyKeys.includes(key)) {
    return esc(formatMoney(value))
  }
  // Date fields
  const dateKeys = ['tenancyStartDate', 'tenancyEndDate', 'employmentStartDate', 'startDate', 'endDate']
  if (dateKeys.includes(key)) {
    return esc(formatDate(value))
  }
  return esc(formatValue(value))
}

// ============================================================================
// SECTION CARD CHECK ITEMS (page 1 overview)
// ============================================================================

function buildCheckItems(section: V2SectionRow, reference: V2ReferenceRow, data: V2ReportData): string {
  const sectionData = (section.section_data || {}) as Record<string, any>
  const checklist = sectionData.checklist_results || {}
  const items: string[] = []
  const decision = section.decision as V2SectionDecision | null
  const isPassed = decision === 'PASS' || decision === 'PASS_WITH_CONDITION'
  const isCond = decision === 'PASS_WITH_CONDITION' || decision === 'REFER'

  switch (section.section_type) {
    case 'IDENTITY': {
      const docType = checklist.document_type || sectionData.document_type || 'Document'
      items.push(`<div class="rr-check-item">${getCheckIcon(isPassed)} ${esc(formatValue(docType))} verified</div>`)
      if (checklist.document_expiry_valid !== undefined) {
        items.push(`<div class="rr-check-item">${getCheckIcon(checklist.document_expiry_valid)} Document ${checklist.document_expiry_valid ? 'not expired' : 'expired'}</div>`)
      }
      if (checklist.facial_match !== undefined) {
        items.push(`<div class="rr-check-item">${getCheckIcon(checklist.facial_match)} Facial recognition: ${checklist.facial_match ? 'Clear' : 'Failed'}</div>`)
      }
      if (items.length <= 1 && section.assessor_notes) {
        items.push(`<div class="rr-check-item">${getCheckIcon(isPassed)} ${esc(section.assessor_notes)}</div>`)
      }
      break
    }

    case 'RTR': {
      const formData = (reference.form_data || {}) as Record<string, any>
      const rtrForm = formData.rtr || {}
      const citizenship = checklist.citizenship_status || reference.citizenship_status || rtrForm.citizenshipStatus || ''
      if (citizenship) {
        items.push(`<div class="rr-check-item">${getCheckIcon(isPassed)} ${esc(formatValue(citizenship))} confirmed</div>`)
      }
      const rtrType = checklist.rtr_type || sectionData.rtr_type || ''
      if (rtrType) {
        items.push(`<div class="rr-check-item">${getCheckIcon(isPassed)} ${esc(formatValue(rtrType))} \u2014 ${checklist.rtr_expiry_date ? `expires ${formatDate(checklist.rtr_expiry_date)}` : 'no expiry'}</div>`)
      }
      if (checklist.digital_check !== undefined) {
        items.push(`<div class="rr-check-item">${getCheckIcon(checklist.digital_check)} Digital Identity check ${checklist.digital_check ? 'complete' : 'failed'}</div>`)
      }
      if (items.length === 0) {
        items.push(`<div class="rr-check-item">${getCheckIcon(isPassed)} ${isPassed ? 'Right to rent verified' : 'Right to rent check incomplete'}</div>`)
      }
      break
    }

    case 'INCOME': {
      const employmentStatus = reference.employment_status || checklist.employment_status || ''
      const employer = decryptSafe(reference.employer_name_encrypted) || checklist.employer_name || ''
      if (employmentStatus || employer) {
        items.push(`<div class="rr-check-item">${getCheckIcon(isPassed)} ${esc(formatValue(employmentStatus))}${employer ? `: ${esc(employer)}` : ''}</div>`)
      }
      const annualIncome = checklist.annual_income || reference.annual_income
      if (annualIncome) {
        items.push(`<div class="rr-check-item">${getCheckIcon(isPassed)} Annual salary: ${formatMoney(annualIncome)}</div>`)
      }
      // Affordability on overview card
      const rentShare = reference.rent_share || reference.monthly_rent || 0
      const multiplier = reference.is_guarantor ? 32 : 30
      const totalEffective = checklist.total_effective_income || checklist.annual_income || reference.annual_income || 0
      const required = multiplier * rentShare
      const passes = totalEffective >= required
      items.push(`<div class="rr-check-item">${getCheckIcon(passes)} ${passes ? `Passes ${multiplier}\u00D7 threshold` : `Below ${multiplier}\u00D7 threshold`}</div>`)

      if (checklist.payslips_verified !== undefined) {
        items.push(`<div class="rr-check-item">${getCheckIcon(checklist.payslips_verified)} Payslips ${checklist.payslips_verified ? 'verified' : 'not verified'}${checklist.payslip_months ? ` \u2014 ${checklist.payslip_months} months` : ''}</div>`)
      }
      if (checklist.employer_reference_received !== undefined) {
        items.push(`<div class="rr-check-item">${getCheckIcon(checklist.employer_reference_received, !checklist.employer_reference_received && isCond)} Employer reference ${checklist.employer_reference_received ? 'received' : 'pending'}</div>`)
      }
      break
    }

    case 'RESIDENTIAL': {
      const currentSituation = checklist.current_situation || sectionData.current_situation || ''
      const duration = checklist.tenancy_duration || sectionData.tenancy_duration || ''
      if (currentSituation) {
        items.push(`<div class="rr-check-item">${getCheckIcon(isPassed)} Currently ${esc(formatValue(currentSituation).toLowerCase())}${duration ? ` \u2014 ${esc(duration)}` : ''}</div>`)
      }
      if (checklist.address_confirmed !== undefined) {
        items.push(`<div class="rr-check-item">${getCheckIcon(checklist.address_confirmed)} Address ${checklist.address_confirmed ? 'confirmed' : 'not confirmed'}</div>`)
      }
      if (checklist.landlord_reference_received !== undefined) {
        items.push(`<div class="rr-check-item">${getCheckIcon(checklist.landlord_reference_received, !checklist.landlord_reference_received && isCond)} Landlord reference ${checklist.landlord_reference_received ? 'received' : 'pending'}</div>`)
      }
      if (items.length === 0) {
        items.push(`<div class="rr-check-item">${getCheckIcon(isPassed)} ${isPassed ? 'Residential history verified' : 'Residential check incomplete'}</div>`)
      }
      break
    }

    case 'ADDRESS': {
      if (checklist.address_confirmed !== undefined) {
        items.push(`<div class="rr-check-item">${getCheckIcon(checklist.address_confirmed)} Address ${checklist.address_confirmed ? 'confirmed' : 'not confirmed'}</div>`)
      }
      if (checklist.proof_of_address !== undefined) {
        items.push(`<div class="rr-check-item">${getCheckIcon(checklist.proof_of_address)} Proof of address ${checklist.proof_of_address ? 'verified' : 'not verified'}</div>`)
      }
      if (items.length === 0) {
        items.push(`<div class="rr-check-item">${getCheckIcon(isPassed)} ${isPassed ? 'Address verified' : 'Address check incomplete'}</div>`)
      }
      break
    }

    case 'CREDIT': {
      const cc2 = data.creditCheck
      const rd2 = cc2?.responseData
      const fl2 = rd2?.flags || {}
      const hasCcjs = fl2.ccjMatch ?? sectionData.ccjMatch ?? false
      const hasInsolvency = fl2.insolvencyMatch ?? sectionData.insolvencyMatch ?? false
      const hasElectoral = fl2.electoralRegisterMatch ?? sectionData.electoralRegisterMatch ?? true
      const identityOk2 = rd2?.verifyMatch ?? sectionData.verifyMatch ?? true
      const deceasedOk = !(fl2.deceasedRegisterMatch ?? sectionData.deceasedRegisterMatch ?? false)
      const declared = checklist.adverse_credit || sectionData.adverse_credit || false
      const ccjCnt = rd2?.countyCourtJudgments?.length || sectionData.ccjCount || 0
      const insCnt = rd2?.insolvencies?.length || sectionData.insolvencyCount || 0
      const totalAdv = ccjCnt + insCnt
      // PG Score calc
      let pgS = 100
      if (!hasElectoral) pgS -= 10
      if (!identityOk2) pgS -= 10
      if (!deceasedOk) pgS -= 50
      if (hasCcjs || hasInsolvency) {
        if (totalAdv > 1) pgS -= 50
        else if (!declared) pgS -= 80
        else pgS -= 30
      }
      pgS = Math.max(0, Math.min(100, pgS))
      items.push(`<div class="rr-check-item">${getCheckIcon(pgS >= 70)} PG Risk Score: ${pgS}/100 — ${pgS >= 70 ? (pgS === 100 ? 'Clear' : 'PASS') : 'FAIL'}</div>`)
      items.push(`<div class="rr-check-item">${getCheckIcon(!hasCcjs)} CCJs: ${hasCcjs ? 'Found' : 'Clear'}</div>`)
      items.push(`<div class="rr-check-item">${getCheckIcon(!hasInsolvency)} Insolvency: ${hasInsolvency ? 'Found' : 'Clear'}</div>`)
      items.push(`<div class="rr-check-item">${getCheckIcon(hasElectoral, !hasElectoral)} Electoral Roll: ${hasElectoral ? 'Match' : 'Not on Register'}</div>`)
      break
    }

    case 'AML': {
      const ac = data.amlCheck
      const riskLevel = ac?.risk_level || checklist.risk_level || sectionData.risk_level || ''
      if (riskLevel) {
        items.push(`<div class="rr-check-item">${getCheckIcon(isPassed)} Risk level: ${esc(riskLevel)}</div>`)
      }
      const sanctionsCount = ac?.sanctions_matches ?? (checklist.sanctions_matches ? 1 : 0)
      items.push(`<div class="rr-check-item">${getCheckIcon(sanctionsCount === 0)} ${sanctionsCount > 0 ? 'Sanctions matches found' : 'No sanctions matches'}</div>`)
      if (checklist.pep_matches !== undefined) {
        items.push(`<div class="rr-check-item">${getCheckIcon(!checklist.pep_matches)} ${checklist.pep_matches ? 'PEP matches found' : 'No PEP matches'}</div>`)
      }
      if (checklist.adverse_media !== undefined) {
        items.push(`<div class="rr-check-item">${getCheckIcon(!checklist.adverse_media)} ${checklist.adverse_media ? 'Adverse media found' : 'No adverse media'}</div>`)
      }
      if (items.length === 0) {
        items.push(`<div class="rr-check-item">${getCheckIcon(isPassed)} ${isPassed ? 'AML check clear' : 'AML check incomplete'}</div>`)
      }
      break
    }
  }

  // Condition note
  if (isCond && section.condition_text) {
    items.push(`<div class="rr-cond-note">${esc(section.condition_text)}</div>`)
  }

  return items.join('\n')
}

// ============================================================================
// PAGE BUILDERS
// ============================================================================

function buildFooter(data: V2ReportData, pageNum: number, totalPages: number): string {
  const refNum = data.reference.reference_number || data.reference.id.substring(0, 13)
  return `
  <div class="rr-footer">
    <span class="rr-footer-text">PropertyGoose Referencing</span>
    <span class="rr-footer-text">Ref: ${esc(refNum)}</span>
    <span class="rr-footer-text">Page ${pageNum} of ${totalPages} \u00B7 propertygoose.co.uk</span>
  </div>`
}

function buildHeader(data: V2ReportData): string {
  // PG logo — use base64 embedded version (guaranteed to work in Puppeteer)
  const pgLogo = data.pgLogoBase64
    ? `<img src="${data.pgLogoBase64}" style="height:36px;object-fit:contain;" alt="PropertyGoose" />`
    : `<span style="color:#fff;font-family:'DM Serif Display',serif;font-size:22px;">PropertyGoose</span>`

  // Agent logo — use base64 if fetched, otherwise placeholder
  const agentLogo = data.company.logoBase64
    ? `<div style="background:#fff;border-radius:6px;padding:6px 12px;display:flex;align-items:center;justify-content:center;max-width:140px;max-height:48px;"><img src="${data.company.logoBase64}" style="max-height:36px;max-width:120px;object-fit:contain;" /></div>`
    : `<div class="rr-agent-slot">${data.company.name}</div>`

  const reportTitle = data.reference.is_guarantor ? 'Guarantor Reference Report' : 'Tenant Reference Report'

  return `
  <div class="rr-header">
    <div class="rr-logo-area">
      ${pgLogo}
      <span style="color:rgba(255,255,255,0.7);font-size:13px;font-weight:500;letter-spacing:0.5px;margin-left:12px;">${reportTitle}</span>
    </div>
    ${agentLogo}
  </div>`
}

function buildPage1(data: V2ReportData, totalPages: number): string {
  const ref = data.reference
  const firstName = decryptSafe(ref.tenant_first_name_encrypted)
  const lastName = decryptSafe(ref.tenant_last_name_encrypted)
  const fullName = `${firstName} ${lastName}`.trim() || 'Unknown Tenant'
  const propertyAddress = decryptSafe(ref.property_address_encrypted) || 'Not specified'
  const propertyCity = decryptSafe(ref.property_city_encrypted)
  const propertyPostcode = decryptSafe(ref.property_postcode_encrypted)
  const fullAddress = [propertyAddress, propertyCity, propertyPostcode].filter(Boolean).join(', ')
  const rentShare = ref.rent_share || ref.monthly_rent || 0
  const monthlyRent = ref.monthly_rent || 0
  const termParts: string[] = []
  if (ref.term_years) termParts.push(`${ref.term_years} year${ref.term_years > 1 ? 's' : ''}`)
  if (ref.term_months) termParts.push(`${ref.term_months} month${ref.term_months > 1 ? 's' : ''}`)
  const termStr = termParts.join(' ') || 'Not specified'

  const status = ref.status as string
  let resolvedStatus = status
  // For individual reports (INDIVIDUAL_COMPLETE / GROUP_ASSESSMENT), parse the intended decision from final_decision_notes
  if (status === 'INDIVIDUAL_COMPLETE' || status === 'GROUP_ASSESSMENT') {
    const notes = ref.final_decision_notes || ''
    const match = notes.match(/^INDIVIDUAL_DECISION:\s*(\S+)/i)
    resolvedStatus = match ? match[1].toUpperCase() : 'PASS'
    // Map PASS to ACCEPTED for display
    if (resolvedStatus === 'PASS') resolvedStatus = 'ACCEPTED'
  }
  const statusConfig = STATUS_CONFIG[resolvedStatus] || { label: resolvedStatus, cssClass: 'cond' }

  // Affordability - correct maths
  const incomeSection = data.sections.find(s => s.section_type === 'INCOME')
  const incomeData = (incomeSection?.section_data || {}) as Record<string, any>
  const incomeChecklist = incomeData.checklist_results || {}
  const totalEffective = incomeChecklist.total_effective_income || incomeChecklist.annual_income || ref.annual_income || 0
  const multiplier = ref.is_guarantor ? 32 : 30
  const required = multiplier * rentShare
  const affordabilityPasses = totalEffective >= required
  const ratioMultiple = rentShare > 0 ? (totalEffective / (rentShare * 12)) : 0
  const ratioDisplay = ratioMultiple > 0 ? `${ratioMultiple.toFixed(1)}\u00D7` : 'N/A'

  const qrHtml = data.qrCodeDataUrl
    ? `<img src="${data.qrCodeDataUrl}" style="width:56px;height:56px;border-radius:4px;" />`
    : `<div class="rr-qr-placeholder"></div>`

  const reviewerLine = data.reviewedBy
    ? `<span class="rr-meta-key">Reviewed by</span><span class="rr-meta-val" style="color:var(--pg-muted)">${esc(data.reviewedBy)}${ref.final_decision_at ? ` \u00B7 ${formatDateLong(ref.final_decision_at)}` : ''}</span>`
    : ''

  return `
  <div class="rr-page">
    ${buildHeader(data)}

    <!-- HERO -->
    <div class="rr-hero">
      <div>
        <div class="rr-hero-ref">REF: ${esc(ref.reference_number || ref.id)}</div>
        <div class="rr-meta-grid">
          <span class="rr-meta-key">${ref.is_guarantor ? 'Guarantor' : 'Tenant'}</span><span class="rr-meta-val">${esc(fullName)}</span>
          <span class="rr-meta-key">Property</span><span class="rr-meta-val">${esc(fullAddress)}</span>
          <span class="rr-meta-key">Rent share</span><span class="rr-meta-val">${formatMoney(rentShare)} / month${rentShare !== monthlyRent ? ` (of ${formatMoney(monthlyRent)} total)` : ''}</span>
          <span class="rr-meta-key">Move-in</span><span class="rr-meta-val">${formatDateLong(ref.move_in_date)}</span>
          <span class="rr-meta-key">Term</span><span class="rr-meta-val">${esc(termStr)}</span>
          ${reviewerLine}
        </div>
      </div>
      <div class="rr-decision-col">
        <div class="rr-decision-badge ${statusConfig.cssClass}">${statusConfig.label}</div>
        <div style="margin-top:12px;">
          ${qrHtml}
          <div class="rr-verify-label">Scan to verify</div>
        </div>
      </div>
    </div>

    <!-- AFFORDABILITY BAR -->
    <div class="rr-afford">
      <div class="rr-afford-tile">
        <div class="rr-afford-label">Annual Income</div>
        <div class="rr-afford-value">${formatMoney(totalEffective)}</div>
        <div class="rr-afford-sub">${totalEffective > 0 ? 'Verified' : 'Not verified'}</div>
      </div>
      <div class="rr-afford-tile">
        <div class="rr-afford-label">Monthly Rent Share</div>
        <div class="rr-afford-value">${formatMoney(rentShare)}</div>
        <div class="rr-afford-sub">${rentShare !== monthlyRent ? `of ${formatMoney(monthlyRent)} total` : 'Full rent'}</div>
      </div>
      <div class="rr-afford-tile">
        <div class="rr-afford-label">Affordability Ratio</div>
        <div class="rr-afford-value">${ratioDisplay}</div>
        <div class="rr-afford-pass" ${!affordabilityPasses ? 'style="color:var(--fail-text)"' : ''}>${affordabilityPasses ? `\u2713 Passes ${multiplier}\u00D7 threshold` : `\u2717 Below ${multiplier}\u00D7 threshold`}</div>
      </div>
    </div>

    <!-- SECTION OVERVIEW -->
    <div class="rr-section-header">
      <span class="rr-section-header-text">Section Results</span>
    </div>

    <div class="rr-grid">
      ${data.sections
        .filter(s => {
          // Guarantors only show: IDENTITY, ADDRESS, INCOME, CREDIT, AML
          if (ref.is_guarantor) {
            return ['IDENTITY', 'ADDRESS', 'INCOME', 'CREDIT', 'AML'].includes(s.section_type)
          }
          return true
        })
        .map(s => buildSectionCard(s, data.reference, data)).join('\n')}
    </div>

    ${buildFooter(data, 1, totalPages)}
  </div>`
}

function buildSectionCard(section: V2SectionRow, reference: V2ReferenceRow, data: V2ReportData): string {
  const sectionType = section.section_type as V2SectionType
  const name = SECTION_NAMES[sectionType] || section.section_type
  const icon = SECTION_ICONS[sectionType] || ''
  const decision = section.decision as V2SectionDecision | null
  const cardClass = getCardClass(decision)
  const badge = getDecisionBadge(decision)

  return `
    <div class="${cardClass}">
      <div class="rr-card-head">
        <div class="rr-card-head-name">
          ${icon}
          ${esc(name)}
        </div>
        ${badge}
      </div>
      <div class="rr-card-body">
        ${buildCheckItems(section, reference, data)}
      </div>
    </div>`
}

function buildPage2Identity(data: V2ReportData, totalPages: number): string {
  const ref = data.reference
  const firstName = decryptSafe(ref.tenant_first_name_encrypted)
  const lastName = decryptSafe(ref.tenant_last_name_encrypted)
  const dob = decryptSafe(ref.tenant_dob_encrypted)
  const email = decryptSafe(ref.tenant_email_encrypted)
  const phone = decryptSafe(ref.tenant_phone_encrypted)

  const identitySection = data.sections.find(s => s.section_type === 'IDENTITY')
  const rtrSection = data.sections.find(s => s.section_type === 'RTR')

  const identityData = (identitySection?.section_data || {}) as Record<string, any>
  const identityChecklist = identityData.checklist_results || {}
  const rtrData = (rtrSection?.section_data || {}) as Record<string, any>
  const rtrChecklist = rtrData.checklist_results || {}

  // Identity form data
  const formData = (ref.form_data || {}) as Record<string, any>
  const identityForm = formData.identity || {}
  const rtrForm = formData.rtr || {}

  const docType = identityChecklist.document_type || identityForm.documentType || identityData.document_type || 'Not specified'
  const expiryDate = identityChecklist.expiry_date || identityChecklist.document_expiry || ''

  // RTR — form_data.rtr values may be encrypted, try decrypt
  const citizenship = rtrChecklist.citizenship_status || rtrForm.citizenshipStatus || ref.citizenship_status || 'Not specified'
  const rtrType = rtrChecklist.rtr_type || rtrData.rtr_type || rtrForm.rtrType || ''
  const rtrExpiry = rtrChecklist.rtr_expiry_date || rtrForm.shareCodeExpiry || ''
  const rawShareCode = rtrForm.shareCode || ref.share_code || rtrChecklist.share_code || ''
  const shareCode = rawShareCode ? decryptSafe(rawShareCode) || rawShareCode : ''

  return `
  <div class="rr-page" style="page-break-before:always;">
    ${buildHeader(data)}

    <!-- IDENTITY DETAIL -->
    <div class="rr-section-divider">
      <span class="rr-section-divider-label">Identity Verification</span>
      <div class="rr-section-divider-line"></div>
      ${getDividerBadge(identitySection?.decision as V2SectionDecision | null)}
    </div>

    <div class="rr-income-wrap">
      <table class="rr-afford-table">
        <tr><td>Full Name</td><td>${esc(firstName)} ${esc(lastName)}</td></tr>
        <tr><td>Date of Birth</td><td>${dob ? formatDate(dob) : 'N/A'}</td></tr>
        <tr><td>Email</td><td>${esc(email) || 'N/A'}</td></tr>
        ${phone ? `<tr><td>Phone</td><td>${esc(phone)}</td></tr>` : ''}
        <tr><td>Document Type</td><td>${esc(formatValue(docType))}</td></tr>
        ${expiryDate ? `<tr><td>Expiry Date</td><td>${formatDate(expiryDate)}</td></tr>` : ''}
        ${identityChecklist.document_expiry_valid !== undefined ? `<tr><td>Document Valid</td><td style="color:${identityChecklist.document_expiry_valid ? 'var(--pass-text)' : 'var(--fail-text)'}">${identityChecklist.document_expiry_valid ? '\u2713 Yes' : '\u2717 Expired'}</td></tr>` : ''}
        ${identityChecklist.facial_match !== undefined ? `<tr><td>Facial Recognition</td><td style="color:${identityChecklist.facial_match ? 'var(--pass-text)' : 'var(--fail-text)'}">${identityChecklist.facial_match ? '\u2713 Clear' : '\u2717 Failed'}</td></tr>` : ''}
      </table>

      ${identitySection?.assessor_notes ? `<div style="font-size:11px;color:var(--pg-muted);margin-top:8px;"><strong>Assessor Notes:</strong> ${esc(identitySection.assessor_notes)}</div>` : ''}
    </div>

    <!-- RTR DETAIL -->
    <div class="rr-section-divider">
      <span class="rr-section-divider-label">Right to Rent</span>
      <div class="rr-section-divider-line"></div>
      ${getDividerBadge(rtrSection?.decision as V2SectionDecision | null)}
    </div>

    <div class="rr-income-wrap">
      <table class="rr-afford-table">
        <tr><td>Citizenship Status</td><td>${esc(formatValue(citizenship))}</td></tr>
        ${rtrType ? `<tr><td>RTR Type</td><td>${esc(formatValue(rtrType))}</td></tr>` : ''}
        ${rtrExpiry ? `<tr><td>RTR Expiry</td><td>${formatDate(rtrExpiry)}</td></tr>` : ''}
        ${shareCode ? `<tr><td>Share Code</td><td>${esc(maskShareCode(shareCode))}</td></tr>` : ''}
        ${rtrChecklist.digital_check !== undefined ? `<tr><td>Digital Check</td><td style="color:${rtrChecklist.digital_check ? 'var(--pass-text)' : 'var(--fail-text)'}">${rtrChecklist.digital_check ? '\u2713 Complete' : '\u2717 Failed'}</td></tr>` : ''}
      </table>

      ${rtrSection?.assessor_notes ? `<div style="font-size:11px;color:var(--pg-muted);margin-top:8px;"><strong>Assessor Notes:</strong> ${esc(rtrSection.assessor_notes)}</div>` : ''}
      ${rtrSection?.condition_text ? `<div class="rr-cond-note">${esc(rtrSection.condition_text)}</div>` : ''}
    </div>

    ${buildFooter(data, 2, totalPages)}
  </div>`
}

function buildGuarantorPage2Identity(data: V2ReportData, totalPages: number): string {
  const ref = data.reference
  const firstName = decryptSafe(ref.tenant_first_name_encrypted)
  const lastName = decryptSafe(ref.tenant_last_name_encrypted)
  const dob = decryptSafe(ref.tenant_dob_encrypted)
  const email = decryptSafe(ref.tenant_email_encrypted)
  const phone = decryptSafe(ref.tenant_phone_encrypted)

  const identitySection = data.sections.find(s => s.section_type === 'IDENTITY')
  const identityData = (identitySection?.section_data || {}) as Record<string, any>
  const identityChecklist = identityData.checklist_results || {}
  const formData = (ref.form_data || {}) as Record<string, any>
  const identityForm = formData.identity || {}

  const docType = identityChecklist.document_type || identityForm.documentType || identityData.document_type || 'Not specified'
  const expiryDate = identityChecklist.expiry_date || identityChecklist.document_expiry || ''

  // Address verification (proof of address for guarantors)
  const addressSection = data.sections.find(s => s.section_type === 'ADDRESS')
  const addressData = (addressSection?.section_data || {}) as Record<string, any>
  const addressChecklist = addressData.checklist_results || {}

  const currentAddr = [
    decryptSafe(ref.current_address_line1_encrypted),
    decryptSafe(ref.current_address_line2_encrypted),
    decryptSafe(ref.current_city_encrypted),
    decryptSafe(ref.current_postcode_encrypted)
  ].filter(Boolean).join(', ')

  return `
  <div class="rr-page" style="page-break-before:always;">
    ${buildHeader(data)}

    <!-- IDENTITY DETAIL -->
    <div class="rr-section-divider">
      <span class="rr-section-divider-label">Identity Verification</span>
      <div class="rr-section-divider-line"></div>
      ${getDividerBadge(identitySection?.decision as V2SectionDecision | null)}
    </div>

    <div class="rr-income-wrap">
      <table class="rr-afford-table">
        <tr><td>Full Name</td><td>${esc(firstName)} ${esc(lastName)}</td></tr>
        <tr><td>Date of Birth</td><td>${dob ? formatDate(dob) : 'N/A'}</td></tr>
        <tr><td>Email</td><td>${esc(email) || 'N/A'}</td></tr>
        ${phone ? `<tr><td>Phone</td><td>${esc(phone)}</td></tr>` : ''}
        <tr><td>Document Type</td><td>${esc(formatValue(docType))}</td></tr>
        ${expiryDate ? `<tr><td>Expiry Date</td><td>${formatDate(expiryDate)}</td></tr>` : ''}
        ${identityChecklist.document_expiry_valid !== undefined ? `<tr><td>Document Valid</td><td style="color:${identityChecklist.document_expiry_valid ? 'var(--pass-text)' : 'var(--fail-text)'}">${identityChecklist.document_expiry_valid ? '\u2713 Yes' : '\u2717 Expired'}</td></tr>` : ''}
        ${identityChecklist.facial_match !== undefined ? `<tr><td>Facial Recognition</td><td style="color:${identityChecklist.facial_match ? 'var(--pass-text)' : 'var(--fail-text)'}">${identityChecklist.facial_match ? '\u2713 Clear' : '\u2717 Failed'}</td></tr>` : ''}
      </table>

      ${identitySection?.assessor_notes ? `<div style="font-size:11px;color:var(--pg-muted);margin-top:8px;"><strong>Assessor Notes:</strong> ${esc(identitySection.assessor_notes)}</div>` : ''}
    </div>

    <!-- ADDRESS / PROOF OF ADDRESS -->
    <div class="rr-section-divider">
      <span class="rr-section-divider-label">Proof of Address</span>
      <div class="rr-section-divider-line"></div>
      ${getDividerBadge(addressSection?.decision as V2SectionDecision | null)}
    </div>

    <div class="rr-income-wrap">
      <table class="rr-afford-table">
        ${currentAddr ? `<tr><td>Current Address</td><td>${esc(currentAddr)}</td></tr>` : ''}
        ${addressChecklist.address_confirmed !== undefined ? `<tr><td>Address Confirmed</td><td style="color:${addressChecklist.address_confirmed ? 'var(--pass-text)' : 'var(--fail-text)'}">${addressChecklist.address_confirmed ? '\u2713 Yes' : '\u2717 No'}</td></tr>` : ''}
        ${addressChecklist.document_type ? `<tr><td>Document Type</td><td>${esc(formatValue(addressChecklist.document_type))}</td></tr>` : ''}
        ${addressChecklist.document_dated_within_3_months !== undefined ? `<tr><td>Document Recent</td><td style="color:${addressChecklist.document_dated_within_3_months ? 'var(--pass-text)' : 'var(--fail-text)'}">${addressChecklist.document_dated_within_3_months ? '\u2713 Within 3 months' : '\u2717 Older than 3 months'}</td></tr>` : ''}
      </table>

      ${addressSection?.assessor_notes ? `<div style="font-size:11px;color:var(--pg-muted);margin-top:8px;"><strong>Assessor Notes:</strong> ${esc(addressSection.assessor_notes)}</div>` : ''}
      ${addressSection?.condition_text ? `<div class="rr-cond-note">${esc(addressSection.condition_text)}</div>` : ''}
    </div>

    ${buildFooter(data, 2, totalPages)}
  </div>`
}

function buildPage3Income(data: V2ReportData, totalPages: number): string {
  const ref = data.reference
  const incomeSection = data.sections.find(s => s.section_type === 'INCOME')
  const incomeData = (incomeSection?.section_data || {}) as Record<string, any>
  const checklist = incomeData.checklist_results || {}

  // Income figures from checklist (assessor-verified)
  const annualIncome = checklist.annual_income || ref.annual_income || 0
  const monthlyIncome = checklist.monthly_income || (annualIncome ? Math.round(annualIncome / 12) : 0)
  // Show the declared savings amount (from form_data), not the 90% effective figure from checklist
  const formData = (ref.form_data || {}) as Record<string, any>
  const incomeForm = formData.income || {}
  const declaredSavings = incomeForm.savingsAmount ? parseFloat(String(incomeForm.savingsAmount)) : 0
  const savings = declaredSavings > 0 ? declaredSavings : (checklist.savings ? Math.round(checklist.savings / 0.9) : 0)
  const totalEffective = checklist.total_effective_income || annualIncome
  const rentShare = ref.rent_share || ref.monthly_rent || 0
  const multiplier = ref.is_guarantor ? 32 : 30
  const required = multiplier * rentShare
  const affordPasses = totalEffective >= required
  const percentDiff = required > 0 ? Math.round(((totalEffective - required) / required) * 100) : 0

  // Referee submissions
  const employerRef = data.refereeSubmissions.find((s: any) => s.referee_type === 'EMPLOYER')
  const accountantRef = data.refereeSubmissions.find((s: any) => s.referee_type === 'ACCOUNTANT')
  const employerVerbal = data.verbalReferences.find((v: any) => v.referee_type === 'EMPLOYER')

  return `
  <div class="rr-page" style="page-break-before:always;">
    ${buildHeader(data)}

    <!-- INCOME DETAIL -->
    <div class="rr-section-divider">
      <span class="rr-section-divider-label">Income Detail</span>
      <div class="rr-section-divider-line"></div>
      ${getDividerBadge(incomeSection?.decision as V2SectionDecision | null)}
    </div>

    <div class="rr-income-wrap">
      <table class="rr-afford-table">
        <tr><td>Monthly Income (evidenced)</td><td>${formatMoney(monthlyIncome)}</td></tr>
        <tr><td>Annual Income (calculated)</td><td>${formatMoney(annualIncome)}</td></tr>
        ${savings > 0 ? `<tr><td>Savings</td><td>${formatMoney(savings)}</td></tr>` : ''}
        <tr><td>Total Effective Income</td><td>${formatMoney(totalEffective)}</td></tr>
        <tr><td>Required (${multiplier}\u00D7 monthly rent)</td><td>${formatMoney(required)}</td></tr>
        <tr class="row-total"><td>Result</td><td>${affordPasses ? `\u2713 PASS \u2014 ${percentDiff > 0 ? `${percentDiff}% above threshold` : 'meets threshold'}` : `\u2717 FAIL \u2014 ${Math.abs(percentDiff)}% below threshold`}</td></tr>
      </table>

      ${employerRef ? buildRefereeCard('Employer Reference', employerRef) : ''}
      ${employerVerbal ? buildVerbalReferenceCard('Employer (Verbal)', employerVerbal) : ''}
      ${accountantRef ? buildRefereeCard('Accountant Reference', accountantRef) : ''}

      ${incomeSection?.assessor_notes ? `<div style="font-size:11px;color:var(--pg-muted);margin-top:12px;"><strong>Assessor Notes:</strong> ${esc(incomeSection.assessor_notes)}</div>` : ''}
      ${incomeSection?.condition_text ? `<div class="rr-cond-note">${esc(incomeSection.condition_text)}</div>` : ''}
    </div>

    ${buildFooter(data, 3, totalPages)}
  </div>`
}

function buildRefereeCard(title: string, submission: any): string {
  const formData = submission.form_data || {}
  const rows: string[] = []

  if (submission.referee_name) {
    rows.push(`<div class="rr-referee-cell">Referee</div><div class="rr-referee-cell">${esc(submission.referee_name)}</div>`)
  }

  for (const [key, value] of Object.entries(formData)) {
    if (key === 'submittedAt' || key === 'signature' || value === null || value === undefined || value === '') continue
    const label = formatLabel(key)
    if (!label) continue // skip keys with empty label (like submittedAt)
    const displayValue = formatFieldHtml(key, value)
    rows.push(`<div class="rr-referee-cell">${esc(label)}</div><div class="rr-referee-cell">${displayValue}</div>`)
  }

  return `
    <div class="rr-referee">
      <div class="rr-referee-head">
        <span class="rr-referee-title">${esc(title)}</span>
        <span class="rr-referee-sub">${submission.completed_at ? `Received ${formatDateLong(submission.completed_at)}` : ''}</span>
      </div>
      <div class="rr-referee-body">
        ${rows.join('\n')}
      </div>
    </div>`
}

function buildVerbalReferenceCard(title: string, vRef: any): string {
  const rows: string[] = []
  rows.push(`<div class="rr-referee-cell">Referee</div><div class="rr-referee-cell">${esc(vRef.referee_name)}${vRef.referee_position ? `, ${esc(vRef.referee_position)}` : ''}</div>`)
  rows.push(`<div class="rr-referee-cell">Phone</div><div class="rr-referee-cell">${esc(vRef.referee_phone)}</div>`)
  rows.push(`<div class="rr-referee-cell">Call Date</div><div class="rr-referee-cell">${formatDateLong(vRef.call_datetime)}</div>`)
  if (vRef.call_duration_minutes) {
    rows.push(`<div class="rr-referee-cell">Duration</div><div class="rr-referee-cell">${vRef.call_duration_minutes} minutes</div>`)
  }

  if (vRef.responses && typeof vRef.responses === 'object') {
    for (const [key, value] of Object.entries(vRef.responses)) {
      const label = formatLabel(key)
      if (!label) continue
      const displayValue = formatFieldHtml(key, value)
      rows.push(`<div class="rr-referee-cell">${esc(label)}</div><div class="rr-referee-cell">${displayValue}</div>`)
    }
  }

  return `
    <div class="rr-referee">
      <div class="rr-referee-head">
        <span class="rr-referee-title">${esc(title)}</span>
        <span class="rr-referee-sub">Verbal Reference</span>
      </div>
      <div class="rr-referee-body">
        ${rows.join('\n')}
      </div>
    </div>`
}

function buildPage4ResidentialCreditAml(data: V2ReportData, totalPages: number): string {
  const ref = data.reference
  const residentialSection = data.sections.find(s => s.section_type === 'RESIDENTIAL') || data.sections.find(s => s.section_type === 'ADDRESS')
  const creditSection = data.sections.find(s => s.section_type === 'CREDIT')
  const amlSection = data.sections.find(s => s.section_type === 'AML')

  const resData = (residentialSection?.section_data || {}) as Record<string, any>
  const resChecklist = resData.checklist_results || {}
  const creditSectionData = (creditSection?.section_data || {}) as Record<string, any>
  const creditChecklist = creditSectionData.checklist_results || {}
  const amlSectionData = (amlSection?.section_data || {}) as Record<string, any>
  const amlChecklist = amlSectionData.checklist_results || {}

  // Form data for residential
  const formData = (ref.form_data || {}) as Record<string, any>
  const resForm = formData.residential || {}

  // Residential info
  const currentAddr = [
    decryptSafe(ref.current_address_line1_encrypted),
    decryptSafe(ref.current_address_line2_encrypted),
    decryptSafe(ref.current_city_encrypted),
    decryptSafe(ref.current_postcode_encrypted)
  ].filter(Boolean).join(', ')
  const currentSituation = resChecklist.current_situation || resForm.currentLivingSituation || resForm.livingSituation || resData.current_situation || resData.currentLivingSituation || ''

  // Landlord reference
  const landlordRef = data.refereeSubmissions.find((s: any) => s.referee_type === 'LANDLORD' || s.referee_type === 'AGENT')
  const landlordVerbal = data.verbalReferences.find((v: any) => v.referee_type === 'LANDLORD' || v.referee_type === 'AGENT')

  // Credit — prefer actual credit check data from DB
  const cc = data.creditCheck
  const riskScore = cc?.risk_score ?? creditChecklist.risk_score ?? creditSectionData.risk_score ?? null
  const riskLevel = cc?.risk_level || creditChecklist.risk_level || creditSectionData.risk_level || ''
  const scoreFillWidth = riskScore !== null ? `${riskScore}%` : '0%'
  const scoreDotLeft = riskScore !== null ? `calc(${riskScore}% - 7px)` : '0'
  const riskBadgeStyle = getRiskBadgeStyle(riskLevel)

  // AML — prefer actual AML check data from DB
  const ac = data.amlCheck
  const amlRiskLevel = ac?.risk_level || amlChecklist.risk_level || amlSectionData.risk_level || ''
  const amlRiskBadgeStyle = getRiskBadgeStyle(amlRiskLevel)
  const amlSanctionsCount = ac?.sanctions_matches ?? 0
  const amlTotalMatches = ac?.total_matches ?? 0
  const amlSummary = ac?.summary || ''

  return `
  <div class="rr-page" style="page-break-before:always;">
    ${buildHeader(data)}

    <!-- RESIDENTIAL DETAIL -->
    <div class="rr-section-divider">
      <span class="rr-section-divider-label">${residentialSection?.section_type === 'ADDRESS' ? 'Address Verification' : 'Residential Detail'}</span>
      <div class="rr-section-divider-line"></div>
      ${getDividerBadge(residentialSection?.decision as V2SectionDecision | null)}
    </div>

    <div class="rr-income-wrap" style="padding-bottom:12px;">
      <table class="rr-afford-table">
        ${currentSituation ? `<tr><td>Current Situation</td><td>${esc(formatValue(currentSituation))}</td></tr>` : ''}
        ${currentAddr ? `<tr><td>Current Address</td><td>${esc(currentAddr)}</td></tr>` : ''}
        ${resChecklist.tenancy_duration ? `<tr><td>Duration</td><td>${esc(resChecklist.tenancy_duration)}</td></tr>` : ''}
        ${resChecklist.address_confirmed !== undefined ? `<tr><td>Address Confirmed</td><td style="color:${resChecklist.address_confirmed ? 'var(--pass-text)' : 'var(--fail-text)'}">${resChecklist.address_confirmed ? '\u2713 Yes' : '\u2717 No'}</td></tr>` : ''}
      </table>

      ${landlordRef ? buildRefereeCard('Landlord Reference', landlordRef) : ''}
      ${landlordVerbal ? buildVerbalReferenceCard('Landlord (Verbal)', landlordVerbal) : ''}

      ${residentialSection?.assessor_notes ? `<div style="font-size:11px;color:var(--pg-muted);margin-top:8px;"><strong>Assessor Notes:</strong> ${esc(residentialSection.assessor_notes)}</div>` : ''}
      ${residentialSection?.condition_text ? `<div class="rr-cond-note">${esc(residentialSection.condition_text)}</div>` : ''}
    </div>

    <!-- CREDIT DETAIL -->
    <div class="rr-section-divider">
      <span class="rr-section-divider-label">Risk Detail</span>
      <div class="rr-section-divider-line"></div>
      ${getDividerBadge(creditSection?.decision as V2SectionDecision | null)}
    </div>

    <div class="rr-credit-wrap">
      ${(() => {
        // Use decrypted responseData from creditCheck, fall back to section_data flags
        const rd = cc?.responseData
        const flags = rd?.flags || {}
        const identityOk = rd?.verifyMatch ?? creditSectionData.verifyMatch ?? creditChecklist.identity_confirmed ?? true
        const electoralOk = flags.electoralRegisterMatch ?? creditSectionData.electoralRegisterMatch ?? creditChecklist.electoral_roll
        const ccjFound = flags.ccjMatch ?? creditSectionData.ccjMatch ?? creditChecklist.ccjs ?? false
        const insolvencyFound = flags.insolvencyMatch ?? creditSectionData.insolvencyMatch ?? creditChecklist.insolvency ?? false
        const deceasedFound = flags.deceasedRegisterMatch ?? creditSectionData.deceasedRegisterMatch ?? false
        const ccjs = rd?.countyCourtJudgments || []
        const insolvencies = rd?.insolvencies || []
        const electoralRolls = rd?.electoralRolls || []
        const tenantDeclaredAdverse = creditChecklist.adverse_credit || creditSectionData.adverse_credit || false

        // Calculate PG Risk Score (consolidated from current + previous address)
        const prevCheck = data.previousAddressCreditCheck?.responseData
        const prevFlags = prevCheck?.flags || {}
        const prevCcjs = prevCheck?.countyCourtJudgments || []
        const prevInsolvencies = prevCheck?.insolvencies || []
        const allCcjs = [...ccjs, ...prevCcjs]
        const allInsolvencies = [...insolvencies, ...prevInsolvencies]
        const ccjCount = allCcjs.length || creditSectionData.ccjCount || 0
        const insolvencyCount = allInsolvencies.length || creditSectionData.insolvencyCount || 0
        const totalAdverse = ccjCount + insolvencyCount
        const hasAnyAdverse = ccjFound || insolvencyFound || prevFlags.ccjMatch || prevFlags.insolvencyMatch
        let pgScore = 100
        if (!electoralOk) pgScore -= 10
        if (!identityOk) pgScore -= 10
        if (deceasedFound) pgScore -= 50
        if (hasAnyAdverse) {
          if (totalAdverse > 1) pgScore -= 50
          else if (!tenantDeclaredAdverse) pgScore -= 80
          else pgScore -= 30
        }
        pgScore = Math.max(0, Math.min(100, pgScore))
        const pgPasses = pgScore >= 70
        const pgScoreColor = pgPasses ? 'var(--pass-text)' : 'var(--fail-text)'
        const pgScoreBg = pgPasses ? 'var(--pass-bg)' : 'var(--fail-bg)'
        const pgScoreBorder = pgPasses ? 'var(--pass-border)' : 'var(--fail-border)'
        const pgScoreLabel = pgScore === 100 ? 'Clear' : pgPasses ? 'PASS' : 'FAIL'

        let html = `
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:14px;padding:12px 16px;background:${pgScoreBg};border:1.5px solid ${pgScoreBorder};border-radius:8px;">
          <div style="font-family:'DM Serif Display',serif;font-size:32px;color:${pgScoreColor};line-height:1;">${pgScore}</div>
          <div>
            <div style="font-size:11px;color:var(--pg-muted);text-transform:uppercase;letter-spacing:0.5px;">PG Risk Score</div>
            <div style="font-size:14px;font-weight:600;color:${pgScoreColor};">${pgScoreLabel}</div>
          </div>
        </div>

        <table class="rr-afford-table">
          <tr><td>Identity Confirmed</td><td style="color:${identityOk ? 'var(--pass-text)' : 'var(--cond-text)'}">${identityOk ? '\u2713 Confirmed' : '\u26A0 Manually Verified'}</td></tr>
          <tr><td>Electoral Roll</td><td style="color:${electoralOk ? 'var(--pass-text)' : 'var(--cond-text)'}">${electoralOk ? '\u2713 Match Found' : '\u26A0 Not on Register'}</td></tr>
          <tr><td>County Court Judgments (CCJs)</td><td style="color:${ccjFound ? 'var(--fail-text)' : 'var(--pass-text)'}">${ccjFound ? `\u2717 ${ccjCount} Found` : '\u2713 Clear'}</td></tr>
          <tr><td>Insolvency / Bankruptcy</td><td style="color:${insolvencyFound ? 'var(--fail-text)' : 'var(--pass-text)'}">${insolvencyFound ? `\u2717 ${insolvencyCount} Found` : '\u2713 Clear'}</td></tr>
          <tr><td>Deceased Register</td><td style="color:${deceasedFound ? 'var(--fail-text)' : 'var(--pass-text)'}">${deceasedFound ? '\u2717 Match Found' : '\u2713 Clear'}</td></tr>
          <tr><td>Adverse Credit Declared</td><td>${tenantDeclaredAdverse ? '<span style="color:var(--fail-text)">\u2717 Yes — Declared by tenant</span>' : '<span style="color:var(--pass-text)">No</span>'}</td></tr>
        </table>`

        // CCJ details if any found
        if (ccjs.length > 0) {
          html += `<div style="margin-top:12px;"><p style="font-size:11px;font-weight:600;color:var(--fail-text);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">CCJ Details</p>`
          html += `<table class="rr-afford-table">`
          html += `<tr style="background:var(--pg-light);"><td style="font-weight:600;">Court</td><td style="font-weight:600;">Amount</td></tr>`
          for (const ccj of ccjs) {
            html += `<tr><td>${esc(ccj.courtName || 'Unknown')}</td><td>\u00A3${(ccj.amount || 0).toLocaleString('en-GB')} — ${esc(ccj.caseStatus || 'Unknown')} (${formatDate(ccj.dateOfJudgment)})</td></tr>`
          }
          html += `</table></div>`
        }

        // Insolvency details if any found
        if (insolvencies.length > 0) {
          html += `<div style="margin-top:12px;"><p style="font-size:11px;font-weight:600;color:var(--fail-text);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Insolvency Details</p>`
          html += `<table class="rr-afford-table">`
          for (const ins of insolvencies) {
            html += `<tr><td>${esc(ins.type || ins.caseType || 'Unknown')}</td><td>${esc(ins.status || 'Unknown')} — ${formatDate(ins.date || ins.startDate)}</td></tr>`
          }
          html += `</table></div>`
        }

        // Electoral roll records
        if (electoralRolls.length > 0) {
          html += `<div style="margin-top:12px;"><p style="font-size:11px;font-weight:500;color:var(--pg-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Electoral Roll Records</p>`
          html += `<table class="rr-afford-table">`
          for (const er of electoralRolls) {
            html += `<tr><td>${esc(er.address || 'Unknown')}</td><td>${er.dateOfRegistration ? formatDate(er.dateOfRegistration) : ''}</td></tr>`
          }
          html += `</table></div>`
        }

        return html
      })()}

      ${cc?.transaction_id ? `<div style="font-size:10px;color:var(--pg-muted);margin-top:6px;">Check date: ${formatDate(cc?.created_at || creditSectionData.checkedAt)} \u00B7 Transaction ID: ${esc(cc.transaction_id)}</div>` : (creditSectionData.checkedAt ? `<div style="font-size:10px;color:var(--pg-muted);margin-top:6px;">Check date: ${formatDate(creditSectionData.checkedAt)}</div>` : '')}

      ${(() => {
        const prev = data.previousAddressCreditCheck
        if (!prev) return ''
        const prd = prev.responseData
        const pflags = prd?.flags || {}
        const pCcjFound = pflags.ccjMatch ?? false
        const pInsolvencyFound = pflags.insolvencyMatch ?? false
        const pElectoralOk = pflags.electoralRegisterMatch ?? true
        const pCcjs = prd?.countyCourtJudgments || []
        const pInsolvencies = prd?.insolvencies || []
        const prevAddr = prev.requestData?.address ? `${esc(prev.requestData.address)}, ${esc(prev.requestData.postcode || '')}` : 'Previous Address'

        let prevHtml = `
        <div style="margin-top:16px;padding:12px 16px;background:#EEF2FF;border:1.5px solid #C7D2FE;border-radius:8px;">
          <div style="font-size:12px;font-weight:600;color:#4338CA;margin-bottom:8px;">Previous Address Credit Check</div>
          <div style="font-size:10px;color:#6366F1;margin-bottom:8px;">${prevAddr}</div>
          <table class="rr-afford-table">
            <tr><td>Electoral Roll</td><td style="color:${pElectoralOk ? 'var(--pass-text)' : 'var(--cond-text)'}">${pElectoralOk ? '\u2713 Match Found' : '\u26A0 Not on Register'}</td></tr>
            <tr><td>CCJs</td><td style="color:${pCcjFound ? 'var(--fail-text)' : 'var(--pass-text)'}">${pCcjFound ? `\u2717 ${pCcjs.length} Found` : '\u2713 Clear'}</td></tr>
            <tr><td>Insolvency</td><td style="color:${pInsolvencyFound ? 'var(--fail-text)' : 'var(--pass-text)'}">${pInsolvencyFound ? '\u2717 Found' : '\u2713 Clear'}</td></tr>
          </table>`

        if (pCcjs.length > 0) {
          prevHtml += `<table class="rr-afford-table" style="margin-top:6px;">`
          prevHtml += `<tr style="background:#FEE2E2;"><td style="font-weight:600;">Court</td><td style="font-weight:600;">Amount</td></tr>`
          for (const ccj of pCcjs) {
            prevHtml += `<tr><td>${esc(ccj.courtName || 'Unknown')}</td><td>\u00A3${(ccj.amount || 0).toLocaleString('en-GB')} — ${esc(ccj.caseStatus || 'Unknown')}</td></tr>`
          }
          prevHtml += `</table>`
        }

        if (pInsolvencies.length > 0) {
          prevHtml += `<table class="rr-afford-table" style="margin-top:6px;">`
          for (const ins of pInsolvencies) {
            prevHtml += `<tr><td>${esc(ins.type || ins.caseType || 'Unknown')}</td><td>${esc(ins.status || 'Unknown')}</td></tr>`
          }
          prevHtml += `</table>`
        }

        prevHtml += `<div style="font-size:10px;color:var(--pg-muted);margin-top:6px;">Check date: ${formatDate(prev.created_at)} \u00B7 Transaction ID: ${esc(prev.transaction_id || 'N/A')}</div>`
        prevHtml += `</div>`
        return prevHtml
      })()}

      ${creditSection?.assessor_notes ? `<div style="font-size:10px;color:var(--pg-muted);margin-top:8px;"><strong>Assessor Notes:</strong> ${esc(creditSection.assessor_notes)}</div>` : ''}
      ${creditSection?.condition_text ? `<div class="rr-cond-note">${esc(creditSection.condition_text)}</div>` : ''}
    </div>

    <!-- AML DETAIL -->
    <div class="rr-section-divider">
      <span class="rr-section-divider-label">AML / Sanctions</span>
      <div class="rr-section-divider-line"></div>
      ${getDividerBadge(amlSection?.decision as V2SectionDecision | null)}
    </div>

    <div class="rr-income-wrap">
      ${amlRiskLevel ? `<div style="margin-bottom:10px;"><span class="rr-score-risk" style="${amlRiskBadgeStyle}">${esc(amlRiskLevel.toUpperCase())}</span></div>` : ''}

      <table class="rr-afford-table">
        <tr><td>Sanctions Matches</td><td style="color:${(amlSanctionsCount || amlSectionData.sanctionsMatches || 0) === 0 ? 'var(--pass-text)' : 'var(--fail-text)'}">${(amlSanctionsCount || amlSectionData.sanctionsMatches || 0) === 0 ? '\u2713 Clear' : `\u2717 ${amlSanctionsCount || amlSectionData.sanctionsMatches} Found`}</td></tr>
        <tr><td>PEP Check</td><td style="color:${(amlChecklist.pep_matches || amlSectionData.pepMatches || 0) > 0 ? 'var(--fail-text)' : 'var(--pass-text)'}">${(amlChecklist.pep_matches || amlSectionData.pepMatches || 0) > 0 ? '\u2717 Matches Found' : '\u2713 Clear'}</td></tr>
        <tr><td>Adverse Media</td><td style="color:${(amlChecklist.adverse_media || amlSectionData.adverseMedia || 0) > 0 ? 'var(--fail-text)' : 'var(--pass-text)'}">${(amlChecklist.adverse_media || amlSectionData.adverseMedia || 0) > 0 ? '\u2717 Found' : '\u2713 Clear'}</td></tr>
        ${ac ? `<tr><td>Total Matches</td><td>${amlTotalMatches}</td></tr>` : ''}
      </table>

      ${amlSummary ? `<div style="font-size:11px;color:var(--pg-muted);margin-top:6px;">${esc(amlSummary)}</div>` : ''}
      ${amlSection?.assessor_notes ? `<div style="font-size:10px;color:var(--pg-muted);margin-top:8px;"><strong>Assessor Notes:</strong> ${esc(amlSection.assessor_notes)}</div>` : ''}
      ${amlSection?.condition_text ? `<div class="rr-cond-note">${esc(amlSection.condition_text)}</div>` : ''}
    </div>

    ${buildFooter(data, 4, totalPages)}
  </div>`
}

function buildPage5GroupSummary(data: V2ReportData, totalPages: number): string {
  if (!data.children || data.children.length === 0) return ''

  const monthlyRent = data.reference.monthly_rent || 0

  const rows: string[] = []
  let totalIncome = 0
  let totalRentShare = 0

  for (const child of data.children) {
    const cRef = child.reference
    const firstName = decryptSafe(cRef.tenant_first_name_encrypted)
    const lastName = decryptSafe(cRef.tenant_last_name_encrypted)

    // Get income from checklist first
    const incSec = child.sections.find(s => s.section_type === 'INCOME')
    const incData = (incSec?.section_data || {}) as Record<string, any>
    const incChecklist = incData.checklist_results || {}
    const income = incChecklist.total_effective_income || incChecklist.annual_income || cRef.annual_income || 0
    const rentShare = cRef.rent_share || monthlyRent
    const ratio = rentShare > 0 ? (income / (rentShare * 12)) : 0
    const passes = income >= 30 * rentShare

    totalIncome += income
    totalRentShare += rentShare

    rows.push(`
      <tr>
        <td style="font-weight:500;">${esc(firstName)} ${esc(lastName)}</td>
        <td>${formatMoney(rentShare)}</td>
        <td>${formatMoney(income)}</td>
        <td>${ratio > 0 ? `${ratio.toFixed(1)}\u00D7` : 'N/A'}</td>
        <td style="color:${passes ? 'var(--pass-text)' : 'var(--fail-text)'}">${passes ? '\u2713 PASS' : '\u2717 FAIL'}</td>
      </tr>`)

    if (child.guarantor) {
      const gRef = child.guarantor.reference
      const gFirst = decryptSafe(gRef.tenant_first_name_encrypted)
      const gLast = decryptSafe(gRef.tenant_last_name_encrypted)
      const gIncSec = child.guarantor.sections.find(s => s.section_type === 'INCOME')
      const gIncData = (gIncSec?.section_data || {}) as Record<string, any>
      const gIncChecklist = gIncData.checklist_results || {}
      const gIncome = gIncChecklist.total_effective_income || gIncChecklist.annual_income || gRef.annual_income || 0
      const gRentShare = cRef.rent_share || monthlyRent
      const gRatio = gRentShare > 0 ? (gIncome / (gRentShare * 12)) : 0
      const gPasses = gIncome >= 32 * gRentShare

      rows.push(`
        <tr style="background:var(--pg-light);">
          <td style="padding-left:24px;color:var(--pg-muted);">\u2514 ${esc(gFirst)} ${esc(gLast)} (Guarantor)</td>
          <td style="color:var(--pg-muted);">\u2014</td>
          <td>${formatMoney(gIncome)}</td>
          <td>${gRatio > 0 ? `${gRatio.toFixed(1)}\u00D7` : 'N/A'}</td>
          <td style="color:${gPasses ? 'var(--pass-text)' : 'var(--fail-text)'}">${gPasses ? '\u2713 PASS' : '\u2717 FAIL'}</td>
        </tr>`)
    }
  }

  const combinedRatio = totalRentShare > 0 ? (totalIncome / (totalRentShare * 12)) : 0

  return `
  <div class="rr-page" style="page-break-before:always;">
    ${buildHeader(data)}

    <div class="rr-section-divider">
      <span class="rr-section-divider-label">Group Application Summary</span>
      <div class="rr-section-divider-line"></div>
    </div>

    <div class="rr-income-wrap">
      <table class="rr-afford-table" style="font-size:12px;">
        <thead>
          <tr style="background:var(--pg-navy);">
            <td style="color:#fff!important;font-weight:600;text-transform:uppercase;font-size:10px;letter-spacing:0.5px;">Name</td>
            <td style="color:#fff!important;font-weight:600;text-transform:uppercase;font-size:10px;letter-spacing:0.5px;">Rent Share</td>
            <td style="color:#fff!important;font-weight:600;text-transform:uppercase;font-size:10px;letter-spacing:0.5px;">Annual Income</td>
            <td style="color:#fff!important;font-weight:600;text-transform:uppercase;font-size:10px;letter-spacing:0.5px;">Ratio</td>
            <td style="color:#fff!important;font-weight:600;text-transform:uppercase;font-size:10px;letter-spacing:0.5px;">Result</td>
          </tr>
        </thead>
        <tbody>
          ${rows.join('\n')}
        </tbody>
        <tfoot>
          <tr class="row-total">
            <td style="font-weight:600;">Combined Total</td>
            <td style="font-weight:600;">${formatMoney(totalRentShare)} / mo</td>
            <td style="font-weight:600;">${formatMoney(totalIncome)}</td>
            <td style="font-weight:600;">${combinedRatio > 0 ? `${combinedRatio.toFixed(1)}\u00D7` : 'N/A'}</td>
            <td></td>
          </tr>
          <tr>
            <td colspan="2" style="color:var(--pg-muted);">Total Monthly Rent</td>
            <td colspan="3" style="font-weight:600;">${formatMoney(monthlyRent)} / month</td>
          </tr>
        </tfoot>
      </table>
    </div>

    ${buildFooter(data, totalPages - 1, totalPages)}
  </div>`
}

function buildLastPage(data: V2ReportData, totalPages: number): string {
  const verificationUrl = `https://app.propertygoose.co.uk/verify/${data.reference.id}`
  const qrHtml = data.qrCodeDataUrl
    ? `<img src="${data.qrCodeDataUrl}" style="width:80px;height:80px;border-radius:4px;" />`
    : ''

  return `
  <div class="rr-page" style="page-break-before:always;">
    ${buildHeader(data)}

    <div style="padding:30px 24px;">
      <div class="rr-section-divider" style="padding:0;margin-bottom:20px;">
        <span class="rr-section-divider-label">Disclaimer &amp; Verification</span>
        <div class="rr-section-divider-line"></div>
      </div>

      <div style="font-size:11px;color:var(--pg-muted);line-height:1.7;margin-bottom:24px;">
        <p style="margin:0 0 10px;">This report has been prepared by PropertyGoose Ltd based on the information and evidence provided by the applicant, their referees, and third-party data sources at the time of assessment. While every reasonable effort has been made to verify the accuracy of the information contained herein, PropertyGoose Ltd does not guarantee the completeness or accuracy of any information provided by third parties.</p>
        <p style="margin:0 0 10px;">This report is provided for the exclusive use of the letting agent and/or landlord named in connection with this application. It should not be relied upon as the sole basis for any tenancy decision and does not constitute a recommendation to grant or refuse a tenancy. The recipient should exercise their own judgment and carry out any additional due diligence they deem appropriate.</p>
        <p style="margin:0 0 10px;">PropertyGoose Ltd accepts no liability for any loss, damage, or expense arising from reliance on this report or any decisions made based on its contents. This report is confidential and must not be disclosed to any third party without the prior written consent of PropertyGoose Ltd.</p>
        <p style="margin:0;">\u00A9 ${new Date().getFullYear()} PropertyGoose Ltd. All rights reserved.</p>
      </div>

      <div style="display:flex;align-items:center;gap:20px;padding:20px;border:1px solid var(--pg-border);border-radius:8px;background:var(--pg-light);">
        ${qrHtml ? `<div>${qrHtml}</div>` : ''}
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--pg-navy);margin-bottom:4px;">Verify This Report</div>
          <div style="font-size:11px;color:var(--pg-muted);margin-bottom:6px;">Scan the QR code or visit the link below to verify the authenticity of this report.</div>
          <a href="${esc(verificationUrl)}" style="font-size:11px;color:var(--pg-orange);text-decoration:underline;">${esc(verificationUrl)}</a>
        </div>
      </div>

      ${data.reference.final_decision_notes ? `
      <div style="margin-top:20px;padding:14px;border:1px solid var(--pg-border);border-radius:8px;">
        <div style="font-size:11px;font-weight:600;color:var(--pg-navy);margin-bottom:6px;">Decision Notes</div>
        <div style="font-size:12px;color:var(--pg-text);line-height:1.5;">${esc(data.reference.final_decision_notes)}</div>
      </div>` : ''}
    </div>

    ${buildFooter(data, totalPages, totalPages)}
  </div>`
}

// ============================================================================
// CSS
// ============================================================================

function getCSS(): string {
  return `
@page {
  size: A4;
  margin: 16mm 14mm;
}

:root {
  --pg-navy: #1B3464;
  --pg-navy-light: #253F7A;
  --pg-orange: #F48024;
  --pg-light: #F4F6FA;
  --pg-border: #E2E7F0;
  --pg-text: #1A1A2E;
  --pg-muted: #6B7A99;
  --pass-bg: #EAF7F1;
  --pass-text: #1A7A4A;
  --pass-border: #5CC48A;
  --cond-bg: #FFF8E7;
  --cond-text: #B07D10;
  --cond-border: #F4C842;
  --fail-bg: #FDECEA;
  --fail-text: #C0392B;
  --fail-border: #E74C3C;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
  background: #fff;
  color: var(--pg-text);
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.rr-page {
  background: #fff;
  width: 100%;
  overflow: hidden;
  position: relative;
  page-break-after: always;
  min-height: calc(100vh - 32mm);
  display: flex;
  flex-direction: column;
}

.rr-page:last-child {
  page-break-after: avoid;
}

/* HEADER */
.rr-header {
  background: var(--pg-navy);
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 3px solid var(--pg-orange);
}
.rr-logo-area {
  display: flex;
  align-items: center;
  gap: 10px;
}
.rr-agent-slot {
  border: 1.5px dashed rgba(255,255,255,0.3);
  border-radius: 6px;
  width: 130px; height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255,255,255,0.4);
  font-size: 11px;
  letter-spacing: 0.5px;
}

/* HERO */
.rr-hero {
  background: var(--pg-light);
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid var(--pg-border);
}
.rr-hero-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: var(--pg-muted);
  font-weight: 500;
  margin-bottom: 2px;
}
.rr-hero-title {
  font-weight: 600;
  font-size: 18px;
  color: var(--pg-navy);
  margin: 0 0 14px;
}
.rr-hero-ref {
  font-size: 11px;
  color: var(--pg-muted);
  font-family: 'Courier New', monospace;
  margin-bottom: 14px;
  letter-spacing: 0.5px;
}
.rr-meta-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 3px 16px;
  font-size: 13px;
}
.rr-meta-key { color: var(--pg-muted); font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; padding-top: 1px; }
.rr-meta-val { color: var(--pg-text); }

.rr-decision-col {
  text-align: center;
  min-width: 160px;
}
.rr-decision-badge {
  background: var(--pass-bg);
  color: var(--pass-text);
  border: 1.5px solid var(--pass-border);
  border-radius: 40px;
  padding: 10px 28px;
  font-weight: 600;
  font-size: 20px;
  letter-spacing: 1px;
  display: inline-block;
  margin-bottom: 10px;
}
.rr-decision-badge.cond {
  background: var(--cond-bg); color: var(--cond-text); border-color: var(--cond-border);
}
.rr-decision-badge.fail {
  background: var(--fail-bg); color: var(--fail-text); border-color: var(--fail-border);
}
.rr-qr-placeholder {
  width: 56px; height: 56px;
  border: 1px solid var(--pg-border);
  border-radius: 4px;
  margin: 0 auto;
  background: repeating-linear-gradient(0deg, #E2E7F0 0px, #E2E7F0 3px, transparent 3px, transparent 6px),
              repeating-linear-gradient(90deg, #E2E7F0 0px, #E2E7F0 3px, transparent 3px, transparent 6px);
}
.rr-verify-label { font-size: 10px; color: var(--pg-muted); margin-top: 5px; }

/* AFFORDABILITY BAR */
.rr-afford {
  display: flex;
  border-bottom: 1px solid var(--pg-border);
}
.rr-afford-tile {
  flex: 1;
  padding: 14px 20px;
  border-right: 1px solid var(--pg-border);
  text-align: center;
}
.rr-afford-tile:last-child { border-right: none; }
.rr-afford-label { font-size: 10px; color: var(--pg-muted); text-transform: uppercase; letter-spacing: 0.8px; font-weight: 500; margin-bottom: 4px; }
.rr-afford-value { font-size: 18px; color: var(--pg-navy); font-weight: 600; }
.rr-afford-sub { font-size: 11px; color: var(--pg-muted); margin-top: 2px; }
.rr-afford-pass { color: var(--pass-text); font-size: 11px; font-weight: 500; margin-top: 3px; }

/* SECTION GRID */
.rr-section-header {
  padding: 14px 24px 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.rr-section-header-text {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: var(--pg-muted);
  font-weight: 500;
}
.rr-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 0 16px 16px;
  gap: 12px;
}
.rr-card {
  border: 1px solid var(--pg-border);
  border-radius: 8px;
  overflow: hidden;
  border-left: 4px solid var(--pass-border);
}
.rr-card.cond { border-left-color: var(--cond-border); }
.rr-card.fail { border-left-color: var(--fail-border); background: var(--fail-bg); }

.rr-card-head {
  background: var(--pg-navy);
  padding: 9px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.rr-card-head-name {
  color: rgba(255,255,255,0.95);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 7px;
}
.rr-card-badge {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.8px;
  padding: 3px 10px;
  border-radius: 20px;
  background: var(--pass-bg);
  color: var(--pass-text);
  border: 1px solid var(--pass-border);
}
.rr-card-badge.cond { background: var(--cond-bg); color: var(--cond-text); border-color: var(--cond-border); }
.rr-card-badge.fail { background: var(--fail-bg); color: var(--fail-text); border-color: var(--fail-border); }

.rr-card-body {
  padding: 10px 14px;
  background: #fff;
}
.rr-check-item {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  font-size: 12px;
  color: var(--pg-text);
  line-height: 1.5;
  margin-bottom: 3px;
}
.rr-check-item .ic { font-size: 11px; margin-top: 1px; flex-shrink: 0; }
.ic-pass { color: var(--pass-text); }
.ic-cond { color: var(--cond-text); }
.ic-fail { color: var(--fail-text); }
.rr-cond-note {
  background: var(--cond-bg);
  border-left: 3px solid var(--cond-border);
  border-radius: 0 4px 4px 0;
  padding: 6px 10px;
  font-size: 11px;
  color: var(--cond-text);
  margin-top: 8px;
  line-height: 1.4;
}

/* SECTION DETAIL */
.rr-section-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 24px 0;
  margin-bottom: 14px;
}
.rr-section-divider-label {
  font-weight: 600;
  font-size: 16px;
  color: var(--pg-navy);
  white-space: nowrap;
}
.rr-section-divider-line {
  flex: 1;
  height: 1px;
  background: var(--pg-border);
}
.rr-section-divider-badge {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.8px;
  padding: 3px 12px;
  border-radius: 20px;
  background: var(--pass-bg);
  color: var(--pass-text);
  border: 1px solid var(--pass-border);
}

/* INCOME TABLE */
.rr-income-wrap { padding: 0 24px 20px; }
.rr-afford-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  margin-bottom: 16px;
}
.rr-afford-table td {
  padding: 7px 12px;
  border-bottom: 1px solid var(--pg-border);
  color: var(--pg-text);
}
.rr-afford-table tr:nth-child(odd) td { background: var(--pg-light); }
.rr-afford-table td:first-child { color: var(--pg-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; }
.rr-afford-table .row-total td { font-weight: 600; background: #EAF7F1 !important; color: var(--pass-text); }
.rr-afford-table td:last-child { text-align: right; font-weight: 500; }

/* CREDIT SCORE */
.rr-credit-wrap { padding: 0 24px 20px; }
.rr-score-row {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 14px;
}
.rr-score-number {
  font-weight: 600;
  font-size: 36px;
  color: var(--pg-navy);
  line-height: 1;
  min-width: 60px;
}
.rr-score-bar-wrap { flex: 1; }
.rr-score-label { font-size: 11px; color: var(--pg-muted); margin-bottom: 5px; }
.rr-score-track {
  height: 10px;
  background: var(--pg-border);
  border-radius: 5px;
  position: relative;
  overflow: visible;
}
.rr-score-fill {
  height: 100%;
  background: linear-gradient(90deg, #E74C3C 0%, #F4C842 40%, #5CC48A 70%);
  border-radius: 5px;
}
.rr-score-dot {
  width: 14px; height: 14px;
  background: var(--pg-navy);
  border: 2px solid #fff;
  border-radius: 50%;
  position: absolute;
  top: -2px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
}
.rr-score-risk {
  background: var(--pass-bg);
  color: var(--pass-text);
  border: 1px solid var(--pass-border);
  border-radius: 20px;
  padding: 4px 14px;
  font-size: 12px;
  font-weight: 600;
  align-self: flex-end;
  margin-bottom: 2px;
  white-space: nowrap;
  display: inline-block;
}

/* REFEREE CARD */
.rr-referee {
  border: 1px solid var(--pg-border);
  border-radius: 8px;
  overflow: hidden;
  margin-top: 16px;
}
.rr-referee-head {
  background: var(--pg-light);
  padding: 9px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--pg-border);
}
.rr-referee-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: var(--pg-navy); }
.rr-referee-sub { font-size: 11px; color: var(--pg-muted); }
.rr-referee-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
}
.rr-referee-cell {
  padding: 7px 14px;
  font-size: 12px;
  border-bottom: 1px solid var(--pg-border);
}
.rr-referee-cell:nth-child(odd) { color: var(--pg-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; background: #FAFBFD; }
.rr-referee-cell:nth-child(even) { color: var(--pg-text); font-weight: 500; }

/* FOOTER */
.rr-footer {
  border-top: 1px solid var(--pg-border);
  padding: 10px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
}
.rr-footer-text { font-size: 10px; color: var(--pg-muted); }

/* ICON SVGs */
.section-icon { width: 16px; height: 16px; display: inline-block; vertical-align: middle; opacity: 0.85; }
`
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export function buildReportHtml(data: V2ReportData): string {
  const status = data.reference.status as string
  const isIndividualReport = status === 'INDIVIDUAL_COMPLETE' || status === 'GROUP_ASSESSMENT'
  const isGroup = data.reference.is_group_parent && data.children && data.children.length > 0 && !isIndividualReport
  const isGuarantor = !!data.reference.is_guarantor

  // Guarantor: cover, identity (no RTR), income, address+credit+aml, disclaimer = 5 pages
  // Tenant: cover, identity+rtr, income, residential+credit+aml, disclaimer = 5 pages (+1 if group)
  let totalPages = isGuarantor ? 5 : 5
  if (isGroup) totalPages = 6

  const pages: string[] = []

  // Page 1 - Cover/Summary
  pages.push(buildPage1(data, totalPages))

  if (isGuarantor) {
    // Guarantor flow: Identity only (no RTR), Income, Address+Credit+AML
    pages.push(buildGuarantorPage2Identity(data, totalPages))
    pages.push(buildPage3Income(data, totalPages))
    pages.push(buildPage4ResidentialCreditAml(data, totalPages))
  } else {
    // Tenant flow: Identity+RTR, Income, Residential+Credit+AML
    pages.push(buildPage2Identity(data, totalPages))
    pages.push(buildPage3Income(data, totalPages))
    pages.push(buildPage4ResidentialCreditAml(data, totalPages))
  }

  // Group Summary (only for final ACCEPTED group reports, not individual reports)
  if (isGroup) {
    pages.push(buildPage5GroupSummary(data, totalPages))
  }

  // Last page - Disclaimer + Verification
  pages.push(buildLastPage(data, totalPages))

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reference Report - ${esc(data.reference.reference_number || data.reference.id)}</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>${getCSS()}</style>
</head>
<body>
  ${pages.join('\n')}
</body>
</html>`
}

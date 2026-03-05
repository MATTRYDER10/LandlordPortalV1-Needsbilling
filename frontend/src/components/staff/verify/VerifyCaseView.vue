<template>
  <div class="min-h-screen bg-gray-50 dark:bg-slate-900">
    <!-- Sticky Header -->
    <div class="sticky top-0 z-50 bg-white dark:bg-slate-800 shadow-md">
      <!-- Top Bar with Logo and Navigation -->
      <div class="border-b border-gray-200 dark:border-slate-700">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between items-center py-4">
            <div class="flex items-center">
              <img src="/PropertyGooseLogo.png" alt="PropertyGoose" class="h-9 mr-3 dark:hidden" />
              <img src="/PropertyGooseLogoDark.png" alt="PropertyGoose" class="h-9 mr-3 hidden dark:block" />
              <span class="text-sm font-semibold px-3 py-1 bg-primary/10 text-primary rounded-full">Verify Case</span>
            </div>
            <div class="flex items-center gap-4">
              <router-link
                to="/staff/work-queue"
                class="flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md"
              >
                <ArrowLeft class="w-5 h-5 mr-2" />
                Back to Portal
              </router-link>
              <button
                @click="handleSignOut"
                class="flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md"
              >
                <LogOut class="w-5 h-5 mr-2" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Person Context Bar -->
      <div class="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <!-- Person Info -->
            <div class="flex items-center gap-4">
              <!-- Photo -->
              <div class="relative">
                <img
                  v-if="selfieBlobUrl"
                  :src="selfieBlobUrl"
                  :alt="personName"
                  class="w-14 h-14 rounded-full object-cover border-2 border-white shadow"
                />
                <div v-else class="w-14 h-14 rounded-full bg-gray-200 dark:bg-slate-700 border-2 border-white dark:border-slate-600 shadow flex items-center justify-center">
                  <User class="w-7 h-7 text-gray-400 dark:text-slate-500" />
                </div>
                <!-- Role Badge -->
                <span :class="[
                  'absolute -bottom-1 -right-1 px-2 py-0.5 text-xs font-semibold rounded-full',
                  isGuarantor ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300'
                ]">
                  {{ isGuarantor ? 'G' : 'T' }}
                </span>
              </div>
              <!-- Name and Details -->
              <div>
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ personName }}</h2>
                <p class="text-sm text-gray-600 dark:text-slate-400">{{ propertyAddress }}</p>
              </div>
            </div>

            <!-- TAS Score -->
            <div v-if="tasScore !== undefined" class="flex items-center gap-2">
              <span class="text-sm text-gray-600 dark:text-slate-400">TAS Score:</span>
              <span :class="[
                'px-3 py-1 text-lg font-bold rounded-lg',
                tasScore >= 70 ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' :
                tasScore >= 50 ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300' :
                tasScore >= 30 ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300' :
                'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300'
              ]">
                {{ tasScore }}
              </span>
            </div>

            <!-- Section Progress -->
            <div class="flex items-center gap-3">
              <span class="text-sm text-gray-600 dark:text-slate-400">Progress:</span>
              <div class="flex items-center gap-1">
                <span
                  v-for="section in sections"
                  :key="section.id"
                  :class="[
                    'w-3 h-3 rounded-full',
                    section.decision === 'PASS' ? 'bg-green-500' :
                    section.decision === 'PASS_WITH_CONDITION' ? 'bg-amber-500' :
                    section.decision === 'ACTION_REQUIRED' ? 'bg-orange-500' :
                    section.decision === 'FAIL' ? 'bg-red-500' :
                    'bg-gray-300 dark:bg-slate-600'
                  ]"
                  :title="`${getSectionLabel(section.sectionType)}: ${section.decision}`"
                ></span>
              </div>
              <span class="text-sm font-medium text-gray-700 dark:text-slate-300">
                {{ completedSections }}/{{ totalSections }}
              </span>
            </div>

            <!-- Lock Status -->
            <div class="flex items-center gap-2">
              <div v-if="lock.isLockedByMe" class="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 rounded-lg">
                <Lock class="w-4 h-4" />
                <span class="text-sm font-medium">Locked by you</span>
              </div>
              <div v-else-if="lock.isLocked" class="flex items-center gap-2 px-3 py-1.5 bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 rounded-lg">
                <Lock class="w-4 h-4" />
                <span class="text-sm font-medium">Locked by {{ lock.lockedByName }}</span>
              </div>
              <button
                v-if="!lock.isLocked && !lock.isLockedByMe"
                @click="claimLock"
                :disabled="lock.loading"
                class="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
              >
                <Loader2 v-if="lock.loading" class="w-4 h-4 animate-spin" />
                <LockOpen v-else class="w-4 h-4" />
                <span class="text-sm font-medium">Claim Lock</span>
              </button>
              <button
                v-if="lock.isLockedByMe"
                @click="releaseLock"
                :disabled="lock.loading"
                class="flex items-center gap-2 px-3 py-1.5 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 disabled:opacity-50"
              >
                <span class="text-sm font-medium">Release</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Read-Only Banner -->
      <div v-if="isReadOnly" class="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div class="flex items-center gap-2 text-amber-800 dark:text-amber-300">
            <AlertTriangle class="w-5 h-5" />
            <span class="text-sm font-medium">
              Read-only mode: {{ lock.lockedByName || 'Another user' }} is currently working on this case
            </span>
          </div>
        </div>
      </div>

      <!-- Action Bar with View Tenant Data button -->
      <div class="bg-gray-100 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div class="flex items-center gap-3">
            <button
              @click="showTenantDataModal = true"
              class="flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              <FileText class="w-4 h-4 mr-2" />
              View Tenant Submitted Data
            </button>
          </div>
        </div>
      </div>

      <!-- Outstanding Referees Panel -->
      <div v-if="outstandingReferees.length > 0" class="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div class="flex items-start gap-3">
            <Clock class="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div class="flex-1">
              <h3 class="text-sm font-semibold text-amber-900 dark:text-amber-200">Outstanding External References</h3>
              <p class="text-xs text-amber-700 dark:text-amber-400 mb-2">
                These referees have been requested but haven't submitted yet. You can return the case to "Collecting Evidence" to wait for them.
              </p>
              <div class="flex flex-wrap gap-2">
                <div
                  v-for="referee in outstandingReferees"
                  :key="referee.recordId"
                  class="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-md px-3 py-1.5 border border-amber-200 dark:border-amber-800"
                >
                  <span class="text-sm text-gray-900 dark:text-white">
                    {{ referee.type === 'EMPLOYER_REF' ? 'Employer' : referee.type === 'LANDLORD_REF' ? 'Landlord' : referee.type === 'ACCOUNTANT_REF' ? 'Accountant' : referee.type === 'GUARANTOR_FORM' ? 'Guarantor' : referee.type }}
                    <span v-if="referee.contactName" class="text-gray-500 dark:text-slate-400">({{ referee.contactName }})</span>
                  </span>
                  <button
                    @click="returnToCollecting(referee.type)"
                    :disabled="returningToCollecting"
                    class="px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50 rounded hover:bg-amber-200 dark:hover:bg-amber-800/50 disabled:opacity-50"
                  >
                    {{ returningToCollecting ? 'Processing...' : 'Wait' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p class="mt-2 text-gray-600 dark:text-slate-400">Loading verification data...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div class="flex items-center gap-3">
          <AlertCircle class="w-6 h-6 text-red-600 dark:text-red-400" />
          <p class="text-red-800 dark:text-red-300">{{ error }}</p>
        </div>
        <button
          @click="loadData"
          class="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          Retry
        </button>
      </div>

      <!-- Main Content Grid -->
      <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left Column: Section Stack -->
        <div class="lg:col-span-2">
          <VerifySectionStack
            :sections="sections"
            :is-guarantor="isGuarantor"
            :reference-data="referenceData"
            :read-only="isReadOnly"
            :loading="!!sectionLoading"
            :action-reason-codes="actionReasonCodes"
            :saving-name-correction="savingNameCorrection"
            @section-pass="handleSectionPass"
            @section-pass-with-condition="handleSectionPassWithCondition"
            @section-action-required="handleSectionActionRequired"
            @section-fail="handleSectionFail"
            @section-reset="handleSectionReset"
            @data-refresh-needed="refreshEvidenceData"
            @update-name="handleUpdateName"
            @update-rtr-data="handleUpdateRtrData"
          />
        </div>

        <!-- Right Column: Final Preview Panel -->
        <div class="lg:col-span-1">
          <FinalPreviewPanel
            :sections="sections"
            :is-guarantor="isGuarantor"
            :person-name="personName"
            :can-finalize="canFinalize"
            :has-action-required="hasActionRequired"
            :has-fail="hasFail"
            :read-only="isReadOnly"
            :loading="finalizing"
            @finalize="handleFinalize"
          />
        </div>
      </div>
    </div>

    <!-- Tenant Submitted Data Modal -->
    <TenantSubmittedDataModal
      v-if="showTenantDataModal"
      :reference-id="referenceId"
      @close="showTenantDataModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ArrowLeft, LogOut, User, Lock, LockOpen, Loader2, AlertTriangle, AlertCircle, FileText, Clock } from 'lucide-vue-next'
import type {
  VerificationSection,
  ActionReasonCode,
  SectionDecision
} from '@/types/staff'
import { getSectionLabel } from '@/types/staff'
import VerifySectionStack from './VerifySectionStack.vue'
import FinalPreviewPanel from './FinalPreviewPanel.vue'
import TenantSubmittedDataModal from '../TenantSubmittedDataModal.vue'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// State
const loading = ref(true)
const error = ref<string | null>(null)
const sectionLoading = ref<string | null>(null)
const finalizing = ref(false)

// Reference Data
const referenceId = computed(() => route.params.id as string)
const workItemId = ref<string | null>(null)
const reference = ref<any>(null)
const sections = ref<VerificationSection[]>([])
const actionReasonCodes = ref<ActionReasonCode[]>([])
const selfieBlobUrl = ref<string | null>(null)
const idDocumentBlobUrl = ref<string | null>(null)
const signatureBlobUrl = ref<string | null>(null)
const rtrDocumentBlobUrl = ref<string | null>(null)
const rtrAlternativeDocumentBlobUrl = ref<string | null>(null)
const rtrBritishPassportBlobUrl = ref<string | null>(null)
const rtrBritishAltDocBlobUrl = ref<string | null>(null)
const creditsafeVerification = ref<any>(null)
const sanctionsScreening = ref<any>(null)
const referenceScore = ref<any>(null)
const evidenceData = ref<any>(null)
const savingNameCorrection = ref(false)

// Tenant data modal and outstanding referees
const showTenantDataModal = ref(false)
const outstandingReferees = ref<Array<{
  type: string
  recordId: string
  contactName: string | null
  contactEmail: string | null
}>>([])
const returningToCollecting = ref(false)

// Computed
const isGuarantor = computed(() => reference.value?.person_type === 'GUARANTOR')
const personName = computed(() => {
  if (!reference.value) return ''
  return `${reference.value.tenant_first_name || ''} ${reference.value.tenant_last_name || ''}`.trim()
})
const propertyAddress = computed(() => reference.value?.property_address || '')
// TAS Score - prefer reference_scores.score_total (0-1000 scale), convert to 0-100
// Fall back to reference.tas_score or creditsafe verification_score
const tasScore = computed(() => {
  if (referenceScore.value?.score_total !== undefined && referenceScore.value?.score_total !== null) {
    return Math.round(referenceScore.value.score_total / 10) // Convert 0-1000 to 0-100
  }
  if (reference.value?.tas_score !== undefined && reference.value?.tas_score !== null) {
    return reference.value.tas_score
  }
  if (creditsafeVerification.value?.verification_score !== undefined) {
    return creditsafeVerification.value.verification_score
  }
  return undefined
})

const totalSections = computed(() => sections.value.length)
const completedSections = computed(() =>
  sections.value.filter(s => s.decision !== 'NOT_REVIEWED').length
)

const canFinalize = computed(() =>
  sections.value.every(s => s.decision !== 'NOT_REVIEWED')
)
const hasActionRequired = computed(() =>
  sections.value.some(s => s.decision === 'ACTION_REQUIRED')
)
const hasFail = computed(() =>
  sections.value.some(s => s.decision === 'FAIL')
)

// Reference data for sections
const referenceData = computed(() => ({
  // Identity
  fullName: personName.value,
  firstName: reference.value?.tenant_first_name,
  lastName: reference.value?.tenant_last_name,
  middleName: reference.value?.middle_name,
  dateOfBirth: reference.value?.date_of_birth,
  nationality: reference.value?.nationality,
  email: reference.value?.tenant_email,
  contactNumber: reference.value?.contact_number,
  idDocumentUrl: idDocumentBlobUrl.value,
  selfieUrl: selfieBlobUrl.value,
  signatureUrl: signatureBlobUrl.value,
  // RTR
  rtrStatus: reference.value?.rtr_status,
  rtrExpiryDate: reference.value?.rtr_expiry_date,
  shareCode: reference.value?.share_code,
  rtrDocumentUrl: rtrDocumentBlobUrl.value,
  rtrAlternativeDocumentUrl: rtrAlternativeDocumentBlobUrl.value,
  rtrAlternativeDocumentType: reference.value?.rtr_alternative_document_type,
  isBritishCitizen: reference.value?.is_british_citizen,
  // British citizen RTR documents
  rtrBritishPassportUrl: rtrBritishPassportBlobUrl.value,
  rtrBritishAltDocUrl: rtrBritishAltDocBlobUrl.value,
  rtrBritishAltDocType: reference.value?.rtr_british_alt_doc_type,
  hasBritishNoPassport: reference.value?.rtr_british_no_passport,
  // Staff RTR verification fields
  rtrStaffExpiryDate: reference.value?.rtr_staff_expiry_date,
  rtrStaffShareCodeConfirmed: reference.value?.rtr_staff_share_code_confirmed,
  rtrIndefiniteLeave: reference.value?.rtr_indefinite_leave,
  rtrVerificationMethod: reference.value?.rtr_verification_method,
  rtrVerificationNotes: reference.value?.rtr_verification_notes,
  // Income
  monthlyRent: evidenceData.value?.monthlyRent || reference.value?.monthly_rent,
  totalIncome: evidenceData.value?.verifiedIncome?.total || evidenceData.value?.claimedIncome?.total || reference.value?.total_income,
  incomeRatio: reference.value?.income_ratio,
  requiredRatio: reference.value?.required_ratio || 2.5,
  employmentType: evidenceData.value?.employment?.type || reference.value?.employment_type,
  employerName: evidenceData.value?.employment?.employerName || reference.value?.employer_name,
  jobTitle: evidenceData.value?.employment?.jobTitle || reference.value?.job_title,
  employmentStartDate: evidenceData.value?.employment?.startDate || reference.value?.employment_start_date,
  employmentEndDate: reference.value?.employment_end_date,
  employmentContractType: reference.value?.employment_contract_type,
  salaryFrequency: reference.value?.employment_salary_frequency,
  // Self-employed details
  selfEmployedStartDate: reference.value?.self_employed_start_date,
  selfEmployedNatureOfBusiness: reference.value?.self_employed_nature_of_business,
  // Additional income
  additionalIncomeFrequency: reference.value?.additional_income_frequency,
  // Benefits
  benefitsMonthlyAmount: reference.value?.benefits_monthly_amount,
  incomeSources: reference.value?.income_sources || [],
  employerReference: reference.value?.employer_reference,
  accountantReference: reference.value?.accountant_reference,
  // Evidence data for Income section modal
  claimedIncome: evidenceData.value?.claimedIncome,
  verifiedIncome: evidenceData.value?.verifiedIncome,
  incomeEvidence: evidenceData.value?.incomeEvidence || [],
  evidenceEmployerRef: evidenceData.value?.employerReference,
  evidenceAccountantRef: evidenceData.value?.accountantReference,
  incomeConfirmedAt: evidenceData.value?.verifiedIncome?.confirmedAt,
  incomeConfirmedBy: evidenceData.value?.verifiedIncome?.confirmedBy,
  isStudent: reference.value?.income_student || false,
  // Guarantor financial data (for guarantors)
  guarantorFinancialData: evidenceData.value?.guarantorFinancialData,
  // Residential
  previousAddress: evidenceData.value?.residential?.previousAddress || reference.value?.previous_address,
  previousAddressType: evidenceData.value?.residential?.addressType || reference.value?.previous_address_type,
  tenancyDuration: evidenceData.value?.residential?.tenancyDuration || reference.value?.tenancy_duration,
  landlordReference: reference.value?.landlord_reference,
  // Previous tenancy dates
  previousTenancyStartDate: reference.value?.previous_tenancy_start_date,
  previousTenancyEndDate: reference.value?.previous_tenancy_end_date,
  // Evidence data for Residential section modal
  evidenceLandlordRef: evidenceData.value?.landlordReference,
  evidenceAgentRef: evidenceData.value?.agentReference,
  confirmedResidentialStatus: evidenceData.value?.residential?.confirmedStatus,
  residentialConfirmedAt: evidenceData.value?.residential?.confirmedAt,
  residentialConfirmedBy: evidenceData.value?.residential?.confirmedBy,
  // Current address and address history
  currentAddress: reference.value?.current_address_line1 ? {
    line1: reference.value.current_address_line1,
    line2: reference.value.current_address_line2,
    city: reference.value.current_address_city,
    postcode: reference.value.current_address_postcode,
    country: reference.value.current_address_country,
    timeYears: reference.value.time_at_address_years,
    timeMonths: reference.value.time_at_address_months
  } : undefined,
  previousAddresses: evidenceData.value?.previousAddresses,
  // Credit - adverse credit disclosure
  adverseCreditDetails: reference.value?.adverse_credit_details,
  // Credit (from reference_scores or Creditsafe verification)
  tasScore: tasScore.value, // Use the computed tasScore which handles all fallbacks
  creditsafeVerification: creditsafeVerification.value,
  // Build credit summary from fraud_indicators if available
  creditSummary: (() => {
    const cv = creditsafeVerification.value
    if (!cv) return undefined
    const fi = typeof cv.fraud_indicators === 'string'
      ? JSON.parse(cv.fraud_indicators)
      : cv.fraud_indicators
    if (!fi) return undefined
    return {
      ccjs: fi.ccjCount || 0,
      insolvencies: fi.insolvencyCount || 0,
      bankruptcies: fi.insolvencyCount || 0, // Same as insolvencies
      electoralRollMatch: fi.electoralRollMatch,
      verifyMatch: !fi.notFound
    }
  })(),
  // Build credit flags from the data
  creditFlags: (() => {
    const cv = creditsafeVerification.value
    if (!cv) return []
    const fi = typeof cv.fraud_indicators === 'string'
      ? JSON.parse(cv.fraud_indicators)
      : cv.fraud_indicators
    const flags = []
    if (fi?.ccjMatch) {
      flags.push({ type: 'CCJ Found', severity: 'high', description: `${fi.ccjCount || 1} County Court Judgment(s)` })
    }
    if (fi?.insolvencyMatch) {
      flags.push({ type: 'Insolvency Found', severity: 'high', description: `${fi.insolvencyCount || 1} Insolvency record(s)` })
    }
    if (fi?.deceasedMatch) {
      flags.push({ type: 'Deceased Match', severity: 'high', description: 'Person appears on deceased register' })
    }
    if (fi?.notFound) {
      flags.push({ type: 'Not Found', severity: 'medium', description: 'No credit file found for this person' })
    }
    if (!fi?.electoralRollMatch && fi?.electoralRollMatch !== undefined) {
      flags.push({ type: 'Electoral Roll', severity: 'low', description: 'Not found on electoral roll at address' })
    }
    return flags
  })(),
  addressMatchStatus: (() => {
    const cv = creditsafeVerification.value
    if (!cv) return undefined
    const fi = typeof cv.fraud_indicators === 'string'
      ? JSON.parse(cv.fraud_indicators)
      : cv.fraud_indicators
    return fi?.electoralRollMatch ? 'matched' : 'mismatched'
  })(),
  creditReport: creditsafeVerification.value?.response_data,
  referenceScore: referenceScore.value,
  // AML (from Sanctions screening)
  sanctionsScreening: sanctionsScreening.value,
  amlStatus: sanctionsScreening.value?.screening_status || sanctionsScreening.value?.risk_level,
  amlLastChecked: sanctionsScreening.value?.created_at,
  pepResult: sanctionsScreening.value?.sanctions_matches?.length > 0 ? 'MATCH' : 'CLEAR',
  pepMatches: sanctionsScreening.value?.sanctions_matches || [],
  sanctionsResult: sanctionsScreening.value?.sanctions_matches?.length > 0 ? 'MATCH' : 'CLEAR',
  sanctionsMatches: sanctionsScreening.value?.sanctions_matches || [],
  adverseMediaResult: sanctionsScreening.value?.donation_matches?.length > 0 ? 'POTENTIAL_MATCH' : 'CLEAR',
  adverseMediaMatches: sanctionsScreening.value?.donation_matches || [],
  idVerificationResult: creditsafeVerification.value?.id_verification_result,
  idVerificationDetails: creditsafeVerification.value?.id_verification_details,
  potentialMatches: [
    ...(sanctionsScreening.value?.sanctions_matches || []),
    ...(sanctionsScreening.value?.donation_matches || [])
  ],
  riskLevel: sanctionsScreening.value?.risk_level,
  riskReason: sanctionsScreening.value?.summary_message
}))

// Auth
const token = computed(() => authStore.session?.access_token || '')

// Soft Lock
const lock = ref({
  isLocked: false,
  isLockedByMe: false,
  lockedByName: null as string | null,
  loading: false,
  error: null as string | null
})

const isReadOnly = computed(() => lock.value.isLocked && !lock.value.isLockedByMe)

// Lock functions
async function checkLockStatus() {
  if (!workItemId.value) return

  try {
    const response = await fetch(`${API_BASE}/api/work-queue/${workItemId.value}/lock/status`, {
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const data = await response.json()
      lock.value.isLocked = data.isLocked
      lock.value.isLockedByMe = data.isLockedByMe
      lock.value.lockedByName = data.lock?.lockedByName || null
    }
  } catch (err) {
    console.error('Failed to check lock status:', err)
  }
}

async function claimLock() {
  if (!workItemId.value) return

  lock.value.loading = true
  try {
    const response = await fetch(`${API_BASE}/api/work-queue/${workItemId.value}/lock/claim`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()

    if (response.ok) {
      lock.value.isLocked = true
      lock.value.isLockedByMe = true
      lock.value.lockedByName = null
      startHeartbeat()
    } else if (response.status === 409) {
      lock.value.isLocked = true
      lock.value.isLockedByMe = false
      lock.value.lockedByName = data.existingLock?.lockedByName || 'Another user'
      lock.value.error = data.error
    }
  } catch (err: any) {
    console.error('Failed to claim lock:', err)
    lock.value.error = err.message
  } finally {
    lock.value.loading = false
  }
}

async function releaseLock() {
  if (!workItemId.value) return

  lock.value.loading = true
  stopHeartbeat()

  try {
    const response = await fetch(`${API_BASE}/api/work-queue/${workItemId.value}/lock/release`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      lock.value.isLocked = false
      lock.value.isLockedByMe = false
      lock.value.lockedByName = null
    }
  } catch (err: any) {
    console.error('Failed to release lock:', err)
    lock.value.error = err.message
  } finally {
    lock.value.loading = false
  }
}

let heartbeatInterval: ReturnType<typeof setInterval> | null = null

function startHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval)

  heartbeatInterval = setInterval(async () => {
    if (!workItemId.value || !lock.value.isLockedByMe) return

    try {
      await fetch(`${API_BASE}/api/work-queue/${workItemId.value}/lock/heartbeat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.value}`,
          'Content-Type': 'application/json'
        }
      })
    } catch (err) {
      console.error('Failed to send heartbeat:', err)
    }
  }, 5 * 60 * 1000) // 5 minutes
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
    heartbeatInterval = null
  }
}

// Data Loading
async function loadData() {
  loading.value = true
  error.value = null

  try {
    // Load reference data
    const refResponse = await fetch(`${API_BASE}/api/verify/person/${referenceId.value}`, {
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json'
      }
    })

    if (!refResponse.ok) {
      throw new Error('Failed to load reference data')
    }

    const refData = await refResponse.json()
    reference.value = refData.reference
    sections.value = refData.sections || []
    workItemId.value = refData.workItemId
    creditsafeVerification.value = refData.creditsafeVerification
    sanctionsScreening.value = refData.sanctionsScreening
    referenceScore.value = refData.score

    // Load action reason codes
    const codesResponse = await fetch(`${API_BASE}/api/verify/action-codes`, {
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json'
      }
    })

    if (codesResponse.ok) {
      const codesData = await codesResponse.json()
      actionReasonCodes.value = codesData.codes || []
    }

    // Check lock status
    if (workItemId.value) {
      await checkLockStatus()
    }

    // Fetch outstanding referees for "Wait for Reference" feature
    await fetchOutstandingReferees()

    // Load evidence data for Income and Residential sections
    try {
      const evidenceResponse = await fetch(`${API_BASE}/api/verify/evidence/${referenceId.value}`, {
        headers: {
          'Authorization': `Bearer ${token.value}`,
          'Content-Type': 'application/json'
        }
      })
      if (evidenceResponse.ok) {
        evidenceData.value = await evidenceResponse.json()
      }
    } catch (err) {
      console.error('Failed to load evidence data:', err)
    }

    // Load ID document and selfie images
    if (reference.value?.id_document_path) {
      idDocumentBlobUrl.value = await loadImageAsBlob(reference.value.id_document_path)
    }
    if (reference.value?.selfie_path) {
      selfieBlobUrl.value = await loadImageAsBlob(reference.value.selfie_path)
    }
    if (reference.value?.signature_path) {
      signatureBlobUrl.value = await loadImageAsBlob(reference.value.signature_path)
    }
    if (reference.value?.rtr_document_path) {
      rtrDocumentBlobUrl.value = await loadImageAsBlob(reference.value.rtr_document_path)
    }
    if (reference.value?.rtr_alternative_document_path) {
      rtrAlternativeDocumentBlobUrl.value = await loadImageAsBlob(reference.value.rtr_alternative_document_path)
    }
    if (reference.value?.rtr_british_passport_path) {
      rtrBritishPassportBlobUrl.value = await loadImageAsBlob(reference.value.rtr_british_passport_path)
    }
    if (reference.value?.rtr_british_alt_doc_path) {
      rtrBritishAltDocBlobUrl.value = await loadImageAsBlob(reference.value.rtr_british_alt_doc_path)
    }
  } catch (err: any) {
    console.error('Failed to load data:', err)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

// Fetch outstanding referees (for "Wait for Reference" feature)
async function fetchOutstandingReferees() {
  try {
    const response = await fetch(`${API_BASE}/api/references/${referenceId.value}/outstanding-referees`, {
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json'
      }
    })
    if (response.ok) {
      const data = await response.json()
      outstandingReferees.value = data.outstandingReferees || []
    }
  } catch (err) {
    console.error('Failed to fetch outstanding referees:', err)
  }
}

// Return to collecting evidence (wait for a specific reference)
async function returnToCollecting(waitingFor: string) {
  if (!workItemId.value) {
    alert('No work item found for this reference')
    return
  }

  returningToCollecting.value = true
  try {
    const response = await fetch(`${API_BASE}/api/references/${referenceId.value}/return-to-collecting`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        workItemId: workItemId.value,
        waitingFor
      })
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to return to collecting evidence')
    }

    // Release lock and navigate back
    await releaseLock()
    router.push('/staff/work-queue')
  } catch (err: any) {
    console.error('Failed to return to collecting:', err)
    alert(err.message || 'Failed to return to collecting evidence')
  } finally {
    returningToCollecting.value = false
  }
}

// Refresh evidence data after income/residential confirmation
async function refreshEvidenceData() {
  try {
    const evidenceResponse = await fetch(`${API_BASE}/api/verify/evidence/${referenceId.value}`, {
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json'
      }
    })
    if (evidenceResponse.ok) {
      evidenceData.value = await evidenceResponse.json()
    }
  } catch (err) {
    console.error('Failed to refresh evidence data:', err)
  }
}

// Update RTR data (staff confirmation of share code, expiry date, indefinite leave, verification method/notes)
async function handleUpdateRtrData(data: {
  shareCodeConfirmed?: string;
  expiryDate?: string;
  indefiniteLeave?: boolean;
  verificationMethod?: string;
  verificationNotes?: string;
}) {
  try {
    const response = await fetch(`${API_BASE}/api/verify/person/${referenceId.value}/rtr`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Failed to update RTR data:', errorData)
      return
    }

    // Update local reference data
    if (reference.value) {
      if (data.shareCodeConfirmed !== undefined) {
        reference.value.rtr_staff_share_code_confirmed = data.shareCodeConfirmed
      }
      if (data.expiryDate !== undefined) {
        reference.value.rtr_staff_expiry_date = data.expiryDate
      }
      if (data.indefiniteLeave !== undefined) {
        reference.value.rtr_indefinite_leave = data.indefiniteLeave
      }
      if (data.verificationMethod !== undefined) {
        reference.value.rtr_verification_method = data.verificationMethod
      }
      if (data.verificationNotes !== undefined) {
        reference.value.rtr_verification_notes = data.verificationNotes
      }
    }
  } catch (err) {
    console.error('Failed to update RTR data:', err)
  }
}

async function loadImageAsBlob(filePath: string): Promise<string | null> {
  if (!token.value || !filePath) {
    console.warn('Cannot load image: missing token or filePath', { hasToken: !!token.value, filePath })
    return null
  }

  try {
    // Parse file path: referenceId/folder/filename
    const parts = filePath.split('/')
    if (parts.length !== 3) {
      console.error('Invalid file path format. Expected: referenceId/folder/filename, got:', filePath)
      return null
    }

    const [refId, folder, filename] = parts
    if (!refId || !folder || !filename) {
      console.error('Missing parts in file path')
      return null
    }

    const downloadUrl = `${API_BASE}/api/staff/download/${refId}/${folder}/${encodeURIComponent(filename)}`

    const response = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${token.value}`
      }
    })

    if (!response.ok) {
      console.error('Failed to load image:', response.status)
      return null
    }

    const blob = await response.blob()
    return URL.createObjectURL(blob)
  } catch (err) {
    console.error('Failed to load image:', err)
    return null
  }
}

// Section Actions
async function handleSectionPass(sectionId: string) {
  await updateSectionDecision(sectionId, 'PASS')
}

async function handleSectionPassWithCondition(sectionId: string, condition: string) {
  await updateSectionDecision(sectionId, 'PASS_WITH_CONDITION', { conditionText: condition })
}

async function handleSectionActionRequired(sectionId: string, params: { reasonCode: string; agentNote: string; internalNote: string }) {
  await updateSectionDecision(sectionId, 'ACTION_REQUIRED', {
    actionReasonCode: params.reasonCode,
    actionAgentNote: params.agentNote,
    actionInternalNote: params.internalNote
  })
}

async function handleSectionFail(sectionId: string, reason: string) {
  await updateSectionDecision(sectionId, 'FAIL', { failReason: reason })
}

async function handleSectionReset(sectionId: string) {
  await updateSectionDecision(sectionId, 'NOT_REVIEWED')
}

// Handle name correction from Identity section
async function handleUpdateName(firstName: string, lastName: string) {
  if (!reference.value?.id) return

  savingNameCorrection.value = true
  try {
    const response = await fetch(`${API_BASE}/api/verify/person/${reference.value.id}/tenant-name`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName
      })
    })

    if (!response.ok) {
      throw new Error('Failed to update tenant name')
    }

    // Update local reference data
    reference.value.tenant_first_name = firstName
    reference.value.tenant_last_name = lastName
  } catch (err: any) {
    console.error('Failed to update tenant name:', err)
    alert('Failed to update tenant name. Please try again.')
  } finally {
    savingNameCorrection.value = false
  }
}

async function updateSectionDecision(sectionId: string, decision: SectionDecision, extra: Record<string, any> = {}) {
  sectionLoading.value = sectionId

  try {
    const response = await fetch(`${API_BASE}/api/verify/sections/${sectionId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ decision, ...extra })
    })

    if (!response.ok) {
      throw new Error('Failed to update section')
    }

    const data = await response.json()

    // Update local section
    const index = sections.value.findIndex(s => s.id === sectionId)
    if (index !== -1) {
      sections.value[index] = data.section
    }
  } catch (err: any) {
    console.error('Failed to update section:', err)
    // Could show toast notification here
  } finally {
    sectionLoading.value = null
  }
}

// Finalize
async function handleFinalize(finalDecision: string, notes?: string) {
  finalizing.value = true

  try {
    const response = await fetch(`${API_BASE}/api/verify/finalize/${referenceId.value}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ decision: finalDecision, notes })
    })

    if (!response.ok) {
      throw new Error('Failed to finalize verification')
    }

    // Release lock and navigate back
    await releaseLock()
    router.push('/staff/work-queue')
  } catch (err: any) {
    console.error('Failed to finalize:', err)
    error.value = err.message
  } finally {
    finalizing.value = false
  }
}

// Auth
async function handleSignOut() {
  if (lock.value.isLockedByMe) {
    await releaseLock()
  }
  await authStore.signOut()
  router.push('/staff/login')
}

// Lifecycle
onMounted(() => {
  loadData()
})

// Cleanup on unmount
import { onUnmounted } from 'vue'

onUnmounted(() => {
  stopHeartbeat()
  if (selfieBlobUrl.value) {
    URL.revokeObjectURL(selfieBlobUrl.value)
  }
  if (idDocumentBlobUrl.value) {
    URL.revokeObjectURL(idDocumentBlobUrl.value)
  }
  if (signatureBlobUrl.value) {
    URL.revokeObjectURL(signatureBlobUrl.value)
  }
  if (rtrDocumentBlobUrl.value) {
    URL.revokeObjectURL(rtrDocumentBlobUrl.value)
  }
  if (rtrAlternativeDocumentBlobUrl.value) {
    URL.revokeObjectURL(rtrAlternativeDocumentBlobUrl.value)
  }
})

// Watch for route changes
watch(() => route.params.id, () => {
  if (route.params.id) {
    loadData()
  }
})
</script>

<style scoped>
/* Additional styles if needed */
</style>

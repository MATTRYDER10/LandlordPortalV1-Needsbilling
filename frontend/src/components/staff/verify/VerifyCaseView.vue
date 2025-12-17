<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Sticky Header -->
    <div class="sticky top-0 z-50 bg-white shadow-md">
      <!-- Top Bar with Logo and Navigation -->
      <div class="border-b">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between items-center py-4">
            <div class="flex items-center">
              <img src="/PropertyGooseIcon.webp" alt="PropertyGoose" class="w-10 h-10 mr-3" />
              <h1 class="text-2xl font-bold">
                <span class="text-gray-900">Property</span><span class="text-primary">Goose</span>
                <span class="ml-3 text-sm font-semibold px-3 py-1 bg-primary/10 text-primary rounded-full">Verify Case</span>
              </h1>
            </div>
            <div class="flex items-center gap-4">
              <router-link
                to="/staff/work-queue"
                class="flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
              >
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Portal
              </router-link>
              <button
                @click="handleSignOut"
                class="flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
              >
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Person Context Bar -->
      <div class="bg-gray-50 border-b">
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
                <div v-else class="w-14 h-14 rounded-full bg-gray-200 border-2 border-white shadow flex items-center justify-center">
                  <svg class="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <!-- Role Badge -->
                <span :class="[
                  'absolute -bottom-1 -right-1 px-2 py-0.5 text-xs font-semibold rounded-full',
                  isGuarantor ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                ]">
                  {{ isGuarantor ? 'G' : 'T' }}
                </span>
              </div>
              <!-- Name and Details -->
              <div>
                <h2 class="text-lg font-semibold text-gray-900">{{ personName }}</h2>
                <p class="text-sm text-gray-600">{{ propertyAddress }}</p>
              </div>
            </div>

            <!-- TAS Score -->
            <div v-if="tasScore !== undefined" class="flex items-center gap-2">
              <span class="text-sm text-gray-600">TAS Score:</span>
              <span :class="[
                'px-3 py-1 text-lg font-bold rounded-lg',
                tasScore >= 70 ? 'bg-green-100 text-green-800' :
                tasScore >= 50 ? 'bg-yellow-100 text-yellow-800' :
                tasScore >= 30 ? 'bg-orange-100 text-orange-800' :
                'bg-red-100 text-red-800'
              ]">
                {{ tasScore }}
              </span>
            </div>

            <!-- Section Progress -->
            <div class="flex items-center gap-3">
              <span class="text-sm text-gray-600">Progress:</span>
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
                    'bg-gray-300'
                  ]"
                  :title="`${getSectionLabel(section.sectionType)}: ${section.decision}`"
                ></span>
              </div>
              <span class="text-sm font-medium text-gray-700">
                {{ completedSections }}/{{ totalSections }}
              </span>
            </div>

            <!-- Lock Status -->
            <div class="flex items-center gap-2">
              <div v-if="lock.isLockedByMe" class="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-800 rounded-lg">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
                </svg>
                <span class="text-sm font-medium">Locked by you</span>
              </div>
              <div v-else-if="lock.isLocked" class="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-800 rounded-lg">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
                </svg>
                <span class="text-sm font-medium">Locked by {{ lock.lockedByName }}</span>
              </div>
              <button
                v-if="!lock.isLocked && !lock.isLockedByMe"
                @click="claimLock"
                :disabled="lock.loading"
                class="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
              >
                <svg v-if="lock.loading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <svg v-else class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
                </svg>
                <span class="text-sm font-medium">Claim Lock</span>
              </button>
              <button
                v-if="lock.isLockedByMe"
                @click="releaseLock"
                :disabled="lock.loading"
                class="flex items-center gap-2 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                <span class="text-sm font-medium">Release</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Read-Only Banner -->
      <div v-if="isReadOnly" class="bg-amber-50 border-b border-amber-200">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div class="flex items-center gap-2 text-amber-800">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            <span class="text-sm font-medium">
              Read-only mode: {{ lock.lockedByName || 'Another user' }} is currently working on this case
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p class="mt-2 text-gray-600">Loading verification data...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-6">
        <div class="flex items-center gap-3">
          <svg class="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <p class="text-red-800">{{ error }}</p>
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
            @section-pass="handleSectionPass"
            @section-pass-with-condition="handleSectionPassWithCondition"
            @section-action-required="handleSectionActionRequired"
            @section-fail="handleSectionFail"
            @section-reset="handleSectionReset"
            @data-refresh-needed="refreshEvidenceData"
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type {
  VerificationSection,
  ActionReasonCode,
  SectionDecision
} from '@/types/staff'
import { getSectionLabel } from '@/types/staff'
import VerifySectionStack from './VerifySectionStack.vue'
import FinalPreviewPanel from './FinalPreviewPanel.vue'

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
const creditsafeVerification = ref<any>(null)
const sanctionsScreening = ref<any>(null)
const referenceScore = ref<any>(null)
const evidenceData = ref<any>(null)

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
  } catch (err: any) {
    console.error('Failed to load data:', err)
    error.value = err.message
  } finally {
    loading.value = false
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

<template>
  <div class="bg-white rounded-lg shadow p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-900">Creditsafe Identity Verification</h3>
      <button
        v-if="showRetryButton"
        @click="$emit('retry')"
        :disabled="retrying"
        class="px-3 py-1 text-sm font-medium text-primary border border-primary rounded hover:bg-primary hover:text-white transition-colors disabled:opacity-50"
      >
        {{ retrying ? 'Retrying...' : 'Retry Verification' }}
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-8">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      <p class="mt-2 text-sm text-gray-600">Loading verification results...</p>
    </div>

    <!-- No Verification Found -->
    <div v-else-if="!verification" class="text-center py-8">
      <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-3">
        <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <p class="text-sm text-gray-600">No verification data available</p>
      <p class="text-xs text-gray-500 mt-1">Verification will run automatically when the tenant submits their information</p>
    </div>

    <!-- Verification Results -->
    <div v-else class="space-y-6">
      <!-- Overall Status -->
      <div class="flex items-center justify-between p-4 rounded-lg" :class="statusColorClass">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <component :is="statusIcon" class="w-8 h-8" :class="statusIconColor" />
          </div>
          <div class="ml-4">
            <h4 class="text-lg font-semibold" :class="statusTextColor">{{ statusLabel }}</h4>
            <p class="text-sm" :class="statusTextColor">Overall Score: {{ verification.verification_score || 0 }}/100</p>
          </div>
        </div>
        <div v-if="verification.risk_level" class="text-right">
          <p class="text-xs font-medium uppercase tracking-wide" :class="statusTextColor">Risk Level</p>
          <p class="text-sm font-bold" :class="riskLevelColor">{{ verification.risk_level.toUpperCase() }}</p>
        </div>
      </div>

      <!-- Match Scores -->
      <div v-if="hasMatchScores">
        <h4 class="text-sm font-semibold text-gray-700 mb-3">Identity Match Scores</h4>
        <div class="grid grid-cols-3 gap-4">
          <div v-if="verification.name_match_score !== null" class="text-center p-3 bg-gray-50 rounded-lg">
            <p class="text-xs text-gray-600 mb-1">Name Match</p>
            <p class="text-2xl font-bold" :class="getScoreColor(verification.name_match_score)">{{ verification.name_match_score }}%</p>
          </div>
          <div v-if="verification.address_match_score !== null" class="text-center p-3 bg-gray-50 rounded-lg">
            <p class="text-xs text-gray-600 mb-1">Address Match</p>
            <p class="text-2xl font-bold" :class="getScoreColor(verification.address_match_score)">{{ verification.address_match_score }}%</p>
          </div>
          <div v-if="verification.dob_match_score !== null" class="text-center p-3 bg-gray-50 rounded-lg">
            <p class="text-xs text-gray-600 mb-1">DOB Match</p>
            <p class="text-2xl font-bold" :class="getScoreColor(verification.dob_match_score)">{{ verification.dob_match_score }}%</p>
          </div>
        </div>
      </div>

      <!-- Compliance Checks -->
      <div v-if="hasComplianceChecks">
        <h4 class="text-sm font-semibold text-gray-700 mb-3">Compliance Screening</h4>
        <div class="space-y-2">
          <div v-if="verification.pep_check_result !== null" class="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span class="text-sm text-gray-700">Politically Exposed Person (PEP)</span>
            <span :class="verification.pep_check_result ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'">
              {{ verification.pep_check_result ? '⚠ Flagged' : '✓ Clear' }}
            </span>
          </div>
          <div v-if="verification.sanctions_check_result !== null" class="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span class="text-sm text-gray-700">Sanctions Screening</span>
            <span :class="verification.sanctions_check_result ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'">
              {{ verification.sanctions_check_result ? '⚠ Flagged' : '✓ Clear' }}
            </span>
          </div>
          <div v-if="verification.adverse_media_result !== null" class="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span class="text-sm text-gray-700">Adverse Media</span>
            <span :class="verification.adverse_media_result ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'">
              {{ verification.adverse_media_result ? '⚠ Found' : '✓ Clear' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Document Verification -->
      <div v-if="verification.document_verified !== null">
        <h4 class="text-sm font-semibold text-gray-700 mb-3">Document Verification</h4>
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded">
          <span class="text-sm text-gray-700">Document Authenticity</span>
          <div class="text-right">
            <span :class="verification.document_verified ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'">
              {{ verification.document_verified ? '✓ Verified' : '✗ Not Verified' }}
            </span>
            <p v-if="verification.document_authenticity_score" class="text-xs text-gray-600">
              Score: {{ verification.document_authenticity_score }}/100
            </p>
          </div>
        </div>
      </div>

      <!-- Fraud Indicators -->
      <div v-if="fraudIndicators && fraudIndicators.length > 0" class="p-4 bg-red-50 border border-red-200 rounded-lg">
        <h4 class="text-sm font-semibold text-red-900 mb-2">⚠ Fraud Indicators</h4>
        <ul class="list-disc list-inside space-y-1">
          <li v-for="(indicator, index) in fraudIndicators" :key="index" class="text-sm text-red-800">
            {{ indicator }}
          </li>
        </ul>
      </div>

      <!-- County Court Judgments (CCJs) -->
      <div v-if="countyCourtJudgments.length > 0" class="p-4 bg-orange-50 border border-orange-200 rounded-lg">
        <h4 class="text-sm font-semibold text-orange-900 mb-3">County Court Judgments (CCJs)</h4>
        <div class="space-y-3">
          <div v-for="(ccj, index) in countyCourtJudgments" :key="index" class="p-3 bg-white rounded border border-orange-100">
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div v-if="ccj.amount !== undefined">
                <span class="font-medium text-gray-700">Amount:</span>
                <span class="ml-1 text-gray-900">{{ formatCurrency(ccj.amount) }}</span>
              </div>
              <div v-if="ccj.date">
                <span class="font-medium text-gray-700">Date Issued:</span>
                <span class="ml-1 text-gray-900">{{ formatDate(ccj.date) }}</span>
              </div>
              <div v-if="ccj.paidDate">
                <span class="font-medium text-gray-700">Paid Date:</span>
                <span class="ml-1 text-green-700 font-medium">{{ formatDate(ccj.paidDate) }}</span>
              </div>
              <div v-else-if="ccj.date">
                <span class="font-medium text-gray-700">Status:</span>
                <span class="ml-1 text-red-700 font-medium">Unpaid</span>
              </div>
              <div v-if="ccj.status" class="col-span-2">
                <span class="font-medium text-gray-700">Status:</span>
                <span class="ml-1 text-gray-900">{{ ccj.status }}</span>
              </div>
              <div v-if="ccj.caseNumber" class="col-span-2">
                <span class="font-medium text-gray-700">Case Number:</span>
                <span class="ml-1 text-gray-900">{{ ccj.caseNumber }}</span>
              </div>
              <div v-if="ccj.courtName" class="col-span-2">
                <span class="font-medium text-gray-700">Court:</span>
                <span class="ml-1 text-gray-900">{{ ccj.courtName }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Electoral Roll History -->
      <div v-if="electoralRolls.length > 0" class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 class="text-sm font-semibold text-blue-900 mb-3">Electoral Roll History</h4>
        <div class="space-y-3">
          <div v-for="(roll, index) in electoralRolls" :key="index" class="p-3 bg-white rounded border border-blue-100">
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div v-if="roll.canvasYear">
                <span class="font-medium text-gray-700">Year:</span>
                <span class="ml-1 text-gray-900">{{ roll.canvasYear }}</span>
              </div>
              <div v-if="roll.firstName || roll.lastName" class="col-span-2">
                <span class="font-medium text-gray-700">Name:</span>
                <span class="ml-1 text-gray-900">{{ [roll.firstName, roll.middleName, roll.lastName].filter(Boolean).join(' ') }}</span>
              </div>
              <div v-if="roll.fullAddress?.simpleValue" class="col-span-2">
                <span class="font-medium text-gray-700">Full Address:</span>
                <span class="ml-1 text-gray-900">{{ roll.fullAddress.simpleValue }}</span>
              </div>
              <div v-if="roll.partialAddress?.simpleValue">
                <span class="font-medium text-gray-700">Partial Address:</span>
                <span class="ml-1 text-gray-900">{{ roll.partialAddress.simpleValue }}</span>
              </div>
              <div v-if="roll.fullAddress?.postCode">
                <span class="font-medium text-gray-700">Postcode:</span>
                <span class="ml-1 text-gray-900">{{ roll.fullAddress.postCode }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Insolvency Records -->
      <div v-if="insolvencies.length > 0" class="p-4 bg-red-50 border border-red-200 rounded-lg">
        <h4 class="text-sm font-semibold text-red-900 mb-3">Insolvency Records</h4>
        <div class="space-y-3">
          <div v-for="(insolvency, index) in insolvencies" :key="index" class="p-3 bg-white rounded border border-red-100">
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div v-if="insolvency.caseDetails?.caseType">
                <span class="font-medium text-gray-700">Type:</span>
                <span class="ml-1 text-gray-900">{{ insolvency.caseDetails.caseType }}</span>
              </div>
              <div v-if="insolvency.caseDetails?.caseStatus">
                <span class="font-medium text-gray-700">Status:</span>
                <span class="ml-1 text-gray-900">{{ insolvency.caseDetails.caseStatus }}</span>
              </div>
              <div v-if="insolvency.caseDetails?.startDate">
                <span class="font-medium text-gray-700">Start Date:</span>
                <span class="ml-1 text-gray-900">{{ formatDate(insolvency.caseDetails.startDate) }}</span>
              </div>
              <div v-if="insolvency.caseDetails?.dischargeDate">
                <span class="font-medium text-gray-700">Discharge Date:</span>
                <span class="ml-1 text-gray-900">{{ formatDate(insolvency.caseDetails.dischargeDate) }}</span>
              </div>
              <div v-if="insolvency.caseDetails?.caseNumber" class="col-span-2">
                <span class="font-medium text-gray-700">Case Number:</span>
                <span class="ml-1 text-gray-900">{{ insolvency.caseDetails.caseNumber }}</span>
              </div>
              <div v-if="insolvency.caseDetails?.court" class="col-span-2">
                <span class="font-medium text-gray-700">Court:</span>
                <span class="ml-1 text-gray-900">{{ insolvency.caseDetails.court }}</span>
              </div>
              <div v-if="insolvency.individualDetails?.occupation">
                <span class="font-medium text-gray-700">Occupation:</span>
                <span class="ml-1 text-gray-900">{{ insolvency.individualDetails.occupation }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="verification.error_message" class="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h4 class="text-sm font-semibold text-yellow-900 mb-1">Verification Error</h4>
        <p class="text-sm text-yellow-800">{{ verification.error_message }}</p>
      </div>

      <!-- Metadata -->
      <div class="border-t pt-4">
        <div class="grid grid-cols-2 gap-4 text-xs text-gray-600">
          <div v-if="verification.verified_at">
            <span class="font-medium">Verified:</span>
            {{ new Date(verification.verified_at).toLocaleString('en-GB') }}
          </div>
          <div v-if="verification.creditsafe_transaction_id">
            <span class="font-medium">Transaction ID:</span>
            {{ verification.creditsafe_transaction_id }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h } from 'vue'
import { formatDate as formatUkDate } from '../utils/date'

// Icons as render functions
const CheckCircleIcon = () => h('svg', { fill: 'currentColor', viewBox: '0 0 20 20' }, [
  h('path', { 'fill-rule': 'evenodd', d: 'M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z', 'clip-rule': 'evenodd' })
])

const XCircleIcon = () => h('svg', { fill: 'currentColor', viewBox: '0 0 20 20' }, [
  h('path', { 'fill-rule': 'evenodd', d: 'M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z', 'clip-rule': 'evenodd' })
])

const ExclamationCircleIcon = () => h('svg', { fill: 'currentColor', viewBox: '0 0 20 20' }, [
  h('path', { 'fill-rule': 'evenodd', d: 'M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z', 'clip-rule': 'evenodd' })
])

const ClockIcon = () => h('svg', { fill: 'currentColor', viewBox: '0 0 20 20' }, [
  h('path', { 'fill-rule': 'evenodd', d: 'M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z', 'clip-rule': 'evenodd' })
])

interface Props {
  verification: any
  loading?: boolean
  showRetryButton?: boolean
  retrying?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  showRetryButton: false,
  retrying: false
})

defineEmits<{
  retry: []
}>()

// Helper to parse fraud indicators JSON
const parseFraudIndicators = () => {
  if (!props.verification?.fraud_indicators) return null
  try {
    return typeof props.verification.fraud_indicators === 'string'
      ? JSON.parse(props.verification.fraud_indicators)
      : props.verification.fraud_indicators
  } catch {
    return null
  }
}

const statusLabel = computed(() => {
  if (!props.verification) return 'No Verification'

  // Check for "not found" case - person has no credit history
  const indicators = parseFraudIndicators()
  if (props.verification.verification_status === 'refer' && indicators?.notFound) {
    return 'No Credit History Found'
  }

  switch (props.verification.verification_status) {
    case 'passed': return 'Verification Passed'
    case 'failed': return 'Verification Failed'
    case 'refer': return 'Manual Review Required'
    case 'pending': return 'Verification Pending'
    case 'error': return 'Verification Error'
    default: return 'Unknown Status'
  }
})

const statusIcon = computed(() => {
  if (!props.verification) return ClockIcon
  switch (props.verification.verification_status) {
    case 'passed': return CheckCircleIcon
    case 'failed': return XCircleIcon
    case 'refer': return ExclamationCircleIcon
    case 'error': return XCircleIcon
    default: return ClockIcon
  }
})

const statusColorClass = computed(() => {
  if (!props.verification) return 'bg-gray-50 border border-gray-200'
  switch (props.verification.verification_status) {
    case 'passed': return 'bg-green-50 border border-green-200'
    case 'failed': return 'bg-red-50 border border-red-200'
    case 'refer': return 'bg-yellow-50 border border-yellow-200'
    case 'error': return 'bg-red-50 border border-red-200'
    default: return 'bg-gray-50 border border-gray-200'
  }
})

const statusTextColor = computed(() => {
  if (!props.verification) return 'text-gray-700'
  switch (props.verification.verification_status) {
    case 'passed': return 'text-green-900'
    case 'failed': return 'text-red-900'
    case 'refer': return 'text-yellow-900'
    case 'error': return 'text-red-900'
    default: return 'text-gray-900'
  }
})

const statusIconColor = computed(() => {
  if (!props.verification) return 'text-gray-500'
  switch (props.verification.verification_status) {
    case 'passed': return 'text-green-600'
    case 'failed': return 'text-red-600'
    case 'refer': return 'text-yellow-600'
    case 'error': return 'text-red-600'
    default: return 'text-gray-500'
  }
})

const riskLevelColor = computed(() => {
  if (!props.verification?.risk_level) return 'text-gray-600'
  switch (props.verification.risk_level.toLowerCase()) {
    case 'low': return 'text-green-700'
    case 'medium': return 'text-yellow-700'
    case 'high': return 'text-orange-700'
    case 'very_high': return 'text-red-700'
    default: return 'text-gray-700'
  }
})

const hasMatchScores = computed(() => {
  if (!props.verification) return false
  return props.verification.name_match_score !== null ||
         props.verification.address_match_score !== null ||
         props.verification.dob_match_score !== null
})

const hasComplianceChecks = computed(() => {
  if (!props.verification) return false
  return props.verification.pep_check_result !== null ||
         props.verification.sanctions_check_result !== null ||
         props.verification.adverse_media_result !== null
})

const fraudIndicators = computed(() => {
  const indicators = parseFraudIndicators()
  if (!indicators) return []

  // Convert object to array of strings
  const result: string[] = []

  // Show "not found" message prominently if applicable
  if (indicators.notFound) {
    result.push('Person not found on credit file - may be a student or young person with no credit history')
  }

  if (indicators.ccjMatch) result.push(`${indicators.ccjCount || 0} County Court Judgment(s) found`)
  if (indicators.insolvencyMatch) result.push(`${indicators.insolvencyCount || 0} Insolvency record(s) found`)
  if (indicators.deceasedMatch) result.push('Deceased register match')
  // Don't show "not on electoral roll" if person wasn't found at all
  if (indicators.electoralRollMatch === false && !indicators.notFound) {
    result.push('Not found on Electoral Roll')
  }

  return result
})

const countyCourtJudgments = computed(() => {
  return props.verification?.countyCourtJudgments || []
})

const electoralRolls = computed(() => {
  return props.verification?.electoralRolls || []
})

const insolvencies = computed(() => {
  return props.verification?.insolvencies || []
})

const getScoreColor = (score: number): string => {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  if (score >= 40) return 'text-orange-600'
  return 'text-red-600'
}

const formatDate = (dateString?: string | null): string => {
  if (!dateString) return 'N/A'
  try {
    return formatUkDate(
      dateString,
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }
    )
  } catch {
    return dateString
  }
}

const formatCurrency = (amount: any): string => {
  if (!amount) return 'N/A'

  // Handle object with value property
  if (typeof amount === 'object' && amount.value !== undefined) {
    return `£${Number(amount.value).toLocaleString()}`
  }

  // Handle direct number
  if (typeof amount === 'number') {
    return `£${amount.toLocaleString()}`
  }

  // Handle string number
  if (typeof amount === 'string') {
    const num = parseFloat(amount)
    if (!isNaN(num)) {
      return `£${num.toLocaleString()}`
    }
  }

  return 'N/A'
}
</script>

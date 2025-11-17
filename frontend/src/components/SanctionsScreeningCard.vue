<template>
  <div class="bg-white rounded-lg shadow p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-900">UK Sanctions & PEP Screening</h3>
      <button
        v-if="showRunButton"
        @click="$emit('run')"
        :disabled="running"
        class="px-3 py-1 text-sm font-medium text-primary border border-primary rounded hover:bg-primary hover:text-white transition-colors disabled:opacity-50"
      >
        {{ running ? 'Running...' : 'Run Screening' }}
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-8">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      <p class="mt-2 text-sm text-gray-600">Loading screening results...</p>
    </div>

    <!-- No Screening Found -->
    <div v-else-if="!screening" class="text-center py-8">
      <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-3">
        <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      </div>
      <p class="text-sm text-gray-600">No screening data available</p>
      <p class="text-xs text-gray-500 mt-1">Screening will run automatically when the tenant submits their information</p>
    </div>

    <!-- Screening Results -->
    <div v-else class="space-y-6">
      <!-- Overall Status -->
      <div class="flex items-center justify-between p-4 rounded-lg" :class="statusColorClass">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <component :is="statusIcon" class="w-8 h-8" :class="statusIconColor" />
          </div>
          <div class="ml-4">
            <h4 class="text-lg font-semibold" :class="statusTextColor">{{ statusLabel }}</h4>
            <p class="text-sm" :class="statusTextColor">Total Matches: {{ screening.total_matches }}</p>
          </div>
        </div>
        <div class="text-right">
          <p class="text-xs font-medium uppercase tracking-wide" :class="statusTextColor">Risk Level</p>
          <p class="text-sm font-bold" :class="riskLevelColor">{{ screening.risk_level.toUpperCase() }}</p>
        </div>
      </div>

      <!-- Summary Message -->
      <div v-if="screening.summary_message" class="p-4 rounded-lg" :class="summaryColorClass">
        <p class="text-sm font-medium" :class="summaryTextColor">{{ screening.summary_message }}</p>
      </div>

      <!-- UK Sanctions List Matches -->
      <div v-if="sanctionsMatches.length > 0" class="p-4 bg-red-50 border border-red-200 rounded-lg">
        <h4 class="text-sm font-semibold text-red-900 mb-3 flex items-center">
          <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          UK Sanctions List Matches ({{ sanctionsMatches.length }})
        </h4>
        <div class="space-y-3">
          <div v-for="(match, index) in sanctionsMatches" :key="index" class="p-3 bg-white rounded border border-red-100">
            <div class="space-y-2">
              <div class="flex items-start justify-between">
                <div>
                  <p class="font-semibold text-red-900">{{ match.matched_name }}</p>
                  <p class="text-xs text-gray-600">{{ match.entity_type }} • ID: {{ match.unique_id }}</p>
                </div>
                <span v-if="match.severity" class="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-red-600 text-white">
                  {{ match.severity }}
                </span>
              </div>

              <div class="grid grid-cols-2 gap-2 text-xs">
                <div v-if="match.date_of_birth">
                  <span class="font-medium text-gray-700">Date of Birth:</span>
                  <span class="ml-1 text-gray-900">{{ formatDate(match.date_of_birth) }}</span>
                </div>
                <div v-if="match.nationality">
                  <span class="font-medium text-gray-700">Nationality:</span>
                  <span class="ml-1 text-gray-900">{{ match.nationality }}</span>
                </div>
                <div v-if="match.date_listed">
                  <span class="font-medium text-gray-700">Listed:</span>
                  <span class="ml-1 text-gray-900">{{ formatDate(match.date_listed) }}</span>
                </div>
              </div>

              <div v-if="match.aliases && match.aliases.length > 0" class="mt-2">
                <p class="text-xs font-medium text-gray-700">Known Aliases:</p>
                <p class="text-xs text-gray-600">{{ match.aliases.join(', ') }}</p>
              </div>

              <div v-if="match.sanctions && match.sanctions.length > 0" class="mt-2 space-y-1">
                <p class="text-xs font-medium text-gray-700">Sanctions:</p>
                <div v-for="(sanction, sIndex) in match.sanctions" :key="sIndex" class="text-xs bg-red-50 p-2 rounded">
                  <p class="font-medium text-red-900">{{ sanction.regime }}</p>
                  <p class="text-gray-700">{{ sanction.type }}</p>
                  <p class="text-gray-600">Imposed: {{ formatDate(sanction.date) }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Political Donations (PEP) -->
      <div v-if="donationMatches.length > 0" class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 class="text-sm font-semibold text-blue-900 mb-3 flex items-center">
          <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
            <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
          </svg>
          Electoral Commission Donations ({{ donationMatches.length }})
        </h4>
        <div v-if="donationMatches.length <= 5" class="space-y-2">
          <div v-for="(donation, index) in donationMatches" :key="index" class="p-3 bg-white rounded border border-blue-100">
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div class="col-span-2">
                <span class="font-medium text-gray-700">Donor:</span>
                <span class="ml-1 text-gray-900">{{ donation.donor_name }}</span>
              </div>
              <div class="col-span-2">
                <span class="font-medium text-gray-700">Recipient:</span>
                <span class="ml-1 text-gray-900">{{ donation.recipient_name }}</span>
              </div>
              <div>
                <span class="font-medium text-gray-700">Amount:</span>
                <span class="ml-1 text-gray-900 font-semibold">{{ formatCurrency(donation.value) }}</span>
              </div>
              <div>
                <span class="font-medium text-gray-700">Date:</span>
                <span class="ml-1 text-gray-900">{{ formatDate(donation.date) }}</span>
              </div>
              <div v-if="donation.donor_type">
                <span class="font-medium text-gray-700">Type:</span>
                <span class="ml-1 text-gray-900">{{ donation.donor_type }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="text-sm text-blue-800">
          <p class="mb-2">Found {{ donationMatches.length }} political donation records totaling {{ totalDonations }}.</p>
          <p class="text-xs">This indicates significant political involvement. Review recommended.</p>
        </div>
      </div>

      <!-- Database Statistics -->
      <div class="border-t pt-4">
        <p class="text-xs text-gray-600 mb-2">
          <span class="font-medium">Screened Against:</span>
        </p>
        <div class="grid grid-cols-2 gap-3">
          <div class="p-2 bg-gray-50 rounded">
            <p class="text-xs text-gray-600">UK Sanctions List</p>
            <p class="text-sm font-semibold text-gray-900">5,656 entities</p>
          </div>
          <div class="p-2 bg-gray-50 rounded">
            <p class="text-xs text-gray-600">Electoral Commission</p>
            <p class="text-sm font-semibold text-gray-900">89,358 donations</p>
          </div>
        </div>
      </div>

      <!-- Metadata -->
      <div class="border-t pt-4">
        <div class="grid grid-cols-2 gap-4 text-xs text-gray-600">
          <div v-if="screening.screening_date">
            <span class="font-medium">Screened:</span>
            {{ new Date(screening.screening_date).toLocaleString('en-GB') }}
          </div>
          <div v-if="screening.tenant_name">
            <span class="font-medium">Tenant:</span>
            {{ screening.tenant_name }}
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

const InfoCircleIcon = () => h('svg', { fill: 'currentColor', viewBox: '0 0 20 20' }, [
  h('path', { 'fill-rule': 'evenodd', d: 'M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z', 'clip-rule': 'evenodd' })
])

interface Props {
  screening: any
  loading?: boolean
  showRunButton?: boolean
  running?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  showRunButton: false,
  running: false
})

defineEmits<{
  run: []
}>()

const statusLabel = computed(() => {
  if (!props.screening) return 'No Screening'
  switch (props.screening.risk_level) {
    case 'clear': return 'All Clear'
    case 'low': return 'Low Risk - Minor Records'
    case 'medium': return 'Medium Risk - Review Required'
    case 'high': return 'High Risk - Action Required'
    default: return 'Unknown Status'
  }
})

const statusIcon = computed(() => {
  if (!props.screening) return InfoCircleIcon
  switch (props.screening.risk_level) {
    case 'clear': return CheckCircleIcon
    case 'low': return InfoCircleIcon
    case 'medium': return ExclamationCircleIcon
    case 'high': return XCircleIcon
    default: return InfoCircleIcon
  }
})

const statusColorClass = computed(() => {
  if (!props.screening) return 'bg-gray-50 border border-gray-200'
  switch (props.screening.risk_level) {
    case 'clear': return 'bg-green-50 border border-green-200'
    case 'low': return 'bg-blue-50 border border-blue-200'
    case 'medium': return 'bg-yellow-50 border border-yellow-200'
    case 'high': return 'bg-red-50 border border-red-200'
    default: return 'bg-gray-50 border border-gray-200'
  }
})

const statusTextColor = computed(() => {
  if (!props.screening) return 'text-gray-700'
  switch (props.screening.risk_level) {
    case 'clear': return 'text-green-900'
    case 'low': return 'text-blue-900'
    case 'medium': return 'text-yellow-900'
    case 'high': return 'text-red-900'
    default: return 'text-gray-900'
  }
})

const statusIconColor = computed(() => {
  if (!props.screening) return 'text-gray-500'
  switch (props.screening.risk_level) {
    case 'clear': return 'text-green-600'
    case 'low': return 'text-blue-600'
    case 'medium': return 'text-yellow-600'
    case 'high': return 'text-red-600'
    default: return 'text-gray-500'
  }
})

const riskLevelColor = computed(() => {
  if (!props.screening?.risk_level) return 'text-gray-600'
  switch (props.screening.risk_level) {
    case 'clear': return 'text-green-700'
    case 'low': return 'text-blue-700'
    case 'medium': return 'text-yellow-700'
    case 'high': return 'text-red-700'
    default: return 'text-gray-700'
  }
})

const summaryColorClass = computed(() => {
  if (!props.screening) return 'bg-gray-50 border border-gray-200'
  switch (props.screening.risk_level) {
    case 'clear': return 'bg-green-50 border border-green-200'
    case 'low': return 'bg-blue-50 border border-blue-200'
    case 'medium': return 'bg-yellow-50 border border-yellow-200'
    case 'high': return 'bg-red-50 border border-red-200'
    default: return 'bg-gray-50 border border-gray-200'
  }
})

const summaryTextColor = computed(() => {
  if (!props.screening) return 'text-gray-700'
  switch (props.screening.risk_level) {
    case 'clear': return 'text-green-800'
    case 'low': return 'text-blue-800'
    case 'medium': return 'text-yellow-800'
    case 'high': return 'text-red-800'
    default: return 'text-gray-800'
  }
})

const sanctionsMatches = computed(() => {
  if (!props.screening?.sanctions_matches) return []
  return Array.isArray(props.screening.sanctions_matches)
    ? props.screening.sanctions_matches
    : []
})

const donationMatches = computed(() => {
  if (!props.screening?.donation_matches) return []
  return Array.isArray(props.screening.donation_matches)
    ? props.screening.donation_matches
    : []
})

const totalDonations = computed(() => {
  if (donationMatches.value.length === 0) return '£0'
  const total = donationMatches.value.reduce((sum: number, d: any) => sum + (d.value || 0), 0)
  return formatCurrency(total)
})

const formatDate = (dateString?: string | null, fallback = 'N/A'): string => {
  try {
    return formatUkDate(
      dateString,
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      },
      fallback
    )
  } catch {
    return dateString || fallback
  }
}

const formatCurrency = (amount: number): string => {
  if (!amount) return '£0'
  return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
</script>

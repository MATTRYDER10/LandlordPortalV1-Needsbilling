<template>
  <div v-if="score" class="bg-white rounded-lg shadow-md p-6 border-l-4" :class="decisionBorderColor">
    <!-- Decision Badge -->
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-2xl font-bold text-gray-800">Reference Score</h2>
      <div class="px-4 py-2 rounded-full text-sm font-semibold" :class="decisionBadgeClass">
        {{ formatDecision(score.decision) }}
      </div>
    </div>

    <!-- Total Score -->
    <div class="mb-6">
      <div class="flex justify-between items-center mb-2">
        <span class="text-gray-600 font-medium">Total Score</span>
        <span class="text-3xl font-bold" :class="scoreColor">{{ score.score_total }}/100</span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-3">
        <div
          class="h-3 rounded-full transition-all duration-500"
          :class="scoreBarColor"
          :style="{ width: `${score.score_total}%` }"
        ></div>
      </div>
    </div>

    <!-- Income to Rent Ratio -->
    <div class="mb-6 p-4 bg-gray-50 rounded-lg">
      <div class="flex justify-between items-center">
        <span class="text-gray-600 font-medium">Income to Rent Ratio</span>
        <span class="text-xl font-bold" :class="ratioColor">{{ score.ratio.toFixed(2) }}×</span>
      </div>
      <p class="text-sm text-gray-500 mt-1">
        {{ getRatioDescription(score.ratio) }}
      </p>
    </div>

    <!-- Domain Breakdown -->
    <div class="mb-6">
      <h3 class="text-lg font-semibold text-gray-700 mb-3">Score Breakdown</h3>
      <div class="space-y-3">
        <!-- Credit & TAS -->
        <div>
          <div class="flex justify-between text-sm mb-1">
            <span class="text-gray-600">Credit & TAS</span>
            <span class="font-semibold">{{ score.domain_scores.credit_tas }}/35</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div
              class="bg-gray-700 h-2 rounded-full"
              :style="{ width: `${(score.domain_scores.credit_tas / 35) * 100}%` }"
            ></div>
          </div>
        </div>

        <!-- Affordability -->
        <div>
          <div class="flex justify-between text-sm mb-1">
            <span class="text-gray-600">Affordability</span>
            <span class="font-semibold">{{ score.domain_scores.affordability }}/30</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div
              class="bg-gray-700 h-2 rounded-full"
              :style="{ width: `${(score.domain_scores.affordability / 30) * 100}%` }"
            ></div>
          </div>
        </div>

        <!-- Employment -->
        <div>
          <div class="flex justify-between text-sm mb-1">
            <span class="text-gray-600">Employment</span>
            <span class="font-semibold">{{ score.domain_scores.employment }}/15</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div
              class="bg-gray-700 h-2 rounded-full"
              :style="{ width: `${(score.domain_scores.employment / 15) * 100}%` }"
            ></div>
          </div>
        </div>

        <!-- Residential -->
        <div>
          <div class="flex justify-between text-sm mb-1">
            <span class="text-gray-600">Residential History</span>
            <span class="font-semibold">{{ score.domain_scores.residential }}/15</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div
              class="bg-gray-700 h-2 rounded-full"
              :style="{ width: `${(score.domain_scores.residential / 15) * 100}%` }"
            ></div>
          </div>
        </div>

        <!-- ID & Data -->
        <div>
          <div class="flex justify-between text-sm mb-1">
            <span class="text-gray-600">ID & Data Quality</span>
            <span class="font-semibold">{{ score.domain_scores.id_data }}/5</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div
              class="bg-gray-700 h-2 rounded-full"
              :style="{ width: `${(score.domain_scores.id_data / 5) * 100}%` }"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Flags & Caps -->
    <div v-if="score.caps && score.caps.length > 0" class="mb-4">
      <h3 class="text-sm font-semibold text-gray-700 mb-2">Conditions</h3>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="cap in score.caps"
          :key="cap"
          class="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full"
        >
          {{ formatCap(cap) }}
        </span>
      </div>
    </div>

    <div v-if="score.review_flags && score.review_flags.length > 0" class="mb-4">
      <h3 class="text-sm font-semibold text-gray-700 mb-2">Review Flags</h3>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="flag in score.review_flags"
          :key="flag"
          class="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
        >
          {{ formatFlag(flag) }}
        </span>
      </div>
    </div>

    <div v-if="score.decline_reasons && score.decline_reasons.length > 0" class="mb-4">
      <h3 class="text-sm font-semibold text-gray-700 mb-2">Decline Reasons</h3>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="reason in score.decline_reasons"
          :key="reason"
          class="px-3 py-1 bg-red-100 text-red-800 text-xs rounded-full"
        >
          {{ reason }}
        </span>
      </div>
    </div>

    <!-- Guarantor Requirements -->
    <div v-if="score.guarantor_required" class="p-4 bg-orange-50 border border-orange-200 rounded-lg">
      <h3 class="text-sm font-semibold text-orange-800 mb-2">⚠️ Guarantor Required</h3>
      <div class="text-sm text-gray-700 space-y-1">
        <p><strong>Minimum Income Ratio:</strong> {{ score.guarantor_min_ratio }}×</p>
        <p><strong>Minimum TAS Score:</strong> {{ score.guarantor_min_tas }}</p>
      </div>
    </div>

    <!-- Timestamp -->
    <div class="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500 text-right">
      Scored on {{ formatDate(score.scored_at) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatDate as formatUkDate } from '../utils/date'

interface DomainScores {
  credit_tas: number
  affordability: number
  employment: number
  residential: number
  id_data: number
}

interface Score {
  decision: string
  score_total: number
  domain_scores: DomainScores
  ratio: number
  caps?: string[]
  review_flags?: string[]
  decline_reasons?: string[]
  guarantor_required: boolean
  guarantor_min_ratio?: number
  guarantor_min_tas?: number
  scored_at: string
}

interface Props {
  score: Score | null
}

const props = defineProps<Props>()

const decisionBorderColor = computed(() => {
  if (!props.score) return 'border-gray-300'

  switch (props.score.decision) {
    case 'PASS':
      return 'border-green-500'
    case 'PASS_WITH_GUARANTOR':
      return 'border-orange-500'
    case 'MANUAL_REVIEW':
      return 'border-blue-500'
    case 'DECLINE':
      return 'border-red-500'
    default:
      return 'border-gray-300'
  }
})

const decisionBadgeClass = computed(() => {
  if (!props.score) return 'bg-gray-100 text-gray-800'

  switch (props.score.decision) {
    case 'PASS':
      return 'bg-green-100 text-green-800'
    case 'PASS_WITH_GUARANTOR':
      return 'bg-orange-100 text-orange-800'
    case 'MANUAL_REVIEW':
      return 'bg-blue-100 text-blue-800'
    case 'DECLINE':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
})

const scoreColor = computed(() => {
  if (!props.score) return 'text-gray-600'
  const score = props.score.score_total

  if (score >= 80) return 'text-green-600'
  if (score >= 65) return 'text-orange-600'
  if (score >= 50) return 'text-yellow-600'
  return 'text-red-600'
})

const scoreBarColor = computed(() => {
  if (!props.score) return 'bg-gray-400'
  const score = props.score.score_total

  if (score >= 80) return 'bg-green-500'
  if (score >= 65) return 'bg-orange-500'
  if (score >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
})

const ratioColor = computed(() => {
  if (!props.score) return 'text-gray-600'
  const ratio = props.score.ratio

  if (ratio >= 3.0) return 'text-green-600'
  if (ratio >= 2.5) return 'text-orange-600'
  if (ratio >= 1.5) return 'text-yellow-600'
  return 'text-red-600'
})

function formatDecision(decision: string): string {
  switch (decision) {
    case 'PASS':
      return 'PASS'
    case 'PASS_WITH_GUARANTOR':
      return 'PASS WITH GUARANTOR'
    case 'MANUAL_REVIEW':
      return 'MANUAL REVIEW'
    case 'DECLINE':
      return 'DECLINE'
    default:
      return decision
  }
}

function getRatioDescription(ratio: number): string {
  if (ratio >= 3.0) return 'Excellent affordability'
  if (ratio >= 2.5) return 'Good affordability'
  if (ratio >= 1.5) return 'Acceptable with guarantor'
  return 'Insufficient income'
}

function formatCap(cap: string): string {
  return cap
    .replace(/_/g, ' ')
    .replace(/</g, '< ')
    .replace(/>/g, '> ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatFlag(flag: string): string {
  return flag
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatDate(dateString?: string | null, fallback = 'N/A'): string {
  return formatUkDate(
    dateString,
    {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    },
    fallback
  )
}
</script>

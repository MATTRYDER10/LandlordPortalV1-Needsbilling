<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
    <div class="w-full max-w-2xl">
      <!-- Logo -->
      <div class="text-center mb-8">
        <img src="/PropertyGooseLogo.png" alt="PropertyGoose" class="h-12 mx-auto" />
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center">
        <Loader2 class="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
        <p class="text-gray-600 dark:text-slate-400">Loading offer details...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center">
        <AlertCircle class="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Link Invalid</h1>
        <p class="text-gray-600 dark:text-slate-400">{{ error }}</p>
      </div>

      <!-- Already Decided State -->
      <div v-else-if="alreadyDecided" class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center">
        <div :class="[
          'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4',
          previousDecision === 'approved' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
        ]">
          <CheckCircle v-if="previousDecision === 'approved'" class="w-8 h-8 text-green-600" />
          <XCircle v-else class="w-8 h-8 text-red-600" />
        </div>
        <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Decision Already Submitted</h1>
        <p class="text-gray-600 dark:text-slate-400">
          You {{ previousDecision === 'approved' ? 'approved' : 'declined' }} this offer
          <span v-if="decidedAt">on {{ formatDate(decidedAt) }}</span>.
        </p>
      </div>

      <!-- Success State -->
      <div v-else-if="submitted" class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center">
        <div :class="[
          'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4',
          decision === 'approved' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
        ]">
          <CheckCircle v-if="decision === 'approved'" class="w-8 h-8 text-green-600" />
          <MessageSquare v-else class="w-8 h-8 text-amber-600" />
        </div>
        <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {{ decision === 'approved' ? 'Offer Approved!' : 'Response Submitted' }}
        </h1>
        <p class="text-gray-600 dark:text-slate-400">
          {{ decision === 'approved'
            ? 'Thank you for approving this offer. The letting agent has been notified.'
            : 'Your feedback has been recorded. The letting agent will contact you shortly.'
          }}
        </p>
      </div>

      <!-- Offer Details & Decision Form -->
      <div v-else class="space-y-6">
        <!-- Offer Summary Card -->
        <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div class="bg-gradient-to-r from-primary to-orange-500 px-6 py-4">
            <h1 class="text-xl font-bold text-white">Tenant Offer Review</h1>
            <p class="text-white/80 text-sm mt-1">{{ companyName }} has sent you an offer to review</p>
          </div>

          <div class="p-6">
            <!-- Property -->
            <div class="flex items-start gap-3 mb-6">
              <div class="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <MapPin class="w-5 h-5 text-primary" />
              </div>
              <div>
                <p class="font-semibold text-gray-900 dark:text-white">{{ offerData?.propertyAddress }}</p>
                <p class="text-sm text-gray-500 dark:text-slate-400">
                  {{ offerData?.propertyCity }}<span v-if="offerData?.propertyPostcode">, {{ offerData?.propertyPostcode }}</span>
                </p>
              </div>
            </div>

            <!-- Offer Terms -->
            <div class="grid grid-cols-2 gap-4 mb-6">
              <div class="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                <div class="flex items-center gap-2 text-gray-500 dark:text-slate-400 text-xs mb-1">
                  <Banknote class="w-3.5 h-3.5" />
                  Monthly Rent
                </div>
                <p class="text-xl font-bold text-gray-900 dark:text-white">
                  {{ offerData?.monthlyRent ? `£${offerData.monthlyRent.toLocaleString()}` : '-' }}
                </p>
              </div>
              <div class="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                <div class="flex items-center gap-2 text-gray-500 dark:text-slate-400 text-xs mb-1">
                  <Calendar class="w-3.5 h-3.5" />
                  Move-in Date
                </div>
                <p class="text-xl font-bold text-gray-900 dark:text-white">
                  {{ offerData?.moveInDate ? formatDate(offerData.moveInDate) : 'TBC' }}
                </p>
              </div>
            </div>

            <!-- Tenants -->
            <div v-if="offerData?.tenants && offerData.tenants.length > 0">
              <h3 class="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Applicants ({{ offerData.tenants.length }})
              </h3>
              <div class="space-y-3">
                <div
                  v-for="(tenant, index) in offerData.tenants"
                  :key="index"
                  class="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl"
                >
                  <div class="flex items-start justify-between">
                    <div>
                      <p class="font-semibold text-gray-900 dark:text-white">{{ tenant.firstName }}</p>
                      <p v-if="tenant.jobTitle" class="text-sm text-gray-600 dark:text-slate-400">{{ tenant.jobTitle }}</p>
                    </div>
                    <div v-if="tenant.annualIncome" class="text-right">
                      <p class="font-bold text-green-600 dark:text-green-400">£{{ tenant.annualIncome.toLocaleString() }}</p>
                      <p class="text-xs text-gray-500">per year</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Decision Form -->
        <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6">
          <h2 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Your Decision</h2>

          <!-- Decision Buttons -->
          <div class="grid grid-cols-2 gap-4 mb-6">
            <button
              @click="decision = 'approved'"
              :class="[
                'p-4 rounded-xl border-2 transition-all text-left',
                decision === 'approved'
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-200 dark:border-slate-600 hover:border-green-300'
              ]"
            >
              <div class="flex items-center gap-3">
                <div :class="[
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  decision === 'approved' ? 'bg-green-500' : 'bg-gray-100 dark:bg-slate-700'
                ]">
                  <ThumbsUp :class="[
                    'w-5 h-5',
                    decision === 'approved' ? 'text-white' : 'text-gray-400'
                  ]" />
                </div>
                <div>
                  <p :class="[
                    'font-semibold',
                    decision === 'approved' ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-slate-300'
                  ]">Approve</p>
                  <p class="text-xs text-gray-500 dark:text-slate-400">Accept this offer</p>
                </div>
              </div>
            </button>

            <button
              @click="decision = 'declined'"
              :class="[
                'p-4 rounded-xl border-2 transition-all text-left',
                decision === 'declined'
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                  : 'border-gray-200 dark:border-slate-600 hover:border-red-300'
              ]"
            >
              <div class="flex items-center gap-3">
                <div :class="[
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  decision === 'declined' ? 'bg-red-500' : 'bg-gray-100 dark:bg-slate-700'
                ]">
                  <ThumbsDown :class="[
                    'w-5 h-5',
                    decision === 'declined' ? 'text-white' : 'text-gray-400'
                  ]" />
                </div>
                <div>
                  <p :class="[
                    'font-semibold',
                    decision === 'declined' ? 'text-red-700 dark:text-red-400' : 'text-gray-700 dark:text-slate-300'
                  ]">Decline</p>
                  <p class="text-xs text-gray-500 dark:text-slate-400">Reject this offer</p>
                </div>
              </div>
            </button>
          </div>

          <!-- Decline Reason -->
          <div v-if="decision === 'declined'" class="mb-6">
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Reason for declining <span class="text-red-500">*</span>
            </label>
            <textarea
              v-model="declineReason"
              rows="3"
              placeholder="Please provide a reason for declining this offer..."
              class="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent"
            ></textarea>
          </div>

          <!-- Submit Button -->
          <button
            @click="submitDecision"
            :disabled="submitting || !decision || (decision === 'declined' && !declineReason)"
            class="w-full py-3 bg-gradient-to-r from-primary to-orange-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Loader2 v-if="submitting" class="w-5 h-5 animate-spin" />
            <span v-else>Submit Decision</span>
          </button>

          <p class="text-center text-xs text-gray-500 dark:text-slate-400 mt-4">
            Your response will be shared with the letting agent
          </p>
        </div>
      </div>

      <!-- Footer -->
      <p class="text-center text-xs text-gray-400 mt-8">
        Powered by PropertyGoose
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  MapPin,
  Banknote,
  Calendar,
  ThumbsUp,
  ThumbsDown,
  MessageSquare
} from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const route = useRoute()

const loading = ref(true)
const error = ref('')
const alreadyDecided = ref(false)
const previousDecision = ref('')
const decidedAt = ref('')
const submitted = ref(false)
const submitting = ref(false)

const companyName = ref('')
const offerData = ref<any>(null)
const decision = ref<'approved' | 'declined' | ''>('')
const declineReason = ref('')

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

async function fetchOffer() {
  const token = route.params.token as string
  if (!token) {
    error.value = 'Invalid link'
    loading.value = false
    return
  }

  try {
    const response = await fetch(`${API_URL}/api/v2/offers/landlord-decision/${token}`)
    const data = await response.json()

    if (!response.ok) {
      error.value = data.error || 'Failed to load offer'
      return
    }

    if (data.alreadyDecided) {
      alreadyDecided.value = true
      previousDecision.value = data.decision
      decidedAt.value = data.decidedAt
      return
    }

    offerData.value = data.offer
    companyName.value = data.companyName
  } catch (err: any) {
    error.value = err.message || 'Failed to load offer'
  } finally {
    loading.value = false
  }
}

async function submitDecision() {
  const token = route.params.token as string
  if (!token || !decision.value) return

  if (decision.value === 'declined' && !declineReason.value.trim()) {
    return
  }

  submitting.value = true

  try {
    const response = await fetch(`${API_URL}/api/v2/offers/landlord-decision/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision: decision.value,
        reason: decision.value === 'declined' ? declineReason.value.trim() : undefined
      })
    })

    const data = await response.json()

    if (!response.ok) {
      error.value = data.error || 'Failed to submit decision'
      return
    }

    submitted.value = true
  } catch (err: any) {
    error.value = err.message || 'Failed to submit decision'
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchOffer()
})
</script>

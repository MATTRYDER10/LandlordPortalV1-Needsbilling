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
        <CheckCircle class="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Decisions Already Submitted</h1>
        <p class="text-gray-600 dark:text-slate-400">
          You have already responded to {{ allOffers.length === 1 ? 'this offer' : 'these offers' }}.
        </p>
      </div>

      <!-- All Done State (after submitting all decisions) -->
      <div v-else-if="allSubmitted" class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center">
        <div class="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle class="w-8 h-8 text-green-600" />
        </div>
        <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Thank You!</h1>
        <p class="text-gray-600 dark:text-slate-400">
          Your {{ allOffers.length === 1 ? 'decision has' : 'decisions have' }} been recorded. The letting agent has been notified.
        </p>
      </div>

      <!-- Offer Details & Decision Form -->
      <div v-else class="space-y-6">
        <!-- Header -->
        <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div class="bg-gradient-to-r from-primary to-orange-500 px-6 py-4">
            <h1 class="text-xl font-bold text-white">Tenant Offer Review</h1>
            <p class="text-white/80 text-sm mt-1">
              {{ companyName }} has sent you {{ allOffers.length === 1 ? 'an offer' : `${allOffers.length} offers` }} to review
            </p>
          </div>
        </div>

        <!-- Multi-offer instruction -->
        <div v-if="allOffers.length > 1" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <p class="text-sm text-amber-800 dark:text-amber-300 font-medium">
            Please review each offer below and approve or decline individually.
          </p>
        </div>

        <!-- Offer Cards -->
        <div v-for="(offer, index) in allOffers" :key="offer.id" class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <!-- Offer header -->
          <div class="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <div>
              <h2 v-if="allOffers.length > 1" class="text-lg font-bold text-gray-900 dark:text-white">
                Offer {{ index + 1 }} of {{ allOffers.length }}
              </h2>
              <div class="flex items-start gap-3 mt-2">
                <MapPin class="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p class="font-semibold text-gray-900 dark:text-white">{{ offer.propertyAddress }}</p>
                  <p class="text-sm text-gray-500 dark:text-slate-400">
                    {{ offer.propertyCity }}<span v-if="offer.propertyPostcode">, {{ offer.propertyPostcode }}</span>
                  </p>
                </div>
              </div>
            </div>
            <!-- Decision badge if already submitted this one -->
            <span v-if="offerDecisions[offer.id]?.submitted"
              :class="[
                'px-3 py-1 text-sm font-semibold rounded-full',
                offerDecisions[offer.id]?.decision === 'approved'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              ]">
              {{ offerDecisions[offer.id]?.decision === 'approved' ? 'Approved' : 'Declined' }}
            </span>
          </div>

          <div class="p-6">
            <!-- Offer Terms Grid -->
            <div class="grid grid-cols-2 gap-3 mb-4">
              <div class="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                <div class="flex items-center gap-2 text-gray-500 dark:text-slate-400 text-xs mb-1">
                  <Banknote class="w-3.5 h-3.5" />
                  Monthly Rent
                </div>
                <p class="text-xl font-bold text-gray-900 dark:text-white">
                  {{ offer.monthlyRent ? `£${offer.monthlyRent.toLocaleString()}` : '-' }}
                </p>
                <p v-if="offer.billsIncluded" class="text-xs text-gray-500 mt-0.5">Bills included</p>
              </div>
              <div class="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                <div class="flex items-center gap-2 text-gray-500 dark:text-slate-400 text-xs mb-1">
                  <Calendar class="w-3.5 h-3.5" />
                  Move-in Date
                </div>
                <p class="text-xl font-bold text-gray-900 dark:text-white">
                  {{ offer.moveInDate ? formatDate(offer.moveInDate) : 'TBC' }}
                </p>
              </div>
              <div v-if="offer.tenancyLengthMonths" class="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                <div class="text-gray-500 dark:text-slate-400 text-xs mb-1">Tenancy Length</div>
                <p class="text-lg font-bold text-gray-900 dark:text-white">{{ offer.tenancyLengthMonths }} months</p>
              </div>
              <div v-if="offer.depositAmount" class="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                <div class="text-gray-500 dark:text-slate-400 text-xs mb-1">Deposit</div>
                <p class="text-lg font-bold text-gray-900 dark:text-white">£{{ offer.depositAmount.toLocaleString() }}</p>
              </div>
            </div>

            <!-- Reposit Badge -->
            <div v-if="offer.depositReplacementRequested" class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
              <div class="flex items-start gap-3">
                <div class="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield class="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p class="font-semibold text-blue-800 dark:text-blue-300 text-sm">
                    <span class="font-bold">Rep<span class="text-blue-500">o</span>sit</span> Selected
                  </p>
                  <p class="text-xs text-blue-700 dark:text-blue-400 mt-1">
                    Deposit replacement scheme — tenants pay ~1 week's rent instead of a full deposit. You receive full deposit-equivalent protection.
                    <a href="https://www.reposit.co.uk/landlords" target="_blank" class="underline font-medium hover:text-blue-900">Learn more</a>
                  </p>
                </div>
              </div>
            </div>

            <!-- Special Conditions -->
            <div v-if="offer.specialConditions" class="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <p class="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">Special Conditions</p>
              <p class="text-sm text-amber-700 dark:text-amber-400">{{ offer.specialConditions }}</p>
            </div>

            <!-- Tenants -->
            <div v-if="offer.tenants && offer.tenants.length > 0">
              <h3 class="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Applicants ({{ offer.tenants.length }})
              </h3>
              <div class="space-y-2">
                <div
                  v-for="(tenant, tIdx) in offer.tenants"
                  :key="tIdx"
                  class="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl"
                >
                  <div class="flex items-start justify-between">
                    <div>
                      <p class="font-semibold text-gray-900 dark:text-white">{{ tenant.firstName }}</p>
                      <p v-if="tenant.jobTitle" class="text-sm text-gray-600 dark:text-slate-400">{{ tenant.jobTitle }}</p>
                    </div>
                    <div class="text-right">
                      <div v-if="tenant.annualIncome">
                        <p class="font-bold text-green-600 dark:text-green-400">£{{ tenant.annualIncome.toLocaleString() }}</p>
                        <p class="text-xs text-gray-500">per year</p>
                      </div>
                      <p v-if="tenant.rentShare" class="text-xs text-gray-500 mt-1">Rent share: £{{ tenant.rentShare }}/mo</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Decision Form (only if not yet submitted for this offer) -->
            <div v-if="!offerDecisions[offer.id]?.submitted && !offer.landlordDecision" class="mt-6 pt-6 border-t border-gray-100 dark:border-slate-700">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Your Decision</h3>

              <!-- Decision Buttons -->
              <div class="grid grid-cols-2 gap-3 mb-4">
                <button
                  @click="setDecision(offer.id, 'approved')"
                  :class="[
                    'p-3 rounded-xl border-2 transition-all text-left',
                    offerDecisions[offer.id]?.decision === 'approved'
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-slate-600 hover:border-green-300'
                  ]"
                >
                  <div class="flex items-center gap-2">
                    <ThumbsUp :class="[
                      'w-5 h-5',
                      offerDecisions[offer.id]?.decision === 'approved' ? 'text-green-600' : 'text-gray-400'
                    ]" />
                    <span :class="[
                      'font-semibold text-sm',
                      offerDecisions[offer.id]?.decision === 'approved' ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-slate-300'
                    ]">Approve</span>
                  </div>
                </button>

                <button
                  @click="setDecision(offer.id, 'declined')"
                  :class="[
                    'p-3 rounded-xl border-2 transition-all text-left',
                    offerDecisions[offer.id]?.decision === 'declined'
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                      : 'border-gray-200 dark:border-slate-600 hover:border-red-300'
                  ]"
                >
                  <div class="flex items-center gap-2">
                    <ThumbsDown :class="[
                      'w-5 h-5',
                      offerDecisions[offer.id]?.decision === 'declined' ? 'text-red-600' : 'text-gray-400'
                    ]" />
                    <span :class="[
                      'font-semibold text-sm',
                      offerDecisions[offer.id]?.decision === 'declined' ? 'text-red-700 dark:text-red-400' : 'text-gray-700 dark:text-slate-300'
                    ]">Decline</span>
                  </div>
                </button>
              </div>

              <!-- Decline Reason -->
              <div v-if="offerDecisions[offer.id]?.decision === 'declined'" class="mb-4">
                <textarea
                  v-model="offerDecisions[offer.id].reason"
                  rows="2"
                  placeholder="Please provide a reason for declining..."
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                ></textarea>
              </div>

              <!-- Submit Button -->
              <button
                @click="submitOfferDecision(offer)"
                :disabled="!offerDecisions[offer.id]?.decision || (offerDecisions[offer.id]?.decision === 'declined' && !offerDecisions[offer.id]?.reason) || offerDecisions[offer.id]?.submitting"
                class="w-full py-2.5 bg-gradient-to-r from-primary to-orange-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
              >
                <Loader2 v-if="offerDecisions[offer.id]?.submitting" class="w-4 h-4 animate-spin" />
                <span v-else>Submit Decision</span>
              </button>
            </div>

            <!-- Already decided in this session -->
            <div v-else-if="offer.landlordDecision" class="mt-6 pt-6 border-t border-gray-100 dark:border-slate-700">
              <div :class="[
                'p-3 rounded-xl text-center',
                offer.landlordDecision === 'approved' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              ]">
                <p class="font-semibold">
                  You {{ offer.landlordDecision === 'approved' ? 'approved' : 'declined' }} this offer
                  <span v-if="offer.landlordDecisionAt">on {{ formatDate(offer.landlordDecisionAt) }}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <p class="text-center text-xs text-gray-500 dark:text-slate-400 mt-4">
          Your responses will be shared with the letting agent. The tenants will not be informed directly.
        </p>
      </div>

      <!-- Footer -->
      <p class="text-center text-xs text-gray-400 mt-8">
        Powered by PropertyGoose
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
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
  Shield,
  MessageSquare
} from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL ?? ''
const route = useRoute()

const loading = ref(true)
const error = ref('')
const alreadyDecided = ref(false)
const companyName = ref('')
const allOffers = ref<any[]>([])
const offerDecisions = reactive<Record<string, { decision: string; reason: string; submitting: boolean; submitted: boolean }>>({})

const allSubmitted = computed(() => {
  if (allOffers.value.length === 0) return false
  return allOffers.value.every(o => offerDecisions[o.id]?.submitted || o.landlordDecision)
})

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function setDecision(offerId: string, decision: string) {
  if (!offerDecisions[offerId]) {
    offerDecisions[offerId] = { decision: '', reason: '', submitting: false, submitted: false }
  }
  offerDecisions[offerId].decision = decision
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
      return
    }

    companyName.value = data.companyName

    if (data.multiOffer) {
      allOffers.value = data.offers
    } else {
      allOffers.value = [data.offer]
    }

    // Initialize decision state for each offer
    for (const offer of allOffers.value) {
      offerDecisions[offer.id] = { decision: '', reason: '', submitting: false, submitted: false }
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load offer'
  } finally {
    loading.value = false
  }
}

async function submitOfferDecision(offer: any) {
  const token = route.params.token as string
  const state = offerDecisions[offer.id]
  if (!token || !state?.decision) return

  if (state.decision === 'declined' && !state.reason.trim()) return

  state.submitting = true

  try {
    const response = await fetch(`${API_URL}/api/v2/offers/landlord-decision/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision: state.decision,
        reason: state.decision === 'declined' ? state.reason.trim() : undefined,
        offerId: allOffers.value.length > 1 ? offer.id : undefined
      })
    })

    const data = await response.json()

    if (!response.ok) {
      error.value = data.error || 'Failed to submit decision'
      return
    }

    state.submitted = true
  } catch (err: any) {
    error.value = err.message || 'Failed to submit decision'
  } finally {
    state.submitting = false
  }
}

onMounted(() => {
  fetchOffer()
})
</script>

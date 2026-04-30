<template>
  <div class="max-w-4xl mx-auto px-4 py-12">
    <!-- Payment Form (overlays pricing cards when active) -->
    <div v-if="showPaymentForm && selectedPlan" class="max-w-lg mx-auto">
      <!-- Back to plans -->
      <button @click="cancelPayment" class="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white mb-6">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back to plans
      </button>

      <!-- Plan Summary -->
      <div class="bg-white dark:bg-slate-900 rounded-2xl border-2 border-primary/30 shadow-xl p-6 mb-6">
        <div class="flex justify-between items-center mb-4">
          <div>
            <h3 class="text-lg font-bold text-gray-900 dark:text-white">{{ selectedPlan.name }}</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ selectedPlan.description }}</p>
          </div>
          <div class="text-right">
            <span class="text-2xl font-bold text-gray-900 dark:text-white">{{ formatPrice(selectedPlan.price) }}</span>
            <span class="text-sm text-gray-500">/month</span>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <span class="text-xs px-3 py-1 bg-primary/10 text-primary rounded-full font-medium">Cancel anytime</span>
          <span class="text-xs px-3 py-1 bg-primary/10 text-primary rounded-full font-medium">Billed monthly</span>
        </div>
      </div>

      <!-- Stripe Payment Element -->
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 p-6">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-4">Payment Information</h3>
        <div id="subscription-payment-element" class="mb-4"></div>

        <div v-if="paymentError" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg px-4 py-3 text-sm mb-4">
          {{ paymentError }}
        </div>

        <button
          @click="confirmPayment"
          :disabled="processing"
          class="w-full py-3 text-white font-semibold rounded-xl transition-all disabled:opacity-50 text-base"
          :class="selectedPlan.key === 'landlord_standard' ? 'bg-primary hover:bg-primary/90' : 'bg-blue-600 hover:bg-blue-700'"
        >
          {{ processing ? 'Processing...' : `Subscribe for ${formatPrice(selectedPlan.price)}/mo` }}
        </button>
      </div>
    </div>

    <!-- Pricing Cards (hidden when payment form is showing) -->
    <template v-else>
      <!-- Header -->
      <div class="text-center mb-10">
        <div class="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg class="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
            <path d="M14 2v6h6" />
            <path d="M9 15l2 2 4-4" stroke-width="2" />
          </svg>
        </div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-3">Tenancy Management</h1>
        <p class="text-lg text-gray-500 dark:text-gray-400">Everything a managing agent does. Priced like software.</p>
      </div>

      <!-- Plans Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

        <!-- Standard Plan -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl border-2 border-primary/30 shadow-xl p-8 relative">
          <div v-if="isPromo" class="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-2xl">
            LAUNCH OFFER
          </div>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-1">Standard</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Up to {{ STANDARD_MAX_PROPERTIES }} properties</p>

          <div class="flex items-baseline gap-2 mb-1">
            <span class="text-4xl font-bold text-gray-900 dark:text-white">{{ formatPrice(standardPrice) }}</span>
            <span class="text-gray-500 dark:text-gray-400">per month</span>
          </div>
          <p v-if="isPromo" class="text-sm text-primary font-medium mb-6">
            <span class="line-through text-gray-400 mr-1">{{ formatPrice(STANDARD_PRICE) }}</span>
            early-adopter price — reverts 15 May
          </p>
          <p v-else class="text-sm text-gray-500 dark:text-gray-400 mb-6">Up to {{ STANDARD_MAX_PROPERTIES }} properties</p>

          <div class="space-y-2.5 mb-6">
            <div v-for="f in standardFeatures" :key="f" class="flex items-start gap-2.5">
              <svg class="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ f }}</span>
            </div>
          </div>

          <button
            @click="handleSubscribe('landlord_standard')"
            :disabled="subscribing"
            class="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 text-base"
          >
            {{ subscribing ? 'Setting up...' : 'Subscribe to Standard' }}
          </button>
        </div>

        <!-- Professional Plan -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl border-2 border-blue-400/40 shadow-xl p-8 relative">
          <div class="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-2xl">
            UNLIMITED
          </div>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-1">Professional</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Unlimited properties</p>

          <div class="flex items-baseline gap-2 mb-1">
            <span class="text-4xl font-bold text-gray-900 dark:text-white">{{ formatPrice(PROFESSIONAL_PRICE) }}</span>
            <span class="text-gray-500 dark:text-gray-400">per month</span>
          </div>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">Unlimited properties &bull; £12.50/ref</p>

          <div class="space-y-2.5 mb-6">
            <div v-for="f in proFeatures" :key="f" class="flex items-start gap-2.5">
              <svg class="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ f }}</span>
            </div>
          </div>

          <button
            @click="handleSubscribe('landlord_professional')"
            :disabled="subscribing"
            class="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 text-base"
          >
            {{ subscribing ? 'Setting up...' : 'Subscribe to Professional' }}
          </button>
        </div>
      </div>

      <p class="text-center text-xs text-gray-400 dark:text-gray-500">
        TRU-COST pricing — no hidden fees, no commissions, cancel anytime.
      </p>

      <!-- Bottom note -->
      <div class="text-center mt-6">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Don't need tenancy management? You can still use
          <router-link to="/offers" class="text-primary hover:underline">Offers</router-link> and
          <router-link to="/referencing" class="text-primary hover:underline">Referencing</router-link> on a pay-per-reference basis.
        </p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, nextTick } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useBillingStore } from '@/stores/billing'
import { useToast } from 'vue-toastification'
import { loadStripe } from '@stripe/stripe-js'
import {
  isPromoPeriod, getStandardPrice, formatPrice,
  STANDARD_PRICE, STANDARD_MAX_PROPERTIES,
  PROFESSIONAL_PRICE
} from '@/utils/pricing'

const authStore = useAuthStore()
const billingStore = useBillingStore()
const toast = useToast()
const subscribing = ref(false)
const showPaymentForm = ref(false)
const processing = ref(false)
const paymentError = ref<string | null>(null)

const standardPrice = computed(() => getStandardPrice())
const isPromo = computed(() => isPromoPeriod())

let stripe: any = null
let elements: any = null
let paymentElement: any = null

const PLANS: Record<string, { key: string; name: string; description: string; price: number }> = {
  landlord_standard: {
    key: 'landlord_standard',
    name: 'Standard',
    description: 'Up to 10 properties',
    price: getStandardPrice(),
  },
  landlord_professional: {
    key: 'landlord_professional',
    name: 'Professional',
    description: 'Unlimited properties',
    price: PROFESSIONAL_PRICE,
  },
}

const selectedPlan = ref<typeof PLANS[string] | null>(null)

onMounted(async () => {
  const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  if (stripeKey) {
    stripe = await loadStripe(stripeKey)
  }
})

const standardFeatures = [
  'AST builder with RRA-compliant template',
  'Unlimited tenancy agreements',
  `Up to ${STANDARD_MAX_PROPERTIES} properties`,
  'Section 13, 8, 21 & 48 notices',
  'Deposit registration: TDS or MyDeposits',
  'Compliance packs sent automatically',
  'Gas, EPC & electrical reminders',
  'Referencing at £13/ref',
  'Up to 5 company landlords',
]

const proFeatures = [
  'Everything in Standard',
  'Unlimited properties',
  'Referencing at £12.50/ref',
  'Up to 10 company landlords',
  'RentGoose — Rent Conciliation & Arrears management',
  'Priority support',
  'End-of-tenancy automation',
  'Free utility bill management',
]

async function handleSubscribe(planKey: string) {
  subscribing.value = true
  paymentError.value = null
  selectedPlan.value = PLANS[planKey]

  try {
    if (!stripe) {
      throw new Error('Stripe not initialized — check VITE_STRIPE_PUBLISHABLE_KEY')
    }

    // Create subscription on backend — returns client_secret for payment
    const result = await billingStore.createSubscription(planKey)

    if (!result?.client_secret) {
      throw new Error('No client secret returned — backend may need to create Stripe subscription')
    }

    // Create Stripe Elements
    elements = stripe.elements({
      clientSecret: result.client_secret,
      appearance: {
        theme: 'stripe' as const,
        variables: { colorPrimary: '#fe7a0f' },
      },
    })

    paymentElement = elements.create('payment', {
      fields: { billingDetails: 'auto' },
    })

    showPaymentForm.value = true

    // Wait for DOM to render the payment element container
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 150))

    paymentElement.mount('#subscription-payment-element')
  } catch (err: any) {
    paymentError.value = err.message || 'Failed to set up payment'
    showPaymentForm.value = false
    selectedPlan.value = null
    console.error('Subscription setup error:', err)
  } finally {
    subscribing.value = false
  }
}

function cancelPayment() {
  showPaymentForm.value = false
  selectedPlan.value = null
  paymentError.value = null
  if (paymentElement) {
    paymentElement.unmount()
    paymentElement = null
  }
}

async function confirmPayment() {
  if (!stripe || !elements) return

  processing.value = true
  paymentError.value = null

  try {
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/tenancies?checkout=success`,
      },
      redirect: 'if_required',
    })

    if (error) {
      paymentError.value = error.message || 'Payment failed'
    } else {
      // Payment succeeded — refresh subscription status and reload
      await authStore.fetchSubscriptionStatus()
      toast.success('Subscription activated! Welcome to Tenancy Management.')
      // Force reload to clear paywall
      window.location.reload()
    }
  } catch (err: any) {
    paymentError.value = err.message || 'Payment processing failed'
  } finally {
    processing.value = false
  }
}
</script>

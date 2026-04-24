<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
      <!-- Step 1: Pricing summary -->
      <div v-if="!showStripeForm">
        <div class="p-8">
          <!-- Header -->
          <div class="text-center mb-6">
            <div class="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <rect x="5" y="4" width="14" height="17" rx="2" />
                <path d="M9 2h6v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V2z" />
                <path d="M9 12l2 2 4-4" stroke-width="2" />
              </svg>
            </div>
            <h3 class="text-xl font-bold text-gray-900 dark:text-white">Reference Payment</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Pay to proceed with tenant referencing</p>
          </div>

          <!-- Pricing breakdown -->
          <div class="bg-gray-50 dark:bg-slate-800 rounded-xl p-5 mb-6">
            <div class="flex justify-between items-center mb-3">
              <span class="text-sm text-gray-600 dark:text-gray-300">References required</span>
              <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ numTenants }}</span>
            </div>
            <div class="flex justify-between items-center mb-3">
              <span class="text-sm text-gray-600 dark:text-gray-300">Price per reference</span>
              <div class="text-right">
                <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ formatPrice(pricePerRef) }}</span>
                <span v-if="isLaunch && !hasSubscription" class="block text-[10px] text-primary font-medium">Launch price</span>
                <span v-if="hasSubscription" class="block text-[10px] text-green-600 font-medium">Subscriber discount</span>
              </div>
            </div>
            <div class="border-t border-gray-200 dark:border-slate-700 pt-3 mt-3">
              <div class="flex justify-between items-center">
                <span class="text-base font-bold text-gray-900 dark:text-white">Total</span>
                <span class="text-2xl font-bold text-primary">{{ formatPrice(totalCost) }}</span>
              </div>
            </div>
          </div>

          <!-- What's included -->
          <div class="mb-6">
            <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Each reference includes</p>
            <div class="grid grid-cols-2 gap-1.5">
              <div v-for="item in included" :key="item" class="flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span class="text-xs text-gray-600 dark:text-gray-400">{{ item }}</span>
              </div>
            </div>
          </div>

          <!-- Credit balance notice -->
          <div v-if="hasEnoughCredits" class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-4">
            <p class="text-sm text-green-700 dark:text-green-400">
              You have <span class="font-bold">{{ authStore.referenceCredits }}</span> reference credits.
              This will use <span class="font-bold">{{ numTenants }}</span>.
            </p>
          </div>
          <div v-else-if="authStore.referenceCredits > 0" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-4">
            <p class="text-sm text-amber-700 dark:text-amber-400">
              You have <span class="font-bold">{{ authStore.referenceCredits }}</span> credits but need <span class="font-bold">{{ numTenants }}</span>.
              <router-link to="/settings/billing" class="underline font-medium">Buy more</router-link> or pay for this batch below.
            </p>
          </div>

          <!-- Actions -->
          <div class="flex gap-3">
            <button
              @click="$emit('close')"
              class="flex-1 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              v-if="hasEnoughCredits"
              @click="useCredits"
              :disabled="usingCredits"
              class="flex-1 px-4 py-3 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl shadow-lg shadow-green-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ usingCredits ? 'Processing...' : `Use ${numTenants} Credit${numTenants > 1 ? 's' : ''}` }}
            </button>
            <button
              v-else
              @click="initiatePayment"
              :disabled="initiating"
              class="flex-1 px-4 py-3 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg shadow-primary/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ initiating ? 'Setting up...' : `Pay ${formatPrice(totalCost)}` }}
            </button>
          </div>
        </div>
      </div>

      <!-- Step 2: Stripe payment form -->
      <div v-else>
        <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <h2 class="text-lg font-bold text-gray-900 dark:text-white">Payment Details</h2>
          <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div class="p-6">
          <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-4 mb-4 flex justify-between items-center">
            <span class="text-sm text-gray-600 dark:text-gray-300">{{ numTenants }} reference{{ numTenants > 1 ? 's' : '' }}</span>
            <span class="text-lg font-bold text-primary">{{ formatPrice(totalCost) }}</span>
          </div>

          <div id="reference-payment-element" class="mb-4"></div>

          <div v-if="paymentError" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg p-3 mb-4 text-sm">
            {{ paymentError }}
          </div>

          <div class="flex gap-3">
            <button
              @click="showStripeForm = false"
              class="flex-1 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-800 rounded-xl transition-colors"
            >
              Back
            </button>
            <button
              @click="handlePayment"
              :disabled="processing"
              class="flex-1 px-4 py-3 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ processing ? 'Processing...' : `Pay ${formatPrice(totalCost)}` }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { loadStripe } from '@stripe/stripe-js'
import { useAuthStore } from '@/stores/auth'
import { getReferencePrice, isLaunchPeriod, formatPrice } from '@/utils/pricing'

const props = defineProps<{
  numTenants: number
}>()

const emit = defineEmits<{
  close: []
  paid: []
}>()

const API_URL = import.meta.env.VITE_API_URL ?? ''
const authStore = useAuthStore()
const hasSubscription = computed(() => authStore.hasSubscription)
const isLaunch = computed(() => isLaunchPeriod())
const pricePerRef = computed(() => getReferencePrice(hasSubscription.value))
const totalCost = computed(() => props.numTenants * pricePerRef.value)

const showStripeForm = ref(false)
const initiating = ref(false)
const processing = ref(false)
const usingCredits = ref(false)
const paymentError = ref<string | null>(null)

const hasEnoughCredits = computed(() => authStore.referenceCredits >= props.numTenants)

let stripe: any = null
let elements: any = null

const included = [
  'Credit check (CreditSafe)',
  'AML / PEP screening',
  'Right to Rent check',
  'Employer reference',
  'Previous landlord ref',
  'Income verification'
]

async function useCredits() {
  usingCredits.value = true
  try {
    const response = await fetch(`${API_URL}/api/billing/reference-credits/use`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ quantity: props.numTenants })
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to use credits')
    }

    // Refresh credit balance and proceed
    await authStore.fetchReferenceCredits()
    emit('paid')
  } catch (err: any) {
    paymentError.value = err.message || 'Failed to use credits'
  } finally {
    usingCredits.value = false
  }
}

async function initiatePayment() {
  initiating.value = true
  paymentError.value = null

  try {
    // Request a payment intent from the backend
    const response = await fetch(`${API_URL}/api/billing/reference-payment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        num_references: props.numTenants,
        price_per_reference: pricePerRef.value
      })
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to initiate payment')
    }

    const { client_secret } = await response.json()

    // Initialize Stripe
    const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
    if (!stripeKey) throw new Error('Stripe not configured')

    stripe = await loadStripe(stripeKey)
    if (!stripe) throw new Error('Failed to load Stripe')

    // Show Stripe form
    showStripeForm.value = true

    // Wait for DOM to update, then mount Stripe Elements
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))

    elements = stripe.elements({
      clientSecret: client_secret,
      appearance: {
        theme: 'stripe' as const,
        variables: { colorPrimary: '#f97316' }
      }
    })

    const paymentElement = elements.create('payment', {
      fields: { billingDetails: 'auto' }
    })

    paymentElement.mount('#reference-payment-element')
  } catch (err: any) {
    paymentError.value = err.message || 'Failed to set up payment'
    console.error('Payment init error:', err)
  } finally {
    initiating.value = false
  }
}

async function handlePayment() {
  if (!stripe || !elements) return

  processing.value = true
  paymentError.value = null

  try {
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/referencing?payment=success`
      },
      redirect: 'if_required'
    })

    if (error) {
      paymentError.value = error.message || 'Payment failed'
    } else {
      // Payment succeeded
      emit('paid')
    }
  } catch (err: any) {
    paymentError.value = err.message || 'Payment processing failed'
    console.error('Payment error:', err)
  } finally {
    processing.value = false
  }
}
</script>

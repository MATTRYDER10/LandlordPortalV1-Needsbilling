<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
      <!-- Step 1: Pricing summary -->
      <div v-if="!showStripeForm">
        <div class="p-8">
          <div class="text-center mb-6">
            <div class="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText class="w-8 h-8 text-primary" />
            </div>
            <h3 class="text-xl font-bold text-gray-900 dark:text-white">Create Agreement</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">One-off payment to generate a tenancy agreement</p>
          </div>

          <!-- Pricing -->
          <div class="bg-gray-50 dark:bg-slate-800 rounded-xl p-5 mb-6">
            <div class="flex justify-between items-center mb-3">
              <span class="text-sm text-gray-600 dark:text-gray-300">Standalone AST Agreement</span>
              <span class="text-sm font-semibold text-gray-900 dark:text-white">1</span>
            </div>
            <div class="border-t border-gray-200 dark:border-slate-700 pt-3 mt-3">
              <div class="flex justify-between items-center">
                <span class="text-base font-bold text-gray-900 dark:text-white">Total</span>
                <span class="text-2xl font-bold text-primary">{{ formatPrice(AGREEMENT_PRICE) }}</span>
              </div>
            </div>
          </div>

          <!-- What's included -->
          <div class="mb-6">
            <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Includes</p>
            <div class="grid grid-cols-1 gap-1.5">
              <div v-for="item in included" :key="item" class="flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span class="text-xs text-gray-600 dark:text-gray-400">{{ item }}</span>
              </div>
            </div>
          </div>

          <!-- Subscription upsell -->
          <div class="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 mb-6">
            <p class="text-sm text-orange-800 dark:text-orange-300 font-medium">
              Upgrade to a subscription from {{ formatPrice(getStandardPrice()) }}/mo for unlimited agreements, tenancy management, and more.
            </p>
            <router-link to="/tenancies" class="text-xs text-primary font-medium underline mt-1 inline-block" @click="$emit('close')">
              View plans
            </router-link>
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
              @click="initiatePayment"
              :disabled="initiating"
              class="flex-1 px-4 py-3 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg shadow-primary/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ initiating ? 'Setting up...' : `Pay ${formatPrice(AGREEMENT_PRICE)}` }}
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
            <span class="text-sm text-gray-600 dark:text-gray-300">1 Agreement</span>
            <span class="text-lg font-bold text-primary">{{ formatPrice(AGREEMENT_PRICE) }}</span>
          </div>

          <div id="agreement-payment-element" class="mb-4"></div>

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
              {{ processing ? 'Processing...' : `Pay ${formatPrice(AGREEMENT_PRICE)}` }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { loadStripe } from '@stripe/stripe-js'
import { useAuthStore } from '@/stores/auth'
import { AGREEMENT_PRICE, formatPrice, getStandardPrice } from '@/utils/pricing'
import { FileText } from 'lucide-vue-next'

const emit = defineEmits<{
  close: []
  paid: []
}>()

const API_URL = import.meta.env.VITE_API_URL ?? ''
const authStore = useAuthStore()

const showStripeForm = ref(false)
const initiating = ref(false)
const processing = ref(false)
const paymentError = ref<string | null>(null)

let stripe: any = null
let elements: any = null

const included = [
  'RRA-compliant AST template',
  'Periodic tenancy ready',
  'Digital signature collection',
  'PDF generation & download',
  'Unlimited edits before signing',
]

async function initiatePayment() {
  initiating.value = true
  paymentError.value = null

  try {
    const response = await fetch(`${API_URL}/api/landlord-portal/agreement-payment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to initiate payment')
    }

    const { client_secret } = await response.json()

    const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
    if (!stripeKey) throw new Error('Stripe not configured')

    stripe = await loadStripe(stripeKey)
    if (!stripe) throw new Error('Failed to load Stripe')

    showStripeForm.value = true
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
    paymentElement.mount('#agreement-payment-element')
  } catch (err: any) {
    paymentError.value = err.message || 'Failed to set up payment'
    console.error('Agreement payment init error:', err)
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
        return_url: `${window.location.origin}/agreements/generate?payment=success`
      },
      redirect: 'if_required'
    })

    if (error) {
      paymentError.value = error.message || 'Payment failed'
    } else {
      emit('paid')
    }
  } catch (err: any) {
    paymentError.value = err.message || 'Payment processing failed'
  } finally {
    processing.value = false
  }
}
</script>

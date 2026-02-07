<template>
  <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" @click.self="$emit('close')">
    <div class="bg-white rounded-2xl max-w-[1100px] w-full max-h-[90vh] overflow-y-auto shadow-2xl">
      <!-- Header -->
      <div class="flex justify-between items-start px-8 py-6 border-b border-gray-100">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Purchase Credits</h2>
          <p class="mt-1 text-sm text-gray-500">Choose a pack that fits your needs. Credits never expire.</p>
        </div>
        <button @click="$emit('close')" class="w-10 h-10 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex items-center justify-center text-2xl leading-none">&times;</button>
      </div>

      <div class="p-8">
        <!-- Step 1: Choose Credit Pack -->
        <div v-if="!showPaymentForm">
          <div v-if="billingStore.loading" class="py-16 text-center">
            <div class="inline-block h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-primary"></div>
            <p class="mt-3 text-sm text-gray-500">Loading credit packs...</p>
          </div>

          <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              v-for="pack in billingStore.creditPacks"
              :key="pack.id"
              class="relative border-2 rounded-xl cursor-pointer transition-all duration-200 flex flex-col hover:-translate-y-1 hover:shadow-lg"
              :class="[
                selectedPack?.id === pack.id
                  ? 'border-primary bg-primary/5 shadow-md'
                  : pack.is_recommended
                    ? 'border-primary/40 hover:border-primary'
                    : 'border-gray-200 hover:border-primary'
              ]"
              @click="selectPack(pack)"
            >
              <div v-if="pack.is_recommended" class="absolute top-0 right-0 bg-primary text-white px-3 py-1 rounded-bl-lg text-[10px] font-bold uppercase tracking-wide z-10">
                Recommended
              </div>

              <div class="p-5 flex-1" :class="{ 'pt-8': pack.is_recommended }">
                <!-- Credits -->
                <div class="text-center mb-4 pb-4 border-b border-gray-100">
                  <div class="text-4xl font-extrabold text-gray-900">{{ pack.credits_quantity }}</div>
                  <div class="text-xs text-gray-500 font-medium uppercase tracking-wide mt-1">Reference Credits</div>
                </div>

                <!-- Price -->
                <div class="text-center mb-4">
                  <span class="text-3xl font-extrabold text-gray-900">&pound;{{ pack.price_gbp.toFixed(2) }}</span>
                </div>

                <!-- Details -->
                <div class="bg-gray-50 rounded-lg p-3 mb-3">
                  <div class="flex justify-between items-center text-sm">
                    <span class="text-gray-500">Per credit</span>
                    <span class="font-bold text-gray-900">&pound;{{ pack.price_per_credit.toFixed(2) }}</span>
                  </div>
                  <div v-if="calculateSavings(pack) > 0" class="mt-2 text-center bg-green-100 text-green-700 rounded px-2 py-1 text-xs font-bold">
                    Save &pound;{{ calculateSavings(pack).toFixed(2) }}
                  </div>
                </div>

                <!-- Description -->
                <p class="text-xs text-gray-500 text-center leading-relaxed min-h-[2.5em]">{{ pack.description }}</p>
              </div>

              <!-- Select Button -->
              <div class="px-5 pb-5">
                <button
                  class="w-full py-2.5 rounded-lg font-semibold text-sm transition-colors"
                  :class="selectedPack?.id === pack.id
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-primary text-white hover:bg-primary/90'"
                >
                  {{ selectedPack?.id === pack.id ? 'Selected' : 'Select Pack' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 2: Payment Form -->
        <div v-else-if="showPaymentForm && selectedPack" class="max-w-xl mx-auto">
          <!-- Order Summary -->
          <div class="border-2 border-gray-200 rounded-xl p-6 mb-6">
            <h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Order Summary</h3>
            <div class="flex justify-between items-center mb-4">
              <div>
                <p class="font-semibold text-gray-900">{{ selectedPack.product_name }}</p>
                <p class="text-sm text-gray-500">{{ selectedPack.credits_quantity }} credits</p>
              </div>
              <p class="text-lg font-bold text-gray-900">&pound;{{ selectedPack.price_gbp.toFixed(2) }}</p>
            </div>
            <div class="flex justify-between items-center pt-4 border-t-2 border-gray-200">
              <span class="text-sm font-semibold text-gray-500 uppercase tracking-wide">Total</span>
              <span class="text-2xl font-extrabold text-gray-900">&pound;{{ selectedPack.price_gbp.toFixed(2) }}</span>
            </div>
          </div>

          <!-- Payment Form -->
          <div class="mb-6">
            <h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Payment Details</h3>
            <div id="payment-element" class="mb-4"></div>

            <div v-if="paymentError" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {{ paymentError }}
            </div>
          </div>

          <div class="flex justify-between gap-3">
            <button @click="cancelPayment" class="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Back
            </button>
            <button
              @click="handlePayment"
              :disabled="processing"
              class="px-6 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <span v-if="processing">Processing...</span>
              <span v-else>Pay &pound;{{ selectedPack.price_gbp.toFixed(2) }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useBillingStore } from '../stores/billing'
import { loadStripe } from '@stripe/stripe-js'
import type { CreditPack } from '../stores/billing'

const emit = defineEmits(['close', 'purchased'])
const billingStore = useBillingStore()

const selectedPack = ref<CreditPack | null>(null)
const showPaymentForm = ref(false)
const processing = ref(false)
const paymentError = ref<string | null>(null)

let stripe: any = null
let elements: any = null
let paymentElement: any = null

onMounted(async () => {
  await billingStore.fetchCreditPacks()

  // Initialize Stripe
  const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  if (!stripeKey) {
    throw new Error('Stripe publishable key not configured')
  }
  stripe = await loadStripe(stripeKey)
})

async function selectPack(pack: CreditPack) {
  selectedPack.value = pack
  // Immediately proceed to payment to reduce friction
  await proceedToPayment()
}

function calculateSavings(pack: CreditPack): number {
  const payAsYouGoPrice = 26.99 // Price for single reference without subscription
  const totalPayAsYouGo = pack.credits_quantity * payAsYouGoPrice
  const savings = totalPayAsYouGo - pack.price_gbp
  return savings > 0 ? savings : 0
}

async function proceedToPayment() {
  if (!selectedPack.value) return

  try {
    processing.value = true
    paymentError.value = null

    // Create payment intent on backend
    const result = await billingStore.purchaseCreditPack(selectedPack.value.product_key)

    // If payment was auto-charged with saved payment method, skip payment form
    if (result.charged === true) {
      emit('purchased')
      return
    }

    // If no client_secret, something went wrong
    if (!result.client_secret) {
      throw new Error('No payment details received from server')
    }

    if (!stripe) {
      throw new Error('Stripe not initialized')
    }

    // Create Elements instance
    const appearance = {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#fe7a0f',
      },
    }

    elements = stripe.elements({
      clientSecret: result.client_secret,
      appearance,
    })

    // Create and mount Payment Element with billing details
    paymentElement = elements.create('payment', {
      fields: {
        billingDetails: 'auto',
      },
    })

    showPaymentForm.value = true

    // Wait for DOM update
    await new Promise(resolve => setTimeout(resolve, 100))

    paymentElement.mount('#payment-element')
  } catch (error: any) {
    paymentError.value = error.message || 'Failed to initialize payment'
  } finally {
    processing.value = false
  }
}

function cancelPayment() {
  showPaymentForm.value = false
  if (paymentElement) {
    paymentElement.unmount()
    paymentElement = null
  }
  paymentError.value = null
}

async function handlePayment() {
  if (!stripe || !elements) return

  try {
    processing.value = true
    paymentError.value = null

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/billing?payment=success`,
      },
      redirect: 'if_required',
    })

    if (error) {
      paymentError.value = error.message || 'Payment failed'
    } else {
      // Payment succeeded - close modal and refresh
      emit('purchased')
      // Give a brief moment for user to see success before closing
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  } catch (error: any) {
    paymentError.value = error.message || 'Payment processing failed'
  } finally {
    processing.value = false
  }
}
</script>

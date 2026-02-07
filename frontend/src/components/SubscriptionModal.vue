<template>
  <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" @click.self="$emit('close')">
    <div class="bg-white rounded-2xl max-w-[1100px] w-full max-h-[90vh] overflow-y-auto shadow-2xl">
      <!-- Header -->
      <div class="flex justify-between items-center px-8 py-6 border-b border-gray-100">
        <h2 class="text-2xl font-bold text-gray-900">Choose Your Subscription</h2>
        <button @click="$emit('close')" class="w-10 h-10 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex items-center justify-center text-2xl leading-none">&times;</button>
      </div>

      <div class="p-8">
        <!-- Step 1: Choose Subscription Tier -->
        <div v-if="!showPaymentForm">
          <p class="text-center text-gray-500 mb-6">Subscribe and save up to 50% on reference credits. Credits roll over every month.</p>

          <div v-if="billingStore.loading" class="py-12 text-center">
            <div class="inline-block h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-primary"></div>
            <p class="mt-3 text-sm text-gray-500">Loading subscription plans...</p>
          </div>

          <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              v-for="tier in billingStore.subscriptionTiers"
              :key="tier.id"
              class="relative border-2 rounded-xl cursor-pointer transition-all duration-200 flex flex-col hover:-translate-y-1 hover:shadow-lg"
              :class="[
                selectedTier?.id === tier.id
                  ? 'border-primary bg-primary/5 shadow-md'
                  : tier.is_popular
                    ? 'border-primary/40 hover:border-primary'
                    : 'border-gray-200 hover:border-primary'
              ]"
              @click="selectTier(tier)"
            >
              <div v-if="tier.is_popular" class="absolute top-0 right-0 bg-primary text-white px-3 py-1 rounded-bl-lg text-[10px] font-bold uppercase tracking-wide z-10">
                Most Popular
              </div>

              <div class="p-5 flex-1" :class="{ 'pt-8': tier.is_popular }">
                <!-- Tier Name -->
                <div class="mb-4">
                  <h3 class="text-lg font-bold text-gray-900">{{ tier.product_name }}</h3>
                  <p class="text-xs text-gray-500 leading-relaxed mt-1 min-h-[2.5em]">{{ tier.description }}</p>
                </div>

                <!-- Pricing -->
                <div class="text-center mb-4 pb-4 border-b border-gray-100">
                  <div class="flex items-baseline justify-center">
                    <span class="text-3xl font-bold text-gray-900">&pound;{{ tier.price_gbp.toFixed(0) }}</span>
                    <span class="text-sm text-gray-500 ml-1">/month</span>
                  </div>
                  <p class="text-xs font-semibold text-primary mt-1">&pound;{{ tier.price_per_credit.toFixed(2) }} per credit</p>
                </div>

                <!-- Features -->
                <div class="space-y-2.5">
                  <div class="flex items-start gap-2 text-sm text-gray-700">
                    <Check class="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>{{ tier.credits_quantity }} credits per month</span>
                  </div>
                  <div class="flex items-start gap-2 text-sm text-gray-700">
                    <Check class="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Credits roll over</span>
                  </div>
                  <div class="flex items-start gap-2 text-sm text-gray-700">
                    <Check class="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Cancel anytime</span>
                  </div>
                  <div class="flex items-start gap-2 text-sm font-semibold text-green-600 pt-2 border-t border-gray-100">
                    <Check class="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Save {{ calculateSavings(tier) }}% vs pay-as-you-go</span>
                  </div>
                </div>
              </div>

              <!-- Select Button -->
              <div class="px-5 pb-5">
                <button
                  class="w-full py-2.5 rounded-lg font-semibold text-sm transition-colors"
                  :class="selectedTier?.id === tier.id
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-primary text-white hover:bg-primary/90'"
                >
                  {{ selectedTier?.id === tier.id ? 'Selected' : 'Select Plan' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 2: Payment Form -->
        <div v-else-if="showPaymentForm && selectedTier" class="max-w-xl mx-auto">
          <!-- Subscription Summary -->
          <div class="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-6">
            <h3 class="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Subscription Summary</h3>
            <div class="flex justify-between items-center mb-2">
              <span class="font-medium text-gray-900">{{ selectedTier.product_name }}</span>
              <span class="font-semibold text-gray-900">&pound;{{ selectedTier.price_gbp.toFixed(2) }}/month</span>
            </div>
            <p class="text-sm text-gray-500 mb-4">
              {{ selectedTier.credits_quantity }} credits per month &bull; &pound;{{ selectedTier.price_per_credit.toFixed(2) }} per credit
            </p>
            <div class="flex flex-wrap gap-2 mb-4">
              <span class="text-xs px-3 py-1 bg-primary/10 text-primary rounded-full font-medium">Credits roll over forever</span>
              <span class="text-xs px-3 py-1 bg-primary/10 text-primary rounded-full font-medium">Cancel anytime</span>
              <span class="text-xs px-3 py-1 bg-primary/10 text-primary rounded-full font-medium">Billed monthly</span>
            </div>
            <div class="flex justify-between items-center pt-4 border-t-2 border-gray-200">
              <span class="font-semibold text-gray-600">Monthly Total</span>
              <span class="text-2xl font-extrabold text-gray-900">&pound;{{ selectedTier.price_gbp.toFixed(2) }}</span>
            </div>
          </div>

          <!-- Payment Form -->
          <h3 class="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Payment Information</h3>

          <div id="payment-element" class="mb-4"></div>

          <div v-if="paymentError" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
            {{ paymentError }}
          </div>

          <div class="flex justify-between gap-3">
            <button @click="cancelPayment" class="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Back
            </button>
            <button
              @click="handleSubscribe"
              :disabled="processing"
              class="px-6 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <span v-if="processing">Processing...</span>
              <span v-else>Subscribe for &pound;{{ selectedTier.price_gbp.toFixed(2) }}/mo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Check } from 'lucide-vue-next'
import { useBillingStore } from '../stores/billing'
import { loadStripe } from '@stripe/stripe-js'
import type { SubscriptionTier } from '../stores/billing'

const emit = defineEmits(['close', 'subscribed'])
const billingStore = useBillingStore()

const selectedTier = ref<SubscriptionTier | null>(null)
const showPaymentForm = ref(false)
const processing = ref(false)
const paymentError = ref<string | null>(null)

let stripe: any = null
let elements: any = null
let paymentElement: any = null

onMounted(async () => {
  await billingStore.fetchSubscriptionTiers()

  // Initialize Stripe
  const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  if (!stripeKey) {
    throw new Error('Stripe publishable key not configured')
  }
  stripe = await loadStripe(stripeKey)
})

async function selectTier(tier: SubscriptionTier) {
  selectedTier.value = tier
  // Immediately proceed to payment to reduce friction
  await proceedToPayment()
}

function calculateSavings(tier: SubscriptionTier): number {
  const payAsYouGoPrice = 26.99
  const subscriptionPricePerCredit = tier.price_per_credit
  const savings = ((payAsYouGoPrice - subscriptionPricePerCredit) / payAsYouGoPrice) * 100
  return Math.round(savings)
}

async function proceedToPayment() {
  if (!selectedTier.value) return

  try {
    processing.value = true
    paymentError.value = null

    // Create subscription on backend
    const result = await billingStore.createSubscription(selectedTier.value.product_key)

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

async function handleSubscribe() {
  if (!stripe || !elements) return

  try {
    processing.value = true
    paymentError.value = null

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/billing?subscription=success`,
      },
      redirect: 'if_required',
    })

    if (error) {
      paymentError.value = error.message || 'Subscription failed'
    } else {
      // Subscription succeeded
      emit('subscribed')
    }
  } catch (error: any) {
    paymentError.value = error.message || 'Subscription processing failed'
  } finally {
    processing.value = false
  }
}
</script>

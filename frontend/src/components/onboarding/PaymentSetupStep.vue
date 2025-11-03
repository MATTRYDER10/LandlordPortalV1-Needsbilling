<template>
  <div>
    <!-- Header -->
    <div class="mb-8">
      <h2 class="text-2xl font-bold text-gray-900 mb-2">Payment Setup</h2>
      <p class="text-gray-600">Add a payment method to get started</p>
    </div>

    <!-- Info Box -->
    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3 flex-1">
          <h3 class="text-sm font-medium text-blue-800">How our billing works</h3>
          <div class="mt-2 text-sm text-blue-700 space-y-1">
            <p>• PropertyGoose uses a credit system - you purchase credits to run tenant references</p>
            <p>• You can buy credit packs or subscribe for better value</p>
            <p>• Your payment method will only be charged when you make a purchase</p>
            <p>• You can enable auto-recharge to automatically top up when credits run low</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Payment Form -->
    <div v-if="!paymentAdded" class="space-y-6">
      <!-- Stripe Payment Element -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-3">
          Payment Method <span class="text-red-500">*</span>
        </label>
        <div class="border border-gray-300 rounded-lg p-4 bg-white">
          <div id="payment-element"></div>
        </div>
        <p class="mt-2 text-xs text-gray-500">
          Secured by Stripe. Your card details are never stored on our servers.
        </p>
      </div>

      <!-- Error Message -->
      <div v-if="errorMessage" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
        {{ errorMessage }}
      </div>

      <!-- Navigation Buttons -->
      <div class="flex items-center justify-between pt-4">
        <button
          type="button"
          @click="$emit('back')"
          :disabled="processing"
          class="px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
        >
          Back
        </button>

        <button
          type="button"
          @click="handleAddPaymentMethod"
          :disabled="processing || !stripeLoaded"
          class="px-8 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="processing">Adding...</span>
          <span v-else-if="!stripeLoaded">Loading...</span>
          <span v-else>Add Payment Method</span>
        </button>
      </div>
    </div>

    <!-- Success State - Options after payment method added -->
    <div v-else class="space-y-6">
      <!-- Success Message -->
      <div class="bg-green-50 border border-green-200 rounded-lg p-6">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-6 w-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-green-800">Payment method added successfully!</h3>
            <p class="mt-1 text-sm text-green-700">
              You're all set! Now you can start using PropertyGoose or purchase credits.
            </p>
          </div>
        </div>
      </div>

      <!-- Next Steps Options -->
      <div class="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">What would you like to do next?</h3>

        <div class="space-y-3">
          <!-- Start Free -->
          <button
            @click="handleComplete"
            class="w-full flex items-center justify-between px-6 py-4 bg-white border border-gray-300 rounded-lg hover:border-primary hover:shadow-md transition-all text-left group"
          >
            <div>
              <p class="font-medium text-gray-900 group-hover:text-primary">Continue to Dashboard</p>
              <p class="text-sm text-gray-600">Start exploring PropertyGoose (you can purchase credits anytime)</p>
            </div>
            <svg class="w-5 h-5 text-gray-400 group-hover:text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <!-- Subscribe -->
          <button
            @click="showSubscriptionOptions = true"
            class="w-full flex items-center justify-between px-6 py-4 bg-white border border-gray-300 rounded-lg hover:border-primary hover:shadow-md transition-all text-left group"
          >
            <div>
              <p class="font-medium text-gray-900 group-hover:text-primary">Subscribe to a Plan</p>
              <p class="text-sm text-gray-600">Get monthly credits at a discounted rate</p>
            </div>
            <svg class="w-5 h-5 text-gray-400 group-hover:text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <!-- Buy Credits -->
          <button
            @click="showCreditPackOptions = true"
            class="w-full flex items-center justify-between px-6 py-4 bg-white border border-gray-300 rounded-lg hover:border-primary hover:shadow-md transition-all text-left group"
          >
            <div>
              <p class="font-medium text-gray-900 group-hover:text-primary">Buy Credit Pack</p>
              <p class="text-sm text-gray-600">Purchase credits as you need them</p>
            </div>
            <svg class="w-5 h-5 text-gray-400 group-hover:text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Simple Subscription Options Modal -->
    <div v-if="showSubscriptionOptions" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" @click.self="showSubscriptionOptions = false">
      <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">Choose a Subscription</h3>
          <button @click="showSubscriptionOptions = false" class="text-gray-400 hover:text-gray-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p class="text-sm text-gray-600 mb-4">You can manage or cancel your subscription anytime from Settings.</p>
        <p class="text-center text-sm text-gray-500 py-8">Subscription options will be available after completing setup.</p>
        <div class="flex justify-end gap-3">
          <button @click="showSubscriptionOptions = false" class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Close</button>
          <button @click="showSubscriptionOptions = false; handleComplete()" class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">Continue to Dashboard</button>
        </div>
      </div>
    </div>

    <!-- Simple Credit Pack Options Modal -->
    <div v-if="showCreditPackOptions" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" @click.self="showCreditPackOptions = false">
      <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">Choose a Credit Pack</h3>
          <button @click="showCreditPackOptions = false" class="text-gray-400 hover:text-gray-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p class="text-sm text-gray-600 mb-4">Credits never expire and can be used anytime.</p>
        <p class="text-center text-sm text-gray-500 py-8">Credit packs will be available after completing setup.</p>
        <div class="flex justify-end gap-3">
          <button @click="showCreditPackOptions = false" class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Close</button>
          <button @click="showCreditPackOptions = false; handleComplete()" class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">Continue to Dashboard</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { loadStripe } from '@stripe/stripe-js'
import axios from 'axios'
import { useAuthStore } from '../../stores/auth'

const authStore = useAuthStore()
const API_URL = import.meta.env.VITE_API_URL

const emit = defineEmits<{
  complete: []
  back: []
}>()

const stripeLoaded = ref(false)
const processing = ref(false)
const paymentAdded = ref(false)
const errorMessage = ref('')
const showSubscriptionOptions = ref(false)
const showCreditPackOptions = ref(false)

let stripe: any = null
let elements: any = null

onMounted(async () => {
  try {
    // Get SetupIntent client secret from backend
    const token = authStore.session?.access_token

    const response = await axios.post(
      `${API_URL}/api/billing/setup-intent`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    )

    const { clientSecret } = response.data

    // Initialize Stripe
    const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
    if (!stripeKey) {
      throw new Error('Stripe publishable key not configured')
    }
    stripe = await loadStripe(stripeKey)

    if (!stripe) {
      throw new Error('Failed to load Stripe')
    }

    // Create Elements instance
    elements = stripe.elements({
      clientSecret,
      appearance: {
        theme: 'stripe',
        variables: {
          colorPrimary: '#f97316',
        },
      },
    })

    // Create and mount Payment Element
    const paymentElement = elements.create('payment')

    // Wait for DOM
    await new Promise(resolve => setTimeout(resolve, 100))
    paymentElement.mount('#payment-element')

    stripeLoaded.value = true
  } catch (err: any) {
    errorMessage.value = err.response?.data?.error || err.message || 'Failed to initialize payment form'
    console.error('Payment element initialization error:', err)
  }
})

const handleAddPaymentMethod = async () => {
  if (!stripe || !elements) {
    errorMessage.value = 'Payment form not ready'
    return
  }

  try {
    processing.value = true
    errorMessage.value = ''

    // Confirm the SetupIntent
    const { setupIntent, error: confirmError } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/onboarding`,
      },
      redirect: 'if_required',
    })

    if (confirmError) {
      errorMessage.value = confirmError.message || 'Failed to save payment method'
      return
    }

    // Save payment method to database
    const paymentMethodId = typeof setupIntent.payment_method === 'string'
      ? setupIntent.payment_method
      : setupIntent.payment_method.id

    const token = authStore.session?.access_token
    await axios.put(
      `${API_URL}/api/billing/payment-methods/default`,
      { payment_method_id: paymentMethodId },
      { headers: { Authorization: `Bearer ${token}` } }
    )

    paymentAdded.value = true
  } catch (error: any) {
    console.error('Error adding payment method:', error)
    errorMessage.value = error.response?.data?.error || error.message || 'Failed to add payment method'
  } finally {
    processing.value = false
  }
}

const handleComplete = () => {
  emit('complete')
}
</script>

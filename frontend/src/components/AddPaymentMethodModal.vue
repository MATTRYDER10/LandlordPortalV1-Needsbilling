<template>
  <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" @click.self="$emit('close')">
    <div class="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl">
      <!-- Header -->
      <div class="flex justify-between items-start px-8 py-6 border-b border-gray-100">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Add Payment Method</h2>
          <p class="mt-1 text-sm text-gray-500">This will be used for auto-recharge and subscriptions</p>
        </div>
        <button @click="$emit('close')" class="w-10 h-10 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex items-center justify-center text-2xl leading-none">&times;</button>
      </div>

      <!-- Body -->
      <div class="p-8 overflow-y-auto flex-1">
        <div id="payment-element" class="mb-4"></div>

        <div v-if="error" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          {{ error }}
        </div>

        <div class="flex gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <AlertCircle class="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <p>Your payment method will be securely stored by Stripe and used only when you make a purchase or enable auto-recharge.</p>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex gap-3 px-8 py-5 border-t border-gray-100">
        <button @click="$emit('close')" class="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button
          @click="handleSubmit"
          :disabled="processing"
          class="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {{ processing ? 'Adding...' : 'Add Payment Method' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { AlertCircle } from 'lucide-vue-next'
import { loadStripe } from '@stripe/stripe-js'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const API_URL = import.meta.env.VITE_API_URL ?? ''

const emit = defineEmits(['close', 'added'])
const processing = ref(false)
const error = ref<string | null>(null)
const authStore = useAuthStore()

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

    // Create Elements instance with SetupIntent client secret
    elements = stripe.elements({
      clientSecret,
      appearance: {
        theme: 'stripe',
        variables: {
          colorPrimary: '#fe7a0f',
        },
      },
    })

    // Create and mount Payment Element
    const paymentElement = elements.create('payment')

    // Wait for DOM
    await new Promise(resolve => setTimeout(resolve, 100))
    paymentElement.mount('#payment-element')
  } catch (err: any) {
    error.value = err.response?.data?.error || err.message || 'Failed to initialize payment form'
  }
})

async function handleSubmit() {
  if (!stripe || !elements) {
    error.value = 'Payment form not ready'
    return
  }

  try {
    processing.value = true
    error.value = null

    // Confirm the SetupIntent
    const { setupIntent, error: confirmError } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/billing`,
      },
      redirect: 'if_required',
    })

    if (confirmError) {
      error.value = confirmError.message || 'Failed to save payment method'
      return
    }

    // SetupIntent confirmed - payment method is now attached to the Stripe customer
    // Now save it to our database and set as default
    const paymentMethodId = typeof setupIntent.payment_method === 'string'
      ? setupIntent.payment_method
      : setupIntent.payment_method.id

    const token = authStore.session?.access_token
    await axios.put(
      `${API_URL}/api/billing/payment-methods/default`,
      { payment_method_id: paymentMethodId },
      { headers: { Authorization: `Bearer ${token}` } }
    )

    // Emit the payment method ID
    emit('added', paymentMethodId)
  } catch (err: any) {
    error.value = err.message || 'An error occurred'
  } finally {
    processing.value = false
  }
}
</script>

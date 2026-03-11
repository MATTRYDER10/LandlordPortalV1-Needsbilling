<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
    <div class="max-w-lg w-full bg-white shadow-sm rounded-2xl p-8 text-center">
      <!-- Loading state -->
      <template v-if="loading">
        <div class="flex justify-center mb-4">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
        <p class="text-sm text-gray-600">{{ loadingText }}</p>
      </template>

      <!-- Payment info state - ready to confirm -->
      <template v-else-if="paymentInfo && !success && !alreadyConfirmed">
        <div class="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path>
          </svg>
        </div>
        <h1 class="text-2xl font-semibold text-gray-900 mb-4">
          Confirm Fee Payment
        </h1>
        <p class="text-sm text-gray-600 mb-6">
          Please confirm you have made the Change of Tenant fee payment for:
        </p>

        <!-- Payment details box -->
        <div class="bg-gray-50 rounded-xl p-6 mb-6 text-left">
          <div class="space-y-3">
            <div class="flex justify-between">
              <span class="text-sm text-gray-500">Property</span>
              <span class="text-sm font-medium text-gray-900">{{ paymentInfo.propertyAddress }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-500">Amount Due</span>
              <span class="text-sm font-semibold text-gray-900">£{{ paymentInfo.totalAmount.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-500">Reference</span>
              <span class="text-sm font-medium text-gray-900">{{ paymentInfo.paymentReference }}</span>
            </div>
          </div>
        </div>

        <button
          @click="confirmPayment"
          :disabled="confirming"
          class="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="confirming">Confirming...</span>
          <span v-else>I've Made This Payment</span>
        </button>

        <p class="mt-4 text-xs text-gray-500">
          By clicking this button, you confirm that you have transferred the funds to the agent's bank account.
        </p>
      </template>

      <!-- Success state -->
      <template v-else-if="success">
        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        <h1 class="text-2xl font-semibold text-gray-900 mb-4">
          Payment Confirmed
        </h1>
        <p class="text-sm text-gray-600 mb-4">
          Thank you for confirming your Change of Tenant fee payment.
        </p>
        <p class="text-sm text-gray-600 mb-4">
          The agent has been notified and will verify the payment has been received in their account. Once confirmed, they will proceed with the tenancy addendum.
        </p>
        <p class="text-sm text-gray-600">
          If you have any questions, please contact the agent directly.
        </p>
      </template>

      <!-- Already confirmed state -->
      <template v-else-if="alreadyConfirmed">
        <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <h1 class="text-2xl font-semibold text-gray-900 mb-4">
          Payment Already Confirmed
        </h1>
        <p class="text-sm text-gray-600 mb-4">
          You've already confirmed your payment for this tenant change.
        </p>
        <p class="text-sm text-gray-600">
          The agent is processing your payment. If you have any questions, please contact them directly.
        </p>
      </template>

      <!-- Error state -->
      <template v-else-if="error">
        <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </div>
        <h1 class="text-2xl font-semibold text-red-600 mb-4">
          Something went wrong
        </h1>
        <p class="text-sm text-gray-600 mb-4">
          {{ errorMessage }}
        </p>
        <p class="text-sm text-gray-600">
          Please contact the agent directly to let them know you've made the payment.
        </p>
      </template>

      <!-- Invalid token state -->
      <template v-else>
        <div class="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
        </div>
        <h1 class="text-2xl font-semibold text-gray-900 mb-4">
          Invalid Link
        </h1>
        <p class="text-sm text-gray-600">
          This link appears to be invalid or expired. Please use the link from your email or contact the agent directly.
        </p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const route = useRoute()

interface PaymentInfo {
  propertyAddress: string
  totalAmount: number
  paymentReference: string
  alreadyConfirmed: boolean
}

const loading = ref(false)
const loadingText = ref('Loading payment details...')
const confirming = ref(false)
const success = ref(false)
const alreadyConfirmed = ref(false)
const error = ref(false)
const errorMessage = ref('')
const paymentInfo = ref<PaymentInfo | null>(null)

async function fetchPaymentInfo() {
  const token = route.params.token as string

  if (!token) {
    return
  }

  loading.value = true
  loadingText.value = 'Loading payment details...'

  try {
    const response = await fetch(`${API_URL}/api/tenant-change/confirm-payment/${token}`)

    const data = await response.json()

    if (response.ok) {
      if (data.alreadyConfirmed) {
        alreadyConfirmed.value = true
      } else {
        paymentInfo.value = data
      }
    } else {
      error.value = true
      errorMessage.value = data.error || 'Failed to load payment details'
    }
  } catch (err) {
    error.value = true
    errorMessage.value = 'Failed to connect to the server. Please try again later.'
  } finally {
    loading.value = false
  }
}

async function confirmPayment() {
  const token = route.params.token as string

  if (!token) {
    return
  }

  confirming.value = true

  try {
    const response = await fetch(`${API_URL}/api/tenant-change/confirm-payment/${token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()

    if (response.ok) {
      success.value = true
    } else {
      if (data.alreadyConfirmed) {
        alreadyConfirmed.value = true
      } else {
        error.value = true
        errorMessage.value = data.error || 'Failed to confirm payment'
      }
    }
  } catch (err) {
    error.value = true
    errorMessage.value = 'Failed to connect to the server. Please try again later.'
  } finally {
    confirming.value = false
  }
}

onMounted(() => {
  fetchPaymentInfo()
})
</script>

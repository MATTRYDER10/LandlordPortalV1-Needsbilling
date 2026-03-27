<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
    <div class="max-w-lg w-full bg-white shadow-sm rounded-2xl p-8 text-center">
      <!-- Loading state -->
      <template v-if="loading">
        <div class="flex justify-center mb-4">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
        <p class="text-sm text-gray-600">Notifying the agent...</p>
      </template>

      <!-- Success state -->
      <template v-else-if="success">
        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        <h1 class="text-2xl font-semibold text-gray-900 mb-4">
          Payment Confirmation Received
        </h1>
        <p class="text-sm text-gray-600 mb-4">
          Thank you for confirming your initial monies payment.
        </p>
        <p class="text-sm text-gray-600 mb-4">
          The agent has been notified and will verify your payment has been received. Once confirmed, you'll be all set for your move-in date.
        </p>
        <p class="text-sm text-gray-600">
          If you have any questions in the meantime, please contact the agent directly.
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
          You've already confirmed your payment for this tenancy.
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

      <!-- No tenancy ID state -->
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

const route = useRoute()

const loading = ref(false)
const success = ref(false)
const alreadyConfirmed = ref(false)
const error = ref(false)
const errorMessage = ref('')

onMounted(async () => {
  const tenancyId = route.params.id as string

  if (!tenancyId) {
    // No tenancy ID provided - show invalid link message
    return
  }

  loading.value = true

  try {
    const response = await fetch(`${import.meta.env.DEV ? `http://${window.location.hostname}:3001` : import.meta.env.VITE_API_URL}/api/tenancies/public/${tenancyId}/tenant-paid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()

    if (response.ok) {
      if (data.alreadyConfirmed) {
        alreadyConfirmed.value = true
      } else {
        success.value = true
      }
    } else {
      error.value = true
      errorMessage.value = data.error || 'Failed to confirm payment'
    }
  } catch (err) {
    error.value = true
    errorMessage.value = 'Failed to connect to the server. Please try again later.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
    <div class="max-w-lg w-full bg-white shadow-sm rounded-2xl p-8 text-center">
      <!-- Loading state -->
      <template v-if="loading">
        <div class="flex justify-center mb-4">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
        <p class="text-sm text-gray-600">Notifying your agent...</p>
      </template>

      <!-- Success state -->
      <template v-else-if="success">
        <h1 class="text-2xl font-semibold text-gray-900 mb-4">
          We've successfully notified the agent
        </h1>
        <p class="text-sm text-gray-600 mb-4">
          Thank you for confirming your holding deposit payment.
        </p>
        <p class="text-sm text-gray-600 mb-4">
          Your agent has been notified and will verify your payment. Once this is done, you will receive a confirmation
          email and your references will be started.
        </p>
        <p class="text-sm text-gray-600">
          If you have any questions in the meantime, please contact your agent directly.
        </p>
      </template>

      <!-- Error state -->
      <template v-else-if="error">
        <h1 class="text-2xl font-semibold text-red-600 mb-4">
          Something went wrong
        </h1>
        <p class="text-sm text-gray-600 mb-4">
          {{ errorMessage }}
        </p>
        <p class="text-sm text-gray-600">
          Please contact your agent directly to let them know you've made the payment.
        </p>
      </template>

      <!-- No offer ID state -->
      <template v-else>
        <h1 class="text-2xl font-semibold text-gray-900 mb-4">
          Invalid Link
        </h1>
        <p class="text-sm text-gray-600">
          This link appears to be invalid or expired. Please use the link from your email or contact your agent directly.
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
const error = ref(false)
const errorMessage = ref('')

onMounted(async () => {
  const offerId = route.query.offer_id as string

  if (!offerId) {
    // No offer ID provided - show invalid link message
    return
  }

  loading.value = true

  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/tenant-offers/confirm-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ offer_id: offerId })
    })

    const data = await response.json()

    if (response.ok) {
      success.value = true
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

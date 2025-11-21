<template>
  <div class="min-h-screen bg-background flex items-center justify-center px-4">
    <div class="max-w-md w-full space-y-8">
      <div class="text-center">
        <div class="flex items-center justify-center mb-4">
          <img src="/PropertyGooseIcon.webp" alt="PropertyGoose" class="w-10 h-10 mr-3" />
          <h1 class="text-4xl font-bold">
            <span class="text-gray-900">Property</span><span class="text-primary">Goose</span>
          </h1>
        </div>
        <h2 class="mt-6 text-3xl font-bold text-gray-900">Reset your password</h2>
        <p class="mt-2 text-sm text-gray-600">
          Remember your password?
          <router-link to="/login" class="font-medium text-primary hover:text-primary/80">
            Sign in
          </router-link>
        </p>
      </div>

      <form @submit.prevent="handleSubmit" class="mt-8 space-y-6">
        <div v-if="errorMessage" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
          {{ errorMessage }}
        </div>

        <div v-if="successMessage" class="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded">
          {{ successMessage }}
        </div>

        <div class="rounded-md shadow-sm">
          <div>
            <label for="email-address" class="block text-sm font-medium text-gray-700">Email address</label>
            <input
              id="email-address"
              v-model="email"
              type="email"
              autocomplete="email"
              required
              class="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
              placeholder="you@example.com"
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            :disabled="loading"
            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ loading ? 'Sending...' : 'Send reset link' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { isValidEmail } from '../utils/validation'

const authStore = useAuthStore()

const email = ref('')
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const loading = ref(false)

const handleSubmit = async () => {
  errorMessage.value = null
  successMessage.value = null

  // Validation
  if (!isValidEmail(email.value)) {
    errorMessage.value = 'Please enter a valid email address'
    return
  }

  loading.value = true

  try {
    const { error } = await authStore.resetPassword(email.value)

    if (error) {
      errorMessage.value = error
    } else {
      successMessage.value = 'Password reset link sent! Please check your email.'
      email.value = ''
    }
  } catch (err: any) {
    errorMessage.value = err.message || 'An error occurred'
  } finally {
    loading.value = false
  }
}
</script>

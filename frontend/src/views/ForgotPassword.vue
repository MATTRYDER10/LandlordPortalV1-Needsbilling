<template>
  <div class="min-h-screen bg-background flex items-center justify-center px-4">
    <div class="max-w-md w-full space-y-8">
      <div class="text-center">
        <div class="flex items-center justify-center mb-4">
          <img src="/PropertyGooseLogo.png" alt="PropertyGoose" class="h-10 dark:hidden" />
          <img src="/PropertyGooseLogoDark.png" alt="PropertyGoose" class="h-10 hidden dark:block" />
        </div>
        <h2 class="mt-6 text-3xl font-bold text-gray-900 dark:text-white">Reset your password</h2>
        <p class="mt-2 text-sm text-gray-600 dark:text-slate-400">
          Remember your password?
          <router-link to="/login" class="font-medium text-primary hover:text-primary/80">
            Sign in
          </router-link>
        </p>
      </div>

      <form @submit.prevent="handleSubmit" class="mt-8 space-y-6">
        <div v-if="errorMessage" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
          {{ errorMessage }}
        </div>

        <div v-if="successMessage" class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded">
          {{ successMessage }}
        </div>

        <div class="rounded-md shadow-sm">
          <div>
            <label for="email-address" class="block text-sm font-medium text-gray-700 dark:text-slate-300">Email address</label>
            <input
              id="email-address"
              v-model="email"
              type="email"
              autocomplete="email"
              required
              class="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 placeholder-gray-500 dark:placeholder-slate-400 text-gray-900 dark:text-white dark:bg-slate-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
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

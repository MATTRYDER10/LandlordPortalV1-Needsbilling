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
        <h2 class="mt-6 text-3xl font-bold text-gray-900">Sign in to your account</h2>
        <p class="mt-2 text-sm text-gray-600">
          Don't have an account?
          <router-link to="/register" class="font-medium text-primary hover:text-primary/80">
            Create one now
          </router-link>
        </p>
      </div>

      <form @submit.prevent="handleSubmit" class="mt-8 space-y-6">
        <div v-if="errorMessage" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
          {{ errorMessage }}
        </div>

        <div class="rounded-md shadow-sm space-y-4">
          <div>
            <label for="email-address" class="block text-sm font-medium text-gray-700">Email address</label>
            <input
              id="email-address"
              v-model="formData.email"
              type="email"
              autocomplete="email"
              required
              class="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-gray-700">Password</label>
            <input
              id="password"
              v-model="formData.password"
              type="password"
              autocomplete="current-password"
              required
              class="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
              placeholder="Your password"
            />
          </div>
        </div>

        <div class="flex items-center justify-end">
          <div class="text-sm">
            <router-link to="/forgot-password" class="font-medium text-primary hover:text-primary/80">
              Forgot your password?
            </router-link>
          </div>
        </div>

        <div>
          <button
            type="submit"
            :disabled="loading"
            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ loading ? 'Signing in...' : 'Sign in' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { isValidEmail } from '../utils/validation'

const router = useRouter()
const authStore = useAuthStore()

const formData = ref({
  email: '',
  password: ''
})

const errorMessage = ref<string | null>(null)
const loading = ref(false)

const handleSubmit = async () => {
  errorMessage.value = null

  // Validation
  if (!isValidEmail(formData.value.email)) {
    errorMessage.value = 'Please enter a valid email address'
    return
  }

  loading.value = true

  try {
    const { error } = await authStore.signIn(
      formData.value.email,
      formData.value.password
    )

    if (error) {
      errorMessage.value = error
    } else {
      // Fetch user data to determine user type
      await authStore.fetchUser()

      // Redirect based on user type
      if (authStore.company) {
        router.push('/dashboard')
      } else if (authStore.isStaff) {
        router.push('/staff/dashboard')
      } else {
        // User has no access - sign them out
        await authStore.signOut()
        errorMessage.value = 'Access denied. Please use the appropriate login portal.'
      }
    }
  } catch (err: any) {
    errorMessage.value = err.message || 'An error occurred during sign in'
  } finally {
    loading.value = false
  }
}
</script>

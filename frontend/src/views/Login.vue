<template>
  <div class="min-h-screen bg-background flex items-center justify-center px-4">
    <div class="max-w-md w-full space-y-8">
      <div class="text-center">
        <div class="flex items-center justify-center mb-6">
          <img src="/PropertyGooseLogoFull.png" alt="PropertyGoose" class="h-64" />
        </div>
        <h2 class="text-3xl font-bold text-gray-900 dark:text-white">Sign in to your account</h2>
        <p class="mt-2 text-sm text-gray-600 dark:text-slate-400">
          Don't have an account?
          <router-link to="/register" class="font-medium text-primary hover:text-primary/80">
            Create one now
          </router-link>
        </p>
      </div>

      <form @submit.prevent="handleSubmit" class="mt-8 space-y-6">
        <div v-if="errorMessage" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
          {{ errorMessage }}
        </div>

        <div class="rounded-md shadow-sm space-y-4">
          <div>
            <label for="email-address" class="block text-sm font-medium text-gray-700 dark:text-slate-300">Email address</label>
            <input
              id="email-address"
              v-model="formData.email"
              type="email"
              autocomplete="email"
              required
              class="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 placeholder-gray-500 dark:placeholder-slate-400 text-gray-900 dark:text-white dark:bg-slate-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 dark:text-slate-300">Password</label>
            <input
              id="password"
              v-model="formData.password"
              type="password"
              autocomplete="current-password"
              required
              class="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 placeholder-gray-500 dark:placeholder-slate-400 text-gray-900 dark:text-white dark:bg-slate-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
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

      // Check if staff first
      if (authStore.isStaff) {
        router.push('/staff/dashboard')
        return
      }

      // Fetch branches for non-staff users
      await authStore.fetchBranches()

      if (authStore.branches.length === 0) {
        // User has no access - sign them out
        await authStore.signOut()
        errorMessage.value = 'Access denied. Please use the appropriate login portal.'
      } else if (authStore.branches.length === 1) {
        // Single branch - auto-select and go to dashboard
        authStore.setActiveBranch(authStore.branches[0].id)
        router.push('/dashboard')
      } else {
        // Multiple branches - go to branch selector
        router.push('/select-branch')
      }
    }
  } catch (err: any) {
    errorMessage.value = err.message || 'An error occurred during sign in'
  } finally {
    loading.value = false
  }
}
</script>

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
        <h2 class="mt-6 text-3xl font-bold text-gray-900">Accept Your Invitation</h2>
        <p class="mt-2 text-sm text-gray-600">
          Create your account to join the team
        </p>
      </div>

      <div v-if="loading" class="text-center py-8">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p class="mt-2 text-gray-600">Loading invitation...</p>
      </div>

      <div v-else-if="invitationError" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
        {{ invitationError }}
      </div>

      <form v-else @submit.prevent="handleSubmit" class="mt-8 space-y-6">
        <div v-if="errorMessage" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
          {{ errorMessage }}
        </div>

        <div v-if="successMessage" class="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded">
          {{ successMessage }}
        </div>

        <div class="rounded-md shadow-sm space-y-4">
          <div>
            <label for="email-address" class="block text-sm font-medium text-gray-700">Email address</label>
            <input
              id="email-address"
              v-model="invitationEmail"
              type="email"
              disabled
              class="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 bg-gray-100 text-gray-700 rounded-md cursor-not-allowed sm:text-sm"
            />
          </div>

          <div>
            <label for="role" class="block text-sm font-medium text-gray-700">Role</label>
            <input
              id="role"
              v-model="invitationRole"
              type="text"
              disabled
              class="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 bg-gray-100 text-gray-700 rounded-md cursor-not-allowed sm:text-sm capitalize"
            />
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-gray-700">Password</label>
            <input
              id="password"
              v-model="formData.password"
              type="password"
              autocomplete="new-password"
              required
              class="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
              placeholder="At least 6 characters"
            />
          </div>

          <div>
            <label for="confirm-password" class="block text-sm font-medium text-gray-700">Confirm Password</label>
            <input
              id="confirm-password"
              v-model="formData.confirmPassword"
              type="password"
              autocomplete="new-password"
              required
              class="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
              placeholder="Confirm your password"
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            :disabled="submitting"
            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ submitting ? 'Creating Account...' : 'Accept Invitation' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const token = ref('')
const loading = ref(true)
const invitationError = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const submitting = ref(false)
const invitationEmail = ref('')
const invitationRole = ref('')

const formData = ref({
  password: '',
  confirmPassword: ''
})

const fetchInvitationDetails = async () => {
  try {
    const response = await fetch(`${API_URL}/api/invitations/details/${token.value}`)

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Invalid or expired invitation')
    }

    const data = await response.json()
    invitationEmail.value = data.email
    invitationRole.value = data.role
  } catch (error: any) {
    invitationError.value = error.message || 'Failed to load invitation'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  token.value = route.params.token as string
  if (!token.value) {
    invitationError.value = 'Invalid invitation link'
    loading.value = false
  } else {
    await fetchInvitationDetails()
  }
})

const handleSubmit = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  // Validate passwords match
  if (formData.value.password !== formData.value.confirmPassword) {
    errorMessage.value = 'Passwords do not match'
    return
  }

  // Validate password length
  if (formData.value.password.length < 6) {
    errorMessage.value = 'Password must be at least 6 characters'
    return
  }

  submitting.value = true

  try {
    const response = await fetch(`${API_URL}/api/invitations/accept/${token.value}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        password: formData.value.password
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to accept invitation')
    }

    successMessage.value = 'Account created successfully! Redirecting to login...'

    setTimeout(() => {
      router.push('/login')
    }, 2000)
  } catch (error: any) {
    errorMessage.value = error.message || 'Failed to accept invitation'
  } finally {
    submitting.value = false
  }
}
</script>

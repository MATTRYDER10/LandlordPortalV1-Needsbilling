<template>
  <div>
    <!-- Header -->
    <div class="mb-8">
      <h2 class="text-2xl font-bold text-gray-900 mb-2">Your Personal Information</h2>
      <p class="text-gray-600">Let's start with your contact details</p>
    </div>

    <!-- Form -->
    <form @submit.prevent="handleSubmit" class="space-y-6">
      <!-- Email (Read-only) -->
      <div>
        <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
          Email Address
        </label>
        <input
          id="email"
          v-model="formData.email"
          type="email"
          disabled
          class="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed text-gray-700"
        />
        <p class="mt-1 text-sm text-gray-500">This is your login email and cannot be changed</p>
      </div>

      <!-- Full Name (Required) -->
      <div>
        <label for="fullName" class="block text-sm font-medium text-gray-700 mb-2">
          Full Name <span class="text-red-500">*</span>
        </label>
        <input
          id="fullName"
          v-model="formData.fullName"
          type="text"
          required
          placeholder="e.g., John Smith"
          class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          :class="{ 'border-red-500': errors.fullName }"
        />
        <p v-if="errors.fullName" class="mt-1 text-sm text-red-600">{{ errors.fullName }}</p>
      </div>

      <!-- Phone Number (Optional) -->
      <div>
        <label for="phone" class="block text-sm font-medium text-gray-700 mb-2">
          Phone Number
        </label>
        <input
          id="phone"
          v-model="formData.phone"
          type="tel"
          placeholder="e.g., 07123 456789"
          class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          :class="{ 'border-red-500': errors.phone }"
        />
        <p v-if="errors.phone" class="mt-1 text-sm text-red-600">{{ errors.phone }}</p>
        <p v-else class="mt-1 text-sm text-gray-500">Optional - for important account notifications</p>
      </div>

      <!-- Error Message -->
      <div v-if="errorMessage" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
        {{ errorMessage }}
      </div>

      <!-- Success Message -->
      <div v-if="successMessage" class="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg">
        {{ successMessage }}
      </div>

      <!-- Navigation Buttons -->
      <div class="flex items-center justify-between pt-4">
        <button
          type="button"
          @click="$emit('back')"
          class="px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
        >
          Back
        </button>

        <button
          type="submit"
          :disabled="loading"
          class="px-8 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="loading">Saving...</span>
          <span v-else>Continue</span>
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const authStore = useAuthStore()

const emit = defineEmits<{
  next: []
  back: []
}>()

interface FormData {
  email: string
  fullName: string
  phone: string
}

const formData = ref<FormData>({
  email: '',
  fullName: '',
  phone: ''
})

const errors = ref<Partial<Record<keyof FormData, string>>>({})
const errorMessage = ref('')
const successMessage = ref('')
const loading = ref(false)

// Load existing profile data
onMounted(async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) {
      errorMessage.value = 'Not authenticated'
      return
    }

    const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    formData.value = {
      email: response.data.email || '',
      fullName: response.data.fullName || '',
      phone: response.data.phone || ''
    }
  } catch (error: any) {
    console.error('Error loading profile:', error)
    errorMessage.value = 'Failed to load profile data'
  }
})

const validateForm = (): boolean => {
  errors.value = {}
  let isValid = true

  // Full name is required
  if (!formData.value.fullName || formData.value.fullName.trim().length === 0) {
    errors.value.fullName = 'Full name is required'
    isValid = false
  }

  // Phone validation (optional but must be valid if provided)
  if (formData.value.phone && formData.value.phone.trim().length > 0) {
    const phoneRegex = /^[\d\s\+\-\(\)]+$/
    if (!phoneRegex.test(formData.value.phone)) {
      errors.value.phone = 'Please enter a valid phone number'
      isValid = false
    }
  }

  return isValid
}

const handleSubmit = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!validateForm()) {
    return
  }

  loading.value = true

  try {
    const token = authStore.session?.access_token
    if (!token) {
      errorMessage.value = 'Not authenticated'
      loading.value = false
      return
    }

    await axios.put(
      `${import.meta.env.VITE_API_URL}/api/profile`,
      {
        fullName: formData.value.fullName.trim(),
        phone: formData.value.phone.trim()
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )

    successMessage.value = 'Profile updated successfully!'

    // Wait a moment to show success message
    setTimeout(() => {
      emit('next')
    }, 500)
  } catch (error: any) {
    console.error('Error updating profile:', error)
    errorMessage.value = error.response?.data?.error || 'Failed to update profile. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

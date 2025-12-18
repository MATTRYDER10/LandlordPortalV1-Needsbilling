<template>
  <div class="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-8">
        <div class="flex justify-center items-center gap-3 mb-4">
          <img src="/PropertyGooseLogo.png" alt="PropertyGoose" class="h-12" />
        </div>
        <h1 class="text-3xl font-bold text-gray-900">Add Guarantor Details</h1>
        <p class="mt-2 text-gray-600">Provide your guarantor's contact information</p>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="bg-white rounded-lg shadow p-8 text-center">
        <div class="text-gray-600">Loading...</div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-lg">
        {{ error }}
      </div>

      <!-- Success State -->
      <div v-else-if="submitted" class="bg-white rounded-lg shadow p-8 text-center">
        <svg class="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 class="mt-4 text-lg font-semibold text-gray-900">Thank You!</h3>
        <p class="mt-2 text-gray-600">
          Your guarantor's details have been submitted successfully. They will receive an email shortly with a link to complete their reference form.
        </p>
      </div>

      <!-- Form -->
      <div v-else-if="referenceDetails" class="space-y-6">
        <!-- Context Info -->
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p class="text-sm text-gray-700">
            Hi <strong>{{ referenceDetails.tenantName }}</strong>, your reference for
            <strong>{{ referenceDetails.propertyAddress }}</strong> has been completed and requires a guarantor.
            Please provide your guarantor's contact details below.
          </p>
        </div>

        <!-- Guarantor Info Box -->
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 class="text-sm font-semibold text-amber-900 mb-2">What is a Guarantor?</h4>
          <p class="text-sm text-amber-800">
            A guarantor is someone who agrees to pay your rent and cover any damages if you are unable to do so.
            This is usually a parent, close relative, or trusted friend who has a stable income.
          </p>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Guarantor Contact Details</h2>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">First Name *</label>
              <input
                v-model="formData.guarantor_first_name"
                type="text"
                required
                class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                placeholder="Enter first name"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Last Name *</label>
              <input
                v-model="formData.guarantor_last_name"
                type="text"
                required
                class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                placeholder="Enter last name"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Email Address *</label>
            <input
              v-model="formData.guarantor_email"
              type="email"
              required
              class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              placeholder="guarantor@example.com"
            />
            <p class="mt-1 text-xs text-gray-500">Your guarantor will receive an email with a link to complete their reference form</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Phone Number</label>
            <input
              v-model="formData.guarantor_phone"
              type="tel"
              class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              placeholder="07XXX XXXXXX"
            />
            <p class="mt-1 text-xs text-gray-500">Optional - SMS reminders may be sent</p>
          </div>

          <!-- Submit Error -->
          <div v-if="submitError" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
            {{ submitError }}
          </div>

          <!-- Submit Button -->
          <div class="pt-4">
            <button
              type="submit"
              :disabled="submitting"
              class="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg v-if="submitting" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ submitting ? 'Submitting...' : 'Submit Guarantor Details' }}
            </button>
          </div>
        </form>

        <!-- Agent Contact -->
        <div class="text-center text-sm text-gray-500">
          <p>Questions? Contact <strong>{{ referenceDetails.agentName }}</strong> for assistance.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'

const route = useRoute()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// State
const loading = ref(true)
const error = ref<string | null>(null)
const submitted = ref(false)
const submitting = ref(false)
const submitError = ref<string | null>(null)

const referenceDetails = ref<{
  tenantName: string
  propertyAddress: string
  agentName: string
} | null>(null)

const formData = ref({
  guarantor_first_name: '',
  guarantor_last_name: '',
  guarantor_email: '',
  guarantor_phone: ''
})

// Load reference details on mount
onMounted(async () => {
  const token = route.params.token as string

  if (!token) {
    error.value = 'Invalid link. Please check your email for the correct link.'
    loading.value = false
    return
  }

  try {
    const response = await axios.get(`${API_URL}/api/references/tenant-add-guarantor/${token}`)
    referenceDetails.value = response.data
  } catch (err: any) {
    if (err.response?.status === 404) {
      error.value = 'Invalid or expired link. Please contact your letting agent for a new link.'
    } else if (err.response?.status === 410) {
      error.value = err.response.data?.error || 'This link has expired. Please contact your letting agent for a new link.'
    } else if (err.response?.status === 400) {
      error.value = err.response.data?.error || 'A guarantor has already been added for this reference.'
    } else {
      error.value = 'An error occurred. Please try again or contact your letting agent.'
    }
  } finally {
    loading.value = false
  }
})

// Handle form submission
async function handleSubmit() {
  const token = route.params.token as string
  submitError.value = null
  submitting.value = true

  try {
    await axios.post(`${API_URL}/api/references/tenant-add-guarantor/${token}`, formData.value)
    submitted.value = true
  } catch (err: any) {
    if (err.response?.status === 400) {
      submitError.value = err.response.data?.error || 'Please check your input and try again.'
    } else if (err.response?.status === 402) {
      submitError.value = err.response.data?.message || 'Unable to process at this time. Please contact your letting agent.'
    } else if (err.response?.status === 410) {
      submitError.value = err.response.data?.error || 'This link has expired. Please contact your letting agent.'
    } else {
      submitError.value = 'An error occurred. Please try again.'
    }
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.bg-primary {
  background-color: var(--color-primary);
}
.bg-primary-dark:hover {
  background-color: #ea580c;
}
.text-primary {
  color: var(--color-primary);
}
.focus\:ring-primary:focus {
  --tw-ring-color: var(--color-primary);
}
.focus\:border-primary:focus {
  border-color: var(--color-primary);
}
</style>

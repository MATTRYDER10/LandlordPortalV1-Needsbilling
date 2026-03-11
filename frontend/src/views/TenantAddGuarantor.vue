<template>
  <div class="min-h-screen bg-gray-50 dark:bg-slate-800 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-8">
        <div class="flex justify-center items-center gap-3 mb-4">
          <img src="/PropertyGooseLogo.png" alt="PropertyGoose" class="h-12 dark:hidden" />
          <img src="/PropertyGooseLogoDark.png" alt="PropertyGoose" class="h-12 hidden dark:block" />
        </div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Add Guarantor Details</h1>
        <p class="mt-2 text-gray-600 dark:text-slate-400">Provide your guarantor's contact information</p>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="bg-white dark:bg-slate-800 rounded-lg shadow p-8 text-center">
        <div class="text-gray-600 dark:text-slate-400">Loading...</div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-6 py-4 rounded-lg">
        {{ error }}
      </div>

      <!-- Success State -->
      <div v-else-if="submitted" class="bg-white dark:bg-slate-800 rounded-lg shadow p-8 text-center">
        <CheckCircle2 class="mx-auto h-12 w-12 text-green-500" />
        <h3 class="mt-4 text-lg font-semibold text-gray-900 dark:text-white">Thank You!</h3>
        <p class="mt-2 text-gray-600 dark:text-slate-400">
          Your guarantor's details have been submitted successfully. They will receive an email shortly with a link to complete their reference form.
        </p>
      </div>

      <!-- Form -->
      <div v-else-if="referenceDetails" class="space-y-6">
        <!-- Context Info -->
        <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p class="text-sm text-gray-700 dark:text-slate-300">
            Hi <strong>{{ referenceDetails.tenantName }}</strong>, your reference for
            <strong>{{ referenceDetails.propertyAddress }}</strong> has been completed and requires a guarantor.
            Please provide your guarantor's contact details below.
          </p>
        </div>

        <!-- Guarantor Info Box -->
        <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <h4 class="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-2">What is a Guarantor?</h4>
          <p class="text-sm text-amber-800 dark:text-amber-400">
            A guarantor is someone who agrees to pay your rent and cover any damages if you are unable to do so.
            This is usually a parent, close relative, or trusted friend who has a stable income.
          </p>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-4">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Guarantor Contact Details</h2>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">First Name *</label>
              <input
                v-model="formData.guarantor_first_name"
                type="text"
                required
                class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
                placeholder="Enter first name"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Last Name *</label>
              <input
                v-model="formData.guarantor_last_name"
                type="text"
                required
                class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
                placeholder="Enter last name"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Email Address *</label>
            <input
              v-model="formData.guarantor_email"
              type="email"
              required
              class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
              placeholder="guarantor@example.com"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">Your guarantor will receive an email with a link to complete their reference form</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Phone Number</label>
            <input
              v-model="formData.guarantor_phone"
              type="tel"
              class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
              placeholder="07XXX XXXXXX"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">Optional - SMS reminders may be sent</p>
          </div>

          <!-- Submit Error -->
          <div v-if="submitError" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
            {{ submitError }}
          </div>

          <!-- Submit Button -->
          <div class="pt-4">
            <button
              type="submit"
              :disabled="submitting"
              class="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Loader2 v-if="submitting" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
              {{ submitting ? 'Submitting...' : 'Submit Guarantor Details' }}
            </button>
          </div>
        </form>

        <!-- Agent Contact -->
        <div class="text-center text-sm text-gray-500 dark:text-slate-400">
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
import { CheckCircle2, Loader2 } from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const route = useRoute()
const LEGACY_LINK_MESSAGE = "This link has expired. We've sent a new one."
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isUuid = (value: string) => UUID_REGEX.test(value)

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
const handleLegacyToken = async (token: string) => {
  if (isUuid(token)) {
    return false
  }

  try {
    await axios.post(`${API_URL}/api/references/legacy-link`, {
      type: 'tenant-add-guarantor',
      token
    })
  } catch (err) {
    console.error('Legacy add-guarantor link resend failed:', err)
  }

  error.value = LEGACY_LINK_MESSAGE
  loading.value = false
  return true
}

onMounted(async () => {
  const token = route.params.token as string

  if (!token) {
    error.value = 'Invalid link. Please check your email for the correct link.'
    loading.value = false
    return
  }

  if (await handleLegacyToken(token)) {
    return
  }

  try {
    const response = await axios.get(`${API_URL}/api/references/tenant-add-guarantor/${token}`)
    referenceDetails.value = response.data
  } catch (err: any) {
    // Handle 410 (expired link) response
    if (err.response?.status === 410) {
      await handleLegacyToken(token)
      return
    }

    if (err.response?.status === 404) {
      error.value = 'Invalid link. Please contact the agent for a new link.'
    } else if (err.response?.status === 400) {
      error.value = err.response.data?.error || 'A guarantor has already been added for this reference.'
    } else {
      error.value = 'An error occurred. Please try again or contact the agent.'
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
      submitError.value = err.response.data?.message || 'Unable to process at this time. Please contact the agent.'
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

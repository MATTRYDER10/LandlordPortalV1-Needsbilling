<template>
  <div class="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-3xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900">Tenant Reference Form</h1>
        <p class="mt-2 text-gray-600">Please complete all sections to submit your reference</p>
      </div>

      <!-- Loading State -->
      <div v-if="initialLoading" class="bg-white rounded-lg shadow p-8 text-center">
        <div class="text-gray-600">Loading reference details...</div>
      </div>

      <!-- Error State -->
      <div v-else-if="tokenError" class="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-lg">
        {{ tokenError }}
      </div>

      <!-- Success/Already Submitted -->
      <div v-else-if="reference && reference.submitted_at" class="bg-white rounded-lg shadow p-8 text-center">
        <svg class="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 class="mt-4 text-lg font-semibold text-gray-900">{{ justSubmitted ? 'Thank You!' : 'Reference Already Submitted' }}</h3>
        <p class="mt-2 text-gray-600">{{ justSubmitted ? 'Your reference has been submitted successfully. We appreciate you taking the time to complete this form.' : 'You have already submitted this reference. Thank you!' }}</p>
      </div>

      <!-- Form -->
      <form v-else-if="reference" @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Property Information (Read Only) -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Property Information</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">Your Name</label>
              <p class="mt-1 text-gray-900">{{ reference.tenant_first_name }} {{ reference.tenant_last_name }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Email</label>
              <p class="mt-1 text-gray-900">{{ reference.tenant_email }}</p>
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-700">Property Address</label>
              <p class="mt-1 text-gray-900">{{ reference.property_address }}</p>
            </div>
          </div>
        </div>

        <!-- Employment Information -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Employment Information</h2>
          <div class="space-y-4">
            <div>
              <label for="employment-status" class="block text-sm font-medium text-gray-700">Employment Status *</label>
              <select
                id="employment-status"
                v-model="formData.employment_status"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select status</option>
                <option value="Employed">Employed</option>
                <option value="Self-Employed">Self-Employed</option>
                <option value="Student">Student</option>
                <option value="Unemployed">Unemployed</option>
                <option value="Retired">Retired</option>
              </select>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="employer-name" class="block text-sm font-medium text-gray-700">Employer Name</label>
                <input
                  id="employer-name"
                  v-model="formData.employer_name"
                  type="text"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label for="job-title" class="block text-sm font-medium text-gray-700">Job Title</label>
                <input
                  id="job-title"
                  v-model="formData.job_title"
                  type="text"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="annual-income" class="block text-sm font-medium text-gray-700">Annual Income (£)</label>
                <input
                  id="annual-income"
                  v-model="formData.annual_income"
                  type="number"
                  step="0.01"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label for="employment-start-date" class="block text-sm font-medium text-gray-700">Employment Start Date</label>
                <input
                  id="employment-start-date"
                  v-model="formData.employment_start_date"
                  type="date"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label for="employer-contact" class="block text-sm font-medium text-gray-700">Employer Contact (Email or Phone)</label>
              <input
                id="employer-contact"
                v-model="formData.employer_contact"
                type="text"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <!-- Previous Landlord Information -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Previous Landlord Information</h2>
          <div class="space-y-4">
            <div>
              <label for="landlord-name" class="block text-sm font-medium text-gray-700">Previous Landlord Name</label>
              <input
                id="landlord-name"
                v-model="formData.previous_landlord_name"
                type="text"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="landlord-email" class="block text-sm font-medium text-gray-700">Landlord Email</label>
                <input
                  id="landlord-email"
                  v-model="formData.previous_landlord_email"
                  type="email"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label for="landlord-phone" class="block text-sm font-medium text-gray-700">Landlord Phone</label>
                <input
                  id="landlord-phone"
                  v-model="formData.previous_landlord_phone"
                  type="tel"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label for="previous-address" class="block text-sm font-medium text-gray-700">Previous Address</label>
              <input
                id="previous-address"
                v-model="formData.previous_address"
                type="text"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label for="tenancy-duration" class="block text-sm font-medium text-gray-700">How long did you live there?</label>
              <input
                id="tenancy-duration"
                v-model="formData.previous_tenancy_duration"
                type="text"
                placeholder="e.g., 2 years, 6 months"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <!-- Error/Success Messages -->
        <div v-if="submitError" class="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-lg">
          {{ submitError }}
        </div>

        <div v-if="submitSuccess" class="bg-green-50 border border-green-200 text-green-600 px-6 py-4 rounded-lg">
          {{ submitSuccess }}
        </div>

        <!-- Submit Button -->
        <div class="bg-white rounded-lg shadow p-6">
          <button
            type="submit"
            :disabled="submitting"
            class="w-full px-6 py-3 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ submitting ? 'Submitting...' : 'Submit Reference' }}
          </button>
          <p class="mt-3 text-sm text-gray-500 text-center">
            By submitting this form, you consent to your information being used for reference purposes.
          </p>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const reference = ref<any>(null)
const initialLoading = ref(true)
const tokenError = ref('')
const submitting = ref(false)
const submitError = ref('')
const submitSuccess = ref('')
const justSubmitted = ref(false)

const formData = ref({
  employment_status: '',
  employer_name: '',
  employer_contact: '',
  job_title: '',
  annual_income: null,
  employment_start_date: '',
  previous_landlord_name: '',
  previous_landlord_email: '',
  previous_landlord_phone: '',
  previous_address: '',
  previous_tenancy_duration: ''
})

onMounted(() => {
  fetchReferenceByToken()
})

const fetchReferenceByToken = async () => {
  try {
    const token = route.params.token
    const response = await fetch(`${API_URL}/api/references/view/${token}`, {
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      if (response.status === 404) {
        tokenError.value = 'Reference not found or link has expired.'
      } else {
        tokenError.value = 'Failed to load reference details.'
      }
      return
    }

    const data = await response.json()
    reference.value = data.reference
  } catch (error) {
    tokenError.value = 'An error occurred while loading the reference.'
  } finally {
    initialLoading.value = false
  }
}

const handleSubmit = async () => {
  submitting.value = true
  submitError.value = ''
  submitSuccess.value = ''

  try {
    const token = route.params.token
    const response = await fetch(`${API_URL}/api/references/submit/${token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData.value)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to submit reference')
    }

    submitSuccess.value = 'Reference submitted successfully! Thank you for completing the form.'
    justSubmitted.value = true

    // Refresh the reference data to show submitted state
    setTimeout(() => {
      fetchReferenceByToken()
    }, 2000)
  } catch (error: any) {
    submitError.value = error.message || 'Failed to submit reference'
  } finally {
    submitting.value = false
  }
}
</script>

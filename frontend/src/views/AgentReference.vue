<template>
  <div class="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-3xl mx-auto">
      <!-- Header -->
      <div v-if="brandingLoaded" class="text-center mb-8">
        <div class="flex justify-center items-center gap-3 mb-4">
          <template v-if="companyLogo">
            <img :src="companyLogo" alt="Company Logo" class="h-20 object-contain" />
          </template>
          <template v-else>
            <img src="/PropertyGooseIcon.webp" alt="PropertyGoose" class="h-12 w-12" />
            <span class="text-2xl font-bold">
              <span class="text-gray-900">Property</span><span :style="{ color: primaryColor }">Goose</span>
            </span>
          </template>
        </div>
        <h1 class="text-3xl font-bold" :style="{ color: primaryColor }">Letting Agent Reference Form</h1>
        <p class="mt-2 text-gray-600">Please provide a reference for your previous/current tenant</p>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="bg-white rounded-lg shadow p-8 text-center">
        <div class="text-gray-600">Loading...</div>
      </div>

      <!-- Success State -->
      <div v-else-if="submitted" class="bg-white rounded-lg shadow p-8 text-center">
        <svg class="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 class="mt-4 text-lg font-semibold text-gray-900">Thank You!</h3>
        <p class="mt-2 text-gray-600">Your agent reference has been submitted successfully.</p>
      </div>

      <!-- Form -->
      <form v-else @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Agent Information -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Agent Information</h2>
          <div class="space-y-4">
            <div>
              <label for="agent-name" class="block text-sm font-medium text-gray-700">Agent's Full Name *</label>
              <input
                id="agent-name"
                v-model="formData.agentName"
                type="text"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label for="agency-name" class="block text-sm font-medium text-gray-700">Agency/Company Name *</label>
              <input
                id="agency-name"
                v-model="formData.agencyName"
                type="text"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="agent-email" class="block text-sm font-medium text-gray-700">Email Address *</label>
                <input
                  id="agent-email"
                  v-model="formData.agentEmail"
                  type="email"
                  required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <PhoneInput
                v-model="formData.agentPhone"
                label="Phone Number"
                id="agent-phone"
                :required="true"
                select-class="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                input-class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <!-- Property & Tenancy Information -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Property & Tenancy Information</h2>
          <div class="space-y-4">
            <div>
              <label for="property-address" class="block text-sm font-medium text-gray-700">Street Address *</label>
              <input
                id="property-address"
                v-model="formData.propertyAddress"
                type="text"
                required
                placeholder="e.g. 123 Main Street"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="property-city" class="block text-sm font-medium text-gray-700">City *</label>
                <input
                  id="property-city"
                  v-model="formData.propertyCity"
                  type="text"
                  required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label for="property-postcode" class="block text-sm font-medium text-gray-700">Postcode *</label>
                <input
                  id="property-postcode"
                  v-model="formData.propertyPostcode"
                  type="text"
                  required
                  placeholder="e.g. SW1A 1AA"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <DatePicker
              v-model="formData.tenancyStartDate"
              label="Tenancy Start Date"
              :required="true"
              year-range-type="tenancy"
              select-class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />

            <DatePicker
              v-model="formData.tenancyEndDate"
              label="Tenancy End Date"
              :required="true"
              year-range-type="tenancy"
              select-class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />

            <div>
              <label for="monthly-rent" class="block text-sm font-medium text-gray-700">Monthly Rent (£) *</label>
              <input
                id="monthly-rent"
                v-model="formData.monthlyRent"
                type="number"
                step="0.01"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <!-- Reference Questions -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Reference Questions</h2>
          <div class="space-y-4">
            <div>
              <label for="rent-paid-on-time" class="block text-sm font-medium text-gray-700">Was rent paid on time? *</label>
              <select
                id="rent-paid-on-time"
                v-model="formData.rentPaidOnTime"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select an option</option>
                <option value="always">Always</option>
                <option value="usually">Usually</option>
                <option value="sometimes">Sometimes</option>
                <option value="rarely">Rarely</option>
                <option value="never">Never</option>
              </select>
            </div>

            <div v-if="formData.rentPaidOnTime && formData.rentPaidOnTime !== 'always'">
              <label for="rent-details" class="block text-sm font-medium text-gray-700">Please provide details</label>
              <textarea
                id="rent-details"
                v-model="formData.rentPaidOnTimeDetails"
                rows="3"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
            </div>

            <div>
              <label for="property-condition" class="block text-sm font-medium text-gray-700">How was the property maintained? *</label>
              <select
                id="property-condition"
                v-model="formData.propertyCondition"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select an option</option>
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="satisfactory">Satisfactory</option>
                <option value="poor">Poor</option>
              </select>
            </div>

            <div v-if="formData.propertyCondition">
              <label for="condition-details" class="block text-sm font-medium text-gray-700">Please provide details</label>
              <textarea
                id="condition-details"
                v-model="formData.propertyConditionDetails"
                rows="3"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
            </div>

            <div>
              <label for="neighbour-complaints" class="block text-sm font-medium text-gray-700">Were there any complaints from neighbours? *</label>
              <select
                id="neighbour-complaints"
                v-model="formData.neighbourComplaints"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select an option</option>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>

            <div v-if="formData.neighbourComplaints === 'yes'">
              <label for="complaint-details" class="block text-sm font-medium text-gray-700">Please provide details *</label>
              <textarea
                id="complaint-details"
                v-model="formData.neighbourComplaintsDetails"
                rows="3"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
            </div>

            <div>
              <label for="breach-tenancy" class="block text-sm font-medium text-gray-700">Were there any breaches of the tenancy agreement? *</label>
              <select
                id="breach-tenancy"
                v-model="formData.breachOfTenancy"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select an option</option>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>

            <div v-if="formData.breachOfTenancy === 'yes'">
              <label for="breach-details" class="block text-sm font-medium text-gray-700">Please provide details *</label>
              <textarea
                id="breach-details"
                v-model="formData.breachOfTenancyDetails"
                rows="3"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
            </div>

            <div>
              <label for="would-rent-again" class="block text-sm font-medium text-gray-700">Would you rent to this tenant again? *</label>
              <select
                id="would-rent-again"
                v-model="formData.wouldRentAgain"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select an option</option>
                <option value="yes">Yes, definitely</option>
                <option value="probably">Probably</option>
                <option value="unsure">Unsure</option>
                <option value="probably-not">Probably not</option>
                <option value="no">No</option>
              </select>
            </div>

            <div v-if="formData.wouldRentAgain">
              <label for="rent-again-details" class="block text-sm font-medium text-gray-700">Please explain your answer</label>
              <textarea
                id="rent-again-details"
                v-model="formData.wouldRentAgainDetails"
                rows="3"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
            </div>

            <div>
              <label for="additional-comments" class="block text-sm font-medium text-gray-700">Additional Comments</label>
              <textarea
                id="additional-comments"
                v-model="formData.additionalComments"
                rows="4"
                placeholder="Please provide any additional information that may be relevant to this reference"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
            </div>
          </div>
        </div>

        <!-- Declaration -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Declaration</h2>
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p class="text-sm text-gray-700">
              I declare that the information provided in this reference is true and accurate to the best of my knowledge.
              I understand that this information will be used to assess the tenant's suitability for a tenancy.
            </p>
          </div>

          <div class="space-y-4">
            <div>
              <label for="signature-name" class="block text-sm font-medium text-gray-700">Full Name *</label>
              <input
                id="signature-name"
                v-model="formData.signatureName"
                type="text"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <SignaturePad
              v-model="formData.signature"
              label="Signature"
            />

            <DatePicker
              v-model="formData.date"
              label="Date"
              :required="true"
              year-range-type="current"
              select-class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="error" class="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-lg">
          {{ error }}
        </div>

        <!-- Submit Button -->
        <div class="bg-white rounded-lg shadow p-6">
          <button
            type="submit"
            :disabled="submitting"
            class="w-full px-6 py-3 text-base font-medium text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
            :style="{ backgroundColor: buttonColor }"
          >
            {{ submitting ? 'Submitting...' : 'Submit Reference' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import SignaturePad from '../components/SignaturePad.vue'
import PhoneInput from '../components/PhoneInput.vue'
import DatePicker from '../components/DatePicker.vue'

const route = useRoute()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const loading = ref(false)
const submitted = ref(false)
const submitting = ref(false)
const error = ref('')

// Company branding
const companyLogo = ref('')
const primaryColor = ref('#FF8C41')
const buttonColor = ref('#FF8C41')
const brandingLoaded = ref(false)

const formData = ref({
  agentName: '',
  agentEmail: '',
  agentPhone: '',
  agencyName: '',
  propertyAddress: '',
  propertyCity: '',
  propertyPostcode: '',
  tenancyStartDate: '',
  tenancyEndDate: '',
  monthlyRent: '',
  rentPaidOnTime: '',
  rentPaidOnTimeDetails: '',
  propertyCondition: '',
  propertyConditionDetails: '',
  neighbourComplaints: '',
  neighbourComplaintsDetails: '',
  breachOfTenancy: '',
  breachOfTenancyDetails: '',
  wouldRentAgain: '',
  wouldRentAgainDetails: '',
  additionalComments: '',
  signatureName: '',
  signature: '',
  date: new Date().toISOString().split('T')[0]
})

const handleSubmit = async () => {
  submitting.value = true
  error.value = ''

  try {
    // Validate signature
    if (!formData.value.signature) {
      error.value = 'Please provide your signature'
      submitting.value = false
      return
    }

    const referenceId = route.params.referenceId
    const response = await fetch(`${API_URL}/api/references/agent/${referenceId}`, {
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

    submitted.value = true
  } catch (err: any) {
    error.value = err.message || 'Failed to submit reference. Please try again.'
  } finally {
    submitting.value = false
  }
}

// Fetch company branding on mount
onMounted(async () => {
  try {
    const referenceId = route.params.referenceId

    // Check if reference already submitted
    const checkResponse = await fetch(`${API_URL}/api/references/agent/${referenceId}/check`)
    if (checkResponse.ok) {
      const checkData = await checkResponse.json()
      if (checkData.submitted) {
        submitted.value = true
        brandingLoaded.value = true
        return
      }
    }

    // Load branding
    const response = await fetch(`${API_URL}/api/references/branding/${referenceId}`)

    if (response.ok) {
      const data = await response.json()
      if (data.branding) {
        companyLogo.value = data.branding.logo_url || ''
        primaryColor.value = data.branding.primary_color || '#FF8C41'
        buttonColor.value = data.branding.button_color || '#FF8C41'
      }
    }
  } catch (err) {
    // Silently fail - just use defaults
    console.error('Failed to load branding:', err)
  } finally {
    brandingLoaded.value = true
  }
})
</script>

<style scoped>
/* Override focus colors with company branding */
select:focus,
input:focus,
textarea:focus,
:deep(select:focus),
:deep(input:focus),
:deep(textarea:focus) {
  --tw-ring-color: v-bind(primaryColor);
  border-color: v-bind(primaryColor) !important;
}
</style>

<template>
  <div class="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-3xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900">Landlord Reference Form</h1>
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
        <p class="mt-2 text-gray-600">Your landlord reference has been submitted successfully.</p>
      </div>

      <!-- Form -->
      <form v-else @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Landlord Information -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Landlord Information</h2>
          <div class="space-y-4">
            <div>
              <label for="landlord-name" class="block text-sm font-medium text-gray-700">Full Name *</label>
              <input
                id="landlord-name"
                v-model="formData.landlordName"
                type="text"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="landlord-email" class="block text-sm font-medium text-gray-700">Email Address *</label>
                <input
                  id="landlord-email"
                  v-model="formData.landlordEmail"
                  type="email"
                  required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label for="landlord-phone" class="block text-sm font-medium text-gray-700">Phone Number *</label>
                <input
                  id="landlord-phone"
                  v-model="formData.landlordPhone"
                  type="tel"
                  required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
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

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="tenancy-start" class="block text-sm font-medium text-gray-700">Tenancy Start Date *</label>
                <input
                  id="tenancy-start"
                  v-model="formData.tenancyStartDate"
                  type="date"
                  required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label for="tenancy-end" class="block text-sm font-medium text-gray-700">Tenancy End Date *</label>
                <input
                  id="tenancy-end"
                  v-model="formData.tenancyEndDate"
                  type="date"
                  required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

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
              <label for="signature" class="block text-sm font-medium text-gray-700">Full Name (Electronic Signature) *</label>
              <input
                id="signature"
                v-model="formData.signature"
                type="text"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label for="date" class="block text-sm font-medium text-gray-700">Date *</label>
              <input
                id="date"
                v-model="formData.date"
                type="date"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
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
            class="w-full px-6 py-3 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
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

const route = useRoute()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const loading = ref(false)
const submitted = ref(false)
const submitting = ref(false)
const error = ref('')

const formData = ref({
  landlordName: '',
  landlordEmail: '',
  landlordPhone: '',
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
  signature: '',
  date: new Date().toISOString().split('T')[0]
})

const handleSubmit = async () => {
  submitting.value = true
  error.value = ''

  try {
    const referenceId = route.params.referenceId
    const response = await fetch(`${API_URL}/api/references/landlord/${referenceId}`, {
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
</script>

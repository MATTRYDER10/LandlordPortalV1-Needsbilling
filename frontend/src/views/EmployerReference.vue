<template>
  <div class="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-3xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900">Employer Reference Form</h1>
        <p class="mt-2 text-gray-600">Please provide an employment reference for your employee/former employee</p>
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
        <p class="mt-2 text-gray-600">Your employer reference has been submitted successfully.</p>
      </div>

      <!-- Form -->
      <form v-else @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Employer/Company Information -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Employer/Company Information</h2>
          <div class="space-y-4">
            <div>
              <label for="company-name" class="block text-sm font-medium text-gray-700">Company Name *</label>
              <input
                id="company-name"
                v-model="formData.companyName"
                type="text"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label for="employer-name" class="block text-sm font-medium text-gray-700">Your Full Name *</label>
              <input
                id="employer-name"
                v-model="formData.employerName"
                type="text"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label for="employer-position" class="block text-sm font-medium text-gray-700">Your Position/Title *</label>
              <input
                id="employer-position"
                v-model="formData.employerPosition"
                type="text"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="employer-email" class="block text-sm font-medium text-gray-700">Your Email Address *</label>
                <input
                  id="employer-email"
                  v-model="formData.employerEmail"
                  type="email"
                  required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label for="employer-phone" class="block text-sm font-medium text-gray-700">Your Phone Number *</label>
                <input
                  id="employer-phone"
                  v-model="formData.employerPhone"
                  type="tel"
                  required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Employment Information -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Employment Information</h2>
          <div class="space-y-4">
            <div>
              <label for="employee-position" class="block text-sm font-medium text-gray-700">Employee's Position/Title *</label>
              <input
                id="employee-position"
                v-model="formData.employeePosition"
                type="text"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label for="employment-type" class="block text-sm font-medium text-gray-700">Employment Type *</label>
              <select
                id="employment-type"
                v-model="formData.employmentType"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select an option</option>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="temporary">Temporary</option>
                <option value="zero-hours">Zero Hours</option>
              </select>
            </div>

            <div class="flex items-center">
              <input
                id="is-current"
                v-model="formData.isCurrentEmployee"
                type="checkbox"
                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label for="is-current" class="ml-2 block text-sm text-gray-700">
                Currently employed
              </label>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="employment-start" class="block text-sm font-medium text-gray-700">Employment Start Date *</label>
                <input
                  id="employment-start"
                  v-model="formData.employmentStartDate"
                  type="date"
                  required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div v-if="!formData.isCurrentEmployee">
                <label for="employment-end" class="block text-sm font-medium text-gray-700">Employment End Date *</label>
                <input
                  id="employment-end"
                  v-model="formData.employmentEndDate"
                  type="date"
                  :required="!formData.isCurrentEmployee"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Salary Information -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Salary Information</h2>
          <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="salary" class="block text-sm font-medium text-gray-700">Salary (£) *</label>
                <input
                  id="salary"
                  v-model="formData.annualSalary"
                  type="number"
                  step="0.01"
                  required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label for="frequency" class="block text-sm font-medium text-gray-700">Frequency *</label>
                <select
                  id="frequency"
                  v-model="formData.salaryFrequency"
                  required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="annual">Annual</option>
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="hourly">Hourly</option>
                </select>
              </div>
            </div>

            <div>
              <label for="probation" class="block text-sm font-medium text-gray-700">Is the employee in a probationary period? *</label>
              <select
                id="probation"
                v-model="formData.isProbation"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select an option</option>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>

            <div v-if="formData.isProbation === 'yes'">
              <label for="probation-end" class="block text-sm font-medium text-gray-700">Probation End Date *</label>
              <input
                id="probation-end"
                v-model="formData.probationEndDate"
                type="date"
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
              <label for="employment-status" class="block text-sm font-medium text-gray-700">Can you confirm the employment details are accurate? *</label>
              <select
                id="employment-status"
                v-model="formData.employmentStatus"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select an option</option>
                <option value="confirmed">Yes, all details are accurate</option>
                <option value="partial">Some details need clarification</option>
                <option value="cannot-confirm">Cannot confirm</option>
              </select>
            </div>

            <div>
              <label for="performance" class="block text-sm font-medium text-gray-700">How would you rate the employee's performance? *</label>
              <select
                id="performance"
                v-model="formData.performanceRating"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select an option</option>
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="satisfactory">Satisfactory</option>
                <option value="needs-improvement">Needs Improvement</option>
                <option value="poor">Poor</option>
              </select>
            </div>

            <div v-if="formData.performanceRating">
              <label for="performance-details" class="block text-sm font-medium text-gray-700">Please provide details about their performance</label>
              <textarea
                id="performance-details"
                v-model="formData.performanceDetails"
                rows="3"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
            </div>

            <div>
              <label for="disciplinary" class="block text-sm font-medium text-gray-700">Have there been any disciplinary issues? *</label>
              <select
                id="disciplinary"
                v-model="formData.disciplinaryIssues"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select an option</option>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>

            <div v-if="formData.disciplinaryIssues === 'yes'">
              <label for="disciplinary-details" class="block text-sm font-medium text-gray-700">Please provide details *</label>
              <textarea
                id="disciplinary-details"
                v-model="formData.disciplinaryDetails"
                rows="3"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
            </div>

            <div>
              <label for="absence" class="block text-sm font-medium text-gray-700">How would you describe the employee's attendance record? *</label>
              <select
                id="absence"
                v-model="formData.absenceRecord"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select an option</option>
                <option value="excellent">Excellent - rarely absent</option>
                <option value="good">Good - occasional absence</option>
                <option value="satisfactory">Satisfactory</option>
                <option value="poor">Poor - frequent absence</option>
              </select>
            </div>

            <div v-if="formData.absenceRecord && formData.absenceRecord !== 'excellent'">
              <label for="absence-details" class="block text-sm font-medium text-gray-700">Please provide details</label>
              <textarea
                id="absence-details"
                v-model="formData.absenceDetails"
                rows="3"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
            </div>

            <div>
              <label for="reemploy" class="block text-sm font-medium text-gray-700">Would you re-employ this person? *</label>
              <select
                id="reemploy"
                v-model="formData.wouldReemploy"
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

            <div v-if="formData.wouldReemploy">
              <label for="reemploy-details" class="block text-sm font-medium text-gray-700">Please explain your answer</label>
              <textarea
                id="reemploy-details"
                v-model="formData.wouldReemployDetails"
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
              I understand that this information will be used to assess the individual's suitability for a tenancy.
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
import SignaturePad from '../components/SignaturePad.vue'

const route = useRoute()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const loading = ref(false)
const submitted = ref(false)
const submitting = ref(false)
const error = ref('')

const formData = ref({
  companyName: '',
  employerName: '',
  employerPosition: '',
  employerEmail: '',
  employerPhone: '',
  employeePosition: '',
  employmentType: '',
  employmentStartDate: '',
  employmentEndDate: '',
  isCurrentEmployee: true,
  annualSalary: '',
  salaryFrequency: 'annual',
  isProbation: '',
  probationEndDate: '',
  employmentStatus: '',
  performanceRating: '',
  performanceDetails: '',
  disciplinaryIssues: '',
  disciplinaryDetails: '',
  absenceRecord: '',
  absenceDetails: '',
  wouldReemploy: '',
  wouldReemployDetails: '',
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
    const response = await fetch(`${API_URL}/api/references/employer/${referenceId}`, {
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

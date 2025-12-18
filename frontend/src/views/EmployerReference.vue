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
            <img src="/PropertyGooseLogo.png" alt="PropertyGoose" class="h-12" />
          </template>
        </div>
        <h1 class="text-3xl font-bold" :style="{ color: primaryColor }">Employer Reference Form</h1>
        <p class="mt-2 text-gray-600">Please provide an employment reference for your employee/former employee</p>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="bg-white rounded-lg shadow p-8 text-center">
        <div class="text-gray-600">Loading...</div>
      </div>

      <!-- Success State -->
      <div v-else-if="submitted" class="bg-white rounded-lg shadow p-8 text-center">
        <CheckCircle2 class="mx-auto h-12 w-12 text-green-500" />
        <h3 class="mt-4 text-lg font-semibold text-gray-900">Thank You!</h3>
        <p class="mt-2 text-gray-600">Your employer reference has been submitted successfully.</p>
      </div>

      <!-- Form -->
      <form v-else @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Instruction Banner -->
        <div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
          <p class="text-sm text-blue-900">
            The tenant has input the below information whilst applying for a Rental property, they have named you as
            their employer, please check the information and correct where required, please ensure the form is filled
            out honestly and factually, if you cannot fill out this form please forward to your HR department to
            complete.
          </p>
        </div>

        <!-- Employee Details -->
        <div v-if="employeeName" class="text-sm text-gray-700">
          <strong>Employee:</strong> {{ employeeName }}
        </div>

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
                :class="[
                  'mt-1 block w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500',
                  fieldErrors.companyName ? 'border-red-300' : 'border-gray-300'
                ]"
              />
              <p v-if="fieldErrors.companyName" class="mt-1 text-sm text-red-600">{{ fieldErrors.companyName }}</p>
            </div>

            <div>
              <label for="employer-name" class="block text-sm font-medium text-gray-700">Your Full Name *</label>
              <input
                id="employer-name"
                v-model="formData.employerName"
                type="text"
                required
                :class="[
                  'mt-1 block w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500',
                  fieldErrors.employerName ? 'border-red-300' : 'border-gray-300'
                ]"
              />
              <p v-if="fieldErrors.employerName" class="mt-1 text-sm text-red-600">{{ fieldErrors.employerName }}</p>
            </div>

            <div>
              <label for="employer-position" class="block text-sm font-medium text-gray-700">Your Position/Title
                *</label>
              <input
                id="employer-position"
                v-model="formData.employerPosition"
                type="text"
                required
                :class="[
                  'mt-1 block w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500',
                  fieldErrors.employerPosition ? 'border-red-300' : 'border-gray-300'
                ]"
              />
              <p v-if="fieldErrors.employerPosition" class="mt-1 text-sm text-red-600">{{ fieldErrors.employerPosition }}</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="employer-email" class="block text-sm font-medium text-gray-700">Your Email Address *</label>
                <input
                  id="employer-email"
                  v-model="formData.employerEmail"
                  type="email"
                  required
                  :class="[
                    'mt-1 block w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500',
                    fieldErrors.employerEmail ? 'border-red-300' : 'border-gray-300'
                  ]"
                />
                <p v-if="fieldErrors.employerEmail" class="mt-1 text-sm text-red-600">{{ fieldErrors.employerEmail }}</p>
              </div>

              <PhoneInput v-model="formData.employerPhone" label="Your Phone Number" id="employer-phone"
                :required="true"
                select-class="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                input-class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>
        </div>

        <!-- Employment Information -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Employment Information</h2>
          <div class="space-y-4">
            <div>
              <label for="employee-position" class="block text-sm font-medium text-gray-700">Employee's Position/Title
                *</label>
              <input
                id="employee-position"
                v-model="formData.employeePosition"
                type="text"
                required
                :class="[
                  'mt-1 block w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500',
                  fieldErrors.employeePosition ? 'border-red-300' : 'border-gray-300'
                ]"
              />
              <p v-if="fieldErrors.employeePosition" class="mt-1 text-sm text-red-600">{{ fieldErrors.employeePosition }}</p>
            </div>

            <div>
              <label for="employment-type" class="block text-sm font-medium text-gray-700">Employment Type *</label>
              <select
                id="employment-type"
                v-model="formData.employmentType"
                required
                :class="[
                  'mt-1 block w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500',
                  fieldErrors.employmentType ? 'border-red-300' : 'border-gray-300'
                ]"
              >
                <option value="">Select an option</option>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="temporary">Temporary</option>
                <option value="zero-hours">Zero Hours</option>
              </select>
              <p v-if="fieldErrors.employmentType" class="mt-1 text-sm text-red-600">{{ fieldErrors.employmentType }}</p>
            </div>

            <div class="flex items-center">
              <input id="is-current" v-model="formData.isCurrentEmployee" type="checkbox"
                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
              <label for="is-current" class="ml-2 block text-sm text-gray-700">
                Currently employed
              </label>
            </div>

            <DatePicker v-model="formData.employmentStartDate" label="Employment Start Date" :required="true"
              year-range-type="employment"
              select-class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />

            <DatePicker v-if="!formData.isCurrentEmployee" v-model="formData.employmentEndDate"
              label="Employment End Date" :required="!formData.isCurrentEmployee" year-range-type="employment"
              select-class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
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
                  :class="[
                    'mt-1 block w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500',
                    fieldErrors.annualSalary ? 'border-red-300' : 'border-gray-300'
                  ]"
                />
                <p v-if="fieldErrors.annualSalary" class="mt-1 text-sm text-red-600">{{ fieldErrors.annualSalary }}</p>
              </div>

              <div>
                <label for="frequency" class="block text-sm font-medium text-gray-700">Pay Frequency *</label>
                <select
                  id="frequency"
                  v-model="formData.salaryFrequency"
                  required
                  :class="[
                    'mt-1 block w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500',
                    fieldErrors.salaryFrequency ? 'border-red-300' : 'border-gray-300'
                  ]"
                >
                  <option value="annual">Annual</option>
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="hourly">Hourly</option>
                </select>
                <p v-if="fieldErrors.salaryFrequency" class="mt-1 text-sm text-red-600">{{ fieldErrors.salaryFrequency }}</p>
              </div>
            </div>

            <div>
              <label for="probation" class="block text-sm font-medium text-gray-700">Is the employee in a probationary
                period? *</label>
              <select
                id="probation"
                v-model="formData.isProbation"
                required
                :class="[
                  'mt-1 block w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500',
                  fieldErrors.isProbation ? 'border-red-300' : 'border-gray-300'
                ]"
              >
                <option value="">Select an option</option>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
              <p v-if="fieldErrors.isProbation" class="mt-1 text-sm text-red-600">{{ fieldErrors.isProbation }}</p>
            </div>

            <DatePicker v-if="formData.isProbation === 'yes'" v-model="formData.probationEndDate"
              label="Probation End Date" :required="true" year-range-type="future"
              select-class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
          </div>
        </div>

        <!-- Reference Questions -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Employment Confirmation</h2>
          <div class="space-y-4">
            <div>
              <label for="employment-status" class="block text-sm font-medium text-gray-700">Can you confirm the
                employment details above are accurate? *</label>
              <select
                id="employment-status"
                v-model="formData.employmentStatus"
                required
                :class="[
                  'mt-1 block w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500',
                  fieldErrors.employmentStatus ? 'border-red-300' : 'border-gray-300'
                ]"
              >
                <option value="">Select an option</option>
                <option value="confirmed">All details were correct</option>
                <option value="partial">I've had to change a few details</option>
                <option value="cannot-confirm">I cannot confirm / I am the incorrect person</option>
              </select>
              <p v-if="fieldErrors.employmentStatus" class="mt-1 text-sm text-red-600">{{ fieldErrors.employmentStatus }}</p>
            </div>

            <div v-if="formData.employmentStatus === 'partial' || formData.employmentStatus === 'cannot-confirm'">
              <label for="clarification-details" class="block text-sm font-medium text-gray-700">Please provide
                clarification *</label>
              <textarea
                id="clarification-details"
                v-model="formData.clarificationDetails"
                rows="3"
                required
                :class="[
                  'mt-1 block w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500',
                  fieldErrors.clarificationDetails ? 'border-red-300' : 'border-gray-300'
                ]"
                placeholder="Please explain which details need clarification or cannot be confirmed"
              ></textarea>
              <p v-if="fieldErrors.clarificationDetails" class="mt-1 text-sm text-red-600">
                {{ fieldErrors.clarificationDetails }}
              </p>
            </div>

            <div>
              <label for="contract-type-confirmation" class="block text-sm font-medium text-gray-700">Can you confirm
                the contract type? *</label>
              <select
                id="contract-type-confirmation"
                v-model="formData.contractTypeConfirmation"
                required
                :class="[
                  'mt-1 block w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500',
                  fieldErrors.contractTypeConfirmation ? 'border-red-300' : 'border-gray-300'
                ]"
              >
                <option value="">Select an option</option>
                <option value="permanent">Permanent</option>
                <option value="fixed-term">Fixed-term contract</option>
                <option value="temporary">Temporary</option>
                <option value="zero-hours">Zero hours</option>
              </select>
              <p v-if="fieldErrors.contractTypeConfirmation" class="mt-1 text-sm text-red-600">
                {{ fieldErrors.contractTypeConfirmation }}
              </p>
            </div>

            <div>
              <label for="employment-stable" class="block text-sm font-medium text-gray-700">Is the employee's position
                secure? *</label>
              <select
                id="employment-stable"
                v-model="formData.employmentStable"
                required
                :class="[
                  'mt-1 block w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500',
                  fieldErrors.employmentStable ? 'border-red-300' : 'border-gray-300'
                ]"
              >
                <option value="">Select an option</option>
                <option value="yes">Yes, position is secure</option>
                <option value="at-risk">Position may be at risk</option>
                <option value="ending">Employment ending soon</option>
              </select>
              <p v-if="fieldErrors.employmentStable" class="mt-1 text-sm text-red-600">
                {{ fieldErrors.employmentStable }}
              </p>
            </div>

            <div v-if="formData.employmentStable !== 'yes'">
              <label for="employment-stable-details" class="block text-sm font-medium text-gray-700">Please provide
                details *</label>
              <textarea
                id="employment-stable-details"
                v-model="formData.employmentStableDetails"
                rows="3"
                required
                :class="[
                  'mt-1 block w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500',
                  fieldErrors.employmentStableDetails ? 'border-red-300' : 'border-gray-300'
                ]"
                placeholder="Please explain the employment situation"
              ></textarea>
              <p v-if="fieldErrors.employmentStableDetails" class="mt-1 text-sm text-red-600">
                {{ fieldErrors.employmentStableDetails }}
              </p>
            </div>

            <div>
              <label for="additional-comments" class="block text-sm font-medium text-gray-700">Additional
                Comments</label>
              <textarea id="additional-comments" v-model="formData.additionalComments" rows="4"
                placeholder="Please provide any additional information that may be relevant to this reference"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"></textarea>
            </div>
          </div>
        </div>

        <!-- Declaration -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Declaration</h2>
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p class="text-sm text-gray-700">
              I declare that the information provided in this reference is true and accurate to the best of my
              knowledge.
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
                :class="[
                  'mt-1 block w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500',
                  fieldErrors.signatureName ? 'border-red-300' : 'border-gray-300'
                ]"
              />
              <p v-if="fieldErrors.signatureName" class="mt-1 text-sm text-red-600">
                {{ fieldErrors.signatureName }}
              </p>
            </div>

            <SignaturePad v-model="formData.signature" label="Signature" />

            <DatePicker v-model="formData.date" label="Date" :required="true" year-range-type="current"
              select-class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="error" class="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-lg">
          {{ error }}
        </div>

        <!-- Submit Button -->
        <div class="bg-white rounded-lg shadow p-6">
          <button type="submit" :disabled="submitting"
            class="w-full px-6 py-3 text-base font-medium text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
            :style="{ backgroundColor: buttonColor }">
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
import { useGeolocationCapture } from '../composables/useGeolocationCapture'
import { isValidEmail } from '../utils/validation'
import { defaultBranding } from '../config/colors'
import { CheckCircle2 } from 'lucide-vue-next'

const route = useRoute()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const loading = ref(false)
const submitted = ref(false)
const submitting = ref(false)
const error = ref('')

// Company branding
const companyLogo = ref('')
const primaryColor = ref(defaultBranding.primaryColor)
const buttonColor = ref(defaultBranding.buttonColor)
const brandingLoaded = ref(false)

// Employee information
const employeeName = ref('')
const { geolocation: userGeolocation } = useGeolocationCapture()

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
  clarificationDetails: '',
  contractTypeConfirmation: '',
  employmentStable: '',
  employmentStableDetails: '',
  additionalComments: '',
  signatureName: '',
  signature: '',
  date: new Date().toISOString().split('T')[0]
})

const fieldErrors = ref<Record<string, string>>({})

const handleSubmit = async () => {
  submitting.value = true
  error.value = ''
  fieldErrors.value = {}

  const errors: Record<string, string> = {}

  if (!formData.value.companyName.trim()) errors.companyName = 'Company name is required'
  if (!formData.value.employerName.trim()) errors.employerName = 'Your full name is required'
  if (!formData.value.employerPosition.trim()) errors.employerPosition = 'Your position/title is required'
  if (!formData.value.employerEmail.trim()) errors.employerEmail = 'Email address is required'
  if (!formData.value.employeePosition.trim()) errors.employeePosition = "Employee's position is required"
  if (!formData.value.employmentType) errors.employmentType = 'Employment type is required'
  if (!formData.value.annualSalary) errors.annualSalary = 'Salary is required'
  if (!formData.value.salaryFrequency) errors.salaryFrequency = 'Pay frequency is required'
  if (!formData.value.isProbation) errors.isProbation = 'Please confirm probation status'
  if (!formData.value.employmentStatus) errors.employmentStatus = 'Please confirm employment details'
  if (
    (formData.value.employmentStatus === 'partial' ||
      formData.value.employmentStatus === 'cannot-confirm') &&
    !formData.value.clarificationDetails.trim()
  ) {
    errors.clarificationDetails = 'Please provide clarification'
  }
  if (!formData.value.contractTypeConfirmation) {
    errors.contractTypeConfirmation = 'Please confirm the contract type'
  }
  if (!formData.value.employmentStable) {
    errors.employmentStable = "Please confirm whether the employee's position is secure"
  }
  if (formData.value.employmentStable !== 'yes' && !formData.value.employmentStableDetails.trim()) {
    errors.employmentStableDetails = 'Please explain the employment situation'
  }
  if (!formData.value.signatureName.trim()) {
    errors.signatureName = 'Your full name is required for the declaration'
  }

  if (Object.keys(errors).length > 0) {
    fieldErrors.value = errors
    submitting.value = false
    return
  }

  // Validate email
  if (!isValidEmail(formData.value.employerEmail)) {
    fieldErrors.value = {
      ...fieldErrors.value,
      employerEmail: 'Please enter a valid email address'
    }
    submitting.value = false
    return
  }

  try {
    // Validate signature
    if (!formData.value.signature) {
      error.value = 'Please provide your signature'
      submitting.value = false
      return
    }

    const referenceId = route.params.referenceId
    const payload = {
      ...formData.value,
      geolocation: userGeolocation.value
    }

    const response = await fetch(`${API_URL}/api/references/employer/${referenceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
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
    const checkResponse = await fetch(`${API_URL}/api/references/employer/${referenceId}/check`)
    if (checkResponse.ok) {
      const checkData = await checkResponse.json()
      if (checkData.submitted) {
        submitted.value = true
        brandingLoaded.value = true
        return
      }
    }

    // Load branding and tenant info
    const response = await fetch(`${API_URL}/api/references/branding/${referenceId}`)

    if (response.ok) {
      const data = await response.json()
      if (data.branding) {
        companyLogo.value = data.branding.logo_url || ''
        primaryColor.value = data.branding.primary_color || defaultBranding.primaryColor
        buttonColor.value = data.branding.button_color || defaultBranding.buttonColor
      }

      // Pre-populate form with tenant-provided information
      if (data.tenantInfo) {
        formData.value.companyName = data.tenantInfo.companyName || ''
        formData.value.employerName = data.tenantInfo.employerName || ''
        formData.value.employerEmail = data.tenantInfo.employerEmail || ''
        formData.value.employerPhone = data.tenantInfo.employerPhone || ''
        formData.value.employerPosition = data.tenantInfo.employerPosition || ''
        formData.value.employeePosition = data.tenantInfo.employeePosition || ''
        formData.value.employmentType = data.tenantInfo.employmentType || ''
        formData.value.employmentStartDate = data.tenantInfo.employmentStartDate || ''
        formData.value.annualSalary = data.tenantInfo.annualSalary || ''
        formData.value.salaryFrequency = data.tenantInfo.salaryFrequency || 'annual'

        // Set employee name
        employeeName.value = `${data.tenantInfo.tenantFirstName} ${data.tenantInfo.tenantLastName}`
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

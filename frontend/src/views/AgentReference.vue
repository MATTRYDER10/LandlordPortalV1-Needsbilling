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
        <h1 class="text-3xl font-bold" :style="{ color: primaryColor }">Letting Agent Reference Form</h1>
        <p class="mt-2 text-gray-600">Please provide a reference for your previous/current tenant</p>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="bg-white rounded-lg shadow p-8 text-center">
        <div class="text-gray-600">Loading...</div>
      </div>

      <!-- Success State -->
      <div v-else-if="submitted" class="bg-white rounded-lg shadow p-8 text-center">
        <CheckCircle2 class="mx-auto h-12 w-12 text-green-500" />
        <h3 class="mt-4 text-lg font-semibold text-gray-900">Thank You!</h3>
        <p class="mt-2 text-gray-600">Your agent reference has been submitted successfully.</p>
      </div>

      <!-- Expired Link State -->
      <div v-else-if="linkExpired" class="bg-white rounded-lg shadow p-8 text-center">
        <AlertTriangle class="mx-auto h-12 w-12 text-red-500" />
        <h3 class="mt-4 text-lg font-semibold text-gray-900">{{ expiredMessage }}</h3>
        <p class="mt-2 text-gray-600">Please check your email for a fresh link.</p>
      </div>

      <!-- Form -->
      <form v-else @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Instruction Banner -->
        <div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
          <p class="text-sm text-blue-900">
            The tenant has made the below statement about their tenancy, please confirm and amend if required the details below.
          </p>
        </div>

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
            <DatePicker
              v-model="formData.tenancyStartDate"
              label="Tenancy Start Date"
              :required="true"
              year-range-type="tenancy"
              select-class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-3">Tenancy Status *</label>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  @click="handleTenancyStatus('ended')"
                  :class="[
                    'py-3 px-4 rounded-lg border-2 font-medium transition-colors text-sm',
                    formData.tenancyStatus === 'ended'
                      ? 'text-white'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  ]"
                  :style="formData.tenancyStatus === 'ended' ? { backgroundColor: buttonColor, borderColor: buttonColor } : {}"
                >
                  Tenancy Ended
                </button>
                <button
                  type="button"
                  @click="handleTenancyStatus('notice-served')"
                  :class="[
                    'py-3 px-4 rounded-lg border-2 font-medium transition-colors text-sm',
                    formData.tenancyStatus === 'notice-served'
                      ? 'text-white'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  ]"
                  :style="formData.tenancyStatus === 'notice-served' ? { backgroundColor: buttonColor, borderColor: buttonColor } : {}"
                >
                  Tenant has served notice
                </button>
                <button
                  type="button"
                  @click="handleTenancyStatus('in-situ')"
                  :class="[
                    'py-3 px-4 rounded-lg border-2 font-medium transition-colors text-sm',
                    formData.tenancyStatus === 'in-situ'
                      ? 'text-white'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  ]"
                  :style="formData.tenancyStatus === 'in-situ' ? { backgroundColor: buttonColor, borderColor: buttonColor } : {}"
                >
                  Tenant in situ
                </button>
              </div>
            </div>

            <DatePicker
              v-if="formData.tenancyStatus === 'ended'"
              v-model="formData.tenancyEndDate"
              label="Tenancy End Date"
              :required="formData.tenancyStatus === 'ended'"
              year-range-type="tenancy"
              select-class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />

            <div>
              <label for="monthly-rent" class="block text-sm font-medium text-gray-700">Monthly Rent (£) *</label>
              <input
                id="monthly-rent"
                v-model.number="formData.monthlyRent"
                type="number"
                step="1"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <!-- Address Confirmation -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Address Confirmation</h2>

          <!-- Display pre-populated address -->
          <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
            <p class="text-sm font-medium text-gray-700 mb-2">Property Address:</p>
            <p class="text-gray-900">{{ formData.propertyAddressLine1 }}</p>
            <p v-if="formData.propertyAddressLine2" class="text-gray-900">{{ formData.propertyAddressLine2 }}</p>
            <p class="text-gray-900">{{ formData.propertyCity }}, {{ formData.propertyPostcode }}</p>
          </div>

          <p class="text-sm text-gray-600 mb-4">(If the address is not correct please answer "No", proceed with the reference and supply the correct address in the comments section below)</p>

          <div class="space-y-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-3">The address is correct *</label>
              <div class="flex gap-2">
                <button
                  type="button"
                  @click="formData.addressCorrect = 'yes'"
                  :class="[
                    'flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-colors',
                    formData.addressCorrect === 'yes'
                      ? 'text-white'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  ]"
                  :style="formData.addressCorrect === 'yes' ? { backgroundColor: buttonColor, borderColor: buttonColor } : {}"
                >
                  Yes
                </button>
                <button
                  type="button"
                  @click="formData.addressCorrect = 'no'"
                  :class="[
                    'flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-colors',
                    formData.addressCorrect === 'no'
                      ? 'text-white'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  ]"
                  :style="formData.addressCorrect === 'no' ? { backgroundColor: buttonColor, borderColor: buttonColor } : {}"
                >
                  No
                </button>
              </div>
            </div>

            <!-- Corrected Address (shown if address is incorrect) -->
            <div v-if="formData.addressCorrect === 'no'" class="mt-6 pt-6 border-t border-gray-200">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Correct Property Address</h3>
              <p class="text-sm text-gray-600 mb-4">Please provide the correct property address</p>
              <div class="space-y-4">
                <div>
                  <label for="corrected-address-line1" class="block text-sm font-medium text-gray-700">Address Line 1 *</label>
                  <input
                    id="corrected-address-line1"
                    v-model="formData.correctedAddressLine1"
                    type="text"
                    :required="formData.addressCorrect === 'no'"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label for="corrected-address-line2" class="block text-sm font-medium text-gray-700">Address Line 2</label>
                  <input
                    id="corrected-address-line2"
                    v-model="formData.correctedAddressLine2"
                    type="text"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label for="corrected-city" class="block text-sm font-medium text-gray-700">City *</label>
                    <input
                      id="corrected-city"
                      v-model="formData.correctedCity"
                      type="text"
                      :required="formData.addressCorrect === 'no'"
                      class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label for="corrected-postcode" class="block text-sm font-medium text-gray-700">Postcode *</label>
                    <input
                      id="corrected-postcode"
                      v-model="formData.correctedPostcode"
                      type="text"
                      :required="formData.addressCorrect === 'no'"
                      class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Reference Questions -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Reference Questions</h2>
          <div class="space-y-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-3">Rent paid on time *</label>
              <div class="flex gap-2">
                <button
                  type="button"
                  @click="formData.rentPaidOnTime = 'yes'"
                  :class="[
                    'flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-colors',
                    formData.rentPaidOnTime === 'yes'
                      ? 'text-white'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  ]"
                  :style="formData.rentPaidOnTime === 'yes' ? { backgroundColor: buttonColor, borderColor: buttonColor } : {}"
                >
                  Yes
                </button>
                <button
                  type="button"
                  @click="formData.rentPaidOnTime = 'no'"
                  :class="[
                    'flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-colors',
                    formData.rentPaidOnTime === 'no'
                      ? 'text-white'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  ]"
                  :style="formData.rentPaidOnTime === 'no' ? { backgroundColor: buttonColor, borderColor: buttonColor } : {}"
                >
                  No
                </button>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-3">Have they been a good tenant *</label>
              <div class="flex gap-2">
                <button
                  type="button"
                  @click="formData.goodTenant = 'yes'"
                  :class="[
                    'flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-colors',
                    formData.goodTenant === 'yes'
                      ? 'text-white'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  ]"
                  :style="formData.goodTenant === 'yes' ? { backgroundColor: buttonColor, borderColor: buttonColor } : {}"
                >
                  Yes
                </button>
                <button
                  type="button"
                  @click="formData.goodTenant = 'no'"
                  :class="[
                    'flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-colors',
                    formData.goodTenant === 'no'
                      ? 'text-white'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  ]"
                  :style="formData.goodTenant === 'no' ? { backgroundColor: buttonColor, borderColor: buttonColor } : {}"
                >
                  No
                </button>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-3">Would you rent to them again *</label>
              <div class="flex gap-2">
                <button
                  type="button"
                  @click="formData.wouldRentAgain = 'yes'"
                  :class="[
                    'flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-colors',
                    formData.wouldRentAgain === 'yes'
                      ? 'text-white'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  ]"
                  :style="formData.wouldRentAgain === 'yes' ? { backgroundColor: buttonColor, borderColor: buttonColor } : {}"
                >
                  Yes
                </button>
                <button
                  type="button"
                  @click="formData.wouldRentAgain = 'no'"
                  :class="[
                    'flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-colors',
                    formData.wouldRentAgain === 'no'
                      ? 'text-white'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  ]"
                  :style="formData.wouldRentAgain === 'no' ? { backgroundColor: buttonColor, borderColor: buttonColor } : {}"
                >
                  No
                </button>
              </div>
            </div>

            <div>
              <label for="additional-comments" class="block text-sm font-medium text-gray-700">If you have any further comments that you feel will support their application please add them here</label>
              <textarea
                id="additional-comments"
                v-model="formData.additionalComments"
                rows="4"
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
import { useGeolocationCapture } from '../composables/useGeolocationCapture'
import { isValidEmail } from '../utils/validation'
import { defaultBranding } from '../config/colors'
import { CheckCircle2, AlertTriangle } from 'lucide-vue-next'

const route = useRoute()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const loading = ref(false)
const submitted = ref(false)
const submitting = ref(false)
const error = ref('')
const linkExpired = ref(false)
const expiredMessage = ref('')

// Company branding
const companyLogo = ref('')
const primaryColor = ref(defaultBranding.primaryColor)
const buttonColor = ref(defaultBranding.buttonColor)
const brandingLoaded = ref(false)

const { geolocation: userGeolocation } = useGeolocationCapture()

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

const handleLegacyLink = async (referenceId: string) => {
  linkExpired.value = true
  try {
    const response = await fetch(`${API_URL}/api/references/legacy-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'landlord', token: referenceId })
    })
    const data = await response.json()
    expiredMessage.value = data.error || "This link has expired. We've sent a new one."
  } catch (err) {
    console.error('Failed to resend legacy agent link:', err)
    expiredMessage.value = "This link has expired. We've sent a new one."
  } finally {
    brandingLoaded.value = true
  }
}

const formData = ref({
  agentName: '',
  agentEmail: '',
  agentPhone: '',
  agencyName: '',
  propertyAddressLine1: '',
  propertyAddressLine2: '',
  propertyCity: '',
  propertyPostcode: '',
  addressCorrect: '',
  correctedAddressLine1: '',
  correctedAddressLine2: '',
  correctedCity: '',
  correctedPostcode: '',
  tenancyStartDate: '',
  tenancyEndDate: '',
  tenancyStatus: '',
  tenancyStillInProgress: false,
  monthlyRent: '',
  goodTenant: '',
  rentPaidOnTime: '',
  wouldRentAgain: '',
  additionalComments: '',
  signatureName: '',
  signature: '',
  date: new Date().toISOString().split('T')[0]
})

const handleTenancyStatus = (status: string) => {
  formData.value.tenancyStatus = status;
  const isStillInProgress = (status === 'in-situ') || (status === 'notice-served')
  formData.value.tenancyStillInProgress = isStillInProgress
  if (isStillInProgress) {
    formData.value.tenancyEndDate = ''
  }
}

const handleSubmit = async () => {
  submitting.value = true
  error.value = ''

  // Validate email
  if (!isValidEmail(formData.value.agentEmail)) {
    error.value = 'Please enter a valid email address'
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

    const response = await fetch(`${API_URL}/api/references/agent/${referenceId}`, {
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
    const referenceId = route.params.referenceId as string

    if (!isUuid(referenceId)) {
      await handleLegacyLink(referenceId)
      return
    }

    // Check if reference already submitted
    const checkResponse = await fetch(`${API_URL}/api/references/agent/${referenceId}/check`)

    // Handle 410 (expired link) response
    if (checkResponse.status === 410) {
      await handleLegacyLink(referenceId)
      return
    }

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

    // Handle 410 (expired link) response
    if (response.status === 410) {
      await handleLegacyLink(referenceId)
      return
    }

    if (response.ok) {
      const data = await response.json()
      if (data.branding) {
        companyLogo.value = data.branding.logo_url || ''
        primaryColor.value = data.branding.primary_color || defaultBranding.primaryColor
        buttonColor.value = data.branding.button_color || defaultBranding.buttonColor
      }

      // Pre-populate form with tenant-provided information
      if (data.tenantInfo) {
        formData.value.agentName = data.tenantInfo.landlordName || ''
        formData.value.agentEmail = data.tenantInfo.landlordEmail || ''
        formData.value.agentPhone = data.tenantInfo.landlordPhone || ''
        formData.value.agencyName = data.tenantInfo.agencyName || ''

        formData.value.propertyAddressLine1 = data.tenantInfo.propertyAddress || ''
        formData.value.propertyAddressLine2 = data.tenantInfo.propertyAddress2 || ''
        formData.value.propertyCity = data.tenantInfo.propertyCity || ''
        formData.value.propertyPostcode = data.tenantInfo.propertyPostcode || ''

        formData.value.tenancyStartDate = data.tenantInfo.tenancyStartDate || ''
        formData.value.tenancyEndDate = data.tenantInfo.tenancyEndDate || ''
        formData.value.monthlyRent = data.tenantInfo.monthlyRent || ''
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

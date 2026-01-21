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
        <h1 class="text-3xl font-bold" :style="{ color: primaryColor }">Accountant Reference Form</h1>
        <p class="mt-2 text-gray-600">Please provide a professional reference for your self-employed client</p>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="bg-white rounded-lg shadow p-8 text-center">
        <div class="text-gray-600">Loading...</div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-white rounded-lg shadow p-8">
        <div class="text-center">
          <AlertTriangle class="mx-auto h-12 w-12 text-red-500" />
          <h3 class="mt-4 text-lg font-semibold text-gray-900">{{ error }}</h3>
        </div>
      </div>

      <!-- Success State -->
      <div v-else-if="submitted" class="bg-white rounded-lg shadow p-8 text-center">
        <CheckCircle2 class="mx-auto h-12 w-12 text-green-500" />
        <h3 class="mt-4 text-lg font-semibold text-gray-900">Thank You!</h3>
        <p class="mt-2 text-gray-600">Your accountant reference has been submitted successfully.</p>
      </div>

      <!-- Form -->
      <form v-else @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Business Information -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Business Information</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">Client Name *</label>
              <input
                v-model="formData.tenantName"
                type="text"
                required
                placeholder="Full name of your client"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Business/Trading Name *</label>
              <input
                v-model="formData.businessName"
                type="text"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Nature of Business *</label>
              <input
                v-model="formData.natureOfBusiness"
                type="text"
                required
                placeholder="e.g., Freelance Graphic Design"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Business Start Date *</label>
              <DatePicker
                v-model="formData.businessStartDate"
                :required="true"
                year-range-type="employment"
                select-class="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                gap="gap-2"
              />
            </div>
          </div>
        </div>

        <!-- Financial Information -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Financial Information</h2>
          <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700">Annual Turnover (£) *</label>
                <input
                  v-model="formData.annualTurnover"
                  type="number"
                  step="0.01"
                  required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Annual Net Profit (£) *</label>
                <input
                  v-model="formData.annualProfit"
                  type="number"
                  step="0.01"
                  required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Tax Returns Filed *</label>
              <div class="flex gap-4">
                <label class="flex items-center">
                  <input
                    v-model="formData.taxReturnsFiled"
                    type="radio"
                    :value="true"
                    required
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span class="ml-2 text-sm text-gray-700">Yes</span>
                </label>
                <label class="flex items-center">
                  <input
                    v-model="formData.taxReturnsFiled"
                    type="radio"
                    :value="false"
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span class="ml-2 text-sm text-gray-700">No</span>
                </label>
              </div>
            </div>

            <div v-if="formData.taxReturnsFiled">
              <label class="block text-sm font-medium text-gray-700 mb-2">Last Tax Return Date</label>
              <DatePicker
                v-model="formData.lastTaxReturnDate"
                :required="false"
                year-range-type="employment"
                select-class="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Accounts Prepared *</label>
              <div class="flex gap-4">
                <label class="flex items-center">
                  <input
                    v-model="formData.accountsPrepared"
                    type="radio"
                    :value="true"
                    required
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span class="ml-2 text-sm text-gray-700">Yes</span>
                </label>
                <label class="flex items-center">
                  <input
                    v-model="formData.accountsPrepared"
                    type="radio"
                    :value="false"
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span class="ml-2 text-sm text-gray-700">No</span>
                </label>
              </div>
            </div>

            <div v-if="formData.accountsPrepared">
              <label class="block text-sm font-medium text-gray-700 mb-2">Accounts Year End Date</label>
              <DatePicker
                v-model="formData.accountsYearEnd"
                :required="false"
                year-range-type="employment"
                select-class="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <!-- Business Status -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Business Status</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">Current Trading Status *</label>
              <select
                v-model="formData.businessTradingStatus"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select status</option>
                <option value="trading">Currently Trading</option>
                <option value="dormant">Dormant</option>
                <option value="ceased">Ceased Trading</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Any Outstanding Tax Liabilities? *</label>
              <div class="flex gap-4">
                <label class="flex items-center">
                  <input
                    v-model="formData.anyOutstandingTaxLiabilities"
                    type="radio"
                    :value="true"
                    required
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span class="ml-2 text-sm text-gray-700">Yes</span>
                </label>
                <label class="flex items-center">
                  <input
                    v-model="formData.anyOutstandingTaxLiabilities"
                    type="radio"
                    :value="false"
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span class="ml-2 text-sm text-gray-700">No</span>
                </label>
              </div>
            </div>

            <div v-if="formData.anyOutstandingTaxLiabilities">
              <label class="block text-sm font-medium text-gray-700">Please provide details</label>
              <textarea
                v-model="formData.taxLiabilitiesDetails"
                rows="3"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Is the business financially stable? *</label>
              <div class="flex gap-4">
                <label class="flex items-center">
                  <input
                    v-model="formData.businessFinanciallyStable"
                    type="radio"
                    :value="true"
                    required
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span class="ml-2 text-sm text-gray-700">Yes</span>
                </label>
                <label class="flex items-center">
                  <input
                    v-model="formData.businessFinanciallyStable"
                    type="radio"
                    :value="false"
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span class="ml-2 text-sm text-gray-700">No</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- Income Verification -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Income Verification</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Can you confirm the income declared by your client? *</label>
              <div class="flex gap-4">
                <label class="flex items-center">
                  <input
                    v-model="formData.accountantConfirmsIncome"
                    type="radio"
                    :value="true"
                    required
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span class="ml-2 text-sm text-gray-700">Yes</span>
                </label>
                <label class="flex items-center">
                  <input
                    v-model="formData.accountantConfirmsIncome"
                    type="radio"
                    :value="false"
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span class="ml-2 text-sm text-gray-700">No</span>
                </label>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Estimated Monthly Income (£) *</label>
              <input
                v-model="formData.estimatedMonthlyIncome"
                type="number"
                step="0.01"
                required
                placeholder="After tax and expenses"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <p class="mt-1 text-xs text-gray-500">Estimated monthly income after tax and business expenses</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Additional Comments</label>
              <textarea
                v-model="formData.additionalComments"
                rows="3"
                placeholder="Any additional information about the client's financial situation"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
            </div>
          </div>
        </div>

        <!-- Recommendation -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Professional Recommendation</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Would you recommend this client as financially reliable for a tenancy agreement? *</label>
              <div class="flex gap-4">
                <label class="flex items-center">
                  <input
                    v-model="formData.wouldRecommend"
                    type="radio"
                    :value="true"
                    required
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span class="ml-2 text-sm text-gray-700">Yes</span>
                </label>
                <label class="flex items-center">
                  <input
                    v-model="formData.wouldRecommend"
                    type="radio"
                    :value="false"
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span class="ml-2 text-sm text-gray-700">No</span>
                </label>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Recommendation Comments</label>
              <textarea
                v-model="formData.recommendationComments"
                rows="4"
                placeholder="Please provide any additional comments regarding your recommendation"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
            </div>
          </div>
        </div>

        <!-- Declaration and Signature -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Declaration & Signature</h2>

          <div class="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
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

            <DatePicker
              v-model="formData.date"
              label="Date"
              :required="true"
              year-range-type="current"
              select-class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <!-- Submit Button -->
        <div class="bg-white rounded-lg shadow p-6">
          <div v-if="submitError" class="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p class="text-sm text-red-600">{{ submitError }}</p>
          </div>

          <button
            type="submit"
            :disabled="submitting"
            class="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white disabled:opacity-50 hover:opacity-90"
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
import DatePicker from '../components/DatePicker.vue'
import SignaturePad from '../components/SignaturePad.vue'
import { useGeolocationCapture } from '../composables/useGeolocationCapture'
import { defaultBranding } from '../config/colors'
import { AlertTriangle, CheckCircle2 } from 'lucide-vue-next'

const route = useRoute()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const loading = ref(true)
const error = ref('')
const submitted = ref(false)
const submitting = ref(false)
const submitError = ref('')
const { geolocation: userGeolocation } = useGeolocationCapture()

// Company branding
const companyLogo = ref('')
const primaryColor = ref(defaultBranding.primaryColor)
const buttonColor = ref(defaultBranding.buttonColor)
const brandingLoaded = ref(false)

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

const handleLegacyLink = async (legacyToken: string) => {
  loading.value = false
  try {
    const response = await fetch(`${API_URL}/api/references/legacy-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'accountant', token: legacyToken })
    })
    const data = await response.json()
    error.value = data.error || "This link has expired. We've sent a new one."
  } catch (err) {
    console.error('Failed to resend legacy accountant link:', err)
    error.value = "This link has expired. We've sent a new one."
  } finally {
    brandingLoaded.value = true
  }
}

// Get today's date in YYYY-MM-DD format
const getTodayDate = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formData = ref({
  tenantName: '',
  businessName: '',
  natureOfBusiness: '',
  businessStartDate: '',
  annualTurnover: null,
  annualProfit: null,
  taxReturnsFiled: null,
  lastTaxReturnDate: '',
  accountsPrepared: null,
  accountsYearEnd: '',
  businessTradingStatus: '',
  anyOutstandingTaxLiabilities: null,
  taxLiabilitiesDetails: '',
  businessFinanciallyStable: null,
  accountantConfirmsIncome: null,
  estimatedMonthlyIncome: 0,
  additionalComments: '',
  wouldRecommend: null,
  recommendationComments: '',
  signatureName: '',
  signature: '',
  date: getTodayDate()
})

onMounted(async () => {
  const token = route.params.token as string

  if (!token) {
    error.value = 'Invalid reference link'
    loading.value = false
    brandingLoaded.value = true
    return
  }
  if (!isUuid(token)) {
    await handleLegacyLink(token)
    return
  }

  // Check if reference already submitted
  try {
    const checkResponse = await fetch(`${API_URL}/api/references/accountant/${token}/check`)
    if (checkResponse.ok) {
      const checkData = await checkResponse.json()
      if (checkData.submitted) {
        submitted.value = true
        brandingLoaded.value = true
        loading.value = false
        return
      }
    }
  } catch (err) {
    console.error('Failed to check submission status:', err)
  }

  // Fetch company branding and tenant info
  try {
    const response = await fetch(`${API_URL}/api/references/accountant/branding/${token}`)
    if (response.ok) {
      const data = await response.json()
      if (data.branding) {
        companyLogo.value = data.branding.logo_url || ''
        primaryColor.value = data.branding.primary_color || defaultBranding.primaryColor
        buttonColor.value = data.branding.button_color || defaultBranding.buttonColor
      }

      // Pre-populate form with tenant-provided information
      if (data.tenantInfo) {
        formData.value.businessName = data.tenantInfo.businessName || ''
        formData.value.natureOfBusiness = data.tenantInfo.natureOfBusiness || ''
        formData.value.businessStartDate = data.tenantInfo.businessStartDate || ''

        // Use estimatedIncome for estimated monthly income if available
        if (data.tenantInfo.estimatedIncome) {
          // The tenant provides annual income, convert to monthly estimate
          const annualIncome = parseFloat(data.tenantInfo.estimatedIncome)
          if (!isNaN(annualIncome)) {
            formData.value.estimatedMonthlyIncome = Math.round(annualIncome / 12)
          }
        }
      }
    }
  } catch (err) {
    // Silently fail - just use defaults
    console.error('Failed to load branding:', err)
  } finally {
    brandingLoaded.value = true
    loading.value = false
  }
})

const handleSubmit = async () => {
  submitting.value = true
  submitError.value = ''

  // Validate signature
  if (!formData.value.signature) {
    submitError.value = 'Please provide your signature'
    submitting.value = false
    return
  }

  try {
    const token = route.params.token as string
    const payload = {
      ...formData.value,
      geolocation: userGeolocation.value
    }

    const response = await fetch(`${API_URL}/api/references/accountant/${token}`, {
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
    submitError.value = err.message || 'An error occurred while submitting the reference'
  } finally {
    submitting.value = false
  }
}
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

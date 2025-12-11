<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-8">
        <div class="flex justify-center items-center gap-3 mb-4">
          <img src="/PropertyGooseIcon.webp" alt="PropertyGoose" class="h-12 w-12" />
          <span class="text-2xl font-bold">
            <span class="text-gray-900">Property</span><span class="text-primary">Goose</span>
          </span>
        </div>
        <h1 class="text-3xl font-bold text-gray-900">Sign Your Tenancy Agreement</h1>
        <p class="mt-2 text-gray-600">Review and sign your agreement electronically</p>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="bg-white rounded-lg shadow p-8 text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p class="text-gray-600">Loading agreement details...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-lg">
        <div class="flex items-center">
          <svg class="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {{ error }}
        </div>
      </div>

      <!-- Already Signed State -->
      <div v-else-if="signingData?.signature?.status === 'signed'" class="bg-white rounded-lg shadow p-8 text-center">
        <svg class="mx-auto h-16 w-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 class="mt-4 text-xl font-semibold text-gray-900">Agreement Already Signed</h3>
        <p class="mt-2 text-gray-600">You have already signed this agreement on {{ formatDate(signingData.signature.signed_at) }}.</p>
        <p class="mt-4 text-sm text-gray-500">You will receive an email with the fully executed agreement once all parties have signed.</p>
      </div>

      <!-- Declined State -->
      <div v-else-if="signingData?.signature?.status === 'declined'" class="bg-white rounded-lg shadow p-8 text-center">
        <svg class="mx-auto h-16 w-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 class="mt-4 text-xl font-semibold text-gray-900">Signature Declined</h3>
        <p class="mt-2 text-gray-600">You have declined to sign this agreement.</p>
        <p class="mt-4 text-sm text-gray-500">If this was a mistake, please contact your letting agent.</p>
      </div>

      <!-- Expired Token State -->
      <div v-else-if="signingData?.signature?.status === 'expired'" class="bg-white rounded-lg shadow p-8 text-center">
        <svg class="mx-auto h-16 w-16 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 class="mt-4 text-xl font-semibold text-gray-900">Link Expired</h3>
        <p class="mt-2 text-gray-600">This signing link has expired. Please contact your letting agent for a new link.</p>
      </div>

      <!-- Success State (just signed) -->
      <div v-else-if="justSigned" class="bg-white rounded-lg shadow p-8 text-center">
        <svg class="mx-auto h-16 w-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 class="mt-4 text-xl font-semibold text-gray-900">Thank You!</h3>
        <p class="mt-2 text-gray-600">Your signature has been recorded successfully.</p>
        <div class="mt-6 p-4 bg-blue-50 rounded-lg">
          <p class="text-sm text-blue-800">
            <strong>What happens next?</strong><br>
            Once all parties have signed, you will receive an email with the fully executed agreement attached.
          </p>
        </div>

        <!-- Signing Status -->
        <div v-if="signingStatus" class="mt-6">
          <h4 class="text-sm font-semibold text-gray-700 mb-3">Signing Progress</h4>
          <div class="space-y-2">
            <div v-for="signer in signingStatus.signers" :key="signer.id"
                 class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div class="flex items-center">
                <span class="text-sm font-medium text-gray-900">{{ signer.signer_name }}</span>
                <span class="ml-2 text-xs text-gray-500 capitalize">({{ signer.signer_type }})</span>
              </div>
              <span :class="getStatusClass(signer.status)" class="text-xs font-medium px-2 py-1 rounded-full">
                {{ getStatusLabel(signer.status) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Signing Interface -->
      <div v-else-if="signingData" class="space-y-6">
        <!-- Agreement Info Card -->
        <div class="bg-white rounded-lg shadow p-6">
          <div class="flex items-start justify-between">
            <div>
              <h2 class="text-lg font-semibold text-gray-900">{{ getAgreementTitle() }}</h2>
              <p class="mt-1 text-gray-600">{{ signingData.agreement.property_address }}</p>
            </div>
            <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800 capitalize">
              {{ signingData.signature.signer_type }}
            </span>
          </div>

          <div class="mt-4 pt-4 border-t border-gray-200">
            <p class="text-sm text-gray-600">
              <strong>You're signing as:</strong> {{ signingData.signature.signer_name }}
            </p>
            <p class="text-sm text-gray-500 mt-1">
              Signing link expires: {{ formatDate(signingData.signature.token_expires_at) }}
            </p>
          </div>
        </div>

        <!-- PDF Preview -->
        <div class="bg-white rounded-lg shadow overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 class="text-lg font-medium text-gray-900">Agreement Document</h3>
            <button
              @click="downloadPdf"
              class="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download PDF
            </button>
          </div>
          <div class="bg-gray-100 p-4">
            <iframe
              v-if="pdfUrl"
              :src="pdfUrl"
              class="w-full h-[600px] border border-gray-300 rounded bg-white"
            ></iframe>
            <div v-else class="h-[600px] flex items-center justify-center">
              <div class="text-center">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p class="text-sm text-gray-500">Loading document...</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Signing Status -->
        <div v-if="signingStatus" class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Signing Progress</h3>
          <div class="space-y-3">
            <div v-for="signer in signingStatus.signers" :key="signer.id"
                 class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div class="flex items-center">
                <div :class="[
                  'w-8 h-8 rounded-full flex items-center justify-center mr-3',
                  signer.status === 'signed' ? 'bg-green-100' : 'bg-gray-200'
                ]">
                  <svg v-if="signer.status === 'signed'" class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <svg v-else class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <span class="text-sm font-medium text-gray-900">{{ signer.signer_name }}</span>
                  <span class="ml-2 text-xs text-gray-500 capitalize">({{ signer.signer_type }})</span>
                </div>
              </div>
              <span :class="getStatusClass(signer.status)" class="text-xs font-medium px-2 py-1 rounded-full">
                {{ getStatusLabel(signer.status) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Signature Section -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Your Signature</h3>

          <SignaturePad
            v-model="signature"
            label="Sign below"
            type-placeholder="Type your full name"
          />

          <!-- Legal Agreement -->
          <div class="mt-6">
            <label class="flex items-start">
              <input
                type="checkbox"
                v-model="agreedToTerms"
                class="mt-1 h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <span class="ml-3 text-sm text-gray-600">
                I confirm that I have read and understood the tenancy agreement above. I agree to be bound by its terms and conditions.
                I understand that this electronic signature is legally binding.
              </span>
            </label>
          </div>

          <!-- Action Buttons -->
          <div class="mt-6 flex flex-col sm:flex-row gap-4">
            <button
              type="button"
              @click="submitSignature"
              :disabled="!canSign || submitting"
              class="flex-1 px-6 py-3 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              :class="canSign && !submitting ? 'bg-primary hover:bg-primary-dark' : 'bg-gray-400'"
            >
              <span v-if="submitting" class="flex items-center justify-center">
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing...
              </span>
              <span v-else>Sign Agreement</span>
            </button>

            <button
              type="button"
              @click="showDeclineModal = true"
              :disabled="submitting"
              class="px-6 py-3 text-red-600 font-semibold border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              Decline to Sign
            </button>
          </div>
        </div>
      </div>

      <!-- Decline Modal -->
      <div v-if="showDeclineModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
        <div class="relative bg-white rounded-lg shadow-xl max-w-md mx-4 p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Decline to Sign</h3>
          <p class="text-sm text-gray-600 mb-4">
            Are you sure you want to decline to sign this agreement? Please provide a reason below.
          </p>
          <textarea
            v-model="declineReason"
            rows="3"
            placeholder="Please explain why you're declining to sign..."
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
          ></textarea>
          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              @click="showDeclineModal = false"
              class="px-4 py-2 text-gray-700 font-medium border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="declineSignature"
              :disabled="!declineReason.trim() || declining"
              class="px-4 py-2 text-white font-medium bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {{ declining ? 'Declining...' : 'Confirm Decline' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import SignaturePad from '../components/SignaturePad.vue'

const route = useRoute()
const token = route.params.token as string

// State
const loading = ref(true)
const error = ref<string | null>(null)
const signingData = ref<any>(null)
const signingStatus = ref<any>(null)
const pdfUrl = ref<string | null>(null)
const signature = ref('')
const agreedToTerms = ref(false)
const submitting = ref(false)
const justSigned = ref(false)
const showDeclineModal = ref(false)
const declineReason = ref('')
const declining = ref(false)

// Computed
const canSign = computed(() => {
  return signature.value && agreedToTerms.value && !submitting.value
})

// API base URL
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Methods
const fetchSigningData = async () => {
  try {
    loading.value = true
    error.value = null

    const response = await fetch(`${API_BASE}/api/signing/${token}`)
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load signing data')
    }

    signingData.value = data

    // Load the PDF
    loadPdf()

    // Load signing status
    fetchSigningStatus()
  } catch (err: any) {
    console.error('Error fetching signing data:', err)
    error.value = err.message || 'Failed to load agreement. The link may be invalid or expired.'
  } finally {
    loading.value = false
  }
}

const loadPdf = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/signing/${token}/pdf`)
    if (!response.ok) {
      throw new Error('Failed to load PDF')
    }
    const blob = await response.blob()
    pdfUrl.value = URL.createObjectURL(blob)
  } catch (err) {
    console.error('Error loading PDF:', err)
  }
}

const fetchSigningStatus = async () => {
  try {
    // The signing status is included in the initial response
    if (signingData.value?.signers) {
      signingStatus.value = { signers: signingData.value.signers }
    }
  } catch (err) {
    console.error('Error fetching signing status:', err)
  }
}

const downloadPdf = () => {
  if (pdfUrl.value) {
    const link = document.createElement('a')
    link.href = pdfUrl.value
    link.download = `Tenancy_Agreement_${new Date().toISOString().split('T')[0]}.pdf`
    link.click()
  }
}

const submitSignature = async () => {
  if (!canSign.value) return

  try {
    submitting.value = true

    const response = await fetch(`${API_BASE}/api/signing/${token}/sign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        signatureData: signature.value,
        signatureType: signature.value.startsWith('data:image') && signature.value.length > 1000 ? 'draw' : 'type'
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to submit signature')
    }

    justSigned.value = true

    // Update signing status
    if (data.signers) {
      signingStatus.value = { signers: data.signers }
    }
  } catch (err: any) {
    console.error('Error submitting signature:', err)
    error.value = err.message || 'Failed to submit signature. Please try again.'
  } finally {
    submitting.value = false
  }
}

const declineSignature = async () => {
  if (!declineReason.value.trim()) return

  try {
    declining.value = true

    const response = await fetch(`${API_BASE}/api/signing/${token}/decline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reason: declineReason.value
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to decline')
    }

    // Refresh the page data
    showDeclineModal.value = false
    await fetchSigningData()
  } catch (err: any) {
    console.error('Error declining signature:', err)
    error.value = err.message || 'Failed to decline. Please try again.'
  } finally {
    declining.value = false
  }
}

const formatDate = (dateString: string) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

const getAgreementTitle = () => {
  if (!signingData.value?.agreement) return 'Tenancy Agreement'
  return signingData.value.agreement.language === 'welsh'
    ? 'Welsh Occupation Contract'
    : 'Assured Shorthold Tenancy Agreement'
}

const getStatusClass = (status: string) => {
  switch (status) {
    case 'signed':
      return 'bg-green-100 text-green-800'
    case 'pending':
    case 'sent':
      return 'bg-yellow-100 text-yellow-800'
    case 'viewed':
      return 'bg-blue-100 text-blue-800'
    case 'declined':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'signed':
      return 'Signed'
    case 'pending':
      return 'Pending'
    case 'sent':
      return 'Awaiting'
    case 'viewed':
      return 'Viewed'
    case 'declined':
      return 'Declined'
    default:
      return status
  }
}

// Lifecycle
onMounted(() => {
  fetchSigningData()
})
</script>

<style scoped>
.text-primary {
  color: #f97316;
}

.bg-primary {
  background-color: #f97316;
}

.bg-primary-dark {
  background-color: #ea580c;
}

.border-primary {
  border-color: #f97316;
}

.focus\:ring-primary:focus {
  --tw-ring-color: #f97316;
}

.focus\:border-primary:focus {
  border-color: #f97316;
}
</style>

<template>
  <div class="min-h-screen bg-white dark:bg-slate-900 flex flex-col">
    <!-- Compact Header -->
    <header class="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 py-3">
      <div class="max-w-6xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-3">
          <img src="/PropertyGooseLogo.png" alt="PropertyGoose" class="h-8 dark:hidden" />
          <img src="/PropertyGooseLogoDark.png" alt="PropertyGoose" class="h-8 hidden dark:block" />
          <div class="hidden sm:block border-l border-gray-300 dark:border-slate-600 pl-3">
            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ signingData?.agreement?.property_address || 'Tenancy Agreement' }}</p>
            <p class="text-xs text-gray-500 dark:text-slate-400">{{ getAgreementTitle() }}</p>
          </div>
        </div>
        <button
          @click="downloadPdf"
          class="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600"
        >
          <Download class="w-4 h-4 mr-1.5" />
          Download PDF
        </button>
      </div>
    </header>

    <!-- Loading State -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p class="text-gray-600 dark:text-slate-400">Loading agreement...</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex-1 flex items-center justify-center p-4">
      <div class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 px-6 py-4 rounded-lg max-w-md">
        <div class="flex items-center">
          <AlertTriangle class="h-5 w-5 mr-2 flex-shrink-0" />
          {{ error }}
        </div>
      </div>
    </div>

    <!-- Already Signed State -->
    <div v-else-if="signingData?.signature?.status === 'signed'" class="flex-1 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 text-center max-w-md">
        <CheckCircle class="mx-auto h-16 w-16 text-green-500" />
        <h3 class="mt-4 text-xl font-semibold text-gray-900 dark:text-white">Agreement Already Signed</h3>
        <p class="mt-2 text-gray-600 dark:text-slate-400">You signed on {{ formatDate(signingData.signature.signed_at) }}.</p>
        <p class="mt-4 text-sm text-gray-500 dark:text-slate-400">You'll receive the fully executed agreement once all parties have signed.</p>
      </div>
    </div>

    <!-- Declined State -->
    <div v-else-if="signingData?.signature?.status === 'declined'" class="flex-1 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 text-center max-w-md">
        <XCircle class="mx-auto h-16 w-16 text-red-500" />
        <h3 class="mt-4 text-xl font-semibold text-gray-900 dark:text-white">Signature Declined</h3>
        <p class="mt-2 text-gray-600 dark:text-slate-400">You have declined to sign this agreement.</p>
        <p class="mt-4 text-sm text-gray-500 dark:text-slate-400">If this was a mistake, please contact the agent.</p>
      </div>
    </div>

    <!-- Success State (just signed) -->
    <div v-else-if="justSigned" class="flex-1 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 text-center max-w-md">
        <CheckCircle class="mx-auto h-16 w-16 text-green-500" />
        <h3 class="mt-4 text-xl font-semibold text-gray-900 dark:text-white">Thank You!</h3>
        <p class="mt-2 text-gray-600 dark:text-slate-400">Your signature has been recorded successfully.</p>
        <div class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-left">
          <p class="text-sm text-blue-800 dark:text-blue-300">
            <strong>What happens next?</strong><br>
            Once all parties have signed, you will receive an email with the fully executed agreement attached.
          </p>
        </div>
      </div>
    </div>

    <!-- Main Signing Interface -->
    <div v-else-if="signingData" class="flex-1 flex flex-col overflow-auto">
      <!-- Document Viewer -->
      <div class="flex-shrink-0">
        <PdfViewer
          v-if="pdfUrl"
          :src="pdfUrl"
          class="w-full"
          style="height: calc(100vh - 280px); min-height: 300px;"
        />
        <div v-else class="flex items-center justify-center py-16 bg-white dark:bg-slate-900">
          <div class="text-center">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p class="text-sm text-gray-500 dark:text-slate-400">Loading document...</p>
          </div>
        </div>
      </div>

      <!-- Signature Panel at Bottom -->
      <div class="bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 shadow-lg">
        <div class="max-w-6xl mx-auto px-4 py-3">
          <!-- Single row layout on desktop, stacked on mobile -->
          <div class="flex flex-col md:flex-row gap-3 items-center">
            <!-- Signer Info - Compact inline -->
            <div class="flex-shrink-0 text-center md:text-left">
              <p class="text-xs text-gray-500 dark:text-slate-400">
                Signing as <span class="font-medium text-gray-900 dark:text-white">{{ signingData.signature.signer_name }}</span>
                <span class="text-gray-400 dark:text-slate-500 capitalize">({{ signingData.signature.signer_type }})</span>
              </p>
            </div>

            <!-- Compact Signature Pad - Limited width -->
            <div class="flex-1 w-full md:max-w-xs">
              <SignaturePad
                v-model="signature"
                label=""
                type-placeholder="Type your name to sign"
                compact
              />
            </div>

            <!-- Terms & Actions - Side by side -->
            <div class="flex flex-col sm:flex-row items-center gap-3 flex-shrink-0">
              <label class="flex items-center gap-2 text-xs max-w-xs">
                <input
                  type="checkbox"
                  v-model="agreedToTerms"
                  class="h-4 w-4 text-primary border-gray-300 dark:border-slate-600 rounded focus:ring-primary dark:bg-slate-900 flex-shrink-0"
                />
                <span class="text-gray-600 dark:text-slate-400">
                  I confirm this e-signature is legally binding
                </span>
              </label>
              <div class="flex gap-2">
                <button
                  type="button"
                  @click="submitSignature"
                  :disabled="!canSign || submitting"
                  class="px-5 py-2 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm whitespace-nowrap"
                  :class="canSign && !submitting ? 'bg-primary hover:bg-primary-dark' : 'bg-gray-400'"
                >
                  <span v-if="submitting" class="flex items-center justify-center">
                    <Loader2 class="animate-spin mr-2 h-4 w-4" />
                    Signing...
                  </span>
                  <span v-else class="flex items-center justify-center gap-1.5">
                    <Check class="w-4 h-4" />
                    Sign
                  </span>
                </button>
                <button
                  type="button"
                  @click="showDeclineModal = true"
                  :disabled="submitting"
                  class="px-3 py-2 text-red-600 dark:text-red-400 font-medium border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors text-sm disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

      <!-- Decline Modal -->
      <div v-if="showDeclineModal" class="fixed inset-0 bg-gray-600 dark:bg-slate-900 bg-opacity-50 dark:bg-opacity-70 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
        <div class="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md mx-4 p-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Decline to Sign</h3>
          <p class="text-sm text-gray-600 dark:text-slate-400 mb-4">
            Are you sure you want to decline to sign this agreement? Please provide a reason below.
          </p>
          <textarea
            v-model="declineReason"
            rows="3"
            placeholder="Please explain why you're declining to sign..."
            class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
          ></textarea>
          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              @click="showDeclineModal = false"
              class="px-4 py-2 text-gray-700 dark:text-slate-300 font-medium border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700"
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
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import SignaturePad from '../components/SignaturePad.vue'
import PdfViewer from '../components/PdfViewer.vue'
import { AlertTriangle, CheckCircle, XCircle, Download, Check, Loader2 } from 'lucide-vue-next'

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
const API_BASE = import.meta.env.VITE_API_URL
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

    // Transform API response to match expected structure
    signingData.value = {
      signature: {
        id: data.signatureId,
        signer_name: data.signerName,
        signer_email: data.signerEmail,
        signer_type: data.signerType,
        status: data.status,
        signed_at: data.signedAt,
        token_expires_at: data.tokenExpiresAt
      },
      agreement: {
        id: data.agreement.id,
        property_address: data.agreement.propertyAddress,
        language: data.agreement.language,
        template_type: data.agreement.templateType,
        agreementType: data.agreement.agreementType,
        rent_amount: data.agreement.rentAmount,
        deposit_amount: data.agreement.depositAmount,
        tenancy_start_date: data.agreement.tenancyStartDate,
        tenancy_end_date: data.agreement.tenancyEndDate
      },
      signers: data.signingStatus?.signatures || []
    }

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
  if (signingData.value.agreement.language === 'welsh') return 'Welsh Occupation Contract'
  const labels: Record<string, string> = {
    ast: 'Assured Shorthold Tenancy Agreement',
    apta: 'Assured Periodic Tenancy Agreement',
    company_let: 'Company Let Agreement',
    lodger: 'Lodger Agreement',
    holiday_let: 'Holiday Let Agreement'
  }
  return labels[signingData.value.agreement.agreementType] || 'Tenancy Agreement'
}

// Lifecycle
onMounted(() => {
  fetchSigningData()
})
</script>

<style scoped>
.text-primary {
  color: var(--color-primary);
}

.bg-primary {
  background-color: var(--color-primary);
}

.bg-primary-dark {
  background-color: #ea580c;
}

.border-primary {
  border-color: var(--color-primary);
}

.focus\:ring-primary:focus {
  --tw-ring-color: var(--color-primary);
}

.focus\:border-primary:focus {
  border-color: var(--color-primary);
}
</style>

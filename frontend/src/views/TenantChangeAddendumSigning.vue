<template>
  <div class="min-h-screen bg-gray-50 dark:bg-slate-800 py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-8">
        <div class="flex justify-center items-center gap-3 mb-4">
          <img src="/PropertyGooseLogo.png" alt="PropertyGoose" class="h-12 dark:hidden" />
          <img src="/PropertyGooseLogoDark.png" alt="PropertyGoose" class="h-12 hidden dark:block" />
        </div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Sign Change of Tenant Addendum</h1>
        <p class="mt-2 text-gray-600 dark:text-slate-400">Review and sign the tenancy addendum electronically</p>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="bg-white dark:bg-slate-800 rounded-lg shadow p-8 text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
        <p class="text-gray-600 dark:text-slate-400">Loading addendum details...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 px-6 py-4 rounded-lg">
        <div class="flex items-center">
          <AlertTriangle class="h-5 w-5 mr-2" />
          {{ error }}
        </div>
      </div>

      <!-- Already Signed State -->
      <div v-else-if="signingData?.status === 'signed'" class="bg-white dark:bg-slate-800 rounded-lg shadow p-8 text-center">
        <CheckCircle class="mx-auto h-16 w-16 text-green-500" />
        <h3 class="mt-4 text-xl font-semibold text-gray-900 dark:text-white">Addendum Already Signed</h3>
        <p class="mt-2 text-gray-600 dark:text-slate-400">You have already signed this addendum.</p>
        <p class="mt-4 text-sm text-gray-500 dark:text-slate-400">You will receive an email with the fully executed addendum once all parties have signed.</p>
      </div>

      <!-- Declined State -->
      <div v-else-if="signingData?.status === 'declined'" class="bg-white dark:bg-slate-800 rounded-lg shadow p-8 text-center">
        <XCircle class="mx-auto h-16 w-16 text-red-500" />
        <h3 class="mt-4 text-xl font-semibold text-gray-900 dark:text-white">Signature Declined</h3>
        <p class="mt-2 text-gray-600 dark:text-slate-400">You have declined to sign this addendum.</p>
        <p class="mt-4 text-sm text-gray-500 dark:text-slate-400">If this was a mistake, please contact the agent.</p>
      </div>

      <!-- Success State (just signed) -->
      <div v-else-if="justSigned" class="bg-white dark:bg-slate-800 rounded-lg shadow p-8 text-center">
        <CheckCircle class="mx-auto h-16 w-16 text-green-500" />
        <h3 class="mt-4 text-xl font-semibold text-gray-900 dark:text-white">Thank You!</h3>
        <p class="mt-2 text-gray-600 dark:text-slate-400">Your signature has been recorded successfully.</p>
        <div class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <p class="text-sm text-blue-800 dark:text-blue-300">
            <strong>What happens next?</strong><br>
            Once all parties have signed, the change of tenant will be completed and you will receive a confirmation email with the executed addendum attached.
          </p>
        </div>
      </div>

      <!-- Main Signing Interface -->
      <div v-else-if="signingData" class="space-y-6">
        <!-- Addendum Info Card -->
        <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <div class="flex items-start justify-between">
            <div>
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Change of Tenant Addendum</h2>
              <p class="mt-1 text-gray-600 dark:text-slate-400">{{ signingData.propertyAddress }}</p>
            </div>
            <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300 capitalize">
              {{ formatSignerType(signingData.signerType) }}
            </span>
          </div>

          <div class="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700 space-y-2">
            <p class="text-sm text-gray-600 dark:text-slate-400">
              <strong>You're signing as:</strong> {{ signingData.signerName }}
            </p>
            <p v-if="signingData.changeoverDate" class="text-sm text-gray-600 dark:text-slate-400">
              <strong>Changeover Date:</strong> {{ formatDate(signingData.changeoverDate) }}
            </p>
            <p class="text-sm text-gray-600 dark:text-slate-400">
              <strong>Incoming Tenant(s):</strong> {{ signingData.incomingTenantCount }} new tenant(s)
            </p>
          </div>
        </div>

        <!-- Addendum Details -->
        <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Addendum Details</h3>
          <div class="prose dark:prose-invert max-w-none text-sm text-gray-700 dark:text-slate-300 space-y-4">
            <p>
              This addendum to the tenancy agreement records a change of tenant(s) at the property located at <strong>{{ signingData.propertyAddress }}</strong>.
            </p>
            <p>
              By signing this addendum, you acknowledge and agree to the change in tenancy as outlined, including:
            </p>
            <ul class="list-disc pl-5 space-y-1">
              <li>The outgoing tenant(s) will no longer be parties to the tenancy agreement</li>
              <li>The incoming tenant(s) will become parties to the existing tenancy agreement</li>
              <li>The deposit protection details remain unchanged</li>
              <li>All other terms of the original tenancy agreement remain in full force and effect</li>
            </ul>
            <p>
              This is a legally binding addendum that forms part of the original tenancy agreement.
            </p>
          </div>
        </div>

        <!-- Signature Section -->
        <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Your Signature</h3>

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
                class="mt-1 h-4 w-4 text-orange-600 border-gray-300 dark:border-slate-600 rounded focus:ring-orange-500 dark:bg-slate-900"
              />
              <span class="ml-3 text-sm text-gray-600 dark:text-slate-400">
                I confirm that I have read and understood the change of tenant addendum above. I agree to be bound by its terms.
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
              :class="canSign && !submitting ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-400'"
            >
              <span v-if="submitting" class="flex items-center justify-center">
                <Loader2 class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                Signing...
              </span>
              <span v-else>Sign Addendum</span>
            </button>

            <button
              type="button"
              @click="showDeclineModal = true"
              :disabled="submitting"
              class="px-6 py-3 text-red-600 dark:text-red-400 font-semibold border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
            >
              Decline to Sign
            </button>
          </div>
        </div>
      </div>

      <!-- Decline Modal -->
      <div v-if="showDeclineModal" class="fixed inset-0 bg-gray-600 dark:bg-slate-900 bg-opacity-50 dark:bg-opacity-70 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
        <div class="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md mx-4 p-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Decline to Sign</h3>
          <p class="text-sm text-gray-600 dark:text-slate-400 mb-4">
            Are you sure you want to decline to sign this addendum? Please provide a reason below.
          </p>
          <textarea
            v-model="declineReason"
            rows="3"
            placeholder="Please explain why you're declining to sign..."
            class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-orange-500 focus:border-orange-500 dark:bg-slate-900 dark:text-white"
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import SignaturePad from '../components/SignaturePad.vue'
import { AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-vue-next'

const route = useRoute()
const token = route.params.token as string

// State
const loading = ref(true)
const error = ref<string | null>(null)
const signingData = ref<any>(null)
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

    const response = await fetch(`${API_BASE}/api/tenant-change/sign/${token}`)
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load signing data')
    }

    signingData.value = data
  } catch (err: any) {
    console.error('Error fetching signing data:', err)
    error.value = err.message || 'Failed to load addendum. The link may be invalid or expired.'
  } finally {
    loading.value = false
  }
}

const submitSignature = async () => {
  if (!canSign.value) return

  try {
    submitting.value = true

    const response = await fetch(`${API_BASE}/api/tenant-change/sign/${token}/sign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        signatureData: signature.value,
        signatureType: signature.value.startsWith('data:image') && signature.value.length > 1000 ? 'draw' : 'type',
        typedName: signature.value.startsWith('data:image') ? undefined : signature.value
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to submit signature')
    }

    justSigned.value = true
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

    const response = await fetch(`${API_BASE}/api/tenant-change/sign/${token}/decline`, {
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

const formatSignerType = (signerType: string) => {
  const labels: Record<string, string> = {
    'outgoing_tenant': 'Outgoing Tenant',
    'incoming_tenant': 'Incoming Tenant',
    'remaining_tenant': 'Remaining Tenant',
    'landlord_agent': 'Agent'
  }
  return labels[signerType] || signerType
}

// Lifecycle
onMounted(() => {
  fetchSigningData()
})
</script>

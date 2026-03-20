<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { CheckCircle, Clock, XCircle, RefreshCw, AlertTriangle, ChevronRight, Mail, Link, Check } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const API_URL = (import.meta.env.DEV && typeof window !== 'undefined' && window.location.hostname === 'localhost')
  ? ''
  : (import.meta.env.VITE_API_URL ?? '')

interface Signature {
  id: string
  signer_type: 'outgoing_tenant' | 'incoming_tenant' | 'remaining_tenant' | 'landlord_agent'
  signer_index: number
  signer_name: string
  signer_email: string
  status: 'pending' | 'sent' | 'viewed' | 'signed' | 'declined'
  signed_at: string | null
  last_email_sent_at: string | null
  email_send_count: number
  signing_token: string
}

interface TenantChange {
  id: string
  addendum_fully_signed_at: string | null
}

const props = defineProps<{
  tenantChange: TenantChange
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'next'): void
}>()

const authStore = useAuthStore()
const isLoading = ref(false)
const isResending = ref<string | null>(null)
const copiedId = ref<string | null>(null)
const error = ref('')
const signatures = ref<Signature[]>([])
const allSigned = ref(false)

function getSigningUrl(token: string): string {
  const baseUrl = window.location.origin
  return `${baseUrl}/sign-tenant-change/${token}`
}

async function copySigningLink(signature: Signature) {
  const url = getSigningUrl(signature.signing_token)
  await navigator.clipboard.writeText(url)
  copiedId.value = signature.id
  setTimeout(() => {
    copiedId.value = null
  }, 2000)
}

// Auto-refresh interval
let refreshInterval: number | null = null

async function fetchSigningStatus() {
  isLoading.value = true
  error.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenant-change/${props.tenantChange.id}/signing-status`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to fetch signing status')
    }

    const data = await response.json()
    // Sort signatures: outgoing first, then incoming, then remaining, then agent last
    const sortOrder: Record<string, number> = {
      'outgoing_tenant': 1,
      'incoming_tenant': 2,
      'remaining_tenant': 3,
      'landlord_agent': 4
    }
    signatures.value = (data.signatures || []).sort((a: Signature, b: Signature) => {
      const orderA = sortOrder[a.signer_type] || 5
      const orderB = sortOrder[b.signer_type] || 5
      if (orderA !== orderB) return orderA - orderB
      return a.signer_index - b.signer_index
    })
    allSigned.value = data.allSigned

    if (allSigned.value) {
      emit('next')
    }
  } catch (err: any) {
    error.value = err.message
  } finally {
    isLoading.value = false
  }
}

async function resendEmail(signatureId: string) {
  isResending.value = signatureId
  error.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenant-change/${props.tenantChange.id}/resend/${signatureId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to resend email')
    }

    // Refresh the status
    await fetchSigningStatus()
  } catch (err: any) {
    error.value = err.message
  } finally {
    isResending.value = null
  }
}

function getSignerTypeLabel(type: string): string {
  switch (type) {
    case 'outgoing_tenant': return 'Outgoing Tenant'
    case 'incoming_tenant': return 'Incoming Tenant'
    case 'remaining_tenant': return 'Remaining Tenant'
    case 'landlord_agent': return 'Landlord/Agent'
    default: return type
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'signed': return CheckCircle
    case 'declined': return XCircle
    case 'viewed':
    case 'sent': return Clock
    default: return Clock
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'signed': return 'text-green-500'
    case 'declined': return 'text-red-500'
    case 'viewed': return 'text-blue-500'
    case 'sent': return 'text-yellow-500'
    default: return 'text-gray-400'
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'signed': return 'Signed'
    case 'declined': return 'Declined'
    case 'viewed': return 'Viewed'
    case 'sent': return 'Email Sent'
    case 'pending': return 'Pending'
    default: return status
  }
}

onMounted(() => {
  fetchSigningStatus()
  // Auto-refresh every 30 seconds
  refreshInterval = window.setInterval(fetchSigningStatus, 30000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<template>
  <div class="space-y-6">
    <div class="text-center">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Awaiting Signatures
      </h3>
      <p class="text-sm text-gray-500 dark:text-slate-400">
        Track the signature status of all parties.
      </p>
    </div>

    <!-- Error -->
    <div v-if="error" class="p-4 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
      <div class="flex items-center gap-2 text-red-700 dark:text-red-400">
        <AlertTriangle class="w-4 h-4" />
        <span class="text-sm">{{ error }}</span>
      </div>
    </div>

    <!-- Progress Summary -->
    <div class="p-4 bg-orange-50 dark:bg-orange-900/30 rounded-lg border border-orange-200 dark:border-orange-800">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium text-orange-900 dark:text-orange-100">Signature Progress</span>
        <span class="text-sm text-orange-700 dark:text-orange-300">
          {{ signatures.filter(s => s.status === 'signed').length }} / {{ signatures.length }} signed
        </span>
      </div>
      <div class="w-full bg-orange-200 dark:bg-orange-800 rounded-full h-2">
        <div
          class="bg-orange-600 h-2 rounded-full transition-all duration-300"
          :style="{ width: `${signatures.length > 0 ? (signatures.filter(s => s.status === 'signed').length / signatures.length) * 100 : 0}%` }"
        ></div>
      </div>
    </div>

    <!-- Refresh Button -->
    <div class="flex justify-end">
      <button
        @click="fetchSigningStatus"
        :disabled="isLoading"
        class="px-3 py-1.5 text-sm text-gray-600 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 flex items-center gap-1"
      >
        <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
        Refresh
      </button>
    </div>

    <!-- Signatures List -->
    <div class="space-y-3">
      <div
        v-for="signature in signatures"
        :key="signature.id"
        class="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg"
      >
        <div class="flex items-start justify-between">
          <div class="flex items-start gap-3">
            <component
              :is="getStatusIcon(signature.status)"
              class="w-5 h-5 mt-0.5"
              :class="getStatusColor(signature.status)"
            />
            <div>
              <p class="font-medium text-gray-900 dark:text-white">{{ signature.signer_name }}</p>
              <p class="text-sm text-gray-500 dark:text-slate-400">
                {{ getSignerTypeLabel(signature.signer_type) }}
              </p>
              <p class="text-xs text-gray-400 dark:text-slate-500 mt-1">
                {{ signature.signer_email }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <span
              class="px-2 py-1 text-xs font-medium rounded-full"
              :class="{
                'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400': signature.status === 'signed',
                'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400': signature.status === 'declined',
                'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400': signature.status === 'viewed',
                'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400': signature.status === 'sent',
                'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300': signature.status === 'pending'
              }"
            >
              {{ getStatusLabel(signature.status) }}
            </span>

            <button
              v-if="signature.status !== 'signed' && signature.status !== 'declined'"
              @click="copySigningLink(signature)"
              class="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
              title="Copy signing link"
            >
              <Check v-if="copiedId === signature.id" class="w-4 h-4 text-green-500" />
              <Link v-else class="w-4 h-4" />
            </button>

            <button
              v-if="signature.status !== 'signed' && signature.status !== 'declined'"
              @click="resendEmail(signature.id)"
              :disabled="isResending === signature.id"
              class="p-2 text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-lg transition-colors"
              title="Resend signing email"
            >
              <Mail v-if="isResending !== signature.id" class="w-4 h-4" />
              <RefreshCw v-else class="w-4 h-4 animate-spin" />
            </button>
          </div>
        </div>

        <!-- Additional info -->
        <div v-if="signature.signed_at || signature.last_email_sent_at" class="mt-2 pl-8 text-xs text-gray-400 dark:text-slate-500">
          <span v-if="signature.signed_at">
            Signed at {{ new Date(signature.signed_at).toLocaleString('en-GB') }}
          </span>
          <span v-else-if="signature.last_email_sent_at">
            Email sent {{ new Date(signature.last_email_sent_at).toLocaleString('en-GB') }}
            <span v-if="signature.email_send_count > 1" class="text-orange-500">
              ({{ signature.email_send_count }} times)
            </span>
          </span>
        </div>
      </div>
    </div>

    <!-- Auto-refresh notice -->
    <p class="text-center text-xs text-gray-400 dark:text-slate-500">
      Status updates automatically every 30 seconds
    </p>

    <!-- Continue Button -->
    <div class="flex justify-end gap-3">
      <button
        v-if="allSigned"
        @click="emit('next')"
        class="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg flex items-center gap-2 transition-colors"
      >
        <CheckCircle class="w-4 h-4" />
        All Signed - Continue
        <ChevronRight class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>

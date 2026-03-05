<template>
  <div class="space-y-4">
    <!-- Loading Skeleton -->
    <div v-if="loading" class="animate-pulse">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <div class="h-6 w-24 bg-gray-200 dark:bg-slate-700 rounded-full"></div>
          <div class="h-4 w-32 bg-gray-100 dark:bg-slate-700 rounded"></div>
        </div>
        <div class="flex items-center gap-2">
          <div class="h-8 w-8 bg-gray-200 dark:bg-slate-700 rounded-lg"></div>
          <div class="h-8 w-8 bg-gray-200 dark:bg-slate-700 rounded-lg"></div>
        </div>
      </div>
      <div class="space-y-2 mb-4">
        <div class="h-4 w-20 bg-gray-200 dark:bg-slate-700 rounded"></div>
        <div class="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-gray-200 dark:bg-slate-700 rounded-full"></div>
            <div class="flex-1">
              <div class="h-4 w-32 bg-gray-200 dark:bg-slate-700 rounded mb-1"></div>
              <div class="h-3 w-24 bg-gray-100 dark:bg-slate-700 rounded"></div>
            </div>
          </div>
        </div>
        <div class="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-gray-200 dark:bg-slate-700 rounded-full"></div>
            <div class="flex-1">
              <div class="h-4 w-28 bg-gray-200 dark:bg-slate-700 rounded mb-1"></div>
              <div class="h-3 w-20 bg-gray-100 dark:bg-slate-700 rounded"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="h-10 w-full bg-gray-200 dark:bg-slate-700 rounded-lg"></div>
    </div>

    <!-- No Agreement State -->
    <div v-else-if="!agreement" class="text-center py-8 bg-gray-50 dark:bg-slate-800 rounded-lg">
      <FileText class="w-12 h-12 text-gray-400 dark:text-slate-500 mx-auto mb-3" />
      <p class="text-gray-600 dark:text-slate-400 mb-4">No agreement generated yet</p>
      <button
        @click="$emit('generate')"
        class="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90"
      >
        <FilePlus class="w-4 h-4" />
        Generate Agreement
      </button>
    </div>

    <!-- Agreement Exists -->
    <div v-else>
      <!-- Status Badge -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <span
            class="px-3 py-1 text-sm font-medium rounded-full"
            :class="statusClass"
          >
            {{ statusLabel }}
          </span>
          <span v-if="agreement.created_at" class="text-xs text-gray-500 dark:text-slate-400">
            Created {{ formatDate(agreement.created_at) }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <a
            v-if="displayPdfUrl"
            :href="displayPdfUrl"
            target="_blank"
            class="p-2 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
            title="View PDF"
          >
            <Eye class="w-4 h-4" />
          </a>
          <a
            v-if="displayPdfUrl"
            :href="displayPdfUrl"
            download
            class="p-2 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
            title="Download PDF"
          >
            <Download class="w-4 h-4" />
          </a>
        </div>
      </div>

      <!-- Signatures List -->
      <div v-if="signatures.length > 0" class="space-y-2 mb-4">
        <h4 class="text-sm font-medium text-gray-700 dark:text-slate-300">Signatures</h4>
        <div
          v-for="sig in signatures"
          :key="sig.id"
          class="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center"
              :class="(sig.signed_at || sig.status === 'signed') ? 'bg-green-100 dark:bg-green-900/50' : 'bg-gray-200 dark:bg-slate-700'"
            >
              <Check v-if="sig.signed_at || sig.status === 'signed'" class="w-4 h-4 text-green-600 dark:text-green-400" />
              <Clock v-else class="w-4 h-4 text-gray-500 dark:text-slate-400" />
            </div>
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ sig.signer_name }}</p>
              <p class="text-xs text-gray-500 dark:text-slate-400">
                {{ formatSignerType(sig.signer_type) }}
                <span v-if="sig.signed_at || sig.status === 'signed'" class="text-green-600 dark:text-green-400">
                  - Signed {{ formatDate(sig.signed_at || sig.signedAt) }}
                </span>
                <span v-else class="text-amber-600 dark:text-amber-400">
                  - Pending
                </span>
              </p>
            </div>
          </div>
          <button
            v-if="!(sig.signed_at || sig.status === 'signed')"
            @click="$emit('resend', sig)"
            :disabled="resending === sig.id"
            class="text-xs text-primary hover:text-primary/80"
          >
            {{ resending === sig.id ? 'Sending...' : 'Resend' }}
          </button>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-wrap gap-2">
        <!-- Draft State -->
        <template v-if="agreement.signing_status === 'draft'">
          <button
            @click="$emit('send')"
            :disabled="sending"
            class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-slate-600"
          >
            <Send class="w-4 h-4" />
            {{ sending ? 'Sending...' : 'Send for Signing' }}
          </button>
          <button
            @click="$emit('edit')"
            class="inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            <Pencil class="w-4 h-4" />
            Edit
          </button>
        </template>

        <!-- Sent / Pending Signatures / Partially Signed -->
        <template v-else-if="agreement.signing_status === 'sent' || agreement.signing_status === 'pending_signatures' || agreement.signing_status === 'partially_signed'">
          <button
            @click="$emit('resendAll')"
            :disabled="resending === 'all'"
            class="inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:bg-gray-100 dark:disabled:bg-slate-700"
          >
            <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': resending === 'all' }" />
            Resend to Unsigned
          </button>
          <button
            @click="$emit('recall')"
            :disabled="recalling"
            class="inline-flex items-center justify-center gap-2 px-4 py-2 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-600 font-medium rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 disabled:bg-gray-100 dark:disabled:bg-slate-700"
          >
            <RotateCcw class="w-4 h-4" />
            Recall & Edit
          </button>
        </template>

        <!-- Fully Signed -->
        <template v-else-if="agreement.signing_status === 'fully_signed'">
          <button
            @click="$emit('execute')"
            :disabled="executing"
            class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-slate-600"
          >
            <CheckCircle class="w-4 h-4" />
            {{ executing ? 'Executing...' : 'Execute Agreement' }}
          </button>
        </template>

        <!-- Executed -->
        <template v-else-if="agreement.signing_status === 'executed'">
          <div class="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg">
            <CheckCircle class="w-5 h-5" />
            <span class="font-medium">Agreement Executed</span>
            <span v-if="agreement.executed_at" class="text-sm">
              on {{ formatDate(agreement.executed_at) }}
            </span>
          </div>
        </template>

        <!-- Cancelled - Show option to edit/regenerate -->
        <template v-else-if="agreement.signing_status === 'cancelled'">
          <div class="flex-1 flex flex-col items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-400 rounded-lg">
            <span class="font-medium">Agreement Cancelled</span>
            <button
              @click="$emit('edit')"
              class="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90"
            >
              <Pencil class="w-4 h-4" />
              Edit & Regenerate
            </button>
          </div>
        </template>
      </div>

      <!-- Progress Indicator -->
      <div v-if="showProgress" class="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
        <div class="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 mb-2">
          <span>Signing Progress</span>
          <span>{{ signedCount }} / {{ signatures.length }} signed</span>
        </div>
        <div class="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
          <div
            class="bg-green-500 h-2 rounded-full transition-all duration-300"
            :style="{ width: `${progressPercent}%` }"
          ></div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  FileText, FilePlus, Eye, Download, Check, Clock, Send, Pencil,
  RefreshCw, RotateCcw, CheckCircle
} from 'lucide-vue-next'

interface Signature {
  id: string
  signer_name: string
  signer_type: 'landlord' | 'tenant' | 'guarantor'
  signer_email: string
  signed_at: string | null
  signedAt?: string | null
  status?: 'pending' | 'sent' | 'viewed' | 'signed' | 'declined'
}

const props = defineProps<{
  agreement: any
  signatures?: Signature[]
  loading?: boolean
  sending?: boolean
  resending?: string | null
  recalling?: boolean
  executing?: boolean
}>()

defineEmits<{
  generate: []
  send: []
  edit: []
  resend: [signature: Signature]
  resendAll: []
  recall: []
  execute: []
}>()

// Status styling
const statusClass = computed(() => {
  switch (props.agreement?.signing_status) {
    case 'draft':
      return 'bg-gray-100 dark:bg-gray-700/50 text-gray-800 dark:text-gray-200'
    case 'sent':
    case 'pending_signatures':
      return 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200'
    case 'partially_signed':
      return 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200'
    case 'fully_signed':
      return 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200'
    case 'executed':
      return 'bg-green-500 text-white'
    case 'cancelled':
      return 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200'
    default:
      return 'bg-gray-100 dark:bg-gray-700/50 text-gray-800 dark:text-gray-200'
  }
})

const statusLabel = computed(() => {
  switch (props.agreement?.signing_status) {
    case 'draft':
      return 'Draft'
    case 'sent':
    case 'pending_signatures':
      return 'Awaiting Signatures'
    case 'partially_signed':
      return 'Partially Signed'
    case 'fully_signed':
      return 'Fully Signed'
    case 'executed':
      return 'Executed'
    case 'cancelled':
      return 'Cancelled'
    default:
      return 'Unknown'
  }
})

// Signatures
const signatures = computed(() => props.signatures || [])

const signedCount = computed(() =>
  signatures.value.filter((s: any) => s.signed_at || s.status === 'signed').length
)

const progressPercent = computed(() => {
  if (signatures.value.length === 0) return 0
  return Math.round((signedCount.value / signatures.value.length) * 100)
})

const showProgress = computed(() =>
  ['sent', 'pending_signatures', 'partially_signed'].includes(props.agreement?.signing_status) &&
  signatures.value.length > 0
)

// Use signed PDF when available (for fully_signed or executed), otherwise fall back to unsigned PDF
const displayPdfUrl = computed(() => {
  if (!props.agreement) return null
  const status = props.agreement.signing_status
  // For signed agreements, prefer the signed PDF
  if (status === 'fully_signed' || status === 'executed') {
    return props.agreement.signed_pdf_url || props.agreement.pdf_url
  }
  // For other statuses, use the regular PDF
  return props.agreement.pdf_url
})

// Helpers
const formatSignerType = (type: string) => {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}
</script>

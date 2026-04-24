<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { FileText, Send, AlertTriangle, ChevronRight, ChevronLeft, CheckCircle, Upload, Loader2, FolderOpen } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { authFetch } from '@/lib/authFetch'

const API_URL = (import.meta.env.DEV && typeof window !== 'undefined' && window.location.hostname === 'localhost')
  ? ''
  : (import.meta.env.VITE_API_URL ?? '')

interface TenantChange {
  id: string
  tenancy_id: string
  changeover_date: string | null
  incoming_tenants: any[]
  outgoing_tenant_ids: string[]
  addendum_sent_at: string | null
}

interface TenancyDocument {
  id: string
  file_name: string
  tag: string
  description: string | null
  created_at: string
}

const props = defineProps<{
  tenantChange: TenantChange
  propertyAddress: string
  tenancyStartDate?: string | null
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'next'): void
  (e: 'back'): void
}>()

const authStore = useAuthStore()
const isSending = ref(false)
const error = ref('')
const addendumSent = ref(!!props.tenantChange.addendum_sent_at)

// Manual start date entry if missing
const manualStartDate = ref('')
const savingStartDate = ref(false)

async function saveStartDate() {
  if (!manualStartDate.value) return
  savingStartDate.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await authFetch(
      `${API_URL}/api/tenancies/records/${props.tenantChange.tenancy_id}`,
      {
        method: 'PUT',
        token,
        body: JSON.stringify({ startDate: manualStartDate.value })
      }
    )

    if (!response.ok) {
      throw new Error('Failed to save start date')
    }

    // Force a page reload to pick up the new date
    window.location.reload()
  } catch (err: any) {
    error.value = err.message
  } finally {
    savingStartDate.value = false
  }
}

// Original agreement state
const checkingAgreement = ref(true)
const agreementAvailable = ref(false)
const agreementUrl = ref<string | null>(null)
const uploadingAgreement = ref(false)

// Document picker state
const showDocumentPicker = ref(false)
const loadingDocuments = ref(false)
const tenancyDocuments = ref<TenancyDocument[]>([])
const selectingDocumentId = ref<string | null>(null)

async function checkOriginalAgreement() {
  checkingAgreement.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await authFetch(
      `${API_URL}/api/tenant-change/${props.tenantChange.id}/original-agreement`,
      { token }
    )

    if (response.ok) {
      const data = await response.json()
      agreementAvailable.value = data.available
      agreementUrl.value = data.url || null
    }
  } catch (err) {
    console.error('Failed to check original agreement:', err)
  } finally {
    checkingAgreement.value = false
  }
}

async function uploadAgreement(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  uploadingAgreement.value = true
  error.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const formData = new FormData()
    formData.append('file', file)

    const response = await authFetch(
      `${API_URL}/api/tenant-change/${props.tenantChange.id}/upload-agreement`,
      {
        method: 'POST',
        token,
        body: formData
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to upload agreement')
    }

    agreementAvailable.value = true
    const data = await response.json()
    agreementUrl.value = data.url || null
  } catch (err: any) {
    error.value = err.message
  } finally {
    uploadingAgreement.value = false
    if (input) input.value = ''
  }
}

async function openDocumentPicker() {
  showDocumentPicker.value = true
  loadingDocuments.value = true
  tenancyDocuments.value = []

  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await authFetch(
      `${API_URL}/api/tenant-change/${props.tenantChange.id}/tenancy-documents`,
      { token }
    )

    if (response.ok) {
      const data = await response.json()
      tenancyDocuments.value = data.documents || []
    }
  } catch (err) {
    console.error('Failed to load tenancy documents:', err)
  } finally {
    loadingDocuments.value = false
  }
}

async function selectDocument(doc: TenancyDocument) {
  selectingDocumentId.value = doc.id
  error.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await authFetch(
      `${API_URL}/api/tenant-change/${props.tenantChange.id}/select-agreement`,
      {
        method: 'POST',
        token,
        body: JSON.stringify({ documentId: doc.id })
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to select document')
    }

    const data = await response.json()
    agreementAvailable.value = true
    agreementUrl.value = data.url || null
    showDocumentPicker.value = false
  } catch (err: any) {
    error.value = err.message
  } finally {
    selectingDocumentId.value = null
  }
}

function formatTag(tag: string): string {
  const labels: Record<string, string> = {
    agreement: 'Agreement',
    gas: 'Gas Certificate',
    epc: 'EPC',
    reference: 'Reference',
    inventory: 'Inventory',
    insurance: 'Insurance',
    rent_notice: 'Rent Notice',
    notice: 'Notice',
    other: 'Other'
  }
  return labels[tag] || tag
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const canSend = computed(() => agreementAvailable.value && !isSending.value)

async function sendForSigning() {
  isSending.value = true
  error.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await authFetch(
      `${API_URL}/api/tenant-change/${props.tenantChange.id}/send-for-signing`,
      {
        method: 'POST',
        token
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to send addendum for signing')
    }

    addendumSent.value = true
    emit('next')
  } catch (err: any) {
    error.value = err.message
  } finally {
    isSending.value = false
  }
}

onMounted(() => {
  checkOriginalAgreement()
})
</script>

<template>
  <div class="space-y-6">
    <div class="text-center">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Addendum Review
      </h3>
      <p class="text-sm text-gray-500 dark:text-slate-400">
        Review the change of tenant addendum before sending for signatures.
      </p>
    </div>

    <!-- Error -->
    <div v-if="error" class="p-4 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
      <div class="flex items-center gap-2 text-red-700 dark:text-red-400">
        <AlertTriangle class="w-4 h-4" />
        <span class="text-sm">{{ error }}</span>
      </div>
    </div>

    <!-- Tenancy Start Date -->
    <div v-if="!props.tenancyStartDate" class="p-4 rounded-lg border bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800">
      <h5 class="font-medium text-amber-700 dark:text-amber-300 mb-2">Original Tenancy Start Date</h5>
      <p class="text-sm text-amber-600 dark:text-amber-400 mb-3">
        No start date found on this tenancy. Please enter it — this will appear on the addendum.
      </p>
      <input
        v-model="manualStartDate"
        type="date"
        class="w-full max-w-xs px-3 py-2 border border-amber-300 dark:border-amber-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
      />
      <button
        v-if="manualStartDate"
        @click="saveStartDate"
        :disabled="savingStartDate"
        class="ml-3 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50"
      >
        {{ savingStartDate ? 'Saving...' : 'Save' }}
      </button>
    </div>
    <div v-else class="p-4 rounded-lg border bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800">
      <div class="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
        <CheckCircle class="w-4 h-4" />
        Original Tenancy Start Date: {{ new Date(props.tenancyStartDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) }}
      </div>
    </div>

    <!-- Original Agreement Check -->
    <div class="p-4 rounded-lg border" :class="agreementAvailable ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800'">
      <h5 class="font-medium mb-2" :class="agreementAvailable ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'">
        Original Tenancy Agreement
      </h5>

      <div v-if="checkingAgreement" class="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
        <Loader2 class="w-4 h-4 animate-spin" />
        Checking for original agreement...
      </div>

      <div v-else-if="agreementAvailable" class="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
        <CheckCircle class="w-4 h-4" />
        Original agreement: Available
        <a v-if="agreementUrl" :href="agreementUrl" target="_blank" class="ml-2 underline hover:no-underline">Preview</a>
      </div>

      <div v-else class="space-y-3">
        <p class="text-sm text-amber-700 dark:text-amber-400">
          No original agreement found for this tenancy. Upload a PDF or select from existing tenancy documents.
        </p>
        <div class="flex flex-wrap gap-2">
          <label class="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 border border-amber-300 dark:border-amber-600 rounded-lg cursor-pointer hover:bg-amber-50 dark:hover:bg-slate-600 transition-colors">
            <Upload class="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span class="text-sm font-medium text-amber-700 dark:text-amber-300">
              {{ uploadingAgreement ? 'Uploading...' : 'Upload PDF' }}
            </span>
            <input
              type="file"
              accept="application/pdf"
              class="hidden"
              :disabled="uploadingAgreement"
              @change="uploadAgreement"
            />
          </label>

          <button
            type="button"
            @click="openDocumentPicker"
            class="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 border border-amber-300 dark:border-amber-600 rounded-lg hover:bg-amber-50 dark:hover:bg-slate-600 transition-colors"
          >
            <FolderOpen class="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span class="text-sm font-medium text-amber-700 dark:text-amber-300">Select from Documents</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Document Picker Modal -->
    <div v-if="showDocumentPicker" class="fixed inset-0 bg-gray-600 dark:bg-slate-900 bg-opacity-50 dark:bg-opacity-70 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div class="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
        <div class="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Select from Tenancy Documents</h3>
          <button @click="showDocumentPicker = false" class="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 text-xl leading-none">&times;</button>
        </div>

        <div class="p-4 overflow-y-auto flex-1">
          <div v-if="loadingDocuments" class="flex items-center justify-center py-8">
            <Loader2 class="w-6 h-6 animate-spin text-orange-500" />
          </div>

          <div v-else-if="tenancyDocuments.length === 0" class="text-center py-8 text-sm text-gray-500 dark:text-slate-400">
            No PDF documents found for this tenancy.
          </div>

          <div v-else class="space-y-2">
            <button
              v-for="doc in tenancyDocuments"
              :key="doc.id"
              @click="selectDocument(doc)"
              :disabled="selectingDocumentId === doc.id"
              class="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors disabled:opacity-50"
            >
              <div class="flex items-center gap-3">
                <FileText class="w-5 h-5 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ doc.file_name }}</p>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 rounded">{{ formatTag(doc.tag) }}</span>
                    <span class="text-xs text-gray-400 dark:text-slate-500">{{ formatDate(doc.created_at) }}</span>
                  </div>
                  <p v-if="doc.description" class="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">{{ doc.description }}</p>
                </div>
                <Loader2 v-if="selectingDocumentId === doc.id" class="w-4 h-4 animate-spin text-orange-500 flex-shrink-0" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Addendum Preview -->
    <div class="p-6 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
      <div class="flex items-start gap-4 mb-6">
        <div class="p-3 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
          <FileText class="w-8 h-8 text-orange-600 dark:text-orange-400" />
        </div>
        <div>
          <h4 class="font-semibold text-gray-900 dark:text-white">Change of Tenant Addendum</h4>
          <p class="text-sm text-gray-500 dark:text-slate-400">Legally binding addendum to the tenancy agreement</p>
        </div>
      </div>

      <div class="space-y-4 text-sm">
        <div class="p-3 bg-white dark:bg-slate-700 rounded-lg">
          <p class="text-gray-500 dark:text-slate-400">Property Address</p>
          <p class="font-medium text-gray-900 dark:text-white">{{ propertyAddress }}</p>
        </div>

        <div class="p-3 bg-white dark:bg-slate-700 rounded-lg">
          <p class="text-gray-500 dark:text-slate-400">Changeover Date</p>
          <p class="font-medium text-gray-900 dark:text-white">
            {{ tenantChange.changeover_date ? new Date(tenantChange.changeover_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not set' }}
          </p>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="p-3 bg-red-50 dark:bg-red-900/30 rounded-lg">
            <p class="text-red-600 dark:text-red-400 text-xs uppercase font-medium mb-1">Outgoing</p>
            <p class="font-medium text-gray-900 dark:text-white">
              {{ tenantChange.outgoing_tenant_ids.length }} tenant(s)
            </p>
          </div>
          <div class="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
            <p class="text-green-600 dark:text-green-400 text-xs uppercase font-medium mb-1">Incoming</p>
            <p class="font-medium text-gray-900 dark:text-white">
              {{ tenantChange.incoming_tenants.length }} tenant(s)
            </p>
          </div>
        </div>
      </div>

      <!-- Document Contents Preview -->
      <div class="mt-6 pt-6 border-t border-gray-200 dark:border-slate-600">
        <h5 class="font-medium text-gray-900 dark:text-white mb-3">The addendum will include:</h5>
        <ul class="space-y-2 text-sm text-gray-600 dark:text-slate-300">
          <li class="flex items-start gap-2">
            <span class="text-orange-500">1.</span>
            Reference to the original tenancy agreement
          </li>
          <li class="flex items-start gap-2">
            <span class="text-orange-500">2.</span>
            Names of all outgoing and incoming tenants
          </li>
          <li class="flex items-start gap-2">
            <span class="text-orange-500">3.</span>
            Effective date of the change ({{ tenantChange.changeover_date ? new Date(tenantChange.changeover_date).toLocaleDateString('en-GB') : 'TBC' }})
          </li>
          <li class="flex items-start gap-2">
            <span class="text-orange-500">4.</span>
            Confirmation of ongoing deposit protection
          </li>
          <li class="flex items-start gap-2">
            <span class="text-orange-500">5.</span>
            Declarations and inventory condition acknowledgement
          </li>
          <li class="flex items-start gap-2">
            <span class="text-orange-500">6.</span>
            Signature blocks for all parties
          </li>
        </ul>
      </div>
    </div>

    <!-- Signers Info -->
    <div class="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
      <h5 class="font-medium text-blue-700 dark:text-blue-300 mb-2">Signatures Required</h5>
      <p class="text-sm text-blue-600 dark:text-blue-400">
        The addendum will be sent to all parties for electronic signature:
      </p>
      <ul class="mt-2 text-sm text-blue-700 dark:text-blue-300 space-y-1">
        <li>&bull; {{ tenantChange.outgoing_tenant_ids.length }} outgoing tenant(s)</li>
        <li>&bull; {{ tenantChange.incoming_tenants.length }} incoming tenant(s)</li>
        <li>&bull; Remaining tenant(s) on the tenancy</li>
        <li>&bull; Landlord/Agent representative</li>
      </ul>
    </div>

    <!-- Actions -->
    <div class="flex justify-between gap-3">
      <button
        @click="emit('back')"
        class="px-6 py-2 text-gray-700 dark:text-slate-300 font-medium border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors"
      >
        <ChevronLeft class="w-4 h-4" />
        Back
      </button>

      <button
        v-if="!addendumSent"
        @click="sendForSigning"
        :disabled="!canSend"
        class="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
      >
        <Send class="w-4 h-4" />
        {{ isSending ? 'Sending...' : 'Send for Signing' }}
      </button>

      <button
        v-else
        @click="emit('next')"
        class="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg flex items-center gap-2 transition-colors"
      >
        Continue
        <ChevronRight class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>

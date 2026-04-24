<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/60 backdrop-blur-sm"
          @click="!serving && emit('close')"
        />

        <!-- Modal -->
        <div class="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-red-50 to-amber-50">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <Send class="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 class="text-lg font-semibold text-gray-900">Serve Section 8 Notice</h2>
                  <p class="text-sm text-gray-600">Send notice to tenant(s) with compliance documents</p>
                </div>
              </div>
              <button
                v-if="!serving"
                @click="emit('close')"
                class="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white/50 transition-colors"
              >
                <X class="w-5 h-5" />
              </button>
            </div>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-6">
            <!-- Loading state -->
            <div v-if="loading" class="flex items-center justify-center py-12">
              <Loader2 class="w-8 h-8 text-red-500 animate-spin" />
            </div>

            <div v-else class="space-y-6">
              <!-- Notice Summary -->
              <div class="bg-gray-50 rounded-lg p-4">
                <h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Notice Details</h3>
                <div class="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p class="text-gray-500">Document Reference</p>
                    <p class="font-medium text-gray-900">{{ notice?.document_ref }}</p>
                  </div>
                  <div>
                    <p class="text-gray-500">Grounds Cited</p>
                    <p class="font-medium text-gray-900">{{ notice?.ground_numbers }}</p>
                  </div>
                  <div>
                    <p class="text-gray-500">Service Date</p>
                    <p class="font-medium text-gray-900">{{ formatDate(notice?.service_date) }}</p>
                  </div>
                  <div>
                    <p class="text-gray-500">Earliest Court Date</p>
                    <p class="font-medium text-gray-900">{{ formatDate(notice?.earliest_court_date) }}</p>
                  </div>
                </div>
              </div>

              <!-- Document Selection -->
              <div>
                <h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
                  Compliance Documents to Attach
                </h3>
                <p class="text-sm text-gray-500 mb-4">
                  Select which compliance documents to include with the notice email. The Section 8 notice PDF will always be attached.
                </p>

                <div v-if="documents.length === 0" class="text-sm text-gray-500 italic py-4 text-center bg-gray-50 rounded-lg">
                  No additional compliance documents available.
                </div>

                <div v-else class="space-y-2">
                  <label
                    v-for="doc in documents"
                    :key="doc.id"
                    class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all"
                    :class="selectedDocIds.includes(doc.id)
                      ? 'border-red-500 bg-red-50 ring-1 ring-red-500'
                      : 'border-gray-200 hover:border-gray-300'"
                  >
                    <input
                      type="checkbox"
                      :checked="selectedDocIds.includes(doc.id)"
                      @change="toggleDocument(doc.id)"
                      class="w-4 h-4 text-red-600 focus:ring-red-500 rounded"
                    />
                    <div class="flex-1">
                      <p class="font-medium text-sm text-gray-900">{{ doc.name }}</p>
                      <p class="text-xs text-gray-500">{{ getDocTypeLabel(doc.type) }}</p>
                    </div>
                    <component
                      :is="getDocIcon(doc.type)"
                      class="w-5 h-5 text-gray-400"
                    />
                  </label>
                </div>
              </div>

              <!-- Additional File Upload -->
              <div>
                <h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
                  Additional Attachments <span class="text-gray-400 font-normal">(Optional)</span>
                </h3>
                <p class="text-sm text-gray-500 mb-4">
                  Upload any additional documents to include with the notice email.
                </p>

                <div class="space-y-3">
                  <!-- File input -->
                  <div class="flex items-center gap-3">
                    <label class="flex-1 cursor-pointer">
                      <div class="flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-red-400 transition-colors">
                        <Paperclip class="w-5 h-5 text-gray-400 mr-2" />
                        <span class="text-sm text-gray-600">Click to add files</span>
                      </div>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        class="hidden"
                        @change="handleFileSelect"
                      />
                    </label>
                  </div>

                  <!-- Selected files list -->
                  <div v-if="additionalFiles.length > 0" class="space-y-2">
                    <div
                      v-for="(file, index) in additionalFiles"
                      :key="index"
                      class="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                    >
                      <div class="flex items-center gap-2">
                        <FileText class="w-4 h-4 text-gray-400" />
                        <span class="text-sm text-gray-700">{{ file.name }}</span>
                        <span class="text-xs text-gray-400">({{ formatFileSize(file.size) }})</span>
                      </div>
                      <button
                        @click="removeFile(index)"
                        class="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Custom Message -->
              <div>
                <h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
                  Email Message <span class="text-gray-400 font-normal">(Optional)</span>
                </h3>
                <textarea
                  v-model="emailMessage"
                  rows="6"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                  placeholder="Leave blank to use the default formal notice message..."
                ></textarea>
              </div>

              <!-- Warning -->
              <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div class="flex items-start gap-3">
                  <AlertTriangle class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p class="font-semibold text-amber-800">Important Legal Notice</p>
                    <p class="text-sm text-amber-700 mt-1">
                      By clicking "Serve Notice", the Section 8 notice will be officially served to all active tenants
                      via email. A copy will be sent to your registered email address. This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <button
              @click="emit('close')"
              :disabled="serving"
              class="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              @click="handleServe"
              :disabled="serving"
              class="px-6 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Loader2 v-if="serving" class="w-4 h-4 animate-spin" />
              <Send v-else class="w-4 h-4" />
              {{ serving ? 'Serving...' : 'Serve Notice' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { Send, X, Loader2, AlertTriangle, FileText, Home, Shield, Flame, Zap, Book, Paperclip } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'vue-toastification'
import { API_URL } from '@/lib/apiUrl'
import { authFetch } from '@/lib/authFetch'
interface Props {
  isOpen: boolean
  noticeId: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  served: []
}>()

interface Document {
  id: string
  name: string
  type: string
  filePath: string
}

interface Notice {
  id: string
  document_ref: string
  ground_numbers: string
  service_date: string
  earliest_court_date: string
  total_arrears: number
}

const authStore = useAuthStore()
const toast = useToast()

const loading = ref(true)
const serving = ref(false)
const notice = ref<Notice | null>(null)
const documents = ref<Document[]>([])
const selectedDocIds = ref<string[]>([])
const emailMessage = ref('')
const additionalFiles = ref<File[]>([])

// File handling functions
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_FILES = 10

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files) {
    const files = Array.from(target.files)

    // Check file count limit
    if (additionalFiles.value.length + files.length > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} files allowed`)
      target.value = ''
      return
    }

    // Check file sizes and filter valid files
    const validFiles: File[] = []
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} is too large. Maximum size is 10MB.`)
      } else {
        validFiles.push(file)
      }
    }

    additionalFiles.value.push(...validFiles)
    target.value = '' // Reset input so same file can be selected again
  }
}

function removeFile(index: number) {
  additionalFiles.value.splice(index, 1)
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// Pre-select all documents by default
watch(() => documents.value, (docs) => {
  selectedDocIds.value = docs.map(d => d.id)
}, { immediate: true })

watch(() => props.isOpen, (isOpen) => {
  if (isOpen && props.noticeId) {
    // Reset state when modal opens
    additionalFiles.value = []
    emailMessage.value = ''
    loadDocuments()
  }
})

onMounted(() => {
  if (props.isOpen && props.noticeId) {
    loadDocuments()
  }
})

async function loadDocuments() {
  if (!props.noticeId) return

  loading.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    // Step 1: Get the notice details (includes tenancy_id)
    const noticeResponse = await authFetch(`${API_URL}/api/legal/section8-notices/${props.noticeId}/documents`, {
      token,
    })

    if (!noticeResponse.ok) {
      throw new Error('Failed to load notice')
    }

    const noticeData = await noticeResponse.json()
    notice.value = noticeData.notice || null

    // Step 2: Get tenancy to find property_id
    if (noticeData.notice?.tenancy_id) {
      const tenancyResponse = await authFetch(`${API_URL}/api/tenancies/records/${noticeData.notice.tenancy_id}`, {
        token,
      })

      if (tenancyResponse.ok) {
        const tenancyData = await tenancyResponse.json()
        const propertyId = tenancyData.tenancy?.property_id

        // Step 3: Get property data (same as TenancyDrawer)
        if (propertyId) {
          const propertyResponse = await authFetch(`${API_URL}/api/properties/${propertyId}`, {
            token,
          })

          if (propertyResponse.ok) {
            const propertyData = await propertyResponse.json()
            const compliance = propertyData.compliance || []

            // Extract compliance documents (same as TenancyDrawer)
            const complianceDocs: Document[] = []
            for (const record of compliance) {
              if (record.status === 'valid' || record.status === 'expiring_soon') {
                const recordDocs = record.documents || []
                for (const doc of recordDocs) {
                  complianceDocs.push({
                    id: `compliance-${record.id}-${doc.id}`,
                    name: doc.file_name || getDocTypeLabel(record.compliance_type),
                    type: record.compliance_type,
                    filePath: doc.file_path || ''
                  })
                }
              }
            }

            // Add signed agreement if available
            if (tenancyData.tenancy?.agreement_pdf_url) {
              complianceDocs.push({
                id: 'agreement',
                name: 'Signed Tenancy Agreement',
                type: 'tenancy_agreement',
                filePath: tenancyData.tenancy.agreement_pdf_url
              })
            }

            documents.value = complianceDocs
            selectedDocIds.value = complianceDocs.map(d => d.id)
          }
        }
      }
    }
  } catch (error: any) {
    console.error('Error loading documents:', error)
    toast.error(error.message || 'Failed to load documents')
  } finally {
    loading.value = false
  }
}

function toggleDocument(docId: string) {
  const index = selectedDocIds.value.indexOf(docId)
  if (index === -1) {
    selectedDocIds.value.push(docId)
  } else {
    selectedDocIds.value.splice(index, 1)
  }
}

async function handleServe() {
  if (!props.noticeId) return

  serving.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    // Use FormData to support file uploads
    const formData = new FormData()
    formData.append('selectedDocumentIds', JSON.stringify(selectedDocIds.value))
    if (emailMessage.value) {
      formData.append('emailMessage', emailMessage.value)
    }

    // Add additional files
    for (const file of additionalFiles.value) {
      formData.append('additionalFiles', file)
    }

    const response = await authFetch(`${API_URL}/api/legal/section8-notices/${props.noticeId}/serve`, {
      method: 'POST',
      token,
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to serve notice')
    }

    const result = await response.json()
    toast.success(`Section 8 notice served to ${result.emailsSent} tenant(s)`)

    // Clear additional files on success
    additionalFiles.value = []

    emit('served')
    emit('close')
  } catch (error: any) {
    console.error('Error serving notice:', error)
    toast.error(error.message || 'Failed to serve notice')
  } finally {
    serving.value = false
  }
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function getDocTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    gas_safety: 'Gas Safety Certificate',
    epc: 'Energy Performance Certificate',
    eicr: 'Electrical Safety Certificate',
    fire_safety: 'Fire Safety Certificate',
    legionella: 'Legionella Risk Assessment',
    smoke_alarm: 'Smoke & CO Alarms Certificate',
    tenancy_agreement: 'Signed Tenancy Agreement',
    how_to_rent: 'Government Guide',
  }
  return labels[type] || type
}

function getDocIcon(type: string) {
  const icons: Record<string, any> = {
    gas_safety: Flame,
    epc: Home,
    eicr: Zap,
    tenancy_agreement: FileText,
    how_to_rent: Book,
  }
  return icons[type] || Shield
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.95) translateY(10px);
}
</style>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-sm"
          @click="close"
        />
        <div class="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-h-[90vh] flex flex-col">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Bulk Email Tenants</h2>
              <p class="text-sm text-gray-500 dark:text-slate-400">
                {{ tenancyCount }} {{ tenancyCount === 1 ? 'tenancy' : 'tenancies' }} selected &middot; {{ tenantCount }} {{ tenantCount === 1 ? 'tenant' : 'tenants' }} will receive this email
              </p>
            </div>
            <button
              @click="close"
              class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-6 space-y-5">
            <!-- Info Banner -->
            <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p class="text-sm text-blue-800 dark:text-blue-300 flex items-center gap-2">
                <Shield class="w-4 h-4 flex-shrink-0" />
                Each tenant receives their own personalised email via BCC. Tenant details are never shared between recipients.
              </p>
            </div>

            <!-- Template Selection -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Email Template</label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="template in templates"
                  :key="template.key"
                  @click="selectTemplate(template)"
                  class="flex items-center gap-2 p-3 border rounded-lg text-left transition-all text-sm"
                  :class="selectedTemplate?.key === template.key
                    ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary'
                    : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 text-gray-700 dark:text-slate-300'"
                >
                  <component :is="template.icon" class="w-4 h-4 flex-shrink-0" />
                  <span>{{ template.label }}</span>
                </button>
              </div>
            </div>

            <!-- Subject -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Subject</label>
              <input
                v-model="subject"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-primary focus:border-primary text-sm"
                placeholder="Email subject..."
              />
            </div>

            <!-- Message -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Message</label>
              <textarea
                v-model="message"
                rows="8"
                class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-primary focus:border-primary text-sm resize-none"
                placeholder="Enter your message..."
              />
              <p class="text-xs text-gray-500 dark:text-slate-400 mt-1">
                Variables: <code class="bg-gray-100 dark:bg-slate-700 px-1 rounded text-gray-600 dark:text-slate-300">{tenant_name}</code>, <code class="bg-gray-100 dark:bg-slate-700 px-1 rounded text-gray-600 dark:text-slate-300">{property_address}</code>, <code class="bg-gray-100 dark:bg-slate-700 px-1 rounded text-gray-600 dark:text-slate-300">{agent_name}</code>, <code class="bg-gray-100 dark:bg-slate-700 px-1 rounded text-gray-600 dark:text-slate-300">{company_name}</code>
              </p>
            </div>

            <!-- Attachments -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Attachments</label>
              <div
                class="border-2 border-dashed border-gray-200 dark:border-slate-600 rounded-lg p-4 text-center hover:border-gray-300 dark:hover:border-slate-500 transition-colors"
                @dragover.prevent
                @drop.prevent="handleFileDrop"
              >
                <input
                  ref="fileInputRef"
                  type="file"
                  multiple
                  class="hidden"
                  @change="handleFileSelect"
                />
                <button
                  type="button"
                  @click="(fileInputRef as HTMLInputElement)?.click()"
                  class="text-sm text-primary hover:text-primary/80 font-medium"
                >
                  Click to upload or drag and drop
                </button>
                <p class="text-xs text-gray-500 dark:text-slate-400 mt-1">PDF, DOC, DOCX, JPG, PNG (max 10MB each)</p>
              </div>
              <div v-if="attachments.length > 0" class="mt-2 space-y-1">
                <div
                  v-for="(file, idx) in attachments"
                  :key="idx"
                  class="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-slate-800 rounded-lg"
                >
                  <div class="flex items-center gap-2 text-sm">
                    <Paperclip class="w-4 h-4 text-gray-400" />
                    <span class="text-gray-700 dark:text-slate-300 truncate max-w-xs">{{ file.name }}</span>
                    <span class="text-gray-400 text-xs">({{ formatFileSize(file.size) }})</span>
                  </div>
                  <button
                    @click="attachments.splice(idx, 1)"
                    class="p-1 text-gray-400 hover:text-red-500"
                  >
                    <X class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-between items-center">
            <p class="text-xs text-gray-500 dark:text-slate-400">
              Replies will go to your registered email
            </p>
            <div class="flex gap-3">
              <button
                @click="close"
                :disabled="sending"
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                @click="sendBulkEmail"
                :disabled="!canSend || sending"
                class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <Loader2 v-if="sending" class="w-4 h-4 animate-spin" />
                <Send v-else class="w-4 h-4" />
                {{ sending ? 'Sending...' : `Send to ${tenantCount} Tenants` }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '@/stores/auth'
import {
  X, Send, Loader2, Paperclip, Shield,
  Megaphone, Wrench, Eye, Clock, Calendar
} from 'lucide-vue-next'
import { API_URL } from '@/lib/apiUrl'

interface EmailTemplate {
  key: string
  label: string
  icon: any
  subject: string
  body: string
}

const props = defineProps<{
  isOpen: boolean
  tenancyIds: string[]
  tenancyCount: number
  tenantCount: number
}>()

const emit = defineEmits<{
  close: []
  success: []
}>()

const toast = useToast()
const authStore = useAuthStore()

const subject = ref('')
const message = ref('')
const selectedTemplate = ref<EmailTemplate | null>(null)
const attachments = ref<File[]>([])
const sending = ref(false)
const fileInputRef = ref<HTMLInputElement>()

const templates: EmailTemplate[] = [
  {
    key: 'general_announcement',
    label: 'General Announcement',
    icon: Megaphone,
    subject: 'Important Update - {{ company_name }}',
    body: `Dear {{ tenant_name }},

We are writing to inform you of an important update regarding your tenancy at {{ property_address }}.

[Your message here]

If you have any questions, please don't hesitate to contact us.

Kind regards,
{{ agent_name }}
{{ company_name }}`
  },
  {
    key: 'viewing_request',
    label: 'Viewing Request',
    icon: Eye,
    subject: 'Property Viewing Request - {{ property_address }}',
    body: `Dear {{ tenant_name }},

We have received a request to conduct a viewing at {{ property_address }}.

Please let us know your availability for the proposed viewing by responding to this email.

Kind regards,
{{ agent_name }}
{{ company_name }}`
  },
  {
    key: 'maintenance_visit',
    label: 'Maintenance Visit',
    icon: Wrench,
    subject: 'Scheduled Maintenance Visit - {{ property_address }}',
    body: `Dear {{ tenant_name }},

We are writing to inform you of a scheduled maintenance visit at {{ property_address }}.

A contractor will need access to the property to carry out the necessary work. Please ensure someone is available to provide access at the agreed time.

Kind regards,
{{ agent_name }}
{{ company_name }}`
  },
  {
    key: 'rent_reminder',
    label: 'Rent Reminder',
    icon: Clock,
    subject: 'Rent Payment Reminder - {{ property_address }}',
    body: `Dear {{ tenant_name }},

This is a friendly reminder that your rent payment for {{ property_address }} is due.

Please ensure payment is made by the due date to avoid any late payment fees.

If you have already made the payment, please disregard this message.

Kind regards,
{{ agent_name }}
{{ company_name }}`
  }
]

// Reset on open
watch(() => props.isOpen, (open) => {
  if (open) {
    subject.value = ''
    message.value = ''
    selectedTemplate.value = null
    attachments.value = []
  }
})

const canSend = computed(() =>
  subject.value.trim() && message.value.trim() && props.tenancyIds.length > 0
)

function selectTemplate(template: EmailTemplate) {
  selectedTemplate.value = template
  const agentName = authStore.user?.user_metadata?.full_name || authStore.user?.email?.split('@')[0] || 'The Team'
  const companyName = authStore.company?.name || 'PropertyGoose'

  subject.value = template.subject
    .replace(/\{\{\s*agent_name\s*\}\}/g, agentName)
    .replace(/\{\{\s*company_name\s*\}\}/g, companyName)

  message.value = template.body
    .replace(/\{\{\s*agent_name\s*\}\}/g, agentName)
    .replace(/\{\{\s*company_name\s*\}\}/g, companyName)
}

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) addFiles(Array.from(input.files))
  input.value = ''
}

function handleFileDrop(e: DragEvent) {
  if (e.dataTransfer?.files) addFiles(Array.from(e.dataTransfer.files))
}

function addFiles(files: File[]) {
  const maxSize = 10 * 1024 * 1024
  const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png']
  for (const file of files) {
    if (file.size > maxSize) { toast.error(`${file.name} is too large (max 10MB)`); continue }
    if (!allowedTypes.includes(file.type)) { toast.error(`${file.name} is not a supported file type`); continue }
    attachments.value.push(file)
  }
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

async function sendBulkEmail() {
  if (!canSend.value) return
  sending.value = true

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const formData = new FormData()
    formData.append('tenancyIds', JSON.stringify(props.tenancyIds))
    formData.append('subject', subject.value)
    formData.append('message', message.value)
    formData.append('templateKey', selectedTemplate.value?.key || 'custom')

    for (const file of attachments.value) {
      formData.append('attachments', file)
    }

    const response = await fetch(`${API_URL}/api/tenancies/records/bulk-email`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to send emails')
    }

    const data = await response.json()
    toast.success(`Email sent to ${data.sentCount} tenant(s) across ${data.tenancyCount} tenancies`)
    emit('success')
    emit('close')
  } catch (error: any) {
    console.error('Error sending bulk email:', error)
    toast.error(error.message || 'Failed to send emails')
  } finally {
    sending.value = false
  }
}

function close() {
  if (!sending.value) emit('close')
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>

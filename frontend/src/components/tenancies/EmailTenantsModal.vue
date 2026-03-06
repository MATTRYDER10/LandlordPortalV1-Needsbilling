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
        <div class="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl max-h-[90vh] flex flex-col">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 class="text-lg font-semibold text-gray-900">Email Tenants</h2>
              <p class="text-sm text-gray-500">{{ propertyAddress }}</p>
            </div>
            <button
              @click="close"
              class="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-6 space-y-5">
            <!-- Recipients -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Recipients</label>
              <div class="space-y-2">
                <div
                  v-for="tenant in tenants"
                  :key="tenant.id"
                  class="flex items-center gap-3"
                >
                  <input
                    type="checkbox"
                    :id="`tenant-${tenant.id}`"
                    v-model="selectedTenantIds"
                    :value="tenant.id"
                    :disabled="!tenant.email"
                    class="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                  />
                  <label
                    :for="`tenant-${tenant.id}`"
                    class="flex items-center gap-2 text-sm"
                    :class="tenant.email ? 'text-gray-900' : 'text-gray-400'"
                  >
                    <span>{{ tenant.first_name }} {{ tenant.last_name }}</span>
                    <span v-if="tenant.email" class="text-gray-500">({{ tenant.email }})</span>
                    <span v-else class="text-red-500 text-xs">(No email)</span>
                  </label>
                </div>
              </div>
              <p v-if="selectedTenantIds.length === 0" class="text-xs text-red-500 mt-1">
                Select at least one recipient
              </p>
            </div>

            <!-- Template Selection -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Email Template</label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="template in templates"
                  :key="template.key"
                  @click="selectTemplate(template)"
                  class="flex items-center gap-2 p-3 border rounded-lg text-left transition-all text-sm"
                  :class="selectedTemplate?.key === template.key
                    ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'"
                >
                  <component :is="template.icon" class="w-4 h-4 flex-shrink-0" />
                  <span>{{ template.label }}</span>
                </button>
              </div>
            </div>

            <!-- Subject -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                v-model="subject"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary text-sm"
                placeholder="Email subject..."
              />
            </div>

            <!-- Message -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                v-model="message"
                rows="6"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary text-sm resize-none"
                placeholder="Enter your message..."
              />
              <p class="text-xs text-gray-500 mt-1">
                Available variables: <code class="bg-gray-100 px-1 rounded text-gray-600">{tenant_name}</code>, <code class="bg-gray-100 px-1 rounded text-gray-600">{property_address}</code>, <code class="bg-gray-100 px-1 rounded text-gray-600">{agent_name}</code>, <code class="bg-gray-100 px-1 rounded text-gray-600">{company_name}</code>
              </p>
            </div>

            <!-- Attachments -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Attachments</label>
              <div
                class="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center hover:border-gray-300 transition-colors"
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
                  @click="($refs.fileInputRef as HTMLInputElement)?.click()"
                  class="text-sm text-primary hover:text-primary/80 font-medium"
                >
                  Click to upload or drag and drop
                </button>
                <p class="text-xs text-gray-500 mt-1">PDF, DOC, DOCX, JPG, PNG (max 10MB each)</p>
              </div>
              <div v-if="attachments.length > 0" class="mt-2 space-y-1">
                <div
                  v-for="(file, idx) in attachments"
                  :key="idx"
                  class="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg"
                >
                  <div class="flex items-center gap-2 text-sm">
                    <Paperclip class="w-4 h-4 text-gray-400" />
                    <span class="text-gray-700 truncate max-w-xs">{{ file.name }}</span>
                    <span class="text-gray-400 text-xs">({{ formatFileSize(file.size) }})</span>
                  </div>
                  <button
                    @click="removeAttachment(idx)"
                    class="p-1 text-gray-400 hover:text-red-500"
                  >
                    <X class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
            <p class="text-xs text-gray-500">
              Replies will go to your registered email
            </p>
            <div class="flex gap-3">
              <button
                @click="close"
                :disabled="sending"
                class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                @click="sendEmail"
                :disabled="!canSend || sending"
                class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <Loader2 v-if="sending" class="w-4 h-4 animate-spin" />
                <Send v-else class="w-4 h-4" />
                {{ sending ? 'Sending...' : 'Send Email' }}
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
  X, Send, Loader2, Paperclip,
  Eye, Wrench, Clock, Megaphone, Calendar, AlertCircle
} from 'lucide-vue-next'
import { API_URL } from '@/lib/apiUrl'

interface Tenant {
  id: string
  first_name: string
  last_name: string
  email: string | null
}

interface EmailTemplate {
  key: string
  label: string
  icon: any
  subject: string
  body: string
}

const props = defineProps<{
  isOpen: boolean
  tenancyId: string
  propertyAddress: string
  tenants: Tenant[]
}>()

const emit = defineEmits<{
  close: []
  success: []
}>()

const toast = useToast()
const authStore = useAuthStore()
// Templates
const templates: EmailTemplate[] = [
  {
    key: 'viewing_request',
    label: 'Viewing Request',
    icon: Eye,
    subject: 'Property Viewing Request - {{ property_address }}',
    body: `Dear {{ tenant_name }},

We have received a request to conduct a viewing at {{ property_address }}.

Please let us know your availability for the proposed viewing by responding to this email.

If you have any questions or concerns, please don't hesitate to contact us.

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

If this is inconvenient, please contact us as soon as possible to arrange an alternative time.

Kind regards,
{{ agent_name }}
{{ company_name }}`
  },
  {
    key: 'rent_reminder_1',
    label: 'Rent Reminder (1 Day)',
    icon: Clock,
    subject: 'Rent Payment Reminder - {{ property_address }}',
    body: `Dear {{ tenant_name }},

This is a friendly reminder that your rent payment for {{ property_address }} is due tomorrow.

Please ensure payment is made by the due date to avoid any late payment fees.

If you have already made the payment, please disregard this message.

Kind regards,
{{ agent_name }}
{{ company_name }}`
  },
  {
    key: 'rent_reminder_7',
    label: 'Payment Due Soon',
    icon: Calendar,
    subject: 'Rent Payment Due Soon - {{ property_address }}',
    body: `Dear {{ tenant_name }},

This is a friendly reminder that your rent payment for {{ property_address }} is due soon.

Please ensure funds are available in your account to avoid any issues with the payment.

If you have any questions about your payment, please don't hesitate to contact us.

Kind regards,
{{ agent_name }}
{{ company_name }}`
  },
  {
    key: 'rent_reminder_14',
    label: 'Rent Reminder (14 Days)',
    icon: Calendar,
    subject: 'Rent Payment Due Soon - {{ property_address }}',
    body: `Dear {{ tenant_name }},

This is a courtesy notice that your rent payment for {{ property_address }} will be due in 14 days.

Please ensure funds are available to avoid any issues with the payment.

Kind regards,
{{ agent_name }}
{{ company_name }}`
  },
  {
    key: 'rent_reminder_21',
    label: 'Rent Reminder (21 Days)',
    icon: AlertCircle,
    subject: 'Upcoming Rent Payment Notice - {{ property_address }}',
    body: `Dear {{ tenant_name }},

This is an advance notice that your rent payment for {{ property_address }} will be due in 21 days.

Please ensure funds are available in your account before the due date.

Kind regards,
{{ agent_name }}
{{ company_name }}`
  },
  {
    key: 'rent_arrears',
    label: 'Rent Arrears',
    icon: AlertCircle,
    subject: 'Rent Arrears Notice - {{ property_address }}',
    body: `Dear {{ tenant_name }},

We are writing to inform you that your rent account for {{ property_address }} is currently in arrears.

It is important that this matter is resolved as soon as possible to avoid any further action. Please make payment immediately or contact us to discuss your situation.

If you are experiencing financial difficulties, please get in touch with us so we can discuss potential options.

If payment has already been made, please disregard this notice and accept our apologies for any inconvenience.

Kind regards,
{{ agent_name }}
{{ company_name }}`
  },
  {
    key: 'general',
    label: 'General Announcement',
    icon: Megaphone,
    subject: 'Important Notice - {{ property_address }}',
    body: `Dear {{ tenant_name }},

[Please enter your message here]

If you have any questions, please do not hesitate to contact us.

Kind regards,
{{ agent_name }}
{{ company_name }}`
  }
]

// State
const selectedTenantIds = ref<string[]>([])
const selectedTemplate = ref<EmailTemplate | null>(null)
const subject = ref('')
const message = ref('')
const attachments = ref<File[]>([])
const sending = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

// Initialize with all tenants who have email
watch(() => props.isOpen, (open) => {
  if (open) {
    selectedTenantIds.value = props.tenants
      .filter(t => t.email)
      .map(t => t.id)
    selectedTemplate.value = null
    subject.value = ''
    message.value = ''
    attachments.value = []
  }
})

const canSend = computed(() => {
  return selectedTenantIds.value.length > 0 &&
         subject.value.trim() &&
         message.value.trim()
})

const selectTemplate = (template: EmailTemplate) => {
  selectedTemplate.value = template

  // Get first selected tenant for preview (backend personalizes per recipient)
  const firstTenant = props.tenants.find(t => selectedTenantIds.value.includes(t.id))
  const tenantName = firstTenant ? `${firstTenant.first_name} ${firstTenant.last_name}` : 'Tenant'

  // Get agent/company info from auth store
  const agentName = authStore.user?.full_name || authStore.user?.email?.split('@')[0] || 'Your Agent'
  const companyName = authStore.company?.name || 'PropertyGoose'

  // Merge all variables
  const mergeVariables = (text: string) => {
    return text
      .replace(/\{\{\s*tenant_name\s*\}\}/g, tenantName)
      .replace(/\{\{\s*property_address\s*\}\}/g, props.propertyAddress)
      .replace(/\{\{\s*agent_name\s*\}\}/g, agentName)
      .replace(/\{\{\s*company_name\s*\}\}/g, companyName)
  }

  subject.value = mergeVariables(template.subject)
  message.value = mergeVariables(template.body)
}

const handleFileSelect = (e: Event) => {
  const input = e.target as HTMLInputElement
  if (input.files) {
    addFiles(Array.from(input.files))
  }
  input.value = '' // Reset for same file selection
}

const handleFileDrop = (e: DragEvent) => {
  if (e.dataTransfer?.files) {
    addFiles(Array.from(e.dataTransfer.files))
  }
}

const addFiles = (files: File[]) => {
  const maxSize = 10 * 1024 * 1024 // 10MB
  const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png']

  for (const file of files) {
    if (file.size > maxSize) {
      toast.error(`${file.name} is too large (max 10MB)`)
      continue
    }
    if (!allowedTypes.includes(file.type)) {
      toast.error(`${file.name} is not a supported file type`)
      continue
    }
    attachments.value.push(file)
  }
}

const removeAttachment = (index: number) => {
  attachments.value.splice(index, 1)
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const sendEmail = async () => {
  if (!canSend.value) return

  sending.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    // Create FormData for file upload
    const formData = new FormData()
    formData.append('tenantIds', JSON.stringify(selectedTenantIds.value))
    formData.append('subject', subject.value)
    formData.append('message', message.value)
    formData.append('templateKey', selectedTemplate.value?.key || 'custom')

    for (const file of attachments.value) {
      formData.append('attachments', file)
    }

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${props.tenancyId}/email-tenants`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to send email')
    }

    const data = await response.json()
    toast.success(`Email sent to ${data.sentCount} tenant(s)`)
    emit('success')
    emit('close')
  } catch (error: any) {
    console.error('Error sending email:', error)
    toast.error(error.message || 'Failed to send email')
  } finally {
    sending.value = false
  }
}

const close = () => {
  if (!sending.value) {
    emit('close')
  }
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

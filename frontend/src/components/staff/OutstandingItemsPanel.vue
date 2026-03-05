<template>
  <div class="bg-white rounded-lg shadow p-6">
    <h3 class="text-lg font-semibold text-gray-900 mb-4">Outstanding Items</h3>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-4">
      <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      <p class="mt-2 text-sm text-gray-500">Loading outstanding items...</p>
    </div>

    <!-- No Outstanding Items -->
    <div v-else-if="items.length === 0" class="text-center py-4 bg-green-50 rounded-lg border border-green-200">
      <CheckCircle class="w-8 h-8 text-green-500 mx-auto" />
      <p class="mt-2 text-sm text-green-800">All external references have been received!</p>
    </div>

    <!-- Outstanding Items List -->
    <div v-else class="space-y-4">
      <div
        v-for="item in items"
        :key="item.id"
        class="border rounded-lg p-4"
        :class="getItemBorderClass(item)"
      >
        <div class="flex items-start justify-between mb-3">
          <div>
            <span class="text-sm font-semibold" :class="getItemTypeClass(item)">
              {{ getSectionLabel(item.sectionType) }}
            </span>
            <span
              class="ml-2 px-2 py-0.5 text-xs font-medium rounded"
              :class="item.initialRequestSentAt ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'"
            >
              {{ item.initialRequestSentAt ? 'Request Sent' : 'Not Sent' }}
            </span>
          </div>
          <div class="text-xs text-gray-500">
            {{ item.emailAttempts }} emails sent
            <span v-if="item.smsAttempts > 0">, {{ item.smsAttempts }} SMS</span>
          </div>
        </div>

        <!-- Contact Information -->
        <div class="grid grid-cols-3 gap-4 mb-3 text-sm">
          <div>
            <label class="block text-xs font-medium text-gray-500 uppercase">Contact Name</label>
            <p class="mt-0.5 text-gray-900">{{ item.contactName || 'Not provided' }}</p>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 uppercase">Email</label>
            <p class="mt-0.5 text-gray-900">
              <a v-if="item.contactEmail" :href="`mailto:${item.contactEmail}`" class="text-primary hover:underline">
                {{ item.contactEmail }}
              </a>
              <span v-else class="text-gray-400">Not provided</span>
            </p>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 uppercase">Phone</label>
            <p class="mt-0.5 text-gray-900">{{ item.contactPhone || 'Not provided' }}</p>
          </div>
        </div>

        <!-- Bounce Status Warning -->
        <div v-if="item.bounceStatus" class="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          <AlertTriangle class="w-4 h-4 inline mr-1" />
          Email bounced: {{ item.bounceStatus }}
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-2 flex-wrap">
          <!-- Send Email -->
          <button
            v-if="item.contactEmail"
            @click="sendChase(item.id, 'email')"
            :disabled="sendingEmail === item.id"
            class="px-3 py-1.5 text-sm font-medium text-white bg-primary rounded hover:bg-primary/90 disabled:opacity-50"
          >
            <Mail class="w-4 h-4 inline mr-1" />
            {{ sendingEmail === item.id ? 'Sending...' : 'Send Email' }}
          </button>

          <!-- Send SMS -->
          <button
            v-if="item.contactPhone"
            @click="sendChase(item.id, 'sms')"
            :disabled="sendingSms === item.id"
            class="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            <MessageSquare class="w-4 h-4 inline mr-1" />
            {{ sendingSms === item.id ? 'Sending...' : 'Send SMS' }}
          </button>

          <!-- Copy Form Link (always show - we can fetch the link dynamically) -->
          <button
            @click="copyFormLink(item)"
            class="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
          >
            <Copy class="w-4 h-4 inline mr-1" />
            Copy Link
          </button>

          <!-- Open Form (Fill over phone) -->
          <button
            @click="openForm(item)"
            class="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
          >
            <ExternalLink class="w-4 h-4 inline mr-1" />
            Open Form
          </button>

          <!-- Edit Contact -->
          <button
            @click="editContact(item)"
            class="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
          >
            <Pencil class="w-4 h-4 inline mr-1" />
            Edit Contact
          </button>
        </div>
      </div>
    </div>

    <!-- Edit Contact Modal -->
    <Teleport to="body">
      <div v-if="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/50" @click="closeEditModal"></div>
        <div class="relative bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
          <h3 class="text-lg font-semibold mb-4">Edit Contact Details</h3>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                v-model="editForm.email"
                type="email"
                class="w-full px-3 py-2 border rounded-md"
                placeholder="referee@example.com"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                v-model="editForm.phone"
                type="tel"
                class="w-full px-3 py-2 border rounded-md"
                placeholder="+44..."
              />
            </div>
          </div>
          <div class="mt-6 flex justify-end gap-3">
            <button @click="closeEditModal" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Cancel
            </button>
            <button
              @click="saveContact"
              :disabled="saving"
              class="px-4 py-2 text-sm font-medium text-white bg-primary rounded hover:bg-primary/90 disabled:opacity-50"
            >
              {{ saving ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { CheckCircle, Mail, MessageSquare, Copy, ExternalLink, Pencil, AlertTriangle } from 'lucide-vue-next'
import { useToast } from 'vue-toastification'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const props = defineProps<{
  referenceId: string
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
}>()

const toast = useToast()
const authStore = useAuthStore()
interface OutstandingItem {
  id: string
  sectionType: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  emailAttempts: number
  smsAttempts: number
  initialRequestSentAt?: string
  lastChaseSentAt?: string
  formUrl?: string
  bounceStatus?: string
}

const loading = ref(false)
const items = ref<OutstandingItem[]>([])
const sendingEmail = ref<string | null>(null)
const sendingSms = ref<string | null>(null)

// Edit modal state
const showEditModal = ref(false)
const editingItem = ref<OutstandingItem | null>(null)
const editForm = ref({ email: '', phone: '' })
const saving = ref(false)

const fetchItems = async () => {
  if (!props.referenceId) return

  loading.value = true
  try {
    const response = await fetch(`${API_URL}/api/chase/reference/${props.referenceId}`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) throw new Error('Failed to fetch outstanding items')

    const data = await response.json()
    // Map the dependencies to our format and filter to only pending ones
    items.value = (data.dependencies || [])
      .filter((d: any) => d.status === 'PENDING' || d.status === 'CHASING')
      .map((d: any) => ({
        id: d.id,
        sectionType: d.dependencyType,
        contactName: d.contactName,
        contactEmail: d.contactEmail,
        contactPhone: d.contactPhone,
        emailAttempts: d.emailAttempts || 0,
        smsAttempts: d.smsAttempts || 0,
        initialRequestSentAt: d.initialRequestSentAt,
        lastChaseSentAt: d.lastChaseSentAt,
        formUrl: d.formUrl
      }))
  } catch (err: any) {
    console.error('Error fetching outstanding items:', err)
  } finally {
    loading.value = false
  }
}

const sendChase = async (itemId: string, method: 'email' | 'sms') => {
  if (method === 'email') {
    sendingEmail.value = itemId
  } else {
    sendingSms.value = itemId
  }

  try {
    const response = await fetch(`${API_URL}/api/chase/${itemId}/chase`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ method })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to send chase')
    }

    toast.success(`${method === 'email' ? 'Email' : 'SMS'} sent successfully`)
    await fetchItems()
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    sendingEmail.value = null
    sendingSms.value = null
  }
}

const getFormLink = async (item: OutstandingItem): Promise<string | null> => {
  // If we already have a formUrl, return it
  if (item.formUrl) return item.formUrl

  // Otherwise fetch it from the API
  try {
    const response = await fetch(`${API_URL}/api/chase/${item.id}/form-link`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })
    if (!response.ok) throw new Error('Failed to get form link')
    const data = await response.json()
    // Cache it on the item
    item.formUrl = data.formUrl
    return data.formUrl
  } catch (err) {
    console.error('Error fetching form link:', err)
    return null
  }
}

const copyFormLink = async (item: OutstandingItem) => {
  const link = await getFormLink(item)
  if (!link) {
    toast.error('Could not get form link')
    return
  }
  try {
    await navigator.clipboard.writeText(link)
    toast.success('Form link copied to clipboard!')
  } catch {
    toast.error('Failed to copy link')
  }
}

const openForm = async (item: OutstandingItem) => {
  const link = await getFormLink(item)
  if (!link) {
    toast.error('Could not get form link')
    return
  }
  window.open(link, '_blank')
}

const editContact = (item: OutstandingItem) => {
  editingItem.value = item
  editForm.value = {
    email: item.contactEmail || '',
    phone: item.contactPhone || ''
  }
  showEditModal.value = true
}

const closeEditModal = () => {
  showEditModal.value = false
  editingItem.value = null
  editForm.value = { email: '', phone: '' }
}

const saveContact = async () => {
  if (!editingItem.value) return

  saving.value = true
  try {
    const response = await fetch(`${API_URL}/api/references/${props.referenceId}/referee`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sectionType: editingItem.value.sectionType,
        email: editForm.value.email,
        phone: editForm.value.phone
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to update contact')
    }

    toast.success('Contact updated successfully')
    closeEditModal()
    await fetchItems()
    emit('refresh')
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    saving.value = false
  }
}

const getSectionLabel = (type: string): string => {
  const labels: Record<string, string> = {
    'EMPLOYER_REF': 'Employer Reference',
    'RESIDENTIAL_REF': 'Landlord Reference',
    'ACCOUNTANT_REF': 'Accountant Reference',
    'GUARANTOR_FORM': 'Guarantor Form',
    'TENANT_FORM': 'Tenant Form'
  }
  return labels[type] || type
}

const getItemBorderClass = (item: OutstandingItem) => {
  if (item.bounceStatus) return 'border-red-300 bg-red-50'
  if (item.emailAttempts > 3) return 'border-orange-300 bg-orange-50'
  return 'border-gray-200'
}

const getItemTypeClass = (item: OutstandingItem) => {
  const classes: Record<string, string> = {
    'EMPLOYER_REF': 'text-green-700',
    'RESIDENTIAL_REF': 'text-purple-700',
    'ACCOUNTANT_REF': 'text-indigo-700',
    'GUARANTOR_FORM': 'text-pink-700'
  }
  return classes[item.sectionType] || 'text-gray-700'
}

watch(() => props.referenceId, () => {
  fetchItems()
})

onMounted(() => {
  fetchItems()
})
</script>

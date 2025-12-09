<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <StaffHeader />

    <!-- Toast Notification -->
    <Transition
      enter-active-class="transition ease-out duration-300"
      enter-from-class="transform opacity-0 translate-y-2"
      enter-to-class="transform opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="transform opacity-100 translate-y-0"
      leave-to-class="transform opacity-0 translate-y-2"
    >
      <div
        v-if="toast.show"
        class="fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2"
        :class="toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'"
      >
        <svg v-if="toast.type === 'success'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
        {{ toast.message }}
      </div>
    </Transition>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Info Banner -->
      <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <p class="text-sm text-yellow-700">
              <strong>Chase List:</strong> These references have been submitted by tenants but are awaiting responses from landlords, agents, employers, accountants, or guarantors. Follow up manually with the contacts listed below.
            </p>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="bg-white rounded-lg shadow p-8 text-center">
        <div class="text-gray-600">Loading chase list...</div>
      </div>

      <!-- Empty State -->
      <div v-else-if="chaseItems.length === 0" class="bg-white rounded-lg shadow p-8 text-center">
        <svg class="mx-auto h-12 w-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 class="mt-2 text-lg font-medium text-gray-900">All caught up!</h3>
        <p class="mt-1 text-sm text-gray-500">There are no references waiting for responses.</p>
      </div>

      <!-- Chase Items -->
      <div v-else class="space-y-4">
        <div v-for="item in chaseItems" :key="item.id" class="bg-white shadow rounded-lg overflow-hidden">
          <div class="p-6">
            <!-- Header -->
            <div class="flex items-start justify-between mb-4">
              <div class="flex-1">
                <div class="flex items-center">
                  <router-link
                    :to="`/staff/references/${item.id}`"
                    class="text-lg font-semibold text-primary hover:text-primary-dark"
                  >
                    {{ item.tenant_name }}
                  </router-link>
                  <span
                    v-if="item.days_pending >= 7"
                    class="ml-3 px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800"
                  >
                    {{ item.days_pending }} days since requested
                  </span>
                  <span
                    v-else-if="item.days_pending >= 3"
                    class="ml-3 px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800"
                  >
                    {{ item.days_pending }} days since requested
                  </span>
                  <span
                    v-else
                    class="ml-3 px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800"
                  >
                    {{ item.days_pending }} days since requested
                  </span>
                </div>
                <div class="mt-1 text-sm text-gray-600">
                  {{ item.property_address }}
                </div>
                <div class="mt-1 text-xs text-gray-500">
                  Company: {{ item.company?.name || 'Unknown' }} • Submitted: {{ formatDate(item.submitted_at) }}
                </div>
              </div>
            </div>

            <!-- Missing Responses -->
            <div class="mb-4">
              <h4 class="text-sm font-semibold text-gray-700 mb-2">Missing Responses:</h4>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="response in item.missing_responses"
                  :key="response"
                  class="px-3 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800"
                >
                  {{ response }}
                </span>
              </div>
            </div>

            <!-- Contacts to Chase -->
            <div v-if="item.contacts_to_chase.length > 0">
              <h4 class="text-sm font-semibold text-gray-700 mb-3">Contacts to Chase:</h4>
              <div class="space-y-3">
                <div
                  v-for="(contact, idx) in item.contacts_to_chase"
                  :key="idx"
                  class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div class="flex-1">
                    <div class="flex items-center">
                      <span class="px-2 py-1 text-xs font-semibold rounded bg-blue-100 text-blue-800 mr-3">
                        {{ contact.type }}
                      </span>
                      <span class="font-medium text-gray-900">{{ contact.name }}</span>
                    </div>
                    <div class="mt-1 text-sm text-gray-600">
                      <a :href="`mailto:${contact.email}`" class="text-primary hover:underline">{{ contact.email }}</a>
                      <span v-if="contact.phone" class="ml-3">• {{ contact.phone }}</span>
                    </div>
                    <div v-if="contact.sentDate" class="mt-1 text-xs text-gray-500">
                      Request sent: {{ formatDate(contact.sentDate) }}
                    </div>
                    <div v-else class="mt-1 text-xs text-orange-600 font-medium">
                      ⚠️ Awaiting response - contact if needed
                    </div>
                  </div>
                  <div class="flex gap-2 ml-4">
                    <button
                      @click="sendReminder(item.id, contact.type, 'email')"
                      :disabled="isSending(`${item.id}-${contact.type}-email`)"
                      class="inline-flex items-center px-3 py-1 text-xs font-medium text-white bg-primary hover:bg-primary-dark rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Send chase email with form link"
                    >
                      <svg v-if="isSending(`${item.id}-${contact.type}-email`)" class="animate-spin w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <svg v-else class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {{ isSending(`${item.id}-${contact.type}-email`) ? 'Sending...' : 'Email' }}
                    </button>
                    <button
                      v-if="contact.phone"
                      @click="sendReminder(item.id, contact.type, 'sms')"
                      :disabled="isSending(`${item.id}-${contact.type}-sms`)"
                      class="inline-flex items-center px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Send SMS with form link"
                    >
                      <svg v-if="isSending(`${item.id}-${contact.type}-sms`)" class="animate-spin w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <svg v-else class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                      {{ isSending(`${item.id}-${contact.type}-sms`) ? 'Sending...' : 'SMS' }}
                    </button>
                    <a
                      v-if="contact.phone"
                      :href="`tel:${contact.phone}`"
                      class="inline-flex items-center px-3 py-1 text-xs font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md"
                      title="Call contact"
                    >
                      <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Call
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <!-- No Contacts Yet -->
            <div v-else class="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p class="text-sm text-yellow-800">
                No contact information available yet. The emails have not been sent or contacts haven't been created.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import StaffHeader from '../components/StaffHeader.vue'
import { formatDate as formatUkDate } from '../utils/date'

const authStore = useAuthStore()

const loading = ref(true)
const chaseItems = ref<any[]>([])
const sendingStatus = ref<Record<string, boolean>>({})
const toast = ref<{ show: boolean; message: string; type: 'success' | 'error' }>({
  show: false,
  message: '',
  type: 'success'
})

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const fetchChaseList = async () => {
  try {
    loading.value = true
    const token = authStore.session?.access_token

    const response = await fetch(`${API_URL}/api/staff/chase-list`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch chase list')
    }

    const data = await response.json()
    chaseItems.value = data.chase_items || []
  } catch (error) {
    console.error('Error fetching chase list:', error)
  } finally {
    loading.value = false
  }
}

const isSending = (key: string) => sendingStatus.value[key] || false

const showToast = (message: string, type: 'success' | 'error') => {
  toast.value = { show: true, message, type }
  setTimeout(() => {
    toast.value.show = false
  }, 3000)
}

const sendReminder = async (referenceId: string, contactType: string, method: 'email' | 'sms') => {
  const key = `${referenceId}-${contactType}-${method}`
  sendingStatus.value[key] = true

  try {
    const token = authStore.session?.access_token
    const response = await fetch(`${API_URL}/api/staff/chase/${referenceId}/send-reminder`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ contactType, method })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to send reminder')
    }

    showToast(`${method === 'email' ? 'Email' : 'SMS'} sent successfully to ${contactType}`, 'success')

    // If SMS was sent, remove the contact from the list immediately (12-hour cooldown)
    if (method === 'sms') {
      chaseItems.value = chaseItems.value.map(item => {
        if (item.id === referenceId) {
          const filteredContacts = item.contacts_to_chase.filter(
            (c: { type: string }) => c.type !== contactType
          )
          // If no contacts left, return null to filter out the whole item
          if (filteredContacts.length === 0) return null
          return { ...item, contacts_to_chase: filteredContacts }
        }
        return item
      }).filter(item => item !== null)
    }
  } catch (error: any) {
    console.error('Error sending reminder:', error)
    showToast(error.message || 'Failed to send reminder', 'error')
  } finally {
    sendingStatus.value[key] = false
  }
}

const formatDate = (dateString?: string | null, fallback = 'N/A') =>
  formatUkDate(
    dateString,
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    },
    fallback
  )


onMounted(() => {
  fetchChaseList()
})
</script>

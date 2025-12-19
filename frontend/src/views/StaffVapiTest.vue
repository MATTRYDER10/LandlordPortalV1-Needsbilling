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
        <Check v-if="toast.type === 'success'" class="w-5 h-5" />
        <X v-else class="w-5 h-5" />
        {{ toast.message }}
      </div>
    </Transition>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-900">VAPI Voice Call Testing</h2>
        <p class="text-gray-600 mt-1">Test VAPI voice calls before enabling in the chase queue</p>
      </div>

      <!-- Configuration Status -->
      <div class="bg-white rounded-lg shadow p-6 mb-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Settings class="w-5 h-5" />
          Configuration Status
        </h3>

        <div v-if="loadingStatus" class="flex items-center gap-2 text-gray-500">
          <Loader2 class="w-4 h-4 animate-spin" />
          Checking configuration...
        </div>

        <div v-else-if="status" class="space-y-4">
          <!-- Configuration Status -->
          <div class="flex items-center gap-3">
            <div
              class="w-3 h-3 rounded-full"
              :class="status.configured ? 'bg-green-500' : 'bg-red-500'"
            />
            <span class="font-medium">
              {{ status.configured ? 'VAPI Configured' : 'VAPI Not Configured' }}
            </span>
          </div>

          <div v-if="!status.configured && status.missing.length > 0" class="ml-6 text-sm text-red-600">
            Missing: {{ status.missing.join(', ') }}
          </div>

          <!-- Call Hours Status -->
          <div class="flex items-center gap-3">
            <div
              class="w-3 h-3 rounded-full"
              :class="status.withinCallHours ? 'bg-green-500' : 'bg-yellow-500'"
            />
            <span class="font-medium">
              {{ status.withinCallHours ? 'Within Call Hours' : 'Outside Call Hours' }}
            </span>
          </div>

          <div class="ml-6 text-sm text-gray-500">
            Current time: {{ status.currentTime?.gmtHour }}:00 GMT ({{ status.currentTime?.dayOfWeek }})
            <br />
            Call hours: {{ status.callHours?.start }}:00 - {{ status.callHours?.end }}:00 GMT, weekdays only
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs mb-6">
        <button :class="['tab', { active: activeTab === 'test' }]" @click="activeTab = 'test'">
          Manual Test Call
        </button>
        <button :class="['tab', { active: activeTab === 'dependency' }]" @click="activeTab = 'dependency'">
          Call from Reference
        </button>
        <button :class="['tab', { active: activeTab === 'logs' }]" @click="activeTab = 'logs'">
          Call Logs
        </button>
      </div>

      <!-- Manual Test Call Tab -->
      <div v-if="activeTab === 'test'" class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Phone class="w-5 h-5" />
          Manual Test Call
        </h3>

        <form @submit.prevent="makeTestCall" class="space-y-4 max-w-md">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Phone Number (E.164 format)
            </label>
            <input
              v-model="testCall.phoneNumber"
              type="tel"
              placeholder="+447123456789"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
            <p class="text-xs text-gray-500 mt-1">Must include country code (e.g., +44 for UK)</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Contact Name
            </label>
            <input
              v-model="testCall.contactName"
              type="text"
              placeholder="John Smith"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Tenant Name (optional)
            </label>
            <input
              v-model="testCall.tenantName"
              type="text"
              placeholder="Jane Doe"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Dependency Type
            </label>
            <select
              v-model="testCall.dependencyType"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="TENANT_FORM">Tenant Form</option>
              <option value="EMPLOYER_REF">Employer Reference</option>
              <option value="RESIDENTIAL_REF">Landlord Reference</option>
              <option value="ACCOUNTANT_REF">Accountant Reference</option>
              <option value="GUARANTOR_FORM">Guarantor Form</option>
            </select>
          </div>

          <button
            type="submit"
            :disabled="makingCall || !status?.configured"
            class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Loader2 v-if="makingCall" class="w-4 h-4 animate-spin" />
            <PhoneCall v-else class="w-4 h-4" />
            {{ makingCall ? 'Initiating Call...' : 'Make Test Call' }}
          </button>
        </form>
      </div>

      <!-- Call Reference Tab -->
      <div v-if="activeTab === 'dependency'" class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users class="w-5 h-5" />
          Test Call from Reference
        </h3>

        <!-- Search -->
        <div class="mb-4">
          <input
            v-model="referenceSearch"
            type="text"
            placeholder="Search by tenant name, employer, landlord, or reference ID..."
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            @input="fetchReferences"
          />
        </div>

        <!-- References List -->
        <div v-if="loadingReferences" class="flex items-center gap-2 text-gray-500 py-4">
          <Loader2 class="w-4 h-4 animate-spin" />
          Loading references...
        </div>

        <div v-else-if="references.length === 0" class="text-gray-500 py-4 text-center">
          No references found
        </div>

        <div v-else class="space-y-4 max-h-[600px] overflow-y-auto">
          <div
            v-for="ref in references"
            :key="ref.id"
            class="p-4 border rounded-lg hover:bg-gray-50"
          >
            <!-- Reference Header -->
            <div class="flex items-center justify-between mb-3">
              <div>
                <div class="font-semibold text-gray-900 text-lg">{{ ref.tenantName }}</div>
                <div class="text-sm text-gray-500">{{ ref.tenantEmail }}</div>
                <div v-if="ref.propertyAddress" class="text-sm text-gray-400 mt-1">
                  <span class="font-medium">Property:</span> {{ ref.propertyAddress }}
                </div>
                <div v-if="ref.companyName" class="text-xs text-gray-400">
                  <span class="font-medium">Agent:</span> {{ ref.companyName }}
                </div>
              </div>
              <div class="text-right">
                <span class="px-2 py-1 text-xs font-medium rounded" :class="getRefStatusClass(ref.status)">
                  {{ ref.status }}
                </span>
                <div class="text-xs text-gray-400 mt-1">{{ ref.id.slice(0, 8) }}...</div>
              </div>
            </div>

            <!-- Contacts for this reference -->
            <div v-if="ref.contacts.length > 0" class="space-y-2">
              <div class="text-xs text-gray-500 font-medium">Available contacts to call:</div>
              <div
                v-for="(contact, idx) in ref.contacts"
                :key="idx"
                class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-800">
                      {{ getDependencyTypeLabel(contact.type) }}
                    </span>
                    <span class="font-medium text-gray-800">{{ contact.name }}</span>
                  </div>
                  <div class="flex items-center gap-4 mt-1 text-sm">
                    <div class="flex items-center gap-1">
                      <Phone class="w-3 h-3 text-gray-400" />
                      <span :class="contact.hasValidPhone ? 'text-gray-600' : 'text-red-500'">
                        {{ contact.phone }}
                        <span v-if="!contact.hasValidPhone" class="text-red-500 ml-1">(Invalid)</span>
                      </span>
                    </div>
                    <div v-if="contact.email" class="flex items-center gap-1">
                      <Mail class="w-3 h-3 text-gray-400" />
                      <span class="text-gray-600">{{ contact.email }}</span>
                    </div>
                  </div>
                  <div v-if="contact.company" class="text-xs text-gray-500 mt-1">
                    Company: {{ contact.company }}
                  </div>
                </div>

                <button
                  @click="makeTestCallFromRef(ref, contact)"
                  :disabled="makingCall || !contact.hasValidPhone || !status?.configured"
                  class="flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <Loader2 v-if="callingContact === `${ref.id}-${contact.type}`" class="w-4 h-4 animate-spin" />
                  <PhoneCall v-else class="w-4 h-4" />
                  Call
                </button>
              </div>
            </div>

            <div v-else class="text-sm text-gray-400 italic">
              No contacts with phone numbers for this reference
            </div>
          </div>
        </div>
      </div>

      <!-- Call Logs Tab -->
      <div v-if="activeTab === 'logs'" class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <History class="w-5 h-5" />
            Call Logs
          </h3>

          <button
            @click="fetchCallLogs"
            :disabled="loadingLogs"
            class="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <RefreshCw :class="['w-4 h-4', { 'animate-spin': loadingLogs }]" />
            Refresh
          </button>
        </div>

        <!-- Call Lookup by ID -->
        <div class="mb-4 p-4 bg-gray-50 rounded-lg">
          <div class="text-sm font-medium text-gray-700 mb-2">Lookup Call by VAPI ID</div>
          <div class="flex gap-2">
            <input
              v-model="callLookupId"
              type="text"
              placeholder="Enter VAPI call ID..."
              class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button
              @click="lookupCall"
              :disabled="!callLookupId || lookingUpCall"
              class="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
            >
              <Loader2 v-if="lookingUpCall" class="w-4 h-4 animate-spin" />
              <Search v-else class="w-4 h-4" />
              Fetch from VAPI
            </button>
          </div>
        </div>

        <!-- Filters -->
        <div class="mb-4">
          <select
            v-model="logsFilter"
            class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            @change="fetchCallLogs"
          >
            <option value="">All Statuses</option>
            <option value="initiated">Initiated</option>
            <option value="ringing">Ringing</option>
            <option value="in-progress">In Progress</option>
            <option value="ended">Ended</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <!-- Logs Table -->
        <div v-if="loadingLogs" class="flex items-center gap-2 text-gray-500 py-4">
          <Loader2 class="w-4 h-4 animate-spin" />
          Loading call logs...
        </div>

        <div v-else-if="callLogs.length === 0" class="text-gray-500 py-4 text-center">
          No call logs found
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b">
                <th class="text-left py-2 px-2">VAPI Call ID</th>
                <th class="text-left py-2 px-2">Time</th>
                <th class="text-left py-2 px-2">Status</th>
                <th class="text-left py-2 px-2">Duration</th>
                <th class="text-left py-2 px-2">Ended Reason</th>
                <th class="text-left py-2 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in callLogs" :key="log.id" class="border-b hover:bg-gray-50">
                <td class="py-2 px-2">
                  <code class="text-xs bg-gray-100 px-1 py-0.5 rounded select-all">
                    {{ log.vapi_call_id?.slice(0, 8) }}...
                  </code>
                </td>
                <td class="py-2 px-2">{{ formatDate(log.created_at) }}</td>
                <td class="py-2 px-2">
                  <span
                    class="px-2 py-1 rounded text-xs font-medium"
                    :class="getStatusClass(log.status)"
                  >
                    {{ log.status }}
                  </span>
                </td>
                <td class="py-2 px-2">
                  {{ log.call_duration_seconds ? `${log.call_duration_seconds}s` : '-' }}
                </td>
                <td class="py-2 px-2">{{ log.ended_reason || '-' }}</td>
                <td class="py-2 px-2 space-x-2">
                  <button
                    @click="fetchCallDetails(log.vapi_call_id)"
                    :disabled="fetchingCallId === log.vapi_call_id"
                    class="text-orange-600 hover:text-orange-700 disabled:opacity-50"
                  >
                    <Loader2 v-if="fetchingCallId === log.vapi_call_id" class="w-4 h-4 animate-spin inline" />
                    <span v-else>Fetch</span>
                  </button>
                  <button
                    v-if="log.transcript || log.summary"
                    @click="viewCallDetails(log)"
                    class="text-blue-600 hover:text-blue-700"
                  >
                    View
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="logsTotal > logsLimit" class="mt-4 flex items-center justify-between">
          <div class="text-sm text-gray-500">
            Showing {{ logsOffset + 1 }} - {{ Math.min(logsOffset + logsLimit, logsTotal) }} of {{ logsTotal }}
          </div>
          <div class="flex gap-2">
            <button
              @click="logsOffset -= logsLimit; fetchCallLogs()"
              :disabled="logsOffset === 0"
              class="px-3 py-1 border rounded disabled:opacity-50"
            >
              Previous
            </button>
            <button
              @click="logsOffset += logsLimit; fetchCallLogs()"
              :disabled="logsOffset + logsLimit >= logsTotal"
              class="px-3 py-1 border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <!-- Call Details Modal -->
      <div
        v-if="selectedCall"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        @click.self="selectedCall = null"
      >
        <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
          <div class="p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold">Call Details</h3>
              <button @click="selectedCall = null" class="text-gray-400 hover:text-gray-600">
                <X class="w-5 h-5" />
              </button>
            </div>

            <div class="space-y-4">
              <div>
                <h4 class="font-medium text-gray-700">Status</h4>
                <p>{{ selectedCall.status }} ({{ selectedCall.ended_reason || 'N/A' }})</p>
              </div>

              <div v-if="selectedCall.call_duration_seconds">
                <h4 class="font-medium text-gray-700">Duration</h4>
                <p>{{ selectedCall.call_duration_seconds }} seconds</p>
              </div>

              <div v-if="selectedCall.summary">
                <h4 class="font-medium text-gray-700">Summary</h4>
                <p class="whitespace-pre-wrap bg-gray-50 p-3 rounded">{{ selectedCall.summary }}</p>
              </div>

              <div v-if="selectedCall.transcript">
                <h4 class="font-medium text-gray-700">Transcript</h4>
                <p class="whitespace-pre-wrap bg-gray-50 p-3 rounded text-sm max-h-60 overflow-y-auto">
                  {{ selectedCall.transcript }}
                </p>
              </div>

              <div v-if="selectedCall.error_message">
                <h4 class="font-medium text-gray-700">Error</h4>
                <p class="text-red-600">{{ selectedCall.error_message }}</p>
              </div>
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
import {
  Check,
  X,
  Settings,
  Loader2,
  Phone,
  PhoneCall,
  Users,
  History,
  RefreshCw,
  Mail,
  Search
} from 'lucide-vue-next'
import StaffHeader from '../components/StaffHeader.vue'

const authStore = useAuthStore()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// State
const activeTab = ref<'test' | 'dependency' | 'logs'>('test')

// Toast
const toast = ref<{ show: boolean; message: string; type: 'success' | 'error' }>({
  show: false,
  message: '',
  type: 'success'
})

// Status
const status = ref<any>(null)
const loadingStatus = ref(false)

// Test call
const testCall = ref({
  phoneNumber: '',
  contactName: '',
  tenantName: '',
  dependencyType: 'TENANT_FORM'
})
const makingCall = ref(false)

// References
const references = ref<any[]>([])
const loadingReferences = ref(false)
const referenceSearch = ref('')
const callingContact = ref<string | null>(null)

// Call logs
const callLogs = ref<any[]>([])
const loadingLogs = ref(false)
const logsFilter = ref('')
const logsOffset = ref(0)
const logsLimit = ref(20)
const logsTotal = ref(0)

// Call details modal
const selectedCall = ref<any>(null)

// Call lookup
const callLookupId = ref('')
const lookingUpCall = ref(false)
const fetchingCallId = ref<string | null>(null)

// Toast helper
function showToast(message: string, type: 'success' | 'error' = 'success') {
  toast.value = { show: true, message, type }
  setTimeout(() => {
    toast.value.show = false
  }, 3000)
}

// Fetch status
async function fetchStatus() {
  loadingStatus.value = true
  try {
    const response = await fetch(`${API_URL}/api/vapi/status`, {
      headers: {
        Authorization: `Bearer ${authStore.session?.access_token}`
      }
    })
    if (!response.ok) throw new Error('Failed to fetch status')
    status.value = await response.json()
  } catch (error: any) {
    console.error('Error fetching status:', error)
    showToast('Failed to fetch VAPI status', 'error')
  } finally {
    loadingStatus.value = false
  }
}

// Make test call
async function makeTestCall() {
  makingCall.value = true
  try {
    const response = await fetch(`${API_URL}/api/vapi/test-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.session?.access_token}`
      },
      body: JSON.stringify(testCall.value)
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to make call')
    }

    showToast(data.message || 'Call initiated successfully', 'success')

    // Switch to logs tab to see the call
    activeTab.value = 'logs'
    fetchCallLogs()
  } catch (error: any) {
    console.error('Error making test call:', error)
    showToast(error.message || 'Failed to make call', 'error')
  } finally {
    makingCall.value = false
  }
}

// Fetch references
async function fetchReferences() {
  loadingReferences.value = true
  try {
    const params = new URLSearchParams()
    if (referenceSearch.value) params.append('search', referenceSearch.value)
    params.append('limit', '50')

    const response = await fetch(`${API_URL}/api/vapi/references?${params}`, {
      headers: {
        Authorization: `Bearer ${authStore.session?.access_token}`
      }
    })
    if (!response.ok) throw new Error('Failed to fetch references')
    const data = await response.json()
    references.value = data.references
  } catch (error: any) {
    console.error('Error fetching references:', error)
    showToast('Failed to fetch references', 'error')
  } finally {
    loadingReferences.value = false
  }
}

// Make test call from reference contact
async function makeTestCallFromRef(ref: any, contact: any) {
  callingContact.value = `${ref.id}-${contact.type}`
  makingCall.value = true
  try {
    const response = await fetch(`${API_URL}/api/vapi/test-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.session?.access_token}`
      },
      body: JSON.stringify({
        phoneNumber: contact.phone,
        contactName: contact.name,
        tenantName: ref.tenantName,
        dependencyType: contact.type,
        propertyAddress: ref.propertyAddress,
        companyName: ref.companyName
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to make call')
    }

    showToast(data.message || 'Call initiated successfully', 'success')

    // Switch to logs tab to see the call
    activeTab.value = 'logs'
    fetchCallLogs()
  } catch (error: any) {
    console.error('Error making call:', error)
    showToast(error.message || 'Failed to make call', 'error')
  } finally {
    callingContact.value = null
    makingCall.value = false
  }
}

// Fetch call logs
async function fetchCallLogs() {
  loadingLogs.value = true
  try {
    const params = new URLSearchParams()
    if (logsFilter.value) params.append('status', logsFilter.value)
    params.append('limit', logsLimit.value.toString())
    params.append('offset', logsOffset.value.toString())

    const response = await fetch(`${API_URL}/api/vapi/calls?${params}`, {
      headers: {
        Authorization: `Bearer ${authStore.session?.access_token}`
      }
    })
    if (!response.ok) throw new Error('Failed to fetch call logs')
    const data = await response.json()
    callLogs.value = data.calls
    logsTotal.value = data.total
  } catch (error: any) {
    console.error('Error fetching call logs:', error)
    showToast('Failed to fetch call logs', 'error')
  } finally {
    loadingLogs.value = false
  }
}

// View call details
function viewCallDetails(call: any) {
  selectedCall.value = call
}

// Lookup call from VAPI
async function lookupCall() {
  if (!callLookupId.value) return

  lookingUpCall.value = true
  try {
    const response = await fetch(`${API_URL}/api/vapi/calls/${callLookupId.value}/fetch`, {
      headers: {
        Authorization: `Bearer ${authStore.session?.access_token}`
      }
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch call')
    }

    // Show the call details in the modal
    selectedCall.value = data.call
    showToast('Call details fetched from VAPI', 'success')
  } catch (error: any) {
    console.error('Error looking up call:', error)
    showToast(error.message || 'Failed to lookup call', 'error')
  } finally {
    lookingUpCall.value = false
  }
}

// Fetch call details from VAPI for a specific log entry
async function fetchCallDetails(vapiCallId: string) {
  if (!vapiCallId) return

  fetchingCallId.value = vapiCallId
  try {
    const response = await fetch(`${API_URL}/api/vapi/calls/${vapiCallId}/fetch`, {
      headers: {
        Authorization: `Bearer ${authStore.session?.access_token}`
      }
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch call')
    }

    // Show the call details in the modal
    selectedCall.value = data.call
    showToast('Call details fetched', 'success')

    // Refresh the logs to show updated data
    fetchCallLogs()
  } catch (error: any) {
    console.error('Error fetching call details:', error)
    showToast(error.message || 'Failed to fetch call', 'error')
  } finally {
    fetchingCallId.value = null
  }
}

// Helper functions
function getDependencyTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'TENANT_FORM': 'Tenant Form',
    'EMPLOYER_REF': 'Employer Reference',
    'RESIDENTIAL_REF': 'Landlord Reference',
    'ACCOUNTANT_REF': 'Accountant Reference',
    'GUARANTOR_FORM': 'Guarantor Form'
  }
  return labels[type] || type
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString()
}

function getStatusClass(status: string): string {
  const classes: Record<string, string> = {
    'initiated': 'bg-blue-100 text-blue-800',
    'queued': 'bg-blue-100 text-blue-800',
    'ringing': 'bg-yellow-100 text-yellow-800',
    'in-progress': 'bg-green-100 text-green-800',
    'ended': 'bg-gray-100 text-gray-800',
    'failed': 'bg-red-100 text-red-800'
  }
  return classes[status] || 'bg-gray-100 text-gray-800'
}

function getRefStatusClass(status: string): string {
  const classes: Record<string, string> = {
    'pending': 'bg-yellow-100 text-yellow-800',
    'in_progress': 'bg-blue-100 text-blue-800',
    'pending_verification': 'bg-purple-100 text-purple-800',
    'completed': 'bg-green-100 text-green-800',
    'rejected': 'bg-red-100 text-red-800',
    'cancelled': 'bg-gray-100 text-gray-800',
    'action_required': 'bg-orange-100 text-orange-800'
  }
  return classes[status] || 'bg-gray-100 text-gray-800'
}

// Lifecycle
onMounted(() => {
  fetchStatus()
  fetchReferences()
  fetchCallLogs()
})
</script>

<style scoped>
.tabs {
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.5rem;
}

.tab {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b7280;
  background: transparent;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
}

.tab:hover {
  color: #374151;
  background: #f3f4f6;
}

.tab.active {
  color: #ea580c;
  background: #fff7ed;
}
</style>

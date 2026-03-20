<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
    <!-- Header -->
    <header class="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-4">
      <div class="max-w-5xl mx-auto">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <button
              @click="goBack"
              class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft class="w-5 h-5" />
            </button>
            <div>
              <div class="flex items-center gap-2">
                <PhoneCall class="w-6 h-6 text-amber-500" />
                <h1 class="text-xl font-bold text-gray-900 dark:text-white">Chase Queue</h1>
              </div>
              <p class="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                {{ items.length }} items need chasing
              </p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <button
              @click="refresh"
              :disabled="loading"
              class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              <RefreshCcw :class="{ 'animate-spin': loading }" class="w-5 h-5" />
            </button>
            <UKTimeClock />
          </div>
        </div>

        <!-- Tabs -->
        <div class="mt-4 flex gap-2">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            @click="activeTab = tab.value"
            class="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            :class="activeTab === tab.value
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              : 'text-gray-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800'"
          >
            {{ tab.label }}
            <span class="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-amber-200/50 dark:bg-amber-900/50">
              {{ tab.count }}
            </span>
          </button>
        </div>
      </div>
    </header>

    <!-- Content -->
    <main class="max-w-5xl mx-auto p-6">
      <!-- Loading -->
      <div v-if="loading && items.length === 0" class="space-y-4">
        <div v-for="i in 5" :key="i" class="bg-white dark:bg-slate-800 rounded-xl p-4 animate-pulse">
          <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/3 mb-2"></div>
          <div class="h-3 bg-gray-100 dark:bg-slate-600 rounded w-1/2"></div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredItems.length === 0" class="text-center py-16">
        <div class="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mb-4">
          <CheckCircle class="w-8 h-8 text-green-600" />
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">No chases needed</h3>
        <p class="text-gray-500 dark:text-slate-400 mt-1">All references are up to date</p>
      </div>

      <!-- Chase Items -->
      <div v-else class="space-y-4">
        <div
          v-for="item in filteredItems"
          :key="item.id"
          class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="font-semibold text-gray-900 dark:text-white">
                  {{ item.referee_name }}
                </span>
                <span class="px-2 py-0.5 text-xs font-medium rounded-full"
                  :class="getRefereeTypeClass(item.referee_type)">
                  {{ item.referee_type }}
                </span>
              </div>
              <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">
                For: {{ item.tenant_name }} - {{ item.section_type }}
              </p>
              <p class="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                {{ item.referee_email }}
                <template v-if="item.referee_phone">
                  | <a :href="`tel:${item.referee_phone}`" class="text-primary hover:underline">{{ item.referee_phone }}</a>
                </template>
              </p>
            </div>
            <div class="text-right">
              <div class="text-sm font-medium" :class="getAgeColor(item.age_hours)">
                {{ formatAge(item.age_hours) }}
              </div>
              <div class="text-xs text-gray-400">since sent</div>
              <div v-if="item.chase_count > 0" class="text-xs text-amber-600 mt-1">
                Chased {{ item.chase_count }}x
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="mt-4 flex flex-wrap gap-2">
            <button
              @click="resendEmail(item)"
              :disabled="actionLoading === item.id"
              class="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 disabled:opacity-50"
            >
              <Mail class="w-4 h-4" />
              Resend Email
            </button>
            <button
              @click="sendSms(item)"
              :disabled="actionLoading === item.id"
              class="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 disabled:opacity-50"
            >
              <MessageSquare class="w-4 h-4" />
              Send SMS
            </button>
            <button
              @click="logCall(item)"
              :disabled="actionLoading === item.id"
              class="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 disabled:opacity-50"
            >
              <Phone class="w-4 h-4" />
              Log Call
            </button>
            <button
              @click="openVerbalModal(item)"
              class="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
            >
              <FileText class="w-4 h-4" />
              Record Verbal
            </button>
            <button
              @click="markReceived(item)"
              :disabled="actionLoading === item.id"
              class="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-teal-100 text-teal-700 rounded-lg hover:bg-teal-200 dark:bg-teal-900/30 dark:text-teal-400 disabled:opacity-50"
            >
              <CheckCircle class="w-4 h-4" />
              Received
            </button>
            <button
              @click="markUnable(item)"
              :disabled="actionLoading === item.id"
              class="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 disabled:opacity-50"
            >
              <XCircle class="w-4 h-4" />
              Unable to Obtain
            </button>
          </div>

          <!-- Chase History -->
          <div v-if="item.chase_history?.length" class="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700">
            <button
              @click="toggleHistory(item.id)"
              class="text-xs text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-300 flex items-center gap-1"
            >
              <ChevronDown
                class="w-3 h-3 transition-transform"
                :class="{ 'rotate-180': expandedHistory === item.id }"
              />
              View chase history ({{ item.chase_history.length }})
            </button>
            <div v-if="expandedHistory === item.id" class="mt-2 space-y-1">
              <div
                v-for="(action, idx) in item.chase_history"
                :key="idx"
                class="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-2"
              >
                <span class="w-16 text-gray-400">{{ formatDate(action.created_at) }}</span>
                <span class="px-1.5 py-0.5 rounded" :class="getActionClass(action.action_type)">
                  {{ action.action_type }}
                </span>
                <span>{{ action.notes }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Verbal Reference Modal -->
    <VerbalReferenceModal
      v-if="verbalModalItem"
      :item="verbalModalItem"
      :open="showVerbalModal"
      @close="showVerbalModal = false"
      @submitted="onVerbalSubmitted"
    />

    <!-- Call Log Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="showCallModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div class="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Log Call Attempt</h3>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Outcome</label>
                <select
                  v-model="callOutcome"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                >
                  <option value="">Select outcome...</option>
                  <option value="NO_ANSWER">No Answer</option>
                  <option value="VOICEMAIL">Left Voicemail</option>
                  <option value="WRONG_NUMBER">Wrong Number</option>
                  <option value="CALL_BACK">Requested Call Back</option>
                  <option value="REFUSED">Refused to Participate</option>
                  <option value="VERBAL_GIVEN">Verbal Reference Given</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Notes</label>
                <textarea
                  v-model="callNotes"
                  rows="3"
                  placeholder="Additional details..."
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <div class="flex gap-3 mt-6">
              <button
                @click="showCallModal = false"
                class="flex-1 py-2 px-4 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                @click="submitCallLog"
                :disabled="!callOutcome"
                class="flex-1 py-2 px-4 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                Log Call
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Unable Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="showUnableModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div class="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Mark as Unable to Obtain</h3>
            <p class="text-sm text-gray-500 dark:text-slate-400 mb-4">
              This will stop chasing for this reference. Are you sure?
            </p>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Reason *</label>
              <select
                v-model="unableReason"
                class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              >
                <option value="">Select reason...</option>
                <option value="NO_RESPONSE">No response after multiple attempts</option>
                <option value="REFUSED">Referee refused to participate</option>
                <option value="WRONG_CONTACT">Incorrect contact details</option>
                <option value="BUSINESS_CLOSED">Business no longer operating</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div class="flex gap-3 mt-6">
              <button
                @click="showUnableModal = false"
                class="flex-1 py-2 px-4 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                @click="submitUnable"
                :disabled="!unableReason"
                class="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Mark Unable
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import UKTimeClock from './components/UKTimeClock.vue'
import VerbalReferenceModal from './VerbalReferenceModal.vue'
import {
  ArrowLeft,
  RefreshCcw,
  PhoneCall,
  CheckCircle,
  Mail,
  MessageSquare,
  Phone,
  FileText,
  XCircle,
  ChevronDown
} from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL ?? ''
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(false)
const actionLoading = ref<string | null>(null)
const items = ref<any[]>([])
const activeTab = ref('all')
const expandedHistory = ref<string | null>(null)

// Modals
const showVerbalModal = ref(false)
const verbalModalItem = ref<any>(null)
const showCallModal = ref(false)
const callModalItem = ref<any>(null)
const callOutcome = ref('')
const callNotes = ref('')
const showUnableModal = ref(false)
const unableModalItem = ref<any>(null)
const unableReason = ref('')

const tabs = computed(() => [
  { value: 'all', label: 'All', count: items.value.length },
  { value: 'EMPLOYER', label: 'Employer', count: items.value.filter(i => i.referee_type === 'EMPLOYER').length },
  { value: 'LANDLORD', label: 'Landlord', count: items.value.filter(i => i.referee_type === 'LANDLORD').length },
  { value: 'AGENT', label: 'Agent', count: items.value.filter(i => i.referee_type === 'AGENT').length }
])

const filteredItems = computed(() => {
  if (activeTab.value === 'all') return items.value
  return items.value.filter(i => i.referee_type === activeTab.value)
})

function getRefereeTypeClass(type: string) {
  switch (type) {
    case 'EMPLOYER': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    case 'LANDLORD': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    case 'AGENT': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    default: return 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300'
  }
}

function getAgeColor(hours: number) {
  if (hours >= 72) return 'text-red-600 dark:text-red-400'
  if (hours >= 48) return 'text-amber-600 dark:text-amber-400'
  return 'text-gray-600 dark:text-slate-300'
}

function formatAge(hours: number): string {
  if (hours < 24) return `${Math.floor(hours)} hours`
  const days = Math.floor(hours / 24)
  return `${days} day${days > 1 ? 's' : ''}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short'
  })
}

function getActionClass(type: string) {
  switch (type) {
    case 'EMAIL': return 'bg-blue-100 text-blue-700'
    case 'SMS': return 'bg-purple-100 text-purple-700'
    case 'CALL': return 'bg-green-100 text-green-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}

function toggleHistory(id: string) {
  expandedHistory.value = expandedHistory.value === id ? null : id
}

async function fetchItems() {
  loading.value = true
  try {
    const response = await fetch(`${API_URL}/api/v2/chase/queue`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      items.value = data.items || []
    }
  } catch (error) {
    console.error('Error fetching chase items:', error)
  } finally {
    loading.value = false
  }
}

async function resendEmail(item: any) {
  actionLoading.value = item.id
  try {
    await fetch(`${API_URL}/api/v2/chase/${item.id}/resend-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      }
    })
    await fetchItems()
  } catch (error) {
    console.error('Error resending email:', error)
  } finally {
    actionLoading.value = null
  }
}

async function sendSms(item: any) {
  actionLoading.value = item.id
  try {
    await fetch(`${API_URL}/api/v2/chase/${item.id}/send-sms`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      }
    })
    await fetchItems()
  } catch (error) {
    console.error('Error sending SMS:', error)
  } finally {
    actionLoading.value = null
  }
}

function logCall(item: any) {
  callModalItem.value = item
  callOutcome.value = ''
  callNotes.value = ''
  showCallModal.value = true
}

async function submitCallLog() {
  if (!callModalItem.value || !callOutcome.value) return

  actionLoading.value = callModalItem.value.id
  try {
    await fetch(`${API_URL}/api/v2/chase/${callModalItem.value.id}/log-call`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        outcome: callOutcome.value,
        notes: callNotes.value
      })
    })
    showCallModal.value = false

    // If verbal given, open verbal modal
    if (callOutcome.value === 'VERBAL_GIVEN') {
      openVerbalModal(callModalItem.value)
    } else {
      await fetchItems()
    }
  } catch (error) {
    console.error('Error logging call:', error)
  } finally {
    actionLoading.value = null
  }
}

function openVerbalModal(item: any) {
  verbalModalItem.value = item
  showVerbalModal.value = true
}

function onVerbalSubmitted() {
  showVerbalModal.value = false
  fetchItems()
}

async function markReceived(item: any) {
  actionLoading.value = item.id
  try {
    await fetch(`${API_URL}/api/v2/chase/${item.id}/mark-received`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      }
    })
    await fetchItems()
  } catch (error) {
    console.error('Error marking received:', error)
  } finally {
    actionLoading.value = null
  }
}

function markUnable(item: any) {
  unableModalItem.value = item
  unableReason.value = ''
  showUnableModal.value = true
}

async function submitUnable() {
  if (!unableModalItem.value || !unableReason.value) return

  actionLoading.value = unableModalItem.value.id
  try {
    await fetch(`${API_URL}/api/v2/chase/${unableModalItem.value.id}/unable`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reason: unableReason.value
      })
    })
    showUnableModal.value = false
    await fetchItems()
  } catch (error) {
    console.error('Error marking unable:', error)
  } finally {
    actionLoading.value = null
  }
}

function refresh() {
  fetchItems()
}

function goBack() {
  router.push({ name: 'StaffDashboardV2' })
}

onMounted(() => {
  fetchItems()
})
</script>

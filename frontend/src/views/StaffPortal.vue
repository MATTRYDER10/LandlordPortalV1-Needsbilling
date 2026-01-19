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
      <div class="header">
        <h2 class="text-2xl font-bold text-gray-900 mb-4">Staff Portal</h2>
        <QueueStatsBar :stats="stats" />
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button :class="['tab', { active: activeTab === 'verify' }]" @click="activeTab = 'verify'">
          Verify Queue ({{ stats.verify.total }})
        </button>
        <button :class="['tab', { active: activeTab === 'chase' }]" @click="activeTab = 'chase'">
          Pending Responses ({{ stats.chase.total }})
        </button>
        <button :class="['tab', { active: activeTab === 'my-tasks' }]" @click="activeTab = 'my-tasks'">
          My Active Tasks ({{ myTasksCount }})
        </button>
        <button :class="['tab', 'email-issues-tab', { active: activeTab === 'email-issues' }]" @click="activeTab = 'email-issues'">
          Email Issues ({{ stats.emailIssues.total }})
        </button>
      </div>

      <!-- Tab Content -->
      <VerifyQueueTab
        v-if="activeTab === 'verify'"
        :items="verifyQueueItems"
        :loading="loadingVerify"
        :error="errorVerify"
        :claiming="claiming"
        :releasing="releasing"
        :current-user-id="currentUserId"
        :can-claim="canClaimMore"
        @claim="claimVerifyItem"
        @open="openVerifyItem"
        @release="releaseVerifyItem"
        @refresh="fetchVerifyQueue"
      />

      <ChaseQueueTab
        v-if="activeTab === 'chase'"
        :items="chaseQueueItems"
        :loading="loadingChase"
        :error="errorChase"
        :sending-email="sendingEmail"
        :sending-sms="sendingSms"
        @send-chase="sendChase"
        @mark-received="markReceived"
        @mark-done="markDoneForToday"
        @action-required="escalateToActionRequired"
        @refresh="fetchChaseQueue"
      />

      <MyActiveTasksTab
        v-if="activeTab === 'my-tasks'"
        :items="myActiveTasks"
        :loading="loadingMyTasks"
        :error="errorMyTasks"
        :releasing="releasing"
        @open="openTask"
        @release="releaseTask"
        @refresh="fetchMyTasks"
      />

      <EmailIssuesTab
        v-if="activeTab === 'email-issues'"
        :items="emailIssueItems"
        :loading="loadingEmailIssues"
        :error="errorEmailIssues"
        @open="openEmailIssue"
        @refresh="fetchEmailIssues"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onActivated } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { Check, X } from 'lucide-vue-next'
import StaffHeader from '../components/StaffHeader.vue'
import QueueStatsBar from '../components/staff/portal/QueueStatsBar.vue'
import VerifyQueueTab from '../components/staff/portal/VerifyQueueTab.vue'
import ChaseQueueTab from '../components/staff/portal/ChaseQueueTab.vue'
import MyActiveTasksTab from '../components/staff/portal/MyActiveTasksTab.vue'
import EmailIssuesTab from '../components/staff/portal/EmailIssuesTab.vue'
import type { VerifyQueueItem, ChaseQueueItem, ActiveTask, QueueStats, EmailIssueItem } from '@/types/staff'

const router = useRouter()
const authStore = useAuthStore()

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// State
const MAX_ACTIVE_ITEMS = 10
const activeTab = ref<'verify' | 'chase' | 'my-tasks' | 'email-issues'>('verify')

// Verify Queue State
const verifyQueueItems = ref<VerifyQueueItem[]>([])
const loadingVerify = ref(false)
const errorVerify = ref<string | null>(null)

// Chase Queue State
const chaseQueueItems = ref<ChaseQueueItem[]>([])
const loadingChase = ref(false)
const errorChase = ref<string | null>(null)

// My Tasks State
const myActiveTasks = ref<ActiveTask[]>([])
const loadingMyTasks = ref(false)
const errorMyTasks = ref<string | null>(null)

// Email Issues State
const emailIssueItems = ref<EmailIssueItem[]>([])
const loadingEmailIssues = ref(false)
const errorEmailIssues = ref<string | null>(null)

// Stats
const stats = ref<QueueStats>({
  chase: { available: 0, assigned: 0, inProgress: 0, myItems: 0, total: 0 },
  verify: { available: 0, assigned: 0, inProgress: 0, awaitingDocs: 0, myItems: 0, total: 0 },
  emailIssues: { total: 0 }
})

// Action state
const claiming = ref<string | null>(null)
const releasing = ref<string | null>(null)
const sendingEmail = ref<string | null>(null)
const sendingSms = ref<string | null>(null)
const refreshInterval = ref<number | null>(null)

// Toast
const toast = ref<{ show: boolean; message: string; type: 'success' | 'error' }>({
  show: false,
  message: '',
  type: 'success'
})

// Computed
const currentUserId = computed(() => authStore.user?.id || null)
const myTasksCount = computed(() => myActiveTasks.value.length)
const canClaimMore = computed(() => myTasksCount.value < MAX_ACTIVE_ITEMS)

// Toast helper
const showToast = (message: string, type: 'success' | 'error') => {
  toast.value = { show: true, message, type }
  setTimeout(() => {
    toast.value.show = false
  }, 3000)
}

// Fetch Functions
const fetchVerifyQueue = async () => {
  try {
    loadingVerify.value = true
    errorVerify.value = null

    const response = await fetch(`${API_URL}/api/verify/queue`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch verify queue')
    }

    const data = await response.json()
    verifyQueueItems.value = data.items || []
  } catch (err: any) {
    errorVerify.value = err.message
    console.error('Error fetching verify queue:', err)
  } finally {
    loadingVerify.value = false
  }
}

const fetchChaseQueue = async () => {
  try {
    loadingChase.value = true
    errorChase.value = null

    const response = await fetch(`${API_URL}/api/chase/queue`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch chase queue')
    }

    const data = await response.json()
    chaseQueueItems.value = data.items || []
  } catch (err: any) {
    errorChase.value = err.message
    console.error('Error fetching chase queue:', err)
  } finally {
    loadingChase.value = false
  }
}

const fetchMyTasks = async () => {
  try {
    loadingMyTasks.value = true
    errorMyTasks.value = null

    const response = await fetch(`${API_URL}/api/work-queue/my-tasks`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch my tasks')
    }

    const data = await response.json()
    myActiveTasks.value = data.tasks || []
  } catch (err: any) {
    errorMyTasks.value = err.message
    console.error('Error fetching my tasks:', err)
  } finally {
    loadingMyTasks.value = false
  }
}

const fetchEmailIssues = async () => {
  try {
    loadingEmailIssues.value = true
    errorEmailIssues.value = null

    const response = await fetch(`${API_URL}/api/email-issues/queue`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch email issues')
    }

    const data = await response.json()
    emailIssueItems.value = data.items || []
  } catch (err: any) {
    errorEmailIssues.value = err.message
    console.error('Error fetching email issues:', err)
  } finally {
    loadingEmailIssues.value = false
  }
}

const fetchStats = async () => {
  try {
    const response = await fetch(`${API_URL}/api/work-queue/stats`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch stats')
    }

    const data = await response.json()
    stats.value = data.stats
  } catch (err) {
    console.error('Error fetching stats:', err)
  }
}

// Verify Queue Actions
const claimVerifyItem = async (item: VerifyQueueItem) => {
  if (!canClaimMore.value) {
    showToast(`You already have ${MAX_ACTIVE_ITEMS} active tasks. Complete or release one first.`, 'error')
    return
  }

  try {
    claiming.value = item.id

    const response = await fetch(`${API_URL}/api/work-queue/${item.id}/claim`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to claim work item')
    }

    showToast('Work item claimed successfully', 'success')
    await Promise.all([fetchVerifyQueue(), fetchStats(), fetchMyTasks()])

    // Open the item immediately
    openVerifyItem(item)
  } catch (err: any) {
    showToast(err.message, 'error')
    console.error('Error claiming work item:', err)
  } finally {
    claiming.value = null
  }
}

const openVerifyItem = (item: VerifyQueueItem) => {
  router.push(`/staff/verify/${item.referenceId}?workItemId=${item.id}`)
}

const releaseVerifyItem = async (item: VerifyQueueItem) => {
  try {
    releasing.value = item.id

    const response = await fetch(`${API_URL}/api/work-queue/${item.id}/release`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to release work item')
    }

    showToast('Work item released', 'success')
    await Promise.all([fetchVerifyQueue(), fetchStats(), fetchMyTasks()])
  } catch (err: any) {
    showToast(err.message, 'error')
    console.error('Error releasing work item:', err)
  } finally {
    releasing.value = null
  }
}

// Chase Queue Actions
const sendChase = async (dependencyId: string, method: 'email' | 'sms') => {
  if (method === 'email') {
    sendingEmail.value = dependencyId
  } else {
    sendingSms.value = dependencyId
  }

  try {
    const response = await fetch(`${API_URL}/api/chase/${dependencyId}/chase`, {
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

    showToast(`${method === 'email' ? 'Email' : 'SMS'} sent successfully`, 'success')
    await fetchChaseQueue()
  } catch (err: any) {
    showToast(err.message, 'error')
    console.error('Error sending chase:', err)
  } finally {
    sendingEmail.value = null
    sendingSms.value = null
  }
}

const markReceived = async (dependencyId: string) => {
  try {
    const response = await fetch(`${API_URL}/api/chase/${dependencyId}/received`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to mark as received')
    }

    showToast('Marked as received', 'success')
    await Promise.all([fetchChaseQueue(), fetchStats()])
  } catch (err: any) {
    showToast(err.message, 'error')
    console.error('Error marking as received:', err)
  }
}

const escalateToActionRequired = async (dependencyId: string) => {
  try {
    const response = await fetch(`${API_URL}/api/chase/${dependencyId}/action-required`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason: 'Manual escalation by staff' })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to escalate')
    }

    showToast('Escalated to Action Required', 'success')
    await fetchChaseQueue()
  } catch (err: any) {
    showToast(err.message, 'error')
    console.error('Error escalating:', err)
  }
}

const markDoneForToday = async (sectionId: string, note: string) => {
  try {
    const response = await fetch(`${API_URL}/api/chase/${sectionId}/mark-done`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ note })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to mark as done')
    }

    showToast('Marked done for today', 'success')
    await fetchChaseQueue()
  } catch (err: any) {
    showToast(err.message, 'error')
    console.error('Error marking as done:', err)
  }
}

// My Tasks Actions
const openTask = (task: ActiveTask) => {
  if (task.workType === 'VERIFY') {
    router.push(`/staff/verify/${task.referenceId}?workItemId=${task.id}`)
  } else if (task.workType === 'CHASE') {
    router.push(`/staff/chase/${task.id}`)
  }
}

const releaseTask = async (task: ActiveTask) => {
  try {
    releasing.value = task.id

    const response = await fetch(`${API_URL}/api/work-queue/${task.id}/release`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to release task')
    }

    showToast('Task released', 'success')
    await Promise.all([fetchVerifyQueue(), fetchChaseQueue(), fetchStats(), fetchMyTasks()])
  } catch (err: any) {
    showToast(err.message, 'error')
    console.error('Error releasing task:', err)
  } finally {
    releasing.value = null
  }
}

// Email Issues Actions
const openEmailIssue = (item: EmailIssueItem) => {
  router.push(`/staff/references/${item.referenceId}`)
}

// Auto-refresh
const startAutoRefresh = () => {
  refreshInterval.value = window.setInterval(() => {
    fetchVerifyQueue()
    fetchChaseQueue()
    fetchStats()
    fetchMyTasks()
    fetchEmailIssues()
  }, 30000)
}

const stopAutoRefresh = () => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
    refreshInterval.value = null
  }
}

// Lifecycle
onMounted(() => {
  fetchVerifyQueue()
  fetchChaseQueue()
  fetchStats()
  fetchMyTasks()
  fetchEmailIssues()
  startAutoRefresh()
})

onActivated(() => {
  fetchVerifyQueue()
  fetchChaseQueue()
  fetchStats()
  fetchMyTasks()
  fetchEmailIssues()
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped>
.header {
  margin-bottom: 2rem;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid #e5e7eb;
}

.tab {
  padding: 0.75rem 1.5rem;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  font-size: 1rem;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
}

.tab:hover {
  color: #1f2937;
  background: #f9fafb;
}

.tab.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.tab.email-issues-tab {
  color: #dc2626;
}

.tab.email-issues-tab.active {
  color: #dc2626;
  border-bottom-color: #dc2626;
}
</style>

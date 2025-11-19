<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <StaffHeader />

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="header">
        <h2 class="text-2xl font-bold text-gray-900 mb-4">Work Queue</h2>
        <div class="stats-bar">
          <div class="stat-card chase">
            <div class="stat-label">Chase Queue</div>
            <div class="stat-value">{{ stats.chase.total }}</div>
            <div class="stat-breakdown">
              <span class="stat-chip available">
                <span class="dot"></span>
                {{ stats.chase.available }} Available
              </span>
              <span class="stat-chip assigned">
                <span class="dot"></span>
                {{ stats.chase.assigned }} Assigned
              </span>
              <span class="stat-chip in-progress">
                <span class="dot"></span>
                {{ stats.chase.inProgress }} In Progress
              </span>
            </div>
          </div>
          <div class="stat-card verify">
            <div class="stat-label">Verify Queue</div>
            <div class="stat-value">{{ stats.verify.total }}</div>
            <div class="stat-breakdown">
              <span class="stat-chip available">
                <span class="dot"></span>
                {{ stats.verify.available }} Available
              </span>
              <span class="stat-chip assigned">
                <span class="dot"></span>
                {{ stats.verify.assigned }} Assigned
              </span>
              <span class="stat-chip in-progress">
                <span class="dot"></span>
                {{ stats.verify.inProgress }} In Progress
              </span>
            </div>
          </div>
          <div class="stat-card my-items">
            <div class="stat-label">My Active Cases</div>
            <div class="stat-value">{{ stats.chase.myItems + stats.verify.myItems }}</div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button :class="['tab', { active: activeTab === 'chase' }]" @click="activeTab = 'chase'">
          Chase Queue ({{ stats.chase.total }})
        </button>
        <button :class="['tab', { active: activeTab === 'verify' }]" @click="activeTab = 'verify'">
          Verify Queue ({{ stats.verify.total }})
        </button>
        <button :class="['tab', { active: activeTab === 'my-cases' }]" @click="activeTab = 'my-cases'">
          My Cases ({{ stats.chase.myItems + stats.verify.myItems }})
        </button>
      </div>
      <p class="tab-help">
        You can hold up to {{ MAX_ACTIVE_ITEMS }} active cases. Items idle for 2 hours are automatically returned and
        escalated.
      </p>

      <!-- Loading State -->
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <p>Loading work queue...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-message">
        <p>{{ error }}</p>
        <button @click="fetchWorkQueue" class="btn btn-primary">Retry</button>
      </div>

      <!-- Work Queue Table -->
      <div v-else class="work-queue-table">
        <table v-if="filteredWorkItems.length > 0">
          <thead>
            <tr>
              <th>Urgency</th>
              <th>Type</th>
              <th>Tenant</th>
              <th>Property</th>
              <th>Age</th>
              <th>Status</th>
              <th>Assigned To</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredWorkItems" :key="item.id" :class="['work-item', `urgency-${item.urgency}`]">
              <td>
                <span :class="['urgency-badge', item.urgency]">
                  {{ urgencyLabel(item.urgency) }}
                </span>
              </td>
              <td>
                <span :class="['type-badge', item.work_type.toLowerCase()]">
                  {{ item.work_type }}
                </span>
              </td>
              <td>
                <div class="tenant-info">
                  <div class="tenant-name">
                    {{ item.reference.tenant_first_name }} {{ item.reference.tenant_last_name }}
                  </div>
                  <div class="tenant-email">{{ item.reference.tenant_email }}</div>
                </div>
              </td>
              <td>
                <div class="property-address">{{ item.reference.property_address }}</div>
              </td>
              <td>
                <div class="age-info">
                  <div class="age-hours">{{ item.ageHours }}h</div>
                  <div class="age-label">{{ ageLabel(item.ageHours) }}</div>
                </div>
              </td>
              <td>
                <span :class="['status-badge', item.status.toLowerCase()]">
                  {{ item.status }}
                </span>
              </td>
              <td>
                <div v-if="item.assigned_staff" class="assigned-info">
                  {{ item.assigned_staff.full_name }}
                </div>
                <div v-else class="unassigned">Unassigned</div>
              </td>
              <td>
                <div class="actions">
                  <button v-if="item.status === 'AVAILABLE' || item.status === 'RETURNED'" @click="claimWorkItem(item)"
                    class="btn btn-sm btn-primary" :disabled="claiming === item.id || !canClaimMoreItems">
                    {{ claiming === item.id ? 'Claiming...' : 'Pick Up' }}
                  </button>
                  <button v-else-if="isMyItem(item)" @click="openWorkItem(item)" class="btn btn-sm btn-success">
                    Open
                  </button>
                  <button v-if="isMyItem(item)" @click="releaseWorkItem(item)" class="btn btn-sm btn-secondary"
                    :disabled="releasing === item.id">
                    {{ releasing === item.id ? 'Releasing...' : 'Release' }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-else class="empty-state">
          <p>No work items in this queue</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onActivated } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import StaffHeader from '../components/StaffHeader.vue'

const router = useRouter()
const authStore = useAuthStore()

// State
const MAX_ACTIVE_ITEMS = 10
const AUTO_RETURN_THRESHOLD_MS = 2 * 60 * 60 * 1000 // 2 hours

const activeTab = ref<'chase' | 'verify' | 'my-cases'>('chase')
const workItems = ref<any[]>([])
const stats = ref({
  chase: { available: 0, assigned: 0, inProgress: 0, myItems: 0, total: 0 },
  verify: { available: 0, assigned: 0, inProgress: 0, myItems: 0, total: 0 }
})
const loading = ref(false)
const error = ref<string | null>(null)
const claiming = ref<string | null>(null)
const releasing = ref<string | null>(null)
const refreshInterval = ref<number | null>(null)

// Computed
const myActiveItems = computed(() => workItems.value.filter(item => isMyItem(item)))
const myActiveItemsCount = computed(() => myActiveItems.value.length)
const canClaimMoreItems = computed(() => myActiveItemsCount.value < MAX_ACTIVE_ITEMS)

const filteredWorkItems = computed(() => {
  const items =
    activeTab.value === 'my-cases'
      ? myActiveItems.value
      : workItems.value.filter(item => item.work_type === activeTab.value.toUpperCase())

  return [...items].sort((a, b) => {
    const dateA =
      new Date(a.reference?.move_in_date ?? a.reference?.created_at ?? a.created_at ?? 0).getTime()
    const dateB =
      new Date(b.reference?.move_in_date ?? b.reference?.created_at ?? b.created_at ?? 0).getTime()
    return dateA - dateB
  })
})

// Methods
const fetchWorkQueue = async () => {
  try {
    loading.value = true
    error.value = null

    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/work-queue`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch work queue')
    }

    const data = await response.json()
    workItems.value = data.workItems || []
    await autoReturnStaleItems()
  } catch (err: any) {
    error.value = err.message
    console.error('Error fetching work queue:', err)
  } finally {
    loading.value = false
  }
}

const fetchStats = async () => {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/work-queue/stats`, {
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

const claimWorkItem = async (item: any) => {
  if (!canClaimMoreItems.value) {
    alert(`You already have ${MAX_ACTIVE_ITEMS} active cases. Complete or release one before picking up another.`)
    return
  }

  try {
    claiming.value = item.id

    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/work-queue/${item.id}/claim`, {
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

    // Refresh queue
    await fetchWorkQueue()
    await fetchStats()

    // Open the work item immediately
    openWorkItem(item)
  } catch (err: any) {
    alert(`Error claiming work item: ${err.message}`)
    console.error('Error claiming work item:', err)
  } finally {
    claiming.value = null
  }
}

const releaseWorkItem = async (
  item: any,
  options?: { forceUrgent?: boolean; suppressAlert?: boolean }
) => {
  const cooldownHours = options?.forceUrgent ? 0 : item.work_type === 'CHASE' ? 4 : 0

  try {
    releasing.value = item.id

    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/work-queue/${item.id}/release`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        cooldownHours,
        forceUrgent: Boolean(options?.forceUrgent)
      })
    })

    if (!response.ok) {
      throw new Error('Failed to release work item')
    }

    // Refresh queue
    await fetchWorkQueue()
    await fetchStats()
  } catch (err: any) {
    if (!options?.suppressAlert) {
      alert(`Error releasing work item: ${err.message}`)
    }
    console.error('Error releasing work item:', err)
  } finally {
    releasing.value = null
  }
}

const openWorkItem = (item: any) => {
  if (item.work_type === 'CHASE') {
    router.push(`/staff/work-queue/chase/${item.id}`)
  } else if (item.work_type === 'VERIFY') {
    router.push(`/staff/verification/${item.reference_id}?workItemId=${item.id}`)
  }
}

const isMyItem = (item: any) => {
  const currentUserId = authStore.user?.id
  if (!currentUserId) return false
  if (item.assigned_staff?.user_id) {
    return item.assigned_staff.user_id === currentUserId
  }
  return false
}

const urgencyLabel = (urgency: string) => {
  switch (urgency) {
    case 'urgent': return 'URGENT'
    case 'warning': return 'WARNING'
    default: return 'NORMAL'
  }
}

const ageLabel = (hours: number) => {
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}


// Auto-refresh every 30 seconds
const autoReturnInProgress = ref(false)
const autoReturnStaleItems = async () => {
  if (autoReturnInProgress.value) return
  autoReturnInProgress.value = true
  try {
    const now = Date.now()
    for (const item of workItems.value) {
      if (
        !isMyItem(item) ||
        !item.claimed_at ||
        !['ASSIGNED', 'IN_PROGRESS'].includes(item.status)
      ) {
        continue
      }
      const claimedAtTime = new Date(item.claimed_at).getTime()
      if (!claimedAtTime) continue
      if (now - claimedAtTime >= AUTO_RETURN_THRESHOLD_MS) {
        await releaseWorkItem(item, { forceUrgent: true, suppressAlert: true })
      }
    }
  } finally {
    autoReturnInProgress.value = false
  }
}

const startAutoRefresh = () => {
  refreshInterval.value = window.setInterval(() => {
    fetchWorkQueue()
    fetchStats()
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
  fetchWorkQueue()
  fetchStats()
  startAutoRefresh()
})

onActivated(() => {
  fetchWorkQueue()
  fetchStats()
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped>
.header {
  margin-bottom: 2rem;
}

.stats-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.stat-card {
  padding: 1rem;
  border-radius: 8px;
  background: white;
  border: 2px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stat-card.chase {
  border-color: #f97316;
}

.stat-card.verify {
  border-color: #3b82f6;
}

.stat-card.my-items {
  border-color: #10b981;
}

.stat-label {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
}

.stat-breakdown {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.stat-chip {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  background: #f3f4f6;
  color: #374151;
}

.stat-chip .dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  display: inline-block;
}

.stat-chip.available .dot {
  background: #10b981;
}

.stat-chip.assigned .dot {
  background: #3b82f6;
}

.stat-chip.in-progress .dot {
  background: #f59e0b;
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
  color: #f97316;
  border-bottom-color: #f97316;
}

.tab-help {
  margin: 0.5rem 0 1.5rem;
  font-size: 0.875rem;
  color: #6b7280;
}
.loading {
  text-align: center;
  padding: 3rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e5e7eb;
  border-top-color: #f97316;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-message {
  text-align: center;
  padding: 2rem;
  color: #dc2626;
}

.work-queue-table {
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  background: #f9fafb;
  padding: 0.75rem 1rem;
  text-align: left;
  font-size: 0.875rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  border-bottom: 2px solid #e5e7eb;
}

td {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.work-item.urgency-urgent {
  background: #fef2f2;
}

.work-item.urgency-warning {
  background: #fffbeb;
}

.urgency-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.urgency-badge.urgent {
  background: #dc2626;
  color: white;
}

.urgency-badge.warning {
  background: #f59e0b;
  color: white;
}

.urgency-badge.normal {
  background: #10b981;
  color: white;
}

.type-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.type-badge.chase {
  background: #fed7aa;
  color: #9a3412;
}

.type-badge.verify {
  background: #bfdbfe;
  color: #1e40af;
}

.tenant-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tenant-name {
  font-weight: 600;
  color: #1f2937;
}

.tenant-email {
  font-size: 0.875rem;
  color: #6b7280;
}

.property-address {
  font-size: 0.875rem;
  color: #4b5563;
}

.age-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.age-hours {
  font-weight: 600;
  color: #1f2937;
}

.age-label {
  font-size: 0.75rem;
  color: #6b7280;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.available {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.assigned {
  background: #dbeafe;
  color: #1e40af;
}

.status-badge.in_progress {
  background: #fef3c7;
  color: #92400e;
}

.status-badge.returned {
  background: #e5e7eb;
  color: #374151;
}

.assigned-info {
  font-size: 0.875rem;
  color: #4b5563;
}

.unassigned {
  font-size: 0.875rem;
  color: #9ca3af;
  font-style: italic;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
}

.btn-primary {
  background: #f97316;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #ea580c;
}

.btn-success {
  background: #10b981;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #059669;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #4b5563;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty-state {
  padding: 3rem;
  text-align: center;
  color: #6b7280;
}
</style>

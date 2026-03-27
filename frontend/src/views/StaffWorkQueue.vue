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
        <h2 class="text-2xl font-bold text-gray-900 mb-4">Work Queue</h2>
        <div class="stats-bar">
          <div class="stat-card chase">
            <div class="stat-label">Chase Queue</div>
            <div class="stat-value">{{ stats.chase.total }}</div>
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
            <div class="stat-value">{{ stats.verify.myItems }}</div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button :class="['tab', { active: activeTab === 'verify' }]" @click="activeTab = 'verify'">
          Verify Queue ({{ stats.verify.total }})
        </button>
        <button :class="['tab', { active: activeTab === 'awaiting-docs' }]" @click="activeTab = 'awaiting-docs'">
          Awaiting Docs ({{ stats.verify.awaitingDocs || 0 }})
        </button>
        <button :class="['tab', { active: activeTab === 'chase' }]" @click="activeTab = 'chase'">
          Chase Queue ({{ stats.chase.total }})
        </button>
        <button :class="['tab', { active: activeTab === 'my-cases' }]" @click="activeTab = 'my-cases'">
          My Cases ({{ stats.verify.myItems }})
        </button>
      </div>
      <p v-if="activeTab === 'chase'" class="tab-help">
        References awaiting responses from landlords, agents, employers, accountants, or guarantors. Use Email/SMS to send reminders with form links.
      </p>
      <p v-else-if="activeTab === 'awaiting-docs'" class="tab-help">
        References where additional documentation has been requested from the tenant. Items will return to the verify queue when documents are uploaded.
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

      <!-- Chase Queue (card-based layout) -->
      <div v-else-if="activeTab === 'chase'" class="chase-list">
        <div v-if="chaseItems.length === 0" class="empty-state">
          <CheckCircle class="mx-auto h-12 w-12 text-green-400" />
          <p class="mt-2">All caught up! No references waiting for responses.</p>
        </div>

        <div v-else class="space-y-4">
          <div v-for="item in chaseItems" :key="item.id" class="chase-card">
            <div class="chase-card-header">
              <div class="chase-card-info">
                <router-link :to="`/staff/references/${item.id}`" class="chase-tenant-name">
                  {{ item.tenant_name }}
                </router-link>
                <span :class="['days-badge', item.days_pending >= 7 ? 'urgent' : item.days_pending >= 3 ? 'warning' : 'normal']">
                  {{ item.days_pending }} days since requested
                </span>
              </div>
            </div>
            <div class="chase-card-details">
              <div class="chase-property">{{ item.property_address }}</div>
              <div class="chase-meta">Company: {{ item.company?.name || 'Unknown' }} • Submitted: {{ formatDate(item.submitted_at) }}</div>
            </div>

            <div class="chase-missing">
              <h4 class="chase-section-title">Missing Responses:</h4>
              <div class="chase-tags">
                <span v-for="response in item.missing_responses" :key="response" class="chase-tag missing">
                  {{ response }}
                </span>
              </div>
            </div>

            <div v-if="item.contacts_to_chase.length > 0" class="chase-contacts">
              <h4 class="chase-section-title">Contacts to Chase:</h4>
              <div v-for="(contact, idx) in item.contacts_to_chase" :key="idx" class="chase-contact">
                <div class="chase-contact-info">
                  <div class="chase-contact-header">
                    <span class="chase-contact-type">{{ contact.type }}</span>
                    <span class="chase-contact-name">{{ contact.name }}</span>
                  </div>
                  <div class="chase-contact-details">
                    <a :href="`mailto:${contact.email}`" class="chase-contact-email">{{ contact.email }}</a>
                    <span v-if="contact.phone" class="chase-contact-phone">• {{ contact.phone }}</span>
                  </div>
                  <div v-if="contact.sentDate" class="chase-contact-sent">
                    Request sent: {{ formatDate(contact.sentDate) }}
                  </div>
                  <div v-else class="chase-contact-warning">
                    ⚠️ Awaiting response - contact if needed
                  </div>
                </div>
                <div class="chase-contact-actions">
                  <button
                    @click="openEmailModal(item.id, contact)"
                    class="btn btn-sm btn-primary"
                    title="Send chase email with form link (click to edit email)"
                  >
                    <Mail class="w-4 h-4 mr-1" />
                    Email
                  </button>
                  <button
                    v-if="contact.phone"
                    @click="sendReminder(item.id, contact.type, 'sms')"
                    :disabled="isSending(`${item.id}-${contact.type}-sms`)"
                    class="btn btn-sm btn-sms"
                    title="Send SMS with form link"
                  >
                    <Loader2 v-if="isSending(`${item.id}-${contact.type}-sms`)" class="animate-spin w-4 h-4 mr-1" />
                    <MessageSquare v-else class="w-4 h-4 mr-1" />
                    {{ isSending(`${item.id}-${contact.type}-sms`) ? 'Sending...' : 'SMS' }}
                  </button>
                  <a
                    v-if="contact.phone"
                    :href="`tel:${contact.phone}`"
                    class="btn btn-sm btn-secondary"
                    title="Call contact"
                  >
                    <Phone class="w-4 h-4 mr-1" />
                    Call
                  </a>
                </div>
              </div>
            </div>

            <div v-else class="chase-no-contacts">
              <p>No contact information available yet. The emails have not been sent or contacts haven't been created.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Work Queue Table (Verify & My Cases) -->
      <div v-else class="work-queue-table">
        <table v-if="filteredWorkItems.length > 0">
          <thead>
            <tr>
              <th>Urgency</th>
              <th>Type</th>
              <th>Person Type</th>
              <th>Person</th>
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
                <span :class="['person-type-badge', item.reference.is_guarantor ? 'guarantor' : 'tenant']">
                  {{ item.reference.is_guarantor ? 'Guarantor' : 'Tenant' }}
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
                <span v-if="item.metadata?.awaiting_documentation" class="awaiting-docs-badge">
                  Awaiting Docs
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

    <!-- Email Edit Modal -->
    <div v-if="showEmailModal" class="modal-overlay" @click="closeEmailModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Send Reference Request Email</h3>
          <button @click="closeEmailModal" class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="sendEmailFromModal">
            <div class="form-group">
              <label>Contact Type</label>
              <input
                type="text"
                :value="emailModalContactType"
                readonly
                class="form-input readonly"
              />
            </div>

            <div class="form-group">
              <label>Recipient Name</label>
              <input
                type="text"
                :value="emailModalContactName"
                readonly
                class="form-input readonly"
              />
            </div>

            <div class="form-group">
              <label>Email Address *</label>
              <input
                v-model="emailModalNewEmail"
                type="email"
                placeholder="Enter email address"
                required
                class="form-input"
              />
              <p class="help-text">
                You can edit this email address. If changed, the new email will be saved permanently.
              </p>
            </div>

            <div v-if="emailModalError" class="error-message-box">
              {{ emailModalError }}
            </div>

            <div class="modal-actions">
              <button type="button" @click="closeEmailModal" class="btn btn-secondary">
                Cancel
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                :disabled="emailModalSending || !emailModalNewEmail"
              >
                {{ emailModalSending ? 'Sending...' : 'Send Email' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onActivated } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { Check, X, CheckCircle, Mail, MessageSquare, Phone, Loader2 } from 'lucide-vue-next'
import StaffHeader from '../components/StaffHeader.vue'

const API_URL = import.meta.env.VITE_API_URL ?? ''

const router = useRouter()
const authStore = useAuthStore()
// State
const MAX_ACTIVE_ITEMS = 10
const AUTO_RETURN_THRESHOLD_MS = 2 * 60 * 60 * 1000 // 2 hours

const activeTab = ref<'chase' | 'verify' | 'my-cases' | 'awaiting-docs'>('verify')
const workItems = ref<any[]>([])
const chaseItems = ref<any[]>([])
const stats = ref({
  chase: { available: 0, assigned: 0, inProgress: 0, myItems: 0, total: 0 },
  verify: { available: 0, assigned: 0, inProgress: 0, awaitingDocs: 0, myItems: 0, total: 0 }
})
const loading = ref(false)
const error = ref<string | null>(null)
const claiming = ref<string | null>(null)
const releasing = ref<string | null>(null)
const refreshInterval = ref<number | null>(null)
const sendingStatus = ref<Record<string, boolean>>({})
const toast = ref<{ show: boolean; message: string; type: 'success' | 'error' }>({
  show: false,
  message: '',
  type: 'success'
})

// Email edit modal state
const showEmailModal = ref(false)
const emailModalReferenceId = ref<string>('')
const emailModalContactType = ref<string>('')
const emailModalContactName = ref<string>('')
const emailModalCurrentEmail = ref<string>('')
const emailModalNewEmail = ref<string>('')
const emailModalSending = ref(false)
const emailModalError = ref<string>('')

// Computed
const myActiveItems = computed(() => workItems.value.filter(item => isMyItem(item)))
const myActiveItemsCount = computed(() => myActiveItems.value.length)
const canClaimMoreItems = computed(() => myActiveItemsCount.value < MAX_ACTIVE_ITEMS)

const filteredWorkItems = computed(() => {
  let items: any[]
  if (activeTab.value === 'my-cases') {
    items = myActiveItems.value
  } else if (activeTab.value === 'awaiting-docs') {
    // Filter for VERIFY items that are awaiting documentation
    items = workItems.value.filter(item =>
      item.work_type === 'VERIFY' && item.metadata?.awaiting_documentation === true
    )
  } else {
    items = workItems.value.filter(item => item.work_type === activeTab.value.toUpperCase())
  }

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
    // Update verify stats from work queue, chase stats come from chase list
    stats.value.verify = data.stats.verify
  } catch (err) {
    console.error('Error fetching stats:', err)
  }
}

const fetchChaseList = async () => {
  try {
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
    // Update chase stats
    stats.value.chase = {
      available: chaseItems.value.length,
      assigned: 0,
      inProgress: 0,
      myItems: 0,
      total: chaseItems.value.length
    }
  } catch (err) {
    console.error('Error fetching chase list:', err)
  }
}

const isSending = (key: string) => sendingStatus.value[key] || false

const showToast = (message: string, type: 'success' | 'error') => {
  toast.value = { show: true, message, type }
  setTimeout(() => {
    toast.value.show = false
  }, 3000)
}

// Email modal methods
const openEmailModal = (referenceId: string, contact: { type: string; name: string; email: string }) => {
  emailModalReferenceId.value = referenceId
  emailModalContactType.value = contact.type
  emailModalContactName.value = contact.name
  emailModalCurrentEmail.value = contact.email
  emailModalNewEmail.value = contact.email
  emailModalError.value = ''
  showEmailModal.value = true
}

const closeEmailModal = () => {
  showEmailModal.value = false
  emailModalReferenceId.value = ''
  emailModalContactType.value = ''
  emailModalContactName.value = ''
  emailModalCurrentEmail.value = ''
  emailModalNewEmail.value = ''
  emailModalError.value = ''
}

const isValidEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

const sendEmailFromModal = async () => {
  if (!emailModalNewEmail.value) {
    emailModalError.value = 'Please enter an email address'
    return
  }
  if (!isValidEmail(emailModalNewEmail.value)) {
    emailModalError.value = 'Please enter a valid email address'
    return
  }

  emailModalSending.value = true
  emailModalError.value = ''

  try {
    const token = authStore.session?.access_token

    const response = await fetch(`${API_URL}/api/staff/chase/${emailModalReferenceId.value}/send-reminder`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contactType: emailModalContactType.value,
        method: 'email',
        newEmail: emailModalNewEmail.value !== emailModalCurrentEmail.value ? emailModalNewEmail.value : undefined
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to send email')
    }

    showToast(`Email sent successfully to ${emailModalNewEmail.value}`, 'success')
    closeEmailModal()

    // Refresh the chase list to update any changed emails
    await fetchChaseList()
  } catch (err: any) {
    console.error('Error sending email:', err)
    emailModalError.value = err.message || 'Failed to send email'
  } finally {
    emailModalSending.value = false
  }
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
      // Update stats
      stats.value.chase.total = chaseItems.value.length
      stats.value.chase.available = chaseItems.value.length
    }
  } catch (err: any) {
    console.error('Error sending reminder:', err)
    showToast(err.message || 'Failed to send reminder', 'error')
  } finally {
    sendingStatus.value[key] = false
  }
}

const formatDate = (dateString?: string | null) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
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
        !isMyItem(item) &&
        !item.claimed_at &&
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
    fetchChaseList()
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
  fetchChaseList()
  startAutoRefresh()
})

onActivated(() => {
  fetchWorkQueue()
  fetchStats()
  fetchChaseList()
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
  border-color: var(--color-primary);
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
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
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
  border-top-color: var(--color-primary);
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

.person-type-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.person-type-badge.tenant {
  background: #dbeafe;
  color: #1e40af;
}

.person-type-badge.guarantor {
  background: #f3e8ff;
  color: #6b21a8;
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

.awaiting-docs-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  margin-left: 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  background: #fef3c7;
  color: #b45309;
  border: 1px solid #f59e0b;
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
  background: var(--color-primary);
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

/* Chase List Styles */
.chase-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.chase-card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
}

.chase-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.chase-card-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.chase-tenant-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-primary);
  text-decoration: none;
}

.chase-tenant-name:hover {
  color: #ea580c;
  text-decoration: underline;
}

.days-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.days-badge.urgent {
  background: #fee2e2;
  color: #991b1b;
}

.days-badge.warning {
  background: #fef3c7;
  color: #92400e;
}

.days-badge.normal {
  background: #f3f4f6;
  color: #4b5563;
}

.chase-card-details {
  margin-bottom: 1rem;
}

.chase-property {
  font-size: 0.875rem;
  color: #4b5563;
}

.chase-meta {
  font-size: 0.75rem;
  color: #9ca3af;
  margin-top: 0.25rem;
}

.chase-missing {
  margin-bottom: 1rem;
}

.chase-section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
}

.chase-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.chase-tag {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.chase-tag.missing {
  background: #fee2e2;
  color: #991b1b;
}

.chase-contacts {
  border-top: 1px solid #e5e7eb;
  padding-top: 1rem;
}

.chase-contact {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 8px;
  margin-top: 0.75rem;
}

.chase-contact:first-of-type {
  margin-top: 0.5rem;
}

.chase-contact-info {
  flex: 1;
}

.chase-contact-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.25rem;
}

.chase-contact-type {
  padding: 0.25rem 0.5rem;
  background: #dbeafe;
  color: #1e40af;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.chase-contact-name {
  font-weight: 500;
  color: #1f2937;
}

.chase-contact-details {
  font-size: 0.875rem;
  color: #4b5563;
}

.chase-contact-email {
  color: var(--color-primary);
  text-decoration: none;
}

.chase-contact-email:hover {
  text-decoration: underline;
}

.chase-contact-phone {
  color: #6b7280;
}

.chase-contact-sent {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.chase-contact-warning {
  font-size: 0.75rem;
  color: #d97706;
  font-weight: 500;
  margin-top: 0.25rem;
}

.chase-contact-actions {
  display: flex;
  gap: 0.5rem;
  margin-left: 1rem;
}

.btn-sms {
  background: #10b981;
  color: white;
  display: inline-flex;
  align-items: center;
}

.btn-sms:hover:not(:disabled) {
  background: #059669;
}

.btn-sm {
  display: inline-flex;
  align-items: center;
}

.chase-no-contacts {
  padding: 0.75rem;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 8px;
  margin-top: 1rem;
}

.chase-no-contacts p {
  font-size: 0.875rem;
  color: #92400e;
  margin: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* Email Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #6b7280;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.modal-close:hover {
  color: #1f2937;
  background: #f3f4f6;
}

.modal-body {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
}

.form-input {
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  font-family: inherit;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1);
}

.form-input.readonly {
  background-color: #f9fafb;
  color: #6b7280;
  cursor: not-allowed;
}

.help-text {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.5rem;
}

.error-message-box {
  color: #dc2626;
  font-size: 0.875rem;
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: #fef2f2;
  border-radius: 6px;
  border: 1px solid #fee2e2;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
  margin-top: 0.5rem;
}
</style>

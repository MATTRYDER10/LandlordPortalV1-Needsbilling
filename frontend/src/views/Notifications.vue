<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useToast } from 'vue-toastification'
import Sidebar from '../components/Sidebar.vue'
import { Bell, Building, Check, Clock, AlertTriangle, X, ChevronRight } from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()

interface Notification {
  id: string
  notification_type: string
  resource_type: string
  resource_id: string
  title: string
  message: string
  severity: 'INFO' | 'WARNING' | 'URGENT'
  metadata: Record<string, any>
  read_by: string[]
  dismissed_by: string[]
  created_at: string
  expires_at: string | null
}

const notifications = ref<Notification[]>([])
const loading = ref(true)
const selectedFilter = ref<'all' | 'unread' | 'urgent'>('all')

// Fetch all notifications
async function fetchNotifications() {
  loading.value = true
  try {
    const token = authStore.session?.access_token

    const response = await fetch(`${API_URL}/api/notifications?includeRead=true`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      notifications.value = data.notifications || []
    }
  } catch (err) {
    console.error('Error fetching notifications:', err)
    toast.error('Failed to load notifications')
  } finally {
    loading.value = false
  }
}

// Mark notification as read
async function markAsRead(notificationId: string) {
  try {
    const token = authStore.session?.access_token

    const response = await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok) {
      // Update local state
      const notif = notifications.value.find(n => n.id === notificationId)
      if (notif && authStore.user?.id) {
        notif.read_by = [...(notif.read_by || []), authStore.user.id]
      }
    }
  } catch (err) {
    console.error('Error marking notification as read:', err)
  }
}

// Dismiss notification
async function dismissNotification(notificationId: string) {
  try {
    const token = authStore.session?.access_token

    const response = await fetch(`${API_URL}/api/notifications/${notificationId}/dismiss`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok) {
      // Remove from local state
      notifications.value = notifications.value.filter(n => n.id !== notificationId)
      toast.success('Notification dismissed')
    }
  } catch (err) {
    console.error('Error dismissing notification:', err)
    toast.error('Failed to dismiss notification')
  }
}

// Mark all as read
async function markAllAsRead() {
  try {
    const token = authStore.session?.access_token

    const response = await fetch(`${API_URL}/api/notifications/read-all`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok) {
      // Update local state
      const userId = authStore.user?.id
      if (userId) {
        notifications.value.forEach(n => {
          if (!n.read_by?.includes(userId)) {
            n.read_by = [...(n.read_by || []), userId]
          }
        })
      }
      toast.success('All notifications marked as read')
    }
  } catch (err) {
    console.error('Error marking all as read:', err)
    toast.error('Failed to mark all as read')
  }
}

// Check if notification is read
function isRead(notification: Notification): boolean {
  const userId = authStore.user?.id
  return !!(userId && notification.read_by?.includes(userId))
}

// Navigate to notification resource
function navigateTo(notification: Notification) {
  // Mark as read when clicked
  if (!isRead(notification)) {
    markAsRead(notification.id)
  }

  // Navigate based on resource type
  if (notification.resource_type === 'property') {
    router.push(`/properties/${notification.resource_id}`)
  } else if (notification.resource_type === 'compliance') {
    const propertyId = notification.metadata?.property_id
    if (propertyId) {
      router.push(`/properties/${propertyId}`)
    }
  }
}

// Filtered notifications
const filteredNotifications = computed(() => {
  let filtered = notifications.value

  if (selectedFilter.value === 'unread') {
    filtered = filtered.filter(n => !isRead(n))
  } else if (selectedFilter.value === 'urgent') {
    filtered = filtered.filter(n => n.severity === 'URGENT')
  }

  // Sort by date (newest first)
  return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
})

// Stats
const unreadCount = computed(() => notifications.value.filter(n => !isRead(n)).length)
const urgentCount = computed(() => notifications.value.filter(n => n.severity === 'URGENT').length)

// Format date
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) {
    return `${diffMins}m ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else if (diffDays < 7) {
    return `${diffDays}d ago`
  } else {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }
}

// Get severity color
function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'URGENT':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'WARNING':
      return 'bg-amber-100 text-amber-800 border-amber-200'
    default:
      return 'bg-blue-100 text-blue-800 border-blue-200'
  }
}

// Get severity icon
function getSeverityIcon(severity: string) {
  switch (severity) {
    case 'URGENT':
      return AlertTriangle
    case 'WARNING':
      return Clock
    default:
      return Bell
  }
}

// Get notification type label
function getTypeLabel(type: string): string {
  switch (type) {
    case 'compliance_expiring':
      return 'Compliance Expiring'
    case 'compliance_expired':
      return 'Compliance Expired'
    default:
      return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }
}

onMounted(() => {
  fetchNotifications()
})
</script>

<template>
  <Sidebar>
    <div class="p-8">
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h2 class="text-3xl font-bold text-gray-900">Notifications</h2>
          <p class="mt-2 text-gray-600">Stay updated on property compliance and important alerts</p>
        </div>
        <button
          v-if="unreadCount > 0"
          @click="markAllAsRead"
          class="px-4 py-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Mark all as read
        </button>
      </div>

      <!-- Stats Row -->
      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="bg-white rounded-lg shadow p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">Total</p>
              <p class="text-2xl font-bold text-gray-900">{{ notifications.length }}</p>
            </div>
            <div class="p-3 bg-gray-100 rounded-full">
              <Bell class="w-5 h-5 text-gray-600" />
            </div>
          </div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">Unread</p>
              <p class="text-2xl font-bold text-blue-600">{{ unreadCount }}</p>
            </div>
            <div class="p-3 bg-blue-100 rounded-full">
              <Bell class="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">Urgent</p>
              <p class="text-2xl font-bold text-red-600">{{ urgentCount }}</p>
            </div>
            <div class="p-3 bg-red-100 rounded-full">
              <AlertTriangle class="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      <!-- Filter Tabs -->
      <div class="bg-white rounded-lg shadow mb-6">
        <div class="border-b border-gray-200">
          <nav class="flex -mb-px">
            <button
              @click="selectedFilter = 'all'"
              class="px-6 py-3 text-sm font-medium border-b-2 transition-colors"
              :class="selectedFilter === 'all'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              "
            >
              All
            </button>
            <button
              @click="selectedFilter = 'unread'"
              class="px-6 py-3 text-sm font-medium border-b-2 transition-colors"
              :class="selectedFilter === 'unread'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              "
            >
              Unread
              <span v-if="unreadCount > 0" class="ml-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                {{ unreadCount }}
              </span>
            </button>
            <button
              @click="selectedFilter = 'urgent'"
              class="px-6 py-3 text-sm font-medium border-b-2 transition-colors"
              :class="selectedFilter === 'urgent'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              "
            >
              Urgent
              <span v-if="urgentCount > 0" class="ml-1 px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded-full">
                {{ urgentCount }}
              </span>
            </button>
          </nav>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="bg-white rounded-lg shadow p-8 text-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p class="mt-2 text-gray-600">Loading notifications...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredNotifications.length === 0" class="bg-white rounded-lg shadow p-12 text-center">
        <Bell class="mx-auto h-12 w-12 text-gray-400" />
        <h3 class="mt-4 text-lg font-medium text-gray-900">No notifications</h3>
        <p class="mt-2 text-sm text-gray-500">
          {{ selectedFilter === 'unread' ? 'All caught up! No unread notifications.' : selectedFilter === 'urgent' ? 'No urgent notifications at this time.' : 'You\'re all set - no notifications to show.' }}
        </p>
      </div>

      <!-- Notification List -->
      <div v-else class="space-y-3">
        <div
          v-for="notification in filteredNotifications"
          :key="notification.id"
          class="bg-white rounded-lg shadow overflow-hidden transition-all hover:shadow-md"
          :class="{ 'opacity-60': isRead(notification) }"
        >
          <div class="p-4">
            <div class="flex items-start gap-4">
              <!-- Icon -->
              <div
                class="flex-shrink-0 p-2 rounded-full"
                :class="getSeverityColor(notification.severity)"
              >
                <component :is="getSeverityIcon(notification.severity)" class="w-5 h-5" />
              </div>

              <!-- Content -->
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <div class="flex items-center gap-2 mb-1">
                      <span
                        class="px-2 py-0.5 text-xs font-medium rounded border"
                        :class="getSeverityColor(notification.severity)"
                      >
                        {{ notification.severity }}
                      </span>
                      <span class="text-xs text-gray-500">
                        {{ getTypeLabel(notification.notification_type) }}
                      </span>
                    </div>
                    <h4 class="font-medium text-gray-900">{{ notification.title }}</h4>
                    <p class="mt-1 text-sm text-gray-600">{{ notification.message }}</p>
                  </div>
                  <div class="flex items-center gap-2 text-sm text-gray-500">
                    <span>{{ formatDate(notification.created_at) }}</span>
                    <div v-if="!isRead(notification)" class="w-2 h-2 bg-blue-500 rounded-full"></div>
                  </div>
                </div>

                <!-- Actions -->
                <div class="mt-3 flex items-center gap-3">
                  <button
                    v-if="notification.resource_id"
                    @click="navigateTo(notification)"
                    class="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 rounded transition-colors"
                  >
                    <Building class="w-4 h-4" />
                    View Property
                    <ChevronRight class="w-4 h-4" />
                  </button>
                  <button
                    v-if="!isRead(notification)"
                    @click.stop="markAsRead(notification.id)"
                    class="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <Check class="w-4 h-4" />
                    Mark as read
                  </button>
                  <button
                    @click.stop="dismissNotification(notification.id)"
                    class="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 transition-colors"
                  >
                    <X class="w-4 h-4" />
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Sidebar>
</template>

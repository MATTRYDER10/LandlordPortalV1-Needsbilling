<template>
  <div class="relative">
    <button
      @click="toggleDropdown"
      class="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
      :class="{ 'bg-gray-100': isOpen }"
    >
      <Bell class="w-5 h-5" />
      <!-- Badge -->
      <span
        v-if="unreadCount > 0"
        class="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold text-white bg-red-500 rounded-full"
      >
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </button>

    <!-- Dropdown (opens upward, positioned to fit in sidebar) -->
    <div
      v-if="isOpen"
      class="absolute -left-48 bottom-full mb-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 class="text-sm font-semibold text-gray-900">Notifications</h3>
        <button
          v-if="notifications.length > 0"
          @click="markAllRead"
          class="text-xs text-primary hover:text-primary/80"
        >
          Mark all read
        </button>
      </div>

      <!-- Notifications List -->
      <div class="max-h-96 overflow-y-auto">
        <div v-if="loading" class="flex items-center justify-center py-8">
          <div class="text-gray-500 text-sm">Loading...</div>
        </div>

        <div v-else-if="notifications.length === 0" class="flex flex-col items-center justify-center py-8 px-4">
          <BellOff class="w-8 h-8 text-gray-300 mb-2" />
          <p class="text-sm text-gray-500">No notifications</p>
        </div>

        <div v-else>
          <div
            v-for="notification in notifications"
            :key="notification.id"
            class="px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 cursor-pointer"
            :class="{
              'bg-blue-50/50': !isRead(notification),
              'bg-white': isRead(notification)
            }"
            @click="handleNotificationClick(notification)"
          >
            <div class="flex items-start gap-3">
              <!-- Severity Icon -->
              <div class="flex-shrink-0 mt-0.5">
                <AlertTriangle
                  v-if="notification.severity === 'URGENT'"
                  class="w-5 h-5 text-red-500"
                />
                <AlertCircle
                  v-else-if="notification.severity === 'WARNING'"
                  class="w-5 h-5 text-amber-500"
                />
                <Info
                  v-else
                  class="w-5 h-5 text-blue-500"
                />
              </div>

              <!-- Content -->
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 truncate">
                  {{ notification.title }}
                </p>
                <p class="text-xs text-gray-600 mt-0.5 line-clamp-2">
                  {{ notification.message }}
                </p>
                <p class="text-xs text-gray-400 mt-1">
                  {{ formatTimeAgo(notification.created_at) }}
                </p>
              </div>

              <!-- Dismiss Button -->
              <button
                @click.stop="dismissNotification(notification.id)"
                class="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600"
              >
                <X class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div v-if="notifications.length > 0" class="px-4 py-2 border-t border-gray-200 bg-gray-50 rounded-b-lg">
        <router-link
          to="/notifications"
          class="text-xs text-primary hover:text-primary/80"
          @click="isOpen = false"
        >
          View all notifications
        </router-link>
      </div>
    </div>

    <!-- Click outside to close -->
    <div
      v-if="isOpen"
      class="fixed inset-0 z-40"
      @click="isOpen = false"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, BellOff, X, AlertTriangle, AlertCircle, Info } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'

interface Notification {
  id: string
  notification_type: string
  resource_type: string
  resource_id: string
  title: string
  message: string
  severity: 'INFO' | 'WARNING' | 'URGENT'
  read_by: string[]
  dismissed_by: string[]
  metadata: Record<string, any>
  created_at: string
}

const router = useRouter()
const authStore = useAuthStore()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const isOpen = ref(false)
const loading = ref(false)
const notifications = ref<Notification[]>([])
const unreadCount = ref(0)
let pollInterval: ReturnType<typeof setInterval> | null = null

const userId = computed(() => authStore.user?.id)

const isRead = (notification: Notification) => {
  return notification.read_by?.includes(userId.value || '')
}

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    fetchNotifications()
  }
}

const fetchNotifications = async () => {
  loading.value = true
  try {
    const response = await fetch(`${API_URL}/api/notifications?limit=20`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      notifications.value = data.notifications || []
    }
  } catch (err) {
    console.error('Failed to fetch notifications:', err)
  } finally {
    loading.value = false
  }
}

const fetchUnreadCount = async () => {
  try {
    const response = await fetch(`${API_URL}/api/notifications/count`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      unreadCount.value = data.count || 0
    }
  } catch (err) {
    console.error('Failed to fetch unread count:', err)
  }
}

const markAsRead = async (notificationId: string) => {
  try {
    await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      }
    })
    await fetchUnreadCount()
  } catch (err) {
    console.error('Failed to mark notification as read:', err)
  }
}

const markAllRead = async () => {
  try {
    await fetch(`${API_URL}/api/notifications/read-all`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      }
    })
    await fetchNotifications()
    await fetchUnreadCount()
  } catch (err) {
    console.error('Failed to mark all as read:', err)
  }
}

const dismissNotification = async (notificationId: string) => {
  try {
    await fetch(`${API_URL}/api/notifications/${notificationId}/dismiss`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      }
    })
    notifications.value = notifications.value.filter(n => n.id !== notificationId)
    await fetchUnreadCount()
  } catch (err) {
    console.error('Failed to dismiss notification:', err)
  }
}

const handleNotificationClick = async (notification: Notification) => {
  // Mark as read
  if (!isRead(notification)) {
    await markAsRead(notification.id)
    // Update local state
    const idx = notifications.value.findIndex(n => n.id === notification.id)
    const notif = notifications.value[idx]
    if (idx !== -1 && userId.value && notif) {
      notif.read_by = [...(notif.read_by || []), userId.value]
    }
  }

  // Navigate based on resource type
  if (notification.resource_type === 'property' || notification.resource_type === 'compliance_record') {
    const propertyId = notification.metadata?.property_id || notification.resource_id
    router.push(`/properties/${propertyId}`)
    isOpen.value = false
  }
}

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

onMounted(() => {
  fetchUnreadCount()

  // Poll for new notifications every 60 seconds
  pollInterval = setInterval(fetchUnreadCount, 60000)
})

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval)
  }
})
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

<template>
  <div class="relative">
    <button
      @click="toggleDropdown"
      class="relative p-2 rounded-lg transition-all duration-200"
      :class="[
        isOpen
          ? (isDark ? 'bg-slate-700/50 text-white' : 'bg-gray-200 text-gray-900')
          : (isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700/50' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200')
      ]"
    >
      <Bell class="w-5 h-5" />
      <!-- Badge -->
      <span
        v-if="unreadCount > 0"
        class="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold text-white bg-orange-500 rounded-full animate-pulse"
      >
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </button>

    <!-- Dropdown (opens upward, positioned to fit in sidebar) -->
    <div
      v-if="isOpen"
      :class="[
        'absolute -left-48 bottom-full mb-2 w-72 rounded-xl shadow-2xl border z-50 overflow-hidden',
        isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
      ]"
    >
      <!-- Header -->
      <div :class="[
        'flex items-center justify-between px-4 py-3 border-b',
        isDark ? 'border-slate-700 bg-slate-800/80' : 'border-gray-200 bg-gray-50'
      ]">
        <h3 :class="['text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900']">Notifications</h3>
        <button
          v-if="notifications.length > 0"
          @click="markAllRead"
          :disabled="markingAllRead"
          class="text-xs text-orange-400 hover:text-orange-300 disabled:opacity-50 flex items-center gap-1 transition-colors"
        >
          <CheckCheck v-if="!markingAllRead" class="w-3 h-3" />
          <Loader2 v-else class="w-3 h-3 animate-spin" />
          {{ markingAllRead ? 'Marking...' : 'Mark all read' }}
        </button>
      </div>

      <!-- Notifications List -->
      <div class="max-h-96 overflow-y-auto">
        <div v-if="loading" class="flex items-center justify-center py-8">
          <Loader2 :class="['w-5 h-5 animate-spin', isDark ? 'text-slate-400' : 'text-gray-400']" />
        </div>

        <div v-else-if="notifications.length === 0" class="flex flex-col items-center justify-center py-8 px-4">
          <BellOff :class="['w-8 h-8 mb-2', isDark ? 'text-slate-600' : 'text-gray-400']" />
          <p :class="['text-sm', isDark ? 'text-slate-400' : 'text-gray-500']">No notifications</p>
        </div>

        <div v-else>
          <div
            v-for="notification in notifications"
            :key="notification.id"
            :class="[
              'px-4 py-3 cursor-pointer transition-colors last:border-b-0',
              isDark ? 'hover:bg-slate-700/50 border-b border-slate-700/50' : 'hover:bg-gray-100 border-b border-gray-100',
              !isRead(notification) ? 'bg-orange-500/10' : (isDark ? 'bg-transparent' : 'bg-white')
            ]"
            @click="handleNotificationClick(notification)"
          >
            <div class="flex items-start gap-3">
              <!-- Severity Icon -->
              <div class="flex-shrink-0 mt-0.5">
                <component
                  :is="getNotificationIcon(notification)"
                  :class="getNotificationIconClass(notification)"
                  class="w-5 h-5"
                />
              </div>

              <!-- Content -->
              <div class="flex-1 min-w-0">
                <p :class="['text-sm font-medium truncate', isDark ? 'text-white' : 'text-gray-900']">
                  {{ notification.title }}
                </p>
                <p :class="['text-xs mt-0.5 line-clamp-2', isDark ? 'text-slate-400' : 'text-gray-500']">
                  {{ notification.message }}
                </p>
                <p :class="['text-xs mt-1', isDark ? 'text-slate-500' : 'text-gray-400']">
                  {{ formatTimeAgo(notification.created_at) }}
                </p>
              </div>

              <!-- Dismiss Button -->
              <button
                @click.stop="dismissNotification(notification.id)"
                :class="['flex-shrink-0 p-1 transition-colors', isDark ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600']"
              >
                <X class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div v-if="notifications.length > 0" :class="[
        'px-4 py-2.5 border-t',
        isDark ? 'border-slate-700 bg-slate-800/80' : 'border-gray-200 bg-gray-50'
      ]">
        <router-link
          to="/notifications"
          class="text-xs text-orange-400 hover:text-orange-300 transition-colors"
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
import {
  Bell, BellOff, X, AlertTriangle, AlertCircle, Info,
  CheckCheck, Loader2, FileSignature, Banknote, Home,
  UserPlus, Clock
} from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { useDarkMode } from '@/composables/useDarkMode'
import { API_URL } from '@/lib/apiUrl'

const { isDark } = useDarkMode()

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
const isOpen = ref(false)
const loading = ref(false)
const markingAllRead = ref(false)
const notifications = ref<Notification[]>([])
const unreadCount = ref(0)
let pollInterval: ReturnType<typeof setInterval> | null = null

const userId = computed(() => authStore.user?.id)

const isRead = (notification: Notification) => {
  return notification.read_by?.includes(userId.value || '')
}

const getNotificationIcon = (notification: Notification) => {
  switch (notification.notification_type) {
    case 'TENANT_OFFER':
      return UserPlus
    case 'PAYMENT_CONFIRMED':
    case 'INITIAL_MONIES_PAID':
      return Banknote
    case 'TENANCY_STARTED':
      return Home
    case 'AGREEMENT_SIGNED':
      return FileSignature
    case 'ACTION_REQUIRED':
      return Clock
    case 'COMPLIANCE_EXPIRING':
    case 'COMPLIANCE_EXPIRED':
      return AlertTriangle
    default:
      if (notification.severity === 'URGENT') return AlertTriangle
      if (notification.severity === 'WARNING') return AlertCircle
      return Info
  }
}

const getNotificationIconClass = (notification: Notification) => {
  switch (notification.notification_type) {
    case 'TENANT_OFFER':
      return 'text-blue-400'
    case 'PAYMENT_CONFIRMED':
    case 'INITIAL_MONIES_PAID':
      return 'text-green-400'
    case 'TENANCY_STARTED':
      return 'text-emerald-400'
    case 'AGREEMENT_SIGNED':
      return 'text-purple-400'
    case 'ACTION_REQUIRED':
      return 'text-orange-400'
    case 'COMPLIANCE_EXPIRING':
      return 'text-amber-400'
    case 'COMPLIANCE_EXPIRED':
      return 'text-red-400'
    default:
      if (notification.severity === 'URGENT') return 'text-red-400'
      if (notification.severity === 'WARNING') return 'text-amber-400'
      return 'text-blue-400'
  }
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
  markingAllRead.value = true
  try {
    const response = await fetch(`${API_URL}/api/notifications/read-all`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      }
    })

    if (response.ok) {
      // Clear notifications from the dropdown after marking all as read
      notifications.value = []
      unreadCount.value = 0
    }
  } catch (err) {
    console.error('Failed to mark all as read:', err)
  } finally {
    markingAllRead.value = false
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
  } else if (notification.resource_type === 'tenant_offer') {
    router.push(`/tenant-offers/${notification.resource_id}`)
    isOpen.value = false
  } else if (notification.resource_type === 'tenancy') {
    router.push(`/tenancies?id=${notification.resource_id}`)
    isOpen.value = false
  } else if (notification.resource_type === 'tenant_reference') {
    router.push(`/references?id=${notification.resource_id}`)
    isOpen.value = false
  } else if (notification.resource_type === 'agreement') {
    router.push(`/agreements/${notification.resource_id}`)
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

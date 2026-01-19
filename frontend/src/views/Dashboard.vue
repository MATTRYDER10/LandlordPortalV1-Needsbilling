<template>
  <Sidebar>
    <div class="p-8">
      <div class="mb-8">
        <h2 class="text-3xl font-bold text-gray-900">Dashboard</h2>
        <p class="mt-2 text-gray-600">Welcome to your tenant referencing dashboard</p>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-5 gap-0 mb-8">
        <router-link to="/references"
          class="bg-white shadow p-6 border-r border-gray-200 first:rounded-l-lg last:rounded-r-lg last:border-r-0 hover:bg-gray-50 transition-colors cursor-pointer">
          <div class="flex items-center">
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-600">Total References</p>
              <p class="text-3xl font-bold text-gray-900">{{ totalReferences }}</p>
            </div>
            <div class="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <FileText class="w-6 h-6 text-primary" />
            </div>
          </div>
        </router-link>

        <router-link :to="{ path: '/references', query: { status: 'in_progress' } }"
          class="bg-white shadow p-6 border-r border-gray-200 first:rounded-l-lg last:rounded-r-lg last:border-r-0 hover:bg-gray-50 transition-colors cursor-pointer">
          <div class="flex items-center">
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-600">In Progress</p>
              <p class="text-3xl font-bold text-primary">{{ inProgressReferences }}</p>
            </div>
            <div class="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <Clock class="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </router-link>

        <router-link :to="{ path: '/references', query: { status: 'pending_verification' } }"
          class="bg-white shadow p-6 border-r border-gray-200 first:rounded-l-lg last:rounded-r-lg last:border-r-0 hover:bg-gray-50 transition-colors cursor-pointer">
          <div class="flex items-center">
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-600">Pending Verification</p>
              <p class="text-3xl font-bold text-orange-600">{{ pendingVerificationReferences }}</p>
            </div>
            <div class="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <ClipboardCheck class="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </router-link>

        <router-link :to="{ path: '/references', query: { status: 'rejected' } }"
          class="bg-white shadow p-6 border-r border-gray-200 first:rounded-l-lg last:rounded-r-lg last:border-r-0 hover:bg-gray-50 transition-colors cursor-pointer">
          <div class="flex items-center">
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-600">Rejected</p>
              <p class="text-3xl font-bold text-red-600">{{ rejectedReferences }}</p>
            </div>
            <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <X class="w-6 h-6 text-red-600" />
            </div>
          </div>
        </router-link>

        <router-link :to="{ path: '/references', query: { status: 'completed' } }"
          class="bg-white shadow p-6 border-r border-gray-200 first:rounded-l-lg last:rounded-r-lg last:border-r-0 hover:bg-gray-50 transition-colors cursor-pointer">
          <div class="flex items-center">
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-600">Completed</p>
              <p class="text-3xl font-bold text-green-600">{{ completedReferences }}</p>
            </div>
            <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle class="w-6 h-6 text-green-600" />
            </div>
          </div>
        </router-link>
      </div>

      <!-- Quick Actions -->
      <div class="mb-8">
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div class="flex flex-wrap gap-4">
            <router-link to="/references?create=true"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md inline-block">
              Create Reference
            </router-link>
            <router-link to="/agreements/generate"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md inline-block">
              Create Agreement
            </router-link>
            <router-link to="/landlords?add=true"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md inline-block">
              Add Landlord
            </router-link>
          </div>
          <p class="mt-3 text-sm text-gray-600">
            Quickly create tenant references, add landlord details, or send offer forms to tenants. Offer
            forms allow tenants to fill in their offer details directly, saving you time on data entry. Once they
            submit, you can approve, decline, or accept with changes, then collect holding deposits and automatically
            create references.
          </p>
        </div>
      </div>

      <!-- Move-in Calendar -->
      <div class="bg-white rounded-lg shadow">
        <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 class="text-lg font-semibold text-gray-900">Move-in Calendar</h3>
          <router-link to="/references" class="text-sm font-medium text-primary hover:text-primary/80">
            View All References →
          </router-link>
        </div>

        <div class="p-6">
          <!-- Loading State -->
          <div v-if="calendarLoading" class="flex justify-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>

          <!-- Calendar Grid -->
          <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <!-- Current Month -->
            <div class="calendar-month">
              <h4 class="text-center font-semibold text-gray-900 mb-4">{{ currentMonthName }}</h4>
              <div class="grid grid-cols-7 gap-1">
                <!-- Day Headers -->
                <div v-for="day in ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']" :key="day"
                  class="text-center text-xs font-medium text-gray-500 py-2">
                  {{ day }}
                </div>
                <!-- Calendar Days -->
                <div v-for="(day, index) in currentMonthDays" :key="'current-' + index"
                  class="relative min-h-[80px] border border-gray-100 rounded p-1"
                  :class="{ 'bg-gray-50': !day.isCurrentMonth }">
                  <span v-if="day.date" class="text-xs text-gray-500">{{ day.date }}</span>
                  <!-- Move-in entries for this day -->
                  <div v-for="entry in day.entries" :key="entry.leadTenantId"
                    class="mt-1 relative group">
                    <div class="text-xs p-1 rounded cursor-pointer truncate"
                      :class="getEntryStatusClass(entry)"
                      @click="navigateToTenancy(entry.property.address)">
                      {{ truncateAddress(entry.property.address) }}
                    </div>
                    <!-- Hover Tooltip -->
                    <div class="absolute left-0 top-full mt-1 z-50 hidden group-hover:block w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                      <div class="text-sm font-medium text-gray-900 mb-2">{{ entry.property.address }}</div>
                      <div class="text-xs text-gray-500 mb-2">{{ entry.property.city }}{{ entry.property.postcode ? ', ' + entry.property.postcode : '' }}</div>
                      <div v-if="entry.rentAmount" class="text-sm font-semibold text-primary mb-2">
                        Rent: {{ formatCurrency(entry.rentAmount) }}/month
                      </div>
                      <div class="space-y-1">
                        <div v-for="tenant in entry.tenants" :key="tenant.id" class="flex items-center justify-between">
                          <span class="text-xs text-gray-700">
                            {{ tenant.name }}
                            <span v-if="tenant.isGuarantor" class="text-purple-600">(G)</span>
                          </span>
                          <span class="px-1.5 py-0.5 text-xs rounded-full" :class="getStatusBadgeClass(tenant.status)">
                            {{ formatStatus(tenant.status) }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Next Month -->
            <div class="calendar-month">
              <h4 class="text-center font-semibold text-gray-900 mb-4">{{ nextMonthName }}</h4>
              <div class="grid grid-cols-7 gap-1">
                <!-- Day Headers -->
                <div v-for="day in ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']" :key="day"
                  class="text-center text-xs font-medium text-gray-500 py-2">
                  {{ day }}
                </div>
                <!-- Calendar Days -->
                <div v-for="(day, index) in nextMonthDays" :key="'next-' + index"
                  class="relative min-h-[80px] border border-gray-100 rounded p-1"
                  :class="{ 'bg-gray-50': !day.isCurrentMonth }">
                  <span v-if="day.date" class="text-xs text-gray-500">{{ day.date }}</span>
                  <!-- Move-in entries for this day -->
                  <div v-for="entry in day.entries" :key="entry.leadTenantId"
                    class="mt-1 relative group">
                    <div class="text-xs p-1 rounded cursor-pointer truncate"
                      :class="getEntryStatusClass(entry)"
                      @click="navigateToTenancy(entry.property.address)">
                      {{ truncateAddress(entry.property.address) }}
                    </div>
                    <!-- Hover Tooltip -->
                    <div class="absolute left-0 top-full mt-1 z-50 hidden group-hover:block w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                      <div class="text-sm font-medium text-gray-900 mb-2">{{ entry.property.address }}</div>
                      <div class="text-xs text-gray-500 mb-2">{{ entry.property.city }}{{ entry.property.postcode ? ', ' + entry.property.postcode : '' }}</div>
                      <div v-if="entry.rentAmount" class="text-sm font-semibold text-primary mb-2">
                        Rent: {{ formatCurrency(entry.rentAmount) }}/month
                      </div>
                      <div class="space-y-1">
                        <div v-for="tenant in entry.tenants" :key="tenant.id" class="flex items-center justify-between">
                          <span class="text-xs text-gray-700">
                            {{ tenant.name }}
                            <span v-if="tenant.isGuarantor" class="text-purple-600">(G)</span>
                          </span>
                          <span class="px-1.5 py-0.5 text-xs rounded-full" :class="getStatusBadgeClass(tenant.status)">
                            {{ formatStatus(tenant.status) }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-if="!calendarLoading && calendarEntries.length === 0" class="text-center py-8">
            <Calendar class="mx-auto h-12 w-12 text-gray-400" />
            <h3 class="mt-2 text-sm font-medium text-gray-900">No move-in dates scheduled</h3>
            <p class="mt-1 text-sm text-gray-500">References with move-in dates in this period will appear here.</p>
          </div>
        </div>
      </div>
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import Sidebar from '../components/Sidebar.vue'
import {
  FileText,
  Clock,
  ClipboardCheck,
  X,
  CheckCircle,
  Calendar
} from 'lucide-vue-next'

interface CalendarEntry {
  tenancyId: string
  leadTenantId: string
  moveInDate: string
  property: {
    address: string
    city: string
    postcode: string
  }
  rentAmount: number | null
  tenants: Array<{
    id: string
    name: string
    status: string
    verificationState: string
    isGuarantor: boolean
  }>
}

interface CalendarDay {
  date: number | null
  isCurrentMonth: boolean
  fullDate: string | null
  entries: CalendarEntry[]
}

const router = useRouter()
const authStore = useAuthStore()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const totalReferences = ref(0)
const inProgressReferences = ref(0)
const pendingVerificationReferences = ref(0)
const rejectedReferences = ref(0)
const completedReferences = ref(0)
const calendarEntries = ref<CalendarEntry[]>([])
const calendarLoading = ref(true)

// Calendar computed values
const now = new Date()
const currentMonth = now.getMonth()
const currentYear = now.getFullYear()
const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1
const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear

const currentMonthName = computed(() => {
  return new Date(currentYear, currentMonth, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
})

const nextMonthName = computed(() => {
  return new Date(nextMonthYear, nextMonth, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
})

// Generate calendar days for a given month
const generateMonthDays = (year: number, month: number): CalendarDay[] => {
  const days: CalendarDay[] = []
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()

  // Get the day of week for the first day (0 = Sunday, adjust for Monday start)
  let startDayOfWeek = firstDay.getDay()
  startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1 // Convert to Monday = 0

  // Add empty days for padding at start
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push({ date: null, isCurrentMonth: false, fullDate: null, entries: [] })
  }

  // Add actual days
  for (let day = 1; day <= daysInMonth; day++) {
    const fullDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const entriesForDay = calendarEntries.value.filter(e => e.moveInDate === fullDate)
    days.push({
      date: day,
      isCurrentMonth: true,
      fullDate,
      entries: entriesForDay
    })
  }

  // Pad to complete the grid (42 cells = 6 rows)
  while (days.length < 42) {
    days.push({ date: null, isCurrentMonth: false, fullDate: null, entries: [] })
  }

  return days
}

const currentMonthDays = computed(() => generateMonthDays(currentYear, currentMonth))
const nextMonthDays = computed(() => generateMonthDays(nextMonthYear, nextMonth))

const fetchStats = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const statsResponse = await fetch(`${API_URL}/api/references/stats`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (statsResponse.status === 404) {
      console.log('User no longer has access, logging out...')
      await authStore.signOut()
      router.push('/login')
      return
    }

    if (statsResponse.ok) {
      const stats = await statsResponse.json()
      totalReferences.value = stats.total || 0
      inProgressReferences.value = stats.inProgress || 0
      pendingVerificationReferences.value = stats.pendingVerification || 0
      completedReferences.value = stats.completed || 0
      rejectedReferences.value = stats.rejected || 0
    }
  } catch (error) {
    console.error('Failed to fetch stats:', error)
  }
}

const fetchCalendarData = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    calendarLoading.value = true
    const response = await fetch(`${API_URL}/api/references/calendar`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const data = await response.json()
      calendarEntries.value = data.entries || []
    }
  } catch (error) {
    console.error('Failed to fetch calendar data:', error)
  } finally {
    calendarLoading.value = false
  }
}

const navigateToTenancy = (address: string) => {
  router.push(`/references?search=${encodeURIComponent(address)}`)
}

const truncateAddress = (address: string) => {
  if (address.length > 20) {
    return address.substring(0, 18) + '...'
  }
  return address
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount)
}

const formatStatus = (status: string) => {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'in_progress':
      return 'bg-blue-100 text-blue-800'
    case 'pending_verification':
      return 'bg-orange-100 text-orange-800'
    case 'completed':
      return 'bg-green-100 text-green-800'
    case 'rejected':
      return 'bg-red-100 text-red-800'
    case 'cancelled':
      return 'bg-gray-100 text-gray-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const getEntryStatusClass = (entry: CalendarEntry) => {
  // Determine overall status based on all tenants
  const statuses = entry.tenants.map(t => t.status)
  if (statuses.every(s => s === 'completed')) {
    return 'bg-green-100 text-green-800 hover:bg-green-200'
  }
  if (statuses.some(s => s === 'rejected')) {
    return 'bg-red-100 text-red-800 hover:bg-red-200'
  }
  if (statuses.some(s => s === 'pending_verification')) {
    return 'bg-orange-100 text-orange-800 hover:bg-orange-200'
  }
  if (statuses.some(s => s === 'in_progress')) {
    return 'bg-blue-100 text-blue-800 hover:bg-blue-200'
  }
  return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
}

onMounted(() => {
  fetchStats()
  fetchCalendarData()
})
</script>

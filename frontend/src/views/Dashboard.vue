<template>
  <Sidebar>
    <div class="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <!-- Top Bar -->
      <div class="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div class="px-6 py-5">
          <div class="flex items-center justify-between">
            <!-- Title & Greeting -->
            <div>
              <h1 class="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Good {{ greeting }}, <span class="text-primary">{{ companyName }}</span>
              </h1>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {{ formattedDate }}
              </p>
            </div>

            <!-- Quick Actions Pills -->
            <div class="flex items-center gap-2">
              <router-link
                to="/tenancies?create=true"
                class="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm shadow-primary/25 transition-all hover:shadow-md hover:shadow-primary/30"
              >
                <Plus class="w-3.5 h-3.5" />
                New Tenancy
              </router-link>
              <router-link
                to="/references?create=true"
                class="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg transition-all"
              >
                <UserCheck class="w-3.5 h-3.5" />
                Reference
              </router-link>
              <router-link
                to="/landlords?add=true"
                class="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg transition-all"
              >
                <UserPlus class="w-3.5 h-3.5" />
                Landlord
              </router-link>
              <router-link
                to="/properties?add=true"
                class="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg transition-all"
              >
                <Home class="w-3.5 h-3.5" />
                Property
              </router-link>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="flex-1 overflow-y-auto">
        <div class="p-6 space-y-6">
          <!-- Stats Grid -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- Draft Tenancies -->
            <router-link
              :to="{ path: '/tenancies', query: { tab: 'draft' } }"
              class="stat-card group bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md dark:hover:shadow-slate-900/50 transition-all cursor-pointer"
            >
              <div class="flex items-start justify-between">
                <div>
                  <p class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Draft Tenancies</p>
                  <p class="text-3xl font-bold text-slate-900 dark:text-white mt-1.5">{{ pendingTenancies }}</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Pending move-ins</p>
                </div>
                <div class="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <FileEdit class="w-5 h-5 text-slate-500 dark:text-slate-400 group-hover:text-primary transition-colors" />
                </div>
              </div>
              <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <span class="text-xs font-medium text-slate-500 dark:text-slate-400 group-hover:text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
                  View drafts <ChevronRight class="w-3.5 h-3.5" />
                </span>
              </div>
            </router-link>

            <!-- Active Tenancies -->
            <router-link
              :to="{ path: '/tenancies', query: { tab: 'active' } }"
              class="stat-card group bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md dark:hover:shadow-slate-900/50 transition-all cursor-pointer"
            >
              <div class="flex items-start justify-between">
                <div>
                  <p class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Active Tenancies</p>
                  <p class="text-3xl font-bold text-slate-900 dark:text-white mt-1.5">{{ activeTenancies }}</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Currently occupied</p>
                </div>
                <div class="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <KeyRound class="w-5 h-5 text-slate-500 dark:text-slate-400 group-hover:text-primary transition-colors" />
                </div>
              </div>
              <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <span class="text-xs font-medium text-slate-500 dark:text-slate-400 group-hover:text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
                  View active <ChevronRight class="w-3.5 h-3.5" />
                </span>
              </div>
            </router-link>

            <!-- References In Progress -->
            <router-link
              :to="{ path: '/references', query: { status: 'IN_PROGRESS' } }"
              class="stat-card group bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md dark:hover:shadow-slate-900/50 transition-all cursor-pointer"
            >
              <div class="flex items-start justify-between">
                <div>
                  <p class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">References</p>
                  <p class="text-3xl font-bold text-slate-900 dark:text-white mt-1.5">{{ inProgressReferences }}</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">In progress</p>
                </div>
                <div class="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <Clock class="w-5 h-5 text-slate-500 dark:text-slate-400 group-hover:text-primary transition-colors" />
                </div>
              </div>
              <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <span class="text-xs font-medium text-slate-500 dark:text-slate-400 group-hover:text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
                  View references <ChevronRight class="w-3.5 h-3.5" />
                </span>
              </div>
            </router-link>

            <!-- Deposits to Protect -->
            <div
              class="stat-card group bg-white dark:bg-slate-900 rounded-xl border p-5 transition-all"
              :class="depositsToProtect > 0
                ? 'border-primary/30 hover:border-primary hover:shadow-md dark:hover:shadow-primary/10 cursor-pointer'
                : 'border-slate-200 dark:border-slate-800'"
              @click="depositsToProtect > 0 ? navigateToDeposits() : null"
            >
              <div class="flex items-start justify-between">
                <div>
                  <p class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Deposits</p>
                  <p class="text-3xl font-bold mt-1.5" :class="depositsToProtect > 0 ? 'text-primary' : 'text-slate-900 dark:text-white'">
                    {{ depositsToProtect }}
                  </p>
                  <p class="text-xs mt-1" :class="depositsToProtect > 0 ? 'text-primary font-medium' : 'text-slate-500 dark:text-slate-400'">
                    {{ depositsToProtect > 0 ? 'Need protection!' : 'All protected' }}
                  </p>
                </div>
                <div
                  class="w-11 h-11 rounded-xl flex items-center justify-center transition-colors"
                  :class="depositsToProtect > 0 ? 'bg-primary/10' : 'bg-slate-100 dark:bg-slate-800'"
                >
                  <Shield class="w-5 h-5" :class="depositsToProtect > 0 ? 'text-primary' : 'text-slate-400 dark:text-slate-500'" />
                </div>
              </div>
              <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <span
                  v-if="depositsToProtect > 0"
                  class="text-xs font-medium text-primary flex items-center gap-1 group-hover:gap-2 transition-all"
                >
                  Take action <ChevronRight class="w-3.5 h-3.5" />
                </span>
                <span v-else class="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <CheckCircle2 class="w-3.5 h-3.5" /> All clear
                </span>
              </div>
            </div>
          </div>

          <!-- Secondary Stats Row -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <!-- Total References -->
            <router-link
              to="/references"
              class="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
            >
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <FileText class="w-4 h-4 text-slate-500 dark:text-slate-400" />
                </div>
                <div>
                  <p class="text-lg font-bold text-slate-900 dark:text-white">{{ totalReferences }}</p>
                  <p class="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Refs</p>
                </div>
              </div>
            </router-link>

            <!-- Completed References -->
            <router-link
              :to="{ path: '/references', query: { status: 'COMPLETED' } }"
              class="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
            >
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <CheckCircle2 class="w-4 h-4 text-slate-500 dark:text-slate-400" />
                </div>
                <div>
                  <p class="text-lg font-bold text-slate-900 dark:text-white">{{ completedReferences }}</p>
                  <p class="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Completed</p>
                </div>
              </div>
            </router-link>

            <!-- Action Required -->
            <router-link
              :to="{ path: '/references', query: { status: 'ACTION_REQUIRED' } }"
              class="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
            >
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <ClipboardCheck class="w-4 h-4" :class="actionRequiredReferences > 0 ? 'text-primary' : 'text-slate-500 dark:text-slate-400'" />
                </div>
                <div>
                  <p class="text-lg font-bold" :class="actionRequiredReferences > 0 ? 'text-primary' : 'text-slate-900 dark:text-white'">{{ actionRequiredReferences }}</p>
                  <p class="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Action Req'd</p>
                </div>
              </div>
            </router-link>

            <!-- Rejected -->
            <router-link
              :to="{ path: '/references', query: { status: 'REJECTED' } }"
              class="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
            >
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <X class="w-4 h-4 text-slate-500 dark:text-slate-400" />
                </div>
                <div>
                  <p class="text-lg font-bold text-slate-900 dark:text-white">{{ rejectedReferences }}</p>
                  <p class="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Rejected</p>
                </div>
              </div>
            </router-link>
          </div>

          <!-- Move-in Calendar -->
          <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
            <!-- Calendar Header -->
            <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CalendarDays class="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 class="text-sm font-semibold text-slate-900 dark:text-white">Move-in Calendar</h2>
                  <p class="text-xs text-slate-500 dark:text-slate-400">Next 12 months • {{ calendarEntries.length }} scheduled move-ins</p>
                </div>
              </div>
              <router-link
                to="/tenancies"
                class="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1"
              >
                View all tenancies <ChevronRight class="w-3.5 h-3.5" />
              </router-link>
            </div>

            <!-- Calendar Loading State -->
            <div v-if="calendarLoading" class="p-8 flex justify-center">
              <div class="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 dark:border-slate-700 border-t-primary"></div>
            </div>

            <!-- Calendar Empty State -->
            <div v-else-if="calendarEntries.length === 0" class="py-12 text-center">
              <CalendarDays class="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p class="text-sm font-medium text-slate-600 dark:text-slate-400">No scheduled move-ins</p>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Move-in dates from tenancies will appear here</p>
            </div>

            <!-- Calendar Horizontal Scroll -->
            <div v-else class="calendar-container overflow-x-auto pb-4">
              <div class="flex gap-4 px-5 pt-4 min-w-max">
                <div
                  v-for="monthData in calendarMonths"
                  :key="`${monthData.year}-${monthData.month}`"
                  class="calendar-month flex-shrink-0 w-72"
                >
                  <!-- Month Header -->
                  <div class="flex items-center gap-2.5 mb-3">
                    <div
                      class="w-8 h-8 rounded-lg flex items-center justify-center"
                      :class="isCurrentMonth(monthData.month, monthData.year) ? 'bg-primary/10' : getMonthColorClasses(monthData.month).bg"
                    >
                      <Calendar
                        class="w-4 h-4"
                        :class="isCurrentMonth(monthData.month, monthData.year) ? 'text-primary' : getMonthColorClasses(monthData.month).text"
                      />
                    </div>
                    <div>
                      <h3 class="text-sm font-semibold text-slate-900 dark:text-white">{{ monthData.name }}</h3>
                      <p class="text-[10px] text-slate-500 dark:text-slate-400">{{ monthData.year }}</p>
                    </div>
                    <div
                      v-if="monthData.entries.length > 0"
                      class="ml-auto px-2 py-0.5 text-[10px] font-medium rounded-full"
                      :class="isCurrentMonth(monthData.month, monthData.year)
                        ? 'bg-primary/10 text-primary'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'"
                    >
                      {{ monthData.entries.length }} move-in{{ monthData.entries.length > 1 ? 's' : '' }}
                    </div>
                  </div>

                  <!-- Month Calendar Grid -->
                  <div class="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5">
                    <!-- Day Headers -->
                    <div class="grid grid-cols-7 gap-0.5 mb-1">
                      <div
                        v-for="day in ['M', 'T', 'W', 'T', 'F', 'S', 'S']"
                        :key="day"
                        class="text-center text-[9px] font-medium text-slate-500 dark:text-slate-400 py-1"
                      >
                        {{ day }}
                      </div>
                    </div>

                    <!-- Calendar Days -->
                    <div class="grid grid-cols-7 gap-0.5">
                      <div
                        v-for="(day, idx) in monthData.days"
                        :key="idx"
                        class="relative aspect-square group"
                      >
                        <template v-if="day.date">
                          <div
                            class="w-full h-full rounded-md flex flex-col items-center justify-center text-[10px] transition-all"
                            :class="getDayClasses(day, monthData)"
                            @click="day.entries.length > 0 ? navigateToReference(day.entries[0]!.leadTenantId) : null"
                          >
                            <span>{{ day.date }}</span>
                          </div>
                          <!-- Entry indicator dot -->
                          <div
                            v-if="day.entries.length > 0"
                            class="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                            :class="getEntryDotColor(day.entries)"
                          />
                          <!-- Tooltip on hover showing all tenants moving in -->
                          <div
                            v-if="day.entries.length > 0"
                            class="calendar-tooltip absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none"
                          >
                            <div class="bg-slate-900 dark:bg-slate-700 text-white text-[10px] rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap">
                              <div v-for="entry in day.entries" :key="entry.leadTenantId" class="mb-1.5 last:mb-0">
                                <p class="font-medium">{{ entry.property.address }}</p>
                                <p v-for="tenant in entry.tenants" :key="tenant.id" class="text-slate-300 pl-2">
                                  • {{ tenant.name }}
                                </p>
                              </div>
                            </div>
                            <!-- Tooltip arrow -->
                            <div class="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-900 dark:border-t-slate-700"></div>
                          </div>
                        </template>
                      </div>
                    </div>
                  </div>

                  <!-- Move-in entries for this month (full list) -->
                  <div v-if="monthData.entries.length > 0" class="mt-3 space-y-1.5">
                    <div
                      v-for="entry in monthData.entries"
                      :key="entry.leadTenantId"
                      class="flex items-center gap-2 px-2.5 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                      @click="navigateToReference(entry.leadTenantId)"
                    >
                      <div
                        class="w-7 h-7 rounded bg-slate-900 dark:bg-slate-700 text-white flex flex-col items-center justify-center flex-shrink-0"
                      >
                        <span class="text-[8px] uppercase">{{ getShortMonth(entry.moveInDate) }}</span>
                        <span class="text-xs font-bold leading-none">{{ getDay(entry.moveInDate) }}</span>
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-xs font-medium text-slate-900 dark:text-white truncate">{{ entry.property.address }}</p>
                        <p class="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {{ entry.tenants.length }} tenant{{ entry.tenants.length > 1 ? 's' : '' }}
                          {{ entry.rentAmount ? `• ${formatCurrency(entry.rentAmount)}/mo` : '' }}
                        </p>
                      </div>
                      <div
                        class="w-2 h-2 rounded-full flex-shrink-0"
                        :class="getEntryDotColor(entry)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
  Plus,
  UserCheck,
  UserPlus,
  Home,
  FileEdit,
  KeyRound,
  Clock,
  Shield,
  ChevronRight,
  FileText,
  CheckCircle2,
  ClipboardCheck,
  X,
  CalendarDays,
  Calendar
} from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

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

interface MonthData {
  month: number
  year: number
  name: string
  days: CalendarDay[]
  entries: CalendarEntry[]
}

const router = useRouter()
const authStore = useAuthStore()
// User greeting
const companyName = computed(() => {
  return authStore.company?.name || 'there'
})

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
})

const formattedDate = computed(() => {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
})

// Stats
const totalReferences = ref(0)
const inProgressReferences = ref(0)
const pendingVerificationReferences = ref(0)
const rejectedReferences = ref(0)
const completedReferences = ref(0)
const actionRequiredReferences = ref(0)
const activeTenancies = ref(0)
const pendingTenancies = ref(0)
const expiringSoonTenancies = ref(0)
const depositsToProtect = ref(0)

// Calendar
const calendarEntries = ref<CalendarEntry[]>([])
const calendarLoading = ref(true)

// Generate 12 months of calendar data
const calendarMonths = computed<MonthData[]>(() => {
  const months: MonthData[] = []
  const now = new Date()

  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const month = date.getMonth()
    const year = date.getFullYear()
    const monthName = date.toLocaleDateString('en-GB', { month: 'long' })

    // Get entries for this month
    const monthEntries = calendarEntries.value.filter(e => {
      const entryDate = new Date(e.moveInDate)
      return entryDate.getMonth() === month && entryDate.getFullYear() === year
    })

    months.push({
      month,
      year,
      name: monthName,
      days: generateMonthDays(year, month),
      entries: monthEntries
    })
  }

  return months
})

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

  // Pad to complete rows (multiple of 7)
  while (days.length % 7 !== 0) {
    days.push({ date: null, isCurrentMonth: false, fullDate: null, entries: [] })
  }

  return days
}

const isCurrentMonth = (month: number, year: number): boolean => {
  const now = new Date()
  return now.getMonth() === month && now.getFullYear() === year
}

const isToday = (day: CalendarDay, monthData: MonthData): boolean => {
  if (!day.date) return false
  const now = new Date()
  return now.getDate() === day.date &&
         now.getMonth() === monthData.month &&
         now.getFullYear() === monthData.year
}

const getDayClasses = (day: CalendarDay, monthData: MonthData): string => {
  if (!day.date) return 'text-slate-300 dark:text-slate-700'

  const classes: string[] = []

  if (isToday(day, monthData)) {
    classes.push('bg-primary text-white font-bold')
    if (day.entries.length > 0) {
      classes.push('cursor-pointer')
    }
  } else if (day.entries.length > 0) {
    classes.push('bg-slate-200 dark:bg-slate-700 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 cursor-pointer')
  } else {
    classes.push('text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700')
  }

  return classes.join(' ')
}

const getEntryDotColor = (entriesOrEntry: CalendarEntry[] | CalendarEntry): string => {
  const entries = Array.isArray(entriesOrEntry) ? entriesOrEntry : [entriesOrEntry]
  // Check status of all tenants in entries
  const allCompleted = entries.every(e =>
    e.tenants.every(t => t.status === 'completed')
  )
  const hasRejected = entries.some(e =>
    e.tenants.some(t => t.status === 'rejected')
  )

  if (allCompleted) return 'bg-emerald-500'
  if (hasRejected) return 'bg-red-500'
  return 'bg-amber-500'
}

const monthColors = [
  { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },      // Jan
  { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-600 dark:text-rose-400' },      // Feb
  { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400' }, // Mar
  { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-600 dark:text-violet-400' },  // Apr
  { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-600 dark:text-pink-400' },      // May
  { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400' },    // Jun
  { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-600 dark:text-cyan-400' },      // Jul
  { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400' },  // Aug
  { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-600 dark:text-teal-400' },      // Sep
  { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-400' },  // Oct
  { bg: 'bg-slate-200 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-300' },    // Nov
  { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400' }         // Dec
]

const getMonthColorClasses = (month: number) => monthColors[month]! || monthColors[0]!

const getShortMonth = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('en-GB', { month: 'short' }).toUpperCase().slice(0, 3)
}

const getDay = (dateStr: string): number => {
  return new Date(dateStr).getDate()
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amount)
}

// API calls
const fetchStats = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
    const activeBranchId = localStorage.getItem('activeBranchId')
    if (activeBranchId) {
      headers['X-Branch-Id'] = activeBranchId
    }

    const response = await fetch(`${API_URL}/api/references/stats`, { headers })

    if (response.status === 404) {
      await authStore.signOut()
      router.push('/login')
      return
    }

    if (response.ok) {
      const stats = await response.json()
      totalReferences.value = stats.total || 0
      inProgressReferences.value = stats.inProgress || 0
      pendingVerificationReferences.value = stats.pendingVerification || 0
      completedReferences.value = stats.completed || 0
      rejectedReferences.value = stats.rejected || 0
      actionRequiredReferences.value = stats.actionRequired || 0
    }
  } catch (error) {
    console.error('Failed to fetch reference stats:', error)
  }
}

const fetchTenancyStats = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) {
      console.warn('No auth token for tenancy stats')
      return
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
    const activeBranchId = localStorage.getItem('activeBranchId')
    if (activeBranchId) {
      headers['X-Branch-Id'] = activeBranchId
    }

    const response = await fetch(`${API_URL}/api/tenancies/records/stats`, { headers })

    if (response.ok) {
      const stats = await response.json()
      console.log('Tenancy stats received:', stats)
      activeTenancies.value = stats.active || 0
      pendingTenancies.value = stats.pending || 0
      expiringSoonTenancies.value = stats.expiringSoon || 0
      depositsToProtect.value = stats.depositsToProtect || 0
    } else {
      console.error('Tenancy stats response not ok:', response.status, await response.text())
    }
  } catch (error) {
    console.error('Failed to fetch tenancy stats:', error)
  }
}

const fetchCalendarData = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
    const activeBranchId = localStorage.getItem('activeBranchId')
    if (activeBranchId) {
      headers['X-Branch-Id'] = activeBranchId
    }

    calendarLoading.value = true
    const response = await fetch(`${API_URL}/api/references/calendar`, { headers })

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

// Navigation
const navigateToReference = (personId: string) => {
  router.push(`/references?person=${personId}`)
}

const navigateToDeposits = () => {
  // Navigate to tenancies filtered for unprotected deposits
  router.push({ path: '/tenancies', query: { filter: 'unprotected_deposits' } })
}

onMounted(() => {
  fetchStats()
  fetchTenancyStats()
  fetchCalendarData()
})
</script>

<style scoped>
.stat-card {
  animation: fadeSlideUp 0.4s ease-out;
  animation-fill-mode: both;
}

.stat-card:nth-child(1) { animation-delay: 0.05s; }
.stat-card:nth-child(2) { animation-delay: 0.1s; }
.stat-card:nth-child(3) { animation-delay: 0.15s; }
.stat-card:nth-child(4) { animation-delay: 0.2s; }

@keyframes fadeSlideUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.calendar-container {
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
}

:root.dark .calendar-container {
  scrollbar-color: #475569 transparent;
}

.calendar-container::-webkit-scrollbar {
  height: 6px;
}

.calendar-container::-webkit-scrollbar-track {
  background: transparent;
}

.calendar-container::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 3px;
}

:root.dark .calendar-container::-webkit-scrollbar-thumb {
  background-color: #475569;
}

.calendar-container::-webkit-scrollbar-thumb:hover {
  background-color: #94a3b8;
}

:root.dark .calendar-container::-webkit-scrollbar-thumb:hover {
  background-color: #64748b;
}

.calendar-month {
  animation: fadeSlideRight 0.5s ease-out;
  animation-fill-mode: both;
}

.calendar-month:nth-child(1) { animation-delay: 0.1s; }
.calendar-month:nth-child(2) { animation-delay: 0.15s; }
.calendar-month:nth-child(3) { animation-delay: 0.2s; }
.calendar-month:nth-child(4) { animation-delay: 0.25s; }
.calendar-month:nth-child(5) { animation-delay: 0.3s; }
.calendar-month:nth-child(6) { animation-delay: 0.35s; }

@keyframes fadeSlideRight {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>

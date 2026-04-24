<template>
  <Sidebar>
    <div class="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <!-- Top Bar -->
      <div class="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div class="px-4 sm:px-6 py-5">
          <div class="flex items-center justify-between">
            <!-- Title & Greeting -->
            <div>
              <h1 class="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Good {{ greeting }}, <span class="text-primary">{{ companyName }}</span>
              </h1>
              <p class="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                {{ formattedDate }}
              </p>
            </div>

            <!-- Quick Actions Pills -->
            <div class="flex items-center gap-2">
              <router-link
                to="/tenancies"
                class="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm shadow-primary/25 transition-all hover:shadow-md hover:shadow-primary/30"
              >
                <Plus class="w-3.5 h-3.5" />
                <span class="hidden sm:inline">Tenancies</span>
              </router-link>
              <router-link
                to="/referencing?create=true"
                class="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg transition-all"
              >
                <UserCheck class="w-3.5 h-3.5" />
                <span class="hidden sm:inline">Reference</span>
              </router-link>
              <router-link
                to="/properties?add=true"
                class="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg transition-all"
              >
                <Home class="w-3.5 h-3.5" />
                <span class="hidden sm:inline">Property</span>
              </router-link>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="flex-1 overflow-y-auto">
        <div class="p-4 sm:p-6 space-y-6">
          <!-- Stats Grid -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- Draft Tenancies -->
            <router-link
              :to="{ path: '/tenancies', query: { tab: 'draft' } }"
              class="stat-card group bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md dark:hover:shadow-slate-900/50 transition-all cursor-pointer"
            >
              <div class="flex items-start justify-between">
                <div>
                  <p class="text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide">Draft Tenancies</p>
                  <p class="text-3xl font-bold text-slate-900 dark:text-white mt-1.5">{{ pendingTenancies }}</p>
                  <p class="text-xs text-slate-500 dark:text-slate-300 mt-1">Pending move-ins</p>
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
                  <p class="text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide">Active Tenancies</p>
                  <p class="text-3xl font-bold text-slate-900 dark:text-white mt-1.5">{{ activeTenancies }}</p>
                  <p class="text-xs text-slate-500 dark:text-slate-300 mt-1">Currently occupied</p>
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
                  <p class="text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide">References</p>
                  <p class="text-3xl font-bold text-slate-900 dark:text-white mt-1.5">{{ inProgressReferences }}</p>
                  <p class="text-xs text-slate-500 dark:text-slate-300 mt-1">In progress</p>
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
                  <p class="text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide">Deposits</p>
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
                  <p class="text-[10px] text-slate-500 dark:text-slate-300 uppercase tracking-wide">Total Refs</p>
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
                  <p class="text-[10px] text-slate-500 dark:text-slate-300 uppercase tracking-wide">Completed</p>
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
                  <p class="text-[10px] text-slate-500 dark:text-slate-300 uppercase tracking-wide">Action Req'd</p>
                </div>
              </div>
            </router-link>

            <!-- Mid-Term Actions (replaced Rejected — always zero) -->
            <router-link
              :to="{ path: '/tenancies', query: { filter: 'mid_term_actions' } }"
              class="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
              :class="midTermActions > 0 ? 'border-amber-200 dark:border-amber-800' : ''"
            >
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-lg flex items-center justify-center" :class="midTermActions > 0 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-slate-100 dark:bg-slate-800'">
                  <AlertTriangle class="w-4 h-4" :class="midTermActions > 0 ? 'text-amber-600' : 'text-slate-500 dark:text-slate-400'" />
                </div>
                <div>
                  <p class="text-lg font-bold" :class="midTermActions > 0 ? 'text-amber-600' : 'text-slate-900 dark:text-white'">{{ midTermActions }}</p>
                  <p class="text-[10px] text-slate-500 dark:text-slate-300 uppercase tracking-wide">Mid-Term</p>
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
                  <p class="text-xs text-slate-500 dark:text-slate-300">Next 12 months • {{ calendarEntries.filter(e => e.type !== 'move_out').length }} scheduled move-ins</p>
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
            <div v-else-if="calendarEntries.length === 0 && complianceExpiries.length === 0" class="py-12 text-center">
              <CalendarDays class="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p class="text-sm font-medium text-slate-600 dark:text-slate-300">No scheduled move-ins</p>
              <p class="text-xs text-slate-500 dark:text-slate-300 mt-1">Move-in dates from tenancies will appear here</p>
            </div>

            <!-- Calendar Horizontal Scroll -->
            <div v-else class="calendar-container overflow-x-auto pb-4">
              <div class="flex gap-4 px-5 pt-4 min-w-max">
                <div
                  v-for="monthData in calendarMonths"
                  :key="`${monthData.year}-${monthData.month}`"
                  class="calendar-month flex-shrink-0 w-60 sm:w-72"
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
                      {{ getMonthEntryLabel(monthData.entries) }}
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
                            @click="day.entries.length > 0 ? navigateToTenancy((day.entries.find(e => e.type !== 'move_out') || day.entries[0])!.tenancyId) : null"
                          >
                            <span>{{ day.date }}</span>
                          </div>
                          <!-- Move-in indicator dot (amber/green) -->
                          <div
                            v-if="day.entries.some(e => e.type !== 'move_out')"
                            class="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                            :class="getEntryDotColor(day.entries.filter(e => e.type !== 'move_out'))"
                          />
                          <!-- Move-out indicator dot (red) -->
                          <div
                            v-if="day.entries.some(e => e.type === 'move_out')"
                            class="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-red-500"
                            :class="{ 'ml-1.5': day.entries.some(e => e.type !== 'move_out') }"
                          />
                          <!-- Compliance expiry indicator (blue) -->
                          <div
                            v-if="day.fullDate && getComplianceForDay(day.fullDate).length > 0"
                            class="absolute -top-0.5 right-0 w-1.5 h-1.5 rounded-full bg-blue-500 cursor-pointer"
                            @click.stop="router.push(`/properties/${getComplianceForDay(day.fullDate!)[0]?.propertyId}`)"
                          />
                          <!-- Compliance expiry tooltip -->
                          <div
                            v-if="day.fullDate && getComplianceForDay(day.fullDate).length > 0"
                            class="calendar-tooltip absolute right-0 bottom-full mb-2 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none"
                          >
                            <div class="bg-blue-900 text-white text-[10px] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg border border-blue-700">
                              <div v-for="c in getComplianceForDay(day.fullDate!)" :key="c.id" class="py-0.5">
                                {{ c.propertyAddress || 'Property' }} - {{ formatComplianceType(c.type) }} expires
                              </div>
                            </div>
                          </div>
                          <!-- Tooltip on hover showing tenants moving in/out -->
                          <div
                            v-if="day.entries.length > 0"
                            class="calendar-tooltip absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none"
                          >
                            <div class="bg-slate-900 dark:bg-slate-700 text-white text-[10px] rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap">
                              <div v-for="entry in day.entries.filter(e => e.type !== 'move_out')" :key="entry.tenancyId" class="mb-1.5 last:mb-0">
                                <p class="font-medium">{{ entry.property.address }}</p>
                                <p v-for="tenant in entry.tenants" :key="tenant.id" class="text-slate-300 pl-2">
                                  • {{ tenant.name }}
                                </p>
                              </div>
                              <div v-for="entry in day.entries.filter(e => e.type === 'move_out')" :key="'out-' + entry.tenancyId" class="mb-1.5 last:mb-0">
                                <p class="font-medium text-red-300">Move-out: {{ entry.property.address }}</p>
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
                  <div v-if="monthData.entries.filter(e => e.type !== 'move_out').length > 0" class="mt-3 space-y-1.5">
                    <div
                      v-for="entry in monthData.entries.filter(e => e.type !== 'move_out')"
                      :key="`${entry.referenceVersion || 'x'}-${entry.referenceId || entry.tenancyId}`"
                      class="flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800"
                      @click="navigateToReference(entry)"
                    >
                      <div
                        class="w-7 h-7 rounded bg-slate-900 dark:bg-slate-700 text-white flex flex-col items-center justify-center flex-shrink-0"
                      >
                        <span class="text-[8px] uppercase">{{ getShortMonth(entry.moveInDate) }}</span>
                        <span class="text-xs font-bold leading-none">{{ getDay(entry.moveInDate) }}</span>
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-xs font-medium text-slate-900 dark:text-white truncate">{{ entry.property.address || 'No property' }}</p>
                        <p class="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {{ entry.tenants[0]?.name || 'Tenant' }}{{ entry.tenants.length > 1 ? ` + ${entry.tenants.length - 1} other${entry.tenants.length > 2 ? 's' : ''}` : '' }}
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
import { authFetch } from '../lib/authFetch'
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
  Calendar,
  AlertTriangle
} from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL ?? ''

interface CalendarEntry {
  // Reference id — the calendar is now driven by V1 + V2 references, not
  // tenancies. tenancyId is kept for backwards compat with move-out entries
  // which still come from the tenancies table.
  referenceId?: string | null
  // 'v1' | 'v2' — controls which page the click-through navigates to
  referenceVersion?: 'v1' | 'v2'
  referenceNumber?: string | null
  tenancyId?: string | null
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
  }>
  groupSize?: number
  status?: string
  allActionsComplete: boolean
  type?: 'move_in' | 'move_out'
}

interface ComplianceExpiry {
  id: string
  type: string
  expiryDate: string
  status: string
  propertyId: string
  propertyAddress: string
  propertyPostcode: string
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
  return authStore.userName || 'there'
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
const midTermActions = ref(0)
const activeTenancies = ref(0)
const pendingTenancies = ref(0)
const expiringSoonTenancies = ref(0)
const depositsToProtect = ref(0)

// Calendar
const calendarEntries = ref<CalendarEntry[]>([])
const complianceExpiries = ref<ComplianceExpiry[]>([])
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
  const allComplete = entries.every(e => e.allActionsComplete)
  if (allComplete) return 'bg-emerald-500'
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

const getMonthEntryLabel = (entries: CalendarEntry[]): string => {
  const moveInCount = entries.filter(e => e.type !== 'move_out').length
  const moveOutCount = entries.filter(e => e.type === 'move_out').length
  const parts: string[] = []
  if (moveInCount > 0) parts.push(`${moveInCount} move-in${moveInCount > 1 ? 's' : ''}`)
  if (moveOutCount > 0) parts.push(`${moveOutCount} move-out${moveOutCount > 1 ? 's' : ''}`)
  return parts.join(', ')
}

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

    const response = await authFetch(`${API_URL}/api/references/stats`, { token })

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
      midTermActions.value = stats.midTermActions || 0
    }
  } catch (error) {
    console.error('Failed to fetch reference stats:', error)
  }
}

const fetchTenancyStats = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await authFetch(`${API_URL}/api/tenancies/records/stats`, { token })

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

const getComplianceForDay = (fullDate: string): ComplianceExpiry[] => {
  return complianceExpiries.value.filter(c => c.expiryDate === fullDate)
}

const formatComplianceType = (type: string): string => {
  const types: Record<string, string> = {
    gas_safety: 'Gas Safety',
    eicr: 'EICR',
    epc: 'EPC',
    council_licence: 'Council Licence',
    pat_test: 'PAT Test',
    other: 'Other'
  }
  return types[type] || type
}

const fetchCalendarData = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    calendarLoading.value = true

    // Pull move-in calendar data from /api/v2/references/calendar — that
    // endpoint now merges V1 references + V2 references + tenancies and
    // dedupes by (linked_property_id, move-in date). Move-out entries +
    // compliance still come from /api/tenancies/records/calendar.
    const [moveInResp, tenancyResp] = await Promise.all([
      authFetch(`${API_URL}/api/v2/references/calendar`, { token }),
      authFetch(`${API_URL}/api/tenancies/records/calendar`, { token }),
    ])

    const moveInEntries = moveInResp.ok ? ((await moveInResp.json()).entries || []) : []

    let moveOutEntries: any[] = []
    let compliance: any[] = []
    if (tenancyResp.ok) {
      const tenancyData = await tenancyResp.json()
      // Keep only move_out entries from the tenancy calendar — move_ins now
      // come from references
      moveOutEntries = (tenancyData.entries || []).filter((e: any) => e.type === 'move_out')
      compliance = tenancyData.complianceExpiries || []
    }

    calendarEntries.value = [...moveInEntries, ...moveOutEntries]
    complianceExpiries.value = compliance
  } catch (error) {
    console.error('Failed to fetch calendar data:', error)
  } finally {
    calendarLoading.value = false
  }
}

// Navigation
const navigateToTenancy = (tenancyId: string) => {
  router.push(`/tenancies?tenancy=${tenancyId}`)
}

// Navigate to a calendar entry. The calendar feed merges three sources —
// V2 refs, V1 refs and tenancies — and tags each with referenceVersion
// where applicable. Routing rules:
//   - referenceVersion === 'v2'  → /references-v2?ref=<id>
//   - referenceVersion === 'v1'  → /references?person=<id>
//   - no referenceId (pure tenancy) → /tenancies?tenancy=<id>
const navigateToReference = (entry: CalendarEntry) => {
  if (entry.referenceVersion === 'v2' && entry.referenceId) {
    router.push(`/references-v2?ref=${entry.referenceId}`)
    return
  }
  if (entry.referenceVersion === 'v1' && entry.referenceId) {
    router.push(`/references?person=${entry.referenceId}`)
    return
  }
  if (entry.tenancyId) {
    router.push(`/tenancies?tenancy=${entry.tenancyId}`)
  }
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

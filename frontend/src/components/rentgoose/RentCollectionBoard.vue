<template>
  <div>
    <!-- Period selector + Summary stat cards -->
    <div class="flex items-center justify-between mb-4">
      <div></div>
      <select
        v-model="summaryPeriod"
        :class="['text-sm rounded-lg px-3 py-1.5 border font-medium', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-200 text-gray-900']"
      >
        <option value="today">Today</option>
        <option value="wtd">Week to Date</option>
        <option value="mtd">Month to Date</option>
        <option value="ytd">Year to Date</option>
      </select>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <div :class="['rounded-xl p-4 border', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200']">
        <p :class="['text-xs font-bold uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-gray-500']">Collected {{ periodLabel }}</p>
        <p class="text-2xl font-bold text-emerald-500 mt-1">&pound;{{ formatMoney(periodSummary.collected) }}</p>
      </div>
      <div :class="['rounded-xl p-4 border', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200']">
        <p :class="['text-xs font-bold uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-gray-500']">Due {{ periodLabel }}</p>
        <p class="text-2xl font-bold text-amber-500 mt-1">&pound;{{ formatMoney(periodSummary.due) }}</p>
      </div>
      <div :class="['rounded-xl p-4 border', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200']">
        <p :class="['text-xs font-bold uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-gray-500']">Arrears</p>
        <p class="text-2xl font-bold text-red-500 mt-1">&pound;{{ formatMoney(store.summary.overdueTotal) }}</p>
      </div>
      <div :class="['rounded-xl p-4 border', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200']">
        <p :class="['text-xs font-bold uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-gray-500']">Payouts Ready</p>
        <p class="text-2xl font-bold text-primary mt-1">&pound;{{ formatMoney(store.summary.payoutsReady) }}</p>
      </div>
      <div :class="['rounded-xl p-4 border', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200']">
        <p :class="['text-xs font-bold uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-gray-500']">Agent Fees Due</p>
        <p class="text-2xl font-bold text-purple-500 mt-1">&pound;{{ formatMoney(periodSummary.agentFees) }}</p>
      </div>
    </div>

    <!-- Filter pills -->
    <div class="flex gap-2 mb-4 flex-wrap">
      <button
        v-for="filter in filters"
        :key="filter.value"
        @click="setFilter(filter.value)"
        :class="[
          'px-3 py-1.5 text-sm font-medium rounded-full transition-all',
          store.statusFilter === filter.value
            ? 'bg-primary text-white'
            : isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        ]"
      >
        {{ filter.label }}
        <span v-if="filter.count > 0" class="ml-1 opacity-75">({{ filter.count }})</span>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="store.loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <!-- Empty state -->
    <div v-else-if="sortedEntries.length === 0" class="text-center py-12" :class="isDark ? 'text-slate-400' : 'text-gray-400'">
      No rent entries found for this filter.
    </div>

    <!-- Grouped by month -->
    <div v-else class="space-y-6">
      <div v-for="group in groupedByMonth" :key="group.key">
        <!-- Month header -->
        <div class="flex items-center gap-3 mb-3 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
          <h3 class="text-sm font-bold text-primary">{{ group.label }}</h3>
          <div class="flex-1 h-px bg-primary/20"></div>
          <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/20 text-primary">
            {{ group.entries.length }} entr{{ group.entries.length === 1 ? 'y' : 'ies' }} &middot; &pound;{{ formatMoney(group.totalDue) }}
          </span>
        </div>

        <!-- Table for this month -->
        <div :class="['rounded-xl border overflow-hidden', isDark ? 'border-slate-700' : 'border-gray-200']">
          <table class="w-full">
            <thead>
              <tr :class="isDark ? 'bg-slate-800' : 'bg-gray-50'">
                <th class="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Property / Tenant</th>
                <th class="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide hidden md:table-cell" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Landlord</th>
                <th class="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Due Date</th>
                <th class="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Amount</th>
                <th class="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Status</th>
                <th class="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="entry in group.entries"
                :key="entry.id"
                :class="['border-t transition-colors', isDark ? 'border-slate-700 hover:bg-slate-800/50' : 'border-gray-100 hover:bg-gray-50']"
              >
                <td class="px-4 py-3">
                  <div class="font-medium text-sm">{{ entry.property_address }}</div>
                  <div :class="['text-xs mt-0.5', isDark ? 'text-slate-400' : 'text-gray-500']">{{ entry.tenant_names }}</div>
                </td>
                <td class="px-4 py-3 text-sm hidden md:table-cell" :class="isDark ? 'text-slate-300' : 'text-gray-700'">{{ entry.landlord_name }}</td>
                <td class="px-4 py-3 text-sm" :class="isDark ? 'text-slate-300' : 'text-gray-700'">{{ formatDate(entry.due_date) }}</td>
                <td class="px-4 py-3 text-sm text-right font-medium">&pound;{{ formatMoney(entry.amount_due) }}</td>
                <td class="px-4 py-3 text-center">
                  <span :class="['px-2 py-1 text-xs font-medium rounded-full', statusClass(entry.status)]">
                    {{ statusLabel(entry.status) }}
                  </span>
                </td>
                <td class="px-4 py-3 text-right">
                  <button
                    v-if="entry.status !== 'paid' && entry.status !== 'cancelled'"
                    @click="openReceipt(entry)"
                    class="px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-orange-600 rounded-lg transition-colors"
                  >
                    Receipt
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Receipt Modal -->
    <ReceiptModal
      v-if="showReceiptModal && selectedEntry"
      :entry="selectedEntry"
      @close="showReceiptModal = false"
      @receipted="onReceipted"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDarkMode } from '../../composables/useDarkMode'
import { useRentGooseStore, type ScheduleEntry } from '../../stores/rentgoose'
import ReceiptModal from './ReceiptModal.vue'

const { isDark } = useDarkMode()
const store = useRentGooseStore()

const summaryPeriod = ref('today')

const periodLabel = computed(() => {
  switch (summaryPeriod.value) {
    case 'wtd': return 'This Week'
    case 'mtd': return 'This Month'
    case 'ytd': return 'This Year'
    default: return 'Today'
  }
})

function getPeriodStart(period: string): string {
  const now = new Date()
  if (period === 'wtd') {
    const day = now.getDay() || 7
    const mon = new Date(now)
    mon.setDate(now.getDate() - day + 1)
    return mon.toISOString().split('T')[0]
  }
  if (period === 'mtd') return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  if (period === 'ytd') return `${now.getFullYear()}-01-01`
  return now.toISOString().split('T')[0] // today
}

const periodSummary = computed(() => {
  const start = getPeriodStart(summaryPeriod.value)
  const entries = store.scheduleEntries

  const collected = entries
    .filter(e => e.status === 'paid' && e.due_date >= start)
    .reduce((sum, e) => sum + (e.amount_received || 0), 0)

  const due = entries
    .filter(e => e.due_date >= start && e.status !== 'paid' && e.status !== 'cancelled')
    .reduce((sum, e) => sum + (e.amount_due || 0), 0)

  // Agent fees: sum of charges on paid entries in period
  const agentFees = entries
    .filter(e => e.status === 'paid' && e.due_date >= start)
    .reduce((sum, e) => sum + (e.total_charges || 0), 0)

  return { collected, due, agentFees }
})

const showReceiptModal = ref(false)
const selectedEntry = ref<ScheduleEntry | null>(null)

const filters = computed(() => [
  { label: 'All', value: 'all', count: store.statusCounts.all || 0 },
  { label: 'Arrears', value: 'arrears', count: store.statusCounts.arrears || 0 },
  { label: 'Due', value: 'due', count: store.statusCounts.due || 0 },
  { label: 'Partial', value: 'partial', count: store.statusCounts.partial || 0 },
  { label: 'Scheduled', value: 'scheduled', count: store.statusCounts.scheduled || 0 },
])

// Sort: overdue first, then due, partial, upcoming, paid — then by due_date ascending
const statusOrder: Record<string, number> = { arrears: 0, overdue: 0, due: 1, partial: 2, scheduled: 3, upcoming: 3, paid: 4, cancelled: 5 }

const sortedEntries = computed(() => {
  return [...store.filteredEntries].sort((a, b) => {
    const orderA = statusOrder[a.status] ?? 9
    const orderB = statusOrder[b.status] ?? 9
    if (orderA !== orderB) return orderA - orderB
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  })
})

// Group sorted entries by month/year
const groupedByMonth = computed(() => {
  const groups = new Map<string, { key: string; label: string; entries: ScheduleEntry[]; totalDue: number; sortOrder: number }>()

  for (const entry of sortedEntries.value) {
    const d = new Date(entry.due_date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

    if (!groups.has(key)) {
      groups.set(key, { key, label, entries: [], totalDue: 0, sortOrder: d.getTime() })
    }
    const group = groups.get(key)!
    group.entries.push(entry)
    group.totalDue += entry.amount_due
  }

  // Sort groups: months with arrears entries first, then chronologically
  return [...groups.values()].sort((a, b) => {
    const aHasArrears = a.entries.some(e => e.status === 'arrears')
    const bHasArrears = b.entries.some(e => e.status === 'arrears')
    if (aHasArrears && !bHasArrears) return -1
    if (!aHasArrears && bHasArrears) return 1
    return a.sortOrder - b.sortOrder
  })
})

function setFilter(value: string) {
  store.statusFilter = value
  store.fetchSchedule({ status: value })
}

function openReceipt(entry: ScheduleEntry) {
  selectedEntry.value = entry
  showReceiptModal.value = true
}

function onReceipted() {
  showReceiptModal.value = false
  store.fetchSchedule({ status: store.statusFilter })
}

function statusClass(status: string) {
  switch (status) {
    case 'arrears': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 'due': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    case 'scheduled': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    case 'partial': return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
    case 'paid': return 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
    default: return 'bg-gray-100 text-gray-500'
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'overdue': return 'Arrears'
    case 'due': return 'Due'
    case 'upcoming': return 'Scheduled'
    case 'partial': return 'Partial'
    case 'paid': return 'Paid'
    default: return status.charAt(0).toUpperCase() + status.slice(1)
  }
}

function formatMoney(val: number) {
  return (val || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

onMounted(() => {
  store.fetchSchedule()
})
</script>

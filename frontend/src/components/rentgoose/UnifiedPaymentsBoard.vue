<template>
  <div>
    <!-- Summary stat cards -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <div :class="['rounded-xl p-4 border', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200']">
        <p :class="['text-xs font-bold uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-gray-500']">Collected</p>
        <p class="text-2xl font-bold text-emerald-500 mt-1">&pound;{{ formatMoney(store.unifiedSummary.collected) }}</p>
      </div>
      <div :class="['rounded-xl p-4 border', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200']">
        <p :class="['text-xs font-bold uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-gray-500']">Due</p>
        <p class="text-2xl font-bold text-amber-500 mt-1">&pound;{{ formatMoney(store.unifiedSummary.due) }}</p>
      </div>
      <div :class="['rounded-xl p-4 border', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200']">
        <p :class="['text-xs font-bold uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-gray-500']">Arrears</p>
        <p class="text-2xl font-bold text-red-500 mt-1">&pound;{{ formatMoney(store.unifiedSummary.arrears) }}</p>
      </div>
      <div :class="['rounded-xl p-4 border', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200']">
        <p :class="['text-xs font-bold uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-gray-500']">Payouts Ready</p>
        <p class="text-2xl font-bold text-primary mt-1">&pound;{{ formatMoney(store.unifiedSummary.payoutsReady) }}</p>
      </div>
      <div :class="['rounded-xl p-4 border', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200']">
        <p :class="['text-xs font-bold uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-gray-500']">Agent Fees</p>
        <p class="text-2xl font-bold text-purple-500 mt-1">&pound;{{ formatMoney(store.unifiedSummary.agentFees) }}</p>
      </div>
    </div>

    <!-- Category tabs -->
    <div class="flex gap-2 mb-4 flex-wrap">
      <button
        v-for="cat in categories"
        :key="cat.value"
        @click="setCategory(cat.value)"
        :class="[
          'px-3 py-1.5 text-sm font-medium rounded-full transition-all',
          store.categoryFilter === cat.value
            ? 'bg-primary text-white'
            : isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        ]"
      >
        {{ cat.label }}
        <span v-if="store.categoryCounts[cat.value] > 0" class="ml-1 opacity-75">({{ store.categoryCounts[cat.value] }})</span>
      </button>
    </div>

    <!-- Status filter pills -->
    <div class="flex gap-2 mb-4 flex-wrap">
      <button
        v-for="filter in statusFilters"
        :key="filter.value"
        @click="setStatusFilter(filter.value)"
        :class="[
          'px-3 py-1.5 text-xs font-medium rounded-full transition-all',
          store.statusFilter === filter.value
            ? 'bg-primary/20 text-primary border border-primary/30'
            : isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
        ]"
      >{{ filter.label }}</button>
    </div>

    <!-- Loading -->
    <div v-if="store.loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <!-- Empty state -->
    <div v-else-if="sortedItems.length === 0" class="text-center py-12" :class="isDark ? 'text-slate-400' : 'text-gray-400'">
      No payment entries found for this filter.
    </div>

    <!-- Grouped by month -->
    <div v-else class="space-y-6">
      <div v-for="group in groupedByMonth" :key="group.key">
        <!-- Month header -->
        <div class="flex items-center gap-3 mb-3 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
          <h3 class="text-sm font-bold text-primary">{{ group.label }}</h3>
          <div class="flex-1 h-px bg-primary/20"></div>
          <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/20 text-primary">
            {{ group.items.length }} item{{ group.items.length === 1 ? '' : 's' }} &middot; &pound;{{ formatMoney(group.totalDue) }}
          </span>
        </div>

        <!-- Table for this month -->
        <div :class="['rounded-xl border overflow-hidden', isDark ? 'border-slate-700' : 'border-gray-200']">
          <table class="w-full">
            <thead>
              <tr :class="isDark ? 'bg-slate-800' : 'bg-gray-50'">
                <th class="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Type</th>
                <th class="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Property / Description</th>
                <th class="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide hidden md:table-cell" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Tenant</th>
                <th class="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Due Date</th>
                <th class="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Amount</th>
                <th class="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Status</th>
                <th class="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in group.items"
                :key="item.id"
                :class="['border-t transition-colors', isDark ? 'border-slate-700 hover:bg-slate-800/50' : 'border-gray-100 hover:bg-gray-50']"
              >
                <td class="px-4 py-3">
                  <span :class="['px-2 py-0.5 text-xs font-medium rounded-full', typeBadgeClass(item.payment_type)]">
                    {{ typeLabel(item.payment_type) }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <div class="font-medium text-sm">{{ item.property_address || item.description }}</div>
                  <div v-if="item.property_address" :class="['text-xs mt-0.5', isDark ? 'text-slate-400' : 'text-gray-500']">{{ item.description }}</div>
                </td>
                <td class="px-4 py-3 text-sm hidden md:table-cell" :class="isDark ? 'text-slate-300' : 'text-gray-700'">{{ item.tenant_name || item.tenant_names || '-' }}</td>
                <td class="px-4 py-3 text-sm" :class="isDark ? 'text-slate-300' : 'text-gray-700'">{{ formatDate(item.due_date) }}</td>
                <td class="px-4 py-3 text-sm text-right font-medium">&pound;{{ formatMoney(item.amount_due) }}</td>
                <td class="px-4 py-3 text-center">
                  <span :class="['px-2 py-1 text-xs font-medium rounded-full', statusClass(item.status)]">
                    {{ statusLabel(item.status) }}
                  </span>
                </td>
                <td class="px-4 py-3 text-right">
                  <button
                    v-if="item.status !== 'paid' && item.status !== 'cancelled'"
                    @click="openReceipt(item)"
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

    <!-- Receipt Modal (for rent items) -->
    <ReceiptModal
      v-if="showRentReceipt && selectedRentEntry"
      :entry="selectedRentEntry"
      @close="showRentReceipt = false"
      @receipted="onReceipted"
    />

    <!-- Expected Payment Receipt Modal (for non-rent items) -->
    <ExpectedPaymentReceiptModal
      v-if="showExpectedReceipt && selectedExpectedItem"
      :item="selectedExpectedItem"
      @close="showExpectedReceipt = false"
      @receipted="onReceipted"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDarkMode } from '../../composables/useDarkMode'
import { useRentGooseStore, type ScheduleEntry, type UnifiedPaymentItem } from '../../stores/rentgoose'
import ReceiptModal from './ReceiptModal.vue'
import ExpectedPaymentReceiptModal from './ExpectedPaymentReceiptModal.vue'

const { isDark } = useDarkMode()
const store = useRentGooseStore()

const showRentReceipt = ref(false)
const showExpectedReceipt = ref(false)
const selectedRentEntry = ref<ScheduleEntry | null>(null)
const selectedExpectedItem = ref<UnifiedPaymentItem | null>(null)

const categories = [
  { label: 'All', value: 'all' },
  { label: 'Rent', value: 'rent' },
  { label: 'Pre-Tenancy', value: 'pre_tenancy' },
  { label: 'Invoices', value: 'invoices' },
  { label: 'Arrears', value: 'arrears' },
]

const statusFilters = [
  { label: 'All Active', value: 'all' },
  { label: 'Due', value: 'due' },
  { label: 'Arrears', value: 'arrears' },
  { label: 'Partial', value: 'partial' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Show Paid', value: 'paid' },
]

const statusOrder: Record<string, number> = { arrears: 0, overdue: 0, due: 1, partial: 2, pending: 2, scheduled: 3, upcoming: 3, paid: 4, cancelled: 5 }

const sortedItems = computed(() => {
  return [...store.filteredUnifiedItems].sort((a, b) => {
    const orderA = statusOrder[a.status] ?? 9
    const orderB = statusOrder[b.status] ?? 9
    if (orderA !== orderB) return orderA - orderB
    const da = a.due_date || '9999-12-31'
    const db = b.due_date || '9999-12-31'
    return da.localeCompare(db)
  })
})

const groupedByMonth = computed(() => {
  const groups = new Map<string, { key: string; label: string; items: UnifiedPaymentItem[]; totalDue: number; sortOrder: number }>()

  for (const item of sortedItems.value) {
    const dateStr = item.due_date || item.paid_at || new Date().toISOString()
    const d = new Date(dateStr)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

    if (!groups.has(key)) {
      groups.set(key, { key, label, items: [], totalDue: 0, sortOrder: d.getTime() })
    }
    const group = groups.get(key)!
    group.items.push(item)
    group.totalDue += item.amount_due
  }

  return [...groups.values()].sort((a, b) => {
    const aHasArrears = a.items.some(i => i.status === 'arrears' || i.status === 'overdue')
    const bHasArrears = b.items.some(i => i.status === 'arrears' || i.status === 'overdue')
    if (aHasArrears && !bHasArrears) return -1
    if (!aHasArrears && bHasArrears) return 1
    return a.sortOrder - b.sortOrder
  })
})

function setCategory(value: string) {
  store.categoryFilter = value as any
  store.fetchUnifiedSchedule({ status: store.statusFilter })
}

function setStatusFilter(value: string) {
  store.statusFilter = value
  store.fetchUnifiedSchedule({ status: value })
}

function openReceipt(item: UnifiedPaymentItem) {
  if (item.item_type === 'rent') {
    selectedRentEntry.value = {
      id: item.id,
      tenancy_id: item.tenancy_id || '',
      period_start: item.period_start || '',
      period_end: item.period_end || '',
      amount_due: item.amount_due,
      amount_received: item.amount_received,
      status: item.status,
      due_date: item.due_date || '',
      property_address: item.property_address,
      property_postcode: item.property_postcode,
      tenant_names: item.tenant_names,
      landlord_name: item.landlord_name,
      tenancy_ref: item.tenancy_ref,
      fee_percent: item.fee_percent,
      management_type: item.management_type,
    }
    showRentReceipt.value = true
  } else {
    selectedExpectedItem.value = item
    showExpectedReceipt.value = true
  }
}

function onReceipted() {
  showRentReceipt.value = false
  showExpectedReceipt.value = false
  store.fetchUnifiedSchedule({ status: store.statusFilter })
}

function typeBadgeClass(type: string) {
  switch (type) {
    case 'rent': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    case 'holding_deposit': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    case 'initial_monies': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    case 'deposit': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    case 'tenant_change_fee': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    case 'rent_change_fee': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    case 'invoice': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    default: return 'bg-gray-100 text-gray-500'
  }
}

function typeLabel(type: string) {
  switch (type) {
    case 'rent': return 'Rent'
    case 'holding_deposit': return 'Holding Dep.'
    case 'initial_monies': return 'Initial Monies'
    case 'deposit': return 'Deposit'
    case 'tenant_change_fee': return 'Change Fee'
    case 'rent_change_fee': return 'Date Change'
    case 'invoice': return 'Invoice'
    default: return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }
}

function statusClass(status: string) {
  switch (status) {
    case 'arrears': case 'overdue': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 'due': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    case 'pending': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    case 'scheduled': case 'upcoming': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    case 'partial': return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
    case 'paid': return 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
    default: return 'bg-gray-100 text-gray-500'
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'overdue': return 'Arrears'
    case 'pending': return 'Pending'
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

function formatDate(dateStr?: string) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

onMounted(() => {
  store.fetchUnifiedSchedule()
})
</script>

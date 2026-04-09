<template>
  <div>
    <!-- Summary stat cards -->
    <div class="grid grid-cols-3 gap-4 mb-6">
      <!-- Agent Fees Due to Pay = PRIMARY card -->
      <div :class="[
        'rounded-[10px] px-5 py-4 border',
        store.unifiedSummary.collected > 0
          ? 'bg-[#fff7ed] dark:bg-orange-950/30 border-l-[3px] border-l-[#f97316] border-gray-200 dark:border-slate-700'
          : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'
      ]">
        <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold">Agent Fees Due to Pay</p>
        <p :class="['text-[22px] font-bold mt-1', store.unifiedSummary.collected > 0 ? 'text-[#f97316]' : 'text-gray-900 dark:text-white']">&pound;{{ formatMoney(store.unifiedSummary.collected) }}</p>
      </div>
      <!-- Due Today = neutral, amber if > 0 -->
      <div :class="[
        'rounded-[10px] px-5 py-4 border',
        store.unifiedSummary.due > 0
          ? 'bg-[#fffbeb] dark:bg-amber-950/30 border-l-[3px] border-l-[#f59e0b] border-gray-200 dark:border-slate-700'
          : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'
      ]">
        <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold">Due Today</p>
        <p :class="['text-[22px] font-bold mt-1', store.unifiedSummary.due > 0 ? 'text-[#f59e0b]' : 'text-gray-900 dark:text-white']">&pound;{{ formatMoney(store.unifiedSummary.due) }}</p>
      </div>
      <!-- Arrears = red accent if > 0, neutral if 0 -->
      <div :class="[
        'rounded-[10px] px-5 py-4 border',
        store.unifiedSummary.arrears > 0
          ? 'bg-[#fef2f2] dark:bg-red-950/30 border-l-[3px] border-l-[#dc2626] border-gray-200 dark:border-slate-700'
          : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'
      ]">
        <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold">Arrears</p>
        <p :class="['text-[22px] font-bold mt-1', store.unifiedSummary.arrears > 0 ? 'text-[#dc2626]' : 'text-gray-900 dark:text-white']">&pound;{{ formatMoney(store.unifiedSummary.arrears) }}</p>
      </div>
    </div>

    <!-- List container with rectangle tabs -->
    <div :class="['rounded-[10px] border overflow-hidden', isDark ? 'border-slate-700' : 'border-gray-200']">
      <!-- Rectangle tabs bar -->
      <div :class="['flex items-center justify-between border-b', isDark ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200']">
        <div class="flex">
          <button
            v-for="cat in categories"
            :key="cat.value"
            @click="setCategory(cat.value)"
            :class="[
              'px-5 py-3 text-[13px] font-semibold border-b-2 transition-all',
              store.categoryFilter === cat.value
                ? 'border-[#f97316] text-[#f97316] bg-white dark:bg-slate-900'
                : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
            ]"
          >
            {{ cat.label }}
            <span v-if="store.categoryCounts[cat.value] > 0" :class="['ml-1 text-xs', store.categoryFilter === cat.value ? 'text-[#f97316]/70' : 'opacity-60']">({{ store.categoryCounts[cat.value] }})</span>
          </button>
        </div>
      <!-- RIGHT: status dropdown -->
      <div class="relative">
        <button
          @click="showStatusDropdown = !showStatusDropdown"
          :class="[
            'rounded-full text-[13px] px-3.5 py-1 font-medium transition-all flex items-center gap-1',
            store.statusFilter !== 'all'
              ? 'bg-gray-800 text-white'
              : isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-gray-100 text-gray-500'
          ]"
        >
          Status: {{ statusDropdownOptions.find(o => o.value === store.statusFilter)?.label || 'All Active' }} &#9662;
        </button>
        <div
          v-if="showStatusDropdown"
          class="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg z-20 py-1"
        >
          <button
            v-for="opt in statusDropdownOptions"
            :key="opt.value"
            @click="setStatusFilter(opt.value); showStatusDropdown = false"
            :class="[
              'w-full text-left px-3 py-2 text-[13px] hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors',
              store.statusFilter === opt.value ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-slate-400'
            ]"
          >{{ opt.label }}</button>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="store.loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <!-- Empty state -->
    <div v-else-if="sortedItems.length === 0" class="flex flex-col items-center justify-center py-16">
      <svg class="w-10 h-10 text-gray-300 dark:text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
      <p class="text-[15px] font-semibold text-gray-700 dark:text-white">No payments found</p>
      <p class="text-[13px] text-gray-500 dark:text-slate-400 max-w-[320px] text-center mt-1">Try adjusting your filters or check back when new payments are scheduled.</p>
    </div>

    <!-- Grouped by month -->
    <div v-else class="space-y-6">
      <div v-for="group in groupedByMonth" :key="group.key">
        <!-- Month header -->
        <div class="bg-[#f9fafb] dark:bg-slate-800 h-10 px-4 flex items-center justify-between rounded-lg">
          <h3 class="text-[12px] font-semibold uppercase tracking-[0.06em] text-gray-700 dark:text-slate-300">{{ group.label }}</h3>
          <span class="text-[12px] font-medium px-2.5 py-0.5 rounded-full bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300">
            {{ group.items.length }} item{{ group.items.length === 1 ? '' : 's' }} &middot; &pound;{{ formatMoney(group.totalDue) }}
          </span>
        </div>

        <!-- Table for this month -->
        <div :class="['rounded-[10px] border overflow-hidden', isDark ? 'border-slate-700' : 'border-gray-200']">
          <table class="w-full">
            <thead>
              <tr :class="isDark ? 'bg-slate-800' : 'bg-gray-50'">
                <th class="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Type</th>
                <th class="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Property / Description</th>
                <th class="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500 hidden md:table-cell">Tenant</th>
                <th class="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Due Date</th>
                <th class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Amount</th>
                <th class="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Status</th>
                <th class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(item, idx) in group.items"
                :key="item.id"
                :class="['border-b border-[#f3f4f6] dark:border-slate-700 min-h-[52px] transition-colors hover:bg-[#fff7ed] dark:hover:bg-slate-700/50', idx % 2 === 1 ? (isDark ? 'bg-slate-800/50' : 'bg-[#fff8f3]') : '']"
              >
                <td class="px-4 py-3">
                  <span :class="['px-2 py-0.5 text-xs font-medium rounded-full', typeBadgeClass(item.payment_type)]">
                    {{ typeLabel(item.payment_type) }}
                  </span>
                  <span v-if="item.item_type === 'rent' && (item as any).has_rlp" class="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">RLP</span>
                </td>
                <td class="px-4 py-3">
                  <div v-if="item.property_address" class="font-semibold text-sm">
                    {{ item.property_address }} <span :class="['font-normal', isDark ? 'text-slate-400' : 'text-gray-500']">&middot; {{ abbreviateNames(item.tenant_name || item.tenant_names) }}</span>
                  </div>
                  <div v-else class="font-semibold text-sm">{{ item.description }}</div>
                  <div v-if="item.property_address" :class="['text-xs mt-0.5', isDark ? 'text-slate-400' : 'text-gray-500']">{{ formatPeriodDesc(item.description) }}</div>
                </td>
                <td class="px-4 py-3 text-sm hidden md:table-cell" :class="isDark ? 'text-slate-300' : 'text-gray-700'">{{ abbreviateNames(item.tenant_name || item.tenant_names) }}</td>
                <td class="px-4 py-3 text-sm" :class="isOverdue(item) ? 'text-red-600 font-semibold' : (isDark ? 'text-slate-300' : 'text-gray-700')">{{ formatDate(item.due_date) }}</td>
                <td class="px-4 py-3 text-sm text-right font-medium tabular-nums">&pound;{{ formatMoney(item.amount_due) }}</td>
                <td class="px-4 py-3 text-center">
                  <span :class="['px-2.5 py-0.5 text-xs font-medium rounded-full', statusClass(item.status)]">
                    {{ statusLabel(item.status) }}
                  </span>
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="flex items-center justify-end gap-1.5">
                    <!-- Silence Arrears Emails — before chase, only for arrears/overdue rent -->
                    <button
                      v-if="item.item_type === 'rent' && (item.status === 'arrears' || item.status === 'overdue')"
                      @click="silenceArrears(item)"
                      :disabled="silenceState[item.id] === 'done'"
                      :class="[
                        'rounded-lg font-semibold px-3 py-2 text-xs transition-all',
                        silenceState[item.id] === 'done'
                          ? 'bg-blue-100 text-blue-600 cursor-default dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40'
                      ]"
                      :title="silenceState[item.id] === 'done' ? 'Silenced for 30 days' : 'Silence arrears emails for 30 days'"
                    >
                      {{ silenceState[item.id] === 'done' ? 'Silenced' : 'Silence' }}
                    </button>
                    <!-- Chase button — only for rent items in arrears -->
                    <template v-if="item.item_type === 'rent' && (item.status === 'arrears' || item.status === 'overdue')">
                      <button
                        @click="handleChase(item)"
                        :disabled="chaseState[item.id] === 'sending' || chaseState[item.id] === 'sent'"
                        :class="[
                          'rounded-lg font-semibold px-3 py-2 text-xs transition-all',
                          chaseState[item.id] === 'sent'
                            ? 'bg-green-600 text-white cursor-default'
                            : chaseState[item.id] === 'confirm'
                              ? 'bg-gray-900 text-white hover:bg-black'
                              : chaseState[item.id] === 'sending'
                                ? 'bg-gray-600 text-white cursor-wait'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-slate-700 dark:text-slate-300'
                        ]"
                      >
                        {{ chaseState[item.id] === 'sent' ? 'Sent ✓' : chaseState[item.id] === 'confirm' ? 'Confirm?' : chaseState[item.id] === 'sending' ? 'Sending…' : 'Chase' }}
                      </button>
                    </template>
                    <!-- Greyed chase placeholder for non-arrears rent items -->
                    <template v-else-if="item.item_type === 'rent' && item.status !== 'paid' && item.status !== 'cancelled'">
                      <button disabled class="rounded-lg font-semibold px-3 py-2 text-xs bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600">
                        Chase
                      </button>
                    </template>

                    <!-- Payment History -->
                    <button
                      v-if="item.item_type === 'rent'"
                      @click="paymentHistoryEntry = item; showPaymentHistory = true"
                      :class="['rounded-lg font-semibold px-3 py-2 text-xs transition-colors', isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200']"
                      title="View payment history"
                    >
                      History
                    </button>
                    <!-- Edit Agency Fees -->
                    <button
                      v-if="item.item_type === 'rent'"
                      @click="editFeesEntry = item; showEditFees = true"
                      :class="['rounded-lg font-semibold px-3 py-2 text-xs transition-colors', isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200']"
                      title="Edit agency fees for this property"
                    >
                      Fees
                    </button>
                    <button
                      v-if="item.status !== 'paid' && item.status !== 'cancelled'"
                      @click="openReceipt(item)"
                      class="bg-[#f97316] hover:bg-[#ea6d10] text-white rounded-lg font-semibold px-3 py-2 text-xs transition-colors"
                    >
                      Receipt
                    </button>
                    <!-- Remove from list -->
                    <button
                      v-if="item.status !== 'paid' && item.status !== 'cancelled'"
                      @click="removeFromList(item)"
                      class="rounded-lg font-semibold px-3 py-2 text-xs bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 transition-colors"
                      title="Remove from rent queue"
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    </div><!-- close list container with tabs -->

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

    <!-- Edit Agency Fees Modal -->
    <EditAgencyFeesModal
      v-if="showEditFees && editFeesEntry"
      :entry="editFeesEntry"
      @close="showEditFees = false"
      @saved="store.fetchUnifiedSchedule()"
    />

    <!-- Payment History Modal -->
    <PaymentHistoryModal
      v-if="showPaymentHistory && paymentHistoryEntry"
      :entry="paymentHistoryEntry"
      @close="showPaymentHistory = false"
      @updated="store.fetchUnifiedSchedule()"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDarkMode } from '../../composables/useDarkMode'
import { useRentGooseStore, type ScheduleEntry, type UnifiedPaymentItem } from '../../stores/rentgoose'
import ReceiptModal from './ReceiptModal.vue'
import ExpectedPaymentReceiptModal from './ExpectedPaymentReceiptModal.vue'
import EditAgencyFeesModal from './EditAgencyFeesModal.vue'
import PaymentHistoryModal from './PaymentHistoryModal.vue'

const { isDark } = useDarkMode()
const store = useRentGooseStore()

const showRentReceipt = ref(false)
const showExpectedReceipt = ref(false)
const selectedRentEntry = ref<ScheduleEntry | null>(null)
const selectedExpectedItem = ref<UnifiedPaymentItem | null>(null)

// Edit Agency Fees modal
const showEditFees = ref(false)
const editFeesEntry = ref<any>(null)

// Payment History modal
const showPaymentHistory = ref(false)
const paymentHistoryEntry = ref<any>(null)

// Chase button state: itemId -> 'confirm' (first click) | 'sending' | 'sent'
const chaseState = ref<Record<string, 'confirm' | 'sending' | 'sent'>>({})
const silenceState = ref<Record<string, 'done'>>({})

async function handleChase(item: UnifiedPaymentItem) {
  if (chaseState.value[item.id] === 'sent') return
  if (chaseState.value[item.id] !== 'confirm') {
    // First click — arm the button
    chaseState.value[item.id] = 'confirm'
    return
  }
  // Second click — send
  chaseState.value[item.id] = 'sending'
  try {
    await store.sendChaseEmail(item.id)
    chaseState.value[item.id] = 'sent'
  } catch {
    delete chaseState.value[item.id]
  }
}

const categories = [
  { label: 'All', value: 'all' },
  { label: 'Rent', value: 'rent' },
  { label: 'Pre-Tenancy', value: 'pre_tenancy' },
  { label: 'Invoices', value: 'invoices' },
]

const showStatusDropdown = ref(false)

const statusDropdownOptions = [
  { label: 'All Active', value: 'all' },
  { label: 'Due', value: 'due' },
  { label: 'Arrears', value: 'arrears' },
  { label: 'Partial', value: 'partial' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Paid', value: 'paid' },
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
  // No refetch — filtered in memory so summary cards stay static
}

async function silenceArrears(item: UnifiedPaymentItem) {
  try {
    await store.silenceArrears(item.id)
    silenceState.value[item.id] = 'done'
  } catch (err) {
    console.error('Failed to silence arrears:', err)
  }
}

async function removeFromList(item: UnifiedPaymentItem) {
  if (!confirm('Remove this entry from the rent queue? This will cancel the schedule entry and resolve any arrears chase.')) return
  try {
    await store.removeScheduleEntry(item.id)
  } catch (err) {
    console.error('Failed to remove entry:', err)
  }
}

function isOverdue(item: UnifiedPaymentItem) {
  if (item.status === 'arrears' || item.status === 'overdue') return true
  if (!item.due_date) return false
  return item.status !== 'paid' && item.status !== 'cancelled' && new Date(item.due_date) < new Date()
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
    case 'rent': return 'bg-[#eff6ff] text-[#1d4ed8]'
    case 'holding_deposit': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    case 'initial_monies': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    case 'deposit': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    case 'tenant_change_fee': return 'bg-[#eff6ff] text-[#1d4ed8]'
    case 'rent_change_fee': return 'bg-[#eff6ff] text-[#1d4ed8]'
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
    case 'arrears': case 'overdue': return 'bg-[#fee2e2] text-[#b91c1c]'
    case 'due': return 'bg-[#fef3c7] text-[#b45309]'
    case 'pending': return 'bg-[#fef3c7] text-[#b45309]'
    case 'scheduled': case 'upcoming': return 'bg-gray-100 text-gray-700'
    case 'partial': return 'bg-[#fef3c7] text-[#b45309]'
    case 'paid': return 'bg-[#dcfce7] text-[#15803d]'
    default: return 'bg-gray-100 text-gray-500'
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'arrears': case 'overdue': return 'Arrears'
    case 'due': return 'Due Today'
    case 'scheduled': case 'upcoming': return 'Scheduled'
    case 'partial': return 'Partial'
    case 'paid': return 'Paid'
    case 'pending': return 'Pending'
    default: return status.charAt(0).toUpperCase() + status.slice(1)
  }
}

function formatMoney(val: number) {
  return (val || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(2)
  return `${dd}/${mm}/${yy}`
}

function abbreviateNames(nameStr?: string) {
  if (!nameStr) return '-'
  return nameStr.split(',').map(name => {
    const parts = name.trim().split(' ').filter(Boolean)
    if (parts.length <= 1) return parts[0] || ''
    return `${parts[0][0]}. ${parts.slice(1).join(' ')}`
  }).join(', ')
}

function formatPeriodDesc(desc?: string) {
  if (!desc) return ''
  // Replace ISO dates (YYYY-MM-DD) with DD/MM/YY
  return desc.replace(/(\d{4})-(\d{2})-(\d{2})/g, (_, y, m, d) => `${d}/${m}/${y.slice(2)}`)
}

function handleClickOutside(e: MouseEvent) {
  if (showStatusDropdown.value && !(e.target as HTMLElement)?.closest?.('.relative')) {
    showStatusDropdown.value = false
  }
}

onMounted(async () => {
  await store.syncTenancies()
  store.fetchUnifiedSchedule()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

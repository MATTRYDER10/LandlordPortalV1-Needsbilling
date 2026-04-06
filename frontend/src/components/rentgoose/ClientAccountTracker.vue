<template>
  <div>
    <!-- Summary bar -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <!-- Current Balance = PRIMARY -->
      <div class="bg-[#fff7ed] dark:bg-orange-950/30 border border-gray-200 dark:border-slate-700 border-l-[3px] border-l-[#f97316] rounded-[10px] px-5 py-4">
        <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold">Current Balance</p>
        <p class="text-[22px] font-bold text-gray-900 dark:text-white mt-1">&pound;{{ formatMoney(store.clientAccount.current_balance) }}</p>
      </div>
      <div class="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-[10px] px-5 py-4">
        <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold">Rent Held</p>
        <p class="text-[22px] font-bold text-[#15803d] mt-1">&pound;{{ formatMoney(rentHeld) }}</p>
      </div>
      <div class="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-[10px] px-5 py-4">
        <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold">Deposits Held</p>
        <p class="text-[22px] font-bold text-[#3b82f6] mt-1">&pound;{{ formatMoney(depositsHeld) }}</p>
      </div>
      <div class="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-[10px] px-5 py-4">
        <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold">Last Updated</p>
        <p class="text-sm font-medium mt-2">{{ lastUpdated }}</p>
      </div>
    </div>

    <!-- Chart of Accounts -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-3">
        <button @click="showChartOfAccounts = !showChartOfAccounts" class="flex items-center gap-2 text-[15px] font-semibold text-primary hover:underline">
          <svg :class="['w-4 h-4 transition-transform', showChartOfAccounts ? 'rotate-180' : '']" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          Chart of Accounts
        </button>
        <button
          v-if="expandedCategory && showChartOfAccounts"
          @click="expandedCategory = null"
          class="text-xs text-primary hover:underline"
        >Back to overview</button>
      </div>

      <div v-if="showChartOfAccounts">
        <!-- Category cards -->
        <div v-if="!expandedCategory" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            v-for="cat in accountCategories"
            :key="cat.type"
            @click="expandedCategory = cat.type"
            :class="[
              'rounded-[10px] p-4 border text-left transition-all hover:shadow-md',
              cat.type === highestBalanceType ? 'bg-[#f9fafb] dark:bg-slate-700/50' : '',
              isDark ? 'bg-slate-800 border-slate-700 hover:border-slate-500' : 'bg-white border-gray-200 hover:border-gray-400'
            ]"
            :style="{ borderLeftWidth: '3px', borderLeftColor: categoryBorderColor(cat.type) }"
          >
            <span :class="['text-[11px] uppercase tracking-[0.06em] font-semibold', isDark ? 'text-slate-400' : 'text-gray-500']">{{ cat.label }}</span>
            <p :class="['text-lg font-bold mt-1 tabular-nums', cat.amountClass]">&pound;{{ formatMoney(cat.total) }}</p>
            <p :class="['text-xs mt-0.5', isDark ? 'text-slate-500' : 'text-gray-400']">{{ cat.count }} entr{{ cat.count === 1 ? 'y' : 'ies' }}</p>
          </button>
        </div>

        <!-- Expanded category detail -->
        <div v-else :class="['rounded-[10px] border overflow-hidden', isDark ? 'border-slate-700' : 'border-gray-200']">
          <div :class="['px-4 py-2 text-[15px] font-semibold', isDark ? 'bg-slate-800 text-slate-300' : 'bg-[#f9fafb] text-primary']">
            {{ accountCategories.find(c => c.type === expandedCategory)?.label }} — {{ categoryEntries.length }} entries
          </div>
          <table class="w-full">
            <thead>
              <tr :class="isDark ? 'bg-slate-800/50' : 'bg-gray-50'">
                <th class="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Date</th>
                <th class="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Description</th>
                <th class="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Reference</th>
                <th class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(e, idx) in categoryEntries" :key="e.id" :class="['border-b border-[#f3f4f6] dark:border-slate-700 min-h-[52px] transition-colors hover:bg-[#fff7ed] dark:hover:bg-slate-700/50', idx % 2 === 1 ? 'bg-[#f9fafb] dark:bg-slate-800/50' : '']">
                <td class="px-4 py-3 text-sm">{{ formatDateTime(e.created_at) }}</td>
                <td class="px-4 py-3 text-sm">{{ e.description }}</td>
                <td class="px-4 py-3 text-sm" :class="isDark ? 'text-slate-400' : 'text-gray-500'">{{ e.reference || '---' }}</td>
                <td :class="['px-4 py-3 text-sm text-right font-bold tabular-nums', isCredit(e.entry_type) ? 'text-[#15803d]' : 'text-[#dc2626]']">
                  {{ isCredit(e.entry_type) ? '' : '-' }}&pound;{{ formatMoney(e.amount) }}
                </td>
              </tr>
              <tr v-if="categoryEntries.length === 0">
                <td colspan="4" class="px-4 py-8 text-center text-[13px] text-gray-500 dark:text-slate-400">No entries in this category.</td>
              </tr>
            </tbody>
            <tfoot v-if="categoryEntries.length > 0">
              <tr :class="['border-t-2 font-medium', isDark ? 'border-slate-600' : 'border-gray-300']">
                <td colspan="3" class="px-4 py-3 text-sm font-semibold">Total</td>
                <td class="px-4 py-3 text-sm text-right font-bold tabular-nums">&pound;{{ formatMoney(categoryEntries.reduce((s, e) => s + (isCredit(e.entry_type) ? e.amount : -e.amount), 0)) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>

    <!-- Transactions sub-header -->
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-[15px] font-semibold text-primary">Transactions</h3>
      <div class="flex gap-2">
        <button @click="showManualModal = true" class="bg-[#f97316] hover:bg-[#ea6d10] text-white rounded-lg font-semibold px-[18px] py-2.5 text-sm transition-colors">Add Manual Entry</button>
        <button @click="showReconcileModal = true" class="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg px-3.5 py-2 text-[13px] font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">Reconcile</button>
        <button @click="exportCSV" class="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg px-3.5 py-2 text-[13px] font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">Export CSV</button>
      </div>
    </div>

    <!-- Filter by type -->
    <div class="flex gap-2 mb-4 flex-wrap">
      <button
        v-for="filter in typeFilters"
        :key="filter.value"
        @click="selectedType = filter.value"
        :class="[
          'rounded-full text-[13px] px-3.5 py-1 font-medium transition-all',
          selectedType === filter.value
            ? 'bg-gray-800 text-white'
            : isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-gray-100 text-gray-500'
        ]"
      >{{ filter.label }}</button>
    </div>

    <!-- Ledger table -->
    <div :class="['rounded-[10px] border overflow-hidden', isDark ? 'border-slate-700' : 'border-gray-200']">
      <table class="w-full">
        <thead>
          <tr :class="isDark ? 'bg-slate-800' : 'bg-gray-50'">
            <th class="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Date/Time</th>
            <th class="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Type</th>
            <th class="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Description</th>
            <th class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Credit</th>
            <th class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Debit</th>
            <th class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(entry, idx) in filteredEntries"
            :key="entry.id"
            :class="['border-b border-[#f3f4f6] dark:border-slate-700 min-h-[52px] transition-colors hover:bg-[#fff7ed] dark:hover:bg-slate-700/50', idx % 2 === 1 ? 'bg-[#f9fafb] dark:bg-slate-800/50' : '']"
          >
            <td class="px-4 py-3 text-sm" :class="isDark ? 'text-slate-300' : 'text-gray-700'">{{ formatDateTime(entry.created_at) }}</td>
            <td class="px-4 py-3">
              <span :class="['px-2 py-0.5 text-xs font-medium rounded-full', typeClass(entry.entry_type)]">
                {{ typeLabel(entry.entry_type) }}
              </span>
              <span v-if="entry.is_manual" class="ml-1 text-xs text-purple-500">M</span>
            </td>
            <td class="px-4 py-3 text-sm">{{ entry.description }}</td>
            <td class="px-4 py-3 text-sm text-right font-bold text-[#15803d] tabular-nums">
              {{ isCredit(entry.entry_type) ? `£${formatMoney(entry.amount)}` : '' }}
            </td>
            <td class="px-4 py-3 text-sm text-right font-bold text-[#dc2626] tabular-nums">
              {{ !isCredit(entry.entry_type) ? `£${formatMoney(entry.amount)}` : '' }}
            </td>
            <td class="px-4 py-3 text-sm text-right font-semibold tabular-nums">
              &pound;{{ formatMoney(entry.balance_after) }}
              <span v-if="idx < filteredEntries.length - 1 && entry.balance_after > filteredEntries[idx + 1].balance_after" class="text-[#15803d] text-xs ml-1">&uarr;</span>
              <span v-else-if="idx < filteredEntries.length - 1 && entry.balance_after < filteredEntries[idx + 1].balance_after" class="text-[#dc2626] text-xs ml-1">&darr;</span>
            </td>
          </tr>
          <tr v-if="filteredEntries.length === 0">
            <td colspan="6" class="px-4 py-12 text-center">
              <div class="flex flex-col items-center">
                <svg class="w-10 h-10 text-gray-300 dark:text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                <p class="text-[15px] font-semibold text-gray-700 dark:text-white">No entries found</p>
                <p class="text-[13px] text-gray-500 dark:text-slate-400 max-w-[320px] text-center mt-1">Add an opening balance to get started.</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modals moved below -->

    <!-- Manual Entry Modal -->
    <ManualEntryModal v-if="showManualModal" @close="showManualModal = false" @saved="onSaved" />

    <!-- Reconcile Modal -->
    <ReconcileModal v-if="showReconcileModal" @close="showReconcileModal = false" @reconciled="onSaved" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDarkMode } from '../../composables/useDarkMode'
import { useRentGooseStore } from '../../stores/rentgoose'
import ManualEntryModal from './ManualEntryModal.vue'
import ReconcileModal from './ReconcileModal.vue'

const { isDark } = useDarkMode()
const store = useRentGooseStore()

const showManualModal = ref(false)
const showReconcileModal = ref(false)
const selectedType = ref('all')
const expandedCategory = ref<string | null>(null)
const showChartOfAccounts = ref(false)

const typeFilters = [
  { label: 'All', value: 'all' },
  { label: 'Rent In', value: 'rent_in' },
  { label: 'Held Rents', value: 'rent_held_in' },
  { label: 'Payouts', value: 'payout_out' },
  { label: 'Deposits', value: 'deposit' },
  { label: 'Holding Deposits', value: 'holding_deposit_in' },
  { label: 'Initial Monies', value: 'initial_monies_rent_in' },
  { label: 'Fees', value: 'invoice_fee_in' },
  { label: 'Manual', value: 'manual' },
]

const filteredEntries = computed(() => {
  const entries = store.clientAccount.entries
  if (selectedType.value === 'all') return entries
  if (selectedType.value === 'deposit') return entries.filter(e => e.entry_type.startsWith('deposit'))
  if (selectedType.value === 'manual') return entries.filter(e => e.is_manual)
  return entries.filter(e => e.entry_type === selectedType.value)
})

const rentHeld = computed(() => {
  const rentIn = store.clientAccount.entries.filter(e => e.entry_type === 'rent_in').reduce((s, e) => s + e.amount, 0)
  const payoutsOut = store.clientAccount.entries.filter(e => e.entry_type === 'payout_out').reduce((s, e) => s + e.amount, 0)
  return Math.max(0, rentIn - payoutsOut)
})

const depositsHeld = computed(() => {
  const depIn = store.clientAccount.entries.filter(e => e.entry_type === 'deposit_in' || e.entry_type === 'holding_deposit_in').reduce((s, e) => s + e.amount, 0)
  const depOut = store.clientAccount.entries.filter(e => e.entry_type === 'deposit_out').reduce((s, e) => s + e.amount, 0)
  return Math.max(0, depIn - depOut)
})

const lastUpdated = computed(() => {
  const entries = store.clientAccount.entries
  if (entries.length === 0) return 'Never'
  return formatDateTime(entries[0].created_at)
})

const accountCategories = computed(() => {
  const entries = store.clientAccount.entries
  const categories = [
    { type: 'rent', label: 'Rent Held', creditTypes: ['rent_in', 'initial_monies_rent_in'], debitTypes: ['payout_out'], dotClass: 'bg-emerald-500', amountClass: 'text-emerald-500' },
    { type: 'holding_deposit', label: 'Holding Deposits', creditTypes: ['holding_deposit_in'], debitTypes: [], dotClass: 'bg-purple-500', amountClass: 'text-purple-500' },
    { type: 'deposit', label: 'Security Deposits', creditTypes: ['deposit_in'], debitTypes: ['deposit_out'], dotClass: 'bg-blue-500', amountClass: 'text-blue-500' },
    { type: 'fees', label: 'Agent Fees', creditTypes: ['invoice_fee_in'], debitTypes: [], dotClass: 'bg-orange-500', amountClass: 'text-orange-500' },
    { type: 'contractor', label: 'Contractor Payouts', creditTypes: [], debitTypes: ['contractor_payout_out'], dotClass: 'bg-red-400', amountClass: 'text-red-400' },
    { type: 'manual', label: 'Manual / Opening', creditTypes: ['manual_credit', 'opening_balance'], debitTypes: ['manual_debit'], dotClass: 'bg-gray-400', amountClass: isDark.value ? 'text-slate-300' : 'text-gray-700' },
  ]

  return categories.map(cat => {
    const allTypes = [...cat.creditTypes, ...cat.debitTypes]
    const catEntries = entries.filter(e => allTypes.includes(e.entry_type))
    const credits = entries.filter(e => cat.creditTypes.includes(e.entry_type)).reduce((s, e) => s + e.amount, 0)
    const debits = entries.filter(e => cat.debitTypes.includes(e.entry_type)).reduce((s, e) => s + e.amount, 0)
    return {
      ...cat,
      types: allTypes,
      total: credits - debits,
      count: catEntries.length,
    }
  })
})

const highestBalanceType = computed(() => {
  let max = 0
  let maxType = ''
  for (const cat of accountCategories.value) {
    if (Math.abs(cat.total) > max) {
      max = Math.abs(cat.total)
      maxType = cat.type
    }
  }
  return maxType
})

function categoryBorderColor(type: string) {
  switch (type) {
    case 'rent': return '#22c55e'
    case 'holding_deposit': return '#8b5cf6'
    case 'deposit': return '#3b82f6'
    case 'fees': return '#f97316'
    case 'contractor': return '#dc2626'
    case 'manual': return '#9ca3af'
    default: return '#e5e7eb'
  }
}

const categoryEntries = computed(() => {
  if (!expandedCategory.value) return []
  const cat = accountCategories.value.find(c => c.type === expandedCategory.value)
  if (!cat) return []
  const allTypes = [...cat.creditTypes, ...cat.debitTypes]
  return store.clientAccount.entries.filter(e => allTypes.includes(e.entry_type))
})

function onSaved() {
  showManualModal.value = false
  showReconcileModal.value = false
  store.fetchClientAccount()
}

function isCredit(type: string) {
  return ['rent_in', 'rent_held_in', 'deposit_in', 'manual_credit', 'opening_balance', 'holding_deposit_in', 'initial_monies_rent_in', 'invoice_fee_in'].includes(type)
}

function typeClass(type: string) {
  switch (type) {
    case 'rent_in': case 'initial_monies_rent_in': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    case 'rent_held_in': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    case 'payout_out': case 'contractor_payout_out': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 'deposit_in': case 'holding_deposit_in': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    case 'deposit_out': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    case 'invoice_fee_in': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    case 'manual_credit': case 'manual_debit': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    case 'opening_balance': return 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300'
    default: return 'bg-gray-100 text-gray-500'
  }
}

const TYPE_LABELS: Record<string, string> = {
  rent_in: 'Rent In',
  rent_held_in: 'Held Rent',
  payout_out: 'Payout Out',
  contractor_payout_out: 'Contractor Payout',
  deposit_in: 'Deposit In',
  deposit_out: 'Deposit Out',
  holding_deposit_in: 'Holding Deposit',
  initial_monies_rent_in: 'Initial Monies',
  invoice_fee_in: 'Fee In',
  manual_credit: 'Manual Credit',
  manual_debit: 'Manual Debit',
  opening_balance: 'Opening Balance',
  reconciliation_checkpoint: 'Reconciliation',
}

function typeLabel(type: string) {
  return TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatMoney(val: number) {
  return (val || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDateTime(str: string) {
  if (!str) return ''
  return new Date(str).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function exportCSV() {
  const csv = 'Date,Type,Description,Reference,Credit,Debit,Balance\n' + store.clientAccount.entries.map(e =>
    `"${formatDateTime(e.created_at)}","${e.entry_type}","${e.description}","${e.reference || ''}",${isCredit(e.entry_type) ? e.amount : ''},${!isCredit(e.entry_type) ? e.amount : ''},${e.balance_after}`
  ).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `client-account-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(() => {
  store.fetchClientAccount()
})
</script>

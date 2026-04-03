<template>
  <div>
    <!-- Summary bar -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div :class="['rounded-xl p-4 border-2 border-primary/20', isDark ? 'bg-slate-800' : 'bg-primary/5']">
        <p :class="['text-xs font-medium uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-gray-500']">Current Balance</p>
        <p class="text-2xl font-bold text-primary mt-1">&pound;{{ formatMoney(store.clientAccount.current_balance) }}</p>
      </div>
      <div :class="['rounded-xl p-4 border', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200']">
        <p :class="['text-xs font-medium uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-gray-500']">Rent Held</p>
        <p class="text-2xl font-bold text-emerald-500 mt-1">&pound;{{ formatMoney(rentHeld) }}</p>
      </div>
      <div :class="['rounded-xl p-4 border', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200']">
        <p :class="['text-xs font-medium uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-gray-500']">Deposits Held</p>
        <p class="text-2xl font-bold text-blue-500 mt-1">&pound;{{ formatMoney(depositsHeld) }}</p>
      </div>
      <div :class="['rounded-xl p-4 border', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200']">
        <p :class="['text-xs font-medium uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-gray-500']">Last Updated</p>
        <p class="text-sm font-medium mt-2">{{ lastUpdated }}</p>
      </div>
    </div>

    <!-- Chart of Accounts -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold" :class="isDark ? 'text-slate-300' : 'text-gray-700'">Chart of Accounts</h3>
        <button
          v-if="expandedCategory"
          @click="expandedCategory = null"
          class="text-xs text-primary hover:underline"
        >Back to overview</button>
      </div>

      <!-- Category cards -->
      <div v-if="!expandedCategory" class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          v-for="cat in accountCategories"
          :key="cat.type"
          @click="expandedCategory = cat.type"
          :class="['rounded-xl p-3 border text-left transition-all hover:shadow-md', isDark ? 'bg-slate-800 border-slate-700 hover:border-slate-500' : 'bg-white border-gray-200 hover:border-gray-400']"
        >
          <div class="flex items-center gap-2 mb-1">
            <span :class="['w-2.5 h-2.5 rounded-full', cat.dotClass]"></span>
            <span :class="['text-xs font-medium uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-gray-500']">{{ cat.label }}</span>
          </div>
          <p :class="['text-lg font-bold', cat.amountClass]">&pound;{{ formatMoney(cat.total) }}</p>
          <p :class="['text-xs mt-0.5', isDark ? 'text-slate-500' : 'text-gray-400']">{{ cat.count }} entr{{ cat.count === 1 ? 'y' : 'ies' }}</p>
        </button>
      </div>

      <!-- Expanded category detail table -->
      <div v-else>
        <div :class="['rounded-xl border overflow-hidden', isDark ? 'border-slate-700' : 'border-gray-200']">
          <div :class="['px-4 py-2 text-sm font-semibold', isDark ? 'bg-slate-800 text-slate-300' : 'bg-gray-50 text-gray-700']">
            {{ accountCategories.find(c => c.type === expandedCategory)?.label }} — {{ categoryEntries.length }} entries
          </div>
          <table class="w-full">
            <thead>
              <tr :class="isDark ? 'bg-slate-800/50' : 'bg-gray-50/50'">
                <th class="px-4 py-2 text-left text-xs uppercase" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Date</th>
                <th class="px-4 py-2 text-left text-xs uppercase" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Description</th>
                <th class="px-4 py-2 text-left text-xs uppercase" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Reference</th>
                <th class="px-4 py-2 text-right text-xs uppercase" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="e in categoryEntries" :key="e.id" :class="['border-t', isDark ? 'border-slate-700' : 'border-gray-100']">
                <td class="px-4 py-2 text-sm">{{ formatDateTime(e.created_at) }}</td>
                <td class="px-4 py-2 text-sm">{{ e.description }}</td>
                <td class="px-4 py-2 text-sm" :class="isDark ? 'text-slate-400' : 'text-gray-500'">{{ e.reference || '—' }}</td>
                <td :class="['px-4 py-2 text-sm text-right font-medium', isCredit(e.entry_type) ? 'text-emerald-500' : 'text-red-500']">
                  {{ isCredit(e.entry_type) ? '' : '-' }}&pound;{{ formatMoney(e.amount) }}
                </td>
              </tr>
              <tr v-if="categoryEntries.length === 0">
                <td colspan="4" class="px-4 py-8 text-center text-sm" :class="isDark ? 'text-slate-500' : 'text-gray-400'">No entries in this category.</td>
              </tr>
            </tbody>
            <tfoot v-if="categoryEntries.length > 0">
              <tr :class="['border-t-2 font-medium', isDark ? 'border-slate-600' : 'border-gray-300']">
                <td colspan="3" class="px-4 py-2 text-sm font-semibold">Total</td>
                <td class="px-4 py-2 text-sm text-right font-bold">&pound;{{ formatMoney(categoryEntries.reduce((s, e) => s + (isCredit(e.entry_type) ? e.amount : -e.amount), 0)) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex gap-3 mb-6">
      <button @click="showManualModal = true" class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-orange-600 rounded-lg transition-colors">Add Manual Entry</button>
      <button @click="showReconcileModal = true" :class="['px-4 py-2 text-sm font-medium rounded-lg border transition-colors', isDark ? 'border-slate-600 hover:bg-slate-800' : 'border-gray-300 hover:bg-gray-50']">Reconcile</button>
      <button @click="exportCSV" :class="['px-4 py-2 text-sm font-medium rounded-lg border transition-colors', isDark ? 'border-slate-600 hover:bg-slate-800' : 'border-gray-300 hover:bg-gray-50']">Export CSV</button>
    </div>

    <!-- Filter by type -->
    <div class="flex gap-2 mb-4 flex-wrap">
      <button
        v-for="filter in typeFilters"
        :key="filter.value"
        @click="selectedType = filter.value"
        :class="[
          'px-3 py-1.5 text-xs font-medium rounded-full transition-all',
          selectedType === filter.value
            ? 'bg-primary text-white'
            : isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        ]"
      >{{ filter.label }}</button>
    </div>

    <!-- Ledger table -->
    <div :class="['rounded-xl border overflow-hidden', isDark ? 'border-slate-700' : 'border-gray-200']">
      <table class="w-full">
        <thead>
          <tr :class="isDark ? 'bg-slate-800' : 'bg-gray-50'">
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Date/Time</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Type</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Description</th>
            <th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Credit</th>
            <th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Debit</th>
            <th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="entry in filteredEntries"
            :key="entry.id"
            :class="['border-t', isDark ? 'border-slate-700' : 'border-gray-100']"
          >
            <td class="px-4 py-3 text-sm" :class="isDark ? 'text-slate-300' : 'text-gray-700'">{{ formatDateTime(entry.created_at) }}</td>
            <td class="px-4 py-3">
              <span :class="['px-2 py-0.5 text-xs font-medium rounded-full', typeClass(entry.entry_type)]">
                {{ typeLabel(entry.entry_type) }}
              </span>
              <span v-if="entry.is_manual" class="ml-1 text-xs text-purple-500">M</span>
            </td>
            <td class="px-4 py-3 text-sm">{{ entry.description }}</td>
            <td class="px-4 py-3 text-sm text-right font-medium text-emerald-500">
              {{ isCredit(entry.entry_type) ? `£${formatMoney(entry.amount)}` : '' }}
            </td>
            <td class="px-4 py-3 text-sm text-right font-medium text-red-500">
              {{ !isCredit(entry.entry_type) ? `£${formatMoney(entry.amount)}` : '' }}
            </td>
            <td class="px-4 py-3 text-sm text-right font-bold">&pound;{{ formatMoney(entry.balance_after) }}</td>
          </tr>
          <tr v-if="filteredEntries.length === 0">
            <td colspan="6" class="px-4 py-12 text-center" :class="isDark ? 'text-slate-400' : 'text-gray-400'">
              No entries found. Add an opening balance to get started.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

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

const typeFilters = [
  { label: 'All', value: 'all' },
  { label: 'Rent In', value: 'rent_in' },
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
  return ['rent_in', 'deposit_in', 'manual_credit', 'opening_balance', 'holding_deposit_in', 'initial_monies_rent_in', 'invoice_fee_in'].includes(type)
}

function typeClass(type: string) {
  switch (type) {
    case 'rent_in': case 'initial_monies_rent_in': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    case 'payout_out': case 'contractor_payout_out': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 'deposit_in': case 'holding_deposit_in': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    case 'deposit_out': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    case 'invoice_fee_in': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    case 'manual_credit': case 'manual_debit': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    case 'opening_balance': return 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300'
    default: return 'bg-gray-100 text-gray-500'
  }
}

function typeLabel(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
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

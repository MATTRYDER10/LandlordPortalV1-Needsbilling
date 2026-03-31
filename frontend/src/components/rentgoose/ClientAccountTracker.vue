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

const typeFilters = [
  { label: 'All', value: 'all' },
  { label: 'Rent In', value: 'rent_in' },
  { label: 'Payouts', value: 'payout_out' },
  { label: 'Deposits', value: 'deposit' },
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
  const depIn = store.clientAccount.entries.filter(e => e.entry_type === 'deposit_in').reduce((s, e) => s + e.amount, 0)
  const depOut = store.clientAccount.entries.filter(e => e.entry_type === 'deposit_out').reduce((s, e) => s + e.amount, 0)
  return Math.max(0, depIn - depOut)
})

const lastUpdated = computed(() => {
  const entries = store.clientAccount.entries
  if (entries.length === 0) return 'Never'
  return formatDateTime(entries[0].created_at)
})

function onSaved() {
  showManualModal.value = false
  showReconcileModal.value = false
  store.fetchClientAccount()
}

function isCredit(type: string) {
  return ['rent_in', 'deposit_in', 'manual_credit', 'opening_balance'].includes(type)
}

function typeClass(type: string) {
  switch (type) {
    case 'rent_in': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    case 'payout_out': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 'contractor_payout_out': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 'deposit_in': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    case 'deposit_out': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
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

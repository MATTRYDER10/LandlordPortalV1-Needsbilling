<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-lg font-semibold">Fee Ledger</h2>
      <div class="flex items-center gap-3">
        <div class="flex gap-1">
          <button
            v-for="p in periods"
            :key="p.id"
            @click="setPeriod(p.id)"
            :class="[
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              activePeriod === p.id
                ? 'bg-primary text-white'
                : isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-gray-500 hover:bg-gray-100'
            ]"
          >{{ p.name }}</button>
        </div>
        <div v-if="activePeriod === 'custom'" class="flex items-center gap-2">
          <input v-model="customFrom" type="date" :class="['px-2 py-1.5 text-xs border rounded-md', isDark ? 'border-slate-600 bg-slate-800 text-white' : 'border-gray-300']" />
          <span class="text-xs" :class="isDark ? 'text-slate-400' : 'text-gray-500'">to</span>
          <input v-model="customTo" type="date" :class="['px-2 py-1.5 text-xs border rounded-md', isDark ? 'border-slate-600 bg-slate-800 text-white' : 'border-gray-300']" />
          <button @click="fetchWithDates" class="px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-md">Go</button>
        </div>
        <button @click="exportCSV" class="px-4 py-2 text-sm font-medium rounded-lg border transition-colors" :class="isDark ? 'border-slate-600 hover:bg-slate-800' : 'border-gray-300 hover:bg-gray-50'">
          Export CSV
        </button>
      </div>
    </div>

    <!-- Summary cards -->
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div :class="['rounded-xl p-4 border', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200']">
        <p :class="['text-xs font-bold uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-gray-500']">Paid</p>
        <p class="text-2xl font-bold text-emerald-500 mt-1">&pound;{{ formatMoney(data?.summary.total_paid || 0) }}</p>
      </div>
      <div :class="['rounded-xl p-4 border', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200']">
        <p :class="['text-xs font-bold uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-gray-500']">Due</p>
        <p class="text-2xl font-bold text-amber-500 mt-1">&pound;{{ formatMoney(data?.summary.total_due || 0) }}</p>
      </div>
      <div :class="['rounded-xl p-4 border-2 border-primary/20', isDark ? 'bg-slate-800' : 'bg-primary/5']">
        <p :class="['text-xs font-bold uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-gray-500']">Total</p>
        <p class="text-2xl font-bold text-primary mt-1">&pound;{{ formatMoney(data?.summary.grand_total || 0) }}</p>
      </div>
    </div>

    <!-- Type filter pills -->
    <div class="flex gap-2 mb-4 flex-wrap">
      <button
        v-for="f in typeFilters"
        :key="f.value"
        @click="selectedType = f.value"
        :class="[
          'px-3 py-1.5 text-xs font-medium rounded-full transition-all',
          selectedType === f.value
            ? 'bg-primary text-white'
            : isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        ]"
      >{{ f.label }}</button>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <div v-else-if="filteredFees.length === 0" class="text-center py-12" :class="isDark ? 'text-slate-400' : 'text-gray-400'">
      No agent fees recorded for this period.
    </div>

    <!-- Fees table -->
    <div v-else :class="['rounded-xl border overflow-hidden', isDark ? 'border-slate-700' : 'border-gray-200']">
      <table class="w-full">
        <thead>
          <tr :class="isDark ? 'bg-slate-800' : 'bg-gray-50'">
            <th class="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Date</th>
            <th class="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Type</th>
            <th class="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Description</th>
            <th class="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Net</th>
            <th class="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide" :class="isDark ? 'text-slate-400' : 'text-gray-500'">VAT</th>
            <th class="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Gross</th>
            <th class="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="fee in filteredFees"
            :key="fee.id"
            :class="['border-t', isDark ? 'border-slate-700' : 'border-gray-100']"
          >
            <td class="px-4 py-3 text-sm" :class="isDark ? 'text-slate-300' : 'text-gray-700'">{{ formatDate(fee.date) }}</td>
            <td class="px-4 py-3">
              <span :class="['px-2 py-0.5 text-xs font-medium rounded-full', feeTypeBadge(fee.fee_type)]">{{ feeTypeLabel(fee.fee_type) }}</span>
            </td>
            <td class="px-4 py-3 text-sm">{{ fee.description }}</td>
            <td class="px-4 py-3 text-sm text-right">&pound;{{ formatMoney(fee.net_amount) }}</td>
            <td class="px-4 py-3 text-sm text-right" :class="isDark ? 'text-slate-400' : 'text-gray-500'">&pound;{{ formatMoney(fee.vat_amount) }}</td>
            <td class="px-4 py-3 text-sm text-right font-medium">&pound;{{ formatMoney(fee.gross_amount) }}</td>
            <td class="px-4 py-3 text-center">
              <span :class="['px-2 py-0.5 text-xs font-medium rounded-full', fee.status === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400']">
                {{ fee.status === 'paid' ? 'Paid' : 'Due' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDarkMode } from '../../composables/useDarkMode'
import { useApi } from '../../composables/useApi'

const { isDark } = useDarkMode()
const { get } = useApi()

const loading = ref(false)
const data = ref<any>(null)
const activePeriod = ref('month')
const customFrom = ref('')
const customTo = ref('')
const selectedType = ref('all')

const periods = [
  { id: 'today', name: 'Today' },
  { id: 'week', name: 'This Week' },
  { id: 'month', name: 'This Month' },
  { id: '3month', name: '3 Months' },
  { id: '6month', name: '6 Months' },
  { id: '12month', name: '12 Months' },
  { id: 'custom', name: 'Custom' },
]

const typeFilters = [
  { label: 'All', value: 'all' },
  { label: 'Management', value: 'management_fee' },
  { label: 'Letting', value: 'letting_fee' },
  { label: 'Change Fees', value: 'tenant_change_fee' },
  { label: 'Date Change', value: 'rent_change_fee' },
  { label: 'Ad Hoc', value: 'ad_hoc' },
]

const filteredFees = computed(() => {
  if (!data.value?.fees) return []
  if (selectedType.value === 'all') return data.value.fees
  return data.value.fees.filter((f: any) => f.fee_type === selectedType.value)
})

function getDateRange(period: string): { from: string; to: string } {
  const now = new Date()
  const to = now.toISOString().split('T')[0]
  let from: Date
  switch (period) {
    case 'today': from = new Date(now); break
    case 'week': from = new Date(now); from.setDate(from.getDate() - 7); break
    case 'month': from = new Date(now); from.setMonth(from.getMonth() - 1); break
    case '3month': from = new Date(now); from.setMonth(from.getMonth() - 3); break
    case '6month': from = new Date(now); from.setMonth(from.getMonth() - 6); break
    case '12month': from = new Date(now); from.setMonth(from.getMonth() - 12); break
    default: from = new Date(now); from.setMonth(from.getMonth() - 1)
  }
  return { from: from.toISOString().split('T')[0], to }
}

async function fetchFees(fromDate?: string, toDate?: string) {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    data.value = await get<any>(`/api/rentgoose/fees?${params.toString()}`)
  } catch (err) {
    console.error('Failed to fetch agent fees:', err)
  } finally {
    loading.value = false
  }
}

function setPeriod(period: string) {
  activePeriod.value = period
  if (period === 'custom') return
  const { from, to } = getDateRange(period)
  fetchFees(from, to)
}

function fetchWithDates() {
  if (customFrom.value && customTo.value) fetchFees(customFrom.value, customTo.value)
}

function feeTypeBadge(type: string) {
  switch (type) {
    case 'management_fee': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    case 'letting_fee': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    case 'tenant_change_fee': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    case 'rent_change_fee': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    case 'ad_hoc': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    default: return 'bg-gray-100 text-gray-500'
  }
}

function feeTypeLabel(type: string) {
  switch (type) {
    case 'management_fee': return 'Management'
    case 'letting_fee': return 'Letting'
    case 'tenant_change_fee': return 'Change Fee'
    case 'rent_change_fee': return 'Date Change'
    case 'contractor_commission': return 'Commission'
    case 'ad_hoc': return 'Ad Hoc'
    default: return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }
}

function formatMoney(val: number) {
  return (val || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(str: string) {
  if (!str) return ''
  return new Date(str).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function exportCSV() {
  if (!data.value?.fees) return
  const csv = 'Date,Type,Description,Net,VAT,Gross,Status\n' + data.value.fees.map((f: any) =>
    `"${formatDate(f.date)}","${f.fee_type}","${f.description}",${f.net_amount},${f.vat_amount},${f.gross_amount},"${f.status}"`
  ).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `fee-ledger-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(() => {
  const { from, to } = getDateRange('month')
  fetchFees(from, to)
})
</script>

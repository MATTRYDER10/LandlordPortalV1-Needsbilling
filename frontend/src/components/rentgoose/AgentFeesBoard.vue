<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-[15px] font-semibold text-primary">Fee Ledger</h2>
      <div class="flex items-center gap-3">
        <div class="flex gap-1">
          <button
            v-for="p in periods"
            :key="p.id"
            @click="setPeriod(p.id)"
            :class="[
              'rounded-full text-[13px] px-3.5 py-1 font-medium transition-colors',
              activePeriod === p.id
                ? 'bg-gray-800 text-white'
                : isDark ? 'text-slate-400 hover:bg-slate-800' : 'bg-gray-100 text-gray-500'
            ]"
          >{{ p.name }}</button>
        </div>
        <div v-if="activePeriod === 'custom'" class="flex items-center gap-2">
          <input v-model="customFrom" type="date" :class="['px-2 py-1.5 text-xs border rounded-md', isDark ? 'border-slate-600 bg-slate-800 text-white' : 'border-gray-300']" />
          <span class="text-xs" :class="isDark ? 'text-slate-400' : 'text-gray-500'">to</span>
          <input v-model="customTo" type="date" :class="['px-2 py-1.5 text-xs border rounded-md', isDark ? 'border-slate-600 bg-slate-800 text-white' : 'border-gray-300']" />
          <button @click="fetchWithDates" class="bg-[#f97316] hover:bg-[#ea6d10] text-white rounded-lg font-semibold px-3.5 py-1.5 text-xs transition-colors">Go</button>
        </div>
        <button @click="exportCSV" class="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg px-3.5 py-2 text-[13px] font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
          Export CSV
        </button>
      </div>
    </div>

    <!-- Summary cards -->
    <div class="grid grid-cols-3 gap-4 mb-6">
      <!-- Total = PRIMARY -->
      <div class="bg-[#fff7ed] dark:bg-orange-950/30 border border-gray-200 dark:border-slate-700 border-l-[3px] border-l-[#f97316] rounded-[10px] px-5 py-4">
        <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold">Total</p>
        <p class="text-[22px] font-bold text-gray-900 dark:text-white mt-1">&pound;{{ formatMoney(data?.summary.grand_total || 0) }}</p>
      </div>
      <!-- Paid = green accent -->
      <div class="bg-[#f0fdf4] dark:bg-green-950/30 border border-gray-200 dark:border-slate-700 border-l-[3px] border-l-[#22c55e] rounded-[10px] px-5 py-4">
        <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold">Paid</p>
        <p class="text-[22px] font-bold text-gray-900 dark:text-white mt-1">&pound;{{ formatMoney(data?.summary.total_paid || 0) }}</p>
      </div>
      <!-- Due = amber accent if > 0, neutral if 0 -->
      <div :class="[
        'rounded-[10px] px-5 py-4 border',
        (data?.summary.total_due || 0) > 0
          ? 'bg-[#fff7ed] dark:bg-orange-950/30 border-l-[3px] border-l-[#f97316] border-gray-200 dark:border-slate-700'
          : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'
      ]">
        <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold">Due</p>
        <p class="text-[22px] font-bold text-gray-900 dark:text-white mt-1">&pound;{{ formatMoney(data?.summary.total_due || 0) }}</p>
      </div>
    </div>

    <!-- Type filter pills -->
    <div class="flex gap-2 mb-4 flex-wrap">
      <button
        v-for="f in typeFilters"
        :key="f.value"
        @click="selectedType = f.value"
        :class="[
          'rounded-full text-[13px] px-3.5 py-1 font-medium transition-all',
          selectedType === f.value
            ? 'bg-gray-800 text-white'
            : isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-gray-100 text-gray-500'
        ]"
      >{{ f.label }}</button>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <div v-else-if="filteredFees.length === 0" class="flex flex-col items-center justify-center py-16">
      <svg class="w-10 h-10 text-gray-300 dark:text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" /></svg>
      <p class="text-[15px] font-semibold text-gray-700 dark:text-white">No agent fees recorded</p>
      <p class="text-[13px] text-gray-500 dark:text-slate-400 max-w-[320px] text-center mt-1">Agent fees will appear here once rent has been collected and management fees calculated.</p>
    </div>

    <!-- Fees table -->
    <div v-else :class="['rounded-[10px] border overflow-hidden', isDark ? 'border-slate-700' : 'border-gray-200']">
      <table class="w-full">
        <thead>
          <tr :class="isDark ? 'bg-slate-800' : 'bg-gray-50'">
            <th class="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Date</th>
            <th class="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Type</th>
            <th class="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Description</th>
            <th class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Net</th>
            <th class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">VAT</th>
            <th class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Gross</th>
            <th class="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(fee, idx) in filteredFees"
            :key="fee.id"
            :class="['border-b border-[#f3f4f6] dark:border-slate-700 min-h-[52px] transition-colors hover:bg-[#fff7ed] dark:hover:bg-slate-700/50', idx % 2 === 1 ? 'bg-[#f9fafb] dark:bg-slate-800/50' : '']"
          >
            <td class="px-4 py-3 text-sm" :class="isDark ? 'text-slate-300' : 'text-gray-700'">{{ formatDate(fee.date) }}</td>
            <td class="px-4 py-3">
              <span :class="['px-2 py-0.5 text-xs font-medium rounded-full', feeTypeBadge(fee.fee_type)]">{{ feeTypeLabel(fee.fee_type) }}</span>
            </td>
            <td class="px-4 py-3 text-sm">{{ fee.description }}</td>
            <td class="px-4 py-3 text-sm text-right font-medium tabular-nums">&pound;{{ formatMoney(fee.net_amount) }}</td>
            <td class="px-4 py-3 text-right text-xs italic text-gray-400 dark:text-slate-500 tabular-nums">&pound;{{ formatMoney(fee.vat_amount) }}</td>
            <td class="px-4 py-3 text-sm text-right font-medium tabular-nums">&pound;{{ formatMoney(fee.gross_amount) }}</td>
            <td class="px-4 py-3 text-center">
              <span :class="['px-2.5 py-0.5 text-xs font-medium rounded-full', fee.status === 'paid' ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fef3c7] text-[#b45309]']">
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
    case 'management_fee': return 'bg-[#eff6ff] text-[#1d4ed8]'
    case 'letting_fee': return 'bg-[#eff6ff] text-[#1d4ed8]'
    case 'tenant_change_fee': return 'bg-[#eff6ff] text-[#1d4ed8]'
    case 'rent_change_fee': return 'bg-[#eff6ff] text-[#1d4ed8]'
    case 'ad_hoc': return 'bg-[#eff6ff] text-[#1d4ed8]'
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

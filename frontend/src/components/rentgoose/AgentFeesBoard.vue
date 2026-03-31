<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-lg font-semibold">Fee Ledger</h2>
      <div class="flex items-center gap-3">
        <!-- Period filter -->
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

        <!-- Custom date range -->
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

    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <div v-else-if="fees" class="space-y-6">
      <!-- Management Fees -->
      <FeeGroup title="Management Fees" :items="fees.management_fees" :isDark="isDark" />

      <!-- Letting / Setup Fees -->
      <FeeGroup v-if="fees.letting_fees.length > 0" title="Letting / Setup Fees" :items="fees.letting_fees" :isDark="isDark" />

      <!-- Contractor Commission -->
      <FeeGroup v-if="fees.contractor_commissions.length > 0" title="Contractor Commission" :items="fees.contractor_commissions" :isDark="isDark" />

      <!-- Ad Hoc Charges -->
      <FeeGroup v-if="fees.ad_hoc_charges.length > 0" title="Ad Hoc Charges" :items="fees.ad_hoc_charges" :isDark="isDark" />

      <!-- Grand Total -->
      <div :class="['rounded-xl p-5 border-2', isDark ? 'bg-slate-800 border-primary/30' : 'bg-primary/5 border-primary/20']">
        <div class="flex justify-between items-center">
          <span class="text-lg font-semibold">Grand Total — Agency Income</span>
          <span class="text-2xl font-bold text-primary">&pound;{{ formatMoney(fees.grand_total) }}</span>
        </div>
      </div>
    </div>

    <div v-else class="text-center py-12" :class="isDark ? 'text-slate-400' : 'text-gray-400'">
      No agent fees recorded for this period.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import { useDarkMode } from '../../composables/useDarkMode'
import { useApi } from '../../composables/useApi'

const { isDark } = useDarkMode()
const { get } = useApi()

const loading = ref(false)
const fees = ref<any>(null)
const activePeriod = ref('month')
const customFrom = ref('')
const customTo = ref('')

const periods = [
  { id: 'today', name: 'Today' },
  { id: 'week', name: 'This Week' },
  { id: 'month', name: 'This Month' },
  { id: '3month', name: '3 Months' },
  { id: '6month', name: '6 Months' },
  { id: '12month', name: '12 Months' },
  { id: 'custom', name: 'Custom' },
]

function getDateRange(period: string): { from: string; to: string } {
  const now = new Date()
  const to = now.toISOString().split('T')[0]
  let from: Date

  switch (period) {
    case 'today':
      from = new Date(now); break
    case 'week':
      from = new Date(now); from.setDate(from.getDate() - 7); break
    case 'month':
      from = new Date(now); from.setMonth(from.getMonth() - 1); break
    case '3month':
      from = new Date(now); from.setMonth(from.getMonth() - 3); break
    case '6month':
      from = new Date(now); from.setMonth(from.getMonth() - 6); break
    case '12month':
      from = new Date(now); from.setMonth(from.getMonth() - 12); break
    default:
      from = new Date(now); from.setMonth(from.getMonth() - 1)
  }

  return { from: from.toISOString().split('T')[0], to }
}

async function fetchFees(fromDate?: string, toDate?: string) {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    const data = await get<any>(`/api/rentgoose/fees?${params.toString()}`)
    fees.value = data
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
  if (customFrom.value && customTo.value) {
    fetchFees(customFrom.value, customTo.value)
  }
}

// Simple inline FeeGroup component
const FeeGroup = {
  props: ['title', 'items', 'isDark'],
  setup(props: any) {
    const subtotal = computed(() => props.items.reduce((s: number, i: any) => s + i.gross_amount, 0))
    return () => h('div', { class: `rounded-xl border overflow-hidden ${props.isDark ? 'border-slate-700' : 'border-gray-200'}` }, [
      h('div', { class: `px-5 py-3 font-medium text-sm ${props.isDark ? 'bg-slate-800 text-slate-300' : 'bg-gray-50 text-gray-700'}` }, props.title),
      h('table', { class: 'w-full' }, [
        h('thead', [
          h('tr', { class: props.isDark ? 'bg-slate-800/50' : 'bg-gray-50/50' }, [
            h('th', { class: `px-5 py-2 text-left text-xs uppercase tracking-wide ${props.isDark ? 'text-slate-400' : 'text-gray-500'}` }, 'Description'),
            h('th', { class: `px-5 py-2 text-right text-xs uppercase tracking-wide ${props.isDark ? 'text-slate-400' : 'text-gray-500'}` }, 'Net'),
            h('th', { class: `px-5 py-2 text-right text-xs uppercase tracking-wide ${props.isDark ? 'text-slate-400' : 'text-gray-500'}` }, 'VAT'),
            h('th', { class: `px-5 py-2 text-right text-xs uppercase tracking-wide ${props.isDark ? 'text-slate-400' : 'text-gray-500'}` }, 'Gross'),
          ])
        ]),
        h('tbody', props.items.map((item: any) =>
          h('tr', { key: item.id, class: `border-t ${props.isDark ? 'border-slate-700' : 'border-gray-100'}` }, [
            h('td', { class: 'px-5 py-3 text-sm' }, item.description),
            h('td', { class: 'px-5 py-3 text-sm text-right' }, `£${item.net_amount.toFixed(2)}`),
            h('td', { class: 'px-5 py-3 text-sm text-right' }, `£${item.vat_amount.toFixed(2)}`),
            h('td', { class: 'px-5 py-3 text-sm text-right font-medium' }, `£${item.gross_amount.toFixed(2)}`),
          ])
        )),
        h('tfoot', [
          h('tr', { class: `border-t font-medium ${props.isDark ? 'border-slate-600 bg-slate-800/30' : 'border-gray-200 bg-gray-50/30'}` }, [
            h('td', { class: 'px-5 py-3 text-sm', colspan: 3 }, 'Subtotal'),
            h('td', { class: 'px-5 py-3 text-sm text-right font-bold' }, `£${subtotal.value.toFixed(2)}`),
          ])
        ])
      ])
    ])
  }
}

function exportCSV() {
  if (!fees.value) return
  const allItems = [
    ...fees.value.management_fees,
    ...fees.value.letting_fees,
    ...fees.value.contractor_commissions,
    ...fees.value.ad_hoc_charges,
  ]
  const csv = 'Type,Description,Net,VAT,Gross\n' + allItems.map((i: any) =>
    `"${i.charge_type}","${i.description}",${i.net_amount},${i.vat_amount},${i.gross_amount}`
  ).join('\n')

  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `fee-ledger-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function formatMoney(val: number) {
  return (val || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

onMounted(() => {
  const { from, to } = getDateRange('month')
  fetchFees(from, to)
})
</script>

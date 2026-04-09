<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="$emit('close')"></div>
      <div :class="['relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl', isDark ? 'bg-slate-900' : 'bg-white']">
        <!-- Header -->
        <div :class="['px-6 py-4 border-b flex items-center justify-between', isDark ? 'border-slate-700' : 'border-gray-200']">
          <div>
            <h2 :class="['text-lg font-semibold', isDark ? 'text-white' : 'text-gray-900']">Payment History</h2>
            <p :class="['text-sm', isDark ? 'text-slate-400' : 'text-gray-500']">{{ entry.property_address }}, {{ entry.property_postcode }} — {{ entry.tenant_names }}</p>
          </div>
          <button @click="$emit('close')" :class="['p-1 rounded-lg', isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-gray-100 text-gray-500']">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-6">
          <div v-if="loading" class="text-center py-8">
            <p :class="['text-sm', isDark ? 'text-slate-400' : 'text-gray-500']">Loading history...</p>
          </div>

          <template v-else>
            <!-- Rent History Table -->
            <div :class="['rounded-xl border overflow-hidden', isDark ? 'border-slate-700' : 'border-gray-200']">
              <table class="w-full text-sm">
                <thead>
                  <tr :class="isDark ? 'bg-slate-800' : 'bg-gray-50'">
                    <th :class="['text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-gray-500']">Period</th>
                    <th :class="['text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-gray-500']">Due</th>
                    <th :class="['text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-gray-500']">Received</th>
                    <th :class="['text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-gray-500']">Status</th>
                    <th :class="['text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-gray-500']">Credit</th>
                    <th :class="['text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-gray-500']">Actions</th>
                  </tr>
                </thead>
                <tbody :class="isDark ? 'divide-slate-700' : 'divide-gray-200'" class="divide-y">
                  <tr v-for="row in history" :key="row.id" :class="isDark ? 'hover:bg-slate-800' : 'hover:bg-gray-50'">
                    <td :class="['px-4 py-3', isDark ? 'text-slate-200' : 'text-gray-900']">
                      {{ formatPeriod(row.period_start, row.period_end) }}
                    </td>
                    <td :class="['px-4 py-3 text-right font-medium', isDark ? 'text-white' : 'text-gray-900']">
                      &pound;{{ formatMoney(row.amount_due) }}
                    </td>
                    <td :class="['px-4 py-3 text-right font-medium', row.amount_received > 0 ? 'text-emerald-500' : (isDark ? 'text-slate-500' : 'text-gray-400')]">
                      &pound;{{ formatMoney(row.amount_received) }}
                    </td>
                    <td class="px-4 py-3 text-center">
                      <span :class="statusBadgeClass(row.status)">{{ statusLabel(row.status) }}</span>
                    </td>
                    <td :class="['px-4 py-3 text-right', isDark ? 'text-slate-400' : 'text-gray-500']">
                      <template v-if="row.rent_credit_amount > 0">
                        <span class="text-amber-500 font-medium">-&pound;{{ formatMoney(row.rent_credit_amount) }}</span>
                        <span v-if="row.rent_credit_reason" :class="['block text-xs', isDark ? 'text-slate-500' : 'text-gray-400']">{{ row.rent_credit_reason }}</span>
                      </template>
                      <span v-else>—</span>
                    </td>
                    <td class="px-4 py-3 text-right">
                      <button
                        v-if="row.status !== 'paid' && row.status !== 'cancelled'"
                        @click="openCreditForm(row)"
                        class="text-xs text-primary hover:underline"
                      >
                        Add Credit
                      </button>
                    </td>
                  </tr>
                  <tr v-if="history.length === 0">
                    <td colspan="6" :class="['px-4 py-8 text-center', isDark ? 'text-slate-500' : 'text-gray-400']">
                      No rent history found
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Payment details expansion (per entry) -->
            <div v-for="row in history.filter(r => r.payments && r.payments.length > 0)" :key="'pay-' + row.id" class="mt-3">
              <div :class="['rounded-lg border px-4 py-2', isDark ? 'border-slate-700 bg-slate-800/50' : 'border-gray-100 bg-gray-50']">
                <p :class="['text-xs font-medium mb-1', isDark ? 'text-slate-400' : 'text-gray-500']">Payments for {{ formatPeriod(row.period_start, row.period_end) }}</p>
                <div v-for="p in row.payments" :key="p.id" class="flex justify-between text-xs py-1">
                  <span :class="isDark ? 'text-slate-300' : 'text-gray-600'">{{ p.date_received }} — {{ p.payment_method.replace('_', ' ') }}</span>
                  <span :class="['font-medium', isDark ? 'text-white' : 'text-gray-900']">&pound;{{ formatMoney(p.amount) }}</span>
                </div>
              </div>
            </div>

            <!-- Credit Form -->
            <div v-if="creditEntry" :class="['mt-4 rounded-xl border p-4', isDark ? 'bg-slate-800 border-slate-700' : 'bg-amber-50 border-amber-200']">
              <h3 :class="['text-sm font-semibold mb-3', isDark ? 'text-white' : 'text-gray-900']">
                Add Rent Credit — {{ formatPeriod(creditEntry.period_start, creditEntry.period_end) }}
              </h3>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label :class="labelClass">Credit Amount</label>
                  <div class="flex items-center gap-1">
                    <span :class="['text-sm', isDark ? 'text-slate-500' : 'text-gray-400']">£</span>
                    <input
                      v-model.number="creditAmount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      :max="creditEntry.amount_due"
                      :class="inputClass"
                      class="flex-1"
                    />
                  </div>
                </div>
                <div>
                  <label :class="labelClass">Reason</label>
                  <input v-model="creditReason" type="text" :class="inputClass" class="w-full" placeholder="e.g. Repair deduction" />
                </div>
              </div>
              <div class="flex justify-end gap-2 mt-3">
                <button @click="creditEntry = null" :class="['px-3 py-1.5 text-xs font-medium rounded-lg', isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200']">Cancel</button>
                <button
                  @click="applyCredit"
                  :disabled="!creditAmount || creditAmount <= 0 || !creditReason || applyingCredit"
                  class="px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-orange-600 rounded-lg disabled:opacity-50"
                >
                  {{ applyingCredit ? 'Applying...' : 'Apply Credit' }}
                </button>
              </div>
            </div>
          </template>
        </div>

        <!-- Footer -->
        <div :class="['px-6 py-4 border-t flex justify-end', isDark ? 'border-slate-700' : 'border-gray-200']">
          <button @click="$emit('close')" :class="['px-4 py-2 text-sm font-medium rounded-lg', isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700']">
            Close
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useDarkMode } from '../../composables/useDarkMode'
import { useApi } from '../../composables/useApi'

interface HistoryEntry {
  id: string
  period_start: string
  period_end: string
  amount_due: number
  amount_received: number
  status: string
  due_date: string
  rent_credit_amount: number
  rent_credit_reason: string | null
  payments: Array<{
    id: string
    amount: number
    payment_method: string
    date_received: string
    reference: string | null
  }>
}

const props = defineProps<{
  entry: {
    tenancy_id: string
    property_address: string
    property_postcode: string
    tenant_names: string
  }
}>()

const emit = defineEmits<{
  close: []
  updated: []
}>()

const { isDark } = useDarkMode()
const { get, post } = useApi()

const loading = ref(true)
const history = ref<HistoryEntry[]>([])
const creditEntry = ref<HistoryEntry | null>(null)
const creditAmount = ref<number | null>(null)
const creditReason = ref('')
const applyingCredit = ref(false)

const labelClass = computed(() => `block text-xs font-medium uppercase tracking-wide mb-1 ${isDark.value ? 'text-slate-400' : 'text-gray-500'}`)
const inputClass = computed(() => `px-3 py-2 text-sm rounded-lg border ${isDark.value ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:ring-2 focus:ring-primary/50 focus:border-primary`)

function formatMoney(val: number): string {
  return (val || 0).toFixed(2)
}

function formatPeriod(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${fmt(s)} – ${fmt(e)} ${e.getFullYear()}`
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    upcoming: 'Scheduled',
    due: 'Due',
    overdue: 'Arrears',
    partial: 'Partial',
    paid: 'Paid',
    cancelled: 'Cancelled'
  }
  return labels[status] || status
}

function statusBadgeClass(status: string): string {
  const base = 'inline-block px-2 py-0.5 text-xs font-medium rounded-full'
  const colors: Record<string, string> = {
    upcoming: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
    due: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    partial: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    cancelled: 'bg-gray-100 text-gray-400 dark:bg-slate-700 dark:text-slate-500'
  }
  return `${base} ${colors[status] || colors.upcoming}`
}

function openCreditForm(row: HistoryEntry) {
  creditEntry.value = row
  creditAmount.value = null
  creditReason.value = ''
}

async function applyCredit() {
  if (!creditEntry.value || !creditAmount.value || !creditReason.value) return
  applyingCredit.value = true
  try {
    await post(`/api/rentgoose/tenancy/${props.entry.tenancy_id}/rent-credit`, {
      schedule_entry_id: creditEntry.value.id,
      credit_amount: creditAmount.value,
      reason: creditReason.value
    })
    creditEntry.value = null
    await loadHistory()
    emit('updated')
  } catch (err) {
    console.error('Failed to apply rent credit:', err)
  } finally {
    applyingCredit.value = false
  }
}

async function loadHistory() {
  loading.value = true
  try {
    const data = await get<{ history: HistoryEntry[] }>(`/api/rentgoose/tenancy/${props.entry.tenancy_id}/history`)
    history.value = data.history || []
  } catch (err) {
    console.error('Failed to load payment history:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadHistory()
})
</script>

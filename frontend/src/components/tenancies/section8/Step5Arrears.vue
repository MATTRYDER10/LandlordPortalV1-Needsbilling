<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">Arrears Breakdown</h3>
      <p class="text-sm text-gray-500 dark:text-slate-400">
        Review the rent schedule below. Enter payment amounts and dates to document arrears for Grounds 8, 10, or 11.
      </p>
    </div>

    <!-- Auto-populate Button -->
    <div v-if="formState.arrearsRows.length === 0 && canAutoPopulate" class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
      <div class="flex items-start gap-3">
        <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
          <Calendar class="w-4 h-4 text-blue-600" />
        </div>
        <div class="flex-1">
          <p class="font-medium text-blue-800 dark:text-blue-200">Pre-populate rent schedule</p>
          <p class="text-sm text-blue-700 dark:text-blue-300 mt-1">
            Generate {{ periodCount }} rent periods from {{ formatDate(formState.tenancyStartDate) }} to today,
            each with £{{ formState.rentAmount?.toLocaleString() }} due.
          </p>
          <button
            @click="autoPopulateRows"
            type="button"
            class="mt-3 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Sparkles class="w-4 h-4" />
            Generate Rent Schedule
          </button>
        </div>
      </div>
    </div>

    <!-- Arrears Table -->
    <div v-if="formState.arrearsRows.length > 0" class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
            <th class="text-left py-2.5 px-3 font-medium text-gray-700 dark:text-slate-300">Period</th>
            <th class="text-center py-2.5 px-2 font-medium text-gray-700 dark:text-slate-300 w-28">Due Date</th>
            <th class="text-right py-2.5 px-2 font-medium text-gray-700 dark:text-slate-300 w-28">Amount Due</th>
            <th class="text-right py-2.5 px-2 font-medium text-gray-700 dark:text-slate-300 w-28">Amount Paid</th>
            <th class="text-center py-2.5 px-2 font-medium text-gray-700 dark:text-slate-300 w-28">Paid Date</th>
            <th class="text-right py-2.5 px-3 font-medium text-gray-700 dark:text-slate-300 w-24">Balance</th>
            <th class="w-10"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, index) in formState.arrearsRows"
            :key="row.id"
            class="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50/50 dark:hover:bg-slate-800/50"
            :class="{ 'bg-red-50/30': row.balance > 0 }"
          >
            <td class="py-2 px-2">
              <input
                :value="row.period"
                @input="updateRow(index, 'period', ($event.target as HTMLInputElement).value)"
                type="text"
                placeholder="e.g., March 2026"
                class="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-primary focus:border-primary text-sm dark:bg-slate-900 dark:text-white"
              />
            </td>
            <td class="py-2 px-1">
              <input
                :value="row.dueDate"
                @input="updateRow(index, 'dueDate', ($event.target as HTMLInputElement).value)"
                type="date"
                class="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-primary focus:border-primary text-sm text-center dark:bg-slate-900 dark:text-white"
              />
            </td>
            <td class="py-2 px-1">
              <div class="relative">
                <span class="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 text-xs">£</span>
                <input
                  :value="row.amountDue || ''"
                  @input="updateRowNumber(index, 'amountDue', ($event.target as HTMLInputElement).value)"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  class="w-full pl-5 pr-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-primary focus:border-primary text-sm text-right dark:bg-slate-900 dark:text-white"
                />
              </div>
            </td>
            <td class="py-2 px-1">
              <div class="relative">
                <span class="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 text-xs">£</span>
                <input
                  :value="row.amountPaid || ''"
                  @input="updateRowNumber(index, 'amountPaid', ($event.target as HTMLInputElement).value)"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  class="w-full pl-5 pr-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-primary focus:border-primary text-sm text-right dark:bg-slate-900 dark:text-white"
                />
              </div>
            </td>
            <td class="py-2 px-1">
              <input
                :value="row.paidDate"
                @input="updateRow(index, 'paidDate', ($event.target as HTMLInputElement).value)"
                type="date"
                class="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-primary focus:border-primary text-sm text-center dark:bg-slate-900 dark:text-white"
                :class="{ 'border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-600': isLatePaid(row) }"
              />
            </td>
            <td class="py-2 px-3 text-right font-medium" :class="row.balance > 0 ? 'text-red-600' : 'text-green-600'">
              £{{ row.balance.toFixed(2) }}
            </td>
            <td class="py-2 px-1">
              <button
                @click="removeRow(index)"
                type="button"
                class="p-1 text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="bg-gray-50 dark:bg-slate-800">
            <td colspan="5" class="py-3 px-3 text-right font-semibold text-gray-900 dark:text-white">
              Total Arrears:
            </td>
            <td class="py-3 px-3 text-right font-bold text-lg" :class="totalArrears > 0 ? 'text-red-600' : 'text-green-600'">
              £{{ totalArrears.toFixed(2) }}
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div class="flex gap-3">
      <button
        @click="addRow"
        type="button"
        class="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
      >
        <Plus class="w-4 h-4" />
        Add row
      </button>
      <button
        v-if="formState.arrearsRows.length > 0"
        @click="clearAll"
        type="button"
        class="text-sm text-gray-500 dark:text-slate-400 hover:text-red-600 flex items-center gap-1"
      >
        <Trash2 class="w-4 h-4" />
        Clear all
      </button>
    </div>

    <!-- Late Payment Summary for Ground 10/11 -->
    <div
      v-if="latePaymentCount > 0 && (ground10Selected || ground11Selected)"
      class="rounded-lg p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
    >
      <div class="flex items-start gap-3">
        <div class="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Clock class="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <p class="font-semibold text-amber-800 dark:text-amber-200">
            {{ latePaymentCount }} Late Payment{{ latePaymentCount > 1 ? 's' : '' }} Identified
          </p>
          <p class="text-sm mt-1 text-amber-700 dark:text-amber-300">
            {{ latePaymentCount }} payment{{ latePaymentCount > 1 ? 's were' : ' was' }} made after the due date.
            This supports {{ ground10Selected && ground11Selected ? 'Grounds 10 and 11' : ground10Selected ? 'Ground 10' : 'Ground 11' }}.
          </p>
        </div>
      </div>
    </div>

    <!-- Ground 8 Threshold Check -->
    <div
      v-if="ground8Selected && formState.rentAmount && formState.rentFrequency"
      class="rounded-lg p-4"
      :class="ground8ThresholdMet ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'"
    >
      <div class="flex items-start gap-3">
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          :class="ground8ThresholdMet ? 'bg-green-100' : 'bg-amber-100'"
        >
          <Check v-if="ground8ThresholdMet" class="w-5 h-5 text-green-600" />
          <AlertTriangle v-else class="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <p class="font-semibold" :class="ground8ThresholdMet ? 'text-green-800 dark:text-green-200' : 'text-amber-800 dark:text-amber-200'">
            Ground 8 Threshold {{ ground8ThresholdMet ? 'Met' : 'Not Met' }}
          </p>
          <p class="text-sm mt-1" :class="ground8ThresholdMet ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'">
            {{ ground8Explanation }}
          </p>
          <p v-if="!ground8ThresholdMet" class="text-xs mt-2 text-amber-600 dark:text-amber-400">
            Ground 8 requires the threshold to be met both at the notice date AND at the court hearing.
            Consider serving with Grounds 10 and 11 as a fallback.
          </p>
        </div>
      </div>
    </div>

    <!-- Payment Notes -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
        Payment Notes
      </label>
      <textarea
        :value="formState.arrearsNotes"
        @input="emit('update', { arrearsNotes: ($event.target as HTMLTextAreaElement).value })"
        rows="3"
        placeholder="Document the payment history and any patterns of late payment..."
        class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm dark:bg-slate-900 dark:text-white"
      ></textarea>
      <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">
        These notes will be included in the notice to support your case, especially for Ground 11.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Plus, Trash2, Check, AlertTriangle, Calendar, Sparkles, Clock } from 'lucide-vue-next'
import type { S8FormState, ArrearsRow } from '@/types/section8'

interface Props {
  formState: S8FormState
}

const props = defineProps<Props>()

const emit = defineEmits<{
  update: [updates: Partial<S8FormState>]
}>()

const totalArrears = computed(() =>
  props.formState.arrearsRows.reduce((sum, row) => sum + row.balance, 0)
)

const ground8Selected = computed(() =>
  props.formState.selectedGroundIds.includes('ground-8')
)

const ground10Selected = computed(() =>
  props.formState.selectedGroundIds.includes('ground-10')
)

const ground11Selected = computed(() =>
  props.formState.selectedGroundIds.includes('ground-11')
)

const ground8Threshold = computed(() => {
  const rent = props.formState.rentAmount || 0
  const freq = props.formState.rentFrequency

  switch (freq) {
    case 'weekly':
    case 'fortnightly':
      return rent * 8
    case 'monthly':
      return rent * 2
    case 'quarterly':
      return rent
    case 'yearly':
      return (rent / 12) * 3
    default:
      return rent * 2
  }
})

const ground8ThresholdMet = computed(() =>
  totalArrears.value >= ground8Threshold.value
)

const ground8Explanation = computed(() => {
  const freq = props.formState.rentFrequency
  const threshold = ground8Threshold.value

  let requirement = ''
  switch (freq) {
    case 'weekly':
    case 'fortnightly':
      requirement = `8 weeks' rent (£${threshold.toFixed(2)})`
      break
    case 'monthly':
      requirement = `2 months' rent (£${threshold.toFixed(2)})`
      break
    case 'quarterly':
      requirement = `1 quarter's rent (£${threshold.toFixed(2)})`
      break
    case 'yearly':
      requirement = `3 months' rent (£${threshold.toFixed(2)})`
      break
    default:
      requirement = `£${threshold.toFixed(2)}`
  }

  return `Ground 8 requires at least ${requirement} unpaid. Current arrears: £${totalArrears.value.toFixed(2)}.`
})

// Calculate if we can auto-populate
const canAutoPopulate = computed(() => {
  return props.formState.tenancyStartDate &&
         props.formState.rentAmount &&
         props.formState.rentAmount > 0
})

// Count how many periods should be generated
const periodCount = computed(() => {
  if (!props.formState.tenancyStartDate) return 0

  const start = new Date(props.formState.tenancyStartDate)
  const now = new Date()

  // Count months between start and now
  let months = (now.getFullYear() - start.getFullYear()) * 12
  months += now.getMonth() - start.getMonth()

  // Include current month
  return Math.max(1, months + 1)
})

// Count late payments
const latePaymentCount = computed(() => {
  return props.formState.arrearsRows.filter(row => isLatePaid(row)).length
})

function isLatePaid(row: ArrearsRow): boolean {
  if (!row.dueDate || !row.paidDate) return false
  return new Date(row.paidDate) > new Date(row.dueDate)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

function autoPopulateRows() {
  if (!props.formState.tenancyStartDate || !props.formState.rentAmount) return

  const start = new Date(props.formState.tenancyStartDate)
  const now = new Date()
  const rentDueDay = parseInt(props.formState.rentDueDay) || 1
  const rentAmount = props.formState.rentAmount

  const rows: ArrearsRow[] = []

  // Start from the first rent due date
  let current = new Date(start.getFullYear(), start.getMonth(), rentDueDay)

  // If tenancy started after the rent due day, start from next month
  if (start.getDate() > rentDueDay) {
    current.setMonth(current.getMonth() + 1)
  }

  // Generate rows for each month until now
  while (current <= now) {
    const periodName = current.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    const dueDate = current.toISOString().split('T')[0]

    rows.push({
      id: crypto.randomUUID(),
      period: periodName,
      dueDate: dueDate!,
      amountDue: rentAmount,
      amountPaid: 0,
      paidDate: '',
      balance: rentAmount, // Initially full amount is owed
    })

    // Move to next month
    current.setMonth(current.getMonth() + 1)
  }

  emit('update', { arrearsRows: rows })
}

function addRow() {
  const rentDueDay = parseInt(props.formState.rentDueDay) || 1
  const now = new Date()
  const dueDate = new Date(now.getFullYear(), now.getMonth(), rentDueDay)

  const newRow: ArrearsRow = {
    id: crypto.randomUUID(),
    period: '',
    dueDate: dueDate.toISOString().split('T')[0]!,
    amountDue: props.formState.rentAmount || 0,
    amountPaid: 0,
    paidDate: '',
    balance: props.formState.rentAmount || 0,
  }
  emit('update', { arrearsRows: [...props.formState.arrearsRows, newRow] })
}

function removeRow(index: number) {
  const rows = props.formState.arrearsRows.filter((_, i) => i !== index)
  emit('update', { arrearsRows: rows })
}

function clearAll() {
  emit('update', { arrearsRows: [] })
}

function updateRow(index: number, field: keyof ArrearsRow, value: string) {
  const rows = [...props.formState.arrearsRows]
  rows[index] = { ...rows[index]!, [field]: value } as ArrearsRow
  emit('update', { arrearsRows: rows })
}

function updateRowNumber(index: number, field: 'amountDue' | 'amountPaid', value: string) {
  const rows = [...props.formState.arrearsRows]
  const numValue = parseFloat(value) || 0
  rows[index] = {
    ...rows[index]!,
    [field]: numValue,
    balance: field === 'amountDue'
      ? numValue - rows[index]!.amountPaid
      : rows[index]!.amountDue - numValue,
  }
  emit('update', { arrearsRows: rows })
}
</script>

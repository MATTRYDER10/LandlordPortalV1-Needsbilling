<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Calendar, DollarSign, Send, AlertTriangle, ChevronRight, ChevronLeft, Info, CheckCircle } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const API_URL = (import.meta.env.DEV && typeof window !== 'undefined' && window.location.hostname === 'localhost')
  ? ''
  : (import.meta.env.VITE_API_URL ?? '')

interface TenantChange {
  id: string
  changeover_date: string | null
  expected_move_in_date: string | null
  fee_amount: number
  fee_waived: boolean
  fee_waived_reason: string | null
  fee_above_50_justification: string | null
  fee_payable_by: 'outgoing' | 'incoming' | 'split'
  payment_reference: string | null
  bank_name: string | null
  sort_code: string | null
  account_number: string | null
  pro_rata_outgoing: number
  pro_rata_incoming: number
  fee_invoice_sent_at: string | null
  fee_received_at: string | null
  fee_tenant_confirmed_at: string | null
}

const props = defineProps<{
  tenantChange: TenantChange
  monthlyRent: number
  rentDueDay: number
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'update', data: any): void
  (e: 'next'): void
  (e: 'back'): void
  (e: 'close'): void
}>()

const authStore = useAuthStore()
const isSubmitting = ref(false)
const isSendingInvoice = ref(false)
const isMarkingReceived = ref(false)
const error = ref('')

// Form state - pre-populate changeover date from expected_move_in_date if not already set
const changeoverDate = ref(props.tenantChange.changeover_date || props.tenantChange.expected_move_in_date || '')
const feeAmount = ref(props.tenantChange.fee_amount)
const feeWaived = ref(props.tenantChange.fee_waived)
const feeWaivedReason = ref(props.tenantChange.fee_waived_reason || '')
const feeAbove50Justification = ref(props.tenantChange.fee_above_50_justification || '')
const feePayableBy = ref(props.tenantChange.fee_payable_by)
const bankName = ref(props.tenantChange.bank_name || '')
const sortCode = ref(props.tenantChange.sort_code || '')
const accountNumber = ref(props.tenantChange.account_number || '')

// Pro-rata state
const proRataOutgoing = ref(props.tenantChange.pro_rata_outgoing || 0)
const proRataIncoming = ref(props.tenantChange.pro_rata_incoming || 0)
const isCalculatingProRata = ref(false)

// Ordinal suffix helper
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// Check if changeover date falls on the rent due day
const isOnRentDueDay = computed(() => {
  if (!changeoverDate.value) return false
  const d = new Date(changeoverDate.value)
  return d.getDate() === props.rentDueDay
})

const proRataRequired = computed(() => {
  return changeoverDate.value && !isOnRentDueDay.value
})

// Calculate pro-rata when changeover date changes
async function calculateProRata() {
  if (!changeoverDate.value || isOnRentDueDay.value) {
    proRataOutgoing.value = 0
    proRataIncoming.value = 0
    return
  }

  isCalculatingProRata.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(
      `${API_URL}/api/tenant-change/${props.tenantChange.id}/calculate-pro-rata`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ changeoverDate: changeoverDate.value })
      }
    )

    if (response.ok) {
      const data = await response.json()
      proRataOutgoing.value = data.proRata.outgoing || 0
      proRataIncoming.value = data.proRata.incoming || 0
    }
  } catch (err) {
    console.error('Failed to calculate pro-rata:', err)
  } finally {
    isCalculatingProRata.value = false
  }
}

// Watch changeover date changes to recalculate pro-rata
let proRataTimeout: ReturnType<typeof setTimeout> | null = null
watch(changeoverDate, () => {
  if (proRataTimeout) clearTimeout(proRataTimeout)
  proRataTimeout = setTimeout(calculateProRata, 500)
}, { immediate: true })

// Total amount is just the fee (no pro-rata - changeover happens on rent due date)
const totalAmount = computed(() => {
  if (feeWaived.value) return 0
  return feeAmount.value
})

// No fee required if waived
const noFeeRequired = computed(() => feeWaived.value || totalAmount.value === 0)

const needsFeeJustification = computed(() => feeAmount.value > 50 && !feeWaived.value)

const invoiceSent = computed(() => !!props.tenantChange.fee_invoice_sent_at)
const feeReceived = computed(() => !!props.tenantChange.fee_received_at)
const tenantConfirmed = computed(() => !!props.tenantChange.fee_tenant_confirmed_at)

async function saveFeeDetails() {
  isSubmitting.value = true
  error.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenant-change/${props.tenantChange.id}/fee-details`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          changeover_date: changeoverDate.value || null,
          fee_amount: feeAmount.value,
          fee_waived: feeWaived.value,
          fee_waived_reason: feeWaived.value ? feeWaivedReason.value : null,
          fee_above_50_justification: needsFeeJustification.value ? feeAbove50Justification.value : null,
          fee_payable_by: feePayableBy.value,
          bank_name: bankName.value,
          sort_code: sortCode.value,
          account_number: accountNumber.value,
          pro_rata_outgoing: proRataOutgoing.value,
          pro_rata_incoming: proRataIncoming.value
        })
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to save fee details')
    }

    const result = await response.json()
    emit('update', result.tenantChange)
  } catch (err: any) {
    error.value = err.message
  } finally {
    isSubmitting.value = false
  }
}

async function sendInvoice() {
  isSendingInvoice.value = true
  error.value = ''

  try {
    // Save first
    await saveFeeDetails()

    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenant-change/${props.tenantChange.id}/send-invoice`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to send invoice')
    }

    const result = await response.json()
    emit('update', result.tenantChange)
  } catch (err: any) {
    error.value = err.message
  } finally {
    isSendingInvoice.value = false
  }
}

async function markFeeReceived() {
  isMarkingReceived.value = true
  error.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenant-change/${props.tenantChange.id}/mark-fee-received`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: totalAmount.value,
          notes: ''
        })
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to mark fee as received')
    }

    const result = await response.json()
    emit('update', result.tenantChange)
    emit('next')
  } catch (err: any) {
    error.value = err.message
  } finally {
    isMarkingReceived.value = false
  }
}

async function handleContinue() {
  // If no fee required (waived), just save and continue
  if (noFeeRequired.value) {
    await saveFeeDetails()
    emit('next')
    return
  }

  // If fee required, ensure it's been received
  if (!feeReceived.value) {
    error.value = 'Please mark the fee as received before continuing'
    return
  }
  emit('next')
}
</script>

<template>
  <div class="space-y-6">
    <div class="text-center">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Fee & Changeover Date
      </h3>
      <p class="text-sm text-gray-500 dark:text-slate-400">
        Set the changeover date and configure the change of tenant fee.
      </p>
    </div>

    <!-- Error -->
    <div v-if="error" class="p-4 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
      <div class="flex items-center gap-2 text-red-700 dark:text-red-400">
        <AlertTriangle class="w-4 h-4" />
        <span class="text-sm">{{ error }}</span>
      </div>
    </div>

    <!-- Changeover Date -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
        <Calendar class="w-4 h-4 inline-block mr-1" />
        Changeover Date *
      </label>
      <input
        v-model="changeoverDate"
        type="date"
        :disabled="feeReceived"
        class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-50"
        required
      >
      <p class="text-xs text-gray-500 dark:text-slate-400 mt-1">
        The date when the outgoing tenant(s) leave and incoming tenant(s) start.
        Rent is currently due on the <strong>{{ ordinal(rentDueDay) }}</strong> of each month (£{{ monthlyRent.toFixed(2) }}/month).
      </p>
    </div>

    <!-- Fee Configuration -->
    <div class="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg space-y-4">
      <h4 class="font-medium text-gray-900 dark:text-white flex items-center gap-2">
        <DollarSign class="w-4 h-4" />
        Fee Configuration
      </h4>

      <!-- Fee Waived Toggle -->
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          v-model="feeWaived"
          type="checkbox"
          :disabled="feeReceived"
          class="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
        >
        <span class="text-sm text-gray-700 dark:text-slate-300">Waive the change of tenant fee</span>
      </label>

      <div v-if="feeWaived" class="pl-6">
        <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Reason for waiving</label>
        <input
          v-model="feeWaivedReason"
          type="text"
          :disabled="feeReceived"
          placeholder="e.g., Landlord requested waiver"
          class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-50"
        >
      </div>

      <div v-if="!feeWaived" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Fee Amount (GBP)</label>
          <input
            v-model.number="feeAmount"
            type="number"
            min="0"
            step="0.01"
            :disabled="feeReceived"
            class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-50"
          >
          <p v-if="feeAmount > 50" class="text-xs text-amber-600 dark:text-amber-400 mt-1">
            Fees above £50 may require justification under the Tenant Fee Ban Act 2019.
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Who pays the fee?</label>
          <select
            v-model="feePayableBy"
            :disabled="feeReceived"
            class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-50"
          >
            <option value="outgoing">Outgoing Tenant</option>
            <option value="incoming">Incoming Tenant</option>
            <option value="split">Split Between Both</option>
          </select>
        </div>
      </div>

      <!-- Fee above £50 justification -->
      <div v-if="needsFeeJustification">
        <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Fee Justification (Required)</label>
        <textarea
          v-model="feeAbove50Justification"
          rows="2"
          :disabled="feeReceived"
          placeholder="Explain why the fee exceeds £50..."
          class="w-full px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50"
        ></textarea>
      </div>
    </div>

    <!-- Pro-Rata Section -->
    <div v-if="changeoverDate && proRataRequired" class="p-4 bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-800">
      <div class="flex items-start gap-3">
        <Info class="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div class="flex-1">
          <p class="font-medium text-amber-700 dark:text-amber-300">Pro-Rata Rent Adjustment</p>
          <p class="text-sm text-amber-600 dark:text-amber-400 mt-1">
            The changeover date does not fall on the rent due date ({{ ordinal(rentDueDay) }}). Rent will be pro-rated for the partial period.
          </p>

          <div v-if="isCalculatingProRata" class="mt-3 text-sm text-amber-600 dark:text-amber-400">
            Calculating...
          </div>
          <div v-else class="mt-3 grid grid-cols-2 gap-3">
            <div class="p-3 bg-white dark:bg-slate-700 rounded-lg border border-amber-200 dark:border-amber-700">
              <p class="text-xs uppercase font-medium text-red-600 dark:text-red-400 mb-1">Outgoing Tenant Refund</p>
              <p class="text-lg font-bold text-gray-900 dark:text-white">£{{ proRataOutgoing.toFixed(2) }}</p>
              <p class="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Overpaid rent to be refunded</p>
            </div>
            <div class="p-3 bg-white dark:bg-slate-700 rounded-lg border border-amber-200 dark:border-amber-700">
              <p class="text-xs uppercase font-medium text-green-600 dark:text-green-400 mb-1">Incoming Tenant Owes</p>
              <p class="text-lg font-bold text-gray-900 dark:text-white">£{{ proRataIncoming.toFixed(2) }}</p>
              <p class="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Partial period rent due</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- No Pro-Rata Info (on rent due day) -->
    <div v-else-if="changeoverDate && isOnRentDueDay" class="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
      <div class="flex items-start gap-3">
        <Info class="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p class="font-medium text-blue-700 dark:text-blue-300">No Pro-Rata Required</p>
          <p class="text-sm text-blue-600 dark:text-blue-400">
            The changeover falls on the rent due date ({{ ordinal(rentDueDay) }}). The incoming tenant's first rent payment will be due on the regular rent due date.
          </p>
        </div>
      </div>
    </div>

    <!-- Bank Details (only show if fee is required) -->
    <div v-if="!noFeeRequired" class="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg space-y-4">
      <h4 class="font-medium text-gray-900 dark:text-white">Bank Details for Payment</h4>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Account Name</label>
          <input
            v-model="bankName"
            type="text"
            :disabled="feeReceived"
            class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-50"
          >
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Sort Code</label>
          <input
            v-model="sortCode"
            type="text"
            :disabled="feeReceived"
            placeholder="00-00-00"
            class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-50"
          >
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Account Number</label>
          <input
            v-model="accountNumber"
            type="text"
            :disabled="feeReceived"
            class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-50"
          >
        </div>
      </div>

      <div class="p-3 bg-white dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600">
        <p class="text-sm text-gray-500 dark:text-slate-400">Payment Reference</p>
        <p class="font-mono font-medium text-gray-900 dark:text-white">{{ tenantChange.payment_reference || 'Not generated' }}</p>
      </div>
    </div>

    <!-- No Fee Required Message -->
    <div v-if="noFeeRequired" class="p-4 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
      <div class="flex items-center gap-3">
        <CheckCircle class="w-5 h-5 text-green-600 dark:text-green-400" />
        <div>
          <p class="font-medium text-green-700 dark:text-green-300">No Fee Required</p>
          <p class="text-sm text-green-600 dark:text-green-400">
            The change of tenant fee has been waived. You can continue without sending an invoice.
          </p>
        </div>
      </div>
    </div>

    <!-- Total & Actions (only show if fee is required) -->
    <div v-if="!noFeeRequired" class="p-4 bg-orange-50 dark:bg-orange-900/30 rounded-lg border border-orange-200 dark:border-orange-800">
      <div class="flex items-center justify-between mb-4">
        <span class="text-lg font-semibold text-orange-900 dark:text-orange-100">Total Due:</span>
        <span class="text-2xl font-bold text-orange-600 dark:text-orange-400">£{{ totalAmount.toFixed(2) }}</span>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <button
          v-if="!invoiceSent"
          @click="sendInvoice"
          :disabled="isSendingInvoice || !changeoverDate"
          class="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Send class="w-4 h-4" />
          {{ isSendingInvoice ? 'Sending...' : 'Send Invoice' }}
        </button>

        <div v-if="invoiceSent" class="flex items-center gap-2 text-green-600 dark:text-green-400">
          <CheckCircle class="w-5 h-5" />
          <span class="text-sm font-medium">Invoice sent</span>
        </div>

        <!-- Tenant Confirmed Status -->
        <div v-if="tenantConfirmed && !feeReceived" class="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 rounded-lg">
          <CheckCircle class="w-4 h-4" />
          <span class="text-sm font-medium">Tenant confirmed payment</span>
        </div>

        <button
          v-if="invoiceSent && !feeReceived"
          @click="markFeeReceived"
          :disabled="isMarkingReceived"
          class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <CheckCircle class="w-4 h-4" />
          {{ isMarkingReceived ? 'Saving...' : 'Mark as Received' }}
        </button>

        <div v-if="feeReceived" class="flex items-center gap-2 text-green-600 dark:text-green-400">
          <CheckCircle class="w-5 h-5" />
          <span class="text-sm font-medium">Payment received</span>
        </div>
      </div>

      <!-- Save & Close hint after invoice sent -->
      <p v-if="invoiceSent && !feeReceived" class="mt-3 text-sm text-orange-700 dark:text-orange-300">
        You can close this dialog and return later to mark payment as received. The tenant will receive an email with payment instructions.
      </p>
    </div>

    <!-- Action Buttons -->
    <div class="flex justify-between">
      <div class="flex gap-2">
        <button
          @click="emit('back')"
          class="px-6 py-2 text-gray-700 dark:text-slate-300 font-medium border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors"
        >
          <ChevronLeft class="w-4 h-4" />
          Back
        </button>
        <!-- Save & Close (available after invoice sent but not yet received) -->
        <button
          v-if="!noFeeRequired && invoiceSent && !feeReceived"
          @click="emit('close')"
          class="px-6 py-2 text-gray-700 dark:text-slate-300 font-medium border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
        >
          Save & Close
        </button>
      </div>

      <!-- Continue Button -->
      <button
        @click="handleContinue"
        :disabled="loading || (!noFeeRequired && !feeReceived) || !changeoverDate"
        class="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
      >
        {{ isSubmitting ? 'Saving...' : 'Continue' }}
        <ChevronRight class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>

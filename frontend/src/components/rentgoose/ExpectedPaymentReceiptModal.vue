<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="$emit('close')"></div>
      <div :class="['relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl shadow-2xl', isDark ? 'bg-slate-900' : 'bg-white']">
        <!-- Header -->
        <div :class="['px-6 py-4 border-b flex items-center justify-between', isDark ? 'border-slate-700' : 'border-gray-200']">
          <div>
            <h2 class="text-lg font-semibold">Receipt Payment</h2>
            <p :class="['text-sm', isDark ? 'text-slate-400' : 'text-gray-500']">{{ item.property_address || item.description }}</p>
          </div>
          <button @click="$emit('close')" :class="['p-1 rounded-lg', isDark ? 'hover:bg-slate-800' : 'hover:bg-gray-100']">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-6 space-y-5">
          <!-- Payment details -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label :class="labelClass">Type</label>
              <span :class="['px-2 py-0.5 text-xs font-medium rounded-full', typeBadgeClass]">{{ typeLabel }}</span>
            </div>
            <div>
              <label :class="labelClass">Tenant</label>
              <p class="text-sm font-medium">{{ item.tenant_name || '-' }}</p>
            </div>
          </div>

          <!-- Amount -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label :class="labelClass">Amount Due</label>
              <p class="text-lg font-bold text-primary">&pound;{{ formatMoney(item.amount_due) }}</p>
            </div>
            <div>
              <label :class="labelClass">Amount Received</label>
              <input
                v-model.number="form.amount"
                type="number"
                step="0.01"
                :class="inputClass"
              />
            </div>
          </div>

          <!-- Holding deposit credit (for initial monies) -->
          <div v-if="holdingDepositCredit.available && item.payment_type === 'initial_monies'" :class="['rounded-xl p-4 border', isDark ? 'bg-emerald-900/20 border-emerald-800' : 'bg-emerald-50 border-emerald-200']">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-emerald-600 dark:text-emerald-400">Holding deposit credit</span>
              <span class="text-sm font-bold text-emerald-600 dark:text-emerald-400">-&pound;{{ formatMoney(holdingDepositCredit.amount) }}</span>
            </div>
            <p class="text-xs mt-1 text-emerald-500">This will be deducted from the amount due</p>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label :class="labelClass">Date Received</label>
              <input v-model="form.date_received" type="date" :class="inputClass" />
            </div>
            <div>
              <label :class="labelClass">Payment Method</label>
              <select v-model="form.payment_method" :class="inputClass">
                <option value="bank_transfer">Bank Transfer</option>
                <option value="standing_order">Standing Order</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label :class="labelClass">Reference (optional)</label>
            <input v-model="form.reference" type="text" :class="inputClass" placeholder="Payment reference" />
          </div>

          <!-- Payout split breakdown (read-only) -->
          <div v-if="item.payout_split && item.payout_split.length > 0">
            <h3 class="text-sm font-semibold mb-3" :class="isDark ? 'text-slate-300' : 'text-gray-700'">Payout Breakdown</h3>
            <div :class="['rounded-xl border divide-y', isDark ? 'border-slate-700 divide-slate-700' : 'border-gray-200 divide-gray-200']">
              <div v-for="(split, i) in item.payout_split" :key="i" class="flex items-center justify-between px-4 py-3">
                <div class="flex items-center gap-2">
                  <span :class="['w-2 h-2 rounded-full', splitDotClass(split.type)]"></span>
                  <span class="text-sm">{{ split.description }}</span>
                </div>
                <div class="text-right">
                  <span class="text-sm font-medium">&pound;{{ formatMoney(split.amount) }}</span>
                  <span :class="['text-xs ml-2', isDark ? 'text-slate-500' : 'text-gray-400']">{{ splitRouteLabel(split.type) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div :class="['px-6 py-4 border-t flex justify-end gap-3', isDark ? 'border-slate-700' : 'border-gray-200']">
          <button @click="$emit('close')" :class="['px-4 py-2 text-sm font-medium rounded-lg', isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-gray-100 hover:bg-gray-200']">
            Cancel
          </button>
          <button
            @click="submitReceipt"
            :disabled="submitting || !form.amount || form.amount <= 0"
            class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-orange-600 rounded-lg disabled:opacity-50 transition-colors"
          >
            {{ submitting ? 'Processing...' : 'Confirm Receipt' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDarkMode } from '../../composables/useDarkMode'
import { useRentGooseStore, type UnifiedPaymentItem } from '../../stores/rentgoose'

const props = defineProps<{ item: UnifiedPaymentItem }>()
const emit = defineEmits<{ close: []; receipted: [] }>()

const { isDark } = useDarkMode()
const store = useRentGooseStore()

const submitting = ref(false)
const holdingDepositCredit = ref<{ available: boolean; amount: number; expected_payment_id: string | null }>({ available: false, amount: 0, expected_payment_id: null })

const form = ref({
  amount: props.item.amount_due - (props.item.amount_received || 0),
  date_received: new Date().toISOString().split('T')[0],
  payment_method: 'bank_transfer',
  reference: '',
})

const typeBadgeClass = computed(() => {
  switch (props.item.payment_type) {
    case 'holding_deposit': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    case 'initial_monies': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    case 'tenant_change_fee': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    case 'rent_change_fee': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    default: return 'bg-gray-100 text-gray-500'
  }
})

const typeLabel = computed(() => {
  switch (props.item.payment_type) {
    case 'holding_deposit': return 'Holding Deposit'
    case 'initial_monies': return 'Initial Monies'
    case 'tenant_change_fee': return 'Change Fee'
    case 'rent_change_fee': return 'Date Change Fee'
    case 'deposit': return 'Deposit'
    default: return props.item.payment_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }
})

function splitDotClass(type: string) {
  switch (type) {
    case 'landlord_rent': case 'landlord_prorata': return 'bg-emerald-500'
    case 'deposit_hold': return 'bg-blue-500'
    case 'agent_fee': return 'bg-orange-500'
    case 'holding_deposit': return 'bg-purple-500'
    default: return 'bg-gray-400'
  }
}

function splitRouteLabel(type: string) {
  switch (type) {
    case 'landlord_rent': case 'landlord_prorata': return 'Landlord'
    case 'deposit_hold': return 'Deposit Hold'
    case 'agent_fee': return 'Agent'
    case 'holding_deposit': return 'Deposit Hold'
    default: return ''
  }
}

async function submitReceipt() {
  submitting.value = true
  try {
    await store.receiptExpectedPayment({
      expected_payment_id: props.item.id,
      amount: form.value.amount,
      payment_method: form.value.payment_method,
      payment_reference: form.value.reference,
      date_received: form.value.date_received,
      holding_deposit_credit_amount: holdingDepositCredit.value.available ? holdingDepositCredit.value.amount : undefined,
      holding_deposit_credit_id: holdingDepositCredit.value.available ? holdingDepositCredit.value.expected_payment_id : undefined,
    })
    emit('receipted')
  } catch (err) {
    console.error('Failed to receipt expected payment:', err)
  } finally {
    submitting.value = false
  }
}

function formatMoney(val: number) {
  return (val || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const labelClass = computed(() => `block text-xs font-medium uppercase tracking-wide mb-1 ${isDark.value ? 'text-slate-400' : 'text-gray-500'}`)
const inputClass = computed(() => `w-full px-3 py-2 text-sm rounded-lg border ${isDark.value ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:ring-2 focus:ring-primary/50 focus:border-primary`)

onMounted(async () => {
  // Fetch holding deposit credit for initial monies
  if (props.item.payment_type === 'initial_monies' && props.item.tenancy_id) {
    holdingDepositCredit.value = await store.fetchHoldingDepositCredit(props.item.tenancy_id)
    if (holdingDepositCredit.value.available) {
      form.value.amount = Math.max(0, form.value.amount - holdingDepositCredit.value.amount)
    }
  }
})
</script>

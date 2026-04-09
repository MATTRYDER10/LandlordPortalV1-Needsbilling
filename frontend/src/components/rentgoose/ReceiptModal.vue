<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="$emit('close')"></div>
      <div :class="['relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl', isDark ? 'bg-slate-900' : 'bg-white']">
        <!-- Header -->
        <div :class="['px-6 py-4 border-b flex items-center justify-between', isDark ? 'border-slate-700' : 'border-gray-200']">
          <div>
            <h2 class="text-lg font-semibold dark:text-white">Receipt Payment</h2>
            <p :class="['text-sm', isDark ? 'text-slate-400' : 'text-gray-500']">{{ entry.property_address }}, {{ entry.property_postcode }}</p>
          </div>
          <button @click="$emit('close')" :class="['p-1 rounded-lg', isDark ? 'hover:bg-slate-800' : 'hover:bg-gray-100']">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-6 space-y-5">
          <!-- Tenant & tenancy info -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label :class="labelClass">Tenant</label>
              <p class="text-sm font-medium dark:text-white">{{ entry.tenant_names }}</p>
            </div>
            <div>
              <label :class="labelClass">Tenancy Ref</label>
              <p class="text-sm font-medium dark:text-white">{{ entry.tenancy_ref }}</p>
            </div>
          </div>

          <!-- Payment fields -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label :class="labelClass">Date Received</label>
              <input
                v-model="form.date_received"
                type="date"
                :class="inputClass"
              />
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

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label :class="labelClass">Amount Due (this period)</label>
              <p class="text-lg font-bold text-primary">&pound;{{ formatMoney(entry.amount_due) }}</p>
            </div>
            <div>
              <label :class="labelClass">Amount Received</label>
              <input
                v-model.number="form.amount"
                type="number"
                step="0.01"
                :class="inputClass"
                @input="checkPartial"
              />
            </div>
          </div>

          <div>
            <label :class="labelClass">Reference (optional)</label>
            <input v-model="form.reference" type="text" :class="inputClass" placeholder="Payment reference" />
          </div>

          <!-- Partial payment warning -->
          <div v-if="isPartial" :class="['rounded-xl p-4 border', isDark ? 'bg-amber-900/20 border-amber-800' : 'bg-amber-50 border-amber-200']">
            <p class="text-sm font-medium text-amber-600 dark:text-amber-400 mb-3">
              Partial payment: &pound;{{ formatMoney(form.amount) }} of &pound;{{ formatMoney(entry.amount_due) }} — &pound;{{ formatMoney(entry.amount_due - form.amount) }} outstanding
            </p>
            <div class="flex gap-3">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="form.partial_action" value="hold" class="text-primary" />
                <span class="text-sm dark:text-slate-200">Hold &amp; wait for remainder</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="form.partial_action" value="payout_now" class="text-primary" />
                <span class="text-sm dark:text-slate-200">Pay out now (partial)</span>
              </label>
            </div>
          </div>

          <!-- Agent charges section -->
          <div>
            <h3 class="text-sm font-semibold mb-3" :class="isDark ? 'text-slate-300' : 'text-gray-700'">Agent Charges</h3>
            <div :class="['rounded-xl border divide-y', isDark ? 'border-slate-700 divide-slate-700' : 'border-gray-200 divide-gray-200']">
              <div v-for="(charge, i) in charges" :key="i" class="flex items-center justify-between px-4 py-3">
                <label class="flex items-center gap-3 cursor-pointer flex-1">
                  <input type="checkbox" v-model="charge.included" class="rounded text-primary" />
                  <span class="text-sm dark:text-slate-200">{{ charge.description }}</span>
                </label>
                <span class="text-sm font-medium dark:text-white">&pound;{{ formatMoney(charge.gross_amount) }}</span>
              </div>
              <!-- Add ad hoc charge -->
              <div class="px-4 py-3">
                <button @click="showAdHoc = !showAdHoc" class="text-sm text-primary hover:underline">+ Add charge</button>
                <div v-if="showAdHoc" class="mt-3 flex gap-2 items-center">
                  <input v-model="adHocDesc" type="text" placeholder="Item description" :class="[`px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:ring-2 focus:ring-primary/50 focus:border-primary`, 'flex-1 min-w-0']" />
                  <div class="relative flex-shrink-0 w-28">
                    <span class="absolute left-3 top-2 text-sm text-gray-400">&pound;</span>
                    <input v-model.number="adHocAmount" type="number" step="0.01" min="0" placeholder="0.00" :class="[`pl-7 pr-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:ring-2 focus:ring-primary/50 focus:border-primary w-full`]" />
                  </div>
                  <button @click="addAdHocCharge" class="px-3 py-2 text-sm bg-primary text-white rounded-lg flex-shrink-0">Add</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Live summary -->
          <div :class="['rounded-xl p-4 border', isDark ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200']">
            <div class="flex justify-between text-sm mb-2">
              <span class="dark:text-slate-200">Rent received</span>
              <span class="font-medium dark:text-white">&pound;{{ formatMoney(form.amount || 0) }}</span>
            </div>
            <div class="flex justify-between text-sm mb-2">
              <span class="dark:text-slate-200">Agent charges</span>
              <span class="font-medium text-red-500">-&pound;{{ formatMoney(totalCharges) }}</span>
            </div>
            <div :class="['flex justify-between text-sm font-bold pt-2 border-t', isDark ? 'border-slate-600' : 'border-gray-300']">
              <span class="dark:text-slate-200">Landlord payout</span>
              <span class="text-emerald-500">&pound;{{ formatMoney(netPayout) }}</span>
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
            {{ submitting ? 'Processing...' : 'Confirm & Move to Payouts' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDarkMode } from '../../composables/useDarkMode'
import { useRentGooseStore, type ScheduleEntry } from '../../stores/rentgoose'
import { useApi } from '../../composables/useApi'

const props = defineProps<{ entry: ScheduleEntry }>()
const emit = defineEmits<{ close: []; receipted: [] }>()

const { isDark } = useDarkMode()
const store = useRentGooseStore()
const { get } = useApi()

const submitting = ref(false)
const showAdHoc = ref(false)
const adHocDesc = ref('')
const adHocAmount = ref<number>(0)

const form = ref({
  date_received: new Date().toISOString().split('T')[0],
  payment_method: 'bank_transfer',
  amount: props.entry.amount_due - (props.entry.amount_received || 0),
  reference: '',
  partial_action: 'hold' as 'hold' | 'payout_now',
})

const charges = ref<Array<{
  charge_type: string
  description: string
  net_amount: number
  vat_amount: number
  gross_amount: number
  included: boolean
}>>([])

// Auto-populate management fee + fetch pre-existing charges
onMounted(async () => {
  if (props.entry.fee_percent && props.entry.management_type === 'managed') {
    const feePercent = props.entry.fee_percent
    const rentAmount = form.value.amount
    const netFee = (feePercent / 100) * rentAmount
    const vatFee = netFee * 0.20
    charges.value.push({
      charge_type: 'management_fee',
      description: `Management fee at ${feePercent}%`,
      net_amount: Math.round(netFee * 100) / 100,
      vat_amount: Math.round(vatFee * 100) / 100,
      gross_amount: Math.round((netFee + vatFee) * 100) / 100,
      included: true,
    })
  }

  // Fetch any pre-raised charges (ad-hoc invoices) for this schedule entry
  try {
    const existing = await get<any[]>(`/api/rentgoose/charges/${props.entry.id}`)
    if (existing && existing.length > 0) {
      for (const c of existing) {
        charges.value.push({
          charge_type: c.charge_type,
          description: c.description,
          net_amount: parseFloat(c.net_amount),
          vat_amount: parseFloat(c.vat_amount),
          gross_amount: parseFloat(c.gross_amount),
          included: c.included,
        })
      }
    }
  } catch (err) {
    console.error('Failed to fetch existing charges:', err)
  }
})

const isPartial = computed(() => form.value.amount > 0 && form.value.amount < (props.entry.amount_due - (props.entry.amount_received || 0)))
const totalCharges = computed(() => charges.value.filter(c => c.included).reduce((sum, c) => sum + c.gross_amount, 0))
const netPayout = computed(() => Math.max(0, (form.value.amount || 0) - totalCharges.value))

function checkPartial() {
  // Recalculate management fee based on amount received
  const mgmtFee = charges.value.find(c => c.charge_type === 'management_fee')
  if (mgmtFee && props.entry.fee_percent) {
    const netFee = (props.entry.fee_percent / 100) * (form.value.amount || 0)
    const vatFee = netFee * 0.20
    mgmtFee.net_amount = Math.round(netFee * 100) / 100
    mgmtFee.vat_amount = Math.round(vatFee * 100) / 100
    mgmtFee.gross_amount = Math.round((netFee + vatFee) * 100) / 100
  }
}

function addAdHocCharge() {
  if (!adHocDesc.value || !adHocAmount.value) return
  charges.value.push({
    charge_type: 'ad_hoc',
    description: adHocDesc.value,
    net_amount: adHocAmount.value,
    vat_amount: 0,
    gross_amount: adHocAmount.value,
    included: true,
  })
  adHocDesc.value = ''
  adHocAmount.value = 0
  showAdHoc.value = false
}

async function submitReceipt() {
  submitting.value = true
  try {
    await store.receiptPayment({
      schedule_entry_id: props.entry.id,
      amount: form.value.amount,
      payment_method: form.value.payment_method,
      date_received: form.value.date_received,
      reference: form.value.reference,
      charges: charges.value.map(c => ({
        charge_type: c.charge_type,
        description: c.description,
        net_amount: c.net_amount,
        vat_amount: c.vat_amount,
        gross_amount: c.gross_amount,
        included: c.included,
      })),
      partial_action: isPartial.value ? form.value.partial_action : undefined,
    })
    emit('receipted')
  } catch (err) {
    console.error('Failed to receipt payment:', err)
  } finally {
    submitting.value = false
  }
}

function formatMoney(val: number) {
  return (val || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const labelClass = computed(() => `block text-xs font-medium uppercase tracking-wide mb-1 ${isDark.value ? 'text-slate-400' : 'text-gray-500'}`)
const inputClass = computed(() => `w-full px-3 py-2 text-sm rounded-lg border ${isDark.value ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:ring-2 focus:ring-primary/50 focus:border-primary`)
</script>

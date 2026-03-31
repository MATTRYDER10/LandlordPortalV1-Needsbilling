<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="$emit('close')"></div>
      <div :class="['relative w-full max-w-lg rounded-2xl shadow-2xl', isDark ? 'bg-slate-900' : 'bg-white']">
        <div :class="['px-6 py-4 border-b', isDark ? 'border-slate-700' : 'border-gray-200']">
          <h2 class="text-lg font-semibold">Confirm Payout</h2>
        </div>

        <div class="p-6 space-y-4">
          <div :class="['rounded-xl p-4', isDark ? 'bg-slate-800' : 'bg-gray-50']">
            <div class="flex justify-between text-sm mb-2">
              <span>Rent received</span>
              <span class="font-medium">&pound;{{ formatMoney(payout.gross_rent) }}</span>
            </div>
            <div class="flex justify-between text-sm mb-2">
              <span>Total charges</span>
              <span class="font-medium text-red-500">-&pound;{{ formatMoney(payout.total_charges) }}</span>
            </div>
            <div :class="['flex justify-between font-bold pt-2 border-t', isDark ? 'border-slate-600' : 'border-gray-300']">
              <span>Net payout</span>
              <span class="text-emerald-500">&pound;{{ formatMoney(payout.net_payout) }}</span>
            </div>
          </div>

          <div>
            <p :class="['text-sm mb-1', isDark ? 'text-slate-400' : 'text-gray-500']">Landlord bank details</p>
            <p class="text-sm font-medium">{{ payout.landlord_bank_name || 'Not set' }} &middot; {{ payout.landlord_bank_sort_code || '—' }} / ****{{ payout.landlord_bank_account_last4 || '—' }}</p>
          </div>

          <div class="space-y-2">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" v-model="sendStatement" class="rounded text-primary" />
              <span class="text-sm">Send statement to landlord (email)</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" v-model="logStatement" class="rounded text-primary" />
              <span class="text-sm">Log statement to landlord documents</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" v-model="sendTenantReceipt" class="rounded text-primary" />
              <span class="text-sm">Send rent receipt to tenant</span>
            </label>
          </div>
        </div>

        <div :class="['px-6 py-4 border-t flex justify-end gap-3', isDark ? 'border-slate-700' : 'border-gray-200']">
          <button @click="$emit('close')" :class="['px-4 py-2 text-sm font-medium rounded-lg', isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-gray-100 hover:bg-gray-200']">Cancel</button>
          <button
            @click="confirm"
            :disabled="submitting"
            class="px-4 py-2 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg disabled:opacity-50"
          >
            {{ submitting ? 'Processing...' : 'Mark Paid & Send' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useDarkMode } from '../../composables/useDarkMode'
import { useRentGooseStore, type PayoutItem } from '../../stores/rentgoose'

const props = defineProps<{ payout: PayoutItem }>()
const emit = defineEmits<{ close: []; paid: [] }>()

const { isDark } = useDarkMode()
const store = useRentGooseStore()

const submitting = ref(false)
const sendStatement = ref(true)
const logStatement = ref(true)
const sendTenantReceipt = ref(true)

async function confirm() {
  submitting.value = true
  try {
    await store.markPaid({
      schedule_entry_id: props.payout.schedule_entry_id,
      send_statement: sendStatement.value,
      log_statement: logStatement.value,
      send_tenant_receipt: sendTenantReceipt.value,
    })
    emit('paid')
  } catch (err) {
    console.error('Failed to mark paid:', err)
  } finally {
    submitting.value = false
  }
}

function formatMoney(val: number) {
  return (val || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
</script>

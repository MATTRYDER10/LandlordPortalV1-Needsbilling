<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="$emit('close')"></div>
      <div :class="['relative w-full max-w-lg rounded-2xl shadow-2xl', isDark ? 'bg-slate-900' : 'bg-white']">
        <div :class="['px-6 py-4 border-b', isDark ? 'border-slate-700' : 'border-gray-200']">
          <h2 class="text-lg font-semibold">Batch Payout — {{ payouts.length }} items</h2>
        </div>

        <div class="p-6 space-y-4">
          <div :class="['rounded-xl p-4', isDark ? 'bg-slate-800' : 'bg-gray-50']">
            <div class="flex justify-between text-sm mb-2">
              <span>Total rent received</span>
              <span class="font-medium">&pound;{{ formatMoney(totalGross) }}</span>
            </div>
            <div class="flex justify-between text-sm mb-2">
              <span>Total charges</span>
              <span class="font-medium text-red-500">-&pound;{{ formatMoney(totalCharges) }}</span>
            </div>
            <div :class="['flex justify-between font-bold pt-2 border-t', isDark ? 'border-slate-600' : 'border-gray-300']">
              <span>Total payouts</span>
              <span class="text-emerald-500">&pound;{{ formatMoney(totalNet) }}</span>
            </div>
          </div>

          <div class="space-y-2">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" v-model="sendStatements" class="rounded text-primary" />
              <span class="text-sm">Send all statements</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" v-model="logStatements" class="rounded text-primary" />
              <span class="text-sm">Log all to documents</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" v-model="sendReceipts" class="rounded text-primary" />
              <span class="text-sm">Send all tenant receipts</span>
            </label>
          </div>
        </div>

        <div :class="['px-6 py-4 border-t flex justify-end gap-3', isDark ? 'border-slate-700' : 'border-gray-200']">
          <button @click="$emit('close')" :class="['px-4 py-2 text-sm font-medium rounded-lg', isDark ? 'bg-slate-800' : 'bg-gray-100']">Cancel</button>
          <button @click="processBatch" class="px-4 py-2 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg">
            Mark All Paid & Send
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDarkMode } from '../../composables/useDarkMode'
import { useRentGooseStore, type PayoutItem } from '../../stores/rentgoose'

const props = defineProps<{ payouts: PayoutItem[] }>()
const emit = defineEmits<{ close: []; completed: [] }>()

const { isDark } = useDarkMode()
const store = useRentGooseStore()

const sendStatements = ref(true)
const logStatements = ref(true)
const sendReceipts = ref(true)

const totalGross = computed(() => props.payouts.reduce((s, p) => s + p.gross_rent, 0))
const totalCharges = computed(() => props.payouts.reduce((s, p) => s + p.total_charges, 0))
const totalNet = computed(() => props.payouts.reduce((s, p) => s + p.net_payout, 0))

function processBatch() {
  store.batchPayout({
    schedule_entry_ids: props.payouts.map(p => p.schedule_entry_id),
    send_statements: sendStatements.value,
    log_statements: logStatements.value,
    send_tenant_receipts: sendReceipts.value,
  })
  emit('completed')
}

function formatMoney(val: number) {
  return (val || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
</script>

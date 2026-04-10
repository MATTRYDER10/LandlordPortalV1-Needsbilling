<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="$emit('close')"></div>
      <div :class="['relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl', isDark ? 'bg-slate-900' : 'bg-white']">
        <!-- Header -->
        <div :class="['px-6 py-4 border-b flex items-center justify-between', isDark ? 'border-slate-700' : 'border-gray-200']">
          <div>
            <h2 :class="['text-lg font-semibold', isDark ? 'text-white' : 'text-gray-900']">Agent Payout Summary</h2>
            <p :class="['text-sm', isDark ? 'text-slate-400' : 'text-gray-500']">{{ charges.length }} charge{{ charges.length !== 1 ? 's' : '' }} ready to pay out</p>
          </div>
          <button @click="$emit('close')" :class="['p-1 rounded-lg', isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-gray-100 text-gray-500']">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-6 space-y-5">
          <!-- Totals at top -->
          <div :class="['grid grid-cols-3 gap-3 rounded-xl p-4 border', isDark ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200']">
            <div>
              <p :class="['text-[11px] uppercase tracking-wide font-semibold', isDark ? 'text-slate-400' : 'text-gray-500']">Net</p>
              <p :class="['text-lg font-bold tabular-nums mt-0.5', isDark ? 'text-white' : 'text-gray-900']">&pound;{{ formatMoney(totalNet) }}</p>
            </div>
            <div>
              <p :class="['text-[11px] uppercase tracking-wide font-semibold', isDark ? 'text-slate-400' : 'text-gray-500']">VAT</p>
              <p :class="['text-lg font-bold tabular-nums mt-0.5', isDark ? 'text-white' : 'text-gray-900']">&pound;{{ formatMoney(totalVat) }}</p>
            </div>
            <div>
              <p :class="['text-[11px] uppercase tracking-wide font-semibold', isDark ? 'text-slate-400' : 'text-gray-500']">Gross</p>
              <p class="text-lg font-bold tabular-nums mt-0.5 text-primary">&pound;{{ formatMoney(totalGross) }}</p>
            </div>
          </div>

          <!-- Charges list grouped by property -->
          <div>
            <h3 :class="['text-xs font-semibold uppercase tracking-wide mb-2', isDark ? 'text-slate-400' : 'text-gray-500']">Properties &amp; Fees</h3>
            <div :class="['rounded-xl border overflow-hidden', isDark ? 'border-slate-700' : 'border-gray-200']">
              <div v-for="(items, address) in chargesByProperty" :key="address" :class="['border-b last:border-b-0', isDark ? 'border-slate-700' : 'border-gray-200']">
                <div :class="['px-4 py-2 text-xs font-semibold', isDark ? 'bg-slate-800 text-slate-300' : 'bg-gray-50 text-gray-600']">
                  <a
                    v-if="items[0]?.property_id"
                    :href="`/properties/${items[0].property_id}`"
                    target="_blank"
                    rel="noopener"
                    class="text-primary hover:underline"
                  >{{ address }}</a>
                  <span v-else>{{ address }}</span>
                </div>
                <div v-for="c in items" :key="c.id" :class="['px-4 py-2 text-sm flex items-center justify-between', isDark ? 'text-slate-200' : 'text-gray-700']">
                  <span>{{ c.description }}</span>
                  <div class="flex items-center gap-4 text-xs">
                    <span :class="isDark ? 'text-slate-500' : 'text-gray-400'">Net £{{ formatMoney(c.net_amount) }}</span>
                    <span :class="isDark ? 'text-slate-500' : 'text-gray-400'">VAT £{{ formatMoney(c.vat_amount) }}</span>
                    <span :class="['font-medium tabular-nums', isDark ? 'text-white' : 'text-gray-900']">£{{ formatMoney(c.gross_amount) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p :class="['text-xs', isDark ? 'text-slate-500' : 'text-gray-500']">
            Confirming this payout will deduct &pound;{{ formatMoney(totalGross) }} from your client account and mark these fees as collected.
          </p>
        </div>

        <!-- Footer -->
        <div :class="['px-6 py-4 border-t flex justify-end gap-3', isDark ? 'border-slate-700' : 'border-gray-200']">
          <button @click="$emit('close')" :class="['px-4 py-2 text-sm font-medium rounded-lg', isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700']">
            Cancel
          </button>
          <button
            @click="confirm"
            :disabled="processing"
            class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-orange-600 rounded-lg disabled:opacity-50 transition-colors"
          >
            {{ processing ? 'Processing...' : `Confirm Payout £${formatMoney(totalGross)}` }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDarkMode } from '../../composables/useDarkMode'
import { useApi } from '../../composables/useApi'

interface AgentChargeItem {
  id: string
  description: string
  net_amount: number
  vat_amount: number
  gross_amount: number
  property_address: string
  property_id?: string
}

const props = defineProps<{
  charges: AgentChargeItem[]
}>()

const emit = defineEmits<{
  close: []
  paid: []
}>()

const { isDark } = useDarkMode()
const { post } = useApi()

const processing = ref(false)

const totalNet = computed(() => props.charges.reduce((s, c) => s + (c.net_amount || 0), 0))
const totalVat = computed(() => props.charges.reduce((s, c) => s + (c.vat_amount || 0), 0))
const totalGross = computed(() => props.charges.reduce((s, c) => s + (c.gross_amount || 0), 0))

const chargesByProperty = computed(() => {
  const grouped: Record<string, AgentChargeItem[]> = {}
  for (const c of props.charges) {
    if (!grouped[c.property_address]) grouped[c.property_address] = []
    grouped[c.property_address].push(c)
  }
  return grouped
})

function formatMoney(val: number): string {
  return (val || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function confirm() {
  if (processing.value) return
  processing.value = true
  try {
    await post('/api/rentgoose/agent-payout', {
      charge_ids: props.charges.map(c => c.id),
    })
    emit('paid')
    emit('close')
  } catch (err) {
    console.error('Failed to process agent payout:', err)
  } finally {
    processing.value = false
  }
}
</script>

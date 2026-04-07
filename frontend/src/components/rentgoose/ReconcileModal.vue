<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="$emit('close')"></div>
      <div :class="['relative w-full max-w-md rounded-2xl shadow-2xl', isDark ? 'bg-slate-900' : 'bg-white']">
        <div :class="['px-6 py-4 border-b', isDark ? 'border-slate-700' : 'border-gray-200']">
          <h2 class="text-lg font-semibold">Reconcile Client Account</h2>
        </div>
        <div class="p-6 space-y-4">
          <p :class="['text-sm', isDark ? 'text-slate-400' : 'text-gray-500']">Enter the closing balance from your bank statement to check against the system balance.</p>
          <div>
            <label :class="labelClass">Bank Statement Balance</label>
            <input v-model.number="bankBalance" type="number" step="0.01" :class="inputClass" placeholder="0.00" />
          </div>
          <div>
            <label :class="labelClass">Statement Date</label>
            <input v-model="statementDate" type="date" :class="inputClass" />
          </div>
          <div v-if="result" :class="['rounded-xl p-4 border', result.matches ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800']">
            <p v-if="result.matches" class="text-sm font-medium text-emerald-600 dark:text-emerald-400">Balances match. Reconciliation recorded.</p>
            <p v-else class="text-sm font-medium text-red-600 dark:text-red-400">Variance: &pound;{{ result.variance.toFixed(2) }}. Please add manual entries to correct.</p>
          </div>
        </div>
        <div :class="['px-6 py-4 border-t flex justify-end gap-3', isDark ? 'border-slate-700' : 'border-gray-200']">
          <button @click="$emit('close')" :class="['px-4 py-2 text-sm rounded-lg', isDark ? 'bg-slate-800' : 'bg-gray-100']">Close</button>
          <button @click="reconcile" :disabled="!bankBalance" class="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg disabled:opacity-50">Reconcile</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDarkMode } from '../../composables/useDarkMode'
import { useRentGooseStore } from '../../stores/rentgoose'

const emit = defineEmits<{ close: []; reconciled: [] }>()
const { isDark } = useDarkMode()
const store = useRentGooseStore()

const bankBalance = ref<number>(0)
const statementDate = ref(new Date().toISOString().split('T')[0])
const result = ref<{ matches: boolean; variance: number } | null>(null)

async function reconcile() {
  result.value = await store.reconcile({ bank_balance: bankBalance.value, date: statementDate.value })
  if (result.value?.matches) {
    setTimeout(() => emit('reconciled'), 1500)
  }
}

const labelClass = computed(() => `block text-xs font-medium uppercase tracking-wide mb-1 ${isDark.value ? 'text-slate-400' : 'text-gray-500'}`)
const inputClass = computed(() => `w-full px-3 py-2 text-sm rounded-lg border ${isDark.value ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300'} focus:ring-2 focus:ring-primary/50`)
</script>

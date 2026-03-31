<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="$emit('close')"></div>
      <div :class="['relative w-full max-w-md rounded-2xl shadow-2xl', isDark ? 'bg-slate-900' : 'bg-white']">
        <div :class="['px-6 py-4 border-b', isDark ? 'border-slate-700' : 'border-gray-200']">
          <h2 class="text-lg font-semibold">Add Manual Entry</h2>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label :class="labelClass">Type</label>
            <select v-model="form.entry_type" :class="inputClass">
              <option value="manual_credit">Credit (money in)</option>
              <option value="manual_debit">Debit (money out)</option>
              <option value="opening_balance">Opening Balance</option>
            </select>
          </div>
          <div>
            <label :class="labelClass">Amount</label>
            <input v-model.number="form.amount" type="number" step="0.01" :class="inputClass" placeholder="0.00" />
          </div>
          <div>
            <label :class="labelClass">Description</label>
            <input v-model="form.description" type="text" :class="inputClass" placeholder="e.g. Bank charges" />
          </div>
          <div>
            <label :class="labelClass">Reference (optional)</label>
            <input v-model="form.reference" type="text" :class="inputClass" />
          </div>
        </div>
        <div :class="['px-6 py-4 border-t flex justify-end gap-3', isDark ? 'border-slate-700' : 'border-gray-200']">
          <button @click="$emit('close')" :class="['px-4 py-2 text-sm rounded-lg', isDark ? 'bg-slate-800' : 'bg-gray-100']">Cancel</button>
          <button @click="save" :disabled="!form.amount || !form.description" class="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg disabled:opacity-50">Save</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDarkMode } from '../../composables/useDarkMode'
import { useRentGooseStore } from '../../stores/rentgoose'

const emit = defineEmits<{ close: []; saved: [] }>()
const { isDark } = useDarkMode()
const store = useRentGooseStore()

const form = ref({ entry_type: 'manual_credit', amount: 0, description: '', reference: '' })

async function save() {
  await store.addManualEntry(form.value)
  emit('saved')
}

const labelClass = computed(() => `block text-xs font-medium uppercase tracking-wide mb-1 ${isDark.value ? 'text-slate-400' : 'text-gray-500'}`)
const inputClass = computed(() => `w-full px-3 py-2 text-sm rounded-lg border ${isDark.value ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300'} focus:ring-2 focus:ring-primary/50`)
</script>

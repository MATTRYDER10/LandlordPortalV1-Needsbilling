<template>
  <div v-if="show" class="fixed inset-0 z-50 overflow-y-auto">
    <div class="fixed inset-0 bg-gray-500 bg-opacity-75" @click="$emit('close')"></div>
    <div class="flex min-h-full items-center justify-center p-4">
      <div class="relative bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full">
        <form @submit.prevent="handleSubmit">
          <div class="px-6 pt-6 pb-4">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Add Charge</h3>
              <button type="button" @click="$emit('close')" class="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                &times;
              </button>
            </div>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Description</label>
                <input
                  v-model="form.description"
                  type="text"
                  required
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-md"
                  placeholder="e.g. Admin fee"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Amount (£)</label>
                <input
                  v-model.number="form.amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-md"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Type</label>
                <select
                  v-model="form.charge_type"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-md"
                >
                  <option value="recurring">Recurring (monthly)</option>
                  <option value="one_off">One-off</option>
                </select>
              </div>

              <div class="flex items-center gap-2">
                <input
                  v-model="form.is_vatable"
                  type="checkbox"
                  id="vatable"
                  class="rounded border-gray-300 dark:border-slate-600"
                />
                <label for="vatable" class="text-sm text-gray-700 dark:text-slate-300">Subject to VAT (20%)</label>
              </div>

              <div v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</div>
            </div>
          </div>

          <div class="bg-gray-50 dark:bg-slate-800 px-6 py-4 flex justify-end gap-3 rounded-b-lg">
            <button type="button" @click="$emit('close')" class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:text-gray-900">
              Cancel
            </button>
            <button
              type="submit"
              :disabled="saving"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50"
            >
              {{ saving ? 'Adding...' : 'Add Charge' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useApi } from '../../composables/useApi'

const props = defineProps<{
  show: boolean
  propertyId: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved'): void
}>()

const { post } = useApi()
const saving = ref(false)
const error = ref('')

const form = ref({
  description: '',
  amount: null as number | null,
  charge_type: 'recurring',
  is_vatable: false
})

async function handleSubmit() {
  saving.value = true
  error.value = ''
  try {
    await post(`/api/property-charges/${props.propertyId}`, {
      description: form.value.description,
      amount: form.value.amount,
      charge_type: form.value.charge_type,
      is_vatable: form.value.is_vatable
    })
    emit('saved')
  } catch (err: any) {
    error.value = err.message || 'Failed to add charge'
  } finally {
    saving.value = false
  }
}
</script>

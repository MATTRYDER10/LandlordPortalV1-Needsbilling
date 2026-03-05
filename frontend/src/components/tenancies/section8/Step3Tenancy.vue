<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">Tenancy Details</h3>
      <p class="text-sm text-gray-500 dark:text-slate-400">Enter the key details from the tenancy agreement.</p>
    </div>

    <!-- Tenancy Start Date -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
        Tenancy Start Date *
      </label>
      <input
        :value="formState.tenancyStartDate"
        @input="emit('update', { tenancyStartDate: ($event.target as HTMLInputElement).value })"
        type="date"
        class="w-48 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm dark:bg-slate-900 dark:text-white"
      />
      <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">The date the original tenancy agreement began</p>
    </div>

    <!-- Rent Amount and Frequency -->
    <div class="grid md:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
          Rent Amount *
        </label>
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400">£</span>
          <input
            :value="formState.rentAmount || ''"
            @input="emit('update', { rentAmount: parseFloat(($event.target as HTMLInputElement).value) || null })"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            class="w-full pl-7 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm dark:bg-slate-900 dark:text-white"
          />
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
          Rent Frequency *
        </label>
        <select
          :value="formState.rentFrequency"
          @change="emit('update', { rentFrequency: ($event.target as HTMLSelectElement).value as any })"
          class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm dark:bg-slate-900 dark:text-white"
        >
          <option value="weekly">Weekly</option>
          <option value="fortnightly">Fortnightly</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>
    </div>

    <!-- Rent Due Date -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
        Rent Due Date *
      </label>
      <input
        :value="formState.rentDueDay"
        @input="emit('update', { rentDueDay: ($event.target as HTMLInputElement).value })"
        type="text"
        placeholder="e.g., 1st of the month, every Monday"
        class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm dark:bg-slate-900 dark:text-white"
      />
      <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">Describe when rent is due (free text)</p>
    </div>

    <!-- Summary Panel -->
    <div v-if="formState.rentAmount && formState.rentFrequency" class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
      <div class="flex items-center gap-2 text-blue-800 dark:text-blue-300">
        <Info class="w-5 h-5 flex-shrink-0" />
        <div>
          <p class="font-medium dark:text-blue-200">Rent Summary</p>
          <p class="text-sm">
            £{{ formState.rentAmount.toLocaleString('en-GB', { minimumFractionDigits: 2 }) }} {{ rentFrequencyLabel }}
          </p>
          <p v-if="formState.rentDueDay" class="text-sm text-blue-600 dark:text-blue-400 mt-1">
            Due: {{ formState.rentDueDay }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Info } from 'lucide-vue-next'
import type { S8FormState } from '@/types/section8'

interface Props {
  formState: S8FormState
}

const props = defineProps<Props>()

const emit = defineEmits<{
  update: [updates: Partial<S8FormState>]
}>()

const rentFrequencyLabel = computed(() => {
  const labels: Record<string, string> = {
    weekly: 'per week',
    fortnightly: 'per fortnight',
    monthly: 'per month',
    quarterly: 'per quarter',
    yearly: 'per year',
  }
  return labels[props.formState.rentFrequency || ''] || ''
})
</script>

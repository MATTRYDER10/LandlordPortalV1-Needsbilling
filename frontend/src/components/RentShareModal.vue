<template>
  <div v-if="isOpen" class="fixed inset-0 bg-gray-600 dark:bg-slate-900 bg-opacity-50 dark:bg-opacity-70 overflow-y-auto h-full w-full z-50"
    @click.self="$emit('close')">
    <div class="relative top-20 mx-auto p-5 border border-gray-200 dark:border-slate-700 w-full max-w-lg shadow-lg rounded-md bg-white dark:bg-slate-800">
      <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-2">Set Rent Shares</h3>
      <p class="text-sm text-gray-600 dark:text-slate-400 mb-4">
        Specify how the monthly rent of <strong class="text-gray-900 dark:text-white">{{ formatCurrency(totalRent) }}</strong> is split between tenants.
      </p>

      <!-- Tenants List -->
      <div class="space-y-4 mb-6">
        <div v-for="(tenant, index) in localTenants" :key="tenant.id"
          class="p-4 border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700/50">
          <div class="flex justify-between items-center mb-2">
            <span class="font-medium text-gray-900 dark:text-white">{{ tenant.name }}</span>
            <span class="text-sm text-gray-500 dark:text-slate-400">
              {{ formatPercentage(tenant.rentShare) }}%
            </span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-gray-500 dark:text-slate-400">£</span>
            <input
              v-model.number="tenant.rentShare"
              type="number"
              step="0.01"
              min="0"
              :max="totalRent"
              class="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              @input="updatePercentages"
            />
            <span class="text-sm text-gray-500 dark:text-slate-400">/month</span>
          </div>
        </div>
      </div>

      <!-- Total and Validation -->
      <div class="mb-4 p-3 rounded-lg" :class="isValid ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'">
        <div class="flex justify-between items-center">
          <span class="text-sm font-medium" :class="isValid ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'">
            Total:
          </span>
          <span class="font-bold" :class="isValid ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'">
            {{ formatCurrency(totalAllocated) }} / {{ formatCurrency(totalRent) }}
          </span>
        </div>
        <p v-if="!isValid" class="text-xs mt-1" :class="isValid ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'">
          {{ difference > 0 ? `£${formatNumber(difference)} over allocated` : `£${formatNumber(Math.abs(difference))} remaining` }}
        </p>
        <p v-else class="text-xs mt-1 text-green-700 dark:text-green-400">
          All rent allocated correctly
        </p>
      </div>

      <!-- Split Evenly Button -->
      <button
        @click="splitEvenly"
        class="w-full mb-4 px-4 py-2 text-sm font-medium text-primary dark:text-primary-light bg-primary/10 dark:bg-primary/20 hover:bg-primary/20 dark:hover:bg-primary/30 rounded-md transition-colors"
      >
        Split Evenly
      </button>

      <!-- Action Buttons -->
      <div class="flex gap-3">
        <button
          @click="handleConfirm"
          :disabled="!isValid || saving"
          class="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ saving ? 'Saving...' : 'Confirm & Continue' }}
        </button>
        <button
          @click="$emit('close')"
          :disabled="saving"
          class="flex-1 px-4 py-2 bg-gray-300 dark:bg-slate-600 text-gray-700 dark:text-slate-300 text-sm font-medium rounded-md hover:bg-gray-400 dark:hover:bg-slate-500"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface Tenant {
  id: string
  name: string
  rentShare: number
  rentSharePercentage?: number
}

const props = defineProps<{
  isOpen: boolean
  tenants: Array<{
    id: string
    name: string
    rent_share?: number | null
    rent_share_percentage?: number | null
  }>
  totalRent: number
  saving?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', tenantShares: Array<{ tenantId: string; rentShare: number }>): void
}>()

const localTenants = ref<Tenant[]>([])

// Initialize local tenants when props change
watch(() => [props.isOpen, props.tenants, props.totalRent], () => {
  if (props.isOpen && props.tenants.length > 0) {
    const defaultShare = props.totalRent / props.tenants.length
    localTenants.value = props.tenants.map(t => ({
      id: t.id,
      name: t.name,
      rentShare: t.rent_share != null ? Number(t.rent_share) : defaultShare
    }))
  }
}, { immediate: true })

const totalAllocated = computed(() => {
  return localTenants.value.reduce((sum, t) => sum + (Number(t.rentShare) || 0), 0)
})

const difference = computed(() => {
  return totalAllocated.value - props.totalRent
})

const isValid = computed(() => {
  return Math.abs(difference.value) < 0.01
})

const updatePercentages = () => {
  // Percentages are computed on display, no need to store
}

const formatCurrency = (amount: number) => {
  return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const formatNumber = (amount: number) => {
  return amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatPercentage = (amount: number) => {
  if (props.totalRent === 0) return '0'
  return ((amount / props.totalRent) * 100).toFixed(0)
}

const splitEvenly = () => {
  const shareAmount = props.totalRent / localTenants.value.length
  // Round all but last to 2 decimal places
  let remaining = props.totalRent
  localTenants.value.forEach((tenant, index) => {
    if (index === localTenants.value.length - 1) {
      // Last tenant gets remainder to ensure exact total
      tenant.rentShare = Math.round(remaining * 100) / 100
    } else {
      tenant.rentShare = Math.round(shareAmount * 100) / 100
      remaining -= tenant.rentShare
    }
  })
}

const handleConfirm = () => {
  if (!isValid.value) return

  const tenantShares = localTenants.value.map(t => ({
    tenantId: t.id,
    rentShare: t.rentShare
  }))

  emit('confirm', tenantShares)
}
</script>

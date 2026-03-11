<template>
  <div
    class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 hover:border-primary hover:shadow-md transition-all cursor-pointer"
    @click="$emit('select', item)"
  >
    <div class="flex items-start justify-between">
      <div class="flex-1">
        <div class="flex items-center gap-2">
          <h3 class="font-semibold text-gray-900 dark:text-white">
            {{ item.tenant_name || 'Unknown Tenant' }}
          </h3>
          <span
            v-if="item.is_verbal"
            class="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-full"
          >
            Verbal
          </span>
          <span
            v-if="item.is_guarantor"
            class="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full"
          >
            Guarantor
          </span>
        </div>
        <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">
          {{ item.property_address }}
        </p>
        <p class="text-xs text-gray-400 dark:text-slate-500 mt-1">
          {{ item.company_name }}
        </p>
      </div>

      <div class="text-right">
        <div
          class="text-sm font-medium"
          :class="ageColor"
        >
          {{ formattedAge }}
        </div>
        <div class="text-xs text-gray-400 mt-0.5">in queue</div>
      </div>
    </div>

    <!-- Additional info row -->
    <div class="mt-3 flex items-center justify-between text-sm">
      <div class="flex items-center gap-4">
        <span class="text-gray-500 dark:text-slate-400">
          Rent: £{{ item.rent_share || item.monthly_rent }}/mo
        </span>
        <span v-if="item.move_in_date" class="text-gray-500 dark:text-slate-400">
          Move: {{ formatDate(item.move_in_date) }}
        </span>
      </div>
      <ChevronRight class="w-5 h-5 text-gray-400" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRight } from 'lucide-vue-next'

interface QueueItemData {
  id: string
  tenant_name: string
  property_address: string
  company_name: string
  rent_share?: number
  monthly_rent?: number
  move_in_date?: string
  is_verbal?: boolean
  is_guarantor?: boolean
  age_hours?: number
  queue_entered_at?: string
}

const props = defineProps<{
  item: QueueItemData
}>()

defineEmits<{
  select: [item: QueueItemData]
}>()

const formattedAge = computed(() => {
  const hours = props.item.age_hours || calculateAge()
  if (hours < 1) return '< 1 hour'
  if (hours < 24) return `${Math.floor(hours)} hours`
  const days = Math.floor(hours / 24)
  return `${days} day${days > 1 ? 's' : ''}`
})

const ageColor = computed(() => {
  const hours = props.item.age_hours || calculateAge()
  if (hours >= 48) return 'text-red-600 dark:text-red-400'
  if (hours >= 24) return 'text-amber-600 dark:text-amber-400'
  return 'text-gray-600 dark:text-slate-300'
})

function calculateAge(): number {
  if (!props.item.queue_entered_at) return 0
  const entered = new Date(props.item.queue_entered_at)
  const now = new Date()
  return (now.getTime() - entered.getTime()) / (1000 * 60 * 60)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short'
  })
}
</script>

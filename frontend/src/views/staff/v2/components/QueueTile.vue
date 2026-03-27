<template>
  <button
    @click="$emit('click')"
    class="p-4 rounded-xl border-2 transition-all hover:shadow-lg hover:scale-[1.02] text-left"
    :class="[
      isActive
        ? 'border-primary bg-primary/5 shadow-md'
        : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary/50',
      large ? 'col-span-2' : ''
    ]"
  >
    <div class="flex items-start justify-between">
      <div>
        <div class="flex items-center gap-2">
          <component :is="icon" class="w-5 h-5" :class="iconColor" />
          <span class="font-semibold text-gray-900 dark:text-white">{{ title }}</span>
        </div>
        <p v-if="subtitle" class="text-xs text-gray-500 dark:text-slate-400 mt-1">{{ subtitle }}</p>
      </div>
      <div class="text-right">
        <div class="text-2xl font-bold" :class="countColor">{{ count }}</div>
        <div class="text-xs text-gray-500 dark:text-slate-400">{{ countLabel }}</div>
      </div>
    </div>

    <!-- Urgency indicator -->
    <div v-if="urgentCount > 0" class="mt-3 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
      <AlertCircle class="w-3.5 h-3.5" />
      <span>{{ urgentCount }} urgent (24h+)</span>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { AlertCircle } from 'lucide-vue-next'

const props = defineProps<{
  title: string
  subtitle?: string
  count: number
  countLabel?: string
  icon: any
  urgentCount?: number
  isActive?: boolean
  large?: boolean
  variant?: 'default' | 'success' | 'warning' | 'danger'
}>()

defineEmits<{
  click: []
}>()

const iconColor = computed(() => {
  switch (props.variant) {
    case 'success': return 'text-green-600'
    case 'warning': return 'text-amber-600'
    case 'danger': return 'text-red-600'
    default: return 'text-primary'
  }
})

const countColor = computed(() => {
  if (props.count === 0) return 'text-gray-400 dark:text-slate-500'
  switch (props.variant) {
    case 'success': return 'text-green-600'
    case 'warning': return 'text-amber-600'
    case 'danger': return 'text-red-600'
    default: return 'text-gray-900 dark:text-white'
  }
})
</script>

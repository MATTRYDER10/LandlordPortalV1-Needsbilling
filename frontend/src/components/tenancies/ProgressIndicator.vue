<template>
  <div
    class="relative group/indicator"
    @mouseenter="showTooltip = true"
    @mouseleave="showTooltip = false"
  >
    <!-- Indicator Circle -->
    <div
      class="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300"
      :class="indicatorClasses"
    >
      <component
        :is="iconComponent"
        class="w-3.5 h-3.5 transition-transform duration-300"
        :class="{ 'scale-110': completed }"
      />
    </div>

    <!-- Tooltip -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-1"
    >
      <div
        v-if="showTooltip"
        class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-900 dark:bg-slate-700 text-white text-xs font-medium rounded-lg whitespace-nowrap shadow-xl z-50"
      >
        {{ label }}
        <span
          class="block text-[10px] font-normal"
          :class="completed ? 'text-emerald-400' : 'text-slate-400'"
        >
          {{ completed ? 'Complete' : 'Pending' }}
        </span>
        <!-- Arrow -->
        <div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900 dark:border-t-slate-700" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  FileText,
  PenTool,
  Package,
  CreditCard,
  Clock,
  Check
} from 'lucide-vue-next'

const props = defineProps<{
  completed: boolean
  label: string
  icon: 'file-text' | 'pen-tool' | 'package' | 'credit-card' | 'clock'
}>()

const showTooltip = ref(false)

const iconMap = {
  'file-text': FileText,
  'pen-tool': PenTool,
  'package': Package,
  'credit-card': CreditCard,
  'clock': Clock
}

const iconComponent = computed(() => {
  return props.completed ? Check : iconMap[props.icon]
})

const indicatorClasses = computed(() => {
  if (props.completed) {
    return 'bg-emerald-500 text-white shadow-sm shadow-emerald-200 dark:shadow-emerald-900/50'
  }
  return 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
})
</script>

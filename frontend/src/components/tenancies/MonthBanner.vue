<template>
  <div class="month-banner relative my-5 first:mt-0">
    <!-- Background accent -->
    <div class="absolute inset-0 overflow-hidden rounded-lg">
      <div
        class="absolute inset-0 opacity-[0.03]"
        :style="{
          backgroundImage: `radial-gradient(circle at 20% 50%, ${accentColor} 0%, transparent 50%),
                           radial-gradient(circle at 80% 50%, ${accentColor} 0%, transparent 50%)`
        }"
      />
    </div>

    <div class="relative flex items-center gap-3 px-4 py-3">
      <!-- Month Icon -->
      <div
        class="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm"
        :class="iconBgClass"
      >
        <Calendar class="w-5 h-5" :class="iconColorClass" />
      </div>

      <!-- Month Text -->
      <div class="flex-1">
        <h3 class="text-base font-bold text-slate-900 dark:text-white">{{ monthName }}</h3>
        <p class="text-xs text-slate-500 dark:text-slate-400">{{ tenancyCount }} {{ tenancyCount === 1 ? 'tenancy' : 'tenancies' }} moving in</p>
      </div>

      <!-- Month indicator line -->
      <div class="flex-shrink-0 flex items-center gap-2.5">
        <div class="h-px w-14 bg-gradient-to-r from-slate-200 dark:from-slate-700 to-transparent" />
        <span class="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">{{ year }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Calendar } from 'lucide-vue-next'

const props = defineProps<{
  month: number // 0-11
  year: number
  tenancyCount: number
  isCurrentMonth?: boolean
}>()

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const monthName = computed(() => monthNames[props.month])

// Color scheme varies by month for visual interest
const monthColors = [
  { bg: 'bg-blue-100', color: 'text-blue-600', accent: '#3B82F6' },      // Jan
  { bg: 'bg-rose-100', color: 'text-rose-600', accent: '#F43F5E' },      // Feb
  { bg: 'bg-emerald-100', color: 'text-emerald-600', accent: '#10B981' }, // Mar
  { bg: 'bg-violet-100', color: 'text-violet-600', accent: '#8B5CF6' },  // Apr
  { bg: 'bg-pink-100', color: 'text-pink-600', accent: '#EC4899' },      // May
  { bg: 'bg-amber-100', color: 'text-amber-600', accent: '#F59E0B' },    // Jun
  { bg: 'bg-cyan-100', color: 'text-cyan-600', accent: '#06B6D4' },      // Jul
  { bg: 'bg-orange-100', color: 'text-orange-600', accent: '#F97316' },  // Aug
  { bg: 'bg-teal-100', color: 'text-teal-600', accent: '#14B8A6' },      // Sep
  { bg: 'bg-indigo-100', color: 'text-indigo-600', accent: '#6366F1' },  // Oct
  { bg: 'bg-slate-200', color: 'text-slate-600', accent: '#64748B' },    // Nov
  { bg: 'bg-red-100', color: 'text-red-600', accent: '#EF4444' }         // Dec
]

const iconBgClass = computed(() => {
  if (props.isCurrentMonth) return 'bg-primary/10'
  const colors = monthColors[props.month]
  return colors?.bg ?? 'bg-slate-100'
})

const iconColorClass = computed(() => {
  if (props.isCurrentMonth) return 'text-primary'
  const colors = monthColors[props.month]
  return colors?.color ?? 'text-slate-600'
})

const accentColor = computed(() => {
  if (props.isCurrentMonth) return '#fe7a0f'
  const colors = monthColors[props.month]
  return colors?.accent ?? '#64748B'
})
</script>

<style scoped>
.month-banner {
  animation: fadeSlideIn 0.4s ease-out;
}

@keyframes fadeSlideIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

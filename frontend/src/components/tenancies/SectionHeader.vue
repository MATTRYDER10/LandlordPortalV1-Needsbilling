<template>
  <div class="section-header relative">
    <!-- Header Content -->
    <div
      class="flex items-center justify-between px-6 py-5 rounded-2xl border transition-all duration-300"
      :class="headerClasses"
    >
      <div class="flex items-center gap-4">
        <!-- Icon -->
        <div
          class="w-12 h-12 rounded-xl flex items-center justify-center"
          :class="iconClasses"
        >
          <component :is="icon" class="w-6 h-6" />
        </div>

        <!-- Title & Count -->
        <div>
          <h2 class="text-xl font-bold" :class="titleClass">{{ title }}</h2>
          <p class="text-sm mt-0.5" :class="subtitleClass">
            {{ count }} {{ count === 1 ? 'tenancy' : 'tenancies' }}
          </p>
        </div>
      </div>

      <!-- Expand/Collapse Button (for collapsible sections) -->
      <button
        v-if="collapsible"
        @click="$emit('toggle')"
        class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        :class="buttonClasses"
      >
        {{ expanded ? 'Collapse' : 'Expand' }}
        <ChevronDown
          class="w-4 h-4 transition-transform duration-300"
          :class="{ 'rotate-180': expanded }"
        />
      </button>
    </div>

    <!-- Decorative bottom line -->
    <div class="mt-2 h-0.5 rounded-full mx-6" :class="lineClass" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ChevronDown, FileEdit, CheckCircle2 } from 'lucide-vue-next'

const props = defineProps<{
  title: string
  count: number
  variant: 'draft' | 'active'
  collapsible?: boolean
  expanded?: boolean
}>()

defineEmits<{
  toggle: []
}>()

const icon = computed(() => {
  return props.variant === 'draft' ? FileEdit : CheckCircle2
})

const headerClasses = computed(() => {
  if (props.variant === 'draft') {
    return 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200/50'
  }
  return 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200/50'
})

const iconClasses = computed(() => {
  if (props.variant === 'draft') {
    return 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-200'
  }
  return 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-200'
})

const titleClass = computed(() => {
  if (props.variant === 'draft') return 'text-amber-900'
  return 'text-emerald-900'
})

const subtitleClass = computed(() => {
  if (props.variant === 'draft') return 'text-amber-700/70'
  return 'text-emerald-700/70'
})

const buttonClasses = computed(() => {
  if (props.variant === 'draft') {
    return 'bg-amber-100 text-amber-700 hover:bg-amber-200'
  }
  return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
})

const lineClass = computed(() => {
  if (props.variant === 'draft') {
    return 'bg-gradient-to-r from-amber-300 via-orange-300 to-transparent'
  }
  return 'bg-gradient-to-r from-emerald-300 via-teal-300 to-transparent'
})
</script>

<style scoped>
.section-header {
  animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

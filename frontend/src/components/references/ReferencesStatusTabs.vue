<template>
  <div class="border-b border-gray-200 bg-white sticky top-0 z-10">
    <nav class="-mb-px flex space-x-8 px-6" aria-label="Tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        @click="$emit('update:modelValue', tab.key as TabKey)"
        class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors"
        :class="[
          modelValue === tab.key
            ? 'border-primary text-primary'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        ]"
      >
        {{ tab.label }}
        <span
          v-if="tab.count !== undefined"
          class="ml-2 py-0.5 px-2 rounded-full text-xs"
          :class="[
            modelValue === tab.key
              ? 'bg-primary/10 text-primary'
              : 'bg-gray-100 text-gray-600'
          ]"
        >
          {{ tab.count }}
        </span>
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TabKey, StatusCounts } from '@/composables/useTenancies'

const props = defineProps<{
  modelValue: TabKey
  counts: StatusCounts
}>()

defineEmits<{
  'update:modelValue': [value: TabKey]
}>()

const tabs = computed(() => [
  { key: 'ALL', label: 'All', count: props.counts.all },
  { key: 'IN_PROGRESS', label: 'In Progress', count: props.counts.inProgress },
  { key: 'ACTION_REQUIRED', label: 'Action Required', count: props.counts.actionRequired },
  { key: 'COMPLETED', label: 'Completed', count: props.counts.completed },
  { key: 'MOVED_IN', label: 'Moved In', count: props.counts.movedIn },
  { key: 'REJECTED', label: 'Rejected', count: props.counts.rejected }
])
</script>

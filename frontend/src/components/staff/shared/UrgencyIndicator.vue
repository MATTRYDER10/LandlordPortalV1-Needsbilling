<template>
  <span :class="['urgency-indicator', urgency.toLowerCase()]">
    <span class="urgency-dot"></span>
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Urgency } from '@/types/staff'

const props = defineProps<{
  urgency: Urgency
  showLabel?: boolean
}>()

const label = computed(() => {
  if (props.showLabel === false) return ''
  const labels: Record<Urgency, string> = {
    NORMAL: 'Normal',
    WARNING: 'Warning',
    URGENT: 'Urgent'
  }
  return labels[props.urgency] || props.urgency
})
</script>

<style scoped>
.urgency-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.urgency-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.urgency-indicator.normal {
  background-color: #d1fae5;
  color: #065f46;
}

.urgency-indicator.normal .urgency-dot {
  background-color: #10b981;
}

.urgency-indicator.warning {
  background-color: #fef3c7;
  color: #92400e;
}

.urgency-indicator.warning .urgency-dot {
  background-color: #f59e0b;
}

.urgency-indicator.urgent {
  background-color: #fee2e2;
  color: #991b1b;
}

.urgency-indicator.urgent .urgency-dot {
  background-color: #ef4444;
}
</style>

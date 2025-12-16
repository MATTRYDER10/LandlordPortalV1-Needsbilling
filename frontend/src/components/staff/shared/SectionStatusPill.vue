<template>
  <span :class="['status-pill', decisionClass]">
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SectionDecision } from '@/types/staff'

const props = defineProps<{
  decision: SectionDecision
}>()

const decisionClass = computed(() => {
  const classMap: Record<SectionDecision, string> = {
    NOT_REVIEWED: 'not-reviewed',
    PASS: 'pass',
    PASS_WITH_CONDITION: 'pass-condition',
    ACTION_REQUIRED: 'action-required',
    FAIL: 'fail'
  }
  return classMap[props.decision] || 'not-reviewed'
})

const label = computed(() => {
  const labelMap: Record<SectionDecision, string> = {
    NOT_REVIEWED: 'Not Reviewed',
    PASS: 'Pass',
    PASS_WITH_CONDITION: 'Pass w/ Condition',
    ACTION_REQUIRED: 'Action Required',
    FAIL: 'Fail'
  }
  return labelMap[props.decision] || props.decision
})
</script>

<style scoped>
.status-pill {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  white-space: nowrap;
}

.status-pill.not-reviewed {
  background: #e5e7eb;
  color: #6b7280;
}

.status-pill.pass {
  background: #d1fae5;
  color: #065f46;
}

.status-pill.pass-condition {
  background: #fef3c7;
  color: #92400e;
}

.status-pill.action-required {
  background: #fed7aa;
  color: #9a3412;
}

.status-pill.fail {
  background: #fee2e2;
  color: #991b1b;
}
</style>

<template>
  <div class="stats-bar">
    <div class="stat-card verify">
      <div class="stat-label">Verify Queue</div>
      <div class="stat-value">{{ stats.verify.total }}</div>
      <div class="stat-breakdown">
        <span class="stat-chip available">
          <span class="dot"></span>
          {{ stats.verify.available }} Available
        </span>
        <span class="stat-chip assigned">
          <span class="dot"></span>
          {{ stats.verify.assigned }} Assigned
        </span>
        <span class="stat-chip in-progress">
          <span class="dot"></span>
          {{ stats.verify.inProgress }} In Progress
        </span>
      </div>
    </div>
    <div class="stat-card chase">
      <div class="stat-label">Chase Queue</div>
      <div class="stat-value">{{ stats.chase.total }}</div>
    </div>
    <div class="stat-card my-items">
      <div class="stat-label">My Active Tasks</div>
      <div class="stat-value">{{ myTasksCount }}</div>
    </div>
    <div class="stat-card email-issues">
      <div class="stat-label">Email Issues</div>
      <div class="stat-value">{{ stats.emailIssues.total }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { QueueStats } from '@/types/staff'

const props = defineProps<{
  stats: QueueStats
}>()

const myTasksCount = computed(() => {
  return props.stats.chase.myItems + props.stats.verify.myItems
})
</script>

<style scoped>
.stats-bar {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  background: white;
  border-radius: 0.5rem;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  min-width: 150px;
}

.stat-card.verify {
  border-left: 4px solid #10b981;
  flex: 2;
}

.stat-card.chase {
  border-left: 4px solid #f59e0b;
}

.stat-card.my-items {
  border-left: 4px solid #6366f1;
}

.stat-card.email-issues {
  border-left: 4px solid #dc2626;
}

.stat-label {
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  color: #6b7280;
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
}

.stat-breakdown {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
}

.stat-chip {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #6b7280;
}

.stat-chip .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.stat-chip.available .dot {
  background-color: #10b981;
}

.stat-chip.assigned .dot {
  background-color: #f59e0b;
}

.stat-chip.in-progress .dot {
  background-color: #3b82f6;
}
</style>

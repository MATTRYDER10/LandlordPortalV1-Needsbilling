<template>
  <div class="my-tasks-tab">
    <!-- Loading State -->
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>Loading your active tasks...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-message">
      <p>{{ error }}</p>
      <button @click="$emit('refresh')" class="btn btn-primary">Retry</button>
    </div>

    <!-- Empty State -->
    <div v-else-if="items.length === 0" class="empty-state">
      <ClipboardList class="mx-auto h-12 w-12 text-gray-400" />
      <p class="mt-2">No active tasks. Pick up items from the Verify or Chase queues to get started.</p>
    </div>

    <!-- Tasks List -->
    <div v-else class="tasks-table">
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Urgency</th>
            <th>Person</th>
            <th>Role</th>
            <th>Property</th>
            <th>Details</th>
            <th>Age</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="task in items" :key="task.id" :class="['task-row', `urgency-${task.urgency.toLowerCase()}`]">
            <td>
              <span :class="['type-badge', task.workType.toLowerCase()]">
                {{ task.workType }}
              </span>
            </td>
            <td>
              <UrgencyIndicator :urgency="task.urgency" />
            </td>
            <td>
              <div class="person-info">
                <div class="person-name">{{ task.personName }}</div>
              </div>
            </td>
            <td>
              <span :class="['role-badge', task.personRole.toLowerCase()]">
                {{ task.personRole }}
              </span>
            </td>
            <td>
              <div class="property-address">{{ task.propertyAddress }}</div>
            </td>
            <td>
              <div v-if="task.workType === 'CHASE' && task.dependencyType" class="task-details">
                <span class="dependency-badge">{{ getDependencyTypeLabel(task.dependencyType) }}</span>
                <span v-if="task.dependencyStatus" :class="['status-badge', task.dependencyStatus.toLowerCase().replace('_', '-')]">
                  {{ task.dependencyStatus.replace('_', ' ') }}
                </span>
              </div>
              <div v-else class="task-details">
                <span class="status-badge in-progress">{{ task.status }}</span>
              </div>
            </td>
            <td>
              <div class="age-info">
                <div class="age-hours">{{ formatHours(task.hoursInQueue) }}</div>
              </div>
            </td>
            <td>
              <div class="actions">
                <button
                  @click="$emit('open', task)"
                  class="btn btn-sm btn-success"
                >
                  Open
                </button>
                <button
                  @click="$emit('release', task)"
                  class="btn btn-sm btn-secondary"
                  :disabled="releasing === task.id"
                >
                  {{ releasing === task.id ? 'Releasing...' : 'Release' }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ActiveTask } from '@/types/staff'
import { getDependencyTypeLabel } from '@/types/staff'
import { ClipboardList } from 'lucide-vue-next'
import UrgencyIndicator from '../shared/UrgencyIndicator.vue'

defineProps<{
  items: ActiveTask[]
  loading: boolean
  error: string | null
  releasing: string | null
}>()

defineEmits<{
  (e: 'open', task: ActiveTask): void
  (e: 'release', task: ActiveTask): void
  (e: 'refresh'): void
}>()

const formatHours = (hours: number) => {
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${Math.round(hours)}h`
  const days = Math.floor(hours / 24)
  return `${days}d ${Math.round(hours % 24)}h`
}
</script>

<style scoped>
.my-tasks-tab {
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.loading {
  text-align: center;
  padding: 3rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e5e7eb;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-message {
  text-align: center;
  padding: 2rem;
  color: #dc2626;
}

.empty-state {
  padding: 3rem;
  text-align: center;
  color: #6b7280;
}

.tasks-table {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  background: #f9fafb;
  padding: 0.75rem 1rem;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  border-bottom: 2px solid #e5e7eb;
  white-space: nowrap;
}

td {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
  vertical-align: middle;
}

.task-row.urgency-urgent {
  background: #fef2f2;
}

.task-row.urgency-warning {
  background: #fffbeb;
}

.type-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.type-badge.verify {
  background: #dbeafe;
  color: #1e40af;
}

.type-badge.chase {
  background: #fed7aa;
  color: #9a3412;
}

.person-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.person-name {
  font-weight: 600;
  color: #1f2937;
}

.role-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.role-badge.tenant {
  background: #dbeafe;
  color: #1e40af;
}

.role-badge.guarantor {
  background: #f3e8ff;
  color: #6b21a8;
}

.property-address {
  font-size: 0.875rem;
  color: #4b5563;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.dependency-badge {
  display: inline-block;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 500;
  background: #e5e7eb;
  color: #374151;
}

.status-badge {
  display: inline-block;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 500;
}

.status-badge.pending {
  background: #e5e7eb;
  color: #374151;
}

.status-badge.chasing {
  background: #dbeafe;
  color: #1e40af;
}

.status-badge.in-progress {
  background: #fef3c7;
  color: #92400e;
}

.age-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.age-hours {
  font-weight: 600;
  color: #1f2937;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #ea580c;
}

.btn-success {
  background: #10b981;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #059669;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #4b5563;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

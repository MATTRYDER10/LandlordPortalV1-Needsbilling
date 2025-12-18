<template>
  <div class="verify-queue-tab">
    <!-- Loading State -->
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>Loading verify queue...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-message">
      <p>{{ error }}</p>
      <button @click="$emit('refresh')" class="btn btn-primary">Retry</button>
    </div>

    <!-- Empty State -->
    <div v-else-if="items.length === 0" class="empty-state">
      <svg class="mx-auto h-12 w-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p class="mt-2">All caught up! No references waiting for verification.</p>
    </div>

    <!-- Queue Table -->
    <div v-else class="queue-table">
      <table>
        <thead>
          <tr>
            <th>Urgency</th>
            <th>Person</th>
            <th>Role</th>
            <th>Property</th>
            <th>Company</th>
            <th>Age</th>
            <th>Status</th>
            <th>Assigned To</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id" :class="['queue-row', `urgency-${item.urgency.toLowerCase()}`]">
            <td>
              <UrgencyIndicator :urgency="item.urgency" />
            </td>
            <td>
              <div class="person-info">
                <div class="person-name">{{ item.person.name }}</div>
                <div class="person-email">{{ item.person.email }}</div>
              </div>
            </td>
            <td>
              <span :class="['role-badge', item.person.role.toLowerCase()]">
                {{ item.person.role }}
              </span>
            </td>
            <td>
              <div class="property-address">{{ item.property.address }}</div>
            </td>
            <td>
              <div class="company-name">{{ item.company.name }}</div>
            </td>
            <td>
              <div class="age-info">
                <div class="age-hours">{{ formatHours(item.hoursInQueue) }}</div>
              </div>
            </td>
            <td>
              <span :class="['status-badge', item.status.toLowerCase().replace('_', '-')]">
                {{ formatStatus(item.status) }}
              </span>
            </td>
            <td>
              <div v-if="item.assignedStaffName" class="assigned-info">
                {{ item.assignedStaffName }}
              </div>
              <div v-else class="unassigned">Unassigned</div>
            </td>
            <td>
              <div class="actions">
                <button
                  v-if="item.status === 'AVAILABLE' || item.status === 'RETURNED'"
                  @click="$emit('claim', item)"
                  class="btn btn-sm btn-primary"
                  :disabled="claiming === item.id || !canClaim"
                >
                  {{ claiming === item.id ? 'Picking up...' : 'Pick Up' }}
                </button>
                <button
                  v-else-if="isMyItem(item)"
                  @click="$emit('open', item)"
                  class="btn btn-sm btn-success"
                >
                  Open
                </button>
                <button
                  v-if="isMyItem(item)"
                  @click="$emit('release', item)"
                  class="btn btn-sm btn-secondary"
                  :disabled="releasing === item.id"
                >
                  {{ releasing === item.id ? 'Releasing...' : 'Release' }}
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
import type { VerifyQueueItem } from '@/types/staff'
import UrgencyIndicator from '../shared/UrgencyIndicator.vue'

const props = defineProps<{
  items: VerifyQueueItem[]
  loading: boolean
  error: string | null
  claiming: string | null
  releasing: string | null
  currentUserId: string | null
  canClaim: boolean
}>()

defineEmits<{
  (e: 'claim', item: VerifyQueueItem): void
  (e: 'open', item: VerifyQueueItem): void
  (e: 'release', item: VerifyQueueItem): void
  (e: 'refresh'): void
}>()

const isMyItem = (item: VerifyQueueItem) => {
  if (!props.currentUserId) return false
  return item.assignedTo === props.currentUserId
}

const formatHours = (hours: number) => {
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${Math.round(hours)}h`
  const days = Math.floor(hours / 24)
  return `${days}d ${Math.round(hours % 24)}h`
}

const formatStatus = (status: string) => {
  return status.replace('_', ' ')
}
</script>

<style scoped>
.verify-queue-tab {
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
  border-top-color: var(--color-primary);
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

.queue-table {
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

.queue-row.urgency-urgent {
  background: #fef2f2;
}

.queue-row.urgency-warning {
  background: #fffbeb;
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

.person-email {
  font-size: 0.75rem;
  color: #6b7280;
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

.company-name {
  font-size: 0.875rem;
  color: #4b5563;
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

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.available {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.assigned {
  background: #dbeafe;
  color: #1e40af;
}

.status-badge.in-progress {
  background: #fef3c7;
  color: #92400e;
}

.status-badge.returned {
  background: #e5e7eb;
  color: #374151;
}

.assigned-info {
  font-size: 0.875rem;
  color: #4b5563;
}

.unassigned {
  font-size: 0.875rem;
  color: #9ca3af;
  font-style: italic;
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

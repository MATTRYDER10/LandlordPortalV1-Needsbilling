<template>
  <div class="email-issues-tab">
    <!-- Loading State -->
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>Loading email issues...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-message">
      <p>{{ error }}</p>
      <button @click="$emit('refresh')" class="btn btn-primary">Retry</button>
    </div>

    <!-- Empty State -->
    <div v-else-if="items.length === 0" class="empty-state">
      <CheckCircle class="mx-auto h-12 w-12 text-green-400" />
      <p class="mt-2">No email delivery issues.</p>
    </div>

    <!-- Issues Table -->
    <div v-else class="queue-table">
      <table>
        <thead>
          <tr>
            <th>Person</th>
            <th>Role</th>
            <th>Contact</th>
            <th>Email</th>
            <th>Issue</th>
            <th>Property</th>
            <th>Company</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id" class="queue-row">
            <td>
              <div class="person-name">{{ item.personName }}</div>
            </td>
            <td>
              <span :class="['role-badge', item.personRole.toLowerCase()]">
                {{ item.personRole }}
              </span>
            </td>
            <td>
              <span class="contact-type">{{ getContactTypeLabel(item.contactType) }}</span>
            </td>
            <td>
              <div class="email-info">
                <div class="email-address">{{ item.email }}</div>
              </div>
            </td>
            <td>
              <span :class="['issue-badge', item.issueType]">
                {{ item.issueType === 'bounced' ? 'Bounced' : 'Spam' }}
              </span>
            </td>
            <td>
              <div class="property-address">{{ item.propertyAddress }}</div>
            </td>
            <td>
              <div class="company-name">{{ item.companyName }}</div>
            </td>
            <td>
              <div class="date-info">{{ formatDate(item.createdAt) }}</div>
            </td>
            <td>
              <div class="actions">
                <button
                  @click="$emit('open', item)"
                  class="btn btn-sm btn-primary"
                >
                  View
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
import type { EmailIssueItem } from '@/types/staff'
import { getContactTypeLabel } from '@/types/staff'
import { CheckCircle } from 'lucide-vue-next'

defineProps<{
  items: EmailIssueItem[]
  loading: boolean
  error: string | null
}>()

defineEmits<{
  (e: 'open', item: EmailIssueItem): void
  (e: 'refresh'): void
}>()

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short'
  })
}
</script>

<style scoped>
.email-issues-tab {
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

.queue-row:hover {
  background: #f9fafb;
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

.contact-type {
  font-size: 0.875rem;
  color: #4b5563;
}

.email-info {
  display: flex;
  flex-direction: column;
}

.email-address {
  font-size: 0.875rem;
  color: #4b5563;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.issue-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.issue-badge.bounced {
  background: #fee2e2;
  color: #dc2626;
}

.issue-badge.complained {
  background: #fef3c7;
  color: #d97706;
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

.date-info {
  font-size: 0.875rem;
  color: #6b7280;
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

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

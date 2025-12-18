<template>
  <div class="chase-queue-tab">
    <!-- Help text -->
    <p class="tab-help">
      Dependencies awaiting responses from landlords, agents, employers, accountants, or guarantors. Use Email/SMS to send reminders with form links.
    </p>

    <!-- Loading State -->
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>Loading chase queue...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-message">
      <p>{{ error }}</p>
      <button @click="$emit('refresh')" class="btn btn-primary">Retry</button>
    </div>

    <!-- Empty State -->
    <div v-else-if="items.length === 0" class="empty-state">
      <CheckCircle class="mx-auto h-12 w-12 text-green-400" />
      <p class="mt-2">All caught up! No dependencies waiting for responses.</p>
    </div>

    <!-- Chase List -->
    <div v-else class="chase-list">
      <div v-for="item in items" :key="item.id" class="chase-card">
        <div class="chase-card-header">
          <div class="chase-card-info">
            <router-link :to="`/staff/references/${item.referenceId}`" class="chase-tenant-name">
              {{ item.tenantName }}
            </router-link>
            <UrgencyIndicator :urgency="item.urgency" />
            <span :class="['dependency-type-badge', item.dependencyType.toLowerCase().replace('_', '-')]">
              {{ getDependencyTypeLabel(item.dependencyType) }}
            </span>
          </div>
          <span :class="['status-badge', item.status.toLowerCase().replace('_', '-')]">
            {{ formatStatus(item.status) }}
          </span>
        </div>

        <div class="chase-card-details">
          <div class="chase-property">{{ item.propertyAddress }}</div>
          <div class="chase-meta">Company: {{ item.companyName }} • {{ item.daysSinceRequest }} days since request</div>
        </div>

        <div class="chase-contact" v-if="item.contactEmail || item.contactPhone">
          <div class="chase-contact-info">
            <div class="chase-contact-header">
              <span v-if="item.contactName" class="chase-contact-name">{{ item.contactName }}</span>
            </div>
            <div class="chase-contact-details">
              <a v-if="item.contactEmail" :href="`mailto:${item.contactEmail}`" class="chase-contact-email">
                {{ item.contactEmail }}
              </a>
              <span v-if="item.contactPhone" class="chase-contact-phone">• {{ item.contactPhone }}</span>
            </div>
            <div class="chase-stats">
              <span v-if="item.emailAttempts > 0">{{ item.emailAttempts }} emails sent</span>
              <span v-if="item.smsAttempts > 0">• {{ item.smsAttempts }} SMS sent</span>
              <span v-if="item.chaseCycle > 0">• Cycle {{ item.chaseCycle }}/3</span>
            </div>
          </div>

          <div class="chase-contact-actions">
            <button
              @click="$emit('sendChase', item.id, 'email')"
              :disabled="sendingEmail === item.id"
              class="btn btn-sm btn-primary"
              title="Send chase email with form link"
            >
              <Mail class="w-4 h-4 mr-1" />
              {{ sendingEmail === item.id ? 'Sending...' : 'Email' }}
            </button>

            <button
              v-if="item.contactPhone"
              @click="$emit('sendChase', item.id, 'sms')"
              :disabled="sendingSms === item.id"
              class="btn btn-sm btn-sms"
              title="Send SMS with form link"
            >
              <MessageSquare class="w-4 h-4 mr-1" />
              {{ sendingSms === item.id ? 'Sending...' : 'SMS' }}
            </button>

            <button
              @click="$emit('markReceived', item.id)"
              class="btn btn-sm btn-success"
              title="Mark as received"
            >
              Received
            </button>

            <button
              v-if="item.status !== 'ACTION_REQUIRED'"
              @click="$emit('actionRequired', item.id)"
              class="btn btn-sm btn-warning"
              title="Escalate to action required"
            >
              Escalate
            </button>
          </div>
        </div>

        <div v-else class="chase-no-contacts">
          <p>No contact information available. Please update the reference with contact details.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChaseQueueItem } from '@/types/staff'
import { getDependencyTypeLabel } from '@/types/staff'
import { CheckCircle, Mail, MessageSquare } from 'lucide-vue-next'
import UrgencyIndicator from '../shared/UrgencyIndicator.vue'

defineProps<{
  items: ChaseQueueItem[]
  loading: boolean
  error: string | null
  sendingEmail: string | null
  sendingSms: string | null
}>()

defineEmits<{
  (e: 'sendChase', dependencyId: string, method: 'email' | 'sms'): void
  (e: 'markReceived', dependencyId: string): void
  (e: 'actionRequired', dependencyId: string): void
  (e: 'refresh'): void
}>()

const formatStatus = (status: string) => {
  return status.replace('_', ' ')
}
</script>

<style scoped>
.chase-queue-tab {
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 1rem;
}

.tab-help {
  margin: 0 0 1.5rem;
  font-size: 0.875rem;
  color: #6b7280;
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

.chase-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.chase-card {
  background: #f9fafb;
  border-radius: 8px;
  padding: 1.25rem;
  border: 1px solid #e5e7eb;
}

.chase-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.chase-card-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.chase-tenant-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-primary);
  text-decoration: none;
}

.chase-tenant-name:hover {
  color: #ea580c;
  text-decoration: underline;
}

.dependency-type-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  background: #dbeafe;
  color: #1e40af;
}

.dependency-type-badge.employer-ref {
  background: #dcfce7;
  color: #166534;
}

.dependency-type-badge.residential-ref {
  background: #fef3c7;
  color: #92400e;
}

.dependency-type-badge.accountant-ref {
  background: #f3e8ff;
  color: #6b21a8;
}

.dependency-type-badge.guarantor-form {
  background: #fce7f3;
  color: #9d174d;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.pending {
  background: #e5e7eb;
  color: #374151;
}

.status-badge.chasing {
  background: #dbeafe;
  color: #1e40af;
}

.status-badge.received {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.exhausted {
  background: #fee2e2;
  color: #991b1b;
}

.status-badge.action-required {
  background: #fef3c7;
  color: #92400e;
}

.chase-card-details {
  margin-bottom: 1rem;
}

.chase-property {
  font-size: 0.875rem;
  color: #4b5563;
}

.chase-meta {
  font-size: 0.75rem;
  color: #9ca3af;
  margin-top: 0.25rem;
}

.chase-contact {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: white;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.chase-contact-info {
  flex: 1;
}

.chase-contact-name {
  font-weight: 500;
  color: #1f2937;
}

.chase-contact-details {
  font-size: 0.875rem;
  color: #4b5563;
  margin-top: 0.25rem;
}

.chase-contact-email {
  color: var(--color-primary);
  text-decoration: none;
}

.chase-contact-email:hover {
  text-decoration: underline;
}

.chase-contact-phone {
  color: #6b7280;
}

.chase-stats {
  font-size: 0.75rem;
  color: #9ca3af;
  margin-top: 0.25rem;
}

.chase-contact-actions {
  display: flex;
  gap: 0.5rem;
  margin-left: 1rem;
  flex-wrap: wrap;
}

.chase-no-contacts {
  padding: 0.75rem;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 8px;
}

.chase-no-contacts p {
  font-size: 0.875rem;
  color: #92400e;
  margin: 0;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
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

.btn-sms {
  background: #3b82f6;
  color: white;
}

.btn-sms:hover:not(:disabled) {
  background: #2563eb;
}

.btn-warning {
  background: #f59e0b;
  color: white;
}

.btn-warning:hover:not(:disabled) {
  background: #d97706;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mr-1 {
  margin-right: 0.25rem;
}
</style>

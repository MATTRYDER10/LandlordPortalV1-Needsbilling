<template>
  <div class="reference-audit-log">
    <div class="header">
      <h3>Activity Log</h3>
    </div>

    <!-- Audit Log List -->
    <div class="audit-log-list">
      <div v-if="loading" class="loading">Loading activity...</div>
      <div v-else-if="auditLog.length === 0" class="empty">
        No activity yet.
      </div>
      <div v-else class="timeline">
        <div
          v-for="entry in auditLog"
          :key="entry.id"
          class="timeline-item"
        >
          <div class="timeline-marker" :class="getActionClass(entry.action)"></div>
          <div class="timeline-content">
            <div class="timeline-header">
              <span class="timeline-action">{{ formatAction(entry.action) }}</span>
              <span class="timeline-time">{{ formatDate(entry.created_at) }}</span>
            </div>
            <p class="timeline-description">{{ entry.description }}</p>
            <div v-if="entry.created_by_user" class="timeline-user">
              by {{ entry.created_by_user.email }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../stores/auth'
import { formatDateTime as formatUkDateTime } from '../utils/date'

const props = defineProps<{
  referenceId: string
}>()

const toast = useToast()
const authStore = useAuthStore()
const auditLog = ref<any[]>([])
const loading = ref(false)

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const loadAuditLog = async () => {
  loading.value = true
  try {
    const token = authStore.session?.access_token
    const response = await fetch(
      `${API_URL}/api/reference-audit-log/${props.referenceId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    )
    if (!response.ok) throw new Error('Failed to load audit log')
    auditLog.value = await response.json()
  } catch (error: any) {
    console.error('Failed to load audit log:', error)
    toast.error('Failed to load activity log')
  } finally {
    loading.value = false
  }
}

const formatAction = (action: string) => {
  // Convert action codes to readable text
  const actionMap: Record<string, string> = {
    'EMAIL_SENT': 'Email Sent',
    'EMAIL_FAILED': 'Email Failed',
    'EMAIL_RESENT': 'Email Resent',
    'EMAIL_BOUNCED': 'Email Bounced',
    'EMAIL_COMPLAINED': 'Marked as Spam',
    'NOTE_ADDED': 'Note Added',
    'NOTE_UPDATED': 'Note Updated',
    'NOTE_DELETED': 'Note Deleted',
    'STATUS_CHANGED': 'Status Changed',
    'SCORE_UPDATED': 'Score Updated',
    'SMS_SENT': 'SMS Sent',
    'SMS_FAILED': 'SMS Failed',
    'STAFF_NOTE': 'Staff Note',
    'PENDING_RESPONSE_MARKED_DONE': 'Follow-up Completed',
    'CHASE_ACTION_REQUIRED': 'Escalated',
    'REFEREE_CONTACT_UPDATED': 'Contact Updated',
  }
  return actionMap[action] || action
}

const getActionClass = (action: string) => {
  // Return CSS class for different action types
  if (action === 'EMAIL_SENT' || action === 'EMAIL_RESENT') return 'action-email'
  if (action === 'EMAIL_FAILED' || action === 'EMAIL_BOUNCED' || action === 'EMAIL_COMPLAINED') return 'action-email-failed'
  if (action.includes('NOTE') || action === 'STAFF_NOTE') return 'action-note'
  if (action.includes('STATUS')) return 'action-status'
  if (action.includes('SCORE')) return 'action-score'
  if (action === 'SMS_SENT') return 'action-sms'
  if (action === 'SMS_FAILED') return 'action-sms-failed'
  if (action === 'PENDING_RESPONSE_MARKED_DONE') return 'action-followup'
  if (action === 'CHASE_ACTION_REQUIRED') return 'action-escalation'
  if (action === 'REFEREE_CONTACT_UPDATED') return 'action-update'
  return 'action-default'
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return formatUkDateTime(
    date,
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }
  )
}

onMounted(() => {
  loadAuditLog()
})
</script>

<style scoped>
.reference-audit-log {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
}

.header {
  margin-bottom: 16px;
}

.header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.loading,
.empty {
  text-align: center;
  padding: 32px;
  color: #6b7280;
  font-size: 14px;
}

.timeline {
  position: relative;
  padding-left: 24px;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 7px;
  top: 8px;
  bottom: 0;
  width: 2px;
  background: #e5e7eb;
}

.timeline-item {
  position: relative;
  padding-bottom: 24px;
}

.timeline-item:last-child {
  padding-bottom: 0;
}

.timeline-marker {
  position: absolute;
  left: -21px;
  top: 4px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 0 0 2px #d1d5db;
}

.action-email {
  background-color: #3b82f6;
}

.action-email-failed {
  background-color: #ef4444;
}

.action-note {
  background-color: #8b5cf6;
}

.action-status {
  background-color: #10b981;
}

.action-score {
  background-color: #f59e0b;
}

.action-sms {
  background-color: #06b6d4;
}

.action-sms-failed {
  background-color: #ef4444;
}

.action-default {
  background-color: #6b7280;
}

.action-followup {
  background-color: #6366f1;
}

.action-escalation {
  background-color: #dc2626;
}

.action-update {
  background-color: #0891b2;
}

.timeline-content {
  margin-left: 8px;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.timeline-action {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.timeline-time {
  font-size: 12px;
  color: #6b7280;
}

.timeline-description {
  margin: 0 0 4px 0;
  font-size: 14px;
  color: #374151;
  line-height: 1.5;
}

.timeline-user {
  font-size: 12px;
  color: #6b7280;
  font-style: italic;
}
</style>

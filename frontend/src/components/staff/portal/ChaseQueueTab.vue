<template>
  <div class="chase-queue-tab">
    <!-- Help text -->
    <p class="tab-help">
      Items awaiting responses from landlords, employers, accountants, or guarantors. Send reminders, then click "Mark Done" with a note when you've contacted them.
    </p>

    <!-- Mark Done Modal -->
    <Teleport to="body">
      <div v-if="showMarkDoneModal" class="modal-overlay" @click.self="closeMarkDoneModal">
        <div class="modal-content">
          <h3 class="modal-title">Mark Done for Today</h3>
          <p class="modal-description">
            Add a note about what you did (e.g., "Left voicemail", "Email sent, waiting for reply", "Spoke to contact, will respond tomorrow").
          </p>
          <p class="modal-info">
            This item will reappear at 8:55am UK tomorrow if still pending. Your note will be visible to agents.
          </p>
          <textarea
            v-model="markDoneNote"
            class="note-textarea"
            placeholder="Enter a note (required)..."
            rows="3"
          ></textarea>
          <div class="modal-actions">
            <button @click="closeMarkDoneModal" class="btn btn-secondary">Cancel</button>
            <button
              @click="submitMarkDone"
              :disabled="!markDoneNote.trim() || markingDone"
              class="btn btn-primary"
            >
              {{ markingDone ? 'Saving...' : 'Mark Done' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Edit Contact Modal -->
    <Teleport to="body">
      <div v-if="showEditModal" class="modal-overlay" @click.self="closeEditModal">
        <div class="modal-content">
          <h3 class="modal-title">Edit Contact Details</h3>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input
              v-model="editForm.email"
              type="email"
              class="form-input"
              placeholder="referee@example.com"
            />
          </div>
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input
              v-model="editForm.phone"
              type="tel"
              class="form-input"
              placeholder="+44..."
            />
          </div>
          <div class="modal-actions">
            <button @click="closeEditModal" class="btn btn-secondary">Cancel</button>
            <button
              @click="submitEditContact"
              :disabled="saving"
              class="btn btn-primary"
            >
              {{ saving ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Escalate Modal -->
    <Teleport to="body">
      <div v-if="showEscalateModal" class="modal-overlay" @click.self="closeEscalateModal">
        <div class="modal-content">
          <h3 class="modal-title">Escalate to Action Required</h3>
          <p class="modal-description">
            This will move the reference to the agent's "Action Required" section. Please explain what action is needed (e.g., "Invalid email address - need correct employer contact", "No response after 3 cycles - request alternative referee").
          </p>
          <p class="modal-info">
            The agent will see this note and can then upload documents, update referee details, or resubmit for re-referencing.
          </p>
          <textarea
            v-model="escalateReason"
            class="note-textarea"
            placeholder="Explain what action is required (required)..."
            rows="3"
          ></textarea>
          <div class="modal-actions">
            <button @click="closeEscalateModal" class="btn btn-secondary">Cancel</button>
            <button
              @click="submitEscalate"
              :disabled="!escalateReason.trim() || escalating"
              class="btn btn-warning"
            >
              {{ escalating ? 'Escalating...' : 'Escalate' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

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
              @click="copyFormLink(item)"
              class="btn btn-sm btn-secondary"
              title="Copy form link to clipboard"
            >
              <Copy class="w-4 h-4 mr-1" />
              Copy Link
            </button>

            <button
              @click="openForm(item)"
              class="btn btn-sm btn-secondary"
              title="Open form in new tab (fill over phone)"
            >
              <ExternalLink class="w-4 h-4 mr-1" />
              Open Form
            </button>

            <button
              @click="openEditModal(item)"
              class="btn btn-sm btn-secondary"
              title="Edit contact details"
            >
              <Pencil class="w-4 h-4 mr-1" />
              Edit
            </button>

            <button
              @click="openMarkDoneModal(item)"
              class="btn btn-sm btn-done"
              title="Mark done for today (reappears tomorrow)"
            >
              <CheckCircle class="w-4 h-4 mr-1" />
              Mark Done
            </button>

            <button
              @click="$emit('markReceived', item.id)"
              class="btn btn-sm btn-success"
              title="Response received - removes from queue permanently"
            >
              Received
            </button>

            <button
              v-if="item.status !== 'ACTION_REQUIRED'"
              @click="openEscalateModal(item)"
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
import { ref } from 'vue'
import type { ChaseQueueItem } from '@/types/staff'
import { getDependencyTypeLabel } from '@/types/staff'
import { CheckCircle, Mail, MessageSquare, Copy, ExternalLink, Pencil } from 'lucide-vue-next'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '@/stores/auth'
import UrgencyIndicator from '../shared/UrgencyIndicator.vue'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const toast = useToast()
const authStore = useAuthStore()
defineProps<{
  items: ChaseQueueItem[]
  loading: boolean
  error: string | null
  sendingEmail: string | null
  sendingSms: string | null
}>()

const emit = defineEmits<{
  (e: 'sendChase', dependencyId: string, method: 'email' | 'sms'): void
  (e: 'markReceived', dependencyId: string): void
  (e: 'markDone', sectionId: string, note: string): void
  (e: 'editContact', sectionId: string, referenceId: string, sectionType: string, email: string, phone: string): void
  (e: 'actionRequired', dependencyId: string, reason: string): void
  (e: 'refresh'): void
}>()

// Mark Done Modal State
const showMarkDoneModal = ref(false)
const markDoneNote = ref('')
const markingDone = ref(false)
const selectedItemForMarkDone = ref<ChaseQueueItem | null>(null)

// Edit Contact Modal State
const showEditModal = ref(false)
const editingItem = ref<ChaseQueueItem | null>(null)
const editForm = ref({ email: '', phone: '' })
const saving = ref(false)

// Escalate Modal State
const showEscalateModal = ref(false)
const escalateReason = ref('')
const escalating = ref(false)
const selectedItemForEscalate = ref<ChaseQueueItem | null>(null)

const openMarkDoneModal = (item: ChaseQueueItem) => {
  selectedItemForMarkDone.value = item
  markDoneNote.value = ''
  showMarkDoneModal.value = true
}

const closeMarkDoneModal = () => {
  showMarkDoneModal.value = false
  markDoneNote.value = ''
  selectedItemForMarkDone.value = null
}

const submitMarkDone = async () => {
  if (!selectedItemForMarkDone.value || !markDoneNote.value.trim()) return

  markingDone.value = true
  try {
    emit('markDone', selectedItemForMarkDone.value.id, markDoneNote.value.trim())
    closeMarkDoneModal()
  } finally {
    markingDone.value = false
  }
}

// Escalate Modal Methods
const openEscalateModal = (item: ChaseQueueItem) => {
  selectedItemForEscalate.value = item
  escalateReason.value = ''
  showEscalateModal.value = true
}

const closeEscalateModal = () => {
  showEscalateModal.value = false
  escalateReason.value = ''
  selectedItemForEscalate.value = null
}

const submitEscalate = async () => {
  if (!selectedItemForEscalate.value || !escalateReason.value.trim()) return

  escalating.value = true
  try {
    emit('actionRequired', selectedItemForEscalate.value.id, escalateReason.value.trim())
    closeEscalateModal()
  } finally {
    escalating.value = false
  }
}

// Edit Contact Modal Methods
const openEditModal = (item: ChaseQueueItem) => {
  editingItem.value = item
  editForm.value = {
    email: item.contactEmail || '',
    phone: item.contactPhone || ''
  }
  showEditModal.value = true
}

const closeEditModal = () => {
  showEditModal.value = false
  editingItem.value = null
  editForm.value = { email: '', phone: '' }
}

const submitEditContact = async () => {
  if (!editingItem.value) return

  saving.value = true
  try {
    const response = await fetch(`${API_URL}/api/references/${editingItem.value.referenceId}/referee`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sectionType: editingItem.value.dependencyType,
        email: editForm.value.email,
        phone: editForm.value.phone
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to update contact')
    }

    toast.success('Contact updated successfully')
    closeEditModal()
    emit('refresh')
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    saving.value = false
  }
}

// Form Link Methods
const getFormLink = async (item: ChaseQueueItem): Promise<string | null> => {
  try {
    const response = await fetch(`${API_URL}/api/chase/${item.id}/form-link`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })
    if (!response.ok) throw new Error('Failed to get form link')
    const data = await response.json()
    return data.formUrl
  } catch (err) {
    console.error('Error fetching form link:', err)
    return null
  }
}

const copyFormLink = async (item: ChaseQueueItem) => {
  const link = await getFormLink(item)
  if (!link) {
    toast.error('Could not get form link')
    return
  }
  try {
    await navigator.clipboard.writeText(link)
    toast.success('Form link copied to clipboard!')
  } catch {
    toast.error('Failed to copy link')
  }
}

const openForm = async (item: ChaseQueueItem) => {
  const link = await getFormLink(item)
  if (!link) {
    toast.error('Could not get form link')
    return
  }
  window.open(link, '_blank')
}

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

.btn-done {
  background: #6366f1;
  color: white;
}

.btn-done:hover:not(:disabled) {
  background: #4f46e5;
}

.btn-secondary {
  background: #e5e7eb;
  color: #374151;
}

.btn-secondary:hover:not(:disabled) {
  background: #d1d5db;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.5rem;
}

.modal-description {
  font-size: 0.875rem;
  color: #4b5563;
  margin: 0 0 0.5rem;
}

.modal-info {
  font-size: 0.8125rem;
  color: #6b7280;
  background: #f3f4f6;
  padding: 0.75rem;
  border-radius: 6px;
  margin-bottom: 1rem;
}

.note-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  resize: vertical;
  margin-bottom: 1rem;
}

.note-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.25rem;
}

.form-input {
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1);
}
</style>

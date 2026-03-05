<template>
  <div class="staff-chase-panel">
    <div class="header">
      <button @click="goBack" class="btn-back">
        ← Back to Queue
      </button>
      <h1>Chase Case</h1>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>Loading case details...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-message">
      <p>{{ error }}</p>
      <button @click="fetchWorkItem" class="btn btn-primary">Retry</button>
    </div>

    <!-- Main Content -->
    <div v-else-if="workItem" class="content">
      <!-- Case Info Card -->
      <div class="card case-info">
        <h2>Case Information</h2>
        <div class="info-grid">
          <div class="info-item">
            <label>Tenant</label>
            <div class="value">
              {{ workItem.reference.tenant_first_name }} {{ workItem.reference.tenant_last_name }}
            </div>
          </div>
          <div class="info-item">
            <label>Email</label>
            <div class="value">{{ workItem.reference.tenant_email }}</div>
          </div>
          <div class="info-item">
            <label>Property</label>
            <div class="value">{{ workItem.reference.property_address }}</div>
          </div>
          <div class="info-item">
            <label>Reference Status</label>
            <div class="value">
              <span :class="['status-badge', workItem.reference.status]">
                {{ workItem.reference.status }}
              </span>
            </div>
          </div>
          <div class="info-item">
            <label>Case Age</label>
            <div class="value">{{ caseAge }}</div>
          </div>
          <div class="info-item">
            <label>Last Activity</label>
            <div class="value">{{ lastActivity }}</div>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="card quick-actions">
        <h2>Quick Actions</h2>
        <p class="subtitle">Contact the relevant parties using these channels</p>
        <div class="action-buttons">
          <button @click="openContactModal('EMAIL')" class="action-btn email">
            <span class="icon">📧</span>
            <span class="label">Email</span>
          </button>
          <button @click="openContactModal('SMS')" class="action-btn sms">
            <span class="icon">💬</span>
            <span class="label">SMS</span>
          </button>
          <button @click="openContactModal('PHONE')" class="action-btn phone">
            <span class="icon">📞</span>
            <span class="label">Phone Call</span>
          </button>
          <button @click="openContactModal('WHATSAPP')" class="action-btn whatsapp">
            <span class="icon">💬</span>
            <span class="label">WhatsApp</span>
          </button>
        </div>
      </div>

      <!-- Contact History -->
      <div class="card contact-history">
        <h2>Contact History</h2>
        <div v-if="contactAttempts.length === 0" class="empty-state">
          <p>No contact attempts logged yet</p>
        </div>
        <div v-else class="attempts-list">
          <div
            v-for="attempt in contactAttempts"
            :key="attempt.id"
            class="attempt-item"
          >
            <div class="attempt-header">
              <span :class="['channel-badge', attempt.channel.toLowerCase()]">
                {{ attempt.channel }}
              </span>
              <span class="contact-type">{{ formatContactType(attempt.contact_type) }}</span>
              <span class="timestamp">{{ formatDate(attempt.created_at) }}</span>
            </div>
            <div class="attempt-details">
              <div class="recipient">
                <strong>To:</strong> {{ attempt.recipient_name }}
                <span v-if="attempt.recipient_contact">({{ attempt.recipient_contact }})</span>
              </div>
              <div class="outcome">
                <strong>Outcome:</strong>
                <span :class="['outcome-badge', outcomeClass(attempt.outcome)]">
                  {{ attempt.outcome }}
                </span>
              </div>
              <div v-if="attempt.notes" class="notes">
                <strong>Notes:</strong> {{ attempt.notes }}
              </div>
            </div>
            <div class="attempt-footer">
              <span class="staff-name">
                Logged by {{ attempt.created_by_staff?.full_name || 'Unknown' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="card action-section">
        <h2>Complete This Chase</h2>
        <div class="completion-buttons">
          <button
            @click="returnToQueue"
            class="btn btn-secondary"
            :disabled="processing"
          >
            Log & Return to Queue (4hr cooldown)
          </button>
          <button
            @click="pushToVerify"
            class="btn btn-primary"
            :disabled="processing"
          >
            Mark Complete & Push to Verify
          </button>
          <button
            @click="verifyNow"
            class="btn btn-success"
            :disabled="processing"
          >
            Mark Complete & Verify Now
          </button>
        </div>
      </div>
    </div>

    <!-- Contact Modal -->
    <div v-if="showContactModal" class="modal-overlay" @click="closeContactModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Log {{ selectedChannel }} Contact Attempt</h3>
          <button @click="closeContactModal" class="btn-close">×</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="submitContactAttempt">
            <div class="form-group">
              <label>Contact Type *</label>
              <select v-model="contactForm.contact_type" required>
                <option value="">Select who you contacted...</option>
                <option value="TENANT">Tenant</option>
                <option value="LANDLORD">Landlord</option>
                <option value="AGENT">Letting Agent</option>
                <option value="EMPLOYER">Employer</option>
                <option value="ACCOUNTANT">Accountant</option>
                <option value="GUARANTOR">Guarantor</option>
              </select>
            </div>

            <div class="form-group">
              <label>Recipient Name *</label>
              <input
                v-model="contactForm.recipient_name"
                type="text"
                placeholder="Name of person contacted"
                required
              />
            </div>

            <div class="form-group">
              <label>Recipient Contact</label>
              <input
                v-model="contactForm.recipient_contact"
                type="text"
                :placeholder="selectedChannel === 'EMAIL' ? 'email@example.com' : 'Phone number'"
              />
            </div>

            <div class="form-group">
              <label>Outcome *</label>
              <select v-model="contactForm.outcome" required>
                <option value="">Select outcome...</option>
                <option value="SENT">Sent</option>
                <option value="DELIVERED">Delivered</option>
                <option value="RESPONDED">Responded</option>
                <option value="NO_RESPONSE">No Response</option>
                <option value="BOUNCED">Bounced</option>
                <option value="BUSY">Busy</option>
                <option value="NO_ANSWER">No Answer</option>
                <option value="LEFT_MESSAGE">Left Message</option>
              </select>
            </div>

            <div class="form-group">
              <label>Notes</label>
              <textarea
                v-model="contactForm.notes"
                rows="4"
                placeholder="Add any relevant details about this contact attempt..."
              ></textarea>
            </div>

            <div class="modal-actions">
              <button type="button" @click="closeContactModal" class="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" class="btn btn-primary" :disabled="submitting">
                {{ submitting ? 'Logging...' : 'Log Contact Attempt' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Email Resend Modal -->
    <div v-if="showEmailResendModal" class="modal-overlay" @click="closeEmailResendModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Send Reference Request Email</h3>
          <button @click="closeEmailResendModal" class="btn-close">&times;</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="sendEmailResend">
            <div class="form-group">
              <label>Select Contact Type *</label>
              <select v-model="emailResendContactType" @change="onContactTypeChange" required>
                <option value="">Select who to email...</option>
                <option
                  v-for="contact in availableEmailContacts"
                  :key="contact.type"
                  :value="contact.type"
                >
                  {{ contact.label }} - {{ contact.name || 'No name' }}
                </option>
              </select>
            </div>

            <div v-if="emailResendContactType" class="form-group">
              <label>Recipient Name</label>
              <input
                v-model="emailRecipientName"
                type="text"
                readonly
                class="readonly-input"
              />
            </div>

            <div v-if="emailResendContactType" class="form-group">
              <label>Email Address *</label>
              <input
                v-model="emailToSend"
                type="email"
                placeholder="Enter email address"
                required
              />
              <p class="help-text">
                You can edit this email address. If changed, the new email will be saved permanently.
              </p>
            </div>

            <div v-if="emailError" class="error-text">
              {{ emailError }}
            </div>

            <div class="modal-actions">
              <button type="button" @click="closeEmailResendModal" class="btn btn-secondary">
                Cancel
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                :disabled="emailSending || !emailResendContactType || !emailToSend"
              >
                {{ emailSending ? 'Sending...' : 'Send Email' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

// State
const workItem = ref<any>(null)
const contactAttempts = ref<any[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const processing = ref(false)
const showContactModal = ref(false)
const selectedChannel = ref<string>('')
const submitting = ref(false)

// Email resend modal state
const showEmailResendModal = ref(false)
const emailResendContactType = ref<string>('')
const emailToSend = ref<string>('')
const emailRecipientName = ref<string>('')
const emailSending = ref(false)
const emailError = ref<string>('')

const contactForm = ref({
  contact_type: '',
  recipient_name: '',
  recipient_contact: '',
  outcome: '',
  notes: ''
})

// Computed
const caseAge = computed(() => {
  if (!workItem.value) return 'N/A'
  const hours = Math.floor(
    (Date.now() - new Date(workItem.value.created_at).getTime()) / (1000 * 60 * 60)
  )
  if (hours < 24) return `${hours} hours`
  const days = Math.floor(hours / 24)
  return `${days} days`
})

const lastActivity = computed(() => {
  if (!workItem.value) return 'N/A'
  const date = new Date(workItem.value.last_activity_at)
  return date.toLocaleString()
})

// Get available email contacts based on what data exists
const availableEmailContacts = computed(() => {
  if (!workItem.value?.reference) return []
  const ref = workItem.value.reference
  const contacts = []

  // Tenant
  if (ref.tenant_email) {
    contacts.push({
      type: 'TENANT',
      label: 'Tenant',
      email: ref.tenant_email,
      name: `${ref.tenant_first_name || ''} ${ref.tenant_last_name || ''}`.trim()
    })
  }

  // Landlord or Agent based on previous_address_type
  if (ref.previous_landlord_email) {
    const isAgent = ref.previous_address_type === 'agent'
    contacts.push({
      type: isAgent ? 'AGENT' : 'LANDLORD',
      label: isAgent ? 'Letting Agent' : 'Landlord',
      email: ref.previous_landlord_email,
      name: ref.previous_landlord_name || ''
    })
  }

  // Employer
  if (ref.employer_ref_email) {
    contacts.push({
      type: 'EMPLOYER',
      label: 'Employer',
      email: ref.employer_ref_email,
      name: ref.employer_ref_name || ''
    })
  }

  // Accountant
  if (ref.accountant_email) {
    contacts.push({
      type: 'ACCOUNTANT',
      label: 'Accountant',
      email: ref.accountant_email,
      name: ref.accountant_name || ''
    })
  }

  // Guarantor
  if (ref.guarantor_email) {
    contacts.push({
      type: 'GUARANTOR',
      label: 'Guarantor',
      email: ref.guarantor_email,
      name: `${ref.guarantor_first_name || ''} ${ref.guarantor_last_name || ''}`.trim()
    })
  }

  return contacts
})

// Methods
const fetchWorkItem = async () => {
  try {
    loading.value = true
    error.value = null

    const workItemId = route.params.id

    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/work-queue/${workItemId}`,
      {
        headers: {
          Authorization: `Bearer ${authStore.session?.access_token}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch work item')
    }

    const data = await response.json()
    workItem.value = data.workItem
    contactAttempts.value = data.workItem.contact_attempts || []
  } catch (err: any) {
    error.value = err.message
    console.error('Error fetching work item:', err)
  } finally {
    loading.value = false
  }
}

const openContactModal = (channel: string) => {
  // For EMAIL channel, show the email resend modal instead
  if (channel === 'EMAIL') {
    openEmailResendModal()
    return
  }
  selectedChannel.value = channel
  showContactModal.value = true
  resetContactForm()
}

const openEmailResendModal = () => {
  console.log('Opening email resend modal')
  console.log('Available contacts:', availableEmailContacts.value)
  emailResendContactType.value = ''
  emailToSend.value = ''
  emailRecipientName.value = ''
  emailError.value = ''
  showEmailResendModal.value = true
  console.log('showEmailResendModal:', showEmailResendModal.value)
}

const closeEmailResendModal = () => {
  showEmailResendModal.value = false
  emailResendContactType.value = ''
  emailToSend.value = ''
  emailRecipientName.value = ''
  emailError.value = ''
}

const onContactTypeChange = () => {
  const selected = availableEmailContacts.value.find(
    c => c.type === emailResendContactType.value
  )
  if (selected) {
    emailToSend.value = selected.email
    emailRecipientName.value = selected.name
  } else {
    emailToSend.value = ''
    emailRecipientName.value = ''
  }
  emailError.value = ''
}

const isValidEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

const sendEmailResend = async () => {
  if (!emailResendContactType.value) {
    emailError.value = 'Please select a contact type'
    return
  }
  if (!emailToSend.value) {
    emailError.value = 'Please enter an email address'
    return
  }
  if (!isValidEmail(emailToSend.value)) {
    emailError.value = 'Please enter a valid email address'
    return
  }

  try {
    emailSending.value = true
    emailError.value = ''

    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/work-queue/${workItem.value.id}/resend-email`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contactType: emailResendContactType.value,
          newEmail: emailToSend.value
        })
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to send email')
    }

    const result = await response.json()

    // Log the contact attempt
    await fetch(
      `${import.meta.env.VITE_API_URL}/api/contact-attempts`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          work_item_id: workItem.value.id,
          reference_id: workItem.value.reference_id,
          channel: 'EMAIL',
          contact_type: emailResendContactType.value,
          recipient_name: result.recipientName || emailRecipientName.value,
          recipient_contact: result.emailSentTo || emailToSend.value,
          outcome: 'SENT',
          notes: 'Email resent via chase panel'
        })
      }
    )

    // Refresh work item data
    await fetchWorkItem()
    closeEmailResendModal()
    alert(`Email sent successfully to ${result.emailSentTo}`)
  } catch (err: any) {
    emailError.value = err.message || 'Failed to send email'
    console.error('Error sending email:', err)
  } finally {
    emailSending.value = false
  }
}

const closeContactModal = () => {
  showContactModal.value = false
  resetContactForm()
}

const resetContactForm = () => {
  contactForm.value = {
    contact_type: '',
    recipient_name: '',
    recipient_contact: '',
    outcome: '',
    notes: ''
  }
}

const submitContactAttempt = async () => {
  try {
    submitting.value = true

    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/contact-attempts`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          work_item_id: workItem.value.id,
          reference_id: workItem.value.reference_id,
          channel: selectedChannel.value,
          ...contactForm.value
        })
      }
    )

    if (!response.ok) {
      throw new Error('Failed to log contact attempt')
    }

    // Refresh data
    await fetchWorkItem()
    closeContactModal()
  } catch (err: any) {
    alert(`Error logging contact attempt: ${err.message}`)
    console.error('Error:', err)
  } finally {
    submitting.value = false
  }
}

const returnToQueue = async () => {
  if (!confirm('Return this case to the queue with a 4-hour cooldown?')) {
    return
  }

  try {
    processing.value = true

    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/work-queue/${workItem.value.id}/release`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cooldownHours: 4 })
      }
    )

    if (!response.ok) {
      throw new Error('Failed to return to queue')
    }

    router.push('/staff/work-queue')
  } catch (err: any) {
    alert(`Error: ${err.message}`)
    console.error('Error:', err)
  } finally {
    processing.value = false
  }
}

const pushToVerify = async () => {
  if (!confirm('Mark this chase as complete and push to the verify queue?')) {
    return
  }

  try {
    processing.value = true

    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/work-queue/${workItem.value.id}/push-to-verify`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.session?.access_token}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error('Failed to push to verify')
    }

    alert('Successfully pushed to verify queue!')
    router.push('/staff/work-queue')
  } catch (err: any) {
    alert(`Error: ${err.message}`)
    console.error('Error:', err)
  } finally {
    processing.value = false
  }
}

const verifyNow = async () => {
  try {
    processing.value = true

    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/work-queue/${workItem.value.id}/verify-now`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.session?.access_token}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error('Failed to start verification')
    }

    const data = await response.json()
    router.push(`/staff/verification/${workItem.value.reference_id}?workItemId=${data.verifyItem.id}`)
  } catch (err: any) {
    alert(`Error: ${err.message}`)
    console.error('Error:', err)
  } finally {
    processing.value = false
  }
}

const goBack = () => {
  router.push('/staff/work-queue')
}

const formatContactType = (type: string) => {
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleString()
}

const outcomeClass = (outcome: string) => {
  const lowerOutcome = outcome.toLowerCase()
  if (lowerOutcome.includes('respond')) return 'success'
  if (lowerOutcome.includes('deliver')) return 'success'
  if (lowerOutcome.includes('sent')) return 'info'
  if (lowerOutcome.includes('no_') || lowerOutcome.includes('bounce')) return 'warning'
  return 'neutral'
}

// Lifecycle
onMounted(() => {
  fetchWorkItem()
})
</script>

<style scoped>
.staff-chase-panel {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

.btn-back {
  padding: 0.5rem 1rem;
  background: #f3f4f6;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-back:hover {
  background: #e5e7eb;
}

.header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
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

.content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.card h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 1rem;
}

.subtitle {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 1rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.info-item label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  margin-bottom: 0.25rem;
}

.info-item .value {
  font-size: 1rem;
  color: #1f2937;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.in_progress {
  background: #fef3c7;
  color: #92400e;
}

.status-badge.pending_verification {
  background: #dbeafe;
  color: #1e40af;
}

.action-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  border-color: var(--color-primary);
  background: #fff7ed;
  transform: translateY(-2px);
}

.action-btn .icon {
  font-size: 2rem;
}

.action-btn .label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
}

.attempts-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.attempt-item {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 1rem;
}

.attempt-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.channel-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.channel-badge.email {
  background: #dbeafe;
  color: #1e40af;
}

.channel-badge.sms {
  background: #fef3c7;
  color: #92400e;
}

.channel-badge.phone {
  background: #d1fae5;
  color: #065f46;
}

.channel-badge.whatsapp {
  background: #d1fae5;
  color: #065f46;
}

.contact-type {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.timestamp {
  margin-left: auto;
  font-size: 0.75rem;
  color: #6b7280;
}

.attempt-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.attempt-details > div {
  font-size: 0.875rem;
  color: #4b5563;
}

.outcome-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-left: 0.5rem;
}

.outcome-badge.success {
  background: #d1fae5;
  color: #065f46;
}

.outcome-badge.info {
  background: #dbeafe;
  color: #1e40af;
}

.outcome-badge.warning {
  background: #fed7aa;
  color: #9a3412;
}

.outcome-badge.neutral {
  background: #e5e7eb;
  color: #374151;
}

.attempt-footer {
  padding-top: 0.75rem;
  border-top: 1px solid #f3f4f6;
}

.staff-name {
  font-size: 0.75rem;
  color: #6b7280;
  font-style: italic;
}

.completion-buttons {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
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

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.btn-close {
  background: none;
  border: none;
  font-size: 2rem;
  color: #6b7280;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  width: 2rem;
  height: 2rem;
}

.btn-close:hover {
  color: #1f2937;
}

.modal-body {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  font-family: inherit;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1);
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.readonly-input {
  background-color: #f9fafb;
  color: #6b7280;
  cursor: not-allowed;
}

.help-text {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.5rem;
}

.error-text {
  color: #dc2626;
  font-size: 0.875rem;
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: #fef2f2;
  border-radius: 6px;
  border: 1px solid #fee2e2;
}
</style>

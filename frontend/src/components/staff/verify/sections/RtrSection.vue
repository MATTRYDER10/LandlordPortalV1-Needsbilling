<template>
  <SectionCard
    title="Right to Rent"
    :section-order="2"
    :decision="section.decision"
    :condition-text="section.conditionText"
    :fail-reason="section.failReason"
    :decision-by="section.decisionBy"
    :decision-at="section.decisionAt"
    :has-unreviewed-data="hasUnreviewedData"
    :read-only="readOnly"
    :loading="loading"
    :action-reason-codes="actionReasonCodes"
    @pass="$emit('pass', section.id)"
    @pass-with-condition="(c) => $emit('passWithCondition', section.id, c)"
    @action-required="(p) => $emit('actionRequired', section.id, p)"
    @fail="(r) => $emit('fail', section.id, r)"
    @reset="$emit('reset', section.id)"
  >
    <div class="section-content">
      <p class="section-description">
        Verify the tenant's right to rent in the UK. Check document validity and expiry dates.
      </p>

      <!-- RTR Status -->
      <div class="rtr-status-card">
        <div class="rtr-status-header">
          <span :class="['status-indicator', rtrStatus?.toLowerCase() || 'unknown']"></span>
          <span class="status-text">{{ rtrStatusLabel }}</span>
        </div>
        <p v-if="displayExpiryDate" class="expiry-date">
          Expires: {{ formatDate(displayExpiryDate) }}
        </p>
      </div>

      <!-- Nationality Info -->
      <div v-if="nationality" class="detail-item">
        <p class="detail-label">Nationality</p>
        <p class="detail-value">{{ nationality }}</p>
      </div>

      <!-- BRITISH CITIZEN SECTION -->
      <template v-if="isBritishCitizen">
        <!-- British Passport -->
        <div v-if="rtrBritishPassportUrl" class="document-section">
          <h4 class="subsection-title">Passport</h4>
          <div class="image-container">
            <img :src="rtrBritishPassportUrl" alt="British Passport" class="document-image" />
          </div>
        </div>

        <!-- British Alternative Document (DL or Birth Certificate) -->
        <div v-if="hasBritishNoPassport && rtrBritishAltDocUrl" class="document-section">
          <h4 class="subsection-title">{{ britishAltDocTypeLabel }}</h4>
          <div class="image-container">
            <img :src="rtrBritishAltDocUrl" :alt="britishAltDocTypeLabel" class="document-image" />
          </div>
        </div>

        <div v-if="hasBritishNoPassport && !rtrBritishAltDocUrl && !rtrBritishPassportUrl" class="info-message">
          <p>Tenant indicated they do not have a passport. No alternative document uploaded.</p>
        </div>

        <!-- Legacy reference - no new RTR documents uploaded -->
        <div v-if="!rtrBritishPassportUrl && !hasBritishNoPassport && !rtrBritishAltDocUrl" class="info-message">
          <p>Legacy reference: British citizen status was confirmed but no passport document was uploaded (pre-update reference).</p>
        </div>
      </template>

      <!-- INTERNATIONAL TENANT SECTION -->
      <template v-else>
        <!-- Share Code Display and Confirmation -->
        <div v-if="shareCode || localShareCodeConfirmed" class="share-code-section">
          <h4 class="subsection-title">Home Office Share Code</h4>

          <!-- Tenant-provided share code -->
          <div v-if="shareCode" class="share-code-display">
            <div>
              <p class="detail-label">Tenant provided:</p>
              <code class="share-code">{{ shareCode }}</code>
            </div>
            <a
              href="https://www.gov.uk/view-right-to-rent"
              target="_blank"
              rel="noopener noreferrer"
              class="verify-link"
            >
              Verify on GOV.UK
            </a>
          </div>

          <!-- Staff confirmation input -->
          <div v-if="!readOnly" class="staff-input-group">
            <label class="input-label">Confirm/Correct Share Code</label>
            <input
              v-model="localShareCodeConfirmed"
              type="text"
              class="text-input"
              placeholder="Enter confirmed share code"
              @change="emitRtrUpdate"
            />
            <p class="input-helper">Enter the share code after verifying on GOV.UK</p>
          </div>
          <div v-else-if="rtrStaffShareCodeConfirmed" class="confirmed-value">
            <p class="detail-label">Confirmed Share Code:</p>
            <code class="share-code confirmed">{{ rtrStaffShareCodeConfirmed }}</code>
          </div>
        </div>

        <!-- Staff Expiry Date Input (always available for international) -->
        <div class="expiry-section">
          <h4 class="subsection-title">Visa/Permit Expiry Date</h4>
          <div v-if="!readOnly" class="staff-input-group">
            <input
              v-model="localExpiryDate"
              type="date"
              class="date-input"
              @change="emitRtrUpdate"
            />
            <p class="input-helper">Enter the visa or permit expiry date</p>
          </div>
          <div v-else-if="rtrStaffExpiryDate" class="confirmed-value">
            <p>{{ formatDate(rtrStaffExpiryDate) }}</p>
          </div>
          <div v-else class="no-data">
            <p>No expiry date set</p>
          </div>
        </div>

        <!-- RTR Document -->
        <div v-if="rtrDocumentUrl" class="document-section">
          <h4 class="subsection-title">RTR Document</h4>
          <div class="image-container">
            <img :src="rtrDocumentUrl" alt="RTR Document" class="document-image" />
          </div>
        </div>

        <!-- Visa / BRP / Evidence Document -->
        <div v-if="rtrAlternativeDocumentUrl" class="document-section">
          <h4 class="subsection-title">{{ alternativeDocumentTypeLabel }}</h4>
          <div class="image-container">
            <img :src="rtrAlternativeDocumentUrl" :alt="alternativeDocumentTypeLabel" class="document-image" />
          </div>
        </div>
      </template>

      <!-- Evidence files -->
      <div v-if="section.evidenceFiles && section.evidenceFiles.length > 0" class="evidence-section">
        <h4 class="subsection-title">Evidence Files</h4>
        <div class="evidence-list">
          <div v-for="file in section.evidenceFiles" :key="file.fileId" class="evidence-item">
            <FileText class="evidence-icon" />
            <span class="evidence-name">{{ file.fileName }}</span>
          </div>
        </div>
      </div>

      <!-- Verification checks -->
      <div v-if="section.checks && section.checks.length > 0" class="checks-section">
        <h4 class="subsection-title">Verification Checks</h4>
        <div class="checks-list">
          <div v-for="check in section.checks" :key="check.name" class="check-item">
            <span :class="['check-icon', check.result]">
              <Check v-if="check.result === 'pass'" />
              <X v-else-if="check.result === 'fail'" />
              <Minus v-else />
            </span>
            <span class="check-name">{{ check.name }}</span>
          </div>
        </div>
      </div>
    </div>
  </SectionCard>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { FileText, Check, X, Minus } from 'lucide-vue-next'
import type { VerificationSection, ActionReasonCode } from '@/types/staff'
import SectionCard from './SectionCard.vue'

const props = defineProps<{
  section: VerificationSection
  rtrStatus?: string
  rtrExpiryDate?: string
  nationality?: string
  shareCode?: string
  rtrDocumentUrl?: string | null
  rtrAlternativeDocumentUrl?: string | null
  rtrAlternativeDocumentType?: string
  isBritishCitizen?: boolean
  hasUnreviewedData?: boolean
  readOnly?: boolean
  loading?: boolean
  actionReasonCodes?: ActionReasonCode[]
  // British citizen document props
  rtrBritishPassportUrl?: string | null
  rtrBritishAltDocUrl?: string | null
  rtrBritishAltDocType?: string
  hasBritishNoPassport?: boolean
  // Staff verification fields
  rtrStaffExpiryDate?: string
  rtrStaffShareCodeConfirmed?: string
}>()

const emit = defineEmits<{
  (e: 'pass', sectionId: string): void
  (e: 'passWithCondition', sectionId: string, condition: string): void
  (e: 'actionRequired', sectionId: string, params: { reasonCode: string; agentNote: string; internalNote: string }): void
  (e: 'fail', sectionId: string, reason: string): void
  (e: 'reset', sectionId: string): void
  (e: 'updateRtrData', data: { shareCodeConfirmed?: string; expiryDate?: string }): void
}>()

// Local state for staff inputs
const localShareCodeConfirmed = ref(props.rtrStaffShareCodeConfirmed || '')
const localExpiryDate = ref(props.rtrStaffExpiryDate || '')

// Watch for prop changes
watch(() => props.rtrStaffShareCodeConfirmed, (newVal) => {
  localShareCodeConfirmed.value = newVal || ''
})

watch(() => props.rtrStaffExpiryDate, (newVal) => {
  localExpiryDate.value = newVal || ''
})

const emitRtrUpdate = () => {
  emit('updateRtrData', {
    shareCodeConfirmed: localShareCodeConfirmed.value || undefined,
    expiryDate: localExpiryDate.value || undefined
  })
}

// Display the staff-entered expiry date if available, otherwise fall back to tenant-provided
const displayExpiryDate = computed(() => {
  return props.rtrStaffExpiryDate || props.rtrExpiryDate
})

const rtrStatusLabel = computed(() => {
  if (!props.rtrStatus) return 'Not verified'
  const labels: Record<string, string> = {
    uk_citizen: 'UK/Irish Citizen',
    settled_status: 'Settled Status',
    pre_settled_status: 'Pre-Settled Status',
    visa: 'Valid Visa',
    pending: 'Pending Verification',
    not_verified: 'Not Verified',
    expired: 'Expired'
  }
  return labels[props.rtrStatus] || props.rtrStatus
})

const formatDate = (dateString?: string) => {
  if (!dateString) return 'Not specified'
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

const alternativeDocumentTypeLabel = computed(() => {
  if (!props.rtrAlternativeDocumentType) return 'Document'
  if (props.rtrAlternativeDocumentType === 'brp') return 'Biometric Residence Permit (BRP)'
  if (props.rtrAlternativeDocumentType === 'visa') return 'Visa'
  if (props.rtrAlternativeDocumentType === 'screenshot') return 'Share Code Verification Screenshot'
  return props.rtrAlternativeDocumentType
})

const britishAltDocTypeLabel = computed(() => {
  if (!props.rtrBritishAltDocType) return 'Document'
  if (props.rtrBritishAltDocType === 'driving_license') return 'Driving Licence'
  if (props.rtrBritishAltDocType === 'birth_certificate') return 'Birth Certificate'
  return props.rtrBritishAltDocType
})
</script>

<style scoped>
.section-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-description {
  color: #6b7280;
  font-size: 0.875rem;
}

.rtr-status-card {
  padding: 1rem;
  background: #f9fafb;
  border-radius: 0.5rem;
  border-left: 4px solid #e5e7eb;
}

.rtr-status-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-indicator {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  background: #e5e7eb;
}

.status-indicator.uk_citizen,
.status-indicator.settled_status {
  background: #10b981;
}

.status-indicator.pre_settled_status,
.status-indicator.visa {
  background: #f59e0b;
}

.status-indicator.pending {
  background: #3b82f6;
}

.status-indicator.expired,
.status-indicator.not_verified {
  background: #ef4444;
}

.status-text {
  font-weight: 600;
  color: #1f2937;
}

.expiry-date {
  margin: 0.5rem 0 0;
  font-size: 0.875rem;
  color: #6b7280;
}

.detail-item {
  background: #f9fafb;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
}

.detail-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: #6b7280;
  margin: 0 0 0.25rem;
}

.detail-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: #1f2937;
  margin: 0;
}

.share-code-section,
.document-section,
.evidence-section,
.checks-section,
.expiry-section {
  padding: 1rem;
  background: #f9fafb;
  border-radius: 0.5rem;
}

.subsection-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 0.75rem;
}

.share-code-display {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.share-code {
  font-family: monospace;
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  background: white;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  border: 1px solid #e5e7eb;
}

.share-code.confirmed {
  border-color: #10b981;
  background: #ecfdf5;
}

.verify-link {
  color: var(--color-primary);
  font-size: 0.875rem;
  text-decoration: none;
}

.verify-link:hover {
  text-decoration: underline;
}

.staff-input-group {
  margin-top: 0.75rem;
}

.input-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.25rem;
}

.text-input,
.date-input {
  width: 100%;
  max-width: 300px;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: #1f2937;
}

.text-input:focus,
.date-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.1);
}

.input-helper {
  font-size: 0.75rem;
  color: #6b7280;
  margin: 0.25rem 0 0;
}

.confirmed-value {
  background: white;
  padding: 0.5rem 0.75rem;
  border-radius: 0.25rem;
  border: 1px solid #e5e7eb;
}

.no-data {
  color: #9ca3af;
  font-size: 0.875rem;
  font-style: italic;
}

.info-message {
  padding: 0.75rem 1rem;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 0.5rem;
  color: #92400e;
  font-size: 0.875rem;
}

.image-container {
  padding: 1rem;
  background: white;
  border-radius: 0.25rem;
  display: flex;
  justify-content: center;
}

.document-image {
  max-width: 100%;
  max-height: 300px;
  object-fit: contain;
}

.evidence-list,
.checks-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.evidence-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #4b5563;
}

.evidence-icon {
  width: 1rem;
  height: 1rem;
  color: #9ca3af;
}

.check-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.check-icon {
  width: 1.25rem;
  height: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.check-icon svg {
  width: 1rem;
  height: 1rem;
}

.check-icon.pass {
  color: #10b981;
}

.check-icon.fail {
  color: #ef4444;
}

.check-icon.na {
  color: #9ca3af;
}

.check-name {
  color: #374151;
}
</style>

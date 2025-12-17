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
        <p v-if="rtrExpiryDate" class="expiry-date">
          Expires: {{ formatDate(rtrExpiryDate) }}
        </p>
      </div>

      <!-- Nationality Info -->
      <div v-if="nationality" class="detail-item">
        <p class="detail-label">Nationality</p>
        <p class="detail-value">{{ nationality }}</p>
      </div>

      <!-- Share Code verification -->
      <div v-if="shareCode" class="share-code-section">
        <h4 class="subsection-title">Home Office Share Code</h4>
        <div class="share-code-display">
          <code class="share-code">{{ shareCode }}</code>
          <a
            href="https://www.gov.uk/view-right-to-rent"
            target="_blank"
            rel="noopener noreferrer"
            class="verify-link"
          >
            Verify on GOV.UK
          </a>
        </div>
      </div>

      <!-- RTR Document -->
      <div v-if="rtrDocumentUrl" class="document-section">
        <h4 class="subsection-title">RTR Document</h4>
        <div class="image-container">
          <img :src="rtrDocumentUrl" alt="RTR Document" class="document-image" />
        </div>
      </div>

      <!-- Visa / BRP Document -->
      <div v-if="rtrAlternativeDocumentUrl" class="document-section">
        <h4 class="subsection-title">{{ alternativeDocumentTypeLabel }}</h4>
        <div class="image-container">
          <img :src="rtrAlternativeDocumentUrl" :alt="alternativeDocumentTypeLabel" class="document-image" />
        </div>
      </div>

      <!-- Evidence files -->
      <div v-if="section.evidenceFiles && section.evidenceFiles.length > 0" class="evidence-section">
        <h4 class="subsection-title">Evidence Files</h4>
        <div class="evidence-list">
          <div v-for="file in section.evidenceFiles" :key="file.fileId" class="evidence-item">
            <svg class="evidence-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
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
              <svg v-if="check.result === 'pass'" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
              <svg v-else-if="check.result === 'fail'" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
              <svg v-else fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
              </svg>
            </span>
            <span class="check-name">{{ check.name }}</span>
          </div>
        </div>
      </div>
    </div>
  </SectionCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
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
}>()

defineEmits<{
  (e: 'pass', sectionId: string): void
  (e: 'passWithCondition', sectionId: string, condition: string): void
  (e: 'actionRequired', sectionId: string, params: { reasonCode: string; agentNote: string; internalNote: string }): void
  (e: 'fail', sectionId: string, reason: string): void
  (e: 'reset', sectionId: string): void
}>()

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
  return props.rtrAlternativeDocumentType
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
.checks-section {
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
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
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

.verify-link {
  color: #f97316;
  font-size: 0.875rem;
  text-decoration: none;
}

.verify-link:hover {
  text-decoration: underline;
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

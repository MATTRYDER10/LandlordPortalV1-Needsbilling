<template>
  <SectionCard
    title="Identity & Selfie"
    :section-order="1"
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
        Compare the {{ isGuarantor ? "guarantor's" : "tenant's" }} ID document and selfie, and confirm their identity matches the application details.
      </p>

      <!-- Document vs Selfie comparison -->
      <div class="comparison-grid">
        <div class="comparison-item">
          <h4 class="comparison-title">ID Document</h4>
          <div v-if="idDocumentUrl" class="image-container">
            <img :src="idDocumentUrl" alt="ID Document" class="document-image" />
          </div>
          <div v-else class="placeholder">
            <svg class="placeholder-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
            </svg>
            <p>No ID document uploaded</p>
          </div>
        </div>

        <div class="comparison-item">
          <h4 class="comparison-title">Selfie</h4>
          <div v-if="selfieUrl" class="image-container">
            <img :src="selfieUrl" alt="Selfie" class="document-image" />
          </div>
          <div v-else class="placeholder">
            <svg class="placeholder-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <p>No selfie uploaded</p>
          </div>
        </div>
      </div>

      <!-- Key identity details -->
      <div class="details-grid">
        <div class="detail-item">
          <p class="detail-label">Full Name</p>
          <p class="detail-value">{{ fullName }}</p>
        </div>
        <div v-if="middleName" class="detail-item">
          <p class="detail-label">Middle Name</p>
          <p class="detail-value">{{ middleName }}</p>
        </div>
        <div class="detail-item">
          <p class="detail-label">Date of Birth</p>
          <p class="detail-value">{{ dateOfBirth || 'Not provided' }}</p>
        </div>
        <div v-if="nationality" class="detail-item">
          <p class="detail-label">Nationality</p>
          <p class="detail-value">{{ nationality }}</p>
        </div>
        <div v-if="email" class="detail-item">
          <p class="detail-label">Email</p>
          <p class="detail-value">{{ email }}</p>
        </div>
        <div v-if="contactNumber" class="detail-item">
          <p class="detail-label">Phone</p>
          <p class="detail-value">{{ contactNumber }}</p>
        </div>
      </div>

      <!-- Signature if available -->
      <div v-if="signatureUrl" class="signature-section">
        <p class="detail-label">Consent Signature</p>
        <div class="signature-container">
          <img :src="signatureUrl" alt="Consent Signature" class="signature-image" />
        </div>
      </div>

      <!-- Evidence files from this section -->
      <div v-if="section.evidenceFiles && section.evidenceFiles.length > 0" class="evidence-section">
        <h4 class="evidence-title">Evidence Files</h4>
        <div class="evidence-list">
          <div v-for="file in section.evidenceFiles" :key="file.fileId" class="evidence-item">
            <svg class="evidence-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span class="evidence-name">{{ file.fileName }}</span>
          </div>
        </div>
      </div>

      <!-- Checks -->
      <div v-if="section.checks && section.checks.length > 0" class="checks-section">
        <h4 class="checks-title">Verification Checks</h4>
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
            <span v-if="check.notes" class="check-notes">({{ check.notes }})</span>
          </div>
        </div>
      </div>
    </div>
  </SectionCard>
</template>

<script setup lang="ts">
import type { VerificationSection, ActionReasonCode } from '@/types/staff'
import SectionCard from './SectionCard.vue'

defineProps<{
  section: VerificationSection
  isGuarantor: boolean
  fullName: string
  middleName?: string
  dateOfBirth?: string
  nationality?: string
  email?: string
  contactNumber?: string
  idDocumentUrl?: string | null
  selfieUrl?: string | null
  signatureUrl?: string | null
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

.comparison-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}

@media (max-width: 768px) {
  .comparison-grid {
    grid-template-columns: 1fr;
  }
}

.comparison-item {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
}

.comparison-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  padding: 0.75rem;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  margin: 0;
}

.image-container {
  padding: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.document-image {
  max-width: 100%;
  max-height: 300px;
  object-fit: contain;
  border-radius: 0.25rem;
}

.placeholder {
  padding: 2rem;
  text-align: center;
  color: #9ca3af;
}

.placeholder-icon {
  width: 3rem;
  height: 3rem;
  margin: 0 auto 0.5rem;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

@media (max-width: 640px) {
  .details-grid {
    grid-template-columns: 1fr;
  }
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

.signature-section {
  padding: 1rem;
  background: #f9fafb;
  border-radius: 0.5rem;
}

.signature-container {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.25rem;
  display: inline-block;
}

.signature-image {
  max-height: 80px;
  object-fit: contain;
}

.evidence-section,
.checks-section {
  padding: 1rem;
  background: #f9fafb;
  border-radius: 0.5rem;
}

.evidence-title,
.checks-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 0.75rem;
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

.evidence-name {
  flex: 1;
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

.check-notes {
  color: #9ca3af;
  font-size: 0.75rem;
}
</style>

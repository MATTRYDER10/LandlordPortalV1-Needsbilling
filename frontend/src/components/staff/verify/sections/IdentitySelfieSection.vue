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
          <div class="comparison-header">
            <h4 class="comparison-title">ID Document</h4>
            <div v-if="idDocumentUrl" class="image-controls">
              <button type="button" class="control-btn" @click="rotateId" title="Rotate 90°">
                <RotateCw :size="16" />
              </button>
              <button type="button" class="control-btn" @click="zoomOutId" :disabled="idZoom <= 0.5" title="Zoom out">
                <ZoomOut :size="16" />
              </button>
              <span class="zoom-level">{{ Math.round(idZoom * 100) }}%</span>
              <button type="button" class="control-btn" @click="zoomInId" :disabled="idZoom >= 3" title="Zoom in">
                <ZoomIn :size="16" />
              </button>
              <button type="button" class="control-btn" @click="resetId" title="Reset">
                <X :size="16" />
              </button>
            </div>
          </div>
          <div v-if="idDocumentUrl" class="image-container">
            <iframe
              v-if="idDocumentIsPdf"
              :src="idDocumentUrl"
              class="document-frame"
              :style="{ transform: `rotate(${idRotation}deg) scale(${idZoom})` }"
              frameborder="0"
            ></iframe>
            <img
              v-else
              :src="idDocumentUrl"
              alt="ID Document"
              class="document-image"
              :style="{ transform: `rotate(${idRotation}deg) scale(${idZoom})` }"
            />
          </div>
          <div v-else class="placeholder">
            <IdCard class="placeholder-icon" />
            <p>No ID document uploaded</p>
          </div>
        </div>

        <div class="comparison-item">
          <div class="comparison-header">
            <h4 class="comparison-title">Selfie</h4>
            <div v-if="selfieUrl" class="image-controls">
              <button type="button" class="control-btn" @click="rotateSelfie" title="Rotate 90°">
                <RotateCw :size="16" />
              </button>
              <button type="button" class="control-btn" @click="zoomOutSelfie" :disabled="selfieZoom <= 0.5" title="Zoom out">
                <ZoomOut :size="16" />
              </button>
              <span class="zoom-level">{{ Math.round(selfieZoom * 100) }}%</span>
              <button type="button" class="control-btn" @click="zoomInSelfie" :disabled="selfieZoom >= 3" title="Zoom in">
                <ZoomIn :size="16" />
              </button>
              <button type="button" class="control-btn" @click="resetSelfie" title="Reset">
                <X :size="16" />
              </button>
            </div>
          </div>
          <div v-if="selfieUrl" class="image-container">
            <img
              :src="selfieUrl"
              alt="Selfie"
              class="document-image"
              :style="{ transform: `rotate(${selfieRotation}deg) scale(${selfieZoom})` }"
            />
          </div>
          <div v-else class="placeholder">
            <User class="placeholder-icon" />
            <p>No selfie uploaded</p>
          </div>
        </div>
      </div>

      <!-- Key identity details -->
      <div class="details-grid">
        <!-- Full Name with verification -->
        <div class="detail-item detail-item-full">
          <p class="detail-label">Full Name</p>
          <p class="detail-value">{{ fullName }}</p>

          <!-- Name match question -->
          <div class="name-match-section">
            <p class="name-match-label">Does name match full ID name?</p>
            <div class="name-match-buttons">
              <button
                type="button"
                @click="nameMatchesId = true"
                :class="['match-btn', nameMatchesId === true ? 'match-btn-yes-active' : 'match-btn-inactive']"
              >
                Yes
              </button>
              <button
                type="button"
                @click="handleNameMismatch"
                :class="['match-btn', nameMatchesId === false ? 'match-btn-no-active' : 'match-btn-inactive']"
              >
                No
              </button>
            </div>
          </div>

          <!-- Name correction form (shown when No is selected) -->
          <div v-if="nameMatchesId === false" class="name-correction-form">
            <p class="correction-label">Correct name as shown on ID:</p>
            <div class="correction-inputs">
              <div class="correction-field">
                <label class="field-label">First Name</label>
                <input
                  v-model="correctedFirstName"
                  type="text"
                  class="correction-input"
                  placeholder="First name from ID"
                />
              </div>
              <div class="correction-field">
                <label class="field-label">Last Name</label>
                <input
                  v-model="correctedLastName"
                  type="text"
                  class="correction-input"
                  placeholder="Last name from ID"
                />
              </div>
            </div>
            <button
              type="button"
              @click="submitNameCorrection"
              :disabled="savingNameCorrection || !correctedFirstName.trim() || !correctedLastName.trim()"
              class="save-correction-btn"
            >
              {{ savingNameCorrection ? 'Saving...' : 'Save Corrected Name' }}
            </button>
          </div>
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
            <FileText class="evidence-icon" />
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
              <Check v-if="check.result === 'pass'" :size="16" />
              <X v-else-if="check.result === 'fail'" :size="16" />
              <Minus v-else :size="16" />
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
import { ref, watch } from 'vue'
import type { VerificationSection, ActionReasonCode } from '@/types/staff'
import SectionCard from './SectionCard.vue'
import { RotateCw, ZoomOut, ZoomIn, X, IdCard, User, FileText, Check, Minus } from 'lucide-vue-next'

// Image manipulation state
const idRotation = ref(0)
const idZoom = ref(1)
const selfieRotation = ref(0)
const selfieZoom = ref(1)

function rotateId() {
  idRotation.value = (idRotation.value + 90) % 360
}

function zoomInId() {
  if (idZoom.value < 3) {
    idZoom.value = Math.min(3, idZoom.value + 0.5)
  }
}

function zoomOutId() {
  if (idZoom.value > 0.5) {
    idZoom.value = Math.max(0.5, idZoom.value - 0.5)
  }
}

function resetId() {
  idRotation.value = 0
  idZoom.value = 1
}

function rotateSelfie() {
  selfieRotation.value = (selfieRotation.value + 90) % 360
}

function zoomInSelfie() {
  if (selfieZoom.value < 3) {
    selfieZoom.value = Math.min(3, selfieZoom.value + 0.5)
  }
}

function zoomOutSelfie() {
  if (selfieZoom.value > 0.5) {
    selfieZoom.value = Math.max(0.5, selfieZoom.value - 0.5)
  }
}

function resetSelfie() {
  selfieRotation.value = 0
  selfieZoom.value = 1
}

// Name verification state
const nameMatchesId = ref<boolean | null>(null)
const correctedFirstName = ref('')
const correctedLastName = ref('')

const props = defineProps<{
  section: VerificationSection
  isGuarantor: boolean
  fullName: string
  firstName?: string
  lastName?: string
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
  savingNameCorrection?: boolean
}>()

const idDocumentIsPdf = ref(false)

const updateIdDocumentType = async (url?: string | null) => {
  if (!url) {
    idDocumentIsPdf.value = false
    return
  }

  if (url.startsWith('blob:')) {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      idDocumentIsPdf.value = blob.type === 'application/pdf'
      return
    } catch {
      idDocumentIsPdf.value = false
      return
    }
  }

  const cleanUrl = url.split('?')[0] || ''
  idDocumentIsPdf.value = cleanUrl.toLowerCase().endsWith('.pdf')
}

const emit = defineEmits<{
  (e: 'pass', sectionId: string): void
  (e: 'passWithCondition', sectionId: string, condition: string): void
  (e: 'actionRequired', sectionId: string, params: { reasonCode: string; agentNote: string; internalNote: string }): void
  (e: 'fail', sectionId: string, reason: string): void
  (e: 'reset', sectionId: string): void
  (e: 'updateName', firstName: string, lastName: string): void
}>()

// Initialize corrected name fields when "No" is clicked
function handleNameMismatch() {
  nameMatchesId.value = false
  correctedFirstName.value = props.firstName || ''
  correctedLastName.value = props.lastName || ''
}

// Submit name correction
function submitNameCorrection() {
  if (correctedFirstName.value.trim() && correctedLastName.value.trim()) {
    emit('updateName', correctedFirstName.value.trim(), correctedLastName.value.trim())
  }
}

// Watch for successful name update (when savingNameCorrection goes from true to false and names match)
watch(() => props.savingNameCorrection, (newVal, oldVal) => {
  if (oldVal === true && newVal === false) {
    // After save completes, check if names were updated
    if (props.firstName === correctedFirstName.value && props.lastName === correctedLastName.value) {
      nameMatchesId.value = true
    }
  }
})

watch(() => props.idDocumentUrl, (newUrl) => {
  updateIdDocumentType(newUrl)
}, { immediate: true })
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

.comparison-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  gap: 0.5rem;
}

.comparison-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin: 0;
}

.image-controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: white;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s ease;
}

.control-btn:hover:not(:disabled) {
  background: #f3f4f6;
  color: #374151;
  border-color: #9ca3af;
}

.control-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.zoom-level {
  font-size: 0.7rem;
  color: #6b7280;
  min-width: 36px;
  text-align: center;
}

.image-container {
  padding: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  overflow: hidden;
}

.document-image {
  max-width: 100%;
  max-height: 300px;
  object-fit: contain;
  border-radius: 0.25rem;
  transition: transform 0.2s ease;
}

.document-frame {
  width: 100%;
  height: 300px;
  border: 0;
  border-radius: 0.25rem;
  transition: transform 0.2s ease;
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

/* Name verification styles */
.detail-item-full {
  grid-column: 1 / -1;
}

.name-match-section {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e5e7eb;
}

.name-match-label {
  font-size: 0.875rem;
  color: #374151;
  margin: 0 0 0.5rem;
}

.name-match-buttons {
  display: flex;
  gap: 0.5rem;
}

.match-btn {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.match-btn-inactive {
  background: white;
  border: 1px solid #d1d5db;
  color: #374151;
}

.match-btn-inactive:hover {
  background: #f9fafb;
}

.match-btn-yes-active {
  background: #16a34a;
  border: 1px solid #16a34a;
  color: white;
}

.match-btn-no-active {
  background: #ea580c;
  border: 1px solid #ea580c;
  color: white;
}

.name-correction-form {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e5e7eb;
}

.correction-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin: 0 0 0.75rem;
}

.correction-inputs {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.correction-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.field-label {
  font-size: 0.75rem;
  color: #6b7280;
}

.correction-input {
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  outline: none;
  transition: border-color 0.15s ease;
}

.correction-input:focus {
  border-color: #f97316;
  box-shadow: 0 0 0 1px #f97316;
}

.save-correction-btn {
  margin-top: 0.75rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: white;
  background: #f97316;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background 0.15s ease;
}

.save-correction-btn:hover:not(:disabled) {
  background: #ea580c;
}

.save-correction-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

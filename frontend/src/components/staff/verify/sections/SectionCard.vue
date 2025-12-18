<template>
  <div :class="['section-card', { collapsed: isCollapsed, 'read-only': readOnly }]">
    <div class="section-header" @click="toggleCollapse">
      <div class="section-header-left">
        <button class="collapse-btn" :aria-label="isCollapsed ? 'Expand' : 'Collapse'">
          <svg :class="['collapse-icon', { collapsed: isCollapsed }]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <span class="section-order">{{ sectionOrder }}</span>
        <h3 class="section-title">{{ title }}</h3>
      </div>
      <div class="section-header-right">
        <span v-if="hasUnreviewedData" class="data-badge">New Data</span>
        <SectionStatusPill :decision="decision" />
      </div>
    </div>

    <Transition name="expand">
      <div v-if="!isCollapsed" class="section-body">
        <slot />

        <div v-if="decision === 'NOT_REVIEWED' && !readOnly" class="decision-actions">
          <div class="quick-actions">
            <button
              @click="$emit('pass')"
              class="btn btn-pass"
              :disabled="loading"
            >
              Pass
            </button>
            <button
              @click="showPassConditionModal = true"
              class="btn btn-pass-condition"
              :disabled="loading"
            >
              Pass with Condition
            </button>
            <button
              @click="usePassWithGuarantor ? handlePassWithGuarantor() : showActionRequiredModal = true"
              :class="['btn', usePassWithGuarantor ? 'btn-pass-guarantor' : 'btn-action-required']"
              :disabled="loading"
            >
              {{ actionRequiredLabel || 'Action Required' }}
            </button>
            <button
              @click="showFailModal = true"
              class="btn btn-fail"
              :disabled="loading"
            >
              Fail
            </button>
          </div>
        </div>

        <div v-else-if="decision !== 'NOT_REVIEWED'" class="decision-info">
          <div class="decision-details">
            <span class="decision-label">Decision:</span>
            <SectionStatusPill :decision="decision" />
            <span v-if="decisionBy" class="decision-by">by {{ decisionBy }}</span>
            <span v-if="decisionAt" class="decision-at">{{ formatDate(decisionAt) }}</span>
          </div>
          <p v-if="conditionText" class="condition-text">
            <strong>Condition:</strong> {{ conditionText }}
          </p>
          <p v-if="failReason" class="fail-reason">
            <strong>Fail Reason:</strong> {{ failReason }}
          </p>
          <button
            v-if="!readOnly"
            @click="$emit('reset')"
            class="btn btn-reset"
            :disabled="loading"
          >
            Reset Decision
          </button>
        </div>
      </div>
    </Transition>

    <!-- Pass with Condition Modal -->
    <Teleport to="body">
      <div v-if="showPassConditionModal" class="modal-overlay" @click="showPassConditionModal = false">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>Pass with Condition</h3>
            <button @click="showPassConditionModal = false" class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Condition Text (appears on certificate)</label>
              <textarea
                v-model="conditionInput"
                placeholder="Enter the condition that must be met..."
                rows="3"
              ></textarea>
            </div>
          </div>
          <div class="modal-actions">
            <button @click="showPassConditionModal = false" class="btn btn-secondary">Cancel</button>
            <button
              @click="submitPassCondition"
              class="btn btn-primary"
              :disabled="!conditionInput.trim()"
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Action Required Modal -->
    <Teleport to="body">
      <div v-if="showActionRequiredModal" class="modal-overlay" @click="showActionRequiredModal = false">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>{{ actionRequiredLabel || 'Action Required' }}</h3>
            <button @click="showActionRequiredModal = false" class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Reason Code</label>
              <select v-model="actionReasonCode">
                <option value="">Select a reason...</option>
                <option v-for="code in actionReasonCodes" :key="code.code" :value="code.code">
                  {{ code.displayLabel }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>Message for Agent/Tenant (visible to them)</label>
              <textarea
                v-model="actionAgentNote"
                placeholder="Explain what action is needed..."
                rows="3"
              ></textarea>
            </div>
            <div class="form-group">
              <label>Internal Note (staff only)</label>
              <textarea
                v-model="actionInternalNote"
                placeholder="Add any internal notes..."
                rows="2"
              ></textarea>
            </div>
          </div>
          <div class="modal-actions">
            <button @click="showActionRequiredModal = false" class="btn btn-secondary">Cancel</button>
            <button
              @click="submitActionRequired"
              class="btn btn-primary"
              :disabled="!actionReasonCode || !actionAgentNote.trim()"
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Fail Modal -->
    <Teleport to="body">
      <div v-if="showFailModal" class="modal-overlay" @click="showFailModal = false">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>Fail Section</h3>
            <button @click="showFailModal = false" class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <p class="warning-text">
              Failing this section will result in the entire reference being failed.
              Are you sure you want to proceed?
            </p>
            <div class="form-group">
              <label>Fail Reason</label>
              <textarea
                v-model="failReasonInput"
                placeholder="Explain why this section is failing..."
                rows="3"
              ></textarea>
            </div>
          </div>
          <div class="modal-actions">
            <button @click="showFailModal = false" class="btn btn-secondary">Cancel</button>
            <button
              @click="submitFail"
              class="btn btn-fail"
              :disabled="!failReasonInput.trim()"
            >
              Confirm Fail
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { SectionDecision, ActionReasonCode } from '@/types/staff'
import SectionStatusPill from '../../shared/SectionStatusPill.vue'

const props = defineProps<{
  title: string
  sectionOrder: number
  decision: SectionDecision
  conditionText?: string
  failReason?: string
  decisionBy?: string
  decisionAt?: string
  hasUnreviewedData?: boolean
  readOnly?: boolean
  loading?: boolean
  actionReasonCodes?: ActionReasonCode[]
  actionRequiredLabel?: string // Custom label for the action required button
  usePassWithGuarantor?: boolean // When true, third button becomes "Pass with Guarantor" and uses passWithCondition
}>()

const emit = defineEmits<{
  (e: 'pass'): void
  (e: 'passWithCondition', condition: string): void
  (e: 'actionRequired', params: { reasonCode: string; agentNote: string; internalNote: string }): void
  (e: 'fail', reason: string): void
  (e: 'reset'): void
}>()

const isCollapsed = ref(props.decision !== 'NOT_REVIEWED')

// Modal states
const showPassConditionModal = ref(false)
const showActionRequiredModal = ref(false)
const showFailModal = ref(false)

// Form inputs
const conditionInput = ref('')
const actionReasonCode = ref('')
const actionAgentNote = ref('')
const actionInternalNote = ref('')
const failReasonInput = ref('')

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const submitPassCondition = () => {
  emit('passWithCondition', conditionInput.value.trim())
  showPassConditionModal.value = false
  conditionInput.value = ''
}

const submitActionRequired = () => {
  emit('actionRequired', {
    reasonCode: actionReasonCode.value,
    agentNote: actionAgentNote.value.trim(),
    internalNote: actionInternalNote.value.trim()
  })
  showActionRequiredModal.value = false
  actionReasonCode.value = ''
  actionAgentNote.value = ''
  actionInternalNote.value = ''
}

const submitFail = () => {
  emit('fail', failReasonInput.value.trim())
  showFailModal.value = false
  failReasonInput.value = ''
}

const handlePassWithGuarantor = () => {
  emit('passWithCondition', 'Requires guarantor to meet affordability requirements')
}
</script>

<style scoped>
.section-card {
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 1rem;
  overflow: hidden;
}

.section-card.read-only {
  opacity: 0.9;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  cursor: pointer;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  transition: background 0.2s;
}

.section-header:hover {
  background: #f3f4f6;
}

.section-header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.collapse-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.collapse-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #6b7280;
  transition: transform 0.2s;
}

.collapse-icon.collapsed {
  transform: rotate(-90deg);
}

.section-order {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: #e5e7eb;
  font-size: 0.75rem;
  font-weight: 600;
  color: #4b5563;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.section-header-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.data-badge {
  padding: 0.25rem 0.5rem;
  background: #dbeafe;
  color: #1e40af;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.section-body {
  padding: 1.25rem;
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.decision-actions {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.quick-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
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

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-pass {
  background: #10b981;
  color: white;
}

.btn-pass:hover:not(:disabled) {
  background: #059669;
}

.btn-pass-condition {
  background: #f59e0b;
  color: white;
}

.btn-pass-condition:hover:not(:disabled) {
  background: #d97706;
}

.btn-action-required {
  background: var(--color-primary);
  color: white;
}

.btn-action-required:hover:not(:disabled) {
  background: #ea580c;
}

.btn-pass-guarantor {
  background: #8b5cf6;
  color: white;
}

.btn-pass-guarantor:hover:not(:disabled) {
  background: #7c3aed;
}

.btn-fail {
  background: #ef4444;
  color: white;
}

.btn-fail:hover:not(:disabled) {
  background: #dc2626;
}

.btn-reset {
  background: #6b7280;
  color: white;
}

.btn-reset:hover:not(:disabled) {
  background: #4b5563;
}

.btn-secondary {
  background: #e5e7eb;
  color: #374151;
}

.btn-secondary:hover:not(:disabled) {
  background: #d1d5db;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #ea580c;
}

.decision-info {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 0.5rem;
}

.decision-details {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.decision-label {
  font-weight: 500;
  color: #6b7280;
}

.decision-by,
.decision-at {
  font-size: 0.875rem;
  color: #9ca3af;
}

.condition-text,
.fail-reason {
  margin-top: 0.75rem;
  font-size: 0.875rem;
  color: #4b5563;
}

/* Modal styles */
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
  border-radius: 0.5rem;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #6b7280;
  cursor: pointer;
}

.modal-body {
  padding: 1.25rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid #e5e7eb;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
}

.form-group textarea,
.form-group select {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
  font-family: inherit;
}

.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1);
}

.warning-text {
  background: #fef2f2;
  color: #991b1b;
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  font-size: 0.875rem;
}
</style>

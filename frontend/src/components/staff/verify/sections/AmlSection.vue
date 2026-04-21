<template>
  <SectionCard
    title="AML / PEP / Sanctions"
    :section-order="isGuarantor ? 4 : 6"
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
        Anti-money laundering, politically exposed person (PEP), and sanctions screening results.
      </p>

      <!-- Auto-Pass Banner -->
      <div v-if="section.sectionData?.autoPassApplied" class="auto-pass-banner">
        <CheckCircle class="auto-pass-icon" />
        <div class="auto-pass-content">
          <span class="auto-pass-label">Auto-Passed by System</span>
          <p class="auto-pass-detail">{{ section.sectionData?.autoPassReason || 'AML clear with zero matches' }}</p>
          <p v-if="section.sectionData?.autoPassAt" class="auto-pass-time">
            {{ formatDateTime(section.sectionData.autoPassAt) }}
          </p>
        </div>
      </div>

      <!-- Overall AML Status -->
      <div class="aml-status-card">
        <div class="aml-status-header">
          <h4 class="status-title">AML Screening Status</h4>
          <span :class="['status-badge', amlStatus?.toLowerCase() || 'pending']">
            {{ formatAmlStatus(amlStatus) }}
          </span>
        </div>
        <p v-if="lastCheckedAt" class="last-checked">
          Last checked: {{ formatDateTime(lastCheckedAt) }}
        </p>
      </div>

      <!-- Screening Results -->
      <div class="screening-results">
        <h4 class="subsection-title">Screening Results</h4>
        <div class="results-grid">
          <!-- PEP Check -->
          <div class="result-item">
            <div class="result-header">
              <span class="result-label">PEP Check</span>
              <span :class="['result-status', pepResult?.toLowerCase() || 'pending']">
                {{ formatResult(pepResult) }}
              </span>
            </div>
            <p v-if="pepDetails" class="result-details">{{ pepDetails }}</p>
          </div>

          <!-- Sanctions Check -->
          <div class="result-item">
            <div class="result-header">
              <span class="result-label">Sanctions Check</span>
              <span :class="['result-status', sanctionsResult?.toLowerCase() || 'pending']">
                {{ formatResult(sanctionsResult) }}
              </span>
            </div>
            <p v-if="sanctionsDetails" class="result-details">{{ sanctionsDetails }}</p>
          </div>

        </div>
      </div>

      <!-- Potential Matches -->
      <div v-if="potentialMatches && potentialMatches.length > 0" class="matches-section">
        <h4 class="subsection-title">
          Potential Matches
          <span class="match-count">({{ potentialMatches.length }})</span>
        </h4>
        <div class="matches-list">
          <div v-for="(match, index) in potentialMatches" :key="index" :class="['match-item', match.severity]">
            <div class="match-header">
              <span class="match-type">{{ match.type }}</span>
              <span :class="['match-score', getScoreClass(match.score)]">
                {{ match.score }}% match
              </span>
            </div>
            <div class="match-details">
              <p v-if="match.name" class="match-name">{{ match.name }}</p>
              <p v-if="match.description" class="match-description">{{ match.description }}</p>
              <p v-if="match.source" class="match-source">Source: {{ match.source }}</p>
            </div>
            <div v-if="match.reviewedBy" class="match-reviewed">
              <Check class="reviewed-icon" />
              Reviewed by {{ match.reviewedBy }}
            </div>
          </div>
        </div>
      </div>

      <!-- Risk Assessment -->
      <div v-if="riskLevel" class="risk-section">
        <h4 class="subsection-title">Risk Assessment</h4>
        <div :class="['risk-card', riskLevel.toLowerCase()]">
          <div class="risk-header">
            <span class="risk-label">Overall Risk Level</span>
            <span :class="['risk-badge', riskLevel.toLowerCase()]">
              {{ riskLevel }}
            </span>
          </div>
          <p v-if="riskReason" class="risk-reason">{{ riskReason }}</p>
        </div>
      </div>

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
    </div>
  </SectionCard>
</template>

<script setup lang="ts">
import { Check, FileText, CheckCircle } from 'lucide-vue-next'
import type { VerificationSection, ActionReasonCode } from '@/types/staff'
import SectionCard from './SectionCard.vue'

interface PotentialMatch {
  type: string
  name?: string
  description?: string
  source?: string
  score: number
  severity: 'low' | 'medium' | 'high'
  reviewedBy?: string
}

defineProps<{
  section: VerificationSection
  isGuarantor: boolean
  sanctionsScreening?: any
  amlStatus?: string
  lastCheckedAt?: string
  pepResult?: string
  pepDetails?: string
  pepMatches?: any[]
  sanctionsResult?: string
  sanctionsDetails?: string
  sanctionsMatches?: any[]
  adverseMediaResult?: string
  adverseMediaMatches?: any[]
  idVerificationResult?: string
  idVerificationDetails?: string
  potentialMatches?: PotentialMatch[]
  riskLevel?: string
  riskReason?: string
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

const formatAmlStatus = (status?: string) => {
  if (!status) return 'Pending'
  const statuses: Record<string, string> = {
    clear: 'Clear',
    review_required: 'Review Required',
    potential_match: 'Potential Match',
    match_found: 'Match Found',
    pending: 'Pending'
  }
  return statuses[status.toLowerCase()] || status
}

const formatResult = (result?: string) => {
  if (!result) return 'Pending'
  const results: Record<string, string> = {
    clear: 'Clear',
    no_match: 'No Match',
    potential_match: 'Potential Match',
    match: 'Match Found',
    pending: 'Pending'
  }
  return results[result.toLowerCase()] || result
}

const formatDateTime = (dateString: string) => {
  return new Date(dateString).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getScoreClass = (score: number) => {
  if (score >= 80) return 'high'
  if (score >= 50) return 'medium'
  return 'low'
}
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

.auto-pass-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 0.5rem;
}

.auto-pass-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #059669;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.auto-pass-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.auto-pass-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #065f46;
}

.auto-pass-detail {
  font-size: 0.8rem;
  color: #047857;
  margin: 0;
}

.auto-pass-time {
  font-size: 0.75rem;
  color: #6ee7b7;
  margin: 0;
}

.aml-status-card {
  padding: 1rem;
  background: #f9fafb;
  border-radius: 0.5rem;
}

.aml-status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin: 0;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-badge.clear {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.review_required,
.status-badge.potential_match {
  background: #fef3c7;
  color: #92400e;
}

.status-badge.match_found {
  background: #fee2e2;
  color: #991b1b;
}

.status-badge.pending {
  background: #e5e7eb;
  color: #6b7280;
}

.last-checked {
  margin: 0.5rem 0 0;
  font-size: 0.75rem;
  color: #9ca3af;
}

.screening-results,
.matches-section,
.risk-section,
.evidence-section {
  padding: 1rem;
  background: #f9fafb;
  border-radius: 0.5rem;
}

.subsection-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.match-count {
  font-size: 0.75rem;
  font-weight: 500;
  color: #6b7280;
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

@media (max-width: 640px) {
  .results-grid {
    grid-template-columns: 1fr;
  }
}

.result-item {
  background: white;
  padding: 0.75rem;
  border-radius: 0.25rem;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.result-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: #6b7280;
}

.result-status {
  padding: 0.125rem 0.375rem;
  border-radius: 9999px;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
}

.result-status.clear,
.result-status.no_match {
  background: #d1fae5;
  color: #065f46;
}

.result-status.potential_match {
  background: #fef3c7;
  color: #92400e;
}

.result-status.match {
  background: #fee2e2;
  color: #991b1b;
}

.result-status.pending {
  background: #e5e7eb;
  color: #6b7280;
}

.result-details {
  font-size: 0.75rem;
  color: #6b7280;
  margin: 0;
}

.matches-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.match-item {
  background: white;
  padding: 0.75rem;
  border-radius: 0.25rem;
  border-left: 3px solid #e5e7eb;
}

.match-item.low {
  border-left-color: #fcd34d;
}

.match-item.medium {
  border-left-color: var(--color-primary);
}

.match-item.high {
  border-left-color: #ef4444;
}

.match-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.match-type {
  font-size: 0.75rem;
  font-weight: 600;
  color: #374151;
  text-transform: uppercase;
}

.match-score {
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  font-size: 0.625rem;
  font-weight: 600;
}

.match-score.low {
  background: #fef3c7;
  color: #92400e;
}

.match-score.medium {
  background: #fed7aa;
  color: #9a3412;
}

.match-score.high {
  background: #fee2e2;
  color: #991b1b;
}

.match-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.match-name {
  font-weight: 500;
  color: #1f2937;
  margin: 0;
}

.match-description {
  font-size: 0.875rem;
  color: #4b5563;
  margin: 0;
}

.match-source {
  font-size: 0.75rem;
  color: #9ca3af;
  margin: 0;
}

.match-reviewed {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #e5e7eb;
  font-size: 0.75rem;
  color: #059669;
}

.reviewed-icon {
  width: 1rem;
  height: 1rem;
}

.risk-card {
  padding: 1rem;
  border-radius: 0.25rem;
  background: white;
  border-left: 4px solid #e5e7eb;
}

.risk-card.low {
  border-left-color: #10b981;
}

.risk-card.medium {
  border-left-color: #f59e0b;
}

.risk-card.high {
  border-left-color: var(--color-primary);
}

.risk-card.very_high {
  border-left-color: #ef4444;
}

.risk-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.risk-label {
  font-size: 0.875rem;
  color: #6b7280;
}

.risk-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.risk-badge.low {
  background: #d1fae5;
  color: #065f46;
}

.risk-badge.medium {
  background: #fef3c7;
  color: #92400e;
}

.risk-badge.high {
  background: #fed7aa;
  color: #9a3412;
}

.risk-badge.very_high {
  background: #fee2e2;
  color: #991b1b;
}

.risk-reason {
  margin: 0.5rem 0 0;
  font-size: 0.875rem;
  color: #4b5563;
}

.evidence-list {
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
</style>

<template>
  <SectionCard
    title="Credit Check"
    :section-order="isGuarantor ? 3 : 5"
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
        Review credit check results and tenant affordability score (TAS).
      </p>

      <!-- Self-Disclosed Adverse Credit -->
      <div v-if="adverseCreditDetails" class="adverse-credit-section">
        <div class="adverse-credit-header">
          <AlertTriangle class="warning-icon" />
          <h4 class="adverse-credit-title">Self-Disclosed Credit Issues</h4>
        </div>
        <div class="adverse-credit-card">
          <span class="adverse-badge">Applicant Disclosed Credit Issues</span>
          <div class="adverse-details-container">
            <p class="adverse-label">Details provided by applicant:</p>
            <p class="adverse-text">{{ adverseCreditDetails }}</p>
          </div>
          <p class="adverse-note">
            Compare this disclosure against the credit report below to verify accuracy and identify any undisclosed issues.
          </p>
        </div>
      </div>

      <!-- No Adverse Credit Disclosed -->
      <div v-else class="no-adverse-credit">
        <CheckCircle class="check-icon" />
        <span>No adverse credit history disclosed by applicant</span>
      </div>

      <!-- TAS Score -->
      <div class="score-card">
        <div class="score-header">
          <h4 class="score-title">Tenant Affordability Score (TAS)</h4>
          <span :class="['score-badge', getScoreLevel(tasScore)]">
            {{ getScoreLabel(tasScore) }}
          </span>
        </div>
        <div class="score-display">
          <div class="score-value">{{ tasScore ?? '—' }}</div>
          <div class="score-meter">
            <div class="meter-track">
              <div
                class="meter-fill"
                :style="{ width: `${Math.min(100, Math.max(0, (tasScore || 0)))}%` }"
                :class="getScoreLevel(tasScore)"
              ></div>
            </div>
            <div class="meter-labels">
              <span>0</span>
              <span>25</span>
              <span>50</span>
              <span>75</span>
              <span>100</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Multi-Address Score Aggregation -->
      <div v-if="section.sectionData?.multiAddressCheck" class="multi-address-section">
        <div class="multi-address-header">
          <MapPin class="multi-address-icon" />
          <h4 class="subsection-title">Multi-Address Credit Check</h4>
          <span class="multi-address-badge">Averaged</span>
        </div>
        <div class="multi-address-grid">
          <div class="address-score-item">
            <p class="address-score-label">Current Address</p>
            <p :class="['address-score-value', getScoreLevel(section.sectionData?.currentAddressScore)]">
              {{ section.sectionData?.currentAddressScore ?? '—' }}
            </p>
          </div>
          <div class="address-score-item">
            <p class="address-score-label">Previous Address</p>
            <p :class="['address-score-value', getScoreLevel(section.sectionData?.previousAddressScore)]">
              {{ section.sectionData?.previousAddressScore ?? '—' }}
            </p>
          </div>
          <div class="address-score-item highlight">
            <p class="address-score-label">Averaged Score</p>
            <p :class="['address-score-value', getScoreLevel(section.sectionData?.aggregatedScore)]">
              {{ section.sectionData?.aggregatedScore ?? '—' }}
            </p>
          </div>
          <div class="address-score-item">
            <p class="address-score-label">Electoral Match (Best)</p>
            <p :class="['address-score-value', section.sectionData?.bestElectoralMatch ? 'success' : 'warning']">
              {{ section.sectionData?.bestElectoralMatch ? 'Matched' : 'Not Found' }}
            </p>
          </div>
        </div>
      </div>

      <!-- Credit Summary -->
      <div v-if="creditSummary" class="credit-summary">
        <h4 class="subsection-title">Credit Summary</h4>
        <div class="summary-grid">
          <div v-if="creditSummary.verifyMatch !== undefined" class="summary-item">
            <p class="summary-label">Identity Verified</p>
            <p :class="['summary-value', creditSummary.verifyMatch ? 'success' : 'warning']">
              {{ creditSummary.verifyMatch ? 'Yes' : 'No Match' }}
            </p>
          </div>
          <div v-if="creditSummary.electoralRollMatch !== undefined" class="summary-item">
            <p class="summary-label">Electoral Roll</p>
            <p :class="['summary-value', creditSummary.electoralRollMatch ? 'success' : 'warning']">
              {{ creditSummary.electoralRollMatch ? 'Matched' : 'Not Found' }}
            </p>
          </div>
          <div v-if="creditSummary.ccjs !== undefined" class="summary-item">
            <p class="summary-label">CCJs</p>
            <p :class="['summary-value', creditSummary.ccjs > 0 ? 'danger' : 'success']">
              {{ creditSummary.ccjs }}
            </p>
          </div>
          <div v-if="creditSummary.bankruptcies !== undefined" class="summary-item">
            <p class="summary-label">Bankruptcies/IVAs</p>
            <p :class="['summary-value', creditSummary.bankruptcies > 0 ? 'danger' : 'success']">
              {{ creditSummary.bankruptcies }}
            </p>
          </div>
          <div v-if="creditSummary.totalAccounts !== undefined" class="summary-item">
            <p class="summary-label">Total Accounts</p>
            <p class="summary-value">{{ creditSummary.totalAccounts }}</p>
          </div>
          <div v-if="creditSummary.activeAccounts !== undefined" class="summary-item">
            <p class="summary-label">Active Accounts</p>
            <p class="summary-value">{{ creditSummary.activeAccounts }}</p>
          </div>
          <div v-if="creditSummary.defaults !== undefined" class="summary-item">
            <p class="summary-label">Defaults</p>
            <p :class="['summary-value', creditSummary.defaults > 0 ? 'warning' : '']">
              {{ creditSummary.defaults }}
            </p>
          </div>
          <div v-if="creditSummary.totalDebt !== undefined" class="summary-item">
            <p class="summary-label">Total Outstanding Debt</p>
            <p class="summary-value">{{ formatCurrency(creditSummary.totalDebt) }}</p>
          </div>
        </div>
      </div>

      <!-- Credit Flags -->
      <div v-if="creditFlags && creditFlags.length > 0" class="flags-section">
        <h4 class="subsection-title">Credit Flags</h4>
        <div class="flags-list">
          <div v-for="flag in creditFlags" :key="flag.type" :class="['flag-item', flag.severity]">
            <AlertCircle v-if="flag.severity === 'high'" class="flag-icon" />
            <AlertTriangle v-else class="flag-icon" />
            <div class="flag-content">
              <span class="flag-type">{{ flag.type }}</span>
              <span v-if="flag.description" class="flag-description">{{ flag.description }}</span>
            </div>
          </div>
        </div>

        <!-- Not Found Explainer -->
        <div v-if="hasNotFoundFlag" class="not-found-explainer">
          <Info class="info-icon" />
          <div class="explainer-content">
            <p class="explainer-title">Why "Not Found"?</p>
            <p class="explainer-text">
              This person has no credit file with CreditSafe. This is common for:
            </p>
            <ul class="explainer-list">
              <li>Young adults (under 25) with limited credit history</li>
              <li>Recent arrivals to the UK</li>
              <li>People who recently moved and haven't updated electoral roll</li>
              <li>Those who opted out of the open electoral register</li>
            </ul>
            <p class="explainer-note">
              <strong>This is not a red flag</strong> — verify identity through other documents (passport, driving licence) and consider income/employment evidence.
            </p>
          </div>
        </div>
      </div>

      <!-- CreditSafe Verification Details -->
      <div v-if="creditsafeVerification" class="verification-details">
        <h4 class="subsection-title">Verification Details</h4>
        <div class="details-grid">
          <div class="detail-item">
            <span class="detail-label">Check Performed</span>
            <span class="detail-value">{{ formatDateTime(creditsafeVerification.verified_at || creditsafeVerification.created_at) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">CreditSafe Status</span>
            <span :class="['detail-value', 'status-badge', creditsafeVerification.verification_status]">
              {{ formatStatus(creditsafeVerification.verification_status) }}
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Risk Level</span>
            <span :class="['detail-value', 'risk-badge', creditsafeVerification.risk_level]">
              {{ creditsafeVerification.risk_level || 'N/A' }}
            </span>
          </div>
          <div v-if="creditsafeVerification.creditsafe_transaction_id" class="detail-item full-width">
            <span class="detail-label">Transaction ID</span>
            <span class="detail-value mono">{{ creditsafeVerification.creditsafe_transaction_id }}</span>
          </div>
        </div>
      </div>

      <!-- Address History Match -->
      <div v-if="addressMatchStatus" class="match-section">
        <h4 class="subsection-title">Address Verification</h4>
        <div :class="['match-status', addressMatchStatus]">
          <Check v-if="addressMatchStatus === 'matched'" class="match-icon" />
          <AlertTriangle v-else class="match-icon" />
          <span>{{ addressMatchStatus === 'matched' ? 'Address history matches credit file' : 'Address history does not match' }}</span>
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
import { AlertTriangle, CheckCircle, AlertCircle, Check, FileText, Info, MapPin } from 'lucide-vue-next'
import { computed } from 'vue'
import type { VerificationSection, ActionReasonCode } from '@/types/staff'
import SectionCard from './SectionCard.vue'

interface CreditSummary {
  totalAccounts?: number
  activeAccounts?: number
  defaults?: number
  ccjs?: number
  bankruptcies?: number
  totalDebt?: number
  verifyMatch?: boolean
  electoralRollMatch?: boolean
  insolvencies?: number
}

interface CreditFlag {
  type: string
  severity: 'low' | 'medium' | 'high'
  description?: string
}

const props = defineProps<{
  section: VerificationSection
  isGuarantor: boolean
  tasScore?: number
  creditSummary?: CreditSummary
  creditFlags?: CreditFlag[]
  addressMatchStatus?: 'matched' | 'mismatched' | 'partial' | string
  creditsafeVerification?: any
  creditReport?: any
  referenceScore?: any
  adverseCreditDetails?: string
  hasUnreviewedData?: boolean
  readOnly?: boolean
  loading?: boolean
  actionReasonCodes?: ActionReasonCode[]
}>()

// Check if any credit flag is "Not Found"
const hasNotFoundFlag = computed(() => {
  return props.creditFlags?.some(f => f.type === 'Not Found') || false
})

defineEmits<{
  (e: 'pass', sectionId: string): void
  (e: 'passWithCondition', sectionId: string, condition: string): void
  (e: 'actionRequired', sectionId: string, params: { reasonCode: string; agentNote: string; internalNote: string }): void
  (e: 'fail', sectionId: string, reason: string): void
  (e: 'reset', sectionId: string): void
}>()

const getScoreLevel = (score?: number) => {
  if (score === undefined || score === null) return 'unknown'
  if (score >= 70) return 'good'
  if (score >= 50) return 'fair'
  if (score >= 30) return 'poor'
  return 'very-poor'
}

const getScoreLabel = (score?: number) => {
  if (score === undefined || score === null) return 'Pending'
  if (score >= 70) return 'Good'
  if (score >= 50) return 'Fair'
  if (score >= 30) return 'Poor'
  return 'Very Poor'
}

const formatCurrency = (amount?: number) => {
  if (amount === undefined || amount === null) return 'N/A'
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

const formatDateTime = (dateString?: string) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatStatus = (status?: string) => {
  if (!status) return 'Unknown'
  const statusMap: Record<string, string> = {
    'passed': 'Passed',
    'failed': 'Failed',
    'refer': 'Refer (Manual Review)',
    'error': 'Error'
  }
  return statusMap[status] || status
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

.score-card {
  padding: 1.25rem;
  background: #f9fafb;
  border-radius: 0.5rem;
}

.score-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.score-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin: 0;
}

.score-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.score-badge.good {
  background: #d1fae5;
  color: #065f46;
}

.score-badge.fair {
  background: #fef3c7;
  color: #92400e;
}

.score-badge.poor {
  background: #fed7aa;
  color: #9a3412;
}

.score-badge.very-poor {
  background: #fee2e2;
  color: #991b1b;
}

.score-badge.unknown {
  background: #e5e7eb;
  color: #6b7280;
}

.score-display {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.score-value {
  font-size: 2.5rem;
  font-weight: 700;
  color: #1f2937;
  min-width: 4rem;
  text-align: center;
}

.score-meter {
  flex: 1;
}

.meter-track {
  height: 0.75rem;
  background: #e5e7eb;
  border-radius: 9999px;
  overflow: hidden;
}

.meter-fill {
  height: 100%;
  border-radius: 9999px;
  transition: width 0.3s ease;
}

.meter-fill.good {
  background: #10b981;
}

.meter-fill.fair {
  background: #f59e0b;
}

.meter-fill.poor {
  background: var(--color-primary);
}

.meter-fill.very-poor {
  background: #ef4444;
}

.meter-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 0.25rem;
  font-size: 0.625rem;
  color: #9ca3af;
}

.multi-address-section {
  padding: 1rem;
  background: #eff6ff;
  border-radius: 0.5rem;
  border: 1px solid #bfdbfe;
}

.multi-address-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.multi-address-icon {
  width: 1rem;
  height: 1rem;
  color: #3b82f6;
}

.multi-address-badge {
  margin-left: auto;
  padding: 0.125rem 0.5rem;
  background: #3b82f6;
  color: white;
  border-radius: 9999px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.multi-address-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.address-score-item {
  padding: 0.5rem;
  background: white;
  border-radius: 0.375rem;
}

.address-score-item.highlight {
  border: 2px solid #3b82f6;
}

.address-score-label {
  font-size: 0.75rem;
  color: #6b7280;
  margin: 0 0 0.25rem;
}

.address-score-value {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
}

.address-score-value.good { color: #059669; }
.address-score-value.fair { color: #d97706; }
.address-score-value.poor { color: #dc2626; }
.address-score-value.very-poor { color: #991b1b; }
.address-score-value.success { color: #059669; }
.address-score-value.warning { color: #d97706; }

.credit-summary,
.flags-section,
.match-section,
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
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

@media (max-width: 640px) {
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.summary-item {
  background: white;
  padding: 0.75rem;
  border-radius: 0.25rem;
  text-align: center;
}

.summary-label {
  font-size: 0.75rem;
  color: #6b7280;
  margin: 0 0 0.25rem;
}

.summary-value {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.summary-value.success {
  color: #10b981;
}

.summary-value.warning {
  color: #f59e0b;
}

.summary-value.danger {
  color: #ef4444;
}

.flags-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.flag-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem;
  background: white;
  border-radius: 0.25rem;
  border-left: 3px solid #e5e7eb;
}

.flag-item.low {
  border-left-color: #fcd34d;
}

.flag-item.medium {
  border-left-color: var(--color-primary);
}

.flag-item.high {
  border-left-color: #ef4444;
}

.flag-icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
}

.flag-item.low .flag-icon {
  color: #f59e0b;
}

.flag-item.medium .flag-icon {
  color: var(--color-primary);
}

.flag-item.high .flag-icon {
  color: #ef4444;
}

.flag-content {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.flag-type {
  font-weight: 500;
  color: #374151;
}

.flag-description {
  font-size: 0.875rem;
  color: #6b7280;
}

.match-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 0.25rem;
}

.match-status.matched {
  background: #d1fae5;
  color: #065f46;
}

.match-status.mismatched,
.match-status.partial {
  background: #fef3c7;
  color: #92400e;
}

.match-icon {
  width: 1.25rem;
  height: 1.25rem;
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

/* Adverse Credit Section */
.adverse-credit-section {
  padding: 1rem;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 0.5rem;
}

.adverse-credit-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.adverse-credit-header .warning-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #d97706;
}

.adverse-credit-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #92400e;
  margin: 0;
}

.adverse-credit-card {
  background: white;
  border-radius: 0.375rem;
  padding: 1rem;
}

.adverse-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background: #fef3c7;
  color: #92400e;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.adverse-details-container {
  margin-bottom: 0.75rem;
}

.adverse-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: #6b7280;
  margin: 0 0 0.25rem;
}

.adverse-text {
  font-size: 0.875rem;
  color: #1f2937;
  margin: 0;
  white-space: pre-line;
  background: #f9fafb;
  padding: 0.75rem;
  border-radius: 0.25rem;
  border: 1px solid #e5e7eb;
}

.adverse-note {
  font-size: 0.75rem;
  color: #6b7280;
  font-style: italic;
  margin: 0;
}

.no-adverse-credit {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: #d1fae5;
  color: #065f46;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.no-adverse-credit .check-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #059669;
}

/* Not Found Explainer */
.not-found-explainer {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
  padding: 1rem;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 0.5rem;
}

.not-found-explainer .info-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #3b82f6;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.explainer-content {
  flex: 1;
}

.explainer-title {
  font-weight: 600;
  color: #1e40af;
  margin: 0 0 0.5rem;
  font-size: 0.875rem;
}

.explainer-text {
  color: #1e3a8a;
  margin: 0 0 0.5rem;
  font-size: 0.8125rem;
}

.explainer-list {
  margin: 0 0 0.75rem;
  padding-left: 1.25rem;
  color: #1e3a8a;
  font-size: 0.8125rem;
}

.explainer-list li {
  margin-bottom: 0.25rem;
}

.explainer-note {
  margin: 0;
  padding: 0.5rem 0.75rem;
  background: #dbeafe;
  border-radius: 0.25rem;
  font-size: 0.8125rem;
  color: #1e40af;
}

/* Verification Details */
.verification-details {
  padding: 1rem;
  background: #f9fafb;
  border-radius: 0.5rem;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

@media (max-width: 640px) {
  .details-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detail-item.full-width {
  grid-column: 1 / -1;
}

.detail-label {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
}

.detail-value {
  font-size: 0.875rem;
  color: #1f2937;
  font-weight: 500;
}

.detail-value.mono {
  font-family: ui-monospace, monospace;
  font-size: 0.75rem;
  color: #6b7280;
}

.status-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  width: fit-content;
}

.status-badge.passed {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.failed {
  background: #fee2e2;
  color: #991b1b;
}

.status-badge.refer {
  background: #fef3c7;
  color: #92400e;
}

.status-badge.error {
  background: #fee2e2;
  color: #991b1b;
}

.risk-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  text-transform: capitalize;
  width: fit-content;
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
</style>

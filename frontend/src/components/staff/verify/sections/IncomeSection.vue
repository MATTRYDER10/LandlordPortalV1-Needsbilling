<template>
  <SectionCard
    :title="isGuarantor ? 'Guarantor Income' : 'Income & Affordability'"
    :section-order="isGuarantor ? 2 : 3"
    :decision="section.decision"
    :condition-text="section.conditionText"
    :fail-reason="section.failReason"
    :decision-by="section.decisionBy"
    :decision-at="section.decisionAt"
    :has-unreviewed-data="hasUnreviewedData"
    :read-only="readOnly"
    :loading="loading"
    :action-reason-codes="actionReasonCodes"
    :action-required-label="isGuarantor ? 'Action Required' : 'Pass with Guarantor'"
    :use-pass-with-guarantor="!isGuarantor"
    @pass="$emit('pass', section.id)"
    @pass-with-condition="(c) => $emit('passWithCondition', section.id, c)"
    @action-required="(p) => $emit('actionRequired', section.id, p)"
    @fail="(r) => $emit('fail', section.id, r)"
    @reset="$emit('reset', section.id)"
  >
    <div class="section-content">
      <p class="section-description">
        Review income documentation and verify affordability against the rent amount.
      </p>

      <!-- Confirmation Status Badge -->
      <div v-if="incomeConfirmedAt" class="confirmation-status">
        <CheckCircle class="check-icon" />
        <span>Income confirmed by {{ incomeConfirmedBy }} on {{ formatDateTime(incomeConfirmedAt) }}</span>
      </div>

      <!-- Student Status Badge -->
      <div v-if="isStudent && !isGuarantor" class="student-status">
        <GraduationCap class="student-icon" />
        <span><strong>Student</strong> - Will likely require a guarantor</span>
      </div>

      <!-- Affordability Summary -->
      <div class="affordability-card">
        <div class="affordability-header">
          <h4 class="affordability-title">Affordability Assessment</h4>
          <span :class="['affordability-badge', affordabilityStatus]">
            {{ affordabilityLabel }}
          </span>
        </div>
        <div class="affordability-grid">
          <div class="affordability-item">
            <p class="affordability-label">Monthly Rent</p>
            <p class="affordability-value">{{ formatCurrency(monthlyRent) }}</p>
          </div>
          <div class="affordability-item">
            <p class="affordability-label">Total Annual Income</p>
            <p class="affordability-value">{{ formatCurrency(displayIncome) }}</p>
          </div>
          <div class="affordability-item">
            <p class="affordability-label">Income to Rent Ratio</p>
            <p class="affordability-value">{{ computedRatio ? `${computedRatio.toFixed(2)}x` : 'N/A' }}</p>
          </div>
          <div class="affordability-item">
            <p class="affordability-label">Required Ratio</p>
            <p class="affordability-value">{{ requiredRatio }}x</p>
          </div>
        </div>
      </div>

      <!-- Review & Confirm Button -->
      <button
        v-if="!readOnly"
        class="confirm-btn"
        @click="openConfirmModal"
      >
        <CheckCircle class="btn-icon" />
        {{ incomeConfirmedAt ? 'Review & Update Income' : 'Review & Confirm Income' }}
      </button>

      <!-- Employment Details -->
      <div v-if="employmentType" class="detail-section">
        <h4 class="subsection-title">Employment</h4>
        <div class="details-grid">
          <div class="detail-item">
            <p class="detail-label">Employment Type</p>
            <p class="detail-value">{{ formatEmploymentType(employmentType) }}</p>
          </div>
          <div v-if="employerName" class="detail-item">
            <p class="detail-label">Employer</p>
            <p class="detail-value">{{ employerName }}</p>
          </div>
          <div v-if="jobTitle" class="detail-item">
            <p class="detail-label">Job Title</p>
            <p class="detail-value">{{ jobTitle }}</p>
          </div>
          <div v-if="employmentContractType" class="detail-item">
            <p class="detail-label">Contract Type</p>
            <p class="detail-value">{{ formatContractType(employmentContractType) }}</p>
          </div>
          <div v-if="employmentStartDate" class="detail-item">
            <p class="detail-label">Start Date</p>
            <p class="detail-value">{{ formatDate(employmentStartDate) }}</p>
          </div>
          <div v-if="employmentEndDate" class="detail-item">
            <p class="detail-label">End Date</p>
            <p class="detail-value">{{ formatDate(employmentEndDate) }}</p>
          </div>
          <div v-if="salaryFrequency" class="detail-item">
            <p class="detail-label">Pay Frequency</p>
            <p class="detail-value">{{ formatFrequency(salaryFrequency) }}</p>
          </div>
        </div>
      </div>

      <!-- Self-Employed Details -->
      <div v-if="employmentType === 'self_employed' && (selfEmployedStartDate || selfEmployedNatureOfBusiness)" class="detail-section">
        <h4 class="subsection-title">Self-Employment Details</h4>
        <div class="details-grid">
          <div v-if="selfEmployedNatureOfBusiness" class="detail-item">
            <p class="detail-label">Nature of Business</p>
            <p class="detail-value">{{ selfEmployedNatureOfBusiness }}</p>
          </div>
          <div v-if="selfEmployedStartDate" class="detail-item">
            <p class="detail-label">Started Self-Employment</p>
            <p class="detail-value">{{ formatDate(selfEmployedStartDate) }}</p>
          </div>
        </div>
      </div>

      <!-- Guarantor Financial Position (only for guarantors) -->
      <div v-if="isGuarantor && guarantorFinancialData" class="detail-section guarantor-financial">
        <h4 class="subsection-title">Guarantor Financial Position</h4>
        <div class="details-grid">
          <div v-if="guarantorFinancialData.homeOwnershipStatus" class="detail-item">
            <p class="detail-label">Home Ownership</p>
            <p class="detail-value">{{ formatHomeOwnership(guarantorFinancialData.homeOwnershipStatus) }}</p>
          </div>
          <div v-if="guarantorFinancialData.propertyValue" class="detail-item">
            <p class="detail-label">Property Value</p>
            <p class="detail-value">{{ formatCurrency(guarantorFinancialData.propertyValue) }}</p>
          </div>
          <div v-if="guarantorFinancialData.monthlyMortgageRent" class="detail-item">
            <p class="detail-label">Monthly Mortgage/Rent</p>
            <p class="detail-value">{{ formatCurrency(guarantorFinancialData.monthlyMortgageRent) }}/mo</p>
          </div>
          <div v-if="guarantorFinancialData.pensionAmount" class="detail-item">
            <p class="detail-label">Pension</p>
            <p class="detail-value">
              {{ formatCurrency(guarantorFinancialData.pensionAmount) }}
              <span v-if="guarantorFinancialData.pensionFrequency" class="frequency-label">/{{ guarantorFinancialData.pensionFrequency }}</span>
            </p>
          </div>
          <div v-if="guarantorFinancialData.otherMonthlyCommitments" class="detail-item">
            <p class="detail-label">Other Commitments</p>
            <p class="detail-value">{{ formatCurrency(guarantorFinancialData.otherMonthlyCommitments) }}/mo</p>
          </div>
          <div v-if="guarantorFinancialData.totalMonthlyExpenditure" class="detail-item">
            <p class="detail-label">Total Monthly Expenditure</p>
            <p class="detail-value">{{ formatCurrency(guarantorFinancialData.totalMonthlyExpenditure) }}/mo</p>
          </div>
        </div>

        <!-- Guarantor Obligations -->
        <div class="obligations-section">
          <p class="obligations-title">Guarantor Confirmations</p>
          <div class="obligations-grid">
            <div class="obligation-item">
              <span :class="['obligation-badge', guarantorFinancialData.understandsObligations ? 'confirmed' : 'pending']">
                {{ guarantorFinancialData.understandsObligations ? '✓' : '?' }}
              </span>
              <span>Understands Legal Obligations</span>
            </div>
            <div class="obligation-item">
              <span :class="['obligation-badge', guarantorFinancialData.willingToPayRent ? 'confirmed' : 'pending']">
                {{ guarantorFinancialData.willingToPayRent ? '✓' : '?' }}
              </span>
              <span>Willing to Pay Rent if Tenant Defaults</span>
            </div>
            <div class="obligation-item">
              <span :class="['obligation-badge', guarantorFinancialData.willingToPayDamages ? 'confirmed' : 'pending']">
                {{ guarantorFinancialData.willingToPayDamages ? '✓' : '?' }}
              </span>
              <span>Willing to Pay Damages if Tenant Defaults</span>
            </div>
            <div v-if="guarantorFinancialData.previouslyActedAsGuarantor" class="obligation-item">
              <span class="obligation-badge info">ℹ</span>
              <span>Has Previously Acted as Guarantor</span>
            </div>
          </div>
        </div>

        <!-- Guarantor Adverse Credit -->
        <div v-if="guarantorFinancialData.adverseCredit || guarantorFinancialData.adverseCreditDetails" class="guarantor-adverse-credit">
          <div class="adverse-header">
            <AlertTriangle class="warning-icon" />
            <span>Guarantor Disclosed Credit Issues</span>
          </div>
          <p v-if="guarantorFinancialData.adverseCreditDetails" class="adverse-details">
            {{ guarantorFinancialData.adverseCreditDetails }}
          </p>
        </div>
      </div>

      <!-- Income Sources -->
      <div v-if="incomeSources && incomeSources.length > 0" class="income-sources">
        <h4 class="subsection-title">Income Sources</h4>
        <div class="sources-list">
          <div v-for="(source, index) in incomeSources" :key="index" class="source-item">
            <div class="source-type">{{ source.type }}</div>
            <div class="source-amount">{{ formatCurrency(source.amount) }}/year</div>
            <div v-if="source.verified" class="source-verified">Verified</div>
          </div>
        </div>
      </div>

      <!-- Employer Reference -->
      <div v-if="employerReference" class="reference-section">
        <h4 class="subsection-title">Employer Reference</h4>
        <div class="reference-card">
          <div class="reference-header">
            <span class="reference-from">{{ employerReference.name }}</span>
            <span :class="['reference-status', employerReference.status]">
              {{ employerReference.status }}
            </span>
          </div>
          <div v-if="employerReference.salary" class="reference-detail">
            Confirmed Salary: {{ formatCurrency(employerReference.salary) }}/year
          </div>
          <div v-if="employerReference.startDate" class="reference-detail">
            Employment Started: {{ formatDate(employerReference.startDate) }}
          </div>
        </div>
      </div>

      <!-- Accountant Reference (for self-employed) -->
      <div v-if="accountantReference" class="reference-section">
        <h4 class="subsection-title">Accountant Reference</h4>
        <div class="reference-card">
          <div class="reference-header">
            <span class="reference-from">{{ accountantReference.firm }}</span>
            <span :class="['reference-status', accountantReference.status]">
              {{ accountantReference.status }}
            </span>
          </div>
          <div v-if="accountantReference.annualIncome" class="reference-detail">
            Annual Income: {{ formatCurrency(accountantReference.annualIncome) }}
          </div>
          <div v-if="accountantReference.yearsTrading" class="reference-detail">
            Years Trading: {{ accountantReference.yearsTrading }}
          </div>
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

  <!-- Income Confirmation Modal -->
  <Teleport to="body">
    <div v-if="showConfirmModal" class="modal-overlay" @click="closeConfirmModal">
      <div class="modal-container" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title">Review & Confirm Income</h2>
          <button class="modal-close" @click="closeConfirmModal">
            <X />
          </button>
        </div>

        <div class="modal-body">
          <!-- Student Info Banner -->
          <div v-if="isStudent && !isGuarantor" class="student-modal-banner">
            <GraduationCap class="banner-icon" />
            <div class="banner-content">
              <strong>Student Applicant</strong>
              <p>Students typically have little or no income. You can confirm £0 income - a guarantor will be required to pass affordability.</p>
            </div>
          </div>

          <div class="modal-columns">
            <!-- Left Column: Claimed Income & Evidence -->
            <div class="modal-column">
              <div class="column-section">
                <h3 class="column-title">Claimed Income</h3>
                <div class="claimed-income-list">
                  <div class="claimed-item">
                    <span class="claimed-label">Salary</span>
                    <span class="claimed-value">{{ formatCurrency(claimedIncome?.salary || 0) }}/year</span>
                  </div>
                  <div class="claimed-item">
                    <span class="claimed-label">Benefits</span>
                    <span class="claimed-value">
                      {{ formatCurrency(claimedIncome?.benefits || 0) }}/year
                      <span v-if="benefitsMonthlyAmount" class="claimed-subtext">({{ formatCurrency(benefitsMonthlyAmount) }}/mo)</span>
                    </span>
                  </div>
                  <div class="claimed-item">
                    <span class="claimed-label">Self-Employed</span>
                    <span class="claimed-value">{{ formatCurrency(claimedIncome?.selfEmployed || 0) }}/year</span>
                  </div>
                  <div class="claimed-item">
                    <span class="claimed-label">Savings/Other</span>
                    <span class="claimed-value">
                      {{ formatCurrency((claimedIncome?.savings || 0) + (claimedIncome?.additional || 0)) }}/year
                      <span v-if="additionalIncomeFrequency" class="claimed-subtext">({{ formatFrequency(additionalIncomeFrequency) }})</span>
                    </span>
                  </div>
                  <div class="claimed-item total">
                    <span class="claimed-label">Total Claimed</span>
                    <span class="claimed-value">{{ formatCurrency(claimedIncome?.total || 0) }}/year</span>
                  </div>
                </div>
              </div>

              <!-- Evidence Preview Section -->
              <div class="column-section">
                <h3 class="column-title">Evidence</h3>
                <div v-if="incomeEvidence && incomeEvidence.length > 0" class="evidence-preview-grid">
                  <EvidencePreview
                    v-for="file in incomeEvidence"
                    :key="file.id"
                    :url="file.file_url || file.url || ''"
                    :file-name="file.file_name || file.fileName || 'Unknown'"
                    :file-type="file.file_type || file.fileType"
                    :uploaded-at="file.created_at || file.uploadedAt"
                  />
                </div>
                <p v-else class="no-evidence">No evidence files uploaded</p>
              </div>

              <!-- Employer Reference -->
              <div v-if="evidenceEmployerRef" class="column-section">
                <h3 class="column-title">Employer Reference</h3>
                <div class="reference-preview">
                  <div class="ref-row">
                    <span class="ref-label">Employer</span>
                    <span class="ref-value">{{ evidenceEmployerRef.employerName }}</span>
                  </div>
                  <div v-if="evidenceEmployerRef.jobTitle" class="ref-row">
                    <span class="ref-label">Job Title</span>
                    <span class="ref-value">{{ evidenceEmployerRef.jobTitle }}</span>
                  </div>
                  <div v-if="evidenceEmployerRef.employmentType" class="ref-row">
                    <span class="ref-label">Employment Type</span>
                    <span class="ref-value">{{ formatEmploymentTypeLabel(evidenceEmployerRef.employmentType) }}</span>
                  </div>
                  <div class="ref-row">
                    <span class="ref-label">Confirmed Salary</span>
                    <span class="ref-value highlight">{{ formatCurrency(evidenceEmployerRef.salary || 0) }}/year</span>
                  </div>
                  <div class="ref-row">
                    <span class="ref-label">Start Date</span>
                    <span class="ref-value">{{ formatDate(evidenceEmployerRef.employmentStartDate) }}</span>
                  </div>
                  <div class="ref-row">
                    <span class="ref-label">Status</span>
                    <span class="ref-value">{{ evidenceEmployerRef.isCurrentlyEmployed ? 'Currently Employed' : (evidenceEmployerRef.employmentStatus || 'Not specified') }}</span>
                  </div>
                  <div v-if="evidenceEmployerRef.isProbation === true || evidenceEmployerRef.isProbation === 'yes'" class="ref-row">
                    <span class="ref-label">Probation</span>
                    <span class="ref-value">{{ formatProbationStatus(evidenceEmployerRef) }}</span>
                  </div>
                  <div v-if="evidenceEmployerRef.contactPhone" class="ref-row">
                    <span class="ref-label">Contact Phone</span>
                    <span class="ref-value">{{ evidenceEmployerRef.contactPhone }}</span>
                  </div>
                  <div class="ref-row">
                    <span class="ref-label">Submitted</span>
                    <span class="ref-value">{{ formatDate(evidenceEmployerRef.submittedAt) }}</span>
                  </div>
                </div>
              </div>

              <!-- Accountant Reference -->
              <div v-if="evidenceAccountantRef" class="column-section">
                <h3 class="column-title">Accountant Reference</h3>
                <div class="reference-preview">
                  <div class="ref-row">
                    <span class="ref-label">Firm</span>
                    <span class="ref-value">{{ evidenceAccountantRef.firmName }}</span>
                  </div>
                  <div class="ref-row">
                    <span class="ref-label">Annual Income</span>
                    <span class="ref-value highlight">{{ formatCurrency(evidenceAccountantRef.annualIncome || 0) }}/year</span>
                  </div>
                  <div class="ref-row">
                    <span class="ref-label">Years Trading</span>
                    <span class="ref-value">{{ evidenceAccountantRef.yearsTrading }}</span>
                  </div>
                  <div v-if="evidenceAccountantRef.contactPhone" class="ref-row">
                    <span class="ref-label">Contact Phone</span>
                    <span class="ref-value">{{ evidenceAccountantRef.contactPhone }}</span>
                  </div>
                  <div class="ref-row">
                    <span class="ref-label">Submitted</span>
                    <span class="ref-value">{{ formatDate(evidenceAccountantRef.submittedAt) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Column: Confirm Income -->
            <div class="modal-column">
              <div class="column-section">
                <h3 class="column-title">Confirm Income</h3>
                <p class="confirm-description">
                  Enter the verified annual income amounts. You can override claimed values if evidence shows different amounts.
                </p>

                <div class="confirm-form">
                  <div class="form-group">
                    <label>Annual Salary</label>
                    <div class="input-wrapper">
                      <span class="input-prefix">£</span>
                      <input
                        v-model.number="confirmedSalary"
                        type="number"
                        min="0"
                        step="1000"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div class="form-group">
                    <label>Annual Benefits</label>
                    <div class="input-wrapper">
                      <span class="input-prefix">£</span>
                      <input
                        v-model.number="confirmedBenefits"
                        type="number"
                        min="0"
                        step="100"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div class="form-group">
                    <label>Self-Employed Income</label>
                    <div class="input-wrapper">
                      <span class="input-prefix">£</span>
                      <input
                        v-model.number="confirmedSelfEmployed"
                        type="number"
                        min="0"
                        step="1000"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div class="form-group">
                    <label>Savings/Other Income</label>
                    <div class="input-wrapper">
                      <span class="input-prefix">£</span>
                      <input
                        v-model.number="confirmedOther"
                        type="number"
                        min="0"
                        step="100"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div class="form-group total-group">
                    <label>Confirmed Total (can override)</label>
                    <div class="input-wrapper">
                      <span class="input-prefix">£</span>
                      <input
                        v-model.number="confirmedTotal"
                        type="number"
                        min="0"
                        step="1000"
                        placeholder="0"
                        class="total-input"
                      />
                    </div>
                    <p class="calculated-hint">
                      Calculated: {{ formatCurrency(calculatedTotal) }}
                      <button v-if="confirmedTotal !== calculatedTotal" class="use-calculated" @click="useCalculatedTotal">
                        Use calculated
                      </button>
                    </p>
                  </div>
                </div>
              </div>

              <!-- Live Affordability Calculator -->
              <div class="column-section">
                <AffordabilityCalculator
                  :income="confirmedTotal || 0"
                  :monthly-rent="monthlyRent || 0"
                  :is-guarantor="isGuarantor"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" @click="closeConfirmModal">Cancel</button>
          <button
            class="btn-primary"
            :disabled="(!isStudent && !confirmedTotal) || confirmLoading"
            @click="confirmIncome"
          >
            <span v-if="confirmLoading">Saving...</span>
            <span v-else>Confirm Income</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { CheckCircle, GraduationCap, AlertTriangle, FileText, X } from 'lucide-vue-next'
import type { VerificationSection, ActionReasonCode } from '@/types/staff'
import SectionCard from './SectionCard.vue'
import EvidencePreview from '../shared/EvidencePreview.vue'
import AffordabilityCalculator from '../shared/AffordabilityCalculator.vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const authToken = computed(() => authStore.session?.access_token || '')

interface IncomeSource {
  type: string
  amount: number
  verified?: boolean
}

interface EmployerRef {
  name: string
  status: string
  salary?: number
  startDate?: string
}

interface AccountantRef {
  firm: string
  status: string
  annualIncome?: number
  yearsTrading?: number
}

interface ClaimedIncome {
  salary: number
  benefits: number
  selfEmployed: number
  savings: number
  additional: number
  total: number
}

interface VerifiedIncome {
  salary: number | null
  benefits: number | null
  selfEmployed: number | null
  savings: number | null
  additional: number | null
  total: number | null
  confirmedAt: string | null
  confirmedBy: string | null
}

interface EvidenceFile {
  id: string
  file_url?: string
  url?: string
  file_name?: string
  fileName?: string
  file_type?: string
  fileType?: string
  created_at?: string
  uploadedAt?: string
}

interface EvidenceEmployerRef {
  employerName: string
  salary: number | null
  employmentStartDate: string
  submittedAt: string
  jobTitle: string | null
  employmentStatus: string | null
  isCurrentlyEmployed: boolean | null
  employmentType: string | null
  isProbation: boolean | string | null
  probationEndDate: string | null
  contactPhone: string | null
}

interface EvidenceAccountantRef {
  firmName: string
  annualIncome: number | null
  yearsTrading: number
  submittedAt: string
  contactPhone: string | null
}

interface GuarantorFinancialData {
  homeOwnershipStatus?: string
  propertyValue?: number | null
  monthlyMortgageRent?: number | null
  pensionAmount?: number | null
  pensionFrequency?: string
  otherMonthlyCommitments?: number | null
  totalMonthlyExpenditure?: number | null
  understandsObligations?: boolean
  willingToPayRent?: boolean
  willingToPayDamages?: boolean
  previouslyActedAsGuarantor?: boolean
  adverseCredit?: boolean
  adverseCreditDetails?: string | null
}

const props = defineProps<{
  section: VerificationSection
  referenceId: string
  isGuarantor: boolean
  monthlyRent?: number
  totalIncome?: number
  incomeRatio?: number
  requiredRatio?: number
  employmentType?: string
  employerName?: string
  jobTitle?: string
  employmentStartDate?: string
  employmentEndDate?: string
  employmentContractType?: string
  salaryFrequency?: string
  // Self-employed fields
  selfEmployedStartDate?: string
  selfEmployedNatureOfBusiness?: string
  // Additional income
  additionalIncomeFrequency?: string
  // Benefits
  benefitsMonthlyAmount?: number
  incomeSources?: IncomeSource[]
  employerReference?: EmployerRef
  accountantReference?: AccountantRef
  hasUnreviewedData?: boolean
  readOnly?: boolean
  loading?: boolean
  actionReasonCodes?: ActionReasonCode[]
  // Evidence data from parent
  claimedIncome?: ClaimedIncome
  verifiedIncome?: VerifiedIncome
  incomeEvidence?: EvidenceFile[]
  evidenceEmployerRef?: EvidenceEmployerRef
  evidenceAccountantRef?: EvidenceAccountantRef
  incomeConfirmedAt?: string
  incomeConfirmedBy?: string
  isStudent?: boolean
  // Guarantor-specific data
  guarantorFinancialData?: GuarantorFinancialData
}>()

const emit = defineEmits<{
  (e: 'pass', sectionId: string): void
  (e: 'passWithCondition', sectionId: string, condition: string): void
  (e: 'actionRequired', sectionId: string, params: { reasonCode: string; agentNote: string; internalNote: string }): void
  (e: 'fail', sectionId: string, reason: string): void
  (e: 'reset', sectionId: string): void
  (e: 'incomeConfirmed', data: { confirmedIncome: number; affordabilityRatio: number; affordableRent: number }): void
}>()

// Modal state
const showConfirmModal = ref(false)
const confirmLoading = ref(false)

// Form state
const confirmedSalary = ref(0)
const confirmedBenefits = ref(0)
const confirmedSelfEmployed = ref(0)
const confirmedOther = ref(0)
const confirmedTotal = ref(0)

// Use verified income if available, otherwise use claimed as default
const displayIncome = computed(() => {
  if (props.verifiedIncome?.total !== null && props.verifiedIncome?.total !== undefined) {
    return props.verifiedIncome.total
  }
  return props.totalIncome || props.claimedIncome?.total || 0
})

const computedRatio = computed(() => {
  if (!props.monthlyRent || !displayIncome.value) return null
  const annualRent = props.monthlyRent * 12
  return displayIncome.value / annualRent
})

const affordabilityStatus = computed(() => {
  if (!computedRatio.value || !props.requiredRatio) return 'unknown'
  if (computedRatio.value >= props.requiredRatio) return 'pass'
  if (computedRatio.value >= props.requiredRatio * 0.8) return 'borderline'
  return 'fail'
})

const affordabilityLabel = computed(() => {
  const labels: Record<string, string> = {
    pass: 'Meets Requirements',
    borderline: 'Borderline',
    fail: 'Below Requirements',
    unknown: 'Pending'
  }
  return labels[affordabilityStatus.value]
})

const calculatedTotal = computed(() => {
  return confirmedSalary.value + confirmedBenefits.value + confirmedSelfEmployed.value + confirmedOther.value
})

// Initialize form with existing values
const initializeForm = () => {
  // Use verified values if available, otherwise use claimed
  if (props.verifiedIncome?.total !== null) {
    confirmedSalary.value = props.verifiedIncome?.salary || 0
    confirmedBenefits.value = props.verifiedIncome?.benefits || 0
    confirmedSelfEmployed.value = props.verifiedIncome?.selfEmployed || 0
    confirmedOther.value = (props.verifiedIncome?.savings || 0) + (props.verifiedIncome?.additional || 0)
    confirmedTotal.value = props.verifiedIncome?.total || 0
  } else if (props.claimedIncome) {
    confirmedSalary.value = props.claimedIncome.salary || 0
    confirmedBenefits.value = props.claimedIncome.benefits || 0
    confirmedSelfEmployed.value = props.claimedIncome.selfEmployed || 0
    confirmedOther.value = (props.claimedIncome.savings || 0) + (props.claimedIncome.additional || 0)
    confirmedTotal.value = props.claimedIncome.total || 0
  }
}

// Watch for calculated total changes and update if not manually overridden
watch([confirmedSalary, confirmedBenefits, confirmedSelfEmployed, confirmedOther], () => {
  // Auto-update total if it matches the previous calculated value
  const newCalc = confirmedSalary.value + confirmedBenefits.value + confirmedSelfEmployed.value + confirmedOther.value
  if (confirmedTotal.value === 0 || confirmedTotal.value === newCalc - (confirmedSalary.value !== 0 ? 0 : calculatedTotal.value)) {
    confirmedTotal.value = newCalc
  }
})

const useCalculatedTotal = () => {
  confirmedTotal.value = calculatedTotal.value
}

const openConfirmModal = () => {
  initializeForm()
  showConfirmModal.value = true
  document.body.style.overflow = 'hidden'
}

const closeConfirmModal = () => {
  showConfirmModal.value = false
  document.body.style.overflow = ''
}

const confirmIncome = async () => {
  // Allow £0 for students, but require a value for non-students
  if (!props.isStudent && !confirmedTotal.value) return

  confirmLoading.value = true

  try {
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    const response = await fetch(`${API_BASE}/api/verify/confirm-income/${props.referenceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken.value}`
      },
      body: JSON.stringify({
        confirmedSalary: confirmedSalary.value,
        confirmedBenefits: confirmedBenefits.value,
        confirmedSelfEmployed: confirmedSelfEmployed.value,
        confirmedSavings: confirmedOther.value,
        confirmedTotal: confirmedTotal.value
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to confirm income')
    }

    const data = await response.json()

    emit('incomeConfirmed', {
      confirmedIncome: data.confirmedIncome,
      affordabilityRatio: data.affordabilityRatio,
      affordableRent: data.affordableRent
    })

    closeConfirmModal()
  } catch (error: any) {
    console.error('Error confirming income:', error)
    alert(error.message || 'Failed to confirm income')
  } finally {
    confirmLoading.value = false
  }
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

const formatDate = (dateString?: string) => {
  if (!dateString) return 'Not specified'
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

const formatDateTime = (dateString?: string) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatEmploymentType = (type: string) => {
  const types: Record<string, string> = {
    employed: 'Employed',
    self_employed: 'Self-Employed',
    contractor: 'Contractor',
    retired: 'Retired',
    student: 'Student',
    unemployed: 'Unemployed',
    other: 'Other'
  }
  return types[type] || type
}

const formatEmploymentTypeLabel = (type: string | null) => {
  if (!type) return 'Not specified'
  const types: Record<string, string> = {
    'full_time': 'Full-time',
    'part_time': 'Part-time',
    'contract': 'Contract',
    'permanent': 'Permanent',
    'temporary': 'Temporary',
    'zero_hours': 'Zero Hours',
    'FULL_TIME': 'Full-time',
    'PART_TIME': 'Part-time',
    'CONTRACT': 'Contract',
    'PERMANENT': 'Permanent',
    'TEMPORARY': 'Temporary'
  }
  return types[type] || type.replace(/_/g, ' ')
}

const formatProbationStatus = (ref: EvidenceEmployerRef) => {
  const isProbation = ref.isProbation === true || ref.isProbation === 'yes'
  if (!isProbation) return 'No'
  if (ref.probationEndDate) {
    return `Yes (ends ${formatDate(ref.probationEndDate)})`
  }
  return 'Yes'
}

const formatContractType = (type: string) => {
  const types: Record<string, string> = {
    'full_time': 'Full-time',
    'part_time': 'Part-time',
    'contract': 'Contract',
    'temporary': 'Temporary',
    'zero_hours': 'Zero Hours',
    'permanent': 'Permanent'
  }
  return types[type] || type.replace(/_/g, ' ')
}

const formatFrequency = (freq: string) => {
  const frequencies: Record<string, string> = {
    'weekly': 'Weekly',
    'bi_weekly': 'Bi-weekly',
    'monthly': 'Monthly',
    'annually': 'Annually'
  }
  return frequencies[freq] || freq.replace(/_/g, ' ')
}

const formatHomeOwnership = (status: string) => {
  const statuses: Record<string, string> = {
    'owner': 'Owner (Outright)',
    'owner_mortgage': 'Owner with Mortgage',
    'renting': 'Renting',
    'living_with_family': 'Living with Family',
    'other': 'Other'
  }
  return statuses[status] || status.replace(/_/g, ' ')
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

.confirmation-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: #d1fae5;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: #065f46;
}

.check-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #059669;
}

.student-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: #fef3c7;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: #92400e;
  border: 1px solid #fcd34d;
}

.student-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #d97706;
  flex-shrink: 0;
}

.affordability-card {
  padding: 1rem;
  background: #f9fafb;
  border-radius: 0.5rem;
}

.affordability-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.affordability-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin: 0;
}

.affordability-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.affordability-badge.pass {
  background: #d1fae5;
  color: #065f46;
}

.affordability-badge.borderline {
  background: #fef3c7;
  color: #92400e;
}

.affordability-badge.fail {
  background: #fee2e2;
  color: #991b1b;
}

.affordability-badge.unknown {
  background: #e5e7eb;
  color: #6b7280;
}

.affordability-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

@media (max-width: 768px) {
  .affordability-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.affordability-item {
  text-align: center;
}

.affordability-label {
  font-size: 0.75rem;
  color: #6b7280;
  margin: 0 0 0.25rem;
}

.affordability-value {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.confirm-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.confirm-btn:hover {
  background: #ea580c;
}

.btn-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.detail-section,
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

.details-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

@media (max-width: 640px) {
  .details-grid {
    grid-template-columns: 1fr;
  }
}

.detail-item {
  background: white;
  padding: 0.75rem;
  border-radius: 0.25rem;
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

.income-sources {
  padding: 1rem;
  background: #f9fafb;
  border-radius: 0.5rem;
}

.sources-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.source-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: white;
  border-radius: 0.25rem;
}

.source-type {
  flex: 1;
  font-weight: 500;
  color: #374151;
}

.source-amount {
  font-weight: 600;
  color: #1f2937;
}

.source-verified {
  padding: 0.125rem 0.5rem;
  background: #d1fae5;
  color: #065f46;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.reference-section {
  padding: 1rem;
  background: #f9fafb;
  border-radius: 0.5rem;
}

.reference-card {
  padding: 0.75rem;
  background: white;
  border-radius: 0.25rem;
  border-left: 3px solid #10b981;
}

.reference-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.reference-from {
  font-weight: 600;
  color: #1f2937;
}

.reference-status {
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: capitalize;
}

.reference-status.received,
.reference-status.verified {
  background: #d1fae5;
  color: #065f46;
}

.reference-status.pending {
  background: #fef3c7;
  color: #92400e;
}

.reference-detail {
  font-size: 0.875rem;
  color: #4b5563;
  margin-top: 0.25rem;
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

/* Modal Styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal-container {
  background: white;
  border-radius: 0.75rem;
  width: 100%;
  max-width: 1000px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background: none;
  border: none;
  cursor: pointer;
  color: #6b7280;
  border-radius: 0.25rem;
  transition: background 0.2s;
}

.modal-close:hover {
  background: #f3f4f6;
}

.modal-close svg {
  width: 1.25rem;
  height: 1.25rem;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.student-modal-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
}

.student-modal-banner .banner-icon {
  width: 1.5rem;
  height: 1.5rem;
  color: #d97706;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.student-modal-banner .banner-content {
  flex: 1;
}

.student-modal-banner .banner-content strong {
  display: block;
  color: #92400e;
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
}

.student-modal-banner .banner-content p {
  color: #92400e;
  font-size: 0.8125rem;
  margin: 0;
  line-height: 1.4;
}

.modal-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

@media (max-width: 768px) {
  .modal-columns {
    grid-template-columns: 1fr;
  }
}

.modal-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.column-section {
  padding: 1rem;
  background: #f9fafb;
  border-radius: 0.5rem;
}

.column-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 1rem;
}

.claimed-income-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.claimed-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background: white;
  border-radius: 0.25rem;
}

.claimed-item.total {
  background: #dbeafe;
  font-weight: 600;
}

.claimed-label {
  color: #6b7280;
  font-size: 0.875rem;
}

.claimed-value {
  color: #1f2937;
  font-size: 0.875rem;
  font-weight: 500;
}

.claimed-subtext {
  font-size: 0.75rem;
  font-weight: 400;
  color: #6b7280;
  margin-left: 0.25rem;
}

.evidence-preview-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.no-evidence {
  color: #9ca3af;
  font-size: 0.875rem;
  text-align: center;
  padding: 1rem;
}

.reference-preview {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ref-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background: white;
  border-radius: 0.25rem;
}

.ref-label {
  color: #6b7280;
  font-size: 0.875rem;
}

.ref-value {
  color: #1f2937;
  font-size: 0.875rem;
  font-weight: 500;
}

.ref-value.highlight {
  color: #059669;
  font-weight: 600;
}

.confirm-description {
  color: #6b7280;
  font-size: 0.875rem;
  margin: 0 0 1rem;
}

.confirm-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form-group label {
  font-size: 0.75rem;
  font-weight: 500;
  color: #374151;
}

.input-wrapper {
  display: flex;
  align-items: center;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  overflow: hidden;
}

.input-prefix {
  padding: 0.5rem 0.75rem;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 0.875rem;
  border-right: 1px solid #d1d5db;
}

.input-wrapper input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: none;
  font-size: 0.875rem;
  outline: none;
}

.input-wrapper input:focus {
  box-shadow: none;
}

.total-group {
  padding-top: 0.5rem;
  border-top: 1px solid #e5e7eb;
}

.total-input {
  font-weight: 600;
}

.calculated-hint {
  font-size: 0.75rem;
  color: #6b7280;
  margin: 0.25rem 0 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.use-calculated {
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: 0.75rem;
  cursor: pointer;
  text-decoration: underline;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.btn-secondary {
  padding: 0.625rem 1.25rem;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: #f3f4f6;
}

.btn-primary {
  padding: 0.625rem 1.25rem;
  background: var(--color-primary);
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: white;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #ea580c;
}

.btn-primary:disabled {
  background: #fdba74;
  cursor: not-allowed;
}

/* Guarantor Financial Section */
.guarantor-financial {
  border: 1px solid #dbeafe;
  background: #eff6ff;
}

.frequency-label {
  font-size: 0.75rem;
  color: #6b7280;
}

.obligations-section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #bfdbfe;
}

.obligations-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 0.75rem;
  text-transform: uppercase;
}

.obligations-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.obligation-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.875rem;
  color: #374151;
  padding: 0.5rem 0.75rem;
  background: white;
  border-radius: 0.25rem;
}

.obligation-badge {
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 600;
  flex-shrink: 0;
}

.obligation-badge.confirmed {
  background: #d1fae5;
  color: #059669;
}

.obligation-badge.pending {
  background: #fef3c7;
  color: #d97706;
}

.obligation-badge.info {
  background: #dbeafe;
  color: #2563eb;
}

.guarantor-adverse-credit {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 0.375rem;
}

.guarantor-adverse-credit .adverse-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #92400e;
  font-weight: 600;
  font-size: 0.875rem;
}

.guarantor-adverse-credit .warning-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.guarantor-adverse-credit .adverse-details {
  margin: 0.5rem 0 0;
  font-size: 0.875rem;
  color: #1f2937;
  background: white;
  padding: 0.75rem;
  border-radius: 0.25rem;
  white-space: pre-line;
}
</style>

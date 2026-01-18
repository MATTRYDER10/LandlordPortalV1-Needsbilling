<template>
  <div class="section-stack">
    <!-- Identity & Selfie - Always shown -->
    <IdentitySelfieSection
      v-if="identitySection"
      :section="identitySection"
      :is-guarantor="isGuarantor"
      :full-name="referenceData.fullName"
      :first-name="referenceData.firstName"
      :last-name="referenceData.lastName"
      :middle-name="referenceData.middleName"
      :date-of-birth="referenceData.dateOfBirth"
      :nationality="referenceData.nationality"
      :email="referenceData.email"
      :contact-number="referenceData.contactNumber"
      :id-document-url="referenceData.idDocumentUrl"
      :selfie-url="referenceData.selfieUrl"
      :signature-url="referenceData.signatureUrl"
      :read-only="readOnly"
      :loading="loading"
      :action-reason-codes="actionReasonCodes"
      :saving-name-correction="savingNameCorrection"
      @pass="(id) => $emit('sectionPass', id)"
      @pass-with-condition="(id, c) => $emit('sectionPassWithCondition', id, c)"
      @action-required="(id, p) => $emit('sectionActionRequired', id, p)"
      @fail="(id, r) => $emit('sectionFail', id, r)"
      @reset="(id) => $emit('sectionReset', id)"
      @update-name="(f, l) => $emit('updateName', f, l)"
    />

    <!-- RTR - Only for tenants -->
    <RtrSection
      v-if="rtrSection && !isGuarantor"
      :section="rtrSection"
      :rtr-status="referenceData.rtrStatus"
      :rtr-expiry-date="referenceData.rtrExpiryDate"
      :nationality="referenceData.nationality"
      :share-code="referenceData.shareCode"
      :rtr-document-url="referenceData.rtrDocumentUrl"
      :rtr-alternative-document-url="referenceData.rtrAlternativeDocumentUrl"
      :rtr-alternative-document-type="referenceData.rtrAlternativeDocumentType"
      :is-british-citizen="referenceData.isBritishCitizen"
      :rtr-british-passport-url="referenceData.rtrBritishPassportUrl"
      :rtr-british-alt-doc-url="referenceData.rtrBritishAltDocUrl"
      :rtr-british-alt-doc-type="referenceData.rtrBritishAltDocType"
      :has-british-no-passport="referenceData.hasBritishNoPassport"
      :rtr-staff-expiry-date="referenceData.rtrStaffExpiryDate"
      :rtr-staff-share-code-confirmed="referenceData.rtrStaffShareCodeConfirmed"
      :rtr-indefinite-leave="referenceData.rtrIndefiniteLeave"
      :rtr-verification-method="referenceData.rtrVerificationMethod"
      :rtr-verification-notes="referenceData.rtrVerificationNotes"
      :read-only="readOnly"
      :loading="loading"
      :action-reason-codes="actionReasonCodes"
      @pass="(id) => $emit('sectionPass', id)"
      @pass-with-condition="(id, c) => $emit('sectionPassWithCondition', id, c)"
      @action-required="(id, p) => $emit('sectionActionRequired', id, p)"
      @fail="(id, r) => $emit('sectionFail', id, r)"
      @reset="(id) => $emit('sectionReset', id)"
      @update-rtr-data="(data) => $emit('updateRtrData', data)"
    />

    <!-- Income - Always shown -->
    <IncomeSection
      v-if="incomeSection"
      :section="incomeSection"
      :is-guarantor="isGuarantor"
      :monthly-rent="referenceData.monthlyRent"
      :total-income="referenceData.totalIncome"
      :income-ratio="referenceData.incomeRatio"
      :required-ratio="referenceData.requiredRatio"
      :employment-type="referenceData.employmentType"
      :employer-name="referenceData.employerName"
      :job-title="referenceData.jobTitle"
      :employment-start-date="referenceData.employmentStartDate"
      :employment-end-date="referenceData.employmentEndDate"
      :employment-contract-type="referenceData.employmentContractType"
      :salary-frequency="referenceData.salaryFrequency"
      :self-employed-start-date="referenceData.selfEmployedStartDate"
      :self-employed-nature-of-business="referenceData.selfEmployedNatureOfBusiness"
      :additional-income-frequency="referenceData.additionalIncomeFrequency"
      :benefits-monthly-amount="referenceData.benefitsMonthlyAmount"
      :income-sources="referenceData.incomeSources"
      :employer-reference="referenceData.employerReference"
      :accountant-reference="referenceData.accountantReference"
      :reference-id="incomeSection.referenceId"
      :claimed-income="referenceData.claimedIncome"
      :verified-income="referenceData.verifiedIncome"
      :income-evidence="referenceData.incomeEvidence"
      :evidence-employer-ref="referenceData.evidenceEmployerRef"
      :evidence-accountant-ref="referenceData.evidenceAccountantRef"
      :income-confirmed-at="referenceData.incomeConfirmedAt"
      :income-confirmed-by="referenceData.incomeConfirmedBy"
      :is-student="referenceData.isStudent"
      :guarantor-financial-data="referenceData.guarantorFinancialData"
      :read-only="readOnly"
      :loading="loading"
      :action-reason-codes="actionReasonCodes"
      @pass="(id) => $emit('sectionPass', id)"
      @pass-with-condition="(id, c) => $emit('sectionPassWithCondition', id, c)"
      @action-required="(id, p) => $emit('sectionActionRequired', id, p)"
      @fail="(id, r) => $emit('sectionFail', id, r)"
      @reset="(id) => $emit('sectionReset', id)"
      @income-confirmed="$emit('dataRefreshNeeded')"
    />

    <!-- Residential - Only for tenants -->
    <ResidentialSection
      v-if="residentialSection && !isGuarantor"
      :section="residentialSection"
      :previous-address="referenceData.previousAddress"
      :previous-address-type="referenceData.previousAddressType"
      :tenancy-duration="referenceData.tenancyDuration"
      :tenancy-start-date="referenceData.previousTenancyStartDate"
      :tenancy-end-date="referenceData.previousTenancyEndDate"
      :landlord-reference="referenceData.landlordReference"
      :reference-id="residentialSection.referenceId"
      :evidence-landlord-ref="referenceData.evidenceLandlordRef"
      :evidence-agent-ref="referenceData.evidenceAgentRef"
      :confirmed-residential-status="referenceData.confirmedResidentialStatus"
      :residential-confirmed-at="referenceData.residentialConfirmedAt"
      :residential-confirmed-by="referenceData.residentialConfirmedBy"
      :current-address="referenceData.currentAddress"
      :previous-addresses="referenceData.previousAddresses"
      :read-only="readOnly"
      :loading="loading"
      :action-reason-codes="actionReasonCodes"
      @pass="(id) => $emit('sectionPass', id)"
      @pass-with-condition="(id, c) => $emit('sectionPassWithCondition', id, c)"
      @action-required="(id, p) => $emit('sectionActionRequired', id, p)"
      @fail="(id, r) => $emit('sectionFail', id, r)"
      @reset="(id) => $emit('sectionReset', id)"
      @residential-confirmed="$emit('dataRefreshNeeded')"
    />

    <!-- Credit - Always shown -->
    <CreditSection
      v-if="creditSection"
      :section="creditSection"
      :is-guarantor="isGuarantor"
      :tas-score="referenceData.tasScore"
      :credit-summary="referenceData.creditSummary"
      :credit-flags="referenceData.creditFlags"
      :address-match-status="referenceData.addressMatchStatus"
      :creditsafe-verification="referenceData.creditsafeVerification"
      :credit-report="referenceData.creditReport"
      :reference-score="referenceData.referenceScore"
      :adverse-credit-details="referenceData.adverseCreditDetails"
      :read-only="readOnly"
      :loading="loading"
      :action-reason-codes="actionReasonCodes"
      @pass="(id) => $emit('sectionPass', id)"
      @pass-with-condition="(id, c) => $emit('sectionPassWithCondition', id, c)"
      @action-required="(id, p) => $emit('sectionActionRequired', id, p)"
      @fail="(id, r) => $emit('sectionFail', id, r)"
      @reset="(id) => $emit('sectionReset', id)"
    />

    <!-- AML - Always shown -->
    <AmlSection
      v-if="amlSection"
      :section="amlSection"
      :is-guarantor="isGuarantor"
      :sanctions-screening="referenceData.sanctionsScreening"
      :aml-status="referenceData.amlStatus"
      :last-checked-at="referenceData.amlLastChecked"
      :pep-result="referenceData.pepResult"
      :pep-matches="referenceData.pepMatches"
      :sanctions-result="referenceData.sanctionsResult"
      :sanctions-matches="referenceData.sanctionsMatches"
      :adverse-media-result="referenceData.adverseMediaResult"
      :adverse-media-matches="referenceData.adverseMediaMatches"
      :id-verification-result="referenceData.idVerificationResult"
      :id-verification-details="referenceData.idVerificationDetails"
      :potential-matches="referenceData.potentialMatches"
      :risk-level="referenceData.riskLevel"
      :risk-reason="referenceData.riskReason"
      :read-only="readOnly"
      :loading="loading"
      :action-reason-codes="actionReasonCodes"
      @pass="(id) => $emit('sectionPass', id)"
      @pass-with-condition="(id, c) => $emit('sectionPassWithCondition', id, c)"
      @action-required="(id, p) => $emit('sectionActionRequired', id, p)"
      @fail="(id, r) => $emit('sectionFail', id, r)"
      @reset="(id) => $emit('sectionReset', id)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { VerificationSection, ActionReasonCode } from '@/types/staff'
import IdentitySelfieSection from './sections/IdentitySelfieSection.vue'
import RtrSection from './sections/RtrSection.vue'
import IncomeSection from './sections/IncomeSection.vue'
import ResidentialSection from './sections/ResidentialSection.vue'
import CreditSection from './sections/CreditSection.vue'
import AmlSection from './sections/AmlSection.vue'

interface ReferenceData {
  // Identity
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
  // RTR
  rtrStatus?: string
  rtrExpiryDate?: string
  shareCode?: string
  rtrDocumentUrl?: string | null
  rtrAlternativeDocumentUrl?: string | null
  rtrAlternativeDocumentType?: string
  isBritishCitizen?: boolean
  // RTR - British citizen documents
  rtrBritishPassportUrl?: string | null
  rtrBritishAltDocUrl?: string | null
  rtrBritishAltDocType?: string
  hasBritishNoPassport?: boolean
  // RTR - Staff verification fields
  rtrStaffExpiryDate?: string
  rtrStaffShareCodeConfirmed?: string
  rtrIndefiniteLeave?: boolean
  rtrVerificationMethod?: string
  rtrVerificationNotes?: string
  // Income
  monthlyRent?: number
  totalIncome?: number
  incomeRatio?: number
  requiredRatio?: number
  employmentType?: string
  employerName?: string
  jobTitle?: string
  employmentStartDate?: string
  incomeSources?: any[]
  employerReference?: any
  accountantReference?: any
  // Evidence data for Income section modal
  claimedIncome?: any
  verifiedIncome?: any
  incomeEvidence?: any[]
  evidenceEmployerRef?: any
  evidenceAccountantRef?: any
  incomeConfirmedAt?: string
  incomeConfirmedBy?: string
  isStudent?: boolean
  // Employment details
  employmentEndDate?: string
  employmentContractType?: string
  salaryFrequency?: string
  // Self-employed details
  selfEmployedStartDate?: string
  selfEmployedNatureOfBusiness?: string
  // Additional income
  additionalIncomeFrequency?: string
  // Benefits
  benefitsMonthlyAmount?: number
  // Guarantor financial data
  guarantorFinancialData?: any
  // Residential
  previousAddress?: string
  previousAddressType?: string
  tenancyDuration?: string
  previousTenancyStartDate?: string
  previousTenancyEndDate?: string
  landlordReference?: any
  // Evidence data for Residential section modal
  evidenceLandlordRef?: any
  evidenceAgentRef?: any
  confirmedResidentialStatus?: string
  residentialConfirmedAt?: string
  residentialConfirmedBy?: string
  // Current and previous addresses
  currentAddress?: any
  previousAddresses?: any[]
  // Credit
  adverseCreditDetails?: string
  tasScore?: number
  creditSummary?: any
  creditFlags?: any[]
  addressMatchStatus?: 'matched' | 'mismatched' | 'partial' | string
  creditsafeVerification?: any
  creditReport?: any
  referenceScore?: any
  // AML
  sanctionsScreening?: any
  amlStatus?: string
  amlLastChecked?: string
  pepResult?: string
  pepMatches?: any[]
  sanctionsResult?: string
  sanctionsMatches?: any[]
  adverseMediaResult?: string
  adverseMediaMatches?: any[]
  idVerificationResult?: string
  idVerificationDetails?: string
  potentialMatches?: any[]
  riskLevel?: string
  riskReason?: string
}

const props = defineProps<{
  sections: VerificationSection[]
  isGuarantor: boolean
  referenceData: ReferenceData
  readOnly?: boolean
  loading?: boolean
  actionReasonCodes?: ActionReasonCode[]
  savingNameCorrection?: boolean
}>()

defineEmits<{
  (e: 'sectionPass', sectionId: string): void
  (e: 'sectionPassWithCondition', sectionId: string, condition: string): void
  (e: 'sectionActionRequired', sectionId: string, params: { reasonCode: string; agentNote: string; internalNote: string }): void
  (e: 'sectionFail', sectionId: string, reason: string): void
  (e: 'sectionReset', sectionId: string): void
  (e: 'dataRefreshNeeded'): void
  (e: 'updateName', firstName: string, lastName: string): void
  (e: 'updateRtrData', data: { shareCodeConfirmed?: string; expiryDate?: string; indefiniteLeave?: boolean; verificationMethod?: string; verificationNotes?: string }): void
}>()

const findSection = (type: string) => {
  return props.sections.find(s => s.sectionType === type) || null
}

const identitySection = computed(() => findSection('IDENTITY_SELFIE'))
const rtrSection = computed(() => findSection('RTR'))
const incomeSection = computed(() => findSection('INCOME'))
const residentialSection = computed(() => findSection('RESIDENTIAL'))
const creditSection = computed(() => findSection('CREDIT'))
const amlSection = computed(() => findSection('AML'))
</script>

<style scoped>
.section-stack {
  display: flex;
  flex-direction: column;
  gap: 0;
}
</style>

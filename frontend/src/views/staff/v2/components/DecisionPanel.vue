<template>
  <div class="border-t border-gray-200 dark:border-slate-700 pt-6">
    <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Section Decision</h3>

    <!-- Decision Buttons -->
    <div class="flex gap-3 mb-4">
      <button
        @click="selectDecision('PASS')"
        class="flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
        :class="decision === 'PASS'
          ? 'bg-green-600 text-white shadow-lg'
          : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'"
      >
        <Check class="w-5 h-5" />
        Pass
      </button>
      <button
        @click="selectDecision('PASS_WITH_CONDITION')"
        class="flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
        :class="decision === 'PASS_WITH_CONDITION'
          ? 'bg-amber-500 text-white shadow-lg'
          : 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400'"
      >
        <AlertCircle class="w-5 h-5" />
        Condition
      </button>
      <button
        @click="selectDecision('FAIL')"
        class="flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
        :class="decision === 'FAIL'
          ? 'bg-red-600 text-white shadow-lg'
          : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'"
      >
        <XCircle class="w-5 h-5" />
        Fail
      </button>
    </div>

    <!-- Condition Text (shown when PASS_WITH_CONDITION) -->
    <div v-if="decision === 'PASS_WITH_CONDITION'" class="mb-4">
      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
        Condition Details *
      </label>
      <textarea
        v-model="conditionText"
        rows="2"
        required
        placeholder="Describe the condition..."
        class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
      />
    </div>

    <!-- Fail Reason (shown when FAIL) -->
    <div v-if="decision === 'FAIL'" class="mb-4">
      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
        Failure Reason *
      </label>
      <select
        v-model="failReason"
        required
        class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent mb-2"
      >
        <option value="">Select reason...</option>
        <option v-for="reason in failReasons" :key="reason.value" :value="reason.value">
          {{ reason.label }}
        </option>
      </select>
      <textarea
        v-model="failNotes"
        rows="2"
        placeholder="Additional notes (optional)..."
        class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
      />
    </div>

    <!-- Notes (always shown) -->
    <div class="mb-4">
      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
        Internal Notes (optional)
      </label>
      <textarea
        v-model="notes"
        rows="2"
        placeholder="Notes for other assessors..."
        class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
      />
    </div>

    <!-- Action Buttons -->
    <div class="flex gap-3">
      <button
        @click="$emit('release')"
        class="flex-1 py-2.5 px-4 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
      >
        Release to Queue
      </button>
      <button
        @click="submitDecision"
        :disabled="!canSubmit || submitting"
        class="flex-1 py-2.5 px-4 bg-gradient-to-r from-primary to-orange-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <Loader2 v-if="submitting" class="w-4 h-4 animate-spin" />
        {{ submitting ? 'Submitting...' : 'Submit Decision' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Check, AlertCircle, XCircle, Loader2 } from 'lucide-vue-next'

type Decision = 'PASS' | 'PASS_WITH_CONDITION' | 'FAIL' | null

const props = defineProps<{
  sectionType: string
  submitting?: boolean
}>()

const emit = defineEmits<{
  submit: [data: { decision: Decision; conditionText?: string; failReason?: string; failNotes?: string; notes?: string }]
  release: []
}>()

const decision = ref<Decision>(null)
const conditionText = ref('')
const failReason = ref('')
const failNotes = ref('')
const notes = ref('')

const failReasons = computed(() => {
  const common = [
    { value: 'DOCUMENT_UNCLEAR', label: 'Document unclear or unreadable' },
    { value: 'DOCUMENT_EXPIRED', label: 'Document expired' },
    { value: 'INFO_MISMATCH', label: 'Information does not match' },
    { value: 'SUSPECTED_FRAUD', label: 'Suspected fraud or manipulation' },
    { value: 'INSUFFICIENT_EVIDENCE', label: 'Insufficient evidence provided' },
    { value: 'OTHER', label: 'Other (specify in notes)' }
  ]

  // Add section-specific reasons
  switch (props.sectionType) {
    case 'IDENTITY':
      return [
        { value: 'SELFIE_MISMATCH', label: 'Selfie does not match ID' },
        { value: 'NAME_MISMATCH', label: 'Name does not match application' },
        ...common
      ]
    case 'RTR':
      return [
        { value: 'NO_RIGHT_TO_RENT', label: 'No right to rent in UK' },
        { value: 'SHARE_CODE_INVALID', label: 'Share code invalid or expired' },
        { value: 'VISA_EXPIRED', label: 'Visa expired or insufficient' },
        ...common
      ]
    case 'INCOME':
      return [
        { value: 'INCOME_INSUFFICIENT', label: 'Income insufficient for rent' },
        { value: 'EMPLOYMENT_NOT_VERIFIED', label: 'Employment could not be verified' },
        { value: 'PAYSLIPS_INCONSISTENT', label: 'Payslips inconsistent' },
        ...common
      ]
    case 'RESIDENTIAL':
      return [
        { value: 'NEGATIVE_REFERENCE', label: 'Negative landlord reference' },
        { value: 'RENT_ARREARS', label: 'Previous rent arrears' },
        { value: 'EVICTION_HISTORY', label: 'Previous eviction' },
        ...common
      ]
    case 'ADDRESS':
      // Guarantor address verification
      return [
        { value: 'NO_PROOF_OF_ADDRESS', label: 'No proof of address provided' },
        { value: 'ADDRESS_MISMATCH', label: 'Address does not match document' },
        { value: 'DOCUMENT_EXPIRED', label: 'Proof of address too old (>3 months)' },
        ...common
      ]
    case 'CREDIT':
      return [
        { value: 'CCJ_FOUND', label: 'CCJ found' },
        { value: 'BANKRUPTCY', label: 'Bankruptcy on record' },
        { value: 'IVA_FOUND', label: 'IVA on record' },
        { value: 'POOR_CREDIT_SCORE', label: 'Poor credit score' },
        ...common
      ]
    case 'AML':
      return [
        { value: 'PEP_FLAG', label: 'Politically Exposed Person flag' },
        { value: 'SANCTIONS_MATCH', label: 'Sanctions list match' },
        { value: 'ADVERSE_MEDIA', label: 'Adverse media found' },
        ...common
      ]
    default:
      return common
  }
})

const canSubmit = computed(() => {
  if (!decision.value) return false
  if (decision.value === 'PASS_WITH_CONDITION' && !conditionText.value.trim()) return false
  if (decision.value === 'FAIL' && !failReason.value) return false
  return true
})

function selectDecision(d: Decision) {
  decision.value = d
}

function submitDecision() {
  if (!canSubmit.value) return

  emit('submit', {
    decision: decision.value,
    conditionText: conditionText.value || undefined,
    failReason: failReason.value || undefined,
    failNotes: failNotes.value || undefined,
    notes: notes.value || undefined
  })
}
</script>

<template>
  <div
    class="p-4 rounded-lg border shadow-sm transition-all"
    :class="[
      isGuarantor
        ? 'ml-4 border-l-4 border-l-purple-300 dark:border-l-purple-500 bg-purple-50/30 dark:bg-purple-900/20 border-gray-200 dark:border-slate-700'
        : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700',
      person.verificationState === 'ACTION_REQUIRED'
        ? 'border-l-4 border-l-red-400 dark:border-l-red-500 bg-red-50 dark:bg-red-900/20'
        : ''
    ]"
  >
    <div class="flex items-center justify-between gap-4">
      <!-- Left: Person info -->
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <!-- Role badge -->
        <span
          class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium"
          :class="isGuarantor
            ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
            : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'"
        >
          {{ isGuarantor ? 'G' : 'T' }}
        </span>

        <!-- Name and details -->
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="font-medium text-gray-900 dark:text-white truncate">{{ person.name }}</span>
            <!-- Single unified status badge -->
            <span
              class="px-2 py-0.5 text-xs font-medium rounded-full"
              :class="unifiedStatusClasses"
            >
              {{ unifiedStatusLabel }}
            </span>
            <!-- Email delivery issue badge -->
            <span
              v-if="person.emailDeliveryIssue"
              class="px-2 py-0.5 text-xs font-semibold rounded-full flex items-center gap-1"
              :class="person.emailDeliveryIssue.type === 'bounced'
                ? 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300'
                : 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300'"
              :title="getEmailIssueTooltip()"
            >
              <MailWarning class="w-3 h-3" />
              {{ getEmailBadgeText() }}
            </span>
          </div>
          <div class="flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            <span v-if="person.rentShare">{{ formatCurrency(person.rentShare) }}/mo</span>
            <span class="truncate">{{ person.email }}</span>
          </div>
        </div>
      </div>

      <!-- Middle: Section strip - shows category abbreviations with status color -->
      <div class="hidden sm:flex items-center gap-1">
        <span
          v-for="section in displaySections"
          :key="section.type"
          class="px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center justify-center"
          :class="getSectionClass(section.decision)"
          :title="getSectionTitle(section)"
        >
          {{ getSectionAbbreviation(section.type) }}
        </span>
      </div>

      <!-- Right: Actions -->
      <div class="flex items-center gap-2">
        <button
          @click.stop="$emit('open')"
          class="px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 dark:hover:bg-primary/20 rounded transition-colors"
        >
          Open
        </button>
        <button
          v-if="canChase"
          @click.stop="$emit('chase')"
          class="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
        >
          Chase
        </button>
      </div>
    </div>

    <!-- Action Required Tasks (if any) -->
    <div v-if="person.actionRequiredTasks.length > 0" class="mt-2 pt-2 border-t border-red-200 dark:border-red-800">
      <div
        v-for="task in person.actionRequiredTasks"
        :key="task.sectionType"
        class="flex items-start gap-2 text-xs text-red-700 dark:text-red-400"
      >
        <AlertCircle class="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          <strong>{{ formatSectionLabel(task.sectionType) }}:</strong>
          {{ formatActionReason(task) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TenancyPerson, SectionStatus, SectionDecision, ActionRequiredTask } from '@/composables/useTenancies'
import { AlertCircle, MailWarning } from 'lucide-vue-next'

const props = defineProps<{
  person: TenancyPerson
  isGuarantor?: boolean
}>()

defineEmits<{
  open: []
  chase: []
}>()

// Only show sections that exist for this person type
const displaySections = computed(() => {
  return props.person.sectionStatuses
})

const canChase = computed(() => {
  // Can chase if: collecting evidence or waiting on references
  return (
    props.person.verificationState === 'COLLECTING_EVIDENCE' ||
    props.person.verificationState === 'WAITING_ON_REFERENCES'
  )
})

// Check if income section has PASS_WITH_CONDITION (indicates guarantor required)
const hasGuarantorCondition = computed(() => {
  const incomeSection = props.person.sectionStatuses?.find(s => s.type === 'INCOME')
  return incomeSection?.decision === 'PASS_WITH_CONDITION'
})

// Single unified status label - simplified to show only ONE status
const unifiedStatusLabel = computed(() => {
  const state = props.person.verificationState
  switch (state) {
    case 'COMPLETED':
      return hasGuarantorCondition.value ? 'Pass with Guarantor' : 'Verified'
    case 'REJECTED':
      return 'Failed'
    case 'ACTION_REQUIRED':
      return 'Action Required'
    case 'AWAITING_VERIFICATION':
    case 'READY_FOR_REVIEW':
    case 'IN_VERIFICATION':
      return 'Awaiting Review'
    case 'COLLECTING_EVIDENCE':
    case 'WAITING_ON_REFERENCES':
    case 'SENT':
    case 'IN_PROGRESS':
    default:
      return 'In Progress'
  }
})

// Single unified status classes
const unifiedStatusClasses = computed(() => {
  const state = props.person.verificationState

  // Pass with Guarantor - amber
  if (state === 'COMPLETED' && hasGuarantorCondition.value) {
    return 'bg-amber-100 dark:bg-amber-800 text-amber-800 dark:text-amber-100'
  }

  switch (state) {
    case 'COMPLETED':
      return 'bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100'
    case 'REJECTED':
      return 'bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-100'
    case 'ACTION_REQUIRED':
      return 'bg-orange-100 dark:bg-orange-800 text-orange-800 dark:text-orange-100'
    case 'AWAITING_VERIFICATION':
    case 'READY_FOR_REVIEW':
    case 'IN_VERIFICATION':
      return 'bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-purple-100'
    default:
      return 'bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100'
  }
})

function getSectionClass(decision: SectionDecision): string {
  switch (decision) {
    case 'PASS':
      return 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
    case 'PASS_WITH_CONDITION':
      return 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400'
    case 'ACTION_REQUIRED':
      return 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
    case 'FAIL':
      return 'bg-red-200 dark:bg-red-900/70 text-red-800 dark:text-red-300'
    case 'NOT_REVIEWED':
    default:
      return 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
  }
}

const sectionLabels: Record<string, string> = {
  'IDENTITY_SELFIE': 'ID/Selfie',
  'RTR': 'Right to Rent',
  'INCOME': 'Income',
  'RESIDENTIAL': 'Residential',
  'CREDIT': 'Credit',
  'AML': 'AML',
  'TENANT_FORM': 'Tenant Application Form',
  'GUARANTOR_FORM': 'Guarantor Form',
  'EMPLOYER_REF': 'Employer Reference',
  'RESIDENTIAL_REF': 'Landlord Reference',
  'ACCOUNTANT_REF': 'Accountant Reference',
  'EMPLOYER_REFERENCE': 'Employer Reference',
  'LANDLORD_REFERENCE': 'Landlord Reference',
  'ACCOUNTANT_REFERENCE': 'Accountant Reference'
}

// Short abbreviations for section strip display
const sectionAbbreviations: Record<string, string> = {
  'IDENTITY_SELFIE': 'ID',
  'RTR': 'RTR',
  'INCOME': 'Inc',
  'RESIDENTIAL': 'Res',
  'CREDIT': 'Crd',
  'AML': 'AML',
  'TENANT_FORM': 'App',
  'GUARANTOR_FORM': 'Frm',
  'EMPLOYER_REF': 'Emp',
  'RESIDENTIAL_REF': 'LL',
  'ACCOUNTANT_REF': 'Acc',
  'EMPLOYER_REFERENCE': 'Emp',
  'LANDLORD_REFERENCE': 'LL',
  'ACCOUNTANT_REFERENCE': 'Acc'
}

function getSectionAbbreviation(sectionType: string): string {
  return sectionAbbreviations[sectionType] || sectionType.substring(0, 3)
}

function formatSectionLabel(sectionType: string): string {
  if (sectionLabels[sectionType]) return sectionLabels[sectionType]
  return sectionType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function formatActionReason(task: ActionRequiredTask): string {
  // Prioritize showing meaningful information
  const reason = task.reasonLabel || task.staffNote || 'Action required'

  // If we have both a reason label and a different staff note, combine them
  if (task.reasonLabel && task.staffNote && task.staffNote !== task.reasonLabel) {
    return `${task.reasonLabel} - ${task.staffNote}`
  }

  return reason
}

function getSectionTitle(section: SectionStatus): string {
  return `${sectionLabels[section.type] || section.type}: ${section.decision}`
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

function getEmailIssueTooltip(): string {
  const issue = props.person.emailDeliveryIssue
  if (!issue) return ''

  const contactLabel = getContactLabel(issue.referenceType)
  if (issue.type === 'bounced') {
    return `${contactLabel} email bounced - please check the email address is correct`
  } else {
    return `${contactLabel} email was marked as spam - consider calling instead`
  }
}

function getEmailBadgeText(): string {
  const issue = props.person.emailDeliveryIssue
  if (!issue) return ''

  // For tenant/guarantor's own email, don't show the type prefix (it's obvious)
  // For referee emails (employer, landlord, etc.), show the prefix
  const refType = issue.referenceType
  const isOwnEmail = refType === 'tenant' || refType === 'guarantor'

  if (isOwnEmail) {
    return issue.type === 'bounced' ? 'BOUNCED' : 'SPAM'
  }

  const label = getContactLabel(refType).toUpperCase()
  return issue.type === 'bounced' ? `${label} BOUNCED` : `${label} SPAM`
}

function getContactLabel(refType: string): string {
  const labels: Record<string, string> = {
    'tenant': 'Tenant',
    'guarantor': 'Guarantor',
    'employer': 'Employer',
    'landlord': 'Landlord',
    'accountant': 'Accountant',
    'agent': 'Agent'
  }
  return labels[refType] || 'Email'
}
</script>

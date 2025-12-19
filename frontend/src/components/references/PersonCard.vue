<template>
  <div
    class="p-4 rounded-lg border border-gray-200 shadow-sm transition-all"
    :class="[
      isGuarantor ? 'ml-4 border-l-4 border-l-purple-300 bg-purple-50/30' : 'bg-white',
      person.status === 'ACTION_REQUIRED' ? 'border-l-4 border-l-red-400 bg-red-50' : ''
    ]"
  >
    <div class="flex items-center justify-between gap-4">
      <!-- Left: Person info -->
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <!-- Role badge -->
        <span
          class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium"
          :class="isGuarantor ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'"
        >
          {{ isGuarantor ? 'G' : 'T' }}
        </span>

        <!-- Name and details -->
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="font-medium text-gray-900 truncate">{{ person.name }}</span>
            <StatusPill :status="person.status" />
            <span
              v-if="isVerified"
              class="px-2 py-0.5 text-xs font-medium rounded-full"
              :class="decisionBadgeClass"
            >
              {{ decisionLabel }}
            </span>
          </div>
          <div class="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
            <span v-if="person.rentShare">{{ formatCurrency(person.rentShare) }}/mo</span>
            <span class="truncate">{{ person.email }}</span>
          </div>
        </div>
      </div>

      <!-- Middle: Section strip -->
      <div class="hidden sm:flex items-center gap-1">
        <span
          v-for="section in displaySections"
          :key="section.type"
          class="w-6 h-6 rounded text-xs font-medium flex items-center justify-center"
          :class="getSectionClass(section.decision)"
          :title="getSectionTitle(section)"
        >
          {{ getSectionIcon(section.decision) }}
        </span>
      </div>

      <!-- Right: Actions -->
      <div class="flex items-center gap-2">
        <button
          @click.stop="$emit('open')"
          class="px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded transition-colors"
        >
          Open
        </button>
        <button
          v-if="canChase"
          @click.stop="$emit('chase')"
          class="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded transition-colors"
        >
          Chase
        </button>
      </div>
    </div>

    <!-- Action Required Tasks (if any) -->
    <div v-if="person.actionRequiredTasks.length > 0" class="mt-2 pt-2 border-t border-red-200">
      <div
        v-for="task in person.actionRequiredTasks"
        :key="task.sectionType"
        class="flex items-start gap-2 text-xs text-red-700"
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
import StatusPill from './StatusPill.vue'
import { AlertCircle } from 'lucide-vue-next'

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
  return ['NOT_STARTED', 'IN_PROGRESS'].includes(props.person.status)
})

const isVerified = computed(() => {
  return ['VERIFIED_PASS', 'VERIFIED_CONDITIONAL', 'VERIFIED_FAIL'].includes(props.person.status)
})

const hasGuarantorCondition = computed(() => {
  // Check if income section has PASS_WITH_CONDITION (indicates guarantor required)
  const incomeSection = props.person.sectionStatuses?.find(s => s.type === 'INCOME')
  return incomeSection?.decision === 'PASS_WITH_CONDITION'
})

const decisionLabel = computed(() => {
  switch (props.person.status) {
    case 'VERIFIED_PASS':
      // Check if income section required guarantor
      return hasGuarantorCondition.value ? 'Pass with Guarantor' : 'Pass'
    case 'VERIFIED_CONDITIONAL': return 'Pass with Guarantor'
    case 'VERIFIED_FAIL': return 'Fail'
    default: return ''
  }
})

const decisionBadgeClass = computed(() => {
  // Use amber for Pass with Guarantor, green for Pass, red for Fail
  if (props.person.status === 'VERIFIED_PASS' && hasGuarantorCondition.value) {
    return 'bg-amber-100 text-amber-800'
  }
  switch (props.person.status) {
    case 'VERIFIED_PASS': return 'bg-green-100 text-green-800'
    case 'VERIFIED_CONDITIONAL': return 'bg-amber-100 text-amber-800'
    case 'VERIFIED_FAIL': return 'bg-red-100 text-red-800'
    default: return ''
  }
})

function getSectionClass(decision: SectionDecision): string {
  switch (decision) {
    case 'PASS':
      return 'bg-green-100 text-green-700'
    case 'PASS_WITH_CONDITION':
      return 'bg-green-100 text-green-600'
    case 'ACTION_REQUIRED':
      return 'bg-red-100 text-red-700'
    case 'FAIL':
      return 'bg-red-200 text-red-800'
    case 'NOT_REVIEWED':
    default:
      return 'bg-gray-100 text-gray-500'
  }
}

function getSectionIcon(decision: SectionDecision): string {
  switch (decision) {
    case 'PASS':
    case 'PASS_WITH_CONDITION':
      return '✓'
    case 'ACTION_REQUIRED':
      return '!'
    case 'FAIL':
      return '✗'
    case 'NOT_REVIEWED':
    default:
      return '—'
  }
}

const sectionLabels: Record<string, string> = {
  'IDENTITY_SELFIE': 'ID/Selfie',
  'RTR': 'Right to Rent',
  'INCOME': 'Income',
  'RESIDENTIAL': 'Residential',
  'CREDIT': 'Credit',
  'AML': 'AML'
}

function formatSectionLabel(sectionType: string): string {
  return sectionLabels[sectionType] || sectionType
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
</script>

<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">Ground Explanations</h3>
      <p class="text-sm text-gray-500 dark:text-slate-400">
        Provide the factual basis for each ground. These explanations will appear in the notice.
      </p>
    </div>

    <!-- One section per selected ground -->
    <div v-for="groundId in formState.selectedGroundIds" :key="groundId" class="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <div
        class="px-4 py-3"
        :class="getGround(groundId)?.type === 'mandatory' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-amber-50 dark:bg-amber-900/20'"
      >
        <div class="flex items-center gap-2">
          <span
            class="text-sm font-semibold"
            :class="getGround(groundId)?.type === 'mandatory' ? 'text-red-600' : 'text-amber-600'"
          >
            {{ getGround(groundId)?.number }}
          </span>
          <span class="text-sm font-medium text-gray-900 dark:text-white">{{ getGround(groundId)?.title }}</span>
        </div>
      </div>

      <div class="p-4 space-y-4">
        <!-- Statutory wording -->
        <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-3 text-xs text-gray-600 dark:text-slate-400 border-l-4 border-gray-300 dark:border-slate-600">
          <p class="font-semibold text-gray-700 dark:text-slate-300 mb-1">Statutory wording:</p>
          <p class="whitespace-pre-wrap">{{ getGround(groundId)?.statutoryWording }}</p>
        </div>

        <!-- Staff guidance -->
        <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-300">
          <div class="flex items-start gap-2">
            <Info class="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>{{ getGround(groundId)?.staffGuidance }}</p>
          </div>
        </div>

        <!-- Explanation text area -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Factual basis for this ground *
          </label>
          <textarea
            :value="formState.groundExplanations[groundId] || ''"
            @input="updateExplanation(groundId, ($event.target as HTMLTextAreaElement).value)"
            rows="4"
            :placeholder="getPlaceholder(groundId)"
            class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm dark:bg-slate-900 dark:text-white"
            :class="getExplanationLength(groundId) < 50 ? 'border-amber-300 dark:border-amber-600' : 'border-gray-300 dark:border-slate-600'"
          ></textarea>
          <div class="flex justify-between mt-1">
            <p class="text-xs" :class="getExplanationLength(groundId) < 50 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-slate-400'">
              {{ getExplanationLength(groundId) < 50
                ? `Minimum 50 characters required (${getExplanationLength(groundId)}/50)`
                : `${getExplanationLength(groundId)} characters`
              }}
            </p>
          </div>
        </div>

        <!-- Auto-populate button for arrears grounds -->
        <button
          v-if="isArrearsGround(groundId) && hasArrearsData"
          @click="populateArrearsExplanation(groundId)"
          type="button"
          class="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
        >
          <Sparkles class="w-4 h-4" />
          Auto-populate from arrears table
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Info, Sparkles } from 'lucide-vue-next'
import type { S8FormState, S8Ground } from '@/types/section8'
import { ARREARS_GROUNDS } from '@/types/section8'

interface Props {
  formState: S8FormState
  grounds: S8Ground[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  update: [updates: Partial<S8FormState>]
}>()

const hasArrearsData = computed(() =>
  props.formState.arrearsRows.length > 0
)

function getGround(id: string): S8Ground | undefined {
  return props.grounds.find(g => g.id === id)
}

function getExplanationLength(groundId: string): number {
  return (props.formState.groundExplanations[groundId] || '').trim().length
}

function isArrearsGround(groundId: string): boolean {
  return ARREARS_GROUNDS.includes(groundId)
}

function updateExplanation(groundId: string, value: string) {
  emit('update', {
    groundExplanations: {
      ...props.formState.groundExplanations,
      [groundId]: value,
    },
  })
}

function getPlaceholder(groundId: string): string {
  const placeholders: Record<string, string> = {
    'ground-1': 'Describe how the landlord occupied the property as their principal home before letting, or why they now require it back as their only home...',
    'ground-2': 'Describe the mortgage lender\'s requirement for possession...',
    'ground-8': 'State the current arrears amount, how it was calculated, and confirm it meets the statutory threshold...',
    'ground-10': 'State the arrears amount at the notice date and confirm rent remains unpaid...',
    'ground-11': 'Describe the pattern of late payments, including specific dates and amounts...',
    'ground-12': 'Describe the specific breach of the tenancy agreement, referencing the relevant clause...',
    'ground-13': 'Describe the deterioration of the property and how it was caused by the tenant...',
    'ground-14': 'Describe the nuisance or annoyance caused, including dates, times, and any complaints received...',
    'ground-17': 'Describe the false statement made and how it induced the landlord to grant the tenancy...',
  }
  return placeholders[groundId] || 'Provide specific details to support this ground...'
}

function formatDateUK(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function populateArrearsExplanation(groundId: string) {
  const rows = props.formState.arrearsRows
  const total = rows.reduce((sum, row) => sum + row.balance, 0)
  const rent = props.formState.rentAmount || 0
  const freq = props.formState.rentFrequency || 'monthly'

  let threshold = ''
  switch (freq) {
    case 'weekly':
    case 'fortnightly':
      threshold = `8 weeks' rent (£${(rent * 8).toFixed(2)})`
      break
    case 'monthly':
      threshold = `2 months' rent (£${(rent * 2).toFixed(2)})`
      break
    case 'quarterly':
      threshold = `1 quarter's rent (£${rent.toFixed(2)})`
      break
    default:
      threshold = `the statutory threshold`
  }

  // Find periods with arrears (balance > 0)
  const arrearsRows = rows.filter(r => r.balance > 0)
  const periodsText = arrearsRows
    .map(r => `${r.period}: £${r.balance.toFixed(2)}`)
    .join('; ')

  // Find the earliest arrears date
  const rowsWithDates = arrearsRows.filter(r => r.dueDate)
  const earliestArrearsDate = rowsWithDates.length > 0
    ? rowsWithDates.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]!.dueDate
    : null
  const formattedEarliestDate = earliestArrearsDate ? formatDateUK(earliestArrearsDate) : 'the start of the tenancy'

  // Find late payments (paid after due date)
  const latePayments = rows.filter(r => r.dueDate && r.paidDate && new Date(r.paidDate) > new Date(r.dueDate))
  const latePaymentText = latePayments
    .map(r => `${r.period}: due ${formatDateUK(r.dueDate)}, paid ${formatDateUK(r.paidDate)}`)
    .join('\n')

  let explanation = ''

  if (groundId === 'ground-8') {
    explanation = `As at the date of this notice, the tenant owes a total of £${total.toFixed(2)} in rent arrears. This exceeds ${threshold} as required by Ground 8.\n\nBreakdown of arrears by period:\n${periodsText}\n\nThe tenant has been in arrears since ${formattedEarliestDate} and despite reminders, the full rent has not been paid.`
  } else if (groundId === 'ground-10') {
    explanation = `Rent arrears of £${total.toFixed(2)} were outstanding at the date of service of this notice. The arrears relate to the following periods:\n${periodsText}\n\nArrears have been outstanding since ${formattedEarliestDate}.`
  } else if (groundId === 'ground-11') {
    const lateCount = latePayments.length
    let latePaymentSection = ''
    if (lateCount > 0) {
      latePaymentSection = `\n\nThe following ${lateCount} payment${lateCount > 1 ? 's were' : ' was'} made late:\n${latePaymentText}`
    }
    explanation = `The tenant has persistently delayed paying rent. The following pattern of late and missed payments demonstrates habitual delay:\n\nOutstanding arrears:\n${periodsText}${latePaymentSection}\n\n${props.formState.arrearsNotes ? `Additional notes: ${props.formState.arrearsNotes}` : ''}`
  }

  updateExplanation(groundId, explanation)
}
</script>

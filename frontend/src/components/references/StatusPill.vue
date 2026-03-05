<template>
  <span
    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
    :class="pillClasses"
  >
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TenancyStatus } from '@/composables/useTenancies'
import { getVerificationStateLabel, getVerificationStateColor } from '@/utils/verificationStateLabels'

const props = defineProps<{
  verificationState?: string  // For person-level status
  status?: TenancyStatus       // For tenancy-level status
}>()

const pillClasses = computed(() => {
  // Handle person-level verificationState
  if (props.verificationState) {
    const color = getVerificationStateColor(props.verificationState)
    const colorMap: Record<string, string> = {
      'green': 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300',
      'blue': 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300',
      'yellow': 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300',
      'purple': 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300',
      'orange': 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300',
      'red': 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300',
      'gray': 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-300'
    }
    return colorMap[color] || 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-300'
  }

  // Handle tenancy-level status
  if (props.status) {
    switch (props.status) {
      case 'COMPLETED':
        return 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300'
      case 'AWAITING_VERIFICATION':
        return 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300'
      case 'IN_PROGRESS':
        return 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300'
      case 'ACTION_REQUIRED':
        return 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300'
      case 'REJECTED':
        return 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300'
      case 'SENT':
      default:
        return 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-300'
    }
  }

  return 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-300'
})

const label = computed(() => {
  // Handle person-level verificationState
  if (props.verificationState !== undefined) {
    return getVerificationStateLabel(props.verificationState)
  }

  // Handle tenancy-level status
  if (props.status) {
    switch (props.status) {
      case 'SENT': return 'Sent'
      case 'IN_PROGRESS': return 'In Progress'
      case 'AWAITING_VERIFICATION': return 'Awaiting Verification'
      case 'ACTION_REQUIRED': return 'Action Required'
      case 'COMPLETED': return 'Completed'
      case 'REJECTED': return 'Rejected'
      default: return props.status
    }
  }

  // Return "Not Started" for null/undefined states (matches getVerificationStateLabel)
  return 'Not Started'
})
</script>

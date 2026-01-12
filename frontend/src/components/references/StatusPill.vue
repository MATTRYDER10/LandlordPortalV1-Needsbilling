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
      'green': 'bg-green-100 text-green-800',
      'blue': 'bg-blue-100 text-blue-800',
      'yellow': 'bg-yellow-100 text-yellow-800',
      'purple': 'bg-purple-100 text-purple-800',
      'orange': 'bg-orange-100 text-orange-800',
      'red': 'bg-red-100 text-red-800',
      'gray': 'bg-gray-100 text-gray-800'
    }
    return colorMap[color] || 'bg-gray-100 text-gray-800'
  }

  // Handle tenancy-level status
  if (props.status) {
    switch (props.status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'AWAITING_VERIFICATION':
        return 'bg-amber-100 text-amber-800'
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800'
      case 'ACTION_REQUIRED':
        return 'bg-red-100 text-red-800'
      case 'REJECTED':
        return 'bg-red-100 text-red-800'
      case 'SENT':
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return 'bg-gray-100 text-gray-800'
})

const label = computed(() => {
  // Handle person-level verificationState
  if (props.verificationState) {
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

  return 'Unknown'
})
</script>

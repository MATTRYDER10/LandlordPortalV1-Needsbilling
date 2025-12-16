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
import type { TenancyStatus, PersonStatus } from '@/composables/useTenancies'

const props = defineProps<{
  status: TenancyStatus | PersonStatus
}>()

const pillClasses = computed(() => {
  switch (props.status) {
    case 'COMPLETED':
    case 'VERIFIED_PASS':
      return 'bg-green-100 text-green-800'
    case 'VERIFIED_CONDITIONAL':
      return 'bg-green-100 text-green-700'
    case 'AWAITING_VERIFICATION':
      return 'bg-amber-100 text-amber-800'
    case 'IN_PROGRESS':
      return 'bg-blue-100 text-blue-800'
    case 'ACTION_REQUIRED':
      return 'bg-red-100 text-red-800'
    case 'REJECTED':
    case 'VERIFIED_FAIL':
      return 'bg-red-100 text-red-800'
    case 'SENT':
    case 'NOT_STARTED':
      return 'bg-gray-100 text-gray-800'
    case 'ARCHIVED':
      return 'bg-gray-200 text-gray-500'
    default:
      return 'bg-gray-100 text-gray-800'
  }
})

const label = computed(() => {
  switch (props.status) {
    case 'SENT': return 'Sent'
    case 'NOT_STARTED': return 'Not Started'
    case 'IN_PROGRESS': return 'In Progress'
    case 'AWAITING_VERIFICATION': return 'Awaiting Verification'
    case 'ACTION_REQUIRED': return 'Action Required'
    case 'VERIFIED_PASS': return 'Verified'
    case 'VERIFIED_CONDITIONAL': return 'Conditional'
    case 'VERIFIED_FAIL': return 'Failed'
    case 'COMPLETED': return 'Completed'
    case 'REJECTED': return 'Rejected'
    case 'ARCHIVED': return 'Archived'
    default: return props.status
  }
})
</script>

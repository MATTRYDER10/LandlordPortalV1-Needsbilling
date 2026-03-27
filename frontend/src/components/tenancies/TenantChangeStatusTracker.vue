<script setup lang="ts">
import { computed } from 'vue'
import { Users, Clock, CheckCircle, ChevronRight, FileSearch } from 'lucide-vue-next'

interface TenantChange {
  id: string
  stage: number
  status: 'in_progress' | 'completed' | 'cancelled'
  outgoing_tenant_ids: string[]
  incoming_tenants: any[]
  fee_received_at: string | null
  addendum_fully_signed_at: string | null
  completed_at: string | null
  incoming_tenant_reference_ids?: string[]
}

interface ReferenceStatus {
  id: string
  status: string
  tenantName: string
}

const props = withDefaults(defineProps<{
  tenantChange: TenantChange
  tenants?: { id: string; first_name: string; last_name: string }[]
  referenceStatuses?: ReferenceStatus[]
}>(), {
  tenants: () => [],
  referenceStatuses: () => []
})

const emit = defineEmits<{
  (e: 'continue'): void
}>()

const stageLabels = [
  'Tenant Details',
  'Referencing',
  'Fee & Date',
  'Addendum',
  'Signatures',
  'Complete',
  'Checklist'
]

const currentStageLabel = computed(() => {
  return stageLabels[props.tenantChange.stage - 1] || 'Unknown'
})

const outgoingNames = computed(() => {
  if (!props.tenants || !props.tenantChange.outgoing_tenant_ids) return ''
  return props.tenantChange.outgoing_tenant_ids
    .map(id => {
      const tenant = props.tenants.find(t => t.id === id)
      return tenant ? `${tenant.first_name} ${tenant.last_name}` : 'Unknown'
    })
    .join(', ')
})

const incomingNames = computed(() => {
  if (!props.tenantChange.incoming_tenants) return ''
  return props.tenantChange.incoming_tenants
    .map(t => `${t.firstName} ${t.lastName}`)
    .join(', ')
})

const statusColor = computed(() => {
  switch (props.tenantChange.status) {
    case 'completed': return 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
    case 'cancelled': return 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
    default: return 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400'
  }
})

const progressPercentage = computed(() => {
  return Math.round((props.tenantChange.stage / 7) * 100)
})

function formatRefStatus(status: string): string {
  const labels: Record<string, string> = {
    'SENT': 'Sent',
    'COLLECTING_EVIDENCE': 'Collecting',
    'IN_REVIEW': 'In Review',
    'READY_FOR_REVIEW': 'Ready for Review',
    'INDIVIDUAL_COMPLETE': 'Complete',
    'ACCEPTED': 'Accepted',
    'ACCEPTED_WITH_GUARANTOR': 'Accepted (Guarantor)',
    'ACCEPTED_ON_CONDITION': 'Conditional',
    'REJECTED': 'Rejected',
    'ACTION_REQUIRED': 'Action Required'
  }
  return labels[status] || status
}

function getRefStatusClass(status: string): string {
  if (['ACCEPTED', 'ACCEPTED_WITH_GUARANTOR', 'ACCEPTED_ON_CONDITION', 'INDIVIDUAL_COMPLETE'].includes(status)) {
    return 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
  }
  if (status === 'REJECTED') {
    return 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
  }
  if (['IN_REVIEW', 'READY_FOR_REVIEW'].includes(status)) {
    return 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400'
  }
  return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400'
}
</script>

<template>
  <div class="p-4 bg-orange-50 dark:bg-orange-900/30 rounded-lg border border-orange-200 dark:border-orange-800">
    <div class="flex items-start justify-between mb-3">
      <div class="flex items-center gap-2">
        <Users class="w-5 h-5 text-orange-600 dark:text-orange-400" />
        <h4 class="font-medium text-orange-900 dark:text-orange-100">Change of Tenant</h4>
      </div>
      <span
        class="px-2 py-0.5 text-xs font-medium rounded-full"
        :class="statusColor"
      >
        {{ tenantChange.status === 'in_progress' ? 'In Progress' : tenantChange.status }}
      </span>
    </div>

    <!-- Progress Bar -->
    <div class="mb-3">
      <div class="flex items-center justify-between text-xs text-orange-700 dark:text-orange-300 mb-1">
        <span>Stage {{ tenantChange.stage }} of 7: {{ currentStageLabel }}</span>
        <span>{{ progressPercentage }}%</span>
      </div>
      <div class="w-full bg-orange-200 dark:bg-orange-800 rounded-full h-1.5">
        <div
          class="bg-orange-600 h-1.5 rounded-full transition-all duration-300"
          :style="{ width: `${progressPercentage}%` }"
        ></div>
      </div>
    </div>

    <!-- Summary -->
    <div class="space-y-2 text-sm mb-3">
      <div class="flex items-start gap-2">
        <span class="text-orange-600 dark:text-orange-400 font-medium">Out:</span>
        <span class="text-orange-800 dark:text-orange-200">{{ outgoingNames || 'None selected' }}</span>
      </div>
      <div class="flex items-start gap-2">
        <span class="text-orange-600 dark:text-orange-400 font-medium">In:</span>
        <span class="text-orange-800 dark:text-orange-200">{{ incomingNames || 'None added' }}</span>
      </div>

      <!-- Incoming Tenant Reference Statuses -->
      <div v-if="referenceStatuses.length > 0" class="mt-1 space-y-1">
        <div
          v-for="ref in referenceStatuses"
          :key="ref.id"
          class="flex items-center gap-2"
        >
          <FileSearch class="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" />
          <span class="text-orange-800 dark:text-orange-200">{{ ref.tenantName }}</span>
          <span
            class="px-1.5 py-0.5 text-[10px] font-semibold rounded-full"
            :class="getRefStatusClass(ref.status)"
          >
            {{ formatRefStatus(ref.status) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Status Indicators -->
    <div class="flex flex-wrap gap-2 text-xs mb-3">
      <span
        v-if="tenantChange.fee_received_at"
        class="flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 rounded"
      >
        <CheckCircle class="w-3 h-3" />
        Fee Paid
      </span>
      <span
        v-else-if="tenantChange.stage >= 3"
        class="flex items-center gap-1 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400 rounded"
      >
        <Clock class="w-3 h-3" />
        Awaiting Payment
      </span>

      <span
        v-if="tenantChange.addendum_fully_signed_at"
        class="flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 rounded"
      >
        <CheckCircle class="w-3 h-3" />
        Fully Signed
      </span>
      <span
        v-else-if="tenantChange.stage >= 5"
        class="flex items-center gap-1 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400 rounded"
      >
        <Clock class="w-3 h-3" />
        Awaiting Signatures
      </span>
    </div>

    <!-- Continue Button -->
    <button
      v-if="tenantChange.status === 'in_progress'"
      @click="emit('continue')"
      class="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-1 transition-colors"
    >
      Continue Process
      <ChevronRight class="w-4 h-4" />
    </button>

    <button
      v-else-if="tenantChange.status === 'completed'"
      @click="emit('continue')"
      class="w-full py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-1 transition-colors"
    >
      View Checklist
      <ChevronRight class="w-4 h-4" />
    </button>
  </div>
</template>

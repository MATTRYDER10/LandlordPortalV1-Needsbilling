<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">Review & Generate</h3>
      <p class="text-sm text-gray-500 dark:text-slate-400">Review all details before generating the notice.</p>
    </div>

    <!-- Tenant & Property -->
    <ReviewSection title="Tenant & Property" @edit="emit('editStep', 1)">
      <div class="grid md:grid-cols-2 gap-4">
        <div>
          <p class="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Tenant(s)</p>
          <p class="font-medium text-gray-900 dark:text-white">{{ tenantNamesDisplay }}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Property Address</p>
          <p class="font-medium text-gray-900 dark:text-white">{{ propertyAddressDisplay }}</p>
        </div>
      </div>
    </ReviewSection>

    <!-- Landlord -->
    <ReviewSection title="Landlord" @edit="emit('editStep', 2)">
      <div class="grid md:grid-cols-2 gap-4">
        <div>
          <p class="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Landlord(s)</p>
          <p class="font-medium text-gray-900 dark:text-white">{{ landlordNamesDisplay }}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Landlord Address</p>
          <p class="font-medium text-gray-900 dark:text-white">{{ landlordAddressDisplay }}</p>
        </div>
        <div v-if="formState.servedByAgent">
          <p class="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Serving Agent</p>
          <p class="font-medium text-gray-900 dark:text-white">{{ formState.agentName }}</p>
        </div>
      </div>
    </ReviewSection>

    <!-- Tenancy Details -->
    <ReviewSection title="Tenancy Details" @edit="emit('editStep', 3)">
      <div class="grid md:grid-cols-3 gap-4">
        <div>
          <p class="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Start Date</p>
          <p class="font-medium text-gray-900 dark:text-white">{{ formatDate(formState.tenancyStartDate) }}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Rent</p>
          <p class="font-medium text-gray-900 dark:text-white">£{{ formState.rentAmount?.toLocaleString() }} {{ rentFrequencyLabel }}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Rent Due</p>
          <p class="font-medium text-gray-900 dark:text-white">{{ formState.rentDueDay }}</p>
        </div>
      </div>
    </ReviewSection>

    <!-- Grounds -->
    <ReviewSection title="Grounds for Possession" @edit="emit('editStep', 4)">
      <div class="flex flex-wrap gap-2">
        <span
          v-for="groundId in formState.selectedGroundIds"
          :key="groundId"
          class="px-3 py-1.5 rounded-lg text-sm font-medium"
          :class="getGround(groundId)?.type === 'mandatory'
            ? 'bg-red-100 text-red-700'
            : 'bg-amber-100 text-amber-700'"
        >
          {{ getGround(groundId)?.number }} — {{ getGround(groundId)?.title }}
        </span>
      </div>
    </ReviewSection>

    <!-- Arrears (if applicable) -->
    <ReviewSection v-if="showArrearsSection" title="Arrears Summary" @edit="emit('editStep', 5)">
      <div class="space-y-2">
        <div class="flex justify-between items-center">
          <span class="text-gray-600 dark:text-slate-400">Total Arrears:</span>
          <span class="text-lg font-bold text-red-600">£{{ totalArrears.toFixed(2) }}</span>
        </div>
        <div class="text-sm text-gray-500 dark:text-slate-400">
          {{ formState.arrearsRows.length }} rent period(s) documented
        </div>
        <div v-if="latePaymentCount > 0" class="text-sm text-amber-600 dark:text-amber-400">
          {{ latePaymentCount }} late payment{{ latePaymentCount > 1 ? 's' : '' }} identified
        </div>
      </div>
    </ReviewSection>

    <!-- Ground Explanations (collapsed) -->
    <ReviewSection title="Ground Explanations" @edit="emit('editStep', showArrearsSection ? 6 : 5)">
      <div class="space-y-3">
        <div v-for="groundId in formState.selectedGroundIds" :key="groundId">
          <p class="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            {{ getGround(groundId)?.number }}
          </p>
          <p class="text-sm text-gray-700 dark:text-slate-300 line-clamp-2">
            {{ formState.groundExplanations[groundId] || '(No explanation provided)' }}
          </p>
        </div>
      </div>
    </ReviewSection>

    <!-- Service Details -->
    <ReviewSection title="Service Details" @edit="emit('editStep', showArrearsSection ? 7 : 6)">
      <div class="grid md:grid-cols-2 gap-4">
        <div>
          <p class="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Service Date</p>
          <p class="font-medium text-gray-900 dark:text-white">{{ formatDate(formState.serviceDate) }}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Service Method</p>
          <p class="font-medium text-gray-900 dark:text-white">{{ serviceMethodLabel }}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Signatory</p>
          <p class="font-medium text-gray-900 dark:text-white">{{ formState.signatoryName }}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Capacity</p>
          <p class="font-medium text-gray-900 dark:text-white">{{ signatoryCapacityLabel }}</p>
        </div>
      </div>
    </ReviewSection>

    <!-- Earliest Court Date (prominent) -->
    <div class="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
          <Calendar class="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <p class="text-sm font-medium text-blue-700 dark:text-blue-400">Earliest Court Date</p>
          <p class="text-xl font-bold text-blue-900 dark:text-blue-200">{{ formatDate(formState.earliestCourtDate || '') }}</p>
        </div>
      </div>
      <p v-if="formState.noticeExplanation" class="text-sm text-blue-700 dark:text-blue-300">
        {{ formState.noticeExplanation }}
      </p>
    </div>

    <!-- Disclaimer -->
    <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
      <div class="flex gap-3">
        <AlertTriangle class="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <div class="text-sm text-amber-800 dark:text-amber-300">
          <p class="font-medium dark:text-amber-200">Important Disclaimer</p>
          <p class="mt-1">
            This notice is generated for your convenience. It does not constitute legal advice.
            Ensure all details are accurate and consider having this reviewed by a solicitor before serving.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Calendar, AlertTriangle } from 'lucide-vue-next'
import ReviewSection from './ReviewSection.vue'
import type { S8FormState, S8Ground } from '@/types/section8'
import { ARREARS_GROUNDS } from '@/types/section8'

interface Props {
  formState: S8FormState
  grounds: S8Ground[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  editStep: [step: number]
}>()

const tenantNamesDisplay = computed(() =>
  props.formState.tenantNames.filter(n => n.trim()).join(', ')
)

const propertyAddressDisplay = computed(() => {
  const addr = props.formState.propertyAddress
  const parts = [addr.line1, addr.line2, addr.town, addr.county, addr.postcode].filter(Boolean)
  return parts.join(', ')
})

const landlordNamesDisplay = computed(() =>
  props.formState.landlordNames.filter(n => n.trim()).join(', ')
)

const landlordAddressDisplay = computed(() => {
  const addr = props.formState.landlordAddress
  const parts = [addr.line1, addr.line2, addr.town, addr.county, addr.postcode].filter(Boolean)
  return parts.join(', ')
})

const rentFrequencyLabel = computed(() => {
  const labels: Record<string, string> = {
    weekly: 'per week',
    fortnightly: 'per fortnight',
    monthly: 'per month',
    quarterly: 'per quarter',
    yearly: 'per year',
  }
  return labels[props.formState.rentFrequency || ''] || ''
})

const showArrearsSection = computed(() =>
  props.formState.selectedGroundIds.some(id => ARREARS_GROUNDS.includes(id))
)

const totalArrears = computed(() =>
  props.formState.arrearsRows.reduce((sum, row) => sum + row.balance, 0)
)

const latePaymentCount = computed(() =>
  props.formState.arrearsRows.filter(row => {
    if (!row.dueDate || !row.paidDate) return false
    return new Date(row.paidDate) > new Date(row.dueDate)
  }).length
)

const serviceMethodLabel = computed(() => {
  const labels: Record<string, string> = {
    email: 'Email',
    first_class_post: 'First Class Post',
    personal_service: 'Personal Service',
    email_and_post: 'Email and Post',
  }
  return labels[props.formState.serviceMethod || ''] || ''
})

const signatoryCapacityLabel = computed(() => {
  const labels: Record<string, string> = {
    landlord: 'Landlord',
    agent: 'Agent for the Landlord',
    joint_landlord: 'Joint Landlord',
  }
  return labels[props.formState.signatoryCapacity || ''] || ''
})

function getGround(id: string): S8Ground | undefined {
  return props.grounds.find(g => g.id === id)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
</script>

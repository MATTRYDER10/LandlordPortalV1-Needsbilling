<template>
  <div
    class="bg-white rounded-xl shadow-sm border border-gray-200 mb-4 hover:shadow-md transition-shadow relative"
    :class="{ 'ring-2 ring-orange-300': tenancy.urgentReverify }"
  >
    <!-- Collapsed View -->
    <div
      class="px-6 py-4 cursor-pointer"
      @click="$emit('toggle')"
    >
      <!-- Line 1: Property address and Move-in date -->
      <div class="flex justify-between items-start">
        <div class="flex-1 min-w-0">
          <h3 class="text-sm font-medium text-gray-900 truncate">
            {{ tenancy.propertyAddress }}
          </h3>
          <p class="text-xs text-gray-500">
            {{ tenancy.propertyCity }}{{ tenancy.propertyPostcode ? `, ${tenancy.propertyPostcode}` : '' }}
          </p>
        </div>
        <div class="ml-4 flex-shrink-0 flex items-center gap-2">
          <span class="text-sm text-gray-500">
            {{ formatDate(tenancy.moveInDate) }}
          </span>
          <button
            @click.stop="$emit('changeMoveInDate', tenancy)"
            class="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
            title="Change move-in date"
          >
            <Pencil class="w-3.5 h-3.5" />
          </button>
          <ChevronDown
            class="w-5 h-5 text-gray-400 transition-transform duration-200"
            :class="{ 'rotate-180': isExpanded }"
          />
        </div>
      </div>

      <!-- Line 2: Status pill, email warning, and URGENT tag -->
      <div class="mt-2 flex items-center gap-2">
        <StatusPill :status="tenancy.tenancyStatus" />
        <!-- Email delivery issue warning -->
        <span
          v-if="hasEmailIssue"
          class="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800 flex items-center gap-1"
          :title="emailIssueTooltip"
        >
          <MailWarning class="w-3 h-3" />
          {{ emailIssueBadgeText }}
        </span>
        <span
          v-if="tenancy.urgentReverify"
          class="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800"
        >
          URGENT
        </span>
      </div>

      <!-- Line 3: Blocking sentence -->
      <p v-if="tenancy.blockingSentence" class="mt-2 text-sm text-gray-600 truncate">
        {{ tenancy.blockingSentence }}
      </p>

      <!-- Line 4: Progress summary -->
      <div class="mt-2 flex items-center gap-4">
        <span class="text-xs text-gray-500">
          Tenants: {{ tenancy.progressSummary.tenantsVerified }}/{{ tenancy.progressSummary.tenantsTotal }}
        </span>
        <span v-if="tenancy.progressSummary.guarantorsTotal > 0" class="text-xs text-gray-500">
          Guarantors: {{ tenancy.progressSummary.guarantorsVerified }}/{{ tenancy.progressSummary.guarantorsTotal }}
        </span>
        <ProgressChips :failures="tenancy.progressSummary.checkFailures" />
      </div>

    </div>

    <!-- Expanded View -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 max-h-0"
      enter-to-class="opacity-100 max-h-[2000px]"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 max-h-[2000px]"
      leave-to-class="opacity-0 max-h-0"
    >
      <div v-if="isExpanded" class="px-6 pb-4 overflow-hidden">
        <!-- Action Required Banner -->
        <div
          v-if="tenancy.tenancyStatus === 'ACTION_REQUIRED'"
          class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg"
        >
          <div class="flex items-start gap-3">
            <AlertTriangle class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div class="flex-1">
              <h4 class="text-sm font-medium text-red-800">Action Required</h4>
              <p class="mt-1 text-sm text-red-700">
                {{ getActionRequiredSummary() }}
              </p>
            </div>
          </div>
        </div>

        <!-- People cards -->
        <div class="space-y-2">
          <template v-for="person in sortedPeople" :key="person.id">
            <PersonCard
              :person="person"
              :isGuarantor="person.role === 'GUARANTOR'"
              @open="$emit('openPerson', person)"
              @chase="$emit('chase', person)"
            />
          </template>
        </div>

        <!-- Add Guarantor (for each tenant without one, if not completed) -->
        <div v-if="canAddGuarantor" class="mt-3">
          <button
            @click="$emit('addGuarantor')"
            class="text-sm text-primary hover:text-primary/80 font-medium"
          >
            + Add Guarantor
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Tenancy, TenancyPerson } from '@/composables/useTenancies'
import StatusPill from './StatusPill.vue'
import ProgressChips from './ProgressChips.vue'
import PersonCard from './PersonCard.vue'
import { ChevronDown, AlertTriangle, MailWarning, Pencil } from 'lucide-vue-next'

const props = defineProps<{
  tenancy: Tenancy
  isExpanded: boolean
}>()

defineEmits<{
  toggle: []
  openPerson: [person: TenancyPerson]
  chase: [person: TenancyPerson]
  addGuarantor: []
  changeMoveInDate: [tenancy: Tenancy]
}>()

// Sort people: tenants first, then their guarantors underneath
const sortedPeople = computed(() => {
  const tenants = props.tenancy.people.filter(p => p.role === 'TENANT')
  const result: TenancyPerson[] = []

  for (const tenant of tenants) {
    result.push(tenant)
    // Find guarantors for this tenant
    const guarantors = props.tenancy.people.filter(
      p => p.role === 'GUARANTOR' && p.guarantorForTenantId === tenant.id
    )
    result.push(...guarantors)
  }

  return result
})

const canAddGuarantor = computed(() => {
  return props.tenancy.tenancyStatus !== 'COMPLETED' &&
         props.tenancy.tenancyStatus !== 'REJECTED'
})

// Check if any person has email delivery issues
const hasEmailIssue = computed(() => {
  return props.tenancy.people.some(p => p.emailDeliveryIssue)
})

const emailIssueTooltip = computed(() => {
  const person = props.tenancy.people.find(p => p.emailDeliveryIssue)
  if (!person?.emailDeliveryIssue) return ''
  const refType = person.emailDeliveryIssue.referenceType
  const type = person.emailDeliveryIssue.type
  const contactLabel = getContactLabel(refType)
  return type === 'bounced'
    ? `${contactLabel} email for ${person.name} bounced - check email address`
    : `${contactLabel} email for ${person.name} marked as spam`
})

const emailIssueBadgeText = computed(() => {
  const person = props.tenancy.people.find(p => p.emailDeliveryIssue)
  if (!person?.emailDeliveryIssue) return ''
  const refType = person.emailDeliveryIssue.referenceType
  const type = person.emailDeliveryIssue.type
  const label = getContactLabel(refType).toUpperCase()
  return type === 'bounced' ? `${label} BOUNCED` : `${label} SPAM`
})

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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Not set'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

function getActionRequiredSummary(): string {
  const actionPeople = props.tenancy.people.filter(p => p.verificationState === 'ACTION_REQUIRED')
  if (actionPeople.length === 0) return ''

  const names = actionPeople.map(p => p.name).join(', ')
  const tasks = actionPeople.flatMap(p => p.actionRequiredTasks)
  const sections = [...new Set(tasks.map(t => t.sectionType))]

  return `${names} - ${sections.join(', ')}`
}
</script>

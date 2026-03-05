<template>
  <div
    class="reference-row group relative bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer transition-all duration-300 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 mb-4"
    :class="{
      'ring-2 ring-orange-300 dark:ring-orange-500/50': tenancy.urgentReverify,
      'ring-2 ring-primary/20': isHovered && !tenancy.urgentReverify
    }"
    @click="$emit('toggle')"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Accent stripe - orange for references -->
    <div class="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 via-orange-400 to-primary opacity-80 rounded-l-xl" />

    <div class="pl-4 pr-5 py-4">
      <!-- Main Row Content -->
      <div class="flex items-start gap-4">
        <!-- Date Badge -->
        <div class="flex-shrink-0 w-[68px] text-center">
          <div class="bg-slate-900 dark:bg-slate-700 text-white rounded-lg px-2.5 py-2 shadow-sm">
            <div class="text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-medium">{{ moveInMonth }}</div>
            <div class="text-xl font-bold leading-tight">{{ moveInDay }}</div>
          </div>
        </div>

        <!-- Reference Label + Address & Tenant Info -->
        <div class="flex-1 min-w-0">
          <!-- Reference Badge + Single Status -->
          <div class="flex items-center gap-2 mb-1">
            <span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 rounded">
              Reference
            </span>
            <!-- Single simplified status -->
            <span
              class="px-2 py-0.5 text-xs font-medium rounded-full"
              :class="mainStatusClasses"
            >
              {{ mainStatusLabel }}
            </span>
            <!-- Email delivery issue warning -->
            <span
              v-if="hasEmailIssue"
              class="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 flex items-center gap-1"
              :title="emailIssueTooltip"
            >
              <MailWarning class="w-3 h-3" />
              {{ emailIssueBadgeText }}
            </span>
            <span
              v-if="tenancy.urgentReverify"
              class="px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300"
            >
              URGENT
            </span>
          </div>

          <!-- Address -->
          <h3 class="text-base font-semibold text-slate-900 dark:text-white truncate leading-tight">
            {{ tenancy.propertyAddress }}
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {{ tenancy.propertyCity }}{{ tenancy.propertyPostcode ? `, ${tenancy.propertyPostcode}` : '' }}
          </p>

          <!-- Tenants -->
          <div class="flex items-center gap-1.5 mt-2">
            <div class="flex -space-x-1.5">
              <div
                v-for="(person, idx) in displayPeople"
                :key="person.id"
                class="w-6 h-6 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center text-[9px] font-bold shadow-sm"
                :class="person.role === 'GUARANTOR'
                  ? 'bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-800 dark:to-orange-700 text-orange-600 dark:text-orange-200'
                  : 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 text-slate-600 dark:text-slate-300'"
                :style="{ zIndex: displayPeople.length - idx }"
                :title="`${person.name}${person.role === 'GUARANTOR' ? ' (Guarantor)' : ''}`"
              >
                {{ getInitials(person.name) }}
              </div>
              <div
                v-if="extraPeopleCount > 0"
                class="w-6 h-6 rounded-full bg-slate-800 dark:bg-slate-600 border-2 border-white dark:border-slate-800 flex items-center justify-center text-[9px] font-bold text-white shadow-sm"
              >
                +{{ extraPeopleCount }}
              </div>
            </div>
            <span class="text-xs text-slate-600 dark:text-slate-400 truncate">{{ tenantNames }}</span>
          </div>
        </div>

        <!-- Progress Indicators - Verification Sections (Circular) -->
        <div class="flex-shrink-0 flex items-center gap-1">
          <ReferenceProgressIndicator
            :completed="sectionStatuses.identity"
            label="ID & Selfie"
            icon="user"
          />
          <ReferenceProgressIndicator
            :completed="sectionStatuses.income"
            label="Income"
            icon="wallet"
          />
          <ReferenceProgressIndicator
            :completed="sectionStatuses.residential"
            label="Landlord Ref"
            icon="home"
          />
          <ReferenceProgressIndicator
            :completed="sectionStatuses.credit"
            label="Credit"
            icon="credit-card"
          />
          <ReferenceProgressIndicator
            :completed="sectionStatuses.rtr"
            label="Right to Rent"
            icon="shield"
          />
        </div>

        <!-- Action Buttons -->
        <div class="flex-shrink-0 flex items-center gap-2">
          <button
            @click.stop="$emit('convertToTenancy', tenancy)"
            class="px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
            title="Convert to active tenancy"
          >
            <ArrowRightCircle class="w-4 h-4" />
            Convert to Tenancy
          </button>
        </div>

        <!-- Expand Arrow -->
        <div class="flex-shrink-0 flex items-center">
          <div class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:bg-primary group-hover:text-white transition-all duration-300">
            <ChevronDown
              class="w-4 h-4 transition-transform duration-200"
              :class="{ 'rotate-180': isExpanded }"
            />
          </div>
        </div>
      </div>

      <!-- Bottom Progress Bar -->
      <div class="mt-3 flex items-center gap-2.5">
        <div class="flex-1 h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            class="h-full bg-gradient-to-r from-amber-400 via-orange-400 to-primary rounded-full transition-all duration-500 ease-out"
            :style="{ width: `${progressPercentage}%` }"
          />
        </div>
        <span class="text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
          {{ tenancy.progressSummary.tenantsVerified }}/{{ tenancy.progressSummary.tenantsTotal }} verified
        </span>
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
      <div v-if="isExpanded" class="px-6 pb-4 overflow-hidden border-t border-slate-100 dark:border-slate-700">
        <!-- Action Required Banner -->
        <div
          v-if="tenancy.tenancyStatus === 'ACTION_REQUIRED'"
          class="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
        >
          <div class="flex items-start gap-3">
            <AlertTriangle class="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div class="flex-1">
              <h4 class="text-sm font-medium text-red-800 dark:text-red-300">Action Required</h4>
              <p class="mt-1 text-sm text-red-700 dark:text-red-400">
                {{ getActionRequiredSummary() }}
              </p>
            </div>
          </div>
        </div>

        <!-- Expanded Actions Row -->
        <div class="mt-4 flex items-center gap-3 flex-wrap">
          <button
            @click.stop="$emit('changeMoveInDate', tenancy)"
            class="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 rounded-md flex items-center gap-1.5 transition-colors"
          >
            <Pencil class="w-3.5 h-3.5" />
            Change Move-in Date
          </button>
          <button
            v-if="canAddGuarantor"
            @click.stop="$emit('addGuarantor')"
            class="px-3 py-1.5 text-xs font-medium text-primary hover:text-primary/80 bg-primary/5 dark:bg-primary/10 hover:bg-primary/10 dark:hover:bg-primary/20 rounded-md flex items-center gap-1.5 transition-colors"
          >
            <UserPlus class="w-3.5 h-3.5" />
            Add Guarantor
          </button>
        </div>

        <!-- People cards -->
        <div class="mt-4 space-y-2">
          <template v-for="person in sortedPeople" :key="person.id">
            <PersonCard
              :person="person"
              :isGuarantor="person.role === 'GUARANTOR'"
              @open="$emit('openPerson', person)"
              @chase="$emit('chase', person)"
            />
          </template>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Tenancy, TenancyPerson } from '@/composables/useTenancies'
import PersonCard from './PersonCard.vue'
import ReferenceProgressIndicator from './ReferenceProgressIndicator.vue'
import { ChevronDown, AlertTriangle, MailWarning, Pencil, ArrowRightCircle, UserPlus } from 'lucide-vue-next'

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
  convertToTenancy: [tenancy: Tenancy]
}>()

const isHovered = ref(false)

// Simplified main status - only shows ONE status
const mainStatusLabel = computed(() => {
  const status = props.tenancy.tenancyStatus
  switch (status) {
    case 'COMPLETED': return 'Verified'
    case 'REJECTED': return 'Failed'
    case 'ACTION_REQUIRED': return 'Action Required'
    case 'IN_PROGRESS':
    case 'COLLECTING_EVIDENCE':
    case 'SENT':
      return 'In Progress'
    case 'AWAITING_VERIFICATION':
      return 'Awaiting Review'
    default:
      return 'In Progress'
  }
})

const mainStatusClasses = computed(() => {
  const status = props.tenancy.tenancyStatus
  switch (status) {
    case 'COMPLETED':
      return 'bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100'
    case 'REJECTED':
      return 'bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-100'
    case 'ACTION_REQUIRED':
      return 'bg-orange-100 dark:bg-orange-800 text-orange-800 dark:text-orange-100'
    default:
      return 'bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100'
  }
})

// Date computations
const moveInDate = computed(() => {
  return props.tenancy.moveInDate ? new Date(props.tenancy.moveInDate) : null
})

const moveInDay = computed(() => {
  return moveInDate.value ? moveInDate.value.getDate() : '--'
})

const moveInMonth = computed(() => {
  return moveInDate.value
    ? moveInDate.value.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()
    : '---'
})

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

// Display up to 3 people avatars
const displayPeople = computed(() => {
  return props.tenancy.people.slice(0, 3)
})

const extraPeopleCount = computed(() => {
  return Math.max(0, props.tenancy.people.length - 3)
})

// Get tenant names for display
const tenantNames = computed(() => {
  const tenants = props.tenancy.people.filter(p => p.role === 'TENANT')
  if (tenants.length === 0) return 'No tenants'
  if (tenants.length === 1) return tenants[0]?.name || ''
  if (tenants.length === 2) return `${tenants[0]?.name || ''} & ${tenants[1]?.name || ''}`
  return `${tenants[0]?.name || ''} + ${tenants.length - 1} others`
})

// Get initials from name
function getInitials(name: string): string {
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return `${parts[0]?.[0] || ''}${parts[parts.length - 1]?.[0] || ''}`
  }
  return name.substring(0, 2).toUpperCase()
}

// Compute section statuses from people's sectionStatuses
const sectionStatuses = computed(() => {
  // Check if any person has completed each section type
  const statuses = {
    identity: false,
    income: false,
    residential: false,
    credit: false,
    rtr: false
  }

  // For simplicity, check the first tenant's sections
  const firstTenant = props.tenancy.people.find(p => p.role === 'TENANT')
  if (firstTenant?.sectionStatuses) {
    for (const section of firstTenant.sectionStatuses) {
      if (section.decision === 'PASS' || section.decision === 'PASS_WITH_CONDITION') {
        if (section.type === 'IDENTITY_SELFIE') statuses.identity = true
        if (section.type === 'INCOME' || section.type === 'EMPLOYER_REFERENCE') statuses.income = true
        if (section.type === 'RESIDENTIAL' || section.type === 'LANDLORD_REFERENCE') statuses.residential = true
        if (section.type === 'CREDIT') statuses.credit = true
        if (section.type === 'RTR') statuses.rtr = true
      }
    }
  }

  // Also check overall verification state
  if (firstTenant?.verificationState === 'COMPLETED') {
    return { identity: true, income: true, residential: true, credit: true, rtr: true }
  }

  return statuses
})

// Progress percentage based on verification
const progressPercentage = computed(() => {
  const { tenantsVerified, tenantsTotal } = props.tenancy.progressSummary
  if (tenantsTotal === 0) return 0
  return Math.round((tenantsVerified / tenantsTotal) * 100)
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

function getActionRequiredSummary(): string {
  const actionPeople = props.tenancy.people.filter(p => p.verificationState === 'ACTION_REQUIRED')
  if (actionPeople.length === 0) return ''

  const names = actionPeople.map(p => p.name).join(', ')
  const tasks = actionPeople.flatMap(p => p.actionRequiredTasks)
  const sections = [...new Set(tasks.map(t => formatSectionType(t.sectionType)))]

  return `${names} - ${sections.join(', ')}`
}

function formatSectionType(type: string): string {
  const labels: Record<string, string> = {
    'IDENTITY_SELFIE': 'ID & Selfie',
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
  if (labels[type]) return labels[type]
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}
</script>

<style scoped>
.reference-row {
  will-change: transform, box-shadow;
}
</style>

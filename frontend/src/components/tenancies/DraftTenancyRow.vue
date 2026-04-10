<template>
  <div
    class="tenancy-row group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer transition-all duration-300 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50"
    :class="{ 'ring-2 ring-primary/20': isHovered }"
    @click="$emit('click', tenancy)"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Accent stripe -->
    <div class="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 via-orange-400 to-primary opacity-80 rounded-l-xl" />

    <div class="pl-4 pr-5 py-4">
      <!-- Main Row Content -->
      <div class="flex items-start gap-5">
        <!-- Date Badge -->
        <div class="flex-shrink-0 w-[68px] text-center">
          <div class="bg-slate-900 dark:bg-slate-800 text-white rounded-lg px-2.5 py-2 shadow-sm">
            <div class="text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-medium">{{ moveInMonth }}</div>
            <div class="text-xl font-bold leading-tight">{{ moveInDay }}</div>
          </div>
        </div>

        <!-- Address & Tenant Info -->
        <div class="flex-1 min-w-0">
          <h3 class="text-base font-semibold text-slate-900 dark:text-white truncate leading-tight">
            {{ [tenancy.property?.address_line1, tenancy.property?.address_line2].filter(Boolean).join(', ') || 'Unknown Address' }}
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {{ tenancy.property?.city }}{{ tenancy.property?.postcode ? `, ${tenancy.property.postcode}` : '' }}
          </p>

          <!-- Tenants -->
          <div class="flex items-center gap-1.5 mt-2.5">
            <div class="flex -space-x-1.5">
              <div
                v-for="(tenant, idx) in displayTenants"
                :key="tenant.id"
                class="w-6 h-6 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[9px] font-bold text-slate-600 dark:text-slate-300 shadow-sm"
                :style="{ zIndex: displayTenants.length - idx }"
                :title="`${tenant.first_name} ${tenant.last_name}`"
              >
                {{ tenant.first_name?.[0] }}{{ tenant.last_name?.[0] }}
              </div>
              <div
                v-if="extraTenantCount > 0"
                class="w-6 h-6 rounded-full bg-slate-800 dark:bg-slate-600 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[9px] font-bold text-white shadow-sm"
              >
                +{{ extraTenantCount }}
              </div>
            </div>
            <span class="text-xs text-slate-600 dark:text-slate-400 truncate">{{ tenantNames }}</span>
          </div>
        </div>

        <!-- Progress Checklist -->
        <div class="flex-shrink-0 flex items-center gap-1">
          <ProgressIndicator
            :completed="hasAgreement"
            label="Agreement"
            icon="file-text"
          />
          <ProgressIndicator
            :completed="agreementSigned"
            label="Signed"
            icon="pen-tool"
          />
          <ProgressIndicator
            :completed="moveInPackSent"
            label="Move-in Pack"
            icon="package"
          />
          <ProgressIndicator
            :completed="initialMoniesPaid"
            label="Monies Paid"
            icon="credit-card"
          />
          <ProgressIndicator
            :completed="moveInTimeConfirmed"
            label="Time Confirmed"
            icon="clock"
          />
        </div>

        <!-- Action Arrow -->
        <div class="flex-shrink-0 flex items-center">
          <div class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:bg-primary group-hover:text-white transition-all duration-300">
            <ChevronRight class="w-4 h-4" />
          </div>
        </div>
      </div>

      <!-- Bottom Progress Bar -->
      <div class="mt-3 flex items-center gap-2.5">
        <div class="flex-1 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            class="h-full bg-gradient-to-r from-amber-400 via-orange-400 to-primary rounded-full transition-all duration-500 ease-out"
            :style="{ width: `${progressPercentage}%` }"
          />
        </div>
        <span class="text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">{{ completedSteps }}/5</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import ProgressIndicator from './ProgressIndicator.vue'

interface TenancyTenant {
  id: string
  first_name: string
  last_name: string
  is_lead_tenant: boolean
  status: string
}

interface Tenancy {
  id: string
  status: string
  tenancy_start_date?: string
  start_date?: string
  monthly_rent?: number
  rent_amount?: number
  property?: {
    address_line1: string
    city: string
    postcode: string
  }
  tenants?: TenancyTenant[]
  // Progress fields
  agreement_id?: string
  signing_status?: string
  compliance_pack_sent_at?: string | null
  initial_monies_paid_at?: string | null
  move_in_time_confirmed?: string | null
  move_in_time_requested_at?: string | null
  move_in_time_submitted_at?: string | null
  initial_monies_requested_at?: string | null
}

const props = defineProps<{
  tenancy: Tenancy
}>()

defineEmits<{
  click: [tenancy: Tenancy]
}>()

const isHovered = ref(false)

// Date computations
const moveInDate = computed(() => {
  const dateStr = props.tenancy.tenancy_start_date || props.tenancy.start_date
  return dateStr ? new Date(dateStr) : null
})

const moveInDay = computed(() => {
  return moveInDate.value ? moveInDate.value.getDate() : '--'
})

const moveInMonth = computed(() => {
  return moveInDate.value
    ? moveInDate.value.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()
    : '---'
})

// Tenant display
const activeTenants = computed(() => {
  return props.tenancy.tenants?.filter(t => t.status === 'active') || []
})

const displayTenants = computed(() => {
  return activeTenants.value.slice(0, 3)
})

const extraTenantCount = computed(() => {
  return Math.max(0, activeTenants.value.length - 3)
})

const tenantNames = computed(() => {
  if (activeTenants.value.length === 0) return 'No tenants assigned'

  const sorted = [...activeTenants.value].sort((a, b) => {
    if (a.is_lead_tenant && !b.is_lead_tenant) return -1
    if (!a.is_lead_tenant && b.is_lead_tenant) return 1
    return 0
  })

  if (sorted.length <= 2) {
    return sorted.map(t => `${t.first_name} ${t.last_name}`).join(' & ')
  }

  const first = sorted[0]
  if (!first) return 'No tenants assigned'
  return `${first.first_name} ${first.last_name} + ${sorted.length - 1} others`
})

// Progress tracking
const hasAgreement = computed(() => !!(props.tenancy as any).agreement_id)
const agreementSigned = computed(() => (props.tenancy as any).signing_status === 'executed')
const moveInPackSent = computed(() => !!(props.tenancy as any).compliance_pack_sent_at)
const initialMoniesPaid = computed(() => !!(props.tenancy as any).initial_monies_paid_at)
const moveInTimeConfirmed = computed(() => !!(props.tenancy as any).move_in_time_confirmed)

const completedSteps = computed(() => {
  return [hasAgreement.value, agreementSigned.value, moveInPackSent.value, initialMoniesPaid.value, moveInTimeConfirmed.value]
    .filter(Boolean).length
})

const progressPercentage = computed(() => {
  return (completedSteps.value / 5) * 100
})
</script>

<style scoped>
.tenancy-row {
  will-change: transform, box-shadow;
}
</style>

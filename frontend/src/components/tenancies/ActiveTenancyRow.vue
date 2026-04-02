<template>
  <div
    class="tenancy-row group relative bg-white dark:bg-slate-900 border rounded-xl cursor-pointer transition-all duration-300"
    :class="rowHoverClass"
    @click="$emit('click', tenancy)"
  >
    <!-- Active accent stripe -->
    <div
      class="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
      :class="accentStripeClass"
    />

    <div class="pl-4 pr-5 py-4">
      <div class="flex items-start gap-5">
        <!-- Status Badge -->
        <div class="flex-shrink-0 w-[68px] text-center">
          <div
            class="rounded-lg px-2.5 py-2 shadow-sm"
            :class="statusBadgeClass"
          >
            <div
              class="text-[9px] uppercase tracking-widest font-medium"
              :class="statusLabelClass"
            >
              {{ statusBadgeLabel }}
            </div>
            <div class="text-xs font-bold leading-tight mt-0.5">{{ formatShortDate(displayDate) }}</div>
          </div>
        </div>

        <!-- Address & Tenant Info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h3 class="text-base font-semibold text-slate-900 dark:text-white truncate leading-tight">
                {{ tenancy.property?.address_line1 || 'Unknown Address' }}
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {{ tenancy.property?.city }}{{ tenancy.property?.postcode ? `, ${tenancy.property.postcode}` : '' }}
              </p>
            </div>

            <!-- Rent Display -->
            <div class="flex-shrink-0 text-right">
              <p class="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium">Monthly Rent</p>
              <p class="text-lg font-bold text-slate-900 dark:text-white tabular-nums">&pound;{{ rentAmount?.toLocaleString() || '0' }}</p>
            </div>
          </div>

          <!-- Tenants -->
          <div class="flex items-center gap-1.5 mt-2.5">
            <div class="flex -space-x-1.5">
              <div
                v-for="(tenant, idx) in displayTenants"
                :key="tenant.id"
                class="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-[9px] font-bold shadow-sm"
                :class="isNoticeServed
                  ? 'bg-gradient-to-br from-rose-100 to-red-100 dark:from-rose-900 dark:to-red-900 text-rose-700 dark:text-rose-400'
                  : 'bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900 dark:to-teal-900 text-emerald-700 dark:text-emerald-400'"
                :style="{ zIndex: displayTenants.length - idx }"
                :title="`${tenant.first_name} ${tenant.last_name}`"
              >
                {{ tenant.first_name?.[0] }}{{ tenant.last_name?.[0] }}
              </div>
              <div
                v-if="extraTenantCount > 0"
                class="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-[9px] font-bold text-white shadow-sm"
                :class="isNoticeServed ? 'bg-rose-600' : 'bg-emerald-600'"
              >
                +{{ extraTenantCount }}
              </div>
            </div>
            <span class="text-xs text-slate-600 dark:text-slate-400 truncate">{{ tenantNames }}</span>
          </div>
        </div>

        <!-- Quick Actions Menu -->
        <div class="flex-shrink-0 flex items-center gap-1.5">
          <!-- Actions Dropdown -->
          <div class="relative">
            <button
              ref="triggerRef"
              @click.stop="toggleActions"
              class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              :class="{ 'ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900': showActions }"
            >
              <MoreHorizontal class="w-4 h-4" />
            </button>

            <!-- Dropdown Menu (Teleported to body) -->
            <Teleport to="body">
              <Transition
                enter-active-class="transition-all duration-200 ease-out"
                enter-from-class="opacity-0 scale-95 translate-y-1"
                enter-to-class="opacity-100 scale-100 translate-y-0"
                leave-active-class="transition-all duration-150 ease-in"
                leave-from-class="opacity-100 scale-100 translate-y-0"
                leave-to-class="opacity-0 scale-95 translate-y-1"
              >
                <div
                  v-if="showActions"
                  ref="dropdownRef"
                  class="fixed w-48 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 py-1.5 z-[9999]"
                  :style="dropdownStyle"
                >
                  <div class="px-2.5 py-1.5 border-b border-slate-100 dark:border-slate-700">
                    <p class="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Tenancy Actions</p>
                  </div>

                  <button
                    v-for="action in actions"
                    :key="action.key"
                    @click.stop="handleAction(action.key)"
                    class="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    :class="{ 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20': action.danger }"
                  >
                    <component :is="action.icon" class="w-3.5 h-3.5" :class="action.danger ? 'text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'" />
                    {{ action.label }}
                  </button>
                </div>
              </Transition>
            </Teleport>
          </div>

          <!-- View Arrow -->
          <div
            class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:text-white transition-all duration-300"
            :class="isNoticeServed ? 'group-hover:bg-rose-500' : 'group-hover:bg-emerald-500'"
          >
            <ChevronRight class="w-4 h-4" />
          </div>
        </div>
      </div>

      <!-- Status Pills -->
      <div class="mt-3 flex items-center gap-1.5 flex-wrap">
        <!-- Deposit Status -->
        <span
          class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full"
          :class="depositStatusClass"
        >
          <Shield class="w-2.5 h-2.5" />
          Deposit: {{ depositStatus }}
        </span>

        <!-- Compliance Pack -->
        <span
          v-if="!tenancy.compliance_pack_sent_at"
          class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
        >
          <AlertCircle class="w-2.5 h-2.5" />
          Compliance pack not sent
        </span>

        <!-- Next rent due indicator -->
        <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
          <Calendar class="w-2.5 h-2.5" />
          Rent due: {{ rentDueDay }}
        </span>

        <!-- Reposit -->
        <span
          v-if="tenancy.deposit_replacement_offered || tenancy.deposit_replacement_requested"
          class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400"
        >
          <Sparkles class="w-2.5 h-2.5" />
          Reposit
        </span>
        <!-- UniHomes -->
        <span
          v-if="tenancy.offer_unihomes"
          class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
        >
          <Zap class="w-2.5 h-2.5" />
          UniHomes{{ tenancy.unihomes_interested ? ' (Interested)' : '' }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import {
  ChevronRight,
  MoreHorizontal,
  Calendar,
  UserMinus,
  TrendingUp,
  FileWarning,
  XCircle,
  Trash2,
  Mail,
  Shield,
  AlertCircle,
  RotateCcw,
  Zap,
  Sparkles
} from 'lucide-vue-next'

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
  tenancy_end_date?: string
  end_date?: string
  actual_end_date?: string
  rent_amount?: number
  monthly_rent?: number
  rent_due_day?: number
  deposit_amount?: number | null
  deposit_protected_at?: string | null
  compliance_pack_sent_at?: string | null
  property?: {
    address_line1: string
    city: string
    postcode: string
  }
  tenants?: TenancyTenant[]
}

const props = defineProps<{
  tenancy: Tenancy
  isArchived?: boolean
  isNoticeServed?: boolean
}>()

const emit = defineEmits<{
  click: [tenancy: Tenancy]
  action: [action: string, tenancy: Tenancy]
}>()

const showActions = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const dropdownPosition = ref({ top: 0, left: 0 })

// Compute dropdown style
const dropdownStyle = computed(() => ({
  top: `${dropdownPosition.value.top}px`,
  left: `${dropdownPosition.value.left}px`
}))

// Toggle dropdown and calculate position
const toggleActions = () => {
  if (showActions.value) {
    showActions.value = false
    return
  }

  if (triggerRef.value) {
    const rect = triggerRef.value.getBoundingClientRect()
    // Position dropdown below and to the left of the trigger
    dropdownPosition.value = {
      top: rect.bottom + 6,
      left: rect.right - 192 // 192px = w-48 (12rem)
    }
  }

  showActions.value = true
}

// Close dropdown when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node
  const isClickOnTrigger = triggerRef.value?.contains(target)
  const isClickOnDropdown = dropdownRef.value?.contains(target)

  if (!isClickOnTrigger && !isClickOnDropdown) {
    showActions.value = false
  }
}

// Close dropdown on scroll
const handleScroll = () => {
  if (showActions.value) {
    showActions.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('scroll', handleScroll, true)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('scroll', handleScroll, true)
})

const actions = computed(() => {
  if (props.isArchived) {
    return [
      { key: 'revert-to-notice-served', label: 'Revert to Notice Served', icon: RotateCcw, danger: false },
      { key: 'revert-to-draft', label: 'Revert to Draft', icon: RotateCcw, danger: true },
      { key: 'delete', label: 'Delete Tenancy', icon: Trash2, danger: true }
    ]
  }
  return [
    { key: 'change-rent-due', label: 'Change Rent Due Date', icon: Calendar, danger: false },
    { key: 'change-tenant', label: 'Change Tenant', icon: UserMinus, danger: false },
    { key: 'rent-increase', label: 'Serve Rent Increase Notice', icon: TrendingUp, danger: false },
    { key: 'section-8', label: 'Serve Section 8 Notice', icon: FileWarning, danger: false },
    { key: 'end-tenancy', label: 'End Tenancy', icon: XCircle, danger: false },
    { key: 'email-tenants', label: 'Email All Tenants', icon: Mail, danger: false },
    { key: 'revert-to-draft', label: 'Revert to Draft', icon: RotateCcw, danger: true },
    { key: 'delete', label: 'Delete Tenancy', icon: Trash2, danger: true }
  ]
})

const handleAction = (actionKey: string) => {
  showActions.value = false
  emit('action', actionKey, props.tenancy)
}

// Date formatting
const startDate = computed(() => props.tenancy.tenancy_start_date || props.tenancy.start_date)
// End date can be in multiple fields: actual_end_date (when notice served/ended), tenancy_end_date, or end_date
const endDate = computed(() => props.tenancy.actual_end_date || props.tenancy.tenancy_end_date || props.tenancy.end_date)

// Display date depends on context
const displayDate = computed(() => {
  if (props.isNoticeServed && endDate.value) return endDate.value
  if (props.isArchived && endDate.value) return endDate.value
  return startDate.value
})

const formatShortDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '--'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// Accent stripe styling
const accentStripeClass = computed(() => {
  if (props.isArchived) return 'bg-gradient-to-b from-slate-300 via-slate-400 to-slate-300 dark:from-slate-600 dark:via-slate-500 dark:to-slate-600'
  if (props.isNoticeServed) return 'bg-gradient-to-b from-rose-400 via-red-500 to-rose-600'
  return 'bg-gradient-to-b from-emerald-400 via-teal-500 to-emerald-600'
})

// Status badge styling
const statusBadgeClass = computed(() => {
  if (props.isArchived) return 'bg-slate-400 text-white shadow-slate-200'
  if (props.isNoticeServed) return 'bg-rose-500 text-white shadow-rose-200'
  return 'bg-emerald-500 text-white shadow-emerald-200'
})

const statusLabelClass = computed(() => {
  if (props.isArchived) return 'text-slate-200'
  if (props.isNoticeServed) return 'text-rose-100'
  return 'text-emerald-100'
})

const statusBadgeLabel = computed(() => {
  if (props.isArchived) return 'Ended'
  if (props.isNoticeServed) return 'Move Out'
  return 'Since'
})

// Row hover styling
const rowHoverClass = computed(() => {
  if (props.isArchived) return 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md dark:hover:shadow-slate-900/50'
  if (props.isNoticeServed) return 'border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-700 hover:shadow-lg hover:shadow-rose-100/50 dark:hover:shadow-rose-900/30'
  return 'border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-lg hover:shadow-emerald-100/50 dark:hover:shadow-emerald-900/30'
})

// Rent
const rentAmount = computed(() => props.tenancy.rent_amount || props.tenancy.monthly_rent || 0)

const rentDueDay = computed(() => {
  const day = props.tenancy.rent_due_day || 1
  const suffix = ['th', 'st', 'nd', 'rd'] as const
  const v = day % 100
  return day + (suffix[(v - 20) % 10] ?? suffix[v] ?? suffix[0])
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
  if (activeTenants.value.length === 0) return 'No tenants'

  const sorted = [...activeTenants.value].sort((a, b) => {
    if (a.is_lead_tenant && !b.is_lead_tenant) return -1
    if (!a.is_lead_tenant && b.is_lead_tenant) return 1
    return 0
  })

  if (sorted.length <= 2) {
    return sorted.map(t => `${t.first_name} ${t.last_name}`).join(' & ')
  }

  const first = sorted[0]
  if (!first) return 'No tenants'
  return `${first.first_name} ${first.last_name} + ${sorted.length - 1} others`
})

// Deposit status
const depositStatus = computed(() => {
  if (!props.tenancy.deposit_amount) return 'None'
  if (props.tenancy.deposit_protected_at) return 'Protected'
  return `£${props.tenancy.deposit_amount.toLocaleString()}`
})

const depositStatusClass = computed(() => {
  if (!props.tenancy.deposit_amount) return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
  if (props.tenancy.deposit_protected_at) return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
  return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
})
</script>

<style scoped>
.tenancy-row {
  will-change: transform, box-shadow;
}
</style>

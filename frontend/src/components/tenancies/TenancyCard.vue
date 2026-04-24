<template>
  <div
    class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 hover:shadow-md transition-shadow cursor-pointer"
    @click="$emit('click', tenancy)"
  >
    <div class="px-6 py-4">
      <!-- Header Row: Property Address & Status -->
      <div class="flex justify-between items-start mb-3">
        <div class="flex-1 min-w-0">
          <h3 class="text-sm font-medium text-gray-900 dark:text-white truncate">
            {{ tenancy.property?.address_line1 || 'Unknown Address' }}
          </h3>
          <p class="text-xs text-gray-500 dark:text-slate-400">
            {{ tenancy.property?.city }}{{ tenancy.property?.postcode ? `, ${tenancy.property.postcode}` : '' }}
          </p>
        </div>
        <div class="ml-4 flex-shrink-0">
          <span
            class="px-2.5 py-1 text-xs font-semibold rounded-full"
            :class="statusClass"
          >
            {{ statusLabel }}
          </span>
        </div>
      </div>

      <!-- Tenants Row -->
      <div class="flex items-center gap-2 mb-3">
        <Users class="w-4 h-4 text-gray-400 dark:text-slate-500 flex-shrink-0" />
        <div class="flex-1 min-w-0">
          <p class="text-sm text-gray-700 dark:text-slate-300 truncate">
            {{ tenantNames }}
          </p>
        </div>
      </div>

      <!-- Details Grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <!-- Rent -->
        <div>
          <p class="text-xs text-gray-500 dark:text-slate-400">Monthly Rent</p>
          <p class="font-medium text-gray-900 dark:text-white">&pound;{{ rentAmount?.toLocaleString() || '0' }}</p>
        </div>

        <!-- Start Date -->
        <div>
          <p class="text-xs text-gray-500 dark:text-slate-400">Start Date</p>
          <p class="font-medium text-gray-900 dark:text-white">{{ formatDate(startDate) }}</p>
        </div>

        <!-- End Date / Term -->
        <div>
          <p class="text-xs text-gray-500 dark:text-slate-400">{{ endDate ? 'End Date' : 'Type' }}</p>
          <p class="font-medium text-gray-900 dark:text-white">
            {{ endDate ? formatDate(endDate) : 'AST' }}
          </p>
        </div>

        <!-- Deposit Status -->
        <div>
          <p class="text-xs text-gray-500 dark:text-slate-400">Deposit</p>
          <p class="font-medium" :class="depositStatusClass">
            {{ depositStatus }}
          </p>
        </div>
      </div>

      <!-- Warning Badges -->
      <div v-if="warnings.length > 0" class="mt-3 flex flex-wrap gap-2">
        <span
          v-for="warning in warnings"
          :key="warning.key"
          class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full"
          :class="warning.class"
        >
          {{ warning.label }}
          <button
            v-if="warning.dismissable"
            @click="dismissAmlWarning"
            :disabled="dismissing"
            class="ml-1 p-0.5 rounded-full hover:bg-black/10 transition-colors"
            title="Dismiss warning"
          >
            <X class="w-3 h-3" />
          </button>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Users, X } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'vue-toastification'
import { API_URL } from '@/lib/apiUrl'
import { authFetch } from '@/lib/authFetch'
const authStore = useAuthStore()
const toast = useToast()

interface TenancyTenant {
  id: string
  first_name: string
  last_name: string
  is_lead_tenant: boolean
  status: string
}

interface LandlordAmlStatus {
  has_landlord: boolean
  aml_passed: boolean
  landlord_name: string | null
}

interface Tenancy {
  id: string
  status: 'pending' | 'active' | 'notice_given' | 'ended' | 'terminated' | 'expired'
  tenancy_type?: string
  // Support both old and new column names
  start_date?: string
  tenancy_start_date?: string
  end_date?: string | null
  tenancy_end_date?: string | null
  monthly_rent?: number
  rent_amount?: number
  deposit_amount?: number | null
  deposit_scheme?: string | null
  deposit_protected_at?: string | null
  compliance_pack_sent_at?: string | null
  landlord_aml_status?: LandlordAmlStatus
  aml_warning_dismissed_at?: string | null
  property?: {
    address_line1: string
    city: string
    postcode: string
  }
  tenants?: TenancyTenant[]
}

const props = defineProps<{
  tenancy: Tenancy
}>()

const emit = defineEmits<{
  click: [tenancy: Tenancy]
  updated: []
}>()

// Local state for dismissing
const dismissing = ref(false)
const localDismissed = ref(false)

const dismissAmlWarning = async (e: Event) => {
  e.stopPropagation() // Don't trigger card click
  dismissing.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await authFetch(
      `${API_URL}/api/tenancies/records/${props.tenancy.id}/dismiss-aml-warning`,
      {
        method: 'POST',
        token,
        body: JSON.stringify({})
      }
    )

    if (!response.ok) {
      throw new Error('Failed to dismiss warning')
    }

    localDismissed.value = true
    emit('updated')
  } catch (error: any) {
    console.error('Error dismissing AML warning:', error)
    toast.error('Failed to dismiss warning')
  } finally {
    dismissing.value = false
  }
}

// Computed: Handle both old and new column names
const rentAmount = computed(() => props.tenancy.rent_amount || props.tenancy.monthly_rent || 0)
const startDate = computed(() => props.tenancy.tenancy_start_date || props.tenancy.start_date || null)
const endDate = computed(() => props.tenancy.tenancy_end_date || props.tenancy.end_date || null)

// Computed: Status styling
const statusClass = computed(() => {
  const classes: Record<string, string> = {
    pending: 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200',
    active: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200',
    notice_given: 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200',
    ended: 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200',
    terminated: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200',
    expired: 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
  }
  return classes[props.tenancy.status] || 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200'
})

const statusLabel = computed(() => {
  const labels: Record<string, string> = {
    pending: 'Pending',
    active: 'Active',
    notice_given: 'Notice Given',
    ended: 'Ended',
    terminated: 'Terminated',
    expired: 'Expired'
  }
  return labels[props.tenancy.status] || props.tenancy.status
})

// Computed: Tenant names
const tenantNames = computed(() => {
  const activeTenants = props.tenancy.tenants?.filter(t => t.status === 'active') || []
  if (activeTenants.length === 0) return 'No tenants'

  // Sort lead tenant first
  const sorted = [...activeTenants].sort((a, b) => {
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

// Computed: Deposit status
const depositStatus = computed(() => {
  if (!props.tenancy.deposit_amount) return 'None'
  if (props.tenancy.deposit_protected_at) return 'Protected'
  return `£${props.tenancy.deposit_amount.toLocaleString()}`
})

const depositStatusClass = computed(() => {
  if (!props.tenancy.deposit_amount) return 'text-gray-500 dark:text-slate-400'
  if (props.tenancy.deposit_protected_at) return 'text-green-600 dark:text-green-400'
  return 'text-amber-600 dark:text-amber-400'
})

// Computed: Warnings
const warnings = computed(() => {
  const result: Array<{ key: string; label: string; class: string; dismissable?: boolean }> = []

  // Check landlord AML status (only if not dismissed)
  const amlStatus = props.tenancy.landlord_aml_status
  const amlDismissed = props.tenancy.aml_warning_dismissed_at || localDismissed.value
  if (
    amlStatus &&
    amlStatus.has_landlord &&
    !amlStatus.aml_passed &&
    !amlDismissed
  ) {
    result.push({
      key: 'aml',
      label: 'Landlord AML not verified',
      class: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300',
      dismissable: true
    })
  }

  // Check deposit protection
  if (
    props.tenancy.status === 'active' &&
    props.tenancy.deposit_amount &&
    !props.tenancy.deposit_protected_at
  ) {
    result.push({
      key: 'deposit',
      label: 'Deposit not protected',
      class: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
    })
  }

  // Check compliance pack
  if (
    props.tenancy.status === 'active' &&
    !props.tenancy.compliance_pack_sent_at
  ) {
    result.push({
      key: 'compliance',
      label: 'Compliance pack not sent',
      class: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
    })
  }

  return result
})

// Methods
const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}
</script>

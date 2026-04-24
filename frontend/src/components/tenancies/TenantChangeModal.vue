<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { X, Users, CheckCircle, FileText, Send, Calendar, ClipboardCheck, AlertTriangle, ChevronRight } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import Step1IncomingDetails from './tenant-change/Step1IncomingDetails.vue'
import Step2ReferencingDecision from './tenant-change/Step2ReferencingDecision.vue'
import Step3FeeAndDate from './tenant-change/Step3FeeAndDate.vue'
import Step4AddendumReview from './tenant-change/Step4AddendumReview.vue'
import Step5AwaitingSignatures from './tenant-change/Step5AwaitingSignatures.vue'
import Step6Complete from './tenant-change/Step6Complete.vue'
import Step7PostCompletion from './tenant-change/Step7PostCompletion.vue'
import { API_URL } from '@/lib/apiUrl'
import { authFetch } from '@/lib/authFetch'

interface Tenant {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  is_lead_tenant: boolean
}

interface IncomingTenant {
  title?: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  dob?: string
  currentAddress?: {
    line1: string
    line2?: string
    city: string
    postcode: string
  }
  hasGuarantor?: boolean
  guarantor?: {
    title?: string
    firstName: string
    lastName: string
    email?: string
    phone?: string
    address?: {
      line1: string
      line2?: string
      city: string
      postcode: string
    }
  }
}

interface TenantChange {
  id: string
  tenancy_id: string
  stage: number
  status: 'in_progress' | 'completed' | 'cancelled'
  outgoing_tenant_ids: string[]
  incoming_tenants: IncomingTenant[]
  expected_move_out_date: string | null
  expected_move_in_date: string | null
  referencing_skipped: boolean
  referencing_overridden: boolean
  referencing_override_reason: string | null
  changeover_date: string | null
  fee_amount: number
  fee_waived: boolean
  fee_waived_reason: string | null
  fee_above_50_justification: string | null
  fee_payable_by: 'outgoing' | 'incoming' | 'split'
  payment_reference: string | null
  bank_name: string | null
  sort_code: string | null
  account_number: string | null
  pro_rata_outgoing: number
  pro_rata_incoming: number
  fee_invoice_sent_at: string | null
  fee_tenant_confirmed_at: string | null
  fee_received_at: string | null
  addendum_sent_at: string | null
  addendum_fully_signed_at: string | null
  completed_at: string | null
  checklist_deposit_updated: boolean
  checklist_deposit_updated_at: string | null
  checklist_prescribed_info_sent: boolean
  checklist_prescribed_info_sent_at: string | null
  checklist_deposit_share_confirmed: boolean
  checklist_deposit_share_confirmed_at: string | null
}

const props = defineProps<{
  isOpen: boolean
  tenancyId: string
  tenancy?: any // Full tenancy object (optional, provides defaults)
  propertyAddress?: string
  monthlyRent?: number
  tenants?: Tenant[]
  existingTenantChange?: TenantChange | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success'): void
  (e: 'updated'): void
}>()

const authStore = useAuthStore()

// State
const loading = ref(false)
const error = ref('')
const tenantChange = ref<TenantChange | null>(null)
const currentStep = ref(1)

// Step definitions
const steps = [
  { number: 1, title: 'Tenant Details', icon: Users },
  { number: 2, title: 'Referencing', icon: CheckCircle },
  { number: 3, title: 'Fee & Date', icon: Calendar },
  { number: 4, title: 'Addendum', icon: FileText },
  { number: 5, title: 'Signatures', icon: Send },
  { number: 6, title: 'Complete', icon: ClipboardCheck },
  { number: 7, title: 'Checklist', icon: ClipboardCheck }
]

// Computed - derive values from tenancy if not provided directly
const effectivePropertyAddress = computed(() => {
  if (props.propertyAddress) return props.propertyAddress
  if (props.tenancy?.property) {
    const p = props.tenancy.property
    return [p.address_line1, p.city, p.postcode].filter(Boolean).join(', ')
  }
  return ''
})

const effectiveMonthlyRent = computed(() => {
  if (props.monthlyRent !== undefined) return props.monthlyRent
  return props.tenancy?.monthly_rent || props.tenancy?.rent_amount || 0
})

const effectiveTenants = computed<Tenant[]>(() => {
  if (props.tenants && props.tenants.length > 0) return props.tenants
  return (props.tenancy?.tenants || []).map((t: any) => ({
    id: t.id,
    first_name: t.first_name,
    last_name: t.last_name,
    email: t.email,
    phone: t.phone,
    is_lead_tenant: t.is_lead_tenant || false
  }))
})

const effectiveRentDueDay = computed(() => {
  return props.tenancy?.rent_due_day || 1
})

// Methods
async function fetchTenantChange() {
  loading.value = true
  error.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await authFetch(
      `${API_URL}/api/tenant-change/tenancy/${props.tenancyId}`,
      {
        token
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to fetch tenant change')
    }

    const data = await response.json()
    tenantChange.value = data.tenantChange

    if (tenantChange.value) {
      currentStep.value = tenantChange.value.stage
    }
  } catch (err: any) {
    console.error('[TenantChangeModal] Fetch error:', err)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function createTenantChange(data: {
  outgoingTenantIds: string[]
  incomingTenants: IncomingTenant[]
  expectedMoveOutDate?: string
  expectedMoveInDate?: string
}) {
  loading.value = true
  error.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await authFetch(
      `${API_URL}/api/tenant-change`,
      {
        method: 'POST',
        token,
        body: JSON.stringify({
          tenancyId: props.tenancyId,
          ...data
        })
      }
    )

    if (!response.ok) {
      const result = await response.json()
      throw new Error(result.error || 'Failed to create tenant change')
    }

    const result = await response.json()
    tenantChange.value = result.tenantChange
    currentStep.value = 2
  } catch (err: any) {
    console.error('[TenantChangeModal] Create error:', err)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function updateTenantChange(updates: Partial<TenantChange>) {
  if (!tenantChange.value) return

  loading.value = true
  error.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await authFetch(
      `${API_URL}/api/tenant-change/${tenantChange.value.id}`,
      {
        method: 'PATCH',
        token,
        body: JSON.stringify(updates)
      }
    )

    if (!response.ok) {
      const result = await response.json()
      throw new Error(result.error || 'Failed to update tenant change')
    }

    const result = await response.json()
    tenantChange.value = result.tenantChange
  } catch (err: any) {
    console.error('[TenantChangeModal] Update error:', err)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function cancelTenantChange(reason: string) {
  if (!tenantChange.value) return

  loading.value = true
  error.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await authFetch(
      `${API_URL}/api/tenant-change/${tenantChange.value.id}/cancel`,
      {
        method: 'POST',
        token,
        body: JSON.stringify({ reason })
      }
    )

    if (!response.ok) {
      const result = await response.json()
      throw new Error(result.error || 'Failed to cancel tenant change')
    }

    emit('close')
    emit('success')
  } catch (err: any) {
    console.error('[TenantChangeModal] Cancel error:', err)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function handleStepComplete(data?: any) {
  if (data) {
    tenantChange.value = { ...tenantChange.value, ...data } as TenantChange
  }
  // Advance the stage if moving beyond the current stage
  if (tenantChange.value && currentStep.value >= tenantChange.value.stage) {
    tenantChange.value = { ...tenantChange.value, stage: currentStep.value + 1 }
  }
  currentStep.value++
}

function handleTenantChangeUpdate(data: TenantChange) {
  // Just update the local state without making an API call
  tenantChange.value = data
}

function handleClose() {
  // Emit updated if we had a tenant change (user may have made progress)
  if (tenantChange.value) {
    emit('updated')
  }
  emit('close')
}

function handleFinalize() {
  // Tenant change is complete - emit updated to refresh the tenancy data
  emit('updated')
  // Also emit success to signal completion
  emit('success')
  // Close the modal
  emit('close')
}

function goToStep(step: number) {
  if (tenantChange.value && step <= tenantChange.value.stage) {
    currentStep.value = step
  }
}

function goBack() {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

// Reset and fetch when modal opens
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    error.value = ''
    currentStep.value = 1

    // Use existing tenant change from props if provided
    if (props.existingTenantChange) {
      tenantChange.value = props.existingTenantChange
      currentStep.value = props.existingTenantChange.stage
    } else {
      tenantChange.value = null
      await fetchTenantChange()
    }
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-sm"
          @click="handleClose"
        />

        <!-- Modal -->
        <div class="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-xl shadow-2xl flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
                <Users class="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Change of Tenant</h2>
                <p class="text-sm text-gray-500 dark:text-slate-400">{{ propertyAddress }}</p>
              </div>
            </div>
            <button
              @click="handleClose"
              class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Step Indicator -->
          <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
            <div class="flex items-center justify-between">
              <template v-for="(step, index) in steps" :key="step.number">
                <button
                  @click="goToStep(step.number)"
                  :disabled="!tenantChange || step.number > tenantChange.stage"
                  class="flex flex-col items-center group relative"
                  :class="[
                    step.number === currentStep ? 'text-orange-600 dark:text-orange-400' :
                    (tenantChange && step.number <= tenantChange.stage) ? 'text-green-600 dark:text-green-400 cursor-pointer' :
                    'text-gray-400 dark:text-slate-500 cursor-not-allowed'
                  ]"
                >
                  <div
                    class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors"
                    :class="[
                      step.number === currentStep ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400' :
                      (tenantChange && step.number < tenantChange.stage) ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400' :
                      (tenantChange && step.number === tenantChange.stage) ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400' :
                      'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500'
                    ]"
                  >
                    <CheckCircle v-if="tenantChange && step.number < tenantChange.stage" class="w-4 h-4" />
                    <span v-else>{{ step.number }}</span>
                  </div>
                  <span class="mt-1 text-xs font-medium hidden sm:block">{{ step.title }}</span>
                </button>
                <ChevronRight
                  v-if="index < steps.length - 1"
                  class="w-4 h-4 text-gray-300 dark:text-slate-600 mx-1"
                />
              </template>
            </div>
          </div>

          <!-- Error Message -->
          <div v-if="error" class="px-6 py-3 bg-red-50 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800">
            <div class="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle class="w-4 h-4" />
              <span class="text-sm">{{ error }}</span>
            </div>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-6">
            <!-- Loading State -->
            <div v-if="loading && !tenantChange" class="flex items-center justify-center py-12">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
            </div>

            <!-- Step Components -->
            <template v-else>
              <Step1IncomingDetails
                v-if="currentStep === 1"
                :tenants="effectiveTenants"
                :tenantChange="tenantChange"
                :loading="loading"
                :rentDueDay="effectiveRentDueDay"
                @create="createTenantChange"
                @update="updateTenantChange"
                @next="handleStepComplete"
              />

              <Step2ReferencingDecision
                v-else-if="currentStep === 2"
                :tenantChange="tenantChange!"
                :loading="loading"
                @update="updateTenantChange"
                @next="handleStepComplete"
                @back="goBack"
              />

              <Step3FeeAndDate
                v-else-if="currentStep === 3"
                :tenantChange="tenantChange!"
                :monthlyRent="effectiveMonthlyRent"
                :rentDueDay="effectiveRentDueDay"
                :loading="loading"
                @update="updateTenantChange"
                @next="handleStepComplete"
                @back="goBack"
                @close="handleClose"
              />

              <Step4AddendumReview
                v-else-if="currentStep === 4"
                :tenantChange="tenantChange!"
                :propertyAddress="effectivePropertyAddress"
                :tenancyStartDate="tenancy?.start_date || null"
                :loading="loading"
                @next="handleStepComplete"
                @back="goBack"
              />

              <Step5AwaitingSignatures
                v-else-if="currentStep === 5"
                :tenantChange="tenantChange!"
                :loading="loading"
                @refresh="fetchTenantChange"
                @next="handleStepComplete"
              />

              <Step6Complete
                v-else-if="currentStep === 6"
                :tenantChange="tenantChange!"
                :tenants="effectiveTenants"
                :loading="loading"
                @complete="handleStepComplete"
              />

              <Step7PostCompletion
                v-else-if="currentStep === 7"
                :tenantChange="tenantChange!"
                :loading="loading"
                @update="handleTenantChangeUpdate"
                @finalize="handleFinalize"
                @close="handleClose"
              />
            </template>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 flex items-center justify-between">
            <div>
              <button
                v-if="tenantChange?.status === 'in_progress'"
                @click="cancelTenantChange('Cancelled by user')"
                :disabled="loading"
                class="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel Process
              </button>
            </div>
            <div class="text-sm text-gray-500 dark:text-slate-400">
              Step {{ currentStep }} of {{ steps.length }}
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>

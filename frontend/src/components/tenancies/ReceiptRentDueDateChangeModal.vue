<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="show" class="fixed inset-0 z-[60] overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4">
          <!-- Backdrop -->
          <div class="fixed inset-0 bg-black/50" @click="$emit('close')" />

          <!-- Modal -->
          <div class="relative w-full max-w-lg bg-white rounded-xl shadow-xl">
            <!-- Header -->
            <div class="px-6 py-4 border-b border-gray-200">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-lg font-semibold text-gray-900">Confirm Payment Received</h3>
                  <p class="text-sm text-gray-500 mt-1">Record payment for rent due date change</p>
                </div>
                <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600">
                  <X class="w-5 h-5" />
                </button>
              </div>
            </div>

            <!-- Content -->
            <div class="p-6 space-y-5">
              <!-- Change Details Card -->
              <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 class="text-sm font-semibold text-blue-800 mb-3">Rent Due Date Change Details</h4>
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <span class="text-blue-700">Current Due Day:</span>
                    <span class="font-medium text-blue-900">{{ ordinal(change?.current_due_day) }} of each month</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-blue-700">New Due Day:</span>
                    <span class="font-medium text-blue-900">{{ ordinal(change?.new_due_day) }} of each month</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-blue-700">Effective From:</span>
                    <span class="font-medium text-blue-900">{{ effectiveDate }}</span>
                  </div>
                </div>
              </div>

              <!-- Payment Summary Card -->
              <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 class="text-sm font-semibold text-gray-700 mb-3">Payment Summary</h4>
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <span class="text-gray-600">Pro-rata Amount ({{ change?.pro_rata_days }} days):</span>
                    <span class="font-medium text-gray-900">&pound;{{ formatAmount(change?.pro_rata_amount) }}</span>
                  </div>
                  <div v-if="(change?.admin_fee ?? 0) > 0" class="flex justify-between">
                    <span class="text-gray-600">Administration Fee:</span>
                    <span class="font-medium text-gray-900">&pound;{{ formatAmount(change?.admin_fee) }}</span>
                  </div>
                  <div class="pt-2 border-t border-gray-300 flex justify-between">
                    <span class="font-semibold text-gray-800">Total Amount:</span>
                    <span class="text-lg font-bold text-primary">&pound;{{ formatAmount(change?.total_amount) }}</span>
                  </div>
                </div>
              </div>

              <!-- Tenant Confirmed Notice -->
              <div v-if="change?.tenant_confirmed_at" class="bg-green-50 border border-green-200 rounded-lg p-3">
                <div class="flex items-center gap-2 text-green-700">
                  <CheckCircle class="w-4 h-4" />
                  <span class="text-sm font-medium">Tenant confirmed payment on {{ formatDate(change.tenant_confirmed_at) }}</span>
                </div>
              </div>

              <!-- Payment Receipt Form -->
              <div class="space-y-4">
                <h4 class="text-sm font-semibold text-gray-700">Payment Receipt Details</h4>

                <!-- Payment Received Date -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Payment Received Date *
                  </label>
                  <input
                    v-model="form.paymentReceivedAt"
                    type="date"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                  />
                </div>

                <!-- Payment Reference (Optional) -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Payment Reference <span class="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    v-model="form.paymentReference"
                    type="text"
                    placeholder="e.g., Bank transfer ref, card payment ID..."
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>

              <!-- Info Notice -->
              <div class="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p class="text-sm text-amber-800">
                  <strong>Note:</strong> Confirming this payment will:
                </p>
                <ul class="text-sm text-amber-700 mt-1 list-disc list-inside space-y-1">
                  <li>Update the tenancy rent due day to the {{ ordinal(change?.new_due_day) }}</li>
                  <li>Generate a legal confirmation notice</li>
                  <li>Send confirmation emails to all tenants</li>
                  <li>Save the notice to the Documents tab</li>
                </ul>
              </div>

              <!-- Error -->
              <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-3">
                <p class="text-sm text-red-700">{{ error }}</p>
              </div>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                type="button"
                @click="$emit('close')"
                class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                @click="handleConfirm"
                :disabled="submitting || !isValid"
                class="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                <Loader2 v-if="submitting" class="w-4 h-4 animate-spin" />
                <CheckCircle v-else class="w-4 h-4" />
                {{ submitting ? 'Processing...' : 'Confirm Payment Received' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '@/stores/auth'
import { X, CheckCircle, Loader2 } from 'lucide-vue-next'
import { API_URL } from '@/lib/apiUrl'
import { authFetch } from '@/lib/authFetch'

interface RentDueDateChange {
  id: string
  current_due_day: number
  new_due_day: number
  effective_month: number
  effective_year: number
  monthly_rent: number
  pro_rata_days: number
  daily_rate: number
  pro_rata_amount: number
  admin_fee: number
  total_amount: number
  status: string
  tenant_confirmed_at?: string
}

const props = defineProps<{
  show: boolean
  tenancyId: string
  change: RentDueDateChange | null
}>()

const emit = defineEmits<{
  close: []
  confirmed: []
}>()

const toast = useToast()
const authStore = useAuthStore()
const submitting = ref(false)
const error = ref('')

const form = ref({
  paymentReceivedAt: new Date().toISOString().split('T')[0],
  paymentReference: ''
})

const isValid = computed(() => {
  return form.value.paymentReceivedAt
})

// Reset form when modal opens
watch(() => props.show, (isShow) => {
  if (isShow) {
    form.value = {
      paymentReceivedAt: new Date().toISOString().split('T')[0],
      paymentReference: ''
    }
    error.value = ''
  }
})

// Helper to format ordinal numbers (1st, 2nd, 3rd, etc.)
const ordinal = (n: number | undefined): string => {
  if (!n) return ''
  if (n >= 11 && n <= 13) return n + 'th'
  switch (n % 10) {
    case 1: return n + 'st'
    case 2: return n + 'nd'
    case 3: return n + 'rd'
    default: return n + 'th'
  }
}

const formatAmount = (amount: number | string | undefined): string => {
  if (!amount) return '0.00'
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return num.toFixed(2)
}

const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

const effectiveDate = computed(() => {
  if (!props.change) return ''
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${ordinal(props.change.new_due_day)} ${monthNames[props.change.effective_month - 1]} ${props.change.effective_year}`
})

const handleConfirm = async () => {
  if (!isValid.value || !props.change) return

  submitting.value = true
  error.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await authFetch(
      `${API_URL}/api/tenancies/records/${props.tenancyId}/rent-due-date-change/${props.change.id}/activate`,
      {
        method: 'POST',
        token,
        body: JSON.stringify({
          paymentReceivedAt: form.value.paymentReceivedAt,
          paymentReference: form.value.paymentReference || null
        })
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to confirm payment')
    }

    toast.success('Payment confirmed! Rent due date has been updated.')
    emit('confirmed')
    emit('close')
  } catch (err: any) {
    console.error('Error confirming payment:', err)
    error.value = err.message || 'Failed to confirm payment'
  } finally {
    submitting.value = false
  }
}
</script>

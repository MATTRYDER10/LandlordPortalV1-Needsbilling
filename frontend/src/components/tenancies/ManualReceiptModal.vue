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
          <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-xl">
            <!-- Header -->
            <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Confirm Payment Received</h3>
              <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">Manually confirm initial monies have been paid</p>
            </div>

            <!-- Loading State -->
            <div v-if="loading" class="p-6 flex items-center justify-center">
              <Loader2 class="w-8 h-8 animate-spin text-primary" />
            </div>

            <!-- Content -->
            <div v-else class="p-6 space-y-4">
              <!-- Property Info -->
              <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 dark:text-slate-400 uppercase">Property</p>
                <p class="font-medium text-gray-900 dark:text-white">{{ propertyAddress }}</p>
              </div>

              <!-- Amount Breakdown -->
              <div class="space-y-3">
                <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase">Payment Details</h4>

                <!-- Amount Requested -->
                <div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-slate-700">
                  <span class="text-sm text-gray-600 dark:text-slate-400">Amount Requested</span>
                  <span class="font-medium text-gray-900 dark:text-white">&pound;{{ amountRequested.toLocaleString('en-GB', { minimumFractionDigits: 2 }) }}</span>
                </div>

                <!-- Amount Received (Editable) -->
                <div class="flex items-center justify-between py-2">
                  <label class="text-sm text-gray-600 dark:text-slate-400">Amount Received</label>
                  <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400">&pound;</span>
                    <input
                      v-model.number="amountReceived"
                      type="number"
                      step="0.01"
                      min="0"
                      class="w-32 pl-7 pr-3 py-2 text-right border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <!-- Balance -->
                <div class="flex items-center justify-between py-3 border-t-2 border-gray-200 dark:border-slate-700">
                  <span class="text-sm font-medium text-gray-700 dark:text-slate-300">Outstanding Balance</span>
                  <span
                    :class="[
                      'text-lg font-bold',
                      balance === 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    ]"
                  >
                    &pound;{{ balance.toLocaleString('en-GB', { minimumFractionDigits: 2 }) }}
                  </span>
                </div>

                <!-- Warning if balance not zero -->
                <div v-if="balance !== 0" class="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                  <p class="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Note:</strong> The amount received doesn't match the amount requested.
                    You can still confirm receipt with an outstanding balance.
                  </p>
                </div>

                <!-- Zero balance confirmation -->
                <div v-else class="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg flex items-center gap-2">
                  <CheckCircle class="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <p class="text-sm text-green-800 dark:text-green-200">
                    Payment matches amount requested. No outstanding balance.
                  </p>
                </div>
              </div>

              <!-- Notes -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Notes (optional)</label>
                <textarea
                  v-model="notes"
                  rows="2"
                  placeholder="e.g. Payment received via bank transfer"
                  class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                ></textarea>
              </div>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                @click="$emit('close')"
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                @click="confirmReceipt"
                :disabled="confirming || amountReceived <= 0"
                class="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                <Loader2 v-if="confirming" class="w-4 h-4 animate-spin" />
                <CheckCircle v-else class="w-4 h-4" />
                {{ confirming ? 'Confirming...' : 'Confirm Payment Received' }}
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
import { Loader2, CheckCircle } from 'lucide-vue-next'
import { API_URL } from '@/lib/apiUrl'

const props = defineProps<{
  show: boolean
  tenancy: any | null
}>()

const emit = defineEmits<{
  close: []
  confirmed: []
}>()

const toast = useToast()
const authStore = useAuthStore()

// State
const loading = ref(false)
const confirming = ref(false)
const propertyAddress = ref('')
const amountRequested = ref(0)
const amountReceived = ref(0)
const notes = ref('')

// Computed
const balance = computed(() => {
  return Math.round((amountRequested.value - amountReceived.value) * 100) / 100
})

// Load data when modal opens
watch(() => props.show, async (isOpen) => {
  if (isOpen && props.tenancy) {
    await loadData()
  }
})

const loadData = async () => {
  if (!props.tenancy) return

  loading.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    // Get payment request data from backend
    const response = await fetch(
      `${API_URL}/api/tenancies/records/${props.tenancy.id}/payment-request`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )

    if (response.ok) {
      const data = await response.json()
      propertyAddress.value = data.propertyAddress || ''
      amountRequested.value = data.totalAmount || 0
      amountReceived.value = data.totalAmount || 0 // Default to full amount
    } else {
      // Fallback to tenancy data
      propertyAddress.value = [
        props.tenancy.property?.address_line1,
        props.tenancy.property?.city,
        props.tenancy.property?.postcode
      ].filter(Boolean).join(', ')

      // Calculate from tenancy
      const rent = props.tenancy.monthly_rent || props.tenancy.rent_amount || 0
      const deposit = props.tenancy.deposit_amount || 0
      amountRequested.value = rent + deposit
      amountReceived.value = rent + deposit
    }
  } catch (err) {
    console.error('Error loading payment data:', err)
    // Use basic fallback
    propertyAddress.value = [
      props.tenancy?.property?.address_line1,
      props.tenancy?.property?.city,
      props.tenancy?.property?.postcode
    ].filter(Boolean).join(', ')

    const rent = props.tenancy?.monthly_rent || props.tenancy?.rent_amount || 0
    const deposit = props.tenancy?.deposit_amount || 0
    amountRequested.value = rent + deposit
    amountReceived.value = rent + deposit
  } finally {
    loading.value = false
  }
}

const confirmReceipt = async () => {
  if (!props.tenancy) return

  confirming.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${props.tenancy.id}/confirm-initial-monies`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amountReceived: amountReceived.value,
          notes: notes.value,
          manualReceipt: true
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to confirm payment')
    }

    toast.success('Payment confirmed successfully')
    emit('confirmed')
    emit('close')
  } catch (err: any) {
    console.error('Error confirming payment:', err)
    toast.error(err.message || 'Failed to confirm payment')
  } finally {
    confirming.value = false
  }
}
</script>

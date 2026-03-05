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
          <div class="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-xl">
            <!-- Header -->
            <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Request Initial Monies</h3>
              <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">Review and send payment request to tenant</p>
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

              <!-- Recipient -->
              <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 dark:text-slate-400 uppercase">Sending to</p>
                <p class="font-medium text-gray-900 dark:text-white">{{ recipientName }}</p>
                <p class="text-sm text-gray-600 dark:text-slate-400">{{ recipientEmail }}</p>
              </div>

              <!-- Editable Amounts -->
              <div class="space-y-3">
                <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase">Payment Breakdown</h4>

                <!-- First Month's Rent -->
                <div class="flex items-center justify-between gap-4">
                  <label class="text-sm text-gray-700 dark:text-slate-300">First Month's Rent</label>
                  <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400">&pound;</span>
                    <input
                      v-model.number="editableAmounts.firstMonthRent"
                      type="number"
                      step="0.01"
                      min="0"
                      class="w-32 pl-7 pr-3 py-2 text-right border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <!-- Deposit -->
                <div class="flex items-center justify-between gap-4">
                  <label class="text-sm text-gray-700 dark:text-slate-300">Security Deposit</label>
                  <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400">&pound;</span>
                    <input
                      v-model.number="editableAmounts.deposit"
                      type="number"
                      step="0.01"
                      min="0"
                      class="w-32 pl-7 pr-3 py-2 text-right border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <!-- Holding Deposit (to deduct) -->
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <label class="text-sm text-gray-700 dark:text-slate-300">Holding Deposit Paid</label>
                    <p class="text-xs text-gray-500 dark:text-slate-400">Will be deducted from total</p>
                  </div>
                  <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400">&pound;</span>
                    <input
                      v-model.number="editableAmounts.holdingDeposit"
                      type="number"
                      step="0.01"
                      min="0"
                      class="w-32 pl-7 pr-3 py-2 text-right border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <!-- Additional Charges -->
                <div v-if="editableAmounts.additionalCharges.length > 0" class="pt-2 border-t border-gray-100 dark:border-slate-700">
                  <p class="text-xs text-gray-500 dark:text-slate-400 uppercase mb-2">Additional Charges</p>
                  <div
                    v-for="(charge, index) in editableAmounts.additionalCharges"
                    :key="index"
                    class="flex items-center justify-between gap-4 mb-2"
                  >
                    <input
                      v-model="charge.name"
                      type="text"
                      placeholder="Charge name"
                      class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                    <div class="relative">
                      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400">&pound;</span>
                      <input
                        v-model.number="charge.amount"
                        type="number"
                        step="0.01"
                        min="0"
                        class="w-28 pl-7 pr-3 py-2 text-right border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <button
                      @click="removeCharge(index)"
                      class="p-1 text-gray-400 hover:text-red-500"
                    >
                      <X class="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <!-- Add Charge Button -->
                <button
                  @click="addCharge"
                  class="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
                >
                  <Plus class="w-4 h-4" />
                  Add Additional Charge
                </button>
              </div>

              <!-- Total -->
              <div class="pt-4 border-t-2 border-gray-200 dark:border-slate-700">
                <div class="flex items-center justify-between">
                  <span class="text-lg font-semibold text-gray-900 dark:text-white">Total Due</span>
                  <span class="text-2xl font-bold text-primary">&pound;{{ totalDue.toLocaleString('en-GB', { minimumFractionDigits: 2 }) }}</span>
                </div>
                <p class="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  = &pound;{{ editableAmounts.firstMonthRent.toLocaleString() }} + &pound;{{ editableAmounts.deposit.toLocaleString() }}
                  <span v-if="additionalChargesTotal > 0"> + &pound;{{ additionalChargesTotal.toLocaleString() }}</span>
                  <span v-if="editableAmounts.holdingDeposit > 0"> - &pound;{{ editableAmounts.holdingDeposit.toLocaleString() }}</span>
                </p>
              </div>

              <!-- Due Date -->
              <div class="flex items-center justify-between gap-4 pt-2">
                <label class="text-sm text-gray-700 dark:text-slate-300">Payment Due Date</label>
                <input
                  v-model="dueDate"
                  type="date"
                  class="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                />
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
                @click="sendRequest"
                :disabled="sending || totalDue <= 0"
                class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                <Loader2 v-if="sending" class="w-4 h-4 animate-spin" />
                <Send v-else class="w-4 h-4" />
                {{ sending ? 'Sending...' : 'Send Payment Request' }}
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
import { Loader2, Send, X, Plus } from 'lucide-vue-next'
import { API_URL } from '@/lib/apiUrl'

const props = defineProps<{
  show: boolean
  tenancy: any | null
}>()

const emit = defineEmits<{
  close: []
  sent: []
}>()

const toast = useToast()
const authStore = useAuthStore()
// State
const loading = ref(false)
const sending = ref(false)
const propertyAddress = ref('')
const recipientName = ref('')
const recipientEmail = ref('')
const dueDate = ref('')

const editableAmounts = ref({
  firstMonthRent: 0,
  deposit: 0,
  holdingDeposit: 0,
  additionalCharges: [] as { name: string; amount: number }[]
})

// Computed
const additionalChargesTotal = computed(() => {
  return editableAmounts.value.additionalCharges.reduce((sum, c) => sum + (c.amount || 0), 0)
})

const totalDue = computed(() => {
  return (
    (editableAmounts.value.firstMonthRent || 0) +
    (editableAmounts.value.deposit || 0) +
    additionalChargesTotal.value -
    (editableAmounts.value.holdingDeposit || 0)
  )
})

// Load data when modal opens
watch(() => props.show, async (isOpen) => {
  if (isOpen && props.tenancy) {
    await loadInitialData()
  }
})

const loadInitialData = async () => {
  if (!props.tenancy) return

  loading.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    // Get preview data from backend
    const response = await fetch(
      `${API_URL}/api/tenancies/records/${props.tenancy.id}/initial-monies-preview`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )

    if (response.ok) {
      const data = await response.json()

      propertyAddress.value = data.propertyAddress || ''
      recipientName.value = data.recipientName || ''
      recipientEmail.value = data.recipientEmail || ''
      dueDate.value = data.dueDate || getDefaultDueDate()

      editableAmounts.value = {
        firstMonthRent: data.firstMonthRent || props.tenancy.monthly_rent || props.tenancy.rent_amount || 0,
        deposit: data.depositAmount || props.tenancy.deposit_amount || 0,
        holdingDeposit: data.holdingDepositPaid || 0,
        additionalCharges: (data.additionalCharges || []).map((c: any) => ({
          name: c.name,
          amount: c.amount
        }))
      }
    } else {
      // Fallback to tenancy data
      const tenants = props.tenancy.tenants || []
      const leadTenant = tenants.find((t: any) => t.is_lead_tenant && t.email) || tenants.find((t: any) => t.email)

      propertyAddress.value = [
        props.tenancy.property?.address_line1,
        props.tenancy.property?.city,
        props.tenancy.property?.postcode
      ].filter(Boolean).join(', ')

      recipientName.value = leadTenant ? `${leadTenant.first_name} ${leadTenant.last_name}`.trim() : ''
      recipientEmail.value = leadTenant?.email || ''
      dueDate.value = getDefaultDueDate()

      editableAmounts.value = {
        firstMonthRent: props.tenancy.monthly_rent || props.tenancy.rent_amount || 0,
        deposit: props.tenancy.deposit_amount || 0,
        holdingDeposit: 0,
        additionalCharges: (props.tenancy.additional_charges || [])
          .filter((c: any) => c.frequency === 'one_time')
          .map((c: any) => ({ name: c.name, amount: c.amount }))
      }
    }
  } catch (err) {
    console.error('Error loading initial monies data:', err)
    // Use tenancy data as fallback
    const tenants = props.tenancy?.tenants || []
    const leadTenant = tenants.find((t: any) => t.is_lead_tenant && t.email) || tenants.find((t: any) => t.email)

    propertyAddress.value = [
      props.tenancy?.property?.address_line1,
      props.tenancy?.property?.city,
      props.tenancy?.property?.postcode
    ].filter(Boolean).join(', ')

    recipientName.value = leadTenant ? `${leadTenant.first_name} ${leadTenant.last_name}`.trim() : ''
    recipientEmail.value = leadTenant?.email || ''
    dueDate.value = getDefaultDueDate()

    editableAmounts.value = {
      firstMonthRent: props.tenancy?.monthly_rent || props.tenancy?.rent_amount || 0,
      deposit: props.tenancy?.deposit_amount || 0,
      holdingDeposit: 0,
      additionalCharges: []
    }
  } finally {
    loading.value = false
  }
}

const getDefaultDueDate = (): string => {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  return date.toISOString().split('T')[0] ?? ''
}

const addCharge = () => {
  editableAmounts.value.additionalCharges.push({ name: '', amount: 0 })
}

const removeCharge = (index: number) => {
  editableAmounts.value.additionalCharges.splice(index, 1)
}

const sendRequest = async () => {
  if (!props.tenancy) return

  sending.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${props.tenancy.id}/request-initial-monies`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firstMonthRent: editableAmounts.value.firstMonthRent,
          depositAmount: editableAmounts.value.deposit,
          holdingDepositPaid: editableAmounts.value.holdingDeposit,
          additionalCharges: editableAmounts.value.additionalCharges.filter(c => c.name && c.amount > 0),
          dueDate: dueDate.value
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to send request')
    }

    const result = await response.json()
    toast.success(`Payment request sent to ${result.emailSentTo}`)
    emit('sent')
    emit('close')
  } catch (err: any) {
    console.error('Error sending initial monies request:', err)
    toast.error(err.message || 'Failed to send request')
  } finally {
    sending.value = false
  }
}
</script>

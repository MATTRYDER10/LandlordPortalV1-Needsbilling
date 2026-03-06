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

                <!-- Rent Up Front Toggle -->
                <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-3">
                  <div class="flex items-center justify-between gap-4">
                    <div>
                      <label class="text-sm font-medium text-gray-700 dark:text-slate-300">Rent Up Front</label>
                      <p class="text-xs text-gray-500 dark:text-slate-400">Charge multiple months rent upfront</p>
                    </div>
                    <button
                      type="button"
                      @click="rentUpFront = !rentUpFront"
                      :class="[
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                        rentUpFront ? 'bg-primary' : 'bg-gray-300 dark:bg-slate-600'
                      ]"
                    >
                      <span
                        :class="[
                          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                          rentUpFront ? 'translate-x-6' : 'translate-x-1'
                        ]"
                      />
                    </button>
                  </div>
                  <!-- Term months input when rent up front is enabled -->
                  <div v-if="rentUpFront" class="flex items-center gap-3">
                    <label class="text-sm text-gray-700 dark:text-slate-300 whitespace-nowrap">Number of months:</label>
                    <input
                      v-model.number="termMonths"
                      type="number"
                      min="1"
                      max="60"
                      class="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
                      @change="recalculateRentUpFront"
                    />
                    <span class="text-xs text-gray-500 dark:text-slate-400">
                      (£{{ (monthlyRent * termMonths).toLocaleString() }} total)
                    </span>
                  </div>
                </div>

                <!-- Pro-rata info if applicable -->
                <div v-if="hasProRata && proRataAmount > 0 && !rentUpFront" class="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <p class="text-xs text-amber-800 dark:text-amber-200">
                    <strong>Pro-rata included:</strong> Move-in on {{ formatDate(moveInDate) }}, rent due {{ rentDueDay }}{{ getDaySuffix(rentDueDay) }} of each month.
                    Pro-rata amount: £{{ proRataAmount.toFixed(2) }}
                  </p>
                </div>

                <!-- Rent Amount -->
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <label class="text-sm text-gray-700 dark:text-slate-300">{{ rentLabel }}</label>
                    <p v-if="!rentUpFront" class="text-xs text-gray-500 dark:text-slate-400">Monthly: £{{ monthlyRent.toLocaleString() }}</p>
                  </div>
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

// Rent up front option
const rentUpFront = ref(false)
const monthlyRent = ref(0)
const termMonths = ref(12)
const proRataAmount = ref(0)
const hasProRata = ref(false)
const moveInDate = ref('')
const rentDueDay = ref(1)

// Watch for rent up front toggle
watch(rentUpFront, (upFront) => {
  if (upFront) {
    // Calculate full term rent
    editableAmounts.value.firstMonthRent = monthlyRent.value * termMonths.value
  } else {
    // Reset to monthly rent (plus pro-rata if applicable)
    editableAmounts.value.firstMonthRent = monthlyRent.value + proRataAmount.value
  }
})

// Recalculate when term months changes
const recalculateRentUpFront = () => {
  if (rentUpFront.value) {
    editableAmounts.value.firstMonthRent = monthlyRent.value * termMonths.value
  }
}


// Computed
const additionalChargesTotal = computed(() => {
  return editableAmounts.value.additionalCharges.reduce((sum, c) => sum + (c.amount || 0), 0)
})

// Label for rent field
const rentLabel = computed(() => {
  if (rentUpFront.value) {
    return `Full Term Rent (${termMonths.value} months)`
  }
  if (hasProRata.value && proRataAmount.value > 0) {
    return "First Month's Rent (inc. pro-rata)"
  }
  return "First Month's Rent"
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

      // Store base values for calculations
      monthlyRent.value = data.monthlyRent || data.firstMonthRent || props.tenancy.monthly_rent || props.tenancy.rent_amount || 0
      termMonths.value = data.termMonths || 12
      moveInDate.value = data.moveInDate || props.tenancy.start_date || ''
      rentDueDay.value = data.rentDueDay || props.tenancy.rent_due_day || 1
      proRataAmount.value = data.proRataAmount || 0
      hasProRata.value = data.hasProRata || false

      // First month rent includes pro-rata if applicable
      const firstMonthWithProRata = monthlyRent.value + (proRataAmount.value || 0)

      editableAmounts.value = {
        firstMonthRent: data.firstMonthRent || firstMonthWithProRata,
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

      // Calculate term months from dates
      const rent = props.tenancy.monthly_rent || props.tenancy.rent_amount || 0
      monthlyRent.value = rent
      moveInDate.value = props.tenancy.start_date || ''
      rentDueDay.value = props.tenancy.rent_due_day || 1

      // Calculate term from start/end dates
      if (props.tenancy.start_date && props.tenancy.end_date) {
        const start = new Date(props.tenancy.start_date)
        const end = new Date(props.tenancy.end_date)
        const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
        termMonths.value = months > 0 ? months : 12
      } else {
        termMonths.value = 12
      }

      // Calculate pro-rata if rent due day differs from move-in day
      const calculatedProRata = calculateProRata(rent, moveInDate.value, rentDueDay.value)
      proRataAmount.value = calculatedProRata.amount
      hasProRata.value = calculatedProRata.hasProRata

      editableAmounts.value = {
        firstMonthRent: rent + proRataAmount.value,
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

    // Calculate term months from dates
    const rent = props.tenancy?.monthly_rent || props.tenancy?.rent_amount || 0
    monthlyRent.value = rent
    moveInDate.value = props.tenancy?.start_date || ''
    rentDueDay.value = props.tenancy?.rent_due_day || 1

    // Calculate term from start/end dates
    if (props.tenancy?.start_date && props.tenancy?.end_date) {
      const start = new Date(props.tenancy.start_date)
      const end = new Date(props.tenancy.end_date)
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
      termMonths.value = months > 0 ? months : 12
    } else {
      termMonths.value = 12
    }

    // Calculate pro-rata if rent due day differs from move-in day
    const calculatedProRata = calculateProRata(rent, moveInDate.value, rentDueDay.value)
    proRataAmount.value = calculatedProRata.amount
    hasProRata.value = calculatedProRata.hasProRata

    editableAmounts.value = {
      firstMonthRent: rent + proRataAmount.value,
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

const formatDate = (dateStr: string): string => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const getDaySuffix = (day: number): string => {
  if (day >= 11 && day <= 13) return 'th'
  switch (day % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

// Calculate pro-rata rent when move-in day differs from rent due day
const calculateProRata = (rent: number, moveIn: string, dueDay: number): { amount: number; hasProRata: boolean } => {
  if (!moveIn || !rent || !dueDay) return { amount: 0, hasProRata: false }

  const moveInDate = new Date(moveIn)
  const moveInDay = moveInDate.getDate()

  // If move-in is on rent due day, no pro-rata needed
  if (moveInDay === dueDay) return { amount: 0, hasProRata: false }

  // Calculate days from move-in to next rent due date
  const daysInMonth = new Date(moveInDate.getFullYear(), moveInDate.getMonth() + 1, 0).getDate()
  const dailyRate = rent / daysInMonth

  let proRataDays: number
  if (moveInDay < dueDay) {
    // Move-in before due day in same month
    proRataDays = dueDay - moveInDay
  } else {
    // Move-in after due day, pro-rata to next month's due day
    proRataDays = (daysInMonth - moveInDay) + dueDay
  }

  const proRataAmount = Math.round(dailyRate * proRataDays * 100) / 100
  return { amount: proRataAmount, hasProRata: true }
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
          dueDate: dueDate.value,
          // For payment_requests table
          rentUpFront: rentUpFront.value,
          termMonths: termMonths.value,
          monthlyRent: monthlyRent.value,
          proRataAmount: proRataAmount.value
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

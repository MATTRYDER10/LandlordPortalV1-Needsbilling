<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { X, Calendar, Calculator, Send, AlertTriangle } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { API_URL } from '@/lib/apiUrl'

const props = defineProps<{
  isOpen: boolean
  tenancyId: string
  currentDueDay: number
  monthlyRent: number
  propertyAddress: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success', change: any): void
}>()

const authStore = useAuthStore()

const newDueDay = ref<number | null>(null)
const adminFee = ref(0)
const isSubmitting = ref(false)
const error = ref('')

// Calculate pro-rata when newDueDay changes
const calculation = computed(() => {
  if (!newDueDay.value || newDueDay.value === props.currentDueDay) {
    return null
  }

  const today = new Date()
  let effectiveMonth = today.getMonth() + 1
  let effectiveYear = today.getFullYear()

  // If we're past the current due day this month, effective date is next month
  if (today.getDate() > props.currentDueDay) {
    effectiveMonth++
    if (effectiveMonth > 12) {
      effectiveMonth = 1
      effectiveYear++
    }
  }

  // Calculate days between current due day and new due day
  const daysInEffectiveMonth = new Date(effectiveYear, effectiveMonth, 0).getDate()

  let proRataDays: number
  if (newDueDay.value > props.currentDueDay) {
    proRataDays = newDueDay.value - props.currentDueDay
  } else {
    // Wrapping around to next month
    proRataDays = (daysInEffectiveMonth - props.currentDueDay) + newDueDay.value
  }

  // Calculate daily rate: (monthly_rent × 12) / 365
  const dailyRate = (props.monthlyRent * 12) / 365
  const proRataAmount = dailyRate * proRataDays
  const totalAmount = proRataAmount + adminFee.value

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  return {
    proRataDays,
    dailyRate,
    proRataAmount,
    totalAmount,
    effectiveDate: `${newDueDay.value}${getDaySuffix(newDueDay.value)} ${monthNames[effectiveMonth - 1]} ${effectiveYear}`
  }
})

function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th'
  switch (day % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

function formatCurrency(amount: number): string {
  return amount.toFixed(2)
}

// Generate day options (1-28)
const dayOptions = Array.from({ length: 28 }, (_, i) => i + 1)

// Reset state when modal opens
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    newDueDay.value = null
    adminFee.value = 0
    error.value = ''
  }
})

async function handleSubmit() {
  console.log('[RentDueDateChange] handleSubmit called', {
    tenancyId: props.tenancyId,
    newDueDay: newDueDay.value,
    adminFee: adminFee.value
  })

  if (!newDueDay.value || !calculation.value) return

  isSubmitting.value = true
  error.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) {
      throw new Error('Not authenticated')
    }

    console.log('[RentDueDateChange] Making POST request...')
    // Use direct fetch without admin override header to match TenancyDetailDrawer behavior
    const response = await fetch(
      `${API_URL}/api/tenancies/records/${props.tenancyId}/rent-due-date-change`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          newDueDay: newDueDay.value,
          adminFee: adminFee.value
        })
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }))
      throw new Error(errorData.error || 'Request failed')
    }

    const data = await response.json()
    console.log('[RentDueDateChange] Response:', data)

    emit('success', data.change)
    emit('close')
  } catch (err: any) {
    console.error('[RentDueDateChange] Error:', err)
    error.value = err.message || 'Failed to initiate rent due date change'
  } finally {
    isSubmitting.value = false
  }
}
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
          @click="emit('close')"
        />

        <!-- Modal -->
        <div class="relative w-full max-w-lg bg-white rounded-xl shadow-2xl">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-orange-100 rounded-lg">
                <Calendar class="w-5 h-5 text-orange-600" />
              </div>
              <h2 class="text-lg font-semibold text-gray-900">Change Rent Due Date</h2>
            </div>
            <button
              @click="emit('close')"
              class="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Content -->
          <div class="p-6 space-y-6">
            <!-- Property Address -->
            <div class="p-3 bg-gray-50 rounded-lg">
              <p class="text-sm text-gray-500">Property</p>
              <p class="font-medium text-gray-900">{{ propertyAddress }}</p>
            </div>

            <!-- Current Due Day -->
            <div class="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div>
                <p class="text-sm text-blue-600">Current rent due date</p>
                <p class="text-lg font-semibold text-blue-900">{{ currentDueDay }}{{ getDaySuffix(currentDueDay) }} of each month</p>
              </div>
              <div class="text-2xl text-blue-400">
                {{ currentDueDay }}
              </div>
            </div>

            <!-- New Due Day Selection -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                New rent due date
              </label>
              <select
                v-model="newDueDay"
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option :value="null">Select new due date...</option>
                <option
                  v-for="day in dayOptions"
                  :key="day"
                  :value="day"
                  :disabled="day === currentDueDay"
                >
                  {{ day }}{{ getDaySuffix(day) }} of each month {{ day === currentDueDay ? '(current)' : '' }}
                </option>
              </select>
            </div>

            <!-- Pro-Rata Calculation -->
            <Transition name="fade">
              <div v-if="calculation" class="space-y-4">
                <div class="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <div class="flex items-start gap-3">
                    <Calculator class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div class="flex-1">
                      <h4 class="font-medium text-amber-900">Pro-rata calculation</h4>
                      <p class="text-sm text-amber-700 mt-1">
                        To adjust the payment cycle, a pro-rata payment is required.
                      </p>
                      <div class="mt-3 space-y-2 text-sm">
                        <div class="flex justify-between">
                          <span class="text-amber-700">Monthly rent</span>
                          <span class="font-medium text-amber-900">£{{ formatCurrency(monthlyRent) }}</span>
                        </div>
                        <div class="flex justify-between">
                          <span class="text-amber-700">Daily rate (£{{ formatCurrency(monthlyRent) }} × 12 ÷ 365)</span>
                          <span class="font-medium text-amber-900">£{{ formatCurrency(calculation.dailyRate) }}</span>
                        </div>
                        <div class="flex justify-between">
                          <span class="text-amber-700">Days to cover</span>
                          <span class="font-medium text-amber-900">{{ calculation.proRataDays }} days</span>
                        </div>
                        <div class="flex justify-between">
                          <span class="text-amber-700">Pro-rata amount</span>
                          <span class="font-medium text-amber-900">£{{ formatCurrency(calculation.proRataAmount) }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Admin Fee -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Administration fee (optional)
                  </label>
                  <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                    <input
                      v-model.number="adminFee"
                      type="number"
                      min="0"
                      max="50"
                      step="1"
                      class="w-full pl-7 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      @keydown.enter.prevent
                    />
                  </div>
                  <p class="mt-1 text-xs text-gray-500">
                    Maximum £50 (Tenant Fee Ban Act 2019)
                  </p>
                </div>

                <!-- Total -->
                <div class="p-4 bg-gray-900 rounded-lg">
                  <div class="flex justify-between items-center">
                    <div>
                      <p class="text-gray-400 text-sm">Total payment required</p>
                      <p class="text-gray-300 text-xs mt-0.5">
                        Effective from {{ calculation.effectiveDate }}
                      </p>
                    </div>
                    <p class="text-2xl font-bold text-white">
                      £{{ formatCurrency(calculation.totalAmount) }}
                    </p>
                  </div>
                </div>
              </div>
            </Transition>

            <!-- Error -->
            <div v-if="error" class="p-4 bg-red-50 rounded-lg border border-red-200">
              <div class="flex items-center gap-2 text-red-700">
                <AlertTriangle class="w-5 h-5" />
                <p class="text-sm font-medium">{{ error }}</p>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <button
              type="button"
              @click="emit('close')"
              class="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              :disabled="isSubmitting"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="handleSubmit"
              :disabled="!calculation || isSubmitting"
              class="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send class="w-4 h-4" />
              {{ isSubmitting ? 'Sending...' : 'Send Payment Request' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
  transform: scale(0.95) translateY(10px);
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>

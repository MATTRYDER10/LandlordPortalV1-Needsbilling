<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { X, Clock, Send, User, CalendarDays, Loader2, AlertTriangle } from 'lucide-vue-next'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '@/stores/auth'
import { API_URL } from '@/lib/apiUrl'

const props = defineProps<{
  isOpen: boolean
  tenancyId: string
  propertyAddress: string
  moveInDate: string
  tenantName: string
  tenantEmail: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success'): void
}>()

const toast = useToast()
const authStore = useAuthStore()
// Mode: 'tenant_chooses' or 'agent_suggests'
const mode = ref<'tenant_chooses' | 'agent_suggests'>('tenant_chooses')

// Agent suggested date and times
const suggestedDate = ref('')
const suggestedTime1 = ref('')
const suggestedTime2 = ref('')

const isSubmitting = ref(false)
const error = ref('')

// Time slots (30-minute intervals from 8am to 6pm)
const timeSlots = [
  '8:00 AM',
  '8:30 AM',
  '9:00 AM',
  '9:30 AM',
  '10:00 AM',
  '10:30 AM',
  '11:00 AM',
  '11:30 AM',
  '12:00 PM',
  '12:30 PM',
  '1:00 PM',
  '1:30 PM',
  '2:00 PM',
  '2:30 PM',
  '3:00 PM',
  '3:30 PM',
  '4:00 PM',
  '4:30 PM',
  '5:00 PM',
  '5:30 PM',
  '6:00 PM'
]

// Check if selected date is a Sunday
const isSunday = computed(() => {
  if (!suggestedDate.value) return false
  const date = new Date(suggestedDate.value)
  return date.getDay() === 0
})

// Format date for display
const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return 'TBC'
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

const formattedMoveInDate = computed(() => formatDateDisplay(props.moveInDate))
const formattedSuggestedDate = computed(() => formatDateDisplay(suggestedDate.value))

// Get minimum date (today)
const minDate = computed(() => {
  const today = new Date()
  return today.toISOString().split('T')[0]
})

const canSubmit = computed(() => {
  if (mode.value === 'tenant_chooses') {
    return true
  }
  // Agent suggests mode requires date, both times, times must be different, and not Sunday
  return suggestedDate.value &&
         suggestedTime1.value &&
         suggestedTime2.value &&
         suggestedTime1.value !== suggestedTime2.value &&
         !isSunday.value
})

// Reset state when modal opens
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    mode.value = 'tenant_chooses'
    // Default to move-in date
    suggestedDate.value = props.moveInDate ? props.moveInDate.split('T')[0]! : ''
    suggestedTime1.value = ''
    suggestedTime2.value = ''
    error.value = ''
  }
})

async function handleSubmit() {
  if (!canSubmit.value) return

  if (mode.value === 'agent_suggests' && isSunday.value) {
    error.value = 'Sunday move-ins are not available. Please select a different date.'
    return
  }

  isSubmitting.value = true
  error.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const body: any = {
      mode: mode.value
    }

    if (mode.value === 'agent_suggests') {
      body.suggestedDate = suggestedDate.value
      body.suggestedTime1 = suggestedTime1.value
      body.suggestedTime2 = suggestedTime2.value
    }

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${props.tenancyId}/request-move-in-time`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    )

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || 'Failed to send request')
    }

    const result = await response.json()

    if (mode.value === 'agent_suggests') {
      toast.success(`Time options sent to ${result.emailSentTo}`)
    } else {
      toast.success(`Move-in time request sent to ${result.emailSentTo}`)
    }

    emit('success')
    emit('close')
  } catch (err: any) {
    console.error('[RequestMoveInTime] Error:', err)
    error.value = err.message || 'Failed to send request'
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
        <div class="relative w-full max-w-lg bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-amber-100 rounded-lg">
                <Clock class="w-5 h-5 text-amber-600" />
              </div>
              <h2 class="text-lg font-semibold text-gray-900">Request Move-in Time</h2>
            </div>
            <button
              @click="emit('close')"
              class="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Content -->
          <div class="p-6 space-y-5">
            <!-- Property & Date Info -->
            <div class="flex items-start gap-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <CalendarDays class="w-10 h-10 text-amber-600 flex-shrink-0" />
              <div>
                <p class="text-sm text-amber-700">Tenancy Start Date</p>
                <p class="font-semibold text-amber-900">{{ formattedMoveInDate }}</p>
                <p class="text-sm text-amber-700 mt-1">{{ propertyAddress }}</p>
              </div>
            </div>

            <!-- Recipient -->
            <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <User class="w-5 h-5 text-gray-500" />
              <div>
                <p class="text-xs text-gray-500 uppercase">Sending to</p>
                <p class="font-medium text-gray-900">{{ tenantName }}</p>
                <p class="text-sm text-gray-600">{{ tenantEmail }}</p>
              </div>
            </div>

            <!-- Mode Selection -->
            <div class="space-y-3">
              <p class="text-sm font-medium text-gray-700 dark:text-slate-200">How would you like to set the move-in time?</p>

              <!-- Option 1: Let tenant choose -->
              <label
                class="flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all"
                :class="mode === 'tenant_chooses' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'"
              >
                <input
                  type="radio"
                  v-model="mode"
                  value="tenant_chooses"
                  class="mt-1 text-primary focus:ring-primary"
                />
                <div>
                  <p class="font-medium text-gray-900">Let tenant choose</p>
                  <p class="text-sm text-gray-500 mt-0.5">
                    Send a link for the tenant to select their preferred date and time
                  </p>
                </div>
              </label>

              <!-- Option 2: Agent suggests times -->
              <label
                class="flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all"
                :class="mode === 'agent_suggests' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'"
              >
                <input
                  type="radio"
                  v-model="mode"
                  value="agent_suggests"
                  class="mt-1 text-primary focus:ring-primary"
                />
                <div>
                  <p class="font-medium text-gray-900">Suggest date and times</p>
                  <p class="text-sm text-gray-500 mt-0.5">
                    Offer a specific date with two time options for the tenant to choose from
                  </p>
                </div>
              </label>
            </div>

            <!-- Date & Time Selection (only shown when agent suggests) -->
            <Transition name="slide">
              <div v-if="mode === 'agent_suggests'" class="space-y-4 pt-2">
                <!-- Date Selection -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Move-in Date
                  </label>
                  <input
                    type="date"
                    v-model="suggestedDate"
                    :min="minDate"
                    class="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                  <p v-if="suggestedDate" class="mt-1.5 text-sm text-gray-600">
                    {{ formattedSuggestedDate }}
                  </p>
                </div>

                <!-- Sunday Warning -->
                <div v-if="isSunday" class="p-4 bg-red-50 rounded-lg border border-red-200">
                  <div class="flex items-start gap-3">
                    <AlertTriangle class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p class="font-medium text-red-800">Sunday move-ins not available</p>
                      <p class="text-sm text-red-700 mt-1">
                        We don't offer move-ins on Sundays. Please select a different date, or ask the tenant to contact you directly to discuss alternative arrangements.
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Time Options -->
                <div v-if="!isSunday" class="grid grid-cols-2 gap-4">
                  <!-- Time Option 1 -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                      Time Option 1
                    </label>
                    <select
                      v-model="suggestedTime1"
                      class="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    >
                      <option value="">Select time...</option>
                      <option
                        v-for="slot in timeSlots"
                        :key="slot"
                        :value="slot"
                        :disabled="slot === suggestedTime2"
                      >
                        {{ slot }}
                      </option>
                    </select>
                  </div>

                  <!-- Time Option 2 -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                      Time Option 2
                    </label>
                    <select
                      v-model="suggestedTime2"
                      class="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    >
                      <option value="">Select time...</option>
                      <option
                        v-for="slot in timeSlots"
                        :key="slot"
                        :value="slot"
                        :disabled="slot === suggestedTime1"
                      >
                        {{ slot }}
                      </option>
                    </select>
                  </div>
                </div>

                <p v-if="!isSunday" class="text-xs text-gray-500">
                  The tenant will receive an email with these two time options to choose from.
                </p>
              </div>
            </Transition>

            <!-- Error -->
            <div v-if="error" class="p-3 bg-red-50 rounded-lg border border-red-200">
              <p class="text-sm text-red-700">{{ error }}</p>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl sticky bottom-0">
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
              :disabled="!canSubmit || isSubmitting"
              class="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Loader2 v-if="isSubmitting" class="w-4 h-4 animate-spin" />
              <Send v-else class="w-4 h-4" />
              {{ isSubmitting ? 'Sending...' : 'Send Request' }}
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

.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>

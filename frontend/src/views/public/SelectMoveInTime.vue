<template>
  <div class="min-h-screen bg-gray-50 dark:bg-slate-800 py-12 px-4">
    <div class="max-w-lg mx-auto">
      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <Loader2 class="w-8 h-8 animate-spin mx-auto" :style="{ color: primaryColor }" />
        <p class="mt-4 text-gray-500 dark:text-slate-400">Loading...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 text-center">
        <AlertCircle class="w-12 h-12 mx-auto text-red-500 mb-4" />
        <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Unable to Load</h1>
        <p class="text-gray-600 dark:text-slate-400">{{ error }}</p>
      </div>

      <!-- Already Submitted State -->
      <div v-else-if="alreadySubmitted" class="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 text-center">
        <CheckCircle class="w-16 h-16 mx-auto text-green-500 mb-4" />
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Already Submitted</h1>
        <p class="text-gray-600 dark:text-slate-400 mb-4">You've already submitted your move-in time preferences.</p>
        <div class="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-4 mt-4">
          <p class="text-sm text-green-800 dark:text-green-300">
            <strong>Option 1:</strong> {{ submittedSlot1 }}<br>
            <strong>Option 2:</strong> {{ submittedSlot2 }}
          </p>
        </div>
        <p class="text-sm text-gray-500 dark:text-slate-400 mt-4">
          The letting agent will confirm your move-in time shortly.
        </p>
      </div>

      <!-- Success State -->
      <div v-else-if="submitted" class="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 text-center">
        <CheckCircle class="w-16 h-16 mx-auto text-green-500 mb-4" />
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Thank You!</h1>
        <p class="text-gray-600 dark:text-slate-400 mb-4">Your move-in time preferences have been submitted.</p>
        <div class="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-4">
          <p class="text-sm text-green-800 dark:text-green-300">
            <strong>Date:</strong> {{ formatDateDisplay(selectedDate) }}<br>
            <strong>Option 1:</strong> {{ selectedSlot1 }}<br>
            <strong>Option 2:</strong> {{ selectedSlot2 }}
          </p>
        </div>
        <p class="text-sm text-gray-500 dark:text-slate-400 mt-6">
          {{ companyName }} will confirm your move-in time shortly.
        </p>
      </div>

      <!-- Form -->
      <div v-else class="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden">
        <!-- Header with logo -->
        <div class="px-4 sm:px-8 py-6 border-b border-gray-200 dark:border-slate-700 text-center">
          <img
            v-if="companyLogoUrl"
            :src="companyLogoUrl"
            :alt="companyName"
            class="h-12 mx-auto mb-4"
          />
          <template v-else>
            <img src="/PropertyGooseLogo.png" alt="PropertyGoose" class="h-12 mx-auto mb-4 dark:hidden" />
            <img src="/PropertyGooseLogoDark.png" alt="PropertyGoose" class="h-12 mx-auto mb-4 hidden dark:block" />
          </template>
          <h1 class="text-xl font-bold text-gray-900 dark:text-white">Choose Your Move-In Time</h1>
        </div>

        <!-- Property Info -->
        <div class="px-4 sm:px-8 py-4 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
          <p class="text-sm text-gray-500 dark:text-slate-400 text-center">Property</p>
          <p class="text-center font-medium text-gray-900 dark:text-white">{{ propertyAddress }}</p>
        </div>

        <!-- Form Content -->
        <form @submit.prevent="submitForm" class="px-4 sm:px-8 py-6 space-y-6">
          <p class="text-gray-600 dark:text-slate-400">
            Please select your preferred move-in date and two time slots. We'll confirm your slot as soon as possible.
          </p>

          <!-- Date Selection -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Move-in Date <span class="text-red-500">*</span>
            </label>
            <input
              type="date"
              v-model="selectedDate"
              :min="minDate"
              required
              class="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary text-lg dark:bg-slate-900 dark:text-white"
            />
            <p v-if="selectedDate" class="mt-2 text-sm text-gray-600 dark:text-slate-400">
              {{ formatDateDisplay(selectedDate) }}
            </p>
          </div>

          <!-- Sunday Warning -->
          <div v-if="isSunday" class="p-4 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-700">
            <div class="flex items-start gap-3">
              <AlertTriangle class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p class="font-medium text-red-800 dark:text-red-300">Sunday move-ins not available</p>
                <p class="text-sm text-red-700 dark:text-red-400 mt-1">
                  We don't offer move-ins on Sundays. Please select a different date.
                </p>
                <p class="text-sm text-red-700 dark:text-red-400 mt-2">
                  If you need to arrange a Sunday move-in, please contact <strong>{{ companyName }}</strong> directly.
                </p>
              </div>
            </div>
          </div>

          <!-- Time Slots (hidden if Sunday) -->
          <template v-if="!isSunday">
            <!-- Time Slot 1 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                First Preference <span class="text-red-500">*</span>
              </label>
              <select
                v-model="selectedSlot1"
                required
                class="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary text-lg dark:bg-slate-900 dark:text-white"
              >
                <option value="" disabled>Select a time...</option>
                <option v-for="slot in timeSlots" :key="slot" :value="slot" :disabled="slot === selectedSlot2">
                  {{ slot }}
                </option>
              </select>
            </div>

            <!-- Time Slot 2 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Second Preference <span class="text-red-500">*</span>
              </label>
              <select
                v-model="selectedSlot2"
                required
                class="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary text-lg dark:bg-slate-900 dark:text-white"
              >
                <option value="" disabled>Select a time...</option>
                <option v-for="slot in timeSlots" :key="slot" :value="slot" :disabled="slot === selectedSlot1">
                  {{ slot }}
                </option>
              </select>
            </div>

            <!-- Notes -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Additional Notes (optional)
              </label>
              <textarea
                v-model="notes"
                rows="3"
                placeholder="Any special requirements or notes..."
                class="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white dark:placeholder-slate-500"
              ></textarea>
            </div>

            <!-- Submit Button -->
            <button
              type="submit"
              :disabled="submitting || !canSubmit"
              :style="{ backgroundColor: buttonColor }"
              class="w-full py-4 text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Loader2 v-if="submitting" class="w-5 h-5 animate-spin" />
              <span>{{ submitting ? 'Submitting...' : 'Submit Preferences' }}</span>
            </button>
          </template>
        </form>

        <!-- Footer -->
        <div class="px-4 sm:px-8 py-4 bg-gray-50 dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 text-center">
          <p class="text-xs text-gray-500 dark:text-slate-400">
            Powered by <a href="https://propertygoose.co.uk" :style="{ color: primaryColor }" class="hover:underline">PropertyGoose</a>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Loader2, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL ?? ''

const route = useRoute()
// State
const loading = ref(true)
const error = ref<string | null>(null)
const submitting = ref(false)
const submitted = ref(false)
const alreadySubmitted = ref(false)

// Form data
const tenancyId = ref('')
const moveInDate = ref('')
const propertyAddress = ref('')
const companyName = ref('')
const companyLogoUrl = ref<string | null>(null)
const primaryColor = ref('#fe7a0f')
const buttonColor = ref('#fe7a0f')
const selectedDate = ref('')
const selectedSlot1 = ref('')
const selectedSlot2 = ref('')
const submittedSlot1 = ref('')
const submittedSlot2 = ref('')
const notes = ref('')

// Time slots (30-minute intervals)
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

// Get minimum date (today)
const minDate = computed(() => {
  const today = new Date()
  return today.toISOString().split('T')[0]
})

// Check if selected date is a Sunday
const isSunday = computed(() => {
  if (!selectedDate.value) return false
  const date = new Date(selectedDate.value)
  return date.getDay() === 0
})

// Can submit form
const canSubmit = computed(() => {
  return selectedDate.value &&
         !isSunday.value &&
         selectedSlot1.value &&
         selectedSlot2.value &&
         selectedSlot1.value !== selectedSlot2.value
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

// Load form data
onMounted(async () => {
  tenancyId.value = route.params.id as string

  try {
    const response = await fetch(`${API_URL}/api/tenancies/public/${tenancyId.value}/move-in-time-form`)

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to load form')
    }

    const data = await response.json()
    moveInDate.value = data.moveInDate
    propertyAddress.value = data.propertyAddress
    companyName.value = data.companyName
    companyLogoUrl.value = data.companyLogoUrl
    primaryColor.value = data.primaryColor || '#fe7a0f'
    buttonColor.value = data.buttonColor || '#fe7a0f'

    // Default selected date to move-in date
    if (data.moveInDate) {
      selectedDate.value = data.moveInDate.split('T')[0]
    }

    if (data.alreadySubmitted) {
      alreadySubmitted.value = true
      submittedSlot1.value = data.submittedSlot1
      submittedSlot2.value = data.submittedSlot2
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load form'
  } finally {
    loading.value = false
  }
})

// Submit form
const submitForm = async () => {
  if (!canSubmit.value) return

  submitting.value = true
  try {
    const response = await fetch(`${API_URL}/api/tenancies/public/${tenancyId.value}/submit-move-in-time`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        moveInDate: selectedDate.value,
        timeSlot1: selectedSlot1.value,
        timeSlot2: selectedSlot2.value,
        notes: notes.value || null
      })
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to submit')
    }

    submitted.value = true
  } catch (err: any) {
    alert(err.message || 'Failed to submit preferences')
  } finally {
    submitting.value = false
  }
}
</script>

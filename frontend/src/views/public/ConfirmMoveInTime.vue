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

      <!-- Already Confirmed State -->
      <div v-else-if="alreadyConfirmed" class="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 text-center">
        <CheckCircle class="w-16 h-16 mx-auto text-green-500 mb-4" />
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Already Confirmed</h1>
        <p class="text-gray-600 dark:text-slate-400 mb-4">Your move-in time has already been confirmed.</p>
        <div class="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-4 mt-4">
          <p class="text-sm text-green-800 dark:text-green-300">
            <strong>Date:</strong> {{ formattedMoveInDate }}<br>
            <strong>Confirmed Time:</strong> {{ confirmedTime }}
          </p>
        </div>
        <p class="text-sm text-gray-500 dark:text-slate-400 mt-4">
          A calendar invite has been sent to your email.
        </p>
      </div>

      <!-- Success State -->
      <div v-else-if="confirmed" class="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 text-center">
        <CheckCircle class="w-16 h-16 mx-auto text-green-500 mb-4" />
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Confirmed!</h1>
        <p class="text-gray-600 dark:text-slate-400 mb-4">Your move-in time has been confirmed.</p>
        <div class="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-4">
          <p class="text-lg font-semibold text-green-800 dark:text-green-300">
            {{ selectedTime }}
          </p>
          <p class="text-sm text-green-700 dark:text-green-400 mt-1">
            on {{ formattedMoveInDate }}
          </p>
        </div>
        <p class="text-sm text-gray-500 dark:text-slate-400 mt-6">
          You'll receive a calendar invite with all the details shortly.
        </p>
      </div>

      <!-- Selection Form -->
      <div v-else class="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden">
        <!-- Header with logo -->
        <div class="px-8 py-6 border-b border-gray-200 dark:border-slate-700 text-center">
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
          <h1 class="text-xl font-bold text-gray-900 dark:text-white">Confirm Your Move-In Time</h1>
        </div>

        <!-- Property & Date Info -->
        <div class="px-8 py-6 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700">
          <div class="text-center">
            <p class="text-sm text-amber-800 dark:text-amber-300 uppercase tracking-wider mb-1">Move-In Date</p>
            <p class="text-2xl font-bold text-amber-900 dark:text-amber-200">{{ formattedMoveInDate }}</p>
            <p class="text-sm text-amber-700 dark:text-amber-400 mt-2">{{ propertyAddress }}</p>
          </div>
        </div>

        <!-- Form Content -->
        <div class="px-8 py-6 space-y-6">
          <p class="text-gray-600 dark:text-slate-400 text-center">
            {{ companyName }} has suggested the following time slots. Please confirm which one works best for you:
          </p>

          <!-- Time Options -->
          <div class="space-y-3">
            <!-- Option 1 -->
            <button
              @click="selectTime(timeSlot1)"
              :disabled="confirming"
              class="w-full p-5 rounded-xl border-2 transition-all text-left"
              :class="selectedTime === timeSlot1
                ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                : 'border-gray-200 dark:border-slate-700 hover:border-green-300 dark:hover:border-green-600 hover:bg-green-50/50 dark:hover:bg-green-900/20'"
            >
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">Option 1</span>
                  <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ timeSlot1 }}</p>
                </div>
                <div
                  class="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors"
                  :class="selectedTime === timeSlot1
                    ? 'border-green-500 bg-green-500'
                    : 'border-gray-300 dark:border-slate-600'"
                >
                  <Check v-if="selectedTime === timeSlot1" class="w-4 h-4 text-white" />
                </div>
              </div>
            </button>

            <!-- Option 2 -->
            <button
              @click="selectTime(timeSlot2)"
              :disabled="confirming"
              class="w-full p-5 rounded-xl border-2 transition-all text-left"
              :class="selectedTime === timeSlot2
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                : 'border-gray-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/20'"
            >
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">Option 2</span>
                  <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ timeSlot2 }}</p>
                </div>
                <div
                  class="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors"
                  :class="selectedTime === timeSlot2
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300 dark:border-slate-600'"
                >
                  <Check v-if="selectedTime === timeSlot2" class="w-4 h-4 text-white" />
                </div>
              </div>
            </button>
          </div>

          <!-- Confirm Button -->
          <button
            @click="confirmTime"
            :disabled="!selectedTime || confirming"
            :style="{ backgroundColor: buttonColor }"
            class="w-full py-4 text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Loader2 v-if="confirming" class="w-5 h-5 animate-spin" />
            <span>{{ confirming ? 'Confirming...' : 'Confirm Selected Time' }}</span>
          </button>

          <p class="text-sm text-gray-500 dark:text-slate-400 text-center">
            If neither time works, please contact {{ companyName }} directly to arrange an alternative.
          </p>
        </div>

        <!-- Footer -->
        <div class="px-8 py-4 bg-gray-50 dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 text-center">
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
import { Loader2, CheckCircle, AlertCircle, Check } from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL ?? ''

const route = useRoute()
// State
const loading = ref(true)
const error = ref<string | null>(null)
const confirming = ref(false)
const confirmed = ref(false)
const alreadyConfirmed = ref(false)

// Data
const tenancyId = ref('')
const moveInDate = ref('')
const propertyAddress = ref('')
const companyName = ref('')
const companyLogoUrl = ref<string | null>(null)
const primaryColor = ref('#fe7a0f')
const buttonColor = ref('#fe7a0f')
const timeSlot1 = ref('')
const timeSlot2 = ref('')
const confirmedTime = ref('')
const selectedTime = ref('')

// Computed
const formattedMoveInDate = computed(() => {
  if (!moveInDate.value) return 'TBC'
  return new Date(moveInDate.value).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
})

// Select time
const selectTime = (time: string) => {
  if (!confirming.value) {
    selectedTime.value = time
  }
}

// Load form data
onMounted(async () => {
  tenancyId.value = route.params.id as string

  try {
    const response = await fetch(`${API_URL}/api/tenancies/public/${tenancyId.value}/confirm-move-in-time-form`)

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to load')
    }

    const data = await response.json()
    moveInDate.value = data.moveInDate
    propertyAddress.value = data.propertyAddress
    companyName.value = data.companyName
    companyLogoUrl.value = data.companyLogoUrl
    primaryColor.value = data.primaryColor || '#fe7a0f'
    buttonColor.value = data.buttonColor || '#fe7a0f'
    timeSlot1.value = data.timeSlot1
    timeSlot2.value = data.timeSlot2

    if (data.alreadyConfirmed) {
      alreadyConfirmed.value = true
      confirmedTime.value = data.confirmedTime
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load'
  } finally {
    loading.value = false
  }
})

// Confirm time
const confirmTime = async () => {
  if (!selectedTime.value) return

  confirming.value = true
  try {
    const response = await fetch(`${API_URL}/api/tenancies/public/${tenancyId.value}/confirm-move-in-time`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        confirmedTime: selectedTime.value
      })
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to confirm')
    }

    confirmed.value = true
  } catch (err: any) {
    alert(err.message || 'Failed to confirm time')
  } finally {
    confirming.value = false
  }
}
</script>

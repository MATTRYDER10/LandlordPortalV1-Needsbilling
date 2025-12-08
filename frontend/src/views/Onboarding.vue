<template>
  <div class="min-h-screen bg-gradient-to-br from-orange-50 to-white flex items-center justify-center p-4">
    <div class="w-full max-w-4xl">
      <!-- Progress Bar -->
      <div v-if="currentStep > 0" class="mb-8">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-gray-700">Step {{ currentStep }} of 5</span>
          <span class="text-sm text-gray-500">{{ progressPercentage }}% complete</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2.5">
          <div
            class="bg-primary h-2.5 rounded-full transition-all duration-300"
            :style="{ width: progressPercentage + '%' }"
          ></div>
        </div>
      </div>

      <!-- Content Card -->
      <div class="bg-white rounded-xl shadow-lg p-8">
        <!-- Step Components -->
        <WelcomeStep
          v-if="currentStep === 0"
          @next="handleNext"
        />
        <PersonalInfoStep
          v-else-if="currentStep === 1"
          @next="handleNext"
          @back="handleBack"
        />
        <CompanyInfoStep
          v-else-if="currentStep === 2"
          @next="handleNext"
          @back="handleBack"
        />
        <BankDetailsStep
          v-else-if="currentStep === 3"
          @next="handleNext"
          @back="handleBack"
          @skip="handleSkip"
        />
        <BrandingStep
          v-else-if="currentStep === 4"
          @next="handleNext"
          @back="handleBack"
          @skip="handleSkip"
        />
        <PaymentSetupStep
          v-else-if="currentStep === 5"
          @complete="handleComplete"
          @back="handleBack"
        />

        <!-- Loading Overlay -->
        <div v-if="loading" class="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-xl">
          <div class="text-center">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p class="text-gray-600">{{ loadingMessage }}</p>
          </div>
        </div>
      </div>

      <!-- Save & Exit Option -->
      <div v-if="currentStep > 0" class="text-center mt-6">
        <button
          @click="handleSaveAndExit"
          class="text-sm text-gray-600 hover:text-gray-900 underline"
        >
          Save progress and continue later
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import axios from 'axios'
import WelcomeStep from '../components/onboarding/WelcomeStep.vue'
import PersonalInfoStep from '../components/onboarding/PersonalInfoStep.vue'
import CompanyInfoStep from '../components/onboarding/CompanyInfoStep.vue'
import BankDetailsStep from '../components/onboarding/BankDetailsStep.vue'
import BrandingStep from '../components/onboarding/BrandingStep.vue'
import PaymentSetupStep from '../components/onboarding/PaymentSetupStep.vue'

const router = useRouter()
const authStore = useAuthStore()

const currentStep = ref(0)
const loading = ref(false)
const loadingMessage = ref('Loading...')

const progressPercentage = computed(() => {
  return Math.round((currentStep.value / 5) * 100)
})

// Load saved progress on mount
onMounted(async () => {
  loading.value = true
  loadingMessage.value = 'Loading your progress...'

  try {
    const token = authStore.session?.access_token
    if (!token) {
      console.error('No access token available')
      router.push('/login')
      return
    }

    const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/onboarding/status`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    // If already completed or should skip, redirect to dashboard
    if (response.data.onboardingCompleted || response.data.shouldSkipOnboarding) {
      router.push('/dashboard')
      return
    }

    // Resume from saved step
    currentStep.value = response.data.currentStep || 0
  } catch (error: any) {
    console.error('Error loading onboarding status:', error)
    // Start from beginning if error
    currentStep.value = 0
  } finally {
    loading.value = false
  }
})

const saveProgress = async (step: number) => {
  try {
    const token = authStore.session?.access_token
    if (!token) {
      throw new Error('No access token available')
    }

    await axios.put(
      `${import.meta.env.VITE_API_URL}/api/onboarding/step`,
      { step },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )
  } catch (error: any) {
    console.error('Error saving onboarding progress:', error)
    throw error
  }
}

const handleNext = async () => {
  const nextStep = currentStep.value + 1

  loading.value = true
  loadingMessage.value = 'Saving progress...'

  try {
    await saveProgress(nextStep)
    currentStep.value = nextStep
  } catch (error: any) {
    alert('Failed to save progress. Please try again.')
  } finally {
    loading.value = false
  }
}

const handleBack = () => {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

const handleSkip = async () => {
  // Same as next, just skip the step
  await handleNext()
}

const handleComplete = async () => {
  loading.value = true
  loadingMessage.value = 'Completing setup...'

  try {
    const token = authStore.session?.access_token
    if (!token) {
      throw new Error('No access token available')
    }

    await axios.post(
      `${import.meta.env.VITE_API_URL}/api/onboarding/complete`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )

    // Update auth store
    await authStore.fetchUser()

    // Redirect to dashboard
    router.push('/dashboard')
  } catch (error: any) {
    loading.value = false

    if (error.response?.data?.missingFields) {
      alert(`Cannot complete onboarding. Missing: ${error.response.data.missingFields.join(', ')}`)
    } else {
      alert('Failed to complete onboarding. Please ensure all required fields are filled.')
    }
  }
}

const handleSaveAndExit = async () => {
  loading.value = true
  loadingMessage.value = 'Saving progress...'

  try {
    await saveProgress(currentStep.value)
    router.push('/dashboard')
  } catch (error: any) {
    alert('Failed to save progress.')
  } finally {
    loading.value = false
  }
}
</script>

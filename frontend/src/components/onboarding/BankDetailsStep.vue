<template>
  <div>
    <!-- Header -->
    <div class="mb-8">
      <h2 class="text-2xl font-bold text-gray-900 mb-2">Bank Details</h2>
      <p class="text-gray-600">Required for generating tenancy agreements</p>
    </div>

    <!-- Info Box -->
    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3 flex-1">
          <h3 class="text-sm font-medium text-blue-800">Why do we need this?</h3>
          <div class="mt-2 text-sm text-blue-700">
            <p>These bank details are included in tenancy agreements for fully managed properties. Tenants will use these details to set up rent payments.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Form -->
    <form @submit.prevent="handleSubmit" class="space-y-6">
      <!-- Account Name -->
      <div>
        <label for="accountName" class="block text-sm font-medium text-gray-700 mb-2">
          Account Name
        </label>
        <input
          id="accountName"
          v-model="formData.bankAccountName"
          type="text"
          placeholder="e.g., Property Management Ltd"
          class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          :class="{ 'border-red-500': errors.bankAccountName }"
        />
        <p v-if="errors.bankAccountName" class="mt-1 text-sm text-red-600">{{ errors.bankAccountName }}</p>
      </div>

      <!-- Account Number and Sort Code -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="accountNumber" class="block text-sm font-medium text-gray-700 mb-2">
            Account Number
          </label>
          <input
            id="accountNumber"
            v-model="formData.bankAccountNumber"
            type="text"
            placeholder="12345678"
            maxlength="8"
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            :class="{ 'border-red-500': errors.bankAccountNumber }"
            @input="handleAccountNumberInput"
          />
          <p v-if="errors.bankAccountNumber" class="mt-1 text-sm text-red-600">{{ errors.bankAccountNumber }}</p>
          <p v-else class="mt-1 text-sm text-gray-500">8 digits</p>
        </div>

        <div>
          <label for="sortCode" class="block text-sm font-medium text-gray-700 mb-2">
            Sort Code
          </label>
          <input
            id="sortCode"
            v-model="formData.bankSortCode"
            type="text"
            placeholder="12-34-56"
            maxlength="8"
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            :class="{ 'border-red-500': errors.bankSortCode }"
            @input="handleSortCodeInput"
          />
          <p v-if="errors.bankSortCode" class="mt-1 text-sm text-red-600">{{ errors.bankSortCode }}</p>
          <p v-else class="mt-1 text-sm text-gray-500">Format: 12-34-56</p>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="errorMessage" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
        {{ errorMessage }}
      </div>

      <!-- Success Message -->
      <div v-if="successMessage" class="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg">
        {{ successMessage }}
      </div>

      <!-- Navigation Buttons -->
      <div class="flex items-center justify-between pt-4">
        <button
          type="button"
          @click="$emit('back')"
          class="px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
        >
          Back
        </button>

        <div class="flex items-center gap-3">
          <button
            type="button"
            @click="handleSkip"
            class="px-6 py-3 text-gray-600 hover:text-gray-900 transition-colors font-medium underline"
          >
            Skip for now
          </button>

          <button
            type="submit"
            :disabled="loading"
            class="px-8 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="loading">Saving...</span>
            <span v-else>Continue</span>
          </button>
        </div>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import axios from 'axios'

const authStore = useAuthStore()

const emit = defineEmits<{
  next: []
  back: []
  skip: []
}>()

interface FormData {
  bankAccountName: string
  bankAccountNumber: string
  bankSortCode: string
}

const formData = ref<FormData>({
  bankAccountName: '',
  bankAccountNumber: '',
  bankSortCode: ''
})

const errors = ref<Partial<Record<keyof FormData, string>>>({})
const errorMessage = ref('')
const successMessage = ref('')
const loading = ref(false)

// Load existing bank details
onMounted(async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) {
      errorMessage.value = 'Not authenticated'
      return
    }

    const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/company`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    formData.value = {
      bankAccountName: response.data.bankAccountName || '',
      bankAccountNumber: response.data.bankAccountNumber || '',
      bankSortCode: response.data.bankSortCode || ''
    }
  } catch (error: any) {
    console.error('Error loading bank details:', error)
    errorMessage.value = 'Failed to load bank details'
  }
})

// Format account number - only allow digits
const handleAccountNumberInput = (e: Event) => {
  const input = e.target as HTMLInputElement
  const value = input.value.replace(/\D/g, '') // Remove non-digits
  formData.value.bankAccountNumber = value.slice(0, 8) // Limit to 8 digits
}

// Format sort code - auto-add dashes
const handleSortCodeInput = (e: Event) => {
  const input = e.target as HTMLInputElement
  let value = input.value.replace(/\D/g, '') // Remove non-digits

  // Format as XX-XX-XX
  if (value.length >= 2) {
    value = value.slice(0, 2) + '-' + value.slice(2)
  }
  if (value.length >= 5) {
    value = value.slice(0, 5) + '-' + value.slice(5, 7)
  }

  formData.value.bankSortCode = value.slice(0, 8) // Limit to XX-XX-XX
}

const validateForm = (): boolean => {
  errors.value = {}
  let isValid = true

  // If any field is filled, all must be filled
  const anyFieldFilled = formData.value.bankAccountName || formData.value.bankAccountNumber || formData.value.bankSortCode

  if (anyFieldFilled) {
    if (!formData.value.bankAccountName || formData.value.bankAccountName.trim().length === 0) {
      errors.value.bankAccountName = 'Account name is required if providing bank details'
      isValid = false
    }

    if (!formData.value.bankAccountNumber || formData.value.bankAccountNumber.trim().length === 0) {
      errors.value.bankAccountNumber = 'Account number is required if providing bank details'
      isValid = false
    } else if (formData.value.bankAccountNumber.length !== 8) {
      errors.value.bankAccountNumber = 'Account number must be exactly 8 digits'
      isValid = false
    } else if (!/^\d{8}$/.test(formData.value.bankAccountNumber)) {
      errors.value.bankAccountNumber = 'Account number must contain only digits'
      isValid = false
    }

    if (!formData.value.bankSortCode || formData.value.bankSortCode.trim().length === 0) {
      errors.value.bankSortCode = 'Sort code is required if providing bank details'
      isValid = false
    } else if (!/^\d{2}-\d{2}-\d{2}$/.test(formData.value.bankSortCode)) {
      errors.value.bankSortCode = 'Sort code must be in format XX-XX-XX'
      isValid = false
    }
  }

  return isValid
}

const handleSubmit = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!validateForm()) {
    return
  }

  loading.value = true

  try {
    const token = authStore.session?.access_token
    if (!token) {
      errorMessage.value = 'Not authenticated'
      loading.value = false
      return
    }

    await axios.put(
      `${import.meta.env.VITE_API_URL}/api/company`,
      {
        bank_account_name: formData.value.bankAccountName.trim(),
        bank_account_number: formData.value.bankAccountNumber.trim(),
        bank_sort_code: formData.value.bankSortCode.trim()
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )

    successMessage.value = 'Bank details saved!'

    // Wait a moment to show success message
    setTimeout(() => {
      emit('next')
    }, 500)
  } catch (error: any) {
    console.error('Error updating bank details:', error)
    errorMessage.value = error.response?.data?.error || 'Failed to update bank details. Please try again.'
  } finally {
    loading.value = false
  }
}

const handleSkip = () => {
  emit('skip')
}
</script>

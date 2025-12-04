<template>
  <div>
    <!-- Header -->
    <div class="mb-8">
      <h2 class="text-2xl font-bold text-gray-900 mb-2">Company Information</h2>
      <p class="text-gray-600">Tell us about your business</p>
    </div>

    <!-- Form -->
    <form @submit.prevent="handleSubmit" class="space-y-6">
      <!-- Company Name (Required) -->
      <div>
        <label for="companyName" class="block text-sm font-medium text-gray-700 mb-2">
          Company Name <span class="text-red-500">*</span>
        </label>
        <input
          id="companyName"
          v-model="formData.name"
          type="text"
          required
          placeholder="e.g., Property Management Ltd"
          class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          :class="{ 'border-red-500': errors.name }"
        />
        <p v-if="errors.name" class="mt-1 text-sm text-red-600">{{ errors.name }}</p>
      </div>

      <!-- Address (Required) -->
      <div>
        <label for="address" class="block text-sm font-medium text-gray-700 mb-2">
          Address <span class="text-red-500">*</span>
        </label>
        <input
          id="address"
          v-model="formData.address"
          type="text"
          required
          placeholder="e.g., 123 High Street"
          class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          :class="{ 'border-red-500': errors.address }"
        />
        <p v-if="errors.address" class="mt-1 text-sm text-red-600">{{ errors.address }}</p>
      </div>

      <!-- City and Postcode (Required) -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="city" class="block text-sm font-medium text-gray-700 mb-2">
            City <span class="text-red-500">*</span>
          </label>
          <input
            id="city"
            v-model="formData.city"
            type="text"
            required
            placeholder="e.g., London"
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            :class="{ 'border-red-500': errors.city }"
          />
          <p v-if="errors.city" class="mt-1 text-sm text-red-600">{{ errors.city }}</p>
        </div>

        <div>
          <label for="postcode" class="block text-sm font-medium text-gray-700 mb-2">
            Postcode <span class="text-red-500">*</span>
          </label>
          <input
            id="postcode"
            v-model="formData.postcode"
            type="text"
            required
            placeholder="e.g., SW1A 1AA"
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            :class="{ 'border-red-500': errors.postcode }"
          />
          <p v-if="errors.postcode" class="mt-1 text-sm text-red-600">{{ errors.postcode }}</p>
        </div>
      </div>

      <!-- Company Phone (Required) -->
      <div>
        <label for="companyPhone" class="block text-sm font-medium text-gray-700 mb-2">
          Company Phone <span class="text-red-500">*</span>
        </label>
        <input
          id="companyPhone"
          v-model="formData.phone"
          type="tel"
          required
          placeholder="e.g., 020 1234 5678"
          class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          :class="{ 'border-red-500': errors.phone }"
        />
        <p v-if="errors.phone" class="mt-1 text-sm text-red-600">{{ errors.phone }}</p>
      </div>

      <!-- Website (Optional) -->
      <div>
        <label for="website" class="block text-sm font-medium text-gray-700 mb-2">
          Website
        </label>
        <input
          id="website"
          v-model="formData.website"
          type="text"
          placeholder="example.com"
          class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          :class="{ 'border-red-500': errors.website }"
          @blur="formatWebsiteUrl"
        />
        <p v-if="errors.website" class="mt-1 text-sm text-red-600">{{ errors.website }}</p>
        <p v-else class="mt-1 text-sm text-gray-500">Optional - displayed on your reference forms</p>
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

        <button
          type="submit"
          :disabled="loading"
          class="px-8 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="loading">Saving...</span>
          <span v-else>Continue</span>
        </button>
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
}>()

interface FormData {
  name: string
  address: string
  city: string
  postcode: string
  phone: string
  website: string
}

const formData = ref<FormData>({
  name: '',
  address: '',
  city: '',
  postcode: '',
  phone: '',
  website: ''
})

const errors = ref<Partial<Record<keyof FormData, string>>>({})
const errorMessage = ref('')
const successMessage = ref('')
const loading = ref(false)

// Load existing company data
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

    const company = response.data.company || response.data
    formData.value = {
      name: company.name || '',
      address: company.address || '',
      city: company.city || '',
      postcode: company.postcode || '',
      phone: company.phone || '',
      website: company.website || ''
    }
  } catch (error: any) {
    console.error('Error loading company:', error)
    errorMessage.value = 'Failed to load company data'
  }
})

const validateForm = (): boolean => {
  errors.value = {}
  let isValid = true

  // Required fields
  if (!formData.value.name || formData.value.name.trim().length === 0) {
    errors.value.name = 'Company name is required'
    isValid = false
  }

  if (!formData.value.address || formData.value.address.trim().length === 0) {
    errors.value.address = 'Address is required'
    isValid = false
  }

  if (!formData.value.city || formData.value.city.trim().length === 0) {
    errors.value.city = 'City is required'
    isValid = false
  }

  if (!formData.value.postcode || formData.value.postcode.trim().length === 0) {
    errors.value.postcode = 'Postcode is required'
    isValid = false
  }

  if (!formData.value.phone || formData.value.phone.trim().length === 0) {
    errors.value.phone = 'Company phone is required'
    isValid = false
  }

  // Website validation (optional but must be valid if provided)
  if (formData.value.website && formData.value.website.trim().length > 0) {
    try {
      new URL(formData.value.website)
    } catch {
      errors.value.website = 'Please enter a valid URL (e.g., https://example.com)'
      isValid = false
    }
  }

  return isValid
}

// Format website URL - add https:// if missing
const formatWebsiteUrl = () => {
  const url = formData.value.website.trim()
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    formData.value.website = 'https://' + url
  }
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
        name: formData.value.name.trim(),
        address: formData.value.address.trim(),
        city: formData.value.city.trim(),
        postcode: formData.value.postcode.trim(),
        phone: formData.value.phone.trim(),
        website: formData.value.website.trim()
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )

    successMessage.value = 'Company information saved!'

    // Wait a moment to show success message
    setTimeout(() => {
      emit('next')
    }, 500)
  } catch (error: any) {
    console.error('Error updating company:', error)
    errorMessage.value = error.response?.data?.error || 'Failed to update company information. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-8">
      <h2 class="text-2xl font-bold text-gray-900 mb-2">Branding</h2>
      <p class="text-gray-600">Customize how your forms look (optional)</p>
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
          <h3 class="text-sm font-medium text-blue-800">Professional appearance</h3>
          <div class="mt-2 text-sm text-blue-700">
            <p>Your logo and brand colors will appear on all forms sent to tenants, landlords, and employers. You can always change these later in Settings.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Form -->
    <form @submit.prevent="handleSubmit" class="space-y-6">
      <!-- Logo Upload -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-3">Company Logo</label>
        <div class="flex items-start gap-6">
          <!-- Logo Preview -->
          <div class="flex-shrink-0">
            <div class="w-32 h-32 border-2 border-gray-300 border-dashed rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden">
              <img v-if="logoPreview" :src="logoPreview" alt="Logo preview" class="w-full h-full object-contain" />
              <div v-else class="text-center p-4">
                <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p class="mt-1 text-xs text-gray-500">No logo</p>
              </div>
            </div>
          </div>

          <!-- Upload Controls -->
          <div class="flex-1">
            <input
              type="file"
              ref="logoInput"
              @change="handleLogoSelect"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:bg-primary/90 cursor-pointer"
            />
            <p class="mt-2 text-xs text-gray-500">PNG, JPG, or WEBP. Max 2MB. Square images work best.</p>
            <button
              v-if="logoPreview"
              type="button"
              @click="handleRemoveLogo"
              class="mt-2 text-sm text-red-600 hover:text-red-800"
            >
              Remove logo
            </button>
          </div>
        </div>
        <p v-if="errors.logo" class="mt-2 text-sm text-red-600">{{ errors.logo }}</p>
      </div>

      <!-- Primary Color -->
      <div>
        <label for="primaryColor" class="block text-sm font-medium text-gray-700 mb-3">
          Primary Color
        </label>
        <div class="flex items-center gap-4">
          <input
            id="primaryColor"
            v-model="formData.primaryColor"
            type="color"
            class="h-12 w-24 border border-gray-300 rounded-lg cursor-pointer"
          />
          <input
            v-model="formData.primaryColor"
            type="text"
            placeholder="#FF8C41"
            class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            :class="{ 'border-red-500': errors.primaryColor }"
          />
        </div>
        <p v-if="errors.primaryColor" class="mt-1 text-sm text-red-600">{{ errors.primaryColor }}</p>
        <p v-else class="mt-1 text-sm text-gray-500">Used for headings and key UI elements</p>
      </div>

      <!-- Button Color -->
      <div>
        <label for="buttonColor" class="block text-sm font-medium text-gray-700 mb-3">
          Button Color
        </label>
        <div class="flex items-center gap-4">
          <input
            id="buttonColor"
            v-model="formData.buttonColor"
            type="color"
            class="h-12 w-24 border border-gray-300 rounded-lg cursor-pointer"
          />
          <input
            v-model="formData.buttonColor"
            type="text"
            placeholder="#FF8C41"
            class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            :class="{ 'border-red-500': errors.buttonColor }"
          />
        </div>
        <p v-if="errors.buttonColor" class="mt-1 text-sm text-red-600">{{ errors.buttonColor }}</p>
        <p v-else class="mt-1 text-sm text-gray-500">Color for buttons and calls-to-action</p>
      </div>

      <!-- Preview -->
      <div class="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h4 class="text-sm font-medium text-gray-900 mb-4">Preview</h4>
        <div class="bg-white rounded-lg border border-gray-200 p-6">
          <div v-if="logoPreview" class="mb-4">
            <img :src="logoPreview" alt="Logo" class="h-12 object-contain" />
          </div>
          <h3 :style="{ color: formData.primaryColor }" class="text-xl font-bold mb-2">
            Tenant Reference Request
          </h3>
          <p class="text-gray-600 mb-4">This is how your forms will appear to recipients.</p>
          <button
            type="button"
            :style="{
              backgroundColor: formData.buttonColor,
              color: '#ffffff'
            }"
            class="px-4 py-2 rounded-md font-medium"
          >
            Sample Button
          </button>
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

const authStore = useAuthStore()
const API_URL = import.meta.env.VITE_API_URL

const emit = defineEmits<{
  next: []
  back: []
  skip: []
}>()

interface FormData {
  primaryColor: string
  buttonColor: string
}

const formData = ref<FormData>({
  primaryColor: '#f97316',
  buttonColor: '#f97316'
})

const logoFile = ref<File | null>(null)
const logoPreview = ref('')
const logoInput = ref<HTMLInputElement | null>(null)
const errors = ref<any>({})
const errorMessage = ref('')
const successMessage = ref('')
const loading = ref(false)

// Load existing branding data
onMounted(async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(`${API_URL}/api/company`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const data = await response.json()
      formData.value = {
        primaryColor: data.primaryColor || '#f97316',
        buttonColor: data.buttonColor || '#f97316'
      }

      if (data.logoUrl) {
        logoPreview.value = data.logoUrl
      }
    }
  } catch (error: any) {
    console.error('Error loading branding:', error)
  }
})

const handleLogoSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  errors.value.logo = ''

  // Validate file size (2MB max)
  if (file.size > 2 * 1024 * 1024) {
    errors.value.logo = 'File size must be less than 2MB'
    return
  }

  // Validate file type
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
  if (!validTypes.includes(file.type)) {
    errors.value.logo = 'File must be PNG, JPG, or WEBP'
    return
  }

  logoFile.value = file

  // Create preview
  const reader = new FileReader()
  reader.onload = (e) => {
    logoPreview.value = e.target?.result as string
  }
  reader.readAsDataURL(file)
}

const handleRemoveLogo = () => {
  logoFile.value = null
  logoPreview.value = ''
  if (logoInput.value) {
    logoInput.value.value = ''
  }
}

const validateForm = (): boolean => {
  errors.value = {}
  let isValid = true

  // Validate hex colors
  const hexRegex = /^#[0-9A-Fa-f]{6}$/

  if (!hexRegex.test(formData.value.primaryColor)) {
    errors.value.primaryColor = 'Please enter a valid hex color (e.g., #FF8C41)'
    isValid = false
  }

  if (!hexRegex.test(formData.value.buttonColor)) {
    errors.value.buttonColor = 'Please enter a valid hex color (e.g., #FF8C41)'
    isValid = false
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
      return
    }

    let logoUrl = logoPreview.value

    // Upload logo if a new file was selected
    if (logoFile.value) {
      const formData = new FormData()
      formData.append('logo', logoFile.value)

      const uploadResponse = await fetch(`${API_URL}/api/company/logo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json()
        throw new Error(errorData.error || 'Failed to upload logo')
      }

      const uploadData = await uploadResponse.json()
      logoUrl = uploadData.logo_url
    }

    // Update branding settings
    const response = await fetch(`${API_URL}/api/company`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        logo_url: logoUrl || null,
        primary_color: formData.value.primaryColor,
        button_color: formData.value.buttonColor
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to update branding')
    }

    successMessage.value = 'Branding updated successfully!'

    // Wait a moment to show success message
    setTimeout(() => {
      emit('next')
    }, 500)
  } catch (error: any) {
    console.error('Error updating branding:', error)
    errorMessage.value = error.message || 'Failed to update branding. Please try again.'
  } finally {
    loading.value = false
  }
}

const handleSkip = () => {
  emit('skip')
}
</script>

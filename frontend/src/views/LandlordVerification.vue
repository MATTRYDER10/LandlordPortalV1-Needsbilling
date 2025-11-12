<template>
  <div class="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-3xl mx-auto">
      <!-- Header -->
      <div v-if="!loading" class="text-center mb-8">
        <div class="flex justify-center items-center gap-3 mb-4">
          <img src="/PropertyGooseIcon.webp" alt="PropertyGoose" class="h-12 w-12" />
          <span class="text-2xl font-bold">
            <span class="text-gray-900">Property</span><span class="text-primary">Goose</span>
          </span>
        </div>
        <h1 class="text-3xl font-bold text-gray-900">Landlord Verification</h1>
        <p class="mt-2 text-gray-600">Please complete your identity verification</p>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="bg-white rounded-lg shadow p-8 text-center">
        <div class="text-gray-600">Loading verification details...</div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-lg">
        {{ error }}
      </div>

      <!-- Success/Already Submitted -->
      <div v-else-if="submitted" class="bg-white rounded-lg shadow p-8 text-center">
        <svg class="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 class="mt-4 text-lg font-semibold text-gray-900">Thank You!</h3>
        <p class="mt-2 text-gray-600">Your verification has been submitted successfully. Your documents are being reviewed.</p>
      </div>

      <!-- Form -->
      <form v-else-if="landlord" @submit.prevent="handleSubmit" class="space-y-6">
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Identity Verification</h2>
          <p class="text-sm text-gray-600 mb-6">Please upload a clear photo of your ID document and take a selfie for verification.</p>

          <div class="space-y-6">
            <!-- ID Document Type -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Document Type *</label>
              <select
                v-model="formData.id_document_type"
                required
                class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              >
                <option value="">Select document type</option>
                <option value="driving_licence">Driving Licence</option>
                <option value="passport">Passport</option>
              </select>
            </div>

            <!-- ID Document Upload -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Upload ID Document *</label>
              <input
                ref="idDocumentInput"
                type="file"
                @change="handleIdDocumentUpload"
                accept=".pdf,.jpg,.jpeg,.png"
                class="hidden"
                required
              />
              <button
                type="button"
                @click="($refs.idDocumentInput as any).click()"
                class="px-4 py-2 text-sm font-semibold bg-blue-50 rounded-md hover:bg-blue-100"
                :style="{ color: buttonColor }"
              >
                {{ idDocument ? 'Change File' : 'Choose File' }}
              </button>
              <p v-if="idDocument" class="mt-2 text-sm text-gray-600">{{ idDocument.name }}</p>
              <p class="mt-1 text-xs text-gray-500">Upload PDF or image (max 10MB)</p>
            </div>

            <!-- Selfie Upload -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Upload Selfie *</label>
              <input
                ref="selfieInput"
                type="file"
                @change="handleSelfieUpload"
                accept=".jpg,.jpeg,.png"
                class="hidden"
                required
              />
              <button
                type="button"
                @click="($refs.selfieInput as any).click()"
                class="px-4 py-2 text-sm font-semibold bg-blue-50 rounded-md hover:bg-blue-100"
                :style="{ color: buttonColor }"
              >
                {{ selfie ? 'Change File' : 'Choose File' }}
              </button>
              <p v-if="selfie" class="mt-2 text-sm text-gray-600">{{ selfie.name }}</p>
              <p class="mt-1 text-xs text-gray-500">Upload a clear selfie photo (max 10MB)</p>
            </div>
          </div>
        </div>

        <!-- Submit Button -->
        <div class="flex justify-end gap-3">
          <button
            type="submit"
            :disabled="submitting || !formData.id_document_type || !idDocument || !selfie"
            class="px-6 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ submitting ? 'Submitting...' : 'Submit Verification' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'

const route = useRoute()
const toast = useToast()

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const loading = ref(true)
const error = ref('')
const submitted = ref(false)
const submitting = ref(false)
const landlord = ref<any>(null)
const idDocument = ref<File | null>(null)
const selfie = ref<File | null>(null)
const buttonColor = ref('#f97316')

const formData = ref({
  id_document_type: ''
})

const idDocumentInput = ref<HTMLInputElement | null>(null)
const selfieInput = ref<HTMLInputElement | null>(null)

const fetchLandlord = async () => {
  loading.value = true
  error.value = ''

  try {
    const landlordId = route.params.id as string
    const token = route.params.token as string

    if (!token) {
      throw new Error('Verification token is required')
    }

    // Verify token and get landlord
    const response = await fetch(`${API_URL}/api/landlords/${landlordId}/verification/${token}`, {
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Invalid verification link')
    }

    const data = await response.json()
    landlord.value = data.landlord

    // Check if already submitted
    if (landlord.value.verification_status === 'submitted' || landlord.value.verification_status === 'verified') {
      submitted.value = true
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load verification details'
    toast.error(err.message || 'Failed to load verification details')
  } finally {
    loading.value = false
  }
}

const handleIdDocumentUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    const file = target.files[0]
    if (file) {
      idDocument.value = file
    }
  }
}

const handleSelfieUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    const file = target.files[0]
    if (file) {
      selfie.value = file
    }
  }
}

const handleSubmit = async () => {
  if (!idDocument.value || !selfie.value || !formData.value.id_document_type) {
    toast.error('Please upload both ID document and selfie')
    return
  }

  submitting.value = true

  try {
    const landlordId = route.params.id as string
    const token = route.params.token as string

    const formDataToSend = new FormData()
    formDataToSend.append('id_document', idDocument.value)
    formDataToSend.append('selfie', selfie.value)
    formDataToSend.append('id_document_type', formData.value.id_document_type)
    formDataToSend.append('token', token)

    const response = await fetch(`${API_URL}/api/landlords/${landlordId}/submit-verification`, {
      method: 'POST',
      body: formDataToSend
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to submit verification')
    }

    submitted.value = true
    toast.success('Verification submitted successfully')
  } catch (err: any) {
    toast.error(err.message || 'Failed to submit verification')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchLandlord()
})
</script>


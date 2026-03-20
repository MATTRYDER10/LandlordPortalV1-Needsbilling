<template>
  <div class="min-h-screen bg-gray-50 dark:bg-slate-800 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-3xl mx-auto">
      <!-- Header -->
      <div v-if="!loading" class="text-center mb-8">
        <div class="flex justify-center items-center gap-3 mb-4">
          <template v-if="companyLogo">
            <img :src="companyLogo" alt="Company Logo" class="h-14 object-contain" />
          </template>
          <template v-else>
            <img src="/PropertyGooseLogo.png" alt="PropertyGoose" class="h-12 dark:hidden" />
            <img src="/PropertyGooseLogoDark.png" alt="PropertyGoose" class="h-12 hidden dark:block" />
          </template>
        </div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Landlord Verification</h1>
        <p class="mt-2 text-gray-600 dark:text-slate-400">Please complete your identity verification</p>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="bg-white dark:bg-slate-800 rounded-lg shadow p-8 text-center">
        <div class="text-gray-600 dark:text-slate-400">Loading verification details...</div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-6 py-4 rounded-lg">
        {{ error }}
      </div>

      <!-- Success/Already Submitted -->
      <div v-else-if="submitted" class="bg-white dark:bg-slate-800 rounded-lg shadow p-8 text-center">
        <CheckCircle2 class="mx-auto h-12 w-12 text-green-500" />
        <h3 class="mt-4 text-lg font-semibold text-gray-900 dark:text-white">Thank You!</h3>
        <p class="mt-2 text-gray-600 dark:text-slate-400">Your verification has been submitted successfully. Your documents are being
          reviewed.</p>
      </div>

      <!-- Form -->
      <div v-else-if="landlord">
        <DeviceHandoffGate
          v-if="showDeviceGate"
          :title="deviceGateTitle"
          :description="deviceGateDescription"
          :company-name="agentCompanyName"
          :company-logo="companyLogo"
          :company-contact-email="agentCompanyEmail"
          :company-contact-phone="agentCompanyPhone"
          :company-contact-address="agentCompanyAddress"
          :company-website="agentCompanyWebsite"
          :request-details="landlordRequestDetails"
          :link="deviceLink"
          :primary-color="primaryColor"
          :button-color="buttonColor"
          proceed-label="Proceed on this device (Camera required)"
          @proceed="handleDeviceGateProceed"
        />
        <form v-else @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Personal Details Section -->
        <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Personal Details</h2>
          <p class="text-sm text-gray-600 dark:text-slate-400 mb-6">Please confirm your personal details for identity verification.</p>

          <div class="space-y-4">
            <!-- Name Row -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">First Name *</label>
                <input v-model="formData.first_name" type="text" required
                  class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                  placeholder="Enter your first name" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Last Name *</label>
                <input v-model="formData.last_name" type="text" required
                  class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                  placeholder="Enter your last name" />
              </div>
            </div>

            <!-- Date of Birth -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Date of Birth *</label>
              <input v-model="formData.date_of_birth" type="date" required
                class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white" />
            </div>
          </div>
        </div>

        <!-- Address Section -->
        <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Address</h2>
          <p class="text-sm text-gray-600 dark:text-slate-400 mb-6">Please provide your current residential address.</p>

          <div class="space-y-4">
            <div>
              <AddressAutocomplete
                v-model="formData.address_line1"
                label="Address Line 1"
                :required="true"
                placeholder="Start typing address..."
                @addressSelected="handleAddressSelected"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Address Line 2</label>
              <input v-model="formData.address_line2" type="text"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                placeholder="Apartment, suite, etc. (optional)" />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">City *</label>
                <input v-model="formData.city" type="text" required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                  placeholder="City" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Postcode *</label>
                <input v-model="formData.postcode" type="text" required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                  placeholder="Postcode" />
              </div>
            </div>
          </div>
        </div>

        <!-- Identity Verification Section -->
        <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Identity Verification</h2>
          <p class="text-sm text-gray-600 dark:text-slate-400 mb-6">Please upload a clear photo of your ID document and take a selfie for
            verification.</p>

          <div class="space-y-6">
            <!-- ID Document Type -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Document Type *</label>
              <select v-model="formData.id_document_type" required
                class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white">
                <option value="">Select document type</option>
                <option value="driving_licence">Driving Licence</option>
                <option value="passport">Passport</option>
              </select>
            </div>

            <!-- ID Document Upload -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Upload ID Document *</label>
              <input ref="idDocumentInput" type="file" @change="handleIdDocumentUpload" accept=".pdf,.jpg,.jpeg,.png"
                class="hidden" required />
              <button type="button" @click="($refs.idDocumentInput as any).click()"
                class="px-4 py-2 text-sm font-semibold bg-blue-50 dark:bg-blue-900/30 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50"
                :style="{ color: buttonColor }">
                {{ idDocument ? 'Change File' : 'Choose File' }}
              </button>
              <p v-if="idDocument" class="mt-2 text-sm text-gray-600 dark:text-slate-400">{{ idDocument.name }}</p>
              <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">Upload PDF or image (max 10MB)</p>
            </div>

            <!-- Selfie Capture -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Take Selfie *</label>

              <!-- Camera stream view -->
              <div v-if="showCameraStream" class="space-y-4">
                <div class="relative bg-black rounded-lg overflow-hidden" style="max-width: 640px;">
                  <video ref="videoElement" autoplay playsinline class="w-full h-auto"
                    style="transform: scaleX(-1);"></video>
                  <canvas ref="canvasElement" class="hidden"></canvas>
                </div>
                <div class="flex gap-2">
                  <button type="button" @click="capturePhoto"
                    class="px-4 py-2 text-sm font-semibold bg-blue-50 dark:bg-blue-900/30 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50"
                    :style="{ color: buttonColor }">
                    Capture Photo
                  </button>
                  <button type="button" @click="stopCamera"
                    class="px-4 py-2 text-sm font-semibold bg-gray-100 dark:bg-slate-700 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300">
                    Cancel
                  </button>
                </div>
              </div>

              <!-- Camera start button or preview -->
              <div v-else>
                <div v-if="selfie && selfiePreview" class="space-y-4">
                  <img :src="selfiePreview" alt="Selfie preview"
                    class="w-48 h-48 object-cover rounded-lg border-2 border-gray-300 dark:border-slate-600" />
                  <div class="flex items-center gap-2">
                    <span class="text-sm text-gray-700 dark:text-slate-300">Photo captured ({{ formatFileSize(selfie.size) }})</span>
                    <button type="button" @click="removeSelfie" class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm">
                      Remove
                    </button>
                  </div>
                </div>

                <div v-else>
                  <button type="button" @click="startCamera"
                    class="px-4 py-2 text-sm font-semibold bg-blue-50 dark:bg-blue-900/30 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50"
                    :style="{ color: buttonColor }">
                    Take Photo
                  </button>
                </div>
              </div>

              <p v-if="cameraError" class="mt-2 text-sm text-red-600 dark:text-red-400">{{ cameraError }}</p>
              <p v-else class="mt-1 text-xs text-gray-500 dark:text-slate-400">Please open this on your mobile phone. A photo
                must be taken using your device's camera for AML compliance.</p>
            </div>
          </div>
        </div>

        <!-- Submit Button -->
        <div class="flex justify-end gap-3">
          <button type="submit" :disabled="submitting || !isFormValid"
            class="px-6 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed">
            {{ submitting ? 'Submitting...' : 'Submit Verification' }}
          </button>
        </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'
import DeviceHandoffGate from '../components/DeviceHandoffGate.vue'
import AddressAutocomplete from '../components/AddressAutocomplete.vue'
import { defaultBranding } from '../config/colors'
import { CheckCircle2 } from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL ?? ''

const route = useRoute()
const toast = useToast()
const getDeviceGateStorageKey = () => `landlord_verification_gate_${route.params.id}_${route.params.token}`

const loading = ref(true)
const error = ref('')
const submitted = ref(false)
const submitting = ref(false)
const landlord = ref<any>(null)
const idDocument = ref<File | null>(null)
const selfie = ref<File | null>(null)
const buttonColor = ref(defaultBranding.buttonColor)
const primaryColor = ref(defaultBranding.primaryColor)
const companyLogo = ref('')
const companyDetails = ref<any>(null)
const showDeviceGate = ref(true)
const deviceLink = ref('')

const formData = ref({
  id_document_type: '',
  first_name: '',
  last_name: '',
  date_of_birth: '',
  address_line1: '',
  address_line2: '',
  city: '',
  postcode: '',
  country: 'GB'
})

const idDocumentInput = ref<HTMLInputElement | null>(null)

// Camera capture for selfie
const showCameraStream = ref(false)
const videoElement = ref<HTMLVideoElement | null>(null)
const canvasElement = ref<HTMLCanvasElement | null>(null)
const cameraStream = ref<MediaStream | null>(null)
const cameraError = ref<string>('')
const selfiePreview = ref<string | null>(null)

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
    if (data.company) {
      companyDetails.value = data.company
      companyLogo.value = data.company.logo_url || ''
      primaryColor.value = data.company.primary_color || primaryColor.value
      buttonColor.value = data.company.button_color || buttonColor.value
    }

    // Pre-populate form data with existing landlord details
    if (landlord.value) {
      formData.value.first_name = landlord.value.first_name || ''
      formData.value.last_name = landlord.value.last_name || ''
      formData.value.date_of_birth = landlord.value.date_of_birth || ''
      formData.value.address_line1 = landlord.value.address_line1 || ''
      formData.value.address_line2 = landlord.value.address_line2 || ''
      formData.value.city = landlord.value.city || ''
      formData.value.postcode = landlord.value.postcode || ''
      formData.value.country = landlord.value.country || 'GB'
    }

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

const handleAddressSelected = (addressData: any) => {
  formData.value.address_line1 = addressData.addressLine1
  formData.value.city = addressData.city
  formData.value.postcode = addressData.postcode

  // Update country if available
  if (addressData.country?.code) {
    formData.value.country = addressData.country.code
  }
}

// Camera capture functions for selfie
const startCamera = async () => {
  cameraError.value = ''
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' }, // Front-facing camera
      audio: false
    })
    cameraStream.value = stream
    showCameraStream.value = true

    // Wait for next tick to ensure video element is rendered
    await new Promise(resolve => setTimeout(resolve, 100))

    if (videoElement.value) {
      videoElement.value.srcObject = stream
    }
  } catch (error: any) {
    console.error('Camera access error:', error)
    if (error.name === 'NotAllowedError') {
      cameraError.value = 'Camera access denied. Please allow camera access to take a selfie.'
    } else if (error.name === 'NotFoundError') {
      cameraError.value = 'No camera found on this device.'
    } else {
      cameraError.value = 'Unable to access camera. Please try again.'
    }
  }
}

const stopCamera = () => {
  if (cameraStream.value) {
    cameraStream.value.getTracks().forEach(track => track.stop())
    cameraStream.value = null
  }
  showCameraStream.value = false
}

const capturePhoto = () => {
  if (!videoElement.value || !canvasElement.value) return

  const video = videoElement.value
  const canvas = canvasElement.value
  const context = canvas.getContext('2d')
  if (!context) return

  // Set canvas size to match video
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  // Flip horizontally to match the mirrored video display
  context.translate(canvas.width, 0)
  context.scale(-1, 1)

  // Draw the video frame to the canvas
  context.drawImage(video, 0, 0, canvas.width, canvas.height)

  // Convert to blob
  canvas.toBlob((blob) => {
    if (blob) {
      const timestamp = Date.now()
      const file = new File([blob], `selfie-${timestamp}.jpg`, { type: 'image/jpeg' })
      selfie.value = file
      selfiePreview.value = canvas.toDataURL('image/jpeg')

      // Stop camera and hide stream
      stopCamera()
    }
  }, 'image/jpeg', 0.9)
}

const removeSelfie = () => {
  selfie.value = null
  selfiePreview.value = null
  stopCamera()
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const agentCompanyName = computed(() => companyDetails.value?.name || 'PropertyGoose')
const agentCompanyEmail = computed(() => companyDetails.value?.email || '')
const agentCompanyPhone = computed(() => companyDetails.value?.phone || '')
const agentCompanyAddress = computed(() => {
  const parts = [companyDetails.value?.address, companyDetails.value?.city, companyDetails.value?.postcode].filter(Boolean)
  return parts.join(', ')
})
const agentCompanyWebsite = computed(() => companyDetails.value?.website || '')

const landlordRequestDetails = computed(() => {
  if (!landlord.value) return []
  const details: { label: string; value: string }[] = []
  const landlordName = [landlord.value.first_name, landlord.value.last_name].filter(Boolean).join(' ').trim()
  if (landlordName) {
    details.push({ label: 'Landlord', value: landlordName })
  }
  if (landlord.value.email) {
    details.push({ label: 'Email', value: landlord.value.email })
  }
  if (agentCompanyName.value) {
    details.push({ label: 'Agent', value: agentCompanyName.value })
  }
  return details
})

const deviceGateTitle = computed(() => `Confirm the request from ${agentCompanyName.value}`)
const deviceGateDescription = computed(
  () =>
    `${agentCompanyName.value} needs to verify your identity to progress with compliance checks. Use the QR code to open this form on your phone, or continue on this device if it has a working camera.`
)

const isFormValid = computed(() => {
  return (
    formData.value.first_name.trim() &&
    formData.value.last_name.trim() &&
    formData.value.date_of_birth &&
    formData.value.address_line1.trim() &&
    formData.value.city.trim() &&
    formData.value.postcode.trim() &&
    formData.value.id_document_type &&
    idDocument.value &&
    selfie.value
  )
})

const handleDeviceGateProceed = () => {
  showDeviceGate.value = false
  if (typeof window !== 'undefined') {
    localStorage.setItem(getDeviceGateStorageKey(), 'true')
  }
}

const handleSubmit = async () => {
  if (!isFormValid.value) {
    toast.error('Please fill in all required fields and upload both ID document and selfie')
    return
  }

  submitting.value = true

  try {
    const landlordId = route.params.id as string
    const token = route.params.token as string

    const formDataToSend = new FormData()
    // Files
    formDataToSend.append('id_document', idDocument.value!)
    formDataToSend.append('selfie', selfie.value!)
    // Personal details
    formDataToSend.append('token', token)
    formDataToSend.append('id_document_type', formData.value.id_document_type)
    formDataToSend.append('first_name', formData.value.first_name.trim())
    formDataToSend.append('last_name', formData.value.last_name.trim())
    formDataToSend.append('date_of_birth', formData.value.date_of_birth)
    // Address
    formDataToSend.append('address_line1', formData.value.address_line1.trim())
    if (formData.value.address_line2) {
      formDataToSend.append('address_line2', formData.value.address_line2.trim())
    }
    formDataToSend.append('city', formData.value.city.trim())
    formDataToSend.append('postcode', formData.value.postcode.trim())
    formDataToSend.append('country', formData.value.country || 'GB')

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
  if (typeof window !== 'undefined') {
    deviceLink.value = window.location.href
    const hasAcknowledged = localStorage.getItem(getDeviceGateStorageKey())
    showDeviceGate.value = hasAcknowledged !== 'true'
  }
  fetchLandlord()
})
</script>

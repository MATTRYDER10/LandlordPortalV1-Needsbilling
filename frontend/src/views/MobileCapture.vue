<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex flex-col">
    <!-- Logo Header -->
    <div class="text-center pt-6 pb-2 px-4">
      <img src="/PropertyGooseLogo.png" alt="PropertyGoose" class="h-10 mx-auto" />
      <p v-if="companyName" class="text-sm text-gray-500 dark:text-slate-400 mt-1">{{ companyName }}</p>
    </div>

    <div class="flex-1 flex items-start justify-center px-4 pb-6 pt-2">
      <div class="w-full max-w-lg">

        <!-- Loading State -->
        <div v-if="loading" class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center">
          <Loader2 class="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p class="text-gray-600 dark:text-slate-400">Validating capture link...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center">
          <AlertCircle class="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Link Invalid or Expired</h1>
          <p class="text-gray-600 dark:text-slate-400">{{ error }}</p>
        </div>

        <!-- Done State -->
        <div v-else-if="step === 'done'" class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center">
          <div class="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle class="w-8 h-8 text-green-600" />
          </div>
          <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Photos Uploaded Successfully!</h1>
          <p class="text-gray-600 dark:text-slate-400">
            You can now return to your desktop to continue the form.
          </p>
          <p class="text-sm text-gray-400 dark:text-slate-500 mt-4">You may close this tab.</p>
        </div>

        <!-- Selfie Capture -->
        <div v-else-if="step === 'selfie'" class="space-y-4">
          <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div class="bg-gradient-to-r from-primary to-orange-500 px-5 py-4">
              <div class="flex items-center gap-2">
                <UserCircle class="w-7 h-7 text-white" />
                <div>
                  <h1 class="text-lg font-bold text-white">Identity Photo Verification</h1>
                  <p class="text-white/80 text-xs mt-0.5">Take a selfie to verify your identity</p>
                </div>
              </div>
            </div>

            <div class="p-5">
              <!-- Instructions (shown when camera not active and no preview) -->
              <div v-if="!showCamera && !capturePreview">
                <p class="text-sm text-gray-700 dark:text-slate-300 mb-4">
                  Take a clear selfie to match your ID photo.
                </p>

                <div class="mb-5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                  <h4 class="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
                    <Info class="w-4 h-4" />
                    Tips for the Perfect Photo
                  </h4>
                  <ul class="space-y-2 text-sm text-blue-700 dark:text-blue-300">
                    <li class="flex items-start gap-2">
                      <CheckCircle class="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
                      <span><strong>Good lighting</strong> -- face a window or light source. Avoid backlighting.</span>
                    </li>
                    <li class="flex items-start gap-2">
                      <CheckCircle class="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
                      <span><strong>Plain background</strong> -- stand against a white or light-coloured wall.</span>
                    </li>
                    <li class="flex items-start gap-2">
                      <CheckCircle class="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
                      <span><strong>Face clearly visible</strong> -- remove glasses, hats, or anything covering your face.</span>
                    </li>
                    <li class="flex items-start gap-2">
                      <CheckCircle class="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
                      <span><strong>Look directly at camera</strong> -- keep a neutral expression, eyes open.</span>
                    </li>
                  </ul>
                </div>

                <button
                  type="button"
                  @click="startCamera('user')"
                  class="w-full px-6 py-3 text-sm font-semibold text-white bg-primary rounded-xl flex items-center justify-center gap-2 shadow-sm hover:opacity-90 transition-opacity"
                >
                  <Camera class="w-5 h-5" />
                  Open Camera
                </button>
              </div>

              <!-- Camera Stream (Selfie - front camera, mirrored) -->
              <div v-if="showCamera && !capturePreview" class="space-y-4">
                <div class="relative bg-black rounded-xl overflow-hidden shadow-lg" style="max-width: 480px; margin: 0 auto;">
                  <video
                    ref="videoElement"
                    autoplay
                    playsinline
                    class="w-full h-auto"
                    style="transform: scaleX(-1);"
                  ></video>
                  <canvas ref="canvasElement" class="hidden"></canvas>

                  <!-- Oval face overlay guide -->
                  <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div class="relative">
                      <div
                        class="w-52 h-72 border-4 border-white/80 rounded-full"
                        style="box-shadow: 0 0 0 9999px rgba(0,0,0,0.5);"
                      ></div>
                      <div class="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-white/80 rounded-full"></div>
                      <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-white/80 rounded-full"></div>
                    </div>
                  </div>

                  <!-- Instructions overlay -->
                  <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-5">
                    <p class="text-white text-sm text-center font-medium">
                      Position your face within the oval
                    </p>
                    <p class="text-white/80 text-xs text-center mt-1">
                      Ensure all facial features are clearly visible
                    </p>
                  </div>
                </div>

                <div class="flex gap-3">
                  <button
                    type="button"
                    @click="capturePhoto(true)"
                    class="flex-1 px-6 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Camera class="w-4 h-4" />
                    Capture Photo
                  </button>
                  <button
                    type="button"
                    @click="stopCamera"
                    class="px-4 py-2.5 text-sm font-semibold bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <!-- Preview (selfie) -->
              <div v-if="capturePreview" class="space-y-4">
                <div class="relative flex justify-center">
                  <img
                    :src="capturePreview"
                    alt="Selfie preview"
                    class="w-48 h-60 object-cover rounded-xl border-2 border-gray-200 dark:border-slate-600 shadow-sm"
                  />
                  <div v-if="uploading" class="absolute inset-0 flex items-center justify-center">
                    <div class="bg-black/50 rounded-xl w-48 h-60 flex items-center justify-center">
                      <div class="text-center">
                        <Loader2 class="w-8 h-8 text-white animate-spin mx-auto mb-2" />
                        <p class="text-white text-sm font-medium">Uploading...</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-if="!uploading" class="flex gap-3">
                  <button
                    type="button"
                    @click="confirmCapture"
                    class="flex-1 px-6 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-lg flex items-center justify-center gap-2 shadow-sm hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle class="w-4 h-4" />
                    Confirm & Upload
                  </button>
                  <button
                    type="button"
                    @click="retakeCapture"
                    class="px-4 py-2.5 text-sm font-semibold bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300"
                  >
                    Retake
                  </button>
                </div>
              </div>

              <!-- Camera Error -->
              <p v-if="cameraError" class="mt-3 text-sm text-red-600 flex items-center gap-2">
                <AlertCircle class="w-4 h-4" />
                {{ cameraError }}
              </p>

              <!-- Upload Error -->
              <p v-if="uploadError" class="mt-3 text-sm text-red-600 flex items-center gap-2">
                <AlertCircle class="w-4 h-4" />
                {{ uploadError }}
              </p>
            </div>
          </div>
        </div>

        <!-- Security Notice (shown on capture steps) -->
        <div v-if="step === 'id_photo' || step === 'selfie'" class="mt-4 flex items-start gap-3 p-3 bg-white/60 dark:bg-slate-800/50 rounded-lg border border-gray-200 dark:border-slate-700">
          <Lock class="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
          <div class="text-xs text-gray-500 dark:text-slate-400">
            <strong class="text-gray-700 dark:text-slate-300">Your data is protected.</strong>
            Your photos are encrypted during transfer and storage. They are only used for identity verification and are automatically deleted after processing in accordance with GDPR.
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import {
  Camera,
  Loader2,
  AlertCircle,
  CheckCircle,
  Info,
  Lock,
  UserCircle
} from 'lucide-vue-next'

// For mobile capture, always derive API URL from current hostname so phones on LAN can reach the backend
// (VITE_API_URL points to localhost which isn't reachable from a phone)
const API_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? `http://${window.location.hostname}:3001`
  : (import.meta.env.VITE_API_URL ?? '')

const route = useRoute()
const captureToken = route.params.captureToken as string

// State
const loading = ref(true)
const error = ref('')
const companyName = ref('')
const step = ref<'selfie' | 'done'>('selfie')

// Camera state
const showCamera = ref(false)
const cameraStream = ref<MediaStream | null>(null)
const videoElement = ref<HTMLVideoElement | null>(null)
const canvasElement = ref<HTMLCanvasElement | null>(null)
const cameraError = ref('')

// Capture state
const capturePreview = ref<string | null>(null)
const capturedBlob = ref<Blob | null>(null)
const uploading = ref(false)
const uploadError = ref('')

// Validate token on mount
onMounted(async () => {
  try {
    const response = await fetch(`${API_URL}/api/v2/mobile-capture/${captureToken}`)
    if (!response.ok) {
      const data = await response.json().catch(() => null)
      error.value = data?.message || 'This capture link is invalid or has expired. Please request a new one from your desktop.'
      return
    }
    const data = await response.json()
    companyName.value = data.companyName || ''
  } catch (err) {
    console.error('Token validation error:', err)
    error.value = 'Unable to validate this link. Please check your connection and try again.'
  } finally {
    loading.value = false
  }
})

// Clean up camera on unmount
onBeforeUnmount(() => {
  stopCamera()
})

async function startCamera(facingMode: 'user' | 'environment') {
  cameraError.value = ''
  uploadError.value = ''
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false
    })
    cameraStream.value = stream
    showCamera.value = true

    await nextTick()

    if (videoElement.value) {
      videoElement.value.srcObject = stream
    }
  } catch (err) {
    console.error('Camera access error:', err)
    if (err instanceof Error) {
      if (err.name === 'NotAllowedError') {
        cameraError.value = 'Camera access denied. Please allow camera access in your browser settings and try again.'
      } else if (err.name === 'NotFoundError') {
        cameraError.value = 'No camera found on this device.'
      } else if (err.name === 'NotReadableError') {
        cameraError.value = 'Camera is in use by another application. Please close other apps using the camera and try again.'
      } else {
        cameraError.value = 'Unable to access camera. Please try again.'
      }
    }
  }
}

function stopCamera() {
  if (cameraStream.value) {
    cameraStream.value.getTracks().forEach(track => track.stop())
    cameraStream.value = null
  }
  showCamera.value = false
  if (videoElement.value) {
    videoElement.value.srcObject = null
  }
}

function capturePhoto(mirrorFlip: boolean) {
  if (!videoElement.value || !canvasElement.value) return

  const video = videoElement.value
  const canvas = canvasElement.value

  // Determine dimensions, resize to max 1920px on longest side
  let width = video.videoWidth
  let height = video.videoHeight
  const maxDimension = 1920

  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height / width) * maxDimension)
      width = maxDimension
    } else {
      width = Math.round((width / height) * maxDimension)
      height = maxDimension
    }
  }

  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (ctx) {
    if (mirrorFlip) {
      // For selfie: un-flip the mirrored video so the captured image is not mirrored
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  }

  canvas.toBlob((blob) => {
    if (blob) {
      capturedBlob.value = blob
      capturePreview.value = canvas.toDataURL('image/jpeg', 0.9)
      stopCamera()
    }
  }, 'image/jpeg', 0.9)
}

function retakeCapture() {
  capturePreview.value = null
  capturedBlob.value = null
  uploadError.value = ''
  const facingMode = step.value === 'id_photo' ? 'environment' : 'user'
  startCamera(facingMode)
}

async function confirmCapture() {
  if (!capturedBlob.value) return

  uploading.value = true
  uploadError.value = ''

  try {
    const file = new File(
      [capturedBlob.value],
      `${step.value}-${Date.now()}.jpg`,
      { type: 'image/jpeg' }
    )
    const base64 = await fileToBase64(file)

    const response = await fetch(`${API_URL}/api/v2/mobile-capture/${captureToken}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: step.value,
        fileType: file.type,
        fileName: file.name,
        fileData: base64.split(',')[1]
      })
    })

    if (!response.ok) {
      const data = await response.json().catch(() => null)
      throw new Error(data?.message || 'Upload failed')
    }

    // Selfie uploaded — done
    step.value = 'done'
  } catch (err) {
    console.error('Upload error:', err)
    uploadError.value = err instanceof Error ? err.message : 'Failed to upload photo. Please try again.'
  } finally {
    uploading.value = false
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
  })
}
</script>

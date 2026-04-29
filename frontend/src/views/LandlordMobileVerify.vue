<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
    <div class="text-center pt-6 pb-2 px-4">
      <img src="/PropertyGooseLogo.png" alt="PropertyGoose" class="h-10 mx-auto" />
      <p class="text-sm text-gray-500 mt-1">Identity Verification</p>
    </div>

    <div class="flex-1 flex items-start justify-center px-4 pb-6 pt-2">
      <div class="w-full max-w-lg">

        <!-- Loading -->
        <div v-if="loading" class="bg-white rounded-2xl shadow-xl p-8 text-center">
          <Loader2 class="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p class="text-gray-600">Validating link...</p>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="bg-white rounded-2xl shadow-xl p-8 text-center">
          <AlertCircle class="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 class="text-xl font-bold text-gray-900 mb-2">Link Invalid</h1>
          <p class="text-gray-600">{{ error }}</p>
        </div>

        <!-- Done -->
        <div v-else-if="step === 'done'" class="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle class="w-8 h-8 text-green-600" />
          </div>
          <h1 class="text-xl font-bold text-gray-900 mb-2">Photo Uploaded!</h1>
          <p class="text-gray-600">Return to your desktop to continue.</p>
          <p class="text-sm text-gray-400 mt-4">You may close this tab.</p>
        </div>

        <!-- Capture -->
        <div v-else class="space-y-4">
          <div class="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div class="bg-gradient-to-r from-primary to-orange-500 px-5 py-4">
              <div class="flex items-center gap-2">
                <Camera class="w-6 h-6 text-white" />
                <div>
                  <h1 class="text-lg font-bold text-white">
                    {{ captureType === 'selfie' ? 'Take a Selfie' : 'Photograph your ID' }}
                  </h1>
                  <p class="text-white/80 text-xs">{{ captureType === 'selfie' ? 'Front-facing camera' : 'Use your rear camera' }}</p>
                </div>
              </div>
            </div>

            <div class="p-5">
              <!-- Instructions -->
              <div v-if="!showCamera && !preview">
                <div class="mb-5 bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h4 class="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <Info class="w-4 h-4" /> Tips
                  </h4>
                  <ul v-if="captureType === 'selfie'" class="space-y-1 text-sm text-blue-700">
                    <li>Good lighting — face a window</li>
                    <li>Plain background</li>
                    <li>Remove glasses or hats</li>
                    <li>Look directly at camera</li>
                  </ul>
                  <ul v-else class="space-y-1 text-sm text-blue-700">
                    <li>Place ID on a flat surface</li>
                    <li>Ensure all text is readable</li>
                    <li>Avoid glare and shadows</li>
                    <li>Capture the full document</li>
                  </ul>
                </div>

                <button
                  @click="startCamera"
                  class="w-full px-6 py-3 text-sm font-semibold text-white bg-primary rounded-xl flex items-center justify-center gap-2"
                >
                  <Camera class="w-5 h-5" /> Open Camera
                </button>
              </div>

              <!-- Live camera -->
              <div v-if="showCamera && !preview" class="space-y-4">
                <div class="relative bg-black rounded-xl overflow-hidden" style="max-width: 480px; margin: 0 auto;">
                  <video ref="videoEl" autoplay playsinline class="w-full h-auto" :style="captureType === 'selfie' ? 'transform: scaleX(-1)' : ''"></video>
                  <canvas ref="canvasEl" class="hidden"></canvas>
                  <div v-if="captureType === 'selfie'" class="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div class="w-44 h-60 border-4 border-white/70 rounded-full" style="box-shadow: 0 0 0 9999px rgba(0,0,0,0.5);"></div>
                  </div>
                  <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                    <p class="text-white text-sm text-center font-medium">
                      {{ captureType === 'selfie' ? 'Position your face in the oval' : 'Frame your ID document' }}
                    </p>
                  </div>
                </div>
                <div class="flex gap-3">
                  <button @click="capture" class="flex-1 px-6 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg flex items-center justify-center gap-2">
                    <Camera class="w-4 h-4" /> Capture
                  </button>
                  <button @click="stopCamera" class="px-4 py-2.5 text-sm font-semibold bg-gray-100 rounded-lg text-gray-700">Cancel</button>
                </div>
              </div>

              <!-- Preview -->
              <div v-if="preview" class="space-y-4">
                <div class="flex justify-center">
                  <img :src="preview" alt="Preview" class="max-h-64 object-contain rounded-xl border-2 border-gray-200" />
                </div>
                <div v-if="!uploading" class="flex gap-3">
                  <button @click="confirmUpload" class="flex-1 px-6 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-lg flex items-center justify-center gap-2">
                    <CheckCircle class="w-4 h-4" /> Upload
                  </button>
                  <button @click="retake" class="px-4 py-2.5 text-sm font-semibold bg-gray-100 rounded-lg text-gray-700">Retake</button>
                </div>
                <div v-else class="text-center">
                  <Loader2 class="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                  <p class="text-sm text-gray-500">Uploading...</p>
                </div>
              </div>

              <p v-if="uploadError" class="mt-3 text-sm text-red-600 flex items-center gap-2">
                <AlertCircle class="w-4 h-4" /> {{ uploadError }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { Camera, Loader2, AlertCircle, CheckCircle, Info } from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL
const route = useRoute()
const token = route.params.token as string

const loading = ref(true)
const error = ref('')
const captureType = ref<'id_document' | 'selfie'>('selfie')
const step = ref<'capture' | 'done'>('capture')

const showCamera = ref(false)
const stream = ref<MediaStream | null>(null)
const videoEl = ref<HTMLVideoElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const preview = ref('')
const blob = ref<Blob | null>(null)
const uploading = ref(false)
const uploadError = ref('')

onMounted(async () => {
  try {
    const res = await fetch(`${API_URL}/api/landlord-portal/aml/mobile/${token}`)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      error.value = data?.message || 'This link is invalid or has expired.'
      return
    }
    const data = await res.json()
    captureType.value = data.captureType || 'selfie'
    if (data.alreadyUploaded) step.value = 'done'
  } catch {
    error.value = 'Unable to validate link.'
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => stopCamera())

async function startCamera() {
  uploadError.value = ''
  try {
    const facingMode = captureType.value === 'selfie' ? 'user' : 'environment'
    const s = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false,
    })
    stream.value = s
    showCamera.value = true
    await nextTick()
    if (videoEl.value) videoEl.value.srcObject = s
  } catch (err: any) {
    if (err.name === 'NotAllowedError') uploadError.value = 'Camera access denied.'
    else uploadError.value = 'Unable to access camera.'
  }
}

function stopCamera() {
  stream.value?.getTracks().forEach(t => t.stop())
  stream.value = null
  showCamera.value = false
  if (videoEl.value) videoEl.value.srcObject = null
}

function capture() {
  if (!videoEl.value || !canvasEl.value) return
  const v = videoEl.value, c = canvasEl.value
  let w = v.videoWidth, h = v.videoHeight
  if (w > 1920) { h = Math.round((h / w) * 1920); w = 1920 }
  c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  if (captureType.value === 'selfie') {
    ctx.translate(c.width, 0); ctx.scale(-1, 1)
  }
  ctx.drawImage(v, 0, 0, w, h)
  c.toBlob(b => {
    if (b) { blob.value = b; preview.value = c.toDataURL('image/jpeg', 0.9); stopCamera() }
  }, 'image/jpeg', 0.9)
}

function retake() {
  preview.value = ''; blob.value = null; uploadError.value = ''
  startCamera()
}

async function confirmUpload() {
  if (!blob.value) return
  uploading.value = true; uploadError.value = ''
  try {
    const reader = new FileReader()
    const base64: string = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob.value!)
    })

    const res = await fetch(`${API_URL}/api/landlord-portal/aml/mobile/${token}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileType: 'image/jpeg',
        fileName: `${captureType.value}-${Date.now()}.jpg`,
        fileData: base64.split(',')[1],
      }),
    })

    if (!res.ok) {
      const d = await res.json().catch(() => null)
      throw new Error(d?.message || 'Upload failed')
    }
    step.value = 'done'
  } catch (err: any) {
    uploadError.value = err.message || 'Upload failed'
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div class="max-w-lg w-full">
      <!-- Loading -->
      <div v-if="loading" class="bg-white rounded-xl shadow-lg p-8 text-center">
        <div class="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
        <p class="text-gray-500">Loading...</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="bg-white rounded-xl shadow-lg p-8 text-center">
        <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle class="w-8 h-8 text-red-500" />
        </div>
        <h1 class="text-xl font-bold text-gray-900 mb-2">Link Invalid</h1>
        <p class="text-gray-500">{{ error }}</p>
      </div>

      <!-- Already uploaded -->
      <div v-else-if="context?.alreadyUploaded || submitted" class="bg-white rounded-xl shadow-lg p-8 text-center">
        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle class="w-8 h-8 text-green-500" />
        </div>
        <h1 class="text-xl font-bold text-gray-900 mb-2">Document Uploaded</h1>
        <p class="text-gray-500">Your document has been uploaded successfully. Your agent will review it shortly.</p>
      </div>

      <!-- Upload Form -->
      <div v-else class="bg-white rounded-xl shadow-lg overflow-hidden">
        <!-- Header -->
        <div class="px-8 py-6 bg-gradient-to-r from-primary/5 to-orange-500/5 border-b border-gray-200">
          <div class="flex items-center justify-center gap-3 mb-2">
            <img v-if="context?.logoUrl" :src="context.logoUrl" :alt="context.companyName" class="h-10" />
          </div>
          <h1 class="text-xl font-bold text-gray-900 text-center">Document Required</h1>
          <p class="text-sm text-gray-500 text-center mt-1">{{ context?.companyName }}</p>
        </div>

        <div class="p-8">
          <!-- Issue Description -->
          <div v-if="context?.issueDescription" class="mb-6 p-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg">
            <p class="text-sm font-medium text-amber-800 mb-1">What's needed:</p>
            <p class="text-amber-700">{{ context.issueDescription }}</p>
          </div>

          <!-- File Upload -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-2">Upload Document</label>
            <div
              class="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              @click="fileInput?.click()"
              @dragover.prevent
              @drop.prevent="handleDrop"
            >
              <Upload class="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p v-if="!selectedFile" class="text-gray-500">
                Click to select or drag and drop
              </p>
              <div v-else class="flex items-center justify-center gap-2">
                <FileText class="w-5 h-5 text-primary" />
                <span class="font-medium text-gray-900">{{ selectedFile.name }}</span>
                <button @click.stop="selectedFile = null" class="text-gray-400 hover:text-red-500">
                  <X class="w-4 h-4" />
                </button>
              </div>
            </div>
            <input ref="fileInput" type="file" class="hidden" @change="handleFileSelect" />
          </div>

          <!-- Submit -->
          <button
            @click="submitUpload"
            :disabled="!selectedFile || submitting"
            class="w-full py-3 px-6 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <div v-if="submitting" class="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
            <span>{{ submitting ? 'Uploading...' : 'Upload Document' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { XCircle, CheckCircle, Upload, FileText, X } from 'lucide-vue-next'

const route = useRoute()
const API_URL = import.meta.env.VITE_API_URL ?? ''

const loading = ref(true)
const error = ref('')
const submitted = ref(false)
const submitting = ref(false)
const context = ref<any>(null)
const selectedFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

onMounted(async () => {
  try {
    const token = route.params.token as string
    const response = await fetch(`${API_URL}/api/v2/sections/issue-upload/${token}`)

    if (!response.ok) {
      const data = await response.json()
      error.value = data.error || 'This link is invalid or has expired.'
      return
    }

    context.value = await response.json()
  } catch (e) {
    error.value = 'Unable to load. Please try again later.'
  } finally {
    loading.value = false
  }
})

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files?.length) {
    selectedFile.value = target.files[0]
  }
}

function handleDrop(event: DragEvent) {
  if (event.dataTransfer?.files?.length) {
    selectedFile.value = event.dataTransfer.files[0]
  }
}

async function submitUpload() {
  if (!selectedFile.value) return

  submitting.value = true
  try {
    const token = route.params.token as string
    const file = selectedFile.value

    // Read file as base64
    const reader = new FileReader()
    const base64 = await new Promise<string>((resolve) => {
      reader.onload = () => {
        const result = reader.result as string
        resolve(result.split(',')[1])
      }
      reader.readAsDataURL(file)
    })

    const response = await fetch(`${API_URL}/api/v2/sections/issue-upload/${token}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileData: base64,
        fileName: file.name,
        fileType: file.type
      })
    })

    if (response.ok) {
      submitted.value = true
    } else {
      const data = await response.json()
      alert(data.error || 'Upload failed. Please try again.')
    }
  } catch (e) {
    alert('Upload failed. Please try again.')
  } finally {
    submitting.value = false
  }
}
</script>

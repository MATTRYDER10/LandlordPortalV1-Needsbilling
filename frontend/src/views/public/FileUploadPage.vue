<template>
  <div class="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center p-4">
    <div class="max-w-md w-full">
      <!-- Loading -->
      <div v-if="loading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p class="mt-3 text-gray-500">Loading upload link...</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-8 text-center">
        <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </div>
        <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Link Invalid</h1>
        <p class="text-gray-500 dark:text-slate-400">{{ error }}</p>
      </div>

      <!-- Upload Success -->
      <div v-else-if="uploaded" class="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-8 text-center">
        <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
        </div>
        <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Upload Complete</h1>
        <p class="text-gray-500 dark:text-slate-400">Your {{ documentName }} has been uploaded successfully. You can close this page.</p>
      </div>

      <!-- Upload Form -->
      <div v-else class="bg-white dark:bg-slate-900 rounded-2xl shadow-lg overflow-hidden">
        <div class="p-6 border-b border-gray-200 dark:border-slate-700 text-center">
          <h1 class="text-xl font-bold text-gray-900 dark:text-white">Upload Document</h1>
          <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">{{ documentName }}</p>
        </div>
        <div class="p-6">
          <div
            class="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl p-8 text-center cursor-pointer hover:border-primary transition-colors"
            @click="($refs.fileInput as HTMLInputElement)?.click()"
            @dragover.prevent
            @drop.prevent="handleDrop"
          >
            <input ref="fileInput" type="file" accept="image/*,.pdf" class="hidden" @change="handleFileSelect" />
            <div v-if="!selectedFile">
              <svg class="w-10 h-10 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
              <p class="text-sm text-gray-600 dark:text-slate-400"><span class="text-primary font-medium">Click to upload</span> or drag and drop</p>
              <p class="text-xs text-gray-400 mt-1">PDF, JPG, PNG up to 25MB</p>
            </div>
            <div v-else class="flex items-center justify-center gap-3">
              <svg class="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <div class="text-left">
                <p class="text-sm font-medium text-gray-900 dark:text-white">{{ selectedFile.name }}</p>
                <p class="text-xs text-gray-400">{{ (selectedFile.size / 1024 / 1024).toFixed(1) }} MB</p>
              </div>
            </div>
          </div>

          <p v-if="uploadError" class="text-sm text-red-600 mt-3">{{ uploadError }}</p>

          <button
            v-if="selectedFile"
            @click="uploadFile"
            :disabled="uploading"
            class="w-full mt-4 px-4 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <svg v-if="uploading" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            {{ uploading ? 'Uploading...' : 'Upload Document' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const API_URL = import.meta.env.VITE_API_URL ?? ''
const route = useRoute()
const uploadToken = route.params.token as string

const loading = ref(true)
const error = ref('')
const uploaded = ref(false)
const uploading = ref(false)
const uploadError = ref('')
const selectedFile = ref<File | null>(null)
const documentName = ref('Document')
const uploadLinkData = ref<any>(null)

onMounted(async () => {
  try {
    // Validate the upload token
    const response = await fetch(`${API_URL}/api/v2/upload-link/${uploadToken}`)
    if (!response.ok) {
      error.value = 'This upload link is invalid or has expired. Please request a new one.'
      return
    }
    const data = await response.json()
    uploadLinkData.value = data
    documentName.value = data.documentName || 'Document'
  } catch (err) {
    error.value = 'Unable to validate this link. Please check your connection.'
  } finally {
    loading.value = false
  }
})

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.[0]) {
    selectedFile.value = input.files[0]
    uploadError.value = ''
  }
}

function handleDrop(event: DragEvent) {
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    selectedFile.value = file
    uploadError.value = ''
  }
}

async function uploadFile() {
  if (!selectedFile.value) return

  uploading.value = true
  uploadError.value = ''

  try {
    // Read file as base64
    const reader = new FileReader()
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const result = reader.result as string
        resolve(result.split(',')[1]) // Strip data URL prefix
      }
      reader.onerror = reject
      reader.readAsDataURL(selectedFile.value!)
    })

    const response = await fetch(`${API_URL}/api/v2/upload-link/${uploadToken}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileData: base64,
        fileName: selectedFile.value.name,
        fileType: selectedFile.value.type || 'application/octet-stream'
      })
    })

    if (response.ok) {
      uploaded.value = true
    } else {
      const data = await response.json().catch(() => null)
      uploadError.value = data?.error || 'Failed to upload file. Please try again.'
    }
  } catch (err) {
    uploadError.value = 'Upload failed. Please check your connection and try again.'
  } finally {
    uploading.value = false
  }
}
</script>

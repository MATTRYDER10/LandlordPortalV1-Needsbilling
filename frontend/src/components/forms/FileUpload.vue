<template>
  <div class="space-y-2">
    <label v-if="label" class="block text-sm font-medium text-gray-700 dark:text-slate-300">
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
    </label>

    <!-- Upload Area -->
    <div
      v-if="!file"
      @click="triggerUpload"
      @dragover.prevent="dragover = true"
      @dragleave="dragover = false"
      @drop.prevent="handleDrop"
      class="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all"
      :class="[
        dragover
          ? 'border-primary bg-primary/5'
          : 'border-gray-300 dark:border-slate-600 hover:border-primary hover:bg-gray-50 dark:hover:bg-slate-800',
        error ? 'border-red-500' : ''
      ]"
    >
      <input
        ref="fileInput"
        type="file"
        :accept="accept"
        @change="handleFileSelect"
        class="hidden"
      />
      <Upload class="w-8 h-8 mx-auto text-gray-400 dark:text-slate-500 mb-2" />
      <p class="text-sm text-gray-600 dark:text-slate-400">
        <span class="text-primary font-medium">Click to upload</span> or drag and drop
      </p>
      <p class="text-xs text-gray-500 dark:text-slate-500 mt-1">
        {{ acceptLabel || 'PDF, JPG, PNG up to 25MB' }}
      </p>
    </div>

    <!-- File Preview -->
    <div v-else class="border border-gray-200 dark:border-slate-700 rounded-lg p-3 bg-gray-50 dark:bg-slate-800">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3 min-w-0">
          <div class="p-2 bg-primary/10 rounded">
            <FileText class="w-5 h-5 text-primary" />
          </div>
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ file.name }}</p>
            <p class="text-xs text-gray-500 dark:text-slate-400">{{ formatFileSize(file.size) }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <CheckCircle v-if="uploaded" class="w-5 h-5 text-green-500" />
          <Loader2 v-else-if="uploading" class="w-5 h-5 text-primary animate-spin" />
          <button
            type="button"
            @click="removeFile"
            class="p-1 text-gray-400 hover:text-red-500 transition-colors"
          >
            <X class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- Upload Progress -->
      <div v-if="uploading && !uploaded" class="mt-2">
        <div class="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-1.5">
          <div
            class="bg-primary h-1.5 rounded-full transition-all duration-300"
            :style="{ width: uploadProgress + '%' }"
          ></div>
        </div>
      </div>
    </div>

    <!-- Error Message -->
    <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

    <!-- Help Text -->
    <p v-if="helpText && !error" class="text-xs text-gray-500 dark:text-slate-400">{{ helpText }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Upload, FileText, X, CheckCircle, Loader2 } from 'lucide-vue-next'

const props = defineProps<{
  label?: string
  required?: boolean
  accept?: string
  acceptLabel?: string
  helpText?: string
  maxSize?: number // in MB
  modelValue?: File | null
  uploadUrl?: string
  token?: string
  section?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: File | null]
  'uploaded': [data: { fileId: string; url: string }]
  'error': [message: string]
}>()

const fileInput = ref<HTMLInputElement>()
const file = ref<File | null>(props.modelValue || null)
const dragover = ref(false)
const error = ref('')
const uploading = ref(false)
const uploaded = ref(false)
const uploadProgress = ref(0)

const maxSizeBytes = (props.maxSize || 25) * 1024 * 1024

watch(() => props.modelValue, (newValue) => {
  file.value = newValue || null
})

function triggerUpload() {
  fileInput.value?.click()
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files?.[0]) {
    processFile(target.files[0])
  }
}

function handleDrop(event: DragEvent) {
  dragover.value = false
  if (event.dataTransfer?.files?.[0]) {
    processFile(event.dataTransfer.files[0])
  }
}

async function processFile(selectedFile: File) {
  error.value = ''

  // Validate size
  if (selectedFile.size > maxSizeBytes) {
    error.value = `File size must be less than ${props.maxSize || 25}MB`
    emit('error', error.value)
    return
  }

  // Validate type
  if (props.accept) {
    const acceptedTypes = props.accept.split(',').map(t => t.trim())
    const fileType = selectedFile.type
    const fileExt = '.' + selectedFile.name.split('.').pop()?.toLowerCase()

    const isValid = acceptedTypes.some(type => {
      if (type.startsWith('.')) {
        return fileExt === type.toLowerCase()
      }
      if (type.endsWith('/*')) {
        return fileType.startsWith(type.replace('/*', '/'))
      }
      return fileType === type
    })

    if (!isValid) {
      error.value = 'Invalid file type'
      emit('error', error.value)
      return
    }
  }

  file.value = selectedFile
  emit('update:modelValue', selectedFile)

  // Auto-upload if URL provided
  if (props.uploadUrl && props.token) {
    await uploadFile()
  }
}

async function uploadFile() {
  if (!file.value || !props.uploadUrl || !props.token) return

  uploading.value = true
  uploadProgress.value = 0
  error.value = ''

  const maxAttempts = 2
  let attempt = 0

  while (attempt < maxAttempts) {
    attempt++
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 300000) // 5 min timeout

    try {
      // Convert file to base64
      const base64 = await fileToBase64(file.value)

      // Simulate progress
      const progressInterval = setInterval(() => {
        if (uploadProgress.value < 90) {
          uploadProgress.value += 10
        }
      }, 100)

      const response = await fetch(props.uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: props.section,
          fileType: file.value.type,
          fileName: file.value.name,
          fileData: base64.split(',')[1] // Remove data URL prefix
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      clearInterval(progressInterval)

      if (response.ok) {
        uploadProgress.value = 100
        uploaded.value = true
        const data = await response.json()
        emit('uploaded', data)
        return
      } else if (response.status === 413) {
        const data = await response.json().catch(() => ({}))
        error.value = data.error || 'File is too large. Maximum size is 25MB.'
        emit('error', error.value)
        uploading.value = false
        return
      } else {
        throw new Error('Upload failed')
      }
    } catch (err: any) {
      if (err.name === 'AbortError' && attempt < maxAttempts) {
        console.warn(`[FileUpload] Upload timed out, retrying (attempt ${attempt}/${maxAttempts})...`)
        uploadProgress.value = 0
        continue
      }

      if (err.name === 'AbortError') {
        error.value = 'Upload timed out. Please check your connection and try again.'
      } else if (!navigator.onLine) {
        error.value = 'No internet connection. Please reconnect and try again.'
      } else {
        error.value = 'Failed to upload file. Please try again.'
      }
      emit('error', error.value)
      break
    }
  }

  uploading.value = false
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
  })
}

function removeFile() {
  file.value = null
  uploaded.value = false
  uploadProgress.value = 0
  error.value = ''
  emit('update:modelValue', null)
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
</script>

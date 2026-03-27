<template>
  <div class="space-y-2">
    <label v-if="label" class="block text-sm font-medium text-gray-700 dark:text-slate-300">
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
    </label>

    <!-- Upload Area -->
    <div
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
        multiple
        @change="handleFileSelect"
        class="hidden"
      />
      <Upload class="w-8 h-8 mx-auto text-gray-400 dark:text-slate-500 mb-2" />
      <p class="text-sm text-gray-600 dark:text-slate-400">
        <span class="text-primary font-medium">Click to upload</span> or drag and drop
      </p>
      <p class="text-xs text-gray-500 dark:text-slate-500 mt-1">
        {{ acceptLabel || 'PDF, JPG, PNG up to 25MB each — select multiple files' }}
      </p>
    </div>

    <!-- File Previews -->
    <div v-if="files.length > 0" class="space-y-2">
      <div
        v-for="(f, idx) in files"
        :key="idx"
        class="border border-gray-200 dark:border-slate-700 rounded-lg p-3 bg-gray-50 dark:bg-slate-800"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3 min-w-0">
            <div class="p-2 bg-primary/10 rounded">
              <FileText class="w-5 h-5 text-primary" />
            </div>
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ f.file.name }}</p>
              <p class="text-xs text-gray-500 dark:text-slate-400">{{ formatFileSize(f.file.size) }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <CheckCircle v-if="f.uploaded" class="w-5 h-5 text-green-500" />
            <Loader2 v-else-if="f.uploading" class="w-5 h-5 text-primary animate-spin" />
            <button
              type="button"
              @click="removeFile(idx)"
              class="p-1 text-gray-400 hover:text-red-500 transition-colors"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
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
import { ref } from 'vue'
import { Upload, FileText, X, CheckCircle, Loader2 } from 'lucide-vue-next'

interface TrackedFile {
  file: File
  uploading: boolean
  uploaded: boolean
}

const props = defineProps<{
  label?: string
  required?: boolean
  accept?: string
  acceptLabel?: string
  helpText?: string
  maxSize?: number
  uploadUrl?: string
  token?: string
  section?: string
  fileType?: string
}>()

const emit = defineEmits<{
  'uploaded': [data: { fileId: string; url: string }]
  'error': [message: string]
}>()

const fileInput = ref<HTMLInputElement>()
const files = ref<TrackedFile[]>([])
const dragover = ref(false)
const error = ref('')

const maxSizeBytes = (props.maxSize || 25) * 1024 * 1024

function triggerUpload() {
  fileInput.value?.click()
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files) {
    for (const f of Array.from(target.files)) {
      processFile(f)
    }
  }
  if (fileInput.value) fileInput.value.value = ''
}

function handleDrop(event: DragEvent) {
  dragover.value = false
  if (event.dataTransfer?.files) {
    for (const f of Array.from(event.dataTransfer.files)) {
      processFile(f)
    }
  }
}

async function processFile(selectedFile: File) {
  error.value = ''

  if (selectedFile.size > maxSizeBytes) {
    error.value = `File "${selectedFile.name}" exceeds ${props.maxSize || 25}MB limit`
    emit('error', error.value)
    return
  }

  if (props.accept) {
    const acceptedTypes = props.accept.split(',').map(t => t.trim())
    const fileType = selectedFile.type
    const fileExt = '.' + selectedFile.name.split('.').pop()?.toLowerCase()
    const isValid = acceptedTypes.some(type => {
      if (type.startsWith('.')) return fileExt === type.toLowerCase()
      if (type.endsWith('/*')) return fileType.startsWith(type.replace('/*', '/'))
      return fileType === type
    })
    if (!isValid) {
      error.value = `File "${selectedFile.name}" has an invalid type`
      emit('error', error.value)
      return
    }
  }

  const tracked: TrackedFile = { file: selectedFile, uploading: false, uploaded: false }
  files.value.push(tracked)

  if (props.uploadUrl && props.token) {
    await uploadFile(tracked)
  }
}

async function uploadFile(tracked: TrackedFile) {
  if (!props.uploadUrl || !props.token) return

  tracked.uploading = true

  try {
    const base64 = await fileToBase64(tracked.file)
    const response = await fetch(props.uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: props.section,
        fileType: tracked.file.type,
        fileName: tracked.file.name,
        fileData: base64.split(',')[1]
      })
    })

    if (response.ok) {
      tracked.uploaded = true
      const data = await response.json()
      emit('uploaded', data)
    } else {
      throw new Error('Upload failed')
    }
  } catch (err) {
    error.value = `Failed to upload "${tracked.file.name}"`
    emit('error', error.value)
  } finally {
    tracked.uploading = false
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

function removeFile(idx: number) {
  files.value.splice(idx, 1)
  error.value = ''
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
</script>
